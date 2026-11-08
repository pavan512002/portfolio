// Subtle scroll-reveal for cards and sections, with per-card stagger.
(function () {
  const els = document.querySelectorAll('.card, .section h2, .page h2, .about-grid, .pipe-step, .gesture, .t-item, .snap');
  els.forEach((el) => {
    el.classList.add('reveal');
    // stagger siblings inside the same parent
    const sibs = Array.from(el.parentElement.children).filter((s) => s.matches('.card, .pipe-step, .gesture, .t-item, .snap'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  els.forEach((el) => {
    el.querySelectorAll('.tags span').forEach((t, n) => t.style.setProperty('--i', n));
    io.observe(el);
  });

  // Nav shadow once the page scrolls.
  const nav = document.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ---------- hero wow: particle net, spotlight, typed roles, HUD sim, tilt, magnetic buttons, progress ----------
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ----- particle network ----- */
  const cv = document.getElementById('net');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, pts = [];
  const mouse = { x: -9999, y: -9999 };
  function sizeNet() {
    const r = hero.getBoundingClientRect();
    W = cv.width = Math.max(1, Math.floor(r.width));
    H = cv.height = Math.max(1, Math.floor(r.height));
    const n = Math.max(24, Math.min(fine ? 95 : 36, Math.floor((W * H) / 21000)));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.7,
    }));
  }
  sizeNet();
  window.addEventListener('resize', sizeNet);
  hero.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
  let netVisible = true, netInView = true;
  document.addEventListener('visibilitychange', () => { netVisible = !document.hidden; });
  new IntersectionObserver((es) => { netInView = es[0].isIntersecting; }).observe(hero);
  (function netLoop() {
    requestAnimationFrame(netLoop);
    if (!netVisible || !netInView) return;
    ctx.clearRect(0, 0, W, H);
    const R = 135;
    for (const p of pts) {
      // gentle mouse attraction
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 32400) { const d = Math.sqrt(d2) || 1; p.vx += (dx / d) * 0.012; p.vy += (dy / d) * 0.012; }
      p.vx *= 0.985; p.vy *= 0.985;
      // keep a minimum drift so it never freezes
      if (Math.abs(p.vx) < 0.08) p.vx += (Math.random() - 0.5) * 0.02;
      if (Math.abs(p.vy) < 0.08) p.vy += (Math.random() - 0.5) * 0.02;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < R) {
          ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - d / R) * 0.28})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (const p of pts) {
      ctx.fillStyle = 'rgba(165, 180, 252, 0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
  })();

  /* ----- mouse spotlight ----- */
  if (fine) {
    const spot = document.getElementById('spot');
    let sx = -600, sy = -600, tx = -600, ty = -600, shown = false;
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { shown = true; spot.style.opacity = '1'; sx = tx; sy = ty; }
    }, { passive: true });
    (function spotLoop() {
      requestAnimationFrame(spotLoop);
      sx += (tx - sx) * 0.08; sy += (ty - sy) * 0.08;
      spot.style.transform = `translate(${sx - 280}px, ${sy - 280}px)`;
    })();
  }

  /* ----- typed roles ----- */
  const typedEl = document.getElementById('typed');
  const roles = ['System Engineer \u00b7 Java @ TCS', 'Robotics tinkerer', 'Deep-learning explorer', 'Chrome-extension builder'];
  let ri = 0, ci = 0, deleting = false;
  (function typeLoop() {
    const word = roles[ri];
    typedEl.textContent = word.slice(0, ci);
    let delay = deleting ? 34 : 62;
    if (!deleting && ci === word.length) { delay = 1700; deleting = true; }
    else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; delay = 350; }
    else ci += deleting ? -1 : 1;
    setTimeout(typeLoop, delay);
  })();

  /* ----- HUD: live log stream ----- */
  const logBox = document.getElementById('hud-log');
  const syncEl = document.getElementById('sync');
  const LOGS = [
    ['ok', 'consumer=java-svc-01 ✓ joined group events-grp'],
    ['', 'topic=in.events ► 42,318 events/sec'],
    ['ok', 'transform ✓ filter + map + format'],
    ['', 'topic=out.events ◄ published 42,310'],
    ['ok', 'cucumber: 17/17 BDD scenarios passing'],
    ['warn', 'lag on partition 7 → rebalanced'],
    ['', 'throughput window: 30–50k events/sec'],
    ['ok', 'checkpoint committed, 0 duplicates'],
  ];
  let li = 0, lastSync = Date.now();
  function stamp() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':');
  }
  function pushLog() {
    const [cls, msg] = LOGS[li % LOGS.length]; li++;
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = `<span class="t">[${stamp()}]</span>${msg}`;
    logBox.appendChild(div);
    while (logBox.children.length > 7) logBox.removeChild(logBox.firstChild);
    lastSync = Date.now();
  }
  pushLog(); pushLog(); pushLog();
  setInterval(pushLog, 1700);
  setInterval(() => {
    const s = Math.floor((Date.now() - lastSync) / 1000);
    syncEl.textContent = s < 3 ? 'just now' : `${s}s ago`;
  }, 1000);

  /* ----- HUD: ticking rows counter ----- */
  const rowsEl = document.getElementById('rows');
  let rows = 4182044;
  setInterval(() => {
    rows += 800 + Math.floor(Math.random() * 3400);
    rowsEl.textContent = rows.toLocaleString('en-US');
  }, 900);

  /* ----- HUD: live sparkline ----- */
  const spark = document.getElementById('spark');
  const sctx = spark.getContext('2d');
  const data = Array.from({ length: 56 }, (_, i) => 50 + Math.sin(i / 5) * 18 + Math.random() * 10);
  function sizeSpark() {
    const r = spark.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    spark.width = Math.max(1, r.width * dpr);
    spark.height = Math.max(1, r.height * dpr);
  }
  sizeSpark();
  window.addEventListener('resize', sizeSpark);
  function drawSpark() {
    const w = spark.width, h = spark.height;
    sctx.clearRect(0, 0, w, h);
    const min = Math.min(...data) - 4, max = Math.max(...data) + 4;
    const X = (i) => (i / (data.length - 1)) * w;
    const Y = (v) => h - ((v - min) / (max - min)) * h * 0.86 - h * 0.07;
    const grad = sctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#6366f1'); grad.addColorStop(1, '#a855f7');
    sctx.beginPath();
    data.forEach((v, i) => (i ? sctx.lineTo(X(i), Y(v)) : sctx.moveTo(X(i), Y(v))));
    sctx.strokeStyle = grad; sctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    sctx.lineJoin = 'round'; sctx.stroke();
    sctx.lineTo(w, h); sctx.lineTo(0, h); sctx.closePath();
    const fill = sctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgba(139, 92, 246, 0.30)'); fill.addColorStop(1, 'rgba(139, 92, 246, 0)');
    sctx.fillStyle = fill; sctx.fill();
  }
  drawSpark();
  setInterval(() => {
    const last = data[data.length - 1];
    data.push(Math.max(8, Math.min(96, last + (Math.random() - 0.48) * 14)));
    data.shift();
    drawSpark();
  }, 550);

  /* ----- hero stat counters ----- */
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const target = +e.target.dataset.count;
      const t0 = performance.now();
      (function tick(t) {
        const k = Math.min(1, (t - t0) / 1300);
        e.target.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => cio.observe(c));

  /* ----- 3D tilt on the HUD ----- */
  if (fine) {
    const hud = document.getElementById('hud');
    const vis = document.querySelector('.hero-visual');
    vis.addEventListener('mousemove', (e) => {
      const r = vis.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      hud.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    });
    vis.addEventListener('mouseleave', () => { hud.style.transform = ''; });
    // pause the float animation while tilting for a cleaner feel
    vis.addEventListener('mouseenter', () => { hud.style.animationPlayState = 'paused'; });
    vis.addEventListener('mouseleave', () => { hud.style.animationPlayState = ''; });
  }

  /* ----- magnetic buttons ----- */
  if (fine) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.14}px, ${y * 0.22}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ----- scroll progress ----- */
  const prog = document.getElementById('progress');
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  }, { passive: true });
})();

