/* ============================================================================
   QUEENBEE — backend.js
   One API, two engines:  Firebase (Auth + Firestore [+ Storage])  or  Demo mode
   (localStorage + IndexedDB, synced live between browser tabs, with bot contacts).
   ========================================================================== */
(function () {
  'use strict';
  const PAL = ['#353935', '#C19552', '#FFFAA0'];
  const rid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const hash = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const clone = o => JSON.parse(JSON.stringify(o));

  function avatarSVG(name, seed) {
    const i = hash(seed || name) % 3, bg = PAL[i], fg = i === 0 ? '#FFFAFA' : '#353935';
    const t = String(name || '?').trim().slice(0, 2).toUpperCase().replace(/[&<>"']/g, '');
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="40" fill="${fg}">${t}</text></svg>`);
  }

  const previewOf = m => m.deleted ? '🚫 This message was deleted'
    : m.type === 'image' ? '📷 ' + (m.text || 'Photo')
    : m.type === 'voice' ? '🎤 Voice message'
    : m.type === 'video' ? '🎬 ' + (m.text || 'Video')
    : m.type === 'file' ? '📎 ' + (m.name || 'Document')
    : m.type === 'poll' ? '📊 ' + m.poll.q
    : m.type === 'note' ? '📝 ' + ((m.note && m.note.title) || 'Note')
    : m.type === 'sticker' ? '🎭 Sticker'
    : m.type === 'gif' ? '🎞️ GIF'
    : m.type === 'code' ? '💻 Code snippet'
    : m.type === 'expense' ? '💸 ' + ((m.expense && m.expense.title) || 'Expense split')
    : (m.threadOf ? '↳ ' : '') + (m.text || '');

  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  /* ---------- IndexedDB blob store (demo mode media) ---------- */
  const IDB = {
    db: null,
    open() {
      return this.db || (this.db = new Promise((res, rej) => {
        const r = indexedDB.open('nova_media', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('m');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      }));
    },
    async put(k, b) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction('m', 'readwrite'); t.objectStore('m').put(b, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
    async get(k) { const d = await this.open(); return new Promise((res, rej) => { const q = d.transaction('m').objectStore('m').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  };
  const urlCache = new Map();
  let chunkLoader = async () => '';
  async function mediaURL(u) {
    if (!u) return '';
    const s = String(u);
    if (!s.startsWith('idb:') && !s.startsWith('fs:')) return u;
    if (urlCache.has(u)) return urlCache.get(u);
    let url = '';
    try {
      if (s.startsWith('idb:')) { const bl = await IDB.get(s.slice(4)); if (bl) url = URL.createObjectURL(bl); }
      else url = await chunkLoader(s.slice(3));
    } catch (e) { console.warn('media load failed', e); }
    if (url) urlCache.set(u, url);
    return url;
  }

  /* ======================= DEMO ENGINE ======================= */
  const LS = 'nova_demo_v3';
  function fresh() { return { users: {}, creds: {}, chats: {}, msgs: {}, statuses: {}, calls: {} }; }
  function load() { try { return JSON.parse(localStorage.getItem(LS)) || fresh(); } catch (e) { return fresh(); } }
  let D = load();
  const subs = new Set();
  function emit() { subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  function save() {
    const cut = Date.now() - 30 * 864e5;
    Object.keys(D.calls).forEach(k => { if (D.calls[k].ts < cut) delete D.calls[k]; });
    try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { console.warn('Demo storage full', e); }
    emit();
  }
  window.addEventListener('storage', e => { if (e.key === LS) { D = load(); emit(); } });
  function sub(fn) { subs.add(fn); fn(); return () => subs.delete(fn); }
  const sess = { get: () => sessionStorage.getItem('nova_uid'), set: v => v ? sessionStorage.setItem('nova_uid', v) : sessionStorage.removeItem('nova_uid') };

  function push(chatId, m) {
    m.id = m.id || rid(); m.ts = m.ts || Date.now();
    (D.msgs[chatId] = D.msgs[chatId] || []).push(m);
    const c = D.chats[chatId];
    if (c && c.type === 'dm' && m.type !== 'system') { const o = c.members.find(x => x !== m.from); if (o && D.users[o] && (D.users[o].blocked || []).includes(m.from)) m.hidden = true; }
    if (c && c.disappear && m.type !== 'system' && !m.exp) m.exp = m.ts + c.disappear * 1000;
    if (c && m.type !== 'system' && !m.hidden) {
      c.lastMsg = { id: m.id, text: previewOf(m), ts: m.ts, from: m.from };
      c.cnt = c.cnt || {}; c.members.forEach(u => { if (u !== m.from) c.cnt[u] = (c.cnt[u] || 0) + 1; });
    }
    if (c && c.act && c.act[m.from]) delete c.act[m.from];
    return m;
  }
  function uniqueName(base) {
    base = String(base || 'user').replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 16) || 'user';
    let n = base, i = 1; const taken = x => Object.values(D.users).some(u => u.usernameLower === x.toLowerCase());
    while (taken(n)) n = base + (++i); return n;
  }
  const Demo = {
    mode: 'demo', maxUpload: 200 * 1024 * 1024, _cb: () => { },
    onAuth(cb) { Demo._cb = cb; const u = sess.get(); setTimeout(() => cb(u && D.users[u] ? D.users[u] : null), 30); },
    async usernameTaken(name, except) { return Object.values(D.users).some(u => u.usernameLower === name.toLowerCase() && u.uid !== except); },
    async signUp({ email, password, username, nickname, photo }) {
      email = email.trim().toLowerCase();
      if (D.creds[email]) throw new Error('That email is already registered. Try logging in.');
      if (await Demo.usernameTaken(username)) throw new Error('That username is already taken.');
      const uid = 'u_' + rid();
      D.creds[email] = { pass: password, uid };
      const u = D.users[uid] = { uid, email, username, nickname: nickname || '', usernameLower: username.toLowerCase(), photo: photo || '', profileDone: true, createdAt: Date.now(), lastSeen: Date.now() };
      save(); sess.set(uid); Demo._cb(u); return u;
    },
    async login(email, password) {
      email = email.trim().toLowerCase(); const c = D.creds[email];
      if (!c || c.pass !== password) throw new Error('Wrong email or password.');
      sess.set(c.uid); Demo._cb(D.users[c.uid]); return D.users[c.uid];
    },
    async google(email, name, photo) {
      email = (email || 'demo.google@gmail.com').trim().toLowerCase();
      let u = Object.values(D.users).find(x => x.email === email);
      if (!u) {
        const uid = 'u_' + rid();
        u = D.users[uid] = { uid, email, username: uniqueName(name || email.split('@')[0]), usernameLower: '', photo: photo || '', profileDone: false, createdAt: Date.now(), lastSeen: Date.now() };
        u.usernameLower = u.username.toLowerCase(); save();
      }
      sess.set(u.uid); Demo._cb(u); return u;
    },
    async logout() { sess.set(null); Demo._cb(null); },
    async updateProfile(uid, patch) { Object.assign(D.users[uid], patch); save(); },
    async touch(uid) { if (D.users[uid]) { D.users[uid].lastSeen = Date.now(); try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { } } },
    watchUsers(cb) { return sub(() => cb(Object.values(D.users))); },
    watchChats(uid, cb) { return sub(() => cb(Object.values(D.chats).filter(c => c.members.includes(uid)))); },
    async ensureDM(me, other) {
      const id = [me, other].sort().join('_');
      if (!D.chats[id]) { D.chats[id] = { id, type: 'dm', members: [me, other], createdAt: Date.now(), lastMsg: null }; D.msgs[id] = []; save(); }
      return id;
    },
    async createGroup(me, { name, photo, members }) {
      const id = 'g_' + rid(), set = Array.from(new Set([me, ...members]));
      const c = D.chats[id] = { id, type: 'group', name, photo: photo || '', members: set, admins: [me], createdBy: me, invite: Math.random().toString(36).slice(2, 12), createdAt: Date.now(), lastMsg: null };
      D.msgs[id] = []; push(id, { from: me, type: 'system', text: `${D.users[me].username} created the group “${name}”` }); save(); return c;
    },
    async findByInvite(code) { return Object.values(D.chats).find(c => c.type === 'group' && c.invite === code) || null; },
    async joinByCode(me, code) {
      const c = await Demo.findByInvite(code); if (!c) throw new Error('Invite link is invalid or expired.');
      if (!c.members.includes(me)) { c.members.push(me); push(c.id, { from: me, type: 'system', text: `${D.users[me].username} joined via invite link` }); save(); }
      return c;
    },
    async regenInvite(chatId) { const c = D.chats[chatId]; c.invite = Math.random().toString(36).slice(2, 12); save(); return c.invite; },
    async renameGroup(chatId, name) { D.chats[chatId].name = name; save(); },
    async leaveGroup(chatId, uid) {
      const c = D.chats[chatId]; if (!c) return; c.members = c.members.filter(m => m !== uid);
      push(chatId, { from: uid, type: 'system', text: `${D.users[uid].username} left` });
      if (!c.members.length) { delete D.chats[chatId]; delete D.msgs[chatId]; } save();
    },
    async setBlock(me, other, val) { const u = D.users[me]; const b = new Set(u.blocked || []); val ? b.add(other) : b.delete(other); u.blocked = [...b]; save(); },
    async markRead(chatId, uid, ghost) { const c = D.chats[chatId]; if (!c) return; if (!ghost) { c.reads = c.reads || {}; c.reads[uid] = Date.now(); } c.cnt = c.cnt || {}; c.cnt[uid] = 0; try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { } emit(); },
    async setActivity(chatId, uid, kind) { const c = D.chats[chatId]; if (!c) return; c.act = c.act || {}; if (kind) c.act[uid] = { k: kind, ts: Date.now() }; else delete c.act[uid]; try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { } },
    async updateMessage(chatId, mid, patch) { const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (m) { Object.assign(m, patch); save(); } },
    async purgeMessages(chatId, ids) { const l = D.msgs[chatId]; if (l) { D.msgs[chatId] = l.filter(m => !ids.includes(m.id)); save(); } },
    async updateChat(chatId, patch) { const c = D.chats[chatId]; if (c) { Object.assign(c, patch); save(); } },
    async signal(callId, sg) { const c = D.calls[callId]; if (!c) return; (c.sig = c.sig || []).push({ id: rid(), ts: Date.now(), ...sg }); if (c.sig.length > 400) c.sig.splice(0, 100); try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { } },
    async setCallRec(callId, uid, data) { const c = D.calls[callId]; if (!c) return; c.recs = c.recs || {}; c.recs[uid] = data; save(); },
    async joinCall(callId, uid) { const c = D.calls[callId]; if (!c) return; c.joined = Array.from(new Set([...(c.joined || [c.from]), uid])); c.status = 'active'; c.answeredAt = c.answeredAt || Date.now(); save(); },
    watchMessages(chatId, cb) { return sub(() => cb((D.msgs[chatId] || []).slice())); },
    async sendMessage(chatId, m) { const msg = push(chatId, m); save(); return msg; },
    async deleteForMe(chatId, mid, uid) { const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (m) { m.deletedFor = [...(m.deletedFor || []), uid]; save(); } },
    async deleteForAll(chatId, mid) {
      const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (!m) return;
      Object.assign(m, { deleted: true, type: 'text', text: '', images: null, media: null, wave: null, poll: null, reactions: null, name: null, mime: null, pinned: false });
      const c = D.chats[chatId]; if (c && c.lastMsg && c.lastMsg.id === mid) c.lastMsg.text = previewOf(m); save();
    },
    async togglePin(chatId, mid, val) { const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (m) { m.pinned = val; save(); } },
    async react(chatId, mid, uid, emoji) {
      const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (!m || m.deleted) return;
      const r = m.reactions || {}, had = (r[emoji] || []).includes(uid);
      Object.keys(r).forEach(k => { r[k] = r[k].filter(x => x !== uid); if (!r[k].length) delete r[k]; });
      if (!had) r[emoji] = [...(r[emoji] || []), uid];
      m.reactions = r; save();
    },
    async votePoll(chatId, mid, uid, optId) {
      const m = (D.msgs[chatId] || []).find(x => x.id === mid); if (!m || !m.poll) return;
      m.poll.options.forEach(o => {
        if (o.id === optId) o.votes = o.votes.includes(uid) ? o.votes.filter(v => v !== uid) : [...o.votes, uid];
        else if (!m.poll.multi) o.votes = o.votes.filter(v => v !== uid);
      }); save();
    },
    async uploadMedia(blob) { const id = rid(); await IDB.put(id, blob); return 'idb:' + id; },
    watchStatuses(cb) { return sub(() => cb(Object.values(D.statuses).filter(s => s.ts > Date.now() - 864e5))); },
    async addStatus(s) { const id = rid(); D.statuses[id] = { id, views: [], ts: Date.now(), ...s }; save(); },
    async viewStatus(id, uid) { const s = D.statuses[id]; if (s && !(s.views || []).includes(uid)) { s.views = [...(s.views || []), uid]; save(); } },
    async deleteStatus(id) { delete D.statuses[id]; save(); },
    async updateStatus(id, p) { if (D.statuses[id]) { Object.assign(D.statuses[id], p); save(); } },
    async startCall({ from, to, chatId, kind }) {
      const id = rid(); D.calls[id] = { id, from, to, parties: [from, ...to], chatId, kind, status: 'ringing', joined: [from], sig: [], ts: Date.now() }; save();
      return id;
    },
    watchCalls(uid, cb) { return sub(() => cb(Object.values(D.calls).filter(c => c.parties.includes(uid)))); },
    async updateCall(id, patch) { if (D.calls[id]) { Object.assign(D.calls[id], patch); save(); } },
  };

  /* ======================= FIREBASE ENGINE ======================= */
  function makeFirebase() {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const auth = firebase.auth(), fs = firebase.firestore(), FV = firebase.firestore.FieldValue;
    const persistReady = window.SESSION_PER_TAB ? Promise.resolve().then(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)).catch(e => console.warn('persistence', e)) : Promise.resolve();
    fs.settings({ ignoreUndefinedProperties: true });
    try { fs.enablePersistence({ synchronizeTabs: true }).catch(() => { }); } catch (e) { }
    let storage = null; if (window.USE_FIREBASE_STORAGE) { try { storage = firebase.storage(); } catch (e) { } }
    let cb = () => { }, busy = false, umap = {}, cmap = {};
    const users = () => fs.collection('users'), chatsC = () => fs.collection('chats'), msgsC = id => chatsC().doc(id).collection('messages');
    const data = s => s.docs.map(d => d.data());
    const CH = 700000, CHUNK_MAX = 10 * 1024 * 1024;
    chunkLoader = async id => {
      const ref = fs.collection('files').doc(id), meta = await ref.get(); if (!meta.exists) return '';
      const snap = await ref.collection('chunks').orderBy('i').get(); let b64 = ''; snap.forEach(d => { b64 += d.data().d; });
      const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: meta.data().mime || 'application/octet-stream' }));
    };
    const api = {
      mode: 'firebase',
      get maxUpload() { return storage ? 100 * 1024 * 1024 : CHUNK_MAX; },
      onAuth(c) {
        cb = c;
        persistReady.then(() => auth.onAuthStateChanged(async fu => {
          if (busy) return;
          if (!fu) return cb(null);
          try {
            const ref = users().doc(fu.uid); let s = await ref.get();
            if (!s.exists) {
              await ref.set({ uid: fu.uid, email: fu.email || '', phone: fu.phoneNumber || '', username: '', usernameLower: '', photo: fu.photoURL || '', profileDone: false, createdAt: Date.now(), lastSeen: Date.now() });
              s = await ref.get();
            }
            cb(s.data());
          } catch (e) { console.error(e); cb(null, e); }
        }));
      },
      async usernameTaken(name, except) {
        const s = await users().where('usernameLower', '==', name.toLowerCase()).limit(3).get();
        return s.docs.some(d => d.id !== except);
      },
      async signUp({ email, password, username, nickname, photo }) {
        await persistReady; busy = true;
        try {
          const cr = await auth.createUserWithEmailAndPassword(email.trim(), password);
          if (await api.usernameTaken(username, cr.user.uid)) { await cr.user.delete(); throw new Error('That username is already taken.'); }
          const u = { uid: cr.user.uid, email: email.trim().toLowerCase(), username, nickname: nickname || '', usernameLower: username.toLowerCase(), photo: photo || '', profileDone: true, createdAt: Date.now(), lastSeen: Date.now() };
          await users().doc(u.uid).set(u); busy = false; cb(u); return u;
        } finally { busy = false; }
      },
      async login(email, password) { await persistReady; await auth.signInWithEmailAndPassword(email.trim(), password); },
      async google() { await persistReady; await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },
      async logout() { await auth.signOut(); },
      async updateProfile(uid, patch) { await users().doc(uid).update(patch); },
      async touch(uid) { try { await users().doc(uid).update({ lastSeen: Date.now() }); } catch (e) { } },
      watchUsers(c) { return users().onSnapshot(s => { const l = data(s); umap = {}; l.forEach(u => { umap[u.uid] = u; }); c(l); }, e => console.error(e)); },
      watchChats(uid, c) { return chatsC().where('members', 'array-contains', uid).onSnapshot(s => { const l = data(s); cmap = {}; l.forEach(x => { cmap[x.id] = x; }); c(l); }, e => console.error(e)); },
      async ensureDM(me, other) {
        const id = [me, other].sort().join('_'), r = chatsC().doc(id), s = await r.get();
        if (!s.exists) await r.set({ id, type: 'dm', members: [me, other], createdAt: Date.now(), lastMsg: null });
        return id;
      },
      async createGroup(me, { name, photo, members }) {
        const id = 'g_' + rid(), c = { id, type: 'group', name, photo: photo || '', members: Array.from(new Set([me, ...members])), admins: [me], createdBy: me, invite: Math.random().toString(36).slice(2, 12), createdAt: Date.now(), lastMsg: null };
        await chatsC().doc(id).set(c);
        await api.sendMessage(id, { from: me, type: 'system', text: `Group “${name}” created` }); return c;
      },
      async findByInvite(code) { const s = await chatsC().where('invite', '==', code).limit(1).get(); return s.empty ? null : s.docs[0].data(); },
      async joinByCode(me, code) {
        const c = await api.findByInvite(code); if (!c) throw new Error('Invite link is invalid or expired.');
        if (!c.members.includes(me)) { await chatsC().doc(c.id).update({ members: FV.arrayUnion(me) }); await api.sendMessage(c.id, { from: me, type: 'system', text: 'A new member joined via invite link' }); c.members.push(me); }
        return c;
      },
      async regenInvite(id) { const code = Math.random().toString(36).slice(2, 12); await chatsC().doc(id).update({ invite: code }); return code; },
      async renameGroup(id, name) { await chatsC().doc(id).update({ name }); },
      async leaveGroup(id, uid) { await chatsC().doc(id).update({ members: FV.arrayRemove(uid) }); },
      async setBlock(me, other, val) { await users().doc(me).update({ blocked: val ? FV.arrayUnion(other) : FV.arrayRemove(other) }); },
      async markRead(id, uid, ghost) { try { const p = { ['cnt.' + uid]: 0 }; if (!ghost) p['reads.' + uid] = Date.now(); await chatsC().doc(id).update(p); } catch (e) { } },
      async updateMessage(id, mid, patch) { await msgsC(id).doc(mid).update(patch); },
      async purgeMessages(id, ids) {
        for (const mid of ids) {
          try { await msgsC(id).doc(mid).delete(); }
          catch (e) { try { await msgsC(id).doc(mid).update({ expired: true, deleted: true, type: 'text', text: '', images: null, media: null, wave: null, poll: null, note: null, code: null, expense: null, reactions: null, name: null }); } catch (e2) { } }
        }
      },
      async updateChat(id, patch) { await chatsC().doc(id).update(patch); },
      async signal(callId, sg) { await fs.collection('calls').doc(callId).update({ sig: FV.arrayUnion({ id: rid(), ts: Date.now(), ...sg }) }); },
      async setCallRec(callId, uid, data) { await fs.collection('calls').doc(callId).update({ ['recs.' + uid]: data }); },
      async joinCall(callId, uid) { await fs.collection('calls').doc(callId).update({ joined: FV.arrayUnion(uid), status: 'active', answeredAt: Date.now() }); },
      async setActivity(id, uid, kind) { try { await chatsC().doc(id).update({ ['act.' + uid]: kind ? { k: kind, ts: Date.now() } : FV.delete() }); } catch (e) { } },
      watchMessages(id, c) { return msgsC(id).orderBy('ts').onSnapshot(s => c(data(s)), e => console.error(e)); },
      async sendMessage(id, m) {
        m = { id: rid(), ts: Date.now(), ...m };
        if (m.type !== 'system' && id.indexOf('g_') !== 0) { const o = id.split('_').find(x => x !== m.from); if (o && umap[o] && (umap[o].blocked || []).includes(m.from)) m.hidden = true; }
        const ch = cmap[id]; if (ch && ch.disappear && m.type !== 'system' && !m.exp) m.exp = m.ts + ch.disappear * 1000;
        await msgsC(id).doc(m.id).set(m);
        if (m.type !== 'system' && !m.hidden) {
          const up = { lastMsg: { id: m.id, text: previewOf(m), ts: m.ts, from: m.from }, ['act.' + m.from]: FV.delete() };
          (ch ? ch.members : id.split('_')).forEach(u => { if (u !== m.from) up['cnt.' + u] = FV.increment(1); });
          await chatsC().doc(id).update(up);
        } else if (m.type !== 'system') { try { await chatsC().doc(id).update({ ['act.' + m.from]: FV.delete() }); } catch (e) { } }
        return m;
      },
      async deleteForMe(id, mid, uid) { await msgsC(id).doc(mid).update({ deletedFor: FV.arrayUnion(uid) }); },
      async deleteForAll(id, mid) {
        await msgsC(id).doc(mid).update({ deleted: true, type: 'text', text: '', images: null, media: null, wave: null, poll: null, reactions: null, name: null, mime: null, pinned: false });
        const s = await chatsC().doc(id).get(), c = s.data();
        if (c && c.lastMsg && c.lastMsg.id === mid) await chatsC().doc(id).update({ 'lastMsg.text': '🚫 This message was deleted' });
      },
      async togglePin(id, mid, val) { await msgsC(id).doc(mid).update({ pinned: val }); },
      async react(id, mid, uid, emoji) {
        const ref = msgsC(id).doc(mid);
        await fs.runTransaction(async tx => {
          const s = await tx.get(ref); if (!s.exists) return; const m = s.data(); if (m.deleted) return;
          const r = m.reactions || {}, had = (r[emoji] || []).includes(uid);
          Object.keys(r).forEach(k => { r[k] = r[k].filter(x => x !== uid); if (!r[k].length) delete r[k]; });
          if (!had) r[emoji] = [...(r[emoji] || []), uid];
          tx.update(ref, { reactions: r });
        });
      },
      async votePoll(id, mid, uid, optId) {
        const ref = msgsC(id).doc(mid);
        await fs.runTransaction(async tx => {
          const s = await tx.get(ref); if (!s.exists) return; const m = s.data(); if (!m.poll) return;
          m.poll.options.forEach(o => {
            if (o.id === optId) o.votes = o.votes.includes(uid) ? o.votes.filter(v => v !== uid) : [...o.votes, uid];
            else if (!m.poll.multi) o.votes = o.votes.filter(v => v !== uid);
          });
          tx.update(ref, { poll: m.poll });
        });
      },
      async uploadMedia(blob, onProg, big) {
        const id = rid(), uid = (auth.currentUser && auth.currentUser.uid) || 'x';
        if (storage) {
          try {
            const ref = storage.ref('media/' + uid + '/' + id), task = ref.put(blob);
            await new Promise((res, rej) => task.on('state_changed', s => onProg && onProg(s.bytesTransferred / s.totalBytes), rej, res));
            return await ref.getDownloadURL();
          } catch (e) { console.warn('Storage upload failed, falling back to Firestore', e); }
        }
        if (blob.size <= 700 * 1024 && !big) return blobToDataURL(blob);
        if (blob.size > CHUNK_MAX) throw new Error('File too large (max ' + Math.round(CHUNK_MAX / 1048576) + ' MB without Firebase Storage).');
        const b64 = (await blobToDataURL(blob)).split(',')[1], n = Math.ceil(b64.length / CH), ref = fs.collection('files').doc(id);
        await ref.set({ mime: blob.type || 'application/octet-stream', n, size: blob.size, uid, ts: Date.now() });
        for (let i = 0; i < n; i++) { await ref.collection('chunks').doc(String(i).padStart(4, '0')).set({ i, d: b64.slice(i * CH, (i + 1) * CH) }); onProg && onProg((i + 1) / n); }
        return 'fs:' + id;
      },
      watchStatuses(c) { return fs.collection('statuses').where('ts', '>', Date.now() - 864e5).onSnapshot(s => c(data(s)), e => console.error(e)); },
      async addStatus(s) { const id = rid(); await fs.collection('statuses').doc(id).set({ id, views: [], ts: Date.now(), ...s }); },
      async viewStatus(id, uid) { await fs.collection('statuses').doc(id).update({ views: FV.arrayUnion(uid) }); },
      async updateStatus(id, p) { await fs.collection('statuses').doc(id).update(p); },
      async deleteStatus(id) { await fs.collection('statuses').doc(id).delete(); },
      async startCall({ from, to, chatId, kind }) {
        const id = rid(); await fs.collection('calls').doc(id).set({ id, from, to, parties: [from, ...to], chatId, kind, status: 'ringing', joined: [from], sig: [], ts: Date.now() }); return id;
      },
      watchCalls(uid, c) { return fs.collection('calls').where('parties', 'array-contains', uid).onSnapshot(s => c(data(s).filter(x => x.ts > Date.now() - 30 * 864e5)), e => console.error(e)); },
      async updateCall(id, patch) { await fs.collection('calls').doc(id).update(patch); },
    };
    return api;
  }

  const cfg = window.FIREBASE_CONFIG || {};
  const configured = !window.FORCE_DEMO && typeof firebase !== 'undefined' && cfg.apiKey && !/YOUR_/.test(cfg.apiKey) && !/YOUR_/.test(cfg.projectId || 'YOUR_');
  let engine; try { engine = configured ? makeFirebase() : Demo; } catch (e) { console.error('Firebase init failed, using Demo mode', e); engine = Demo; }
  engine.util = { PAL, rid, hash, avatarSVG, previewOf, mediaURL, blobToDataURL, clone };
  window.NovaBackend = engine;
})();
