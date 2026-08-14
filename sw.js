// Service Worker بسيط — يخزّن الملفات الثابتة (HTML/CSS/JS) مؤقتاً عشان الموقع يفتح أسرع
// ويشتغل حتى لو الاتصال ضعيف. البيانات الحقيقية (الأسئلة، الاقتباسات...) دايماً تجي طازة من Supabase،
// هذا الكاش يغطي شكل الموقع بس، مو محتواه.

const CACHE_NAME = 'ask-quotation-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './supabase-client.js',
  './db.js',
  './app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // لا تكاش طلبات Supabase أبداً — لازم تكون حية دايماً (بيانات حقيقية + ريل تايم)
  if(url.includes('supabase.co') || url.includes('supabase.in')){
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if(response && response.status === 200 && event.request.method === 'GET'){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
