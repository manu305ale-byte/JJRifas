// TASA MANUAL DESACTIVADA
// No se manipulan los logos por JavaScript: se cargan directamente desde los SVG enlazados en el HTML.
window.JJRIFAS_RATE_CONFIG = { fallbackRateVES: null, fallbackLabel: 'api requerida' };

// Carga segura de mejoras visuales/UX sin tocar el HTML principal.
window.addEventListener('load', function () {
  if (!document.querySelector('link[href="frontend-improvements.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'frontend-improvements.css';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[src="frontend-ux.js"]')) {
    var script = document.createElement('script');
    script.src = 'frontend-ux.js';
    script.defer = true;
    document.body.appendChild(script);
  }
});
