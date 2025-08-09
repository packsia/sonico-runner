'use strict';

/* ======================
   BOOT
====================== */
window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  canvas.width  = 800;
  canvas.height = 500;

  // Match the stage size to the canvas size so HUD aligns
  const stage = document.getElementById('stage');
  stage.style.width  = canvas.width + 'px';
  stage.style.height = canvas.height + 'px';

  new Game(canvas);
});


/* ======================
   ASSETS
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
   CONFIG
====================== */
const WORLD = {
  FLOOR_HEIGHT: 10,
  BOTTOM_PAD: 10
};

// Scroll speed (pixels / second)
const WORLD_SPEED = 500;

// tiny gap so sprites sit just above the floor
const GROUND_LIFT = -5;

const TrexConfig = {
  WIDTH: 100,           // must be a number (not "auto")
  HEIGHT: 100,
  X: 50,
  JUMP_VELOCITY: -15,   // more negative = higher initial jump
  GRAVITY: 0.7          // higher = falls faster
};

const ObstacleTypes = [
  {
    kind: 'martini',
    images: IMG.martini,
    // one size per image (tweak to taste)
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
   CLASSES
====================== */
class Trex {
  constructor(ctx, floorY) {
    this.ctx = ctx;
    this.x = TrexConfig.X;
    this.groundY = floorY - TrexConfig.HEIGHT;
    this.y = this.groundY;
    this.status = 'IDLE';  // IDLE | RUNNING | JUMPING
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
    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 10;
    const skyBottom = Math.max(60, ctx.canvas.height * 0.35);
    this.y = skyTop + Math.random() * (skyBottom - skyTop);
    this.speed = 40 + Math.random() * 40;   // px/sec
    this.width = 60;
    this.height = 40;
  }
  update(dt) { this.x -= this.speed * dt; }
  draw() { this.ctx.drawImage(IMG.cloud, this.x, this.y, this.width, this.height); }
  isVisible() { return this.x + this.width > 0; }
}

class Bird {
  constructor(ctx, canvasWidth) {
    this.ctx = ctx;
    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 20;
    const skyBottom = Math.max(60, ctx.canvas.height * 0.5);
    this.y = skyTop + Math.random() * (skyBottom - skyTop);

    this.speed = 120 + Math.random() * 60; // px/sec
    this.width = 46;
    this.height = 40;

    this.frame = 0;
    this.frameTimer = 0;
    this.frameRate = 6; // flaps per second
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
  constructor(ctx, type, floorY) {
    this.ctx = ctx;
    this.type = type;

    // choose which image we’ll use for THIS obstacle
    this.variant = Math.floor(Math.random() * type.images.length);
    this.img = type.images[this.variant];

    // use per-image size if provided; otherwise fall back to type.width/height
    const sz = (type.sizes && type.sizes[this.variant])
      ? type.sizes[this.variant]
      : { w: type.width, h: type.height };

    this.width  = sz.w;
    this.height = sz.h;

    this.x = ctx.canvas.width;
    this.y = floorY - this.height - GROUND_LIFT; // sit on the floor
  }

  update(speedPerSec, dt) {
    this.x -= speedPerSec * dt;
  }

  draw() {
    this.ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
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
   GAME
====================== */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    this.width = canvas.width;
    this.height = canvas.height;
    this.floorY = this.height - WORLD.FLOOR_HEIGHT - WORLD.BOTTOM_PAD;

    // player / world
    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    // decorative overlay GIF (positioned with CSS)
    this.runnerGif = document.getElementById('runnerGif');

    // state
    this.obstacles = [];
    this.clouds = [];
    this.birds = [];
    this.isPlaying = false;
    this.hasEverStarted = false;
    this.lastTime = null;

    // HUD refs
    this.startMsg   = document.getElementById('startMsg');
    this.gameOverEl = document.getElementById('gameOver');
    this.restartBtn = document.getElementById('restartBtn');

    // hide GO on load (HTML should also have class="hidden")
    this.hideGameOver();

    // restart handlers
    this.restartBtn?.addEventListener('click', () => this.resetAndStart());
    this.restartBtn?.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') this.resetAndStart();
    });

    this.bindEvents();
    this.renderIdleScreen();
  }

  /* helpers */
  hideGameOver() { this.gameOverEl && this.gameOverEl.classList.add('hidden'); }
  showGameOver() { this.gameOverEl && this.gameOverEl.classList.remove('hidden'); }

  bindEvents() {
    document.addEventListener('keydown', e => {
      if (e.code !== 'Space') return;

      // First time -> start
      if (!this.isPlaying && !this.hasEverStarted) {
        this.start();
        return;
      }
      // After game over -> ignore (must click restart)
      if (!this.isPlaying && this.hasEverStarted) return;

      // While playing -> jump
      this.trex.startJump();
    });

    const mobileBtn = document.getElementById('mobile-btn');
    mobileBtn?.addEventListener('click', () => {
      if (!this.isPlaying && !this.hasEverStarted) { this.start(); return; }
      if (!this.isPlaying) return; // post-collision
      this.trex.startJump();
    });
  }

  start() {
    this.isPlaying = true;
    this.trex.status = 'RUNNING';
    this.lastTime = performance.now();

    if (!this.hasEverStarted) {
      this.startMsg && (this.startMsg.style.display = 'none');
      this.hasEverStarted = true;
    }
    this.hideGameOver();
    requestAnimationFrame(this.update.bind(this));
  }

  end() {
    this.isPlaying = false;
    this.trex.status = 'IDLE';
    this.runnerGif?.classList.add('hidden'); // stop the gif
    this.showGameOver();
  }

  reset() {
    // Clear state
    this.obstacles = [];
    this.clouds = [];
    this.birds = [];
    this.lastTime = null;

    // Reset player & floor
    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    this.hideGameOver();
    this.renderIdleScreen();
  }

  resetAndStart() { this.reset(); this.start(); }

  update(timestamp) {
    const dt = (timestamp - this.lastTime) / 1000; // seconds
    this.lastTime = timestamp;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // background
    this.updateClouds(dt);
    this.clouds.forEach(c => c.draw());

    this.updateBirds(dt);
    this.birds.forEach(b => b.draw());

    // floor
    this.horizon.update(WORLD_SPEED, dt);
    this.horizon.draw();

    // obstacles
    this.updateObstacles(dt);

    // runner GIF overlay (runs only while moving)
    const moving = this.trex.status === 'RUNNING' || this.trex.status === 'JUMPING';
    if (moving) {
      this.runnerGif?.classList.remove('hidden');
      this.runnerGif.style.transform = `translate(${this.trex.x}px, ${this.trex.y}px)`;
    } else {
      this.runnerGif?.classList.add('hidden');
    }

    // player physics + fallback draw (idle image under gif)
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
    // spawn spaced out
    const canSpawn =
      Math.random() < 0.02 &&
      (this.obstacles.length === 0 ||
       this.obstacles[this.obstacles.length - 1].x < this.width - 400);

    if (canSpawn) {
      const type = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
      this.obstacles.push(new Obstacle(this.ctx, type, this.floorY + 0));
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
