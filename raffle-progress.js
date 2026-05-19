window.addEventListener('load', function () {
  var TOTAL_NUMBERS = 100;
  var ACTIVE_FOR_PROGRESS = ['pending', 'partial', 'second_pending', 'paid'];

  function getProgressNumbers() {
    var list = [];
    try { list = Array.isArray(reservations) ? reservations : []; } catch (_) { list = []; }
    var used = new Set();
    list.forEach(function (reservation) {
      if (!reservation || ACTIVE_FOR_PROGRESS.indexOf(reservation.status) === -1) return;
      (reservation.numbers || []).forEach(function (number) {
        used.add(String(number).padStart(2, '0'));
      });
    });
    return used.size;
  }

  function updateProgress() {
    var fill = document.getElementById('raffleProgressFill');
    var value = document.getElementById('raffleProgressValue');
    var sold = document.getElementById('raffleProgressSold');
    if (!fill || !value || !sold) return;

    var count = getProgressNumbers();
    var percent = Math.max(0, Math.min(100, Math.round((count / TOTAL_NUMBERS) * 100)));
    fill.style.width = percent + '%';
    value.textContent = percent + '%';
    sold.textContent = count + ' / ' + TOTAL_NUMBERS + ' números comprometidos';
  }

  window.updateRaffleProgress = updateProgress;

  var oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function () {
      var result = oldRender.apply(this, arguments);
      setTimeout(updateProgress, 40);
      return result;
    };
  }

  document.addEventListener('click', function (event) {
    if (
      event.target.closest('.number-btn') ||
      event.target.closest('#clearSelectionBtn') ||
      event.target.closest('#selectRandomBtn') ||
      event.target.closest('#adminPanel')
    ) {
      setTimeout(updateProgress, 150);
      setTimeout(updateProgress, 700);
    }
  });

  setTimeout(updateProgress, 250);
  setInterval(updateProgress, 5000);
});
