// 马里奥卡丁车游戏主逻辑
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
let gameMode = 'player'; // player, aiRace
let gameTime = 0;
let particles = [];
let items = [];
let projectiles = [];
let aiRaceResults = []; // AI竞速赛结果
let countdownValue = 3; // 倒计时当前值

// 输入状态
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
    shift: false
};

// 道具类型
const ITEM_TYPES = {
    MUSHROOM: { emoji: '🍄', name: '加速蘑菇', effect: 'speed_boost' },
    BANANA: { emoji: '🍌', name: '香蕉皮', effect: 'banana_trap' },
    SHELL: { emoji: '🐢', name: '龟壳', effect: 'shell_attack' },
    STAR: { emoji: '⭐', name: '无敌星', effect: 'invincible' },
    LIGHTNING: { emoji: '⚡', name: '闪电', effect: 'shrink_others' }
};

// 赛道定义 - 闭合环路
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

// 障碍物位置
const OBSTACLES = [
    { x: 400, y: 300, type: 'tree', radius: 25 },
    { x: 600, y: 400, type: 'tree', radius: 25 },
    { x: 500, y: 250, type: 'rock', radius: 20 },
    { x: 300, y: 450, type: 'rock', radius: 20 },
    { x: 700, y: 350, type: 'tree', radius: 25 }
];

// 道具箱位置
const ITEM_BOXES = [
    { x: 500, y: 80, active: true },
    { x: 870, y: 350, active: true },
    { x: 500, y: 620, active: true },
    { x: 130, y: 350, active: true }
];

// 车辆类型配置
const CAR_TYPES = {
    standard: { name: '标准型', emoji: '🏎️', maxSpeed: 12, acceleration: 0.3, turnSpeed: 0.08, weight: 1.0, color: '#e74c3c' },
    speed: { name: '速度型', emoji: '🚀', maxSpeed: 15, acceleration: 0.25, turnSpeed: 0.06, weight: 0.8, color: '#3498db' },
    acceleration: { name: '加速型', emoji: '⚡', maxSpeed: 12, acceleration: 0.45, turnSpeed: 0.08, weight: 0.9, color: '#f39c12' },
    handling: { name: '操控型', emoji: '🎯', maxSpeed: 10, acceleration: 0.3, turnSpeed: 0.12, weight: 0.7, color: '#27ae60' },
    heavy: { name: '重型', emoji: '🛡️', maxSpeed: 11, acceleration: 0.22, turnSpeed: 0.07, weight: 1.5, color: '#8e44ad' }
};

// 玩家配置
let playerConfig = {
    name: '玩家',
    carType: 'standard'
};

// 车辆类
class Kart {
    constructor(id, x, y, color, isPlayer = false, character = 'Mario', carType = null) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.speed = 0;
        
        // 应用车辆类型属性
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
        this.character = character;
        this.displayName = isPlayer ? (playerConfig.name || '玩家') : character;
        this.lap = 1;
        this.checkpoint = 0;
        this.finished = false;
        this.finishTime = 0;
        this.rank = 1;
        
        // 单圈计时
        this.lapTimes = [];
        this.currentLapStartTime = 0;
        this.bestLapTime = Infinity;
        
        // 道具
        this.item = null;
        this.itemCooldown = 0;
        this.invincibleTime = 0;
        this.shrunk = false;
        this.shrinkTime = 0;
        
        // 漂移
        this.driftTime = 0;
        this.isDrifting = false;
        this.boostTime = 0;
        
        // 表情
        this.expression = 'normal';
        this.expressionTime = 0;
        
