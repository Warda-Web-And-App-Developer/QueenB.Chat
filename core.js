/* QUEENBEE — core.js : shared state + helpers */
(function () {
  'use strict';
  const B = window.NovaBackend;
  const N = window.Nova = { B, U: B.util };
  N.S = { me: null, users: {}, chats: [], statuses: [], calls: [], activeId: null, msgs: [], tab: 'chats', q: '', inChatQ: '', unsubs: {} };
  const S = N.S;
  N.$ = (s, r = document) => r.querySelector(s);
  N.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  N.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  N.el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const { $, $$, esc, el } = N;

  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    dots: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    micoff: '<path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-.11 1.23M5 10v2a7 7 0 0 0 12 5"/><path d="M12 19v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    poll: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    forward: '<path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    play: '<path d="m6 3 14 9-14 9Z" fill="currentColor"/>',
    pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
    videooff: '<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><path d="m1 1 22 22"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    trash2: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eyeoff: '<path d="M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>'
  };
  ICONS.tick = '<path d="m4 12.5 5 5L20 6.5"/>';
  ICONS.ticks = '<path d="m1.5 12.5 5 5L16.5 6.5"/><path d="m10 16.5 1.5 1.5L22 6.5"/>';
  ICONS.ban = ICONS.ban || '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>';
  ICONS.unlock = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
  ICONS.key = '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 7l3 3M14 9l2 2"/>';
  ICONS.backspace = '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6M12 9l6 6"/>';
  ICONS.rec = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>';
  ICONS.speaker = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>';
  ICONS.gear = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  ICONS.bell = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>';
  ICONS.belloff = '<path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8a6 6 0 0 0-9.3-5M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M2 2l20 20"/>';
  ICONS.star = '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>';
  ICONS.clock = '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>';
  ICONS.thread = '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>';
  ICONS.code = '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>';
  ICONS.note = '<path d="M5 3h11l4 4v14H5z"/><path d="M15 3v5h5M8 12h9M8 16h6"/>';
  ICONS.calc = '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>';
  ICONS.globe = '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19"/>';
  ICONS.ghost = '<path d="M5 21V11a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>';
  ICONS.volume = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>';
  ICONS.moon2 = ICONS.moon;
  const PH = ICONS.phone;
  ICONS.phonein = '<polyline points="16 2 16 8 22 8"/><line x1="22" y1="2" x2="16" y2="8"/>' + PH;
  ICONS.phoneout = '<polyline points="22 8 22 2 16 2"/><line x1="16" y1="8" x2="22" y2="2"/>' + PH;
  ICONS.phonemiss = '<line x1="22" y1="2" x2="16" y2="8"/><line x1="16" y1="2" x2="22" y2="8"/>' + PH;
  ICONS.file = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>';
  ICONS.zap = '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>';
  ICONS.shield = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>';
  ICONS.arrow = '<path d="M5 12h14M13 6l6 6-6 6"/>';
  ICONS.ring = '<circle cx="12" cy="12" r="9.5" stroke-dasharray="4 3"/><path d="M12 8v8M8 12h8"/>';
  ICONS.sparkle = '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4"/>';
  N.ic = (name, cls = 'w-5 h-5') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

  N.toast = (msg, ms = 2800) => {
    const box = $('#toasts'); const t = el(`<div class="toast">${esc(msg)}</div>`); box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  };

  N.modal = function (inner, opts = {}) {
    const m = el(`<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-onyx/60 sm:p-4 fade-in"><div class="modal-box w-full ${opts.wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-auto rounded-t-3xl sm:rounded-3xl bg-[var(--panel)] text-[var(--text)] shadow-2xl pop-in"></div></div>`);
    const box = m.firstElementChild; box.append(typeof inner === 'string' ? el(inner) : inner);
    const close = () => { m.remove(); opts.onClose && opts.onClose(); };
    if (!opts.sticky) m.addEventListener('mousedown', e => { if (e.target === m) close(); });
    document.body.append(m);
    return { m, box, close };
  };
  N.ask = (title, text, ok = 'Confirm') => new Promise(res => {
    const md = N.modal(`<div class="p-6"><h3 class="text-lg font-bold mb-2">${esc(title)}</h3><p class="text-[var(--muted)] mb-5">${esc(text)}</p>
      <div class="flex gap-2 justify-end"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-royal" data-ok>${esc(ok)}</button></div></div>`, { onClose: () => res(false) });
    md.box.querySelector('[data-no]').onclick = () => md.close();
    md.box.querySelector('[data-ok]').onclick = () => { res(true); md.m.remove(); };
  });

  /* theme */
  N.themeIcon = () => N.ic(document.documentElement.classList.contains('dark') ? 'sun' : 'moon');
  N.setTheme = t => { document.documentElement.classList.toggle('dark', t === 'dark'); try { localStorage.setItem('nova_theme', t); } catch (e) { } $$('[data-theme-btn]').forEach(b => b.innerHTML = N.themeIcon()); };
  N.toggleTheme = () => N.setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');

  /* people */
  N.avatar = u => (u && u.photo) ? u.photo : B.util.avatarSVG(u && u.username || '?', u && u.uid);
  N.chatInfo = c => {
    if (c.type === 'group') return { name: c.name || 'Group', photo: c.photo || B.util.avatarSVG(c.name || 'G', c.id), group: true };
    const o = S.users[c.members.find(m => m !== S.me.uid)] || {};
    return { name: o.nickname || o.username || 'Unknown', photo: N.avatar(o), other: o };
  };
  N.timeStr = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  N.dayLabel = ts => {
    const d = new Date(ts), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
  };
  N.ago = ts => {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return N.dayLabel(ts);
  };
  N.presence = u => !u ? '' : (u.bot || (u.lastSeen && Date.now() - u.lastSeen < 70000)) ? 'online' : (u.lastSeen ? 'last seen ' + N.ago(u.lastSeen) : 'offline');
  /* ---- live activity, blocking, read receipts ---- */
  N.isBlocked = uid => !!(S.me && (S.me.blocked || []).includes(uid));
  N.blockedMe = u => !!(u && S.me && (u.blocked || []).includes(S.me.uid));
  const fresh = ts => ts && Date.now() - ts < 6000;
  N.activity = c => {   // → {kind:'typing'|'voice'|'calling', uid} | null  (what the other side is doing right now)
    if (!c || !S.me) return null;
    for (const uid of c.members) {
      if (uid === S.me.uid || N.isBlocked(uid) || N.blockedMe(S.users[uid])) continue;
      const a = c.act && c.act[uid]; if (a && fresh(a.ts) && !(c.lastMsg && c.lastMsg.from === uid && c.lastMsg.ts >= a.ts - 200)) return { kind: a.k, uid };
      const call = (S.calls || []).find(x => x.chatId === c.id && x.from === uid && x.status === 'ringing' && x.ts > Date.now() - 40000 && (x.to || []).includes(S.me.uid));
      if (call) return { kind: 'calling', uid };
    }
    return null;
  };
  const WORD = { typing: 'typing…', voice: 'voice messaging…', calling: 'calling…' };
  N.activityText = (c, withName) => {
    const a = N.activity(c); if (!a) return '';
    return (withName && c.type === 'group' ? ((S.users[a.uid] || {}).username || 'Someone') + ' is ' : '') + WORD[a.kind];
  };
  N.seen = (c, m) => {   // has every other member read this message?
    if (!c || m.hidden) return false;
    const others = c.members.filter(x => x !== m.from); if (!others.length) return false;
    return others.every(u => c.reads && c.reads[u] >= m.ts);
  };
  N.textOn = bg => /ffbf00/i.test(bg) ? '#353935' : '#FFFAFA';

  /* images */
  N.compressImage = (file, max = 1280, q = 0.78) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => { URL.revokeObjectURL(url); b ? res({ blob: b, w, h }) : rej(new Error('Could not process image')); }, 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a valid image')); };
    img.src = url;
  });
  N.avatarFromFile = (file, size = 160) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
      const s = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2;
      g.drawImage(img, sx, sy, s, s, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a valid image')); };
    img.src = url;
  });
  N.hydrate = root => $$('[data-media]', root).forEach(async n => {
    const u = await B.util.mediaURL(n.dataset.media); n.removeAttribute('data-media'); if (u) { if (n.tagName === 'A') n.href = u; else n.src = u; }
  });
  N.copy = async text => { try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (e2) { } t.remove(); } };
  N.share = async (title, text, url) => {
    if (navigator.share) { try { await navigator.share({ title, text, url }); return true; } catch (e) { if (e.name === 'AbortError') return true; } }
    await N.copy([text, url].filter(Boolean).join('\n')); N.toast('Copied to clipboard — paste it anywhere to share'); return false;
  };
  N.inviteLink = code => location.href.split('#')[0] + '#join=' + code;
  N.clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------- QueenB.Chat logo ---------- */
  let _lg = 0;
  N.logoMark = (cls = 'w-10 h-10') => `<svg class="${cls}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QueenB.Chat"><rect width="64" height="64" rx="18" fill="#353935"/><path d="M32 8.5 50.5 19v21.2L38.2 47.4 33 56l-4.800-8.600L13.500 40.200V19Z" fill="#C19552"/><path d="M32 8.5 50.5 19v21.2L38.2 47.4 33 56l-4.800-8.600L13.500 40.200V19Z" fill="none" stroke="#FFFAA0" stroke-width="1.400" stroke-linejoin="round" opacity=".55"/><ellipse cx="24.500" cy="25" rx="7" ry="4.200" fill="#FFFAFA" opacity=".92" transform="rotate(-28 24.500 25)"/><ellipse cx="39.500" cy="25" rx="7" ry="4.200" fill="#FFFAFA" opacity=".92" transform="rotate(28 39.500 25)"/><ellipse cx="32" cy="33" rx="7.200" ry="9.500" fill="#FFFAA0"/><path d="M25 31.200q7 2.600 14 0v2.800q-7 2.600-14 0ZM26.200 37q5.800 2.400 11.600 0l.6 2.600q-6.400 2.600-12.800 0Z" fill="#353935"/><path d="M25.500 22.500 27 17l2.600 3.400L32 15.500l2.400 4.900L37 17l1.500 5.500Z" fill="#353935"/><circle cx="27" cy="16.400" r="1.100" fill="#353935"/><circle cx="32" cy="14.700" r="1.100" fill="#353935"/><circle cx="37" cy="16.400" r="1.100" fill="#353935"/></svg>`;
  N.logo = (markCls = 'w-9 h-9', textCls = 'text-xl') => `<span class="inline-flex items-center gap-2.5">${N.logoMark(markCls)}<span class="${textCls} font-extrabold tracking-tight leading-none">QueenB<span class="font-medium text-gold">.Chat</span></span></span>`;
})();
