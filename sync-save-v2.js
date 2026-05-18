// DESACTIVADO
// Este archivo antes reenviaba localStorage al backend en cada clic del admin.
// Eso podía restaurar comprobantes eliminados o estados viejos.
// La sincronización actual usa rutas específicas:
// - POST /api/reservations/create
// - POST /api/reservations/second-payment
// - POST /api/admin/action
window.syncReservationsNow = function(){ return Promise.resolve(); };
