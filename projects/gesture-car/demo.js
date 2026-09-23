// Interactive gesture-car demo.
// Webcam -> MediaPipe HandLandmarker -> finger count -> car command,
// using the same gesture map as the real robot (car.ino):
//   1 = forward, 2 = backward, 3 = left, 4 = right, 0/5 = stop.
// Everything runs locally in the browser; no video leaves the device.

import {
  HandLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const video = document.getElementById('cam');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const track = document.getElementById('track');
const tctx = track.getContext('2d');
const camBtn = document.getElementById('cam-btn');
const camWrap = document.querySelector('.cam-wrap');
const camError = document.getElementById('cam-error');
const hudCount = document.getElementById('hud-count');
const hudCmd = document.getElementById('hud-cmd');

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// ---- state ---------------------------------------------------------------
let landmarker = null;
let live = false;
let cameraOn = false;
let stream = null;
let lastVideoTime = -1;
let gestureCmd = 'stop';
let keyCmd = null;
let lastHandTime = 0;
// holdStop: stays on after the Stop button until the hand leaves the frame,
// so a still-raised hand can't instantly re-trigger the car.
let holdStop = false;
const recentCounts = [];

// ---- car -----------------------------------------------------------------
const car = { x: 320, y: 210, angle: -Math.PI / 2, speed: 0 };
const MAX_FWD = 240, MAX_REV = -150, TURN_RATE = 3.0;
let lastT = performance.now();

function countToCmd(n) {
  return n === 1 ? 'forward'
    : n === 2 ? 'backward'
    : n === 3 ? 'left'
    : n === 4 ? 'right'
    : 'stop';
}

// Thumb is "up" when its tip is clearly farther from the wrist than its
// middle joint — no left/right guess needed, so a fist can never
// misread as "1 finger = forward".
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function countFingers(lm) {
  let n = 0;
  if (dist(lm[4], lm[0]) > dist(lm[3], lm[0]) * 1.2) n++;
  for (const t of [8, 12, 16, 20]) {
    if (lm[t].y < lm[t - 2].y) n++;
  }
  return n;
}

function pushCount(c) {
  recentCounts.push(c);
  if (recentCounts.length > 8) recentCounts.shift();
  const freq = {};
  for (const x of recentCounts) freq[x] = (freq[x] || 0) + 1;
  let best = recentCounts[recentCounts.length - 1], bestN = 0;
  for (const k in freq) {
    if (freq[k] > bestN) { bestN = freq[k]; best = Number(k); }
  }
  // Only switch when the reading is stable — kills flicker.
  if (bestN >= 5) gestureCmd = countToCmd(best);
}

function effectiveCmd(now) {
  if (keyCmd) return keyCmd;
  if (holdStop) return 'stop'; // Stop button holds until the hand leaves
  if (now - lastHandTime > 700) return 'stop'; // lost the hand -> stop
  return gestureCmd;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTrack() {
  tctx.clearRect(0, 0, 640, 420);
  // subtle asphalt grid
  tctx.strokeStyle = 'rgba(255,255,255,0.045)';
  tctx.lineWidth = 1;
  for (let x = 0; x <= 640; x += 40) {
    tctx.beginPath(); tctx.moveTo(x, 0); tctx.lineTo(x, 420); tctx.stroke();
  }
  for (let y = 0; y <= 420; y += 40) {
    tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(640, y); tctx.stroke();
  }
  // center dashes
  tctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
  tctx.lineWidth = 3;
  tctx.setLineDash([18, 22]);
  tctx.beginPath(); tctx.moveTo(0, 210); tctx.lineTo(640, 210); tctx.stroke();
  tctx.setLineDash([]);
}

function drawCar() {
  tctx.save();
  tctx.translate(car.x, car.y);
  tctx.rotate(car.angle);

  // shadow
  tctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(tctx, -22, -11, 46, 26, 9); tctx.fill();

  // wheels
  tctx.fillStyle = '#0c0c12';
  rr(tctx, -17, -17, 11, 6, 2); tctx.fill();
  rr(tctx, -17, 11, 11, 6, 2); tctx.fill();
  rr(tctx, 7, -17, 11, 6, 2); tctx.fill();
  rr(tctx, 7, 11, 11, 6, 2); tctx.fill();

  // body
  const g = tctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, '#818cf8');
  g.addColorStop(1, '#4f46e5');
  tctx.fillStyle = g;
  rr(tctx, -23, -13, 46, 26, 9); tctx.fill();

  // cabin
  tctx.fillStyle = 'rgba(10,10,18,0.85)';
  rr(tctx, -6, -9, 16, 18, 5); tctx.fill();

  // headlights
  tctx.fillStyle = '#fef9c3';
  tctx.beginPath(); tctx.arc(23, -7, 2.6, 0, 7); tctx.fill();
  tctx.beginPath(); tctx.arc(23, 7, 2.6, 0, 7); tctx.fill();

  // motion streaks when fast
  const v = Math.abs(car.speed);
  if (v > 120) {
    tctx.strokeStyle = `rgba(129,140,248,${Math.min(0.5, v / 600)})`;
    tctx.lineWidth = 3;
    for (const yy of [-8, 0, 8]) {
      tctx.beginPath();
      tctx.moveTo(-26, yy);
      tctx.lineTo(-26 - v * 0.12, yy);
      tctx.stroke();
    }
  }
  tctx.restore();
}

function updateCar(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const cmd = effectiveCmd(now);

  let target = 0, turn = 0;
  if (cmd === 'forward') target = MAX_FWD;
  else if (cmd === 'backward') target = MAX_REV;
  else if (cmd === 'left') { turn = -TURN_RATE; target = 80; }
  else if (cmd === 'right') { turn = TURN_RATE; target = 80; }

  car.speed += (target - car.speed) * Math.min(1, dt * 5);
  car.angle += turn * dt * (0.35 + Math.min(1, Math.abs(car.speed) / MAX_FWD));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // open world: no walls — the car wraps around instead of stopping
  const m = 40;
  if (car.x < -m) car.x += 640 + 2 * m;
  else if (car.x > 640 + m) car.x -= 640 + 2 * m;
  if (car.y < -m) car.y += 420 + 2 * m;
  else if (car.y > 420 + m) car.y -= 420 + 2 * m;

  drawTrack();
  drawCar();

  // HUD
  const label = cmd === 'stop' ? 'stop' : cmd;
  if (hudCmd.textContent !== label) {
    hudCmd.textContent = label;
    hudCmd.classList.remove('pulse');
    void hudCmd.offsetWidth; // restart the animation
    hudCmd.classList.add('pulse');
  }
  hudCmd.classList.toggle('go', cmd !== 'stop');
}

// ---- hand overlay ---------------------------------------------------------
function drawOverlay(landmarks) {
  const w = overlay.width, h = overlay.height;
  octx.clearRect(0, 0, w, h);
  if (!landmarks) return;
  octx.lineWidth = 2.5;
  octx.strokeStyle = '#22c55e';
  octx.fillStyle = '#a7f3d0';
  octx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    octx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    octx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
  }
  octx.stroke();
  for (const p of landmarks) {
    octx.beginPath();
    octx.arc(p.x * w, p.y * h, 4, 0, 7);
    octx.fill();
  }
}

