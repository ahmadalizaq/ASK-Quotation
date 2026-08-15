// ================= أدوات عامة =================
function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}
function timeAgo(iso){
  if(!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime())/1000;
  if(diff < 60) return 'الآن';
  if(diff < 3600) return `قبل ${Math.floor(diff/60)} دقيقة`;
  if(diff < 86400) return `قبل ${Math.floor(diff/3600)} ساعة`;
  return `قبل ${Math.floor(diff/86400)} يوم`;
}

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
function openNotificationAt(i){
  const n = notifications[i];
  if(!n) return;
  notifPanelOpen = false;
  document.getElementById('notifPanel').classList.remove('show');
  if(n.post_id){
    const post = publicPosts.find(p => p.id === n.post_id);
    switchTab(post && post.type === 'quote' ? 'quotes' : 'questions');
  } else if(n.confession_id){
    switchTab('confessions');
  }
}

// أفاتار موحّد: يعرض الصورة الحقيقية لو موجودة، وإلا الحروف كما كان
function avatarHtml(avatarUrl, initials, extraClass){
  if(avatarUrl) return `<div class="avatar ${extraClass||''}"><img class="avatar-img" src="${avatarUrl}"></div>`;
  return `<div class="avatar ${extraClass||''}">${initials||'?'}</div>`;
}
// يضيف onclick لفتح صفحة الشخص — يُستخدم على أي أفاتار/اسم قابل للزيارة
function up(userId){
  return userId ? `onclick="viewProfile('${userId}')" style="cursor:pointer;"` : '';
}
function render(){
  if(!currentUser) return;
  let html = '';
  if(currentTab === 'profile') html = renderProfile();
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
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  if(tab === 'quotes') loadFeatured();
  if(tab === 'messages') loadConversations();
  render();
}

