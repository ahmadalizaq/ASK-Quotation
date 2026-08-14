// ================= الحالة العامة (State) =================
let currentUser = null;      
let currentTab = 'profile';
let publicPosts = [];        
let confessions = [];
let notifications = [];
let myLikedPostIds = new Set();
let myLikedConfessionIds = new Set();
let followingIds = new Set();
let peopleDirectory = [];    

const topics = [
  {name:'الكل', emoji:'✨'},
  {name:'حكمة', emoji:'🧠'},
  {name:'حب', emoji:'❤️'},
  {name:'نجاح', emoji:'🚀'},
  {name:'صداقة', emoji:'🤝'},
  {name:'تحفيز', emoji:'🔥'},
];
let exploreTopic = 'الكل';
let exploreSearchTerm = '';
let composerMode = 'ask';
let activeQuestion = null;
let authMode = 'login';
let notifPanelOpen = false;

// ================= أدوات مساعدة =================
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 2200);
}

function timeAgo(iso){
  if(!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime())/1000;
  if(diff < 60) return 'الآن';
  if(diff < 3600) return `قبل ${Math.floor(diff/60)} دقيقة`;
  if(diff < 86400) return `قبل ${Math.floor(diff/3600)} ساعة`;
  return `قبل ${Math.floor(diff/86400)} يوم`;
}

// ================= إدارة الشاشات =================
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appMobile').style.display = 'none';
  document.getElementById('appDesktop').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appMobile').style.removeProperty('display');
  document.getElementById('appDesktop').style.removeProperty('display');
}

// ================= المصادقة AUTH =================
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('authTitle').textContent = authMode==='login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  document.getElementById('authSub').textContent = authMode==='login' ? 'أدخل بياناتك للمتابعة' : 'خلك أنت — بحساب حقيقي من الصفر';
  document.getElementById('nameField').style.display = authMode==='signup' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').textContent = authMode==='login' ? 'دخول' : 'إنشاء الحساب';
  document.getElementById('authSwitchLine').innerHTML = authMode==='login'
    ? 'ماعندك حساب؟ <a onclick="toggleAuthMode()">أنشئ حساب جديد</a>'
    : 'عندك حساب؟ <a onclick="toggleAuthMode()">سجّل دخولك</a>';
  document.getElementById('authError').classList.remove('show');
}

function showAuthError(msg){
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.add('show');
}

async function submitAuth(){
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const btn = document.getElementById('authSubmitBtn');

  if(!email || !password){ showAuthError('عبّي البريد وكلمة المرور'); return; }
  if(authMode==='signup' && !name){ showAuthError('اكتب اسمك'); return; }
  if(password.length < 6){ showAuthError('كلمة المرور لازم 6 أحرف على الأقل'); return; }

  btn.disabled = true;
  btn.textContent = 'جاري المعالجة...';

  try {
    if(authMode === 'signup'){
      const { data, error } = await sb.auth.signUp({ email, password });
      if(error) throw error;
      if(data.user){
        const initials = name.trim()[0] || 'A';
        await sb.from('profiles').insert([{ id: data.user.id, name, initials, coins: 50, vip: false }]);
      }
      if(!data.session){
        toast('تم إنشاء الحساب! تحقق من بريدك لتأكيد الحساب ثم سجّل دخولك.');
        toggleAuthMode();
        btn.disabled = false; btn.textContent = 'دخول';
        return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
    }
  } catch(err) {
    showAuthError(err.message || 'حدث خطأ في عملية التسجيل');
    btn.disabled = false;
    btn.textContent = authMode==='login' ? 'دخول' : 'إنشاء الحساب';
  }
}

async function logout(){
  await sb.auth.signOut();
  currentUser = null;
  showAuthScreen();
}

async function loadProfile(userId){
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if(error || !data) return null;
  return data;
}

async function bootApp(session){
  const profile = await loadProfile(session.user.id);
  if(!profile){
    showAuthError('تعذر جلب بيانات الحساب.');
    await sb.auth.signOut();
    return;
  }
  currentUser = profile;
  showMainApp();

  await Promise.all([loadPosts(), loadConfessions(), loadMyLikes(), loadNotifications(), loadPeople(), loadFollowing()]);
  render();
  subscribeRealtime();
}

// ================= جلب البيانات =================
async function loadPosts(){
  const { data } = await sb.from('posts').select('*').order('created_at', { ascending:false }).limit(100);
  publicPosts = data || [];
  render();
}
async function loadConfessions(){
  const { data } = await sb.from('confessions').select('*').order('created_at', { ascending:false }).limit(100);
  confessions = data || [];
  render();
}
async function loadMyLikes(){
  if(!currentUser) return;
  const { data: pLikes } = await sb.from('likes').select('post_id').eq('user_id', currentUser.id);
  myLikedPostIds = new Set((pLikes||[]).map(r=>r.post_id));
  const { data: cLikes } = await sb.from('confession_likes').select('confession_id').eq('user_id', currentUser.id);
  myLikedConfessionIds = new Set((cLikes||[]).map(r=>r.confession_id));
}
async function loadNotifications(){
  if(!currentUser) return;
  const { data } = await sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending:false }).limit(30);
  notifications = data || [];
  renderNotifBadge();
}
async function loadPeople(){
  if(!currentUser) return;
  const { data } = await sb.from('profiles').select('id,name,initials,vip').neq('id', currentUser.id).limit(20);
  peopleDirectory = data || [];
}
async function loadFollowing(){
  if(!currentUser) return;
  const { data } = await sb.from('follows').select('following_id').eq('follower_id', currentUser.id);
  followingIds = new Set((data||[]).map(r=>r.following_id));
}

