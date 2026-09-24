// Dodge Run — gesture/keyboard/touch obstacle-dodging game.
// Dodge the falling barriers for as long as you can. Score = survival time.
// Gestures (same map as the robot): 3 fingers = left, 4 fingers = right,
// fist/anything else = stop. Arrow keys / A,D and on-screen buttons work too.
// Everything runs locally; the camera is optional.

import {
  HandLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// ---------- DOM ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const overlay = document.getElementById('game-overlay');
const hudTime = document.getElementById('hud-time');
const hudDodged = document.getElementById('hud-dodged');
const hudBest = document.getElementById('hud-best');
const startBtn = document.getElementById('start-btn');
const camBtn = document.getElementById('cam-btn');
const camStopBtn = document.getElementById('cam-stop');
const camError = document.getElementById('cam-error');
const camMini = document.getElementById('cam-mini');
const video = document.getElementById('cam');
const handCv = document.getElementById('hand-overlay');
const hctx = handCv.getContext('2d');
const touchL = document.getElementById('touch-left');
const touchR = document.getElementById('touch-right');

// ---------- helpers ----------
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---------- tiny sound effects (WebAudio, no assets) ----------
let audio = null;
function beep(freq, dur, type = 'sine', vol = 0.08) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch (e) { /* audio is decoration — never break the game */ }
}

// ---------- game state ----------
let state = 'idle'; // idle | countdown | playing | dying | over
const car = { x: W / 2, y: H - 64, vx: 0 };
const CAR_W = 46, CAR_H = 26;
let obstacles = [];
let particles = [];
let survived = 0, dodged = 0;
let spawnT = 0, countT = 0, countN = 3, dieT = 0;
let best = parseFloat(localStorage.getItem('dodgeRunBest') || '0');
let keyDir = 0, touchDir = 0, gestDir = 0;
let lastT = performance.now();

// ---------- input ----------
function inputDir() { return keyDir || touchDir || gestDir; }

const KEYMAP = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) { keyDir = KEYMAP[e.code]; e.preventDefault(); }
  if ((e.code === 'Space' || e.code === 'Enter') && (state === 'idle' || state === 'over')) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined && keyDir === KEYMAP[e.code]) keyDir = 0;
});
function bindTouch(btn, dir) {
  const on = (e) => { e.preventDefault(); touchDir = dir; };
  const off = (e) => { e.preventDefault(); if (touchDir === dir) touchDir = 0; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
}
bindTouch(touchL, -1);
bindTouch(touchR, 1);

// ---------- gestures ----------
let landmarker = null, cameraOn = false, stream = null;
let lastVideoTime = -1, lastDetectTime = 0;
const DETECT_INTERVAL = 50;
const recentCounts = [];
let lastHandTime = 0;

function countFingers(lm) {
  let n = 0;
  if (dist(lm[4], lm[0]) > dist(lm[3], lm[0]) * 1.2) n++;
  for (const t of [8, 12, 16, 20]) if (lm[t].y < lm[t - 2].y) n++;
  return n;
}
function pushCount(c) {
  recentCounts.push(c);
  if (recentCounts.length > 8) recentCounts.shift();
  const freq = {};
  for (const x of recentCounts) freq[x] = (freq[x] || 0) + 1;
  let b = recentCounts[recentCounts.length - 1], bn = 0;
  for (const k in freq) if (freq[k] > bn) { bn = freq[k]; b = Number(k); }
  if (bn >= 5) gestDir = b === 3 ? -1 : b === 4 ? 1 : 0;
}
function drawHand(lm) {
  const w = handCv.width, h = handCv.height;
  hctx.clearRect(0, 0, w, h);
  if (!lm) return;
  hctx.strokeStyle = '#22c55e'; hctx.lineWidth = 2;
  hctx.fillStyle = '#a7f3d0';
  for (const [a, b] of HAND_CONNECTIONS) {
    hctx.beginPath();
    hctx.moveTo(lm[a].x * w, lm[a].y * h);
    hctx.lineTo(lm[b].x * w, lm[b].y * h);
    hctx.stroke();
  }
  for (const p of lm) {
    hctx.beginPath(); hctx.arc(p.x * w, p.y * h, 3, 0, 7); hctx.fill();
  }
}
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
function detectHands(now) {
  if (!landmarker || !cameraOn || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  if (now - lastDetectTime < DETECT_INTERVAL) return;
  lastDetectTime = now;
  const res = landmarker.detectForVideo(video, now);
  const lm = res.landmarks && res.landmarks[0];
  if (lm) {
    lastHandTime = now;
    pushCount(countFingers(lm));
    drawHand(lm);
  } else {
    if (now - lastHandTime > 700) gestDir = 0; // lost the hand -> stop
    drawHand(null);
  }
}
async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
  });
}
camBtn.addEventListener('click', async () => {
  camBtn.disabled = true;
  camBtn.textContent = 'Loading hand tracking…';
  camError.hidden = true;
  try {
    if (!window.isSecureContext) throw new Error('Camera needs HTTPS (or localhost).');
    if (!landmarker) await initLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });
    video.srcObject = stream;
    await video.play();
    handCv.width = video.videoWidth || 640;
    handCv.height = video.videoHeight || 480;
    cameraOn = true;
    camMini.hidden = false;
    camStopBtn.hidden = false;
    camBtn.textContent = 'Camera on ✓';
  } catch (e) {
    console.error(e);
    camError.textContent = e.name === 'NotAllowedError'
      ? 'Camera permission denied — no problem, drive with arrow keys, touch buttons, or gestures off.'
      : `Could not start the camera: ${e.message || e.name}. Arrow keys and touch buttons still work.`;
    camError.hidden = false;
    camBtn.disabled = false;
    camBtn.textContent = 'Enable camera (optional)';
  }
});
camStopBtn.addEventListener('click', () => {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  video.srcObject = null;
  cameraOn = false;
  gestDir = 0;
  recentCounts.length = 0;
  drawHand(null);
  camMini.hidden = true;
  camStopBtn.hidden = true;
  camBtn.disabled = false;
  camBtn.textContent = 'Enable camera (optional)';
});