// ---- main loop ------------------------------------------------------------
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  if (live) updateCar(now);
  if (!landmarker || !cameraOn || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const res = landmarker.detectForVideo(video, now);
  const lm = res.landmarks && res.landmarks[0];
  if (lm) {
    lastHandTime = now;
    const c = countFingers(lm);
    hudCount.textContent = c;
    if (!holdStop) pushCount(c); // still show the count, but don't steer while stopped
    drawOverlay(lm);
  } else {
    holdStop = false; // hand left the frame -> new gestures allowed again
    drawOverlay(null);
  }
}

// ---- camera ---------------------------------------------------------------
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
    if (!window.isSecureContext) {
      throw new Error('Camera needs HTTPS (or localhost). This page should be served over HTTPS.');
    }
    if (!landmarker) await initLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    camWrap.classList.add('live');
    cameraOn = true;
    camStopBtn.hidden = false;
    live = true;
    lastHandTime = performance.now();
    hudCmd.textContent = 'show your hand';
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    camError.textContent =
      e.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow access and try again — or use the arrow keys.'
        : `Could not start the camera: ${e.message || e.name}. You can still drive with the arrow keys.`;
    camError.hidden = false;
    camBtn.disabled = false;
    camBtn.textContent = 'Enable camera';
    // Keyboard fallback still works without a camera.
    live = true;
    requestAnimationFrame(loop);
  }
});

// ---- stop camera ----------------------------------------------------------
const camStopBtn = document.getElementById('cam-stop');
camStopBtn.addEventListener('click', () => {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  cameraOn = false;
  holdStop = false;
  gestureCmd = 'stop';
  recentCounts.length = 0;
  camWrap.classList.remove('live');
  camBtn.disabled = false;
  camBtn.textContent = 'Enable camera';
  camStopBtn.hidden = true;
  hudCount.textContent = '–';
  hudCmd.textContent = 'camera off';
  hudCmd.classList.remove('go');
  drawOverlay(null);
});

// ---- stop car -------------------------------------------------------------
const stopBtn = document.getElementById('stop-btn');
stopBtn.addEventListener('click', () => {
  recentCounts.length = 0;
  gestureCmd = 'stop';
  keyCmd = null;
  car.speed = 0;
  holdStop = true; // stays stopped until the hand leaves the frame
  hudCount.textContent = '–';
  hudCmd.textContent = 'stop';
  hudCmd.classList.remove('go');
});

// ---- keyboard fallback -----------------------------------------------------
const KEYMAP = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'backward', KeyS: 'backward',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keyCmd = KEYMAP[e.code]; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] && keyCmd === KEYMAP[e.code]) keyCmd = null;
});

// Idle attract: render the track behind the demo before the camera starts.
drawTrack();
drawCar();
