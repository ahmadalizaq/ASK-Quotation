// ================= أدوات عامة =================
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${msg}</span>`;
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(()=> t.classList.remove('show'), 2600);
}
// يكبّر مربع النص تلقائياً مع الكتابة، ويحدّث عداد الأحرف تحته
function growAndCount(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 260) + 'px';
  const counter = document.getElementById(el.id + '-count');
  if(counter){
    const max = parseInt(el.getAttribute('maxlength')) || 0;
    const len = el.value.length;
    counter.textContent = `${len}/${max}`;
    counter.classList.toggle('warn', max>0 && len > max*0.85 && len <= max);
    counter.classList.toggle('max', max>0 && len >= max);
  }
}

// ================= نافذة تأكيد مخصصة (تحل محل confirm/prompt المتصفح) =================
let _modalResolve = null;
function showConfirm(title, text, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    _modalResolve = resolve;
    document.getElementById('confirmIcon').textContent = opts.icon || '⚠️';
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text || '';
    document.getElementById('confirmOkBtn').textContent = opts.okText || 'تأكيد';
    document.getElementById('confirmOkBtn').style.background = opts.danger === false ? 'var(--ink)' : 'var(--red)';
    const inputWrap = document.getElementById('confirmInputWrap');
    const input = document.getElementById('confirmInput');
    inputWrap.style.display = opts.withInput ? 'block' : 'none';
    input.value = opts.inputValue || '';
    input.placeholder = opts.inputPlaceholder || 'اكتب هنا (اختياري)...';
    document.getElementById('confirmOkBtn').onclick = () => {
      const val = opts.withInput ? input.value.trim() : true;
      _closeModalInternal();
      resolve(val);
    };
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('confirmModal').classList.add('show');
  });
}
function closeModal(){
  _closeModalInternal();
  if(_modalResolve) _modalResolve(false);
}
function _closeModalInternal(){
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('confirmModal').classList.remove('show');
}

// يشغّل حركة نبض القلب فوراً عند الضغط، بدون انتظار الشبكة
function popHeart(el){
  el.classList.add('heart-pop');
  setTimeout(()=> el.classList.remove('heart-pop'), 350);
}
function timeAgo(iso){
  if(!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime())/1000;
  if(diff < 60) return 'الآن';
  if(diff < 3600) return `قبل ${Math.floor(diff/60)} دقيقة`;
  if(diff < 86400) return `قبل ${Math.floor(diff/3600)} ساعة`;
  return `قبل ${Math.floor(diff/86400)} يوم`;
}
// تنظيف أي نص كتبه مستخدم قبل حقنه بـ HTML — يمنع XSS. يُستخدم على كل نص مستخدم بالتطبيق.
function esc(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// نسخة آمنة لتضمين نص داخل سمة onclick بصيغة '...' (تهرب من علامات الاقتباس والحقن معاً)
function escAttr(str){
  return esc(str).replace(/`/g, '&#96;');
}
// ترميز نص حر (يحتمل يحتوي على علامات اقتباس أو HTML) قبل تمريره كوسيط داخل onclick —
// أأمن من escAttr لأنه ما يتأثر بترتيب فك تشفير HTML/JS بالمتصفح إطلاقاً.
function b64(str){ return btoa(unescape(encodeURIComponent(str||''))); }
function unb64(str){ try { return decodeURIComponent(escape(atob(str))); } catch(e){ return ''; } }

