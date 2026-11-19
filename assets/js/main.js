/* Lumen — motion + interaction layer (transform/opacity only) */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('no-motion');

  /* tier-2 refraction: chromium only */
  try {
    if (CSS.supports('backdrop-filter', 'url(#lens)') || CSS.supports('-webkit-backdrop-filter', 'url(#lens)')) {
      if (!reduced) root.classList.add('refract-on');
    }
  } catch (e) {}

  /* fine pointer only: cursor light + magnetic */
  var fine = matchMedia('(pointer: fine)').matches && !reduced;
  if (fine) {
    doc.body.classList.add('fine-pointer');
    var light = doc.getElementById('cursor-light');
    if (light) {
      var lx = innerWidth / 2, ly = innerHeight / 2, tx = lx, ty = ly, raf = null;
      var tick = function () {
        lx += (tx - lx) * 0.09; ly += (ty - ly) * 0.09;
        light.style.transform = 'translate(' + (lx - 260) + 'px,' + (ly - 260) + 'px)';
        raf = (Math.abs(tx - lx) > .3 || Math.abs(ty - ly) > .3) ? requestAnimationFrame(tick) : null;
      };
      addEventListener('pointermove', function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });
    }
    doc.querySelectorAll('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.28;
        el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* intro: three acts, once per session, skippable */
  var intro = doc.getElementById('intro');
  var KEY = 'lumen-intro-seen';
  var finishIntro = function () {
    doc.body.classList.remove('intro-live', 'intro-skip');
    doc.body.classList.add('ready');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    if (intro) intro.remove();
  };
  if (intro) {
    var seen = false;
    try { seen = !!sessionStorage.getItem(KEY); } catch (e) {}
    if (!seen && !reduced) {
      doc.body.classList.add('intro-live');
      var t1 = setTimeout(finishIntro, 3150);
      var skip = function () { clearTimeout(t1); doc.body.classList.add('intro-skip'); setTimeout(finishIntro, 340); };
      var onSkip = function (e) { if (performance.now() > 750) { skip(); doc.removeEventListener('click', onSkip); doc.removeEventListener('keydown', onSkip); } };
      doc.addEventListener('click', onSkip);
      doc.addEventListener('keydown', onSkip);
    } else {
      finishIntro();
    }
  } else {
    doc.body.classList.add('ready');
  }

  /* nav state */
  var nav = doc.querySelector('.nav');
  if (nav) {
    var setNav = function () { nav.classList.toggle('scrolled', scrollY > 40); };
    addEventListener('scroll', setNav, { passive: true }); setNav();
  }

  /* mobile menu */
  var burger = doc.querySelector('.burger'), menu = doc.getElementById('menu');
  if (burger && menu) {
    var closeMenu = function () { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
    burger.addEventListener('click', function () {
      menu.classList.add('open'); burger.setAttribute('aria-expanded', 'true');
    });
    menu.querySelector('.close').addEventListener('click', closeMenu);
    menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* reveal on scroll */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  doc.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* collection: detail modal with shared-element flight */
  var modal = doc.getElementById('detail');
  var dataEl = doc.getElementById('pieces-data');
  if (modal && dataEl) {
    var pieces = {};
    try { JSON.parse(dataEl.textContent).forEach(function (p) { pieces[p.id] = p; }); } catch (e) {}
    var cardImg = modal.querySelector('img');
    var lastSrc = null;
    var openPiece = function (id, sourceImg) {
      var p = pieces[id]; if (!p) return;
      lastSrc = sourceImg;
      var put = function () {
        cardImg.src = p.img; cardImg.alt = p.name;
        modal.querySelector('h3').textContent = p.name;
        modal.querySelector('.dims').textContent = p.dims;
        modal.querySelector('.desc').textContent = p.desc;
        modal.querySelector('.enquire').href = 'contact.html?piece=' + encodeURIComponent(p.name);
        modal.classList.add('open');
        doc.body.style.overflow = 'hidden';
      };
      if (sourceImg && document.startViewTransition && !reduced) {
        sourceImg.style.viewTransitionName = 'piece-flight';
        cardImg.style.viewTransitionName = 'piece-flight';
        var vt = document.startViewTransition(put);
        vt.finished.finally(function () {
          sourceImg.style.viewTransitionName = ''; cardImg.style.viewTransitionName = '';
        });
      } else { put(); }
    };
    var close = function () {
      modal.classList.remove('open'); doc.body.style.overflow = '';
      if (lastSrc) { lastSrc.style.viewTransitionName = ''; lastSrc = null; }
      cardImg.style.viewTransitionName = '';
    };
    doc.querySelectorAll('.piece-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.preventDefault();
        openPiece(card.getAttribute('data-piece'), card.querySelector('img'));
      });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('.detail-close')) close();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
  }

  /* contact form: submit morphs the button in place */
  var form = doc.querySelector('form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = form.querySelector('button');
      b.classList.add('sent'); b.textContent = 'Sent';
      b.disabled = true;
      var n = form.querySelector('.form-note');
      if (n) n.textContent = 'Thank you. The studio replies within two days.';
    });
  }
})();
