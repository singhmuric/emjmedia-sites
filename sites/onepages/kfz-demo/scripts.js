/* Interactions — Session 1.4 NFR-C-09/-11/-12 + v2-Upgrade 2026-04-22.
 * Runs after DOMContentLoaded (script has `defer`).
 * Respect `prefers-reduced-motion`: wenn gesetzt, Reveal + Counter
 * deaktiviert — Inhalte bleiben trotzdem sichtbar (Progressive Enhancement).
 *
 * Scroll-Reveal v2-Fix:
 *  - CSS-Default: alles sichtbar (opacity:1). Script nimmt Inhalte nie weg,
 *    solange der Observer nicht erfolgreich angelegt ist.
 *  - Flag `html.js-reveal-ready` wird NUR gesetzt, wenn IntersectionObserver
 *    existiert und mindestens ein Element gefunden wurde.
 *  - Observer observiert BEIDE Attribute: [data-reveal] UND [data-reveal-stagger]
 *    (Bug aus v1: nur [data-reveal] wurde observed, wodurch Listen-Sektionen
 *    mit nur [data-reveal-stagger] nie revealed wurden → 5 Sektionen leer).
 *  - Fallback fuer reduce-motion ODER fehlendes IntersectionObserver:
 *    Flag NICHT setzen → Content bleibt per CSS-Default sichtbar.
 */
(() => {
  'use strict';
  const html = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;

  // --- NFR-C-09 v2 Scroll-Reveal (Progressive Enhancement) --------
  const revealEls = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if (revealEls.length && !reduce() && 'IntersectionObserver' in window) {
    // Flag setzen BEVOR Elemente hidden werden — CSS haengt daran.
    html.classList.add('js-reveal-ready');

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealEls.forEach((el) => io.observe(el));
  }
  // Fallback implizit: wenn reduce-motion oder kein IntersectionObserver,
  // bleibt 'js-reveal-ready' nicht gesetzt → CSS-Default (opacity:1) greift.

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
