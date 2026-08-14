// ================= بيانات الاتصال =================
let sb = null;

function initSupabase() {
  try {
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined') {
      sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
  } catch (e) {
    console.warn("تعذر الاتصال بـ Supabase حالياً، سيعمل النظام في الوضع المحلي:", e);
  }
}

// ================= الحالة العامة =================
let currentUser = null;
let currentTab = 'questions';
let publicPosts = [
  { id: '1', type: 'qa', q: 'ما هو هدفك اليوم؟', a: 'العمل وتطوير المهارات.', asker_name: 'أحمد', asker_initials: 'أ', created_at: new Date().toISOString() }
];
let confessions = [
  { id: 'c1', text: 'هذا اعتراف تجريبي للتأكد من المظهر.', created_at: new Date().toISOString() }
];

// ================= أدوات الواجهة =================
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function timeAgo(iso) {
  if (!iso) return 'الآن';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  return `قبل ${Math.floor(diff / 3600)} ساعة`;
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appMobile').style.display = 'none';
  document.getElementById('appDesktop').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  // التحقق من حجم الشاشة لعرض الواجهة المناسبة
  if (window.innerWidth >= 850) {
    document.getElementById('appDesktop').style.display = 'block';
    document.getElementById('appMobile').style.display = 'none';
  } else {
    document.getElementById('appMobile').style.display = 'block';
    document.getElementById('appDesktop').style.display = 'none';
  }
}

function switchTab(tabName) {
  currentTab = tabName;
  render();
}

function enableDemoMode() {
  currentUser = { id: 'demo_user', name: 'زائر تجريبي', initials: 'ز', coins: 50 };
  showMainApp();
  render();
  toast('🚀 تم الدخول بنجاح');
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
              <div class="avatar">${it.asker_initials || '?'}</div>
              <div class="name-line">
                <b>${it.asker_name || 'عضو'}</b>
                <small>${timeAgo(it.created_at)}</small>
              </div>
            </div>
            <div class="q-bubble">${it.q}</div>
            ${it.a ? `<div class="a-text">${it.a}</div>` : ''}
          </div>
        `).join('')}
    </div>
  `;
}

function renderQuotes() {
  return `
    <div class="page-title">الاقتباسات</div>
    <div style="margin-top:14px;">
      <div class="card">
        <div style="font-family:'El Messiri',sans-serif; font-size:16px;">"العلم نور والجهل تاركٌ صاحبه في الظلمات."</div>
      </div>
    </div>
  `;
}

function renderConfessions() {
  return `
    <div class="page-title">الاعترافات</div>
    <div style="margin-top:14px;">
      ${confessions.map(c => `
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
    <div class="card" style="text-align:center; padding: 20px;">
      <div class="avatar" style="width:60px; height:60px; margin:0 auto 10px; font-size:22px;">${currentUser.initials}</div>
      <h3>${currentUser.name}</h3>
      <p style="color:var(--muted); font-size:13px; margin-top:4px;">الرصيد: ${currentUser.coins} 🪙</p>
      <button class="btn-primary" style="margin-top:16px;" onclick="location.reload()">تسجيل الخروج</button>
    </div>
  `;
}

// ================= التشغيل الإجباري المباشر =================
window.onload = () => {
  initSupabase();
  // إظهار شاشة الدخول فوراً وبدون أي تأخير
  showAuthScreen();
};
