/* QueenB.Chat — expressive.js : animated stickers + searchable GIFs for the message picker.
   Stickers and the built-in reaction GIFs are made on the device. To also search a huge online GIF library,
   set window.GIF_API = { provider: 'tenor' | 'giphy', key: '…' } in firebase-config.js. */
(function () {
  'use strict';
  const N = window.Nova;
  const ST = [ // [emoji, animation, caption, keywords]
    ['😂', 'shake', 'LOL', 'lol laugh funny haha joke'], ['🤣', 'roll', 'ROFL', 'rofl laugh funny haha'], ['😍', 'pulse', 'Love it', 'love heart eyes like'], ['🥰', 'float', 'Aww', 'aww cute love sweet'],
    ['😎', 'bounce', 'Cool', 'cool nice sunglasses'], ['🤩', 'spin', 'Wow', 'wow amazing star'], ['😮', 'pop', 'Whoa', 'wow surprise shock omg'], ['😢', 'drip', 'Sad', 'sad cry tears'],
    ['😭', 'shake', 'Crying', 'cry sob sad'], ['😡', 'shake', 'Angry', 'angry mad'], ['🥳', 'bounce', 'Party', 'party celebrate birthday congrats'], ['🎉', 'pop', 'Congrats', 'congrats celebrate party'],
    ['👍', 'bounce', 'Yes', 'yes ok good thumbs agree'], ['👎', 'wiggle', 'No', 'no bad dislike'], ['🙏', 'float', 'Thanks', 'thanks thank please pray shukriya'], ['👋', 'wave', 'Hello', 'hello hi hey bye wave salam'],
    ['❤️', 'pulse', 'Love', 'love heart'], ['💔', 'wiggle', 'Heartbroken', 'broken heart sad'], ['🔥', 'pulse', 'Fire', 'fire hot lit'], ['💯', 'pop', '100', 'hundred perfect great'],
    ['😴', 'float', 'Sleepy', 'sleep tired night'], ['🤔', 'wiggle', 'Hmm', 'think hmm maybe'], ['🙄', 'roll', 'Really?', 'eyeroll really annoyed'], ['😅', 'drip', 'Oops', 'oops sweat nervous sorry'],
    ['🤗', 'pop', 'Hug', 'hug care'], ['😘', 'float', 'Kiss', 'kiss love'], ['🤝', 'bounce', 'Deal', 'deal agree handshake'], ['👏', 'shake', 'Bravo', 'clap bravo well done'],
    ['💪', 'pulse', 'Strong', 'strong gym power'], ['🍯', 'float', 'Honey', 'honey sweet bee'], ['🐝', 'fly', 'Buzz', 'bee buzz queen'], ['👑', 'bounce', 'Queen', 'queen crown boss'],
    ['📚', 'wiggle', 'Study', 'study book school exam'], ['✅', 'pop', 'Done', 'done complete finished'], ['⏰', 'shake', 'Hurry', 'late time hurry'], ['☕', 'float', 'Chai', 'tea coffee chai break'],
    ['🍕', 'spin', 'Pizza', 'pizza food hungry'], ['🌙', 'float', 'Good night', 'night sleep'], ['☀️', 'spin', 'Good morning', 'morning sun'], ['🎂', 'bounce', 'Birthday', 'birthday cake']
  ];
  /* sticker HTML (used in the picker and in chat bubbles) */
  N.stickerHTML = (e, a, cap, cls = '') => `<div class="stk ${cls}"><span class="stk-e stk-${a}">${e}</span>${cap ? `<span class="stk-c">${cap.replace(/</g, '&lt;')}</span>` : ''}</div>`;
  N.STICKERS = ST.map(([e, a, c, k]) => ({ e, a, c, k }));

  /* built-in animated reaction GIFs (animated SVG pictures — searchable by word) */
  const PAL = [['#FFFAA0', '#353935'], ['#C19552', '#FFFAFA'], ['#353935', '#FFFAA0'], ['#FFFAFA', '#C19552']];
  const ANIM = { shake: 'rotate;-14 0;14 0;-14 0;0 0', bounce: 'translate;0 0;0 -18;0 0;0 0', pulse: 'scale;1;1.25;1;1', spin: 'rotate;0 0;360 0;360 0;360 0', wiggle: 'rotate;-8 0;8 0;-8 0;-8 0', float: 'translate;0 4;0 -10;0 4;0 4', pop: 'scale;.8;1.3;.9;.8', roll: 'rotate;-20 0;20 0;-20 0;-20 0' };
  function svgGif(i, e, a, cap) {
    const [bg, fg] = PAL[i % 4], an = (ANIM[a] || ANIM.bounce).split(';'), type = an[0], vals = an.slice(1);
    const v = type === 'scale' ? vals.join(';') : vals.map(x => type === 'rotate' ? x + ' 90 80' : x).join(';');
    const tr = type === 'scale' ? `<animateTransform attributeName="transform" type="scale" values="${v}" dur="1.2s" repeatCount="indefinite" additive="sum"/>` : `<animateTransform attributeName="transform" type="${type}" values="${v}" dur="1.2s" repeatCount="indefinite"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 160" width="180" height="160"><rect width="180" height="160" rx="18" fill="${bg}"/><g ${type === 'scale' ? 'transform="translate(90 80)"' : ''}><g>${tr}<text x="${type === 'scale' ? 0 : 90}" y="${type === 'scale' ? 18 : 98}" font-size="64" text-anchor="middle">${e}</text></g></g><text x="90" y="146" font-size="15" font-weight="800" font-family="Arial,sans-serif" text-anchor="middle" fill="${fg}">${cap.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  const LOCAL = ST.map(([e, a, c, k], i) => ({ url: svgGif(i, e, a, c), w: 180, h: 160, title: c, k: (c + ' ' + k).toLowerCase() }));
  const cache = {};
  N.gifSearch = async function (q) {
    q = (q || '').trim().toLowerCase(); const api = window.GIF_API;
    if (api && api.key) {
      const key = api.provider + '|' + q; if (cache[key]) return cache[key];
      try {
        let url, map;
        if (api.provider === 'giphy') { url = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(api.key)}&limit=24&rating=g&q=${encodeURIComponent(q)}`; map = j => (j.data || []).map(g => ({ url: g.images.fixed_height.url, w: +g.images.fixed_height.width, h: +g.images.fixed_height.height, title: g.title })); }
        else { url = `https://tenor.googleapis.com/v2/${q ? 'search' : 'featured'}?key=${encodeURIComponent(api.key)}&limit=24&contentfilter=high&media_filter=tinygif&q=${encodeURIComponent(q)}`; map = j => (j.results || []).map(g => { const t = g.media_formats.tinygif; return { url: t.url, w: t.dims[0], h: t.dims[1], title: g.content_description }; }); }
        const r = await fetch(url); if (!r.ok) throw new Error('gif ' + r.status); const out = map(await r.json()); if (out.length) return (cache[key] = out);
      } catch (e) { console.warn('GIF search unavailable, using built-in set', e); }
    }
    return q ? LOCAL.filter(g => g.k.includes(q) || q.split(/\s+/).some(w => w.length > 2 && g.k.includes(w))) : LOCAL;
  };
})();