function renderDesktopSidebar(){
  return `
    ${featuredPost ? `
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;margin-bottom:12px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">⭐ الاقتباس المميز اليوم</span>
      <div style="font-family:'El Messiri',sans-serif;font-weight:600;font-size:12px;line-height:1.5;color:var(--ink);">${featuredPost.text}</div>
      <div class="muted" style="font-size:10px; margin-top:8px;" ${up(featuredPost.anon?null:featuredPost.author_id)}>— ${featuredPost.anon ? 'مجهول' : featuredPost.author_name}</div>
    </div>` : ''}
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">👥 أشخاص بالمنصة</span>
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:11px;">ما فيه أعضاء جدد لهسا</div>` :
        peopleDirectory.slice(0,4).map(p=>`
        <div class="d-suggest-row">
          <span ${up(p.id)}>${p.avatar_url ? `<div class="avatar" style="width:28px;height:28px;font-size:11px;border-radius:9px;"><img class="avatar-img" src="${p.avatar_url}"></div>` : `<div class="avatar" style="width:28px;height:28px;font-size:11px;border-radius:9px;">${p.initials}</div>`}</span>
          <div ${up(p.id)}><b>${p.name}</b><span>${p.vip?'عضو VIP':'عضو بالمنصة'}</span></div>
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

// ---- صفحة الأسئلة ----
function renderQuestions(){
  const qas = publicPosts.filter(p=>p.type==='qa');
  return `
    <div class="page-title">الأسئلة</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 14px 0;">أسئلة مفتوحة من الجميع — جاوب على أي سؤال يعجبك</div>
    <div class="composer-trigger" onclick="openComposerMode('ask')">
      <span>عندك سؤال؟ اطرحه الحين...</span>
      <div class="composer-plus">+</div>
    </div>
    <div style="margin-top:14px;">
      ${qas.length===0 ? `<div class="empty-state"><div class="big">❓</div>ما فيه أسئلة بعد<br>كن أول شخص يسأل</div>` :
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
          <span ${up(it.anon?null:it.asked_by)}>${it.anon ? `<div class="avatar anon">؟</div>` : avatarHtml(it.asker_avatar, it.asker_initials, '')}</span>
          <div class="name-line">
            <b ${up(it.anon?null:it.asked_by)}>${it.anon ? 'سؤال مجهول' : (it.asker_name||'')}</b>
            <small>${timeAgo(it.created_at)}${it.is_shoutout ? ' · 📢 شوت أوت' : ''}${it.topic && it.topic!=='الكل' ? ' · #'+it.topic : ''}</small>
          </div>
        </div>
        <div class="q-bubble">${it.q}</div>
        <div class="a-text">${it.a}</div>
        <div class="muted" style="font-size:10.5px; margin:-4px 0 9px 0; display:flex; align-items:center; gap:6px;" ${up(it.answered_by)}>
          ${avatarHtml(it.answered_by_avatar, it.answered_by_initials, 'avatar-tiny')}
          جاوب عليه: <b style="color:var(--ink);">${it.answered_by_name||''}</b>
        </div>
        <div class="card-foot">
          <div class="foot-btn ${liked?'liked':''}" onclick="toggleLike('${it.id}')">♥ <span>${it.likes}</span></div>
          <div class="foot-btn" onclick="openComments('post','${it.id}')">💬 <span>${it.comments||0}</span></div>
          <div class="foot-btn" onclick="openSharePicker('${(it.q+' — '+it.a).replace(/'/g,"\\'")}')">📤 مشاركة</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="card-head">
        <span ${up(it.anon?null:it.asked_by)}>${it.anon ? `<div class="avatar anon">؟</div>` : avatarHtml(it.asker_avatar, it.asker_initials, '')}</span>
        <div class="name-line">
          <b ${up(it.anon?null:it.asked_by)}>${it.anon ? 'سؤال مجهول' : (it.asker_name||'')} ${it.is_shoutout ? '<span class="vip-badge">📢 شوت أوت</span>':''}</b>
          <small>${timeAgo(it.created_at)}${it.topic && it.topic!=='الكل' ? ' · #'+it.topic : ''}</small>
        </div>
      </div>
      <div class="q-bubble">${it.q}</div>
      <button class="btn-primary" style="margin-top:2px;" onclick="openAnswer('${it.id}')">أجب على هذا السؤال</button>
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
  return `
    <div class="post-tile">
      <div class="type-ic">❝</div>
      <span ${up(item.anon?null:item.author_id)}>${item.author_avatar && !item.anon ? `<div class="tile-avatar"><img class="avatar-img" src="${item.author_avatar}"></div>` : `<div class="tile-avatar">${item.author_initials || (item.anon?'؟':'?')}</div>`}</span>
      <div class="tile-name" ${up(item.anon?null:item.author_id)}>${item.anon ? 'مجهول' : (item.author_name||'')}</div>
      <div class="tile-content quote">${item.text}</div>
      <div class="tile-foot">
        <div class="t-like ${liked?'liked':''}" onclick="toggleLike('${item.id}')">♥ ${item.likes}</div>
        <div onclick="openComments('post','${item.id}')" style="cursor:pointer;">💬 ${item.comments||0}</div>
        <div onclick="openSharePicker('${item.text.replace(/'/g,"\\'")}')" style="cursor:pointer;">📤</div>
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
    <div class="quote-card" style="border-right-color:var(--orange);">
      <div class="qtext">${featuredPost.text}</div>
      <div class="qmeta">
        <div class="qauthor" ${up(featuredPost.anon?null:featuredPost.author_id)}>
          ${avatarHtml(featuredPost.author_avatar, featuredPost.author_initials, '')}
          <span>${featuredPost.anon ? 'مجهول' : featuredPost.author_name}</span>
        </div>
        <div class="qstory">♥ ${featuredPost.likes}</div>
      </div>
    </div>` : ''}

    <div class="composer-trigger" onclick="openComposerMode('quote')">
      <span>شاركنا اقتباس يعجبك...</span>
      <div class="composer-plus">+</div>
    </div>
    <input type="text" class="explore-search" style="margin-top:14px;" placeholder="ابحث عن اقتباس أو شخص..." value="${exploreSearchTerm}" oninput="onExploreSearch(this.value)">
    <div class="topic-row">
      ${topicsList.map(t=>`<div class="topic-chip ${exploreTopic===t.name?'active':''}" onclick="setExploreTopic('${t.name}')">${t.emoji} ${t.name}</div>`).join('')}
    </div>
    <div class="exploreResults">${renderExploreResults()}</div>
    <div class="eyebrow">أشخاص بالمنصة 👥</div>
    <div class="people-grid">
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:12px;grid-column:1/-1;">ما فيه أعضاء جدد لهسا — كن أول من يدعو أصحابه!</div>` :
        peopleDirectory.map(p=>`
        <div class="people-card">
          <span ${up(p.id)}>${p.avatar_url ? `<div class="avatar" style="width:38px;height:38px;font-size:14px;border-radius:12px;margin:0 auto 8px auto;"><img class="avatar-img" src="${p.avatar_url}"></div>` : `<div class="avatar" style="width:38px;height:38px;font-size:14px;border-radius:12px;margin:0 auto 8px auto;">${p.initials}</div>`}</span>
          <b ${up(p.id)}>${p.name}</b>
          <span>${p.vip?'عضو VIP ✨':'عضو بالمنصة'}</span>
          <button class="d-follow-btn ${followingIds.has(p.id)?'following':''}" style="margin:8px auto 0 auto; display:block;" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'متابَع ✓':'متابعة'}</button>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- صفحة الاعترافات ----
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
        confessions.map(c=>{
        const liked = myLikedConfessionIds.has(c.id);
        const isAnon = c.anon !== false;
        return `
        <div class="confession-card">
          <div class="conf-head">
            <span ${up(isAnon?null:c.user_id)}>${isAnon ? `<div class="conf-ghost">🎭</div>` : avatarHtml(c.user_avatar, c.user_initials, 'conf-ghost')}</span>
            <b ${up(isAnon?null:c.user_id)}>${isAnon ? 'اعتراف مجهول' : c.user_name}</b>
            <span class="muted">${timeAgo(c.created_at)}</span>
          </div>
          <div class="conf-text">${c.text}</div>
          <div class="card-foot" style="margin-top:10px;">
            <div class="foot-btn ${liked?'liked':''}" onclick="toggleConfessionLike('${c.id}')">♥ <span>${c.likes}</span></div>
            <div class="foot-btn" onclick="openComments('confession','${c.id}')">💬 <span>${c.comments||0}</span></div>
            <div class="foot-btn" onclick="openSharePicker('${c.text.replace(/'/g,"\\'")}')">📤 مشاركة</div>
          </div>
        </div>
      `;}).join('')}
    </div>
  `;
}