        // AI
        this.aiSkill = Math.random() * 0.3 + 0.7; // 0.7-1.0
        this.aiOffset = (Math.random() - 0.5) * 40; // 赛道偏移
        this.aiReactionTime = Math.random() * 10 + 5;
        this.aiTimer = 0;
        this.targetPoint = 0;
    }
    
    update() {
        if (this.finished) return;
        
        // 更新计时
        if (this.currentLapStartTime === 0 && gameState === 'racing') {
            this.currentLapStartTime = Date.now();
        }
        
        // 道具冷却
        if (this.itemCooldown > 0) this.itemCooldown--;
        
        // 无敌时间
        if (this.invincibleTime > 0) {
            this.invincibleTime--;
            if (this.invincibleTime <= 0) {
                this.maxSpeed = this.isPlayer ? 12 : 9 + Math.random() * 2;
            }
        }
        
        // 缩小时间
        if (this.shrinkTime > 0) {
            this.shrinkTime--;
            if (this.shrinkTime <= 0) {
                this.shrunk = false;
                this.maxSpeed *= 2;
            }
        }
        
        // 漂移
        if (this.isDrifting) {
            this.driftTime++;
            if (this.driftTime > 30) {
                this.boostTime = 60; // 漂移加速
            }
        } else {
            this.driftTime = 0;
        }
        
        // 漂移加速
        if (this.boostTime > 0) {
            this.boostTime--;
        }
        
        // 表情
        if (this.expressionTime > 0) {
            this.expressionTime--;
            if (this.expressionTime <= 0) {
                this.expression = 'normal';
            }
        }
        
        // 应用摩擦力
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 检查是否在赛道上
        this.checkTrackPosition();
        
        // 检查道具箱
        this.checkItemBoxes();
        
        // 检查障碍物
        this.checkObstacles();
        
        // 检查检查点
        this.checkCheckpoints();
        
        // AI控制
        if (!this.isPlayer && gameMode === 'player') {
            this.aiControl();
        }
        
        // 边界检查
        this.checkBoundaries();
    }
    
    aiControl() {
        this.aiTimer++;
        
        // 倒计时期间不移动（防止抢跑）
        if (gameState === 'countdown') {
            this.vx = 0;
            this.vy = 0;
            this.speed = 0;
            return;
        }
        
        // 获取目标点
        const target = TRACK_POINTS[this.targetPoint];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 计算目标角度
        let targetAngle = Math.atan2(dy, dx);
        
        // 添加赛道偏移
        const perpAngle = targetAngle + Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * this.aiOffset;
        const offsetY = Math.sin(perpAngle) * this.aiOffset;
        const adjustedTargetX = target.x + offsetX;
        const adjustedTargetY = target.y + offsetY;
        
        const adjustedDx = adjustedTargetX - this.x;
        const adjustedDy = adjustedTargetY - this.y;
        targetAngle = Math.atan2(adjustedDy, adjustedDx);
        
        // 平滑转向
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        const turnAmount = Math.max(-this.turnSpeed, Math.min(this.turnSpeed, angleDiff));
        this.angle += turnAmount * this.aiSkill;
        
        // 加速
        const boostMultiplier = this.boostTime > 0 ? 1.5 : 1;
        const actualMaxSpeed = this.maxSpeed * this.aiSkill * boostMultiplier;
        
        if (this.speed < actualMaxSpeed) {
            this.vx += Math.cos(this.angle) * this.acceleration * this.aiSkill;
            this.vy += Math.sin(this.angle) * this.acceleration * this.aiSkill;
        }
        
        // 到达目标点后转向下一个
        if (dist < 60) {
            this.targetPoint = (this.targetPoint + 1) % TRACK_POINTS.length;
        }
        
        // AI使用道具
        if (this.item && Math.random() < 0.02 * this.aiSkill) {
            this.useItem();
        }
    }
    
    checkTrackPosition() {
        // 找到最近的赛道点
        let minDist = Infinity;
        let onTrack = false;
        
        for (let i = 0; i < TRACK_POINTS.length; i++) {
            const p1 = TRACK_POINTS[i];
            const p2 = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
            
            const dist = this.distanceToSegment(this.x, this.y, p1.x, p1.y, p2.x, p2.y);
            if (dist < minDist) minDist = dist;
        }
        
        // 如果在赛道外，应用更大的摩擦力
        if (minDist > GAME_CONFIG.TRACK_WIDTH / 2) {
            this.vx *= GAME_CONFIG.OFF_ROAD_FRICTION;
            this.vy *= GAME_CONFIG.OFF_ROAD_FRICTION;
            this.maxSpeed = this.isPlayer ? 8 : 7 * this.aiSkill;
        } else {
            this.maxSpeed = this.isPlayer ? 12 : 9 + Math.random() * 2;
        }
    }
    
    distanceToSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    checkItemBoxes() {
        for (let box of ITEM_BOXES) {
            if (box.active) {
                const dist = Math.sqrt((this.x - box.x) ** 2 + (this.y - box.y) ** 2);
                if (dist < 30 && !this.item && this.itemCooldown === 0) {
                    this.getRandomItem();
                    box.active = false;
                    setTimeout(() => box.active = true, 3000);
                    
                    // 特效
                    for (let i = 0; i < 10; i++) {
                        particles.push(new Particle(box.x, box.y, '#ffd700'));
                    }
                }
            }
        }
    }
    
    getRandomItem() {
        const items = Object.keys(ITEM_TYPES);
        const randomItem = items[Math.floor(Math.random() * items.length)];
        this.item = randomItem;
        this.expression = 'happy';
        this.expressionTime = 60;
    }
    
    useItem() {
        if (!this.item) return;
        
        const itemType = ITEM_TYPES[this.item];
        
        switch (itemType.effect) {
            case 'speed_boost':
                this.boostTime = 120;
                this.expression = 'excited';
                this.expressionTime = 60;
                break;
            case 'banana_trap':
                items.push({
                    type: 'banana',
                    x: this.x - Math.cos(this.angle) * 30,
                    y: this.y - Math.sin(this.angle) * 30,
                    life: 600
                });
                break;
            case 'shell_attack':
                const target = this.findTarget();
                if (target) {
                    projectiles.push({
                        type: 'shell',
                        x: this.x,
                        y: this.y,
                        target: target,
                        speed: 15
                    });
                }
                break;
            case 'invincible':
                this.invincibleTime = 300;
                this.maxSpeed *= 1.3;
                this.expression = 'star';
                this.expressionTime = 300;
                break;
            case 'shrink_others':
                for (let kart of karts) {
                    if (kart !== this && !kart.finished) {
                        kart.shrunk = true;
                        kart.shrinkTime = 180;
                        kart.maxSpeed *= 0.5;
                    }
                }
                break;
        }
        
        this.item = null;
        this.itemCooldown = 30;
    }
    
    findTarget() {
        // 找到前方最近的对手
        let target = null;
        let minDist = Infinity;
        
        for (let kart of karts) {
            if (kart !== this && !kart.finished) {
                const dist = Math.sqrt((kart.x - this.x) ** 2 + (kart.y - this.y) ** 2);
                if (dist < minDist && dist < 300) {
                    minDist = dist;
                    target = kart;
                }
            }
        }
        
        return target;
    }
    
    checkObstacles() {
        for (let obstacle of OBSTACLES) {
            const dist = Math.sqrt((this.x - obstacle.x) ** 2 + (this.y - obstacle.y) ** 2);
            if (dist < obstacle.radius + 15) {
                // 碰撞反弹
                const angle = Math.atan2(this.y - obstacle.y, this.x - obstacle.x);
                this.vx = Math.cos(angle) * this.speed * GAME_CONFIG.WALL_BOUNCE;
                this.vy = Math.sin(angle) * this.speed * GAME_CONFIG.WALL_BOUNCE;
                this.speed *= 0.5;
                
                this.expression = 'hurt';
                this.expressionTime = 30;
                
                // 特效
                for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(this.x, this.y, '#888'));
                }
            }
        }
        
        // 检查道具
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const dist = Math.sqrt((this.x - item.x) ** 2 + (this.y - item.y) ** 2);
            if (dist < 20) {
                this.spinOut();
                items.splice(i, 1);
            }
        }
    }
    
    spinOut() {
        this.speed *= 0.3;
        this.vx *= 0.3;
        this.vy *= 0.3;
        this.expression = 'dizzy';
        this.expressionTime = 60;
        
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(this.x, this.y, '#ff6b6b'));
        }
    }
    
    checkCheckpoints() {
        // 检查是否通过检查点
        for (let i = 0; i < TRACK_POINTS.length; i++) {
            const point = TRACK_POINTS[i];
            const dist = Math.sqrt((this.x - point.x) ** 2 + (this.y - point.y) ** 2);
            
            if (dist < 50) {
                if (i === (this.checkpoint + 1) % TRACK_POINTS.length) {
                    this.checkpoint = i;
                    
                    // 完成一圈
                    if (this.checkpoint === 0 && this.speed > 1) {
                        // 记录单圈时间
                        if (this.currentLapStartTime > 0) {
                            const lapTime = (Date.now() - this.currentLapStartTime) / 1000;
                            this.lapTimes.push(lapTime);
                            if (lapTime < this.bestLapTime) {
                                this.bestLapTime = lapTime;
                            }
                        }
                        
                        this.lap++;
                        this.currentLapStartTime = Date.now();
                        
                        if (this.lap > GAME_CONFIG.TOTAL_LAPS) {
                            this.finished = true;
                            this.finishTime = Date.now();
                        }
                    }
                }
            }
        }
    }
    
    checkBoundaries() {
        if (this.x < 0) { this.x = 0; this.vx *= -0.5; }
        if (this.x > canvas.width) { this.x = canvas.width; this.vx *= -0.5; }
        if (this.y < 0) { this.y = 0; this.vy *= -0.5; }
        if (this.y > canvas.height) { this.y = canvas.height; this.vy *= -0.5; }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // 缩放（缩小效果）
        const scale = this.shrunk ? 0.6 : 1;
        ctx.scale(scale, scale);
        
        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(5, 5, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 车身
        ctx.fillStyle = this.color;
        ctx.fillRect(-15, -10, 30, 20);
        
        // 车顶
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // 角色表情
        ctx.fillStyle = '#ffccaa';
        ctx.beginPath();
        ctx.arc(5, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(7, -2, 2, 0, Math.PI * 2);
        ctx.arc(7, 2, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 表情
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        switch (this.expression) {
            case 'happy':
                ctx.arc(8, 0, 3, 0, Math.PI);
                break;
            case 'excited':
                ctx.arc(8, 0, 4, 0, Math.PI);
                break;
            case 'hurt':
            case 'dizzy':
                ctx.moveTo(6, -1); ctx.lineTo(8, 1);
                ctx.moveTo(8, -1); ctx.lineTo(6, 1);
                ctx.moveTo(6, 3); ctx.lineTo(8, 5);
                ctx.moveTo(8, 3); ctx.lineTo(6, 5);
                break;
            case 'star':
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(8, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            default:
                ctx.moveTo(6, 2); ctx.lineTo(10, 2);
        }
        ctx.stroke();
        
        // 帽子（马里奥风格）
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(5, -8, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 帽子logo
        ctx.fillStyle = 'white';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.character[0], 5, -6);
        
        // 车轮
        ctx.fillStyle = '#333';
        ctx.fillRect(-12, -12, 8, 6);
        ctx.fillRect(-12, 6, 8, 6);
        ctx.fillRect(4, -12, 8, 6);
        ctx.fillRect(4, 6, 8, 6);
        
        // 漂移特效
        if (this.isDrifting && this.driftTime > 10) {
            ctx.strokeStyle = `hsl(${(this.driftTime * 10) % 360}, 100%, 50%)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(-15, -15, 8, 0, Math.PI * 2);
            ctx.arc(-15, 15, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // 无敌特效
        if (this.invincibleTime > 0) {
            ctx.strokeStyle = `hsl(${(Date.now() / 10) % 360}, 100%, 50%)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // 车辆类型表情（玩家）
        if (this.isPlayer && this.carEmoji) {
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.carEmoji, 0, -18);
        }
        
        ctx.restore();
        
        // 角色名称（使用displayName显示玩家自定义名字）
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.displayName, this.x, this.y - 25);
        
        // 排名
        if (this.rank <= 3) {
            const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
            ctx.fillStyle = colors[this.rank - 1];
            ctx.beginPath();
            ctx.arc(this.x - 20, this.y - 20, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.font = 'bold 10px Arial';
            ctx.fillText(this.rank.toString(), this.x - 20, this.y - 17);
        }
    }
}

// 粒子类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 30;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.size *= 0.95;
    }
    
    draw() {
        ctx.globalAlpha = this.life / 30;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// 游戏变量
let karts = [];
let player;

// 初始化游戏
function initGame() {
    karts = [];
    particles = [];
    items = [];
    projectiles = [];
    aiRaceResults = [];
    
    const characters = [
        { name: 'Mario', color: '#e74c3c', isPlayer: gameMode === 'player' },
        { name: 'Luigi', color: '#2ecc71', isPlayer: false },
        { name: 'Peach', color: '#ff69b4', isPlayer: false },
        { name: 'Bowser', color: '#f39c12', isPlayer: false }
    ];
    
    // 起始位置
    const startPositions = [
        { x: 150, y: 320 },
        { x: 150, y: 350 },
        { x: 150, y: 380 },
        { x: 150, y: 410 }
    ];
    
    for (let i = 0; i < GAME_CONFIG.PLAYER_COUNT; i++) {
        const pos = startPositions[i];
        const isPlayer = characters[i].isPlayer;
        const kart = new Kart(
            i,
            pos.x,
            pos.y,
            characters[i].color,
            isPlayer,
            characters[i].name,
            isPlayer ? playerConfig.carType : null
        );
        karts.push(kart);
        if (isPlayer) player = kart;
    }
    
    gameTime = 0;
    countdownValue = 3;
    gameState = 'countdown';
    
    // 倒计时 - 3, 2, 1, GO!
    const countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue < 0) {
            clearInterval(countdownInterval);
            gameState = 'racing';
            // 初始化所有赛车的单圈计时
            for (let kart of karts) {
                kart.currentLapStartTime = Date.now();
            }
        }
    }, 1000);
}

