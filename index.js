'use strict';

/* ====== Boot: size-to-container + focus priming ====== */
window.addEventListener('load', () => {
  const stage  = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx    = canvas.getContext('2d');

  function resizeToStage() {
    const rect = stage.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;

    // CSS size (visible)
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';

    // Backing pixel buffer
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    // Draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Inform the game of logical size
    if (window.__game) window.__game.resize(rect.width, rect.height);
  }

  resizeToStage();
  new ResizeObserver(resizeToStage).observe(stage);
  window.addEventListener('orientationchange', resizeToStage);
  window.addEventListener('resize', resizeToStage);

  // Create game
  window.__game = new Game(canvas);

  // Prevent Space from scrolling parent page (when embedded)
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') e.preventDefault();
  }, { passive: false });

  // Make keyboard work immediately inside an iframe: focus on first interaction
  const primeFocus = () => canvas.focus({ preventScroll: true });
  ['pointerdown','pointerenter','touchstart'].forEach(ev =>
    window.addEventListener(ev, primeFocus, { once: true, passive: true })
  );
  setTimeout(primeFocus, 0);
});

/* ======================
   Assets
====================== */
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const IMG = {
  runnerIdle: loadImage('assets/sonico-images/sonicoman.png'),
  runnerRun:  loadImage('assets/sonico-images/sonicoman.gif'),
  floor:      loadImage('assets/sonico-images/floor.png'),
  cloud:      loadImage('assets/sonico-images/cloud.png'),
  bird: [loadImage('assets/sonico-images/bird1.png'), loadImage('assets/sonico-images/bird2.png')],
  martini: [
    loadImage('assets/sonico-images/martini1.png'),
    loadImage('assets/sonico-images/martini2.png'),
    loadImage('assets/sonico-images/martini3.png'),
    loadImage('assets/sonico-images/martini4.png')
  ],
  palm: [
    loadImage('assets/sonico-images/palm1.png'),
    loadImage('assets/sonico-images/palm2.png'),
    loadImage('assets/sonico-images/palm3.png'),
    loadImage('assets/sonico-images/palm4.png')
  ],
  gameover: loadImage('assets/sonico-images/gameover.png'),
  restart:  loadImage('assets/sonico-images/restart.png')
};

/* ======================
   Config
====================== */
const WORLD = { FLOOR_HEIGHT: 10, BOTTOM_PAD: 10 };
const WORLD_SPEED = 500;   // px/sec
const GROUND_LIFT = -5;

// Reserve this much *visual* space at the bottom for UI (button area)
const BOTTOM_UI_GAP = 120; // tweak this to move the whole game further up/down

const TrexConfig = {
  WIDTH: 100,
  HEIGHT: 100,
  X: 50,
  JUMP_VELOCITY: -15,
  GRAVITY: 1.0
};

const ObstacleTypes = [
  {
    kind: 'martini',
    images: IMG.martini,
    sizes: [
      { w: 34, h: 45 },
      { w: 34, h: 47 },
      { w: 34, h: 48 },
      { w: 34, h: 61 }
    ]
  },
  {
    kind: 'palm',
    images: IMG.palm,
    sizes: [
      { w: 44, h: 65 },
      { w: 56, h: 80 },
      { w: 35, h: 50 },
      { w: 39, h: 70 }
    ]
  }
];

/* ======================
   Classes
====================== */
class Trex {
  constructor(ctx, floorY) {
    this.ctx = ctx;
    this.x = TrexConfig.X;
    this.groundY = floorY - TrexConfig.HEIGHT;
    this.y = this.groundY;
    this.status = 'IDLE';
    this.jumpVel = 0;
  }
  startJump() {
    if (this.status !== 'JUMPING') {
      this.status = 'JUMPING';
      this.jumpVel = TrexConfig.JUMP_VELOCITY;
    }
  }
  update() {
    if (this.status === 'JUMPING') {
      this.y += this.jumpVel;
      this.jumpVel += TrexConfig.GRAVITY;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.status = 'RUNNING';
      }
    }
  }
  draw() {
    const img = (this.status === 'RUNNING') ? IMG.runnerRun : IMG.runnerIdle;
    this.ctx.drawImage(img, this.x, this.y, TrexConfig.WIDTH, TrexConfig.HEIGHT);
  }
  getBounds() {
    return { x: this.x, y: this.y, width: TrexConfig.WIDTH, height: TrexConfig.HEIGHT };
  }
}

