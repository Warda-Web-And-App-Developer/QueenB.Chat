/* QUEENBEE — auth.js : login / sign-up / Google / profile */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, $$, esc, el, ic, toast, modal } = N;
  let mode = 'login';

  function friendly(err) {
    const c = err && err.code || '';
    const map = {
      'auth/invalid-credential': 'Wrong email or password. If you signed up with Google, use “Continue with Google”.', 'auth/wrong-password': 'Wrong password. Please try again.',
      'auth/user-not-found': 'No account found with that email.', 'auth/email-already-in-use': 'That email is already registered. Try logging in.',
      'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'Please enter a valid email address.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.', 'auth/network-request-failed': 'Network error — check your connection.',
      'auth/operation-not-allowed': 'This sign-in method isn’t available right now.',
      'auth/unauthorized-domain': 'Sign-in isn’t available on this website address yet.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/invalid-phone-number': 'That phone number doesn’t look right. Check the country code and number.',
      'auth/invalid-verification-code': 'That code is not right. Check it and try again.', 'auth/code-expired': 'That code has expired. Request a new one.',
      'auth/missing-phone-number': 'Enter your phone number first.', 'auth/quota-exceeded': 'Too many texts sent today. Try again later or use email.',
      'auth/captcha-check-failed': 'Verification failed. Please try again.', 'auth/billing-not-enabled': 'Phone sign-in isn’t available right now. Please use email.',
      'permission-denied': 'You don’t have permission to do that right now.'
    };
    return map[c] || (err && err.message) || 'Something went wrong.';
  }
  N.friendly = friendly;

  N.showAuth = function () {
    const pendingJoin = sessionStorage.getItem('nova_join');
    const bars = [30, 60, 45, 80, 55, 90, 40, 70, 50, 85, 35, 65, 45, 75, 30, 60, 40, 55];
    const steps = [
      ['Create your account', 'Sign up with email or Google, choose a username, then upload a photo or build your own avatar.'],
      ['Find your people', 'Search a username to start a chat, add favourites, or share a group invite link with friends.'],
      ['Chat your way', 'Send text, voice notes, photos, videos, files and polls. Ask the QueenB.Chat assistant for help any time.'],
      ['Call & catch up', 'Talk with clear two-way audio or video, record calls, and get quick summaries of busy group chats.']
    ];
    const feats = [
      ['sparkle', 'AI assistant & summaries', 'Chat with the built-in assistant and turn 100 unread group messages into a short bullet list.'],
      ['phone', 'Crystal-clear calls', 'Real two-way voice and video with noise cancellation, a mic test and optional call recording.'],
      ['mic', 'Voice notes + transcripts', 'Record voice messages and read them as text instantly.'],
      ['smile', 'Your own avatar', 'Build a personal avatar, or upload a photo. Your avatar even talks and smiles on video calls.'],
      ['chat', 'Threads & mini-apps', 'Reply in threads, share notes, code snippets, polls and split expenses without leaving the chat.'],
      ['shield', 'Privacy controls', 'Block people, lock chats with a PIN, ghost mode, disappearing messages and scheduled Do Not Disturb.'],
      ['camera', 'Stories & status', 'Post photo, video or text stories and share what you are up to with a custom status.'],
      ['sun', 'Your language, your look', 'English, اردو, العربية and more, with full right-to-left support, plus light and dark themes.']
    ];
    const yr = new Date().getFullYear();
    $('#app').innerHTML = `
    <div id="authWrap" class="text-[var(--text)]">
      <header class="land-nav">
        <div class="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4 px-4 py-3">
          <button data-top class="shrink-0" title="QueenB.Chat">${N.logo('w-9 h-9', 'text-xl')}</button>
          <nav class="hidden md:flex items-center gap-1 ms-6 text-sm font-semibold text-[var(--muted)]">
            <button data-scroll="how" class="px-3 py-2 rounded-xl hover:bg-[var(--panel2)] hover:text-[var(--text)] transition">How it works</button>
            <button data-scroll="why" class="px-3 py-2 rounded-xl hover:bg-[var(--panel2)] hover:text-[var(--text)] transition">Why QueenB.Chat</button>
            <button data-scroll="about" class="px-3 py-2 rounded-xl hover:bg-[var(--panel2)] hover:text-[var(--text)] transition">About</button>
          </nav>
          <div class="flex-1"></div>
          ${N.langButton ? N.langButton() : ''}
          <button data-theme-btn class="icon-btn soft" title="Light / dark">${N.themeIcon()}</button>
          <button data-go="login" class="btn btn-ghost !py-2 !px-4 !hidden sm:!inline-flex">Log in</button>
          <button data-go="signup" class="btn btn-gold !py-2 !px-3 sm:!px-4 whitespace-nowrap"><span class="sm:hidden">Sign up</span><span class="hidden sm:inline">Sign up free</span></button>
        </div>
      </header>

      <section class="qb-hero relative overflow-hidden">
        <div class="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-14 lg:py-16">
          <div id="authCard" class="qb-card land-sec grid md:grid-cols-[1.05fr_1fr] rounded-[2rem] overflow-hidden shadow-2xl border border-[var(--border)] pop-in">
            <div class="qb-form p-6 sm:p-9 flex flex-col justify-center min-w-0">
              ${pendingJoin ? '<div class="mb-4 text-sm rounded-xl bg-gold text-onyx px-3 py-2 font-medium">You were invited to a group. Log in or sign up to join it.</div>' : ''}
              <div class="flex items-center gap-2 mb-5 text-[10px] font-extrabold tracking-[.22em] uppercase text-[var(--muted)]">${N.logoMark('w-6 h-6')}<span>QueenB.Chat</span></div>
              <div id="authHead" class="mb-4"></div>
              <div class="seg-nav mb-4"><button class="tab" data-mode="login">Log in</button><button class="tab" data-mode="signup">Sign up</button></div>
              <form id="authForm" class="space-y-3.5" novalidate></form>
              <div class="flex items-center gap-3 my-4 text-xs text-[var(--muted)]"><div class="flex-1 h-px bg-[var(--border)]"></div>or continue with<div class="flex-1 h-px bg-[var(--border)]"></div></div>
              <button id="googleBtn" class="btn btn-ghost w-full border border-[var(--border)] !py-3">
                <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#C19552" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/><path fill="#353935" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22z"/><path fill="#C19552" opacity=".7" d="M6.400 14c-.2-.6-.3-1.300-.3-2s.1-1.400.3-2V7.400H3.100a10 10 0 0 0 0 9.200z"/><path fill="#353935" opacity=".75" d="M12 5.900c1.500 0 2.800.5 3.800 1.500l2.800-2.800A10 10 0 0 0 3.100 7.400L6.400 10c.8-2.300 3-4.100 5.600-4.100z"/></svg>
                Continue with Google</button>
            </div>
            <div class="qb-art hidden md:flex flex-col justify-end relative min-h-[460px]">
              <div class="relative z-10 p-7 text-snow">
                <span class="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full bg-onyx/45 border border-snow/25 backdrop-blur">${ic('sparkle', 'w-4 h-4 text-gold')} Free · Works on every device</span>
                <h1 class="mt-3 text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight drop-shadow">Welcome to the hive.<span class="block text-pastel">Chat, call and share.</span></h1>
                <div class="mock mt-5">
                  <div class="mk in">Are we still on for Friday? 🎉</div>
                  <div class="mk out">Yes! Voting in the poll now 📊</div>
                  <div class="mk in voice"><span class="mk-play">${ic('play', 'w-3 h-3')}</span><span class="mk-bars">${bars.map(h => `<i style="height:${h}%"></i>`).join('')}</span><span class="text-xs opacity-70">0:12</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" class="land-sec max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <div class="text-center max-w-2xl mx-auto">
          <div class="text-xs font-extrabold tracking-[.2em] uppercase text-royal dark:text-gold">How it works</div>
          <h2 class="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Up and chatting in four easy steps</h2>
          <p class="mt-3 text-[var(--muted)]">No setup, no downloads. Open QueenB.Chat in your browser and you're ready.</p>
        </div>
        <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          ${steps.map(([t, d], i) => `<div class="step-card"><div class="step-num">${i + 1}</div><h3 class="mt-4 text-lg font-bold">${t}</h3><p class="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">${d}</p></div>`).join('')}
        </div>
      </section>

      <section id="why" class="land-sec bg-[var(--panel2)]">
        <div class="max-w-6xl mx-auto px-4 py-16 lg:py-20">
          <div class="text-center max-w-2xl mx-auto">
            <div class="text-xs font-extrabold tracking-[.2em] uppercase text-royal dark:text-gold">Why choose QueenB.Chat</div>
            <h2 class="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Everything you need to stay close</h2>
            <p class="mt-3 text-[var(--muted)]">All the tools you'd expect from a modern messenger, plus smart extras that make every chat easier.</p>
          </div>
          <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            ${feats.map(([i, t, d]) => `<div class="feat-card"><div class="feat-ic">${ic(i, 'w-6 h-6')}</div><h3 class="font-bold">${t}</h3><p class="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">${d}</p></div>`).join('')}
          </div>
        </div>
      </section>

      <section id="about" class="land-sec max-w-6xl mx-auto px-4 py-16 lg:py-20">
        <div class="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div class="text-xs font-extrabold tracking-[.2em] uppercase text-royal dark:text-gold">About QueenB.Chat</div>
            <h2 class="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">A simple, fast and good-looking way to stay in touch</h2>
            <p class="mt-4 text-[var(--muted)] leading-relaxed">QueenB.Chat is a modern messaging app for friends, families and teams. Talk one-to-one, start a group in seconds, drop a voice note, share a file or post a story, all without leaving the page.</p>
            <p class="mt-3 text-[var(--muted)] leading-relaxed">Your chats stay in sync across every device you sign in on, and the layout adapts to phones, tablets and desktops.</p>
            <div class="mt-6 flex flex-wrap gap-2 text-sm font-semibold">${['Real-time messaging', 'Responsive design', 'Light & dark themes', 'Many languages'].map(t => `<span class="px-3 py-1.5 rounded-full bg-[var(--panel2)] border border-[var(--border)]">${t}</span>`).join('')}</div>
          </div>
          <div class="grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4">
            ${[['zap', 'Fast', 'Messages and reactions appear instantly for everyone in the chat.'], ['shield', 'Secure sign-in', 'Log in with your email or your Google account.'], ['sparkle', 'Delightful', 'Avatars, stories, polls, sounds and wallpapers make every chat feel personal.']].map(([i, t, d]) => `<div class="feat-card !p-5"><div class="feat-ic !w-11 !h-11">${ic(i, 'w-5 h-5')}</div><h3 class="font-bold">${t}</h3><p class="mt-1 text-sm text-[var(--muted)]">${d}</p></div>`).join('')}
          </div>
        </div>
      </section>

      <section class="px-4 pb-16 lg:pb-20">
        <div class="cta-band relative overflow-hidden max-w-6xl mx-auto rounded-[2rem] px-6 py-12 sm:py-14 text-center">
          <div class="relative z-10">
            <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Ready to start chatting?</h2>
            <p class="mt-3 opacity-85 max-w-xl mx-auto">Create your free account in under a minute and invite your people.</p>
            <button data-go="signup" class="btn btn-royal !px-7 !py-3.5 text-base mt-6 shadow-xl">Create your free account ${ic('arrow', 'w-5 h-5')}</button>
          </div>
        </div>
      </section>

      <footer class="border-t border-[var(--border)]">
        <div class="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <div class="flex items-center gap-2.5">${N.logoMark('w-7 h-7')}<span>© ${yr} QueenB.Chat. All rights reserved.</span></div>
          <div class="flex gap-4 font-semibold"><button data-scroll="how">How it works</button><button data-scroll="why">Why QueenB.Chat</button><button data-scroll="about">About</button></div>
        </div>
      </footer>
    </div>`;
    $$('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; renderForm(); });
    $('#googleBtn').onclick = googleFlow;
    $$('[data-theme-btn]').forEach(b => b.onclick = N.toggleTheme);
    $$('[data-scroll]').forEach(b => b.onclick = () => { const t = document.getElementById(b.dataset.scroll); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $$('[data-go]').forEach(b => b.onclick = () => {
      mode = b.dataset.go; renderForm(); $('#authCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { const f = $('#fUser') || $('#fEmail'); if (f) f.focus({ preventScroll: true }); }, 450);
    });
    const top = $('[data-top]'); if (top) top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    renderForm();
  };

  /* ---- profile-picture block: upload a photo OR build an avatar (used on sign-up and in the profile editor) ---- */
  function photoBlock(id, getState, setState) {
    const st = getState();
    const html = `<div class="pb" id="${id}">
      <div class="pb-circle-wrap"><span class="pb-ring"></span><img class="pb-img" src="${esc(st.photo || B.util.avatarSVG('?', 'new'))}" alt=""></div>
      <div class="flex gap-2 justify-center mt-3 flex-wrap">
        <label class="pill ${st.source === 'photo' ? 'on' : ''}" data-pb="up">${ic('camera', 'w-4 h-4')}<span>Upload photo</span><input type="file" accept="image/*" class="hidden"></label>
        <button type="button" class="pill ${st.source === 'avatar' ? 'on' : ''}" data-pb="av">${ic('smile', 'w-4 h-4')}<span>Make avatar</span></button></div></div>`;
    const bind = root => {
      const box = $('#' + id, root), img = $('.pb-img', box), pills = $$('.pill', box);
      const mark = src => pills.forEach(p => p.classList.toggle('on', (p.dataset.pb === 'up') === (src === 'photo')));
      $('input[type=file]', box).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const p = await N.avatarFromFile(f); img.src = p; setState({ photo: p, source: 'photo' }); mark('photo'); } catch (er) { toast(er.message); } };
      $('[data-pb=av]', box).onclick = async () => { const r = await N.avatarBuilder({ cfg: getState().cfg, seed: getState().seed }); if (r) { img.src = r.photo; setState({ photo: r.photo, cfg: r.cfg, source: 'avatar' }); mark('avatar'); } };
    };
    return { html, bind };
  }

  function renderForm() {
    $$('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const su = mode === 'signup', f = $('#authForm');
    $('#authHead').innerHTML = `<h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">${su ? 'Create your account' : 'Welcome back 👋'}</h2><p class="text-[var(--muted)] mt-1">${su ? 'Add your picture and details to join QueenB.Chat.' : 'Log in to continue your conversations.'}</p>`;
    const row = (id, icon, ph, type, extra = '') => `<div class="inp"><span class="inp-ic">${ic(icon, 'w-5 h-5')}</span><input id="${id}" type="${type}" class="field" placeholder="${ph}" ${extra}></div>`;
    const pb = su ? photoBlock('pbSignup', () => su$, p => Object.assign(su$, p)) : null;
    f.innerHTML = `
      ${su ? `<div class="su-head">${pb.html}</div>
        ${row('fUser', 'user', 'Username (3–20 letters, numbers, _ .)', 'text', 'autocomplete="username" maxlength="20"')}
        ${row('fNick', 'smile', 'Nickname (optional)', 'text', 'autocomplete="nickname" maxlength="24"')}` : ''}
      ${row('fEmail', 'mail', 'Email address', 'email', 'autocomplete="email"')}
      <div class="inp"><span class="inp-ic">${ic('lock', 'w-5 h-5')}</span><input id="fPass" type="password" class="field !pe-12" placeholder="Password (min 6 characters)" autocomplete="${su ? 'new-password' : 'current-password'}"><button type="button" id="pwToggle" class="pw-eye" title="Show / hide password">${ic('eye', 'w-5 h-5')}</button></div>
      <div id="authErr" class="hidden text-sm rounded-xl px-3 py-2 bg-royal text-snow"></div>
      <button class="btn btn-gold w-full !py-3.5 text-base shadow-lg" id="authSubmit">${su ? 'Create account' : 'Log in'} →</button>`;
    $('#pwToggle').onclick = () => { const i = $('#fPass'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#pwToggle').innerHTML = ic(show ? 'eyeoff' : 'eye', 'w-5 h-5'); };
    if (su) pb.bind(f);
    f.onsubmit = submit;
    if (N.i18nApply) N.i18nApply($('#authCard'));
  }

  const su$ = { photo: '', cfg: null, source: '', seed: Math.random() };
  N.photoBlock = photoBlock;

  function showErr(msg) { const e = $('#authErr'); if (!e) return; e.textContent = msg; e.classList.remove('hidden'); }

  async function submit(e) {
    e.preventDefault(); const btn = $('#authSubmit'); $('#authErr').classList.add('hidden');
    const email = $('#fEmail').value.trim(), password = $('#fPass').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErr('Please enter a valid email address.');
    if (password.length < 6) return showErr('Password must be at least 6 characters.');
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Please wait…';
    try {
      if (mode === 'signup') {
        const username = $('#fUser').value.trim();
        if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) { btn.disabled = false; btn.textContent = old; return showErr('Username must be 3–20 characters: letters, numbers, _ or .'); }
        const nu = await B.signUp({ email, password, username, nickname: ($('#fNick').value || '').trim(), photo: su$.photo, avatarCfg: su$.cfg || null }); if (su$.cfg && nu && nu.uid) B.updateProfile(nu.uid, { avatarCfg: su$.cfg }).catch(() => { });
      } else await B.login(email, password);
    } catch (err) { showErr(friendly(err)); btn.disabled = false; btn.textContent = old; }
  }

  async function googleFlow() {
    if (B.mode === 'firebase') { try { await B.google(); } catch (e) { toast(friendly(e)); } return; }
    const accts = [['Alex Morgan', 'alex.morgan@gmail.com'], ['Sam Rivera', 'sam.rivera@gmail.com']];
    const md = modal(`<div class="p-6"><div class="text-center mb-4"><div class="text-xl font-bold">Choose an account</div><div class="text-sm text-[var(--muted)]">to continue to QueenB.Chat</div></div>
      ${accts.map(([n, m]) => `<button class="row rounded-xl" data-g="${m}" data-n="${n}"><img class="w-10 h-10 rounded-full" src="${B.util.avatarSVG(n, m)}"><div><div class="font-semibold">${n}</div><div class="text-sm text-[var(--muted)]">${m}</div></div></button>`).join('')}
      <div class="flex gap-2 mt-3"><input id="gMail" class="field" placeholder="Use another email…" type="email"><button class="btn btn-gold" id="gGo">Go</button></div></div>`);
    const go = async (mail, name) => { try { md.close(); await B.google(mail, name); } catch (e) { toast(friendly(e)); } };
    $$('[data-g]', md.box).forEach(b => b.onclick = () => go(b.dataset.g, b.dataset.n));
    $('#gGo', md.box).onclick = () => { const v = $('#gMail', md.box).value.trim(); if (/^\S+@\S+\.\S+$/.test(v)) go(v, v.split('@')[0]); else toast('Enter a valid email'); };
  }

  /* profile modal — first-time setup (Google) and editing: photo OR avatar, username, about line */
  N.profileModal = function (user, { first = false } = {}) {
    const stt = { photo: user.photo || '', cfg: user.avatarCfg || null, source: user.avatarCfg ? 'avatar' : (user.photo ? 'photo' : ''), seed: user.uid };
    const pb = photoBlock('pbProfile', () => stt, p => Object.assign(stt, p));
    const md = modal(`<form class="p-6 space-y-4">
      <h3 class="text-xl font-bold">${first ? 'Set up your profile' : 'Edit profile'}</h3>
      ${first ? '<p class="text-sm text-[var(--muted)]">Pick a username and a picture so people can find you. Upload a photo, or build your own avatar.</p>' : ''}
      ${pb.html}
      <input id="pmName" class="field" placeholder="Username" maxlength="20" value="${esc(user.username || (user.email || '').split('@')[0].replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20))}">
      <input id="pmNick" class="field" placeholder="Nickname (optional)" maxlength="24" value="${esc(user.nickname || '')}">
      <div id="pmErr" class="hidden text-sm rounded-xl px-3 py-2 bg-royal text-snow"></div>
      <div class="flex gap-2 justify-end">${first ? '' : '<button type="button" class="btn btn-ghost" data-c>Cancel</button>'}<button class="btn btn-royal">Save</button></div></form>`, { sticky: first });
    pb.bind(md.box);
    $('[data-c]', md.box) && ($('[data-c]', md.box).onclick = md.close);
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const name = $('#pmName', md.box).value.trim(), err = $('#pmErr', md.box);
      if (!/^[a-zA-Z0-9_.]{3,20}$/.test(name)) { err.textContent = 'Username must be 3–20 characters: letters, numbers, _ or .'; err.classList.remove('hidden'); return; }
      try {
        if (await B.usernameTaken(name, user.uid)) { err.textContent = 'That username is already taken.'; err.classList.remove('hidden'); return; }
        await B.updateProfile(user.uid, { username: name, nickname: $('#pmNick', md.box).value.trim(), usernameLower: name.toLowerCase(), photo: stt.photo, avatarCfg: stt.source === 'avatar' ? stt.cfg : null, profileDone: true });
        md.close(); toast('Profile saved');
      } catch (er) { err.textContent = friendly(er); err.classList.remove('hidden'); }
    };
    if (N.i18nApply) N.i18nApply(md.box);
  };
})();
