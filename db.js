// ================= الحالة العامة (state) =================
let currentUser = null;      // { id, name, initials, coins, vip }
let currentTab = 'questions';
let publicPosts = [];        // منشورات من نوع 'quote' و 'qa'
let confessions = [];
let notifications = [];
let myLikedPostIds = new Set();
let myLikedConfessionIds = new Set();
let followingIds = new Set();
let peopleDirectory = [];    // حسابات حقيقية من قاعدة البيانات

const topics = [
  {name:'الكل', emoji:'✨'},
  {name:'حكمة', emoji:'🧠'},
  {name:'حب', emoji:'❤️'},
  {name:'نجاح', emoji:'🚀'},
  {name:'صداقة', emoji:'🤝'},
  {name:'تحفيز', emoji:'🔥'},
];
function computeTopics(){
  const seedNames = topics.map(t=>t.name);
  const extra = new Set();
  publicPosts.forEach(p=>{ if(p.type==='quote' && p.topic && !seedNames.includes(p.topic)) extra.add(p.topic); });
  return [...topics, ...[...extra].map(name=>({name, emoji:'#'}))];
}
let exploreTopic = 'الكل';
let exploreSearchTerm = '';
let composerMode = 'ask';
let activeQuestion = null;
let authMode = 'login';
let notifPanelOpen = false;

let conversations = [];       // قائمة محادثات الرسائل الخاصة
let activeThreadUserId = null;
let activeThreadUser = null;
let threadMessages = [];
let featuredPost = null;      // الاقتباس المميز الحالي (أعلى لايكات كل 24 ساعة)
let shareText = null;         // النص اللي بيتم اختيار شخص لإرساله له عبر الرسائل

// ================= AUTH (تسجيل الدخول / إنشاء حساب) =================
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('authTitle').textContent = authMode==='login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  document.getElementById('authSub').textContent = authMode==='login' ? 'أدخل بياناتك للمتابعة' : 'خلك أنت — بحساب حقيقي من الصفر';
  document.getElementById('nameField').style.display = authMode==='signup' ? 'block' : 'none';
  document.getElementById('confirmPasswordField').style.display = authMode==='signup' ? 'block' : 'none';
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
  const confirmField = document.getElementById('authPasswordConfirm');
  const name = document.getElementById('authName').value.trim();
  const btn = document.getElementById('authSubmitBtn');

  if(!email || !password){ showAuthError('عبّي البريد وكلمة المرور'); return; }
  if(authMode==='signup' && !name){ showAuthError('اكتب اسمك'); return; }
  if(password.length < 6){ showAuthError('كلمة المرور لازم 6 أحرف على الأقل'); return; }
  if(authMode==='signup' && confirmField && confirmField.value !== password){
    showAuthError('كلمة المرور وتأكيدها مو متطابقين'); return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  if(authMode === 'signup'){
    // الاسم يترسل كـ user metadata — الـ trigger بقاعدة البيانات هو اللي ينشئ صف
    // profiles تلقائياً (يشتغل حتى لو ما فيه جلسة دخول نشطة، مثلاً وقت تأكيد البريد)
    const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ name } } });
    if(error){ showAuthError(error.message); btn.disabled=false; btn.textContent='إنشاء الحساب'; return; }
    if(!data.session){
      toast('تم إنشاء الحساب! تحقق من بريدك لتأكيد الحساب ثم سجّل دخولك.');
      toggleAuthMode();
      btn.disabled = false; btn.textContent = 'دخول';
      return;
    }
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){ showAuthError(error.message); btn.disabled=false; btn.textContent='دخول'; return; }
  }
  // onAuthStateChange بتتكفل تفتح التطبيق بمجرد ما تصير الجلسة جاهزة
}

