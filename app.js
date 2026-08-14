// 🔴 ضع بيانات Supabase الخاصة بك هنا عند الجاهزية
const SUPABASE_URL = 'https://exoqrqndxzqibxwmsebv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3FycW5keHpxaWJ4d21zZWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDg2NTMsImV4cCI6MjEwMjI4NDY1M30.uBMp6_k8IHCN-gscpKcPsMqlwf03g-b4C2wGbJHCWpg';

let sb = null;

// تهيئة الاتصال وآليات الأمان
try {
  if (typeof supabase !== 'undefined' && !SUPABASE_URL.includes('YOUR-PROJECT')) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("فشل تهيئة Supabase:", e);
}

// ================= الحالة العامة =================
let currentUser = null;
let currentTab = 'questions';
let publicPosts = [];
let confessions = [];

// ================= أدوات مساعدة =================
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}

// ================= التحكم بالشاشات =================
function showAuthScreen() {
  const auth = document.getElementById('authScreen');
  const mob = document.getElementById('appMobile');
  const desk = document.getElementById('appDesktop');

  if (auth) auth.style.display = 'flex';
  if (mob) mob.style.display = 'none';
  if (desk) desk.style.display = 'none';
}

function showMainApp() {
  const auth = document.getElementById('authScreen');
  const mob = document.getElementById('appMobile');
  const desk = document.getElementById('appDesktop');

  if (auth) auth.style.display = 'none';
  if (mob) mob.style.display = 'block';
  if (desk) desk.style.display = 'block';
}

// ================= الوضع التجريبي =================
function enableDemoMode() {
  currentUser = { id: 'demo_user', name: 'زائر تجريبي', initials: 'ز', coins: 50 };
  publicPosts = [
    { id: '1', type: 'qa', q: 'ما هو اقتباسك المفضل؟', a: 'العلم نور والجهل تاركٌ صاحبه في الظلمات.', asker_name: 'أحمد', asker_initials: 'أ', created_at: new Date().toISOString() }
  ];
  confessions = [
    { id: 'c1', text: 'هذا منشور تجريبي للتأكد من شاشة العرض.', created_at: new Date().toISOString() }
  ];
  showMainApp();
  render();
  toast('🚀 دخلت بوضع المعاينة التجريبية');
}

// ================= العرض والواجهات =================
function render() {
  if (!currentUser) return;

  let html = '';
  if (currentTab === 'questions') html = renderQuestions();
  else if (currentTab === 'quotes') html = renderQuotes();
  else if (currentTab === 'confessions') html = renderConfessions();
  else if (currentTab === 'profile') html = renderProfile();

  const mobContent = document.getElementById('content');
  const deskContent = document.getElementById('desktopContent');
  if (mobContent) mobContent.innerHTML = html;
  if (deskContent) deskContent.innerHTML = html;

  const coinEl = document.getElementById('dCoinCount');
  if (coinEl) coinEl.textContent = currentUser.coins;
}

function renderQuestions() {
  const qas = publicPosts.filter(p => p.type === 'qa');
  return `
    <div class="page-title">الأسئلة</div>
    <div style="margin-top:14px;">
      ${qas.length === 0 ? `<div class="empty-state">لا توجد أسئلة بعد</div>` :
        qas.map(it => `
          <div class="card">
            <div class="card-head">
              <div class="avatar ${it.anon ? 'anon' : ''}">${it.anon ? '؟' : (it.asker_initials || '?')}</div>
              <div class="name-line">
                <b>${it.anon ? 'سؤال مجهول' : (it.asker_name || 'عضو')}</b>
                <small>${timeAgo(it.created_at)}</small>
              </div>
            </div>
            <div class="q-bubble">${it.q}</div>
            ${it.a ? `<div class="a-text">${it.a}</div>` : `<button class="btn-primary" style="padding:8px 12px; font-size:12px; width:auto;" onclick="openAnswer('${it.id}')">إجابة</button>`}
          </div>
        `).join('')}
    </div>
  `;
}

function renderQuotes() {
  const quotes = publicPosts.filter(p => p.type === 'quote');
  return `
    <div class="page-title">الاقتباسات</div>
    <div style="margin-top:14px;">
      ${quotes.length === 0 ? `<div class="empty-state">لا توجد اقتباسات بعد</div>` :
        quotes.map(q => `
          <div class="card">
            <div style="font-family:'El Messiri',sans-serif; font-size:16px; line-height:1.6;">${q.text || q.q}</div>
            <div style="text-align:left; font-size:12px; color:var(--muted); margin-top:8px;">— ${q.author_name || q.asker_name || 'مجهول'}</div>
          </div>
        `).join('')}
    </div>
  `;
}

function renderConfessions() {
  return `
    <div class="page-title">الاعترافات</div>
    <div style="margin-top:14px;">
      ${confessions.length === 0 ? `<div class="empty-state">لا توجد اعترافات بعد</div>` :
        confessions.map(c => `
          <div class="card">
            <div class="card-head">
              <div class="avatar anon">🎭</div>
              <div class="name-line"><b>اعتراف مجهول</b><small>${timeAgo(c.created_at)}</small></div>
            </div>
            <div class="a-text">${c.text}</div>
          </div>
        `).join('')}
    </div>
  `;
}

function renderProfile() {
  return `
    <div class="card" style="text-align:center;">
      <div class="avatar" style="width:60px; height:60px; margin:0 auto 10px; font-size:22px;">${currentUser.initials}</div>
      <h3>${currentUser.name}</h3>
      <p style="color:var(--muted); font-size:13px; margin-top:4px;">الرصيد: ${currentUser.coins} 🪙</p>
      <button class="btn-primary" style="margin-top:16px;" onclick="location.reload()">تسجيل الخروج</button>
    </div>
  `;
}

// ================= بدء التشغيل المضمون (الحل للمشكلة) =================
window.addEventListener('DOMContentLoaded', () => {
  // إجبار النظام على فتح شاشة التسجيل فوراً كخيار افتراضي لحماية الصفحة من التعليق
  showAuthScreen();

  if (!sb) return;

  // إعطاء مهلة أقصاها 2.5 ثانية للتحقق من الجلسة
  const sessionTimeout = setTimeout(() => {
    console.warn("استغرق الاتصال بـ Supabase وقتاً طويلاً، تم تحويلك لشاشة الدخول.");
  }, 2500);

  sb.auth.getSession()
    .then(({ data }) => {
      clearTimeout(sessionTimeout);
      if (data && data.session) {
        currentUser = {
          id: data.session.user.id,
          name: data.session.user.email ? data.session.user.email.split('@')[0] : 'عضو',
          initials: 'ع',
          coins: 50
        };
        showMainApp();
        render();
      }
    })
    .catch(err => {
      clearTimeout(sessionTimeout);
      console.error("خطأ في التحقق من الجلسة:", err);
    });
});
