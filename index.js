'use strict';

/********************************
 * IMAGE LOADING
 ********************************/
const IMG = {
    runnerIdle: loadImage('assets/sonico-images/sonicoman.png'),
    runnerRun: loadImage('assets/sonico-images/sonicoman.gif'),
    floor: loadImage('assets/sonico-images/floor.png'),
    cloud: loadImage('assets/sonico-images/cloud.png'),
    bird1: loadImage('assets/sonico-images/bird1.png'),
    bird2: loadImage('assets/sonico-images/bird2.png'),
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

function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

/********************************
 * CONFIG
 ********************************/
const TrexConfig = {
    WIDTH: 78,
    HEIGHT: 88,
    START_X_POS: 50,
    JUMP_VELOCITY: -10,
    GRAVITY: 0.6
};

const CloudConfig = {
    WIDTH: 60,
    HEIGHT: 30,
    MIN_GAP: 100,
    MAX_GAP: 400
};

const ObstacleTypes = [
    { name: 'MARTINI', width: 40, height: 60, yPos: 105, images: IMG.martini, minGap: 120 },
    { name: 'PALM', width: 50, height: 70, yPos: 90, images: IMG.palm, minGap: 120 },
    { name: 'BIRD', width: 46, height: 40, yPos: [100, 75, 50], images: [IMG.bird1, IMG.bird2], minGap: 150, frameRate: 6 }
];

/********************************
 * TREX
 ********************************/
class Trex {
    constructor(canvasCtx) {
        this.canvasCtx = canvasCtx;
        this.xPos = TrexConfig.START_X_POS;
        this.yPos = 0;
        this.groundYPos = 150 - TrexConfig.HEIGHT; // ground level
        this.status = 'WAITING';
        this.jumpVelocity = 0;
    }

    startJump() {
        if (this.status !== 'JUMPING') {
            this.status = 'JUMPING';
            this.jumpVelocity = TrexConfig.JUMP_VELOCITY;
        }
    }

    update() {
        if (this.status === 'JUMPING') {
            this.yPos += this.jumpVelocity;
            this.jumpVelocity += TrexConfig.GRAVITY;
            if (this.yPos >= this.groundYPos) {
                this.yPos = this.groundYPos;
                this.status = 'RUNNING';
            }
        }
    }

    draw() {
        const img = (this.status === 'RUNNING') ? IMG.runnerRun : IMG.runnerIdle;
        this.canvasCtx.drawImage(img, this.xPos, this.yPos, TrexConfig.WIDTH, TrexConfig.HEIGHT);
    }
}

/********************************
 * CLOUD
 ********************************/
class Cloud {
    constructor(canvasCtx, xPos, yPos) {
        this.canvasCtx = canvasCtx;
        this.xPos = xPos;
        this.yPos = yPos;
    }
    update(speed) {
        this.xPos -= speed;
    }
    draw() {
        this.canvasCtx.drawImage(IMG.cloud, this.xPos, this.yPos, CloudConfig.WIDTH, CloudConfig.HEIGHT);
    }
}

/********************************
 * OBSTACLE
 ********************************/
class Obstacle {
    constructor(canvasCtx, typeIndex) {
        this.canvasCtx = canvasCtx;
        this.typeConfig = ObstacleTypes[typeIndex];
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.size = 1;
        this.xPos = 800;
        this.yPos = this.typeConfig.yPos;
    }
    update(speed, deltaTime) {
        this.xPos -= speed;
        if (this.typeConfig.frameRate) {
            this.frameTimer += deltaTime;
            if (this.frameTimer >= 1000 / this.typeConfig.frameRate) {
                this.currentFrame = (this.currentFrame + 1) % this.typeConfig.images.length;
                this.frameTimer = 0;
            }
        }
    }
    draw() {
        const img = this.typeConfig.images[this.currentFrame % this.typeConfig.images.length];
        this.canvasCtx.drawImage(img, this.xPos, this.yPos, this.typeConfig.width * this.size, this.typeConfig.height);
    }
}

/********************************
 * FLOOR
 ********************************/
class HorizonLine {
    constructor(canvasCtx, dimensions) {
        this.canvasCtx = canvasCtx;
        this.dimensions = dimensions;
        this.xPos = [0, dimensions.WIDTH];
        this.yPos = dimensions.HEIGHT - 20;
    }
    update(speed) {
        this.xPos[0] -= speed;
        this.xPos[1] -= speed;
        if (this.xPos[0] <= -this.dimensions.WIDTH) {
            this.xPos[0] = this.xPos[1] + this.dimensions.WIDTH;
        }
        if (this.xPos[1] <= -this.dimensions.WIDTH) {
            this.xPos[1] = this.xPos[0] + this.dimensions.WIDTH;
        }
    }
    draw() {
        this.canvasCtx.drawImage(IMG.floor, this.xPos[0], this.yPos, this.dimensions.WIDTH, 20);
        this.canvasCtx.drawImage(IMG.floor, this.xPos[1], this.yPos, this.dimensions.WIDTH, 20);
    }
}

/********************************
 * GAME OVER PANEL
 ********************************/
class GameOverPanel {
    constructor(canvasCtx, canvasDimensions) {
        this.canvasCtx = canvasCtx;
        this.canvasDimensions = canvasDimensions;
    }
    draw() {
        const centerX = this.canvasDimensions.WIDTH / 2;
        this.canvasCtx.drawImage(IMG.gameover, centerX - (IMG.gameover.width / 2), this.canvasDimensions.HEIGHT / 3);
        this.canvasCtx.drawImage(IMG.restart, centerX - (IMG.restart.width / 2), this.canvasDimensions.HEIGHT / 2);
    }
}

/********************************
 * MAIN GAME
 ********************************/
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dimensions = { WIDTH: canvas.width, HEIGHT: canvas.height };
        this.horizon = new HorizonLine(this.ctx, this.dimensions);
        this.trex = new Trex(this.ctx);
        this.clouds = [];
        this.obstacles = [];
        this.gameOverPanel = new GameOverPanel(this.ctx, this.dimensions);
        this.speed = 6;
        this.isPlaying = false;
        this.lastTime = null;
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.isPlaying) {
                    this.start();
                }
                this.trex.startJump();
            }
        });
        this.canvas.addEventListener('click', () => {
            if (!this.isPlaying) {
                this.start();
            }
            this.trex.startJump();
        });
    }

    start() {
        this.isPlaying = true;
        this.trex.status = 'RUNNING';
        this.lastTime = performance.now();
        requestAnimationFrame(this.update.bind(this));
    }

    update(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Clear screen
        this.ctx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);

        // Update game elements
        this.horizon.update(this.speed);
        this.horizon.draw();

        this.trex.update();
        this.trex.draw();

        this.updateClouds(deltaTime);
        this.updateObstacles(deltaTime);

        // Loop game
        if (this.isPlaying) {
            requestAnimationFrame(this.update.bind(this));
        } else {
            this.gameOverPanel.draw();
        }
    }

    updateClouds(deltaTime) {
        if (Math.random() < 0.005) {
            this.clouds.push(new Cloud(this.ctx, this.dimensions.WIDTH, Math.random() * 50));
        }
        this.clouds.forEach(cloud => {
            cloud.update(this.speed / 2);
            cloud.draw();
        });
        this.clouds = this.clouds.filter(cloud => cloud.xPos + CloudConfig.WIDTH > 0);
    }

    updateObstacles(deltaTime) {
        if (Math.random() < 0.02) {
            const typeIndex = Math.floor(Math.random() * ObstacleTypes.length);
            this.obstacles.push(new Obstacle(this.ctx, typeIndex));
        }
        this.obstacles.forEach(obstacle => {
            obstacle.update(this.speed, deltaTime);
            obstacle.draw();
        });
        this.obstacles = this.obstacles.filter(o => o.xPos + o.typeConfig.width > 0);
    }
}

/********************************
 * START GAME
 ********************************/
window.onload = function() {
    const canvas = document.getElementById('game');
    canvas.width = 800;
    canvas.height = 150;
    new Game(canvas);
};