// 更新游戏
function update() {
    if (gameState !== 'racing' && gameState !== 'countdown') return;
    
    gameTime++;
    
    // 更新车辆
    for (let kart of karts) {
        kart.update();
    }
    
    // 倒计时期间禁止移动
    if (gameState === 'countdown') {
        // 重置所有车辆速度为0，防止抢跑
        for (let kart of karts) {
            kart.vx = 0;
            kart.vy = 0;
            kart.speed = 0;
        }
        return;
    }
    
    // 更新粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    // 更新道具
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].life--;
        if (items[i].life <= 0) items.splice(i, 1);
    }
    
    // 更新投射物
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        if (proj.target && !proj.target.finished) {
            const dx = proj.target.x - proj.x;
            const dy = proj.target.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 20) {
                proj.target.spinOut();
                projectiles.splice(i, 1);
            } else {
                proj.x += (dx / dist) * proj.speed;
                proj.y += (dy / dist) * proj.speed;
            }
        } else {
            projectiles.splice(i, 1);
        }
    }
    
    // 计算排名
    calculateRanking();
    
    // 检查游戏结束
    checkGameEnd();
}

// 计算排名
function calculateRanking() {
    // 根据圈数和进度排序
    const sorted = [...karts].sort((a, b) => {
        if (a.finished && b.finished) {
            return a.finishTime - b.finishTime;
        }
        if (a.finished) return -1;
        if (b.finished) return 1;
        
        if (a.lap !== b.lap) return b.lap - a.lap;
        return b.checkpoint - a.checkpoint;
    });
    
    for (let i = 0; i < sorted.length; i++) {
        sorted[i].rank = i + 1;
    }
}

