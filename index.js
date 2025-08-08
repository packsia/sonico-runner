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
  runnerRun: loadImage('assets/sonico-images/sonicoman.gif'),
  floor: loadImage('assets/sonico-images/floor.png'),
  cloud: loadImage('assets/sonico-images/cloud.png'),
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
  restart: loadImage('assets/sonico-images/restart.png')
};

/**************
 * CONFIG
 **************/
const TrexConfig = {
  WIDTH: 78,
  HEIGHT: 88,
  X: 50,
  JUMP_VELOCITY: -10,
  GRAVITY: 0.6
};

const ObstacleTypes = [
  { images: IMG.martini, width: 40, height: 60, yPos: 90 },
  { images: IMG.palm, width: 50, height: 70, yPos: 75 },
  { images: IMG.bird, width: 46, height: 40, yPos: 70, frameRate: 6 }
];

/**************
 * TREX
 **************/
class Trex {
  constructor(ctx) {
    this.ctx = ctx;
    this.x = TrexConfig.X;
    this.y = 150 - TrexConfig.HEIGHT;
    this.groundY = 150 - TrexConfig.HEIGHT;
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
 * OBSTACLE
 **************/
class Obstacle {
  constructor(ctx, type) {
    this.ctx = ctx;
    this.type = type;
    this.frame = 0;
    this.frameTimer = 0;
    this.x = 800;
    this.y = type.yPos;
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
  constructor(ctx, w) {
    this.ctx = ctx;
    this.w = w;
    this.x = [0, w];
  }
  update(speed) {
    this.x[0] -= speed;
    this.x[1] -= speed;
    if (this.x[0] <= -this.w) this.x[0] = this.x[1] + this.w;
    if (this.x[1] <= -this.w) this.x[1] = this.x[0] + this.w;
  }
  draw() {
    this.ctx.drawImage(IMG.floor, this.x[0], 130, this.w, 20);
    this.ctx.drawImage(IMG.floor, this.x[1], 130, this.w, 20);
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
    this.trex = new Trex(this.ctx);
    this.horizon = new Horizon(this.ctx, this.width);
    this.obstacles = [];
    this.speed = 6;
    this.isPlaying = false;
    this.lastTime = null;
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
    this.horizon.update(this.speed);
    this.horizon.draw();
    this.trex.update();
    this.trex.draw();
    this.updateObstacles(delta);
    if (this.isPlaying) requestAnimationFrame(this.update.bind(this));
  }
  updateObstacles(delta) {
    if (Math.random() < 0.02) {
      const type = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
      this.obstacles.push(new Obstacle(this.ctx, type));
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
  canvas.width = 800;
  canvas.height = 300;
  new Game(canvas);
};
