// 马里奥卡丁车游戏主逻辑 - 双人对战版
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 响应式缩放配置
let scaleRatio = 1;
let canvasDisplayWidth = 1000;
let canvasDisplayHeight = 700;

// 检测是否为移动设备
function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// 更新画布尺寸和缩放
function updateCanvasScale() {
    const container = document.getElementById('gameContainer');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 计算缩放比例，保持宽高比
    const scaleX = containerWidth / GAME_CONFIG.CANVAS_WIDTH;
    const scaleY = containerHeight / GAME_CONFIG.CANVAS_HEIGHT;
    scaleRatio = Math.min(scaleX, scaleY);
    
    // 计算显示尺寸
    canvasDisplayWidth = GAME_CONFIG.CANVAS_WIDTH * scaleRatio;
    canvasDisplayHeight = GAME_CONFIG.CANVAS_HEIGHT * scaleRatio;
    
    // 设置画布样式尺寸（CSS显示尺寸）
    canvas.style.width = canvasDisplayWidth + 'px';
    canvas.style.height = canvasDisplayHeight + 'px';
    
    // iPhone 特殊处理 - 确保填满屏幕
    if (isMobile()) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        scaleRatio = Math.min(
            containerWidth / GAME_CONFIG.CANVAS_WIDTH,
            containerHeight / GAME_CONFIG.CANVAS_HEIGHT
        );
    }
}

// 坐标转换函数 - 将屏幕坐标转换为画布坐标
function screenToCanvas(screenX, screenY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left) * (GAME_CONFIG.CANVAS_WIDTH / rect.width),
        y: (screenY - rect.top) * (GAME_CONFIG.CANVAS_HEIGHT / rect.height)
    };
}

// 窗口大小改变时更新缩放
window.addEventListener('resize', updateCanvasScale);
window.addEventListener('orientationchange', () => {
    setTimeout(updateCanvasScale, 100);
});

// 游戏配置
const GAME_CONFIG = {
    FPS: 60,
    TOTAL_LAPS: 3,
    PLAYER_COUNT: 4,
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 700,
    TRACK_WIDTH: 120,
    WALL_BOUNCE: 0.5,
    FRICTION: 0.98,
    OFF_ROAD_FRICTION: 0.92
};

// 游戏状态
let gameState = 'start'; // start, modeSelect, countdown, racing, finished
let gameMode = 'twoPlayer'; // twoPlayer, aiRace
let gameTime = 0;
let particles = [];
let items = [];
let projectiles = [];
let aiRaceResults = [];
let countdownValue = 3;

// 输入状态 - 两个玩家
const keys = {
    // 玩家1 (WASD)
    p1: { up: false, down: false, left: false, right: false, space: false, shift: false },
    // 玩家2 (方向键)
    p2: { up: false, down: false, left: false, right: false, space: false, shift: false }
};

// 道具类型
const ITEM_TYPES = {
    MUSHROOM: { emoji: '🍄', name: '加速蘑菇', effect: 'speed_boost' },
    BANANA: { emoji: '🍌', name: '香蕉皮', effect: 'banana_trap' },
    SHELL: { emoji: '🐢', name: '龟壳', effect: 'shell_attack' },
    STAR: { emoji: '⭐', name: '无敌星', effect: 'invincible' },
    LIGHTNING: { emoji: '⚡', name: '闪电', effect: 'shrink_others' }
};

// 赛道定义
const TRACK_POINTS = [
    { x: 150, y: 350 },
    { x: 200, y: 200 },
    { x: 350, y: 120 },
    { x: 500, y: 100 },
    { x: 650, y: 120 },
    { x: 800, y: 200 },
    { x: 850, y: 350 },
    { x: 800, y: 500 },
    { x: 650, y: 580 },
    { x: 500, y: 600 },
    { x: 350, y: 580 },
    { x: 200, y: 500 }
];

// 障碍物
const OBSTACLES = [
    { x: 400, y: 300, type: 'tree', radius: 25 },
    { x: 600, y: 400, type: 'tree', radius: 25 },
    { x: 500, y: 250, type: 'rock', radius: 20 },
    { x: 300, y: 450, type: 'rock', radius: 20 },
    { x: 700, y: 350, type: 'tree', radius: 25 }
];

// 道具箱
const ITEM_BOXES = [
    { x: 500, y: 80, active: true },
    { x: 870, y: 350, active: true },
    { x: 500, y: 620, active: true },
    { x: 130, y: 350, active: true }
];

// 车辆类型
const CAR_TYPES = {
    standard: { name: '标准型', emoji: '🏎️', maxSpeed: 12, acceleration: 0.3, turnSpeed: 0.08, weight: 1.0, color: '#e74c3c' },
    speed: { name: '速度型', emoji: '🚀', maxSpeed: 15, acceleration: 0.25, turnSpeed: 0.06, weight: 0.8, color: '#3498db' },
    acceleration: { name: '加速型', emoji: '⚡', maxSpeed: 12, acceleration: 0.45, turnSpeed: 0.08, weight: 0.9, color: '#f39c12' },
    handling: { name: '操控型', emoji: '🎯', maxSpeed: 10, acceleration: 0.3, turnSpeed: 0.12, weight: 0.7, color: '#27ae60' },
    heavy: { name: '重型', emoji: '🛡️', maxSpeed: 11, acceleration: 0.22, turnSpeed: 0.07, weight: 1.5, color: '#8e44ad' }
};

