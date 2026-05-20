window.addEventListener('load', function () {
  var floatButton = document.querySelector('.whatsapp-float');
  if (floatButton) {
    floatButton.href = 'https://wa.me/56928733069';
    floatButton.setAttribute('aria-label', 'Contactar por WhatsApp +56 9 2873 3069');
  }
});
