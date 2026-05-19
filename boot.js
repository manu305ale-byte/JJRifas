const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'server.js');
const runtimePath = path.join(__dirname, '.runtime-server.js');
let code = fs.readFileSync(sourcePath, 'utf8');

const start = code.indexOf("app.post('/api/reservations/second-payment'");
const end = code.indexOf("\n\napp.post('/api/admin/action'", start);

if (start === -1 || end === -1) {
  throw new Error('No se pudo localizar la ruta second-payment para parchear.');
}

const fixedRoute = `app.post('/api/reservations/second-payment', async (req, res) => {
  try {
    const { numbers, paymentRef, receipt } = req.body || {};
    const secondReceipt = cleanReceipt(receipt);
    const requested = Array.isArray(numbers)
      ? numbers.map(n => String(n).padStart(2, '0')).filter(n => /^\\d{2}$/.test(n))
      : [];

    if (!requested.length || !secondReceipt) {
      return res.status(400).json({ ok: false, error: 'Segundo pago inválido.' });
    }

    const list = await readReservations();
    const updated = [];

    for (const number of requested) {
      const itemIndex = list.findIndex(r => Array.isArray(r.numbers) && r.numbers.includes(number) && r.status === 'partial');
      if (itemIndex === -1) continue;

      const item = list[itemIndex];
      const currentNumbers = Array.isArray(item.numbers) ? item.numbers : [];
      const selectedNumbers = currentNumbers.filter(n => n === number);
      const remainingNumbers = currentNumbers.filter(n => n !== number);

      const secondPaymentRecord = {
        ...item,
        id: \`\${Date.now()}\${Math.random().toString(16).slice(2)}\`,
        status: 'second_pending',
        numbers: selectedNumbers,
        ticketTotal: selectedNumbers.length * 20,
        amount: selectedNumbers.length * 20,
        amountPaid: selectedNumbers.length * 10,
        secondPaymentRef: cleanText(paymentRef, 40),
        secondReceipt,
        secondReportedAt: new Date().toISOString()
      };

      if (remainingNumbers.length) {
        item.numbers = remainingNumbers;
        item.ticketTotal = remainingNumbers.length * 20;
        item.amount = remainingNumbers.length * 10;
        item.amountPaid = remainingNumbers.length * 10;
        list.splice(itemIndex, 0, secondPaymentRecord);
      } else {
        list[itemIndex] = secondPaymentRecord;
      }

      updated.push(number);
    }

    if (!updated.length) {
      return res.status(404).json({ ok: false, error: 'No se encontraron números con pago parcial aprobado.' });
    }

    await writeReservations(list);
    res.json({ ok: true, updated, reservations: list.map(publicReservation) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error reportando segundo pago.' });
  }
});`;

code = code.slice(0, start) + fixedRoute + code.slice(end);
fs.writeFileSync(runtimePath, code, 'utf8');
require(runtimePath);
