/* QUEENBEE — avatar.js : build-your-own avatar (skin, hair, clothes, headwear, glasses, expression, girl/boy),
   plus live "Memoji-style" animation (mouth follows your voice, blinking, smile follows your face when the browser can track it).
   API:  N.avatarMarkup(cfg, state)  → <svg> string          N.avatarURI(cfg)  → data: URI (used as the profile photo)
         N.avatarBuilder({cfg}) → Promise<{cfg, photo} | null> (opens the builder)
         N.avatarDefault(seed) → random-ish starting config   N.liveAvatar(box, cfg) → {set(state), destroy()}
         N.avatarStream(cfg) → {stream, set(state), destroy()}   (a video track of the animated avatar, for calls)
         N.faceTracker(videoEl, onState) → {stop()}             (smile / mouth / blink from the camera, when available) */
(function () {
  'use strict';
  const N = window.Nova, { $, $$, esc, el, ic, toast, modal } = N;

  const SKIN = ['#FFE0C7', '#F6CDA6', '#E8B98A', '#D39B6B', '#B87D4E', '#96603A', '#704323', '#4F2D1A'];
  const HAIRC = ['#1E1A17', '#3B2A20', '#6B4423', '#A8552B', '#C19552', '#FFFAA0', '#B9B6AE', '#F2F0EA', '#E58BA8', '#5B8DD6'];
  const CLOTHC = ['#353935', '#C19552', '#FFFAA0', '#FFFAFA', '#C0392B', '#2E8B8B', '#3B6FB6', '#4C8C4A', '#D96B8C'];
  const BGS = ['#FFFAA0', '#C19552', '#353935', '#FFFAFA'];
  const HAIR = { boy: ['short', 'quiff', 'curly', 'buzz', 'long', 'bald'], girl: ['long', 'bob', 'ponytail', 'bun', 'curls', 'pixie'] };
  const CLOTHES = ['tee', 'hoodie', 'suit', 'top', 'turtle'];
  const HEAD = ['none', 'cap', 'beanie', 'crown', 'headband', 'bow', 'hijab', 'phones'];
  const GLASSES = ['none', 'round', 'square', 'shades', 'cat'];
  const EXPR = ['smile', 'grin', 'neutral', 'wow', 'wink', 'sad'];
  const LBL = { tee: 'T-shirt', hoodie: 'Hoodie', suit: 'Suit', top: 'Scoop top', turtle: 'Turtleneck', none: 'None', cap: 'Cap', beanie: 'Beanie', crown: 'Crown', headband: 'Headband', bow: 'Bow', hijab: 'Hijab', phones: 'Headphones', round: 'Round', square: 'Square', shades: 'Shades', cat: 'Cat-eye', smile: 'Smile', grin: 'Grin', neutral: 'Calm', wow: 'Wow', wink: 'Wink', sad: 'Sad', short: 'Short', quiff: 'Quiff', curly: 'Curly', buzz: 'Buzz', long: 'Long', bald: 'Bald', bob: 'Bob', ponytail: 'Ponytail', bun: 'Bun', curls: 'Curls', pixie: 'Pixie' };

  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); };
  const hash = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

  N.avatarDefault = seed => {
    const h = hash(seed || Math.random()), girl = h % 2 === 0, g = girl ? 'girl' : 'boy';
    return { gender: g, skin: h % SKIN.length, hair: (h >> 3) % 6, hairC: (h >> 5) % HAIRC.length, clothes: (h >> 7) % CLOTHES.length, clothC: (h >> 9) % CLOTHC.length, head: 0, glasses: 0, expr: 0, bg: (h >> 11) % BGS.length };
  };
  const norm = c => { const d = N.avatarDefault('x'); c = Object.assign({}, d, c || {}); if (!HAIR[c.gender]) c.gender = 'boy'; return c; };

  /* ---------------------------------------------------------------- drawing */
  function hairParts(c, col, dk) {
    const st = HAIR[c.gender][c.hair % 6], f = (d, extra = '') => `<path d="${d}" fill="${col}" ${extra}/>`, ci = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;
    let back = '', front = '';
    if (c.gender === 'boy') {
      if (st === 'short') front = f('M58 84C54 50 76 35 100 35C126 35 146 50 142 84C136 66 126 58 100 58C76 58 64 66 58 84Z');
      if (st === 'quiff') front = f('M58 84C52 52 72 34 100 34C124 32 148 46 142 84C138 66 128 56 112 54C100 48 80 50 72 62C64 68 60 76 58 84Z') + f('M80 50C84 26 118 20 130 44C114 36 96 38 80 50Z');
      if (st === 'curly') front = ci(68, 62, 15) + ci(86, 50, 16) + ci(108, 48, 17) + ci(128, 56, 15) + ci(140, 74, 12) + ci(60, 80, 11) + ci(100, 62, 11);
      if (st === 'buzz') front = f('M60 80C58 54 78 43 100 43C122 43 142 54 140 80C132 64 122 58 100 58C78 58 68 64 60 80Z', 'opacity=".8"');
      if (st === 'long') { back = f('M54 90C48 54 72 34 100 34C128 34 152 54 146 90L150 142C150 152 140 156 134 150L130 112L70 112L66 150C60 156 50 152 50 142Z'); front = f('M58 86C56 54 78 40 100 40C122 40 144 54 142 86C132 66 116 60 100 62C84 60 68 66 58 86Z'); }
    } else {
      if (st === 'long') { back = f('M52 92C46 52 70 34 100 34C130 34 154 52 148 92L156 162C156 178 138 182 130 172L128 122L72 122L70 172C62 182 44 178 44 162Z'); front = f('M58 92C54 56 74 38 100 38C126 38 146 56 142 92C138 72 122 56 104 56C84 56 66 72 58 92Z'); }
      if (st === 'bob') { back = f('M54 92C48 52 72 36 100 36C128 36 152 52 146 92L148 130C148 140 140 144 132 140L68 140C60 144 52 140 52 130Z'); front = f('M58 88C54 52 76 36 100 36C124 36 146 52 142 88L140 68C126 62 114 70 100 70C86 70 74 62 60 68Z'); }
      if (st === 'ponytail') { back = f('M60 82C56 50 78 38 100 38C122 38 144 50 140 82Z') + f('M136 64C170 62 174 112 160 144C150 122 148 102 136 92Z'); front = f('M58 88C56 54 78 38 100 38C124 38 144 54 142 88C134 66 122 58 100 60C80 58 66 68 58 88Z') + `<circle cx="140" cy="68" r="5" fill="#C19552"/>`; }
      if (st === 'bun') { back = ci(100, 26, 17) + f('M60 82C56 50 78 38 100 38C122 38 144 50 140 82Z'); front = f('M58 88C56 54 78 40 100 40C124 40 144 54 142 88C132 66 118 60 100 60C82 60 68 68 58 88Z'); }
      if (st === 'curls') { back = ci(62, 94, 18) + ci(54, 122, 18) + ci(62, 150, 16) + ci(138, 94, 18) + ci(146, 122, 18) + ci(138, 150, 16) + ci(100, 44, 32); front = ci(70, 60, 15) + ci(90, 50, 16) + ci(112, 50, 16) + ci(132, 60, 15) + ci(58, 82, 11) + ci(142, 82, 11); }
      if (st === 'pixie') front = f('M56 90C50 52 76 33 104 35C130 37 148 56 142 90C140 72 130 62 116 60C100 58 84 62 72 76C66 82 60 92 56 90Z');
    }
    return { back, front };
  }
  function bodyMarkup(c, skin, cc) {
    const sh = shade(cc, -.18), t = `<path d="M30 200C30 168 58 152 88 150L112 150C142 152 170 168 170 200Z" fill="${cc}"/>`, k = CLOTHES[c.clothes % 5];
    const neck = `<path d="M86 124H114V156Q100 170 86 156Z" fill="${shade(skin, -.12)}"/>`;
    if (k === 'tee') return neck + t + `<path d="M86 151Q100 174 114 151L112 148L88 148Z" fill="${shade(skin, -.06)}"/>`;
    if (k === 'hoodie') return neck + t + `<path d="M76 152Q100 140 124 152L132 170Q100 186 68 170Z" fill="${sh}"/><path d="M86 154Q100 168 114 154L110 150L90 150Z" fill="${shade(skin, -.06)}"/><path d="M92 166V186M108 166V186" stroke="#FFFAA0" stroke-width="3" stroke-linecap="round"/>`;
    if (k === 'suit') return neck + t + `<path d="M86 151L100 190L114 151Z" fill="#FFFAFA"/><path d="M86 150L74 196L100 190Z" fill="${sh}"/><path d="M114 150L126 196L100 190Z" fill="${sh}"/><path d="M97 158H103L106 184L100 194L94 184Z" fill="#C19552"/>`;
    if (k === 'top') return neck + t + `<path d="M68 156Q100 192 132 156L128 148H72Z" fill="${shade(skin, -.06)}"/>`;
    return t + `<path d="M84 128H116L120 158H80Z" fill="${cc}"/><path d="M84 148H116" stroke="${sh}" stroke-width="2"/>`;
  }
  function headwearParts(c, cc) {
    const k = HEAD[c.head % 8], sh = shade(cc, -.2);
    if (k === 'cap') return { top: `<path d="M56 72C56 44 78 32 100 32C122 32 144 44 144 72Z" fill="${cc}"/><path d="M60 68L152 68C162 68 166 76 156 78L62 78Z" fill="${sh}"/>` };
    if (k === 'beanie') return { top: `<path d="M57 76C54 40 80 26 100 26C120 26 146 40 143 76Z" fill="${cc}"/><rect x="55" y="66" width="90" height="13" rx="6" fill="${sh}"/><circle cx="100" cy="22" r="8" fill="${shade(cc, .25)}"/>` };
    if (k === 'crown') return { top: `<path d="M66 54L74 26L90 42L100 20L110 42L126 26L134 54Z" fill="#C19552" stroke="#8d6a30" stroke-width="1.5" stroke-linejoin="round"/><circle cx="74" cy="26" r="3.5" fill="#FFFAA0"/><circle cx="100" cy="20" r="3.5" fill="#FFFAA0"/><circle cx="126" cy="26" r="3.5" fill="#FFFAA0"/><rect x="66" y="50" width="68" height="6" rx="2" fill="#a97b3a"/>` };
    if (k === 'headband') return { top: `<path d="M57 68C70 42 130 42 143 68L139 76C126 54 74 54 61 76Z" fill="${cc}"/>` };
    if (k === 'bow') return { top: `<path d="M112 40L138 26V54Z" fill="${cc}"/><path d="M112 40L86 26V54Z" fill="${cc}"/><circle cx="112" cy="40" r="6" fill="${sh}"/>` };
    if (k === 'phones') return { top: `<path d="M56 92C56 38 144 38 144 92" fill="none" stroke="#353935" stroke-width="6" stroke-linecap="round"/><rect x="48" y="84" width="14" height="30" rx="6" fill="#C19552"/><rect x="138" y="84" width="14" height="30" rx="6" fill="#C19552"/>` };
    if (k === 'hijab') return {
      back: `<path d="M42 104C38 50 66 24 100 24C134 24 162 50 158 104C158 134 152 160 142 182L58 182C48 160 42 134 42 104Z" fill="${cc}"/>`,
      top: `<path fill-rule="evenodd" fill="${cc}" d="M46 104C42 56 70 30 100 30C130 30 158 56 154 104L156 168L44 168ZM63 90C63 60 80 50 100 50C120 50 137 60 137 90C137 116 122 136 100 138C78 136 63 116 63 90Z"/><path d="M62 124Q100 168 138 124L150 160L50 160Z" fill="${cc}"/><path d="M63 90C63 60 80 50 100 50C120 50 137 60 137 90" fill="none" stroke="${sh}" stroke-width="2" opacity=".6"/>` };
    return {};
  }
  function glassesMarkup(c) {
    const k = GLASSES[c.glasses % 5];
    if (k === 'round') return '<g fill="rgba(255,250,170,.18)" stroke="#353935" stroke-width="3"><circle cx="82" cy="94" r="14"/><circle cx="118" cy="94" r="14"/></g><path d="M96 94H104" stroke="#353935" stroke-width="3"/><path d="M68 92L58 90M132 92L142 90" stroke="#353935" stroke-width="3"/>';
    if (k === 'square') return '<g fill="rgba(255,250,170,.18)" stroke="#353935" stroke-width="3"><rect x="66" y="82" width="30" height="24" rx="6"/><rect x="104" y="82" width="30" height="24" rx="6"/></g><path d="M96 92H104" stroke="#353935" stroke-width="3"/><path d="M66 90L58 88M134 90L142 88" stroke="#353935" stroke-width="3"/>';
    if (k === 'shades') return '<path d="M64 84H98V98C98 106 92 110 82 110C70 110 64 104 64 94Z" fill="#1d1f1d"/><path d="M102 84H136V94C136 104 130 110 118 110C108 110 102 106 102 98Z" fill="#1d1f1d"/><path d="M98 88H102" stroke="#1d1f1d" stroke-width="3"/><path d="M64 86L56 84M136 86L144 84" stroke="#1d1f1d" stroke-width="3"/><path d="M70 90l8-2M108 90l8-2" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>';
    if (k === 'cat') return '<g fill="rgba(255,250,170,.16)" stroke="#C19552" stroke-width="3" stroke-linejoin="round"><path d="M62 88L96 84C98 100 92 108 80 108C68 108 62 100 62 88Z"/><path d="M138 88L104 84C102 100 108 108 120 108C132 108 138 100 138 88Z"/></g><path d="M96 90H104" stroke="#C19552" stroke-width="3"/>';
    return '';
  }
  /* state: {mouth 0..1 (talking), smile -1..1 (override), blink 0|1, expr (index override)} */
  function render(cfg, st) {
    const c = norm(cfg); st = st || {};
    const skin = SKIN[c.skin % 8], hairc = HAIRC[c.hairC % 10], cc = CLOTHC[c.clothC % 9], bg = BGS[c.bg % 4], girl = c.gender === 'girl';
    const hw = headwearParts(c, cc), hijab = HEAD[c.head % 8] === 'hijab';
    const hp = hijab ? { back: '', front: '' } : hairParts(c, hairc, shade(hairc, -.2));
    const ex = EXPR[(st.expr != null ? st.expr : c.expr) % 6], dark = '#2b2623', lip = '#8a3b3b', blink = st.blink ? 1 : 0, m = Math.max(0, Math.min(1, st.mouth || 0));
    const head = girl ? 'M62 88C62 58 80 45 100 45C120 45 138 58 138 88C138 116 122 140 100 142C78 140 62 116 62 88Z' : 'M58 88C58 58 76 44 100 44C124 44 142 58 142 88C142 114 128 138 100 142C72 138 58 114 58 88Z';
    const eye = (x, closed, arc) => (closed || arc) ? `<path d="M${x - 6} ${arc ? 97 : 95}Q${x} ${arc ? 89 : 99} ${x + 6} ${arc ? 97 : 95}" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>` : `<ellipse cx="${x}" cy="94" rx="5.2" ry="6.6" fill="${dark}"/><circle cx="${x + 1.8}" cy="91.6" r="1.8" fill="#FFFAFA"/>`;
    const eyeL = eye(82, blink, ex === 'grin'), eyeR = eye(118, blink || ex === 'wink', ex === 'grin');
    const lash = girl && !blink ? `<path d="M75 90L71 86M125 90L129 86" stroke="${dark}" stroke-width="2.2" stroke-linecap="round"/>` : '';
    const bw = girl ? 2.6 : 4, by = ex === 'wow' ? -4 : 0, bcol = shade(hairc, -.15) === hairc ? hairc : (HAIR[c.gender][c.hair % 6] === 'bald' || hijab ? shade(skin, -.45) : shade(hairc, -.1));
    const brow = ex === 'sad' ? `<path d="M72 ${83 + by}Q82 ${80} 92 ${76}M108 76Q118 80 128 ${83 + by}" fill="none" stroke="${bcol}" stroke-width="${bw}" stroke-linecap="round"/>` : `<path d="M72 ${81 + by}Q82 ${75 + by} 92 ${80 + by}M108 ${80 + by}Q118 ${75 + by} 128 ${81 + by}" fill="none" stroke="${bcol}" stroke-width="${bw}" stroke-linecap="round"/>`;
    let mouth;
    if (m > .06) { const w = 8 + m * 5 + (ex === 'smile' || ex === 'grin' ? 3 : 0), h = 2 + m * 9; mouth = `<ellipse cx="100" cy="122" rx="${w}" ry="${h}" fill="#6e2626"/><ellipse cx="100" cy="${122 + h * .5}" rx="${w * .55}" ry="${h * .4}" fill="#d9777a"/>`; }
    else if (st.smile != null && st.smile > .55) mouth = `<path d="M86 116Q100 ${132} 114 116Z" fill="#6e2626"/><path d="M88 117Q100 123 112 117L112 119Q100 126 88 119Z" fill="#FFFAFA"/>`;
    else if (ex === 'grin') mouth = `<path d="M86 116Q100 134 114 116Z" fill="#6e2626"/><path d="M88 117Q100 123 112 117L112 119Q100 126 88 119Z" fill="#FFFAFA"/>`;
    else if (ex === 'neutral') mouth = `<path d="M91 122H109" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
    else if (ex === 'wow') mouth = `<ellipse cx="100" cy="124" rx="6" ry="8" fill="#6e2626"/>`;
    else if (ex === 'sad') mouth = `<path d="M90 126Q100 116 110 126" fill="none" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
    else mouth = `<path d="M88 118Q100 ${st.smile != null && st.smile > .2 ? 130 : 128} 112 118" fill="none" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
    const cheeks = girl ? '<circle cx="73" cy="111" r="6.5" fill="#F4A6A6" opacity=".38"/><circle cx="127" cy="111" r="6.5" fill="#F4A6A6" opacity=".38"/>' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/>${hw.back || ''}${hp.back}${bodyMarkup(c, skin, cc)}<circle cx="59" cy="94" r="7.500" fill="${skin}"/><circle cx="141" cy="94" r="7.500" fill="${skin}"/><path d="${head}" fill="${skin}"/>${cheeks}${eyeL}${eyeR}${lash}${brow}<path d="M99 100Q95 109 100 110Q104 110 102 106" fill="none" stroke="${shade(skin, -.3)}" stroke-width="2" stroke-linecap="round"/>${mouth}${hp.front}${glassesMarkup(c)}${hw.top || ''}</svg>`;
  }
  N.avatarMarkup = render;
  N.avatarURI = (cfg, st) => 'data:image/svg+xml;utf8,' + encodeURIComponent(render(cfg, st));

  /* ---------------------------------------------------------------- animation helpers */
  N.liveAvatar = function (box, cfg) {
    let st = { mouth: 0, blink: 0, smile: null, expr: null }, alive = true, dirty = true, bt = 0;
    const draw = () => { if (alive && dirty) { dirty = false; box.innerHTML = render(cfg, st); const s = box.firstElementChild; if (s) { s.style.width = '100%'; s.style.height = '100%'; s.style.display = 'block'; } } };
    const blinkLoop = () => { if (!alive) return; st.blink = 1; dirty = true; setTimeout(() => { st.blink = 0; dirty = true; }, 140); bt = setTimeout(blinkLoop, 2200 + Math.random() * 3200); };
    bt = setTimeout(blinkLoop, 1500); const iv = setInterval(draw, 70); draw();
    return { set(p) { let ch = false; for (const k in p) if (st[k] !== p[k]) { st[k] = p[k]; ch = true; } if (ch) dirty = true; }, destroy() { alive = false; clearInterval(iv); clearTimeout(bt); } };
  };
  /* a MediaStream carrying the animated avatar — can replace the camera in a video call */
  N.avatarStream = function (cfg, size = 360) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
    let st = { mouth: 0, blink: 0, smile: null, expr: null }, alive = true, busy = false, bt = 0, last = '';
    const frame = () => {
      if (!alive) return; const key = JSON.stringify(st);
      if (!busy && key !== last) { busy = true; last = key; const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, size, size); busy = false; }; im.onerror = () => { busy = false; }; im.src = N.avatarURI(cfg, st); }
    };
    const iv = setInterval(frame, 66); frame();
    const blinkLoop = () => { if (!alive) return; st.blink = 1; setTimeout(() => { st.blink = 0; }, 140); bt = setTimeout(blinkLoop, 2200 + Math.random() * 3000); }; bt = setTimeout(blinkLoop, 1500);
    const stream = cv.captureStream ? cv.captureStream(15) : null;
    return { stream, canvas: cv, set(p) { Object.assign(st, p); }, destroy() { alive = false; clearInterval(iv); clearTimeout(bt); if (stream) stream.getTracks().forEach(t => t.stop()); } };
  };
  /* Camera → expression (smile / mouth open / blink). Uses a face-landmark model loaded on demand; if it can't load
     (offline, blocked, old browser) it quietly does nothing and the avatar simply follows your voice. */
  N.faceTracker = function (video, onState) {
    let alive = true, lm = null, raf = 0, lastT = 0;
    (async () => {
      try {
        const V = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
        const mod = await import(V + '/vision_bundle.mjs'), fs = await mod.FilesetResolver.forVisionTasks(V + '/wasm');
        lm = await mod.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 });
      } catch (e) { console.info('Face tracking unavailable, using voice only'); return; }
      const loop = () => {
        if (!alive) return; raf = requestAnimationFrame(loop);
        if (!video.videoWidth || video.currentTime === lastT) return; lastT = video.currentTime;
        try {
          const r = lm.detectForVideo(video, performance.now()), bs = r.faceBlendshapes && r.faceBlendshapes[0]; if (!bs) return;
          const g = n => (bs.categories.find(c => c.categoryName === n) || {}).score || 0;
          onState({ smile: (g('mouthSmileLeft') + g('mouthSmileRight')) / 2 * 1.8, mouthFace: g('jawOpen'), blink: (g('eyeBlinkLeft') + g('eyeBlinkRight')) / 2 > .5 ? 1 : 0, wow: g('browInnerUp') > .6 && g('jawOpen') > .3 });
        } catch (e) { }
      };
      loop();
    })();
    return { stop() { alive = false; cancelAnimationFrame(raf); try { lm && lm.close(); } catch (e) { } } };
  };

  /* ---------------------------------------------------------------- builder UI */
  N.avatarBuilder = function (opts = {}) {
    return new Promise(res => {
      let cfg = norm(opts.cfg || N.avatarDefault(opts.seed)), tab = 'look', done = false, live = null;
      const fin = v => { if (!done) { done = true; if (live) live.destroy(); res(v); } };
      const TABS = [['look', 'Gender & skin'], ['hair', 'Hair'], ['clothes', 'Clothes'], ['head', 'Headwear'], ['glass', 'Glasses'], ['face', 'Expression'], ['bg', 'Background']];
      const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-2"><h3 class="text-lg font-bold">Create your avatar</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
        <div class="flex gap-4 flex-col sm:flex-row">
          <div class="sm:w-44 shrink-0 flex sm:flex-col items-center gap-3"><div id="avPrev" class="w-36 h-36 sm:w-44 sm:h-44 rounded-[2rem] overflow-hidden border-4 border-gold shadow-lg shrink-0"></div>
            <div class="flex flex-col gap-2 w-full"><button class="btn btn-ghost !py-2 w-full text-sm" data-rand>🎲 <span>Surprise me</span></button></div></div>
          <div class="flex-1 min-w-0"><div id="avTabs" class="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">${TABS.map(([k, l]) => `<button class="av-tab" data-t="${k}">${l}</button>`).join('')}</div><div id="avBody" class="mt-2 max-h-[36dvh] overflow-y-auto pr-1"></div></div></div>
        <div class="flex gap-2 mt-4"><button class="btn btn-ghost flex-1" data-x>Cancel</button><button class="btn btn-gold flex-1" data-save>${ic('check', 'w-4 h-4')} Use this avatar</button></div></div>`, { onClose: () => fin(null), wide: true });
      const prev = $('#avPrev', md.box); live = N.liveAvatar(prev, cfg);
      const thumb = (c, extra = '') => `<span class="av-th ${extra}">${render(c, {})}</span>`;
      const swatch = (hex, on, attr) => `<button class="av-sw ${on ? 'on' : ''}" ${attr} style="background:${hex}" aria-label="${hex}"></button>`;
      const opt = (label, c, on, attr) => `<button class="av-opt ${on ? 'on' : ''}" ${attr}>${thumb(c)}<span>${esc(label)}</span></button>`;
      const draw = () => {
        $$('#avTabs .av-tab', md.box).forEach(b => b.classList.toggle('on', b.dataset.t === tab));
        const b = $('#avBody', md.box), set = o => Object.assign({}, cfg, o); let h = '';
        if (tab === 'look') h = `<div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">I am a…</div><div class="grid grid-cols-2 gap-2 mb-4">${['girl', 'boy'].map(g => opt(g === 'girl' ? 'Girl' : 'Boy', set({ gender: g, hair: g === cfg.gender ? cfg.hair : 0 }), cfg.gender === g, `data-g="${g}"`)).join('')}</div><div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Skin colour</div><div class="flex flex-wrap gap-2">${SKIN.map((s, i) => swatch(s, cfg.skin === i, `data-k="skin" data-v="${i}"`)).join('')}</div>`;
        if (tab === 'hair') h = `<div class="grid grid-cols-3 gap-2 mb-4">${HAIR[cfg.gender].map((s, i) => opt(LBL[s], set({ hair: i, head: HEAD[cfg.head % 8] === 'hijab' ? 0 : cfg.head }), cfg.hair === i && HEAD[cfg.head % 8] !== 'hijab', `data-k="hair" data-v="${i}"`)).join('')}</div><div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Hair colour</div><div class="flex flex-wrap gap-2">${HAIRC.map((s, i) => swatch(s, cfg.hairC === i, `data-k="hairC" data-v="${i}"`)).join('')}</div>`;
        if (tab === 'clothes') h = `<div class="grid grid-cols-3 gap-2 mb-4">${CLOTHES.map((s, i) => opt(LBL[s], set({ clothes: i }), cfg.clothes === i, `data-k="clothes" data-v="${i}"`)).join('')}</div><div class="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">Colour</div><div class="flex flex-wrap gap-2">${CLOTHC.map((s, i) => swatch(s, cfg.clothC === i, `data-k="clothC" data-v="${i}"`)).join('')}</div>`;
        if (tab === 'head') h = `<div class="grid grid-cols-3 gap-2 mb-4">${HEAD.map((s, i) => (s === 'hijab' && cfg.gender === 'boy') ? '' : opt(LBL[s], set({ head: i }), cfg.head === i, `data-k="head" data-v="${i}"`)).join('')}</div><div class="text-xs text-[var(--muted)]">Headwear takes the colour you picked for your clothes.</div>`;
        if (tab === 'glass') h = `<div class="grid grid-cols-3 gap-2">${GLASSES.map((s, i) => opt(LBL[s], set({ glasses: i }), cfg.glasses === i, `data-k="glasses" data-v="${i}"`)).join('')}</div>`;
        if (tab === 'face') h = `<div class="grid grid-cols-3 gap-2">${EXPR.map((s, i) => opt(LBL[s], set({ expr: i }), cfg.expr === i, `data-k="expr" data-v="${i}"`)).join('')}</div>`;
        if (tab === 'bg') h = `<div class="flex flex-wrap gap-3">${BGS.map((s, i) => swatch(s, cfg.bg === i, `data-k="bg" data-v="${i}"`)).join('')}</div>`;
        b.innerHTML = h;
      };
      const refresh = () => { live.destroy(); live = N.liveAvatar(prev, cfg); draw(); };
      md.box.addEventListener('click', e => {
        const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; return draw(); }
        const g = e.target.closest('[data-g]'); if (g) { cfg = Object.assign({}, cfg, { gender: g.dataset.g, hair: 0 }); if (cfg.gender === 'boy' && HEAD[cfg.head % 8] === 'hijab') cfg.head = 0; return refresh(); }
        const o = e.target.closest('[data-k]'); if (o) { cfg = Object.assign({}, cfg, { [o.dataset.k]: +o.dataset.v }); return refresh(); }
        if (e.target.closest('[data-rand]')) { const r = N.avatarDefault(Math.random()); cfg = Object.assign(r, { head: Math.random() < .35 ? 1 + Math.floor(Math.random() * 7) : 0, glasses: Math.random() < .3 ? 1 + Math.floor(Math.random() * 4) : 0, expr: Math.floor(Math.random() * 6) }); if (cfg.head === 6 && cfg.gender === 'boy') cfg.head = 3; return refresh(); }
        if (e.target.closest('[data-save]')) { const out = { cfg, photo: N.avatarURI(cfg, {}) }; done = true; live.destroy(); md.m.remove(); res(out); }
        else if (e.target.closest('[data-x]')) md.close();
      });
      draw();
    });
  };
})();
