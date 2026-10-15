/* Polished, book-centered reading shelf with local-first cloud sync. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const id = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const books = () => read('ilm-yolida-books', []).filter(book => book && typeof book.title === 'string');
  const notes = () => read('ilm-yolida-knowledge-notes', []);
  const insights = () => read('ilm-yolida-book-insights', []);
  const person = () => {
    const profile = read('ilm-yolida-profile', {});
    const community = read('ilm-yolida-community-profile', {});
    return community.name || [profile.first, profile.last].filter(Boolean).join(' ') || 'Ilm yo‘lovchisi';
  };
  const saveAndSync = async (key, value) => {
    write(key, value);
    if (window.ilmCloud?.user()) {
      try { await window.ilmCloud.syncLocalReadingData(); }
      catch (error) { console.error('Cloud sync deferred:', error); }
    }
  };
  const entryList = book => {
    const savedNotes = notes().filter(item => item.bookId === book.id || item.source === `Kitob · ${book.title}`).map(item => ({
      id: item.id, kind: item.kind || 'note', body: item.text, pageNumber: item.pageNumber, visibility: item.visibility || 'private', groupId: item.groupId || null, createdAt: item.createdAt, sourceType: 'note',
    }));
    const savedInsights = insights().filter(item => item.bookId === book.id).flatMap(item => [
      item.quote ? { id: `${item.id}:quote`, kind: 'quote', body: item.quote, pageNumber: item.pageNumber, visibility: 'private', createdAt: item.createdAt, sourceType: 'insight' } : null,
      item.reflection ? { id: `${item.id}:reflection`, kind: 'opinion', body: item.reflection, pageNumber: item.pageNumber, visibility: 'private', createdAt: item.createdAt, sourceType: 'insight' } : null,
    ].filter(Boolean));
    return [...savedNotes, ...savedInsights].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  };
  const cover = book => book.cover
    ? `<img class="pro-book-cover" src="${esc(book.cover)}" alt="${esc(book.title)} muqovasi">`
    : `<div class="pro-book-cover pro-cover-placeholder"><span>ILM YO‘LIDA</span><b>${esc(book.title)}</b><small>${esc(book.author || 'Muallif')}</small></div>`;

  window.readBookCover = input => {
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 700 / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        state.pendingBookCover = canvas.toDataURL('image/jpeg', .8);
        const label = document.getElementById('book-cover-name'); if (label) label.textContent = file.name;
        const preview = document.getElementById('book-cover-preview'); if (preview) preview.src = state.pendingBookCover;
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  window.openBookEditor = bookId => { state.bookEditorId = bookId || ''; state.bookFormOpen = true; state.bookDetailId = ''; render(); };
  window.closeBookEditor = () => { state.bookEditorId = ''; state.bookFormOpen = false; state.pendingBookCover = ''; render(); };
  window.openBookDetail = bookId => { state.bookDetailId = bookId; state.bookEditorId = ''; state.bookFormOpen = false; state.bookTab = 'shelf'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  window.backToBookShelf = () => { state.bookDetailId = ''; state.bookEditorId = ''; state.bookFormOpen = false; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  window.saveBook = async () => {
    const form = document.getElementById('pro-book-form'); if (!form) return;
    const values = new FormData(form), title = String(values.get('title') || '').trim();
    if (!title) return;
    const all = books(), editing = all.find(item => item.id === state.bookEditorId);
    const totalPages = Math.max(0, Number(values.get('totalPages')) || 0);
    const currentPage = Math.min(totalPages || Number(values.get('currentPage')) || 0, Math.max(0, Number(values.get('currentPage')) || 0));
    const next = {
      ...(editing || {}), id: editing?.id || id('book'), title: title.slice(0,180),
      author: String(values.get('author') || '').trim().slice(0,140), totalPages, currentPage,
      status: values.get('status') || 'reading', description: String(values.get('description') || '').trim().slice(0,1200),
      isPublic: values.get('isPublic') === 'on', cover: state.pendingBookCover || editing?.cover || '',
      createdAt: editing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const updated = editing ? all.map(item => item.id === editing.id ? next : item) : [next, ...all];
    await saveAndSync('ilm-yolida-books', updated);
    state.pendingBookCover = ''; state.bookEditorId = ''; state.bookFormOpen = false; state.bookFilter = 'all';
    render();
  };

  window.deleteBook = async bookId => {
    const book = books().find(item => item.id === bookId); if (!book) return;
    if (!confirm(`“${book.title}” va unga tegishli yozuvlarni javoningizdan o‘chiraymi?`)) return;
    write('ilm-yolida-books', books().filter(item => item.id !== bookId));
    write('ilm-yolida-knowledge-notes', notes().filter(item => item.bookId !== bookId && item.source !== `Kitob · ${book.title}`));
    write('ilm-yolida-book-insights', insights().filter(item => item.bookId !== bookId));
    write('ilm-yolida-reading-challenges', read('ilm-yolida-reading-challenges', []).filter(item => item.bookId !== bookId));
    try { await window.ilmCloud?.deleteBook(bookId); } catch (error) { console.error('Cloud delete deferred:', error); }
    render();
  };

  window.updateBookProgress = async bookId => {
    const all = books(), book = all.find(item => item.id === bookId), input = document.getElementById(`pro-book-page-${bookId}`);
    if (!book || !input) return;
    const page = Math.max(0, Math.min(Number(book.totalPages) || 100000, Number(input.value) || 0));
    book.currentPage = page; book.updatedAt = new Date().toISOString();
    if (book.totalPages && page >= book.totalPages) { book.status = 'finished'; book.finishedAt = new Date().toISOString(); }
    else if (book.status === 'finished') book.status = 'reading';
    await saveAndSync('ilm-yolida-books', all); render();
  };

  window.saveBookEntry = async bookId => {
    const form = document.getElementById(`pro-entry-form-${bookId}`); if (!form) return;
    const values = new FormData(form), body = String(values.get('body') || '').trim(); if (!body) return;
    const book = books().find(item => item.id === bookId); if (!book) return;
    const visibility = String(values.get('visibility') || 'private');
    const groupId = visibility === 'group' ? String(values.get('groupId') || '') : '';
    const canShareOnline = Boolean(window.ilmCloud?.user());
    if (visibility === 'group' && canShareOnline && !groupId) { alert('Ulashish uchun guruhni tanlang.'); return; }
    const editingId = state.bookEntryEditorId || '';
    const existingEntry = notes().find(item => item.id === editingId);
    const entry = {
      id: existingEntry?.id || id('entry'), bookId, title: book.title, text: body, kind: values.get('kind') || 'note',
      pageNumber: Number(values.get('pageNumber')) || null,
      visibility: canShareOnline ? visibility : 'private', groupId: canShareOnline ? groupId : '',
      source: `Kitob · ${book.title}`, tags: ['kitob'], createdAt: existingEntry?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), nextReview: new Date().toISOString(),
    };
    const existingIndex = notes().findIndex(item => item.id === editingId);
    const nextNotes = existingIndex >= 0 ? notes().map(item => item.id === editingId ? { ...item, ...entry, id: item.id } : item) : [entry, ...notes()];
    await saveAndSync('ilm-yolida-knowledge-notes', nextNotes);
    state.bookEntryEditorId = '';
    try {
      if (canShareOnline && visibility === 'public') await window.ilmCloud.publishPost({ kind: entry.kind === 'quote' ? 'quote' : entry.kind === 'note' ? 'note' : 'reflection', body: `${entry.kind === 'quote' ? 'Iqtibos' : entry.kind === 'opinion' ? 'Fikrim' : 'Qayd'} · ${book.title}${entry.pageNumber ? ` · ${entry.pageNumber}-sahifa` : ''}\n\n${entry.text}`, visibility: 'public' });
      if (canShareOnline && visibility === 'group' && groupId) await window.ilmCloud.shareBookEntryToGroup(groupId, { ...entry, bookTitle: book.title, body: entry.text });
    } catch (error) { alert(`Yozuv saqlandi, lekin onlayn ulashilmadi: ${error.message}`); }
    render();
  };

  window.deleteBookEntry = async entryId => {
    if (!confirm('Ushbu yozuvni o‘chirasizmi?')) return;
    if (entryId.endsWith(':quote') || entryId.endsWith(':opinion')) {
      const [insightId, part] = entryId.split(/:(?=[^:]+$)/), field = part === 'quote' ? 'quote' : 'reflection';
      write('ilm-yolida-book-insights', insights().map(item => item.id === insightId ? { ...item, [field]: '' } : item).filter(item => item.quote || item.reflection));
    } else write('ilm-yolida-knowledge-notes', notes().filter(item => item.id !== entryId));
    if (window.ilmCloud?.user()) {
      const result = await window.ilmCloud.client.from('book_entries').delete().eq('user_id', window.ilmCloud.user().id).eq('client_id', entryId);
      if (result.error) console.error('Could not remove cloud entry:', result.error);
    }
    render();
  };
  window.editBookEntry = (bookId, entryId) => {
    const book = books().find(item => item.id === bookId), entry = entryList(book || {}).find(item => item.id === entryId);
    if (!book || !entry) return;
    document.getElementById('pro-entry-edit-dialog')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<dialog id="pro-entry-edit-dialog" class="pro-entry-edit-dialog"><form><button type="button" class="pro-icon-button" data-close aria-label="Yopish">×</button><span class="pro-kicker">KITOB YOZUVI</span><h2>Yozuvni tahrirlash</h2><div class="two-col"><label>Turi<select name="kind"><option value="quote" ${entry.kind==='quote'?'selected':''}>Iqtibos</option><option value="note" ${entry.kind==='note'?'selected':''}>Qayd</option><option value="opinion" ${entry.kind==='opinion'?'selected':''}>Mening fikrim</option></select></label><label>Sahifa<input name="pageNumber" type="number" min="1" value="${Number(entry.pageNumber)||''}"></label></div><label>Matn<textarea name="body" maxlength="5000" required>${esc(entry.body)}</textarea></label><label>Ko‘rinish<select name="visibility"><option value="private">Faqat men</option><option value="public" ${entry.visibility==='public'?'selected':''}>Ommaviy profil</option><option value="group" ${entry.visibility==='group'?'selected':''}>Guruh</option></select></label><div class="pro-form-actions"><button type="button" class="pro-secondary" data-close>Bekor qilish</button><button class="book-primary" type="submit">Saqlash</button></div></form></dialog>`);
    const dialog = document.getElementById('pro-entry-edit-dialog'), form = dialog.querySelector('form');
    dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    form.addEventListener('submit', async event => {
      event.preventDefault(); const values=new FormData(form), body=String(values.get('body')||'').trim(); if(!body)return;
      const kind=String(values.get('kind')||'note'), pageNumber=Number(values.get('pageNumber'))||null, visibility=String(values.get('visibility')||'private');
      if(entryId.endsWith(':quote')||entryId.endsWith(':opinion')) {
        const [insightId,part]=entryId.split(/:(?=[^:]+$)/),field=part==='quote'?'quote':'reflection';
        write('ilm-yolida-book-insights',insights().map(item=>item.id===insightId?{...item,[field]:body,pageNumber,updatedAt:new Date().toISOString()}:item));
      } else write('ilm-yolida-knowledge-notes',notes().map(item=>item.id===entryId?{...item,text:body,kind,pageNumber,visibility,groupId:visibility==='group'?item.groupId:'',updatedAt:new Date().toISOString()}:item));
      try { await window.ilmCloud?.syncLocalReadingData(); } catch(error) { console.error(error); }
      dialog.close();dialog.remove();render();
    });
    dialog.showModal();
  };

  function shareText(book, entry) {
    return `“${entry.body}”\n\n${book.title}${book.author ? ` — ${book.author}` : ''}${entry.pageNumber ? ` · ${entry.pageNumber}-sahifa` : ''}\n\nIlm Yo‘lida · O‘qishdan qoladigan fikr`;
  }
  function wrapLines(context, text, maxWidth) {
    const words = String(text).split(/\s+/), lines = []; let line = '';
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line); return lines;
  }
  window.shareBookEntry = async (bookId, entryId) => {
    const book = books().find(item => item.id === bookId), entry = entryList(book || {}).find(item => item.id === entryId);
    if (!book || !entry) return;
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const context = canvas.getContext('2d'), gradient = context.createLinearGradient(0,0,1080,1350);
    gradient.addColorStop(0,'#073f30'); gradient.addColorStop(1,'#117252'); context.fillStyle = gradient; context.fillRect(0,0,1080,1350);
    context.fillStyle = '#e8c86f'; context.font = '800 30px Arial'; context.fillText('ILM YO‘LIDA',88,112);
    context.fillStyle = '#ffffff'; context.font = 'italic 52px Georgia';
    const lines = wrapLines(context, `“${entry.body}”`, 890).slice(0,12);
    lines.forEach((line,index)=>context.fillText(line,88,320+index*78));
    context.fillStyle = '#dceee5'; context.font = '700 34px Arial'; context.fillText(book.title.slice(0,42),88,1120);
    context.font = '26px Arial'; context.fillText(`${book.author || 'Muallif'}${entry.pageNumber ? ` · ${entry.pageNumber}-sahifa` : ''}`.slice(0,60),88,1170);
    context.fillStyle = '#b7d7c7'; context.font = '22px Arial'; context.fillText('O‘qishdan qoladigan fikr',88,1260);
    const text = shareText(book, entry);
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = blob && new File([blob], 'ilm-yolida-iqtibos.png', { type: 'image/png' });
      if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: 'Ilm Yo‘lida', text, files: [file] }); return; }
      if (file) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); }
    } catch (error) { if (error.name === 'AbortError') return; }
    if (navigator.share) { try { await navigator.share({ title: 'Ilm Yo‘lida', text }); return; } catch (error) { if (error.name === 'AbortError') return; } }
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  };

  function bookForm(book) {
    const editing = Boolean(book);
    return `<form class="module-form pro-book-form" id="pro-book-form" onsubmit="event.preventDefault();saveBook()"><div class="pro-form-head"><div><span class="pro-kicker">${editing ? 'JAVONNI TAHRIRLASH' : 'YANGI KITOB'}</span><h3>${editing ? 'Kitob ma’lumotlarini yangilang' : 'Kitobingizni javonga qo‘shing'}</h3></div><button type="button" class="pro-icon-button" onclick="closeBookEditor()" aria-label="Yopish">×</button></div><div class="pro-cover-field">${book?.cover ? `<img id="book-cover-preview" src="${esc(book.cover)}" alt="Muqova ko‘rinishi">` : `<div class="pro-cover-upload-placeholder" id="book-cover-preview-placeholder">📚</div>`}<label>Muqova rasmi<input type="file" accept="image/png,image/jpeg,image/webp" onchange="readBookCover(this)"><small id="book-cover-name">JPG, PNG yoki WebP · ixtiyoriy</small></label></div><div class="two-col"><label>Kitob nomi<input name="title" required maxlength="180" value="${esc(book?.title||'')}" placeholder="Masalan: O‘tkan kunlar"></label><label>Muallif<input name="author" maxlength="140" value="${esc(book?.author||'')}" placeholder="Muallifning ismi"></label></div><div class="two-col"><label>Jami sahifa<input name="totalPages" type="number" min="0" value="${Number(book?.totalPages)||''}" placeholder="300"></label><label>Hozirgi sahifa<input name="currentPage" type="number" min="0" max="${Number(book?.totalPages)||100000}" value="${Number(book?.currentPage)||0}"></label></div><div class="two-col"><label>O‘qish holati<select name="status"><option value="reading" ${book?.status==='reading'?'selected':''}>O‘qiyapman</option><option value="planned" ${book?.status==='planned'?'selected':''}>Rejada</option><option value="paused" ${book?.status==='paused'?'selected':''}>Tanaffusda</option><option value="finished" ${book?.status==='finished'?'selected':''}>Tugallangan</option></select></label><label class="pro-public-toggle"><input name="isPublic" type="checkbox" ${book?.isPublic?'checked':''}><span><b>Profilimda ko‘rsatish</b><small>Kitob nomi ommaviy profilingizda ko‘rinadi.</small></span></label></div><label>Kitob haqida qisqacha<textarea name="description" maxlength="1200" placeholder="Nega bu kitobni o‘qiyapsiz?">${esc(book?.description||'')}</textarea></label><div class="pro-form-actions"><button type="button" class="pro-secondary" onclick="closeBookEditor()">Bekor qilish</button><button class="book-primary" type="submit">${editing ? 'O‘zgarishlarni saqlash' : 'Javonga qo‘shish'}</button></div></form>`;
  }

  function entryMarkup(book, entry) {
    const label = entry.kind === 'quote' ? 'IQTIBOS' : entry.kind === 'opinion' ? 'FIKRIM' : 'QAYD';
    const visibility = entry.visibility === 'public' ? 'Profilimda ulashilgan' : entry.visibility === 'group' ? 'Guruh bilan ulashilgan' : 'Faqat men';
    return `<article class="pro-entry"><header><span class="pro-entry-kind">${label}${entry.pageNumber ? ` · ${entry.pageNumber}-SAHIFA` : ''}</span><time>${entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('uz-UZ',{day:'numeric',month:'short',year:'numeric'}) : ''}</time></header><p>${entry.kind==='quote'?'“':''}${esc(entry.body)}${entry.kind==='quote'?'”':''}</p><footer><span>${visibility}</span><button type="button" onclick="shareBookEntry('${book.id}','${entry.id}')">Ulashish</button><button type="button" onclick="editBookEntry('${book.id}','${entry.id}')">Tahrirlash</button><button type="button" onclick="deleteBookEntry('${entry.id}')">O‘chirish</button></footer></article>`;
  }

  function bookDetail(book) {
    const entries = entryList(book), total = Math.max(0, Number(book.totalPages)||0), current = Math.min(total || Number(book.currentPage)||0, Number(book.currentPage)||0), percent = total ? Math.round(current/total*100) : 0;
    const groupOptions = `<option value="">Guruhni tanlang</option>`;
    return `<section class="book-app pro-shelf"><header class="book-app-head pro-detail-head"><button class="program-return" onclick="backToBookShelf()">← Javonimga</button><div class="book-wordmark"><span>KITOB MA’LUMOTI · ILM YO‘LIDA</span><h1>${esc(book.title)}</h1></div>${window.ilmCloudAccountControls?.()||''}</header><section class="pro-detail-hero">${cover(book)}<div class="pro-detail-copy"><span class="pro-kicker">${book.status==='finished'?'TUGALLANGAN':book.status==='planned'?'O‘QISH REJASIDA':book.status==='paused'?'TANAFFUSDA':'HOZIR O‘QILYAPTI'}</span><h2>${esc(book.title)}</h2><p>${esc(book.author||'Muallif kiritilmagan')}</p>${book.description?`<blockquote>${esc(book.description)}</blockquote>`:''}<div class="pro-detail-stats"><span><b>${current}</b> / ${total||'—'} sahifa</span><span><b>${percent}%</b> bajarildi</span><span><b>${entries.length}</b> yozuv</span></div><div class="pro-progress"><i style="width:${percent}%"></i></div><div class="pro-inline-progress"><label>Hozirgi sahifa<input id="pro-book-page-${book.id}" type="number" min="0" max="${total||100000}" value="${current}"></label><button class="small-btn" onclick="updateBookProgress('${book.id}')">Progressni saqlash</button><button class="small-btn" onclick="openBookEditor('${book.id}')">Tahrirlash</button></div></div></section><section class="pro-book-entries"><div class="pro-section-title"><div><span class="pro-kicker">KITOBDAN QOLGANLAR</span><h2>Iqtiboslarim va qaydlarim</h2><p>Yozuv kitobga bog‘lanadi. Ulashishni o‘zingiz tanlaysiz.</p></div><span class="pro-entry-count">${entries.length}</span></div><form id="pro-entry-form-${book.id}" class="pro-entry-form" onsubmit="event.preventDefault();saveBookEntry('${book.id}')"><div class="two-col"><label>Yozuv turi<select name="kind"><option value="quote">Iqtibos</option><option value="note">Qayd</option><option value="opinion">Mening fikrim</option></select></label><label>Sahifa raqami<input name="pageNumber" type="number" min="1" max="${total||100000}" placeholder="Masalan: 42"></label></div><label>Matn<textarea name="body" required maxlength="5000" placeholder="O‘qigan joyingizdan muhim fikr, iqtibos yoki xulosa..."></textarea></label><div class="two-col"><label>Kim bilan ulashilsin?<select name="visibility" id="pro-entry-visibility-${book.id}" onchange="toggleBookEntryGroup('${book.id}')"><option value="private">Faqat men ko‘raman</option><option value="public">Ommaviy profilimda</option><option value="group">Guruh bilan</option></select></label><label id="pro-entry-group-wrap-${book.id}" hidden>Guruh<select name="groupId" id="pro-entry-group-${book.id}">${groupOptions}</select></label></div><div class="pro-form-actions"><small>Maxfiy yozuvlaringiz ommaga chiqmaydi.</small><button class="book-primary">Yozuvni saqlash</button></div></form><div class="pro-entry-list">${entries.length?entries.map(entry=>entryMarkup(book,entry)).join(''):`<div class="book-empty"><b>Bu kitobdan hali yozuv yo‘q</b><span>O‘qigan joyingizdan qolgan birinchi fikrni saqlang.</span></div>`}</div></section></section>`;
  }

  window.toggleBookEntryGroup = bookId => {
    const visibility = document.getElementById(`pro-entry-visibility-${bookId}`)?.value;
    const wrap = document.getElementById(`pro-entry-group-wrap-${bookId}`); if (wrap) wrap.hidden = visibility !== 'group';
  };
  async function populateGroups(bookId) {
    const select = document.getElementById(`pro-entry-group-${bookId}`);
    if (!select || !window.ilmCloud?.configured || !window.ilmCloud.user()) return;
    try {
      const groups = await window.ilmCloud.listReaderGroups();
      select.innerHTML = `<option value="">Guruhni tanlang</option>${groups.map(group=>`<option value="${esc(group.id)}">${esc(group.name)}</option>`).join('')}`;
    } catch {}
  }

  function shelfHome() {
    const all = books(), filter = state.bookFilter || 'all';
    const counts = { all:all.length, reading:all.filter(b=>b.status==='reading').length, planned:all.filter(b=>b.status==='planned').length, finished:all.filter(b=>b.status==='finished').length };
    const shown = all.filter(book => filter==='all' || (filter==='reading' ? book.status==='reading' || book.status==='paused' : book.status===filter));
    const form = state.bookFormOpen ? bookForm(all.find(book=>book.id===state.bookEditorId)) : '';
    return `<section class="book-app pro-shelf"><header class="book-app-head"><button class="program-return" onclick="programBack()">← Ilm maydoniga qaytish</button><div class="book-wordmark"><span>KITOBXONLIK · SHAXSIY JAVON</span><h1>Har bir kitob — yangi fikr.</h1></div>${window.ilmCloudAccountControls?.()||''}</header><nav class="book-tabs"><button class="book-tab ${state.bookTab==='shelf'?'active':''}" onclick="setBookTab('shelf')">Javonim</button><button class="book-tab" onclick="setBookTab('challenge')">Yakka challenge</button><button class="book-tab" onclick="setBookTab('group')">Guruhlar</button><button class="book-tab" onclick="setBookTab('insights')">Fikrlarim</button><button class="book-tab" onclick="setBookTab('review')">Bugun eslash</button><button class="book-tab" onclick="setBookTab('community')">Hamjamiyat</button></nav><section class="pro-shelf-overview"><div><span class="pro-kicker">KITOBLARIM</span><h2>Javoningiz</h2><p>Kitoblaringiz, o‘qish holatingiz va har bir kitobdan olgan yozuvlaringiz bir joyda.</p></div><button class="book-primary" onclick="openBookEditor()">＋ Kitob qo‘shish</button></section><div class="pro-shelf-counts"><button class="${filter==='all'?'active':''}" onclick="setBookFilter('all')"><b>${counts.all}</b><span>Barchasi</span></button><button class="${filter==='reading'?'active':''}" onclick="setBookFilter('reading')"><b>${counts.reading}</b><span>O‘qiyapman</span></button><button class="${filter==='planned'?'active':''}" onclick="setBookFilter('planned')"><b>${counts.planned}</b><span>Rejada</span></button><button class="${filter==='finished'?'active':''}" onclick="setBookFilter('finished')"><b>${counts.finished}</b><span>Tugallangan</span></button></div>${form}<section class="pro-shelf-grid">${shown.length?shown.map(bookCard).join(''):`<div class="book-empty pro-shelf-empty"><b>${all.length?'Bu bo‘lim hozircha bo‘sh':'Javoningizni birinchi kitob bilan boshlang'}</b><span>${all.length?'Boshqa holatni tanlang yoki yangi kitob qo‘shing.':'Muqova, muallif va o‘qish holatini kiriting. Har bir kitobga o‘z yozuvlaringizni biriktiring.'}</span>${!all.length?`<button class="book-primary" onclick="openBookEditor()">Kitob qo‘shish</button>`:''}</div>`}</section></section>`;
  }

  window.setBookFilter = value => { state.bookFilter = value; render(); };
  function bookCard(book) {
    const total = Math.max(0, Number(book.totalPages)||0), current = Math.min(total||Number(book.currentPage)||0, Number(book.currentPage)||0), pct = total ? Math.round(current/total*100) : 0, count = entryList(book).length;
    return `<article class="pro-book-card"><button class="pro-book-open" type="button" onclick="openBookDetail('${book.id}')" aria-label="${esc(book.title)} kitobini ochish">${cover(book)}<span class="pro-book-info"><small>${book.status==='finished'?'TUGALLANGAN':book.status==='planned'?'REJADA':book.status==='paused'?'TANAFFUSDA':'O‘QILYAPTI'}</small><b>${esc(book.title)}</b><span>${esc(book.author||'Muallif kiritilmagan')}</span><span class="pro-book-progress"><i style="width:${pct}%"></i></span><span>${total?`${current} / ${total} sahifa · ${pct}%`:`${current} sahifa qayd etildi`}</span><em>${count} ta iqtibos va qayd</em></span></button><footer><button type="button" onclick="openBookEditor('${book.id}')">Tahrirlash</button><button type="button" onclick="deleteBook('${book.id}')">O‘chirish</button></footer></article>`;
  }

  function addStyles() {
    if (document.getElementById('pro-shelf-styles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="pro-shelf-styles">.pro-shelf{padding-bottom:44px}.pro-shelf-overview{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:25px 28px;margin:18px 0;border:1px solid #dce9e1;border-radius:22px;background:linear-gradient(130deg,#f5faf6,#fff9e9)}.pro-shelf-overview h2,.pro-section-title h2{margin:5px 0;color:#174c3d;font:800 1.5rem Georgia}.pro-shelf-overview p,.pro-section-title p{margin:0;color:#6b8177;font-size:.86rem}.pro-kicker{color:#a37c25;font-size:.65rem;font-weight:900;letter-spacing:.12em}.pro-shelf-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 20px}.pro-shelf-counts button{display:flex;align-items:center;gap:10px;padding:13px 15px;border:1px solid #e0e9e3;border-radius:13px;background:#fff;color:#637a70;text-align:left;cursor:pointer}.pro-shelf-counts button.active{border-color:#76a58d;background:#edf7f0;color:#176246}.pro-shelf-counts b{font:800 1.25rem Georgia;color:#174c3d}.pro-shelf-counts span{font-size:.76rem;font-weight:700}.pro-shelf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pro-book-card{overflow:hidden;border:1px solid #dce8e0;border-radius:18px;background:#fff;box-shadow:0 5px 18px #174c3d0a}.pro-book-open{display:flex;width:100%;min-height:175px;gap:15px;padding:16px;border:0;background:none;text-align:left;cursor:pointer}.pro-book-cover{display:flex;width:106px;height:146px;flex:0 0 106px;flex-direction:column;justify-content:space-between;object-fit:cover;padding:12px;border-radius:5px 12px 12px 5px;box-shadow:5px 8px 14px #193b2d2a}.pro-cover-placeholder{color:#fff;background:linear-gradient(145deg,#176246,#0c3b2c)}.pro-cover-placeholder span{color:#f2d98c;font-size:.5rem;font-weight:900;letter-spacing:.09em}.pro-cover-placeholder b{font:700 .95rem/1.18 Georgia}.pro-cover-placeholder small{color:#d4e4da;font-size:.62rem}.pro-book-info{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-start;gap:6px}.pro-book-info>small{padding:4px 7px;border-radius:999px;background:#edf5f0;color:#176246;font-size:.58rem;font-weight:900;letter-spacing:.05em}.pro-book-info>b{display:-webkit-box;overflow:hidden;color:#183f32;font:800 1.02rem/1.25 Georgia;-webkit-box-orient:vertical;-webkit-line-clamp:2}.pro-book-info>span{color:#70847a;font-size:.72rem}.pro-book-progress,.pro-progress{display:block;width:100%;height:7px;overflow:hidden;border-radius:999px;background:#e8efe9}.pro-book-progress i,.pro-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#d9b34f,#14805c)}.pro-book-info em{font-style:normal;color:#ae842a;font-size:.7rem;font-weight:800}.pro-book-card footer{display:flex;justify-content:flex-end;gap:8px;padding:9px 13px;border-top:1px solid #edf1ed}.pro-book-card footer button,.pro-entry footer button{border:0;background:none;color:#39705d;font-family:inherit;font-size:.75rem;font-weight:700;cursor:pointer}.pro-book-card footer button:last-child{color:#a34b45}.pro-shelf-empty{grid-column:1/-1;padding:34px;text-align:center}.pro-shelf-empty .book-primary{margin:16px auto 0}.pro-detail-head .book-wordmark{flex:1}.pro-detail-hero{display:grid;grid-template-columns:210px minmax(0,1fr);gap:26px;margin:18px 0;padding:26px;border:1px solid #dce9e1;border-radius:22px;background:linear-gradient(135deg,#fbfdfb,#f0f7f2)}.pro-detail-hero>.pro-book-cover{width:190px;height:265px;max-width:100%;padding:19px}.pro-detail-copy h2{margin:6px 0;color:#174c3d;font:800 clamp(1.5rem,3vw,2.15rem) Georgia}.pro-detail-copy>p{margin:0;color:#6a8076}.pro-detail-copy blockquote{margin:13px 0;padding-left:14px;border-left:3px solid #d2ae53;color:#60766b;font:italic .9rem/1.5 Georgia}.pro-detail-stats{display:flex;gap:18px;flex-wrap:wrap;margin:17px 0 10px;color:#6f8379;font-size:.74rem}.pro-detail-stats b{color:#176246}.pro-inline-progress{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin-top:14px}.pro-inline-progress label{display:grid;gap:4px;color:#60766b;font-size:.7rem;font-weight:700}.pro-inline-progress input{width:110px;padding:9px;border:1px solid #d7e4dc;border-radius:9px}.pro-book-entries{padding:23px;border:1px solid #e0e9e3;border-radius:20px;background:#fff}.pro-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.pro-entry-count{display:grid;place-items:center;min-width:38px;height:38px;padding:0 10px;border-radius:12px;background:#edf5f0;color:#176246;font-weight:900}.pro-entry-form{display:grid;gap:12px;padding:17px;border-radius:15px;background:#f5faf6}.pro-entry-form textarea{min-height:108px}.pro-entry-form input,.pro-entry-form select,.pro-entry-form textarea{width:100%;padding:11px;border:1px solid #d8e5dd;border-radius:10px;background:#fff;font:inherit}.pro-form-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.pro-form-actions small{color:#71857b;font-size:.7rem}.pro-entry-list{display:grid;gap:10px;margin-top:16px}.pro-entry{padding:15px;border:1px solid #e4ebe5;border-radius:14px;background:#fff}.pro-entry header,.pro-entry footer{display:flex;justify-content:space-between;align-items:center;gap:8px}.pro-entry-kind{color:#a17a24;font-size:.64rem;font-weight:900;letter-spacing:.08em}.pro-entry time,.pro-entry footer span{color:#89988f;font-size:.67rem}.pro-entry>p{margin:11px 0;color:#294b3d;font:1rem/1.6 Georgia;white-space:pre-wrap;overflow-wrap:anywhere}.pro-entry footer{justify-content:flex-end}.pro-entry footer span{margin-right:auto}.pro-book-form{margin:16px 0;padding:20px;border:1px solid #dce9e1;border-radius:18px;background:#fff}.pro-form-head{display:flex;justify-content:space-between;align-items:start}.pro-form-head h3{margin:5px 0 14px;color:#174c3d;font:800 1.15rem Georgia}.pro-icon-button{border:0;background:none;color:#789087;font-size:1.5rem;cursor:pointer}.pro-cover-field{display:flex;align-items:center;gap:12px;margin-bottom:13px}.pro-cover-field>img,.pro-cover-upload-placeholder{display:grid;width:58px;height:76px;place-items:center;object-fit:cover;border-radius:7px;background:#eaf3ed}.pro-cover-field label{display:grid;gap:4px;color:#547065;font-size:.75rem;font-weight:700}.pro-cover-field input{font-size:.72rem}.pro-cover-field small{color:#84958d;font-weight:400}.pro-book-form textarea{min-height:70px}.pro-public-toggle{display:flex!important;align-items:center;gap:9px!important;padding:9px;border-radius:10px;background:#f4f8f5}.pro-public-toggle input{width:auto!important}.pro-public-toggle span{display:grid;gap:3px}.pro-public-toggle b{color:#426659;font-size:.73rem}.pro-public-toggle small{color:#7f9088;font-size:.64rem;font-weight:400}.pro-form-actions .pro-secondary{padding:10px 14px;border:1px solid #d7e4dc;border-radius:10px;background:#fff;color:#557166;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer}.pro-detail-hero .pro-book-cover{font-size:1.15rem}@media(max-width:740px){.pro-shelf-grid{grid-template-columns:1fr}.pro-detail-hero{grid-template-columns:125px 1fr;gap:15px;padding:17px}.pro-detail-hero>.pro-book-cover{width:120px;height:175px;padding:11px}.pro-detail-stats{gap:10px}.pro-inline-progress{align-items:stretch}.pro-shelf-overview{align-items:flex-start;flex-direction:column;padding:20px}.pro-shelf-counts{grid-template-columns:repeat(2,1fr)}.pro-book-open{padding:12px}.pro-book-cover{width:82px;height:118px;flex-basis:82px}.pro-book-entries{padding:15px}.pro-form-actions{align-items:flex-start;flex-direction:column}.pro-form-actions .book-primary{width:100%}}@media(max-width:390px){.pro-detail-hero{grid-template-columns:1fr}.pro-detail-hero>.pro-book-cover{width:126px;height:180px}.pro-entry header{align-items:flex-start;flex-direction:column}}</style>`);
  }

  const previousBooksView = window.booksView;
  window.booksView = () => {
    if (state.bookTab === 'shelf' && state.bookDetailId) {
      const book = books().find(item => item.id === state.bookDetailId);
      if (book) { setTimeout(() => populateGroups(book.id), 0); return bookDetail(book); }
      state.bookDetailId = '';
    }
    if (state.bookTab === 'shelf') return shelfHome();
    return previousBooksView();
  };
  window.addEventListener('ilm-auth-change', () => { if (window.ilmCloud?.user()) window.ilmCloud.syncLocalReadingData().then(()=>{ if (state.section==='books') render(); }).catch(()=>{}); });
  addStyles();
})();
