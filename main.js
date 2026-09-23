// Subtle scroll-reveal for cards and sections, with per-card stagger.
(function () {
  const els = document.querySelectorAll('.card, .section h2, .about-grid, .pipe-step, .gesture');
  els.forEach((el) => {
    el.classList.add('reveal');
    // stagger siblings inside the same parent
    const sibs = Array.from(el.parentElement.children).filter((s) => s.matches('.card, .pipe-step, .gesture'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = `${Math.min(i, 4) * 90}ms`;
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));

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
  const roles = ['Big Data Engineer @ TCS', 'Robotics tinkerer', 'Deep-learning explorer', 'Chrome-extension builder'];
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
    ['ok', 'stage=bronze ✓ 1,204,553 rows validated'],
    ['', 'stage=silver ► dedup + schema evolution'],
    ['ok', 'partition dt=2026-09-23 committed'],
    ['', 'unix watchdog: 0 errors, checksums match'],
    ['warn', 'skew on key=user_id → auto-rebalanced'],
    ['ok', 'stage=gold ✓ dashboard mart refreshed'],
    ['', 'notify: monthly report delivered ✓'],
    ['ok', 'compaction done: 14 files → 3, 61% smaller'],
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