function subscribeRealtime(){
  sb.channel('posts-changes').on('postgres_changes', { event:'*', schema:'public', table:'posts' }, () => loadPosts()).subscribe();
  sb.channel('confessions-changes').on('postgres_changes', { event:'*', schema:'public', table:'confessions' }, () => loadConfessions()).subscribe();
  sb.channel('notif-changes').on('postgres_changes', { event:'*', schema:'public', table:'notifications', filter:`user_id=eq.${currentUser.id}` }, () => loadNotifications()).subscribe();
}

async function pushNotification(userId, text){
  if(!userId || userId === currentUser.id) return;
  await sb.from('notifications').insert([{ user_id:userId, text, read:false }]);
}

// ================= التفاعلات =================
async function toggleLike(postId){
  const item = publicPosts.find(p=>p.id===postId);
  if(!item) return;
  const alreadyLiked = myLikedPostIds.has(postId);
  
  if(alreadyLiked){
    myLikedPostIds.delete(postId);
    item.likes = Math.max(0, item.likes-1);
    sb.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', postId).then(()=>{});
  } else {
    myLikedPostIds.add(postId);
    item.likes += 1;
    sb.from('likes').insert([{user_id:currentUser.id, post_id:postId}]).then(()=>{});
    const owner = item.type === 'quote' ? item.author_id : (item.answered_by || item.asked_by);
    pushNotification(owner, `${currentUser.name} أعجب بمنشورك`);
  }
  sb.rpc('increment_post_likes', { pid: postId, delta: alreadyLiked ? -1 : 1 }).then(()=>{});
  render();
}

async function toggleConfessionLike(confId){
  const item = confessions.find(c=>c.id===confId);
  if(!item) return;
  const alreadyLiked = myLikedConfessionIds.has(confId);

  if(alreadyLiked){
    myLikedConfessionIds.delete(confId);
    item.likes = Math.max(0, item.likes-1);
    sb.from('confession_likes').delete().eq('user_id', currentUser.id).eq('confession_id', confId).then(()=>{});
  } else {
    myLikedConfessionIds.add(confId);
    item.likes += 1;
    sb.from('confession_likes').insert([{user_id:currentUser.id, confession_id:confId}]).then(()=>{});
  }
  sb.rpc('increment_confession_likes', { cid: confId, delta: alreadyLiked ? -1 : 1 }).then(()=>{});
  render();
}

async function toggleFollow(targetId){
  if(followingIds.has(targetId)){
    followingIds.delete(targetId);
    await sb.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetId);
    toast('تم إلغاء المتابعة');
  } else {
    followingIds.add(targetId);
    await sb.from('follows').insert([{follower_id:currentUser.id, following_id:targetId}]);
    toast('تمت المتابعة ✅');
    pushNotification(targetId, `${currentUser.name} بدأ يتابعك`);
  }
  render();
}

async function upgradeVip(){
  const { error } = await sb.from('profiles').update({vip:true}).eq('id', currentUser.id);
  if(error){ toast('حدث خلل، حاول مجدداً'); return; }
  currentUser.vip = true;
  toast('🎉 مبروك! تم تفعيل VIP');
  render();
}

