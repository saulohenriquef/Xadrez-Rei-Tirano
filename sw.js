// sw.js · Xadrez do Rei Tirano · versão 2.0
// Service worker do Xadrez do Rei Tirano
// Ao publicar uma versão nova, basta trocar o index.html no GitHub:
// a página é buscada na rede primeiro, e o cache só é usado offline.
// Se mudar ícones ou este arquivo, aumente o número da VERSAO.
const VERSAO = 'rei-tirano-2.0';
const FONTES = 'rei-tirano-fontes';
const SONS = 'rei-tirano-sons';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== FONTES && k !== SONS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: usa o cache e atualiza em segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTES).then(async c => {
      const hit = await c.match(req);
      const rede = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || rede;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Sons da pasta sons/: toca o que está guardado e atualiza em segundo plano.
  // Arquivo trocado no GitHub vale na próxima abertura; arquivo apagado volta ao som sintetizado.
  if (url.pathname.includes('/sons/')) {
    const rede = caches.open(SONS).then(c => fetch(req).then(r => {
      if (r.ok) c.put(req, r.clone()); else if (r.status === 404) c.delete(req);
      return r;
    }));
    e.respondWith(caches.open(SONS).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) { e.waitUntil(rede.catch(() => {})); return hit; }
      return rede.catch(() => Response.error());
    }));
    return;
  }

  // Página: rede primeiro (pega a versão nova), cache se estiver offline ou lento
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const r = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej('lento'), 4000))
        ]);
        if (r.ok) cache.put('./index.html', r.clone());
        return r;
      } catch {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Demais arquivos: cache primeiro
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
    return r;
  })));
});