class Cloud {
  constructor(ctx, canvasWidth) {
    this.ctx = ctx;
    const H = this.logicalHeight();

    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 10;
    const skyBottom = Math.max(60, H * 0.35);
    this.y = skyTop + Math.random() * (skyBottom - skyTop);

    this.speed = 40 + Math.random() * 40;
    this.width = 60;
    this.height = 40;
  }
  logicalHeight() {
    const dpr = window.devicePixelRatio || 1;
    return this.ctx.canvas.height / dpr;
  }
  update(dt) { this.x -= this.speed * dt; }
  draw() { this.ctx.drawImage(IMG.cloud, this.x, this.y, this.width, this.height); }
  isVisible() { return this.x + this.width > 0; }
}

class Bird {
  constructor(ctx, canvasWidth) {
    this.ctx = ctx;
    const H = this.logicalHeight();

    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 10;
    const skyBottom = Math.max(60, H * 0.35);   // same band as clouds
    this.y = skyTop + Math.random() * (skyBottom - skyTop);

    this.speed = 120 + Math.random() * 60;
    this.width = 46;
    this.height = 40;

    this.frame = 0;
    this.frameTimer = 0;
    this.frameRate = 6;
  }
  logicalHeight() {
    const dpr = window.devicePixelRatio || 1;
    return this.ctx.canvas.height / dpr;
  }
  update(dt) {
    this.x -= this.speed * dt;
    this.frameTimer += dt;
    if (this.frameTimer >= 1 / this.frameRate) {
      this.frame = (this.frame + 1) % IMG.bird.length;
      this.frameTimer = 0;
    }
  }
  draw() {
    const img = IMG.bird[this.frame];
    this.ctx.drawImage(img, this.x, this.y, this.width, this.height);
  }
  isVisible() { return this.x + this.width > 0; }
}

class Obstacle {
  constructor(ctx, type, floorY, spawnX) {
    this.ctx = ctx;
    this.type = type;

    this.variant = Math.floor(Math.random() * type.images.length);
    this.img = type.images[this.variant];

    const sz = (type.sizes && type.sizes[this.variant])
      ? type.sizes[this.variant]
      : { w: type.width, h: type.height };

    this.width  = sz.w;
    this.height = sz.h;

    this.x = spawnX;
    this.y = floorY - this.height - GROUND_LIFT;
  }
  update(speedPerSec, dt) { this.x -= speedPerSec * dt; }
  draw() { this.ctx.drawImage(this.img, this.x, this.y, this.width, this.height); }
  getBounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

class Horizon {
  constructor(ctx, w, floorY) {
    this.ctx = ctx;
    this.w = w;
    this.floorY = floorY;
    this.x = [0, w];
  }
  update(speedPerSec, dt) {
    const dx = speedPerSec * dt;
    this.x[0] -= dx;
    this.x[1] -= dx;
    if (this.x[0] <= -this.w) this.x[0] = this.x[1] + this.w;
    if (this.x[1] <= -this.w) this.x[1] = this.x[0] + this.w;
  }
  draw() {
    this.ctx.drawImage(IMG.floor, this.x[0], this.floorY, this.w, WORLD.FLOOR_HEIGHT);
    this.ctx.drawImage(IMG.floor, this.x[1], this.floorY, this.w, WORLD.FLOOR_HEIGHT);
  }
}

/* ======================
   Game
====================== */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    this.width  = 800;  // replaced on first resize()
    this.height = 500;

    // reserve bottom UI gap and compute floor
    this.bottomGap = BOTTOM_UI_GAP;
    this.floorY = this.height - WORLD.FLOOR_HEIGHT - WORLD.BOTTOM_PAD - this.bottomGap;

    // entities
    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    // HUD
    this.runnerGif = document.getElementById('runnerGif');
    this.startMsg   = document.getElementById('startMsg');
    this.gameOverEl = document.getElementById('gameOver');
    this.restartBtn = document.getElementById('restartBtn');
    this.mobileBtn  = document.getElementById('mobile-btn');

    // state
    this.obstacles = [];
    this.clouds = [];
    this.birds = [];
    this.isPlaying = false;
    this.hasEverStarted = false;
    this.lastTime = null;

    // touch detection for showing the button
    this.isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (this.isTouch) this.showMobileBtn('Start');  // visible only on touch

