/* QUEENBEE — main.js : boot, session, live subscriptions */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, toast } = N;
  let started = false, hb = null, firstChats = true, restored = false; const lastSeen = {};

  const m = location.hash.match(/join=([\w-]+)/);
  if (m) { try { sessionStorage.setItem('nova_join', m[1]); } catch (e) { } }
  window.addEventListener('hashchange', () => { const h = location.hash.match(/join=([\w-]+)/); if (h && S.me && started) N.handleJoin(h[1]); else if (h) sessionStorage.setItem('nova_join', h[1]); });

  function unsubAll() { Object.keys(S.unsubs).forEach(k => { try { S.unsubs[k] && S.unsubs[k](); } catch (e) { } S.unsubs[k] = null; }); }

  function start(u) {
    S.me = u;
    if (started) { N.renderSelf(); return; }
    started = true; firstChats = true; restored = false; N.cfg.use(u.uid);
    N.buildMain();
    S.unsubs.users = B.watchUsers(list => {
      const nowT = Date.now(); S.users = Object.fromEntries(list.map(x => [x.uid, x.mood && x.mood.until && x.mood.until < nowT ? Object.assign({}, x, { mood: null }) : x]));
      if (N.AI_USER) S.users[N.AI_USER.uid] = N.AI_USER;
      if (S.users[S.me.uid]) S.me = S.users[S.me.uid];
      N.renderSelf(); N.renderList(); N.renderHeader && N.renderHeader();
      if (S.activeId) N.renderMessages();
    });
    S.unsubs.chats = B.watchChats(S.me.uid, list => {
      S.chats = list;
      list.forEach(c => {
        const l = c.lastMsg; if (!l) return; const prev = lastSeen[c.id];
        if (!firstChats && l.ts > (prev || 0) && l.from !== S.me.uid && c.id !== S.activeId && l.type !== 'system') {
          if (N.shouldNotify(c.id) && !N.isBlocked(l.from)) {       // muted chats and Do Not Disturb stay silent (the chat list still updates)
            const info = N.chatInfo(c), who = c.type === 'group' && S.users[l.from] ? S.users[l.from].username + ': ' : '';
            toast(N.isLocked(c.id) ? `🔒 New message in a locked chat — ${info.name}` : `${N.cfg.isFav(l.from) ? '★' : '💬'} ${info.name} — ${who}${l.text}`.slice(0, 110));
            if (N.sfx) N.sfx.recv(c.id, l.from);
          }
        }
        lastSeen[c.id] = l.ts;
      });
      if (firstChats && N.ensureAI) setTimeout(() => N.ensureAI(), 400);
      firstChats = false;
      if (!restored && list.length) { restored = true; let last = null; try { last = localStorage.getItem('nova_last_' + S.me.uid); } catch (e) { } if (last && !S.activeId && list.some(c => c.id === last)) N.openChat(last); }
      if (S.pendingOpen && list.some(c => c.id === S.pendingOpen)) { const id = S.pendingOpen; S.pendingOpen = null; if (S.activeId !== id) N.openChat(id); }
      if (S.activeId && !list.some(c => c.id === S.activeId) && !S.pendingOpen) N.closeChat();
      N.renderList(); N.renderHeader && N.renderHeader(); if (S.activeId) N.renderMessages();
    });
    S.unsubs.statuses = B.watchStatuses(list => { S.statuses = list; N.updateStoryDot && N.updateStoryDot(); N.refreshStories && N.refreshStories(); });
    S.unsubs.calls = B.watchCalls(S.me.uid, list => N.onCalls(list));
    B.touch(S.me.uid); hb = setInterval(() => B.touch(S.me.uid), 30000);
    if (!S.me.profileDone) N.profileModal(S.me, { first: true });
    const code = sessionStorage.getItem('nova_join');
    if (code) { sessionStorage.removeItem('nova_join'); setTimeout(() => N.handleJoin(code), 600); }
  }

  function stop() {
    clearInterval(hb); unsubAll(); N.resetCalls && N.resetCalls();
    started = false; N.cfg.use(null); if (N.closeThread) N.closeThread(); Object.assign(S, { me: null, users: {}, chats: [], statuses: [], calls: [], activeId: null, msgs: [], tab: 'chats', q: '', inChatQ: '' });
    document.querySelectorAll('.fixed.z-50').forEach(x => x.remove());
  }

  N.logout = async function () { try { await B.logout(); } catch (e) { toast(N.friendly(e)); } };

  B.onAuth(async (u, err) => {
    if (err) toast(N.friendly(err), 5000);
    if (!u) {
      if (started) stop();
      N.showAuth(); return;
    }
    start(u);
  });
})();