async function requestPasswordReset(){
  const email = document.getElementById('authEmail').value.trim();
  if(!email){ showAuthError('اكتب بريدك الإلكتروني فوق أولاً'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if(error){ showAuthError(error.message); return; }
  toast('✅ إذا البريد مسجل عندنا، بيوصلك رابط لإعادة تعيين كلمة المرور');
}

async function logout(){
  await sb.auth.signOut();
  currentUser = null;
  document.body.classList.remove('app-active');
  document.getElementById('authScreen').style.display = 'flex';
}

async function loadProfile(userId){
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if(error || !data){ console.warn('profile load error:', error && error.message); return null; }
  return data;
}

async function bootApp(session){
  const profile = await loadProfile(session.user.id);
  if(!profile){
    // صف الحساب مفقود (حالة نادرة) — نسجل خروجه بدل ما نعرض تطبيق مكسور
    showAuthError('صار خلل بجلب حسابك، حاول تسجل الدخول مرة ثانية.');
    await sb.auth.signOut();
    return;
  }
  currentUser = profile;
  document.getElementById('authScreen').style.display = 'none';
  // نضيف كلاس على body بدل ما نتحكم بـ display مباشرة على العنصرين —
  // هذا يخلي الـ CSS (media query) هو اللي يقرر أي واجهة تظهر حسب حجم الشاشة
  document.body.classList.add('app-active');

  await Promise.all([loadPosts(), loadConfessions(), loadMyLikes(), loadNotifications(), loadPeople(), loadFollowing(), loadConversations(), loadFeatured()]);
  render();
  subscribeRealtime();
  hideBootLoader();
}

// ================= تحميل البيانات =================
async function loadPosts(){
  const { data, error } = await sb.from('posts_feed').select('*').order('created_at', { ascending:false }).limit(100);
  if(error){ console.warn('posts load error:', error.message); return; }
  publicPosts = data || [];
  render();
}
async function loadConfessions(){
  const { data, error } = await sb.from('confessions_feed').select('*').order('created_at', { ascending:false }).limit(100);
  if(error){ console.warn('confessions load error:', error.message); return; }
  confessions = data || [];
  render();
}
async function loadMyLikes(){
  if(!currentUser) return;
  const { data } = await sb.from('likes').select('post_id').eq('user_id', currentUser.id);
  myLikedPostIds = new Set((data||[]).map(r=>r.post_id));
  const { data: cData } = await sb.from('confession_likes').select('confession_id').eq('user_id', currentUser.id);
  myLikedConfessionIds = new Set((cData||[]).map(r=>r.confession_id));
}
async function loadNotifications(){
  if(!currentUser) return;
  const { data, error } = await sb.from('notifications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending:false }).limit(30);
  if(error){ console.warn('notifications load error:', error.message); return; }
  notifications = data || [];
  renderNotifBadge();
}
async function loadPeople(){
  if(!currentUser) return;
  const { data, error } = await sb.from('profiles').select('id,name,initials,vip,avatar_url').neq('id', currentUser.id).limit(20);
  if(error){ console.warn('people load error:', error.message); return; }
  peopleDirectory = data || [];
}
async function loadFollowing(){
  if(!currentUser) return;
  const { data } = await sb.from('follows').select('following_id').eq('follower_id', currentUser.id);
  followingIds = new Set((data||[]).map(r=>r.following_id));
}
async function loadFeatured(){
  await sb.rpc('refresh_featured_quote');
  const { data } = await sb.from('app_state').select('featured_post_id').eq('id',1).single();
  if(data && data.featured_post_id){
    const { data: post } = await sb.from('posts').select('*').eq('id', data.featured_post_id).single();
    featuredPost = post || null;
  } else {
    featuredPost = null;
  }
  render();
}
async function loadConversations(){
  if(!currentUser) return;
  const { data } = await sb.from('messages')
    .select('*')
    .or(`from_id.eq.${currentUser.id},to_id.eq.${currentUser.id}`)
    .order('created_at', { ascending:false });
  const map = new Map();
  (data||[]).forEach(m=>{
    const otherId = m.from_id === currentUser.id ? m.to_id : m.from_id;
    if(!map.has(otherId)) map.set(otherId, { userId:otherId, lastText:m.text, lastTime:m.created_at, unread:0 });
    if(m.to_id===currentUser.id && !m.read) map.get(otherId).unread++;
  });
  const ids = [...map.keys()];
  if(ids.length){
    const { data: profs } = await sb.from('profiles').select('id,name,initials,avatar_url').in('id', ids);
    (profs||[]).forEach(p=>{ const c = map.get(p.id); if(c){ c.name=p.name; c.initials=p.initials; c.avatar=p.avatar_url; } });
  }
  conversations = [...map.values()].sort((a,b)=> new Date(b.lastTime) - new Date(a.lastTime));
  renderNotifBadge();
  if(currentTab === 'messages') render();
}

function subscribeRealtime(){
  sb.channel('posts-changes').on('postgres_changes', { event:'*', schema:'public', table:'posts' }, () => loadPosts()).subscribe();
  sb.channel('confessions-changes').on('postgres_changes', { event:'*', schema:'public', table:'confessions' }, () => loadConfessions()).subscribe();
  sb.channel('notif-changes').on('postgres_changes', { event:'*', schema:'public', table:'notifications', filter:`user_id=eq.${currentUser.id}` }, () => loadNotifications()).subscribe();
  sb.channel('messages-changes').on('postgres_changes', { event:'*', schema:'public', table:'messages' }, payload => {
    const row = payload.new || payload.old;
    if(!row) return;
    if(row.from_id === currentUser.id || row.to_id === currentUser.id){
      loadConversations();
      if(activeThreadUserId && (row.from_id === activeThreadUserId || row.to_id === activeThreadUserId)){
        loadThread(activeThreadUserId, activeThreadUser);
      }
    }
  }).subscribe();
}

async function pushNotification(userId, text, meta={}){
  if(!userId || userId === currentUser.id) return; // ما ننبّه المستخدم عن فعله هو نفسه
  await sb.from('notifications').insert([{
    user_id:userId, text, read:false,
    type: meta.type || null,
    post_id: meta.postId || null,
    confession_id: meta.confessionId || null
  }]);
}

// ================= التفاعلات (لايك / متابعة / VIP) =================
async function toggleLike(postId){
  const item = publicPosts.find(p=>p.id===postId);
  if(!item) return;
  const alreadyLiked = myLikedPostIds.has(postId);
  if(alreadyLiked){
    myLikedPostIds.delete(postId);
    item.likes = Math.max(0, item.likes-1);
    const { error } = await sb.from('likes').delete().eq('user_id', currentUser.id).eq('post_id', postId);
    if(error){ console.warn('unlike failed:', error.message); }
  } else {
    myLikedPostIds.add(postId);
    item.likes += 1;
    const { error } = await sb.from('likes').insert([{user_id:currentUser.id, post_id:postId}]);
    if(error){ console.warn('like failed:', error.message); myLikedPostIds.delete(postId); item.likes = Math.max(0, item.likes-1); render(); return; }
    const owner = item.type === 'quote' ? item.author_id : (item.answered_by || item.asked_by);
    pushNotification(owner, `${currentUser.name} أعجب بمنشورك`, {type:'like', postId: postId});
  }
  // اللايك والعملة المكافأة صارت تحسب تلقائياً بقاعدة البيانات (trigger) — نحدّث رصيدنا محلياً للعرض السريع بس
  loadMyProfileCoins();
  render();
}
async function loadMyProfileCoins(){
  const { data } = await sb.from('profiles').select('coins').eq('id', currentUser.id).single();
  if(data){ currentUser.coins = data.coins; render(); }
}
async function toggleConfessionLike(confId){
  const item = confessions.find(c=>c.id===confId);
  if(!item) return;
  const alreadyLiked = myLikedConfessionIds.has(confId);
  if(alreadyLiked){
    myLikedConfessionIds.delete(confId);
    item.likes = Math.max(0, item.likes-1);
    await sb.from('confession_likes').delete().eq('user_id', currentUser.id).eq('confession_id', confId);
  } else {
    myLikedConfessionIds.add(confId);
    item.likes += 1;
    const { error } = await sb.from('confession_likes').insert([{user_id:currentUser.id, confession_id:confId}]);
    if(error){ console.warn('like failed:', error.message); myLikedConfessionIds.delete(confId); item.likes = Math.max(0, item.likes-1); render(); return; }
  }
  loadMyProfileCoins();
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
    pushNotification(targetId, `${currentUser.name} بدأ يتابعك`, {type:'follow'});
  }
  render();
}
async function editMyBio(){
  const newBio = await showConfirm('نبذتك التعريفية', '', {icon:'✍️', okText:'حفظ', danger:false, withInput:true, inputValue: currentUser.bio || '', inputPlaceholder:'اكتب نبذة قصيرة عنك...'});
  if(newBio === false) return;
  const { error } = await sb.from('profiles').update({ bio: newBio || null }).eq('id', currentUser.id);
  if(error){ toast('❌ ما قدرنا نحفظ: ' + error.message); return; }
  currentUser.bio = newBio || null;
  toast('✅ تم تحديث نبذتك');
  render();
}

async function upgradeVip(){
  const { error } = await sb.from('profiles').update({vip:true}).eq('id', currentUser.id);
  if(error){ toast('صار خلل، حاول مرة ثانية'); return; }
  currentUser.vip = true;
  toast('🎉 مبروك! تم تفعيل VIP');
  render();
}

async function deleteMyAccount(){
  const step1 = await showConfirm('حذف الحساب نهائياً', 'هذا حذف نهائي لحسابك وكل محتواك — ما يرجع بعدها.', {icon:'⚠️', okText:'متابعة'});
  if(!step1) return;
  const step2 = await showConfirm('تأكيد أخير', 'بيتحذف حسابك الآن للأبد. أكيد تماماً؟', {icon:'🗑️', okText:'احذف حسابي'});
  if(!step2) return;
  const { error } = await sb.rpc('delete_my_account');
  if(error){ toast('❌ ما قدرنا نحذف الحساب: ' + error.message); console.warn(error.message); return; }
  toast('تم حذف حسابك');
  currentUser = null;
  document.body.classList.remove('app-active');
  document.getElementById('authScreen').style.display = 'flex';
}

// ================= تعديل/حذف المحتوى الخاص بك =================
async function deletePost(postId){
  if(!(await showConfirm('حذف المنشور', 'حذف هذا المنشور نهائياً؟ ما يمكن التراجع.', {icon:'🗑️', okText:'حذف'}))) return;
  const { error } = await sb.from('posts').delete().eq('id', postId);
  if(error){ toast('❌ ما قدرنا نحذف: ' + error.message); return; }
  toast('🗑️ تم الحذف');
  loadPosts();
}
async function deleteConfession(confId){
  if(!(await showConfirm('حذف الاعتراف', 'حذف هذا الاعتراف نهائياً؟ ما يمكن التراجع.', {icon:'🗑️', okText:'حذف'}))) return;
  const { error } = await sb.from('confessions').delete().eq('id', confId);
  if(error){ toast('❌ ما قدرنا نحذف: ' + error.message); return; }
  toast('🗑️ تم الحذف');
  loadConfessions();
}
async function deleteComment(commentId, type, targetId){
  if(!(await showConfirm('حذف التعليق', 'حذف هذا التعليق؟', {icon:'🗑️', okText:'حذف'}))) return;
  const { error } = await sb.from('comments').delete().eq('id', commentId);
  if(error){ toast('❌ ما قدرنا نحذف: ' + error.message); return; }
  if(type === 'post'){
    const item = publicPosts.find(p=>p.id===targetId);
    if(item) item.comments = Math.max(0, (item.comments||0)-1);
  } else {
    const item = confessions.find(c=>c.id===targetId);
    if(item) item.comments = Math.max(0, (item.comments||0)-1);
  }
  render();
  openComments(type, targetId);
}
async function editQuote(postId){
  const item = publicPosts.find(p=>p.id===postId);
  if(!item) return;
  const newText = await showConfirm('تعديل الاقتباس', '', {icon:'✏️', okText:'حفظ', danger:false, withInput:true, inputValue:item.text});
  if(!newText || newText === item.text) return;
  const { error } = await sb.from('posts').update({ text: newText }).eq('id', postId);
  if(error){ toast('❌ ما قدرنا نحفظ التعديل: ' + error.message); return; }
  toast('✅ تم التعديل');
  loadPosts();
}

// ================= الإبلاغ والحظر =================
async function reportContent(type, id){
  const reason = await showConfirm('الإبلاغ عن محتوى', 'وش سبب الإبلاغ؟', {icon:'🚩', okText:'إرسال البلاغ', withInput:true});
  if(reason === false) return;
  const row = { reporter_id: currentUser.id, reason: reason || null };
  if(type === 'post') row.post_id = id;
  else if(type === 'confession') row.confession_id = id;
  else if(type === 'comment') row.comment_id = id;
  else if(type === 'user') row.reported_user_id = id;
  const { error } = await sb.from('reports').insert([row]);
  if(error){ toast('❌ ما قدرنا نرسل البلاغ: ' + error.message); return; }
  toast('✅ تم إرسال البلاغ، شكراً لك');
}
async function blockUser(userId){
  if(!(await showConfirm('حظر هذا الشخص', 'ما راح يقدر يراسلك ولا تشوف بعض بالمستقبل بسهولة.', {icon:'🚫', okText:'حظر'}))) return;
  const { error } = await sb.from('blocks').insert([{ blocker_id: currentUser.id, blocked_id: userId }]);
  if(error){ toast('❌ صار خلل: ' + error.message); return; }
  toast('🚫 تم الحظر');
  closeSheet();
}

// ================= إنشاء المحتوى (composer) =================
async function submitAsk(){
  const txt = document.getElementById('askText').value.trim();
  if(!txt){ toast('اكتب سؤالاً أولاً'); return; }
  const anon = document.getElementById('anonToggle').classList.contains('on');
  const topicEl = document.getElementById('askTopic');
  const topic = (topicEl && topicEl.value.trim()) || 'الكل';
  const { error } = await sb.from('posts').insert([{
    type:'qa', q:txt, a:null, anon, topic,
    asked_by: currentUser.id,
    asker_name: anon ? null : currentUser.name,
    asker_initials: anon ? null : currentUser.initials,
    asker_avatar: anon ? null : (currentUser.avatar_url || null)
  }]);
  if(error){ toast('❌ ما قدرنا ننشر السؤال: ' + error.message); console.warn(error.message); return; }
  toast('✅ تم إرسال سؤالك للجميع (+8 🪙)');
  document.getElementById('askText').value = '';
  if(topicEl) topicEl.value = '';
  closeSheet();
  await loadPosts();
  await loadMyProfileCoins();
}
async function submitShoutout(){
  const txt = document.getElementById('shoutText').value.trim();
  if(!txt){ toast('اكتب نص الشوت أوت أولاً'); return; }
  if(currentUser.coins < 15){ toast('رصيدك من ASKcoins غير كافٍ'); return; }
  if(!(await showConfirm('نشر شوت أوت', 'بينخصم 15 🪙 من رصيدك وينشر لكل الأعضاء فوراً. متأكد؟', {icon:'📢', okText:'نشر ودفع 15 🪙'}))) return;
  const { error } = await sb.rpc('create_shoutout', { q_text: txt });
  if(error){ toast('❌ ما قدرنا ننشر الشوت أوت: ' + error.message); console.warn(error.message); return; }
  toast('📢 تم نشر الشوت أوت — وصل إشعار لكل الأعضاء');
  document.getElementById('shoutText').value = '';
  closeSheet();
  await loadPosts();
  await loadMyProfileCoins();
}
async function submitQuote(){
  const txt = document.getElementById('quoteText').value.trim();
  if(!txt){ toast('اكتب الاقتباس أولاً'); return; }
  const topicEl = document.getElementById('quoteTopic');
  const topic = (topicEl && topicEl.value.trim()) || 'الكل';
  const { error } = await sb.from('posts').insert([{
    type:'quote', text:txt, topic, anon:false,
    author_id: currentUser.id, author_name: currentUser.name, author_initials: currentUser.initials,
    author_avatar: currentUser.avatar_url || null
  }]);
  if(error){ toast('❌ ما قدرنا ننشر الاقتباس: ' + error.message); console.warn(error.message); return; }
  toast('❝ تم نشر اقتباسك للجميع');
  document.getElementById('quoteText').value = '';
  if(topicEl) topicEl.value = '';
  closeSheet();
  loadPosts();
}
async function submitConfession(){
  const txt = document.getElementById('confessionText').value.trim();
  if(!txt){ toast('اكتب اعترافك أولاً'); return; }
  const anon = document.getElementById('confessionAnonToggle').classList.contains('on');
  const row = {
    text:txt, anon,
    user_id: currentUser.id,
    user_name: currentUser.name,
    user_initials: currentUser.initials,
    user_avatar: currentUser.avatar_url || null
  };
  const { error } = await sb.from('confessions').insert([row]);
  if(error){ toast('❌ ما قدرنا ننشر الاعتراف: ' + error.message); console.warn(error.message); return; }
  toast(anon ? '🎭 تم نشر اعترافك بشكل مجهول بالكامل للآخرين' : '🎭 تم نشر اعترافك باسمك');
  document.getElementById('confessionText').value = '';
  closeSheet();
  loadConfessions();
}
async function submitAnswer(){
  const txt = document.getElementById('answerText').value.trim();
  if(!txt || !activeQuestion){ toast('اكتب إجابة أولاً'); return; }
  const { error } = await sb.from('posts')
    .update({
      a:txt, answered_by: currentUser.id,
      answered_by_name: currentUser.name, answered_by_initials: currentUser.initials,
      answered_by_avatar: currentUser.avatar_url || null
    })
    .eq('id', activeQuestion.id)
    .is('a', null); // ينجح بس لو السؤال لسا بدون إجابة — يمنع تعارض لو اثنين جاوبوا بنفس اللحظة
  if(error){ toast('❌ صار خلل: ' + error.message); console.warn(error.message); return; }
  pushNotification(activeQuestion.asked_by, `${currentUser.name} جاوب على سؤالك`, {type:'answer', postId: activeQuestion.id});
  toast('✅ تم نشر إجابتك للجميع (+5 🪙)');
  closeSheet();
  await loadPosts();
  await loadMyProfileCoins();
}

// ================= زيارة حساب شخص =================
async function viewProfile(userId){
  if(!userId) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if(error || !data){ toast('تعذّر فتح هذا الحساب'); return; }

  const isMe = userId === currentUser.id;

  const { count: followerCount } = await sb.from('follows')
    .select('follower_id', { count:'exact', head:true }).eq('following_id', userId);

  // أسئلته: العلنية يشوفها الكل، المجهولة يشوفها هو بس (نفس منطق يحدد اسمه بالمنشور)
  let qQuery = sb.from('posts').select('*').eq('asked_by', userId).eq('type','qa').order('created_at',{ascending:false});
  if(!isMe) qQuery = qQuery.eq('anon', false);
  const { data: userQuestions } = await qQuery;

  // اقتباساته: دايماً علنية
  const { data: userQuotes } = await sb.from('posts').select('*').eq('author_id', userId).eq('type','quote').order('created_at',{ascending:false});

  // اعترافاته: العلنية يشوفها الكل، المجهولة يشوفها هو بس
  let cQuery = sb.from('confessions').select('*').eq('user_id', userId).order('created_at',{ascending:false});
  if(!isMe) cQuery = cQuery.eq('anon', false);
  const { data: userConfessions } = await cQuery;

  renderProfileSheet(data, {
    isMe,
    followerCount: followerCount || 0,
    questions: userQuestions || [],
    quotes: userQuotes || [],
    confessions: userConfessions || []
  });
  document.getElementById('overlay').classList.add('show');
  document.getElementById('profileSheet').classList.add('show');
}

// ================= الرسائل الخاصة (DM) =================
async function loadThread(userId, userInfo){
  activeThreadUserId = userId;
  activeThreadUser = userInfo;
  const { data } = await sb.from('messages')
    .select('*')
    .or(`and(from_id.eq.${currentUser.id},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${currentUser.id})`)
    .order('created_at', { ascending:true });
  threadMessages = data || [];
  const unreadIds = threadMessages.filter(m=>m.to_id===currentUser.id && !m.read).map(m=>m.id);
  if(unreadIds.length){
    sb.from('messages').update({read:true}).in('id', unreadIds).then(()=> loadConversations());
  }
  renderThread();
}
async function openThread(userId, encodedName, initials, avatar){
  const name = unb64(encodedName);
  await loadThread(userId, { name, initials, avatar });
  document.getElementById('overlay').classList.add('show');
  document.getElementById('threadSheet').classList.add('show');
}
async function sendMessage(){
  const el = document.getElementById('threadText');
  const txt = el.value.trim();
  if(!txt || !activeThreadUserId) return;
  el.value = '';
  const { error } = await sb.from('messages').insert([{ from_id:currentUser.id, to_id:activeThreadUserId, text:txt }]);
  if(error){ toast('❌ ما قدرنا نرسل الرسالة: ' + error.message); console.warn(error.message); return; }
  pushNotification(activeThreadUserId, `${currentUser.name} أرسل لك رسالة 💬`, {type:'message'});
  loadThread(activeThreadUserId, activeThreadUser);
  loadConversations();
}

// ---- مشاركة عبر الرسائل ----
function openSharePicker(encodedText){
  shareText = unb64(encodedText);
  renderSharePicker();
  document.getElementById('overlay').classList.add('show');
  document.getElementById('sharePickerSheet').classList.add('show');
}
async function shareToPerson(userId){
  if(!shareText || !userId) return;
  const { error } = await sb.from('messages').insert([{ from_id:currentUser.id, to_id:userId, text: shareText }]);
  if(error){ toast('❌ ما قدرنا نشارك: ' + error.message); return; }
  pushNotification(userId, `${currentUser.name} شارك معك شي 📤`, {type:'message'});
  toast('✅ تم الإرسال');
  closeSheet();
  loadConversations();
}

// ================= مين أعجب =================
async function openLikers(type, id){
  document.getElementById('overlay').classList.add('show');
  document.getElementById('likersSheet').classList.add('show');
  document.getElementById('likersList').innerHTML = `<div class="muted" style="padding:20px;text-align:center;font-size:12px;">...جاري التحميل</div>`;
  const table = type === 'post' ? 'likes' : 'confession_likes';
  const col = type === 'post' ? 'post_id' : 'confession_id';
  const { data, error } = await sb.from(table)
    .select('user_id, profiles(name, initials, avatar_url)')
    .eq(col, id).order('created_at', { ascending:false }).limit(100);
  if(error){
    document.getElementById('likersList').innerHTML = `<div class="muted" style="padding:20px;text-align:center;font-size:12px;">تعذر التحميل</div>`;
    console.warn(error.message);
    return;
  }
  renderLikersList(data || []);
}

// ================= التعليقات =================
let activeCommentTarget = null; // {type:'post'|'confession', id}
let currentComments = [];

async function openComments(type, id){
  activeCommentTarget = {type, id};
  document.getElementById('overlay').classList.add('show');
  document.getElementById('commentsSheet').classList.add('show');
  document.getElementById('commentsList').innerHTML = `<div class="muted" style="padding:20px;text-align:center;font-size:12px;">...جاري التحميل</div>`;
  const col = type === 'post' ? 'post_id' : 'confession_id';
  const { data, error } = await sb.from('comments').select('*').eq(col, id).order('created_at', { ascending:true });
  if(error){ document.getElementById('commentsList').innerHTML = `<div class="muted" style="padding:20px;text-align:center;font-size:12px;">تعذر تحميل التعليقات</div>`; console.warn(error.message); return; }
  currentComments = data || [];
  renderCommentsList();
}
function renderCommentsList(){
  const el = document.getElementById('commentsList');
  if(!el) return;
  if(currentComments.length === 0){
    el.innerHTML = `<div class="empty-state" style="padding:22px 10px;"><div class="big">💬</div>ولا فيه تعليق بعد<br>كن أول من يعلّق</div>`;
    return;
  }
  el.innerHTML = currentComments.map(c => `
    <div class="comment-item">
      <span ${up(c.user_id)}>${c.user_avatar ? `<div class="avatar"><img class="avatar-img" src="${esc(c.user_avatar)}"></div>` : `<div class="avatar">${esc(c.user_initials)||'?'}</div>`}</span>
      <div class="comment-body">
        <b ${up(c.user_id)}>${esc(c.user_name) || 'مستخدم'}</b>
        <div class="ctext">${esc(c.text)}</div>
        <div class="muted" style="font-size:9.5px; margin-top:2px;">${timeAgo(c.created_at)}</div>
      </div>
      ${c.user_id === currentUser.id
        ? `<div class="foot-btn" style="align-self:flex-start;" onclick="deleteComment('${c.id}','${activeCommentTarget.type}','${activeCommentTarget.id}')">🗑️</div>`
        : `<div class="foot-btn" style="align-self:flex-start;" onclick="reportContent('comment','${c.id}')">🚩</div>`}
    </div>
  `).join('');
}
async function submitComment(){
  const txt = document.getElementById('commentText').value.trim();
  if(!txt){ toast('اكتب تعليقاً أولاً'); return; }
  if(!activeCommentTarget) return;
  const { type, id } = activeCommentTarget;
  const row = {
    user_id: currentUser.id, user_name: currentUser.name,
    user_initials: currentUser.initials, user_avatar: currentUser.avatar_url || null,
    text: txt
  };
  row[type === 'post' ? 'post_id' : 'confession_id'] = id;
  const { error } = await sb.from('comments').insert([row]);
  if(error){ toast('❌ ما قدرنا ننشر التعليق: ' + error.message); console.warn(error.message); return; }
  document.getElementById('commentText').value = '';
  if(type === 'post'){
    const item = publicPosts.find(p => p.id === id);
    if(item) item.comments = (item.comments||0) + 1;
  } else {
    const item = confessions.find(c => c.id === id);
    if(item) item.comments = (item.comments||0) + 1;
  }
  render();
  openComments(type, id);
}

// ================= الصورة الشخصية =================
async function uploadAvatar(file){
  if(!file || !currentUser) return;
  if(!file.type || !file.type.startsWith('image/')){ toast('❌ لازم تختار صورة'); return; }
  if(file.size > 5 * 1024 * 1024){ toast('❌ حجم الصورة كبير — الحد الأقصى 5 ميجا'); return; }
  const allowedExt = ['jpg','jpeg','png','gif','webp'];
  let ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  if(!allowedExt.includes(ext)) ext = 'jpg';
  toast('⏳ جاري رفع الصورة...');
  const path = `${currentUser.id}/avatar.${ext}`;
  const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert:true });
  if(upErr){ toast('❌ ما قدرنا نرفع الصورة: ' + upErr.message); console.warn(upErr.message); return; }
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  const publicUrl = data.publicUrl + '?t=' + Date.now();
  const { error: updErr } = await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
  if(updErr){ toast('❌ ما قدرنا نحفظ الصورة: ' + updErr.message); console.warn(updErr.message); return; }
  currentUser.avatar_url = publicUrl;
  toast('✅ تم تحديث صورتك الشخصية');
  render();
}

// ================= تشغيل التطبيق =================
function hideBootLoader(){
  const el = document.getElementById('bootLoader');
  if(el) el.classList.add('hide');
}

async function initApp(){
  if(!supabaseReady){
    document.getElementById('setupNotice').style.display = 'flex';
    hideBootLoader();
    return;
  }

  sb.auth.onAuthStateChange((event, session) => {
    if(session && !currentUser){ bootApp(session); }
    if(!session){
      currentUser = null;
      document.body.classList.remove('app-active');
      document.getElementById('authScreen').style.display = 'flex';
      hideBootLoader();
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if(session){ bootApp(session); }
  else { document.getElementById('authScreen').style.display = 'flex'; hideBootLoader(); }
}
