/* QUEENBEE — chat.js : sidebar, chat pane, messages, voice, polls, images, menus, groups */
(function () {
  'use strict';
  const N = window.Nova, { S, B, U, $, $$, esc, el, ic, toast, modal, ask } = N, cfg = N.cfg;
  const readKey = id => `nova_read_${S.me.uid}_${id}`;
  const isUnread = c => c.id !== S.activeId && c.lastMsg && c.lastMsg.from !== S.me.uid && c.lastMsg.ts > (+localStorage.getItem(readKey(c.id)) || 0);
  const unreadN = c => { if (!c || c.id === S.activeId || !S.me) return 0; const n = c.cnt && c.cnt[S.me.uid]; return typeof n === 'number' ? n : (isUnread(c) ? 1 : 0); };
  const otherOf = c => c && c.type === 'dm' ? c.members.find(m => m !== S.me.uid) : null;
  const isAI = c => !!(c && c.type === 'dm' && c.members.includes('qb_ai'));
  N.unreadN = unreadN; N.isAIChat = isAI;
  S.filter = S.filter || 'all';
  let pinIdx = 0;
  const draftKey = () => `nova_draft_${S.me.uid}_${S.activeId}`;

  /* ------------------------------------------------------------------ MAIN SHELL */
  N.buildMain = function () {
    window.scrollTo(0, 0);
    try { S.tab = localStorage.getItem('nova_tab_' + S.me.uid) === 'calls' ? 'calls' : 'chats'; } catch (e) { S.tab = 'chats'; }
    $('#app').innerHTML = `
    <div id="main" class="h-[100dvh] w-full flex overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <aside id="side" class="relative w-full md:w-[360px] lg:w-[400px] shrink-0 flex flex-col bg-[var(--panel)] border-r border-[var(--border)]">
        <header class="px-4 pt-4 pb-2">
          <div class="flex items-center gap-3">
            <button id="meBtn" class="story-ring shrink-0" title="Profile & settings"><img id="meImg" class="w-11 h-11 rounded-full object-cover"></button>
            <div class="flex-1 min-w-0 leading-tight"><div class="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[.2em] uppercase text-royal dark:text-gold">${N.logoMark('w-4 h-4')}<span>QueenB.Chat</span></div><div id="meName" class="font-extrabold text-lg truncate"></div><div id="modeLbl" class="text-[11px] text-[var(--muted)]"></div></div>
            <button id="storyBtn" class="icon-btn soft story-btn" title="Add status / stories">${ic('ring')}</button>
            <button id="newGroupBtn" class="icon-btn soft" title="New group">${ic('users')}</button>
            <button data-theme-btn class="icon-btn soft" title="Light / dark">${N.themeIcon()}</button>
            <button id="setBtn" class="icon-btn soft" title="Settings">${ic('gear')}</button>
          </div>
          <div class="relative mt-4">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">${ic('search', 'w-4 h-4')}</span>
            <input id="sideSearch" class="field !pl-10 !py-2.5 !rounded-2xl" placeholder="Search people &amp; chats" autocomplete="off">
          </div>
        </header>
        <nav class="seg-nav mx-4 mb-2"><button class="tab${S.tab === 'chats' ? ' active' : ''}" data-tab="chats">${ic('chat', 'w-4 h-4')} Chats</button><button class="tab${S.tab === 'calls' ? ' active' : ''}" data-tab="calls">${ic('phone', 'w-4 h-4')} Calls</button></nav>
        <div id="chips" class="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar"></div>
        <div id="list" class="flex-1 overflow-y-auto px-2 pb-28"></div>
        <button id="fab" class="fab" title="New chat">${ic('plus', 'w-6 h-6')}</button>
      </aside>
      <section id="pane" class="flex-1 min-w-0 flex-col relative"></section>
    </div>`;
    $('#meBtn').onclick = e => { if (popEl && popAnchor === e.currentTarget) return closePop(); openMeMenu(e.currentTarget); };
    $('#meBtn').dataset.ptrig = 1;
    $('#setBtn').onclick = () => N.openSettings && N.openSettings();
    $('#chips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; S.filter = b.dataset.f; N.renderList(); });
    $('#fab').onclick = () => (S.tab === 'calls' ? N.newCallPicker() : newChatModal());
    $('#storyBtn').onclick = () => N.openStoriesPanel();
    $('#newGroupBtn').onclick = createGroupModal;
    $('[data-theme-btn]').onclick = N.toggleTheme;
    $('#sideSearch').oninput = e => { S.q = e.target.value; N.renderList(); };
    $$('[data-tab]').forEach(b => b.onclick = () => {
      S.tab = b.dataset.tab; try { localStorage.setItem('nova_tab_' + S.me.uid, S.tab); } catch (e) { }
      $$('[data-tab]').forEach(x => x.classList.toggle('active', x === b)); updateFab(); N.renderList();
    });
    $('#list').addEventListener('click', e => {
      const cb = e.target.closest('[data-cb]'); if (cb) return N.callBack(cb.dataset.cid, cb.dataset.cb);
      if (e.target.closest('[data-newcall]')) return N.newCallPicker();
      const rc = e.target.closest('[data-rec]'); if (rc) return N.playRecording(rc.dataset.rec);
      if (e.target.closest('[data-mictest]')) return N.micTest();
      const c = e.target.closest('[data-chat]'); if (c) return N.openChat(c.dataset.chat);
      const u = e.target.closest('[data-user]'); if (u) return N.startDM(u.dataset.user);
    });
    updateFab(); N.renderSelf(); N.renderList(); N.renderEmptyPane();
  };
  function updateFab() { const f = $('#fab'); if (!f) return; const c = S.tab === 'calls'; f.innerHTML = ic(c ? 'phone' : 'plus', 'w-6 h-6'); f.title = c ? 'New call' : 'New chat'; }

  N.renderSelf = function () {
    if (!$('#meImg')) return;
    $('#meImg').src = N.avatar(S.me); $('#meName').textContent = S.me.username || 'You';
    const md = N.cfg.get('fMood') !== false && S.me.mood && S.me.mood.t ? (S.me.mood.e || '') + ' ' + S.me.mood.t : 'Available';
    $('#modeLbl').textContent = md.trim(); const mb = $('#meBtn'); if (mb) mb.classList.toggle('has-mood', !!(S.me.mood && S.me.mood.t));
    if (N.i18nApply) N.i18nApply($('#modeLbl'));
  };

  function openMeMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const items = [['user', 'Edit profile', () => N.profileModal(S.me)], ['gear', 'Settings', () => N.openSettings && N.openSettings()], ['smile', 'Set status', () => N.moodModal && N.moodModal()], ['link', 'Join group with link', joinByLinkModal], ['ban', 'Blocked users', () => N.blockedModal()], ['key', N.hasPin() ? 'Change chat PIN' : 'Set chat PIN', () => N.hasPin() ? N.changePin() : N.setPinFlow()]];
    items.push(['logout', 'Log out', () => N.logout()]);
    openPop(items.map(([i, t, f]) => ({ icon: i, text: t, fn: f })), r.left, r.bottom + 6); mark(anchor);
  }

  /* ------------------------------------------------------------------ LIST */
  function chatRow(c) {
    const info = N.chatInfo(c), last = c.lastMsg, unN = unreadN(c), un = unN > 0, locked = N.isLocked(c.id), act = locked ? '' : N.activityText(c, true), blk = !info.group && N.isBlocked(info.other && info.other.uid);
    let prev = last ? last.text : (c.type === 'group' ? 'Group created' : isAI(c) ? 'Ask me anything ✨' : 'Say hello 👋');
    const oU = info.other, fav = oU && !info.group && cfg.isFav(oU.uid) && N.feature('fFav'), mood = oU && N.feature('fMood') && oU.mood && oU.mood.e ? oU.mood : null, muted = cfg.chat(c.id).mute;
    if (last && last.from === S.me.uid && !prev.startsWith('🚫')) prev = 'You: ' + prev;
    else if (last && c.type === 'group' && last.from !== S.me.uid && S.users[last.from]) prev = S.users[last.from].username + ': ' + prev;
    if (locked) prev = 'Locked chat — enter PIN to read';
    return `<button class="row ${c.id === S.activeId ? 'active' : ''}" data-chat="${esc(c.id)}">
      <div class="relative shrink-0"><img class="w-[52px] h-[52px] rounded-[18px] object-cover" src="${esc(info.photo)}">
        ${!info.group && info.other && !locked && !N.blockedMe(info.other) && N.presence(info.other) === 'online' ? '<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gold border-[2.5px] border-[var(--panel)]"></span>' : ''}${mood && !locked ? `<span class="mood-pin" title="${esc(mood.t || '')}">${esc(mood.e)}</span>` : ''}</div>
      <div class="flex-1 min-w-0"><div class="flex justify-between items-center gap-2"><span class="font-bold truncate">${esc(info.name)}${fav ? ` <span class="text-gold inline-block align-middle" title="Favorite">${ic('star', 'w-3.5 h-3.5')}</span>` : ''}${info.group ? ' <span class="chip-g">GROUP</span>' : ''}${isAI(c) ? ' <span class="chip-g chip-ai">AI</span>' : ''}${muted ? ` <span class="inline-block align-middle text-[var(--muted)]">${ic('belloff', 'w-3.5 h-3.5')}</span>` : ''}${blk ? ` <span class="inline-block align-middle text-[var(--muted)]" title="Blocked">${ic('ban', 'w-3.5 h-3.5')}</span>` : ''}</span>
        <span class="text-[11px] shrink-0 ${un ? 'text-royal dark:text-gold font-bold' : 'text-[var(--muted)]'}">${last ? N.timeStr(last.ts) : ''}</span></div>
        <div class="flex justify-between items-center gap-2 mt-0.5">${act ? `<span class="text-sm truncate font-semibold text-royal dark:text-gold act-line">${esc(act.replace('…', ''))}<span class="act-dots"><i></i><i></i><i></i></span></span>` : `<span class="text-sm truncate ${un ? 'font-semibold' : 'text-[var(--muted)]'} flex items-center gap-1">${locked ? ic('lock', 'w-3.5 h-3.5 shrink-0') : ''}<span class="truncate">${esc(prev)}</span></span>`}${un ? `<span class="unread-badge">${unN > 99 ? '99+' : unN}</span>` : ''}</div></div></button>`;
  }

  N.renderList = function () {
    const box = $('#list'); if (!box || !S.me) return;
    N.updateStoryDot && N.updateStoryDot();
    if (S.tab === 'calls') return N.renderCallList(box);
    const q = S.q.trim().toLowerCase();
    renderChips();
    let chats = S.chats.filter(c => !(isAI(c) && !N.feature('fAI'))).slice().sort((a, b) => (isAI(b) - isAI(a)) || (((b.lastMsg && b.lastMsg.ts) || b.createdAt || 0) - ((a.lastMsg && a.lastMsg.ts) || a.createdAt || 0)));
    if (!N.feature('fFav') && S.filter === 'favs') S.filter = 'all';
    if (S.filter === 'unread') chats = chats.filter(c => unreadN(c) > 0);
    else if (S.filter === 'favs') chats = chats.filter(c => c.type === 'dm' && cfg.isFav(otherOf(c)));
    else if (S.filter === 'groups') chats = chats.filter(c => c.type === 'group');
    if (q) chats = chats.filter(c => N.chatInfo(c).name.toLowerCase().includes(q) || (!N.isLocked(c.id) && ((c.lastMsg && c.lastMsg.text) || '').toLowerCase().includes(q)));
    let html = chats.map(chatRow).join('');
    if (q && S.filter === 'all') {
      const dmWith = new Set(S.chats.filter(c => c.type === 'dm').map(c => c.members.find(m => m !== S.me.uid)));
      const people = Object.values(S.users).filter(u => u.uid !== S.me.uid && u.username && !dmWith.has(u.uid) && u.username.toLowerCase().includes(q));
      if (people.length) html += `<div class="px-4 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">People on QueenB.Chat</div>` +
        people.map(u => `<button class="row" data-user="${esc(u.uid)}"><img class="w-12 h-12 rounded-full object-cover" src="${esc(N.avatar(u))}"><div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(u.username)}</div><div class="text-sm text-[var(--muted)]">Tap to start chatting</div></div><span class="text-royal dark:text-gold">${ic('chat')}</span></button>`).join('');
    }
    if (!html) html = `<div class="p-8 text-center text-[var(--muted)]"><div class="mx-auto w-14 h-14 rounded-full bg-[var(--panel2)] flex items-center justify-center mb-3">${ic('chat', 'w-7 h-7')}</div>${q ? 'No chats or people match “' + esc(S.q) + '”.' : S.filter === 'unread' ? 'You’re all caught up 🎉<br>No unread messages.' : S.filter === 'favs' ? 'No favorites yet.<br>Open a contact and tap the star to add them.' : S.filter === 'groups' ? 'You’re not in any groups yet.<br>Tap the people icon to create one.' : 'No chats yet.<br>Search for a username or tap the chat icon above to start one.'}</div>`;
    const key = S.tab + '|' + q; box.classList.toggle('stagger', box._k !== key); box._k = key; box.innerHTML = html;
    if (box.classList.contains('stagger')) { clearTimeout(box._st); box._st = setTimeout(() => box.classList.remove('stagger'), 900); }
  };

  const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['favs', 'Favorites'], ['groups', 'Groups']];
  function renderChips() {
    const b = $('#chips'); if (!b) return; const show = S.tab === 'chats'; b.classList.toggle('hidden', !show); b.classList.toggle('flex', show); if (!show) return;
    const un = S.chats.filter(c => unreadN(c) > 0 && !(isAI(c) && !N.feature('fAI'))).length;
    const html = FILTERS.filter(([k]) => k !== 'favs' || N.feature('fFav')).map(([k, t]) => `<button type="button" class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}"><span>${t}</span>${k === 'unread' && un ? `<b>${un}</b>` : ''}</button>`).join('');
    if (b._h !== html) { b._h = html; b.innerHTML = html; if (N.i18nApply) N.i18nApply(b); }
  }
  N.startDM = async function (uid) {
    try { const id = await B.ensureDM(S.me.uid, uid); S.pendingOpen = id; N.openChat(id); } catch (e) { toast(N.friendly(e)); }
  };

  function newChatModal() {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">New chat</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <input id="ncq" class="field mb-3" placeholder="Search username…" autocomplete="off"><div id="ncl" class="max-h-[55dvh] overflow-y-auto -mx-2"></div></div>`);
    const draw = () => {
      const q = $('#ncq', md.box).value.trim().toLowerCase();
      const us = Object.values(S.users).filter(u => u.uid !== S.me.uid && u.username && u.username.toLowerCase().includes(q)).sort((a, b) => a.username.localeCompare(b.username));
      $('#ncl', md.box).innerHTML = us.map(u => `<button class="row rounded-xl" data-u="${esc(u.uid)}"><img class="w-11 h-11 rounded-full object-cover" src="${esc(N.avatar(u))}"><div><div class="font-semibold">${esc(u.username)}</div><div class="text-xs text-[var(--muted)]">${N.presence(u)}</div></div></button>`).join('') || '<div class="p-6 text-center text-[var(--muted)]">No users found</div>';
    };
    $('#ncq', md.box).oninput = draw; draw(); $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) { md.close(); N.startDM(b.dataset.u); } });
    setTimeout(() => $('#ncq', md.box).focus(), 50);
  }

  /* ------------------------------------------------------------------ PANE */
  N.renderEmptyPane = function () {
    const p = $('#pane'); if (!p) return; S.activeId = null; $('#main').classList.remove('chat-open');
    p.innerHTML = `<div class="hidden md:flex flex-1 flex-col items-center justify-center text-center p-10 bg-[var(--bg)]">
      <div class="mb-5 drop-shadow-xl">${N.logoMark('w-24 h-24')}</div>
      <h2 class="text-2xl font-extrabold">QueenB.Chat</h2><p class="text-[var(--muted)] mt-2 max-w-sm">Pick a conversation, search for a person, or create a group and share its invite link.</p></div>`;
  };

  N.closeChat = function () {
    if (S.activeId) N.relock(S.activeId); sendAct(null);
    if (S.unsubs.msgs) { S.unsubs.msgs(); S.unsubs.msgs = null; }
    try { localStorage.removeItem('nova_last_' + S.me.uid); } catch (e) { }
    stopRec(false); S.msgs = []; S.inChatQ = ''; N.renderEmptyPane(); N.renderList();
  };

  N.openChat = function (id, skipLock) {
    if (S.activeId && S.activeId !== id) N.relock(S.activeId);
    sendAct(null);
    if (S.unsubs.msgs) { S.unsubs.msgs(); S.unsubs.msgs = null; }
    stopRec(false);
    if (!skipLock && N.isLocked(id) && !N.isUnlocked(id)) { S.activeId = id; S.msgs = []; try { localStorage.setItem('nova_last_' + S.me.uid, id); } catch (e) { } $('#main').classList.add('chat-open'); N.renderList(); return N.showLock(id); }
    const un0 = unreadN(S.chats.find(c => c.id === id)); S.activeId = id; S.msgs = []; S.inChatQ = ''; pinIdx = 0; S.thread = null; N.closeThread && N.closeThread();
    localStorage.setItem(readKey(id), Date.now());
    try { localStorage.setItem('nova_last_' + S.me.uid, id); } catch (e) { }
    $('#main').classList.add('chat-open');
    buildPane(); N.renderList();
    let lastTs = Date.now(), firstLoad = true;
    S.unsubs.msgs = B.watchMessages(id, list => {
      if (S.activeId !== id) return; S.msgs = list;
      localStorage.setItem(readKey(id), Date.now());
      const fresh = list.filter(m => m.ts > lastTs && m.from !== S.me.uid && m.type !== 'system' && !m.hidden && !m.threadOf);
      if (!firstLoad && fresh.length && N.shouldNotify(id) && N.sfx) N.sfx.recv(id, fresh[fresh.length - 1].from);
      if (list.length) lastTs = Math.max(lastTs, list[list.length - 1].ts); firstLoad = false;
      N.renderMessages(); N.renderPinned(); N.renderThread && N.renderThread();
    });
    if (un0 >= 8 && N.feature('fSummary') && N.showCatchUp) setTimeout(() => N.showCatchUp(id, un0), 350);
  };

  function buildPane() {
    const p = $('#pane');
    p.innerHTML = `
      <header id="chatHead" class="flex items-center gap-1 px-2 sm:px-4 py-2.5 bg-[var(--panel)] border-b border-[var(--border)] shadow-sm z-10">
        <button class="icon-btn md:hidden" id="backBtn">${ic('back')}</button>
        <button id="headInfo" class="flex items-center gap-3 flex-1 min-w-0 text-left rounded-2xl px-1.5 py-1 hover:bg-[var(--panel2)] transition">
          <img data-h="img" class="w-11 h-11 rounded-2xl object-cover"><div class="min-w-0"><div data-h="name" class="font-extrabold truncate leading-tight"></div><div data-h="sub" class="text-xs text-[var(--muted)] truncate"></div></div></button>
        <button class="icon-btn soft" id="searchBtn" title="Search in chat">${ic('search')}</button>
        <button class="icon-btn soft" id="vcBtn" title="Video call">${ic('video')}</button>
        <button class="icon-btn soft" id="acBtn" title="Voice call">${ic('phone')}</button>
        <button class="icon-btn soft" id="moreBtn">${ic('dots')}</button>
      </header>
      <div id="searchBar" class="hidden items-center gap-2 px-3 py-2 bg-[var(--panel)] border-b border-[var(--border)]">
        <input id="inSearch" class="field !py-2" placeholder="Search messages or usernames in this chat…" autocomplete="off"><span id="inCount" class="text-xs text-[var(--muted)] whitespace-nowrap"></span>
        <button class="icon-btn" id="searchClose">${ic('x')}</button></div>
      <button id="pinBar" class="hidden items-center gap-2 px-4 py-2 text-sm bg-[var(--panel2)] border-b border-[var(--border)] text-left"></button>
      <div id="msgs" class="flex-1 overflow-y-auto py-3"></div>
      <div id="composerWrap" class="px-2 sm:px-4 pt-2 relative">
        <form id="composer" class="composer flex items-end gap-1">
          <button type="button" id="emojiBtn" data-emoji-btn class="icon-btn text-royal dark:text-gold" title="Emoji">${ic('smile', 'w-6 h-6')}</button>
          <textarea id="msgInput" rows="1" class="flex-1 min-w-0 bg-transparent outline-none px-1 py-2.5 max-h-32" placeholder="Type a message"></textarea>
          <button type="button" id="attachBtn" class="icon-btn text-royal dark:text-gold" title="Attach">${ic('plus', 'w-6 h-6')}</button>
          <button type="submit" id="sendBtn" class="send-btn" title="Send">${ic('mic', 'w-5 h-5')}</button>
        </form>
        <div id="blockBar" class="hidden items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--panel)] border border-[var(--border)] text-sm"><span class="flex items-center gap-2">${ic('ban', 'w-4 h-4')}<span id="blockTxt"></span></span><button type="button" id="unblockBtn" class="btn btn-gold !py-1.5 !px-3 text-sm">Unblock</button></div>
        <div id="recBar" class="composer hidden items-center gap-2">
          <button type="button" id="recCancel" class="icon-btn text-royal dark:text-gold" title="Discard">${ic('trash')}</button>
          <span class="rec-dot"></span><span id="recTime" class="text-sm font-mono w-12">0:00</span>
          <canvas id="recCanvas" class="flex-1 h-10 min-w-0 rounded-xl bg-[var(--input)]"></canvas>
          <button type="button" id="recSend" class="send-btn">${ic('send', 'w-5 h-5')}</button>
        </div>
        <input id="fileImg" type="file" accept="image/*" multiple class="hidden"><input id="fileVid" type="file" accept="video/*" multiple class="hidden"><input id="fileDoc" type="file" multiple class="hidden"><input id="fileCam" type="file" accept="image/*" capture="environment" class="hidden">
      </div>`;
    $('#backBtn').onclick = N.closeChat;
    $('#headInfo').onclick = showInfo;
    $('#vcBtn').onclick = () => N.startCall('video'); $('#acBtn').onclick = () => N.startCall('audio');
    $('#unblockBtn').onclick = () => { const c = curChat(), o = c && N.chatInfo(c).other; if (o) N.toggleBlock(o.uid); };
    $('#moreBtn').onclick = e => { if (popEl && popAnchor === e.currentTarget) return closePop(); const r = e.currentTarget.getBoundingClientRect(); const c = curChat(); const it = [{ icon: 'search', text: 'Search', fn: toggleSearch }, { icon: 'image', text: 'Chat wallpaper', fn: wallpaperModal }, { icon: 'users', text: c && c.type === 'group' ? 'Group info' : 'Contact info', fn: showInfo }];
      if (c) {
        const o0 = otherOf(c), cp = cfg.chat(c.id);
        if (o0 && !isAI(c) && N.feature('fFav')) it.push({ icon: 'star', text: cfg.isFav(o0) ? 'Remove from favorites' : 'Add to favorites', fn: () => toggleFav(o0) });
        if (N.feature('fSummary') && N.catchUpNow) it.push({ icon: 'sparkle', text: 'Summarize this chat', fn: () => N.catchUpNow(c.id) });
        if (N.feature('fDisappear') && !isAI(c)) it.push({ icon: 'clock', text: 'Disappearing messages' + (c.disappear ? ' · ' + disLabel(c.disappear) : ''), fn: () => disappearModal(c) });
        it.push({ icon: cp.mute ? 'bell' : 'belloff', text: cp.mute ? 'Unmute notifications' : 'Mute notifications', fn: () => { cfg.setChat(c.id, { mute: !cp.mute }); toast(cp.mute ? 'Notifications on' : 'Chat muted — no sound or pop-ups'); N.renderList(); } });
        if (N.chatSoundsModal) it.push({ icon: 'volume', text: 'Chat sounds & ringtone', fn: () => N.chatSoundsModal(c.id) });
      }
      if (c && c.type === 'group') it.push({ icon: 'link', text: 'Copy invite link', fn: async () => { await N.copy(N.inviteLink(c.invite)); toast('Invite link copied'); } });
      if (c) { const o = c.type === 'dm' && N.chatInfo(c).other; if (o) it.push({ icon: 'ban', text: N.isBlocked(o.uid) ? 'Unblock ' + (o.username || 'user') : 'Block ' + (o.username || 'user'), danger: !N.isBlocked(o.uid), fn: () => N.toggleBlock(o.uid) });
        it.push({ icon: N.isLocked(c.id) ? 'unlock' : 'lock', text: N.isLocked(c.id) ? 'Remove chat lock' : 'Lock chat with PIN', fn: () => N.toggleLock(c.id) }); }
      openPop(it, r.right - 230, r.bottom + 6); mark(e.currentTarget); };
    $('#moreBtn').dataset.ptrig = 1; $('#attachBtn').dataset.ptrig = 1;
    $('#searchBtn').onclick = toggleSearch; $('#searchClose').onclick = toggleSearch;
    $('#inSearch').oninput = e => { S.inChatQ = e.target.value; N.renderMessages(); };
    $('#pinBar').onclick = jumpPin;
    const inp = $('#msgInput');
    inp.oninput = () => { inp.value.trim() ? sendAct('typing') : sendAct(null); clearTimeout(actTimer); actTimer = setTimeout(() => sendAct(null), 4500); inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 128) + 'px'; updateSendIcon(); try { inp.value ? localStorage.setItem(draftKey(), inp.value) : localStorage.removeItem(draftKey()); } catch (e) { } };
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); if (inp.value.trim()) $('#composer').requestSubmit(); } };
    $('#composer').onsubmit = onSubmit;
    $('#emojiBtn').onclick = e => { toggleEmojiPicker(e.currentTarget); mark(e.currentTarget); };
    $('#attachBtn').onclick = e => { if (popEl && popAnchor === e.currentTarget) return closePop(); const r = e.currentTarget.getBoundingClientRect(); const items = [{ icon: 'image', text: 'Photos', fn: () => $('#fileImg').click() }, { icon: 'camera', text: 'Camera', fn: () => $('#fileCam').click() }, { icon: 'video', text: 'Video', fn: () => $('#fileVid').click() }, { icon: 'file', text: 'Document', fn: () => $('#fileDoc').click() }, { icon: 'poll', text: 'Poll', fn: pollModal }];
      if (N.feature('fMini') && N.miniMenu && !isAI(curChat())) items.push(...N.miniMenu());
      openPop(items, r.left, Math.max(8, r.top - 46 * items.length - 14)); mark(e.currentTarget); };
    $('#fileImg').onchange = e => { imagePreview([...e.target.files]); e.target.value = ''; };
    $('#fileCam').onchange = e => { imagePreview([...e.target.files]); e.target.value = ''; };
    $('#fileVid').onchange = e => { sendFiles([...e.target.files], 'video'); e.target.value = ''; };
    $('#fileDoc').onchange = e => { sendFiles([...e.target.files], 'file'); e.target.value = ''; };
    $('#recCancel').onclick = () => stopRec(false); $('#recSend').onclick = () => stopRec(true);
    const box = $('#msgs');
    box.addEventListener('click', onMsgClick);
    box.addEventListener('contextmenu', e => { const row = e.target.closest('[data-id]'); if (row) { e.preventDefault(); openMsgMenu(row.dataset.id, e.clientX, e.clientY); } });
    try { const d = localStorage.getItem(draftKey()); if (d) { inp.value = d; inp.dispatchEvent(new Event('input')); } } catch (e) { }
    applyWallpaper(); N.renderHeader(); updateSendIcon();
    N.watchDrop && N.watchDrop();
  }
  const curChat = () => S.chats.find(c => c.id === S.activeId);
  function updateSendIcon() {
    const b = $('#sendBtn'), v = $('#msgInput'); if (!b) return;
    const has = v.value.trim().length > 0; if (b.dataset.mode && b.dataset.mode !== (has ? 'send' : 'mic')) { b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap'); } b.innerHTML = ic(has ? 'send' : 'mic', 'w-5 h-5'); b.title = has ? 'Send' : 'Record voice message'; b.dataset.mode = has ? 'send' : 'mic';
  }
  N.renderHeader = function () {
    const c = curChat(), h = $('#chatHead'); if (!c || !h) return;
    const info = N.chatInfo(c);
    $('[data-h=img]', h).src = info.photo; $('[data-h=name]', h).textContent = info.name;
    const act = N.activityText(c, true), sub = $('[data-h=sub]', h);
    let base;
    if (info.group) { const on = c.members.filter(m => m !== S.me.uid && S.users[m] && !N.isBlocked(m) && N.presence(S.users[m]) === 'online').length; base = on + ' ' + N.t('online') + ' · ' + c.members.length + ' ' + (N.t('members') || 'members'); }
    else if (isAI(c)) base = N.t('online') + ' · AI assistant';
    else { const o = info.other || {}; base = N.blockedMe(o) ? '' : N.presence(o) + (N.feature('fMood') && o.mood && o.mood.t ? ' · ' + (o.mood.e || '') + ' ' + o.mood.t : ''); if (base.startsWith('online')) base = N.t('online') + base.slice(6); }
    if (c.disappear && N.feature('fDisappear')) base += ' · ⏱ ' + disLabel(c.disappear);
    const key = act ? 'a:' + act : 't:' + base;
    if (sub.dataset.k !== key) {
      sub.dataset.k = key;
      if (act) { sub.innerHTML = `<span class="act-line font-semibold text-royal dark:text-gold">${esc(act.replace('…', ''))}<span class="act-dots"><i></i><i></i><i></i></span></span>`; }
      else sub.textContent = key.slice(2);
    }
    applyBlockState();
  };
  function applyBlockState() {
    const c = curChat(), cmp = $('#composer'), bar = $('#blockBar'); if (!c || !cmp || !bar) return;
    const o = c.type === 'dm' && N.chatInfo(c).other, blk = !!(o && N.isBlocked(o.uid));
    bar.classList.toggle('hidden', !blk); bar.classList.toggle('flex', blk);
    if (blk) { cmp.classList.add('hidden'); $('#blockTxt').textContent = 'You blocked ' + (o.username || 'this user') + '. They can’t reach you.'; stopRec(false); }
    else if (!rec) cmp.classList.remove('hidden');
    ['vcBtn', 'acBtn'].forEach(i => { const b = $('#' + i); if (b) { b.disabled = blk; b.classList.toggle('opacity-40', blk); b.classList.toggle('hidden', isAI(c)); } });
  }

  /* ---- live activity signal (typing / voice) ---- */
  let actKind = null, actSent = 0, actCid = null, actTimer = 0;
  function sendAct(kind) {
    if (!S.me || (kind && kind !== 'voice' && cfg.get('hideTyping'))) return;
    if (kind) { const cid = S.activeId; if (!cid) return; const now = Date.now(); if (actKind === kind && actCid === cid && now - actSent < 2500) return; actKind = kind; actCid = cid; actSent = now; B.setActivity(cid, S.me.uid, kind).catch(() => { }); }
    else if (actKind) { const cid = actCid; actKind = null; actCid = null; B.setActivity(cid, S.me.uid, null).catch(() => { }); }
  }
  /* typing bubble (3 moving dots) at the end of the conversation */
  N.renderTyping = function () {
    const box = $('#msgs'), c = curChat(); if (!box || !c) return;
    const a = N.activity(c), old = $('#typingRow', box), key = a ? a.kind + a.uid : '';
    if (old && old.dataset.k === key) return; if (old) old.remove(); if (!a) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 200;
    const icon = a.kind === 'voice' ? ic('mic', 'w-4 h-4') : a.kind === 'calling' ? `<span class="ringing inline-flex">${ic('phone', 'w-4 h-4')}</span>` : '';
    const row = el(`<div id="typingRow" data-k="${esc(key)}" class="flex items-end px-3 py-1 typing-in">${c.type === 'group' ? `<img class="w-8 h-8 rounded-xl object-cover mr-1.5 mb-0.5" src="${esc(N.avatar(S.users[a.uid]))}">` : ''}
      <div class="typing-bubble" title="${esc(N.activityText(c, true))}">${c.type === 'group' ? `<span class="text-[11px] font-bold mr-1 text-royal dark:text-gold">${esc(nameOf(a.uid))}</span>` : ''}${icon ? `<span class="text-royal dark:text-gold mr-0.5">${icon}</span>` : ''}<i></i><i></i><i></i></div></div>`);
    box.append(row); if (near) box.scrollTop = box.scrollHeight;
  };
  /* mark the open chat as read → the sender's ticks turn green */
  const marked = {};
  N.markSeen = function () {
    const c = curChat(); if (!c || !S.me || document.visibilityState !== 'visible' || N.isLocked(c.id) && !N.isUnlocked(c.id)) return;
    let newest = 0; S.msgs.forEach(m => { if (m.from !== S.me.uid && !m.hidden && m.type !== 'system' && m.ts > newest) newest = m.ts; });
    if (!newest || newest <= ((c.reads && c.reads[S.me.uid]) || 0) || newest <= (marked[c.id] || 0)) return;
    marked[c.id] = newest; B.markRead(c.id, S.me.uid, !!cfg.get('ghost')).catch(() => { });
  };
  document.addEventListener('visibilitychange', () => N.markSeen && N.markSeen());
  window.addEventListener('focus', () => N.markSeen && N.markSeen());
  let lastActKey = '';
  setInterval(() => {
    if (!S.me) return; N.renderHeader(); N.renderTyping();
    const k = S.chats.map(c => { const a = N.activity(c); return a ? c.id + a.kind : ''; }).join('|'); if (k !== lastActKey) { lastActKey = k; N.renderList(); }
  }, 1500);
  function toggleSearch() {
    const bar = $('#searchBar'), show = bar.classList.contains('hidden');
    bar.classList.toggle('hidden', !show); bar.classList.toggle('flex', show); $('#searchBtn').classList.toggle('on', show);
    if (show) $('#inSearch').focus(); else { S.inChatQ = ''; $('#inSearch').value = ''; $('#inCount').textContent = ''; N.renderMessages(); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const inp = $('#msgInput'), text = inp.value.trim();
    if (!text) { return startRec(); }
    sendAct(null); clearTimeout(actTimer); inp.value = ''; inp.style.height = 'auto'; updateSendIcon(); try { localStorage.removeItem(draftKey()); } catch (e) { }
    const cid = S.activeId;
    try { await B.sendMessage(cid, { from: S.me.uid, type: 'text', text }); N.sfx && N.sfx.sent(); if (N.afterSend) N.afterSend(cid, text); } catch (er) { toast(N.friendly(er)); inp.value = text; }
  }

  /* ------------------------------------------------------------------ MESSAGES */
  const linkify = s => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline break-all">$1</a>');
  const hl = (t, q) => {
    let s = linkify(esc(t));
    if (q) { const e = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); s = s.replace(new RegExp('(' + e + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>'); }
    return s;
  };
  const nameOf = uid => (S.users[uid] || {}).username || 'Someone';
  const fmtSize = n => !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const extOf = name => (String(name || '').includes('.') ? String(name).split('.').pop() : 'FILE').slice(0, 4).toUpperCase();
  const fmtDur = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function bodyHTML(m, q) {
    if (m.deleted) return `<div class="italic opacity-75 flex items-center gap-1.5">${ic('ban', 'w-4 h-4')} This message was deleted</div>`;
    if (m.type === 'image') {
      const imgs = m.images || [], one = imgs.length === 1;
      return `<div class="${one ? 'w-[240px] sm:w-[280px]' : 'grid grid-cols-2 gap-1 w-[240px] sm:w-[280px]'} mb-1">${imgs.map(i => `<img class="chat-img" data-media="${esc(i.url)}" style="aspect-ratio:${one ? (i.w || 4) + '/' + (i.h || 3) : '1/1'}" alt="photo">`).join('')}</div>${m.text ? `<div class="whitespace-pre-wrap">${hl(m.text, q)}</div>` : ''}`;
    }
    if (m.type === 'sticker' && m.sticker) return N.stickerHTML(m.sticker.e, m.sticker.a, m.sticker.c);
    if (m.type === 'gif' && m.gif) return `<img class="gif-img" src="${esc(m.gif.url)}" alt="${esc(m.gif.t || 'GIF')}" style="aspect-ratio:${m.gif.w || 4}/${m.gif.h || 3}" loading="lazy">`;
    if (m.type === 'video') return `<div class="w-[240px] sm:w-[300px] mb-1"><button class="vid-load" data-vload="${esc(m.id)}"><span class="vid-play">${ic('play', 'w-6 h-6')}</span><span class="vid-meta">${esc(m.name || 'Video')}${m.size ? ' · ' + fmtSize(m.size) : ''}</span></button></div>${m.text ? `<div class="whitespace-pre-wrap">${hl(m.text, q)}</div>` : ''}`;
    if (m.type === 'file') return `<div class="file-card flex items-center gap-3 w-[240px] sm:w-[290px]" data-fdl="${esc(m.id)}"><div class="file-ic">${esc(extOf(m.name))}</div><div class="flex-1 min-w-0"><div class="font-semibold truncate">${hl(m.name || 'Document', q)}</div><div class="text-xs opacity-75">${fmtSize(m.size) || 'File'}</div></div><span class="file-dl">${ic('download', 'w-5 h-5')}</span></div>`;
    if (['note', 'code', 'expense'].includes(m.type) && N.miniBody) return N.miniBody(m, q);
    if (m.type === 'voice') {
      const wave = (m.wave && m.wave.length ? m.wave : Array.from({ length: 36 }, (_, i) => 20 + (i * 37 % 60)));
      return `<div class="flex items-center gap-2 w-[230px] sm:w-[260px]"><button class="vplay w-10 h-10 rounded-full bg-gold text-onyx flex items-center justify-center shrink-0" data-v="${esc(m.id)}">${ic('play', 'w-4 h-4')}</button>
        <div class="flex-1 min-w-0"><div class="vbars" data-vb="${esc(m.id)}">${wave.map(h => `<i style="height:${Math.max(8, h)}%"></i>`).join('')}</div><div class="text-[10px] opacity-75 -mt-0.5" data-vt="${esc(m.id)}">${fmtDur(m.dur)}</div></div></div>${m.transcript ? `<button class="vtx-btn" data-vtx>${ic('type', 'w-3.5 h-3.5')}<span>Transcript</span></button><div class="vtx hidden">${esc(m.transcript)}</div>` : ''}`;
    }
    if (m.type === 'poll') {
      const p = m.poll, total = p.options.reduce((n, o) => n + o.votes.length, 0), voters = new Set(p.options.flatMap(o => o.votes)).size;
      return `<div class="w-[240px] sm:w-[290px]"><div class="font-bold mb-0.5 flex gap-1.5">${ic('poll', 'w-4 h-4 mt-1 shrink-0')}<span>${hl(p.q, q)}</span></div><div class="text-[11px] opacity-75 mb-2">${p.multi ? 'Select one or more' : 'Select one'}</div>
        ${p.options.map(o => { const n = o.votes.length, mine = o.votes.includes(S.me.uid), pct = total ? Math.round(n / total * 100) : 0;
          return `<button class="poll-opt block w-full text-left mb-2" data-opt="${esc(o.id)}"><div class="flex justify-between gap-2 text-sm"><span class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${mine ? 'bg-gold border-gold text-onyx' : 'border-current opacity-70'}">${mine ? ic('check', 'w-3 h-3') : ''}</span>${esc(o.text)}</span><span class="font-semibold">${n}</span></div>
          <div class="h-1.5 rounded-full bg-onyx/20 dark:bg-snow/20 mt-1 overflow-hidden"><div class="h-full rounded-full bg-gold transition-all duration-500" style="width:${pct}%"></div></div></button>`; }).join('')}
        <div class="text-[11px] opacity-75">${voters} ${voters === 1 ? 'voter' : 'voters'} · live results</div></div>`;
    }
    return `<div class="whitespace-pre-wrap">${hl(m.text || '', q)}</div>`;
  }

  function reactsHTML(m, mine) {
    const rs = Object.entries(m.reactions || {}).filter(([, a]) => a && a.length);
    if (m.deleted || !rs.length) return '';
    return `<div class="reacts ${mine ? 'justify-end' : ''}">${rs.map(([e, a]) => `<button class="react-chip ${a.includes(S.me.uid) ? 'mine' : ''}" data-e="${esc(e)}" title="${esc(a.map(nameOf).join(', '))}"><span>${esc(e)}</span>${a.length > 1 ? `<b>${a.length}</b>` : ''}</button>`).join('')}</div>`;
  }

  function buildMsg(m, chat, q, rc) {
    if (m.type === 'system' || m.type === 'call') {
      return el(`<div class="flex justify-center px-3 py-1" data-id="${esc(m.id)}"><span class="text-xs px-3 py-1 rounded-full bg-[var(--panel)] text-[var(--muted)] shadow-sm border border-[var(--border)]">${m.type === 'call' ? '📞 ' : ''}${esc(m.text)}</span></div>`);
    }
    const mine = m.from === S.me.uid, grp = chat.type === 'group', sender = S.users[m.from];
    const bare = (m.type === 'sticker' || m.type === 'gif') && !m.deleted, bubbleCls = bare ? 'bubble-bare' : mine ? 'bubble-out text-onyx' : 'bg-[var(--bubble-in)] text-[var(--text)] border border-[var(--border)]';
    const rbtn = m.deleted ? '' : `<button class="rbtn" data-react title="React">${ic('smile', 'w-4 h-4')}</button>`;
    const av = `<img class="msg-av" src="${esc(N.avatar(sender))}" alt="">`;
    const tick = mine && !m.deleted ? (N.seen(chat, m) ? `<span class="tick seen" title="Seen">${ic('ticks', 'w-4 h-4')}</span>` : `<span class="tick" title="Sent">${ic('tick', 'w-4 h-4')}</span>`) : '';
    const meta = `<div class="msg-meta ${mine ? 'items-end' : 'items-start'}"><span class="flex items-center gap-1">${m.exp && !m.deleted ? `<span title="Disappearing message">${ic('clock', 'w-3 h-3')}</span>` : ''}${m.pinned && !m.deleted ? ic('pin', 'w-3 h-3') : ''}${N.timeStr(m.ts)}</span>${tick}</div>`;
    const thread = rc && !m.deleted && N.feature('fThreads') ? `<button class="thread-chip" data-thread="${esc(m.id)}">${ic('thread', 'w-3.5 h-3.5')}<span>${rc} ${rc === 1 ? 'reply' : 'replies'}</span></button>` : '';
    const node = el(`<div class="msg-row flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} px-3 py-1" data-id="${esc(m.id)}">
      ${av}
      <div class="flex flex-col ${mine ? 'items-end' : 'items-start'} min-w-0 max-w-[78%] md:max-w-[62%]">
        ${grp && !mine ? `<div class="text-xs font-bold mb-0.5 px-2 ${U.hash(m.from) % 2 ? 'text-gold' : 'text-onyx dark:text-pastel'}">${esc(nameOf(m.from))}</div>` : ''}
        <div class="flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''} max-w-full">
          <div class="bubble relative px-4 py-2.5 ${bubbleCls} min-w-0">
            ${m.fwd && !m.deleted ? `<div class="text-[11px] italic opacity-75 flex items-center gap-1 mb-0.5">${ic('forward', 'w-3 h-3')} Forwarded</div>` : ''}
            ${bodyHTML(m, q)}
            <button class="mbtn" data-menu title="Actions">${ic('chev', 'w-4 h-4')}</button>
          </div>${meta}
        </div>
        ${thread}${reactsHTML(m, mine)}
      </div>
      ${rbtn}</div>`);
    N.hydrate(node); return node;
  }

  N.renderMessages = function () {
    const box = $('#msgs'), chat = curChat(); if (!box || !chat) return;
    const q = S.inChatQ.trim().toLowerCase();
    const now = Date.now(), replies = {}; S.msgs.forEach(m => { if (m.threadOf && !m.deleted && !(m.exp && m.exp <= now)) replies[m.threadOf] = (replies[m.threadOf] || 0) + 1; });
    let list = S.msgs.filter(m => !(m.deletedFor || []).includes(S.me.uid) && !(m.hidden && m.from !== S.me.uid) && !(m.exp && m.exp <= now) && (q || !m.threadOf || !N.feature('fThreads')));
    if (q) list = list.filter(m => !m.deleted && m.type !== 'system' && m.type !== 'call' && ((m.text || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q) || nameOf(m.from).toLowerCase().includes(q) || (m.poll && m.poll.q.toLowerCase().includes(q))));
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 160, first = !box.dataset.loaded;
    const cache = box._cache || (box._cache = new Map()), frag = document.createDocumentFragment(), seen = new Set(); let lastDay = '';
    list.forEach(m => {
      const d = new Date(m.ts).toDateString();
      if (d !== lastDay) { lastDay = d; frag.append(el(`<div class="flex justify-center py-2"><span class="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--panel)] text-[var(--muted)] border border-[var(--border)] shadow-sm">${N.dayLabel(m.ts)}</span></div>`)); }
      const sig = JSON.stringify([m, q, chat.type, nameOf(m.from), N.seen(chat, m), replies[m.id] || 0, (S.users[m.from] || {}).photo ? 1 : 0]); let c = cache.get(m.id);
      if (!c || c.sig !== sig) { const isNew = !c; c = { sig, node: buildMsg(m, chat, q, replies[m.id] || 0) }; if (isNew && !first && !q && m.ts > Date.now() - 15000) c.node.classList.add('msg-in'); cache.set(m.id, c); }
      seen.add(m.id); frag.append(c.node);
    });
    for (const k of Array.from(cache.keys())) if (!seen.has(k)) cache.delete(k);
    if (!list.length) frag.append(el(`<div class="h-full flex items-center justify-center p-8"><div class="text-center text-sm px-4 py-3 rounded-2xl bg-[var(--panel)] text-[var(--muted)] shadow">${q ? 'No messages match your search.' : (isAI(chat) ? 'Say hello to your assistant ✨' : 'No messages yet — say hi! 👋')}</div></div>`));
    const tr = $('#typingRow', box); box.replaceChildren(frag); if (tr) box.append(tr);
    const cnt = $('#inCount'); if (cnt) cnt.textContent = q ? list.length + ' found' : '';
    const lastM = list[list.length - 1];
    if (first || (near && !q) || (lastM && lastM.from === S.me.uid && !q)) box.scrollTop = box.scrollHeight;
    box.dataset.loaded = '1'; N.renderTyping(); N.markSeen();
  };

  N.renderPinned = function () {
    const bar = $('#pinBar'); if (!bar) return;
    const pins = S.msgs.filter(m => m.pinned && !m.deleted && !(m.deletedFor || []).includes(S.me.uid));
    if (!pins.length) { bar.classList.add('hidden'); bar.classList.remove('flex'); return; }
    pinIdx = pinIdx % pins.length; const m = pins[pinIdx];
    const label = m.type === 'text' ? m.text : U.previewOf(m);
    bar.classList.remove('hidden'); bar.classList.add('flex');
    bar.innerHTML = `<span class="text-royal dark:text-gold">${ic('pin', 'w-4 h-4')}</span><div class="flex-1 min-w-0"><div class="text-[11px] font-bold text-royal dark:text-gold">Pinned${pins.length > 1 ? ' · ' + (pinIdx + 1) + ' of ' + pins.length : ''}</div><div class="truncate">${esc(label)}</div></div>`;
  };
  function jumpPin() {
    const pins = S.msgs.filter(m => m.pinned && !m.deleted && !(m.deletedFor || []).includes(S.me.uid)); if (!pins.length) return;
    const m = pins[pinIdx % pins.length], row = $(`[data-id="${CSS.escape(m.id)}"]`, $('#msgs'));
    if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1500); }
    pinIdx = (pinIdx + 1) % pins.length; N.renderPinned();
  }

  /* ------------------------------------------------------------------ MESSAGE EVENTS */
  const players = new Map(); let curPlay = null;
  function onMsgClick(e) {
    const row = e.target.closest('[data-id]'); if (!row) return; const id = row.dataset.id;
    const mb = e.target.closest('[data-menu]'); if (mb) { if (popEl && popAnchor === mb) return closePop(); const r = mb.getBoundingClientRect(); openMsgMenu(id, r.right - 200, r.bottom + 4); mark(mb); return; }
    const th = e.target.closest('[data-thread]'); if (th) return N.openThread(th.dataset.thread);
    const tx = e.target.closest('[data-vtx]'); if (tx) { const t = tx.nextElementSibling; if (t) t.classList.toggle('hidden'); return; }
    if (N.miniClick && N.miniClick(e, id)) return;
    const chip = e.target.closest('.react-chip'); if (chip) return doReact(S.activeId, id, chip.dataset.e);
    const rb = e.target.closest('[data-react]'); if (rb) return openReactBar(id, rb.getBoundingClientRect());
    const vl = e.target.closest('[data-vload]'); if (vl) return loadVideo(id, vl);
    const fd = e.target.closest('[data-fdl]'); if (fd) return downloadFile(id);
    if (e.target.closest('.vplay')) return togglePlay(id);
    const po = e.target.closest('.poll-opt'); if (po) return B.votePoll(S.activeId, id, S.me.uid, po.dataset.opt).catch(er => toast(N.friendly(er)));
    const im = e.target.closest('.chat-img'); if (im && im.src) return lightbox(im.src);
  }
  async function togglePlay(id) {
    const m = S.msgs.find(x => x.id === id); if (!m) return;
    let a = players.get(id);
    if (!a) {
      a = new Audio(); a.preload = 'auto'; players.set(id, a);
      a.src = await U.mediaURL(m.media);
      a.ontimeupdate = () => { const d = m.dur || a.duration || 1; paintVoice(id, Math.min(1, a.currentTime / d), a.currentTime); };
      a.onended = () => { paintVoice(id, 0, 0, true); curPlay = null; };
      a.onpause = () => setPlayIcon(id, false); a.onplay = () => setPlayIcon(id, true);
    }
    if (curPlay && curPlay !== a) { curPlay.pause(); }
    if (a.paused) { curPlay = a; try { await a.play(); } catch (er) { toast('Could not play audio'); } } else a.pause();
  }
  function setPlayIcon(id, playing) { const b = $(`.vplay[data-v="${CSS.escape(id)}"]`); if (b) b.innerHTML = ic(playing ? 'pause' : 'play', 'w-4 h-4'); }
  function paintVoice(id, frac, t, reset) {
    const bars = $(`[data-vb="${CSS.escape(id)}"]`); if (!bars) return;
    const kids = bars.children, n = Math.round(kids.length * frac);
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i < n);
    const m = S.msgs.find(x => x.id === id), tl = $(`[data-vt="${CSS.escape(id)}"]`);
    if (tl) tl.textContent = reset ? fmtDur(m && m.dur) : fmtDur(t);
    if (reset) setPlayIcon(id, false);
  }

  /* pop menu */
  let popEl = null;
  let popAnchor = null;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } if (popAnchor) { popAnchor.classList.remove('on'); popAnchor = null; } }
  function mark(btn) { if (btn && popEl) { popAnchor = btn; btn.classList.add('on'); } }
  N.openPop = (items, x, y, btn) => { openPop(items, x, y); if (btn) mark(btn); };
  N.closePop = () => closePop();
  function openPop(items, x, y) {
    closePop();
    popEl = el(`<div class="menu-pop">${items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${ic(it.icon, 'w-4 h-4')}${esc(it.text)}</button>`).join('')}</div>`);
    document.body.append(popEl);
    const r = popEl.getBoundingClientRect();
    popEl.style.left = N.clamp(x, 8, innerWidth - r.width - 8) + 'px'; popEl.style.top = N.clamp(y, 8, innerHeight - r.height - 8) + 'px';
    popEl.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; closePop(); it.fn(); });
  }
  let anchorDown = 0;
  document.addEventListener('mousedown', e => { if (e.target.closest('[data-menu],[data-emoji-btn],[data-react],[data-ptrig]')) anchorDown = Date.now(); if (popEl && !popEl.contains(e.target) && !e.target.closest('[data-menu],[data-emoji-btn],[data-react],[data-ptrig]')) closePop(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  document.addEventListener('scroll', e => { if ((popEl && popEl.contains(e.target)) || e.target === document || Date.now() - anchorDown < 700) return; closePop(); }, true);

  /* ---------------- emoji picker + reactions ---------------- */
  const QUICK = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
  const CATS = [
    { icon: '😀', list: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖' },
    { icon: '👍', list: '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤏 💪 🙏 🤝 👏 🙌 👐 🤲 ✍️ 💅 🤳 🫶 🫡 🫰 👀 🧠 👂 👃 👄' },
    { icon: '❤️', list: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💋 💯 💢 💥 💫 💦 💨 🔥 ✨ 🌟 ⭐ 🎉 🎊 🎈' },
    { icon: '🐶', list: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦅 🦉 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🐠 🐬 🐳 🌸 🌹 🌻 🌼 🌲 🌴 🍀 🌍 🌙 ☀️ ⛅ 🌈 ⚡ ❄️ 🌊' },
    { icon: '🍕', list: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🌽 🥕 🍞 🧀 🥚 🍳 🥓 🍔 🍟 🍕 🌭 🌮 🌯 🍝 🍜 🍣 🍩 🍪 🎂 🍰 🍫 🍬 🍭 ☕ 🍵 🥤 🍺 🍷 🥂' },
    { icon: '⚽', list: '⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎮 🎯 🎲 🎵 🎶 🎤 🎧 🎸 🎬 📷 📱 💻 ⌚ 💡 🔑 🔒 🎁 🏆 🥇 🚗 ✈️ 🚀 🏠 📚 ✏️ 💼 💰 ⏰ 📌 🔔' },
    { icon: '✅', list: '✅ ❌ ❓ ❗ ‼️ ⚠️ ➕ ➖ ✔️ ☑️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ➡️ ⬅️ ⬆️ ⬇️ 🔁 🔄 🆗 🆒 🆕 🔝 💤 🚫 ⭕' }
  ].map(c => ({ icon: c.icon, list: c.list.split(' ') }));

  function placeNear(node, rect) {
    const r = { width: node.offsetWidth, height: node.offsetHeight };
    const left = N.clamp(rect.left + (rect.width || 0) / 2 - r.width / 2, 8, innerWidth - r.width - 8);
    let top = rect.top - r.height - 8; if (top < 8) top = Math.min(rect.bottom + 8, innerHeight - r.height - 8);
    node.style.left = left + 'px'; node.style.top = Math.max(8, top) + 'px';
  }
  const doReact = (cid, mid, emoji) => B.react(cid, mid, S.me.uid, emoji).catch(er => toast(N.friendly(er)));

  function openEmojiPicker(rect, onPick, keep) {
    closePop();
    popEl = el(`<div class="menu-pop emoji-pop" data-kind="emoji"><div class="emoji-tabs">${CATS.map((c, i) => `<button type="button" data-cat="${i}" class="${i === 0 ? 'on' : ''}">${c.icon}</button>`).join('')}</div><div class="emoji-grid"></div></div>`);
    const grid = popEl.querySelector('.emoji-grid');
    const draw = i => { grid.innerHTML = CATS[i].list.map(ch => `<button type="button" data-ch="${ch}">${ch}</button>`).join(''); grid.scrollTop = 0; $$('[data-cat]', popEl).forEach(b => b.classList.toggle('on', +b.dataset.cat === i)); };
    draw(0);
    popEl.addEventListener('click', e => {
      const t = e.target.closest('[data-cat]'); if (t) return draw(+t.dataset.cat);
      const b = e.target.closest('[data-ch]'); if (b) { onPick(b.dataset.ch); if (!keep) closePop(); }
    });
    document.body.append(popEl); placeNear(popEl, rect);
  }
  function toggleEmojiPicker(btn) {
    if (popEl && popEl.dataset.kind === 'emoji') return closePop();
    openRichPicker(btn.getBoundingClientRect());
  }
  /* tabbed picker: Emoji · Stickers · GIFs (with search) */
  function openRichPicker(rect) {
    closePop(); let tab = localStorage.getItem('qb_picker') || 'emoji', cat = 0, gq = '', gt = 0;
    popEl = el(`<div class="menu-pop emoji-pop rich-pop" data-kind="emoji"><div class="rp-tabs"><button type="button" data-rt="emoji">${ic('smile', 'w-4 h-4')}<span>Emoji</span></button><button type="button" data-rt="sticker">${ic('sparkle', 'w-4 h-4')}<span>Stickers</span></button><button type="button" data-rt="gif"><b class="gifmark">GIF</b></button></div><div class="rp-body"></div></div>`);
    const body = popEl.querySelector('.rp-body');
    const mark = () => $$('[data-rt]', popEl).forEach(b => b.classList.toggle('on', b.dataset.rt === tab));
    const draw = async () => {
      mark(); try { localStorage.setItem('qb_picker', tab); } catch (e) { }
      if (tab === 'emoji') {
        body.innerHTML = `<div class="emoji-tabs">${CATS.map((c, i) => `<button type="button" data-cat="${i}" class="${i === cat ? 'on' : ''}">${c.icon}</button>`).join('')}</div><div class="emoji-grid">${CATS[cat].list.map(ch => `<button type="button" data-ch="${ch}">${ch}</button>`).join('')}</div>`;
      } else if (tab === 'sticker') {
        body.innerHTML = `<div class="stk-grid">${(N.STICKERS || []).map((s, i) => `<button type="button" data-st="${i}" title="${esc(s.c)}">${N.stickerHTML(s.e, s.a, '', 'sm')}</button>`).join('')}</div>`;
      } else {
        body.innerHTML = `<div class="p-1"><input class="field !py-2 text-sm gif-q" placeholder="Search GIFs…" value="${esc(gq)}" autocomplete="off"></div><div class="gif-grid"><div class="col-span-2 text-center text-sm text-[var(--muted)] p-4">Loading…</div></div>`;
        const my = ++gt, list = await N.gifSearch(gq); if (my !== gt || !popEl) return;
        const g = body.querySelector('.gif-grid'); if (!g) return;
        g._list = list; if (popEl) placeNear(popEl, rect); g.innerHTML = list.length ? list.map((x, i) => `<button type="button" data-gif="${i}"><img src="${esc(x.url)}" alt="${esc(x.title || 'GIF')}" loading="lazy"></button>`).join('') : '<div class="col-span-2 text-center text-sm text-[var(--muted)] p-4">No GIFs found — try another word</div>';
        if (popEl) placeNear(popEl, rect);
      }
      if (N.i18nApply) N.i18nApply(popEl);
      if (popEl) placeNear(popEl, rect);
    };
    popEl.addEventListener('click', e => {
      const rt = e.target.closest('[data-rt]'); if (rt) { tab = rt.dataset.rt; return draw(); }
      const ct = e.target.closest('[data-cat]'); if (ct) { cat = +ct.dataset.cat; return draw(); }
      const ch = e.target.closest('[data-ch]'); if (ch) return insertEmoji(ch.dataset.ch);
      const st = e.target.closest('[data-st]'); if (st) { const s = N.STICKERS[+st.dataset.st]; closePop(); return sendRich({ type: 'sticker', sticker: { e: s.e, a: s.a, c: s.c } }); }
      const gf = e.target.closest('[data-gif]'); if (gf) { const x = body.querySelector('.gif-grid')._list[+gf.dataset.gif]; closePop(); return sendRich({ type: 'gif', gif: { url: x.url, w: x.w, h: x.h, t: x.title || '' } }); }
    });
    popEl.addEventListener('input', e => { if (e.target.classList.contains('gif-q')) { gq = e.target.value; clearTimeout(popEl._t); popEl._t = setTimeout(() => { const f = body.querySelector('.gif-q'); draw().then(() => { const n = body.querySelector('.gif-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); }, 350); } });
    document.body.append(popEl); draw();
  }
  async function sendRich(payload) {
    const cid = S.activeId; if (!cid) return;
    try { await B.sendMessage(cid, Object.assign({ from: S.me.uid }, payload)); N.sfx && N.sfx.sent(); } catch (er) { toast(N.friendly(er)); }
  }
  function insertEmoji(ch) {
    const inp = $('#msgInput'); if (!inp) return;
    const s = inp.selectionStart == null ? inp.value.length : inp.selectionStart, e = inp.selectionEnd == null ? s : inp.selectionEnd;
    inp.value = inp.value.slice(0, s) + ch + inp.value.slice(e);
    const pos = s + ch.length; try { inp.setSelectionRange(pos, pos); } catch (er) { }
    inp.dispatchEvent(new Event('input'));
    if (matchMedia('(pointer:fine)').matches) inp.focus();
  }
  function openReactBar(id, rect) {
    if (popEl && popEl.dataset.kind === 'react' && popEl.dataset.mid === id) return closePop();
    closePop();
    const cid = S.activeId, m = S.msgs.find(x => x.id === id), mineE = m && Object.keys(m.reactions || {}).find(k => (m.reactions[k] || []).includes(S.me.uid));
    popEl = el(`<div class="menu-pop react-bar" data-kind="react" data-mid="${esc(id)}">${QUICK.map(e => `<button type="button" data-e="${e}" class="${e === mineE ? 'on' : ''}">${e}</button>`).join('')}<button type="button" data-more class="more">${ic('plus', 'w-4 h-4')}</button></div>`);
    popEl.addEventListener('click', e => {
      const b = e.target.closest('[data-e]'); if (b) { closePop(); return doReact(cid, id, b.dataset.e); }
      if (e.target.closest('[data-more]')) { closePop(); openEmojiPicker(rect, ch => doReact(cid, id, ch), false); }
    });
    document.body.append(popEl); placeNear(popEl, rect);
  }

  function openMsgMenu(id, x, y) {
    const m = S.msgs.find(z => z.id === id); if (!m) return; const mine = m.from === S.me.uid, cid = S.activeId, it = [];
    if (!m.deleted) {
      it.push({ icon: 'smile', text: 'React', fn: () => openReactBar(id, { left: x, right: x, top: y, bottom: y, width: 0 }) });
      if (N.feature('fThreads') && !m.threadOf && m.type !== 'system') it.push({ icon: 'thread', text: 'Reply in thread', fn: () => N.openThread(id) });
      it.push({ icon: 'pin', text: m.pinned ? 'Unpin' : 'Pin', fn: () => B.togglePin(cid, id, !m.pinned).then(() => toast(m.pinned ? 'Unpinned' : 'Pinned')).catch(e => toast(N.friendly(e))) });
      it.push({ icon: 'forward', text: 'Forward', fn: () => forwardModal([m]) });
      it.push({ icon: 'share', text: 'Share', fn: () => shareMsg(m) });
      if (m.text) it.push({ icon: 'copy', text: 'Copy text', fn: async () => { await N.copy(m.text); toast('Copied'); } });
    }
    it.push({ icon: 'trash', text: 'Delete for me', danger: true, fn: async () => { if (await ask('Delete for me?', 'This removes the message only from your view. Others will still see it.', 'Delete for me')) B.deleteForMe(cid, id, S.me.uid).catch(e => toast(N.friendly(e))); } });
    if (mine && !m.deleted) it.push({ icon: 'trash', text: 'Delete for everyone', danger: true, fn: async () => { if (await ask('Delete for everyone?', 'Everyone in this chat will see “This message was deleted”.', 'Delete for everyone')) B.deleteForAll(cid, id).catch(e => toast(N.friendly(e))); } });
    openPop(it, x, y);
  }

  async function shareMsg(m) {
    const text = m.type === 'poll' ? `📊 ${m.poll.q}\n` + m.poll.options.map(o => '• ' + o.text).join('\n') : (m.text || (m.type === 'voice' ? '🎤 Voice message from QueenB.Chat' : (m.type === 'file' ? '📎 ' + (m.name || 'Document') : m.type === 'video' ? '🎬 Video from QueenB.Chat' : '📷 Photo from QueenB.Chat')));
    if (m.type === 'image' && m.images && m.images.length && navigator.canShare) {
      try { const u = await U.mediaURL(m.images[0].url), b = await (await fetch(u)).blob(), f = new File([b], 'photo.jpg', { type: b.type || 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: m.text || '' }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    }
    N.share('QueenB.Chat', text);
  }

  function lightbox(src) {
    const lb = el(`<div class="fixed inset-0 z-[90] bg-onyx/90 flex items-center justify-center p-4 fade-in"><img class="max-w-full max-h-full rounded-lg"><div class="absolute top-3 right-3 flex gap-2"><a class="icon-btn text-snow bg-snow/10" download="photo.jpg">${ic('download')}</a><button class="icon-btn text-snow bg-snow/10" data-x>${ic('x')}</button></div></div>`);
    lb.querySelector('img').src = src; lb.querySelector('a').href = src; lb.onclick = e => { if (e.target === lb || e.target.closest('[data-x]')) lb.remove(); }; document.body.append(lb);
  }

  /* ------------------------------------------------------------------ FORWARD */
  function forwardModal(msgs) {
    const sel = new Set();
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Forward to…</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <input id="fq" class="field mb-3" placeholder="Search chats and people" autocomplete="off"><div id="fl" class="max-h-[50dvh] overflow-y-auto -mx-2"></div>
      <button id="fgo" class="btn btn-gold w-full mt-3" disabled>Forward</button></div>`);
    const draw = () => {
      const q = $('#fq', md.box).value.trim().toLowerCase(), dmWith = new Set(S.chats.filter(c => c.type === 'dm').map(c => c.members.find(m => m !== S.me.uid)));
      const rows = S.chats.map(c => ({ key: 'c:' + c.id, ...N.chatInfo(c) })).concat(Object.values(S.users).filter(u => u.uid !== S.me.uid && u.username && !dmWith.has(u.uid)).map(u => ({ key: 'u:' + u.uid, name: u.username, photo: N.avatar(u) }))).filter(r => r.name.toLowerCase().includes(q));
      $('#fl', md.box).innerHTML = rows.map(r => `<button class="row rounded-xl" data-k="${esc(r.key)}"><img class="w-10 h-10 rounded-full object-cover" src="${esc(r.photo)}"><span class="flex-1 font-semibold truncate text-left">${esc(r.name)}</span><span class="w-6 h-6 rounded-full border-2 border-royal dark:border-gold flex items-center justify-center ${sel.has(r.key) ? 'bg-gold text-onyx !border-gold' : ''}">${sel.has(r.key) ? ic('check', 'w-4 h-4') : ''}</span></button>`).join('') || '<div class="p-6 text-center text-[var(--muted)]">No results</div>';
      const g = $('#fgo', md.box); g.disabled = !sel.size; g.textContent = sel.size ? `Forward to ${sel.size} chat${sel.size > 1 ? 's' : ''}` : 'Forward';
    };
    $('#fq', md.box).oninput = draw; draw(); $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; sel.has(b.dataset.k) ? sel.delete(b.dataset.k) : sel.add(b.dataset.k); draw(); });
    $('#fgo', md.box).onclick = async () => {
      try {
        for (const k of sel) {
          const [t, id] = [k.slice(0, 1), k.slice(2)], cid = t === 'u' ? await B.ensureDM(S.me.uid, id) : id;
          for (const m of msgs) {
            const copy = { from: S.me.uid, type: m.type, fwd: true };
            if (m.text) copy.text = m.text; if (m.images) copy.images = m.images; if (m.media) { copy.media = m.media; if (m.dur) copy.dur = m.dur; if (m.wave) copy.wave = m.wave; if (m.name) copy.name = m.name; if (m.size) copy.size = m.size; if (m.mime) copy.mime = m.mime; }
            if (m.poll) copy.poll = { q: m.poll.q, multi: m.poll.multi, options: m.poll.options.map(o => ({ id: o.id, text: o.text, votes: [] })) };
            await B.sendMessage(cid, copy);
          }
        }
        md.close(); toast(`Forwarded to ${sel.size} chat${sel.size > 1 ? 's' : ''}`);
      } catch (e) { toast(N.friendly(e)); }
    };
  }

  async function loadVideo(id, btn) {
    const m = S.msgs.find(x => x.id === id); if (!m) return;
    const wrap = btn.parentElement, meta = btn.querySelector('.vid-meta'); btn.classList.add('loading'); meta.textContent = 'Loading…';
    const url = await U.mediaURL(m.media);
    if (!url) { btn.classList.remove('loading'); meta.textContent = 'Could not load video — tap to retry'; return; }
    wrap.innerHTML = '<video controls autoplay playsinline class="w-full rounded-xl bg-onyx max-h-80"></video>'; wrap.firstChild.src = url;
  }
  async function downloadFile(id) {
    const m = S.msgs.find(x => x.id === id); if (!m) return; toast('Preparing ' + (m.name || 'file') + '…', 1800);
    try {
      const url = await U.mediaURL(m.media); if (!url) throw new Error('Could not load the file');
      const a = document.createElement('a'); a.href = url; a.download = m.name || 'file'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
    } catch (e) { toast(e.message || 'Download failed'); }
  }
  function sendFiles(files, kind) {
    const max = B.maxUpload || 10 * 1048576; files = files.filter(Boolean);
    const big = files.find(f => f.size > max); if (big) { toast(`“${big.name}” is too large (max ${Math.round(max / 1048576)} MB).`, 5000); files = files.filter(f => f.size <= max); }
    if (!files.length) return;
    const cid = S.activeId, plural = files.length > 1 ? 's' : '';
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Send ${kind === 'video' ? 'video' : 'document'}${plural}</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="space-y-2 mb-3 max-h-60 overflow-y-auto">${files.map(f => `<div class="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--panel2)]"><div class="file-ic">${esc(extOf(f.name))}</div><div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(f.name)}</div><div class="text-xs text-[var(--muted)]">${fmtSize(f.size)}</div></div></div>`).join('')}</div>
      ${kind === 'video' ? '<input id="fvCap" class="field mb-3" placeholder="Add a caption…">' : ''}
      <div id="fvProg" class="hidden h-2 rounded-full bg-[var(--panel2)] overflow-hidden mb-3"><div class="h-full bg-gold" style="width:0%;transition:width .2s"></div></div>
      <button id="fvSend" class="btn btn-gold w-full">${ic('send', 'w-5 h-5')} Send</button></div>`);
    $('[data-x]', md.box).onclick = md.close;
    $('#fvSend', md.box).onclick = async e => {
      const btn = e.currentTarget, prog = $('#fvProg', md.box), bar = prog.firstElementChild; btn.disabled = true; btn.textContent = 'Uploading…'; prog.classList.remove('hidden');
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i], url = await B.uploadMedia(f, p => { bar.style.width = Math.round(((i + p) / files.length) * 100) + '%'; });
          bar.style.width = Math.round(((i + 1) / files.length) * 100) + '%';
          const base = { from: S.me.uid, media: url, name: f.name, size: f.size, mime: f.type || '' };
          await B.sendMessage(cid, kind === 'video' ? { ...base, type: 'video', text: i === 0 && $('#fvCap', md.box) ? $('#fvCap', md.box).value.trim() : '' } : { ...base, type: 'file' });
        }
        md.close();
      } catch (er) { toast(N.friendly(er), 5000); btn.disabled = false; btn.textContent = 'Send'; prog.classList.add('hidden'); }
    };
  }
  function routeFiles(files) {
    const imgs = files.filter(f => f.type.startsWith('image/')), vids = files.filter(f => f.type.startsWith('video/')), rest = files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
    if (imgs.length) imagePreview(imgs); if (vids.length) sendFiles(vids, 'video'); if (rest.length) sendFiles(rest, 'file');
  }

  /* ------------------------------------------------------------------ IMAGES */
  async function imagePreview(files) {
    files = files.filter(f => f.type.startsWith('image/')).slice(0, 10); if (!files.length) return;
    const items = []; const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Send photos</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div id="ipGrid" class="grid grid-cols-3 gap-2 mb-3 min-h-[90px]"><div class="col-span-3 text-center text-[var(--muted)] py-6">Preparing…</div></div>
      <input id="ipCap" class="field mb-3" placeholder="Add a caption…"><button id="ipSend" class="btn btn-gold w-full" disabled>${ic('send', 'w-5 h-5')} Send</button></div>`);
    const draw = () => {
      $('#ipGrid', md.box).innerHTML = items.map((it, i) => `<div class="relative aspect-square"><img class="w-full h-full object-cover rounded-xl" src="${it.prev}"><button class="absolute top-1 right-1 w-6 h-6 rounded-full bg-royal text-snow flex items-center justify-center" data-rm="${i}">${ic('x', 'w-3 h-3')}</button></div>`).join('');
      $('#ipSend', md.box).disabled = !items.length;
    };
    $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { URL.revokeObjectURL(items[+r.dataset.rm].prev); items.splice(+r.dataset.rm, 1); draw(); if (!items.length) md.close(); } });
    for (const f of files) { try { const c = await N.compressImage(f); items.push({ ...c, prev: URL.createObjectURL(c.blob) }); } catch (e) { toast(e.message); } }
    if (!items.length) return md.close(); draw();
    $('#ipSend', md.box).onclick = async () => {
      const btn = $('#ipSend', md.box); btn.disabled = true; btn.textContent = 'Sending…'; const cid = S.activeId;
      try {
        const images = []; for (const it of items) images.push({ url: await B.uploadMedia(it.blob), w: it.w, h: it.h });
        await B.sendMessage(cid, { from: S.me.uid, type: 'image', images, text: $('#ipCap', md.box).value.trim() });
        md.close();
      } catch (e) { toast(N.friendly(e), 4500); btn.disabled = false; btn.textContent = 'Send'; }
    };
  }

  /* ------------------------------------------------------------------ POLL */
  function pollModal() {
    const md = modal(`<form class="p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">Create poll</h3><button type="button" class="icon-btn" data-x>${ic('x')}</button></div>
      <input id="pq" class="field" placeholder="Ask a question" maxlength="140"><div id="po" class="space-y-2"></div>
      <button type="button" id="pAdd" class="btn btn-ghost w-full">${ic('plus', 'w-4 h-4')} Add option</button>
      <label class="flex items-center gap-2 text-sm"><input id="pm" type="checkbox" class="w-4 h-4 accent-[#353935]"> Allow multiple answers</label>
      <button class="btn btn-gold w-full">${ic('send', 'w-5 h-5')} Send poll</button></form>`);
    const po = $('#po', md.box); const add = () => { if (po.children.length >= 8) return toast('Max 8 options'); const i = el(`<input class="field" placeholder="Option ${po.children.length + 1}" maxlength="60">`); po.append(i); };
    add(); add(); $('#pAdd', md.box).onclick = add; $('[data-x]', md.box).onclick = md.close; setTimeout(() => $('#pq', md.box).focus(), 50);
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const q = $('#pq', md.box).value.trim(), opts = $$('input', po).map(i => i.value.trim()).filter(Boolean);
      if (!q) return toast('Please write a question'); if (opts.length < 2) return toast('Add at least 2 options');
      try { await B.sendMessage(S.activeId, { from: S.me.uid, type: 'poll', poll: { q, multi: $('#pm', md.box).checked, options: opts.map((t, i) => ({ id: 'o' + i, text: t, votes: [] })) } }); md.close(); } catch (er) { toast(N.friendly(er)); }
    };
  }

  /* ------------------------------------------------------------------ VOICE RECORDING */
  let rText = '', rSR = null, recAct = 0, rec = null, rStream = null, rChunks = [], rAC = null, rAN = null, rPeaks = [], rT0 = 0, rRaf = 0, rLast = 0, rCid = null, rSend = false;
  async function startRec() {
    if (rec) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice recording is not supported in this browser');
    try { rStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Allow microphone access to record voice messages'); }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(rStream, mime ? { mimeType: mime } : {}); rChunks = []; rPeaks = []; rCid = S.activeId; rSend = false;
    rec.ondataavailable = e => { if (e.data && e.data.size) rChunks.push(e.data); };
    rec.onstop = finishRec;
    try { rAC = new (window.AudioContext || window.webkitAudioContext)(); rAN = rAC.createAnalyser(); rAN.fftSize = 128; rAC.createMediaStreamSource(rStream).connect(rAN); } catch (e) { rAN = null; }
    rText = ''; rSR = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && cfg.get('autoTranscribe') !== false && N.feature('fAI')) { try { const sr = rSR = new SR(); sr.continuous = true; sr.interimResults = false; sr.lang = N.speechLang(); sr.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) rText += ev.results[i][0].transcript + ' '; }; sr.onend = () => { if (rSR === sr && rec) { try { sr.start(); } catch (e) { } } }; sr.onerror = () => { }; sr.start(); } catch (e) { rSR = null; } }
    rec.start(250); rT0 = Date.now(); rLast = 0; sendAct('voice'); clearInterval(recAct); recAct = setInterval(() => sendAct('voice'), 2600);
    $('#composer').classList.add('hidden'); const rb = $('#recBar'); rb.classList.remove('hidden'); rb.classList.add('flex');
    const cv = $('#recCanvas'), g = cv.getContext('2d'), buf = new Uint8Array(rAN ? rAN.frequencyBinCount : 64);
    const loop = () => {
      if (!rec) return; const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2;
      if (rAN) rAN.getByteFrequencyData(buf); g.clearRect(0, 0, w, h);
      const bars = 36, bw = w / bars; let sum = 0;
      for (let i = 0; i < bars; i++) { const v = buf[Math.floor(i * buf.length / bars * .7)] / 255; sum += v; const bh = Math.max(6, v * h * .9); g.fillStyle = i % 2 ? '#C19552' : '#353935'; g.fillRect(i * bw + 2, (h - bh) / 2, bw - 4, bh); }
      const now = Date.now(); if (now - rLast > 100) { rLast = now; rPeaks.push(sum / bars); }
      $('#recTime').textContent = fmtDur((now - rT0) / 1000); rRaf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopRec(send) {
    if (!rec) return; rSend = !!send; if (rSR) { const x = rSR; rSR = null; try { x.stop(); } catch (e) { } } cancelAnimationFrame(rRaf); clearInterval(recAct); sendAct(null);
    const r = rec; rec = null; try { r.state !== 'inactive' && r.stop(); } catch (e) { finishRec.call(r); }
  }
  async function finishRec() {
    const dur = (Date.now() - rT0) / 1000, send = rSend, cid = rCid;
    if (rStream) rStream.getTracks().forEach(t => t.stop()); rStream = null; if (rAC) { try { rAC.close(); } catch (e) { } rAC = null; }
    const cmp = $('#composer'), rb = $('#recBar'); if (cmp) cmp.classList.remove('hidden'); if (rb) { rb.classList.add('hidden'); rb.classList.remove('flex'); }
    if (!send) return;
    if (dur < 0.8) return toast('Recording too short');
    const blob = new Blob(rChunks, { type: (rChunks[0] && rChunks[0].type) || 'audio/webm' });
    const n = 36, max = Math.max(...rPeaks, 0.05), wave = Array.from({ length: n }, (_, i) => { const s = rPeaks.slice(Math.floor(i * rPeaks.length / n), Math.max(Math.floor((i + 1) * rPeaks.length / n), Math.floor(i * rPeaks.length / n) + 1)); const v = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; return Math.round(12 + (v / max) * 88); });
    try { const url = await B.uploadMedia(blob); const tr = rText.trim(); const msg = { from: S.me.uid, type: 'voice', media: url, dur: Math.round(dur * 10) / 10, wave }; if (tr) msg.transcript = tr.slice(0, 1500); await B.sendMessage(cid, msg); N.sfx && N.sfx.sent(); } catch (e) { toast(N.friendly(e), 4500); }
  }

  /* ------------------------------------------------------------------ WALLPAPER */
  const DOODLE = "url(\"data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='none' stroke='#FFFAA0' stroke-opacity='.35' stroke-width='2' stroke-linecap='round'><circle cx='20' cy='22' r='7'/><path d='M80 18v14M73 25h14'/><path d='M30 84l10-10 10 10'/><rect x='84' y='78' width='14' height='14' rx='3'/><path d='M62 56q6-8 12 0'/></g></svg>`) + "\")";
  const WALLS = [
    { id: 'none', name: 'Default', css: '' },
    { id: 'dusk', name: 'Dusk', css: 'linear-gradient(160deg,color-mix(in srgb,#353935 38%,var(--bg)),color-mix(in srgb,#FFFAA0 38%,var(--bg)))' },
    { id: 'sun', name: 'Sunrise', css: 'linear-gradient(160deg,color-mix(in srgb,#C19552 34%,var(--bg)),color-mix(in srgb,#FFFAA0 30%,var(--bg)))' },
    { id: 'violet', name: 'Violet glow', css: 'radial-gradient(circle at 30% 20%,color-mix(in srgb,#353935 45%,var(--bg)),var(--bg) 70%)' },
    { id: 'gold', name: 'Gold haze', css: 'radial-gradient(circle at 75% 80%,color-mix(in srgb,#C19552 40%,var(--bg)),var(--bg) 70%)' },
    { id: 'doodle', name: 'Doodles', css: DOODLE, tile: true },
    { id: 'ocean', name: 'Steel mist', css: 'linear-gradient(200deg,color-mix(in srgb,#FFFAA0 45%,var(--bg)),var(--bg))' }
  ];
  const wkey = id => `nova_wp_${S.me.uid}_${id}`;
  function applyWallpaper() {
    const box = $('#msgs'); if (!box) return;
    const v = localStorage.getItem(wkey(S.activeId)) || localStorage.getItem(wkey('all')) || 'none';
    box.style.backgroundImage = ''; box.style.backgroundSize = 'cover'; box.style.backgroundRepeat = 'no-repeat';
    if (v.startsWith('data:')) { box.style.backgroundImage = `url(${v})`; return; }
    const w = WALLS.find(x => x.id === v) || WALLS[0]; if (!w.css) return;
    box.style.backgroundImage = w.css; if (w.tile) { box.style.backgroundSize = '120px 120px'; box.style.backgroundRepeat = 'repeat'; }
  }
  function wallpaperModal() {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Chat wallpaper</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="grid grid-cols-3 gap-2 mb-3">${WALLS.map(w => `<button data-w="${w.id}" class="rounded-xl overflow-hidden border-2 border-[var(--border)] hover:border-gold"><div class="h-20" style="background-color:var(--bg);${w.css ? 'background-image:' + w.css.replace(/"/g, "'") + ';' : ''}${w.tile ? 'background-size:120px;' : ''}"></div><div class="text-xs py-1">${w.name}</div></button>`).join('')}
      <label class="rounded-xl overflow-hidden border-2 border-dashed border-[var(--border)] hover:border-gold cursor-pointer flex flex-col items-center justify-center text-xs h-[108px]">${ic('image', 'w-6 h-6 mb-1')}Upload<input id="wpFile" type="file" accept="image/*" class="hidden"></label></div>
      <label class="flex items-center gap-2 text-sm"><input id="wpAll" type="checkbox" class="w-4 h-4 accent-[#353935]"> Use for all chats</label></div>`);
    $('[data-x]', md.box).onclick = md.close;
    const set = v => { try { localStorage.setItem(wkey($('#wpAll', md.box).checked ? 'all' : S.activeId), v); if ($('#wpAll', md.box).checked) localStorage.removeItem(wkey(S.activeId)); } catch (e) { toast('Image too large to save'); } applyWallpaper(); };
    md.box.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) { set(b.dataset.w); toast('Wallpaper updated'); } });
    $('#wpFile', md.box).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const c = await N.compressImage(f, 1100, .6); set(await U.blobToDataURL(c.blob)); toast('Wallpaper updated'); } catch (er) { toast(er.message); } };
  }

  /* ------------------------------------------------------------------ FAVORITES / DISAPPEARING / THREADS */
  function toggleFav(uid) {
    const on = cfg.toggleFav(uid), u = S.users[uid] || {};
    toast(on ? '★ ' + (u.username || 'Contact') + ' added to favorites — their calls ring through Do Not Disturb' : (u.username || 'Contact') + ' removed from favorites'); N.renderList(); N.renderHeader();
  }
  N.toggleFav = toggleFav;
  const DIS = [[0, 'Off'], [10, '10 seconds'], [3600, '1 hour'], [86400, '24 hours']];
  const disLabel = n => (DIS.find(d => d[0] === n) || [0, n + ' s'])[1];
  function disappearModal(c) {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-1"><h3 class="text-lg font-bold">Disappearing messages</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <p class="text-sm text-[var(--muted)] mb-3">New messages in this chat vanish for everyone after the time you choose.</p>
      <div class="space-y-1.5">${DIS.map(([v, t]) => `<button class="row rounded-xl !py-3 justify-between" data-d="${v}"><span class="font-semibold">${t}</span><span class="w-5 h-5 rounded-full border-2 ${(c.disappear || 0) === v ? 'bg-gold border-gold' : 'border-[var(--border)]'}"></span></button>`).join('')}</div></div>`);
    $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', async e => {
      const b = e.target.closest('[data-d]'); if (!b) return; const v = +b.dataset.d; md.close();
      try { await B.updateChat(c.id, { disappear: v }); await B.sendMessage(c.id, { from: S.me.uid, type: 'system', text: v ? `${S.me.username} turned on disappearing messages: ${disLabel(v)}` : `${S.me.username} turned off disappearing messages` }); toast(v ? 'Disappearing messages: ' + disLabel(v) : 'Disappearing messages off'); } catch (er) { toast(N.friendly(er)); }
    });
  }
  /* sweep: hide expired messages immediately; the sender also wipes them from storage */
  const wiped = new Set();
  setInterval(() => {
    if (!S.me || !S.activeId) return; const now = Date.now(); const gone = S.msgs.filter(m => m.exp && m.exp <= now);
    if (!gone.length) return; N.renderMessages(); N.renderThread && N.renderThread();
    const mine = gone.filter(m => m.from === S.me.uid && !wiped.has(m.id)); if (mine.length) { mine.forEach(m => wiped.add(m.id)); B.purgeMessages(S.activeId, mine.map(m => m.id)).catch(() => { }); }
  }, 1000);

  /* nested threads: a side panel with one message and its replies */
  let thPanel = null;
  N.closeThread = () => { if (thPanel) { thPanel.remove(); thPanel = null; } S.thread = null; };
  N.openThread = function (id) {
    if (S.thread === id && thPanel) return N.closeThread();
    N.closeThread(); S.thread = id; const pane = $('#pane'); if (!pane) return;
    thPanel = el(`<aside id="thPanel" class="th-panel fade-in"><header class="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]"><button class="icon-btn" data-x>${ic('x')}</button><div class="font-extrabold flex-1">Thread</div></header>
      <div id="thBody" class="flex-1 overflow-y-auto p-3 space-y-2"></div>
      <form id="thForm" class="p-3 border-t border-[var(--border)] flex gap-2 items-end"><textarea id="thInput" rows="1" class="field !py-2.5 !rounded-2xl flex-1 resize-none" placeholder="Reply in thread…"></textarea><button class="send-btn" title="Send">${ic('send', 'w-5 h-5')}</button></form></aside>`);
    pane.append(thPanel); $('[data-x]', thPanel).onclick = N.closeThread;
    const inp = $('#thInput', thPanel); inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); $('#thForm', thPanel).requestSubmit(); } };
    $('#thForm', thPanel).onsubmit = async e => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = '';
      try { await B.sendMessage(S.activeId, { from: S.me.uid, type: 'text', text: t, threadOf: id }); N.sfx && N.sfx.sent(); } catch (er) { toast(N.friendly(er)); inp.value = t; }
    };
    N.renderThread(true); if (N.i18nApply) N.i18nApply(thPanel); setTimeout(() => inp.focus(), 80);
  };
  N.renderThread = function (scroll) {
    if (!thPanel || !S.thread) return; const body = $('#thBody', thPanel), now = Date.now(), root = S.msgs.find(m => m.id === S.thread);
    if (!root) return N.closeThread();
    const rows = [root, ...S.msgs.filter(m => m.threadOf === S.thread && !m.deleted && !(m.exp && m.exp <= now))];
    const near = body.scrollHeight - body.scrollTop - body.clientHeight < 120;
    body.innerHTML = rows.map((m, i) => { const mine = m.from === S.me.uid, u = S.users[m.from];
      return `<div class="flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${i === 0 ? 'th-root' : ''}"><img class="msg-av" src="${esc(N.avatar(u))}"><div class="min-w-0 max-w-[85%]"><div class="text-[11px] text-[var(--muted)] px-2 ${mine ? 'text-right' : ''}">${esc(nameOf(m.from))} · ${N.timeStr(m.ts)}</div>
        <div class="bubble px-3.5 py-2 ${mine ? 'bubble-out text-onyx' : 'bg-[var(--bubble-in)] border border-[var(--border)]'}">${m.deleted ? '<i>Deleted</i>' : (m.type === 'text' ? '<div class="whitespace-pre-wrap">' + hl(m.text || '', '') + '</div>' : esc(U.previewOf(m)))}</div></div></div>${i === 0 ? `<div class="text-xs font-bold text-[var(--muted)] px-2 py-1">${rows.length - 1} ${rows.length === 2 ? 'reply' : 'replies'}</div>` : ''}`; }).join('');
    if (scroll || near) body.scrollTop = body.scrollHeight;
  };

  /* ------------------------------------------------------------------ INFO / GROUPS */
  function showInfo() {
    const c = curChat(); if (!c) return; const info = N.chatInfo(c);
    if (c.type === 'dm') {
      const o = info.other || {};
      const md = modal(`<div class="p-6 text-center"><img class="w-28 h-28 rounded-full object-cover mx-auto border-4 border-gold" src="${esc(info.photo)}"><h3 class="text-xl font-bold mt-3">${esc(info.name)}</h3>${o.nickname ? `<div class="text-sm font-semibold text-gold">“${esc(o.nickname)}”</div>` : ''}<div class="text-sm text-[var(--muted)]">${N.blockedMe(o) ? '' : N.presence(o)}</div>${N.feature('fMood') && o.mood && o.mood.t ? `<div class="inline-block mt-2 px-3 py-1 rounded-full bg-[var(--panel2)] text-sm">${esc((o.mood.e || '') + ' ' + o.mood.t)}</div>` : ''}
        <div class="flex gap-2 justify-center mt-5"><button class="btn btn-ghost" data-a="audio">${ic('phone', 'w-4 h-4')} Voice</button><button class="btn btn-royal" data-a="video">${ic('video', 'w-4 h-4')} Video</button></div>
        ${N.feature('fFav') && !isAI(c) ? `<div class="flex gap-2 justify-center mt-2"><button class="btn btn-ghost flex-1" data-fav>${ic('star', 'w-4 h-4')} ${cfg.isFav(o.uid) ? 'Remove favorite' : 'Add to favorites'}</button></div>` : ''}
        <div class="flex gap-2 justify-center mt-2"><button class="btn btn-ghost flex-1" data-blk>${ic('ban', 'w-4 h-4')} ${N.isBlocked(o.uid) ? 'Unblock' : 'Block'}</button><button class="btn btn-ghost flex-1" data-lck>${ic(N.isLocked(c.id) ? 'unlock' : 'lock', 'w-4 h-4')} ${N.isLocked(c.id) ? 'Remove lock' : 'Lock chat'}</button></div></div>`);
      md.box.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { md.close(); return N.startCall(b.dataset.a); }
        if (e.target.closest('[data-fav]')) { md.close(); toggleFav(o.uid); }
        else if (e.target.closest('[data-blk]')) { md.close(); N.toggleBlock(o.uid); } else if (e.target.closest('[data-lck]')) { md.close(); N.toggleLock(c.id); } });
      return;
    }
    const isAdmin = (c.admins || []).includes(S.me.uid) || c.createdBy === S.me.uid;
    const md = modal(`<div class="p-5"><div class="flex justify-end"><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="text-center -mt-3"><img class="w-24 h-24 rounded-full object-cover mx-auto border-4 border-gold" src="${esc(info.photo)}">
        <div class="flex items-center justify-center gap-2 mt-3"><h3 id="gName" class="text-xl font-bold">${esc(c.name)}</h3>${isAdmin ? `<button class="icon-btn !w-8 !h-8" data-rename title="Rename">${ic('edit', 'w-4 h-4')}</button>` : ''}</div>
        <div class="text-sm text-[var(--muted)]">Group · ${c.members.length} members</div></div>
      <div class="mt-5 p-3 rounded-2xl bg-[var(--panel2)]"><div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Invite link</div>
        <input id="gLink" readonly class="field !py-2 text-sm" value="${esc(N.inviteLink(c.invite))}">
        <div class="flex gap-2 mt-2"><button class="btn btn-gold flex-1 !py-2" data-copy>${ic('copy', 'w-4 h-4')} Copy</button><button class="btn btn-royal flex-1 !py-2" data-share>${ic('share', 'w-4 h-4')} Share</button>${isAdmin ? `<button class="btn btn-ghost !py-2" data-reset title="Generate a new link (old link stops working)">↻</button>` : ''}</div></div>
      <div class="mt-4"><input id="gmq" class="field !py-2 mb-2" placeholder="Search members by username…"><div id="gml" class="max-h-52 overflow-y-auto"></div></div>
      <button class="btn btn-ghost w-full mt-3" data-leave>${ic('logout', 'w-4 h-4')} Leave group</button></div>`);
    const draw = () => { const q = $('#gmq', md.box).value.trim().toLowerCase(); $('#gml', md.box).innerHTML = c.members.map(m => S.users[m]).filter(u => u && u.username.toLowerCase().includes(q)).map(u => `<div class="flex items-center gap-3 py-1.5"><img class="w-10 h-10 rounded-full object-cover" src="${esc(N.avatar(u))}"><div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(u.username)}${u.uid === S.me.uid ? ' (You)' : ''}</div><div class="text-xs text-[var(--muted)]">${N.presence(u)}</div></div>${(c.admins || []).includes(u.uid) ? '<span class="text-[10px] px-2 py-0.5 rounded bg-gold text-onyx font-bold">ADMIN</span>' : ''}</div>`).join('') || '<div class="text-center text-sm text-[var(--muted)] py-3">No members match</div>'; };
    draw(); $('#gmq', md.box).oninput = draw; $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', async e => {
      if (e.target.closest('[data-copy]')) { await N.copy($('#gLink', md.box).value); toast('Invite link copied — send it to anyone you want in the group'); }
      else if (e.target.closest('[data-share]')) N.share('Join ' + c.name + ' on QueenB.Chat', `Join my group “${c.name}” on QueenB.Chat:`, $('#gLink', md.box).value);
      else if (e.target.closest('[data-reset]')) { if (await ask('Reset invite link?', 'The old link will stop working.', 'Reset')) { const code = await B.regenInvite(c.id); c.invite = code; $('#gLink', md.box).value = N.inviteLink(code); toast('New invite link generated'); } }
      else if (e.target.closest('[data-rename]')) { const n = prompt('New group name', c.name); if (n && n.trim()) { await B.renameGroup(c.id, n.trim().slice(0, 40)); $('#gName', md.box).textContent = n.trim(); } }
      else if (e.target.closest('[data-leave]')) { if (await ask('Leave group?', 'You will stop receiving messages from this group.', 'Leave')) { md.close(); await B.leaveGroup(c.id, S.me.uid); N.closeChat(); toast('You left the group'); } }
    });
  }

  function createGroupModal() {
    let photo = ''; const sel = new Set();
    const md = modal(`<form class="p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">New group</h3><button type="button" class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="flex items-center gap-3"><label class="relative cursor-pointer shrink-0"><img id="gpImg" class="w-16 h-16 rounded-full object-cover border-2 border-gold" src="${U.avatarSVG('G', 'newgroup')}"><span class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gold text-onyx flex items-center justify-center">${ic('camera', 'w-4 h-4')}</span><input id="gpFile" type="file" accept="image/*" class="hidden"></label>
        <input id="gpName" class="field" placeholder="Group name" maxlength="40"></div>
      <input id="gpq" class="field !py-2" placeholder="Search people to add…"><div id="gpl" class="max-h-48 overflow-y-auto -mx-1"></div>
      <p class="text-xs text-[var(--muted)]">You'll get an invite link to share with anyone who should join.</p><button class="btn btn-gold w-full">Create group</button></form>`);
    const draw = () => { const q = $('#gpq', md.box).value.trim().toLowerCase(); $('#gpl', md.box).innerHTML = Object.values(S.users).filter(u => u.uid !== S.me.uid && u.username && u.username.toLowerCase().includes(q)).map(u => `<button type="button" class="row rounded-xl !py-2" data-u="${esc(u.uid)}"><img class="w-9 h-9 rounded-full object-cover" src="${esc(N.avatar(u))}"><span class="flex-1 text-left font-semibold truncate">${esc(u.username)}</span><span class="w-5 h-5 rounded-full border-2 border-royal dark:border-gold flex items-center justify-center ${sel.has(u.uid) ? 'bg-gold text-onyx !border-gold' : ''}">${sel.has(u.uid) ? ic('check', 'w-3 h-3') : ''}</span></button>`).join('') || '<div class="text-center text-sm text-[var(--muted)] py-3">No people found</div>'; };
    draw(); $('#gpq', md.box).oninput = draw; $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b) { sel.has(b.dataset.u) ? sel.delete(b.dataset.u) : sel.add(b.dataset.u); draw(); } });
    $('#gpFile', md.box).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { photo = await N.avatarFromFile(f); $('#gpImg', md.box).src = photo; } catch (er) { toast(er.message); } };
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const name = $('#gpName', md.box).value.trim(); if (!name) return toast('Give your group a name');
      try { const c = await B.createGroup(S.me.uid, { name, photo, members: [...sel] }); md.close(); S.pendingOpen = c.id; N.openChat(c.id); toast('Group created — open Group info to copy the invite link'); setTimeout(showInfo, 400); } catch (er) { toast(N.friendly(er)); }
    };
  }

  function joinByLinkModal() {
    const md = modal(`<div class="p-5 space-y-3"><h3 class="text-lg font-bold">Join a group</h3><input id="jl" class="field" placeholder="Paste invite link or code"><button class="btn btn-gold w-full" id="jgo">Continue</button></div>`);
    $('#jgo', md.box).onclick = () => { const v = $('#jl', md.box).value.trim(); const m = v.match(/join=([\w-]+)/) || v.match(/^([\w-]{6,})$/); if (!m) return toast('That does not look like an invite link'); md.close(); N.handleJoin(m[1]); };
  }

  N.handleJoin = async function (code) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
    let c; try { c = await B.findByInvite(code); } catch (e) { return toast(N.friendly(e)); }
    if (!c) return toast('This invite link is invalid or has expired');
    if (c.members.includes(S.me.uid)) { toast('You are already in this group'); S.pendingOpen = c.id; return N.openChat(c.id); }
    const photo = c.photo || U.avatarSVG(c.name, c.id);
    const md = modal(`<div class="p-6 text-center"><img class="w-24 h-24 rounded-full object-cover mx-auto border-4 border-gold" src="${esc(photo)}"><div class="text-sm text-[var(--muted)] mt-3">You've been invited to join</div><h3 class="text-xl font-bold">${esc(c.name)}</h3><div class="text-sm text-[var(--muted)]">${c.members.length} members</div>
      <div class="flex gap-2 mt-5"><button class="btn btn-ghost flex-1" data-x>Not now</button><button class="btn btn-gold flex-1" data-j>Join group</button></div></div>`);
    $('[data-x]', md.box).onclick = md.close;
    $('[data-j]', md.box).onclick = async () => { try { const g = await B.joinByCode(S.me.uid, code); md.close(); S.pendingOpen = g.id; N.openChat(g.id); toast('Welcome to ' + g.name + '!'); } catch (e) { toast(N.friendly(e)); } };
  };

  /* dragged files → image preview */
  N.watchDrop = function () {
    const p = $('#pane'); if (!p || p._drop) return; p._drop = 1;
    p.addEventListener('dragover', e => e.preventDefault());
    p.addEventListener('drop', e => { e.preventDefault(); if (S.activeId) routeFiles([...e.dataTransfer.files]); });
    p.addEventListener('paste', e => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) routeFiles(fs); });
  };
})();
