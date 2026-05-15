// TASA MANUAL DESACTIVADA
// Este archivo queda solo como respaldo técnico.
// La web ya no mostrará una tasa manual falsa si la API no responde.
window.JJRIFAS_RATE_CONFIG = {
  fallbackRateVES: null,
  fallbackLabel: 'api requerida'
};

// Asegura que los logos SVG se mantengan aunque exista caché o scripts anteriores.
window.addEventListener('load', () => {
  document.querySelectorAll('img[alt="JJRifas"]').forEach(img => {
    img.src = 'assets/logo.svg';
  });
  document.querySelectorAll('img[alt*="Manuel"], img.creator-logo').forEach(img => {
    img.src = 'assets/firma-manuel.svg';
  });
});
