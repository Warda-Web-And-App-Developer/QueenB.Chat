/* QUEENBEE — calls.js : real two-way voice & video calls (WebRTC), noise cancellation, mic test,
   call recording + transcript, avatar video mode, call history.
   Signalling goes through the shared call record (B.signal / B.joinCall), media flows device-to-device. */
(function () {
  'use strict';
  const N = window.Nova, { S, B, U, $, $$, esc, el, ic, toast, modal, ask } = N, cfg = N.cfg;
  const ICE = () => (window.ICE_SERVERS && window.ICE_SERVERS.length ? window.ICE_SERVERS : [{ urls: 'stun:stun.l.google.com:19302' }]);
  const AC = window.AudioContext || window.webkitAudioContext;
  const fmt = s => { s = Math.floor(s); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  let C = null, incomingId = null, incomingEl = null, stopRing = null; const dismissed = new Set();

  /* ================================================================ AUDIO PIPELINE (noise cancellation) */
  /* high-pass + low-pass + compressor + adaptive noise gate. The browser's own noise suppression / echo cancellation
     is requested as well, so steady noise (fans, hiss) is removed first and the gate then mutes the gaps between words
     (typing, traffic, dogs…). */
  function pipeline(rawStream, on) {
    const ac = new AC(), src = ac.createMediaStreamSource(new MediaStream(rawStream.getAudioTracks()));
    const hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), comp = ac.createDynamicsCompressor(), gate = ac.createGain(), an = ac.createAnalyser(), dest = ac.createMediaStreamDestination();
    hp.type = 'highpass'; lp.type = 'lowpass'; an.fftSize = 1024; comp.threshold.value = -32; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2;
    src.connect(hp); hp.connect(lp); lp.connect(an); lp.connect(comp); comp.connect(gate); gate.connect(dest);
    const buf = new Float32Array(an.fftSize); let nf = .01, hold = 0, level = 0, enabled = !!on, openState = true, timer = 0;
    const setOn = v => { enabled = !!v; hp.frequency.value = enabled ? 110 : 10; lp.frequency.value = enabled ? 7800 : 22000; if (!enabled) gate.gain.setTargetAtTime(1, ac.currentTime, .02); };
    setOn(enabled);
    timer = setInterval(() => {
      an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]; const rms = Math.sqrt(sum / buf.length); level = level * .6 + rms * .4;
      if (rms < nf) nf = nf * .9 + rms * .1; else nf += (rms - nf) * .0015;       // noise floor follows quiet moments
      if (!enabled) return;
      const th = Math.max(.012, nf * 3);
      if (rms > th) { hold = Date.now() + 320; if (!openState) { openState = true; gate.gain.setTargetAtTime(1, ac.currentTime, .012); } }
      else if (Date.now() > hold && openState) { openState = false; gate.gain.setTargetAtTime(.04, ac.currentTime, .09); }
    }, 30);
    if (ac.state === 'suspended') ac.resume().catch(() => { });
    return { ac, stream: dest.stream, track: dest.stream.getAudioTracks()[0], setOn, level: () => level, noise: () => nf, destroy() { clearInterval(timer); try { rawStream.getTracks().forEach(t => t.stop()); if (ac.state !== 'closed') ac.close().catch(() => { }); } catch (e) { } } };
  }
  const audioConstraints = () => ({ echoCancellation: true, noiseSuppression: !!cfg.get('noiseCancel'), autoGainControl: true, channelCount: 1 });

  /* ================================================================ MIC TEST (volume meter + waveform) */
  N.micTest = function (opts = {}) {
    return new Promise(res => {
      let raw = null, pipe = null, an = null, raf = 0, loop = null, peak = 0, heard = false, done = false, closing = false;
      const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Microphone check</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
        <p class="text-sm text-[var(--muted)] mb-3">Say something. The bar should move when your voice is picked up.</p>
        <select id="mtDev" class="field mb-3 !py-2 text-sm"></select>
        <div class="h-5 rounded-full bg-[var(--panel2)] overflow-hidden relative"><div id="mtBar" class="h-full rounded-full bg-gold transition-[width] duration-75" style="width:0%"></div><span id="mtPeak" class="absolute top-0 bottom-0 w-0.5 bg-onyx dark:bg-snow" style="left:0%"></span></div>
        <canvas id="mtWave" class="w-full h-20 rounded-2xl bg-[var(--panel2)] mt-3"></canvas>
        <div id="mtMsg" class="mt-3 text-sm font-semibold flex items-center gap-2">${ic('mic', 'w-4 h-4')}<span>Waiting for the microphone…</span></div>
        <label class="flex items-center gap-2 text-sm mt-3"><input id="mtNc" type="checkbox" class="w-4 h-4 accent-[#C19552]" ${cfg.get('noiseCancel') ? 'checked' : ''}> Noise cancellation</label>
        <label class="flex items-center gap-2 text-sm mt-2"><input id="mtLoop" type="checkbox" class="w-4 h-4 accent-[#C19552]"> Hear myself <span class="text-xs text-[var(--muted)]">(use headphones)</span></label>
        <div class="flex gap-2 mt-4"><button class="btn btn-ghost flex-1" id="mtSpk">${ic('speaker', 'w-4 h-4')} Test speaker</button>${opts.thenCall ? '<button class="btn btn-gold flex-1" id="mtGo">Start call</button>' : '<button class="btn btn-gold flex-1" data-x>Done</button>'}</div></div>`, { onClose: () => cleanup(false) });
      const msg = (t, good) => { const m = $('#mtMsg', md.box); m.lastElementChild.textContent = t; m.classList.toggle('text-green-600', !!good); };
      async function start(devId) {
        stop();
        try {
          raw = await navigator.mediaDevices.getUserMedia({ audio: Object.assign(audioConstraints(), { noiseSuppression: $('#mtNc', md.box).checked }, devId ? { deviceId: { exact: devId } } : {}) });
        } catch (e) { msg('Microphone blocked or not found. Allow microphone access in your browser, then reopen this.'); return; }
        pipe = pipeline(raw, $('#mtNc', md.box).checked); an = pipe.ac.createAnalyser(); an.fftSize = 1024; pipe.ac.createMediaStreamSource(pipe.stream).connect(an);
        try { const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'), cur = raw.getAudioTracks()[0].getSettings().deviceId; $('#mtDev', md.box).innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || 'Microphone ' + (i + 1))}</option>`).join(''); } catch (e) { }
        msg('Listening… speak now');
        const buf = new Float32Array(an.fftSize), cv = $('#mtWave', md.box), g = cv.getContext('2d'); peak = 0; heard = false;
        const draw = () => {
          raf = requestAnimationFrame(draw); if (!pipe) return; an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]; const rms = Math.sqrt(sum / buf.length), pct = Math.min(100, Math.round(Math.sqrt(rms) * 190));
          $('#mtBar', md.box).style.width = pct + '%'; peak = Math.max(peak * .995, pct); $('#mtPeak', md.box).style.left = Math.min(99.5, peak) + '%';
          if (pct > 14 && !heard) { heard = true; msg('Great — your microphone is working and your voice is being picked up.', true); }
          const w = cv.width = cv.clientWidth * 2, h = cv.height = cv.clientHeight * 2; g.clearRect(0, 0, w, h); g.strokeStyle = '#C19552'; g.lineWidth = 3; g.beginPath();
          for (let i = 0; i < buf.length; i += 4) { const x = i / buf.length * w, y = h / 2 + buf[i] * h * 1.4; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        };
        draw(); setLoop();
      }
      function setLoop() {
        if (loop) { try { loop.disconnect(); } catch (e) { } loop = null; } if (!pipe || !$('#mtLoop', md.box).checked) return;
        const gn = pipe.ac.createGain(); gn.gain.value = .6; pipe.ac.createMediaStreamSource(pipe.stream).connect(gn); gn.connect(pipe.ac.destination); loop = gn;
      }
      function stop() { cancelAnimationFrame(raf); if (loop) { try { loop.disconnect(); } catch (e) { } loop = null; } if (pipe) { pipe.destroy(); pipe = null; } raw = null; }
      function cleanup(ok) { if (done) return; done = true; stop(); res({ ok, heard }); }
      $('[data-x]', md.box).onclick = md.close; md.box.querySelectorAll('[data-x]').forEach(b => b.onclick = md.close);
      $('#mtNc', md.box).onchange = e => { cfg.set('noiseCancel', e.target.checked); if (pipe) pipe.setOn(e.target.checked); };
      $('#mtLoop', md.box).onchange = setLoop; $('#mtDev', md.box).onchange = e => start(e.target.value);
      $('#mtSpk', md.box).onclick = () => N.sfx.preview('chime');
      const go = $('#mtGo', md.box); if (go) go.onclick = () => { cleanup(true); md.m.remove(); };
      if (N.i18nApply) N.i18nApply(md.box);
      start();
    });
  };

  /* ================================================================ CALL SETUP */
  async function getMedia(kind) {
    const out = { raw: null, cam: null, err: '' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { out.err = 'Camera / microphone are not available in this browser'; return out; }
    try { out.raw = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() }); } catch (e) { out.err = 'Microphone blocked — you can listen, but others can’t hear you. Allow the microphone in your browser settings.'; }
    if (kind === 'video') { try { out.cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }); } catch (e) { out.camErr = true; } }
    return out;
  }

  N.startCall = async function (kind, target) {
    if (C) return toast('You are already in a call');
    let chatId, peers, title;
    if (target) ({ chatId, peers, title } = target);
    else { const chat = S.chats.find(c => c.id === S.activeId); if (!chat) return; chatId = chat.id; peers = chat.members.filter(m => m !== S.me.uid); title = N.chatInfo(chat).name; }
    if (!peers || !peers.length) return toast('Nobody else is in this chat yet');
    if (peers.length === 1 && N.isBlocked(peers[0])) return toast('You blocked this contact — unblock to call.');
    if (cfg.get('micCheck') && !sessionStorage.getItem('qb_mic_ok')) { const r = await N.micTest({ thenCall: true }); if (!r.ok) return; try { sessionStorage.setItem('qb_mic_ok', '1'); } catch (e) { } }
    C = { id: null, kind, chatId, peers, role: 'caller', phase: 'ringing', title, pcs: {}, handled: new Set(), joined: [], lines: [], rec: !!cfg.get('recordCalls') };
    const mine = C;
    try {
      const media = await getMedia(kind); if (C !== mine) { releaseMedia(media); return; }
      if (media.err) toast(media.err, 5000);
      attachMedia(media);
      mine.id = await B.startCall({ from: S.me.uid, to: peers, chatId, kind });
      await openCallUI(); stopRing = N.sfx.ringback();
      mine.timeout = setTimeout(() => { if (C === mine && mine.phase === 'ringing') B.updateCall(mine.id, { status: 'missed' }).catch(() => { }); }, 40000);
    } catch (e) { toast(N.friendly(e)); if (C === mine) { teardown(mine); C = null; } }
  };

  function releaseMedia(m) { [m.raw, m.cam].forEach(s => s && s.getTracks().forEach(t => t.stop())); }
  function attachMedia(m) {
    C.rawMic = m.raw; C.camStream = m.cam; C.pipe = m.raw ? pipeline(m.raw, cfg.get('noiseCancel')) : null; C.micTrack = C.pipe && C.pipe.track;
    C.camTrack = m.cam ? m.cam.getVideoTracks()[0] : null;
    const me = S.me; C.avatarCfg = me.avatarCfg || null;
    if (C.kind === 'video') {
      if (C.avatarCfg && (cfg.get('avatarCall') || !C.camTrack)) startAvatarMode(true);
      C.videoTrack = C.avatarMode && C.avatarLive ? C.avatarLive.stream.getVideoTracks()[0] : C.camTrack;
    }
  }
  function startAvatarMode(silent) {
    if (!C || !C.avatarCfg || C.avatarMode) return false;
    C.avatarLive = N.avatarStream(C.avatarCfg); if (!C.avatarLive.stream) { C.avatarLive.destroy(); C.avatarLive = null; return false; }
    C.avatarMode = true;
    if (C.camStream && C.camTrack) {      // camera drives the avatar's smile / mouth / blink when face tracking can load
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = C.camStream; v.play().catch(() => { }); C.trackVid = v;
      C.tracker = N.faceTracker(v, s => { C.face = s; C.faceAt = Date.now(); });
    }
    if (!silent) swapVideo();
    return true;
  }
  function stopAvatarMode() {
    if (!C || !C.avatarMode) return; C.avatarMode = false; if (C.tracker) { C.tracker.stop(); C.tracker = null; } if (C.trackVid) { C.trackVid.srcObject = null; C.trackVid = null; }
    if (C.avatarLive) { C.avatarLive.destroy(); C.avatarLive = null; } swapVideo();
  }
  function swapVideo() {
    if (!C) return; const t = C.avatarMode && C.avatarLive ? C.avatarLive.stream.getVideoTracks()[0] : C.camTrack; C.videoTrack = t || null;
    Object.values(C.pcs).forEach(P => { const s = P.pc.getSenders().find(x => x.track && x.track.kind === 'video') || P.vSender; if (s && t) s.replaceTrack(t).catch(() => { }); });
    paintLocal();
  }

  /* ================================================================ PEER CONNECTIONS */
  function makePC(uid) {
    if (C.pcs[uid]) return C.pcs[uid];
    const pc = new RTCPeerConnection({ iceServers: ICE() }), P = { uid, pc, pending: [], haveRemote: false, stream: new MediaStream(), dc: null, up: false };
    C.pcs[uid] = P;
    if (C.micTrack) pc.addTrack(C.micTrack, C.pipe.stream); else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (C.kind === 'video') { if (C.videoTrack) P.vSender = pc.addTrack(C.videoTrack, new MediaStream([C.videoTrack])); else pc.addTransceiver('video', { direction: 'recvonly' }); }
    pc.onicecandidate = e => { if (e.candidate && C) B.signal(C.id, { from: S.me.uid, to: uid, t: 'ice', c: e.candidate.toJSON() }).catch(() => { }); };
    pc.ontrack = e => { P.stream.addTrack(e.track); e.track.onunmute = () => attachRemote(P); attachRemote(P); };
    pc.ondatachannel = e => setupDC(P, e.channel);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected' && !P.up) { P.up = true; peerUp(P); }
      if ((st === 'failed') && C && C.pcs[uid] === P) { if (!P.restarted && S.me.uid < uid) { P.restarted = true; sendOffer(P, true); } else toast('Connection problem with ' + ((S.users[uid] || {}).username || 'a participant') + ' — your network may block calls. Try another Wi-Fi or mobile data.', 6000); }
    };
    return P;
  }
  async function sendOffer(P, restart) {
    try {
      if (!P.dc) setupDC(P, P.pc.createDataChannel('qb'));
      const o = await P.pc.createOffer(restart ? { iceRestart: true } : {}); await P.pc.setLocalDescription(o);
      await B.signal(C.id, { from: S.me.uid, to: P.uid, t: 'offer', sdp: P.pc.localDescription.sdp });
    } catch (e) { console.warn('offer failed', e); }
  }
  async function onSignal(sg) {
    if (!C) return; const P = makePC(sg.from);
    try {
      if (sg.t === 'offer') {
        await P.pc.setRemoteDescription({ type: 'offer', sdp: sg.sdp }); P.haveRemote = true; await flush(P);
        const a = await P.pc.createAnswer(); await P.pc.setLocalDescription(a); await B.signal(C.id, { from: S.me.uid, to: sg.from, t: 'answer', sdp: P.pc.localDescription.sdp });
      } else if (sg.t === 'answer') { await P.pc.setRemoteDescription({ type: 'answer', sdp: sg.sdp }); P.haveRemote = true; await flush(P); }
      else if (sg.t === 'ice') { if (P.haveRemote) await P.pc.addIceCandidate(sg.c).catch(() => { }); else P.pending.push(sg.c); }
    } catch (e) { console.warn('signal error', sg.t, e); }
  }
  async function flush(P) { const l = P.pending.splice(0); for (const c of l) await P.pc.addIceCandidate(c).catch(() => { }); }

  /* data channel: live captions, camera on/off, recording notice */
  function setupDC(P, ch) {
    P.dc = ch;
    ch.onopen = () => { if (C && C.recOn) ch.send(JSON.stringify({ t: 'rec', on: true })); sendCam(); };
    ch.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (m.t === 'cap') addLine(P.uid, m.text);
      else if (m.t === 'cam') { P.camOn = m.on; paintTile(P.uid); }
      else if (m.t === 'rec') { P.rec = m.on; paintRec(); }
    };
  }
  const dcAll = o => { if (!C) return; const s = JSON.stringify(o); Object.values(C.pcs).forEach(P => { if (P.dc && P.dc.readyState === 'open') P.dc.send(s); }); };
  const sendCam = () => dcAll({ t: 'cam', on: !!(C && C.videoTrack && C.videoTrack.enabled) });

  /* ================================================================ CALL UI */
  async function openCallUI() {
    const peers = C.peers.map(p => S.users[p]).filter(Boolean), group = peers.length > 1, cols = peers.length <= 1 ? 'grid-cols-1' : peers.length <= 4 ? 'grid-cols-2' : 'grid-cols-3', video = C.kind === 'video';
    const btn = (id, icon, title, cls = '') => `<button id="${id}" class="cbtn ${cls}" title="${title}">${ic(icon, 'w-6 h-6')}</button>`;
    const ui = C.ui = el(`<div id="callUI" class="fixed inset-0 z-[100] call-bg text-snow flex flex-col fade-in">
      <div class="text-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2"><div class="text-xl font-bold truncate">${esc(C.title || (peers[0] && peers[0].username) || 'Call')}</div>
        <div class="flex items-center justify-center gap-2 text-sm opacity-90"><span id="cStatus">Calling…</span><span id="cRec" class="rec-badge hidden">● REC</span></div></div>
      <div id="cTiles" class="flex-1 min-h-0 p-3 grid ${cols} gap-3 auto-rows-fr">${peers.map(p => `<div class="ctile" data-peer="${esc(p.uid)}">
        <video data-rv class="absolute inset-0 w-full h-full object-cover hidden" autoplay playsinline></video>
        <div data-fb class="absolute inset-0 flex flex-col items-center justify-center"><div class="cav ${group ? 'sm' : ''}" data-av></div>
        <div class="mt-3 font-semibold drop-shadow">${esc(p.username)}</div><div class="text-xs opacity-80" data-ps>Ringing…</div></div></div>`).join('')}</div>
      <div id="cCap" class="hidden mx-3 mb-2 px-3 py-2 rounded-2xl bg-onyx/70 text-sm max-h-24 overflow-y-auto"></div>
      <div id="cPip" class="hidden absolute end-3 top-20 w-28 sm:w-40 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-gold shadow-xl bg-onyx z-10"><video id="cLocal" class="w-full h-full object-cover mirror" muted playsinline autoplay></video><div id="cLocalAv" class="hidden w-full h-full"></div></div>
      <div id="cAvBar" class="hidden justify-center gap-2 pb-2">${[['😊', 0], ['😁', 1], ['😮', 3], ['😉', 4], ['😢', 5]].map(([e, i]) => `<button class="av-ex" data-ex="${i}">${e}</button>`).join('')}</div>
      <div class="flex justify-center items-end gap-1 h-6 lvl" id="cLvl">${'<i></i>'.repeat(12)}</div>
      <div class="flex justify-center flex-wrap gap-3 sm:gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        ${btn('cMic', 'mic', 'Mute')}${video ? btn('cCam', 'video', 'Camera') : ''}${video && C.avatarCfg ? btn('cAvm', 'smile', 'Avatar mode') : ''}${btn('cNc', 'shield', 'Noise cancellation')}${btn('cRecBtn', 'rec', 'Record call')}${btn('cCc', 'type', 'Captions')}
        <button id="cEnd" class="w-16 h-14 rounded-full bg-royal border-2 border-gold flex items-center justify-center" title="End call"><span class="rotate-[135deg]">${ic('phone', 'w-6 h-6')}</span></button></div></div>`);
    document.body.append(ui);
    peers.forEach(p => { const box = $(`[data-peer="${p.uid}"] [data-av]`, ui); setTileAvatar(p.uid, box); });
    $('#cEnd', ui).onclick = () => hangup();
    $('#cMic', ui).onclick = e => { const t = C.micTrack; if (!t) return toast('No microphone'); t.enabled = !t.enabled; C.muted = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? 'mic' : 'micoff', 'w-6 h-6'); e.currentTarget.classList.toggle('on', C.muted); };
    const cam = $('#cCam', ui); if (cam) cam.onclick = e => { if (C.avatarMode) return toast('Turn off avatar mode to use the camera'); const t = C.camTrack; if (!t) return toast('No camera available'); t.enabled = !t.enabled; e.currentTarget.innerHTML = ic(t.enabled ? 'video' : 'videooff', 'w-6 h-6'); e.currentTarget.classList.toggle('on', !t.enabled); paintLocal(); sendCam(); };
    const avm = $('#cAvm', ui); if (avm) { avm.classList.toggle('on', !!C.avatarMode); avm.onclick = () => { if (C.avatarMode) stopAvatarMode(); else if (!startAvatarMode()) toast('Avatar mode is not available here'); avm.classList.toggle('on', !!C.avatarMode); $('#cAvBar', ui).classList.toggle('hidden', !C.avatarMode); $('#cAvBar', ui).classList.toggle('flex', !!C.avatarMode); sendCam(); }; if (C.avatarMode) { $('#cAvBar', ui).classList.remove('hidden'); $('#cAvBar', ui).classList.add('flex'); } }
    $$('[data-ex]', ui).forEach(b => b.onclick = () => { C.exprOverride = +b.dataset.ex; clearTimeout(C.exprT); C.exprT = setTimeout(() => { C.exprOverride = null; }, 4000); });
    const nc = $('#cNc', ui); nc.classList.toggle('on', !!cfg.get('noiseCancel')); nc.onclick = () => { const v = !cfg.get('noiseCancel'); cfg.set('noiseCancel', v); if (C.pipe) C.pipe.setOn(v); nc.classList.toggle('on', v); toast(v ? 'Noise cancellation on' : 'Noise cancellation off'); };
    const rb = $('#cRecBtn', ui); rb.classList.toggle('on', C.rec); rb.onclick = () => { C.rec = !C.rec; rb.classList.toggle('on', C.rec); if (C.phase === 'active') { C.rec ? startRecording() : stopRecording(false); } toast(C.rec ? 'Recording will start when the call connects' : 'Recording off'); };
    $('#cCc', ui).onclick = e => { C.cc = !C.cc; e.currentTarget.classList.toggle('on', C.cc); $('#cCap', ui).classList.toggle('hidden', !C.cc); renderCaps(); if (C.cc && C.phase === 'active') startCaptions(); };
    paintLocal(); if (N.i18nApply) N.i18nApply(ui);
    const buf = new Uint8Array(32);
    const loop = () => {
      if (!C || C.ui !== ui) return; C.raf = requestAnimationFrame(loop);
      const lv = C.pipe ? C.pipe.level() : 0;
      $$('#cLvl i', ui).forEach((b, i) => b.style.height = (C.muted ? 4 : 4 + Math.min(1, lv * 14) * (8 + (i % 4) * 4)) + 'px');
      if (C.avatarLive) { const face = C.face && Date.now() - C.faceAt < 600 ? C.face : null; C.avatarLive.set({ mouth: face ? Math.max(face.mouthFace * 1.4, 0) : Math.min(1, lv * 9), smile: face ? Math.min(1, face.smile) : null, blink: face ? face.blink : undefined, expr: C.exprOverride != null ? C.exprOverride : (face && face.wow ? 3 : null) }); if (!face) C.avatarLive.set({ blink: undefined }); }
      if (C.localLive) { const face = C.face && Date.now() - C.faceAt < 600 ? C.face : null; C.localLive.set({ mouth: face ? face.mouthFace * 1.4 : Math.min(1, lv * 9), smile: face ? Math.min(1, face.smile) : null, expr: C.exprOverride != null ? C.exprOverride : (face && face.wow ? 3 : null) }); }
      Object.values(C.pcs).forEach(P => { if (!P.an) return; P.an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } const r = Math.sqrt(s / buf.length); P.level = P.level * .6 + r * .4; const tile = $(`[data-peer="${P.uid}"]`, ui); if (tile) { const sp = P.level > .03; tile.classList.toggle('speaking', sp); if (P.live) P.live.set({ mouth: Math.min(1, P.level * 9) }); } });
      if (C.phase === 'active' && C.t0) $('#cStatus', ui).textContent = fmt((Date.now() - C.t0) / 1000);
    };
    C.raf = requestAnimationFrame(loop);
  }
  function setTileAvatar(uid, box) {
    if (!box) return; const u = S.users[uid] || {}, P = C.pcs[uid];
    if (P && P.live) { P.live.destroy(); P.live = null; }
    if (u.avatarCfg) { box.classList.add('animated'); const live = N.liveAvatar(box, u.avatarCfg); if (P) P.live = live; else (C.pre = C.pre || {})[uid] = live; }
    else box.innerHTML = `<img class="w-full h-full object-cover" src="${esc(N.avatar(u))}">`;
  }
  function paintLocal() {
    if (!C || !C.ui) return; const pip = $('#cPip', C.ui), v = $('#cLocal', C.ui), av = $('#cLocalAv', C.ui); if (!pip) return;
    if (C.localLive) { C.localLive.destroy(); C.localLive = null; }
    if (C.kind !== 'video') return pip.classList.add('hidden');
    if (C.avatarMode && C.avatarCfg) { pip.classList.remove('hidden'); v.classList.add('hidden'); av.classList.remove('hidden'); C.localLive = N.liveAvatar(av, C.avatarCfg); return; }
    av.classList.add('hidden'); if (C.camStream && C.camTrack) { v.srcObject = C.camStream; v.classList.remove('hidden'); v.style.opacity = C.camTrack.enabled ? 1 : .15; pip.classList.remove('hidden'); } else pip.classList.add('hidden');
  }
  function attachRemote(P) {
    if (!C || !C.ui) return; const tile = $(`[data-peer="${P.uid}"]`, C.ui); if (!tile) return;
    const hasAudio = P.stream.getAudioTracks().length, vt = P.stream.getVideoTracks()[0];
    if (hasAudio && !P.audioEl) {
      const a = document.createElement('audio'); a.autoplay = true; a.playsInline = true; a.srcObject = new MediaStream(P.stream.getAudioTracks()); a.style.display = 'none'; C.ui.append(a); P.audioEl = a; a.play().catch(() => { toast('Tap anywhere to hear the other person'); document.addEventListener('pointerdown', () => a.play().catch(() => { }), { once: true }); });
      try { P.ac = P.ac || new AC(); P.an = P.ac.createAnalyser(); P.an.fftSize = 512; P.ac.createMediaStreamSource(new MediaStream(P.stream.getAudioTracks())).connect(P.an); P.level = 0; } catch (e) { }
      if (C.recOn && C.mix) connectRemoteToMix(P);
    }
    if (vt && !P.videoAttached) { P.videoAttached = true; const v = $('[data-rv]', tile); v.srcObject = new MediaStream([vt]); v.play().catch(() => { }); }
    paintTile(P.uid);
  }
  function paintTile(uid) {
    if (!C || !C.ui) return; const tile = $(`[data-peer="${uid}"]`, C.ui), P = C.pcs[uid]; if (!tile || !P) return;
    const showVid = C.kind === 'video' && P.videoAttached && P.camOn !== false;
    $('[data-rv]', tile).classList.toggle('hidden', !showVid); $('[data-fb]', tile).classList.toggle('hidden', showVid && P.camOn !== false && false);
    $('[data-fb]', tile).style.opacity = showVid ? 0 : 1;
    const u = S.users[uid] || {}, box = $('[data-av]', tile); if (P.live == null && box && !(box.dataset.set)) { box.dataset.set = 1; setTileAvatar(uid, box); if (C.pre && C.pre[uid]) { P.live = C.pre[uid]; } }
  }
  function paintRec() {
    if (!C || !C.ui) return; const on = C.recOn || Object.values(C.pcs).some(p => p.rec); const b = $('#cRec', C.ui); if (b) b.classList.toggle('hidden', !on);
  }
  function peerUp(P) {
    if (!C) return; if (C.phase !== 'active') connected();
    const t = $(`[data-peer="${P.uid}"] [data-ps]`, C.ui); if (t) t.textContent = 'Connected'; paintTile(P.uid);
  }
  function connected() {
    if (!C || C.phase === 'active') return; C.phase = 'active'; C.t0 = Date.now(); if (stopRing) { stopRing(); stopRing = null; } clearTimeout(C.timeout);
    if (C.ui) $$('[data-ps]', C.ui).forEach(n => n.textContent = 'Connected');
    toast('Call connected'); if (C.rec) startRecording(); if (C.cc || cfg.get('autoTranscribe') && C.rec) startCaptions();
  }

  /* ================================================================ RECORDING + TRANSCRIPT */
  function startRecording() {
    if (!C || C.recOn || !AC || !window.MediaRecorder) return;
    try {
      C.mix = new AC(); C.mixDest = C.mix.createMediaStreamDestination();
      if (C.pipe) C.mix.createMediaStreamSource(C.pipe.stream).connect(C.mixDest);
      Object.values(C.pcs).forEach(connectRemoteToMix);
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      C.recorder = new MediaRecorder(C.mixDest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : {}); const chunks = C.recChunks = []; C.recT0 = Date.now();
      C.recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      C.recorder.start(1000); C.recOn = true; paintRec(); dcAll({ t: 'rec', on: true }); toast('● Recording this call — the other person can see the REC badge');
    } catch (e) { console.warn('recording failed', e); C.recOn = false; }
  }
  function connectRemoteToMix(P) { if (!C || !C.mix || P.mixed || !P.stream.getAudioTracks().length) return; try { C.mix.createMediaStreamSource(new MediaStream(P.stream.getAudioTracks())).connect(C.mixDest); P.mixed = true; } catch (e) { } }
  function stopRecording() {
    return new Promise(res => {
      if (!C || !C.recorder || !C.recOn) return res(null); const r = C.recorder, chunks = C.recChunks, t0 = C.recT0; C.recOn = false; paintRec(); dcAll({ t: 'rec', on: false });
      r.onstop = () => res(chunks.length ? { blob: new Blob(chunks, { type: chunks[0].type || 'audio/webm' }), dur: (Date.now() - t0) / 1000 } : null);
      try { r.state !== 'inactive' ? r.stop() : res(null); } catch (e) { res(null); }
    });
  }
  function startCaptions() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR || C.sr || !C.micTrack) return;
    try {
      const sr = C.sr = new SR(); sr.continuous = true; sr.interimResults = false; sr.lang = N.speechLang();
      sr.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const text = e.results[i][0].transcript.trim(); if (text && !C.muted) { addLine(S.me.uid, text); dcAll({ t: 'cap', text }); } } };
      sr.onend = () => { if (C && C.sr === sr && C.phase === 'active') { try { sr.start(); } catch (e) { } } };
      sr.onerror = () => { };
      sr.start();
    } catch (e) { C.sr = null; }
  }
  function addLine(uid, text) { if (!C) return; C.lines.push({ uid, t: C.t0 ? Math.round((Date.now() - C.t0) / 1000) : 0, text }); renderCaps(); }
  function renderCaps() { if (!C || !C.ui) return; const b = $('#cCap', C.ui); if (!b || b.classList.contains('hidden')) return; b.innerHTML = C.lines.slice(-6).map(l => `<div><b>${esc(l.uid === S.me.uid ? 'You' : (S.users[l.uid] || {}).username || 'Them')}:</b> ${esc(l.text)}</div>`).join('') || '<div class="opacity-70">Captions will appear here while people talk…</div>'; b.scrollTop = b.scrollHeight; }

  /* ================================================================ END OF CALL */
  async function hangup() {
    if (!C) return; const c = C;
    try {
      if (c.peers.length <= 1) await B.updateCall(c.id, { status: 'ended', endedAt: Date.now() });
      else { const cur = (S.calls.find(x => x.id === c.id) || {}).joined || [], left = cur.filter(u => u !== S.me.uid); await B.updateCall(c.id, left.length <= 1 ? { joined: left, status: 'ended', endedAt: Date.now() } : { joined: left }); }
    } catch (e) { }
    endLocal('ended');
  }
  function teardown(c) {
    cancelAnimationFrame(c.raf); clearTimeout(c.timeout); clearTimeout(c.exprT); if (stopRing) { stopRing(); stopRing = null; }
    if (c.sr) { const s = c.sr; c.sr = null; try { s.stop(); } catch (e) { } }
    Object.values(c.pcs).forEach(P => { try { P.pc.close(); } catch (e) { } if (P.live) P.live.destroy(); if (P.ac && P.ac.state !== 'closed') { try { P.ac.close(); } catch (e) { } } });
    if (c.tracker) c.tracker.stop(); if (c.avatarLive) c.avatarLive.destroy(); if (c.localLive) c.localLive.destroy();
    if (c.camStream) c.camStream.getTracks().forEach(t => t.stop()); if (c.pipe) c.pipe.destroy(); if (c.mix && c.mix.state !== 'closed') { try { c.mix.close(); } catch (e) { } }
    if (c.ui) c.ui.remove();
  }
  async function endLocal(reason) {
    if (!C) return; const c = C; C = null;
    const rec = c.recOn ? await (async () => { C = c; const r = await stopRecording(); C = null; return r; })() : null;
    teardown(c);
    const kindLbl = c.kind === 'video' ? 'video' : 'voice';
    if (c.role === 'caller' && c.id) {
      const text = c.t0 ? `${kindLbl[0].toUpperCase() + kindLbl.slice(1)} call · ${fmt((Date.now() - c.t0) / 1000)}` : reason === 'declined' ? `Declined ${kindLbl} call` : `Missed ${kindLbl} call`;
      B.sendMessage(c.chatId, { from: S.me.uid, type: 'call', text }).catch(() => { });
    }
    toast(c.t0 ? 'Call ended' : reason === 'declined' ? 'Call declined' : reason === 'missed' ? 'No answer' : 'Call cancelled');
    if (rec && c.id) {
      try {
        const max = B.maxUpload || 10 * 1048576; if (rec.blob.size > max) throw new Error('The recording is too large to save (' + Math.round(rec.blob.size / 1048576) + ' MB, limit ' + Math.round(max / 1048576) + ' MB)');
        toast('Saving your call recording…');
        const url = await B.uploadMedia(rec.blob, null, true);
        await B.setCallRec(c.id, S.me.uid, { url, dur: Math.round(rec.dur), size: rec.blob.size, transcript: c.lines.map(l => ({ uid: l.uid, t: l.t, text: l.text })) });
        toast('Call recording saved — find it in your Calls tab');
      } catch (e) {
        console.warn('recording save failed', e); const href = URL.createObjectURL(rec.blob), ext = /mp4/.test(rec.blob.type) ? 'm4a' : /ogg/.test(rec.blob.type) ? 'ogg' : 'webm';
        const md = modal(`<div class="p-5"><h3 class="text-lg font-bold mb-2">Recording couldn’t be saved to your history</h3><p class="text-sm text-[var(--muted)] mb-3">${esc(e.message || 'Unknown error')}</p><p class="text-sm mb-4">Your recording is still here — download it now so it isn’t lost.</p>
          <div class="flex gap-2 justify-end"><button class="btn btn-ghost" data-x>Close</button><a class="btn btn-gold" href="${href}" download="call-${Date.now()}.${ext}">Download recording</a></div></div>`);
        $('[data-x]', md.box).onclick = md.close;
      }
    }
  };

  /* ================================================================ INCOMING */
  function showIncoming(d) {
    if (!N.callAllowed(d.from)) { dismissed.add(d.id); return; }          // Do Not Disturb (favourites still get through)
    incomingId = d.id; const from = S.users[d.from] || { username: 'Someone' }, chat = S.chats.find(c => c.id === d.chatId), grp = chat && chat.type === 'group', vip = cfg.isFav(d.from);
    incomingEl = el(`<div class="fixed inset-0 z-[110] call-bg text-snow flex flex-col items-center justify-center p-6 fade-in">
      <div class="relative"><div class="cav big">${from.avatarCfg ? '' : `<img class="w-full h-full object-cover" src="${esc(N.avatar(from))}">`}</div><div class="absolute inset-0 rounded-full speak"></div></div>
      ${vip ? '<div class="mt-4 text-xs font-bold px-3 py-1 rounded-full bg-gold text-onyx">★ Favourite</div>' : ''}
      <div class="text-3xl font-bold mt-4 text-center">${esc(grp ? chat.name : from.username)}</div><div class="opacity-85 mt-1">${grp ? esc(from.username) + ' is ' : ''}Incoming ${d.kind === 'video' ? 'video' : 'voice'} call…</div>
      <div class="flex gap-12 mt-14"><button id="inDec" class="w-16 h-16 rounded-full bg-royal border-2 border-gold flex items-center justify-center" title="Decline"><span class="rotate-[135deg]">${ic('phone', 'w-7 h-7')}</span></button>
      <button id="inAcc" class="w-16 h-16 rounded-full bg-gold text-onyx flex items-center justify-center ringing" title="Accept">${ic(d.kind === 'video' ? 'video' : 'phone', 'w-7 h-7')}</button></div></div>`);
    if (from.avatarCfg) { const b = $('.cav', incomingEl); N.liveAvatar(b, from.avatarCfg); }
    document.body.append(incomingEl); if (N.i18nApply) N.i18nApply(incomingEl);
    stopRing = N.sfx.ring(N.sfx.ringFor(d.from, d.chatId));
    $('#inDec', incomingEl).onclick = () => { dismissed.add(d.id); closeIncoming(); if (d.to.length <= 1) B.updateCall(d.id, { status: 'declined' }).catch(() => { }); };
    $('#inAcc', incomingEl).onclick = async () => {
      dismissed.add(d.id); closeIncoming();
      if (C) return toast('You are already in a call');
      C = { id: d.id, kind: d.kind, chatId: d.chatId, peers: d.parties.filter(p => p !== S.me.uid), role: 'callee', phase: 'ringing', title: grp ? chat.name : from.username, pcs: {}, handled: new Set(), joined: [], lines: [], rec: !!cfg.get('recordCalls') };
      const mine = C;
      try {
        const media = await getMedia(d.kind); if (C !== mine) { releaseMedia(media); return; }
        if (media.err) toast(media.err, 5000);
        attachMedia(media); await openCallUI(); await B.joinCall(d.id, S.me.uid);
      } catch (e) { toast(N.friendly(e)); if (C === mine) { teardown(mine); C = null; } }
    };
  }
  function closeIncoming() { if (stopRing && !C) { stopRing(); stopRing = null; } else if (stopRing && incomingEl) { stopRing(); stopRing = null; } if (incomingEl) incomingEl.remove(); incomingEl = null; incomingId = null; }

  N.onCalls = function (list) {
    list = list.filter(c => c.from === S.me.uid || !N.isBlocked(c.from));
    S.calls = list; if (S.tab === 'calls' && N.renderList) N.renderList();
    if (incomingId) { const d = list.find(x => x.id === incomingId); if (!d || d.status !== 'ringing' || d.ts < Date.now() - 45000) closeIncoming(); }
    if (C && C.id) {
      const d = list.find(x => x.id === C.id); if (!d) return;
      if (['ended', 'declined', 'missed'].includes(d.status)) return endLocal(d.status);
      const joined = d.joined || [], me = S.me.uid;
      if (C.role === 'caller' && joined.length > 1 && C.phase === 'ringing') { C.phase = 'connecting'; if (C.ui) $$('[data-ps]', C.ui).forEach(n => n.textContent = 'Connecting…'); if (stopRing) { stopRing(); stopRing = null; } }
      if (joined.includes(me)) joined.forEach(u => {      // pair with everybody who joined; the lower id makes the offer
        if (u === me) return; const known = !!C.pcs[u], P = makePC(u);
        if (!known && me < u) sendOffer(P);
      });
      Object.keys(C.pcs).forEach(u => { if (!joined.includes(u) && C.pcs[u].up) { try { C.pcs[u].pc.close(); } catch (e) { } const t = $(`[data-peer="${u}"] [data-ps]`, C.ui); if (t) t.textContent = 'Left'; delete C.pcs[u]; } });
      (d.sig || []).forEach(sg => { if (sg.to === me && !C.handled.has(sg.id)) { C.handled.add(sg.id); C.chain = (C.chain || Promise.resolve()).then(() => onSignal(sg)); } });
      return;
    }
    if (C || incomingEl) return;
    const inc = list.find(x => x.status === 'ringing' && x.from !== S.me.uid && x.to.includes(S.me.uid) && x.ts > Date.now() - 40000 && !dismissed.has(x.id));
    if (inc) showIncoming(inc);
  };
  N.resetCalls = function () { if (C) { const id = C.id; if (id) B.updateCall(id, { status: 'ended', endedAt: Date.now() }).catch(() => { }); endLocal('ended'); } closeIncoming(); };

  /* ================================================================ CALL HISTORY (Calls tab) */
  function callWho(c) {
    const chat = S.chats.find(x => x.id === c.chatId), peers = c.parties.filter(p => p !== S.me.uid);
    if (chat) { const i = N.chatInfo(chat); return { name: i.name, photo: i.photo, peers, chatId: c.chatId }; }
    const u = S.users[peers[0]] || {}; return { name: u.username || 'Unknown', photo: N.avatar(u), peers, chatId: c.chatId };
  }
  function callState(c) {
    const out = c.from === S.me.uid, answered = !!c.answeredAt || c.status === 'active';
    if (c.status === 'ringing' && c.ts > Date.now() - 60000) return { out, missed: false, label: 'Ringing…' };
    if (answered) return { out, missed: false, label: out ? 'Outgoing' : 'Incoming' };
    if (c.status === 'declined') return { out, missed: false, label: 'Declined' };
    return { out, missed: !out, label: out ? 'No answer' : 'Missed' };
  }
  N.renderCallList = function (box) {
    const q = S.q.trim().toLowerCase();
    const rows = S.calls.slice().sort((a, b) => b.ts - a.ts).slice(0, 100).map(c => ({ c, w: callWho(c), st: callState(c) })).filter(r => !q || r.w.name.toLowerCase().includes(q));
    let html = `<button class="row" data-newcall><span class="call-new">${ic('phone', 'w-5 h-5')}</span><div class="text-start"><div class="font-semibold">New call</div><div class="text-sm text-[var(--muted)]">Call a contact or a group</div></div></button>
      <button class="row" data-mictest><span class="call-new alt">${ic('mic', 'w-5 h-5')}</span><div class="text-start"><div class="font-semibold">Test microphone</div><div class="text-sm text-[var(--muted)]">See your volume level before you call</div></div></button>`;
    html += rows.length ? '<div class="px-3 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Recent</div>' + rows.map(({ c, w, st }) => {
      const icon = st.missed ? 'phonemiss' : st.out ? 'phoneout' : 'phonein', dur = c.answeredAt && c.endedAt ? ' · ' + fmt((c.endedAt - c.answeredAt) / 1000) : '', rec = c.recs && c.recs[S.me.uid];
      return `<div class="row"><img class="w-[52px] h-[52px] rounded-[18px] object-cover" src="${esc(w.photo)}"><div class="flex-1 min-w-0"><div class="font-bold truncate ${st.missed ? 'text-royal dark:text-gold' : ''}">${esc(w.name)}</div>
        <div class="text-sm text-[var(--muted)] flex items-center gap-1.5 truncate"><span class="shrink-0 ${st.missed ? 'text-royal dark:text-gold' : ''}">${ic(icon, 'w-4 h-4')}</span><span class="truncate">${st.label} · ${N.dayLabel(c.ts)}, ${N.timeStr(c.ts)}${dur}${c.kind === 'video' ? ' · video' : ''}</span></div></div>
        ${rec ? `<button class="icon-btn soft" data-rec="${esc(c.id)}" title="Play recording & transcript">${ic('rec')}</button>` : ''}
        <button class="icon-btn soft" data-cb="${c.kind}" data-cid="${esc(c.id)}" title="Call back">${ic(c.kind === 'video' ? 'video' : 'phone')}</button></div>`;
    }).join('') : `<div class="p-8 text-center text-[var(--muted)]"><div class="mx-auto w-14 h-14 rounded-full bg-[var(--panel2)] flex items-center justify-center mb-3">${ic('phone', 'w-7 h-7')}</div>${q ? 'No calls match “' + esc(S.q) + '”.' : 'No calls yet.<br>Tap New call to ring someone.'}</div>`;
    box.innerHTML = html;
  };
  N.callBack = function (id, kind) {
    const c = S.calls.find(x => x.id === id); if (!c) return; const w = callWho(c);
    N.startCall(kind, { chatId: w.chatId, peers: w.peers, title: w.name });
  };
  N.playRecording = async function (id) {
    const c = S.calls.find(x => x.id === id), r = c && c.recs && c.recs[S.me.uid]; if (!r) return;
    const w = callWho(c), md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">Call recording</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <div class="text-sm text-[var(--muted)] mb-3">${esc(w.name)} · ${N.dayLabel(c.ts)}, ${N.timeStr(c.ts)} · ${fmt(r.dur || 0)}</div>
      <audio id="recAudio" controls class="w-full mb-4"></audio>
      <div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Transcript</div>
      <div class="max-h-[34dvh] overflow-y-auto space-y-1.5 text-sm">${(r.transcript || []).length ? r.transcript.map(l => `<div><b>${esc(l.uid === S.me.uid ? 'You' : (S.users[l.uid] || {}).username || 'Them')}</b> <span class="text-xs text-[var(--muted)]">${fmt(l.t || 0)}</span><div>${esc(l.text)}</div></div>`).join('') : '<div class="text-[var(--muted)]">No transcript for this call — your browser may not support speech-to-text, or nobody spoke while captions were running.</div>'}</div></div>`);
    $('[data-x]', md.box).onclick = md.close; md.m.addEventListener('mousedown', e => { if (e.target === md.m) $('#recAudio', md.box).pause(); });
    const au = $('#recAudio', md.box); au.src = await U.mediaURL(r.url);
    au.addEventListener('loadedmetadata', () => { if (au.duration === Infinity) { au.currentTime = 1e101; au.addEventListener('timeupdate', function f() { au.removeEventListener('timeupdate', f); au.currentTime = 0; }); } });
    au.play().catch(() => { });
    if (N.i18nApply) N.i18nApply(md.box);
  };
  N.newCallPicker = function () {
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold">New call</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <input id="ncq2" class="field mb-3" placeholder="Search contacts or groups…" autocomplete="off"><div id="ncl2" class="max-h-[55dvh] overflow-y-auto -mx-2"></div></div>`);
    const draw = () => {
      const q = $('#ncq2', md.box).value.trim().toLowerCase();
      const groups = S.chats.filter(c => c.type === 'group' && (c.name || '').toLowerCase().includes(q)).map(c => ({ key: 'g:' + c.id, name: c.name, photo: N.chatInfo(c).photo, sub: c.members.length + ' members' }));
      const people = Object.values(S.users).filter(u => u.uid !== S.me.uid && !u.bot && u.username && u.username.toLowerCase().includes(q)).sort((a, b) => (cfg.isFav(b.uid) - cfg.isFav(a.uid)) || a.username.localeCompare(b.username)).map(u => ({ key: 'u:' + u.uid, name: (cfg.isFav(u.uid) ? '★ ' : '') + u.username, photo: N.avatar(u), sub: N.blockedMe(u) ? '' : N.presence(u) }));
      $('#ncl2', md.box).innerHTML = [...groups, ...people].map(r => `<div class="row"><img class="w-11 h-11 rounded-2xl object-cover" src="${esc(r.photo)}"><div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(r.name)}</div><div class="text-xs text-[var(--muted)]">${esc(r.sub)}</div></div>
        <button class="icon-btn soft" data-k="audio" data-t="${esc(r.key)}" title="Voice call">${ic('phone')}</button><button class="icon-btn soft" data-k="video" data-t="${esc(r.key)}" title="Video call">${ic('video')}</button></div>`).join('') || '<div class="p-6 text-center text-[var(--muted)]">No contacts found</div>';
    };
    $('#ncq2', md.box).oninput = draw; draw(); $('[data-x]', md.box).onclick = md.close; setTimeout(() => $('#ncq2', md.box).focus(), 50);
    if (N.i18nApply) N.i18nApply(md.box);
    md.box.addEventListener('click', async e => {
      const b = e.target.closest('[data-k]'); if (!b) return; const kind = b.dataset.k, t = b.dataset.t.slice(0, 1), id = b.dataset.t.slice(2); md.close();
      try {
        if (t === 'g') { const c = S.chats.find(z => z.id === id); if (c) N.startCall(kind, { chatId: c.id, peers: c.members.filter(m => m !== S.me.uid), title: c.name }); }
        else { const cid = await B.ensureDM(S.me.uid, id); N.startCall(kind, { chatId: cid, peers: [id], title: (S.users[id] || {}).username }); }
      } catch (er) { toast(N.friendly(er)); }
    });
  };
})();