// ================= الإشعارات (واجهة) =================
function renderNotifBadge(){
  const unreadNotifs = notifications.filter(n=>!n.read).length;
  const unreadMsgs = conversations.reduce((s,c)=>s+c.unread,0);
  const unread = unreadNotifs + unreadMsgs;
  [document.getElementById('notifBadgeM'), document.getElementById('notifBadgeD')].forEach(el=>{
    if(!el) return;
    if(unread>0){ el.style.display='flex'; el.textContent = unread>9?'9+':unread; }
    else { el.style.display='none'; }
  });
}
function toggleNotifPanel(){
  if(requireLogin()) return;
  notifPanelOpen = !notifPanelOpen;
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('show', notifPanelOpen);
  if(notifPanelOpen){
    if(notifications.length === 0){
      panel.innerHTML = `<div class="empty-state" style="padding:26px;">لا توجد إشعارات بعد</div>`;
    } else {
      panel.innerHTML = notifications.map((n,i) => `
        <div class="notif-item ${n.read?'':'unread'}" style="cursor:pointer;" onclick="openNotificationAt(${i})">
          <span>🔔</span>
          <div><div>${esc(n.text)}</div><div class="muted" style="font-size:10px; margin-top:3px;">${timeAgo(n.created_at)}</div></div>
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
function openNotificationAt(i){
  const n = notifications[i];
  if(!n) return;
  notifPanelOpen = false;
  document.getElementById('notifPanel').classList.remove('show');
  if(n.post_id){
    const post = publicPosts.find(p => p.id === n.post_id);
    switchTab(post && post.type === 'quote' ? 'quotes' : 'questions');
    if(n.type === 'answer' && post && post.type === 'qa'){
      setTimeout(()=> openAllAnswers(post.id), 250);
    }
  } else if(n.confession_id){
    switchTab('confessions');
  }
}

// أفاتار موحّد: يعرض الصورة الحقيقية لو موجودة، وإلا الحروف كما كان
function avatarHtml(avatarUrl, initials, extraClass){
  if(avatarUrl) return `<div class="avatar ${extraClass||''}"><img class="avatar-img" src="${avatarUrl}" alt="صورة شخصية"></div>`;
  return `<div class="avatar ${extraClass||''}" role="img" aria-label="صورة شخصية">${initials||'?'}</div>`;
}
// يضيف onclick لفتح صفحة الشخص — يُستخدم على أي أفاتار/اسم قابل للزيارة
function up(userId){
  return userId ? `onclick="viewProfile('${userId}')" style="cursor:pointer;"` : '';
}
function render(){
  if(!currentUser) return;
  let html = '';
  if(currentTab === 'profile') html = isGuest ? renderGuestProfile() : renderProfile();
  else if(currentTab === 'questions') html = renderQuestions();
  else if(currentTab === 'quotes') html = renderQuotesPage();
  else if(currentTab === 'confessions') html = renderConfessions();
  else if(currentTab === 'messages') html = renderMessagesPage();

  document.getElementById('content').innerHTML = html;
  document.getElementById('desktopContent').innerHTML = html;
  document.getElementById('desktopSidebarRight').innerHTML = renderDesktopSidebar();

  document.getElementById('dCoinCount').textContent = currentUser.coins;
  document.getElementById('dCoinWidget').textContent = currentUser.coins + ' 🪙';
  renderNotifBadge();
}

function switchTab(tab){
  if(tab === 'messages' && requireLogin()) return;
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  if(tab === 'quotes') loadFeatured();
  if(tab === 'messages') loadConversations();
  ['content','desktopContent'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.classList.remove('content-fade'); void el.offsetWidth; el.classList.add('content-fade'); }
  });
  render();
}

function renderDesktopSidebar(){
  return `
    ${featuredPost ? `
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;margin-bottom:12px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">⭐ الاقتباس المميز اليوم</span>
      <div style="font-family:'El Messiri',sans-serif;font-weight:600;font-size:12px;line-height:1.5;color:var(--ink);">${esc(featuredPost.text)}</div>
      <div class="muted" style="font-size:10px; margin-top:8px;" ${up(featuredPost.anon?null:featuredPost.author_id)}>— ${featuredPost.anon ? 'مجهول' : esc(featuredPost.author_name)}</div>
    </div>` : ''}
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">👥 أشخاص بالمنصة</span>
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:11px;">ما فيه أعضاء جدد لهسا</div>` :
        peopleDirectory.slice(0,4).map(p=>`
        <div class="d-suggest-row">
          <span ${up(p.id)}>${p.avatar_url ? `<div class="avatar" style="width:28px;height:28px;font-size:11px;border-radius:9px;"><img class="avatar-img" src="${esc(p.avatar_url)}"></div>` : `<div class="avatar" style="width:28px;height:28px;font-size:11px;border-radius:9px;">${esc(p.initials)}</div>`}</span>
          <div ${up(p.id)}><b>${esc(p.name)}</b><span>${p.vip?'عضو VIP':'عضو بالمنصة'}</span></div>
          <button class="d-follow-btn ${followingIds.has(p.id)?'following':''}" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'متابَع':'متابعة'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

// ================= بحث موحّد =================
function openGlobalSearch(prefill){
  document.getElementById('overlay').classList.add('show');
  document.getElementById('searchSheet').classList.add('show');
  const input = document.getElementById('globalSearchInput');
  input.value = prefill || '';
  onGlobalSearch(input.value);
  setTimeout(()=> input.focus(), 250);
}
function onGlobalSearch(val){
  const term = val.trim();
  const box = document.getElementById('globalSearchResults');
  if(!term){ box.innerHTML = `<div class="empty-state" style="padding:24px;">اكتب شي تدور عليه — سؤال، اقتباس، اعتراف، أو اسم شخص</div>`; return; }

  const quotes = publicPosts.filter(p => p.type==='quote' &&
    ((p.text||'').includes(term) || (!p.anon && (p.author_name||'').includes(term))));
  const questions = publicPosts.filter(p => p.type==='qa' &&
    ((p.q||'').includes(term) || (answersByPost[p.id]||[]).some(a=>(a.text||'').includes(term)) || (!p.anon && (p.asker_name||'').includes(term))));
  const confs = confessions.filter(c => (c.text||'').includes(term));
  const people = peopleDirectory.filter(p => (p.name||'').includes(term));

  if(quotes.length===0 && questions.length===0 && confs.length===0 && people.length===0){
    box.innerHTML = `<div class="empty-state" style="padding:24px;"><div class="big">🔍</div>ما فيه نتائج مطابقة</div>`;
    return;
  }

  let html = '';
  if(people.length){
    html += `<div class="eyebrow">أشخاص 👥</div>`;
    html += people.slice(0,6).map(p=>`
      <div class="inbox-item" style="cursor:default;">
        <span ${up(p.id)}>${avatarHtml(p.avatar_url, p.initials, '')}</span>
        <div style="flex:1;" ${up(p.id)}><b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${esc(p.name)}</b></div>
        <button class="d-follow-btn ${followingIds.has(p.id)?'following':''}" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'متابَع':'متابعة'}</button>
      </div>
    `).join('');
  }
  if(quotes.length){
    html += `<div class="eyebrow">اقتباسات ❝</div><div class="tile-grid">${quotes.slice(0,10).map(renderTile).join('')}</div>`;
  }
  if(questions.length){
    html += `<div class="eyebrow">أسئلة ❓</div>${questions.slice(0,10).map(renderQATile).join('')}`;
  }
  if(confs.length){
    html += `<div class="eyebrow">اعترافات 🎭</div>${confs.slice(0,10).map(renderConfessionCard).join('')}`;
  }
  box.innerHTML = html;
}

// ---- صفحة الأسئلة ----
let questionTopic = 'الكل';
function computeQuestionTopics(){
  const seedNames = topics.map(t=>t.name);
  const extra = new Set();
  publicPosts.forEach(p=>{ if(p.type==='qa' && p.topic && !seedNames.includes(p.topic)) extra.add(p.topic); });
  return [...topics, ...[...extra].map(name=>({name, emoji:'#'}))];
}
function setQuestionTopic(name){
  questionTopic = name;
  render();
}
function renderQuestions(){
  const allQas = publicPosts.filter(p=>p.type==='qa');
  const qas = questionTopic === 'الكل' ? allQas : allQas.filter(p=>p.topic === questionTopic);
  const topicsList = computeQuestionTopics();
  return `
    <div class="page-title">الأسئلة</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 14px 0;">أسئلة مفتوحة من الجميع — جاوب على أي سؤال يعجبك</div>
    <div class="composer-trigger" onclick="openComposerMode('ask')">
      <span>عندك سؤال؟ اطرحه الحين...</span>
      <div class="composer-plus">+</div>
    </div>
    <div class="topic-row" style="margin-top:14px;">
      ${topicsList.map(t=>`<div class="topic-chip ${questionTopic===t.name?'active':''}" onclick="setQuestionTopic('${escAttr(t.name)}')">${t.emoji} ${esc(t.name)}</div>`).join('')}
    </div>
    <div style="margin-top:4px;">
      ${qas.length===0 ? `<div class="empty-state"><div class="big">❓</div>ما فيه أسئلة بهالفئة بعد<br>كن أول شخص يسأل</div>` :
        qas.map(it => renderQATile(it)).join('')}
    </div>
  `;
}
function renderQATile(it){
  const liked = myLikedPostIds.has(it.id);
  const isOwner = it.asked_by === currentUser.id;
  const answers = answersByPost[it.id] || [];
  const hasAnswers = answers.length > 0;
  const shown = answers.slice(0, 3);

  const answersHtml = hasAnswers ? `
    <div class="answers-list">
      ${shown.map(a => `
        <div class="comment-item" style="padding:8px 2px;">
          <span ${up(a.user_id)}>${avatarHtml(a.user_avatar, a.user_initials, 'avatar-tiny')}</span>
          <div class="comment-body">
            <b ${up(a.user_id)} style="font-size:12px;">${esc(a.user_name) || 'مستخدم'}</b>
            <div class="ctext">${esc(a.text)}</div>
          </div>
        </div>
      `).join('')}
      ${answers.length > 3
        ? `<div class="answers-viewall" onclick="openAllAnswers('${it.id}')">مشاهدة كل الإجابات (${answers.length}) ←</div>`
        : (answers.length > 1 ? `<div class="answers-viewall" onclick="openAllAnswers('${it.id}')">عرض الكل</div>` : '')}
    </div>
  ` : '';

  if(hasAnswers){
    return `
      <div class="card">
        <div class="card-head">
          <span ${up(it.anon?null:it.asked_by)}>${it.anon ? `<div class="avatar anon">؟</div>` : avatarHtml(it.asker_avatar, it.asker_initials, '')}</span>
          <div class="name-line">
            <b ${up(it.anon?null:it.asked_by)}>${it.anon ? 'سؤال مجهول' : esc(it.asker_name)}</b>
            <small>${timeAgo(it.created_at)}${it.is_shoutout ? ' · 📢 شوت أوت' : ''}${it.topic && it.topic!=='الكل' ? ' · #'+esc(it.topic) : ''}</small>
          </div>
        </div>
        <div class="q-bubble">${esc(it.q)}</div>
        ${answersHtml}
        <div style="display:flex; gap:8px; margin-bottom:4px;">
          <button class="btn-ghost" style="margin-top:2px; width:auto; padding:0 16px; font-size:12px;" onclick="openAnswer('${it.id}')">➕ أضف إجابتك</button>
          ${isOwner ? `<button class="btn-ghost" style="margin-top:2px; width:auto; padding:0 16px; font-size:12px;" onclick="deletePost('${it.id}')">حذف</button>` : ''}
        </div>
        <div class="card-foot">
          <div class="foot-btn ${liked?'liked':''}"><span onclick="popHeart(this); toggleLike('${it.id}')">♥</span> <span onclick="openLikers('post','${it.id}')" style="cursor:pointer;">${it.likes}</span></div>
          <div class="foot-btn" onclick="openComments('post','${it.id}')">💬 <span>${it.comments||0}</span></div>
          <div class="foot-btn" onclick="openSharePicker('${b64(it.q+' — '+shown[0].text)}')">📤 مشاركة</div>
          <div class="foot-btn" onclick="nativeShare('${b64(it.q+' — '+shown[0].text)}')">🔗</div>
          ${isOwner ? `<div class="foot-btn" onclick="deletePost('${it.id}')">🗑️</div>` : `<div class="foot-btn" onclick="reportContent('post','${it.id}')">🚩</div>`}
        </div>
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="card-head">
        <span ${up(it.anon?null:it.asked_by)}>${it.anon ? `<div class="avatar anon">؟</div>` : avatarHtml(it.asker_avatar, it.asker_initials, '')}</span>
        <div class="name-line">
          <b ${up(it.anon?null:it.asked_by)}>${it.anon ? 'سؤال مجهول' : esc(it.asker_name)} ${it.is_shoutout ? '<span class="vip-badge">📢 شوت أوت</span>':''}</b>
          <small>${timeAgo(it.created_at)}${it.topic && it.topic!=='الكل' ? ' · #'+esc(it.topic) : ''}</small>
        </div>
      </div>
      <div class="q-bubble">${esc(it.q)}</div>
      <div style="display:flex; gap:8px;">
        <button class="btn-primary" style="margin-top:2px;" onclick="openAnswer('${it.id}')">أجب على هذا السؤال</button>
        ${isOwner ? `<button class="btn-ghost" style="margin-top:2px; width:auto; padding:0 16px;" onclick="deletePost('${it.id}')">حذف</button>` : ''}
      </div>
    </div>
  `;
}

// ---- صفحة الاقتباسات ----
function matchesExplore(item){
  if(item.type !== 'quote') return false;
  const topicOk = exploreTopic === 'الكل' || item.topic === exploreTopic;
  const term = exploreSearchTerm.trim();
  const searchOk = !term || item.text.includes(term) || (item.author_name||'').includes(term);
  return topicOk && searchOk;
}
function renderTile(item){
  const liked = myLikedPostIds.has(item.id);
  const isOwner = item.author_id === currentUser.id;
  return `
    <div class="post-tile">
      <div class="type-ic">❝</div>
      <span ${up(item.anon?null:item.author_id)}>${item.author_avatar && !item.anon ? `<div class="tile-avatar"><img class="avatar-img" src="${esc(item.author_avatar)}"></div>` : `<div class="tile-avatar">${esc(item.author_initials) || (item.anon?'؟':'?')}</div>`}</span>
      <div class="tile-name" ${up(item.anon?null:item.author_id)}>${item.anon ? 'مجهول' : esc(item.author_name)}</div>
      <div class="tile-content quote">${esc(item.text)}</div>
      <div class="tile-foot">
        <div class="t-like ${liked?'liked':''}"><span onclick="popHeart(this); toggleLike('${item.id}')">♥</span> <span onclick="openLikers('post','${item.id}')" style="cursor:pointer;">${item.likes}</span></div>
        <div onclick="openComments('post','${item.id}')" style="cursor:pointer;">💬 ${item.comments||0}</div>
        <div onclick="openSharePicker('${b64(item.text)}')" style="cursor:pointer;">📤</div>
        <div onclick="nativeShare('${b64(item.text)}')" style="cursor:pointer;">🔗</div>
        ${isOwner
          ? `<div onclick="editQuote('${item.id}')" style="cursor:pointer;">✏️</div><div onclick="deletePost('${item.id}')" style="cursor:pointer;">🗑️</div>`
          : `<div onclick="reportContent('post','${item.id}')" style="cursor:pointer;">🚩</div>`}
      </div>
    </div>
  `;
}
function renderExploreResults(){
  const results = publicPosts.filter(matchesExplore);
  if(results.length === 0){
    return `<div class="empty-state" style="padding:34px 10px;"><div class="big">🔍</div>ما فيه نتائج مطابقة<br>جرب كلمة أو موضوع ثاني</div>`;
  }
  return `<div class="tile-grid">${results.map(it=>renderTile(it)).join('')}</div>`;
}
function onExploreSearch(val){
  exploreSearchTerm = val;
  document.querySelectorAll('.exploreResults').forEach(el => el.innerHTML = renderExploreResults());
}
function setExploreTopic(name){
  exploreTopic = name;
  render();
}
function renderQuotesPage(){
  const topicsList = computeTopics();
  return `
    <div class="page-title">الاقتباسات</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 12px 0;">دوّر على اقتباس بموضوع يعجبك، أو شارك اقتباسك الخاص</div>

    ${featuredPost ? `
    <div class="eyebrow">⭐ الاقتباس المميز (أعلى لايكات آخر 24 ساعة)</div>
    <div class="quote-card featured-quote" style="border-right-color:var(--orange);">
      <div class="qtext">${esc(featuredPost.text)}</div>
      <div class="qmeta">
        <div class="qauthor" ${up(featuredPost.anon?null:featuredPost.author_id)}>
          ${avatarHtml(featuredPost.author_avatar, featuredPost.author_initials, '')}
          <span>${featuredPost.anon ? 'مجهول' : esc(featuredPost.author_name)}</span>
        </div>
        <div class="qstory">♥ ${featuredPost.likes}</div>
      </div>
    </div>` : ''}

    <div class="composer-trigger" onclick="openComposerMode('quote')">
      <span>شاركنا اقتباس يعجبك...</span>
      <div class="composer-plus">+</div>
    </div>
    <input type="text" class="explore-search" style="margin-top:14px;" placeholder="ابحث عن اقتباس أو شخص..." value="${esc(exploreSearchTerm)}" oninput="onExploreSearch(this.value)">
    <div class="topic-row">
      ${topicsList.map(t=>`<div class="topic-chip ${exploreTopic===t.name?'active':''}" onclick="setExploreTopic('${escAttr(t.name)}')">${t.emoji} ${esc(t.name)}</div>`).join('')}
    </div>
    <div class="exploreResults">${renderExploreResults()}</div>
    <div class="eyebrow">أشخاص بالمنصة 👥</div>
    <div class="people-grid">
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:12px;grid-column:1/-1;">ما فيه أعضاء جدد لهسا — كن أول من يدعو أصحابه!</div>` :
        peopleDirectory.map(p=>`
        <div class="people-card">
          <span ${up(p.id)}>${p.avatar_url ? `<div class="avatar" style="width:38px;height:38px;font-size:14px;border-radius:12px;margin:0 auto 8px auto;"><img class="avatar-img" src="${esc(p.avatar_url)}"></div>` : `<div class="avatar" style="width:38px;height:38px;font-size:14px;border-radius:12px;margin:0 auto 8px auto;">${esc(p.initials)}</div>`}</span>
          <b ${up(p.id)}>${esc(p.name)}</b>
          <span>${p.vip?'عضو VIP ✨':'عضو بالمنصة'}</span>
          <button class="d-follow-btn ${followingIds.has(p.id)?'following':''}" style="margin:8px auto 0 auto; display:block;" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'متابَع ✓':'متابعة'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- صفحة الاعترافات ----
function renderConfessionCard(c){
  const liked = myLikedConfessionIds.has(c.id);
  const isAnon = c.anon !== false;
  const isOwner = c.user_id === currentUser.id;
  return `
    <div class="confession-card">
      <div class="conf-head">
        <span ${up(isAnon?null:c.user_id)}>${isAnon ? `<div class="conf-ghost">🎭</div>` : avatarHtml(c.user_avatar, c.user_initials, 'conf-ghost')}</span>
        <b ${up(isAnon?null:c.user_id)}>${isAnon ? 'اعتراف مجهول' : esc(c.user_name)}</b>
        <span class="muted">${timeAgo(c.created_at)}</span>
      </div>
      <div class="conf-text">${esc(c.text)}</div>
      <div class="card-foot" style="margin-top:10px;">
        <div class="foot-btn ${liked?'liked':''}"><span onclick="popHeart(this); toggleConfessionLike('${c.id}')">♥</span> <span onclick="openLikers('confession','${c.id}')" style="cursor:pointer;">${c.likes}</span></div>
        <div class="foot-btn" onclick="openComments('confession','${c.id}')">💬 <span>${c.comments||0}</span></div>
        <div class="foot-btn" onclick="openSharePicker('${b64(c.text)}')">📤 مشاركة</div>
        <div class="foot-btn" onclick="nativeShare('${b64(c.text)}')">🔗</div>
        ${isOwner ? `<div class="foot-btn" onclick="deleteConfession('${c.id}')">🗑️</div>` : `<div class="foot-btn" onclick="reportContent('confession','${c.id}')">🚩</div>`}
      </div>
    </div>
  `;
}
function renderConfessions(){
  return `
    <div class="page-title">الاعترافات</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 14px 0;">اعترف باسمك أو مجهول بالكامل — اختيارك أنت</div>
    <div class="composer-trigger" onclick="openComposerMode('confession')">
      <span>عندك اعتراف؟ شاركه الحين...</span>
      <div class="composer-plus">+</div>
    </div>
    <div style="margin-top:14px;">
      ${confessions.length===0 ? `<div class="empty-state"><div class="big">🎭</div>ما فيه اعترافات بعد<br>كن أول من يعترف بشي</div>` :
        confessions.map(renderConfessionCard).join('')}
    </div>
  `;
}

// ---- صفحة الحساب (زائر) ----
function renderGuestProfile(){
  return `
    <div class="profile-cover"></div>
    <div class="profile-header">
      <div class="profile-avatar" style="position:relative;">👤</div>
      <div class="profile-name">تتصفح كزائر</div>
      <div class="muted" style="font-size:12px; margin-top:4px; max-width:280px; margin-inline:auto;">
        تقدر تشوف كل الأسئلة والاقتباسات والاعترافات، بس عشان تسأل أو تجاوب أو تلايك أو تتابع أو ترسل — لازم حساب حقيقي.
      </div>
      <button class="btn-primary" style="width:auto; padding:10px 26px; margin-top:14px;" onclick="promptGuestLogin()">تسجيل الدخول / إنشاء حساب</button>
    </div>
    <div class="hint" style="margin-top:22px;">حسابك حقيقي ومحفوظ بقاعدة بيانات — يبدأ رصيدك 50 🪙، وتسجل دخولك من أي جهاز وتلقى نفس بياناتك.</div>
  `;
}

// ---- صفحة الحساب ----
function renderProfile(){
  const myOpenQuestions = publicPosts.filter(p=>p.type==='qa' && !(answersByPost[p.id]&&answersByPost[p.id].length) && p.asked_by===currentUser.id);
  const myAnswersCount = Object.values(answersByPost).reduce((sum,arr)=> sum + arr.filter(a=>a.user_id===currentUser.id).length, 0);
  return `
    <div class="profile-cover"></div>
    <div class="profile-header">
      <div class="profile-avatar" style="position:relative;">
        ${currentUser.vip ? `<div class="vip-crown">✦ VIP ✦</div>` : ''}
        ${currentUser.avatar_url ? `<img class="avatar-img" src="${esc(currentUser.avatar_url)}">` : esc(currentUser.initials)}
        <label class="avatar-upload-btn" title="تغيير الصورة">
          📷<input type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(this.files[0])">
        </label>
      </div>
      <div class="profile-name">${esc(currentUser.name)} ${currentUser.vip ? '<span class="vip-badge">VIP</span>' : ''}</div>
      <div class="muted" style="font-size:12px; margin-top:4px; max-width:280px; margin-inline:auto;">${currentUser.bio ? esc(currentUser.bio) : 'ما فيه نبذة بعد'} — <a onclick="editMyBio()" style="color:var(--red); cursor:pointer; font-weight:700;">تعديل</a></div>
      ${!currentUser.vip ? `<button class="btn-primary" style="width:auto; padding:9px 20px; margin-top:10px;" onclick="upgradeVip()">✨ الترقية إلى VIP</button>` : ''}
    </div>

    <div class="stat-card">
      <div><b>${publicPosts.filter(p=>p.author_id===currentUser.id).length + myAnswersCount}</b><span>مساهمة</span></div>
      <div><b>${followingIds.size}</b><span>تتابع</span></div>
      <div><b>${currentUser.coins}</b><span>🪙 عملات</span></div>
    </div>

    <div class="eyebrow">كيف تكسب عملات 🪙</div>
    <div class="card" style="font-size:11.5px; line-height:2; color:var(--ink);">
      ❤️ لايك على منشورك = 1 🪙 &nbsp;·&nbsp; ✅ تجاوب على سؤال = 5 🪙 &nbsp;·&nbsp; ❓ تسأل سؤال = 8 🪙
    </div>

    <div class="eyebrow">أسئلتك المفتوحة <span class="more">${myOpenQuestions.length}</span></div>
    <div class="card" style="padding:4px 14px;">
      ${myOpenQuestions.length === 0 ? `<div class="empty-state" style="padding:24px;">ما عندك أسئلة مفتوحة حالياً</div>` :
        myOpenQuestions.map(q => `
        <div class="inbox-item">
          <div class="dot"></div>
          <div style="flex:1;">
            <div style="font-size:12.5px; line-height:1.4; color:var(--ink);">${esc(q.q)}</div>
            <div class="muted" style="font-size:10px; margin-top:2px;">بانتظار أي أحد يجاوب — ${timeAgo(q.created_at)}</div>
          </div>
          <div class="foot-btn" style="margin-inline-start:auto;" onclick="deletePost('${q.id}')">🗑️</div>
        </div>
      `).join('')}
    </div>

    <div class="eyebrow">الحساب</div>
    <div class="card">
      <button class="btn-ghost" style="margin-top:0;" onclick="logout()">🚪 تسجيل الخروج</button>
      <button class="btn-ghost" style="margin-top:8px; color:var(--red); border-color:var(--red);" onclick="deleteMyAccount()">⚠️ حذف الحساب نهائياً</button>
    </div>

    ${currentUser.is_admin ? `
    <div class="eyebrow">⚙️ منطقة المطور</div>
    <div class="card" style="border-color:var(--red);">
      <div class="muted" style="font-size:11px; margin-bottom:10px; line-height:1.6;">يمسح كل الحسابات (غير حسابك) وكل الأسئلة والاقتباسات والاعترافات نهائياً. للاستخدام وقت التطوير والاختبار بس.</div>
      <button class="btn-ghost" style="margin-top:0; color:var(--red); border-color:var(--red);" onclick="wipeAllData()">🧨 حذف كل الحسابات والمحتوى</button>
    </div>` : ''}

    <div class="hint">حسابك حقيقي ومحفوظ بقاعدة بيانات — أي جهاز تسجل دخول منه بنفس البريد بتلقى نفس بياناتك.</div>
  `;
}

// ---- صفحة الرسائل ----
function renderMessagesPage(){
  return `
    <div class="page-title">الرسائل</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 14px 0;">راسل أي شخص تتابعه أو تابعك مباشرة</div>
    ${conversations.length===0 ? `<div class="empty-state"><div class="big">💬</div>ما فيه محادثات بعد<br>زور أي حساب وابدأ الحديث</div>` :
      conversations.map(c=>`
      <div class="inbox-item" onclick="openThread('${c.userId}','${b64(c.name||'')}','${escAttr(c.initials||'?')}', ${c.avatar? `'${escAttr(c.avatar)}'` : 'null'})">
        ${avatarHtml(c.avatar, c.initials, '')}
        <div style="flex:1;">
          <b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${esc(c.name)||'مستخدم'}</b>
          <div class="muted" style="font-size:11px; margin-top:2px;">${esc((c.lastText||'').slice(0,40))}</div>
        </div>
        ${c.unread>0 ? `<div class="dot" style="width:10px;height:10px;"></div>` : ''}
      </div>
    `).join('')}
  `;
}
function renderThread(){
  const box = document.getElementById('threadMessages');
  const title = document.getElementById('threadTitle');
  if(title) title.textContent = activeThreadUser ? activeThreadUser.name : 'محادثة';
  if(!box) return;
  box.innerHTML = threadMessages.map(m=>{
    const mine = m.from_id === currentUser.id;
    return `<div style="display:flex; justify-content:${mine?'flex-start':'flex-end'}; margin-bottom:8px;">
      <div style="max-width:75%; background:${mine?'var(--red)':'var(--paper-soft)'}; color:${mine?'#fff':'var(--ink)'}; padding:9px 13px; border-radius:14px; font-size:12.5px; line-height:1.5;">
        ${esc(m.text)}
      </div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// ---- شيت زيارة حساب شخص ----
function renderProfileSheet(p, info){
  const isMe = info.isMe;
  const qCount = info.questions.length;

  const questionsHTML = info.questions.length === 0
    ? `<div class="empty-state" style="padding:16px;">${isMe ? 'ما سألت أي سؤال بعد' : 'ما نشر أسئلة علنية بعد'}</div>`
    : info.questions.map(q => `
      <div class="inbox-item" style="cursor:default;">
        <div class="dot" style="background:${q.anon?'var(--ink-muted)':'var(--red)'};"></div>
        <div style="flex:1;">
          <div style="font-size:12px; line-height:1.4; color:var(--ink);">${esc(q.q)}${q.anon ? ' <span class="muted" style="font-size:9.5px;">(مجهول — يظهر لك بس)</span>' : ''}</div>
          <div class="muted" style="font-size:9.5px; margin-top:2px;">${q.answersCount ? `متجاوب عليه (${q.answersCount})` : 'بانتظار إجابة'} — ${timeAgo(q.created_at)}</div>
        </div>
      </div>
    `).join('');

  const quotesHTML = info.quotes.length === 0
    ? `<div class="empty-state" style="padding:16px;">ما نشر اقتباسات بعد</div>`
    : info.quotes.map(qt => `
      <div class="inbox-item" style="cursor:default;">
        <div style="flex:1; font-size:12px; color:var(--ink); line-height:1.5;">❝ ${esc(qt.text)}</div>
      </div>
    `).join('');

  const confessionsHTML = info.confessions.length === 0
    ? `<div class="empty-state" style="padding:16px;">${isMe ? 'ما سجّلت اعترافات بعد' : 'ما نشر اعترافات علنية بعد'}</div>`
    : info.confessions.map(c => `
      <div class="inbox-item" style="cursor:default;">
        <div style="flex:1; font-size:12px; color:var(--ink); line-height:1.5;">🎭 ${esc(c.text)}${c.anon ? ' <span class="muted" style="font-size:9.5px;">(مجهول — يظهر لك بس)</span>' : ''}</div>
      </div>
    `).join('');

  document.getElementById('profileSheetBody').innerHTML = `
    <div style="text-align:center;">
      <div style="position:relative; display:inline-block;">
        ${p.vip ? `<div class="vip-crown">✦ VIP ✦</div>` : ''}
        ${avatarHtml(p.avatar_url, p.initials, '')}
      </div>
      <div class="profile-name" style="justify-content:center; margin-top:10px;">${esc(p.name)} ${p.vip?'<span class="vip-badge">VIP</span>':''}</div>
      ${p.bio ? `<div class="muted" style="font-size:12px; margin-top:4px; max-width:280px; margin-inline:auto;">${esc(p.bio)}</div>` : ''}
      ${!isMe ? `
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn-primary" style="margin-top:0;" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'إلغاء المتابعة':'متابعة'}</button>
        <button class="btn-primary" style="margin-top:0; background:var(--ink);" onclick="closeSheet(); openThread('${p.id}','${b64(p.name)}','${escAttr(p.initials)}', ${p.avatar_url?`'${escAttr(p.avatar_url)}'`:'null'})">💬 مراسلة</button>
      </div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn-ghost" style="margin-top:0;" onclick="reportContent('user','${p.id}')">🚩 إبلاغ</button>
        <button class="btn-ghost" style="margin-top:0; color:var(--red); border-color:var(--red);" onclick="blockUser('${p.id}')">🚫 حظر</button>
      </div>` : `<div class="muted" style="margin-top:8px; font-size:12px;">هذا حسابك أنت</div>`}
    </div>

    <div class="stat-card" style="margin-top:16px;">
      <div><b>${info.followerCount}</b><span>متابع</span></div>
      <div><b>${qCount}</b><span>سؤال</span></div>
      <div><b>${info.quotes.length}</b><span>اقتباس</span></div>
    </div>

    <div class="eyebrow">أسئلته ❓</div>
    <div class="card" style="padding:2px 12px; max-height:180px; overflow-y:auto;">${questionsHTML}</div>

    <div class="eyebrow">اقتباساته ❝</div>
    <div class="card" style="padding:2px 12px; max-height:180px; overflow-y:auto;">${quotesHTML}</div>

    <div class="eyebrow">اعترافاته 🎭</div>
    <div class="card" style="padding:2px 12px; max-height:180px; overflow-y:auto;">${confessionsHTML}</div>
  `;
}

// ---- شيت اختيار شخص للمشاركة ----
function renderSharePicker(){
  const box = document.getElementById('sharePickerList');
  const pool = peopleDirectory.filter(p=> followingIds.has(p.id))
    .concat(conversations.map(c=>({id:c.userId,name:c.name,initials:c.initials,avatar_url:c.avatar})));
  const seen = new Set(); const list = [];
  pool.forEach(p=>{ if(p && p.id && !seen.has(p.id)){ seen.add(p.id); list.push(p); } });
  if(list.length === 0){
    box.innerHTML = `<div class="empty-state" style="padding:20px;">تابع أشخاص أول عشان تقدر تشاركهم</div>`;
    return;
  }
  box.innerHTML = list.map(p=>`
    <div class="inbox-item" onclick="shareToPerson('${p.id}')">
      ${avatarHtml(p.avatar_url, p.initials, '')}
      <b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${esc(p.name)}</b>
    </div>
  `).join('');
}

// ---- شيت مين أعجب ----
function renderLikersList(rows){
  const box = document.getElementById('likersList');
  if(!box) return;
  if(!rows || rows.length === 0){
    box.innerHTML = `<div class="empty-state" style="padding:20px;">محد أعجب بهذا بعد — كن أول واحد</div>`;
    return;
  }
  box.innerHTML = rows.map(r=>{
    const p = r.profiles || {};
    return `
    <div class="inbox-item" ${up(r.user_id)}>
      ${avatarHtml(p.avatar_url, p.initials, '')}
      <b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${esc(p.name)||'مستخدم'}</b>
    </div>`;
  }).join('');
}

// ================= تصدير صورة القصة (توليد حقيقي بالمتصفح، بدون سيرفر) =================
function exportStoryImage(text){
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,1080,1350);
  grad.addColorStop(0,'#C97B4A'); grad.addColorStop(1,'#7A3F22');
  ctx.fillStyle = grad; ctx.fillRect(0,0,1080,1350);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';

  const words = text.split(' ');
  let lines = []; let line = '';
  ctx.font = '600 56px sans-serif';
  words.forEach(w=>{
    const test = line + w + ' ';
    if(ctx.measureText(test).width > 860 && line){ lines.push(line); line = w + ' '; }
    else line = test;
  });
  lines.push(line);

  const startY = 675 - (lines.length*70)/2;
  lines.forEach((l,i)=> ctx.fillText(l.trim(), 540, startY + i*80));

  ctx.font = '700 34px sans-serif';
  ctx.fillText('QQC', 540, 1260);

  const link = document.createElement('a');
  link.download = 'quote.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('📤 تم تجهيز الصورة للتحميل');
}

// مشاركة خارجية حقيقية (واتساب/تويتر/أي تطبيق) عبر واجهة المتصفح، أو نسخ للحافظة كخيار احتياطي
async function nativeShare(encodedText){
  const text = unb64(encodedText);
  if(navigator.share){
    try{ await navigator.share({ text: text + '\n— QQC' }); }catch(e){ /* المستخدم ألغى المشاركة، تجاهل */ }
  } else if(navigator.clipboard){
    try{ await navigator.clipboard.writeText(text); toast('✅ تم نسخ النص — الصقه أي مكان'); }
    catch(e){ toast('تعذر النسخ'); }
  } else {
    toast('المشاركة غير مدعومة بهذا المتصفح');
  }
}

// ================= نافذة الإنشاء (composer) =================
function openComposer(){
  if(requireLogin()) return;
  document.getElementById('overlay').classList.add('show');
  document.getElementById('composerSheet').classList.add('show');
}
function openComposerMode(mode){
  openComposer();
  setComposerMode(mode);
}
function closeSheet(){
  document.getElementById('overlay').classList.remove('show');
  document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('show'));
}
function setComposerMode(mode){
  composerMode = mode;
  document.querySelectorAll('#composerTabs .mode-opt').forEach(d => d.classList.toggle('active', d.dataset.mode === mode));
  document.getElementById('composerAskBody').style.display = mode==='ask' ? 'block':'none';
  document.getElementById('composerShoutBody').style.display = mode==='shoutout' ? 'block':'none';
  document.getElementById('composerQuoteBody').style.display = mode==='quote' ? 'block':'none';
  document.getElementById('composerConfessionBody').style.display = mode==='confession' ? 'block':'none';
  if(mode==='ask' || mode==='quote'){
    const list = document.getElementById('topicDatalist');
    if(list) list.innerHTML = computeTopics().filter(t=>t.name!=='الكل').map(t=>`<option value="${escAttr(t.name)}">`).join('');
  }
}

// ================= الإجابة على سؤال =================
function openAnswer(postId){
  if(requireLogin()) return;
  activeQuestion = publicPosts.find(p=>p.id===postId);
  if(!activeQuestion) return;
  document.getElementById('answerQuestionPreview').textContent = activeQuestion.q;
  document.getElementById('answerText').value = '';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('answerSheet').classList.add('show');
}

// ================= بدء التطبيق =================
initApp();

// دعم تفعيل عناصر role="button" بلوحة المفاتيح (Enter/Space) لمن يتصفح بدون فأرة
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button'){
    e.preventDefault();
    e.target.click();
  }
});

