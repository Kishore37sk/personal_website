/* Kishore Kumar S — portfolio interactions
 * Progressive enhancement: every section is readable and every link works
 * without this file. Motion is skipped for prefers-reduced-motion. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  // Safari < 14 only has the legacy addListener API
  const onMQ = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
  // document position from layout offsets — ignores transforms (reveal, parallax, hover)
  const pageTop = el => { let t = 0; for (let n = el; n; n = n.offsetParent) t += n.offsetTop; return t; };

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mqNarrow = window.matchMedia('(max-width: 860px)');
  const hasIO = 'IntersectionObserver' in window;
  let reduced = mqReduce.matches;

  doc.classList.add('js');

  /* ── Small content enhancements ─────────────────────────────────────── */
  $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  // every new-tab link: safe rel + an announcement for screen-reader users
  $$('a[target="_blank"]').forEach(a => {
    if (!/\bnoopener\b/.test(a.rel)) a.rel = `${a.rel} noopener`.trim();
    if (a.getAttribute('aria-hidden') === 'true') return;
    const hint = document.createElement('span');
    hint.className = 'sr-only';
    hint.textContent = ' (opens in new tab)';
    a.append(hint);
  });

  // a broken screenshot falls back to its frame's brand-coloured background
  $$('.proj-screen img, .proj-phone img, .mosaic img').forEach(img => {
    const fail = () => { img.hidden = true; };
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
    img.addEventListener('error', fail, { once: true });
  });

  /* ── Mobile menu (modal: scrim, scroll lock, inert background) ─────── */
  const toggle = $('.nav-toggle');
  const menu = $('#mobile-menu');
  const scrim = $('.menu-scrim');
  const header = $('.site-header');
  const menuOpen = () => !!toggle && toggle.getAttribute('aria-expanded') === 'true';
  const background = ['#main', '.site-footer', '.to-top', '.skip-link'].map(s => $(s)).filter(Boolean);

  function setMenu(open, returnFocus = true) {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    doc.classList.toggle('menu-open', open);
    background.forEach(el => { el.inert = open; });
    if (open) requestAnimationFrame(() => { const first = $('a', menu); if (first) first.focus(); });
    else if (returnFocus) toggle.focus();
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => setMenu(!menuOpen()));
    if (scrim) scrim.addEventListener('click', () => setMenu(false));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false, false); });
    // logo / availability badge stay usable above the scrim — they close the menu too
    if (header) header.addEventListener('click', e => { if (menuOpen() && e.target.closest('a')) setMenu(false, false); });
    document.addEventListener('keydown', e => {
      if (!menuOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
      if (e.key !== 'Tab') return;
      // keep keyboard focus cycling through toggle + menu links
      const items = [toggle, ...$$('a', menu)];
      const i = items.indexOf(document.activeElement);
      if (i === -1) { e.preventDefault(); items[0].focus(); }
      else if (e.shiftKey && i === 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    });
    onMQ(mqNarrow, e => { if (!e.matches && menuOpen()) setMenu(false, false); });
  }

  /* ── Active section + sliding nav indicator ─────────────────────────── */
  const navList = $('.nav-links');
  const indicator = $('.nav-indicator');
  const deskLinks = $$('.nav-links a');
  const spyLinks = $$('a[data-nav]');
  const spySections = [...new Set(spyLinks.map(a => a.hash.slice(1)))]
    .map(id => document.getElementById(id)).filter(Boolean);
  let spyTops = [];   // [{ id, top }] sorted by position — cached in measure()
  let linkGeo = [];   // [{ hash, x, w }] — cached in measure()
  let activeId = 'home';

  function placeIndicator() {
    if (!navList || !indicator) return;
    const g = linkGeo.find(l => l.hash === `#${activeId}`);
    if (!g || !g.w) return; // nav links hidden (mobile) or not measured yet
    indicator.style.setProperty('--x', `${g.x}px`);
    indicator.style.setProperty('--w', `${g.w}px`);
    navList.classList.add('has-indicator');
  }

  function setActive(id) {
    if (!id || id === activeId) return;
    activeId = id;
    spyLinks.forEach(a => {
      const on = a.hash === `#${id}`;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    placeIndicator();
  }

  /* ── Scroll reveal ──────────────────────────────────────────────────── */
  // Default state is visible. Only elements that start off-screen are hidden
  // (.is-pending) and revealed as they arrive; anything already in view at
  // load stays put, so nothing can get stuck invisible.
  const reveals = $$('[data-reveal]');
  const markIn = el => { el.classList.remove('is-pending'); el.classList.add('is-in'); };
  const settle = el => { el.classList.add('is-settled'); };

  if (reduced || !hasIO) {
    reveals.forEach(el => { markIn(el); settle(el); });
  } else {
    $$('[data-stagger]').forEach(group => {
      $$(':scope > [data-reveal]', group).forEach((el, i) => {
        el.style.setProperty('--rd', `${(Math.min(i, 6) * 0.08).toFixed(2)}s`);
      });
    });

    const revealNow = el => {
      markIn(el);
      const done = ev => {
        if (ev && (ev.target !== el || ev.propertyName !== 'opacity')) return;
        el.removeEventListener('transitionend', done);
        settle(el);
      };
      el.addEventListener('transitionend', done);
      setTimeout(() => settle(el), 1800); // fallback if transitionend never fires
    };

    const rio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        rio.unobserve(e.target);
        revealNow(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    const vh0 = window.innerHeight;
    reveals.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < vh0 && r.bottom > 0) { markIn(el); settle(el); }
      else { el.classList.add('is-pending'); rio.observe(el); }
    });

    // safety net: anything on screen that is still pending gets shown
    const sweep = () => reveals.forEach(el => {
      if (!el.classList.contains('is-pending')) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { rio.unobserve(el); revealNow(el); }
    });
    window.addEventListener('load', () => setTimeout(sweep, 1200));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sweep(); });
    window.addEventListener('beforeprint', () => reveals.forEach(el => { markIn(el); settle(el); }));
  }

  /* ── Count-up stats (real values live in the HTML) ──────────────────── */
  const counters = $$('[data-count]');
  counters.forEach(el => { el.style.minWidth = `${String(el.dataset.count).length}ch`; });
  if (!reduced && hasIO) {
    const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const run = el => {
      const target = Number(el.dataset.count);
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / 1500, 1);
        el.textContent = String(Math.round(easeOutExpo(p) * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        run(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => { el.textContent = '0'; cio.observe(el); });
    window.addEventListener('beforeprint', () => counters.forEach(el => {
      cio.unobserve(el);
      el.textContent = el.dataset.count;
    }));
  }

  /* ── Ticker: pause control + pause while off-screen ─────────────────── */
  const marquee = $('.marquee');
  if (marquee) {
    const btn = $('.marquee-toggle', marquee);
    if (btn) btn.addEventListener('click', () => {
      const paused = marquee.classList.toggle('is-paused');
      btn.setAttribute('aria-pressed', String(paused));
    });
    if (hasIO) {
      new IntersectionObserver(entries => {
        const e = entries[entries.length - 1];
        marquee.classList.toggle('is-offscreen', !e.isIntersecting);
      }).observe(marquee);
    }
  }

  /* ── One rAF-batched scroll loop ────────────────────────────────────────
   * measure() does every layout read (load / resize / font load only);
   * render() only writes, so scrolling never forces layout. */
  const bar = $('.scroll-progress');
  const toTop = $('.to-top');
  const heroArt = $('.hero-art');
  const blobs = $$('.aurora .blob');
  const processEl = $('[data-process]');
  const stepsWrap = processEl ? $('.steps-wrap', processEl) : null;
  const steps = processEl ? $$('.step', processEl) : [];
  const parallax = $$('[data-parallax]').map(el => ({
    el, speed: parseFloat(el.dataset.parallax) || 0, center: 0, half: 0,
  }));

  let vh = window.innerHeight;
  let maxScroll = 1;
  let heroStart = 0;
  let heroBottom = 0;
  let procTop = 0;
  let procH = 0;
  let ticking = false;

  function measure() {
    vh = window.innerHeight;
    maxScroll = Math.max(1, doc.scrollHeight - vh);

    parallax.forEach(p => {
      p.half = p.el.offsetHeight / 2;
      p.center = pageTop(p.el) + p.half;
    });

    if (heroArt) {
      const top = pageTop(heroArt);
      heroBottom = top + heroArt.offsetHeight;
      // layers rest while the art is centred on screen; they drift as it leaves
      heroStart = Math.max(0, top + heroArt.offsetHeight / 2 - vh / 2);
    }

    if (processEl) {
      procTop = pageTop(processEl);
      procH = processEl.offsetHeight;
      if (stepsWrap && steps.length) {
        const last = steps[steps.length - 1];
        processEl.style.setProperty('--track-bottom', `${stepsWrap.offsetHeight - (last.offsetTop + 21)}px`);
      }
    }

    spyTops = spySections.map(s => ({ id: s.id, top: pageTop(s) })).sort((a, b) => a.top - b.top);
    linkGeo = deskLinks.map(a => ({ hash: a.hash, x: a.offsetLeft, w: a.offsetWidth }));
    placeIndicator();
    render();
  }

  function render() {
    ticking = false;
    const y = window.scrollY;
    const progress = clamp(y / maxScroll, 0, 1);

    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (toTop) {
      toTop.classList.toggle('is-visible', y > vh * 0.8);
      toTop.style.setProperty('--p', progress.toFixed(4));
    }

    // active section = last one whose top has passed a line near the top third
    if (spyTops.length) {
      const line = y + Math.min(vh * 0.4, 200);
      let cur = spyTops[0].id;
      for (const s of spyTops) { if (s.top <= line) cur = s.id; else break; }
      if (y >= maxScroll - 4) cur = 'contact';
      setActive(cur);
    }

    if (processEl) {
      const span = Math.max(procH * 0.85, vh * 0.35);
      const p = reduced ? 1 : clamp((y + vh * 0.72 - procTop) / span, 0, 1);
      processEl.style.setProperty('--progress', p.toFixed(3));
      const last = Math.max(1, steps.length - 1);
      steps.forEach((s, i) => s.classList.toggle('is-lit', p > 0 && p >= i / last - 0.02));
    }

    if (reduced) return;
    const k = mqNarrow.matches ? 0.55 : 1;

    if (heroArt && y < heroBottom + 80) {
      heroArt.style.setProperty('--sy', (Math.max(0, y - heroStart) * k).toFixed(1));
    }

    const mid = y + vh / 2;
    for (const p of parallax) {
      const d = p.center - mid;
      if (Math.abs(d) > vh / 2 + p.half + 120) continue; // off-screen: skip
      p.el.style.translate = `0 ${(d * p.speed * k).toFixed(1)}px`;
    }

    // the pastel wash drifts with scroll but stays bounded (never scrolls away)
    for (let i = 0; i < blobs.length; i++) {
      const t = y / 1100 + i * 1.7;
      blobs[i].style.transform =
        `translate3d(${(Math.cos(t * 0.8) * 44).toFixed(1)}px, ${(Math.sin(t) * 64).toFixed(1)}px, 0) ` +
        `scale(${(1 + Math.sin(t * 0.6) * 0.06).toFixed(3)})`;
    }
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  };
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 120); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', measure);
  window.addEventListener('pageshow', e => { if (e.persisted) measure(); }); // back/forward cache
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(document.body);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  onMQ(mqReduce, e => {
    reduced = e.matches;
    if (reduced) {
      parallax.forEach(p => { p.el.style.translate = ''; });
      blobs.forEach(b => { b.style.transform = ''; });
      if (heroArt) heroArt.style.removeProperty('--sy');
      reveals.forEach(el => { markIn(el); settle(el); });
    }
    render();
  });

  if (toTop) {
    toTop.addEventListener('click', () => {
      const main = $('#main');
      if (main) main.focus({ preventScroll: true }); // keyboard users restart from the top
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  measure();

  /* ── Pointer-only flourishes (mouse / trackpad) ─────────────────────── */
  if (mqFine.matches) {
    // hero: layers lean toward the pointer, eased with a small lerp loop
    const heroCard = $('.hero-card');
    if (heroArt && heroCard) {
      let rect = null;
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const step = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        heroArt.style.setProperty('--px', cx.toFixed(3));
        heroArt.style.setProperty('--py', cy.toFixed(3));
        raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(step) : 0;
      };
      const kick = () => { if (!raf && !reduced) raf = requestAnimationFrame(step); };
      heroCard.addEventListener('pointerenter', () => { rect = heroArt.getBoundingClientRect(); });
      heroCard.addEventListener('pointermove', e => {
        if (!rect) rect = heroArt.getBoundingClientRect();
        tx = clamp((e.clientX - rect.left) / rect.width - 0.5, -0.8, 0.8);
        ty = clamp((e.clientY - rect.top) / rect.height - 0.5, -0.8, 0.8);
        kick();
      });
      heroCard.addEventListener('pointerleave', () => { tx = 0; ty = 0; rect = null; kick(); });
      window.addEventListener('scroll', () => { rect = null; }, { passive: true });
    }

    // glass cards: a soft light follows the pointer
    $$('.spot').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
        card.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      });
    });

    // service cards: subtle 3D tilt (kept from the original site), once revealed
    $$('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        if (reduced || !card.classList.contains('is-settled')) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform .12s linear, box-shadow .5s';
        card.style.transform =
          `translateY(-6px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transition = '';
        card.style.transform = '';
      });
    });
  }
})();
