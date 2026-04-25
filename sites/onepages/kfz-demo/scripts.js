/* =========================================================================
   KFZ-Demo Variant B — Interactions
   Session 1.6. Self-contained vanilla JS, respects prefers-reduced-motion.
   Fail-Safe Progressive-Enhancement (Constitution §12.5):
   html.js-reveal-ready wird NUR gesetzt, wenn IntersectionObserver verfügbar,
   reduced-motion inaktiv und Reveal-Elemente vorhanden sind. Ohne Flag bleibt
   Content per CSS-Default sichtbar.
   ========================================================================= */
(function () {
  'use strict';

  var html = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return mqReduce.matches; }

  /* -------- 1 · Scroll-Reveal (Fail-Safe PE) -------- */
  var revealEls = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  if (revealEls.length && !reduced() && 'IntersectionObserver' in window) {
    html.classList.add('js-reveal-ready');

    var revealIo = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-revealed');
        revealIo.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealEls.forEach(function (el) { revealIo.observe(el); });
  }

  /* -------- 2 · Nav Scroll-Glass (DNA §5.14) -------- */
  var nav = document.querySelector('[data-nav]');
  if (nav) {
    var navTicking = false;
    function onNavScroll() {
      if (navTicking) return;
      navTicking = true;
      requestAnimationFrame(function () {
        if (window.scrollY > 12) nav.classList.add('is-scrolled');
        else nav.classList.remove('is-scrolled');
        navTicking = false;
      });
    }
    window.addEventListener('scroll', onNavScroll, { passive: true });
    onNavScroll();
  }

  /* -------- 3 · Mobile Menu Toggle -------- */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var navDrawer = document.querySelector('[data-nav-drawer]');
  if (navToggle && navDrawer) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (open) navDrawer.setAttribute('hidden', '');
      else navDrawer.removeAttribute('hidden');
    });
    // Close drawer when a link is clicked
    navDrawer.addEventListener('click', function (e) {
      var target = e.target;
      if (target && (target.tagName === 'A')) {
        navToggle.setAttribute('aria-expanded', 'false');
        navDrawer.setAttribute('hidden', '');
      }
    });
    // ESC to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        navToggle.setAttribute('aria-expanded', 'false');
        navDrawer.setAttribute('hidden', '');
      }
    });
  }

  /* -------- 4 · Prozess SVG-Connector Scroll-Animation (1.8 §2.1) --------
   * Jeder .connector-path wird beim Scrollen progressiv "gezeichnet"
   * via stroke-dashoffset (linear → smoothstep über scroll-progress).
   * Skill: emil-design-eng §4 Easing-Decision — constant motion (scroll-bound)
   * → linear-Mapping, geglättet mit smoothstep p*p*(3-2p) auf scroll-progress.
   * Vanilla-JS (kein GSAP — Constitution §2.4 JS-Budget ≤30 KB).
   *
   * Fail-Safe (Constitution §12.5): CSS-Default zeigt den Pfad voll
   * sichtbar (kein dasharray). JS schaltet erst auf "hidden initial"
   * um, wenn IO/animation aktiv ist und prefers-reduced-motion inaktiv.
   * Bei reduced-motion oder kein-IO: Pfad bleibt sichtbar wie im CSS. */
  var connectorPaths = document.querySelectorAll('.connector-path');
  if (connectorPaths.length && !reduced() && 'IntersectionObserver' in window) {
    var connSpecs = [];
    connectorPaths.forEach(function (path) {
      var connectorEl = path.closest('.step-connector');
      if (!connectorEl) return;
      var length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      connSpecs.push({ path: path, el: connectorEl, length: length });
    });

    if (connSpecs.length) {
      var connTicking = false;
      var updateConnectors = function () {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        for (var i = 0; i < connSpecs.length; i++) {
          var spec = connSpecs[i];
          var rect = spec.el.getBoundingClientRect();
          /* Engagement-Range: top of element bei vh*0.75 (start)
           * bis bottom of element bei vh*0.25 (end).
           * → raw = (start_y - rect.top) / (start_y - end_y) */
          var startY = vh * 0.75;
          var endY = vh * 0.25 - rect.height;
          var raw = (startY - rect.top) / (startY - endY);
          var p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
          /* smoothstep für sanfte Lerp am Anfang + Ende. */
          var eased = p * p * (3 - 2 * p);
          spec.path.style.strokeDashoffset = String(spec.length * (1 - eased));
        }
      };
      window.addEventListener('scroll', function () {
        if (connTicking) return;
        connTicking = true;
        requestAnimationFrame(function () { updateConnectors(); connTicking = false; });
      }, { passive: true });
      window.addEventListener('resize', updateConnectors);
      updateConnectors();
    }
  }

  /* -------- 5 · Counter-Animation (NFR data-counter) -------- */
  var counters = document.querySelectorAll('[data-counter]');
  if (counters.length) {
    var easeOutQuint = function (t) { return 1 - Math.pow(1 - t, 5); };
    var runCounter = function (el) {
      var end = parseFloat(el.getAttribute('data-counter-to') || '0');
      var decimals = parseInt(el.getAttribute('data-counter-decimals') || '0', 10);
      var duration = 1100;
      if (reduced()) {
        el.textContent = end.toFixed(decimals).replace('.', ',');
        return;
      }
      var start = performance.now();
      var step = function (now) {
        var t = Math.min(1, (now - start) / duration);
        var v = end * easeOutQuint(t);
        el.textContent = v.toFixed(decimals).replace('.', ',');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      var ctrIo = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.isIntersecting) continue;
          runCounter(e.target);
          // mark parent stat-cell revealed for bar-animation
          var cell = e.target.closest('.stats__cell');
          if (cell) cell.classList.add('is-revealed');
          ctrIo.unobserve(e.target);
        }
      }, { threshold: 0.6 });
      counters.forEach(function (el) { ctrIo.observe(el); });
    } else {
      counters.forEach(runCounter);
    }
  }

  /* -------- 6 · FAQ Filter (DNA §10.10) -------- */
  var faqFilters = document.querySelectorAll('[data-filter]');
  var faqItems = document.querySelectorAll('.faq__item');
  if (faqFilters.length && faqItems.length) {
    faqFilters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-filter');
        faqFilters.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        faqItems.forEach(function (item) {
          var itemCat = item.getAttribute('data-cat');
          var show = cat === 'all' || itemCat === cat;
          item.classList.toggle('is-hidden', !show);
        });
      });
    });
  }

  /* -------- 7 · Live Opening-Hours Status (DNA §10.11) -------- */
  var live = document.querySelector('[data-hours]');
  var liveStatus = document.querySelector('[data-live-status]');
  if (live && liveStatus) {
    var hoursMap = {
      1: { from: '08:00', to: '17:30' },
      2: { from: '08:00', to: '17:30' },
      3: { from: '08:00', to: '17:30' },
      4: { from: '08:00', to: '17:30' },
      5: { from: '08:00', to: '15:00' },
      6: null,
      0: null
    };
    var dayNames = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    var now = new Date();
    var dow = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var parseMin = function (s) { var p = s.split(':'); return parseInt(p[0],10)*60 + parseInt(p[1],10); };
    var today = hoursMap[dow];
    var isOpen = false;
    if (today && mins >= parseMin(today.from) && mins < parseMin(today.to)) isOpen = true;

    if (isOpen) {
      liveStatus.textContent = 'Jetzt geöffnet · bis ' + today.to + ' Uhr';
    } else {
      // find next open day
      var next = null, addDays = 0;
      for (var d = 1; d <= 7; d++) {
        var nd = (dow + d) % 7;
        if (hoursMap[nd]) { next = { dow: nd, from: hoursMap[nd].from }; addDays = d; break; }
      }
      if (next) {
        var prefix = addDays === 1 ? 'Morgen' : 'Am ' + dayNames[next.dow];
        liveStatus.textContent = 'Geschlossen · öffnet ' + prefix + ' ' + next.from + ' Uhr';
      } else {
        liveStatus.textContent = 'Geschlossen';
      }
      live.classList.add('is-closed');
    }

    // Mark today's row
    var todayRow = live.querySelector('[data-day="' + dow + '"]');
    if (todayRow) todayRow.classList.add('is-today');
  }

  /* -------- 8 · Mobile Sticky-Phone-Button (DNA §10.12) -------- */
  var stickyPhone = document.querySelector('[data-sticky-phone]');
  if (stickyPhone) {
    var mqDesktop = window.matchMedia('(min-width: 768px)');
    var stickyTicking = false;
    var onStickyScroll = function () {
      if (stickyTicking) return;
      stickyTicking = true;
      requestAnimationFrame(function () {
        if (!mqDesktop.matches && window.scrollY > 400) stickyPhone.classList.add('is-shown');
        else stickyPhone.classList.remove('is-shown');
        stickyTicking = false;
      });
    };
    window.addEventListener('scroll', onStickyScroll, { passive: true });
    if (typeof mqDesktop.addEventListener === 'function') {
      mqDesktop.addEventListener('change', onStickyScroll);
    }
    onStickyScroll();
  }

  /* -------- 9 · Marquee Scroll-Speed-Adjust (optional, pause on reduce) -------- */
  if (reduced()) {
    document.querySelectorAll('.marquee__track, .review-band__track').forEach(function (t) {
      t.style.animationPlayState = 'paused';
    });
  }
})();