// 检查游戏结束
function checkGameEnd() {
    const finishedCount = karts.filter(k => k.finished).length;
    if (finishedCount === karts.length && gameState !== 'finished') {
        gameState = 'finished';
        
        // 如果是AI竞速赛模式，记录结果
        if (gameMode === 'aiRace') {
            aiRaceResults = karts.map(k => ({
                character: k.character,
                color: k.color,
                totalTime: (k.finishTime - k.currentLapStartTime) / 1000,
                lapTimes: k.lapTimes,
                bestLapTime: k.bestLapTime,
                rank: k.rank
            }));
        }
    }
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制草地纹理
    ctx.fillStyle = '#3d6b26';
    for (let i = 0; i < canvas.width; i += 40) {
        for (let j = 0; j < canvas.height; j += 40) {
            if ((i + j) % 80 === 0) {
                ctx.fillRect(i, j, 20, 20);
            }
        }
    }
    
    // 绘制赛道
    drawTrack();
    
    // 绘制道具箱
    drawItemBoxes();
    
    // 绘制道具
    drawItems();
    
    // 绘制投射物
    drawProjectiles();
    
    // 绘制车辆
    for (let kart of karts) {
        kart.draw();
    }
    
    // 绘制粒子
    for (let p of particles) {
        p.draw();
    }
    
    // 绘制UI
    drawUI();
}