// ---------- projects rail: arrows + drag + half-screen pop-out ----------
(function () {
  const rail = document.querySelector('#projects .cards');
  if (!rail) return;
  // keep hover snappy: drop the reveal stagger delay on rail cards
  rail.querySelectorAll('.card').forEach((c) => { c.style.transitionDelay = '0ms'; });

  const cards = Array.from(rail.querySelectorAll('.card'));
  const popCards = cards.concat(Array.from(document.querySelectorAll('#publications .card[data-project]')));
  const railWrap = document.querySelector('#projects .rail-wrap');
  const prev = document.getElementById('railPrev');
  const next = document.getElementById('railNext');
  const step = () => (cards[0] ? cards[0].offsetWidth + 24 : 320);
  function syncArrows() {
    if (!prev || !next) return;
    // arrows only when the cards overflow the screen
    const needs = rail.scrollWidth > rail.clientWidth + 4;
    if (railWrap) railWrap.classList.toggle('no-arrows', !needs);
    const max = rail.scrollWidth - rail.clientWidth - 4;
    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft >= max;
  }
  if (prev) prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
  rail.addEventListener('scroll', syncArrows, { passive: true });
  window.addEventListener('resize', syncArrows);
  syncArrows();

  // drag to slide (desktop mice); a drag never opens the pop-out
  let down = false, startX = 0, startScroll = 0, dragged = false, suppressClick = false;
  rail.addEventListener('pointerdown', (e) => {
    down = true; dragged = false; startX = e.clientX; startScroll = rail.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) > 8) { dragged = true; rail.classList.add('dragging'); }
    if (dragged) rail.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', () => {
    down = false; rail.classList.remove('dragging');
  });
  // the click that follows a drag is swallowed here (capture runs first)
  rail.addEventListener('click', (e) => {
    if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; suppressClick = true; }
  }, true);

  /* ----- half-screen pop-out sheet ----- */
  const PROJECTS = {
    tapcourt: {
      kind: 'Mobile + Web App \u00b7 2026', badge: '<span class="badge live">\u25cf Latest</span>',
      title: 'TapCourt \u2014 Badminton Live Scoring',
      lede: 'Live badminton scoring with a full BWF rules engine \u2014 one Flutter codebase shipping to web, Android and iOS, with real-time score sharing and offline support.',
      tags: ['Flutter', 'Dart', 'Node.js', 'Redis', 'SSE'],
      points: [
        'Complete BWF rules engine \u2014 rally scoring, intervals, game/match point, sudden death, serve tracking and undo.',
        'One Flutter codebase ships the same app to web, Android and iOS.',
        'Every rally mirrors to a Node.js + Redis backend and streams over Server-Sent Events \u2014 a public watch link lets anyone follow live, no account needed.',
        'Offline-first: a persisted retry queue replays every rally in order when the network returns.'
      ],
      ctas: [{ label: 'Open full page \u2192', href: 'projects/tapcourt/', primary: true }]
    },
    gesture: {
      kind: 'Hardware + AI \u00b7 2023', badge: '<span class="badge live">\u25cf Live demo</span>',
      title: 'Gesture-Controlled Robot Car',
      lede: 'Drive a robot car with nothing but your hand. A webcam tracks your fingers with MediaPipe, and each gesture steers the car over Bluetooth.',
      tags: ['Python', 'MediaPipe', 'OpenCV', 'C++', 'Arduino', 'Bluetooth'],
      points: [
        'Webcam hand tracking with MediaPipe \u2014 no wearables, no controllers.',
        '1 finger forward, 2 back, 3 left, 4 right, fist to stop.',
        'Finger counts stream over Bluetooth to an Arduino driving the car motors.',
        'Playable right in the browser \u2014 no hardware needed for the demo.'
      ],
      ctas: [
        { label: 'Try the live demo \u2192', href: 'projects/gesture-car/', primary: true },
        { label: 'Code', href: 'https://github.com/pavan512002/gesture_controlled_robot' }
      ]
    },
    freeslot: {
      kind: 'Chrome Extension \u00b7 2026', badge: '',
      title: 'freeslot',
      lede: '\u201cWhen are you free?\u201d \u2014 answered in one click. A Chrome extension that reads your Google Calendar and finds, shares, and converts available time slots across timezones.',
      tags: ['JavaScript', 'Chrome MV3', 'Google Calendar API', 'Supabase', 'Polar'],
      points: [
        'Four modes: Solo availability, Team overlap, a visual week picker, and a timezone converter.',
        'Missing calendar access is reported, never guessed.',
        'Pro billing via Polar ($24/year or $3.99/month, 7-day free trial) through a Supabase Edge Function.',
        'Solo and Time Convert are free \u2014 400+ timezones with live UTC offsets.'
      ],
      ctas: [
        { label: 'Add to Chrome \u2192', href: 'https://chromewebstore.google.com/detail/freeslot/ifakanacachncobodmfkedilmnplmfbk', primary: true },
        { label: 'Open full page', href: 'projects/freeslot/' }
      ]
    },
    paper: {
      kind: 'Journal paper · 2025', badge: '<span class="badge live">● Published</span>',
      title: 'Multilingual Sentiment Analysis',
      lede: 'A language-agnostic sentiment analysis system for Hindi, Telugu and English web text, with emoji-aware emotion modeling.',
      tags: ['NLP', 'Sentiment Analysis', 'Machine Learning', 'Multilingual'],
      points: [
        'Works across Hindi, Telugu and English text instead of needing one model per language.',
        'Emoji-aware emotion modeling, so the emoji people use are read as signal.',
        'Trained on data scraped from social media, news platforms and customer reviews.',
        'Published in the Journal of Current Research in Engineering and Science, Vol. 8, Issue 2, August 2025.'
      ],
      ctas: [
        { label: 'Read the paper →', href: 'https://www.psvpec.in/jcres/2025_2/18.pdf', primary: true },
        { label: 'Journal page', href: 'https://www.psvpec.in/jcres/2025_2.html' }
      ]
    },
    skin: {
      kind: 'Deep Learning \u00b7 2023', badge: '',
      title: 'Skin Cancer Detection',
      lede: 'A deep learning system that classifies skin lesion images \u2014 built on transfer learning with a MobileNetV2 backbone, tuned for accuracy across multiple lesion classes.',
      tags: ['Python', 'TensorFlow', 'MobileNetV2', 'OpenCV', 'CNN'],
      points: [
        'MobileNetV2 transfer-learning backbone trained on an augmented lesion dataset.',
        'Custom dense and dropout layers stacked as the classification head.',
        'OpenCV preprocessing pipeline \u2014 resizing, normalization, augmentation.',
        'Dropout regularization keeps multi-class predictions robust without overfitting.'
      ],
      ctas: [{ label: 'Open full page \u2192', href: 'projects/skin-cancer/', primary: true }]
    }
  };

  const overlay = document.getElementById('projectModal');
  const body = document.getElementById('modalBody');
  const closeBtn = document.getElementById('modalClose');
  if (!overlay || !body) return;

  const esc = (t) => t;
  const BUSY = [1, 2, 8, 9, 10, 15, 16, 17, 22, 23, 24, 25, 29, 30];
  function preview(key) {
    if (key === 'tapcourt') return '<div class="pv pv-score"><div class="team"><small>Player A</small><b class="n a"></b></div><div class="vs"><i></i>LIVE</div><div class="team"><small>Player B</small><b class="n b"></b></div></div>';
    if (key === 'gesture') return '<div class="pv pv-gest"><span><b>1</b>FWD</span><span><b>2</b>BACK</span><span><b>3</b>LEFT</span><span><b>4</b>RIGHT</span><span><b>0</b>STOP</span></div>';
    if (key === 'freeslot') {
      let cells = '', k = 0;
      for (let i = 0; i < 35; i++) cells += BUSY.indexOf(i) > -1 ? '<i class="b"></i>' : '<i class="f" style="--k:' + (k++) + '"></i>';
      return '<div class="pv pv-week">' + cells + '</div>';
    }
    if (key === 'paper') return '<div class="pv pv-sent">' +
      '<div class="row" style="--p:90%"><small>EN</small><span>Loved the service, will use again!</span><div class="meter"><i></i></div></div>' +
      '<div class="row" style="--p:10%;--d:1.3s"><small>HI</small><span>बिल्कुल बेकार</span><div class="meter"><i></i></div></div>' +
      '<div class="row" style="--p:52%;--d:2.6s"><small>TE</small><span>పర్వాలేదు</span><div class="meter"><i></i></div></div></div>';
    if (key === 'skin') return '<div class="pv pv-scan"><div class="lens"><u></u></div><div class="bars"><i style="--w:88%"></i><i style="--w:31%"></i><i style="--w:14%"></i></div></div>';
    return '';
  }
  function detailHTML(p, key) {
    return preview(key) + '<div class="modal-kind">' + (p.badge ? p.badge + ' ' : '') + esc(p.kind) + '</div>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p class="modal-lede">' + esc(p.lede) + '</p>' +
      '<div class="tags">' + p.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>' +
      '<ul class="modal-points">' + p.points.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<div class="modal-ctas">' + p.ctas.map((c) =>
        '<a href="' + c.href + '"' + (c.href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') +
        ' class="btn ' + (c.primary ? 'primary' : 'ghost') + '">' + esc(c.label) + '</a>'
      ).join('') + '</div>';
  }
  function openModal(key) {
    const p = PROJECTS[key];
    if (!p) return;
    body.innerHTML = detailHTML(p, key).replace('<h3>', '<h3 id="modalTitle">');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }
  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ----- hover (mouse only): the card itself grows, in place, into the detail panel ----- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.setAttribute('aria-hidden', 'true');
    pop.innerHTML = '<div class="pop-from card"></div><div class="pop-to"></div>';
    document.body.appendChild(pop);
    const fromEl = pop.firstChild, toEl = pop.lastChild;
    const M = 16;
    let cur = null, openT = 0, closeT = 0, endT = 0;

    const setRect = (l, t, w, h) => {
      pop.style.left = l + 'px'; pop.style.top = t + 'px';
      pop.style.width = w + 'px'; pop.style.height = h + 'px';
    };
    function finishHide() {
      pop.style.display = 'none';
      if (cur) { cur.classList.remove('is-popped'); cur.parentElement.classList.remove('pop-on'); }
      cur = null;
    }
    function hide(instant) {
      clearTimeout(openT); clearTimeout(closeT); clearTimeout(endT);
      if (!cur) return;
      if (instant) { pop.classList.remove('on'); finishHide(); return; }
      const cr = cur.getBoundingClientRect();
      pop.classList.remove('on');
      setRect(cr.left, cr.top, cr.width, cr.height);
      cur.classList.remove('is-popped');
      cur.parentElement.classList.remove('pop-on');
      endT = setTimeout(finishHide, 380);
    }
    function show(card) {
      const p = PROJECTS[card.dataset.project];
      if (!p) return;
      clearTimeout(endT);
      const cr = card.getBoundingClientRect();
      cur = card;
      fromEl.innerHTML = card.innerHTML;
      fromEl.style.width = cr.width + 'px'; fromEl.style.height = cr.height + 'px';
      toEl.innerHTML = detailHTML(p, card.dataset.project);
      // measure the expanded size
      const W = Math.min(Math.max(cr.width * 1.3, 560), Math.max(cr.width, 760), window.innerWidth - 2 * M);
      pop.classList.remove('on');
      pop.style.transition = 'none';
      pop.style.display = 'flex';
      setRect(cr.left, cr.top, W, 0);
      pop.style.height = 'auto';
      const H = Math.min(pop.offsetHeight, window.innerHeight - 2 * M);
      // start exactly on the card
      setRect(cr.left, cr.top, cr.width, cr.height);
      void pop.offsetWidth;
      // grow around the card's centre, kept on screen
      let l = cr.left + cr.width / 2 - W / 2, t = cr.top + cr.height / 2 - H / 2;
      l = Math.max(M, Math.min(l, window.innerWidth - W - M));
      t = Math.max(M, Math.min(t, window.innerHeight - H - M));
      pop.style.transition = '';
      pop.classList.add('on');
      setRect(l, t, W, H);
      card.classList.add('is-popped');
      card.parentElement.classList.add('pop-on');
    }
    const maybeClose = () => {
      clearTimeout(openT); clearTimeout(closeT);
      closeT = setTimeout(() => {
        if (pop.matches(':hover') || (cur && cur.matches(':hover'))) return;
        hide(false);
      }, 260);
    };
    popCards.forEach((card) => {
      card.addEventListener('pointerenter', () => {
        if (card.parentElement.classList.contains('dragging')) return;
        clearTimeout(closeT); clearTimeout(openT);
        if (cur === card) return;
        const swap = !!cur;
        if (swap) hide(true);
        openT = setTimeout(() => show(card), swap ? 40 : 140);
      });
      card.addEventListener('pointerleave', maybeClose);
    });
    pop.addEventListener('pointerenter', () => clearTimeout(closeT));
    pop.addEventListener('pointerleave', maybeClose);
    window.addEventListener('scroll', () => hide(true), { passive: true });
    rail.addEventListener('scroll', () => hide(true), { passive: true });
    window.addEventListener('resize', () => hide(true));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(false); });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // click a card (or its Learn more button) -> pop out the half-screen sheet
  popCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest('[data-open-modal]')) { e.preventDefault(); openModal(card.dataset.project); return; }
      if (e.target.closest('a, button')) return;
      openModal(card.dataset.project);
    });
  });
})();

// ---------- motion pass: cursor glow on cards + nav scroll-spy ----------
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('#projects .card').forEach((c) => {
      const sh = document.createElement('span');
      sh.className = 'sheen'; sh.setAttribute('aria-hidden', 'true');
      c.appendChild(sh);
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (card.closest('#projects')) {
        card.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
      }
    }, { passive: true });
  }
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.remove('active'));
      const a = byId.get(e.target.id);
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const sec = document.getElementById(id); if (sec) spy.observe(sec); });
})();
