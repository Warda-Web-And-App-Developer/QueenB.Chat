/* QUEENBEE — sounds.js : synthesised sound effects (no audio files needed)
   N.sfx.sent() · N.sfx.recv(chatId, fromUid) · N.sfx.preview(id) · N.sfx.ring(id) → stop() · N.sfx.ringFor(fromUid, chatId) · N.sfx.ringback() → stop() */
(function () {
  'use strict';
  const N = window.Nova, cfg = N.cfg;
  let ctx = null, master = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.connect(ctx.destination); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    master.gain.value = Math.max(0, Math.min(1, cfg.get('volume')));
    return ctx;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (!ctx) ac(); else if (ctx.state === 'suspended') ctx.resume().catch(() => { }); }, { passive: true }));

  /* a note: [freq, startSec, durSec, wave, gain, endFreq?, lowpassHz?] */
  function note(c, t0, [f, st, d, w = 'sine', g = .25, f2, lp]) {
    const o = c.createOscillator(), a = c.createGain(); o.type = w; o.frequency.setValueAtTime(f, t0 + st);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + st + d);
    let out = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); out = fl; }
    out.connect(a); a.connect(master);
    a.gain.setValueAtTime(.0001, t0 + st); a.gain.exponentialRampToValueAtTime(g, t0 + st + Math.min(.02, d / 3)); a.gain.exponentialRampToValueAtTime(.0001, t0 + st + d);
    o.start(t0 + st); o.stop(t0 + st + d + .05);
  }
  const play = notes => { const c = ac(); if (!c) return; const t0 = c.currentTime + .01; notes.forEach(n => note(c, t0, n)); };

  /* ---- message tones ---- */
  const TONES = {
    pop:    { name: 'Pop',          n: [[880, 0, .08, 'sine', .3], [1320, .07, .12, 'sine', .25]] },
    bubble: { name: 'Bubble',       n: [[420, 0, .16, 'sine', .3, 900], [700, .14, .14, 'sine', .22, 1200]] },
    bell:   { name: 'Golden bell',  n: [[1568, 0, .6, 'triangle', .22], [2349, .02, .5, 'sine', .1]] },
    chime:  { name: 'Chime',        n: [[784, 0, .2, 'sine', .25], [988, .12, .2, 'sine', .25], [1175, .24, .35, 'sine', .25]] },
    drop:   { name: 'Honey drop',   n: [[1300, 0, .28, 'sine', .3, 480]] },
    buzz:   { name: 'Bee buzz',     n: [[220, 0, .12, 'sawtooth', .22, 260, 900], [262, .12, .12, 'sawtooth', .22, 300, 900], [330, .24, .16, 'sawtooth', .2, 360, 900]] },
    tick:   { name: 'Soft tick',    n: [[1800, 0, .04, 'square', .08], [1200, .05, .05, 'square', .06]] }
  };
  const SENT = [[620, 0, .06, 'sine', .16], [930, .05, .09, 'sine', .14]];
  /* ---- ringtones: events inside one cycle, then repeat ---- */
  const RINGS = {
    honey:   { name: 'Honey buzz',  cycle: 2.6, n: [[392, 0, .16, 'sawtooth', .16, 0, 1100], [494, .18, .16, 'sawtooth', .16, 0, 1100], [587, .36, .16, 'sawtooth', .16, 0, 1100], [494, .54, .16, 'sawtooth', .16, 0, 1100], [392, .9, .16, 'sawtooth', .16, 0, 1100], [494, 1.08, .16, 'sawtooth', .16, 0, 1100], [587, 1.26, .3, 'sawtooth', .16, 0, 1100]] },
    classic: { name: 'Classic ring', cycle: 3,  n: [[440, 0, .38, 'sine', .22], [480, 0, .38, 'sine', .22], [440, .5, .38, 'sine', .22], [480, .5, .38, 'sine', .22]] },
    marimba: { name: 'Marimba',     cycle: 2.4, n: [[659, 0, .22, 'triangle', .26], [784, .2, .22, 'triangle', .26], [988, .4, .22, 'triangle', .26], [784, .6, .22, 'triangle', .26], [1319, .8, .5, 'triangle', .26]] },
    fanfare: { name: 'Royal fanfare', cycle: 2.8, n: [[523, 0, .14, 'square', .1, 0, 1800], [523, .16, .14, 'square', .1, 0, 1800], [523, .32, .14, 'square', .1, 0, 1800], [659, .5, .3, 'square', .1, 0, 1800], [784, .85, .55, 'square', .1, 0, 1800]] },
    crystal: { name: 'Crystal',     cycle: 2.6, n: [[1568, 0, .5, 'sine', .18], [2093, .25, .5, 'sine', .14], [1760, .55, .5, 'sine', .16], [2349, .85, .7, 'sine', .12]] },
    pulse:   { name: 'Pulse',       cycle: 2,   n: [[740, 0, .1, 'square', .08, 0, 1500], [740, .2, .1, 'square', .08, 0, 1500], [740, .4, .1, 'square', .08, 0, 1500]] }
  };
  const BACK = { cycle: 4, n: [[440, 0, 1, 'sine', .12], [480, 0, 1, 'sine', .12]] };

  const list = o => Object.keys(o).map(id => ({ id, name: o[id].name }));
  const hash = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const on = () => cfg.get('sound');

  N.sfx = {
    TONES: list(TONES), RINGS: list(RINGS),
    sent() { if (on() && cfg.get('sendSound')) play(SENT); },
    preview(id) { const t = TONES[id] || RINGS[id]; if (t) play(t.n); },
    /* tone for an incoming message: chat's own tone → VIP tone (favourite sender) → global tone */
    toneFor(chatId, fromUid) { const p = cfg.chat(chatId); return p.tone || (fromUid && cfg.isFav(fromUid) ? cfg.get('vipTone') : cfg.get('msgTone')); },
    recv(chatId, fromUid) { if (!on() || !N.shouldNotify(chatId)) return; const t = TONES[this.toneFor(chatId, fromUid)] || TONES.pop; play(t.n); },
    ringFor(fromUid, chatId) { const p = cfg.chat(chatId); return p.ring || (fromUid && cfg.isFav(fromUid) ? cfg.get('vipRingtone') : cfg.get('ringtone')); },
    loop(def) {
      if (!ac()) return () => { };
      let alive = true, timer = 0; const go = () => { if (!alive) return; play(def.n); timer = setTimeout(go, def.cycle * 1000); }; go();
      return () => { alive = false; clearTimeout(timer); };
    },
    ring(id) { return this.loop(RINGS[id] || RINGS.honey); },
    ringback() { return this.loop(BACK); },
    /* a different tone suggested for each chat/group so you can tell them apart by ear */
    suggest(chatId) { const t = Object.keys(TONES), r = Object.keys(RINGS); return { tone: t[hash(chatId) % t.length], ring: r[hash(chatId + 'r') % r.length] }; }
  };
})();
