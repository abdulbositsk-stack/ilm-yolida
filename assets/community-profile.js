/* Ilm yo'lida — personal channel UI. Supabase sync is enabled after project keys are configured. */
(() => {
  const profileKey = 'ilm-yolida-community-profile';
  const postsKey = 'ilm-yolida-community-posts';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const refresh = () => { if (typeof render === 'function') render(); };

  function currentProfile() {
    const account = read('ilm-yolida-profile', {});
    const saved = read(profileKey, {});
    return {
      name: saved.name || [account.first, account.last].filter(Boolean).join(' ') || 'Ilm yo‘lovchisi',
      avatar: saved.avatar || account.photo || '',
      bio: saved.bio || '',
      reading: saved.reading || '',
      isPublic: saved.isPublic !== false
    };
  }

  function posts() { return read(postsKey, []); }
  function initials(name) { return name.split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase(); }
  function dateLabel(value) { return new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

  function postCard(post) {
    const comments = post.comments || [];
    return `<article class="community-post"><header><div class="community-avatar">${post.author.avatar ? `<img src="${esc(post.author.avatar)}" alt="">` : esc(initials(post.author.name))}</div><div><b>${esc(post.author.name)}</b><span>${dateLabel(post.createdAt)} · ${post.kind === 'quote' ? 'Iqtibos' : post.kind === 'note' ? 'Qayd' : 'Xulosa'}</span></div></header><p>${esc(post.body).replace(/\n/g, '<br>')}</p><footer><button onclick="communityReact('${post.id}','like')">♡ ${post.likes || 0}</button><button onclick="communityReact('${post.id}','dislike')">△ ${post.dislikes || 0}</button><span>${comments.length} ta fikr</span></footer><div class="community-comments">${comments.map(comment => `<p><b>${esc(comment.author)}</b>${esc(comment.body)}</p>`).join('')}<form onsubmit="event.preventDefault();communityComment('${post.id}',this)"><input name="comment" maxlength="1200" required placeholder="Mulohazangizni yozing…"><button type="submit">Yuborish</button></form></div></article>`;
  }

  function communityView() {
    const profile = currentProfile();
    const myPosts = posts();
    const profilePhoto = profile.avatar ? `<img src="${esc(profile.avatar)}" alt="${esc(profile.name)}">` : esc(initials(profile.name));
    return `<section class="book-app community-app"><header class="community-hero"><button class="program-return" onclick="programBack()">← Ilm maydoniga qaytish</button><div class="community-profile-head"><div class="community-avatar community-avatar-large">${profilePhoto}</div><div><span class="community-kicker">ILM DAVRASI · SHAXSIY KANAL</span><h1>${esc(profile.name)}</h1><p>${esc(profile.bio || 'O‘qish yo‘lingizdan qolgan fikrlarni boshqalar bilan ulashing.')}</p>${profile.reading ? `<small>Hozir o‘qiyapti: <b>${esc(profile.reading)}</b></small>` : ''}</div><button class="community-edit" onclick="communityEditProfile()">Profilni tahrirlash</button></div><div class="community-metrics"><span><b>${myPosts.length}</b> post</span><span><b>${myPosts.reduce((total, post) => total + (post.likes || 0), 0)}</b> yoqtirish</span><span>${profile.isPublic ? '◉ Profil ochiq' : '◌ Profil yopiq'}</span></div></header><nav class="book-tabs"><button class="book-tab active">Mening kanalim</button><button class="book-tab" onclick="setBookTab('group')">Challenge davrasi</button><button class="book-tab" onclick="setBookTab('shelf')">Javonim</button></nav><section class="community-composer"><div><span>ULASHISH</span><h2>Bugun nimani anglandingiz?</h2><p>Iqtibos, qayd yoki xulosangiz kanalga post bo‘lib tushadi.</p></div><form onsubmit="event.preventDefault();communityPublish(this)"><select name="kind"><option value="quote">Iqtibos</option><option value="note">Qayd</option><option value="reflection">Xulosa</option></select><textarea name="body" maxlength="3000" required placeholder="Fikringizni hurmat va mazmun bilan yozing…"></textarea><div><small>${profile.isPublic ? 'Postingiz ochiq profil sifatida ko‘rinadi.' : 'Profil yopiq — postlar faqat sizda saqlanadi.'}</small><button class="book-primary" type="submit">Post qilish →</button></div></form></section><section class="community-feed"><div class="community-feed-head"><div><span>SO‘NGGI POSTLAR</span><h2>Sizning fikrlar maydoningiz</h2></div><small>${myPosts.length ? 'Yangi fikrlar shu yerda yashaydi.' : 'Birinchi postingizni kutmoqda.'}</small></div>${myPosts.length ? myPosts.map(postCard).join('') : `<div class="book-empty"><b>Kanalingiz sokin turibdi</b><span>O‘qigan kitobingizdan bir fikr bilan suhbatni boshlang.</span></div>`}</section></section>`;
  }

  window.communityEditProfile = () => {
    const profile = currentProfile();
    const name = prompt('Profil ismi', profile.name);
    if (name === null) return;
    const bio = prompt('Qisqa bio', profile.bio);
    if (bio === null) return;
    const reading = prompt('Hozir o‘qiyotgan kitobingiz', profile.reading);
    if (reading === null) return;
    write(profileKey, { ...profile, name: name.trim().slice(0, 80) || profile.name, bio: bio.trim().slice(0, 280), reading: reading.trim().slice(0, 180) });
    refresh();
  };
  window.communityPublish = form => {
    const body = form.body.value.trim();
    if (!body) return;
    const profile = currentProfile();
    const next = [{ id: uid(), kind: form.kind.value, body, author: { name: profile.name, avatar: profile.avatar }, likes: 0, dislikes: 0, comments: [], createdAt: new Date().toISOString() }, ...posts()];
    write(postsKey, next);
    refresh();
  };
  window.communityReact = (id, kind) => {
    const next = posts().map(post => post.id === id ? { ...post, [kind === 'like' ? 'likes' : 'dislikes']: (post[kind === 'like' ? 'likes' : 'dislikes'] || 0) + 1 } : post);
    write(postsKey, next); refresh();
  };
  window.communityComment = (id, form) => {
    const body = form.comment.value.trim(); if (!body) return;
    const author = currentProfile().name;
    write(postsKey, posts().map(post => post.id === id ? { ...post, comments: [...(post.comments || []), { id: uid(), author, body }] } : post));
    refresh();
  };

  const priorBooksView = window.booksView;
  window.booksView = function communityBooksView() {
    if (state.bookTab === 'community') return communityView();
    const view = priorBooksView();
    if (!view.includes('book-tabs') || view.includes('Mening kanalim')) return view;
    return view.replace('</nav>', `<button class="book-tab ${state.bookTab === 'community' ? 'active' : ''}" onclick="setBookTab('community')">Mening kanalim</button></nav>`);
  };
})();