// ---------- game logic ----------
function resetGame() {
  obstacles = [];
  particles = [];
  survived = 0; dodged = 0;
  spawnT = 0.6;
  car.x = W / 2; car.vx = 0;
  keyDir = 0; touchDir = 0; gestDir = 0;
  recentCounts.length = 0;
}
function startGame() {
  try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  resetGame();
  state = 'countdown';
  countN = 3; countT = 0;
  renderOverlay();
}
function spawnObstacle(baseSpeed) {
  const w = 44 + Math.random() * 66;
  const h = 26 + Math.random() * 14;
  obstacles.push({
    x: 30 + Math.random() * (W - 60 - w),
    y: -h - 10,
    w, h,
    speed: baseSpeed * (0.9 + Math.random() * 0.25),
    hue: Math.random() < 0.5,
  });
}
function crash() {
  state = 'dying';
  dieT = 0;
  beep(110, 0.35, 'sawtooth', 0.12);
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
    particles.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
      life: 0.7 + Math.random() * 0.5, age: 0,
      c: ['#818cf8', '#f472b6', '#facc15', '#f87171'][i % 4],
    });
  }
}
function update(dt) {
  if (state === 'countdown') {
    countT += dt;
    if (countT >= 0.75) {
      countT = 0;
      if (countN > 1) { countN--; beep(660, 0.09); }
      else { state = 'playing'; beep(880, 0.18); overlay.hidden = true; }
      renderOverlay();
    }
    return;
  }
  if (state === 'dying') {
    dieT += dt;
    updateParticles(dt);
    if (dieT >= 1.0) {
      state = 'over';
      const isBest = survived > best;
      if (isBest) {
        best = survived;
        localStorage.setItem('dodgeRunBest', String(best));
      }
      hudBest.textContent = best.toFixed(1) + 's';
      renderOverlay(isBest);
    }
    return;
  }
  if (state !== 'playing') { updateParticles(dt); return; }

  survived += dt;
  const dir = inputDir();
  const target = dir * 430;
  car.vx += (target - car.vx) * Math.min(1, dt * 10);
  car.x += car.vx * dt;
  car.x = Math.max(28, Math.min(W - 28, car.x));

  const baseSpeed = Math.min(560, 190 + survived * 9);
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnObstacle(baseSpeed);
    spawnT = Math.max(0.32, 0.95 - survived * 0.012) * (0.7 + Math.random() * 0.6);
  }
  const cx = car.x - 19, cy = car.y - 10, cw = 38, ch = 20;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += o.speed * dt;
    if (o.y > H + 40) { obstacles.splice(i, 1); dodged++; continue; }
    // forgiving hitboxes (shrunk ~12%)
    if (cx < o.x + o.w * 0.88 && cx + cw > o.x + o.w * 0.12 &&
        cy < o.y + o.h * 0.88 && cy + ch > o.y + o.h * 0.12) {
      crash();
      return;
    }
  }
  updateParticles(dt);
  hudTime.textContent = survived.toFixed(1) + 's';
  hudDodged.textContent = dodged;
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.vy += 500 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

