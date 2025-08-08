'use strict';

/**************
 * IMAGE LOADER
 **************/
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

/**************
 * CONFIG
 **************/
const WORLD = {
  FLOOR_HEIGHT: 20,
  BOTTOM_PAD: 10
};
const GROUND_LIFT = 6; // tiny gap so sprites sit just above the floor

const TrexConfig = {
  WIDTH: 78,
  HEIGHT: 88,
  X: 50,
  JUMP_VELOCITY: -16,
  GRAVITY: 0.55
};

const ObstacleTypes = [
  { images: IMG.martini, width: 30, height: 45 },
  { images: IMG.palm,   width: 40, height: 56 }
];

/**************
 * TREX
 **************/
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

/**************
 * CLOUD
 **************/
class Cloud {
  constructor(ctx, canvasWidth) {
    this.ctx = ctx;
    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 10;
    const skyBottom = Math.max(60, ctx.canvas.height * 0.35);
    this.y = skyTop + Math.random() * (skyBottom - skyTop);
    this.speed = 1.5 + Math.random();
    this.width = 60;
    this.height = 30;
  }
  update(delta) {
    const pxPerMs = this.speed * 0.06;
    this.x -= pxPerMs * (delta || 16);
  }
  draw() {
    this.ctx.drawImage(IMG.cloud, this.x, this.y, this.width, this.height);
  }
  isVisible() {
    return this.x + this.width > 0;
  }
}

/**************
 * OBSTACLE
 **************/
class Obstacle {
  constructor(ctx, type, floorY) {
    this.ctx = ctx;
    this.type = type;
    this.frame = 0;
    this.frameTimer = 0;
    this.x = ctx.canvas.width;
    this.y = floorY - type.height - GROUND_LIFT; // sit on floor
  }
  update(speed, delta) {
    this.x -= speed;
    if (this.type.frameRate) {
      this.frameTimer += delta;
      if (this.frameTimer >= 1000 / this.type.frameRate) {
        this.frame = (this.frame + 1) % this.type.images.length;
        this.frameTimer = 0;
      }
    }
  }
  draw() {
    const img = this.type.images[this.frame % this.type.images.length];
    this.ctx.drawImage(img, this.x, this.y, this.type.width, this.type.height);
  }
  getBounds() {
    return { x: this.x, y: this.y, width: this.type.width, height: this.type.height };
  }
}

/**************
 * FLOOR
 **************/
class Horizon {
  constructor(ctx, w, floorY) {
    this.ctx = ctx;
    this.w = w;
    this.floorY = floorY;
    this.x = [0, w];
  }
  update(speed) {
    this.x[0] -= speed;
    this.x[1] -= speed;
    if (this.x[0] <= -this.w) this.x[0] = this.x[1] + this.w;
    if (this.x[1] <= -this.w) this.x[1] = this.x[0] + this.w;
  }
  draw() {
    this.ctx.drawImage(IMG.floor, this.x[0], this.floorY, this.w, WORLD.FLOOR_HEIGHT);
    this.ctx.drawImage(IMG.floor, this.x[1], this.floorY, this.w, WORLD.FLOOR_HEIGHT);
  }
}

/**************
 * GAME
 **************/
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.floorY = this.height - WORLD.FLOOR_HEIGHT - WORLD.BOTTOM_PAD;

    this.trex = new Trex(this.ctx, this.floorY);
    this.horizon = new Horizon(this.ctx, this.width, this.floorY);

    this.obstacles = [];
    this.speed = 6;
    this.isPlaying = false;
    this.lastTime = null;

    this.clouds = [];

    this.bindEvents();
    this.renderIdleScreen();
  }

  bindEvents() {
    document.addEventListener('keydown', e => {
      if (e.code === 'Space') {
        if (!this.isPlaying) this.start();
        else this.trex.startJump();
      }
    });
    const mobileBtn = document.getElementById('mobile-btn');
    mobileBtn.addEventListener('click', () => {
      if (!this.isPlaying) {
        this.start();
        mobileBtn.textContent = 'Jump';
      } else {
        this.trex.startJump();
      }
    });
  }

  start() {
    this.isPlaying = true;
    this.trex.status = 'RUNNING';
    this.lastTime = performance.now();
    requestAnimationFrame(this.update.bind(this));
  }

  end() {
    this.isPlaying = false;
    document.getElementById('mobile-btn').textContent = 'Start';
    this.renderIdleScreen();
  }

  update(timestamp) {
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // clouds (background)
    this.updateClouds(delta);
    this.clouds.forEach(c => c.draw());

    // floor
    this.horizon.update(this.speed);
    this.horizon.draw();

    // obstacles
    this.updateObstacles(delta);

    // player
    this.trex.update();
    this.trex.draw();

    if (this.isPlaying) requestAnimationFrame(this.update.bind(this));
  }

  updateClouds(delta) {
    if (Math.random() < 0.01 && this.clouds.length < 6) {
      this.clouds.push(new Cloud(this.ctx, this.width));
    }
    this.clouds.forEach(c => c.update(delta));
    this.clouds = this.clouds.filter(c => c.isVisible());
  }

  updateObstacles(delta) {
    if (Math.random() < 0.02) {
      const type = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
      this.obstacles.push(new Obstacle(this.ctx, type, this.floorY));
    }
    this.obstacles.forEach(o => {
      o.update(this.speed, delta);
      o.draw();
      if (this.checkCollision(this.trex.getBounds(), o.getBounds())) {
        this.end();
      }
    });
    this.obstacles = this.obstacles.filter(o => o.x + o.type.width > 0);
  }

  checkCollision(r, o) {
    return !(r.x > o.x + o.width || r.x + r.width < o.x || r.y > o.y + o.height || r.y + r.height < o.y);
  }

  renderIdleScreen() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.horizon.draw();
    this.trex.status = 'IDLE';
    this.trex.draw();
  }
}

/**************
 * INIT
 **************/
window.onload = function() {
  const canvas = document.getElementById('game');
  canvas.width  = 800;
  canvas.height = 600; // taller window
  new Game(canvas);
};