// 绘制赛道
function drawTrack() {
    ctx.strokeStyle = '#555';
    ctx.lineWidth = GAME_CONFIG.TRACK_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(TRACK_POINTS[0].x, TRACK_POINTS[0].y);
    for (let i = 1; i < TRACK_POINTS.length; i++) {
        ctx.lineTo(TRACK_POINTS[i].x, TRACK_POINTS[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // 赛道边缘
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 中心线
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 30]);
    ctx.beginPath();
    ctx.moveTo(TRACK_POINTS[0].x, TRACK_POINTS[0].y);
    for (let i = 1; i < TRACK_POINTS.length; i++) {
        ctx.lineTo(TRACK_POINTS[i].x, TRACK_POINTS[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 起点/终点线
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
        ctx.fillRect(140 + i * 8, 300, 8, 100);
    }
    
    // 检查点标记
    for (let i = 0; i < TRACK_POINTS.length; i++) {
        const p = TRACK_POINTS[i];
        ctx.fillStyle = i === 0 ? '#e74c3c' : '#3498db';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 障碍物
    for (let obs of OBSTACLES) {
        if (obs.type === 'tree') {
            // 树干
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(obs.x - 5, obs.y - 5, 10, 15);
            // 树冠
            ctx.fillStyle = '#228b22';
            ctx.beginPath();
            ctx.arc(obs.x, obs.y - 15, obs.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (obs.type === 'rock') {
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
            ctx.fill();
            // 高光
            ctx.fillStyle = '#a9a9a9';
            ctx.beginPath();
            ctx.arc(obs.x - 5, obs.y - 5, obs.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 绘制道具箱
function drawItemBoxes() {
    for (let box of ITEM_BOXES) {
        if (box.active) {
            // 浮动动画
            const float = Math.sin(Date.now() / 200) * 3;
            
            // 问号方块
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(box.x - 15, box.y - 15 + float, 30, 30);
            
            // 边框
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x - 15, box.y - 15 + float, 30, 30);
            
            // 问号
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('?', box.x, box.y + 5 + float);
            
            // 光晕
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(box.x, box.y + float, 20, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// 绘制道具
function drawItems() {
    for (let item of items) {
        if (item.type === 'banana') {
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🍌', item.x, item.y);
        }
    }
}

// 绘制投射物
function drawProjectiles() {
    for (let proj of projectiles) {
        if (proj.type === 'shell') {
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // 龟壳纹理
            ctx.strokeStyle = '#27ae60';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// 绘制UI
function drawUI() {
    // 速度表
    const speed = player ? Math.floor(player.speed * 10) : 0;
    document.getElementById('speedValue').textContent = speed;
    
    // 圈数信息
    const currentLap = player ? player.lap : 1;
    document.getElementById('lapInfo').innerHTML = `
        <div>圈数</div>
        <div style="font-size: 1.5rem; color: #ffd700;">${currentLap}/${GAME_CONFIG.TOTAL_LAPS}</div>
    `;
    
    // 排名
    const rank = player ? player.rank : 1;
    const rankSuffix = ['st', 'nd', 'rd', 'th'][rank - 1];
    document.getElementById('ranking').innerHTML = `
        <div>排名</div>
        <div style="font-size: 1.5rem; color: #ffd700;">${rank}${rankSuffix}</div>
    `;
    
    // 道具
    const itemBox = document.getElementById('itemBox');
    if (player && player.item) {
        itemBox.textContent = ITEM_TYPES[player.item].emoji;
        itemBox.style.borderColor = '#ffd700';
    } else {
        itemBox.textContent = '';
        itemBox.style.borderColor = '#666';
    }
    
    // 倒计时 - 使用独立的倒计时变量
    if (gameState === 'countdown') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 显示倒计时数字
        const text = countdownValue > 0 ? countdownValue : 'GO!';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // 显示提示文字
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('准备出发！', canvas.width / 2, canvas.height / 2 + 100);
    }
    
    // 游戏结束画面
    if (gameState === 'finished') {
        drawGameOver();
    }
}

// 绘制游戏结束画面
function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (gameMode === 'aiRace') {
        ctx.fillText('🏁 AI竞速赛结束！', canvas.width / 2, 80);
    } else {
        const playerRank = player ? player.rank : 1;
        if (playerRank === 1) {
            ctx.fillText('🏆 冠军！', canvas.width / 2, 80);
        } else if (playerRank === 2) {
            ctx.fillText('🥈 亚军！', canvas.width / 2, 80);
        } else if (playerRank === 3) {
            ctx.fillText('🥉 季军！', canvas.width / 2, 80);
        } else {
            ctx.fillText('第 ' + playerRank + ' 名', canvas.width / 2, 80);
        }
    }
    
    // 排名列表
    const sorted = [...karts].sort((a, b) => a.rank - b.rank);
    
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('最终排名', canvas.width / 2, 140);
    
    // 表头
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('排名  角色      总用时     最佳单圈', canvas.width / 2, 175);
    
    ctx.font = '20px Arial';
    for (let i = 0; i < sorted.length; i++) {
        const kart = sorted[i];
        const y = 210 + i * 40;
        
        // 排名背景
        if (i < 3) {
            const colors = ['rgba(255, 215, 0, 0.3)', 'rgba(192, 192, 192, 0.3)', 'rgba(205, 127, 50, 0.3)'];
            ctx.fillStyle = colors[i];
            ctx.fillRect(canvas.width / 2 - 200, y - 20, 400, 35);
        }
        
        // 排名
        ctx.fillStyle = i < 3 ? '#ffd700' : '#fff';
        ctx.fillText(`${i + 1}`, canvas.width / 2 - 180, y);
        
        // 角色
        ctx.fillStyle = kart.color;
        ctx.fillText(kart.character, canvas.width / 2 - 100, y);
        
        // 总用时
        const totalTime = kart.finished ? (kart.finishTime / 1000).toFixed(2) : '--';
        ctx.fillStyle = '#fff';
        ctx.fillText(totalTime + 's', canvas.width / 2 + 20, y);
        
        // 最佳单圈
        const bestLap = kart.bestLapTime !== Infinity ? (kart.bestLapTime / 1000).toFixed(2) + 's' : '--';
        ctx.fillStyle = '#2ecc71';
        ctx.fillText(bestLap, canvas.width / 2 + 140, y);
    }
    
    // 单圈详细成绩
    if (gameMode === 'aiRace') {
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('各圈成绩详情', canvas.width / 2, 390);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('角色      第1圈      第2圈      第3圈', canvas.width / 2, 415);
        
        for (let i = 0; i < sorted.length; i++) {
            const kart = sorted[i];
            const y = 440 + i * 30;
            
            ctx.fillStyle = kart.color;
            ctx.fillText(kart.character.substring(0, 6), canvas.width / 2 - 120, y);
            
            ctx.fillStyle = '#fff';
            for (let j = 0; j < 3; j++) {
                const lapTime = kart.lapTimes[j] ? (kart.lapTimes[j] / 1000).toFixed(2) + 's' : '--';
                ctx.fillText(lapTime, canvas.width / 2 - 40 + j * 80, y);
            }
        }
    }
    
    // 重新开始提示
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('按空格键或点击重新开始', canvas.width / 2, canvas.height - 50);
}

// 游戏循环
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 玩家输入处理
function handlePlayerInput() {
    if (!player || gameState !== 'racing') return;
    
    // 倒计时期间禁止移动（防止抢跑）
    if (gameState === 'countdown') {
        player.vx = 0;
        player.vy = 0;
        player.speed = 0;
        return;
    }
    
    // 加速/减速 - 使用绝对方向
    if (keys.up) {
        player.vy -= player.acceleration;
    }
    if (keys.down) {
        player.vy += player.acceleration;
    }
    if (keys.left) {
        player.vx -= player.acceleration;
    }
    if (keys.right) {
        player.vx += player.acceleration;
    }
    
    // 限制最大速度
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    const boostMultiplier = player.boostTime > 0 ? 1.5 : 1;
    const actualMaxSpeed = player.maxSpeed * boostMultiplier;
    
    if (speed > actualMaxSpeed) {
        const ratio = actualMaxSpeed / speed;
        player.vx *= ratio;
        player.vy *= ratio;
    }
    
    // 更新角度（根据速度方向）
    if (speed > 0.5) {
        player.angle = Math.atan2(player.vy, player.vx);
    }
    
    // 漂移
    player.isDrifting = keys.shift && speed > 5;
    
    // 使用道具
    if (keys.space && player.item) {
        player.useItem();
    }
}

// 键盘事件
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            keys.up = true;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.down = true;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = true;
            break;
        case ' ':
            keys.space = true;
            if (gameState === 'finished') {
                showModeSelect();
            }
            break;
        case 'Shift':
            keys.shift = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            keys.down = false;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            keys.right = false;
            break;
        case ' ':
            keys.space = false;
            break;
        case 'Shift':
            keys.shift = false;
            break;
    }
});

// 触摸控制
let joystickActive = false;
let joystickCenter = { x: 0, y: 0 };
let joystickCurrent = { x: 0, y: 0 };

const joystick = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystickKnob');

if (joystick) {
    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        joystickCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        joystickActive = true;
        updateJoystick(touch);
    });
    
    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystickActive) {
            updateJoystick(e.touches[0]);
        }
    });
    
    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        joystickKnob.style.transform = 'translate(0px, 0px)';
        keys.up = false;
        keys.down = false;
        keys.left = false;
        keys.right = false;
    });
}

function updateJoystick(touch) {
    const maxDist = 40;
    const dx = touch.clientX - joystickCenter.x;
    const dy = touch.clientY - joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    
    joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    
    // 设置方向键状态
    const threshold = 10;
    keys.up = dy < -threshold;
    keys.down = dy > threshold;
    keys.left = dx < -threshold;
    keys.right = dx > threshold;
}

// 动作按钮
const btnItem = document.getElementById('btnItem');
const btnDrift = document.getElementById('btnDrift');

if (btnItem) {
    btnItem.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.space = true;
        btnItem.classList.add('active');
    });
    btnItem.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.space = false;
        btnItem.classList.remove('active');
    });
}

