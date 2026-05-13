(() => {
  const encoder = new TextEncoder();

  function getVisibleReservationsForExport() {
    if (typeof filteredReservations === 'function') return filteredReservations();
    return Array.isArray(window.reservations) ? window.reservations : [];
  }

  function sanitizeFilename(value) {
    return String(value || 'sin-nombre')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'comprobante';
  }

  function base64ToBytes(dataUrl) {
    const base64 = String(dataUrl).split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function dataUrlToPngBytes(dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const pngData = canvas.toDataURL('image/png');
    return base64ToBytes(pngData);
  }

  function textToPngBytes(lines) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d6b448';
    ctx.font = 'bold 44px Arial';
    ctx.fillText('JJRIFAS - COMPROBANTE NO VISUAL', 60, 90);
    ctx.fillStyle = '#fff8d6';
    ctx.font = '28px Arial';
    lines.forEach((line, index) => ctx.fillText(line, 60, 160 + index * 48));
    return base64ToBytes(canvas.toDataURL('image/png'));
  }

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }
  const crcTable = makeCrcTable();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, date: dosDate };
  }

  function u16(value) { return [value & 0xff, (value >>> 8) & 0xff]; }
  function u32(value) { return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]; }

  function createZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const dt = dosDateTime();

    files.forEach(file => {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const localHeader = new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(dt.time), ...u16(dt.date),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)
      ]);
      localParts.push(localHeader, nameBytes, data);

      const centralHeader = new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(dt.time), ...u16(dt.date),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
      ]);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + data.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(offset), ...u16(0)
    ]);

    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  async function exportReceiptsZip() {
    const rows = getVisibleReservationsForExport();
    if (!rows.length) {
      alert('No hay comprobantes para exportar en esta sección.');
      return;
    }

    const files = [];
    for (const row of rows) {
      const base = `${row.numbers?.join('-') || 'sin-numero'}_${sanitizeFilename(row.name)}_${row.status}`;
      if (row.receipt?.data && row.receipt?.type?.includes('image')) {
        files.push({ name: `${base}_comprobante-inicial.png`, data: await dataUrlToPngBytes(row.receipt.data) });
      } else if (row.receipt?.data) {
        files.push({ name: `${base}_comprobante-inicial.png`, data: textToPngBytes([
          `Participante: ${row.name || 'Sin nombre'}`,
          `Números: ${row.numbers?.join(', ') || '-'}`,
          `Estado: ${row.status}`,
          `El comprobante inicial no era imagen.`,
          `Archivo original: ${row.receipt.name || 'PDF/documento'}`
        ]) });
      }

      if (row.secondReceipt?.data && row.secondReceipt?.type?.includes('image')) {
        files.push({ name: `${base}_segundo-comprobante.png`, data: await dataUrlToPngBytes(row.secondReceipt.data) });
      } else if (row.secondReceipt?.data) {
        files.push({ name: `${base}_segundo-comprobante.png`, data: textToPngBytes([
          `Participante: ${row.name || 'Sin nombre'}`,
          `Números: ${row.numbers?.join(', ') || '-'}`,
          `Estado: ${row.status}`,
          `El segundo comprobante no era imagen.`,
          `Archivo original: ${row.secondReceipt.name || 'PDF/documento'}`
        ]) });
      }
    }

    if (!files.length) {
      alert('Los registros visibles no tienen comprobantes exportables.');
      return;
    }

    const zip = createZip(files);
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jjrifas-comprobantes-${adminFilter || 'todos'}-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function attachExportButton() {
    const button = document.getElementById('exportDataBtn');
    if (!button) return;
    button.onclick = exportReceiptsZip;
  }

  window.addEventListener('load', attachExportButton);
  setTimeout(attachExportButton, 300);
})();