// ---------- rendering ----------
function drawRoad() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // neon side rails
  for (const x of [8, W - 8]) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(99,102,241,0)');
    g.addColorStop(0.5, 'rgba(99,102,241,0.5)');
    g.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
}
function drawCarShape() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(-Math.PI / 2 + car.vx * 0.00045); // lean into turns
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -22, -11, 46, 26, 9); ctx.fill();
  ctx.fillStyle = '#0c0c12';
  rr(ctx, -17, -17, 11, 6, 2); ctx.fill();
  rr(ctx, -17, 11, 11, 6, 2); ctx.fill();
  rr(ctx, 7, -17, 11, 6, 2); ctx.fill();
  rr(ctx, 7, 11, 11, 6, 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, '#818cf8'); g.addColorStop(1, '#4f46e5');
  ctx.fillStyle = g;
  rr(ctx, -23, -13, 46, 26, 9); ctx.fill();
  ctx.fillStyle = 'rgba(10,10,18,0.85)';
  rr(ctx, -6, -9, 16, 18, 5); ctx.fill();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath(); ctx.arc(23, -7, 2.6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(23, 7, 2.6, 0, 7); ctx.fill();
  ctx.restore();
}
function drawObstacles() {
  for (const o of obstacles) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = o.hue ? 'rgba(248,113,113,0.8)' : 'rgba(251,146,60,0.8)';
    const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
    if (o.hue) { g.addColorStop(0, '#f87171'); g.addColorStop(1, '#b91c1c'); }
    else { g.addColorStop(0, '#fb923c'); g.addColorStop(1, '#c2410c'); }
    ctx.fillStyle = g;
    rr(ctx, o.x, o.y, o.w, o.h, 8); ctx.fill();
    ctx.shadowBlur = 0;
    // hazard stripes
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let sx = o.x + 8; sx < o.x + o.w - 6; sx += 18) {
      ctx.save();
      ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
      ctx.translate(sx, o.y); ctx.rotate(0.5);
      ctx.fillRect(0, -6, 8, o.h + 12);
      ctx.restore();
    }
    ctx.restore();
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function render() {
  drawRoad();
  drawObstacles();
  if (state !== 'dying' && state !== 'over') drawCarShape();
  drawParticles();
}

// ---------- overlay screens ----------
function renderOverlay(isBest = false) {
  if (state === 'idle') {
    overlay.hidden = false;
    overlay.innerHTML = `
      <h3>🎮 Dodge Run</h3>
      <p>Barriers rain from the top. Dodge them with your hand, keys, or thumbs —<br>
      <b>your score is how many seconds you survive.</b></p>
      <div class="go-controls">
        <span>🤟 3 fingers · left</span><span>🖖 4 fingers · right</span>
        <span>✊ fist · stop</span><span>⌨️ ← → / A D</span>
      </div>
      <button class="btn primary big" id="ov-start">Start game</button>
      <p class="fine">Best so far: ${best.toFixed(1)}s</p>`;
    document.getElementById('ov-start').addEventListener('click', startGame);
  } else if (state === 'countdown') {
    overlay.hidden = false;
    overlay.innerHTML = `<div class="count">${countN}</div>`;
  } else if (state === 'over') {
    overlay.hidden = false;
    overlay.innerHTML = `
      <h3>💥 Crashed!</h3>
      <div class="final-score">${survived.toFixed(1)}<span>s survived</span></div>
      ${isBest ? '<div class="new-best">🏆 New best!</div>' : ''}
      <p>Obstacles dodged: <b>${dodged}</b> · Best: <b>${best.toFixed(1)}s</b></p>
      <button class="btn primary big" id="ov-again">Play again</button>
      <p class="fine">Tip: small, early moves beat big panicked ones.</p>`;
    document.getElementById('ov-again').addEventListener('click', startGame);
  }
}
startBtn.addEventListener('click', startGame);

// ---------- main loop (single rAF — game + throttled hand tracking) ----------
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  detectHands(now);
  update(dt);
  render();
}

// ---------- init ----------
hudBest.textContent = best.toFixed(1) + 's';
renderOverlay();
drawRoad();
drawCarShape();
requestAnimationFrame(tick);
