// --- 게임 로직 ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('scoreBoard');
const startMsg = document.getElementById('startMsg');
const speedBtn = document.getElementById('speedBtn');

window.gameRunning = false;

let score = 0;
let speed = 5;
let scoreMultiplier = 1;
let obstacles = [];
let animationId;
let isUpPressed = false;

let horizonY;
const maxZ = 3000;
const fov = 300;
const roadWidth = 1500;
let bgZOffset = 0;

let currentCurve = 0;
let targetCurve = 0;
let curveTimer = 0;

const mountains = [];
for (let i = 0; i < 15; i++) {
    mountains.push({
        x: Math.random() * 3000 - 1000,
        y: 0,
        w: Math.random() * 400 + 200,
        h: Math.random() * 150 + 50,
        color: Math.random() > 0.5 ? '#B2EBF2' : '#E0F7FA'
    });
}

const clouds = [];
for (let i = 0; i < 8; i++) {
    clouds.push({
        x: Math.random() * 2000,
        y: Math.random() * 200,
        w: Math.random() * 80 + 40,
        speed: Math.random() * 0.2 + 0.05
    });
}

// 펭귄 설정
const penguin = {
    x: 0,
    y: 0,
    width: 50,
    height: 70,
    color: '#000000',
    dx: 0,
    speed: 7,
    wobble: 0,
    wobbleDirection: 1,
    jumpY: 0,
    jumpVy: 0,
    isJumping: false,
    jumpStrength: 25,
    gravity: 1.5
};

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    horizonY = canvas.height * 0.4;
    penguin.y = canvas.height - 150;
    if (!window.gameRunning) {
        penguin.x = canvas.width / 2 - penguin.width / 2;
    }
    mountains.forEach(mt => { mt.y = horizonY; });
}

window.addEventListener('resize', resize);
resize();

function increaseSpeed() {
    if (window.gameRunning) {
        speed *= 1.05;
        scoreMultiplier *= 1.1;
    }
}

function jump() {
    if (!penguin.isJumping && window.gameRunning) {
        penguin.isJumping = true;
        penguin.jumpVy = penguin.jumpStrength;
        if(audioCtx) playTone(600, 'sine', 0.1, audioCtx.currentTime, 0.1);
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        penguin.dx = -penguin.speed;
    } else if (e.key === 'ArrowRight') {
        penguin.dx = penguin.speed;
    } else if (e.key === 'ArrowUp') {
        if (!isUpPressed) {
            increaseSpeed();
            isUpPressed = true;
        }
    } else if (e.key === ' ') {
        jump();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        penguin.dx = 0;
    } else if (e.key === 'ArrowUp') {
        isUpPressed = false;
    }
});

document.addEventListener('touchstart', (e) => {
    if (!window.gameRunning) return;
    if (e.target === speedBtn || speedBtn.contains(e.target)) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;

    const pLeft = penguin.x;
    const pRight = penguin.x + penguin.width;
    const pTop = penguin.y - penguin.jumpY;
    const pBottom = penguin.y + penguin.height - penguin.jumpY;

    if (touchX > pLeft - 50 && touchX < pRight + 50 &&
        touchY > pTop - 50 && touchY < pBottom + 50) {
        jump();
        return;
    }

    const halfWidth = window.innerWidth / 2;
    if (touchX < halfWidth) {
        penguin.dx = -penguin.speed;
    } else {
        penguin.dx = penguin.speed;
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (!window.gameRunning) return;
    if (e.target === speedBtn || speedBtn.contains(e.target)) return;
    if (e.touches.length === 0) {
        penguin.dx = 0;
    }
}, { passive: false });

speedBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation(); increaseSpeed();
});
speedBtn.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation(); increaseSpeed();
});

startMsg.addEventListener('click', () => {
    if (!window.gameRunning) startGame();
});

