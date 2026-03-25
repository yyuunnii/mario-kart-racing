// 马里奥卡丁车游戏主逻辑 - 完整版
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏配置
const GAME_CONFIG = {
    FPS: 60,
    TOTAL_LAPS: 3,
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 700,
    TRACK_WIDTH: 120
};

// 游戏状态
let gameState = 'modeSelect';
let gameMode = 'player';
let gameTime = 0;
let countdownValue = 3;
let selectedCar = 'standard';
let karts = [];
let playerKart = null;
let particles = [];

// 输入状态
const keys = { up: false, down: false, left: false, right: false, space: false, shift: false };

// 车辆类型
const CAR_TYPES = {
    standard: { name: '标准型', emoji: '🏎️', maxSpeed: 12, acceleration: 0.3, turnSpeed: 0.08, color: '#e74c3c' },
    speed: { name: '速度型', emoji: '🚀', maxSpeed: 15, acceleration: 0.25, turnSpeed: 0.06, color: '#3498db' },
    acceleration: { name: '加速型', emoji: '⚡', maxSpeed: 12, acceleration: 0.45, turnSpeed: 0.08, color: '#f39c12' },
    handling: { name: '操控型', emoji: '🎯', maxSpeed: 10, acceleration: 0.3, turnSpeed: 0.12, color: '#27ae60' },
    heavy: { name: '重型', emoji: '🛡️', maxSpeed: 11, acceleration: 0.22, turnSpeed: 0.07, color: '#8e44ad' }
};

// 玩家配置
let playerConfig = { name: '玩家', carType: 'standard' };

// 赛道点
const TRACK_POINTS = [
    { x: 150, y: 350 }, { x: 200, y: 200 }, { x: 350, y: 120 },
    { x: 500, y: 100 }, { x: 650, y: 120 }, { x: 800, y: 200 },
    { x: 850, y: 350 }, { x: 800, y: 500 }, { x: 650, y: 580 },
    { x: 500, y: 600 }, { x: 350, y: 580 }, { x: 200, y: 500 }
];

// 车辆类
class Kart {
    constructor(id, x, y, color, isPlayer, character, carType) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = -Math.PI / 2;
        this.speed = 0;
        
        const config = isPlayer && carType ? CAR_TYPES[carType] : CAR_TYPES.standard;
        this.maxSpeed = config.maxSpeed;
        this.acceleration = config.acceleration;
        this.turnSpeed = config.turnSpeed;
        this.color = config.color;
        this.carEmoji = config.emoji;
        
        this.isPlayer = isPlayer;
        this.character = character;
        this.displayName = isPlayer ? playerConfig.name : character;
        this.lap = 1;
        this.checkpoint = 0;
        this.finished = false;
        this.boostTime = 0;
        this.isDrifting = false;
        this.shrunk = false;
        this.aiTargetPoint = 0;
        this.aiSkill = Math.random() * 0.3 + 0.7;
    }
    
    update() {
        if (this.finished || gameState === 'countdown') return;
        
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        this.x += this.vx;
        this.y += this.vy;
        
        if (!this.isPlayer) this.aiControl();
        this.checkBoundaries();
    }
    
    aiControl() {
        const target = TRACK_POINTS[this.aiTargetPoint];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 50) {
            this.aiTargetPoint = (this.aiTargetPoint + 1) % TRACK_POINTS.length;
        }
        
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        this.angle += Math.max(-this.turnSpeed, Math.min(this.turnSpeed, angleDiff)) * this.aiSkill;
        
        const boost = this.boostTime > 0 ? 1.5 : 1;
        this.vx += Math.cos(this.angle) * this.acceleration * boost * this.aiSkill;
        this.vy += Math.sin(this.angle) * this.acceleration * boost * this.aiSkill;
        
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed * boost) {
            this.vx = (this.vx / speed) * this.maxSpeed * boost;
            this.vy = (this.vy / speed) * this.maxSpeed * boost;
        }
    }
    
    checkBoundaries() {
        if (this.x < 20) { this.x = 20; this.vx *= -0.5; }
        if (this.x > 980) { this.x = 980; this.vx *= -0.5; }
        if (this.y < 20) { this.y = 20; this.vy *= -0.5; }
        if (this.y > 680) { this.y = 680; this.vy *= -0.5; }
    }
}

// 游戏控制函数
function showModeSelect() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('modeSelectScreen').classList.remove('hidden');
    document.getElementById('characterSelectScreen').classList.add('hidden');
    gameState = 'modeSelect';
}

function showCharacterSelect() {
    document.getElementById('modeSelectScreen').classList.add('hidden');
    document.getElementById('characterSelectScreen').classList.remove('hidden');
    gameMode = 'player';
}

function selectCar(type) {
    selectedCar = type;
    document.querySelectorAll('.car-option').forEach(el => {
        el.style.borderColor = el.dataset.car === type ? '#ffd700' : '#666';
        el.style.background = el.dataset.car === type ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.3)';
    });
}