// نسجّل الـ Service Worker (بدون أي كاش — شوف sw.js) — لازم يكون مسجّل عشان
// المتصفح (خصوصاً أندرويد/كروم/سامسونج) يعتبر الموقع "قابل للتثبيت" كتطبيق.
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// ================= تثبيت التطبيق على الشاشة الرئيسية =================
let deferredInstallPrompt = null;
const INSTALL_DISMISS_KEY = 'qqc_install_dismissed';

function isStandaloneApp(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOSDevice(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

// كروم/سامسونج إنترنت وأي متصفح Chromium بأندرويد يطلق هذا الحدث تلقائياً
// لما يتأكد إن الموقع قابل للتثبيت — نمنع البانر الافتراضي ونعرض بانرنا المخصص بدلاً منه
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  maybeShowInstallBanner();
});
window.addEventListener('appinstalled', () => {
  hideInstallBanner();
  deferredInstallPrompt = null;
});

function maybeShowInstallBanner(){
  if(isStandaloneApp()) return; // مثبت أصلاً
  if(localStorage.getItem(INSTALL_DISMISS_KEY)) return; // المستخدم سكّرها قبل
  document.getElementById('installBanner').style.display = 'flex';
}
function hideInstallBanner(){
  const el = document.getElementById('installBanner');
  if(el) el.style.display = 'none';
}
function dismissInstallBanner(){
  hideInstallBanner();
  try{ localStorage.setItem(INSTALL_DISMISS_KEY, '1'); }catch(e){}
}
async function handleInstallClick(){
  if(deferredInstallPrompt){
    // أندرويد/سامسونج/كروم: نطلب نافذة التثبيت الأصلية من المتصفح نفسه
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    hideInstallBanner();
    if(choice && choice.outcome === 'accepted'){ toast('✅ جاري تثبيت التطبيق'); }
  } else if(isIOSDevice()){
    // آيفون: ما فيه API تلقائي، نعرض خطوات الإضافة اليدوية من Safari
    openIosInstallModal();
  } else {
    toast('افتح الموقع من متصفح Safari (آيفون) أو Chrome (أندرويد) للتثبيت');
  }
}
function openIosInstallModal(){
  document.getElementById('iosInstallOverlay').classList.add('show');
  document.getElementById('iosInstallModal').classList.add('show');
}
function closeIosInstallModal(){
  document.getElementById('iosInstallOverlay').classList.remove('show');
  document.getElementById('iosInstallModal').classList.remove('show');
}

// آيفون ما يطلق beforeinstallprompt أبداً — نعرضله بانرنا يدوياً بعد ثانيتين من فتح الصفحة
if(isIOSDevice() && !isStandaloneApp() && !localStorage.getItem(INSTALL_DISMISS_KEY)){
  setTimeout(maybeShowInstallBanner, 1500);
}