    this.hideGameOver();
    this.restartBtn?.addEventListener('click', () => this.resetAndStart());
    this.restartBtn?.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') this.resetAndStart();
    });

    this.bindEvents();
    this.renderIdleScreen();
  }

  /* helpers to control the mobile button hard (no CSS race) */
  showMobileBtn(text) {
    if (!this.mobileBtn) return;
    this.mobileBtn.textContent = text;
    this.mobileBtn.classList.remove('hidden');
    this.mobileBtn.style.display = 'inline-block';
  }
  hideMobileBtn() {
    if (!this.mobileBtn) return;
    this.mobileBtn.classList.add('hidden');
    this.mobileBtn.style.display = 'none';
  }

  /* called by the boot resizeToStage() */
  resize(w, h) {
    this.width  = w;
    this.height = h;
    this.floorY = this.height - WORLD.FLOOR_HEIGHT - WORLD.BOTTOM_PAD - this.bottomGap;

    // keep floor/player aligned
    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    if (!this.isPlaying) this.renderIdleScreen();
  }

  hideGameOver() { this.gameOverEl && this.gameOverEl.classList.add('hidden'); }
  showGameOver() { this.gameOverEl && this.gameOverEl.classList.remove('hidden'); }

  bindEvents() {
    window.addEventListener('keydown', e => {
      if (e.code !== 'Space') return;
      e.preventDefault(); // stop parent page scrolling
      if (!this.isPlaying && !this.hasEverStarted) { this.start(); return; }
      if (!this.isPlaying && this.hasEverStarted) return;
      this.trex.startJump();
    }, { passive: false });

    this.mobileBtn?.addEventListener('click', () => {
      if (!this.isPlaying && !this.hasEverStarted) { this.start(); return; }
      if (!this.isPlaying) return;
      this.trex.startJump();
    });
  }

  start() {
    this.isPlaying = true;
    this.trex.status = 'RUNNING';
    this.lastTime = performance.now();

    if (!this.hasEverStarted) {
      if (this.startMsg) this.startMsg.style.display = 'none';
      this.hasEverStarted = true;
    }

    // Mobile button becomes "Jump!" while playing
    if (this.isTouch) this.showMobileBtn('Jump!');

    this.hideGameOver();
    requestAnimationFrame(this.update.bind(this));
  }

  end() {
    this.isPlaying = false;
    this.trex.status = 'IDLE';
    this.runnerGif?.classList.add('hidden');

    // Hide the mobile button on Game Over
    if (this.isTouch) this.hideMobileBtn();

    this.showGameOver();
  }

  reset() {
    this.obstacles = [];
    this.clouds = [];
    this.birds = [];
    this.lastTime = null;

    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    this.hideGameOver();
    this.renderIdleScreen();

    // Idle state after reset: show Start on touch
    if (this.isTouch) this.showMobileBtn('Start');
  }

  resetAndStart() { this.reset(); this.start(); }

  update(ts) {
    const dt = (ts - this.lastTime) / 1000;
    this.lastTime = ts;

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.updateClouds(dt);  this.clouds.forEach(c => c.draw());
    this.updateBirds(dt);   this.birds.forEach(b => b.draw());

    this.horizon.update(WORLD_SPEED, dt);
    this.horizon.draw();

    this.updateObstacles(dt);

    const moving = (this.trex.status === 'RUNNING' || this.trex.status === 'JUMPING');
    if (moving) {
      this.runnerGif?.classList.remove('hidden');
      this.runnerGif.style.transform = `translate(${this.trex.x}px, ${this.trex.y}px)`;
    } else {
      this.runnerGif?.classList.add('hidden');
    }

    this.trex.update();
    if (!moving) this.trex.draw();

    if (this.isPlaying) requestAnimationFrame(this.update.bind(this));
  }

  updateClouds(dt) {
    if (Math.random() < 0.01 && this.clouds.length < 6) {
      this.clouds.push(new Cloud(this.ctx, this.width));
    }
    this.clouds.forEach(c => c.update(dt));
    this.clouds = this.clouds.filter(c => c.isVisible());
  }

  updateBirds(dt) {
    if (Math.random() < 0.005 && this.birds.length < 4) {
      this.birds.push(new Bird(this.ctx, this.width));
    }
    this.birds.forEach(b => b.update(dt));
    this.birds = this.birds.filter(b => b.isVisible());
  }

  updateObstacles(dt) {
    const canSpawn =
      Math.random() < 0.02 &&
      (this.obstacles.length === 0 ||
       this.obstacles[this.obstacles.length - 1].x < this.width - 400);

    if (canSpawn) {
      const type = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
      this.obstacles.push(new Obstacle(this.ctx, type, this.floorY + 0, this.width));
    }

    this.obstacles.forEach(o => {
      o.update(WORLD_SPEED, dt);
      o.draw();
      if (this.checkCollision(this.trex.getBounds(), o.getBounds())) this.end();
    });

    this.obstacles = this.obstacles.filter(o => o.x + o.width > 0);
  }

  checkCollision(r, o) {
    return !(r.x > o.x + o.width || r.x + r.width < o.x || r.y > o.y + o.height || r.y + r.height < o.y);
  }

  renderIdleScreen() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.horizon.draw();
    this.trex.status = 'IDLE';
    this.runnerGif?.classList.add('hidden');
    this.trex.draw();
  }
}
