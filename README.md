# JJRifas - Landing de rifas

Landing web estática para gestionar una rifa de 100 números con carga de comprobantes y panel privado de administración.

## Características

- Diseño visual negro/dorado.
- Logo de JJRifas integrado.
- 100 números disponibles.
- Números libres en verde.
- Números pendientes por aprobar en amarillo.
- Números aprobados con comprobante en rojo.
- Formulario para reservar números y cargar comprobante.
- Panel admin para aprobar, rechazar o liberar números.
- Botón flotante de WhatsApp hacia +56 9 2873 3069.
- Exportación de reservas en JSON.

## Cómo abrirlo

Solo abre el archivo `index.html` en el navegador.

## Panel admin

La clave está configurada dentro de `app.js`, en esta línea:

```js
adminPassword: 'admin123'
```

Puedes cambiarla por otra antes de publicar.

## Importante

Esta versión guarda los datos en `localStorage`, es decir, en el navegador donde se usa. Sirve para probar o para uso básico local.

Para que múltiples usuarios puedan reservar números desde internet al mismo tiempo y para que los comprobantes queden guardados en servidor, se debe conectar a una base de datos/back-end como Supabase, Firebase, PostgreSQL o similar.