if (btnDrift) {
    btnDrift.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.shift = true;
        btnDrift.classList.add('active');
    });
    btnDrift.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.shift = false;
        btnDrift.classList.remove('active');
    });
}

// 模式选择
function showModeSelect() {
    gameState = 'modeSelect';
    document.getElementById('modeSelectScreen').style.display = 'flex';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
}

// 开始玩家模式
function startPlayerGame() {
    gameMode = 'player';
    document.getElementById('modeSelectScreen').style.display = 'none';
    initGame();
}

// 开始AI竞速赛模式
function startAIRace() {
    gameMode = 'aiRace';
    document.getElementById('modeSelectScreen').style.display = 'none';
    initGame();
}

// 显示模式选择
function showModeSelectScreen() {
    showModeSelect();
}

// 返回模式选择
function backToModeSelect() {
    gameState = 'modeSelect';
    document.getElementById('modeSelectScreen').style.display = 'flex';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('aiRaceResultScreen').style.display = 'none';
    document.getElementById('watchingBadge').classList.add('hidden');
}

// 重新开始游戏
function restartGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    initGame();
}

// 重新开始AI竞速赛
function restartAIRace() {
    document.getElementById('aiRaceResultScreen').style.display = 'none';
    initGame();
}

// 游戏循环中添加玩家输入处理
setInterval(handlePlayerInput, 1000 / 60);

