// Service Worker بسيط جداً — الغرض الوحيد منه إنه يخلي المتصفح (خصوصاً أندرويد/كروم)
// يعتبر الموقع "قابل للتثبيت" كتطبيق على الشاشة الرئيسية.
// عن قصد ما فيه أي تخزين مؤقت (cache) — كل طلب يروح للشبكة مباشرة —
// عشان ما نرجع لمشكلة "الموقع يطلع خربان" (كاش عالق) اللي صارت قبل.

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // تمرير مباشر للشبكة، بدون أي كاش
  event.respondWith(fetch(event.request));
});
