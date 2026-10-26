/* QUEENBEE — settings.js : per-user preferences store (N.cfg) + Do-Not-Disturb helpers.
   Stored in localStorage on this device (key qb_cfg_<uid>); language also remembered before login. */
(function () {
  'use strict';
  const N = window.Nova, { S } = N;
  const DEF = {
    lang: 'en',
    /* sounds */ sound: true, volume: 0.7, sendSound: true, msgTone: 'pop', ringtone: 'honey', vipTone: 'bell', vipRingtone: 'fanfare',
    /* do not disturb */ dnd: false, dndSched: false, dndFrom: '22:00', dndTo: '07:00', dndEmergency: true,
    /* privacy */ ghost: false, hideTyping: false,
    /* calls */ recordCalls: true, noiseCancel: true, micCheck: true, avatarCall: false,
    /* AI */ autoTranscribe: true, aiProvider: 'local', aiKey: '', aiModel: '', aiHistory: true,
    /* feature switches (everything on by default) */ fAI: true, fSummary: true, fMini: true, fThreads: true, fDisappear: true, fMood: true, fStories: true, fFav: true,
    /* look */ font: 'inter', fontSize: 'md',
    /* chat */ enterSend: true,
    /* data */ favs: [], chatPrefs: {}
  };
  const key = u => 'qb_cfg_' + (u || 'guest');
  let uid = null, data = clone(DEF); const subs = new Set();
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function read(u) { try { return JSON.parse(localStorage.getItem(key(u))) || {}; } catch (e) { return {}; } }
  function write() { try { localStorage.setItem(key(uid), JSON.stringify(data)); if (uid) localStorage.setItem(key(null), JSON.stringify({ lang: data.lang })); } catch (e) { } }
  const emit = k => subs.forEach(f => { try { f(k); } catch (e) { console.error(e); } });

  const cfg = N.cfg = {
    DEF,
    use(u) {                       // call on login / logout
      uid = u || null;
      const guest = read(null), mine = u ? read(u) : {};
      data = Object.assign(clone(DEF), u ? { lang: guest.lang || DEF.lang } : {}, u ? mine : guest);
      emit('*');
    },
    get(k) { return data[k]; },
    set(k, v) { data[k] = v; write(); emit(k); },
    patch(o) { Object.assign(data, o); write(); emit('*'); },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    chat(id) { return Object.assign({ mute: false, tone: '', ring: '' }, (data.chatPrefs || {})[id] || {}); },
    setChat(id, p) { const all = Object.assign({}, data.chatPrefs); all[id] = Object.assign(cfg.chat(id), p); data.chatPrefs = all; write(); emit('chat'); },
    isFav: u => (data.favs || []).includes(u),
    toggleFav(u) { const s = new Set(data.favs || []); s.has(u) ? s.delete(u) : s.add(u); data.favs = [...s]; write(); emit('favs'); return s.has(u); }
  };
  cfg.use(null);


  /* ---- fonts + text size (Settings → Appearance) ---- */
  const BASE = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  const FONTS = [
    { id: 'inter', name: 'Inter', g: 'Inter:wght@400;500;600;700;800', stack: 'Inter' },
    { id: 'system', name: 'System', g: '', stack: 'system-ui,-apple-system,"Segoe UI",Roboto' },
    { id: 'poppins', name: 'Poppins', g: 'Poppins:wght@400;500;600;700;800', stack: 'Poppins' },
    { id: 'nunito', name: 'Nunito', g: 'Nunito:wght@400;500;600;700;800', stack: 'Nunito' },
    { id: 'quicksand', name: 'Quicksand', g: 'Quicksand:wght@400;500;600;700', stack: 'Quicksand' },
    { id: 'montserrat', name: 'Montserrat', g: 'Montserrat:wght@400;500;600;700;800', stack: 'Montserrat' },
    { id: 'lato', name: 'Lato', g: 'Lato:wght@400;700;900', stack: 'Lato' },
    { id: 'playfair', name: 'Playfair Display', g: 'Playfair+Display:wght@400;500;600;700;800', stack: '"Playfair Display",Georgia,serif' },
    { id: 'lora', name: 'Lora', g: 'Lora:wght@400;500;600;700', stack: 'Lora,Georgia,serif' },
    { id: 'merriweather', name: 'Merriweather', g: 'Merriweather:wght@400;700;900', stack: 'Merriweather,Georgia,serif' },
    { id: 'mono', name: 'Roboto Mono', g: 'Roboto+Mono:wght@400;500;600;700', stack: '"Roboto Mono",ui-monospace,monospace' },
    { id: 'hand', name: 'Patrick Hand', g: 'Patrick+Hand', stack: '"Patrick Hand","Comic Sans MS",cursive' },
    { id: 'pacifico', name: 'Pacifico', g: 'Pacifico', stack: 'Pacifico,cursive' },
    { id: 'naskh', name: 'Naskh · نسخ', g: 'Noto+Naskh+Arabic:wght@400;500;600;700', stack: '"Noto Naskh Arabic"', rtl: true },
    { id: 'nastaliq', name: 'Nastaliq · نستعلیق', g: 'Noto+Nastaliq+Urdu:wght@400;500;600;700', stack: '"Noto Nastaliq Urdu"', rtl: true },
    { id: 'amiri', name: 'Amiri · أميري', g: 'Amiri:wght@400;700', stack: 'Amiri,serif', rtl: true }
  ];
  const SIZES = { sm: 14.5, md: 16, lg: 18, xl: 20 };
  N.FONTS = FONTS; N.FONT_SIZES = SIZES;
  const loaded = new Set();
  const loadG = list => {
    const fam = list.filter(f => f.g && !loaded.has(f.id)); if (!fam.length) return; fam.forEach(f => loaded.add(f.id));
    try { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + fam.map(f => 'family=' + f.g).join('&') + '&display=swap'; document.head.appendChild(l); } catch (e) { }
  };
  N.loadAllFonts = () => loadG(FONTS);
  N.applyFont = () => {
    const f = FONTS.find(x => x.id === cfg.get('font')) || FONTS[0], r = document.documentElement.style;
    loadG([f, FONTS.find(x => x.id === 'naskh')]);
    r.setProperty('--qb-font', f.stack + ',' + BASE);
    r.setProperty('--qb-font-rtl', (f.rtl ? f.stack : '"Noto Naskh Arabic",' + f.stack) + ',"Noto Nastaliq Urdu","Segoe UI",Tahoma,' + BASE);
    r.fontSize = (SIZES[cfg.get('fontSize')] || 16) + 'px';
  };
  cfg.on(k => { if (k === 'font' || k === 'fontSize' || k === '*') N.applyFont(); });
  N.applyFont();

  /* ---- Do Not Disturb ---- */
  const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  N.inDndWindow = () => {
    if (!cfg.get('dndSched')) return false;
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes(), a = mins(cfg.get('dndFrom')), b = mins(cfg.get('dndTo'));
    return a === b ? false : a < b ? (cur >= a && cur < b) : (cur >= a || cur < b);
  };
  N.dndActive = () => !!cfg.get('dnd') || N.inDndWindow();
  /* should a new message in this chat make a sound / pop a toast? */
  N.shouldNotify = chatId => !(cfg.chat(chatId).mute || N.dndActive());
  /* may a call from this person ring right now? (Emergency Override = favourites still get through) */
  N.callAllowed = from => !N.dndActive() || (cfg.get('dndEmergency') && cfg.isFav(from));
  N.speechLang = () => ({ en: 'en-US', ur: 'ur-PK', ar: 'ar-SA', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR' }[cfg.get('lang')] || 'en-US');
  N.feature = k => cfg.get(k) !== false;
})();
