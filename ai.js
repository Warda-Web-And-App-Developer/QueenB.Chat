/* QUEENBEE — ai.js : QueenB.Chat AI assistant chat, smart summaries / catch-up.
   The assistant answers with a built-in offline engine (calculations, date & time, tips, chat summaries).
   For open-ended answers, connect your own AI service in Settings → AI assistant (or set AI_ENDPOINT in firebase-config.js). */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, $$, esc, el, ic, toast, modal } = N, cfg = N.cfg;
  const BOT = 'qb_ai';
  N.AI_USER = { uid: BOT, username: 'QueenB.Chat AI', usernameLower: 'queenbee ai', bot: true, profileDone: true, lastSeen: Date.now(), photo: 'data:image/svg+xml;utf8,' + encodeURIComponent(N.logoMark('w-10 h-10').replace('class="w-10 h-10"', 'width="96" height="96"')) };
  const aiChat = () => S.chats.find(c => c.type === 'dm' && c.members.includes(BOT));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nameOf = uid => (S.users[uid] || {}).username || 'Someone';

  /* ---------------- chat with the assistant ---------------- */
  let ensuring = false;
  N.ensureAI = async function () {
    if (!S.me || ensuring || !N.feature('fAI') || aiChat()) return; ensuring = true;
    try {
      const id = await B.ensureDM(S.me.uid, BOT);
      await B.sendMessage(id, { from: BOT, type: 'text', text: `Hi ${S.me.nickname || S.me.username || 'there'}! 👋 I’m QueenB.Chat AI.\n\nI can explain how QueenB.Chat works, chat about your day, tell you a story, and help with studies — maths, study plans, essay outlines, quizzes and exam tips. I can also sum up your busy chats.\n\nTry: “how do calls work?”, “tell me a story”, “quiz me”, “solve 2x + 3 = 11” or “study plan for 5 days”. What would you like to do?` });
    } catch (e) { console.warn('ai setup', e); } finally { ensuring = false; }
  };
  N.afterSend = async function (chatId, text) {
    const c = S.chats.find(x => x.id === chatId); if (!c || !c.members.includes(BOT) || !N.feature('fAI')) return;
    try {
      await sleep(350); B.setActivity(chatId, BOT, 'typing').catch(() => { });
      const keep = setInterval(() => B.setActivity(chatId, BOT, 'typing').catch(() => { }), 2500);
      let reply; const t0 = Date.now();
      try { reply = await answer(text, c); } catch (e) { reply = 'Sorry, I couldn’t reach my AI service just now. I’ll keep using my built-in skills — try again in a moment.'; }
      const wait = Math.max(0, Math.min(2600, 700 + reply.length * 9) - (Date.now() - t0)); await sleep(wait);
      clearInterval(keep); await B.setActivity(chatId, BOT, null).catch(() => { });
      await B.sendMessage(chatId, { from: BOT, type: 'text', text: reply });
    } catch (e) { console.warn(e); }
  };

  /* ---------------- answer engine ---------------- */
  async function answer(q, chat) {
    if (cfg.get('aiProvider') === 'custom' && (cfg.get('aiUrl') || window.AI_ENDPOINT)) return remote(chat);
    return local(q);
  }
  async function remote(chat) {
    const url = cfg.get('aiUrl') || window.AI_ENDPOINT, key = cfg.get('aiKey') || window.AI_KEY || '', model = cfg.get('aiModel') || window.AI_MODEL || 'gpt-4o-mini';
    const hist = S.msgs.filter(m => m.type === 'text' && !m.deleted).slice(-12).map(m => ({ role: m.from === BOT ? 'assistant' : 'user', content: m.text }));
    const r = await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}), body: JSON.stringify({ model, messages: [{ role: 'system', content: 'You are QueenB.Chat AI, a friendly assistant inside the QueenB.Chat messaging app. Explain app features when asked, chat casually, tell short stories, and help students of every level (school, college, university) with clear step-by-step explanations, study plans, essays, maths, science and exam tips. Be accurate, encouraging and concise. Reply in the language the user writes in (including Urdu and Roman Urdu).' }, ...hist] }) });
    if (!r.ok) throw new Error('AI service ' + r.status);
    const j = await r.json(); return (j.choices && j.choices[0] && (j.choices[0].message || {}).content || j.reply || j.text || '').trim() || 'I didn’t get an answer back — try rephrasing.';
  }
  const JOKES = ['Why don’t bees ever get married? Because they’re always on their honeymoon. 🍯', 'What do you call a bee that can’t make up its mind? A maybe-bee. 🐝', 'Why did the bee get married? Because he found his honey. 💛', 'What’s a bee’s favourite hairstyle? A buzz cut.'];
  const TIPS = [
    [/group/, 'Tap the people icon at the top of your list, choose members, name it and you’re done. Open Group info to copy the invite link — anyone with it can join.'],
    [/call|video|voice call/, 'Open a chat and tap the phone or camera at the top. Calls are two-way, can be recorded (Settings → Calls) and have noise cancellation. Test your mic from the Calls tab first if you like.'],
    [/avatar/, 'Settings → Avatar opens the builder: skin, hair, clothes, headwear, glasses, expression, girl or boy. On video calls, switch on “Use my avatar” and it will smile and speak with you.'],
    [/favou?rite|vip/, 'Open a contact (or the ⋮ menu) and choose “Add to favorites”. Favorites get their own tone and ringtone, and their calls ring through Do Not Disturb when Emergency override is on.'],
    [/disappear|vanish/, 'In a chat, open ⋮ → Disappearing messages and pick 10 seconds, 1 hour or 24 hours.'],
    [/ghost|read receipt|blue tick/, 'Settings → Privacy → Ghost mode lets you read without showing the green “seen” ticks.'],
    [/thread/, 'Open a message’s ⋮ menu and choose “Reply in thread” to start a side conversation without cluttering the chat.'],
    [/dnd|disturb|mute/, 'Settings → Do Not Disturb has a switch, a nightly schedule (for example 10pm–7am) and an Emergency override for favorites. You can also mute a single chat from its ⋮ menu.'],
    [/language|urdu|arabic|hindi|spanish|french|rtl/, 'Use the 🌐 button at the top of Settings (or on the sign-in page) to switch between English, اردو, العربية, हिन्दी, Español and Français. Urdu and Arabic switch the whole layout right-to-left.'],
    [/poll|note|code|expense|split/, 'Tap + in a chat: Poll, Collaborative note, Code snippet (with colours) and Split expenses are all there.'],
    [/record/, 'Settings → Calls → “Record my calls”. Recordings and transcripts appear in your Calls tab. Everyone on the call sees a REC badge.']
  ];

  /* ---------------- students, stories, casual talk, app guide ---------------- */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let quiz = null;
  const QB = [
    ['What is the powerhouse of the cell?', ['mitochondria', 'mitochondrion'], 'Mitochondria make most of the cell’s energy (ATP).'], ['What gas do plants take in for photosynthesis?', ['carbon dioxide', 'co2'], 'Plants use CO₂, water and light to make glucose and oxygen.'],
    ['What is the chemical symbol for water?', ['h2o'], 'Two hydrogen atoms and one oxygen atom: H₂O.'], ['How many degrees are there in a triangle’s angles combined?', ['180'], 'The interior angles of any triangle add up to 180°.'],
    ['What is 12 × 12?', ['144'], '12 × 12 = 144.'], ['What is the square root of 81?', ['9'], '9 × 9 = 81.'], ['Which planet is known as the Red Planet?', ['mars'], 'Mars looks red because of iron oxide (rust) on its surface.'],
    ['What is the past tense of “go”?', ['went'], 'Go → went → gone.'], ['What is the capital of Pakistan?', ['islamabad'], 'Islamabad is the capital; Karachi is the largest city.'], ['What force pulls objects toward the Earth?', ['gravity'], 'Gravity — about 9.8 m/s² near the surface.'],
    ['What is the plural of “child”?', ['children'], 'An irregular plural: child → children.'], ['How many sides does a hexagon have?', ['6', 'six'], 'Hexa- means six. Honeycomb cells are hexagons! 🐝'], ['What is the freezing point of water in °C?', ['0', 'zero'], 'Water freezes at 0 °C (32 °F).'],
    ['Who wrote “Romeo and Juliet”?', ['shakespeare', 'william shakespeare'], 'William Shakespeare, around 1595.'], ['What is 15% of 200?', ['30'], '200 × 0.15 = 30.'], ['What do we call a word that means the opposite of another?', ['antonym'], 'Antonym. (A synonym means the same.)']
  ];
  const STORIES = [
    n => `🐝 The Little Bee and the Big Storm\n\nOnce there was a small bee named ${n}, the youngest in her hive. Every day the older bees said, “You are too small to fly far.”\n\nOne afternoon dark clouds rolled in and the whole hive was out in the meadow. ${n} was the only one small enough to slip through a gap in the rocks and find the shortcut home. She buzzed ahead and led every bee safely back before the first drop fell.\n\nThat night the Queen smiled: “Being small is not being weak.” \n\n✨ Moral: don’t let anyone measure your courage by your size.`,
    n => `🌙 ${n} and the Lantern\n\nIn a village with no street lights lived a boy named ${n}. He had exams the next morning and the power went out. Instead of giving up, he took an old lantern, sat by the window and read his notes line by line until the oil ran low.\n\nHe woke up tired, but when the paper came, every answer felt familiar. When the results were announced, his teacher said, “Hard work in the dark shows in the light.”\n\n✨ Moral: small steady effort beats last-minute panic.`,
    n => `🦊 The Clever Fox and the Honey Jar\n\nA fox called ${n} found a jar of honey too tall to reach. A crow laughed, “You’ll never get it!” ${n} didn’t argue. She rolled a few stones under the jar, one by one, until she could climb up.\n\nWhile the crow kept laughing, the fox quietly enjoyed the sweetest lunch in the forest.\n\n✨ Moral: patience and a plan are worth more than loud talk.`
  ];
  function guide(low) {
    if (/how.*(work|use)|what is queen|about (this )?app|features?|what can (i|this)|tell me about/.test(low) && /queen|app|chat|feature|work/.test(low) && !/call|group|avatar|sticker|gif|emoji|status|stor|typing|online|unread|sign|login|filter/.test(low))
      return 'QueenB.Chat is a messaging app:\n• Chats & groups — text, voice notes (with transcripts), photos, videos, files, stickers and GIFs\n• Real voice & video calls with noise cancellation and optional recording\n• Favorites, Unread and Groups filters; VIP tones for favorites\n• Status stories (you can hide yours from chosen people)\n• Avatars you design yourself — they even smile and talk in video calls\n• Privacy: Do Not Disturb (with a nightly schedule), ghost mode, disappearing messages, chat lock\n• Mini-apps: polls, shared notes, code snippets, expense splitting\n• Six languages, including Urdu and Arabic right-to-left\n\nEverything can be switched on or off in Settings. Ask me about any one, e.g. “how do calls work?”';
    if (/sticker|gif|emoji/.test(low)) return 'Tap the smiley beside the message box. It has three tabs: Emoji, Stickers (animated) and GIFs with a search box. Tap a sticker or GIF to send it straight away. Tap the smiley again to close the picker.';
    if (/status|story|stories/.test(low) && /hide|private|privacy|who can|see/.test(low)) return 'Open Stories → Status privacy. Tick the people who must NOT see your status. The second tab lets you stop seeing someone else’s status.';
    if (/typing|dots/.test(low)) return 'When someone is typing you see three moving dots in the chat where their message will appear. They disappear as soon as the message arrives.';
    if (/online/.test(low)) return 'In a group, the header shows how many members are online right now — like “2 online”, “50 online” or “0 online”.';
    if (/unread|filter/.test(low)) return 'Above your chat list use the chips: All, Unread, Favorites and Groups. Unread shows only chats with new messages, with a number beside each.';
    if (/sign ?in|login|log in|otp|phone number|sms/.test(low)) return 'You can sign in with email + password, or choose Phone: enter your number, receive a 6-digit code by SMS and type it in. New here? Sign up and pick a picture (or build an avatar), a username and a nickname.';
    return null;
  }
  function solveEq(t) {
    const m = t.toLowerCase().replace(/\s+/g, '').replace(/×/g, '*').match(/(?:solve|find x|equation)?:?([0-9x+\-*/().^]+)=([0-9x+\-*/().^]+)/); if (!m || !/x/.test(m[0])) return null;
    const f = s => { s = s.replace(/(\d)x/g, '$1*x').replace(/\)x/g, ')*x').replace(/\^/g, ''); return x => Function('x', '"use strict";return (' + s + ')')(x); };
    try {
      const L = f(m[1]), R = f(m[2]), g = x => L(x) - R(x), c = g(0), b1 = g(1) - c, b2 = (g(2) - c - 2 * b1) / 2; // g(x) ≈ a x² + b x + c
      const a = b2, b = b1 - a; if (![a, b, c].every(isFinite)) return null; const r = v => String(Math.round(v * 1e6) / 1e6);
      if (Math.abs(a) < 1e-9) { if (Math.abs(b) < 1e-9) return Math.abs(c) < 1e-9 ? 'Every value of x works (it is always true).' : 'No solution — the two sides can never be equal.'; return `Step 1: move everything to one side → ${r(b)}x + ${r(c)} = 0\nStep 2: x = ${r(-c)} / ${r(b)}\n✅ x = ${r(-c / b)}`; }
      const d = b * b - 4 * a * c; const sg = v => (v < 0 ? '− ' : '+ ') + r(Math.abs(v)); let s = `Quadratic: ${r(a)}x² ${sg(b)}x ${sg(c)} = 0\nDiscriminant D = b² − 4ac = ${r(d)}\n`;
      if (d < 0) return s + 'D is negative, so there is no real solution.'; if (d === 0) return s + `✅ x = ${r(-b / (2 * a))} (one repeated root)`;
      return s + `x = (−b ± √D) / 2a\n✅ x = ${r((-b + Math.sqrt(d)) / (2 * a))} or x = ${r((-b - Math.sqrt(d)) / (2 * a))}`;
    } catch (e) { return null; }
  }
  function units(low) {
    const m = low.match(/(-?[\d.]+)\s*(km|kilometers?|miles?|mi|kg|kilograms?|lbs?|pounds?|c|celsius|f|fahrenheit|cm|inch(?:es)?|in|m|meters?|feet|ft)\s*(?:to|in|into)\s*(km|miles?|mi|kg|lbs?|pounds?|c|celsius|f|fahrenheit|cm|inch(?:es)?|in|m|meters?|feet|ft|kilograms?|kilometers?)\b/); if (!m) return null;
    const v = parseFloat(m[1]), a = m[2].replace(/s$/, ''), b = m[3].replace(/s$/, ''), k = x => /^(km|kilometer)/.test(x) ? 'km' : /^(mi)/.test(x) ? 'mi' : /^(kg|kilogram)/.test(x) ? 'kg' : /^(lb|pound)/.test(x) ? 'lb' : /^(c|celsius)$/.test(x) ? 'c' : /^(f|fahrenheit)$/.test(x) ? 'f' : /^(cm)$/.test(x) ? 'cm' : /^(inch|in)/.test(x) ? 'in' : /^(m|meter)/.test(x) ? 'm' : /^(feet|ft|foot)/.test(x) ? 'ft' : x;
    const F = { 'km>mi': x => x * .621371, 'mi>km': x => x * 1.609344, 'kg>lb': x => x * 2.204623, 'lb>kg': x => x / 2.204623, 'c>f': x => x * 9 / 5 + 32, 'f>c': x => (x - 32) * 5 / 9, 'cm>in': x => x / 2.54, 'in>cm': x => x * 2.54, 'm>ft': x => x * 3.28084, 'ft>m': x => x / 3.28084 }[k(a) + '>' + k(b)];
    return F ? `${v} ${m[2]} ≈ ${Math.round(F(v) * 1000) / 1000} ${m[3]}` : null;
  }
  function plan(low) {
    const d = Math.max(1, Math.min(14, +((low.match(/(\d+)\s*(day|days|din)/) || [])[1] || 5))), subj = ((low.match(/(?:for|of)\s+([a-z ]{3,30}?)(?:\s+(?:in|for)\s+\d|$)/) || [])[1] || '').trim();
    const L = []; for (let i = 1; i <= d; i++) L.push(`Day ${i}: ${i === d ? 'full revision + past paper under exam timing, then rest early' : i === d - 1 ? 'mock test, fix weak areas, make a one-page summary sheet' : i % 3 === 0 ? 'review the last two days + practise questions' : 'learn a new topic (45 min), practise questions (30 min), short recap (10 min)'}`);
    return `📚 ${d}-day study plan${subj ? ' for ' + subj : ''}:\n\n${L.join('\n')}\n\nTips: study in 25-minute blocks with 5-minute breaks (Pomodoro), test yourself instead of re-reading, sleep 7–8 hours before the exam, and drink water.`;
  }
  function study(t, low) {
    if (quiz) { const q = quiz; quiz = null; if (/^(stop|quit|exit|skip|no)$/.test(low)) return 'Okay, quiz stopped. Say “quiz me” any time. 🐝'; const ok = q[1].some(a => low.replace(/[^a-z0-9 ]/g, '').trim() === a || low.includes(a)); return (ok ? '✅ Correct! ' : '❌ Not quite. ') + q[2] + '\n\nSay “quiz me” for another question.'; }
    if (/quiz|test me|mcq|question me/.test(low)) { quiz = pick(QB); return '🧠 Quick quiz:\n\n' + quiz[0] + '\n\n(Type your answer, or “stop”.)'; }
    if (/story|kahani|kahaani|tale/.test(low)) { const n = (low.match(/(?:about|named|called|of)\s+([a-z]{2,15})/) || [])[1]; const nm = n && !/story|bee|king|queen/.test(n) ? n[0].toUpperCase() + n.slice(1) : (S.me.nickname || S.me.username || 'Sara'); return pick(STORIES)(nm.replace(/_/g, ' ')); }
    const eq = /=/.test(t) && /x/.test(low) ? solveEq(t) : null; if (eq) return eq;
    const u = units(low); if (u) return u;
    let m; if ((m = low.match(/(?:square root|sqrt|√)\s*(?:of)?\s*(\d+(?:\.\d+)?)/))) return `√${m[1]} = ${Math.round(Math.sqrt(+m[1]) * 1e6) / 1e6}`;
    if ((m = low.match(/(\d+)\s*(?:!|factorial)/)) && +m[1] <= 20) { let f = 1; for (let i = 2; i <= +m[1]; i++) f *= i; return `${m[1]}! = ${f}`; }
    if ((m = low.match(/area of (?:a )?circle.*?(?:radius|r)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/))) return `Area = πr² = 3.14159 × ${m[1]}² = ${Math.round(Math.PI * m[1] * m[1] * 100) / 100}`;
    if (/study plan|timetable|schedule.*(exam|study)|revision plan/.test(low)) return plan(low);
    if (/essay|article|paragraph|speech/.test(low) && /outline|write|structure|how|plan|help/.test(low)) { const topic = (low.match(/(?:on|about)\s+(.{3,60})$/) || [])[1]; return `📝 Essay outline${topic ? ' — ' + topic : ''}:\n\n1. Introduction — a hook, background, and your thesis (one clear sentence).\n2. Body paragraph 1 — strongest point + evidence + explanation.\n3. Body paragraph 2 — second point + example.\n4. Body paragraph 3 — a counter-argument and your reply.\n5. Conclusion — restate the thesis in new words, summarise, finish with a thought.\n\nTell me your topic and your main points and I’ll help you shape each paragraph.`; }
    if (/study tip|how to study|focus|concentrat|exam tip|memori[sz]e|yaad|exam|prepare/.test(low)) return pick(['Active recall beats re-reading: close the book and write down everything you remember, then check. Do this after every topic.', 'Use spaced repetition: review new material after 1 day, 3 days, 7 days and 21 days. A few minutes each time is enough.', 'Try the Feynman method: explain the topic out loud as if teaching a younger student. Wherever you get stuck is what to revise.', 'Pomodoro: 25 minutes focused, 5 minutes break, and after four rounds a longer break. Put your phone in another room.', 'On exam day: read the whole paper first, answer the questions you know, then return to the hard ones. Check units, signs and spelling.']);
    if (/define|meaning of|what does .* mean|what is (a|an|the) /.test(low) && low.length < 80) return 'I’m best offline with chat, maths and study help. For dictionary-style definitions and detailed subject questions, connect an AI service in Settings → AI assistant — then I can answer anything. Meanwhile I can quiz you, make a study plan or outline an essay.';
    return null;
  }
  function chitchat(low) {
    if (/how are you|kaise ho|kaisay ho|kya haal|how r u|aap kaisay/.test(low)) return pick(['I’m buzzing with energy, thanks for asking! 🐝 How are you?', 'Doing great — ready to help! How’s your day going?', 'Alhamdulillah, all good! Tum batao, kya chal raha hai?']);
    if (/good morning|subah/.test(low)) return 'Good morning! ☀️ Wishing you a productive day. Anything you’d like to plan?';
    if (/good night|shab bakhair|night/.test(low) && !/tonight/.test(low)) return 'Good night! 🌙 Sleep well — a rested brain remembers more. See you tomorrow.';
    if (/bored|bore ho/.test(low)) return 'Let’s fix that! I can tell you a story, quiz you, or crack a joke. Which one?';
    if (/\b(sad|upset|lonely|stressed|tension|udas|pareshan|anxious)\b/.test(low)) return 'I’m sorry you’re feeling that way. 💛 Take a slow breath with me — in for 4, hold for 4, out for 6. If you can, talk to someone you trust too. Do you want to tell me what’s going on?';
    if (/i love you|love you/.test(low)) return 'That’s sweet! 💛 I’m just an assistant, but I’m always happy to chat with you.';
    if (/who (made|created|built)/.test(low)) return 'I’m the built-in assistant of QueenB.Chat, made by the QueenB.Chat team to help with the app, studies and friendly conversation.';
    if (/(what.?s up|sup|kya chal)/.test(low)) return 'Not much — just here in the hive! 🐝 What’s up with you?';
    if (/\b(bye|goodbye|khuda hafiz|allah hafiz|see you)\b/.test(low)) return 'Bye for now! 👋 Come back any time.';
    if (/\b(ok|okay|cool|nice|great|wow|haha|lol)\b/.test(low) && low.length < 14) return pick(['😊', 'Glad to hear it!', 'Anything else I can help with?']);
    return null;
  }
  function local(q) {
    const t = q.trim(), low = t.toLowerCase();
    if (/^(hi|hello|hey|salam|assalam|as-salam|hola|bonjour|namaste)\b/.test(low)) return `Hello ${S.me.nickname || S.me.username}! How can I help? I can calculate, tell the time, explain features or summarise your chats.`;
    if (/(thank|shukriya|شکریہ)/.test(low)) return 'You’re welcome! 🐝';
    if (/\b(time|waqt)\b|what.*time/.test(low) && !/timer/.test(low)) return 'It’s ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' right now.';
    if (/\b(date|today|day is it)\b/.test(low)) return 'Today is ' + new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.';
    { const s = study(t, low); if (s) return s; }
    if (/joke|funny|hasao|mazaq/.test(low)) return JOKES[Math.floor(Math.random() * JOKES.length)];
    { const g = guide(low); if (g) return g; }
    if (/summar|catch me up|catch up|what did i miss|kya hua/.test(low)) return summarizeAll();
    if (/who are you|your name|what are you/.test(low)) return 'I’m QueenB.Chat AI — your built-in assistant. I can calculate, explain features and summarise chats. Connect a bigger AI in Settings → AI assistant for open-ended questions.';
    const math = calc(t); if (math !== null) return t.replace(/\s*=\s*$/, '') + ' = ' + math;
    const tip = TIPS.find(([re]) => re.test(low)); if (tip) return tip[1];
    { const c = chitchat(low); if (c) return c; }
    if (/help|what can you|kya kar/.test(low)) return 'I can help with:\n• QueenB.Chat — “how do calls work?”, “how do stickers work?”\n• Study — “quiz me”, “study plan for 5 days”, “essay outline on pollution”, “solve x^2 - 5x + 6 = 0”, “10 km to miles”\n• Fun — “tell me a story”, “tell me a joke”\n• Chats — “summarize my chats”';
    return 'I’m not sure about that one offline. 🤔 I’m good at app help, maths, quizzes, study plans, stories and chat summaries — say “help” to see examples. For any question on any subject, connect your own AI service in Settings → AI assistant.';
  }
  function calc(s) {
    let e = s.toLowerCase().replace(/[=?]/g, '').replace(/\bx\b|×/g, '*').replace(/÷/g, '/').replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\btimes\b|\bmultiplied by\b/g, '*').replace(/\bdivided by\b|\bover\b/g, '/').replace(/(\d)\s*%\s*of\s*(\d)/g, '($1/100)*$2').replace(/(what is|calculate|calc|whats|what's|solve|how much is)/g, '').replace(/,/g, '').trim();
    if (!/\d/.test(e) || !/^[\d\s+\-*/().%^]+$/.test(e) || !/[+\-*/^%]/.test(e)) return null;
    e = e.replace(/\^/g, '');
    try { const v = Function('"use strict";return (' + e + ')')(); if (typeof v !== 'number' || !isFinite(v)) return null; return String(Math.round(v * 1e8) / 1e8); } catch (er) { return null; }
  }
  function summarizeAll() {
    const rows = S.chats.filter(c => !c.members.includes(BOT) && N.unreadN(c) > 0 && !N.isLocked(c.id));
    if (!rows.length) return 'You’re all caught up — no unread messages. 🎉';
    return 'Here’s what’s waiting for you:\n\n' + rows.slice(0, 8).map(c => `• ${N.chatInfo(c).name} — ${N.unreadN(c)} new${c.lastMsg ? ': “' + String(c.lastMsg.text || '').slice(0, 60) + '”' : ''}`).join('\n') + '\n\nOpen any chat and use ⋮ → Summarize this chat for a full bullet summary.';
  }

  /* ---------------- extractive summaries ---------------- */
  const STOP = new Set('the a an and or but if so of to in on at for with from by is are was were be been am it this that these those i you he she we they me my your our their his her its as not no yes ok okay do does did have has had will would can could should just also than then there here what when where which who how why about into over out up down very too more most some any all one two get got let like really much many thanks thank please hi hello hey lol haha hmm yeah yep nope a ہے ہیں اور کا کی کے میں کو سے نے پر یہ وہ تو بھی کہ ہو gai tha thi hai hain ka ki ke mein ko se ne par ye woh to bhi kya nahi aap main hum'.split(' '));
  const words = s => (s.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  function summarize(list) {
    const msgs = list.filter(m => !m.deleted && !m.hidden && m.type !== 'system' && m.type !== 'call' && !m.threadOf);
    if (!msgs.length) return { bullets: ['Nothing to summarise yet.'], n: 0 };
    const texts = msgs.filter(m => m.type === 'text' && m.text && m.text.trim().length > 1), freq = {};
    texts.forEach(m => words(m.text).forEach(w => { freq[w] = (freq[w] || 0) + 1; }));
    const who = {}; msgs.forEach(m => { who[m.from] = (who[m.from] || 0) + 1; });
    const people = Object.entries(who).sort((a, b) => b[1] - a[1]);
    const bullets = [];
    bullets.push(`${msgs.length} message${msgs.length > 1 ? 's' : ''} from ${people.length} ${people.length > 1 ? 'people' : 'person'} — most active: ${people.slice(0, 3).map(([u, n]) => nameOf(u) + ' (' + n + ')').join(', ')}.`);
    const topics = Object.entries(freq).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
    if (topics.length) bullets.push('Main topics: ' + topics.join(', ') + '.');
    const scored = texts.map((m, i) => { const ws = words(m.text); const sc = ws.reduce((a, w) => a + (freq[w] || 0), 0) / Math.sqrt(ws.length + 3) + (/\b(\d{1,2}[:.]\d{2}|am|pm|tomorrow|today|tonight|deadline|meeting|meet|urgent|important|decid|agree|confirm|book|pay|send|submit|kal|aaj|meeting)\b/i.test(m.text) ? 2.5 : 0) + (m.text.length > 25 ? .4 : 0); return { m, i, sc }; });
    const pick = scored.sort((a, b) => b.sc - a.sc).slice(0, Math.min(5, Math.max(2, Math.ceil(texts.length / 8)))).sort((a, b) => a.i - b.i);
    pick.forEach(({ m }) => bullets.push(`${nameOf(m.from)}: “${m.text.trim().replace(/\s+/g, ' ').slice(0, 130)}${m.text.length > 130 ? '…' : ''}”`));
    const qs = texts.filter(m => /\?|؟/.test(m.text) && !pick.some(p => p.m === m)).slice(-2); if (qs.length) bullets.push('Questions asked: ' + qs.map(m => '“' + m.text.trim().slice(0, 70) + '” (' + nameOf(m.from) + ')').join('; '));
    const polls = msgs.filter(m => m.type === 'poll'); if (polls.length) bullets.push('Polls: ' + polls.map(m => m.poll.q).slice(0, 3).join('; ') + '.');
    const media = { image: 0, video: 0, voice: 0, file: 0 }; msgs.forEach(m => { if (media[m.type] != null) media[m.type]++; });
    const mt = Object.entries(media).filter(([, n]) => n).map(([k, n]) => `${n} ${k === 'image' ? 'photo' : k === 'voice' ? 'voice note' : k}${n > 1 ? 's' : ''}`); if (mt.length) bullets.push('Shared: ' + mt.join(', ') + '.');
    const links = texts.flatMap(m => m.text.match(/https?:\/\/[^\s]+/g) || []); if (links.length) bullets.push(links.length + ' link' + (links.length > 1 ? 's' : '') + ' shared.');
    const vt = msgs.filter(m => m.type === 'voice' && m.transcript).slice(-2); vt.forEach(m => bullets.push(`Voice note from ${nameOf(m.from)}: “${m.transcript.slice(0, 120)}${m.transcript.length > 120 ? '…' : ''}”`));
    return { bullets, n: msgs.length };
  }
  N.summarize = summarize;

  /* ---------------- catch-up banner + summary sheet ---------------- */
  N.showCatchUp = function (chatId, n) {
    const pane = $('#msgs'); if (!pane || S.activeId !== chatId || $('#catchBar')) return;
    const bar = el(`<div id="catchBar" class="catch-bar fade-in"><span class="text-gold">${ic('sparkle', 'w-5 h-5')}</span><div class="flex-1 min-w-0"><div class="font-bold text-sm">${n} unread messages</div><div class="text-xs text-[var(--muted)]">Want a quick summary?</div></div><button class="btn btn-gold !py-1.5 !px-3 text-sm" data-go>Summarize</button><button class="icon-btn !w-8 !h-8" data-x>${ic('x', 'w-4 h-4')}</button></div>`);
    pane.parentElement.insertBefore(bar, pane); $('[data-x]', bar).onclick = () => bar.remove(); $('[data-go]', bar).onclick = () => { bar.remove(); N.catchUpNow(chatId, n); };
    if (N.i18nApply) N.i18nApply(bar);
  };
  N.catchUpNow = function (chatId, n) {
    const c = S.chats.find(x => x.id === chatId); if (!c || (N.isLocked(chatId) && !N.isUnlocked(chatId))) return;
    const list = S.msgs.slice(-Math.max(20, Math.min(n || 100, 300))), r = summarize(list);
    const md = modal(`<div class="p-5"><div class="flex items-center justify-between mb-3"><h3 class="text-lg font-bold flex items-center gap-2"><span class="text-gold">${ic('sparkle', 'w-5 h-5')}</span> Catch-up · ${esc(N.chatInfo(c).name)}</h3><button class="icon-btn" data-x>${ic('x')}</button></div>
      <ul class="space-y-2 text-sm max-h-[55dvh] overflow-y-auto">${r.bullets.map(b => `<li class="flex gap-2"><span class="text-gold mt-0.5">●</span><span>${esc(b)}</span></li>`).join('')}</ul>
      <p class="text-[11px] text-[var(--muted)] mt-3">Summary made privately on your device from the last ${r.n} messages.</p></div>`);
    $('[data-x]', md.box).onclick = md.close; if (N.i18nApply) N.i18nApply(md.box);
  };
})();