function confirmCharacterSelect() {
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput && nameInput.value.trim()) {
        playerConfig.name = nameInput.value.trim();
    }
    playerConfig.carType = selectedCar;
    startPlayerGame();
}

function backToModeSelect() {
    document.getElementById('modeSelectScreen').classList.remove('hidden');
    document.getElementById('characterSelectScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('aiRaceResultScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.add('hidden');
    gameState = 'modeSelect';
}

function startPlayerGame() {
    document.getElementById('characterSelectScreen').classList.add('hidden');
    document.getElementById('modeSelectScreen').classList.add('hidden');
    initGame();
    startCountdown();
}

function startAIRace() {
    document.getElementById('modeSelectScreen').classList.add('hidden');
    gameMode = 'aiRace';
    initAIRace();
    startCountdown();
}

function initGame() {
    karts = [];
    playerKart = new Kart(0, 500, 550, '#e74c3c', true, 'Player', playerConfig.carType);
    karts.push(playerKart);
    
    const aiColors = ['#3498db', '#f39c12', '#27ae60'];
    const aiNames = ['Luigi', 'Peach', 'Bowser'];
    for (let i = 0; i < 3; i++) {
        karts.push(new Kart(i + 1, 480 + i * 20, 580 + i * 15, aiColors[i], false, aiNames[i]));
    }
    
    gameState = 'countdown';
    gameTime = 0;
}

function initAIRace() {
    karts = [];
    const aiColors = ['#e74c3c', '#3498db', '#f39c12', '#27ae60'];
    const aiNames = ['Mario', 'Luigi', 'Peach', 'Bowser'];
    for (let i = 0; i < 4; i++) {
        karts.push(new Kart(i, 460 + i * 25, 550 + i * 15, aiColors[i], false, aiNames[i]));
    }
    gameState = 'countdown';
    gameTime = 0;
}

function startCountdown() {
    countdownValue = 3;
    const countdownEl = document.getElementById('countdown');
    countdownEl.classList.remove('hidden');
    countdownEl.textContent = '3';
    
    const interval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            countdownEl.textContent = countdownValue;
        } else if (countdownValue === 0) {
            countdownEl.textContent = 'GO!';
        } else {
            clearInterval(interval);
            countdownEl.classList.add('hidden');
            gameState = 'racing';
        }
    }, 1000);
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startPlayerGame();
}

function restartAIRace() {
    document.getElementById('aiRaceResultScreen').classList.add('hidden');
    startAIRace();
}

// 输入处理
window.addEvent
// 输入处理
window.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': case 'w': case 'W': keys.up = true; break;
        case 'ArrowDown': case 's': case 'S': keys.down = true; break;
        case 'ArrowLeft': case 'a': case 'A': keys.left = true; break;
        case 'ArrowRight': case 'd': case 'D': keys.right = true; break;
        case ' ': keys.space = true; break;
        case 'Shift': keys.shift = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowUp': case 'w': case 'W': keys.up = false; break;
        case 'ArrowDown': case 's': case 'S': keys.down = false; break;
        case 'ArrowLeft': case 'a': case 'A': keys.left = false; break;
        case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
        case ' ': keys.space = false; break;
        case 'Shift': keys.shift = false; break;
    }
});

// 触摸控制
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };

const joystickBase = document.getElementById('joystickBase');
const joystick = document.getElementById('joystick');

if (joystickBase && joystick) {
    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = joystickBase.getBoundingClientRect();
        joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        joystickActive = true;
        updateJoystick(touch.clientX, touch.clientY);
    }, { passive: false });
    
    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystickActive) {
            updateJoystick(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    
    joystickBase.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        joystick.style.transform = 'translate(-50%, -50%)';
        keys.left = false;
        keys.right = false;
    });
    
    // 防止触摸时页面滚动
    joystickBase.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

function updateJoystick(clientX, clientY) {
    const maxDist = 40;
    const dx = clientX - joystickCenter.x;
    const dy = clientY - joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const clampedDist = Math.min(dist, maxDist);
    const jx = Math.cos(angle) * clampedDist;
    const jy = Math.sin(angle) * clampedDist;
    
    joystick.style.transform = `translate(calc(-50% + ${jx}px), calc(-50% + ${jy}px))`;
    
    // 根据摇杆位置控制转向
    if (jx < -10) { keys.left = true; keys.right = false; }
    else if (jx > 10) { keys.right = true; keys.left = false; }
    else { keys.left = false; keys.right = false; }
}

// 按钮触摸控制
const gasButton = document.getElementById('gasButton');
const brakeButton = document.getElementById('brakeButton');
const itemButton = document.getElementById('itemButton');
const driftButton = document.getElementById('driftButton');