// ---- صفحة الحساب ----
function renderProfile(){
  const myOpenQuestions = publicPosts.filter(p=>p.type==='qa' && !p.a && p.asked_by===currentUser.id);
  return `
    <div class="profile-cover"></div>
    <div class="profile-header">
      <div class="profile-avatar" style="position:relative;">
        ${currentUser.avatar_url ? `<img class="avatar-img" src="${currentUser.avatar_url}">` : currentUser.initials}
        <label class="avatar-upload-btn" title="تغيير الصورة">
          📷<input type="file" accept="image/*" style="display:none;" onchange="uploadAvatar(this.files[0])">
        </label>
      </div>
      <div class="profile-name">${currentUser.name} ${currentUser.vip ? '<span class="vip-badge">VIP</span>' : ''}</div>
      ${!currentUser.vip ? `<button class="btn-primary" style="width:auto; padding:9px 20px; margin-top:10px;" onclick="upgradeVip()">✨ الترقية إلى VIP</button>` : ''}
    </div>

    <div class="stat-card">
      <div><b>${publicPosts.filter(p=>p.answered_by===currentUser.id || p.author_id===currentUser.id).length}</b><span>مساهمة</span></div>
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
            <div style="font-size:12.5px; line-height:1.4; color:var(--ink);">${q.q}</div>
            <div class="muted" style="font-size:10px; margin-top:2px;">بانتظار أي أحد يجاوب — ${timeAgo(q.created_at)}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="eyebrow">الحساب</div>
    <div class="card">
      <button class="btn-ghost" style="margin-top:0;" onclick="logout()">🚪 تسجيل الخروج</button>
    </div>

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
      <div class="inbox-item" onclick="openThread('${c.userId}','${(c.name||'').replace(/'/g,"\\'")}','${c.initials||'?'}', ${c.avatar? `'${c.avatar}'` : 'null'})">
        ${avatarHtml(c.avatar, c.initials, '')}
        <div style="flex:1;">
          <b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${c.name||'مستخدم'}</b>
          <div class="muted" style="font-size:11px; margin-top:2px;">${(c.lastText||'').slice(0,40)}</div>
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
        ${m.text}
      </div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// ---- شيت زيارة حساب شخص ----
function renderProfileSheet(p){
  const isMe = p.id === currentUser.id;
  document.getElementById('profileSheetBody').innerHTML = `
    <div style="text-align:center;">
      ${avatarHtml(p.avatar_url, p.initials, '')}
      <div class="profile-name" style="justify-content:center; margin-top:10px;">${p.name} ${p.vip?'<span class="vip-badge">VIP</span>':''}</div>
      ${!isMe ? `
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button class="btn-primary" style="margin-top:0;" onclick="toggleFollow('${p.id}')">${followingIds.has(p.id)?'إلغاء المتابعة':'متابعة'}</button>
        <button class="btn-primary" style="margin-top:0; background:var(--ink);" onclick="closeSheet(); openThread('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.initials}', ${p.avatar_url?`'${p.avatar_url}'`:'null'})">💬 مراسلة</button>
      </div>` : `<div class="muted" style="margin-top:10px; font-size:12px;">هذا حسابك أنت</div>`}
    </div>
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
      <b style="font-family:'El Messiri',sans-serif; font-size:12.5px; color:var(--ink);">${p.name}</b>
    </div>
  `).join('');
}

// ================= تصدير صورة القصة (توليد حقيقي بالمتصفح، بدون سيرفر) =================
function exportStoryImage(text){
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,1080,1350);
  grad.addColorStop(0,'#EA323C'); grad.addColorStop(1,'#B9151F');
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

// ================= نافذة الإنشاء (composer) =================
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
    if(list) list.innerHTML = computeTopics().filter(t=>t.name!=='الكل').map(t=>`<option value="${t.name}">`).join('');
  }
}

// ================= الإجابة على سؤال =================
function openAnswer(postId){
  activeQuestion = publicPosts.find(p=>p.id===postId);
  if(!activeQuestion) return;
  document.getElementById('answerQuestionPreview').textContent = activeQuestion.q;
  document.getElementById('answerText').value = '';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('answerSheet').classList.add('show');
}

// ================= بدء التطبيق =================
initApp();

// نلغي أي Service Worker قديم مسجّل من قبل (كان سبب مشكلة الكاش العالق) —
// يضمن إن أي زائر عنده نسخة قديمة مكسورة محفوظة، تنشال تلقائياً.
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
  if(window.caches){ caches.keys().then(keys => keys.forEach(k => caches.delete(k))); }
}
