/* QUEENBEE — safety.js : block / unblock people + PIN-locked chats
   · Block: stored on YOUR user profile (field `blocked`). Messages a blocked person sends are never shown to you,
     their calls never ring, and they can no longer see your online / typing status.
   · PIN lock: the PIN is never stored in plain text — only a salted PBKDF2 hash, kept on THIS device
     (localStorage), so nobody else can read it from the database. A locked chat re-locks when you leave it,
     reload the page, or leave the tab for more than a minute. */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, $$, esc, el, ic, toast, modal, ask } = N;
  const kPin = () => 'nova_pin_' + S.me.uid, kLocks = () => 'nova_locks_' + S.me.uid;
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save — browser storage is blocked'); } };

  /* ------------------------------------------------------------ BLOCK */
  N.toggleBlock = async function (uid) {
    const u = S.users[uid] || {}, blk = N.isBlocked(uid);
    if (!blk && !(await ask('Block ' + (u.username || 'this user') + '?', 'They won’t be able to message or call you, and they won’t see when you are online. You can unblock them any time.', 'Block'))) return;
    try {
      await B.setBlock(S.me.uid, uid, !blk);
      const set = new Set(S.me.blocked || []); blk ? set.delete(uid) : set.add(uid); S.me = { ...S.me, blocked: [...set] };
      toast(blk ? (u.username || 'User') + ' unblocked' : (u.username || 'User') + ' blocked');
      N.renderHeader && N.renderHeader(); N.renderList && N.renderList();
    } catch (e) { toast(N.friendly(e)); }
  };
  N.blockedModal = function () {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Blocked users</h3><button class="icon-btn" data-x>${ic('x')}</button></div><div id="blList" class="max-h-[55dvh] overflow-y-auto -mx-2"></div></div>`);
    const draw = () => {
      const ids = (S.me.blocked || []).filter(id => S.users[id]);
      $('#blList', md.box).innerHTML = ids.map(id => { const u = S.users[id]; return `<div class="row"><img class="w-11 h-11 rounded-full object-cover" src="${esc(N.avatar(u))}"><div class="flex-1 font-semibold truncate">${esc(u.username)}</div><button class="btn btn-gold !py-1.5 !px-3 text-sm" data-ub="${esc(id)}">Unblock</button></div>`; }).join('')
        || `<div class="p-8 text-center text-[var(--muted)]"><div class="mx-auto w-14 h-14 rounded-full bg-[var(--panel2)] flex items-center justify-center mb-3">${ic('ban', 'w-7 h-7')}</div>You haven’t blocked anyone.</div>`;
    };
    draw(); $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', async e => { const b = e.target.closest('[data-ub]'); if (!b) return; await N.toggleBlock(b.dataset.ub); draw(); });
  };

  /* ------------------------------------------------------------ PIN */
  async function hash(pin, salt) {
    try {
      const enc = new TextEncoder(), key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
      return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { // very old / insecure-context browsers
      let h = 5381; const s = salt + ':' + pin; for (let i = 0; i < 60000; i++) h = ((h << 5) + h + s.charCodeAt(i % s.length)) | 0; return 'f' + h;
    }
  }
  let locksCache = null, cacheUid = null;
  const locks = () => { if (!S.me) return []; if (cacheUid !== S.me.uid || !locksCache) { cacheUid = S.me.uid; locksCache = get(kLocks(), []); } return locksCache; };
  const saveLocks = l => { locksCache = l; put(kLocks(), l); };
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith('nova_locks_')) { locksCache = null; N.renderList && S.me && N.renderList(); } });
  const unlocked = new Set(); let unlockedFor = null;
  N.hasPin = () => !!(S.me && get(kPin(), null));
  N.isLocked = id => locks().includes(id);
  N.isUnlocked = id => unlockedFor === (S.me && S.me.uid) && unlocked.has(id);
  N.relock = id => unlocked.delete(id);
  let fails = 0, until = 0;
  async function check(pin) {
    const rec = get(kPin(), null); if (!rec) return false;
    return (await hash(pin, rec.salt)) === rec.h;
  }

  /* small modal asking for a PIN (create = two fields) → resolves with the PIN or null */
  function pinDialog({ title, text, create }) {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      const inp = (id, ph) => `<input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" class="field text-center text-2xl tracking-[.5em] font-mono" placeholder="${ph}">`;
      const md = modal(`<form class="p-6 space-y-3"><div class="flex justify-center"><span class="lock-badge">${ic('lock', 'w-7 h-7')}</span></div>
        <h3 class="text-lg font-bold text-center">${esc(title)}</h3><p class="text-sm text-[var(--muted)] text-center">${esc(text || '')}</p>
        ${inp('pin1', '••••')}${create ? inp('pin2', 'repeat') : ''}
        <div id="pinErr" class="hidden text-sm rounded-xl px-3 py-2 bg-royal text-snow text-center"></div>
        <div class="flex gap-2"><button type="button" class="btn btn-ghost flex-1" data-no>Cancel</button><button class="btn btn-gold flex-1">${create ? 'Save PIN' : 'Continue'}</button></div></form>`, { onClose: () => fin(null), sticky: true });
      const err = t => { const b = $('#pinErr', md.box); b.textContent = t; b.classList.remove('hidden'); md.box.classList.remove('shake'); void md.box.offsetWidth; md.box.classList.add('shake'); };
      $$('input', md.box).forEach(i => i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); });
      $('[data-no]', md.box).onclick = md.close;
      md.box.querySelector('form').onsubmit = e => {
        e.preventDefault(); const a = $('#pin1', md.box).value;
        if (!/^\d{4,6}$/.test(a)) return err('PIN must be 4 to 6 digits.');
        if (create && a !== $('#pin2', md.box).value) return err('The two PINs don’t match.');
        done = true; md.m.remove(); res(a);
      };
      setTimeout(() => $('#pin1', md.box).focus(), 60);
    });
  }
  async function verifyDialog(title, text) {
    if (Date.now() < until) { toast('Too many wrong tries — wait ' + Math.ceil((until - Date.now()) / 1000) + 's'); return false; }
    const pin = await pinDialog({ title, text: text || 'Enter your chat PIN' }); if (pin == null) return false;
    if (await check(pin)) { fails = 0; return true; }
    if (++fails >= 5) { until = Date.now() + 30000; fails = 0; } toast('Wrong PIN'); return false;
  }

  N.setPinFlow = async function () {
    const pin = await pinDialog({ title: 'Create your chat PIN', text: 'Choose 4–6 digits. Only you will know it — there is no way to recover it, so remember it.', create: true });
    if (!pin) return false;
    const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    put(kPin(), { salt, h: await hash(pin, salt) }); toast('PIN saved on this device 🔑'); return true;
  };
  N.changePin = async function () { if (await verifyDialog('Change PIN', 'First enter your current PIN')) N.setPinFlow(); };
  N.toggleLock = async function (id) {
    const ids = locks();
    if (ids.includes(id)) {
      if (!(await verifyDialog('Remove chat lock', 'Enter your PIN to unlock this chat for good'))) return;
      saveLocks(ids.filter(x => x !== id)); unlocked.delete(id); toast('Chat lock removed'); N.renderList(); return;
    }
    if (!N.hasPin() && !(await N.setPinFlow())) return;
    saveLocks([...ids, id]); unlocked.delete(id);
    if (S.activeId === id) N.closeChat();
    N.renderList(); toast('Chat locked 🔒 — it needs your PIN to open');
  };

  /* full-pane lock screen with number pad */
  N.showLock = function (id) {
    const c = S.chats.find(x => x.id === id), info = c ? N.chatInfo(c) : { name: 'Chat', photo: '' }, p = $('#pane'); if (!p) return;
    let pin = '';
    p.innerHTML = `<div id="lockScreen" class="flex-1 flex flex-col bg-[var(--bg)] lock-in">
      <header class="flex items-center gap-1 px-2 sm:px-4 py-2.5 bg-[var(--panel)] border-b border-[var(--border)]"><button class="icon-btn md:hidden" id="lkBack">${ic('back')}</button><div class="font-extrabold px-2 truncate">${esc(info.name)}</div></header>
      <div class="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-6 text-center">
        <span class="lock-badge big">${ic('lock', 'w-9 h-9')}</span>
        <h2 class="text-xl font-extrabold mt-4">This chat is locked</h2><p id="lkMsg" class="text-sm text-[var(--muted)] mt-1">Enter your PIN to read messages</p>
        <div id="lkDots" class="flex gap-3 my-6">${'<i></i>'.repeat(6)}</div>
        <div id="lkPad" class="grid grid-cols-3 gap-3 w-[min(17rem,100%)]">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="pad-key" data-k="${n}">${n}</button>`).join('')}<button class="pad-key ghost" data-k="del" title="Delete">${ic('backspace', 'w-5 h-5')}</button><button class="pad-key" data-k="0">0</button><button class="pad-key go" data-k="go" title="Unlock">${ic('unlock', 'w-5 h-5')}</button></div>
        <button id="lkForgot" class="text-xs text-[var(--muted)] hover:underline mt-5">Forgot PIN?</button>
        <p id="lkHelp" class="hidden text-xs text-[var(--muted)] mt-2 max-w-xs">For your security there is no PIN reset — nobody, including us, can unlock it for you. Your messages are safe in your account; clearing this site’s data in your browser settings removes the lock on this device.</p>
      </div></div>`;
    const paint = () => { $$('#lkDots i', p).forEach((d, i) => d.classList.toggle('on', i < pin.length)); };
    const fail = m => { const d = $('#lkDots', p); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); $('#lkMsg', p).textContent = m; $('#lkMsg', p).classList.add('text-royal', 'dark:text-gold'); pin = ''; paint(); };
    async function submit() {
      if (pin.length < 4) return fail('PIN is 4–6 digits');
      if (Date.now() < until) return fail('Too many wrong tries — wait ' + Math.ceil((until - Date.now()) / 1000) + 's');
      const ok = await check(pin);
      if (!ok) { if (++fails >= 5) { until = Date.now() + 30000; fails = 0; return fail('Too many wrong tries — wait 30s'); } return fail('Wrong PIN — try again'); }
      fails = 0; unlockedFor = S.me.uid; unlocked.add(id); document.removeEventListener('keydown', onKey, true); N.openChat(id, true);
    }
    const press = k => {
      if (k === 'del') pin = pin.slice(0, -1); else if (k === 'go') return submit(); else if (pin.length < 6) pin += k;
      paint(); if (pin.length === 6) submit();
    };
    function onKey(e) {
      if (!$('#lockScreen')) return document.removeEventListener('keydown', onKey, true);
      if (document.querySelector('.fixed.z-50')) return;
      if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('go'); else return; e.preventDefault();
    }
    document.addEventListener('keydown', onKey, true);
    $('#lkPad', p).onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
    $('#lkBack', p).onclick = () => { document.removeEventListener('keydown', onKey, true); N.closeChat(); };
    $('#lkForgot', p).onclick = () => $('#lkHelp', p).classList.toggle('hidden');
    paint();
  };

  /* leave the tab for > 1 min while a locked chat is open → lock it again */
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 60000 && S.me && S.activeId && N.isLocked(S.activeId) && N.isUnlocked(S.activeId)) { N.closeChat(); toast('Locked chat closed for your privacy'); }
    hiddenAt = 0;
  });
})();