function startGame() {
    window.gameRunning = true;
    score = 0;
    speed = 10;
    scoreMultiplier = 1;
    obstacles = [];
    penguin.x = canvas.width / 2 - penguin.width / 2;
    penguin.wobble = 0;
    penguin.jumpY = 0;
    penguin.isJumping = false;
    bgZOffset = 0;
    currentCurve = 0;
    targetCurve = 0;
    startMsg.style.display = 'none';
    speedBtn.style.display = 'flex';
    startBgm();
    update();
}

function gameOver() {
    window.gameRunning = false;
    cancelAnimationFrame(animationId);
    stopBgm();
    startMsg.innerHTML = `게임 오버!<br>점수: ${score}<br><span style="font-size:16px">클릭하여 다시 시작</span>`;
    startMsg.style.display = 'block';
    speedBtn.style.display = 'none';
}

function createObstacle() {
    const lanes = [-1, 0, 1];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const laneWidth = roadWidth / 3.5;
    const trackX = lane * (laneWidth / roadWidth);

    // 장애물 타입 결정 (0: 구멍, 1: 빙산)
    const type = Math.random() < 0.7 ? 0 : 1;

    obstacles.push({
        trackX: trackX,
        lane: lane,
        z: maxZ,
        width: 80,
        height: type === 0 ? 30 : 80,
        type: type, // 0: Hole, 1: Iceberg
        color: type === 0 ? '#000000' : '#E0F7FA' // 검은색 vs 빙산색
    });
}

function getCurveOffset(z) {
    const t = z / maxZ;
    return currentCurve * t * t;
}

function drawBackground() {
    const centerX = canvas.width / 2;
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, horizonY);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.w < 0) cloud.x = canvas.width + 50;
        ctx.beginPath();
        ctx.ellipse(cloud.x, cloud.y, cloud.w, cloud.w * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    const parallaxX = currentCurve * 0.3;
    const mountainRange = 3000;
    mountains.forEach(mt => {
        let drawX = mt.x - parallaxX;
        drawX = (drawX % mountainRange + mountainRange) % mountainRange - 1000;
        ctx.fillStyle = mt.color;
        ctx.beginPath();
        ctx.moveTo(drawX, mt.y);
        ctx.lineTo(drawX + mt.w / 2, mt.y - mt.h);
        ctx.lineTo(drawX + mt.w, mt.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.moveTo(drawX + mt.w / 2, mt.y - mt.h);
        ctx.lineTo(drawX + mt.w, mt.y);
        ctx.lineTo(drawX + mt.w / 2, mt.y);
        ctx.closePath();
        ctx.fill();
    });

    ctx.fillStyle = '#F0F8FF';
    ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    const segmentLength = 50;
    for (let z = maxZ; z > 0; z -= segmentLength) {
        const zFar = z;
        const zNear = z - segmentLength;
        const scaleFar = fov / (fov + zFar);
        const scaleNear = fov / (fov + zNear);
        const yFar = horizonY + (canvas.height - horizonY) * scaleFar;
        const yNear = horizonY + (canvas.height - horizonY) * scaleNear;
        const wFar = roadWidth * scaleFar;
        const wNear = roadWidth * scaleNear;
        const xOffsetFar = getCurveOffset(zFar);
        const xOffsetNear = getCurveOffset(zNear);
        const centerFar = centerX + xOffsetFar;
        const centerNear = centerX + xOffsetNear;

        if (yNear < horizonY || yFar > canvas.height) continue;

        ctx.fillStyle = (Math.floor((z - bgZOffset) / 200) % 2 === 0) ? '#FFFFFF' : '#F8F8FF';
        ctx.beginPath();
        ctx.moveTo(centerFar - wFar/2, yFar);
        ctx.lineTo(centerFar + wFar/2, yFar);
        ctx.lineTo(centerNear + wNear/2, yNear);
        ctx.lineTo(centerNear - wNear/2, yNear);
        ctx.fill();

        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerFar - wFar/2, yFar);
        ctx.lineTo(centerNear - wNear/2, yNear);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerFar + wFar/2, yFar);
        ctx.lineTo(centerNear + wNear/2, yNear);
        ctx.stroke();

        const laneWFar = wFar / 3;
        const laneWNear = wNear / 3;
        ctx.strokeStyle = 'rgba(0, 191, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerFar - laneWFar/2, yFar);
        ctx.lineTo(centerNear - laneWNear/2, yNear);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerFar + laneWFar/2, yFar);
        ctx.lineTo(centerNear + laneWNear/2, yNear);
        ctx.stroke();
    }
}

