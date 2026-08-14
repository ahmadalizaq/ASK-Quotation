// 🔴 ضع بيانات Supabase الخاصة بك هنا عند الجاهزية
const SUPABASE_URL = 'https://exoqrqndxzqibxwmsebv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4b3FycW5keHpxaWJ4d21zZWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDg2NTMsImV4cCI6MjEwMjI4NDY1M30.uBMp6_k8IHCN-gscpKcPsMqlwf03g-b4C2wGbJHCWpg';

let sb = null;

// تهيئة الاتصال بقاعدة البيانات
try {
  if (typeof supabase !== 'undefined' && !SUPABASE_URL.includes('YOUR-PROJECT')) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("فشل الاتصال بـ Supabase:", e);
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

// ================= جلب البيانات من Supabase =================
async function loadDataFromSupabase() {
  if (!sb) return;

  try {
    // جلب الأسئلة والاقتباسات
    const { data: postsData, error: postsErr } = await sb
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (postsErr) throw postsErr;
    if (postsData) publicPosts = postsData;

    // جلب الاعترافات
    const { data: confData, error: confErr } = await sb
      .from('confessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (confErr) throw confErr;
    if (confData) confessions = confData;

    render();
  } catch (err) {
    console.error("خطأ أثناء جلب البيانات:", err);
    toast("⚠️ خطأ في جلب البيانات من قاعدة البيانات: " + (err.message || 'راجع الـ Console'));
  }
}

// ================= التنقل والشاشات =================
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appMobile').style.display = 'none';
  document.getElementById('appDesktop').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appMobile').style.display = 'block';
  document.getElementById('appDesktop').style.display = 'block';
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  render();
}

// ================= المصادقة AUTH =================
let authMode = 'login';
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('authTitle').textContent = authMode === 'login' ? 'تسجيل الدخول' : 'حساب جديد';
  document.getElementById('nameField').style.display = authMode === 'signup' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
}

async function submitAuth() {
  if (!sb) {
    toast('⚠️ لم يتم ربط بيانات Supabase في ملف app.js بعد');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();

  if (!email || !password) { toast('يرجى كتابة البريد وكلمة المرور'); return; }

  try {
    if (authMode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await sb.from('profiles').insert([{ id: data.user.id, name: name || 'عضو جديد', initials: (name[0] || 'A').toUpperCase(), coins: 50 }]);
      }
      toast('تم إنشاء الحساب بنجاح! يمكنك الدخول الآن');
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await initUserSession(data.user);
    }
  } catch (err) {
    toast('❌ ' + (err.message || 'فشل تسجيل الدخول'));
  }
}

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

async function initUserSession(authUser) {
  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', authUser.id).single();
    currentUser = {
      id: authUser.id,
      name: profile?.name || authUser.email.split('@')[0],
      initials: profile?.initials || 'U',
      coins: profile?.coins || 0
    };
    showMainApp();
    await loadDataFromSupabase();
  } catch (e) {
    currentUser = { id: authUser.id, name: 'عضو', initials: 'ع', coins: 10 };
    showMainApp();
    await loadDataFromSupabase();
  }
}

// ================= العرض والواجهات =================
function render() {
  if (!currentUser) return;

  let html = '';
  if (currentTab === 'questions') html = renderQuestions();
  else if (currentTab === 'quotes') html = renderQuotes();
  else if (currentTab === 'confessions') html = renderConfessions();
  else if (currentTab === 'profile') html = renderProfile();

  document.getElementById('content').innerHTML = html;
  const dtContent = document.getElementById('desktopContent');
  if (dtContent) dtContent.innerHTML = html;
  
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
      <button class="btn-primary" style="margin-top:16px;" onclick="logout()">تسجيل الخروج</button>
    </div>
  `;
}

async function logout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  showAuthScreen();
}

// ================= النوافذ والإرسال =================
function openComposer() {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('composerSheet').classList.add('show');
}

function closeSheet() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('composerSheet').classList.remove('show');
  document.getElementById('answerSheet').classList.remove('show');
}

async function submitAsk() {
  const txt = document.getElementById('askText').value.trim();
  if (!txt) return;

  const newPost = {
    type: 'qa', q: txt, a: null,
    asker_name: currentUser.name,
    asker_initials: currentUser.initials,
    created_at: new Date().toISOString()
  };

  if (sb) {
    const { error } = await sb.from('posts').insert([newPost]);
    if (error) { toast('❌ فشل الحفظ في قاعدة البيانات'); return; }
    await loadDataFromSupabase();
  } else {
    publicPosts.unshift({ id: Date.now().toString(), ...newPost });
    render();
  }

  document.getElementById('askText').value = '';
  closeSheet();
  toast('تم إرسال السؤال ✅');
}

// ================= بدء التشغيل =================
window.addEventListener('DOMContentLoaded', async () => {
  if (!sb) {
    showAuthScreen();
  } else {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await initUserSession(session.user);
    } else {
      showAuthScreen();
    }
  }
});
