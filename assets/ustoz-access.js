/* Ustozlar davrasi: parolsiz kirish, 1-podcast bepul, qolganlari bir martalik to'lovdan keyin ochiladi. */
(function () {
  'use strict';

  var CONFIG = {
    freeIds: ['Nc7Oe_oDC58'],
    price: '27 000 so‘m',
    card: '9860 1666 5394 5666',
    owner: 'A. Abdulbosit',
    telegram: 'abdulbasit_sk'
  };
  var KEY_DEVICE = 'ilm-yolida-device-id';
  var KEY_CODE = 'ilm-yolida-access-code';
  var KEY_INTRO = 'ilm-yolida-ustoz-intro-seen';

  var unlocked = false;
  var pendingId = '';

  function read(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* brauzer saqlashga ruxsat bermasa */ } }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function deviceId() {
    var id = read(KEY_DEVICE);
    if (id && /^[A-Za-z0-9-]{16,64}$/.test(id)) return id;
    if (window.crypto && crypto.randomUUID) id = crypto.randomUUID();
    else id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    write(KEY_DEVICE, id);
    return id;
  }

  function post(body) {
    return fetch('/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { status: response.status, data: data };
      });
    });
  }

  function isFree(id) { return CONFIG.freeIds.indexOf(id) !== -1; }
  function isLocked(id) { return !unlocked && !isFree(id); }

  /* ---------- Parolsiz kirish ---------- */
  window.hasUstozlarAccess = function () { return read(KEY_INTRO) === 'yes'; };
  window.enterUstozFromWelcome = function () {
    write(KEY_INTRO, 'yes');
    try { sessionStorage.setItem('ilm-yolida-ustozlar-access', 'yes'); } catch (e) { /* ignore */ }
    openUstozSection((window.state && state.ustozDestination) || 'podcasts');
  };

  /* Menyu va kartalar openProgram('ustoz') orqali ochadi: parol formasi o'rniga to'g'ridan-to'g'ri davraga kiramiz. */
  var originalOpenProgram = window.openProgram;
  window.openProgram = function (key, destination) {
    if (key === 'ustoz' && typeof window.openUstozlarDavrasi === 'function') {
      return window.openUstozlarDavrasi(destination || 'podcasts');
    }
    return originalOpenProgram.apply(this, arguments);
  };

  /* ---------- Podcastni tanlash: qulf ---------- */
  var originalSelect = window.selectPodcast;
  window.selectPodcast = function (id) {
    if (isLocked(id)) { showPaywall(id); return; }
    return originalSelect.apply(this, arguments);
  };

  /* ---------- Qulf belgilari ---------- */
  function decorate() {
    var buttons = document.querySelectorAll('button[onclick^="selectPodcast("]');
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var match = /selectPodcast\('([^']+)'\)/.exec(button.getAttribute('onclick') || '');
      if (!match) continue;
      var locked = isLocked(match[1]);
      button.classList.toggle('ia-locked', locked);
      var badge = button.querySelector(':scope > .ia-badge');
      if (locked && !badge) {
        badge = document.createElement('span');
        badge.className = 'ia-badge';
        badge.textContent = '🔒';
        badge.setAttribute('aria-label', 'Yopiq podcast');
        button.appendChild(badge);
      } else if (!locked && badge) {
        badge.remove();
      }
    }
  }
  var scheduled = false;
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || setTimeout)(function () { scheduled = false; decorate(); });
  }
  new MutationObserver(scheduleDecorate).observe(document.body, { childList: true, subtree: true });

  /* ---------- To'lov oynasi ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function closePaywall() {
    var open = document.getElementById('ia-paywall');
    if (open) open.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(event) { if (event.key === 'Escape') closePaywall(); }

  function showPaywall(id, reason) {
    pendingId = id || '';
    closePaywall();

    var overlay = el('div', 'ia-overlay');
    overlay.id = 'ia-paywall';
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closePaywall(); });

    var box = el('div', 'ia-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'ia-title');

    var close = el('button', 'ia-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Yopish');
    close.addEventListener('click', closePaywall);

    var forQuiz = reason === 'quiz';
    var title = el('h2', '', forQuiz ? 'Test yaratish pullik funksiya' : 'Bu podcast yopiq');
    title.id = 'ia-title';
    var lead = el('p', 'ia-lead');
    lead.appendChild(document.createTextNode(forQuiz ? 'Video matnini avtomatik yozish va u asosida 10 ta test yaratish faqat to‘lov qilganlar uchun. Hammasi ochilishi uchun ' : '1-podcast hamma uchun bepul. Qolgan podcastlarni ko‘rish, iqtibos va qayd yozish hamda test yechish uchun '));
    var price = el('b', '', 'bir martalik ' + CONFIG.price);
    lead.appendChild(price);
    lead.appendChild(document.createTextNode(' to‘lov qilasiz va hammasi doimiy ochiladi.'));

    var steps = el('ol', 'ia-steps');

    var s1 = el('li');
    s1.appendChild(el('span', '', CONFIG.price + ' ni quyidagi kartaga o‘tkazing:'));
    var cardRow = el('div', 'ia-card');
    cardRow.appendChild(el('code', '', CONFIG.card));
    var copy = el('button', 'ia-copy', 'Nusxalash');
    copy.type = 'button';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'Nusxalandi ✓'; setTimeout(function () { copy.textContent = 'Nusxalash'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CONFIG.card.replace(/ /g, '')).then(done, function () {});
      else done();
    });
    cardRow.appendChild(copy);
    s1.appendChild(cardRow);
    s1.appendChild(el('small', '', 'Karta egasi: ' + CONFIG.owner));
    steps.appendChild(s1);

    var s2 = el('li');
    s2.appendChild(document.createTextNode('To‘lov chekini Telegramda '));
    var link = el('a', '', '@' + CONFIG.telegram);
    link.href = 'https://t.me/' + CONFIG.telegram;
    link.target = '_blank';
    link.rel = 'noopener';
    s2.appendChild(link);
    s2.appendChild(document.createTextNode(' ga yuboring.'));
    steps.appendChild(s2);

    steps.appendChild(el('li', '', 'Sizga shaxsiy kirish kodi yuboriladi. Uni pastga kiriting.'));

    var form = el('form', 'ia-form');
    var input = el('input');
    input.type = 'text';
    input.placeholder = 'ILM-XXXXX-XXXXX';
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Kirish kodi');
    var submit = el('button', 'ia-submit', 'Ochish');
    submit.type = 'submit';
    form.appendChild(input);
    form.appendChild(submit);

    var status = el('p', 'ia-status');
    status.setAttribute('role', 'status');
    var note = el('p', 'ia-note', 'Kod faqat sizniki: u ko‘pi bilan 2 ta qurilmada (masalan telefon va kompyuter) ishlaydi.');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var code = input.value.trim();
      if (!code) { status.textContent = 'Kodni kiriting.'; return; }
      submit.disabled = true;
      status.textContent = 'Tekshirilmoqda…';
      redeem(code).then(function (result) {
        submit.disabled = false;
        if (result.ok && forQuiz) {
          status.style.color = '#0b6b52';
          status.textContent = 'Kod qabul qilindi ✓ Endi “Test yaratish” tugmasini qayta bosing.';
          input.disabled = true;
        } else if (result.ok) {
          closePaywall();
          if (pendingId && originalSelect) originalSelect(pendingId);
          else if (typeof render === 'function') render();
        } else {
          status.textContent = result.error;
        }
      });
    });

    box.appendChild(close);
    box.appendChild(title);
    box.appendChild(lead);
    box.appendChild(steps);
    box.appendChild(form);
    box.appendChild(status);
    box.appendChild(note);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ---------- Kodni tekshirish ---------- */
  function redeem(code) {
    return post({ action: 'redeem', code: code, deviceId: deviceId() }).then(function (res) {
      if (res.data && res.data.ok) {
        write(KEY_CODE, code.trim().toUpperCase());
        unlocked = true;
        scheduleDecorate();
        return { ok: true };
      }
      return { ok: false, error: (res.data && res.data.error) || 'Kodni tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.' };
    }, function () {
      return { ok: false, error: 'Internet bilan aloqa yo‘q. Aloqani tekshirib qayta urinib ko‘ring.' };
    });
  }

  function verifyStored() {
    var code = read(KEY_CODE);
    if (!code) return;
    unlocked = true; /* oflayn ham ishlashi uchun avval ochiq deb olamiz, so'ng serverdan tasdiqlaymiz */
    post({ action: 'check', code: code, deviceId: deviceId() }).then(function (res) {
      if (res.data && res.data.ok) return;
      if (res.status === 403 || res.status === 404) {
        unlocked = false;
        remove(KEY_CODE);
        scheduleDecorate();
        if (window.state && isLocked(state.active) && typeof render === 'function') {
          state.active = CONFIG.freeIds[0];
          render();
        }
      }
    }, function () { /* tarmoq xatosi: saqlangan holat qoladi */ });
  }

  /* ---------- Video-test so'rovlari: kodni qo'shish, 402 bo'lsa to'lov oynasi ---------- */
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/api\/quiz(\?|$)/.test(url)) {
          var next = Object.assign({}, init);
          var headers = new Headers(next.headers || {});
          var saved = read(KEY_CODE);
          if (saved) headers.set('x-access-code', saved);
          headers.set('x-device-id', deviceId());
          next.headers = headers;
          return nativeFetch(input, next).then(function (response) {
            if (response.status === 402) setTimeout(function () { showPaywall('', 'quiz'); }, 30);
            return response;
          });
        }
      } catch (e) { /* oddiy so'rovga qaytamiz */ }
      return nativeFetch(input, init);
    };
  }

  /* ---------- Uslub ---------- */
  var css = [
    '.ia-locked{position:relative}',
    '.ia-locked>*:not(.ia-badge){opacity:.62}',
    '.ia-badge{position:absolute;top:8px;right:10px;font-size:15px;line-height:1;pointer-events:none}',
    '.ia-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,24,20,.62);backdrop-filter:blur(3px)}',
    '.ia-box{position:relative;width:100%;max-width:460px;max-height:92vh;overflow:auto;border-radius:20px;background:#fffdf7;color:#17332b;padding:26px 24px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:inherit}',
    '.ia-box h2{margin:0 36px 10px 0;font-size:1.35rem;font-weight:800}',
    '.ia-lead{margin:0 0 14px;line-height:1.5;font-size:.95rem}',
    '.ia-close{position:absolute;top:12px;right:14px;width:34px;height:34px;border:0;border-radius:50%;background:#efe8d6;color:#17332b;font-size:22px;line-height:1;cursor:pointer}',
    '.ia-steps{margin:0 0 16px;padding-left:20px;display:grid;gap:12px;font-size:.93rem;line-height:1.45}',
    '.ia-steps small{display:block;margin-top:4px;color:#5c6f68}',
    '.ia-card{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}',
    '.ia-card code{padding:8px 10px;border-radius:10px;background:#f1ead8;font-size:1rem;font-weight:700;letter-spacing:.04em}',
    '.ia-copy{border:1px solid #17332b33;border-radius:10px;background:#fff;padding:7px 12px;font-weight:700;cursor:pointer;color:#17332b}',
    '.ia-steps a{color:#0b6b52;font-weight:800}',
    '.ia-form{display:flex;gap:8px}',
    '.ia-form input{flex:1;min-width:0;border:1px solid #17332b40;border-radius:12px;padding:12px;font-size:1rem;letter-spacing:.06em;text-transform:uppercase;background:#fff;color:#17332b}',
    '.ia-submit{border:0;border-radius:12px;padding:0 20px;background:#0b6b52;color:#fff;font-weight:800;cursor:pointer}',
    '.ia-submit:disabled{opacity:.6;cursor:wait}',
    '.ia-status{min-height:1.2em;margin:10px 0 0;font-size:.9rem;font-weight:700;color:#a3361f}',
    '.ia-note{margin:8px 0 0;font-size:.82rem;color:#5c6f68}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.__iaShowPaywall = showPaywall; /* sinash va qo'lda ochish uchun */
  verifyStored();
  scheduleDecorate();
})();