function setupButton(btn, key) {
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[key] = true;
        btn.classList.add('active');
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[key] = false;
        btn.classList.remove('active');
    });
}

setupButton(gasButton, 'up');
setupButton(brakeButton, 'down');
setupButton(itemButton, 'space');
setupButton(driftButton, 'shift');

// 响应式画布缩放
let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;

function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const canvas = document.getElementById('gameCanvas');
    
    if (!container || !canvas) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 计算缩放比例，保持宽高比
    const scaleX = containerWidth / GAME_CONFIG.CANVAS_WIDTH;
    const scaleY = containerHeight / GAME_CONFIG.CANVAS_HEIGHT;
    canvasScale = Math.min(scaleX, scaleY);
    
    // 计算居中偏移
    canvasOffsetX = (containerWidth - GAME_CONFIG.CANVAS_WIDTH * canvasScale) / 2;
    canvasOffsetY = (containerHeight - GAME_CONFIG.CANVAS_HEIGHT * canvasScale) / 2;
    
    // 设置画布实际显示大小
    canvas.style.width = (GAME_CONFIG.CANVAS_WIDTH * canvasScale) + 'px';
    canvas.style.height = (GAME_CONFIG.CANVAS_HEIGHT * canvasScale) + 'px';
    canvas.style.marginLeft = canvasOffsetX + 'px';
    canvas.style.marginTop = canvasOffsetY + 'px';
}

// 坐标转换函数：屏幕坐标 -> 画布坐标
function screenToCanvas(screenX, screenY) {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left) / canvasScale,
        y: (screenY - rect.top) / canvasScale
    };
}

// 游戏主循环
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (gameState !== 'racing' && gameState !== 'countdown') return;
    
    // 玩家控制
    if (playerKart && gameState === 'racing') {
        const boost = playerKart.boostTime > 0 ? 1.5 : 1;
        
        if (keys.up) {
            playerKart.vx += Math.cos(playerKart.angle) * playerKart.acceleration * boost;
            playerKart.vy += Math.sin(playerKart.angle) * playerKart.acceleration * boost;
        }
        if (keys.down) {
            playerKart.vx -= Math.cos(playerKart.angle) * playerKart.acceleration * 0.5;
            playerKart.vy -= Math.sin(playerKart.angle) * playerKart.acceleration * 0.5;
        }
        if (keys.left) playerKart.angle -= playerKart.turnSpeed;
        if (keys.right) playerKart.angle += playerKart.turnSpeed;
        
        const speed = Math.sqrt(playerKart.vx * playerKart.vx + playerKart.vy * playerKart.vy);
        if (speed > playerKart.maxSpeed * boost) {
            playerKart.vx = (playerKart.vx / speed) * playerKart.maxSpeed * boost;
            playerKart.vy = (playerKart.vy / speed) * playerKart.maxSpeed * boost;
        }
    }
    
    // 更新所有赛车
    karts.forEach(kart => kart.update());
    
    // 更新UI
    if (playerKart) {
        document.getElementById('speedValue').textContent = Math.floor(playerKart.speed * 10);
        document.getElementById('lapValue').textContent = playerKart.lap + '/3';
    }
}

function render() {
    // 清空画布
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(0, 0, 1000, 700);
    
    // 只在游戏进行或倒计时状态时绘制赛道和赛车
    if (gameState === 'racing' || gameState === 'countdown') {
        // 绘制赛道
        drawTrack();
        
        // 绘制赛车
        karts.forEach(kart => drawKart(kart));
    }
}

function drawTrack() {
    // 绘制赛道背景
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 120;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    TRACK_POINTS.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    
    // 绘制赛道边线
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制起点线
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(480 + i * 10, 540, 5, 60);
    }
}

function drawKart(kart) {
    ctx.save();
    ctx.translate(kart.x, kart.y);
    ctx.rotate(kart.angle);
    
    const scale = kart.shrunk ? 0.6 : 1;
    ctx.scale(scale, scale);
    
    // 绘制车辆
    ctx.fillStyle = kart.color;
    ctx.fillRect(-15, -10, 30, 20);
    
    // 绘制车窗
    ctx.fillStyle = '#333';
    ctx.fillRect(-5, -8, 15, 16);
    
    // 绘制车轮
    ctx.fillStyle = '#000';
    ctx.fillRect(-12, -12, 8, 4);
    ctx.fillRect(-12, 8, 8, 4);
    ctx.fillRect(4, -12, 8, 4);
    ctx.fillRect(4, 8, 8, 4);
    
    ctx.restore();
    
    // 绘制名字
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(kart.displayName, kart.x, kart.y - 20);
}

// 初始化
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100);
});

// 初始调整大小
resizeCanvas();

// 初始显示开始界面
document.getElementById('startScreen').classList.remove('hidden');
document.getElementById('modeSelectScreen').classList.add('hidden');
gameState = 'start';

// 启动游戏循环
gameLoop();
