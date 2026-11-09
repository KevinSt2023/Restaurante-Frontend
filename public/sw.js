/*
 * Service worker de Valexa.
 *
 * Escrito a mano a propósito, en vez de usar @angular/service-worker: esta app
 * vive de la API y lo único que debe guardar es su propia cáscara. Un caché
 * agresivo acá no da offline —los datos igual vienen del servidor— y sí puede
 * servir una versión vieja del sistema a un restaurante en pleno servicio.
 *
 * LAS TRES REGLAS, EN ORDEN:
 *
 *   1. La API NUNCA se cachea. Ni una respuesta, ni por un segundo. Una mesa
 *      con un total viejo es plata mal cobrada.
 *   2. La navegación es network-first con respaldo en caché. Si hay señal, se
 *      ve lo último; si se cayó, al menos abre en vez de mostrar el dinosaurio.
 *   3. SOLO lo que lleva hash en el nombre se guarda de verdad. Un nombre con
 *      hash es un contrato: si cambia el contenido, cambia el nombre. Lo que no
 *      lo lleva va a la red primero, o el despliegue de hoy sirve la app de ayer.
 *
 * Al cambiar VERSION se borran los cachés viejos en la activación.
 */
const VERSION = 'valexa-v2';
const CASCARA = `cascara-${VERSION}`;
const ESTATICOS = `estaticos-${VERSION}`;

// Lo mínimo para que la app abra sin señal.
const PRECARGA = [
  '/',
  '/favicon.png',
  '/manifest.webmanifest',
  '/logo-valexa.webp',
  '/logo-valexa-oscuro.webp',
  '/logo-marca.webp',
  '/logo-marca-oscuro.webp',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CASCARA)
      // Si algún archivo no está, no se tumba la instalación entera.
      .then((c) => Promise.allSettled(PRECARGA.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((llaves) => Promise.all(
        llaves.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Solo se guarda de verdad lo que lleva HASH en el nombre: `main-A1B2C3D4.js`.
 * Un nombre con hash es un contrato — si el contenido cambia, cambia el nombre —
 * así que cachearlo es seguro para siempre.
 *
 * Todo lo demás (`main.js` sin hash, logos, el index) va a la red primero. Esta
 * distinción no es un detalle: sin ella el service worker sirve una versión
 * vieja del sistema después de cada despliegue, y un restaurante en pleno
 * servicio se queda con la app de ayer. Pasó en pruebas antes de escribirla.
 */
function esInmutable(url) {
  return /-[A-Za-z0-9_]{8,}\.(js|css|woff2?)$/.test(url.pathname);
}

/** Estático del propio build, con o sin hash. */
function esDelBuild(url) {
  return /\.(js|css|woff2?|png|webp|svg|ico|json|webmanifest)$/i.test(url.pathname);
}

/** Red primero; si no hay señal, lo guardado. Y se refresca el caché al pasar. */
function redPrimero(pedido, nombreCache) {
  return fetch(pedido)
    .then((respuesta) => {
      if (respuesta && respuesta.status === 200) {
        const copia = respuesta.clone();
        caches.open(nombreCache).then((c) => c.put(pedido, copia)).catch(() => {});
      }
      return respuesta;
    })
    .catch(() => caches.match(pedido).then((r) => r ?? Response.error()));
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  // 1. La API, de frente a la red. Nunca se guarda.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/archivos')) return;
  if (url.origin !== self.location.origin) return;

  // 2. Navegación: red primero, caché de respaldo para que al menos abra.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CASCARA).then((c) => c.put('/', copia)).catch(() => {});
          return respuesta;
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error()))
    );
    return;
  }

  if (!esDelBuild(url)) return;

  // 3. Con hash, de caché y listo: el nombre garantiza el contenido.
  if (esInmutable(url)) {
    evento.respondWith(
      caches.match(pedido).then((guardado) => guardado ?? redPrimero(pedido, ESTATICOS))
    );
    return;
  }

  // 4. Sin hash, red primero: nunca servir un archivo viejo con nombre nuevo.
  evento.respondWith(redPrimero(pedido, ESTATICOS));
});

// La app avisa cuando hay versión nueva y el usuario acepta recargar.
self.addEventListener('message', (evento) => {
  if (evento.data === 'actualizar') self.skipWaiting();
});
