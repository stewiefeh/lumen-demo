/* Lumen — motion layer, second edition
   WebGL light-field intro, word-mask reveals, SPA-style page swaps
   with the View Transitions API. All animation on transform/opacity. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('no-motion');
  var fine = matchMedia('(pointer: fine)').matches && !reduced;

  /* tier-2 refraction: chromium only */
  try {
    if (!reduced && (CSS.supports('backdrop-filter', 'url(#lens)') || CSS.supports('-webkit-backdrop-filter', 'url(#lens)'))) {
      root.classList.add('refract-on');
    }
  } catch (e) {}

  /* ---------- split headlines into masked words ---------- */
  function splitWords(el) {
    if (el.getAttribute('data-split')) return;
    el.setAttribute('data-split', '1');
    var wi = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          var frag = doc.createDocumentFragment();
          parts.forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(doc.createTextNode(' ')); return; }
            var s = doc.createElement('span'); s.className = 'w'; s.style.setProperty('--wi', wi++);
            var it = doc.createElement('i'); it.textContent = w; s.appendChild(it);
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) { walk(n); }
      });
    })(el);
    el.classList.add('split-hold');
  }
  doc.querySelectorAll('.display, .lede').forEach(function (el) {
    if (!el.closest('.pull')) splitWords(el);
  });

  /* ---------- cursor light + magnetic ---------- */
  if (fine) {
    doc.body.classList.add('fine-pointer');
    var light = doc.getElementById('cursor-light');
    if (light) {
      var lx = innerWidth / 2, ly = innerHeight / 2, tx = lx, ty = ly, raf = null;
      var tick = function () {
        lx += (tx - lx) * 0.08; ly += (ty - ly) * 0.08;
        light.style.transform = 'translate(' + (lx - 260) + 'px,' + (ly - 260) + 'px)';
        raf = (Math.abs(tx - lx) > .3 || Math.abs(ty - ly) > .3) ? requestAnimationFrame(tick) : null;
      };
      addEventListener('pointermove', function (e) {
        tx = e.clientX; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(tick);
      }, { passive: true });
    }
  }

  /* ---------- nav + menu + parallax (once) ---------- */
  var nav = doc.querySelector('.nav');
  var setNav = function () { if (nav) nav.classList.toggle('scrolled', scrollY > 40); };
  addEventListener('scroll', setNav, { passive: true }); setNav();

  var burger = doc.querySelector('.burger'), menu = doc.getElementById('menu');
  if (burger && menu) {
    var closeMenu = function () { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
    burger.addEventListener('click', function () { menu.classList.add('open'); burger.setAttribute('aria-expanded', 'true'); });
    menu.querySelector('.close').addEventListener('click', closeMenu);
    menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  var hp = doc.querySelector('.hero-panel img');
  if (hp && !reduced) {
    var praf = null;
    var pfn = function () {
      praf = null;
      hp.style.transform = 'translateY(' + (Math.min(scrollY, 900) * 0.09) + 'px) scale(1.06)';
    };
    addEventListener('scroll', function () { if (!praf) praf = requestAnimationFrame(pfn); }, { passive: true });
  }

  /* ---------- intro: light through glass ---------- */
  var intro = doc.getElementById('intro');
  var KEY = 'lumen-intro-seen';
  var finishIntro = function () {
    doc.body.classList.remove('intro-live');
    doc.body.classList.add('ready');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    if (intro && intro.isConnected) intro.remove();
  };

  function runIntro() {
    if (!intro) { doc.body.classList.add('ready'); return; }
    var seen = false;
    try { seen = !!sessionStorage.getItem(KEY); } catch (e) {}
    if (seen || reduced) { finishIntro(); return; }
    doc.body.classList.add('intro-live');

    var canvas = doc.getElementById('intro-canvas');
    var gl = null, uni = { t: null, r: null, fl: null };
    if (canvas) {
      try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl'); } catch (e) {}
    }
    if (gl) {
      var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
      var FS = [
        'precision highp float;',
        'uniform float t;uniform vec2 r;uniform float fl;',
        'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
        'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
        ' return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}',
        'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}',
        'void main(){',
        ' vec2 uv=(gl_FragCoord.xy-0.5*r)/r.y;',
        ' vec3 col=vec3(0.012,0.02,0.04);',
        ' float skew=0.55;',
        ' float field=fbm(vec2(uv.x+uv.y*skew,uv.y*0.6)*3.0+vec2(t*0.11,0.0));',
        ' field=smoothstep(0.42,0.9,field);',
        ' float topw=smoothstep(-0.55,0.9,uv.y);',
        ' vec3 amber=vec3(0.96,0.63,0.28),ice=vec3(0.55,0.88,0.85);',
        ' float mx=fbm(uv*1.5+t*0.05);',
        ' vec3 lc=mix(ice,amber,smoothstep(-0.5,0.6,uv.x+0.3*mx-0.4));',
        ' col+=lc*field*topw*0.4;',
        ' vec2 c=vec2(0.0,0.03);vec2 dv=uv-c;float d=length(dv);float R=0.235;',
        ' float ins=1.0-smoothstep(R-0.004,R,d);',
        ' vec2 n=dv/max(d,1e-4);float bend=1.0-d/R;',
        ' vec3 disp=vec3(0.0);',
        ' for(int i=0;i<3;i++){',
        '  float o=0.014*(float(i)-1.0);',
        '  vec2 q=vec2(uv.x+uv.y*skew,uv.y*0.6)+n*bend*0.22+vec2(o,0.0);',
        '  float v=smoothstep(0.42,0.9,fbm(q*3.0+vec2(t*0.11,0.0)));',
        '  disp[i]=v*topw;',
        ' }',
        ' vec3 refr=lc*(disp.r*0.55+disp.g*0.9+disp.b*0.75)/1.6;',
        ' col=mix(col,refr*1.15,ins*0.9);',
        ' col+=lc*smoothstep(0.012,0.0,abs(d-R))*0.5*topw;',
        ' col+=lc*smoothstep(0.35,0.0,abs(uv.x))*field*topw*0.12;',
        ' col+=vec3(1.0,0.9,0.8)*fl*0.55*(0.4+0.6*ins);',
        ' float g=h21(gl_FragCoord.xy+fract(t)*13.7)-0.5;col+=g*0.045;',
        ' col*=1.0-0.5*dot(uv,uv);',
        ' gl_FragColor=vec4(col,1.0);',
        '}'
      ].join('\n');
      function sh(type, src) {
        var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl = null; return null; }
        return s;
      }
      var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
      if (v && f) {
        var prog = gl.createProgram();
        gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.useProgram(prog);
          var buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          var loc = gl.getAttribLocation(prog, 'p');
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          uni.t = gl.getUniformLocation(prog, 't');
          uni.r = gl.getUniformLocation(prog, 'r');
          uni.fl = gl.getUniformLocation(prog, 'fl');
        } else { gl = null; }
      } else { gl = null; }
    }
    if (gl) { canvas.style.opacity = ''; }

    var t0 = performance.now(), flash = 0, flashEnd = 0, running = true;
    function frame() {
      if (!running || !intro.isConnected) { running = false; return; }
      if (gl) {
        var dpr = Math.min(devicePixelRatio || 1, 1.5);
        var w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
        var t = (performance.now() - t0) / 1000;
        if (flashEnd) { var k = Math.max(0, (flashEnd - performance.now()) / 850); flash = k * k * (3 - 2 * k); }
        gl.uniform1f(uni.t, t); gl.uniform2f(uni.r, w, h); gl.uniform1f(uni.fl, flash);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    var at = function (ms, cls) {
      setTimeout(function () { if (intro.isConnected) intro.classList.add(cls); }, ms);
    };
    at(400, 's1'); at(1050, 's2');
    setTimeout(function () { if (intro.isConnected) { intro.classList.add('s3'); flashEnd = performance.now() + 850; } }, 2150);
    at(3050, 's4');
    var done = setTimeout(finishIntro, 3950);
    var onSkip = function () {
      if (performance.now() - t0 < 450) return;
      clearTimeout(done); running = false;
      intro.classList.add('skip');
      setTimeout(finishIntro, 520);
      doc.removeEventListener('click', onSkip); doc.removeEventListener('keydown', onSkip);
    };
    doc.addEventListener('click', onSkip);
    doc.addEventListener('keydown', onSkip);
  }
  runIntro();

  /* ---------- page-level bindings, re-runnable after a swap ---------- */
  function initReveals() {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    doc.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  function initMagnets() {
    if (!fine) return;
    doc.querySelectorAll('[data-magnet]').forEach(function (el) {
      if (el._mag) return; el._mag = true;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.24) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  function initModal() {
    var modal = doc.getElementById('detail'), dataEl = doc.getElementById('pieces-data');
    if (!modal || !dataEl || modal._init) return; modal._init = true;
    var pieces = {};
    try { JSON.parse(dataEl.textContent).forEach(function (p) { pieces[p.id] = p; }); } catch (e) {}
    var cardImg = modal.querySelector('img');
    var openPiece = function (id, sourceImg) {
      var p = pieces[id]; if (!p) return;
      var put = function () {
        cardImg.src = p.img; cardImg.alt = p.name;
        modal.querySelector('h3').textContent = p.name;
        modal.querySelector('.dims').textContent = p.dims;
        modal.querySelector('.desc').textContent = p.desc;
        modal.querySelector('.enquire').href = 'contact.html?piece=' + encodeURIComponent(p.name);
        modal.classList.add('open');
        doc.body.style.overflow = 'hidden';
      };
      if (sourceImg && !reduced) {
        try {
          var a = sourceImg.getBoundingClientRect();
          put();
          var b = cardImg.getBoundingClientRect();
          var sx = a.width / b.width, sy = a.height / b.height;
          var dx = (a.left + a.width / 2) - (b.left + b.width / 2);
          var dy = (a.top + a.height / 2) - (b.top + b.height / 2);
          cardImg.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')' },
            { transform: 'none' }
          ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
        } catch (err) {
          if (!modal.classList.contains('open')) put();
        }
      } else { put(); }
    };
    var close = function () { modal.classList.remove('open'); doc.body.style.overflow = ''; };
    doc.querySelectorAll('.piece-card').forEach(function (card) {
      if (card._pc) return; card._pc = true;
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

  function initForm() {
    var form = doc.querySelector('form');
    if (!form || form._init) return; form._init = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = form.querySelector('button');
      b.classList.add('sent'); b.textContent = 'Sent'; b.disabled = true;
      var n = form.querySelector('.form-note');
      if (n) n.textContent = 'Thank you. The studio replies within two days.';
    });
    var p = new URLSearchParams(location.search).get('piece');
    if (p) {
      var t = form.querySelector('textarea');
      if (t && !t.value) t.value = 'I am interested in ' + p + '.';
    }
  }

  function initPage() { initReveals(); initMagnets(); initModal(); initForm(); }
  initPage();

  /* ---------- page swaps: fetch, swap main, light-edge sweep ---------- */
  var net = false;
  function swap(href, isPop) {
    if (net) return; net = true;
    fetch(href).then(function (r) {
      return r.ok ? r.text() : Promise.reject(new Error(String(r.status)));
    }).then(function (html) {
      var dp = new DOMParser().parseFromString(html, 'text/html');
      var apply = function () {
        var newMain = doc.importNode(dp.querySelector('main'), true);
        doc.querySelector('main').replaceWith(newMain);
        var path = href.split('#')[0];
        doc.querySelectorAll('.nav-links a, #menu a').forEach(function (a) {
          var same = a.getAttribute('href').split('#')[0] === path;
          if (same) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
        });
        doc.title = dp.title;
        if (!isPop) { try { history.pushState({ lumen: href }, '', href); } catch (e) {} }
        scrollTo(0, 0);
        net = false;
        initPage();
      };
      var edge = doc.createElement('div'); edge.className = 'light-edge';
      doc.body.appendChild(edge);
      setTimeout(function () { if (edge.isConnected) edge.remove(); }, 1400);
      if (doc.startViewTransition && !reduced) {
        root.classList.add('vt');
        var vt = doc.startViewTransition(apply);
        vt.finished.finally(function () { root.classList.remove('vt'); });
      } else { apply(); }
    }).catch(function () { net = false; location.href = href; });
  }

  doc.addEventListener('click', function (e) {
    if (reduced || !doc.startViewTransition || !window.fetch || net) return;
    var a = e.target.closest('a[href]');
    if (!a || a.target || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return;
    if (!/^[\w\-./]*\.html(\?.*)?$/.test(href)) return;
    if (a.origin && a.origin !== location.origin) return;
    e.preventDefault();
    swap(href);
  });

  addEventListener('popstate', function () {
    var path = location.pathname.split('/').pop() || 'index.html';
    swap(path + location.search, true);
  });
})();