function drawPenguin() {
    ctx.save();

    const bounceSpeed = Math.max(100 - (speed * 2), 20);
    const bounce = Math.abs(Math.sin(Date.now() / bounceSpeed)) * 5;

    const drawY = penguin.y - bounce - penguin.jumpY;

    const centerX = penguin.x + penguin.width / 2;
    const centerY = drawY + penguin.height;

    if (penguin.isJumping) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        const shadowScale = Math.max(0.5, 1 - penguin.jumpY / 200);
        ctx.ellipse(centerX, penguin.y + penguin.height, 20 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.translate(centerX, centerY);
    ctx.rotate(penguin.wobble * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    ctx.fillStyle = penguin.color;
    ctx.beginPath();
    ctx.ellipse(penguin.x + penguin.width/2, drawY + penguin.height/2, penguin.width/2, penguin.height/2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = penguin.color;
    ctx.beginPath();
    ctx.moveTo(penguin.x + penguin.width/2 - 10, drawY + penguin.height - 15);
    ctx.lineTo(penguin.x + penguin.width/2 + 10, drawY + penguin.height - 15);
    ctx.lineTo(penguin.x + penguin.width/2, drawY + penguin.height + 5);
    ctx.fill();

    const walkCycle = penguin.isJumping ? 0 : Math.sin(Date.now() / bounceSpeed);
    const leftFootY = drawY + penguin.height + (walkCycle > 0 ? -3 : 0);
    const rightFootY = drawY + penguin.height + (walkCycle < 0 ? -3 : 0);

    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    ctx.ellipse(penguin.x + 10, leftFootY, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(penguin.x + penguin.width - 10, rightFootY, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const wingAngle = penguin.isJumping ? 0.5 : Math.sin(Date.now() / (bounceSpeed/2)) * 0.2;

    ctx.fillStyle = penguin.color;

    ctx.save();
    ctx.translate(penguin.x, drawY + 30);
    ctx.rotate(Math.PI / 4 + wingAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(penguin.x + penguin.width, drawY + 30);
    ctx.rotate(-Math.PI / 4 - wingAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
}

function drawObstacles() {
    obstacles.forEach(obs => {
        const scale = fov / (fov + obs.z);
        const groundHeight = canvas.height - horizonY;
        const screenY = horizonY + groundHeight * scale;

        const centerX = canvas.width / 2;

        const curveOffset = getCurveOffset(obs.z);
        const screenX = (centerX + curveOffset) + (obs.trackX * roadWidth) * scale;

        const screenW = obs.width * scale;
        const screenH = obs.height * scale;

        obs.screenX = screenX;
        obs.screenY = screenY;
        obs.screenW = screenW;
        obs.screenH = screenH;

        if (obs.type === 0) { // 구멍 (Hole)
            ctx.fillStyle = '#000000'; // 검은색 (심연)
            ctx.beginPath();

            // 지그재그로 원을 그려서 깨진 느낌 표현
            const radiusX = screenW / 2;
            const radiusY = screenH / 2;
            const centerY = screenY - screenH / 2;

            // 8개의 점을 불규칙하게 연결
            ctx.moveTo(screenX + radiusX, centerY); // 우
            ctx.lineTo(screenX + radiusX * 0.5, centerY + radiusY * 0.8); // 우하
            ctx.lineTo(screenX, centerY + radiusY); // 하 (뾰족)
            ctx.lineTo(screenX - radiusX * 0.6, centerY + radiusY * 0.7); // 좌하
            ctx.lineTo(screenX - radiusX, centerY); // 좌
            ctx.lineTo(screenX - radiusX * 0.4, centerY - radiusY * 0.8); // 좌상
            ctx.lineTo(screenX, centerY - radiusY); // 상 (뾰족)
            ctx.lineTo(screenX + radiusX * 0.7, centerY - radiusY * 0.6); // 우상

            ctx.closePath();
            ctx.fill();

            // 균열 (Cracks) - 흰색 선으로 강조
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 추가 균열 선 (밖으로 뻗어나가는)
            ctx.beginPath();
            ctx.moveTo(screenX + radiusX, centerY);
            ctx.lineTo(screenX + radiusX * 1.3, centerY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(screenX - radiusX, centerY);
            ctx.lineTo(screenX - radiusX * 1.3, centerY);
            ctx.stroke();

        } else { // 빙산 (Iceberg)
            // 빙산 본체
            ctx.fillStyle = '#E0F7FA';
            ctx.beginPath();
            ctx.moveTo(screenX - screenW/2, screenY);
            ctx.lineTo(screenX - screenW/4, screenY - screenH);
            ctx.lineTo(screenX + screenW/4, screenY - screenH);
            ctx.lineTo(screenX + screenW/2, screenY);
            ctx.closePath();
            ctx.fill();

            // 빙산 그림자/입체감
            ctx.fillStyle = '#B2EBF2';
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - screenH);
            ctx.lineTo(screenX + screenW/4, screenY - screenH);
            ctx.lineTo(screenX + screenW/2, screenY);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.fill();
        }
    });
}

function update() {
    if (!window.gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bgZOffset += speed;
    if (bgZOffset >= 200) {
        bgZOffset -= 200;
    }

    curveTimer++;
    if (curveTimer > 300) {
        targetCurve = (Math.random() - 0.5) * 3000;
        curveTimer = 0;
    }
    currentCurve += (targetCurve - currentCurve) * 0.005;

    drawBackground();

    penguin.x += penguin.dx;
    if (penguin.x < 0) penguin.x = 0;
    if (penguin.x + penguin.width > canvas.width) penguin.x = canvas.width - penguin.width;

    if (penguin.isJumping) {
        penguin.jumpY += penguin.jumpVy;
        penguin.jumpVy -= penguin.gravity;

        if (penguin.jumpY <= 0) {
            penguin.jumpY = 0;
            penguin.isJumping = false;
        }
    }

    if (penguin.dx !== 0 && !penguin.isJumping) {
        penguin.wobble += 3 * penguin.wobbleDirection;
        if (penguin.wobble > 15 || penguin.wobble < -15) {
            penguin.wobbleDirection *= -1;
        }
    } else {
        penguin.wobble *= 0.8;
    }

    if (Math.random() < 0.03 + (speed * 0.001)) {
        createObstacle();
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.z -= speed;

        if (obs.z < -100) {
            obstacles.splice(i, 1);
            score += Math.round(10 * scoreMultiplier);
            scoreElement.innerText = `Score: ${score}`;
            if (score % 100 === 0) speed += 1;
        }
    }

    obstacles.sort((a, b) => b.z - a.z);
    drawObstacles();

    obstacles.forEach(obs => {
        if (obs.z < 50 && obs.z > -50) {
            const obsLeft = obs.screenX - obs.screenW/2;
            const obsRight = obs.screenX + obs.screenW/2;

            const pLeft = penguin.x + 10;
            const pRight = penguin.x + penguin.width - 10;

            if (pRight > obsLeft && pLeft < obsRight) {
                if (obs.type === 0) {
                    if (penguin.jumpY > 40) {
                        // Safe
                    } else {
                        gameOver();
                    }
                } else {
                    gameOver();
                }
            }
        }
    });

    drawPenguin();

    animationId = requestAnimationFrame(update);
}

speedBtn.style.display = 'none';
drawBackground();
drawPenguin();