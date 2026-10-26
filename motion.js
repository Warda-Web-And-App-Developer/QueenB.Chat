/* QUEENBEE — motion.js : click colour feedback (ripple + pressed colour) and scroll-reveal animations */
(function () {
  'use strict';
  const HOSTS = '.btn,.icon-btn,.tab,.fab,.send-btn,.row,.menu-pop button,.story-add,.poll-opt,.pw-eye,.react-chip,.pad-key,.file-card,.vid-play,.land-nav a,.step-card,.feat-card';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* every clickable control flashes a palette colour the moment it's pressed */
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest && e.target.closest(HOSTS); if (!h || h.disabled) return;
    h.classList.add('pressed'); clearTimeout(h._pt); h._pt = setTimeout(() => h.classList.remove('pressed'), 520);
    if (reduce) return;
    const r = h.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const bg = getComputedStyle(h).backgroundColor.match(/\d+/g) || [0, 0, 0, 0];
    const onGold = +bg[0] > 200 && +bg[1] > 150 && +bg[2] < 90 && (bg[3] === undefined || +bg[3] !== 0);
    const w = document.createElement('span'); w.className = 'rp-wave' + (onGold ? ' on-gold' : '');
    w.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    const needPos = getComputedStyle(h).position === 'static';
    if (needPos) h.style.position = 'relative'; h.classList.add('rp-host'); h.append(w);
    setTimeout(() => { w.remove(); h.classList.remove('rp-host'); if (needPos) h.style.position = ''; }, 650);
  }, true);

  /* scroll reveal for the landing page */
  const SEL = '.land-sec h2, .land-sec .step-card, .land-sec .feat-card, .land-sec > div > p, #about > *, .auth-hero .mock';
  let io = null;
  function scan() {
    if (reduce || !('IntersectionObserver' in window)) return;
    io = io || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
    document.querySelectorAll(SEL).forEach((n, i) => { if (n.dataset.rv) return; n.dataset.rv = 1; n.classList.add('reveal'); n.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(n); });
  }
  let t = 0; const app = document.getElementById('app');
  if (app) new MutationObserver(() => { cancelAnimationFrame(t); t = requestAnimationFrame(scan); }).observe(app, { childList: true, subtree: true });
  scan();
})();