// 玩家配置
let playerConfig = {
    p1: { name: '玩家1', carType: 'standard' },
    p2: { name: '玩家2', carType: 'standard' }
};

// 车辆类
class Kart {
    constructor(id, x, y, color, isPlayer = false, playerNum = 0, character = 'Player', carType = null) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.speed = 0;
        
        const carConfig = isPlayer && carType ? CAR_TYPES[carType] : null;
        if (carConfig) {
            this.maxSpeed = carConfig.maxSpeed;
            this.acceleration = carConfig.acceleration;
            this.turnSpeed = carConfig.turnSpeed;
            this.weight = carConfig.weight;
            this.carType = carType;
            this.carEmoji = carConfig.emoji;
        } else {
            this.maxSpeed = isPlayer ? 12 : 9 + Math.random() * 2;
            this.acceleration = 0.3;
            this.turnSpeed = 0.08;
            this.weight = 1.0;
            this.carType = null;
            this.carEmoji = '🏎️';
        }
        
        this.friction = 0.98;
        this.color = carConfig ? carConfig.color : color;
        this.isPlayer = isPlayer;
        this.playerNum = playerNum; // 1 or 2
        this.character = character;
        this.displayName = isPlayer ? (playerNum === 1 ? playerConfig.p1.name : playerConfig.p2.name) : character;
        this.lap = 1;
        this.checkpoint = 0;
        this.finished = false;
        this.finishTime = 0;
        this.rank = 1;
        this.lapTimes = [];
        this.currentLapStartTime = 0;
        this.bestLapTime = Infinity;
        this.item = null;
        this.itemCooldown = 0;
        this.invincibleTime = 0;
        this.shrunk = false;
        this.shrinkTime = 0;
        this.driftTime = 0;
        this.isDrifting = false;
        this.boostTime = 0;
        this.expression = 'normal';
        this.expressionTime = 0;
        this.aiSkill = Math.random() * 0.3 + 0.7;
        this.aiOffset = (Math.random() - 0.5) * 40;
        this.aiReactionTime = Math.random() * 10 + 5;
        this.aiTimer = 0;
        this.targetPoint = 0;
    }
    
    update() {
        if (this.finished) return;
        
        if (this.currentLapStartTime === 0 && gameState === 'racing') {
            this.currentLapStartTime = Date.now();
        }
        
        if (this.itemCooldown > 0) this.itemCooldown--;
        
        if (this.invincibleTime > 0) {
            this.invincibleTime--;
            if (this.invincibleTime <= 0) {
                this.maxSpeed = this.isPlayer ? 12 : 9 + Math.random() * 2;
            }
        }
        
        if (this.shrinkTime > 0) {
            this.shrinkTime--;
            if (this.shrinkTime <= 0) {
                this.shrunk = false;
                this.maxSpeed *= 2;
            }
        }
        
        if (this.isDrifting) {
            this.driftTime++;
            if (this.driftTime > 30) {
                this.boostTime = 60;
            }
        } else {
            this.driftTime = 0;
        }
        
        if (this.boostTime > 0) {
            this.boostTime--;
        }
        
        if (this.expressionTime > 0) {
            this.expressionTime--;
            if (this.expressionTime <= 0) {
                this.expression = 'normal';
            }
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.checkTrackPosition();
        this.checkItemBoxes();
        this.checkObstacles();
        this.checkCheckpoints();
        
        if (!this.isPlayer && gameMode === 'twoPlayer') {
            this.aiControl();
        }
        
        this.checkBoundaries();
    }
    
    aiControl() {
        this.aiTimer++;
        
        if (gameState === 'countdown') {
            this.vx = 0;
            this.vy = 0;
            this.speed = 0;
            return;
        }
        
        const target = TRACK_POINTS[this.targetPoint];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let targetAngle = Math.atan2(dy, dx);
        const perpAngle = targetAngle + Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * this.aiOffset;
        const offsetY = Math.sin(perpAngle) * this.aiOffset;
        const adjustedTargetX = target.x + offsetX;
        const adjustedTargetY = target.y + offsetY;
        
        const adjustedDx = adjustedTargetX - this.x;
        const adjustedDy = adjustedTargetY - this.y;
        targetAngle = Math.atan2(adjustedDy, adjustedDx);
        
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const turnAmount = Math.max(-this.turnSpeed, Math.min(this.turnSpeed, angleDiff));
        this.angle += turnAmount * this.aiSkill;
        
        const boostMultiplier = this.boostTime > 0 ? 1.5 : 1