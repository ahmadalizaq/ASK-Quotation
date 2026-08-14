// 🔴 ضع بيانات Supabase الخاصة بك هنا عند الجاهزية
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'; 
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

// التحقق من صلاحية الاتصال
let sb = null;
try {
  if (typeof supabase !== 'undefined' && SUPABASE_URL.indexOf('YOUR-PROJECT') === -1) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.warn("Supabase not initialized, running in fallback/demo mode.");
}

// ================= الحالة العامة (State) =================
let isDemoMode = false;
let currentUser = null;
let currentTab = 'questions';
let publicPosts = [];
let confessions = [];
let notifications = [];
let myLikedPostIds = new Set();
let myLikedConfessionIds = new Set();

// ================= بيانات تجريبية (Demo Data) =================
const demoPosts = [
  { id: '1', type: 'qa', q: 'ما هي أفضل نصيحة قرأتها هذا العام؟', a: 'أن الاستمرارية تتغلب دائماً على الشغف المؤقت.', asked_by: 'u2', asker_name: 'أحمد', asker_initials: 'أ', likes: 12, created_at: new Date().toISOString() },
  { id: '2', type: 'qa', q: 'هل تعتقد أن الذكاء الاصطناعي سيغير شكل العمل المستقبلي؟', a: null, asked_by: 'u3', asker_name: 'سارة', asker_initials: 'س', likes: 5, created_at: new Date().toISOString() },
  { id: '3', type: 'quote', text: '«العقل كالظل، ينقبض إذا اقتربت من الضوء ويتسع إذا ابتعدت.»', author_name: 'حكمة اليوم', author_initials: 'ح', likes: 24, created_at: new Date().toISOString() }
];

const demoConfessions = [
  { id: 'c1', text: 'أحياناً أتظاهر بالانشغال فقط لأقضي بعض الوقت بمفردي بعيداً عن صخب الحياة.', likes: 8, created_at: new Date().toISOString() }
];

// ================= أدوات مساعدة =================
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}

// ================= التنقل والشاشات =================
function enableDemoMode() {
  isDemoMode = true;
  currentUser = { id: 'demo_user', name: 'زائر تجريبي', initials: 'ز', coins: 50, vip: false };
  publicPosts = [...demoPosts];
  confessions = [...demoConfessions];
  showMainApp();
  render();
  toast('مرحباً بك في الوضع التجريبي 🚀');
}

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
    toast('يرجى إضافة بيانات Supabase أو استخدام وضع الزائر');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();

  if (!email || !password) { toast('يرجى ملء جميع الحقول Required'); return; }

  try {
    if (authMode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await sb.from('profiles').insert([{ id: data.user.id, name, initials: name[0] || 'A', coins: 50 }]);
      }
      toast('تم إنشاء الحساب بنجاح!');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    toast(err.message || 'حدث خطأ في التسجيل');
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
  document.getElementById('desktopContent').innerHTML = html;
  
  document.getElementById('dCoinCount').textContent = currentUser.coins;
  document.getElementById('dCoinWidget').textContent = currentUser.coins + ' 🪙';
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
            ${it.a ? `<div class="a-text">${it.a}</div>` : `<button class="btn-primary" style="padding:8px 12px; font-size:12px;" onclick="openAnswer('${it.id}')">إجابة</button>`}
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
            <div style="font-family:'El Messiri',sans-serif; font-size:16px; line-height:1.6;">${q.text}</div>
            <div style="text-align:left; font-size:12px; color:var(--muted); margin-top:8px;">— ${q.author_name || 'مجهول'}</div>
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
          <div class="confession-card">
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

// ================= النوافذ والمشاركة =================
function openComposer() {
  document.getElementById('overlay').classList.add('show');
  document.getElementById('composerSheet').classList.add('show');
}
function closeSheet() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('composerSheet').classList.remove('show');
  document.getElementById('answerSheet').classList.remove('show');
}

function setComposerMode(mode) {
  document.querySelectorAll('#composerTabs .mode-opt').forEach(d => d.classList.toggle('active', d.dataset.mode === mode));
  document.getElementById('composerAskBody').style.display = mode === 'ask' ? 'block' : 'none';
  document.getElementById('composerShoutBody').style.display = mode === 'shoutout' ? 'block' : 'none';
  document.getElementById('composerQuoteBody').style.display = mode === 'quote' ? 'block' : 'none';
  document.getElementById('composerConfessionBody').style.display = mode === 'confession' ? 'block' : 'none';
}

let activeQuestionId = null;
function openAnswer(id) {
  activeQuestionId = id;
  const q = publicPosts.find(p => p.id === id);
  if (!q) return;
  document.getElementById('answerQuestionPreview').textContent = q.q;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('answerSheet').classList.add('show');
}

// ================= الإرسال =================
function submitAsk() {
  const txt = document.getElementById('askText').value.trim();
  if (!txt) return;
  publicPosts.unshift({
    id: Date.now().toString(),
    type: 'qa', q: txt, a: null,
    asked_by: currentUser.id,
    asker_name: currentUser.name,
    asker_initials: currentUser.initials,
    created_at: new Date().toISOString()
  });
  document.getElementById('askText').value = '';
  closeSheet();
  render();
  toast('تم إرسال السؤال ✅');
}

function submitQuote() {
  const txt = document.getElementById('quoteText').value.trim();
  if (!txt) return;
  publicPosts.unshift({
    id: Date.now().toString(),
    type: 'quote', text: txt,
    author_name: currentUser.name,
    created_at: new Date().toISOString()
  });
  document.getElementById('quoteText').value = '';
  closeSheet();
  render();
  toast('تم نشر الاقتباس ❝');
}

function submitConfession() {
  const txt = document.getElementById('confessionText').value.trim();
  if (!txt) return;
  confessions.unshift({
    id: Date.now().toString(),
    text: txt,
    created_at: new Date().toISOString()
  });
  document.getElementById('confessionText').value = '';
  closeSheet();
  render();
  toast('تم نشر الاعتراف 🎭');
}

function submitAnswer() {
  const txt = document.getElementById('answerText').value.trim();
  if (!txt || !activeQuestionId) return;
  const target = publicPosts.find(p => p.id === activeQuestionId);
  if (target) target.a = txt;
  document.getElementById('answerText').value = '';
  closeSheet();
  render();
  toast('تم نشر إجابتك ✅');
}

// ================= بدء التشغيل =================
window.addEventListener('DOMContentLoaded', () => {
  if (!sb) {
    showAuthScreen();
  } else {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentUser = { id: session.user.id, name: 'عضو', initials: 'ع', coins: 50 };
        showMainApp();
        render();
      } else {
        showAuthScreen();
      }
    });
  }
});
