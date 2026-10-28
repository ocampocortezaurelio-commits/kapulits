// Retiro del POS viejo de GitHub Pages (compuerta 2026-10-26). La app vieja pide
// reg.update() cada cierto tiempo, asi que toma este archivo sola en cuanto tenga red:
// borra su cache, se da de baja y recarga la pagina, que ahora solo redirige a la version nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
