/* Cloud-backed reader profiles, community feed, follows and notifications. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nameOf = profile => profile?.display_name || 'Ilm yo‘lovchisi';
  const initials = name => String(name).split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase();
  const dateLabel = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date); };
  const cloud = () => window.ilmCloud;
  const renderSafe = () => { try { render(); } catch {} };

  function avatar(profile, large = false) {
    const className = `community-avatar${large?' community-avatar-large':''}`;
    return `<div class="${className}">${profile?.avatar_url?`<img src="${esc(profile.avatar_url)}" alt="${esc(nameOf(profile))}">`:esc(initials(nameOf(profile)))}</div>`;
  }
  function sharePost(post) {
    const profile = post.profiles || {};
    return `${nameOf(profile)} Ilm Yo‘lida fikr ulashdi:\n\n${post.body}\n\nIlm Yo‘lida · Ilmni birga ulashamiz`;
  }
  function feedCard(post) {
    const profile = post.profiles || {}, reactions = post.reactions || [], comments = post.comments || [];
    const mine = cloud()?.user()?.id === post.author_id, myLike = reactions.some(item=>item.user_id===cloud()?.user()?.id && item.kind==='like'), likes = reactions.filter(item=>item.kind==='like').length;
    const author = esc(nameOf(profile));
    return `<article class="community-post community-cloud-post"><header><button class="community-author" type="button" onclick="openCommunityProfile('${profile.id||post.author_id}')">${avatar(profile)}<span><b>${author}</b><small>@${esc(profile.username||'kitobxon')} · ${dateLabel(post.created_at)}</small></span></button>${mine?`<button class="community-post-menu" type="button" onclick="deleteCommunityPost('${post.id}')" aria-label="Postni o‘chirish">•••</button>`:`<details class="community-post-menu"><summary aria-label="Post amallari">•••</summary><button onclick="reportCommunityPost('${post.id}','${post.author_id}')">Shikoyat qilish</button><button onclick="blockCommunityUser('${post.author_id}')">Bloklash</button></details>`}</header><span class="community-post-kind">${post.kind==='quote'?'IQTIBOS':post.kind==='note'?'QAYD':'ILM HAQIDA'}</span><p>${esc(post.body).replace(/\n/g,'<br>')}</p><footer><button class="community-action ${myLike?'liked':''}" type="button" onclick="communityReact('${post.id}')">${myLike?'♥':'♡'} <span>${likes}</span></button><button class="community-action" type="button" onclick="focusCommunityComment('${post.id}')">◯ <span>${comments.length} izoh</span></button><button class="community-action" type="button" onclick="shareCommunityPost('${post.id}')">↗ <span>Ulashish</span></button></footer><section class="community-comments">${comments.map(comment=>`<p><b>${esc(nameOf(comment.profiles))}</b><span>${esc(comment.body)}</span></p>`).join('')}<form id="community-comment-${post.id}" onsubmit="event.preventDefault();communityComment('${post.id}',this)"><input name="comment" maxlength="1200" required placeholder="Fikringizni yozing…"><button type="submit">Yuborish</button></form></section></article>`;
  }
  function authPrompt() {
    return `<section class="community-auth-prompt"><div class="community-auth-icon">✦</div><span class="community-kicker">ILM YO‘LIDA · HAMJAMIYAT</span><h2>Ilm davrasiga qo‘shiling</h2><p>Profil yarating, kitoblaringizni qurilmalar orasida saqlang va boshqa kitobxonlar bilan fikr almashing.</p>${cloud()?.configured?`<button class="book-primary" onclick="openIlmCloudAuth()">Kirish / ro‘yxatdan o‘tish</button>`:`<small>Onlayn akkaunt uchun Supabase loyihasi sozlanishi kerak.</small>`}</section>`;
  }
  function communityHeader(active = 'feed') {
    return `<header class="community-hero"><button class="program-return" onclick="programBack()">← Ilm maydoniga qaytish</button><div class="community-profile-head"><div><span class="community-kicker">KITOBXONLAR JAMOASI</span><h1>Ilmni birga ulashamiz.</h1><p>O‘qigan kitoblaringiz va foydali fikrlar atrofida suhbat quring.</p></div><div class="community-header-actions"><button class="community-icon-button" onclick="openCommunityNotifications()" aria-label="Bildirishnomalar">♧ <i id="community-unread-badge" hidden></i></button><button class="community-profile-button" onclick="openCommunityProfile()">Mening profilim</button></div></div><nav class="community-nav"><button onclick="setBookTab('shelf')">Javonim</button><button onclick="setBookTab('group')">Guruhlar</button><button class="${active==='feed'?'active':''}" onclick="openCommunityFeed()">Yangiliklar</button><button class="${active==='search'?'active':''}" onclick="openCommunitySearch()">Kitobxonlarni topish</button><button class="${active==='profile'?'active':''}" onclick="openCommunityProfile()">Profilim</button><button class="${active==='notifications'?'active':''}" onclick="openCommunityNotifications()">Bildirishnomalar</button></nav></header>`;
  }
  function composer() {
    return `<section class="community-composer"><div><span>ILM HAQIDA POST</span><h2>Bugun nimani anglandingiz?</h2><p>Foydali fikr, o‘qish tajribasi yoki savolingizni yozing.</p></div><form onsubmit="event.preventDefault();communityPublish(this)"><select name="kind" aria-label="Post turi"><option value="reflection">Fikr / xulosa</option><option value="quote">Iqtibos</option><option value="note">Qayd</option></select><textarea name="body" maxlength="3000" required placeholder="Ilm yo‘lida nimalarni o‘rgandingiz?"></textarea><div><label class="community-privacy"><input type="checkbox" name="private"> Faqat profilimda saqlansin</label><button class="book-primary" type="submit">Post qilish →</button></div></form></section>`;
  }
  function feedView() {
    const active = state.communityFeedType || 'all', posts = state.communityFeedPosts || [];
    return `<section class="community-app">${communityHeader('feed')}${composer()}<section class="community-feed"><div class="community-feed-head"><div><span>ILM DAVRASI</span><h2>Kitobxonlar fikrlari</h2></div><button class="community-refresh" onclick="loadCommunityFeed(true)">Yangilash</button></div><div class="community-feed-filters"><button class="${active==='all'?'active':''}" onclick="setCommunityFeedType('all')">Barchasi</button><button class="${active==='following'?'active':''}" onclick="setCommunityFeedType('following')">Kuzatayotganlar</button></div>${state.communityFeedLoading?'<div class="community-loading">Fikrlar yuklanmoqda…</div>':state.communityError?`<div class="community-error">${esc(state.communityError)} <button onclick="loadCommunityFeed(true)">Qayta urinish</button></div>`:posts.length?posts.map(feedCard).join(''):`<div class="book-empty"><b>Hozircha post yo‘q</b><span>Birinchi bo‘lib foydali fikr ulashing yoki kitobxonlarni kuzating.</span></div>`}</section></section>`;
  }
  function profileView(profile, posts, books) {
    const own = cloud()?.user()?.id === profile.id;
    return `<section class="community-app">${communityHeader('profile')}<section class="community-profile-card"><div class="community-public-hero">${avatar(profile,true)}<div><span class="community-kicker">ILM YO‘LIDA · KITOBXON</span><h1>${esc(nameOf(profile))}</h1><small>@${esc(profile.username||'kitobxon')}</small><p>${esc(profile.bio||'Hali bio yozilmagan.')}</p>${profile.currently_reading?`<span class="community-reading-now">📖 Hozir o‘qiyapti: ${esc(profile.currently_reading)}</span>`:''}</div>${own?`<button class="community-edit" onclick="toggleCommunityEditor()">Profilni tahrirlash</button>`:`<button class="community-follow ${profile.followedByMe?'following':''}" onclick="toggleCommunityFollow('${profile.id}')">${profile.followedByMe?'Kuzatilmoqda':'Kuzatish +'}</button>`}</div><div class="community-metrics"><span><b>${profile.followerCount||0}</b> kuzatuvchi</span><span><b>${profile.followingCount||0}</b> kuzatmoqda</span><span><b>${posts.length}</b> post</span></div>${own&&state.communityEditOpen?profileEditor(profile):''}</section>${books.length?`<section class="community-books"><h2>Ommaviy javoni</h2><div class="community-book-row">${books.map(book=>`<article>${book.cover_url?`<img src="${esc(book.cover_url)}" alt="">`:`<span class="community-book-placeholder">📚</span>`}<b>${esc(book.title)}</b><small>${esc(book.author||'')}</small></article>`).join('')}</div></section>`:''}<section class="community-feed"><div class="community-feed-head"><div><span>SHAXSIY KANAL</span><h2>${own?'Mening postlarim':`${esc(nameOf(profile))}ning postlari`}</h2></div></div>${posts.length?posts.map(feedCard).join(''):`<div class="book-empty"><b>Postlar hali yo‘q</b><span>${own?'Ilm yo‘lidagi fikringizni ulashing.':'Bu kitobxon hozircha post ulashmagan.'}</span></div>`}</section></section>`;
  }
  function profileEditor(profile) {
    return `<form class="community-editor" onsubmit="event.preventDefault();saveCommunityProfile(this)"><h2>Profil sozlamalari</h2><label>Profil rasmi<input type="file" accept="image/jpeg,image/png,image/webp" onchange="previewCommunityAvatar(this)"><img id="community-avatar-preview" src="${esc(profile.avatar_url||'')}" alt="" ${profile.avatar_url?'':'hidden'}></label><div class="two-col"><label>Ism<input name="display_name" maxlength="80" minlength="2" required value="${esc(profile.display_name)}"></label><label>Foydalanuvchi nomi<input name="username" minlength="3" maxlength="30" pattern="[a-z0-9_]+" required value="${esc(profile.username)}"></label></div><label>Qisqacha bio<textarea name="bio" maxlength="280">${esc(profile.bio||'')}</textarea></label><label>Hozir o‘qiyotgan kitob<input name="currently_reading" maxlength="180" value="${esc(profile.currently_reading||'')}"></label><label class="community-privacy"><input name="is_public" type="checkbox" ${profile.is_public?'checked':''}> Profilim va postlarim ommaga ochiq</label><p id="community-profile-status" role="status"></p><div><button type="button" class="community-cancel" onclick="toggleCommunityEditor()">Bekor qilish</button><button type="submit" class="book-primary">Saqlash</button></div></form>`;
  }
  function searchView() {
    const results = state.communitySearchResults || [];
    return `<section class="community-app">${communityHeader('search')}<section class="community-feed community-search-panel"><span class="community-kicker">YANGI DAVRA TOPING</span><h2>Kitobxonlarni qidiring</h2><form onsubmit="event.preventDefault();searchCommunityProfiles(this.elements.query.value)"><input name="query" minlength="2" maxlength="60" placeholder="Ism yoki @username"><button class="book-primary">Qidirish</button></form>${state.communitySearchLoading?'<div class="community-loading">Qidirilmoqda…</div>':results.map(profile=>`<article class="community-user-result"><button onclick="openCommunityProfile('${profile.id}')">${avatar(profile)}<span><b>${esc(profile.display_name)}</b><small>@${esc(profile.username)} · ${esc(profile.bio||'')}</small></span></button><button class="community-follow" onclick="toggleCommunityFollow('${profile.id}')">Kuzatish +</button></article>`).join('')||'<div class="book-empty"><b>Ism bilan izlang</b><span>Ochiq profillar natijalarda chiqadi.</span></div>'}</section></section>`;
  }
  function notificationsView() {
    const items = state.communityNotifications || [];
    return `<section class="community-app">${communityHeader('notifications')}<section class="community-feed"><div class="community-feed-head"><div><span>SIZ UCHUN</span><h2>Bildirishnomalar</h2></div><button class="community-refresh" onclick="loadCommunityNotifications()">Yangilash</button></div>${items.length?items.map(item=>`<button class="community-notification ${item.is_read?'':'unread'}" onclick="readCommunityNotification('${item.id}','${item.actor_id||''}')">${avatar(item.profiles||{})}<span><b>${esc(nameOf(item.profiles))}</b> ${item.type==='follow'?'sizni kuzata boshladi':item.type==='reaction'?'postingizni yoqtirdi':item.type==='comment'?'postingizga izoh yozdi':item.type==='group_message'?'guruh chatida xabar yozdi':'challenge yangilandi'}<small>${dateLabel(item.created_at)}</small></span>${item.is_read?'':'<i></i>'}</button>`).join(''):`<div class="book-empty"><b>Yangi bildirishnoma yo‘q</b><span>Yangiliklar shu yerda ko‘rinadi.</span></div>`}</section></section>`;
  }
  function communityView() {
    if (!cloud()?.configured) return `<section class="community-app">${communityHeader()}${authPrompt()}</section>`;
    if (!cloud()?.user()) return `<section class="community-app">${communityHeader()}${authPrompt()}</section>`;
    if (state.communityView === 'search') { setTimeout(()=>{document.getElementById('community-search-input')?.focus()},0); return searchView(); }
    if (state.communityView === 'notifications') return notificationsView();
    if (state.communityView === 'profile' || state.communityProfileId) {
      if (!state.communityProfile || state.communityProfile.id !== (state.communityProfileId || cloud().user().id)) {
        setTimeout(loadCommunityProfile, 0);
        return `<section class="community-app">${communityHeader('profile')}<div class="community-loading large">Profil yuklanmoqda…</div></section>`;
      }
      const own = state.communityProfile.id === cloud().user().id;
      const profilePosts = state.communityProfilePosts || [];
      const profileBooks = state.communityProfileBooks || [];
      return profileView(state.communityProfile, profilePosts, profileBooks);
    }
    if (!state.communityFeedPosts || state.communityFeedExpired) setTimeout(()=>loadCommunityFeed(),0);
    if (state.communityUnread === undefined) setTimeout(loadCommunityNotifications,0);
    return feedView();
  }

  window.openCommunityFeed = () => { state.communityView='feed'; state.communityProfileId=''; state.communityProfile=null; renderSafe(); };
  window.openCommunitySearch = () => { state.communityView='search'; state.communitySearchResults=[]; renderSafe(); };
  window.openCommunityNotifications = () => { state.communityView='notifications'; renderSafe(); loadCommunityNotifications(); };
  window.openCommunityProfile = async profileId => {
    state.communityView='profile'; state.communityProfileId=profileId || cloud()?.user()?.id || '';
    state.communityProfile=null; state.communityProfilePosts=[]; state.communityProfileBooks=[]; renderSafe();
    await loadCommunityProfile();
  };
  window.loadCommunityFeed = async (force = false) => {
    if (!cloud()?.user() || state.communityFeedLoading) return;
    state.communityFeedLoading=true; state.communityError=''; if (force) state.communityFeedPosts=[]; renderSafe();
    try { state.communityFeedPosts=await cloud().communityFeed({ followingOnly: state.communityFeedType==='following' }); state.communityFeedExpired=false; }
    catch (error) { state.communityError=error.message || 'Postlarni yuklab bo‘lmadi.'; }
    finally { state.communityFeedLoading=false; if (state.communityView==='feed') renderSafe(); }
  };
  window.setCommunityFeedType = type => { state.communityFeedType=type; state.communityFeedPosts=null; renderSafe(); loadCommunityFeed(); };
  window.communityPublish = async form => {
    const body=form.elements.body.value.trim(), kind=form.elements.kind.value, visibility=form.elements.private.checked?'private':'public'; if (!body) return;
    try { await cloud().publishPost({kind,body,visibility}); form.reset(); state.communityFeedPosts=null; await loadCommunityFeed(true); }
    catch(error) { alert(error.message || 'Postni saqlab bo‘lmadi.'); }
  };
  window.communityReact = async postId => {
    try { await cloud().reactToPost(postId); state.communityFeedPosts=null; state.communityProfilePosts=null; renderSafe(); if (state.communityView==='profile') await loadCommunityProfile(); else await loadCommunityFeed(true); }
    catch(error) { alert(error.message || 'Yoqtirishni saqlab bo‘lmadi.'); }
  };
  window.communityComment = async (postId, form) => {
    const body=form.elements.comment.value.trim(); if (!body) return;
    try { await cloud().commentOnPost(postId,body); form.reset(); state.communityFeedPosts=null; state.communityProfilePosts=null; renderSafe(); if (state.communityView==='profile') await loadCommunityProfile(); else await loadCommunityFeed(true); }
    catch(error) { alert(error.message || 'Izohni saqlab bo‘lmadi.'); }
  };
  window.focusCommunityComment = postId => document.getElementById(`community-comment-${postId}`)?.elements.comment.focus();
  window.shareCommunityPost = async postId => {
    const post=[...(state.communityFeedPosts||[]),...(state.communityProfilePosts||[])].find(item=>item.id===postId); if (!post) return;
    const text=sharePost(post);
    if (navigator.share) { try { await navigator.share({title:'Ilm Yo‘lida',text}); return; } catch(error) { if(error.name==='AbortError')return; } }
    try { await navigator.clipboard.writeText(text); alert('Post matni nusxalandi. Uni Telegramda ulashishingiz mumkin.'); }
    catch { window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`,'_blank','noopener'); }
  };
  window.deleteCommunityPost = async postId => {
    if (!confirm('Postingizni o‘chirasizmi?')) return;
    try { const result=await cloud().client.from('community_posts').delete().eq('id',postId).eq('author_id',cloud().user().id); if(result.error)throw result.error; state.communityFeedPosts=null; state.communityProfilePosts=null; renderSafe(); }
    catch(error) { alert(error.message || 'Postni o‘chirib bo‘lmadi.'); }
  };
  window.searchCommunityProfiles = async term => {
    state.communityQuery=String(term||'').trim();
    state.communitySearchLoading=true; state.communitySearchResults=[]; renderSafe();
    try { state.communitySearchResults=await cloud().searchProfiles(state.communityQuery); }
    catch(error) { state.communityError=error.message; }
    finally { state.communitySearchLoading=false; renderSafe(); }
  };
  window.reportCommunityPost = async (postId,userId) => {
    const reason=prompt('Nima uchun ushbu post haqida xabar beryapsiz?');if(!reason?.trim())return;
    try{await cloud().reportUser({postId,userId,reason});alert('Xabaringiz yuborildi. Rahmat.');}
    catch(error){alert(error.message||'Xabar yuborilmadi.');}
  };
  window.blockCommunityUser = async userId => {
    if(!confirm('Ushbu foydalanuvchini bloklaysizmi? U sizning hamjamiyat lentangizda ko‘rinmaydi.'))return;
    try{await cloud().blockProfile(userId);state.communityFeedPosts=null;await loadCommunityFeed(true);}
    catch(error){alert(error.message||'Foydalanuvchi bloklanmadi.');}
  };
  window.toggleCommunityFollow = async profileId => {
    try { const following=await cloud().followProfile(profileId); if(state.communityProfile?.id===profileId) state.communityProfile={...state.communityProfile,followedByMe:following,followerCount:Math.max(0,(state.communityProfile.followerCount||0)+(following?1:-1))}; if(state.communityView==='search')await searchCommunityProfiles(document.querySelector('.community-search-panel input')?.value||''); else renderSafe(); }
    catch(error) { alert(error.message || 'Kuzatishni saqlab bo‘lmadi.'); }
  };
  window.toggleCommunityEditor = () => { state.communityEditOpen=!state.communityEditOpen; renderSafe(); };
  window.previewCommunityAvatar = input => {
    const file=input.files?.[0]; if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader(); reader.onload=()=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas'),scale=Math.min(1,500/Math.max(image.width,image.height));canvas.width=image.width*scale;canvas.height=image.height*scale;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);state.pendingCommunityAvatar=canvas.toDataURL('image/jpeg',.8);const preview=document.getElementById('community-avatar-preview');if(preview){preview.src=state.pendingCommunityAvatar;preview.hidden=false;}};image.src=reader.result;};reader.readAsDataURL(file);
  };
  window.saveCommunityProfile = async form => {
    const values=new FormData(form), username=String(values.get('username')||'').toLowerCase().trim();
    const button=form.querySelector('[type=submit]'), status=document.getElementById('community-profile-status');button.disabled=true;if(status)status.textContent='Saqlanmoqda…';
    try {
      const current=state.communityProfile||await cloud().profile();
      const updated=await cloud().updateProfile({display_name:String(values.get('display_name')).trim(),username,bio:String(values.get('bio')||'').trim(),currently_reading:String(values.get('currently_reading')||'').trim(),is_public:values.get('is_public')==='on',...(state.pendingCommunityAvatar?{avatar_url:state.pendingCommunityAvatar}:{})});
      state.pendingCommunityAvatar='';state.communityEditOpen=false;state.communityProfile={...current,...updated};await loadCommunityProfile();
    } catch(error) { if(status)status.textContent=error.message||'Profilni saqlab bo‘lmadi.';button.disabled=false; }
  };
  window.readCommunityNotification = async (notificationId, actorId) => {
    try { await cloud().markNotificationRead(notificationId); state.communityNotifications=(state.communityNotifications||[]).map(item=>item.id===notificationId?{...item,is_read:true}:item); state.communityUnread=Math.max(0,(state.communityUnread||0)-1); if(actorId) { state.communityView='profile'; await window.openCommunityProfile(actorId); } else renderSafe(); }
    catch(error) { alert(error.message); }
  };
  window.loadCommunityNotifications = async () => {
    if(!cloud()?.user())return;
    try { state.communityNotifications=await cloud().notifications();state.communityUnread=state.communityNotifications.filter(item=>!item.is_read).length; }
    catch(error) { state.communityError=error.message; }
    const badge=document.getElementById('community-unread-badge');if(badge){badge.hidden=!state.communityUnread;badge.textContent=state.communityUnread>9?'9+':String(state.communityUnread);}
    if(state.communityView==='notifications')renderSafe();
  };
  async function loadCommunityProfile() {
    const target=state.communityProfileId||cloud()?.user()?.id;if(!target||!cloud()?.user())return;
    try {
      const [profile, posts, books]=await Promise.all([cloud().profile(target),cloud().communityFeed({authorId:target}),cloud().publicBooks(target)]);
      state.communityProfile=profile;state.communityProfilePosts=posts.filter(post=>post.visibility==='public'||post.author_id===cloud().user().id);state.communityProfileBooks=books;
    } catch(error) { state.communityError=error.message||'Profilni yuklab bo‘lmadi.'; }
    renderSafe();
  }
  document.addEventListener('ilm-cloud-redraw', () => { if(state.section==='books'&&state.bookTab==='community')renderSafe(); });
  window.addEventListener('ilm-auth-change', event => {
    if(event.detail?.user && state.section==='books'&&state.bookTab==='community'){state.communityFeedPosts=null;state.communityProfile=null;renderSafe();}
  });
  window.addEventListener('ilm-cloud-sync', () => {
    const badge=document.getElementById('community-unread-badge');
    if(state.section==='books'&&state.bookTab==='community')loadCommunityNotifications();
    else if(badge)loadCommunityNotifications();
  });
  const previousBooksView=window.booksView;
  window.booksView=()=>state.bookTab==='community'?communityView():previousBooksView();
  document.head.insertAdjacentHTML('beforeend',`<style>.community-app{max-width:1180px;margin:auto;padding-bottom:46px}.community-hero{padding:24px 28px;border-radius:24px}.community-profile-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px}.community-profile-head>div:first-child{max-width:730px}.community-header-actions{display:flex;align-items:center;gap:8px}.community-profile-button,.community-icon-button,.community-refresh{position:relative;border:1px solid #ffffff45;border-radius:11px;padding:10px 13px;background:#ffffff12;color:#fff;font:700 .78rem inherit;cursor:pointer}.community-icon-button{font-size:1.1rem}.community-icon-button i{position:absolute;right:2px;top:2px;min-width:16px;height:16px;padding:2px;border-radius:99px;background:#d64e4e;color:#fff;font-size:.55rem;font-style:normal}.community-nav{display:flex;gap:6px;overflow-x:auto;margin-top:20px;padding-top:13px;border-top:1px solid #ffffff26}.community-nav button{border:0;border-radius:9px;padding:9px 12px;background:transparent;color:#e6f1eb;font:700 .75rem inherit;white-space:nowrap;cursor:pointer}.community-nav button.active,.community-nav button:hover{background:#ffffff20;color:#f4d98e}.community-auth-prompt{max-width:620px;margin:24px auto;padding:34px;text-align:center;border:1px solid #dbe8e0;border-radius:22px;background:#fff}.community-auth-icon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 14px;border-radius:16px;background:#eaf4ed;color:#b1882b;font-size:1.5rem}.community-auth-prompt h2{color:#174c3d;font:800 1.5rem Georgia}.community-auth-prompt p{color:#6a7d74;line-height:1.6}.community-cloud-post{border-top:1px solid #e9eee9}.community-author{display:flex;align-items:center;gap:10px;border:0;background:none;text-align:left;cursor:pointer}.community-author>span{display:grid;gap:3px}.community-author b{color:#224c3c}.community-author small{color:#7a8981;font-size:.7rem}.community-post-menu{margin-left:auto;border:0;background:none;color:#74877d;cursor:pointer}.community-post-kind{display:inline-block;margin:12px 0 0;padding:4px 7px;border-radius:999px;background:#fbf5e4;color:#977321;font-size:.6rem;font-weight:900;letter-spacing:.07em}.community-action{display:flex;align-items:center;gap:5px}.community-action.liked{color:#bd4c55}.community-privacy{display:flex;align-items:center;gap:7px;color:#72837a;font-size:.72rem}.community-privacy input{accent-color:#176246}.community-feed-filters{display:flex;gap:7px;margin:-4px 0 14px}.community-feed-filters button{border:1px solid #e0e9e3;border-radius:9px;padding:7px 11px;background:#fff;color:#5d766a;font:700 .72rem inherit;cursor:pointer}.community-feed-filters button.active{border-color:#176246;background:#edf5f0;color:#176246}.community-loading,.community-error{padding:32px;text-align:center;color:#70847a}.community-loading.large{margin:20px auto;max-width:720px}.community-error{color:#a33}.community-error button{margin-left:8px}.community-public-hero{display:flex;align-items:center;gap:17px;padding:25px;border-radius:20px;background:linear-gradient(125deg,#123d34,#1a5447);color:#fff}.community-public-hero>div:nth-child(2){flex:1}.community-public-hero h1{margin:3px 0;font:800 1.7rem Georgia}.community-public-hero>div:nth-child(2)>small{color:#d2e8db;font-size:.76rem}.community-public-hero p{margin:9px 0;color:#ecf5ef;white-space:pre-wrap}.community-reading-now{color:#f4d98e;font-size:.78rem}.community-follow{border:0;border-radius:10px;padding:10px 14px;background:#e6c46b;color:#173e35;font:800 .75rem inherit;cursor:pointer}.community-follow.following{border:1px solid #ffffff6e;background:transparent;color:#fff}.community-profile-card{margin:18px 0;overflow:hidden;border:1px solid #dce8e0;border-radius:20px;background:#fff}.community-profile-card .community-metrics{margin:0;padding:15px 24px;color:#71847a;border-top:1px solid #edf1ed}.community-profile-card .community-metrics b{color:#176246}.community-editor{display:grid;gap:12px;margin:18px;padding:18px;border-radius:15px;background:#f6faf7}.community-editor h2{margin:0;color:#174c3d;font:800 1.1rem Georgia}.community-editor label{display:grid;gap:5px;color:#547065;font-size:.75rem;font-weight:700}.community-editor input:not([type=checkbox]),.community-editor textarea{width:100%;padding:10px;border:1px solid #d9e5dd;border-radius:9px;font:inherit}.community-editor textarea{min-height:70px}.community-editor>label:first-of-type{grid-template-columns:1fr auto;align-items:center}.community-editor img{width:45px;height:45px;border-radius:50%;object-fit:cover}.community-editor>div:last-child{display:flex;justify-content:flex-end;gap:8px}.community-cancel{border:1px solid #dce7e0;border-radius:9px;padding:9px 12px;background:#fff;color:#5b7368;cursor:pointer}.community-search-panel form{display:flex;gap:8px;margin:15px 0}.community-search-panel form input{min-width:0;flex:1;padding:11px;border:1px solid #d9e5dd;border-radius:10px;font:inherit}.community-user-result{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #e9eee9}.community-user-result>button:first-child{display:flex;align-items:center;gap:10px;min-width:0;border:0;background:none;text-align:left;cursor:pointer}.community-user-result>button:first-child span{display:grid;gap:4px;min-width:0}.community-user-result small{overflow:hidden;color:#77867e;text-overflow:ellipsis;white-space:nowrap}.community-user-result .community-follow{background:#176246;color:#fff}.community-notification{display:flex;width:100%;align-items:center;gap:11px;padding:13px;border:0;border-bottom:1px solid #edf1ed;background:#fff;text-align:left;cursor:pointer}.community-notification>span{display:grid;gap:4px;flex:1;color:#4f665b;font-size:.8rem}.community-notification small{color:#8a9991;font-size:.68rem}.community-notification.unread{background:#f3f8f4}.community-notification>i{width:8px;height:8px;border-radius:50%;background:#1d815c}.community-books{margin:18px 0;padding:20px;border:1px solid #e0e9e3;border-radius:17px;background:#fff}.community-books h2{margin:0 0 12px;color:#174c3d;font:800 1.1rem Georgia}.community-book-row{display:flex;gap:12px;overflow:auto}.community-book-row article{display:grid;min-width:112px;max-width:135px;gap:5px;color:#274c3d;font-size:.72rem}.community-book-row img,.community-book-placeholder{display:grid;width:90px;height:120px;place-items:center;object-fit:cover;border-radius:6px;background:#edf5f0}.community-book-row small{color:#70847a}@media(max-width:680px){.community-hero{padding:18px}.community-profile-head{align-items:flex-start;flex-direction:column}.community-header-actions{width:100%;justify-content:space-between}.community-public-hero{align-items:flex-start;flex-wrap:wrap;padding:18px}.community-public-hero h1{font-size:1.35rem}.community-edit,.community-follow{margin-left:auto}.community-profile-card .community-metrics{gap:12px;padding:13px;flex-wrap:wrap}.community-nav{margin-top:14px}.community-search-panel form{flex-wrap:wrap}.community-search-panel form .book-primary{width:100%}.community-user-result .community-follow{padding:8px}.community-editor{margin:12px;padding:13px}}</style>`);
})();
