'use strict';

window.onload = function() {
  const canvas = document.getElementById('game');
  canvas.width  = 500;
  canvas.height = 312;

  // Match the stage size to the canvas size
  const stage = document.getElementById('stage');
  stage.style.width  = canvas.width + 'px';
  stage.style.height = canvas.height + 'px';

  new Game(canvas);
};



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
const GROUND_LIFT = 0; // tiny gap so sprites sit just above the floor

const TrexConfig = {
  WIDTH: 100,
  HEIGHT: 100,
  X: 50,
  JUMP_VELOCITY: -10,
  GRAVITY: 0.3
};

const ObstacleTypes = [
  { images: IMG.martini, width: 30, height: 45 },
  { images: IMG.palm,   width: 70, height: 75 }
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
 * BIRD
 **************/
class Bird {
  constructor(ctx, canvasWidth) {
    this.ctx = ctx;
    this.x = canvasWidth + Math.random() * 200;
    const skyTop = 20;
    const skyBottom = Math.max(60, ctx.canvas.height * 0.5); 
    this.y = skyTop + Math.random() * (skyBottom - skyTop);

    this.speed = 3 + Math.random() * 1.5; // slightly faster than clouds
    this.width = 46; 
    this.height = 40;

    this.frame = 0;
    this.frameTimer = 0;
    this.frameRate = 6; // flaps per second
  }
  update(delta) {
    const pxPerMs = this.speed * 0.06;
    this.x -= pxPerMs * (delta || 16);

    // animate wings
    this.frameTimer += delta;
    if (this.frameTimer >= 1000 / this.frameRate) {
      this.frame = (this.frame + 1) % IMG.bird.length;
      this.frameTimer = 0;
    }
  }
  draw() {
    const img = IMG.bird[this.frame];
    this.ctx.drawImage(img, this.x, this.y, this.width, this.height);
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
    this.birds = [];

    this.hasEverStarted = false; // <- show "Press Space..." only the first time

    // HUD refs
    this.startMsg   = document.getElementById('startMsg');
    this.gameOverEl = document.getElementById('gameOver');
    this.restartBtn = document.getElementById('restartBtn');

    // restart handlers
    this.restartBtn?.addEventListener('click', () => this.reset());
    this.restartBtn?.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') this.reset();
    });
    
    this.bindEvents();
    this.renderIdleScreen();

    this.obstacleCooldown = 200; // ms until next obstacle can spawn

    
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
  // Hide start message the first time only
  if (!this.hasEverStarted) {
    this.startMsg && (this.startMsg.style.display = 'none');
    this.hasEverStarted = true;
  }

  // Hide game-over HUD if it was showing
  this.gameOverEl && this.gameOverEl.classList.add('hidden');

  requestAnimationFrame(this.update.bind(this));
}

end() {
  this.isPlaying = false;
  document.getElementById('mobile-btn').textContent = 'Start';

  // Show Game Over + restart button
  this.gameOverEl && this.gameOverEl.classList.remove('hidden');
}

  update(timestamp) {
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // clouds (background)
    this.updateClouds(delta);
    this.clouds.forEach(c => c.draw());

    // birds (background)
    this.updateBirds(delta);
    this.birds.forEach(b => b.draw());
    
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

updateBirds(delta) {
  if (Math.random() < 0.005 && this.birds.length < 4) { 
    this.birds.push(new Bird(this.ctx, this.width));
  }
  this.birds.forEach(b => b.update(delta));
  this.birds = this.birds.filter(b => b.isVisible());
}
  
updateObstacles(delta) {
  // Only spawn if random chance AND last obstacle is far enough away
  const canSpawn =
    Math.random() < 0.02 &&
    (this.obstacles.length === 0 ||
     this.obstacles[this.obstacles.length - 1].x < this.width - 200); // tweak gap

  if (canSpawn) {
    const type = ObstacleTypes[Math.floor(Math.random() * ObstacleTypes.length)];
    // small +5 pushes it down so it sits right on the floor sprite
    this.obstacles.push(new Obstacle(this.ctx, type, this.floorY + 4));
  }

  // move/draw and check collisions
  this.obstacles.forEach(o => {
    o.update(this.speed, delta);
    o.draw();
    if (this.checkCollision(this.trex.getBounds(), o.getBounds())) {
      this.end();
    }
  });

  // cull off-screen
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


reset() {
  // Clear state
  this.obstacles = [];
  this.clouds = [];
  this.birds = [];
  this.speed = 6;
  this.lastTime = null;

  // Reset player & floor
  this.trex = new Trex(this.ctx, this.floorY);
  this.horizon = new Horizon(this.ctx, this.width, this.floorY);

  // Hide Game Over
  this.gameOverEl && this.gameOverEl.classList.add('hidden');

  // Do NOT show the start message again (per “first time only”)
  this.renderIdleScreen();
}
}


/**************
 * INIT
 **************/