// ================= الإشعارات =================
function renderNotifBadge(){
  const unread = notifications.filter(n=>!n.read).length;
  [document.getElementById('notifBadgeM'), document.getElementById('notifBadgeD')].forEach(el=>{
    if(!el) return;
    if(unread>0){ el.style.display='flex'; el.textContent = unread>9?'9+':unread; }
    else { el.style.display='none'; }
  });
}

function toggleNotifPanel(){
  notifPanelOpen = !notifPanelOpen;
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('show', notifPanelOpen);
  if(notifPanelOpen){
    if(notifications.length === 0){
      panel.innerHTML = `<div class="empty-state" style="padding:26px;">لا توجد إشعارات جديدة</div>`;
    } else {
      panel.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.read?'':'unread'}">
          <span>🔔</span>
          <div><div>${n.text}</div><div class="muted" style="font-size:10px; margin-top:3px;">${timeAgo(n.created_at)}</div></div>
        </div>
      `).join('');
      const unreadIds = notifications.filter(n=>!n.read).map(n=>n.id);
      if(unreadIds.length){
        sb.from('notifications').update({read:true}).in('id', unreadIds).then(()=>{
          notifications.forEach(n=>n.read=true);
          renderNotifBadge();
        });
      }
    }
  }
}

// ================= بناء الواجهة (Rendering) =================
function render(){
  if(!currentUser) return;
  let html = '';
  if(currentTab === 'profile') html = renderProfile();
  else if(currentTab === 'questions') html = renderQuestions();
  else if(currentTab === 'quotes') html = renderQuotesPage();
  else if(currentTab === 'confessions') html = renderConfessions();

  document.getElementById('content').innerHTML = html;
  document.getElementById('desktopContent').innerHTML = html;
  document.getElementById('desktopSidebarRight').innerHTML = renderDesktopSidebar();

  document.getElementById('dCoinCount').textContent = currentUser.coins;
  document.getElementById('dCoinWidget').textContent = currentUser.coins + ' 🪙';
  renderNotifBadge();
}

function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  render();
}

function renderDesktopSidebar(){
  const spotlight = publicPosts.find(p=>p.type==='quote');
  return `
    ${spotlight ? `
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:16px;padding:14px;margin-bottom:14px;">
      <span style="font-size:10px;font-weight:800;color:var(--red);margin-bottom:8px;display:block;">✨ اقتباس مميز</span>
      <div style="font-family:'El Messiri',sans-serif;font-weight:600;font-size:13px;line-height:1.5;color:var(--ink);">${spotlight.text}</div>
      <div class="muted" style="font-size:10.5px; margin-top:8px;">— ${spotlight.anon ? 'مجهول' : spotlight.author_name}</div>
    </div>` : ''}
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:16px;padding:14px;">
      <span style="font-size:10px;font-weight:800;color:var(--red);margin-bottom:10px;display:block;">👥 أعضاء بالمنصة</span>
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:11.5px;">لا يوجد أعضاء جدد حالياً</div>` :
        peopleDirectory.slice(0,5).map(p=>`
        <div class="d-suggest-row">
          <div class="avatar" style="width:30px;height:30px;font-size:11px;border-radius:10px;">${p.initials}</div>
          <div><b>${p.name}</b><span>${p.vip?'عضو VIP':'عضو بالمنصة'}</span></div>
          <button class="d-follow-btn ${followingIds.has(p.id)?'following':''}" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'متابَع':'متابعة'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

function headerSearch(val){
  exploreSearchTerm = val;
  exploreTopic = 'الكل';
  switchTab('quotes');
}

// ---- صفحات التطبيق ----
function renderQuestions(){
  const qas = publicPosts.filter(p=>p.type==='qa');
  return `
    <div class="page-title">الأسئلة</div>
    <div class="muted" style="font-size:12px; margin-bottom:14px;">أسئلة مفتوحة للجميع — جاوب وششارك رأيك</div>
    <div class="composer-trigger" onclick="openComposerMode('ask')">
      <span>عندك سؤال؟ اطرحه الآن...</span>
      <div class="composer-plus">+</div>
    </div>
    <div style="margin-top:16px;">
      ${qas.length===0 ? `<div class="empty-state"><div class="big">❓</div>لا توجد أسئلة بعد<br>كن أول من يطرح سؤالاً</div>` :
        qas.map(it => renderQATile(it)).join('')}
    </div>
  `;
}

function renderQATile(it){
  const liked = myLikedPostIds.has(it.id);
  if(it.a){
    return `
      <div class="card">
        <div class="card-head">
          <div class="avatar ${it.anon?'anon':''}">${it.anon ? '؟' : it.asker_initials || '?'}</div>
          <div class="name-line">
            <b>${it.anon ? 'سؤال مجهول' : (it.asker_name||'')}</b>
            <small>${timeAgo(it.created_at)}${it.is_shoutout ? ' · 📢 شوت أوت' : ''}</small>
          </div>
        </div>
        <div class="q-bubble">${it.q}</div>
        <div class="a-text">${it.a}</div>
        <div class="card-foot">
          <div class="foot-btn ${liked?'liked':''}" onclick="toggleLike('${it.id}')">♥ <span>${it.likes}</span></div>
          <div class="foot-btn" onclick="exportStoryImage('${(it.q+' — '+it.a).replace(/'/g,"\\'")}')">📤 مشاركة</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="card-head">
        <div class="avatar ${it.anon?'anon':''}">${it.anon ? '؟' : it.asker_initials || '?'}</div>
        <div class="name-line">
          <b>${it.anon ? 'سؤال مجهول' : (it.asker_name||'')} ${it.is_shoutout ? '<span class="vip-badge">📢 شوت أوت</span>':''}</b>
          <small>${timeAgo(it.created_at)}</small>
        </div>
      </div>
      <div class="q-bubble">${it.q}</div>
      <button class="btn-primary" style="margin-top:4px;" onclick="openAnswer('${it.id}')">أجب على هذا السؤال</button>
    </div>
  `;
}

function renderQuotesPage(){
  return `
    <div class="page-title">الاقتباسات</div>
    <div class="muted" style="font-size:12px; margin-bottom:12px;">تصفح واكتشف اقتباسات وحكم رائعة</div>
    <div class="composer-trigger" onclick="openComposerMode('quote')">
      <span>شاركنا اقتباس يعجبك...</span>
      <div class="composer-plus">+</div>
    </div>
    <input type="text" class="explore-search" style="margin-top:14px;" placeholder="ابحث عن اقتباس..." value="${exploreSearchTerm}" oninput="onExploreSearch(this.value)">
    <div class="topic-row">
      ${topics.map(t=>`<div class="topic-chip ${exploreTopic===t.name?'active':''}" onclick="setExploreTopic('${t.name}')">${t.emoji} ${t.name}</div>`).join('')}
    </div>
    <div class="exploreResults">${renderExploreResults()}</div>
  `;
}

function matchesExplore(item){
  if(item.type !== 'quote') return false;
  const topicOk = exploreTopic === 'الكل' || item.topic === exploreTopic;
  const term = exploreSearchTerm.trim().toLowerCase();
  const searchOk = !term || item.text.toLowerCase().includes(term) || (item.author_name||'').toLowerCase().includes(term);
  return topicOk && searchOk;
}

function renderExploreResults(){
  const results = publicPosts.filter(matchesExplore);
  if(results.length === 0){
    return `<div class="empty-state" style="padding:30px 10px;"><div class="big">🔍</div>لا توجد نتائج مطابقة</div>`;
  }
  return `<div class="tile-grid">${results.map(it=>renderTile(it)).join('')}</div>`;
}

function renderTile(item){
  const liked = myLikedPostIds.has(item.id);
  return `
    <div class="post-tile">
      <div class="type-ic">❝</div>
      <div class="tile-avatar">${item.author_initials || (item.anon?'؟':'?')}</div>
      <div class="tile-name">${item.anon ? 'مجهول' : (item.author_name||'')}</div>
      <div class="tile-content quote">${item.text}</div>
      <div class="tile-foot">
        <div class="t-like ${liked?'liked':''}" onclick="toggleLike('${item.id}')">♥ ${item.likes}</div>
      </div>
    </div>
  `;
}

function onExploreSearch(val){
  exploreSearchTerm = val;
  document.querySelectorAll('.exploreResults').forEach(el => el.innerHTML = renderExploreResults());
}
function setExploreTopic(name){
  exploreTopic = name;
  render();
}

function renderConfessions(){
  return `
    <div class="page-title">الاعترافات</div>
    <div class="muted" style="font-size:12px; margin-bottom:14px;">اعترافات مجهولة بالكامل وبسرية سرية</div>
    <div class="composer-trigger" onclick="openComposerMode('confession')">
      <span>اكتب اعترافك بشفافية وبدون أثر لهويتك...</span>
      <div class="composer-plus">+</div>
    </div>
    <div style="margin-top:16px;">
      ${confessions.length===0 ? `<div class="empty-state"><div class="big">🎭</div>لا توجد اعترافات بعد</div>` :
        confessions.map(c=>{
        const liked = myLikedConfessionIds.has(c.id);
        return `
        <div class="confession-card">
          <div class="conf-head">
            <div class="conf-ghost">🎭</div>
            <b>اعتراف مجهول</b>
            <span class="muted">${timeAgo(c.created_at)}</span>
          </div>
          <div class="conf-text">${c.text}</div>
          <div class="card-foot" style="margin-top:12px;">
            <div class="foot-btn ${liked?'liked':''}" onclick="toggleConfessionLike('${c.id}')">♥ <span>${c.likes}</span></div>
            <div class="foot-btn" onclick="exportStoryImage('${c.text.replace(/'/g,"\\'")}')">📤 مشاركة</div>
          </div>
        </div>
      `;}).join('')}
    </div>
  `;
}

function renderProfile(){
  const myOpenQuestions = publicPosts.filter(p=>p.type==='qa' && !p.a && p.asked_by===currentUser.id);
  return `
    <div class="profile-cover"></div>
    <div class="profile-header">
      <div class="profile-avatar">${currentUser.initials}</div>
      <div class="profile-name">${currentUser.name} ${currentUser.vip ? '<span class="vip-badge">VIP</span>' : ''}</div>
      ${!currentUser.vip ? `<button class="btn-primary" style="width:auto; padding:8px 18px; margin-top:8px; font-size:12px;" onclick="upgradeVip()">✨ الترقية إلى VIP</button>` : ''}
    </div>

    <div class="stat-card">
      <div><b>${publicPosts.filter(p=>p.answered_by===currentUser.id || p.author_id===currentUser.id).length}</b><span>مساهمة</span></div>
      <div><b>${followingIds.size}</b><span>تتابع</span></div>
      <div><b>${currentUser.coins}</b><span>🪙 عملات</span></div>
    </div>

    <div class="eyebrow">أسئلتك المفتوحة <span>${myOpenQuestions.length}</span></div>
    <div class="card" style="padding:8px 14px;">
      ${myOpenQuestions.length === 0 ? `<div class="empty-state" style="padding:20px;">لا توجد أسئلة معلقة</div>` :
        myOpenQuestions.map(q => `
        <div style="padding:10px 0; border-bottom:1px solid var(--line-on-white);">
          <div style="font-size:13px; color:var(--ink);">${q.q}</div>
          <div class="muted" style="font-size:10px; margin-top:2px;">${timeAgo(q.created_at)}</div>
        </div>
      `).join('')}
    </div>

    <div class="eyebrow">الحساب</div>
    <div class="card">
      <button class="btn-ghost" style="margin:0;" onclick="logout()">🚪 تسجيل الخروج</button>
    </div>
  `;
}

// ================= تصدير بطاقة الاقتباس كصورة =================
function exportStoryImage(text){
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  
  const grad = ctx.createLinearGradient(0,0,1080,1350);
  grad.addColorStop(0,'#EA323C'); grad.addColorStop(1,'#B9151F');
  ctx.fillStyle = grad; ctx.fillRect(0,0,1080,1350);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';

  const words = text.split(' ');
  let lines = []; let line = '';
  ctx.font = 'bold 50px sans-serif';
  words.forEach(w=>{
    const test = line + w + ' ';
    if(ctx.measureText(test).width > 820 && line){ lines.push(line); line = w + ' '; }
    else line = test;
  });
  lines.push(line);

  const startY = 675 - (lines.length*65)/2;
  lines.forEach((l,i)=> ctx.fillText(l.trim(), 540, startY + i*75));

  ctx.font = '700 32px sans-serif';
  ctx.fillText('ASK & Quotation', 540, 1240);

  const link = document.createElement('a');
  link.download = 'quote.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('📤 تم حفظ الصورة بنجاح');
}

// ================= النوافذ المنبثقة (Composer & Answer) =================
function openComposer(){
  document.getElementById('overlay').classList.add('show');
  document.getElementById('composerSheet').classList.add('show');
}
function openComposerMode(mode){
  openComposer();
  setComposerMode(mode);
}
function closeSheet(){
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('composerSheet').classList.remove('show');
  document.getElementById('answerSheet').classList.remove('show');
}
function setComposerMode(mode){
  composerMode = mode;
  document.querySelectorAll('#composerTabs .mode-opt').forEach(d => d.classList.toggle('active', d.dataset.mode === mode));
  document.getElementById('composerAskBody').style.display = mode==='ask' ? 'block':'none';
  document.getElementById('composerShoutBody').style.display = mode==='shoutout' ? 'block':'none';
  document.getElementById('composerQuoteBody').style.display = mode==='quote' ? 'block':'none';
  document.getElementById('composerConfessionBody').style.display = mode==='confession' ? 'block':'none';
}

function openAnswer(postId){
  activeQuestion = publicPosts.find(p=>p.id===postId);
  if(!activeQuestion) return;
  document.getElementById('answerQuestionPreview').textContent = activeQuestion.q;
  document.getElementById('answerText').value = '';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('answerSheet').classList.add('show');
}

// ================= العمليات وإرسال البيانات =================
async function submitAsk(){
  const txt = document.getElementById('askText').value.trim();
  if(!txt){ toast('اكتب سؤالاً أولاً'); return; }
  const anon = document.getElementById('anonToggle').classList.contains('on');
  const { error } = await sb.from('posts').insert([{
    type:'qa', q:txt, a:null, anon,
    asked_by: currentUser.id,
    asker_name: anon ? null : currentUser.name,
    asker_initials: anon ? null : currentUser.initials
  }]);
  if(error){ toast('تعذر نشر السؤال'); return; }
  toast('✅ تم نشر سؤالك');
  document.getElementById('askText').value = '';
  closeSheet();
  loadPosts();
}

async function submitShoutout(){
  const txt = document.getElementById('shoutText').value.trim();
  if(!txt){ toast('اكتب الشوت أوت أولاً'); return; }
  if(currentUser.coins < 15){ toast('رصيد العملات لا يكفي'); return; }
  const { error } = await sb.from('posts').insert([{
    type:'qa', q:txt, a:null, anon:false, is_shoutout:true,
    asked_by: currentUser.id, asker_name: currentUser.name, asker_initials: currentUser.initials
  }]);
  if(error){ toast('تعذر النشر'); return; }
  await sb.from('profiles').update({coins: currentUser.coins - 15}).eq('id', currentUser.id);
  currentUser.coins -= 15;
  toast('📢 تم نشر الشوت أوت');
  document.getElementById('shoutText').value = '';
  closeSheet();
  loadPosts();
}

async function submitQuote(){
  const txt = document.getElementById('quoteText').value.trim();
  if(!txt){ toast('اكتب الاقتباس أولاً'); return; }
  const { error } = await sb.from('posts').insert([{
    type:'quote', text:txt, topic:'الكل', anon:false,
    author_id: currentUser.id, author_name: currentUser.name, author_initials: currentUser.initials
  }]);
  if(error){ toast('تعذر نشر الاقتباس'); return; }
  toast('❝ تم نشر الاقتباس');
  document.getElementById('quoteText').value = '';
  closeSheet();
  loadPosts();
}

async function submitConfession(){
  const txt = document.getElementById('confessionText').value.trim();
  if(!txt){ toast('اكتب اعترافك أولاً'); return; }
  const { error } = await sb.from('confessions').insert([{ text:txt }]);
  if(error){ toast('تعذر نشر الاعتراف'); return; }
  toast('🎭 تم نشر اعترافك بشكل مجهول');
  document.getElementById('confessionText').value = '';
  closeSheet();
  loadConfessions();
}

async function submitAnswer(){
  const txt = document.getElementById('answerText').value.trim();
  if(!txt || !activeQuestion){ toast('اكتب الإجابة أولاً'); return; }
  const { error } = await sb.from('posts')
    .update({ a:txt, answered_by: currentUser.id })
    .eq('id', activeQuestion.id);
  if(error){ toast('حدث خلل أثناء الإجابة'); return; }
  await sb.from('profiles').update({coins: currentUser.coins + 3}).eq('id', currentUser.id);
  currentUser.coins += 3;
  pushNotification(activeQuestion.asked_by, `${currentUser.name} أجاب على سؤالك`);
  toast('✅ تم إرسال الإجابة');
  closeSheet();
  loadPosts();
}

// ================= تشغيل التطبيق =================
async function initApp(){
  if(typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('YOUR_')){
    document.getElementById('setupNotice').style.display = 'flex';
    return;
  }

  sb.auth.onAuthStateChange((event, session) => {
    if(session && !currentUser){ bootApp(session); }
    if(!session){
      currentUser = null;
      showAuthScreen();
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if(session){ bootApp(session); }
  else { showAuthScreen(); }
}

// بدء التشغيل والتأكد من تسجيل ServiceWorker
window.addEventListener('DOMContentLoaded', () => {
  initApp();
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
