/* Sonico Runner — single-file loop + events
   Fixes:
   1) Transparent canvas (no box), 2) GIF animates (DOM layer),
   3) Mobile layout + Start/Jump button, 4) Clouds are back,
   5) Taller canvas + better jump, 6) Raise clouds & birds,
   7) Birds/clouds don't collide.
*/

(function () {
  'use strict';

  // --------- Helpers
  const $ = (sel) => document.querySelector(sel);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // --------- Canvas + sizing
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');

  // Base design units (we’ll scale to device width)
  const BASE = { WIDTH: 900, HEIGHT: 260 }; // taller than stock so jumps feel good

  function sizeCanvas() {
    // Fill width, cap at 1000; keep aspect, but allow a bit taller on phones
    const maxW = Math.min(1000, window.innerWidth);
    const phoneBonus = isTouch ? 40 : 0;
    const h = Math.round((BASE.HEIGHT + phoneBonus) * (maxW / BASE.WIDTH));
    canvas.width = maxW;
    canvas.height = h;
    // Runner layer uses same size to position GIFs
    const layer = $('#runnerLayer');
    layer.style.width = maxW + 'px';
    layer.style.height = h + 'px';
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  // --------- UI text / mobile button
  const hint = $('#desktopHint');
  const mobileBtn = $('#mobileBtn');
  if (isTouch) mobileBtn.style.display = 'inline-block';
  else hint.style.display = 'block';

  // --------- Assets
  const IMG = {
    floor: $('#img-floor'),
    cloud: $('#img-cloud'),
    bird: [$('#img-bird1'), $('#img-bird2')],
    martini: [$('#img-m1'), $('#img-m2'), $('#img-m3'), $('#img-m4')],
    palm: [$('#img-p1'), $('#img-p2'), $('#img-p3'), $('#img-p4')],
    gameover: $('#img-gameover'),
    restart: $('#img-restart')
  };

  // --------- Runner (DOM sprites so the GIF actually animates)
  const runnerIdle = $('#runnerIdle');
  const runnerRun  = $('#runnerRun');

  const RUNNER = {
    x: 50,                   // will be scaled each frame
    y: 0,
    w: 78, h: 88,            // natural PNG/GIF size
    vy: 0,
    onGround: true,
    gravity: 0.75,
    jumpVel: -16,            // stronger jump for taller canvas
    speedDrop: false,
    setPos(x, y) {
      // position sprites in the runner layer
      const t = `translate(${x}px, ${y}px)`;
      runnerIdle.style.transform = t;
      runnerRun.style.transform = t;
    },
    showIdle() { runnerIdle.style.display = 'block'; runnerRun.style.display = 'none'; },
    showRun()  { runnerIdle.style.display = 'none';  runnerRun.style.display = 'block'; }
  };

  // --------- World state
  const state = {
    playing: false,
    crashed: false,
    speed: 6,
    frameTime: 1000 / 60,
    t: performance.now(),
    dist: 0,
    clouds: [],
    birds: [],
    obstacles: [],
    gameOverFlash: 0
  };

  // Y “rails”
  function groundY() { return canvas.height - 24; } // leave a little margin
  function runnerYBase() { return groundY() - RUNNER.h; }

  // --------- Spawners
  function spawnCloud() {
    const y = Math.round(canvas.height * (0.18 + Math.random() * 0.10)); // higher in sky
    state.clouds.push({
      x: canvas.width + Math.random() * 200,
      y,
      speed: 0.3 + Math.random() * 0.3
    });
  }

  function spawnBird() {
    const y = Math.round(canvas.height * (0.35 + Math.random() * 0.08)); // above runner
    state.birds.push({
      x: canvas.width + 20,
      y,
      frame: 0,
      timer: 0,
      speed: 2.5 + Math.random() * 0.8
    });
  }

  function spawnObstacle() {
    const isMartini = Math.random() < 0.55;
    const set = isMartini ? IMG.martini : IMG.palm;
    const img = set[Math.floor(Math.random() * set.length)];
    // sit *above* the floor a bit
    const height = img.naturalHeight || 60;
    const width  = img.naturalWidth  || 40;
    const y = groundY() - height + (isMartini ? -6 : -10);
    state.obstacles.push({
      x: canvas.width + Math.random() * 40,
      y,
      w: width,
      h: height,
      img,
      type: isMartini ? 'MARTINI' : 'PALM'
    });
  }

  // Pre-seed some decoration
  for (let i = 0; i < 3; i++) spawnCloud();

  // --------- Input
  function jump() {
    if (!state.playing || state.crashed) return;
    if (RUNNER.onGround) {
      RUNNER.vy = RUNNER.jumpVel - state.speed * 0.15; // tiny speed assist
      RUNNER.onGround = false;
    }
  }

  function startGame() {
    if (state.playing) return;
    state.playing = true;
    hint.style.display = 'none';
    if (isTouch) mobileBtn.textContent = 'Jump';
    RUNNER.showRun(); // use GIF while running
  }

  function restart() {
    state.playing = false;
    state.crashed = false;
    state.speed = 6;
    state.dist = 0;
    state.clouds = [];
    state.birds = [];
    state.obstacles = [];
    state.gameOverFlash = 0;
    RUNNER.onGround = true;
    RUNNER.vy = 0;
    RUNNER.showIdle();
    hint.style.display = isTouch ? 'none' : 'block';
    if (isTouch) mobileBtn.textContent = 'Start';
  }

  // Desktop keys
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (!state.playing) startGame();
      else jump();
      e.preventDefault();
    } else if (state.crashed && (e.code === 'Enter' || e.code === 'Space')) {
      restart();
    }
  });

  // Mobile button
  mobileBtn.addEventListener('click', () => {
    if (!state.playing) startGame();
    else if (state.crashed) restart();
    else jump();
  });

  // --------- Collision (only martinis + palms)
  function collides(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  // --------- Draw helpers
  function drawFloor() {
    const img = IMG.floor;
    const h = img.naturalHeight || 12;
    // scroll illusion using two draws
    const offset = -((state.dist * 2) % img.naturalWidth);
    ctx.drawImage(img, offset, groundY() - h + 4);
    ctx.drawImage(img, offset + img.naturalWidth, groundY() - h + 4);
  }

  function drawClouds(dt) {
    if (state.clouds.length < 6 && Math.random() < 0.02) spawnCloud();
    for (const c of state.clouds) {
      c.x -= c.speed * dt * 0.06 * state.speed; // very slow parallax
      ctx.drawImage(IMG.cloud, c.x, c.y, 60, 30);
    }
    state.clouds = state.clouds.filter(c => c.x > -80);
  }

  function drawBirds(dt) {
    if (state.birds.length < 2 && Math.random() < 0.01 && state.playing) spawnBird();
    for (const b of state.birds) {
      b.timer += dt;
      if (b.timer > 1000 / 6) { b.frame = (b.frame + 1) % 2; b.timer = 0; }
      b.x -= (state.speed + b.speed) * dt * 0.06;
      const sprite = IMG.bird[b.frame];
      ctx.drawImage(sprite, b.x, b.y, 46, 40);
    }
    state.birds = state.birds.filter(b => b.x > -60);
  }

  function drawObstacles(dt) {
    const need = state.obstacles.length === 0 ||
                 (state.obstacles[state.obstacles.length - 1].x < canvas.width - 220);
    if (need && state.playing) spawnObstacle();

    for (const o of state.obstacles) {
      o.x -= state.speed * dt * 0.06;
      ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
    }
    state.obstacles = state.obstacles.filter(o => o.x > -o.w - 10);
  }

  function drawGameOver() {
    const go = IMG.gameover, r = IMG.restart;
    const cx = canvas.width / 2;
    ctx.drawImage(go, cx - go.naturalWidth / 2, Math.round(canvas.height * 0.28));
    const rx = cx - r.naturalWidth / 2;
    const ry = Math.round(canvas.height * 0.48);
    ctx.drawImage(r, rx, ry);
    // simple hit area for mobile restarts
    mobileBtn.onclick = () => restart();
  }

  // --------- Main loop
  function tick(now) {
    const dt = Math.min(50, now - state.t); // cap delta for tab-switches
    state.t = now;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Floor (always visible)
    drawFloor();

    // Clouds, birds (decorative)
    drawClouds(dt);
    drawBirds(dt);

    // Obstacles
    drawObstacles(dt);

    // Runner physics
    const scaleX = 1; // we already scaled canvas
    if (!RUNNER.onGround) {
      RUNNER.vy += RUNNER.gravity;
      RUNNER.y += RUNNER.vy;
      if (RUNNER.y >= runnerYBase()) {
        RUNNER.y = runnerYBase();
        RUNNER.vy = 0;
        RUNNER.onGround = true;
      }
    } else {
      RUNNER.y = runnerYBase();
    }

    // Position the DOM sprite
    RUNNER.setPos(RUNNER.x * scaleX, RUNNER.y);

    // Distance + speed ramp
    if (state.playing && !state.crashed) {
      state.dist += state.speed * dt / state.frameTime;
      if (state.speed < 12.5) state.speed += 0.0009 * dt; // gentle ramp
    }

    // Collision check (with obstacles only)
    if (state.playing && !state.crashed) {
      const rBox = { x: RUNNER.x + 6, y: RUNNER.y + 4, w: RUNNER.w - 10, h: RUNNER.h - 8 };
      for (const o of state.obstacles) {
        const oBox = { x: o.x + 2, y: o.y + 2, w: o.w - 4, h: o.h - 4 };
        if (collides(rBox, oBox)) {
          state.crashed = true;
          state.playing = false;
          RUNNER.showIdle(); // pause on idle frame
          break;
        }
      }
    }

    // Game over panel
    if (state.crashed) {
      drawGameOver();
    }

    requestAnimationFrame(tick);
  }

  // --------- Boot
  function boot() {
    // put runner at ground, show idle + desktop hint
    RUNNER.y = runnerYBase();
    RUNNER.showIdle();
    RUNNER.setPos(RUNNER.x, RUNNER.y);
    requestAnimationFrame((t) => { state.t = t; tick(t); });
  }

  boot();
})();
