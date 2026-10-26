/* QUEENBEE — extras.js : status stories (calls live in calls.js) */
(function () {
  'use strict';
  const N = window.Nova, { S, B, U, $, $$, esc, el, ic, toast, modal, ask } = N;

  /* ================================================================ STATUS (STORIES) */
  const hid = () => N.cfg.get('statusHide') || [], muted = () => N.cfg.get('statusMute') || [];
  const active = () => S.statuses.filter(s => s.ts > Date.now() - 864e5 && (s.uid === S.me.uid || (!(s.hideFrom || []).includes(S.me.uid) && !muted().includes(s.uid))));
  const addSt = d => B.addStatus(Object.assign({ hideFrom: hid().slice() }, d));
  const byUser = uid => active().filter(s => s.uid === uid).sort((a, b) => a.ts - b.ts);
  const unseen = uid => byUser(uid).some(s => !(s.views || []).includes(S.me.uid));
  N.statusOrder = function () {
    const contacts = new Set(); S.chats.forEach(c => c.members.forEach(m => { if (m !== S.me.uid) contacts.add(m); }));
    return [...contacts].filter(u => byUser(u).length && S.users[u]).sort((a, b) => (unseen(b) - unseen(a)) || (byUser(b).slice(-1)[0].ts - byUser(a).slice(-1)[0].ts));
  };
  function thumb(u, size = 'w-12 h-12') { return `<div class="story-ring ${unseen(u.uid) || u.uid === S.me.uid ? '' : 'seen'}"><img class="${size} rounded-full object-cover" src="${esc(N.avatar(u))}"></div>`; }

  /* ---- stories panel (small icon in the header) ---- */
  let panel = null;
  N.updateStoryDot = function () { const b = $('#storyBtn'); if (b && S.me) b.classList.toggle('has-dot', N.statusOrder().some(unseen)); };
  N.refreshStories = () => { if (panel) panel.draw(); };
  N.openStoriesPanel = function () {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold">Stories</h3><button class="icon-btn" data-x>${ic('x')}</button></div><div id="spBody"></div></div>`, { onClose: () => { panel = null; } });
    const draw = () => {
      const mine = byUser(S.me.uid), order = N.statusOrder();
      $('#spBody', md.box).innerHTML = `
        <button class="row !py-2 mb-2" data-privacy>${ic('eyeoff', 'w-5 h-5')}<div class="flex-1 text-left"><div class="font-semibold text-sm">Status privacy</div><div class="text-xs text-[var(--muted)]">${hid().length ? 'Hidden from ' + hid().length + ' ' + (hid().length === 1 ? 'person' : 'people') : 'Choose who can’t see your status'}${muted().length ? ' · ' + muted().length + ' muted' : ''}</div></div></button>
        <div class="grid grid-cols-3 gap-2 mb-4">
          <button class="story-add" data-new="text">${ic('type', 'w-6 h-6')}<span>Text</span></button>
          <button class="story-add" data-new="photo">${ic('image', 'w-6 h-6')}<span>Photo</span></button>
          <button class="story-add" data-new="video">${ic('video', 'w-6 h-6')}<span>Video</span></button></div>
        <button class="row" ${mine.length ? `data-story="${esc(S.me.uid)}"` : 'data-new="text"'}>
          ${mine.length ? thumb(S.me) : `<img class="w-12 h-12 rounded-full object-cover" src="${esc(N.avatar(S.me))}">`}
          <div class="flex-1 min-w-0 text-left"><div class="font-semibold">My status</div><div class="text-sm text-[var(--muted)]">${mine.length ? mine.length + ' update' + (mine.length > 1 ? 's' : '') + ' · ' + N.ago(mine[mine.length - 1].ts) : 'Tap a button above to add your first status'}</div></div>
          ${mine.length ? `<span class="text-xs text-[var(--muted)] flex items-center gap-1">${ic('eye', 'w-4 h-4')} ${mine.reduce((n, st) => n + (st.views || []).length, 0)}</span>` : ''}</button>
        ${order.length ? '<div class="px-1 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Recent updates</div>' + order.map(uid => { const u = S.users[uid], l = byUser(uid); return `<button class="row" data-story="${esc(uid)}">${thumb(u)}<div class="flex-1 min-w-0 text-left"><div class="font-semibold truncate">${esc(u.username)}</div><div class="text-sm text-[var(--muted)]">${N.ago(l[l.length - 1].ts)}${unseen(uid) ? ' · new' : ''}</div></div></button>`; }).join('') : '<div class="p-6 text-center text-sm text-[var(--muted)]">No recent updates from your contacts yet.</div>'}`;
    };
    md.box.addEventListener('click', e => {
      if (e.target.closest('[data-privacy]')) return N.statusPrivacy();
      const n = e.target.closest('[data-new]'); if (n) return N.createStatusModal(n.dataset.new);
      const st = e.target.closest('[data-story]'); if (st) N.openStatusViewer(st.dataset.story);
    });
    $('[data-x]', md.box).onclick = md.close;
    panel = { draw, close: md.close }; draw();
  };

  const BGS = [
    { bg: '#353935', fg: '#FFFAFA' }, { bg: '#FFFAA0', fg: '#FFFAFA' }, { bg: '#C19552', fg: '#353935' },
    { bg: 'linear-gradient(135deg,#353935,#FFFAA0)', fg: '#FFFAFA' }, { bg: 'linear-gradient(135deg,#C19552,#353935)', fg: '#FFFAFA' }, { bg: 'linear-gradient(160deg,#FFFAA0,#C19552)', fg: '#353935' }
  ];
  N.createStatusModal = function (start) {
    let kind = (start === 'photo' || start === 'video') ? 'media' : 'text';
    const accept = start === 'photo' ? 'image/*' : start === 'video' ? 'video/*' : 'image/*,video/*';
    let bgi = 3, wall = null, wallPrev = '', text = '', file = null, prev = '', caption = '';
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">New status</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="flex gap-2 mb-3"><button class="btn flex-1 !py-2" data-k="text">${ic('type', 'w-4 h-4')} Text</button><button class="btn flex-1 !py-2" data-k="media">${ic('image', 'w-4 h-4')} Photo / Video</button></div>
      <div id="stBody"></div><button id="stPost" class="btn btn-gold w-full mt-3">Post status</button><p class="text-xs text-[var(--muted)] text-center mt-2">Disappears after 24 hours</p></div>`);
    const draw = () => {
      $$('[data-k]', md.box).forEach(b => { const on = b.dataset.k === kind; b.classList.toggle('btn-royal', on); b.classList.toggle('btn-ghost', !on); });
      const body = $('#stBody', md.box);
      if (kind === 'text') {
        const cur = BGS[bgi], style = wallPrev ? `background:#353935 url(${wallPrev}) center/cover` : `background:${cur.bg}`, fg = wallPrev ? '#FFFAFA' : cur.fg;
        body.innerHTML = `<div class="relative rounded-2xl h-60 flex items-center justify-center p-4 overflow-hidden" style="${style}">${wallPrev ? '<div class="absolute inset-0 bg-onyx/35"></div>' : ''}<textarea id="stText" rows="3" maxlength="220" class="relative w-full bg-transparent text-center text-2xl font-bold outline-none resize-none" style="color:${fg};field-sizing:content;max-height:100%" placeholder="Type a status">${esc(text)}</textarea></div>
          <div class="flex items-center justify-center gap-2 mt-3 flex-wrap">${BGS.map((b, i) => `<button data-bgi="${i}" class="w-9 h-9 rounded-full border-4 ${!wallPrev && i === bgi ? 'border-[var(--text)]' : 'border-transparent'}" style="background:${b.bg}"></button>`).join('')}
            <label class="w-9 h-9 rounded-full border-4 ${wallPrev ? 'border-[var(--text)]' : 'border-transparent'} bg-[var(--panel2)] flex items-center justify-center cursor-pointer" title="Use a photo as wallpaper">${ic('image', 'w-4 h-4')}<input id="stWall" type="file" accept="image/*" class="hidden"></label></div>
          <p class="text-xs text-center text-[var(--muted)] mt-2">Pick a colour, a gradient, or use your own photo as the wallpaper</p>`;
        $('#stText', md.box).oninput = e => text = e.target.value;
        $('#stWall', md.box).onchange = e => { const f = e.target.files[0]; if (!f) return; if (!f.type.startsWith('image/')) return toast('Please choose an image'); if (wallPrev) URL.revokeObjectURL(wallPrev); wall = f; wallPrev = URL.createObjectURL(f); draw(); };
      } else {
        body.innerHTML = `<label class="block rounded-2xl border-2 border-dashed border-[var(--border)] min-h-[14rem] flex items-center justify-center cursor-pointer overflow-hidden bg-[var(--input)]">
          ${prev ? (file.type.startsWith('video') ? `<video src="${prev}" class="max-h-64 w-full" controls muted playsinline></video>` : `<img src="${prev}" class="max-h-64 w-full object-contain">`) : `<div class="text-center text-[var(--muted)]">${ic('image', 'w-10 h-10 mx-auto mb-2')}Choose a ${start === 'photo' ? 'photo' : start === 'video' ? 'video' : 'photo or video'}</div>`}
          <input id="stFile" type="file" accept="${accept}" class="hidden"></label><input id="stCap" class="field mt-3" placeholder="Add a caption (optional)" value="${esc(caption)}" maxlength="120">`;
        $('#stFile', md.box).onchange = e => { const f = e.target.files[0]; if (!f) return; if (prev) URL.revokeObjectURL(prev); file = f; prev = URL.createObjectURL(f); draw(); };
        $('#stCap', md.box).oninput = e => caption = e.target.value;
      }
    };
    md.box.addEventListener('click', e => { const k = e.target.closest('[data-k]'); if (k) { kind = k.dataset.k; draw(); } const c = e.target.closest('[data-bgi]'); if (c) { bgi = +c.dataset.bgi; wall = null; if (wallPrev) URL.revokeObjectURL(wallPrev); wallPrev = ''; draw(); } });
    $('[data-x]', md.box).onclick = md.close; draw();
    $('#stPost', md.box).onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; const old = btn.textContent; btn.textContent = 'Posting…';
      try {
        if (kind === 'text') {
          if (!text.trim()) throw new Error('Type something first');
          const cur = BGS[bgi], doc = { uid: S.me.uid, type: 'text', content: text.trim(), bg: cur.bg, fg: cur.fg };
          if (wall) { const c = await N.compressImage(wall, 1080, .7); doc.bgImage = await B.uploadMedia(c.blob); doc.fg = '#FFFAFA'; }
          await addSt(doc);
        } else {
          if (!file) throw new Error('Choose a photo or video first');
          if (file.type.startsWith('video')) {
            const max = B.maxUpload || 10 * 1048576; if (file.size > max) throw new Error(`Video is too large (max ${Math.round(max / 1048576)} MB)`);
            await addSt({ uid: S.me.uid, type: 'video', content: await B.uploadMedia(file), caption: caption.trim() });
          } else { const c = await N.compressImage(file, 1080, .72); await addSt({ uid: S.me.uid, type: 'image', content: await B.uploadMedia(c.blob), caption: caption.trim() }); }
        }
        md.close(); toast('Status posted'); N.updateStoryDot(); if (panel) panel.draw();
      } catch (er) { toast(N.friendly(er), 4500); btn.disabled = false; btn.textContent = old; }
    };
  };

  N.openStatusViewer = function (uid) {
    const order = N.statusOrder(); const queue = uid === S.me.uid ? [uid] : order.slice(Math.max(0, order.indexOf(uid)));
    if (!queue.length || !byUser(queue[0]).length) return;
    let ui = 0, si = 0, list = [], elapsed = 0, dur = 5000, paused = false, raf = 0, last = 0, vid = null, held = false, downT = 0, modalOpen = false;
    const ov = el(`<div class="fixed inset-0 z-[95] bg-onyx flex items-center justify-center fade-in"><div id="svBox" class="relative w-full h-full sm:max-w-md sm:h-[96dvh] sm:rounded-2xl overflow-hidden bg-onyx select-none">
      <div id="svBars" class="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2 pt-[max(.5rem,env(safe-area-inset-top))]"></div>
      <div class="absolute top-4 left-0 right-0 z-10 flex items-center gap-2 px-3 pt-[env(safe-area-inset-top)] mt-3 text-snow"><img id="svAv" class="w-10 h-10 rounded-full object-cover"><div class="flex-1 min-w-0"><div id="svName" class="font-bold truncate"></div><div id="svTime" class="text-xs opacity-80"></div></div><button id="svDel" class="icon-btn hidden">${ic('trash')}</button><button id="svX" class="icon-btn">${ic('x')}</button></div>
      <div id="svContent" class="absolute inset-0"></div>
      <div id="svFoot" class="absolute bottom-0 left-0 right-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-snow bg-gradient-to-t from-black/70 to-transparent"></div></div></div>`);
    document.body.append(ov);
    const close = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); if (vid) { vid.pause(); vid = null; } ov.remove(); N.renderList(); N.updateStoryDot(); if (panel) panel.draw(); };
    function loadUser(startAtEnd) {
      list = byUser(queue[ui]); if (!list.length) return advanceUser();
      si = startAtEnd ? list.length - 1 : (queue[ui] === S.me.uid ? 0 : Math.max(0, list.findIndex(s => !(s.views || []).includes(S.me.uid)))); show();
    }
    function advanceUser() { ui++; if (ui >= queue.length) return close(); loadUser(); }
    function next() { if (si < list.length - 1) { si++; show(); } else advanceUser(); }
    function prev() { if (si > 0) { si--; show(); } else if (ui > 0) { ui--; loadUser(true); } else show(); }
    function show() {
      const s = list[si], u = S.users[s.uid] || S.me, own = s.uid === S.me.uid; elapsed = 0; dur = 5000; vid = null;
      $('#svAv', ov).src = N.avatar(u); $('#svName', ov).textContent = own ? 'My status' : u.username; $('#svTime', ov).textContent = N.ago(s.ts);
      $('#svDel', ov).classList.toggle('hidden', !own);
      $('#svBars', ov).innerHTML = list.map((_, i) => `<div class="flex-1 h-1 rounded bg-snow/30 overflow-hidden"><div class="h-full bg-gold" style="width:${i < si ? 100 : 0}%"></div></div>`).join('');
      const c = $('#svContent', ov);
      if (s.type === 'text') { c.innerHTML = `<div class="relative w-full h-full flex items-center justify-center p-8 text-center" style="background:${s.bg || '#353935'}">${s.bgImage ? '<img class="absolute inset-0 w-full h-full object-cover" data-media="' + esc(s.bgImage) + '"><div class="absolute inset-0 bg-onyx/40"></div>' : ''}<div class="relative text-3xl font-bold whitespace-pre-wrap break-words" style="color:${s.fg || N.textOn(s.bg || '#353935')};${s.bgImage ? 'text-shadow:0 2px 12px #000a' : ''}">${esc(s.content)}</div></div>`; N.hydrate(c); }
      else if (s.type === 'image') { c.innerHTML = '<img class="w-full h-full object-contain" data-media="' + esc(s.content) + '">'; N.hydrate(c); }
      else { c.innerHTML = '<video class="w-full h-full object-contain" playsinline autoplay></video>'; vid = c.firstChild; U.mediaURL(s.content).then(url => { vid.src = url; vid.play().catch(() => { vid.muted = true; vid.play().catch(() => { }); }); }); }
      $('#svFoot', ov).innerHTML = (s.caption ? `<div class="mb-2 text-base">${esc(s.caption)}</div>` : '') + (own ? `<button id="svViews" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-snow/20 text-sm">${ic('eye', 'w-4 h-4')} ${(s.views || []).length} view${(s.views || []).length === 1 ? '' : 's'}</button>` : '');
      if (!own) B.viewStatus(s.id, S.me.uid).catch(() => { });
      last = performance.now();
    }
    function tick(t) {
      const dt = t - last; last = t; const s = list[si];
      if (s && !paused && !held && !modalOpen) {
        if (vid && vid.duration && isFinite(vid.duration)) { dur = Math.min(vid.duration, 60) * 1000; elapsed = vid.currentTime * 1000; if (vid.ended) elapsed = dur; } else if (!vid) elapsed += dt;
        const bar = $('#svBars', ov).children[si]; if (bar) bar.firstElementChild.style.width = Math.min(100, elapsed / dur * 100) + '%';
        if (elapsed >= dur) next();
      }
      raf = requestAnimationFrame(tick);
    }
    const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); };
    document.addEventListener('keydown', onKey);
    $('#svX', ov).onclick = close;
    $('#svDel', ov).onclick = async () => { modalOpen = true; const ok = await ask('Delete status?', 'This status will be removed for everyone.', 'Delete'); modalOpen = false; if (!ok) return; await B.deleteStatus(list[si].id); list.splice(si, 1); if (!list.length) close(); else { if (si >= list.length) si = list.length - 1; show(); } };
    const box = $('#svBox', ov);
    box.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; downT = Date.now(); held = true; if (vid) vid.pause(); });
    box.addEventListener('pointerup', e => {
      if (e.target.closest('button')) return; const quick = Date.now() - downT < 250; held = false; if (vid) vid.play().catch(() => { });
      if (quick) { const r = box.getBoundingClientRect(); (e.clientX - r.left) < r.width / 3 ? prev() : next(); }
    });
    box.addEventListener('pointerleave', () => { if (held) { held = false; if (vid) vid.play().catch(() => { }); } });
    ov.addEventListener('click', e => {
      if (e.target.closest('#svViews')) {
        const s = list[si]; modalOpen = true; if (vid) vid.pause();
        const viewers = (s.views || []).map(v => S.users[v]).filter(Boolean);
        const m = modal(`<div class="p-5"><div class="flex items-center justify-between mb-2"><h3 class="font-bold text-lg">Viewed by ${viewers.length}</h3><button class="icon-btn" data-x>${ic('x')}</button></div>${viewers.map(v => `<div class="flex items-center gap-3 py-2"><img class="w-10 h-10 rounded-full object-cover" src="${esc(N.avatar(v))}"><span class="font-semibold">${esc(v.username)}</span></div>`).join('') || '<div class="py-4 text-center text-[var(--muted)]">No views yet</div>'}</div>`, { onClose: () => { modalOpen = false; if (vid) vid.play().catch(() => { }); } });
        m.m.style.zIndex = 120; $('[data-x]', m.box).onclick = m.close;
      }
    });
    loadUser(); raf = requestAnimationFrame(tick);
  };

  /* ---- status privacy: hide my status from chosen people / don't show someone's status to me ---- */
  N.statusPrivacy = function () {
    let tab = 'hide'; const people = () => Object.values(S.users).filter(u => u.uid !== S.me.uid && !u.bot && u.username).sort((a, b) => a.username.localeCompare(b.username));
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Status privacy</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="seg-nav mb-3"><button class="tab active" data-t="hide">Hide my status from</button><button class="tab" data-t="mute">Don’t show me status of</button></div>
      <p id="spHint" class="text-xs text-[var(--muted)] mb-2"></p><input id="spQ" class="field mb-2 !py-2 text-sm" placeholder="Search people…"><div id="spList" class="max-h-[46dvh] overflow-y-auto -mx-2"></div></div>`);
    const key = () => tab === 'hide' ? 'statusHide' : 'statusMute';
    const draw = () => {
      const q = $('#spQ', md.box).value.trim().toLowerCase(), cur = N.cfg.get(key()) || [];
      $$('[data-t]', md.box).forEach(b => b.classList.toggle('active', b.dataset.t === tab));
      $('#spHint', md.box).textContent = tab === 'hide' ? 'People you tick can’t see any of your statuses. You can change this any time.' : 'Statuses from people you tick won’t appear in your Stories.';
      $('#spList', md.box).innerHTML = people().filter(u => !q || u.username.toLowerCase().includes(q)).map(u => `<label class="row cursor-pointer"><img class="w-10 h-10 rounded-full object-cover" src="${esc(N.avatar(u))}"><span class="flex-1 font-semibold truncate">${esc(u.nickname || u.username)}</span><input type="checkbox" data-u="${esc(u.uid)}" class="w-5 h-5 accent-[#C19552]" ${cur.includes(u.uid) ? 'checked' : ''}></label>`).join('') || '<div class="p-6 text-center text-[var(--muted)]">No people yet</div>';
    };
    md.box.addEventListener('change', async e => {
      const c = e.target.closest('[data-u]'); if (!c) return; const set = new Set(N.cfg.get(key()) || []); c.checked ? set.add(c.dataset.u) : set.delete(c.dataset.u); N.cfg.set(key(), [...set]);
      if (tab === 'hide') { const mine = S.statuses.filter(s => s.uid === S.me.uid && s.ts > Date.now() - 864e5); mine.forEach(s => B.updateStatus && B.updateStatus(s.id, { hideFrom: [...set] }).catch(() => { })); }
      N.updateStoryDot(); N.refreshStories();
    });
    md.box.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(); } });
    $('#spQ', md.box).oninput = draw; $('[data-x]', md.box).onclick = md.close; draw(); if (N.i18nApply) N.i18nApply(md.box);
  };
})();
