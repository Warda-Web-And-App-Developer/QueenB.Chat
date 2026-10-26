/* QUEENBEE — settingsui.js : settings panel (features on/off, sounds, Do Not Disturb, privacy, calls, AI), status / mood, per-chat sounds */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, $$, esc, el, ic, toast, modal } = N, cfg = N.cfg;

  const sw = (k, label, desc = '') => `<label class="set-row"><span class="min-w-0"><span class="block font-semibold">${label}</span>${desc ? `<span class="block text-xs text-[var(--muted)] mt-0.5">${desc}</span>` : ''}</span><input type="checkbox" class="sw" data-k="${k}" ${cfg.get(k) ? 'checked' : ''}></label>`;
  const sel = (k, label, opts, prev) => `<div class="set-row"><span class="font-semibold">${label}</span><span class="flex items-center gap-2"><select class="field !py-1.5 !px-2 !w-auto text-sm" data-s="${k}">${opts.map(o => `<option value="${o.id}" ${cfg.get(k) === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>${prev ? `<button type="button" class="icon-btn soft !w-9 !h-9" data-prev="${k}" title="Preview">${ic('play', 'w-4 h-4')}</button>` : ''}</span></div>`;
  const card = (title, icon, body) => `<section class="set-card"><h3 class="set-h">${ic(icon, 'w-4 h-4')}<span>${title}</span></h3>${body}</section>`;

  N.openSettings = function () {
    if (document.getElementById('setPanel')) return;
    const me = S.me, mood = me.mood && me.mood.t ? (me.mood.e || '') + ' ' + me.mood.t : 'No status set';
    const p = el(`<div id="setPanel" class="fixed inset-0 z-[60] bg-[var(--bg)] flex flex-col slide-in">
      <header class="flex items-center gap-2 px-3 py-3 bg-[var(--panel)] border-b border-[var(--border)] shadow-sm"><button class="icon-btn" data-x title="Close">${ic('back')}</button><h2 class="text-lg font-extrabold flex-1">Settings</h2>${N.langButton ? N.langButton() : ''}</header>
      <div class="flex-1 overflow-y-auto"><div class="max-w-2xl mx-auto p-3 sm:p-5 space-y-4 pb-16">
        <section class="set-card flex items-center gap-4"><img class="w-16 h-16 rounded-full object-cover border-2 border-gold" src="${esc(N.avatar(me))}"><div class="flex-1 min-w-0"><div class="text-lg font-extrabold truncate">${esc(me.username || 'You')}${me.nickname ? ` <span class="text-sm font-semibold text-gold">“${esc(me.nickname)}”</span>` : ''}</div><div class="text-sm text-[var(--muted)] truncate">${esc(me.email || me.phone || '')}</div><div class="text-sm mt-0.5 truncate">${esc(mood)}</div></div></section>
        <div class="grid grid-cols-3 gap-2"><button class="btn btn-ghost !px-2 text-sm" data-a="profile">${ic('user', 'w-4 h-4')} Profile</button><button class="btn btn-ghost !px-2 text-sm" data-a="avatar">${ic('smile', 'w-4 h-4')} Avatar</button><button class="btn btn-gold !px-2 text-sm" data-a="mood">${ic('sparkle', 'w-4 h-4')} Status</button></div>

        ${card('Features — turn on only what you want', 'zap', sw('fAI', 'AI assistant', 'A chat with QueenB.Chat AI at the top of your list') + sw('fSummary', 'Smart summaries', 'Catch up on long chats with a short bullet list') + sw('fMini', 'Mini-apps in chat', 'Notes, code snippets and expense splits') + sw('fThreads', 'Threads', 'Reply to one message in its own side conversation') + sw('fDisappear', 'Disappearing messages', 'Messages that vanish after 10 seconds, 1 hour or 24 hours') + sw('fMood', 'Status & mood', 'Show what you are up to next to your picture') + sw('fStories', 'Stories', 'Share photos and text for 24 hours') + sw('fFav', 'Favorites & VIP alerts', 'Star people for special sounds and call priority'))}

        ${card('Appearance — font and text size', 'type', `<div class="font-grid" id="fontGrid">${(N.FONTS || []).map(f => `<button type="button" class="font-opt ${cfg.get('font') === f.id ? 'on' : ''}" data-font="${f.id}" style="font-family:${f.stack},system-ui,sans-serif"><b>Aa</b><span data-notr>${f.name}</span></button>`).join('')}</div>
          <div class="font-sample" id="fontSample">The quick brown fox jumps over the lazy dog. 🐝<br>تیز بھوری لومڑی سست کتے پر کودتی ہے۔</div>
          <div class="size-row" id="sizeRow">${[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'Extra large']].map(([k, t]) => `<button type="button" class="${cfg.get('fontSize') === k ? 'on' : ''}" data-size="${k}">${t}</button>`).join('')}</div>`)}

        ${card('Sounds', 'volume', sw('sound', 'Chat sounds', 'Turn every sound on or off') + `<div class="set-row"><span class="font-semibold">Volume</span><input type="range" min="0" max="1" step="0.05" value="${cfg.get('volume')}" data-vol class="w-40 accent-[#C19552]"></div>` + sw('sendSound', 'Sent message sound') + sel('msgTone', 'Message received', N.sfx.TONES, true) + sel('ringtone', 'Call ringtone', N.sfx.RINGS, true) + sel('vipTone', 'Favorite — message tone', N.sfx.TONES, true) + sel('vipRingtone', 'Favorite — ringtone', N.sfx.RINGS, true) + '<p class="text-xs text-[var(--muted)] px-1 pt-1">Mute one chat or give it its own sound from the ⋮ menu inside that chat. We even suggest a different tone for each group.</p>')}

        ${card('Do Not Disturb', 'belloff', sw('dnd', 'Do Not Disturb now', 'No pop-ups or sounds; messages still wait in your chats') + sw('dndSched', 'Schedule', 'Switch on automatically at set times') + `<div class="set-row"><span class="font-semibold">From / until</span><span class="flex items-center gap-2"><input type="time" class="field !py-1.5 !px-2 !w-auto text-sm" data-t="dndFrom" value="${cfg.get('dndFrom')}"><span>–</span><input type="time" class="field !py-1.5 !px-2 !w-auto text-sm" data-t="dndTo" value="${cfg.get('dndTo')}"></span></div>` + sw('dndEmergency', 'Emergency override', 'Calls from your favorites still ring during Do Not Disturb'))}

        ${card('Privacy', 'shield', sw('ghost', 'Ghost mode', 'Read messages without showing read receipts') + sw('hideTyping', 'Hide my typing', 'Others will not see “typing…”') + `<div class="grid grid-cols-2 gap-2 pt-2"><button class="btn btn-ghost text-sm" data-a="pin">${ic('key', 'w-4 h-4')} ${N.hasPin && N.hasPin() ? 'Change chat PIN' : 'Set chat PIN'}</button><button class="btn btn-ghost text-sm" data-a="blocked">${ic('ban', 'w-4 h-4')} Blocked users</button></div>`)}

        ${card('Calls', 'phone', sw('recordCalls', 'Record my calls', 'Calls are saved to your Calls tab with a transcript. Everyone in the call sees a REC badge') + sw('autoTranscribe', 'Transcripts', 'Write out voice notes and call speech as text when your browser allows it') + sw('noiseCancel', 'Noise cancellation', 'Mutes fans, typing and traffic between words') + sw('micCheck', 'Check microphone before calls', 'A quick level meter once per session') + sw('avatarCall', 'Use my avatar on video calls', 'Your avatar smiles and speaks along with you') + `<button class="btn btn-ghost w-full text-sm mt-2" data-a="mic">${ic('mic', 'w-4 h-4')} Test microphone</button>`)}

        ${card('AI assistant', 'sparkle', `<div class="set-row"><span class="font-semibold">Brain</span><select class="field !py-1.5 !px-2 !w-auto text-sm" data-s="aiProvider"><option value="local" ${cfg.get('aiProvider') !== 'custom' ? 'selected' : ''}>Built-in (works offline)</option><option value="custom" ${cfg.get('aiProvider') === 'custom' ? 'selected' : ''}>My own AI service</option></select></div>
          <div id="aiCustom" class="${cfg.get('aiProvider') === 'custom' ? '' : 'hidden'} space-y-2 pt-1"><input class="field text-sm" data-i="aiUrl" placeholder="Service address (…/v1/chat/completions)" value="${esc(cfg.get('aiUrl') || '')}"><input class="field text-sm" data-i="aiModel" placeholder="Model name" value="${esc(cfg.get('aiModel') || '')}"><input class="field text-sm" type="password" data-i="aiKey" placeholder="Access key (stays on this device)" value="${esc(cfg.get('aiKey') || '')}"></div>`)}

        ${card('Chat', 'chat', sw('enterSend', 'Enter sends the message', 'Shift + Enter adds a new line'))}
      </div></div></div>`);
    document.body.append(p); if (N.loadAllFonts) N.loadAllFonts();
    const close = () => p.remove();
    $('[data-x]', p).onclick = close;
    const onKey = e => { if (e.key === 'Escape' && document.getElementById('setPanel') && !document.querySelector('.fixed.z-50')) { close(); document.removeEventListener('keydown', onKey); } }; document.addEventListener('keydown', onKey);
    p.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('sw')) { cfg.set(t.dataset.k, t.checked); if (/^f[A-Z]/.test(t.dataset.k)) { N.renderList(); N.renderHeader && N.renderHeader(); N.renderMessages && S.activeId && N.renderMessages(); } if (t.dataset.k === 'ghost') toast(t.checked ? 'Ghost mode on — others won’t see when you read' : 'Ghost mode off'); }
      else if (t.dataset.s) { cfg.set(t.dataset.s, t.value); if (t.dataset.s === 'aiProvider') $('#aiCustom', p).classList.toggle('hidden', t.value !== 'custom'); if (N.sfx && /Tone|ringtone|Ringtone/.test(t.dataset.s)) N.sfx.preview(t.value); }
      else if (t.dataset.t) cfg.set(t.dataset.t, t.value);
      else if (t.dataset.i) cfg.set(t.dataset.i, t.value.trim());
    });
    $('[data-vol]', p).oninput = e => cfg.set('volume', +e.target.value);
    $('[data-vol]', p).onchange = () => N.sfx.preview(cfg.get('msgTone'));
    p.addEventListener('click', async e => {
      const fo = e.target.closest('[data-font]'); if (fo) { cfg.set('font', fo.dataset.font); $$('[data-font]', p).forEach(x => x.classList.toggle('on', x === fo)); const f = N.FONTS.find(x => x.id === fo.dataset.font); $('#fontSample', p).style.fontFamily = f.stack + ',system-ui,sans-serif'; return; }
      const sz = e.target.closest('[data-size]'); if (sz) { cfg.set('fontSize', sz.dataset.size); $$('[data-size]', p).forEach(x => x.classList.toggle('on', x === sz)); return; }
      const pv = e.target.closest('[data-prev]'); if (pv) { const s = $(`[data-s="${pv.dataset.prev}"]`, p); return N.sfx.preview(s.value); }
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'profile') N.profileModal(S.me);
      else if (a === 'mood') N.moodModal();
      else if (a === 'mic') N.micTest();
      else if (a === 'blocked') N.blockedModal && N.blockedModal();
      else if (a === 'pin') { N.hasPin() ? N.changePin() : N.setPinFlow(); }
      else if (a === 'avatar') {
        const r = await N.avatarBuilder({ cfg: S.me.avatarCfg, seed: S.me.uid });
        if (r) { try { await B.updateProfile(S.me.uid, { avatarCfg: r.cfg, photo: r.photo }); toast('Avatar updated'); close(); N.openSettings(); } catch (er) { toast(N.friendly(er)); } }
      }
    });
    if (N.i18nApply) N.i18nApply(p);
  };

  /* ---------------- status / mood ---------------- */
  const MOODS = [['💻', 'In Deep Work'], ['👨‍💻', 'Coding'], ['🎧', 'Listening to Music'], ['📅', 'In a Meeting'], ['📚', 'Studying'], ['🎮', 'Gaming'], ['🏋️', 'At the Gym'], ['✈️', 'Traveling'], ['🍽️', 'Eating'], ['😴', 'Sleeping'], ['🌴', 'On Vacation'], ['🚗', 'Driving']];
  N.moodModal = function () {
    const cur = S.me.mood || {}; let chosen = cur.t ? { e: cur.e || '', t: cur.t } : null, until = 0;
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Set your status</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <p class="text-sm text-[var(--muted)] mb-3">Your status shows next to your picture for people you chat with.</p>
      <div class="flex flex-wrap gap-2 mb-3">${MOODS.map(([e, t], i) => `<button type="button" class="chip" data-m="${i}">${e} ${t}</button>`).join('')}</div>
      <div class="flex gap-2 mb-3"><input id="mE" class="field !w-16 text-center text-xl" maxlength="2" placeholder="🙂" value="${esc(cur.e || '')}"><input id="mT" class="field flex-1" maxlength="30" placeholder="Or write your own…" value="${esc(cur.t || '')}"></div>
      <div class="flex items-center gap-2 mb-4 text-sm"><span class="font-semibold">Clear after</span><select id="mU" class="field !py-1.5 !px-2 !w-auto text-sm"><option value="0">Never</option><option value="1">1 hour</option><option value="4">4 hours</option><option value="24">Today</option></select></div>
      <div class="flex gap-2"><button class="btn btn-ghost flex-1" data-clear>Clear status</button><button class="btn btn-gold flex-1" data-save>Save</button></div></div>`);
    $('[data-x]', md.box).onclick = md.close;
    md.box.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; const [em, t] = MOODS[+b.dataset.m]; $('#mE', md.box).value = em; $('#mT', md.box).value = t; $$('[data-m]', md.box).forEach(x => x.classList.toggle('on', x === b)); });
    const save = async v => { try { await B.updateProfile(S.me.uid, { mood: v }); md.close(); toast(v ? 'Status updated' : 'Status cleared'); N.renderSelf(); N.renderList(); } catch (er) { toast(N.friendly(er)); } };
    $('[data-save]', md.box).onclick = () => { const t = $('#mT', md.box).value.trim(); if (!t) return toast('Choose or write a status'); const h = +$('#mU', md.box).value; save({ e: $('#mE', md.box).value.trim(), t, until: h ? Date.now() + h * 3600000 : 0 }); };
    $('[data-clear]', md.box).onclick = () => save(null);
    if (N.i18nApply) N.i18nApply(md.box);
  };

  /* ---------------- per-chat sounds ---------------- */
  N.chatSoundsModal = function (chatId) {
    const c = S.chats.find(x => x.id === chatId); if (!c) return; const sug = N.sfx.suggest(chatId);
    const opt = (list, v) => list.map(o => `<option value="${o.id}" ${v === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">${esc(N.chatInfo(c).name)} · sounds</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <label class="set-row"><span class="font-semibold">Mute this chat</span><input type="checkbox" class="sw" id="csMute" ${cfg.chat(chatId).mute ? 'checked' : ''}></label>
      <div class="set-row"><span class="font-semibold">Message tone</span><span class="flex gap-2 items-center"><select id="csTone" class="field !py-1.5 !px-2 !w-auto text-sm"><option value="">Default</option>${opt(N.sfx.TONES, cfg.chat(chatId).tone)}</select><button class="icon-btn soft !w-9 !h-9" data-pt>${ic('play', 'w-4 h-4')}</button></span></div>
      <div class="set-row"><span class="font-semibold">Ringtone</span><span class="flex gap-2 items-center"><select id="csRing" class="field !py-1.5 !px-2 !w-auto text-sm"><option value="">Default</option>${opt(N.sfx.RINGS, cfg.chat(chatId).ring)}</select><button class="icon-btn soft !w-9 !h-9" data-pr>${ic('play', 'w-4 h-4')}</button></span></div>
      <button class="btn btn-ghost w-full mt-3 text-sm" data-sug>${ic('sparkle', 'w-4 h-4')} Suggest sounds for this chat</button><button class="btn btn-gold w-full mt-2" data-ok>Done</button></div>`);
    $('[data-x]', md.box).onclick = md.close; $('[data-ok]', md.box).onclick = md.close;
    $('#csMute', md.box).onchange = e => { cfg.setChat(chatId, { mute: e.target.checked }); N.renderList(); };
    $('#csTone', md.box).onchange = e => { cfg.setChat(chatId, { tone: e.target.value }); if (e.target.value) N.sfx.preview(e.target.value); };
    $('#csRing', md.box).onchange = e => { cfg.setChat(chatId, { ring: e.target.value }); if (e.target.value) N.sfx.preview(e.target.value); };
    $('[data-pt]', md.box).onclick = () => N.sfx.preview($('#csTone', md.box).value || cfg.get('msgTone'));
    $('[data-pr]', md.box).onclick = () => N.sfx.preview($('#csRing', md.box).value || cfg.get('ringtone'));
    $('[data-sug]', md.box).onclick = () => { $('#csTone', md.box).value = sug.tone; $('#csRing', md.box).value = sug.ring; cfg.setChat(chatId, { tone: sug.tone, ring: sug.ring }); N.sfx.preview(sug.tone); toast('Suggested sounds applied'); };
    if (N.i18nApply) N.i18nApply(md.box);
  };

  /* expire statuses */
  setInterval(() => { const m = S.me && S.me.mood; if (m && m.until && m.until < Date.now()) B.updateProfile(S.me.uid, { mood: null }).catch(() => { }); }, 30000);
})();
