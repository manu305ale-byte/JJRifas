// TASA MANUAL DESACTIVADA
window.JJRIFAS_RATE_CONFIG = {
  fallbackRateVES: null,
  fallbackLabel: 'api requerida'
};

// Inserta los SVG en línea para evitar problemas de MIME, caché o preview de Railway.
(() => {
  async function inlineSvg(img, url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`SVG HTTP ${response.status}`);
      const svgText = await response.text();
      if (!svgText.includes('<svg')) throw new Error('Archivo SVG inválido');
      const wrapper = document.createElement('span');
      wrapper.className = img.className || '';
      wrapper.innerHTML = svgText;
      const svg = wrapper.querySelector('svg');
      if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', img.alt || 'Logo');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
      }
      img.replaceWith(wrapper);
    } catch (error) {
      img.removeAttribute('data-original-logo');
      img.src = url;
      console.warn('No se pudo incrustar SVG:', url, error);
    }
  }

  window.addEventListener('load', () => {
    document.querySelectorAll('img[alt="JJRifas"]').forEach(img => inlineSvg(img, 'assets/logo.svg'));
    document.querySelectorAll('img[alt*="Manuel"], img.creator-logo').forEach(img => inlineSvg(img, 'assets/firma-manuel.svg'));
  });
})();
