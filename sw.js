// Rodagem: guarda o app no aparelho para abrir sem internet.
// A cada versão nova, mude o número abaixo junto com APP_VERSION do index.html.
const VERSAO = '1.0.1';
const CACHE = 'rodagem-' + VERSAO;
const ARQUIVOS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  // não ativa sozinha: espera o usuário tocar em "Atualizar agora"
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all([...ARQUIVOS, ...EXTERNOS].map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('rodagem-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return; // dados sempre da internet
  if (url.searchParams.has('v')) return; // checagem de versão nova

  // config.js: tenta a internet primeiro para pegar chaves atualizadas
  if (url.origin === location.origin && url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req)));
    return;
  }

  const permitido = url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!permitido) return;

  // app, bibliotecas e fontes: usa o que está guardado; se não tiver, baixa e guarda
  e.respondWith(caches.match(req, { ignoreSearch: url.origin === location.origin && req.mode === 'navigate' }).then(salvo => salvo ||
    fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : undefined)
  ));
});
