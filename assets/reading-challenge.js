/* Ilm Yo'lida | Mutolaa - 15 kunlik o'qish challenge'i (Kitobxonlik bo'limi)
   Eski javon / guruh / lenta ko'rinishlarini almashtiradi (ma'lumotlari o'chirilmaydi).
   Qayta eski holatga qaytarish uchun index.html oxiridagi shu skript tegini olib tashlash kifoya. */
(() => {
  const KEY = 'ilm-yolida-mutolaa15';
  const TOTAL = 15, GOAL = 5;
  const TG = 'https://t.me/ilmm_yolida';
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const MON = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const MONL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const short = d => `${d.getDate()}-${MON[d.getMonth()]}`;
  const long = d => `${d.getDate()}-${MONL[d.getMonth()]}, ${d.getFullYear()}`;
  const MAX_EXTRA = 3;
  const blankDay = () => ({ done: false, pages: GOAL, summary: '', format: '', voice: null, dateStamp: '', book: '', author: '', newBook: false, quote: '', quoteBy: '', extra: [] });
  const fresh = () => ({ v: 1, name: '', book: '', author: '', start: ymd(new Date()), days: Array.from({ length: TOTAL }, blankDay) });

  const clean = raw => {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.days) || raw.days.length !== TOTAL) return null;
    return {
      v: 1,
      name: String(raw.name ?? '').slice(0, 80),
      book: String(raw.book ?? '').slice(0, 140),
      author: String(raw.author ?? '').slice(0, 100),
      start: parse(raw.start) ? raw.start : ymd(new Date()),
      days: raw.days.map(d => {
        d = d && typeof d === 'object' ? d : {};
        const pages = Number(d.pages);
        return {
          done: Boolean(d.done),
          pages: Number.isFinite(pages) ? Math.max(0, Math.min(9999, Math.floor(pages))) : GOAL,
          summary: String(d.summary ?? '').slice(0, 2000),
          format: ['voice', 'text', 'poster'].includes(d.format) ? d.format : (d.summary ? 'poster' : ''),
          voice: d.voice && typeof d.voice.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(d.voice.id) ? { id: d.voice.id, duration: Math.max(0, Math.min(300, Number(d.voice.duration) || 0)) } : null,
          dateStamp: parse(d.dateStamp) ? d.dateStamp : '',
          book: String(d.book ?? '').slice(0, 140),
          author: String(d.author ?? '').slice(0, 100),
          newBook: Boolean(d.newBook),
          quote: String(d.quote ?? '').slice(0, 400),
          extra: (Array.isArray(d.extra) ? d.extra : []).slice(0, MAX_EXTRA).map(e => ({ title: String(e && e.title || '').slice(0, 60), text: String(e && e.text || '').slice(0, 2000) })),
          quoteBy: String(d.quoteBy ?? '').slice(0, 80),
        };
      }),
    };
  };

  let S = clean(storage.get(KEY, null)) || fresh();
  const save = () => storage.set(KEY, S);

  /* ---------- hisob-kitob ---------- */
  const profileName = () => {
    const p = storage.get('ilm-yolida-profile', null);
    return p && typeof p === 'object' ? [p.first, p.last].filter(x => typeof x === 'string' && x.trim()).join(' ').trim() : '';
  };
  const readerName = () => S.name.trim() || profileName() || 'O‘quvchi';
  const startDate = () => parse(S.start);
  const endDate = () => { const s = startDate(); if (!s) return null; const e = new Date(s); e.setDate(e.getDate() + TOTAL - 1); return e; };
  const dayDate = i => { const s = startDate(); if (!s) return null; const d = new Date(s); d.setDate(d.getDate() + i); return d; };
  const todayIdx = () => {
    const s = startDate(); if (!s) return null;
    const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - s) / 864e5);
  };
  const doneCount = () => S.days.filter(d => d.done).length;
  const pagesRead = () => S.days.reduce((s, d) => s + (d.done ? d.pages : 0), 0);
  const streak = () => {
    let last = -1; S.days.forEach((d, i) => { if (d.done) last = i; });
    if (last < 0) return 0;
    const t = todayIdx(); if (t !== null && last < t - 1) return 0;
    let n = 0; for (let i = last; i >= 0 && S.days[i].done; i--) n++;
    return n;
  };
  const bookNames = () => {
    const list = []; const first = S.book.trim(); if (first) list.push(first);
    S.days.forEach(d => { const b = d.book.trim(); if (d.newBook && b && b !== list[list.length - 1]) list.push(b); });
    return list.length ? list : ['ajoyib kitob'];
  };
  const bookForDay = i => {
    let cur = S.book.trim();
    for (let j = 0; j <= i; j++) { const d = S.days[j]; if (d.newBook && d.book.trim()) cur = d.book.trim(); }
    return cur;
  };
  const authorForDay = i => {
    let cur = S.author.trim();
    for (let j = 0; j <= i; j++) { const d = S.days[j]; if (d.newBook && d.book.trim()) cur = d.author.trim(); }
    return cur;
  };
  const joinNames = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' va ' + a[a.length - 1];
  const hasSummary = d => d.format === 'voice' ? !!d.voice : !!d.summary.trim();
  const summarized = () => S.days.every(hasSummary);
  const unlocked = () => S.days.every(d => d.done) && summarized();
  const certId = () => {
    const base = (S.name || 'anon') + S.start + TOTAL; let h = 0;
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
    return 'IY-' + h.toString(36).toUpperCase().slice(0, 7);
  };
  const completedOn = () => {
    const stamps = S.days.map(d => d.dateStamp).filter(Boolean).sort();
    return parse(stamps[stamps.length - 1]) || new Date();
  };

  /* ---------- ko'rinish bo'laklari ---------- */
  const topHTML = () => {
    const c = doneCount(), p = Math.round(c / TOTAL * 100);
    return `<div class="rc-stats">
      <div class="rc-stat"><b>${c}/${TOTAL}</b><span>Tugallangan kun</span></div>
      <div class="rc-stat"><b>${pagesRead()}/${GOAL * TOTAL}</b><span>O‘qilgan sahifa</span></div>
      <div class="rc-stat"><b>${streak()}</b><span>Joriy seriya</span></div>
      <div class="rc-stat"><b>${p}%</b><span>Bajarildi</span></div>
    </div>
    <div class="rc-ribbon" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Challenge jarayoni">
      <div class="rc-ribbon-top"><span>Jarayon</span><span>${p}%</span></div>
      <div class="rc-track"><div class="rc-fill" style="width:${p}%"></div></div>
    </div>`;
  };

  const shareBtn = i => {
    const d = S.days[i];
    return hasSummary(d)
      ? `<button type="button" class="rc-share-btn" onclick="rcShare(${i})">3. Ko‘rib chiqish va ulashish →</button>` : '';
  };

  const extrasHTML = i => {
    const d = S.days[i];
    return d.extra.map((e, k) => `<div class="rc-extra">
        <div class="rc-extra-top"><b>${k + 2}-xulosa${d.format === 'poster' ? ' · alohida rasm' : ''}</b><button type="button" class="rc-extra-x" onclick="rcExtraDel(${i},${k})" aria-label="${k + 2}-xulosani o‘chirish">✕</button></div>
        <input class="rc-extra-title" type="text" maxlength="60" value="${esc(e.title)}" placeholder="Mavzu (ixtiyoriy) — masalan: Odatlar" oninput="rcExtra(${i},${k},'title',this.value)" aria-label="${k + 2}-xulosa mavzusi">
        <textarea class="rc-summary" maxlength="2000" placeholder="Boshqa mavzu bo‘yicha xulosa…" oninput="rcExtra(${i},${k},'text',this.value)" aria-label="${k + 2}-xulosa matni">${esc(e.text)}</textarea>
      </div>`).join('') + (d.extra.length < MAX_EXTRA ? `<button type="button" class="rc-extra-add" onclick="rcExtraAdd(${i})">➕ Yana xulosa qo‘shish${d.format === 'poster' ? ' (alohida rasm)' : ''}</button>` : '');
  };

  const dayHTML = i => {
    const d = S.days[i], date = dayDate(i), t = todayIdx();
    const isToday = t === i, missed = t !== null && t > i && !d.done;
    const tag = isToday ? ' · bugun' : missed ? ' · o‘tkazilgan' : '';
    return `<article class="rc-day ${d.done ? 'done' : ''} ${isToday ? 'today' : ''} ${missed ? 'missed' : ''}" id="rc-day-${i}">
      <div class="rc-day-top">
        <div><b class="rc-day-num">${i + 1}-kun</b><small>${date ? short(date) : ''}${tag}</small></div>
        <div class="rc-done-control"><small>${d.done ? 'Kun tugallandi' : 'O‘qidim'}</small><button type="button" class="rc-check ${d.done ? 'on' : ''}" onclick="rcToggle(${i})" aria-pressed="${d.done}" aria-label="${i + 1}-kunni ${d.done ? 'bekor qilish' : 'tugallandi deb belgilash'}">${d.done ? '✓' : ''}</button></div>
      </div>
      <p class="rc-step-label">1. O‘qish ma’lumotlari</p>
      <div class="rc-pages">
        <input type="number" min="0" max="9999" inputmode="numeric" value="${d.pages}" oninput="rcPages(${i},this.value)" aria-label="${i + 1}-kun: o‘qilgan sahifalar soni">
        <span>sahifa o‘qildi</span>
      </div>
      <label class="rc-newbook"><input type="checkbox" ${d.newBook ? 'checked' : ''} onchange="rcNewBook(${i},this.checked)"><span>Kitobni tugatdim — bugun yangisini boshladim</span></label>
      ${d.newBook ? `<input class="rc-booktitle" type="text" maxlength="140" value="${esc(d.book)}" placeholder="Yangi kitob nomi" oninput="rcBookTitle(${i},this.value)" aria-label="Yangi kitob nomi"><input class="rc-booktitle" type="text" maxlength="100" value="${esc(d.author)}" placeholder="Yangi kitob muallifi" oninput="rcBookAuthor(${i},this.value)" aria-label="Yangi kitob muallifi">` : ''}
      <p class="rc-day-meta" id="rc-meta-${i}">${detailsHTML(i)}</p>
      <p class="rc-step-label">2. Xulosa shaklini tanlang</p>
      <div class="rc-formats" role="group" aria-label="${i + 1}-kun xulosa shakli">${[['voice','🎙','Ovoz','Gapirib ayting'],['text','✍','Matn','Xabar yozing'],['poster','▧','Poster','Matnli rasm']].map(([key,icon,label,hint]) => `<button type="button" aria-pressed="${d.format === key}" onclick="rcFormat(${i},'${key}')"><span aria-hidden="true">${icon}</span><b>${label}</b><small>${hint}</small></button>`).join('')}</div>
      ${!d.format ? '<p class="rc-format-hint">Avval shaklni tanlang. Keyin yozish yoki ovoz yozib olish maydoni ochiladi.</p>' : d.format === 'voice' ? `<div id="rc-voice-${i}" class="rc-voice">${voiceHTML(i)}</div>` : `
      <label class="rc-summary-label">${d.format === 'poster' ? 'Poster uchun xulosangiz' : 'Xulosangiz'}<textarea class="rc-summary" maxlength="2000" placeholder="Nimani o‘qidim? Eng muhim fikr nima? Uni qanday qo‘llayman? (3–5 gap)" oninput="rcSummary(${i},this.value)" aria-label="${i + 1}-kun xulosasi">${esc(d.summary)}</textarea></label>
      <p class="rc-format-hint">${d.format === 'poster' ? 'Matningiz kitob ma’lumotlari bilan rasmga aylanadi.' : 'Matningiz kitob ma’lumotlari bilan Telegram xabari bo‘ladi.'}</p>
      <details class="rc-optional"><summary>Qo‘shimcha xulosa yoki iqtibos (ixtiyoriy)</summary>
      <div class="rc-extras" id="rc-extras-${i}">${extrasHTML(i)}</div>
      <div class="rc-quote-box">
        <textarea class="rc-quote" maxlength="400" placeholder="Iqtibos (ixtiyoriy) — kitobdan yoqqan jumla" oninput="rcQuote(${i},'quote',this.value)" aria-label="${i + 1}-kun iqtibosi (ixtiyoriy)">${esc(d.quote)}</textarea>
        <input class="rc-quote-by" type="text" maxlength="80" value="${esc(d.quoteBy)}" placeholder="Muallif (ixtiyoriy)" oninput="rcQuote(${i},'quoteBy',this.value)" aria-label="${i + 1}-kun iqtibos muallifi">
      </div></details>`}
      <div class="rc-share" id="rc-share-${i}">${shareBtn(i)}</div>
    </article>`;
  };

  const certHTML = () => {
    if (!unlocked()) {
      const n = S.days.filter(hasSummary).length;
      return `<div class="rc-locked"><span>🔒</span><p>Sertifikat uchun 15 kunning har birini belgilang va matnli yoki ovozli xulosa tayyorlang.</p><small>${doneCount()}/${TOTAL} kun belgilangan · ${n}/${TOTAL} xulosa tayyor</small></div>`;
    }
    const names = bookNames(), pages = S.days.reduce((s, d) => s + d.pages, 0);
    const quoted = names.map(n => `<span class="rc-cert-book">“${esc(n)}”</span>`);
    const body = `${joinNames(quoted)} ${names.length > 1 ? 'kitoblarini' : 'kitobini'} o‘qib, ${long(startDate())} dan ${long(endDate())} gacha ${pages} sahifani muvaffaqiyatli yakunlab, 15 kunlik Mutolaa challenge’ini tugatgani uchun.`;
    return `<div class="rc-cert-outer">
      <div id="rc-certificate">
        <div class="rc-cert-inner">
          <img class="rc-cert-logo" src="./assets/ilm-yolida-logo.png" alt="" crossorigin="anonymous">
          <div class="rc-cert-eyebrow">Ilm Yo‘lida | Mutolaa</div>
          <div class="rc-cert-title">Tugatganlik sertifikati</div>
          <div class="rc-cert-sub">15 kunlik Mutolaa challenge’i</div>
          <div class="rc-cert-presented">Ushbu sertifikat quyidagi shaxsga topshiriladi</div>
          <div class="rc-cert-name">${esc(readerName())}</div>
          <div class="rc-cert-body">${body}</div>
          <div class="rc-cert-meta">
            <div class="rc-cert-block"><div class="rc-cert-line">${long(completedOn())}</div><div>Tugatilgan sana</div></div>
            <div class="rc-cert-seal"><span>RASMIY</span><span>★</span><span>MUHR</span></div>
            <div class="rc-cert-block"><div class="rc-cert-line">${certId()}</div><div>Sertifikat raqami</div></div>
          </div>
        </div>
      </div>
      <div class="rc-cert-actions">
        <button type="button" class="rc-btn primary" onclick="rcCertDownload()">⬇ Sertifikatni yuklab olish</button>
        <button type="button" class="rc-btn" onclick="rcCertPrint()">🖨 Chop etish / PDF</button>
      </div>
    </div>`;
  };

  const setupHTML = () => `<section class="rc-card rc-setup">
    <h2>Avval o‘zingiz va kitobingizni tanishtiring</h2>
    <p class="rc-format-hint">Bu ma’lumotlar barcha matn, ovoz va poster xulosalariga qo‘shiladi.</p>
    <div class="rc-grid2">
      <label>Ism<input type="text" maxlength="80" value="${esc(S.name)}" placeholder="${esc(profileName() || 'Ismingiz')}" oninput="rcField('name',this.value)"></label>
      <label>Hozirgi kitob<input type="text" maxlength="140" value="${esc(S.book)}" placeholder="O‘qiyotgan kitobingiz nomi" oninput="rcField('book',this.value)"></label>
      <label>Kitob muallifi<input type="text" maxlength="100" value="${esc(S.author)}" placeholder="Masalan: James Clear" oninput="rcField('author',this.value)"></label>
      <label>Boshlanish sanasi<input type="date" value="${esc(S.start)}" onchange="rcStart(this.value)"></label>
      <label>Tugash sanasi<input type="date" id="rc-end" value="${endDate() ? ymd(endDate()) : ''}" readonly></label>
    </div>
  </section>`;

  let botName; // undefined: hali so'ralmagan, null: bot ulanmagan
  const loadBot = () => {
    if (botName !== undefined) return;
    botName = null;
    fetch('/api/telegram', { headers: { Accept: 'application/json' } }).then(r => r.json()).then(d => {
      if (d && typeof d.bot === 'string' && /^[A-Za-z0-9_]{4,64}$/.test(d.bot)) {
        botName = d.bot;
        const a = document.getElementById('rc-bot'); if (a) { a.href = 'https://t.me/' + botName; a.hidden = false; }
      }
    }).catch(() => {});
  };
  const TEMPLATE = 'Bugun … kitobining … qismini o‘qidim.\nEng muhim fikr: …\nBu menga …\nSavol yoki iqtibos: …';
  const guideHTML = () => `<details class="rc-card rc-guide" id="rc-guide">
    <summary><b>Xulosa tayyorlash bo‘yicha yordam</b><span>Yozish yoki gapirib aytish uchun sodda savollar</span></summary>
    <p class="rc-lead">Xulosa — o‘qiganingizdan nima qolganini <b>o‘z so‘zingiz bilan</b> aytish. 3–5 gap yozing yoki ovozli xulosa yozib oling.</p>
    <ol class="rc-steps">
      <li><i>1</i><div><b>Nimani o‘qidim?</b><span>Bir gapda ayting: kitob nomi va bugungi sahifalar nima haqida edi.</span></div></li>
      <li><i>2</i><div><b>Eng muhim fikr nima?</b><span>Sizni to‘xtatib qo‘ygan bitta fikrni tanlang va o‘z so‘zingiz bilan yozing.</span></div></li>
      <li><i>3</i><div><b>Menga nima beradi?</b><span>Bu fikr hayotingizga qanday aloqador? Bugun yoki ertaga qanday qo‘llay olasiz?</span></div></li>
      <li><i>4</i><div><b>Savol yoki iqtibos <em>(ixtiyoriy)</em></b><span>Yoqqan jumlani qo‘shtirnoq ichida yozing yoki ko‘nglingizda qolgan savolni qoldiring.</span></div></li>
    </ol>
    <div class="rc-example"><small>NAMUNA</small><p>Bugun “Atom odatlar” kitobining 1-bobini o‘qidim: kichik o‘zgarishlar vaqt o‘tib katta natija beradi. Eng muhim fikr — maqsaddan ko‘ra tizim muhimroq ekan. Men ham har kuni 5 sahifa o‘qishni odatga aylantirsam, kitobni zo‘riqmasdan tugataman. Ertadan telefonni o‘qish joyimdan uzoqroqqa qo‘yaman.</p></div>
    <div class="rc-dodont">
      <div class="do"><b>✓ Yaxshi xulosa</b><ul><li>O‘z so‘zingiz bilan yozilgan</li><li>3–5 ta gap, aniq bitta fikr</li><li>Hayotingiz bilan bog‘langan</li></ul></div>
      <div class="dont"><b>✕ Kerak emas</b><ul><li>Kitobdan ko‘chirib yozish</li><li>«Yaxshi kitob ekan» kabi umumiy gap</li><li>Juda uzun yozish — qisqa bo‘lsin</li></ul></div>
    </div>
    <button type="button" class="rc-btn" onclick="rcCopyTemplate()">📋 Shablonni nusxalash</button>
  </details>`;

  window.booksView = () => { setTimeout(loadBot, 0); return `<section class="rc-app">
    <header class="rc-hero">
      <button type="button" class="rc-back" onclick="programBack()">← Ilm maydoniga qaytish</button>
      <div class="rc-hero-text">
        <img class="rc-hero-logo" src="./assets/ilm-yolida-logo.png" alt="Ilm Yo‘lida" onerror="this.remove()">
        <span class="rc-eyebrow">ILM YO‘LIDA | MUTOLAA</span>
        <h1>15 kunlik Mutolaa challenge’i</h1>
        <div class="rc-trio"><span>15 kun</span><i>•</i><span>1 kitob</span><i>•</i><span>0 so‘m</span></div>
        <span class="rc-free">MUTLAQO BEPUL</span>
        <p>Har kuni kitob o‘qing, sahifalaringizni belgilang va xulosangizni yozing yoki ovozga yozib oling. Kuniga 5 sahifa ham yetarli.</p>
      </div>
    </header>
    <div class="rc-wrap">
      ${setupHTML()}
      <div id="rc-top">${topHTML()}</div>
      <section class="rc-card rc-prize">
        <h3>Eng faol ishtirokchilar</h3>
        <p>📣 Eng yaxshi xulosalar Ilm Yo‘lida kanalida yoritiladi.</p>
        <p>🎁 Yakunda eng faol ishtirokchilarga <b>kitob sovg‘a qilinadi!</b></p>
        <a class="rc-cta" href="${TG}" target="_blank" rel="noopener">✈ Ishtirok etish · t.me/ilmm_yolida</a>
        <div class="rc-bot-box">
          <p>👥 <b>Maxsus mutolaa guruhi:</b> 5 ta do‘stingizni kanalga taklif qiling — bot sizga guruh havolasini beradi.</p>
          <a class="rc-cta rc-bot" id="rc-bot" ${botName ? `href="https://t.me/${botName}"` : 'href="#" hidden'} target="_blank" rel="noopener">🤖 Botga o‘tish</a>
        </div>
      </section>
      ${guideHTML()}
      <h2 class="rc-h2">Sizning 15 kuningiz</h2>
      <p class="rc-flow-hint">Har kuni: sahifalarni kiriting → Ovoz, Matn yoki Poster tanlang → xulosani tayyorlang → tekshirib ulashing. O‘qib bo‘lgach, «O‘qidim» belgisini bosing.</p>
      <div class="rc-days" id="rc-days">${S.days.map((_, i) => dayHTML(i)).join('')}</div>
      <h2 class="rc-h2">Sertifikat</h2>
      <div id="rc-cert">${certHTML()}</div>
      <div class="rc-actions">
        <button type="button" class="rc-btn primary" onclick="rcExport()">⬇ Zaxira nusxa yuklab olish</button>
        <label class="rc-btn">⬆ Zaxira nusxani yuklash<input type="file" accept="application/json,.json" hidden onchange="rcImport(this)"></label>
        <button type="button" class="rc-btn red-outline" onclick="rcReset()">Hammasini tozalash</button>
      </div>
      <p class="rc-foot">Ilm yo‘lida birga yuramiz.<br>Natijalar shu qurilmada avtomatik saqlanadi. Boshqa qurilmaga o‘tish uchun zaxira nusxa yuklab oling.</p>
    </div>
  </section>`; };

  /* kirish sahifasi (3 qadam) matni yangi mazmunga moslandi */
  window.bookWelcomeView = () => {
    const step = state.bookWelcome;
    const body = step === 1
      ? `<div class="program-kicker">KITOBXONLIK · 01 / 03</div><h1>15 kun. 1 kitob. 0 so‘m.</h1><p>Ilm Yo‘lida | Mutolaa — mutlaqo bepul challenge. Har kuni 5 sahifa o‘qing va xulosangizni yozing yoki ovozga yozib oling.</p><button class="program-primary" onclick="setBookWelcome(2)">Boshlash →</button>`
      : step === 2
        ? `<div class="program-kicker">KITOBXONLIK · 02 / 03</div><h1>O‘qing. Belgilang. Ulashing.</h1><div class="program-steps"><div><b>01 · Kunlik o‘qish</b><span>Har kuni kitob o‘qing va sahifalaringizni belgilang.</span></div><div><b>02 · Xulosa</b><span>Ovoz, oddiy matn yoki poster tanlang. Xulosangizni tayyorlab, guruhga ulashing.</span></div><div><b>03 · Sertifikat</b><span>15 kunni xulosalari bilan tugatsangiz, ismingizdagi sertifikat ochiladi.</span></div></div><div class="program-actions"><button class="program-back" onclick="setBookWelcome(1)">← Ortga</button><button class="program-primary" onclick="setBookWelcome(3)">Ichkarida nima bor? →</button></div>`
        : `<div class="program-kicker">KITOBXONLIK · 03 / 03</div><h1>Kunlik reja. Xulosalar. Sertifikat.</h1><div class="program-preview-grid"><article><b>15 kunlik reja</b><span>Sahifa, kitob va xulosa — kunma-kun.</span><i></i></article><article><b>3 xil xulosa</b><span>Ovoz, oddiy matn yoki matnli poster — o‘zingiz tanlang.</span><i></i></article><article><b>Sertifikat</b><span>Challenge yakunida ismingizdagi sertifikat.</span><i></i></article></div><p>Bugundan boshlang — birinchi 5 sahifa sizni kutyapti.</p><div class="program-actions"><button class="program-back" onclick="setBookWelcome(2)">← Ortga</button><button class="program-primary" onclick="enterBooks()">Kitobxonlikka kirish →</button></div>`;
    return `<section class="program-entry book-entry"><button class="program-return" onclick="programBack()">← Ilm maydoniga qaytish</button><div class="program-entry-content">${body}</div></section>`;
  };

  /* ---------- yangilash yordamchilari ---------- */
  const setHTML = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  let certSig = '';
  const refresh = () => {
    setHTML('rc-top', topHTML());
    const sig = unlocked() ? JSON.stringify([readerName(), bookNames(), S.start, S.days.map(d => d.pages), completedOn().getTime()]) : 'locked:' + doneCount() + ':' + S.days.filter(hasSummary).length;
    if (sig !== certSig) { certSig = sig; setHTML('rc-cert', certHTML()); }
  };
  const repaintDay = i => { const e = document.getElementById('rc-day-' + i); if (e) e.outerHTML = dayHTML(i); };
  const repaintDays = () => setHTML('rc-days', S.days.map((_, i) => dayHTML(i)).join(''));

  let toastTimer;
  const toast = msg => {
    let el = document.getElementById('rc-toast');
    if (!el) { el = document.createElement('div'); el.id = 'rc-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.className = 'show';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = ''; }, 4800);
  };
  const download = (href, name) => { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const fontsReady = () => (document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve());

  let rcPrev = null, rcPrevDay = 0, previewVersion = 0;
  const previewText = () => rcPrev ? rcPrev.details + (rcPrev.format === 'text' ? '\n\nXulosa:\n' + (document.getElementById('rc-prev-cap')?.value || '') : rcPrev.format === 'voice' ? '\n\n🎙 Ovozli xulosa' : '') + '\n\n#IlmYolidaMutolaa' : '';
  const captionFor = i => {
    return `Ilm Yo‘lida · Mutolaa\n📅 ${i + 1}-kun / ${TOTAL} · ${long(dayDate(i))}\n📖 Kitob: ${bookForDay(i)}\nMuallif: ${authorForDay(i)}\nO‘quvchi: ${readerName()}\n📄 O‘qildi: ${S.days[i].pages} sahifa`;
  };
  const detailsHTML = i => `<b>${esc(bookForDay(i) || 'Kitob nomini yuqorida kiriting')}</b><br>Muallif: ${esc(authorForDay(i) || 'yuqorida kiriting')}<br>O‘quvchi: ${esc(readerName())}`;
  const refreshDetails = () => S.days.forEach((_, i) => setHTML('rc-meta-' + i, detailsHTML(i)));
  const validDetails = i => {
    if (!(S.name.trim() || profileName()) || !bookForDay(i) || !authorForDay(i) || !S.days[i].pages) {
      toast('Ism, kitob nomi, muallif va o‘qilgan sahifalar sonini kiriting.');
      return false;
    }
    return true;
  };
  const textFor = i => {
    const d = S.days[i];
    return [d.summary.trim(), ...d.extra.filter(e => e.text.trim()).map(e => [e.title.trim(), e.text.trim()].filter(Boolean).join('\n')), d.quote.trim() ? `“${d.quote.trim()}”${d.quoteBy.trim() ? ' — ' + d.quoteBy.trim() : ''}` : ''].filter(Boolean).join('\n\n');
  };

  // Audio stays in IndexedDB; localStorage only holds small references.
  let audioDB;
  const audioStore = async (mode, action) => {
    if (!window.indexedDB) throw new Error('Audio storage unavailable');
    if (!audioDB) audioDB = new Promise((resolve, reject) => {
      const req = indexedDB.open('ilm-mutolaa-audio', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('clips');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Audio storage blocked'));
    }).catch(error => { audioDB = null; throw error; });
    const db = await audioDB;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('clips', mode), req = action(tx.objectStore('clips'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Audio storage failed'));
    });
  };
  const getAudio = id => audioStore('readonly', store => store.get(id));
  const putAudio = (id, blob) => audioStore('readwrite', store => store.put(blob, id));
  const deleteAudio = id => audioStore('readwrite', store => store.delete(id)).catch(() => {});
  const clipURLs = new Map();
  const dropClipURL = id => { if (clipURLs.has(id)) URL.revokeObjectURL(clipURLs.get(id)); clipURLs.delete(id); };
  const clockText = seconds => `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;
  let recording = null;
  const voiceHTML = i => {
    const d = S.days[i], active = recording?.i === i;
    if (active) return `<p role="status">${recording.recorder ? '🔴 Ovoz yozilmoqda' : 'Mikrofonga ruxsat kutilmoqda…'} <b id="rc-timer-${i}">${clockText(recording.seconds || 0)}</b></p><button type="button" class="rc-btn ${recording.recorder ? 'red' : ''}" onclick="rcRecordStop()">${recording.recorder ? '■ To‘xtatish va saqlash' : 'Bekor qilish'}</button>`;
    return `<p class="rc-format-hint">O‘qiganlaringizni o‘z so‘zingiz bilan ayting. Ko‘pi bilan 5 daqiqa. Yuborishdan oldin tinglashingiz mumkin.</p>${d.voice ? `<p>✓ Ovozli xulosa saqlangan · ${clockText(d.voice.duration)}</p>${clipURLs.has(d.voice.id) ? `<audio controls preload="metadata" src="${clipURLs.get(d.voice.id)}" aria-label="${i + 1}-kun ovozli xulosasi"></audio>` : `<button type="button" class="rc-btn" onclick="rcVoiceListen(${i})">▶ Yozuvni tinglash</button>`}` : ''}<div class="rc-voice-actions"><button type="button" class="rc-btn primary" onclick="rcRecordStart(${i})">🎙 ${d.voice ? 'Qayta yozish' : 'Ovoz yozishni boshlash'}</button>${d.voice ? `<button type="button" class="rc-btn red-outline" onclick="rcVoiceDelete(${i})">O‘chirish</button>` : ''}</div><small>Ovoz shu brauzerda saqlanadi. Zaxira nusxaga ham qo‘shiladi.</small>`;
  };
  const updateVoice = i => { setHTML('rc-voice-' + i, voiceHTML(i)); setHTML('rc-share-' + i, shareBtn(i)); refresh(); };
  const stopTracks = session => { clearInterval(session.timer); session.stream?.getTracks().forEach(track => track.stop()); };
  const recordingGuard = () => {
    if (!recording) return false;
    toast('Avval ovoz yozishni to‘xtating va saqlanishini kuting.'); return true;
  };
  const blobDataURL = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });

  Object.assign(window, {
    rcFormat(i, format) {
      if (recordingGuard() || !['voice', 'text', 'poster'].includes(format)) return;
      S.days[i].format = format; save(); repaintDay(i); refresh();
    },
    async rcVoiceListen(i) {
      const voice = S.days[i].voice; if (!voice) return;
      try {
        const blob = await getAudio(voice.id);
        if (!blob?.size) throw new Error('Missing audio');
        if (S.days[i].voice?.id !== voice.id) return;
        dropClipURL(voice.id); clipURLs.set(voice.id, URL.createObjectURL(blob)); updateVoice(i);
      } catch { toast('Ovoz topilmadi. Zaxira nusxadan tiklang yoki qayta yozing.'); }
    },
    async rcRecordStart(i) {
      if (recordingGuard() || !validDetails(i)) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Bu brauzerda ovoz yozib bo‘lmaydi. HTTPS orqali Chrome yoki Safari’da oching yoki Matn shaklini tanlang.'); return; }
      if (S.days[i].voice && !confirm('Yangi yozuv saqlangach, avvalgi ovoz almashtiriladi. Davom etasizmi?')) return;
      const session = { i, seconds: 0, chunks: [], bytes: 0, day: S.days[i] };
      recording = session; updateVoice(i);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        session.stream = stream;
        if (recording !== session || !document.getElementById('rc-voice-' + i)) { stopTracks(session); if (recording === session) recording = null; return; }
        const mimeType = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported?.(type));
        const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
        session.recorder = recorder;
        recorder.ondataavailable = event => {
          if (event.data.size) { session.chunks.push(event.data); session.bytes += event.data.size; }
          if (session.bytes > 10 * 1024 * 1024 && recorder.state === 'recording') window.rcRecordStop();
        };
        recorder.onerror = () => { session.failed = true; if (recorder.state !== 'inactive') recorder.stop(); stopTracks(session); recording = null; updateVoice(i); toast('Ovoz yozishda xato. Avvalgi xulosangiz saqlangan. Qayta urinib ko‘ring.'); };
        recorder.onstop = async () => {
          stopTracks(session);
          try {
            if (session.failed || session.discard || S.days[i] !== session.day) return;
            const blob = new Blob(session.chunks, { type: recorder.mimeType || session.chunks[0]?.type || 'audio/webm' });
            if (!blob.size || session.bytes > 11 * 1024 * 1024) throw new Error('Empty or oversized audio');
            const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`, previous = session.day.voice;
            await putAudio(id, blob);
            if (session.discard || S.days[i] !== session.day) { deleteAudio(id); return; }
            session.day.voice = { id, duration: Math.min(300, (Date.now() - session.started) / 1000) };
            if (save() === false) { session.day.voice = previous; deleteAudio(id); throw new Error('Save failed'); }
            clipURLs.set(id, URL.createObjectURL(blob));
            if (previous) { dropClipURL(previous.id); deleteAudio(previous.id); }
            toast('Ovoz saqlandi. Tinglab, keyin ulashing.');
          } catch { toast('Ovoz saqlanmadi. Qurilmada bo‘sh joy va brauzer ruxsatlarini tekshirib, qayta yozing.'); }
          finally { if (recording === session) recording = null; updateVoice(i); }
        };
        recorder.start(1000); session.started = Date.now(); updateVoice(i);
        session.timer = setInterval(() => {
          session.seconds = Math.floor((Date.now() - session.started) / 1000);
          const timer = document.getElementById('rc-timer-' + i); if (timer) timer.textContent = clockText(session.seconds);
          if (session.seconds >= 300 || !document.getElementById('rc-voice-' + i)) window.rcRecordStop();
        }, 250);
      } catch (error) {
        stopTracks(session); if (recording === session) recording = null; updateVoice(i);
        toast(error.name === 'NotAllowedError' ? 'Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering yoki Matn shaklini tanlang.' : 'Mikrofonni ishga tushirib bo‘lmadi. Ulanganini tekshirib, qayta urinib ko‘ring.');
      }
    },
    rcRecordStop() {
      const session = recording; if (!session) return;
      if (!session.recorder) { recording = null; stopTracks(session); updateVoice(session.i); return; }
      if (session.recorder.state === 'inactive') return;
      clearInterval(session.timer); session.recorder.stop(); stopTracks(session);
      setHTML('rc-voice-' + session.i, '<p role="status">Ovoz saqlanmoqda…</p>');
    },
    async rcVoiceDelete(i) {
      if (recordingGuard() || !S.days[i].voice || !confirm('Shu kunning ovozli xulosasi o‘chirilsinmi?')) return;
      const previous = S.days[i].voice; S.days[i].voice = null;
      if (save() === false) { S.days[i].voice = previous; return; }
      dropClipURL(previous.id); await deleteAudio(previous.id); updateVoice(i);
    },
  });
  window.addEventListener('pagehide', () => { if (recording) window.rcRecordStop(); });
  window.addEventListener('beforeunload', event => { if (recording) { event.preventDefault(); event.returnValue = ''; } });
  /* ---------- harakatlar ---------- */
  Object.assign(window, {
    rcField(field, value) { S[field] = String(value).slice(0, field === 'name' ? 80 : field === 'author' ? 100 : 140); save(); refresh(); refreshDetails(); },
    rcStart(value) {
      if (!parse(value)) return;
      S.start = value; save();
      const end = document.getElementById('rc-end'); if (end && endDate()) end.value = ymd(endDate());
      certSig = ''; repaintDays(); refresh();
    },
    rcToggle(i) {
      const d = S.days[i]; d.done = !d.done; d.dateStamp = d.done ? ymd(new Date()) : '';
      save(); repaintDay(i); refresh();
    },
    rcPages(i, value) {
      S.days[i].pages = Math.max(0, Math.min(9999, Math.floor(Number(value)) || 0));
      save(); refresh();
    },
    rcSummary(i, value) {
      S.days[i].summary = String(value).slice(0, 2000); save();
      setHTML('rc-share-' + i, shareBtn(i)); refresh();
    },
    rcNewBook(i, checked) {
      const d = S.days[i]; d.newBook = checked; if (!checked) { d.book = ''; d.author = ''; }
      save(); repaintDay(i); certSig = ''; refresh(); refreshDetails();
    },
    rcExtraAdd(i) { const d = S.days[i]; if (d.extra.length >= MAX_EXTRA) return; d.extra.push({ title: '', text: '' }); save(); setHTML('rc-extras-' + i, extrasHTML(i)); },
    rcExtraDel(i, k) { S.days[i].extra.splice(k, 1); save(); setHTML('rc-extras-' + i, extrasHTML(i)); },
    rcExtra(i, k, field, value) { const e = S.days[i].extra[k]; if (!e) return; e[field] = String(value).slice(0, field === 'title' ? 60 : 2000); save(); },
    rcQuote(i, field, value) { S.days[i][field] = String(value).slice(0, field === 'quote' ? 400 : 80); save(); },
    rcBookAuthor(i, value) { S.days[i].author = String(value).slice(0, 100); save(); refreshDetails(); },
    rcBookTitle(i, value) { S.days[i].book = String(value).slice(0, 140); save(); refresh(); refreshDetails(); },
    async rcBuild(i) {
      const d = S.days[i];
      if (typeof html2canvas === 'undefined') { toast('Dalil kartasini yaratish uchun internet aloqasi kerak.'); return null; }
      const date = dayDate(i);
      const hasQuote = !!(d.quote || '').trim();
      const W = 1080, H = 1350;                       /* 4:5 — Telegram 1280 px dan oshmasa qayta siqmaydi */
      const stage = document.createElement('div');
      stage.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(stage);
      const cardHTML = (item, part, total) => `<div class="rc-p" style="width:${W}px;height:${H}px">
        <div class="rc-p-head">
          <img class="rc-p-logo" src="./assets/ilm-yolida-logo.png" alt="">
          <div class="rc-p-brand"><b>ILM YO‘LIDA</b><span>MUTOLAA CHALLENGE</span></div>
          <div class="rc-p-day"><small>KUN</small>${i + 1}<em>/15</em></div>
        </div>
        <div class="rc-p-meta">
          <div><small>SANA</small><b>${date ? long(date) : '—'}</b></div>
          <div><small>BUGUN O‘QILDI</small><b>${d.pages} sahifa</b></div>
          ${total > 1 ? `<div><small>QISM</small><b>${part} / ${total}</b></div>` : ''}
        </div>
        <div class="rc-p-body">
          <div class="rc-p-book"><small>KITOB</small>${esc(bookForDay(i) || 'Kitob nomi kiritilmagan')}${authorForDay(i) ? `<span class="rc-p-author">${esc(authorForDay(i))}</span>` : ''}</div>
          <div class="rc-p-rule"></div>
          ${hasQuote && part === 1 ? `<div class="rc-p-quote"><div class="rc-p-quote-t">“${esc(d.quote.trim())}”</div>${d.quoteBy.trim() ? `<div class="rc-p-quote-by">— ${esc(d.quoteBy.trim())}</div>` : ''}</div>` : '<div class="rc-p-q">“</div>'}
          ${item.title ? `<div class="rc-p-topic">${esc(item.title)}</div>` : ''}
          <div class="rc-p-text">${esc(item.text)}</div>
        </div>
        <div class="rc-p-foot">
          <div class="rc-p-name"><small>O‘QUVCHI</small>${esc(readerName())}</div>
          <div class="rc-p-tg">t.me/ilmm_yolida</div>
        </div>
      </div>`;
      const mount = (item, part, total) => { stage.innerHTML = cardHTML(item, part, total); return stage.firstElementChild; };
      const fits = (el) => { const t = el.querySelector('.rc-p-text'), bd = el.querySelector('.rc-p-body'); return bd.scrollHeight <= bd.clientHeight + 1 && t.scrollHeight <= t.clientHeight + 1; };
      const SIZES = [58, 54, 50, 46, 42, 38, 35, 32, 30, 28];
      const fitSize = (el, minPx = 0) => { const t = el.querySelector('.rc-p-text'); for (const px of SIZES) { if (px < minPx) break; t.style.fontSize = px + 'px'; if (fits(el)) return px; } return 0; };
      try {
        await fontsReady();
        /* Har bir xulosa — alohida rasm. Avtomatik bo‘linmaydi: sig‘masa shrift kichrayadi, baribir sig‘masa ogohlantiriladi */
        const items = [{ title: '', text: String(d.summary || '').trim() || '—' }]
          .concat(d.extra.filter(e => e.text.trim()).map(e => ({ title: e.title.trim(), text: e.text.trim() })));
        let el, clipped = [];
        const files = [];
        for (let k = 0; k < items.length; k++) {
          el = mount(items[k], k + 1, items.length);
          const img = el.querySelector('.rc-p-logo');
          if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
          if (!fitSize(el, 28)) clipped.push(k + 1);
          const canvas = await html2canvas(el, { scale: 1, width: W, height: H, backgroundColor: '#0b3f31', useCORS: true });
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          if (!blob) throw new Error('blob');
          const name = items.length > 1 ? `${i + 1}-kun-dalil-${k + 1}.png` : `${i + 1}-kun-dalil.png`;
          files.push(new File([blob], name, { type: 'image/png' }));
        }
        const urls = files.map(f => URL.createObjectURL(f));
        return { files, urls, clipped };
      } catch { toast('Dalil kartasini yaratib bo‘lmadi. Qayta urinib ko‘ring.'); return null; }
      finally { stage.remove(); }
    },
    /* Ko‘rib chiqish oynasi: karta aynan guruhga ketadigan ko‘rinishda chiqadi, caption tahrirlanadi */
    async rcShare(i) {
      const d = S.days[i];
      if (recordingGuard() || !hasSummary(d) || !validDetails(i)) return;
      window.rcPreviewClose();
      const version = previewVersion, format = d.format;
      let built;
      if (d.format === 'voice') {
        try {
          const blob = await getAudio(d.voice.id);
          if (!blob?.size) throw new Error('Missing audio');
          const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
          built = { files: [new File([blob], `${i + 1}-kun-ovozli-xulosa.${ext}`, { type: blob.type })], urls: [URL.createObjectURL(blob)] };
        } catch { toast('Ovoz topilmadi. Zaxira nusxadan tiklang yoki qayta yozing.'); return; }
      } else if (d.format === 'text') built = { files: [], urls: [] };
      else { toast('Poster tayyorlanmoqda…'); built = await window.rcBuild(i); }
      if (!built) return;
      if (version !== previewVersion || S.days[i] !== d || d.format !== format) { built.urls.forEach(url => URL.revokeObjectURL(url)); return; }
      rcPrev = { ...built, format: d.format, details: captionFor(i) }; rcPrevDay = i;
      const old = document.getElementById('rc-prev'); if (old) old.remove();
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="rc-modal-back" id="rc-prev" onclick="if(event.target===this)rcPreviewClose()">
        <div class="rc-modal rc-prev" role="dialog" aria-modal="true" aria-label="Xulosani ko‘rib chiqish" tabindex="-1">
          <button type="button" class="rc-modal-x" onclick="rcPreviewClose()" aria-label="Yopish">✕</button>
          <h2>3. ${d.format === 'voice' ? 'Tinglang va ulashing' : d.format === 'text' ? 'Matnni tekshiring va ulashing' : 'Posterni tekshiring va ulashing'}</h2>
          <p class="rc-prev-hint">${d.format === 'voice' ? 'Ovoz va quyidagi kitob ma’lumotlarini birga ulashing. Ulashish oynasida Telegramni tanlang.' : d.format === 'text' ? 'Quyidagi ma’lumotlar va xulosa Telegram xabariga qo‘shiladi.' : 'Rasm va kitob ma’lumotlarini birga ulashing. Ulashish oynasida Telegramni tanlang.'}</p>
          ${built.clipped && built.clipped.length ? `<p class="rc-prev-warn">⚠️ ${built.clipped.join(', ')}-rasmda matn sig‘madi. «Tahrirlash» ni bosing va «➕ Yana xulosa qo‘shish» orqali matnni bo‘lib yozing.</p>` : ''}
          ${d.format === 'voice' ? `<audio controls src="${built.urls[0]}" aria-label="Ovozli xulosani tinglash"></audio>` : `<div class="rc-prev-imgs">${built.urls.map((u, k) => `<img src="${u}" alt="${i + 1}-kun dalil kartasi ${k + 1}">`).join('')}</div>`}
          <pre class="rc-share-details">${esc(rcPrev.details)}</pre>
          ${d.format === 'text' ? '<label class="rc-prev-lbl" for="rc-prev-cap">Xulosa matni (tahrirlash mumkin)</label><textarea id="rc-prev-cap" rows="7"></textarea>' : '<p class="rc-format-hint">Kitob ma’lumotlarini o‘zgartirish uchun «Tahrirlash» tugmasini bosing.</p>'}
          <p class="rc-format-hint">${d.format === 'text' ? '' : 'Telegram matnni birga qo‘shmasa, «Matnni nusxalash» orqali izohga joylang.'}</p>
          <p id="rc-share-status" role="status"></p>
          <div class="rc-prev-btns">
            <button type="button" class="rc-btn" onclick="rcPreviewClose()">✏️ Tahrirlash</button>
            <button type="button" class="rc-btn" onclick="rcCopyCaption()">📋 Matnni nusxalash</button>
            ${d.format !== 'text' ? '<button type="button" class="rc-btn" onclick="rcPreviewDownload()">⬇ Yuklab olish</button>' : ''}
            <button type="button" class="rc-btn primary" onclick="rcPreviewSend(this)">📤 Telegramda ulashish</button>
          </div>
        </div></div>`;
      document.body.appendChild(wrap.firstElementChild);
      const caption = document.getElementById('rc-prev-cap'); if (caption) caption.value = textFor(i);
      document.querySelector('#rc-prev [role="dialog"]').focus();
    },
    rcPreviewClose() {
      previewVersion++;
      const e = document.getElementById('rc-prev'); if (e) e.remove();
      if (rcPrev) { rcPrev.urls.forEach(u => URL.revokeObjectURL(u)); rcPrev = null; }
      if (e) document.querySelector('#rc-share-' + rcPrevDay + ' button')?.focus();
    },
    async rcCopyCaption() {
      if (!rcPrev) return;
      const text = previewText();
      try { await navigator.clipboard.writeText(text); toast('Matn nusxalandi — Telegram xabariga qo‘ying.'); }
      catch { window.prompt('Matnni nusxalab, Telegramga joylang:', text); }
    },
    rcPreviewDownload() {
      if (!rcPrev) return;
      rcPrev.files.forEach((file, k) => { const url = URL.createObjectURL(file); setTimeout(() => { download(url, file.name); setTimeout(() => URL.revokeObjectURL(url), 30000); }, k * 400); });
      toast('Fayl yuklab olindi. Telegramda uni biriktiring va kitob ma’lumotlarini izohga qo‘ying.');
    },
    async rcPreviewSend(button) {
      if (!rcPrev || button?.disabled) return;
      const preview = rcPrev, files = preview.files, caption = previewText();
      if (preview.format === 'text') { window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(caption)}`, '_blank', 'noopener'); return; }
      if (button) button.disabled = true;
      try {
        if (navigator.share && navigator.canShare?.({ files })) {
          try { await navigator.share({ files, title: `${rcPrevDay + 1}-kun — ${readerName()}`, text: caption }); return; }
          catch (err) { if (err?.name === 'AbortError') return; }
        }
        if (rcPrev !== preview) return;
        window.rcPreviewDownload();
        const status = document.getElementById('rc-share-status');
        if (status) status.innerHTML = `Fayl yuklab olindi. <b>1.</b> Matnni nusxalang. <b>2.</b> Telegramni oching. <b>3.</b> Faylni biriktirib, matnni izohga qo‘ying. <a href="https://t.me/share/url?url=&amp;text=${encodeURIComponent(caption)}" target="_blank" rel="noopener">Telegramni ochish →</a>`;
      } finally { if (button) button.disabled = false; }
    },
    async rcCertDownload() {
      const src = document.getElementById('rc-certificate'); if (!src) return;
      if (typeof html2canvas === 'undefined') { toast('Rasm yaratish uchun internet aloqasi kerak. «Chop etish / PDF» tugmasidan foydalaning.'); return; }
      toast('Sertifikat tayyorlanmoqda…');
      const clone = src.cloneNode(true); clone.removeAttribute('id');
      clone.classList.add('rc-print-mode'); clone.style.cssText = 'width:1754px;height:1240px;box-sizing:border-box';
      const stage = document.createElement('div'); stage.style.cssText = 'position:fixed;left:-99999px;top:0';
      stage.appendChild(clone); document.body.appendChild(stage);
      try {
        await fontsReady();
        /* 1754x1240 @ scale 2 = 3508x2480 px (A4 albom, 300 dpi) */
        const canvas = await html2canvas(clone, { scale: 2, width: 1754, height: 1240, windowWidth: 1754, backgroundColor: '#fffdf7', useCORS: true });
        download(canvas.toDataURL('image/png'), `${readerName().replace(/\s+/g, '-').toLowerCase()}-sertifikat.png`);
        toast('Sertifikat yuklab olindi.');
      } catch { toast('Sertifikatni yaratib bo‘lmadi. «Chop etish / PDF» tugmasidan foydalaning.'); }
      finally { stage.remove(); }
    },
    rcCertPrint() {
      document.body.classList.add('rc-printing');
      const off = () => { document.body.classList.remove('rc-printing'); window.removeEventListener('afterprint', off); };
      window.addEventListener('afterprint', off); window.print();
    },
    async rcCopyTemplate() {
      try { await navigator.clipboard.writeText(TEMPLATE); toast('Shablon nusxalandi. Xulosa maydoniga qo‘yib, nuqtalarni to‘ldiring.'); }
      catch { toast('Nusxalab bo‘lmadi. Shablon: ' + TEMPLATE.replace(/\n/g, ' ')); }
    },
    async rcExport() {
      if (recordingGuard()) return;
      const backup = JSON.parse(JSON.stringify(S)); backup.audio = {};
      try {
        for (const d of backup.days) if (d.voice) {
          const blob = await getAudio(d.voice.id); if (!blob?.size) throw new Error('Missing audio');
          backup.audio[d.voice.id] = await blobDataURL(blob);
        }
      } catch { toast('Ovozlarni zaxiralab bo‘lmadi. Saqlangan yozuvlarni tekshiring va qayta urinib ko‘ring.'); return; }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      download(url, `${(S.name.trim() || profileName() || 'mutolaa').replace(/\s+/g, '-').toLowerCase()}-mutolaa-zaxira.json`);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    rcImport(input) {
      if (recordingGuard()) { input.value = ''; return; }
      const file = input.files && input.files[0]; if (!file) return;
      if (file.size > 230 * 1024 * 1024) { toast('Zaxira fayli juda katta.'); input.value = ''; return; }
      if (!confirm('Zaxiradagi ma’lumotlar joriy challenge o‘rniga tiklanadi. Davom etasizmi?')) { input.value = ''; return; }
      const reader = new FileReader();
      reader.onerror = () => toast('Zaxira faylini o‘qib bo‘lmadi.');
      reader.onload = async () => {
        let next = null, raw; try { raw = JSON.parse(reader.result); next = clean(raw); } catch { next = null; }
        if (!next) { toast('Bu zaxira faylini o‘qib bo‘lmadi.'); return; }
        const inserted = [], previous = S;
        try {
          for (const d of next.days) if (d.voice) {
            const data = raw.audio?.[d.voice.id];
            if (typeof data !== 'string' || data.length > 16 * 1024 * 1024 || !/^data:audio\/(?:mp4|ogg|webm)(?:;codecs=[a-zA-Z0-9.,-]+)?;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid audio backup');
            const comma = data.indexOf(','), binary = atob(data.slice(comma + 1));
            const blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: data.slice(5, data.indexOf(';base64,')) });
            const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await putAudio(id, blob); inserted.push(id); d.voice.id = id;
          }
          if (recording || S !== previous) throw new Error('Challenge changed');
          S = next; if (save() === false) { S = previous; throw new Error('Save failed'); }
          window.rcPreviewClose(); previous.days.forEach(d => { if (d.voice) { dropClipURL(d.voice.id); deleteAudio(d.voice.id); } });
          certSig = ''; render(); toast('Zaxira nusxa ovozlar bilan tiklandi.');
        } catch { inserted.forEach(deleteAudio); toast('Zaxira tiklanmadi. Fayldagi ovozlar va qurilma xotirasini tekshiring. Avvalgi ma’lumotlar saqlangan.'); }
      };
      reader.readAsText(file); input.value = '';
    },
    rcReset() {
      if (recordingGuard()) return;
      if (!confirm('Shu qurilmadagi Mutolaa challenge natijalari tozalanadi. Davom etasizmi?')) return;
      const previous = S; S = fresh(); if (save() === false) { S = previous; return; }
      window.rcPreviewClose(); previous.days.forEach(d => { if (d.voice) { dropClipURL(d.voice.id); deleteAudio(d.voice.id); } });
      certSig = ''; render();
    },
  });

  /* ---------- uslub ---------- */
  if (!document.getElementById('rc-fonts')) {
    const link = document.createElement('link');
    link.id = 'rc-fonts'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&display=swap';
    document.head.appendChild(link);
  }
  const style = document.createElement('style');
  style.id = 'rc-style';
  style.textContent = `
.rc-app{--g:#07543f;--g2:#0c6a50;--g3:#dcefe8;--gold:#d5a63b;--gold2:#f1d58b;--cream:#fbfaf4;--ink:#17332b;--mut:#6f7f78;--line:#dfe7e1;--red:#a64b42;
  min-height:100dvh;background:#eef4ef;color:var(--ink);padding-bottom:64px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.rc-app *{box-sizing:border-box}
.rc-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#053d2e 0%,var(--g) 55%,var(--g2) 100%);color:var(--cream);padding:clamp(18px,3vw,34px) clamp(16px,4vw,56px) clamp(54px,7vw,84px);border-bottom:4px solid var(--gold)}
.rc-hero::before,.rc-hero::after{content:"";position:absolute;border-radius:50%;border:1.5px solid rgba(241,213,139,.28);pointer-events:none}
.rc-hero::before{width:360px;height:360px;right:-90px;top:-120px}
.rc-hero::after{width:210px;height:210px;right:40px;top:40px;border-color:rgba(241,213,139,.18)}
.rc-back{position:relative;border:1px solid rgba(251,250,244,.35);background:transparent;color:inherit;border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;font-size:.86rem;cursor:pointer}
.rc-back:hover{background:rgba(251,250,244,.12)}
.rc-hero-text{position:relative;max-width:1000px;margin:clamp(22px,4vw,40px) auto 0;padding:0 4px}
.rc-hero-logo{height:64px;width:auto;display:block;margin:0 0 14px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.25))}
.rc-trio{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:1.15rem;font-weight:800;margin-bottom:12px}
.rc-trio i{color:var(--gold);font-style:normal}
.rc-free{display:inline-block;background:linear-gradient(180deg,#f1d58b,#d5a63b);color:#3a2b05;font-weight:900;letter-spacing:.08em;font-size:.82rem;padding:7px 18px;border-radius:999px;margin-bottom:14px;box-shadow:0 6px 18px rgba(0,0,0,.2)}
.rc-hero-text,.rc-wrap{max-width:960px}
.rc-eyebrow{display:block;color:var(--gold2);font-size:.76rem;font-weight:900;letter-spacing:.16em}
.rc-hero h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:clamp(2rem,6vw,3.5rem);line-height:1.04;margin:12px 0 10px;letter-spacing:-.01em}
.rc-hero p{margin:0;max-width:560px;color:#cfe4da;line-height:1.6}
.rc-wrap{margin:0 auto;padding:0 clamp(14px,3vw,24px)}
.rc-card{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 55px rgba(21,62,48,.1);padding:clamp(16px,3vw,24px)}
.rc-setup{margin:-34px 0 20px;position:relative}
.rc-setup h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.5rem;margin:0 0 14px}
.rc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.rc-app label{display:flex;flex-direction:column;gap:6px;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.rc-app input[type=text],.rc-app input[type=date],.rc-app input[type=number],.rc-app textarea{width:100%;font:inherit;font-size:.95rem;font-weight:500;text-transform:none;letter-spacing:0;color:var(--ink);background:var(--cream);border:1px solid var(--line);border-radius:10px;padding:10px 12px;transition:border-color .2s,box-shadow .2s}
.rc-app input:focus,.rc-app textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(213,166,59,.22)}
.rc-app input[readonly]{opacity:.75}
.rc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.rc-stat{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 10px;text-align:center;box-shadow:0 10px 30px rgba(21,62,48,.07)}
.rc-stat b{display:block;font-size:1.65rem;font-weight:800;color:var(--g);font-variant-numeric:tabular-nums}
.rc-stat span{font-size:.7rem;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);font-weight:700}
.rc-ribbon{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:20px;box-shadow:0 10px 30px rgba(21,62,48,.07)}
.rc-ribbon-top{display:flex;justify-content:space-between;font-size:.85rem;font-weight:700;color:var(--mut);margin-bottom:10px}
.rc-track{height:14px;border-radius:999px;background:var(--g3);overflow:hidden}
.rc-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--g),var(--gold));transition:width .6s cubic-bezier(.4,0,.2,1)}
.rc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-weight:700;font-size:.86rem;text-transform:none!important;letter-spacing:0!important;color:var(--ink)!important;border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 16px;cursor:pointer;transition:border-color .2s,filter .2s}
.rc-btn:hover{border-color:var(--gold)}
.rc-btn.primary{background:var(--g);border-color:var(--g);color:#fff!important}
.rc-btn.primary:hover{filter:brightness(1.12)}
.rc-btn.red{background:var(--red);border-color:var(--red);color:#fff!important}
.rc-btn.red-outline{color:var(--red)!important;border-color:var(--red);background:transparent}
.rc-btn.ghost{background:transparent}
.rc-btn:disabled{opacity:.45;cursor:not-allowed}
.rc-h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.7rem;margin:6px 0 14px}
.rc-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:34px}
.rc-day{position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(21,62,48,.07);transition:transform .2s,border-color .2s}
.rc-day:hover{transform:translateY(-2px)}
.rc-day.done{border-color:var(--g);background:linear-gradient(180deg,#f4faf6,#fff 60%)}
.rc-day.today{border-color:var(--gold);box-shadow:0 0 0 3px rgba(213,166,59,.25),0 10px 30px rgba(21,62,48,.07)}
.rc-day.missed{border-color:#ecd9a6}
.rc-day.missed small{color:#a9791a}
.rc-day-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.rc-day-num{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.35rem;line-height:1.1}
.rc-day small{font-size:.74rem;color:var(--mut);font-weight:600}
.rc-check{width:30px;height:30px;border-radius:50%;border:2px solid var(--g);background:transparent;color:transparent;font-size:.95rem;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s}
.rc-check:hover:not(:disabled){background:var(--g3)}
.rc-check.on{background:var(--g);color:#fff;transform:scale(1.08)}
.rc-check:disabled{opacity:.45;cursor:not-allowed}
.rc-pages{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.rc-pages input{width:78px!important}
.rc-pages span{font-size:.8rem;color:var(--mut)}
.rc-app label.rc-newbook{flex-direction:row;align-items:center;gap:8px;font-size:.78rem;font-weight:600;text-transform:none;letter-spacing:0;color:var(--mut);cursor:pointer;margin-bottom:8px}
.rc-newbook input{width:16px;height:16px;accent-color:var(--gold);flex-shrink:0}
.rc-booktitle{margin-bottom:8px;font-style:italic}
.rc-extras{display:grid;gap:10px;margin-top:10px}
.rc-extra{border:1px dashed #d9c68f;border-radius:14px;padding:10px;display:grid;gap:8px;background:#fffdf5}
.rc-extra-top{display:flex;justify-content:space-between;align-items:center;font-size:.82rem;color:#8a6d2b}
.rc-extra-x{border:0;background:#f1e6cc;border-radius:50%;width:26px;height:26px;cursor:pointer}
.rc-extra-add{border:1px dashed #b8934a;background:transparent;color:#8a6d2b;border-radius:12px;padding:9px;font-weight:700;cursor:pointer;font-size:.86rem}
.rc-quote-box{display:grid;gap:8px;margin-top:10px}
.rc-quote{min-height:54px;resize:vertical;font-size:.86rem!important;font-style:italic}
.rc-quote-by{font-size:.86rem!important}
.rc-summary{min-height:70px;resize:vertical;font-size:.88rem!important}
.rc-step-label{font-size:.75rem;font-weight:850;color:var(--g);margin:18px 0 9px}
.rc-done-control{display:flex;align-items:center;gap:6px}.rc-done-control small{font-size:.65rem}
.rc-flow-hint{font-size:.85rem;line-height:1.8;color:var(--mut);margin:0 0 18px}
.rc-guide>summary{cursor:pointer;color:var(--g);line-height:1.7}.rc-guide>summary span{display:block;font-size:.78rem;color:var(--mut);font-weight:400}
.rc-day-meta{font-size:.78rem;line-height:1.65;color:var(--mut);overflow-wrap:anywhere;background:var(--cream);padding:10px;border-radius:9px}
.rc-day-meta b{color:var(--ink)}
.rc-formats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px 0 14px}
.rc-formats button{font:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 3px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);cursor:pointer;min-height:82px}
.rc-formats button[aria-pressed=true]{background:var(--g3);border:2px solid var(--g);padding:9px 2px;color:var(--g)}
.rc-formats button:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.rc-formats b{font-size:.82rem}.rc-formats button small{font-size:.61rem;color:inherit;font-weight:500}
.rc-format-hint{font-size:.77rem;line-height:1.6;color:#64776d;margin:8px 0 14px}
.rc-summary-label{text-transform:none!important;letter-spacing:0!important;margin-top:10px}
.rc-optional{margin:12px 0}.rc-optional summary{font-size:.75rem;color:var(--mut);cursor:pointer;line-height:1.6}
.rc-voice{padding:12px;background:var(--cream);border:1px solid var(--line);border-radius:12px}
.rc-voice p{font-size:.8rem;line-height:1.6}.rc-voice small{display:block;line-height:1.6;margin-top:10px}
.rc-voice audio,.rc-prev audio{display:block;width:100%;max-width:100%;margin:12px 0}
.rc-voice-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.rc-voice-actions .rc-btn{padding:10px;font-size:.75rem}
.rc-share-details{font:500 .85rem/1.8 Inter,system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f7f3;padding:16px;border-radius:12px;color:#17332b}
#rc-share-status{font-size:.82rem;line-height:1.7;color:#07543f}#rc-share-status a{display:block;font-weight:800}
.rc-share:empty{display:none}
.rc-share{margin-top:10px}
.rc-share-btn{width:100%;border:0;border-radius:10px;background:var(--gold);color:#2b2208;font:inherit;font-weight:800;font-size:.82rem;padding:10px;cursor:pointer;transition:filter .2s}
.rc-share-btn:hover{filter:brightness(1.07)}
.rc-locked{background:#fff;border:1.5px dashed var(--line);border-radius:18px;padding:28px 20px;text-align:center;color:var(--mut);margin-bottom:30px}
.rc-locked span{font-size:2rem;display:block;margin-bottom:6px}
.rc-locked p{margin:0 0 8px;line-height:1.6}
.rc-locked small{font-weight:700;color:var(--g)}
.rc-cert-outer{background:#fff;border:1px solid var(--line);border-radius:18px;padding:clamp(12px,3vw,24px);box-shadow:0 18px 55px rgba(21,62,48,.1);margin-bottom:30px}
#rc-certificate{position:relative;background:#fffdf7;color:#17332b;border:2px solid #b8934a;padding:clamp(26px,5vw,48px) clamp(18px,4vw,40px);
  background-image:repeating-linear-gradient(45deg,rgba(184,147,74,.045) 0 2px,transparent 2px 14px)}
#rc-certificate::before,.rc-print-mode::before{content:"";position:absolute;inset:10px;border:1px solid #b8934a;pointer-events:none}
.rc-cert-inner{position:relative;text-align:center}
.rc-cert-logo{width:54px;height:54px;object-fit:contain;margin:0 auto 6px;display:block}
.rc-cert-eyebrow{font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:#b8934a;font-weight:800;margin-bottom:6px}
.rc-cert-title{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.1;margin-bottom:4px}
.rc-cert-sub{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.1rem;color:#5a6e66;margin-bottom:22px}
.rc-cert-presented{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#8a9390;margin-bottom:8px}
.rc-cert-name{display:inline-block;font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:clamp(1.9rem,6vw,2.9rem);color:#07543f;border-bottom:1px solid #b8934a;padding:0 20px 6px;margin-bottom:18px;max-width:100%;overflow-wrap:anywhere}
.rc-cert-body{font-family:"Cormorant Garamond",Georgia,serif;font-size:clamp(1.05rem,2.6vw,1.3rem);line-height:1.7;color:#2c3d36;max-width:600px;margin:0 auto 26px}
.rc-cert-book{font-style:italic;font-weight:700;color:#07543f}
.rc-cert-meta{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:30px;font-size:.74rem;color:#5a6e66}
.rc-cert-block{text-align:center;min-width:120px}
.rc-cert-line{border-top:1px solid #17332b;margin-top:22px;padding-top:6px;font-weight:700;letter-spacing:.04em;margin-bottom:3px}
.rc-cert-meta>.rc-cert-block:first-child .rc-cert-line,.rc-cert-meta>.rc-cert-block:last-child .rc-cert-line{margin-top:30px}
.rc-cert-seal{width:76px;height:76px;border-radius:50%;border:2px solid #b8934a;color:#b8934a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:.56rem;font-weight:800;letter-spacing:.1em;line-height:1.35;flex-shrink:0}
.rc-cert-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
.rc-print-mode{padding:96px 84px!important;position:relative;background-color:#fffdf7;color:#17332b;border:2px solid #b8934a;font-family:Inter,sans-serif}
.rc-print-mode::before{inset:22px!important;border-width:3px!important}
.rc-print-mode{display:flex!important;align-items:center;justify-content:center}.rc-print-mode .rc-cert-inner{width:100%}
.rc-print-mode .rc-cert-logo{width:110px;height:110px;margin-bottom:12px}
.rc-print-mode .rc-cert-eyebrow{font-size:23px;letter-spacing:6px;margin-bottom:14px}
.rc-print-mode .rc-cert-title{font-size:72px;margin-bottom:10px}
.rc-print-mode .rc-cert-sub{font-size:32px;margin-bottom:34px}
.rc-print-mode .rc-cert-presented{font-size:22px;letter-spacing:4px;margin-bottom:14px}
.rc-print-mode .rc-cert-name{font-size:82px;padding:0 44px 16px;margin-bottom:34px;border-bottom-width:2px}
.rc-print-mode .rc-cert-body{font-size:33px;max-width:1500px;margin:0 auto 30px;line-height:1.7}
.rc-print-mode .rc-cert-meta{margin-top:50px;font-size:21px}
.rc-print-mode .rc-cert-block{min-width:340px}
.rc-print-mode .rc-cert-line{margin-top:40px!important;padding-top:12px;font-size:24px}
.rc-print-mode .rc-cert-seal{width:150px;height:150px;font-size:17px;border-width:3px}
.rc-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.rc-actions label.rc-btn{flex-direction:row}
.rc-foot{text-align:center;color:var(--mut);font-size:.8rem;margin:16px 0 0}
.rc-p{position:relative;display:flex;flex-direction:column;background:#0b3f31;color:#17332b;font-family:Inter,Arial,sans-serif;overflow:hidden}
.rc-p *{box-sizing:border-box;margin:0}
.rc-p-head{display:flex;align-items:center;gap:26px;padding:48px 64px 40px;background:radial-gradient(120% 140% at 85% 0%,#0f6b52 0%,#07543f 45%,#063a2c 100%);position:relative}
.rc-p-head::after{content:"";position:absolute;left:64px;right:64px;bottom:0;height:3px;background:linear-gradient(90deg,#b8934a,#e9d08c 50%,#b8934a)}
.rc-p-logo{width:128px;height:128px;border-radius:50%;background:#fffdf7;padding:10px;object-fit:contain;box-shadow:0 0 0 4px #b8934a}
.rc-p-brand{flex:1;display:flex;flex-direction:column;gap:10px}
.rc-p-brand b{font-family:"Cormorant Garamond",Georgia,serif;font-size:50px;font-weight:700;letter-spacing:4px;color:#fffdf7;line-height:1}
.rc-p-brand span{font-size:20px;letter-spacing:6px;font-weight:700;color:#e0c277}
.rc-p-day{text-align:center;font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:112px;line-height:.9;color:#e9d08c}
.rc-p-day small{display:block;font-family:Inter,Arial,sans-serif;font-size:18px;letter-spacing:5px;color:#b8934a;margin-bottom:6px}
.rc-p-day em{font-style:normal;font-size:34px;color:#b8934a;margin-left:4px}
.rc-p-meta{display:flex;background:#063a2c;padding:24px 64px;gap:48px;border-bottom:1px solid rgba(184,147,74,.45)}
.rc-p-meta div{display:flex;flex-direction:column;gap:6px}
.rc-p-meta small{font-size:15px;letter-spacing:3px;font-weight:700;color:#b8934a}
.rc-p-meta b{font-size:28px;font-weight:700;color:#fffdf7}
.rc-p-body{flex:1;min-height:0;display:flex;flex-direction:column;background:#fffdf7;padding:44px 64px 30px;position:relative;overflow:hidden}
.rc-p-body::before{content:"";position:absolute;inset:14px;border:2px solid #e3d2a0;pointer-events:none}
.rc-p-book{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:700;font-size:40px;line-height:1.15;color:#07543f}
.rc-p-book small{display:block;font-family:Inter,Arial,sans-serif;font-style:normal;font-size:15px;letter-spacing:3px;color:#b8934a;margin-bottom:8px}
.rc-p-author{display:block;margin-top:8px;font-family:Inter,Arial,sans-serif;font-style:normal;font-weight:600;font-size:22px;letter-spacing:1px;color:#8a6d2b}
.rc-p-rule{height:3px;width:120px;background:#b8934a;margin:22px 0 4px}
.rc-p-q{font-family:"Cormorant Garamond",Georgia,serif;font-size:110px;line-height:.8;color:#e3d2a0;height:56px}
.rc-p-quote{margin:26px 0 22px;padding:6px 0 6px 26px;border-left:6px solid #b8934a}
.rc-p-quote-t{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:600;font-size:34px;line-height:1.3;color:#07543f;overflow-wrap:anywhere}
.rc-p-quote-by{margin-top:10px;font-size:19px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b8934a}
.rc-p-topic{font-family:Inter,Arial,sans-serif;font-weight:800;font-size:24px;letter-spacing:3px;text-transform:uppercase;color:#07543f;margin:6px 0 10px}
.rc-p-text{flex:1;min-height:0;overflow:hidden;font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:40px;line-height:1.38;color:#1f332b;overflow-wrap:anywhere;white-space:pre-wrap}
.rc-p-foot{display:flex;justify-content:space-between;align-items:center;padding:30px 64px 36px;background:linear-gradient(180deg,#07543f,#063a2c);position:relative}
.rc-p-foot::before{content:"";position:absolute;left:64px;right:64px;top:0;height:3px;background:linear-gradient(90deg,#b8934a,#e9d08c 50%,#b8934a)}
.rc-p-name{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:44px;color:#fffdf7;line-height:1.1}
.rc-p-name small{display:block;font-family:Inter,Arial,sans-serif;font-size:15px;letter-spacing:3px;color:#b8934a;margin-bottom:6px}
.rc-p-tg{font-size:26px;font-weight:700;letter-spacing:1px;color:#e0c277}
#rc-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);max-width:min(92vw,460px);background:#07543f;color:#fff;border-radius:12px;padding:12px 18px;font:600 .88rem/1.45 Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:.3s;z-index:9999}
#rc-toast.show{opacity:1;transform:translate(-50%,0)}
@media(max-width:700px){.rc-stats{grid-template-columns:repeat(2,1fr)}.rc-grid2{grid-template-columns:1fr}.rc-cert-meta{flex-wrap:wrap;justify-content:center}.rc-cert-block{min-width:100px}}
@media(prefers-reduced-motion:reduce){.rc-app *{transition:none!important}}
.rc-prize{margin-bottom:20px;text-align:center;background:linear-gradient(180deg,#fffdf4,#fff);border-color:#ecd9a6}
.rc-prize h3{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.5rem;margin:0 0 10px;color:var(--g)}
.rc-prize p{margin:6px 0;line-height:1.6}
.rc-cta{display:inline-block;margin-top:12px;background:var(--g);color:#fff!important;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 24px;box-shadow:0 10px 24px rgba(7,84,63,.28);transition:filter .2s}
.rc-cta:hover{filter:brightness(1.14)}
.rc-cta[hidden]{display:none}
.rc-bot-box{margin-top:18px;padding-top:16px;border-top:1px dashed #ecd9a6}
.rc-bot-box p{margin:0 0 4px}
.rc-bot{background:#229ed9;box-shadow:0 10px 24px rgba(34,158,217,.3)}
.rc-guide{margin-bottom:30px;border-top:4px solid var(--gold)}
.rc-kicker{font-size:.72rem;font-weight:900;letter-spacing:.16em;color:#a9791a}
.rc-guide h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.9rem;margin:4px 0 8px}
.rc-lead{margin:0 0 16px;line-height:1.65;color:#40574d}
.rc-steps{list-style:none;margin:0 0 16px;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rc-steps li{display:flex;gap:12px;background:var(--cream);border:1px solid var(--line);border-radius:14px;padding:14px}
.rc-steps i{flex:0 0 32px;height:32px;border-radius:50%;background:var(--g);color:#fff;font-style:normal;font-weight:800;display:flex;align-items:center;justify-content:center}
.rc-steps b{display:block;margin-bottom:3px}
.rc-steps em{font-weight:500;color:var(--mut)}
.rc-steps span{font-size:.86rem;line-height:1.55;color:#4b6258}
.rc-example{background:#f4faf6;border-left:4px solid var(--g);border-radius:12px;padding:14px 16px;margin-bottom:16px}
.rc-example small{font-weight:900;letter-spacing:.14em;color:var(--g);font-size:.7rem}
.rc-example p{margin:6px 0 0;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.18rem;line-height:1.6;font-style:italic}
.rc-dodont{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.rc-dodont>div{border-radius:14px;padding:14px 16px;font-size:.88rem}
.rc-dodont ul{margin:8px 0 0;padding-left:18px;line-height:1.7}
.rc-dodont .do{background:#eaf6ef;color:#14503c}
.rc-dodont .dont{background:#fbf1e3;color:#7a4b12}
@media(max-width:700px){.rc-steps,.rc-dodont{grid-template-columns:1fr}}
.rc-modal-back{position:fixed;inset:0;z-index:10000;background:rgba(20,16,8,.55);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
.rc-modal{position:relative;background:#fffaf0;color:#2b2314;border-radius:20px;max-width:540px;width:100%;max-height:90vh;overflow:auto;padding:26px 24px;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.rc-modal h2{margin:6px 0 8px;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.7rem}
.rc-modal h3{margin:18px 0 6px;font-size:1rem}
.rc-prev{max-width:620px}
.rc-prev-hint{font-size:.88rem;color:#6b5d3a;margin:0 0 12px}
.rc-prev-imgs{display:grid;gap:12px;margin-bottom:14px}
.rc-prev-imgs img{width:100%;height:auto;border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.22)}
.rc-prev-warn{background:#fff1d6;border:1px solid #e0b25a;color:#6b4a0a;border-radius:10px;padding:10px 12px;font-size:.88rem;margin:0 0 12px}
.rc-prev-lbl{display:block;font-size:.8rem;font-weight:700;color:#8a6d2b;margin-bottom:6px}
#rc-prev-cap{width:100%;border:1px solid #e3d2a0;border-radius:12px;padding:10px 12px;font:inherit;font-size:.9rem;background:#fff;resize:vertical}
.rc-prev-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.rc-prev-btns .rc-btn{flex:1 1 150px}
.rc-modal-x{position:absolute;right:12px;top:12px;border:0;background:#f1e6cc;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:1rem}
.rc-info-list{margin:0;padding-left:20px;line-height:1.7;font-size:.92rem}
.rc-info-note{font-size:.84rem;opacity:.75;margin:10px 0 0}
.rc-info-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;align-items:center}
.rc-info-soon{font-size:.88rem;opacity:.7}
@page{size:A4 landscape;margin:10mm}
@media print{
  body.rc-printing *{visibility:hidden}
  body.rc-printing #rc-certificate,body.rc-printing #rc-certificate *{visibility:visible}
  body.rc-printing #rc-certificate{position:absolute;left:0;top:0;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

  /* ---- Alohida "Challenge va bot" tugmasi (Sozlamalar ichida) + oyna ---- */
  const infoHTML = () => `<div class="rc-modal-back" id="rc-info" onclick="if(event.target===this)rcInfoClose()">
    <div class="rc-modal" role="dialog" aria-modal="true" aria-label="Mutolaa challenge shartlari">
      <button type="button" class="rc-modal-x" onclick="rcInfoClose()" aria-label="Yopish">✕</button>
      <span class="rc-kicker">ILM YO‘LIDA | MUTOLAA</span>
      <h2>15 kunlik mutolaa challenge</h2>
      <p class="rc-lead">15 kun • 1 kitob • 0 so‘m. Har kuni kamida 5 sahifa o‘qiysiz va matnli yoki ovozli xulosa tayyorlaysiz. Jarimalar yo‘q — faqat odat.</p>
      <h3>Shartlar</h3>
      <ul class="rc-info-list">
        <li>Ishtirok <b>mutlaqo bepul</b>.</li>
        <li>Kuniga kamida <b>5 sahifa</b> o‘qing. Ovoz, Matn yoki Poster shaklini tanlab, o‘z so‘zingiz bilan xulosa tayyorlang.</li>
        <li>Hech qanday jarima yo‘q: o‘qimagan kuningiz hisobdan chiqarilmaydi.</li>
        <li>Eng faol ishtirokchilar kitob sovg‘alari bilan taqdirlanadi.</li>
        <li>Natijalar va yangiliklar <b>Telegram kanali</b>da e’lon qilinadi.</li>
      </ul>
      <h3>Maxsus guruhga qanday kiraman?</h3>
      <ol class="rc-info-list">
        <li>Quyidagi tugma orqali <b>botni</b> oching va <b>Start</b> bosing.</li>
        <li>Bot sizga <b>shaxsiy havola</b> beradi. Uni do‘stlaringizga yuboring.</li>
        <li><b>5 ta do‘st</b> shu havola orqali <b>Ilm Yo‘lida kanaliga</b> qo‘shilsa, bot sizga maxsus guruhning bir martalik havolasini yuboradi.</li>
      </ol>
      <p class="rc-info-note">Buning uchun saytga kirish kerak emas, hammasi Telegramning o‘zida.</p>
      <div class="rc-info-actions">
        <a class="rc-cta rc-bot" id="rc-info-bot" href="#" target="_blank" rel="noopener" hidden>🤖 Botga o‘tish</a>
        <span class="rc-info-soon" id="rc-info-soon" hidden>Bot tez orada ulanadi.</span>
        <a class="rc-cta" href="${TG}" target="_blank" rel="noopener">📣 Telegram kanal</a>
      </div>
    </div>
  </div>`;
  window.rcInfoOpen = () => {
    if (document.getElementById('rc-info')) return;
    document.body.insertAdjacentHTML('beforeend', infoHTML());
    const show = () => {
      const a = document.getElementById('rc-info-bot'), n = document.getElementById('rc-info-soon');
      if (botName) { if (a) { a.href = 'https://t.me/' + botName; a.hidden = false; } if (n) n.hidden = true; }
      else if (n) n.hidden = false;
    };
    if (botName !== undefined) { show(); return; }
    fetch('/api/telegram', { headers: { Accept: 'application/json' } }).then(r => r.json()).then(d => {
      botName = (d && typeof d.bot === 'string' && /^[A-Za-z0-9_]{4,64}$/.test(d.bot)) ? d.bot : null;
    }).catch(() => { botName = null; }).then(show);
  };
  window.rcInfoClose = () => { const m = document.getElementById('rc-info'); if (m) m.remove(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { window.rcInfoClose(); window.rcPreviewClose(); }
    const modal = document.querySelector('#rc-prev [role="dialog"]');
    if (modal && e.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button:not(:disabled), textarea, a[href], audio[controls]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  const baseSettings = window.settingsView;
  if (typeof baseSettings === 'function') {
    window.settingsView = function () {
      const html = baseSettings.apply(this, arguments);
      const card = `<div class="card"><h2>Mutolaa challenge va bot</h2><p class="sub" style="margin-bottom:10px">15 kunlik challenge shartlari va maxsus guruh uchun Telegram bot.</p><div class="settings-row"><button class="ghost" type="button" onclick="rcInfoOpen()">🤖 Shartlar va bot</button></div></div>`;
      return typeof html === 'string' ? html.replace(/<\/section>\s*$/, card + '</section>') : html;
    };
  }
  document.head.appendChild(style);
})();
