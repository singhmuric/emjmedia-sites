/* Interactions — Session 1.4 NFR-C-09/-11/-12.
 * Runs after DOMContentLoaded (script has `defer`). Respects
 * prefers-reduced-motion: if set, reveal + counter are disabled.
 */
(() => {
  'use strict';
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;

  // --- NFR-C-09 Scroll-Reveal via IntersectionObserver --------
  // Elements with data-reveal get .is-revealed when entering viewport.
  // Stagger via data-reveal-delay (set per-item, 60ms cascade).
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length && !reduce() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else if (reduce()) {
    revealEls.forEach((el) => el.classList.add('is-revealed'));
  }

  // --- NFR-C-11 Number-Counter -----------------------------
  // <span data-counter data-counter-to="1998" data-counter-decimals="0">0</span>
  const counters = document.querySelectorAll('[data-counter]');
  if (counters.length) {
    const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
    const runCounter = (el) => {
      const end = parseFloat(el.dataset.counterTo || '0');
      const decimals = parseInt(el.dataset.counterDecimals || '0', 10);
      const duration = 900;
      if (reduce()) { el.textContent = end.toFixed(decimals).replace('.', ','); return; }
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const v = end * easeOutQuint(t);
        el.textContent = v.toFixed(decimals).replace('.', ',');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { runCounter(e.target); io.unobserve(e.target); }
      }, { threshold: 0.5 });
      counters.forEach((el) => io.observe(el));
    } else {
      counters.forEach(runCounter);
    }
  }

  // --- NFR-C-12 Sticky Mobile-CTA-Bar ---------------------
  // Shows below md (<768px) after 400px scroll; hidden on desktop.
  const ctaBar = document.querySelector('[data-sticky-cta]');
  if (ctaBar) {
    const mqDesktop = window.matchMedia('(min-width: 768px)');
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!mqDesktop.matches && window.scrollY > 400) ctaBar.classList.add('is-shown');
        else ctaBar.classList.remove('is-shown');
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    mqDesktop.addEventListener('change', onScroll);
    onScroll();
  }
})();