// 角色选择界面
function showCharacterSelect() {
    gameState = 'characterSelect';
    document.getElementById('modeSelectScreen').style.display = 'none';
    document.getElementById('characterSelectScreen').style.display = 'flex';
    document.getElementById('characterSelectScreen').classList.remove('hidden');
    
    // 重置选择
    playerConfig.name = '玩家';
    playerConfig.carType = 'standard';
    document.getElementById('playerNameInput').value = '';
    updateCarSelectionUI();
}

// 选择车辆类型
function selectCar(carType) {
    playerConfig.carType = carType;
    updateCarSelectionUI();
}

// 更新车辆选择UI
function updateCarSelectionUI() {
    const options = document.querySelectorAll('.car-option');
    options.forEach(opt => {
        const type = opt.getAttribute('data-car');
        if (type === playerConfig.carType) {
            opt.style.borderColor = '#ffd700';
            opt.style.background = 'rgba(255,215,0,0.3)';
            opt.style.transform = 'scale(1.05)';
        } else {
            opt.style.borderColor = '#666';
            opt.style.background = 'rgba(0,0,0,0.3)';
            opt.style.transform = 'scale(1)';
        }
    });
}

// 确认角色选择并开始游戏
function confirmCharacterSelect() {
    const nameInput = document.getElementById('playerNameInput').value.trim();
    if (nameInput) {
        playerConfig.name = nameInput;
    }
    
    document.getElementById('characterSelectScreen').style.display = 'none';
    gameMode = 'player';
    initGame();
}

// 启动游戏
showModeSelect();
gameLoop();
