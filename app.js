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
      panel.innerHTML = `<div class="empty-state" style="padding:26px;">لا توجد إشعارات بعد</div>`;
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

// ================= الريندر الرئيسي =================
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
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;margin-bottom:12px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">✨ اقتباس مميز</span>
      <div style="font-family:'El Messiri',sans-serif;font-weight:600;font-size:12px;line-height:1.5;color:var(--ink);">${spotlight.text}</div>
      <div class="muted" style="font-size:10px; margin-top:8px;">— ${spotlight.anon ? 'مجهول' : spotlight.author_name}</div>
    </div>` : ''}
    <div style="background:var(--paper);border:1.5px solid var(--line-on-white);border-radius:15px;padding:13px;">
      <span style="font-size:9.5px;font-weight:800;color:var(--red);margin-bottom:7px;display:block;">👥 أشخاص بالمنصة</span>
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:11px;">ما فيه أعضاء جدد لهسا</div>` :
        peopleDirectory.slice(0,4).map(p=>`
        <div class="d-suggest-row">
          <div class="avatar" style="width:28px;height:28px;font-size:11px;border-radius:9px;">${p.initials}</div>
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
          <div class="foot-btn">💬 <span>${it.comments||0}</span></div>
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
      <div class="tile-avatar">${item.author_initials || (item.anon?'؟':'?')}</div>
      <div class="tile-name">${item.anon ? 'مجهول' : (item.author_name||'')}</div>
      <div class="tile-content quote">${item.text}</div>
      <div class="tile-foot">
        <div class="t-like ${liked?'liked':''}" onclick="toggleLike('${item.id}')">♥ ${item.likes}</div>
        <div>💬 ${item.comments||0}</div>
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
  return `
    <div class="page-title">الاقتباسات</div>
    <div class="muted" style="font-size:12px; margin:-2px 0 12px 0;">دوّر على اقتباس بموضوع يعجبك، أو شارك اقتباسك الخاص</div>
    <div class="composer-trigger" onclick="openComposerMode('quote')">
      <span>شاركنا اقتباس يعجبك...</span>
      <div class="composer-plus">+</div>
    </div>
    <input type="text" class="explore-search" style="margin-top:14px;" placeholder="ابحث عن اقتباس أو شخص..." value="${exploreSearchTerm}" oninput="onExploreSearch(this.value)">
    <div class="topic-row">
      ${topics.map(t=>`<div class="topic-chip ${exploreTopic===t.name?'active':''}" onclick="setExploreTopic('${t.name}')">${t.emoji} ${t.name}</div>`).join('')}
    </div>
    <div class="exploreResults">${renderExploreResults()}</div>
    <div class="eyebrow">أشخاص بالمنصة 👥</div>
    <div class="people-grid">
      ${peopleDirectory.length === 0 ? `<div class="muted" style="font-size:12px;grid-column:1/-1;">ما فيه أعضاء جدد لهسا — كن أول من يدعو أصحابه!</div>` :
        peopleDirectory.map(p=>`
        <div class="people-card">
          <div class="avatar" style="width:38px;height:38px;font-size:14px;border-radius:12px;margin:0 auto 8px auto;">${p.initials}</div>
          <b>${p.name}</b>
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
    <div class="muted" style="font-size:12px; margin:-2px 0 14px 0;">اعترافات مجهولة بالكامل — محد بيعرف مين كتبها</div>
    <div class="composer-trigger" onclick="openComposerMode('confession')">
      <span>عندك اعتراف؟ شاركه بدون أي أثر لهويتك...</span>
      <div class="composer-plus">+</div>
    </div>
    <div style="margin-top:14px;">
      ${confessions.length===0 ? `<div class="empty-state"><div class="big">🎭</div>ما فيه اعترافات بعد<br>كن أول من يعترف بشي</div>` :
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
          <div class="card-foot" style="margin-top:10px;">
            <div class="foot-btn ${liked?'liked':''}" onclick="toggleConfessionLike('${c.id}')">♥ <span>${c.likes}</span></div>
            <div class="foot-btn">💬 <span>${c.comments||0}</span></div>
            <div class="foot-btn" onclick="exportStoryImage('${c.text.replace(/'/g,"\\'")}')">📤 مشاركة</div>
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
      <div class="profile-avatar">${currentUser.initials}</div>
      <div class="profile-name">${currentUser.name} ${currentUser.vip ? '<span class="vip-badge">VIP</span>' : ''}</div>
      ${!currentUser.vip ? `<button class="btn-primary" style="width:auto; padding:9px 20px; margin-top:10px;" onclick="upgradeVip()">✨ الترقية إلى VIP</button>` : ''}
    </div>

    <div class="stat-card">
      <div><b>${publicPosts.filter(p=>p.answered_by===currentUser.id || p.author_id===currentUser.id).length}</b><span>مساهمة</span></div>
      <div><b>${followingIds.size}</b><span>تتابع</span></div>
      <div><b>${currentUser.coins}</b><span>🪙 عملات</span></div>
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
  ctx.fillText('ASK & Quotation', 540, 1260);

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

// تسجيل الـ Service Worker (يفعّل بعض ميزات PWA وتخزين مؤقت بسيط للملفات الثابتة)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err.message));
  });
}
