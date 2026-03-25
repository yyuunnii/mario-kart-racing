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
let gameState = 'start'; // start, countdown, racing, finished
let gameTime = 0;
let particles = [];
let items = [];
let projectiles = [];

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

// 车辆类
class Kart {
    constructor(id, x, y, color, isPlayer = false, character = 'Mario') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = isPlayer ? 12 : 9 + Math.random() * 2;
        this.acceleration = 0.3;
        this.friction = 0.98;
        this.turnSpeed = 0.08;
        this.color = color;
        this.isPlayer = isPlayer;
        this.character = character;
        this.lap = 1;
        this.checkpoint = 0;
        this.finished = false;
        this.finishTime = 0;
        this.rank = 1;
        
        // 道具
        this.item = null;
        this.itemCount = 0;
        
        // 状态
        this.drifting = false;
        this.invincible = false;
        this.invincibleTime = 0;
        this.shrunk = false;
        this.shrinkTime = 0;
        this.stunned = false;
        this.stunTime = 0;
        
        // AI
        this.aiOffset = (Math.random() - 0.5) * 40;
        this.aiReaction = Math.random() * 0.5 + 0.5;
    }
    
    update() {
        if (this.finished) return;
        
        // 处理眩晕
        if (this.stunned) {
            this.stunTime--;
            if (this.stunTime <= 0) {
                this.stunned = false;
            }
            this.vx *= 0.9;
            this.vy *= 0.9;
            this.x += this.vx;
            this.y += this.vy;
            return;
        }
        
        // 处理无敌时间
        if (this.invincible) {
            this.invincibleTime--;
            if (this.invincibleTime <= 0) {
                this.invincible = false;
            }
        }
        
        // 处理缩小
        if (this.shrunk) {
            this.shrinkTime--;
            if (this.shrinkTime <= 0) {
                this.shrunk = false;
            }
        }
        
        if (this.isPlayer) {
            this.handlePlayerInput();
        } else {
            this.handleAI();
        }
        
        // 应用摩擦力
        const onTrack = this.isOnTrack();
        const friction = onTrack ? this.friction : GAME_CONFIG.OFF_ROAD_FRICTION;
        this.vx *= friction;
        this.vy *= friction;
        
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 计算速度
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // 更新角度（根据速度方向）
        if (this.speed > 0.5) {
            const targetAngle = Math.atan2(this.vy, this.vx);
            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += diff * 0.1;
        }
        
        // 边界检查
        this.checkBoundaries();
        
        // 检查检查点
        this.checkCheckpoints();
        
        // 检查道具箱
        this.checkItemBoxes();
        
        // 漂移效果
        if (this.drifting && this.speed > 5) {
            this.createDriftParticles();
        }
    }
    
    handlePlayerInput() {
        let accelerating = false;
        let turning = false;
        
        // 使用绝对方向控制（WASD控制屏幕方向，不是赛车朝向）
        let ax = 0;
        let ay = 0;
        
        // W/S 控制上下方向（屏幕坐标系）
        if (keys.up) {
            ay -= this.acceleration;
            accelerating = true;
        }
        if (keys.down) {
            ay += this.acceleration * 0.5;
        }
        
        // A/D 控制左右方向（屏幕坐标系）
        if (keys.left) {
            ax -= this.acceleration;
            turning = true;
        }
        if (keys.right) {
            ax += this.acceleration;
            turning = true;
        }
        
        // 应用加速度到速度
        this.vx += ax;
        this.vy += ay;
        
        // 根据速度方向更新赛车朝向（用于渲染）
        if (this.speed > 0.5 || Math.abs(ax) > 0 || Math.abs(ay) > 0) {
            const targetAngle = Math.atan2(this.vy, this.vx);
            let diff = targetAngle - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += diff * 0.15;
        }
        
        // 漂移状态
        this.drifting = keys.shift && turning && this.speed > 5;
        
        // 使用道具
        if (keys.space && this.item) {
            this.useItem();
        }
    }
    
    handleAI() {
        // 找到最近的赛道点
        let nearestPoint = 0;
        let minDist = Infinity;
        
        for (let i = 0; i < TRACK_POINTS.length; i++) {
            const dist = Math.hypot(TRACK_POINTS[i].x - this.x, TRACK_POINTS[i].y - this.y);
            if (dist < minDist) {
                minDist = dist;
                nearestPoint = i;
            }
        }
        
        // 目标点是前方的一个点
        const targetIndex = (nearestPoint + 2) % TRACK_POINTS.length;
        const target = TRACK_POINTS[targetIndex];
        
        // 计算到目标的角度
        const targetAngle = Math.atan2(target.y - this.y + this.aiOffset, target.x - this.x + this.aiOffset);
        
        // 平滑转向
        let diff = targetAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.05 * this.aiReaction;
        
        // 加速
        const speedMultiplier = this.isOnTrack() ? 1 : 0.7;
        this.vx += Math.cos(this.angle) * this.acceleration * speedMultiplier;
        this.vy += Math.sin(this.angle) * this.acceleration * speedMultiplier;
        
        // 随机漂移
        this.drifting = Math.random() < 0.1 && this.speed > 6;
        
        // AI使用道具
        if (this.item && Math.random() < 0.02) {
            this.useItem();
        }
    }
    
    useItem() {
        if (!this.item) return;
        
        const itemType = this.item.effect;
        
        switch (itemType) {
            case 'speed_boost':
                this.vx *= 2;
                this.vy *= 2;
                createParticles(this.x, this.y, 'speed', 20);
                break;
                
            case 'banana_trap':
                // 在身后放置香蕉皮
                items.push({
                    x: this.x - Math.cos(this.angle) * 40,
                    y: this.y - Math.sin(this.angle) * 40,
                    type: 'banana',
                    emoji: '🍌',
                    owner: this.id
                });
                break;
                
            case 'shell_attack':
                // 发射龟壳
                projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(this.angle) * 15,
                    vy: Math.sin(this.angle) * 15,
                    type: 'shell',
                    emoji: '🐢',
                    owner: this.id,
                    bounces: 3
                });
                break;
                
            case 'invincible':
                this.invincible = true;
                this.invincibleTime = 300;
                this.maxSpeed *= 1.5;
                break;
                
            case 'shrink_others':
                // 缩小其他赛车
                karts.forEach(kart => {
                    if (kart.id !== this.id) {
                        kart.shrunk = true;
                        kart.shrinkTime = 180;
                    }
                });
                break;
        }
        
        this.item = null;
        updateUI();
    }
    
    isOnTrack() {
        // 检查是否在赛道上
        let onTrack = false;
        const trackWidth = GAME_CONFIG.TRACK_WIDTH / 2;
        
        // 检查到赛道中心线的距离
        for (let i = 0; i < TRACK_POINTS.length; i++) {
            const p1 = TRACK_POINTS[i];
            const p2 = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
            
            const dist = pointToLineDistance(this.x, this.y, p1.x, p1.y, p2.x, p2.y);
            if (dist < trackWidth) {
                onTrack = true;
                break;
            }
        }
        
        return onTrack;
    }
    
    checkBoundaries() {
        // 墙壁碰撞
        if (this.x < 20) {
            this.x = 20;
            this.vx *= -GAME_CONFIG.WALL_BOUNCE;
        }
        if (this.x > canvas.width - 20) {
            this.x = canvas.width - 20;
            this.vx *= -GAME_CONFIG.WALL_BOUNCE;
        }
        if (this.y < 20) {
            this.y = 20;
            this.vy *= -GAME_CONFIG.WALL_BOUNCE;
        }
        if (this.y > canvas.height - 20) {
            this.y = canvas.height - 20;
            this.vy *= -GAME_CONFIG.WALL_BOUNCE;
        }
        
        // 障碍物碰撞
        OBSTACLES.forEach(obs => {
            const dist = Math.hypot(this.x - obs.x, this.y - obs.y);
            const minDist = obs.radius + 15;
            
            if (dist < minDist) {
                const angle = Math.atan2(this.y - obs.y, this.x - obs.x);
                this.x = obs.x + Math.cos(angle) * minDist;
                this.y = obs.y + Math.sin(angle) * minDist;
                this.vx *= 0.5;
                this.vy *= 0.5;
                
                if (this.isPlayer) {
                    createParticles(this.x, this.y, 'collision', 10);
                }
            }
        });
    }
    
    checkCheckpoints() {
        // 检查是否通过检查点
        const checkpoint = TRACK_POINTS[this.checkpoint];
        const dist = Math.hypot(this.x - checkpoint.x, this.y - checkpoint.y);
        
        if (dist < 50) {
            this.checkpoint = (this.checkpoint + 1) % TRACK_POINTS.length;
            
            // 完成一圈
            if (this.checkpoint === 0) {
                this.lap++;
                if (this.lap > GAME_CONFIG.TOTAL_LAPS) {
                    this.finished = true;
                    this.finishTime = gameTime;
                }
                
                if (this.isPlayer) {
                    updateUI();
                }
            }
        }
    }
    
    checkItemBoxes() {
        ITEM_BOXES.forEach((box, index) => {
            if (!box.active) return;
            
            const dist = Math.hypot(this.x - box.x, this.y - box.y);
            if (dist < 30) {
                // 获得随机道具
                const itemKeys = Object.keys(ITEM_TYPES);
                const randomItem = ITEM_TYPES[itemKeys[Math.floor(Math.random() * itemKeys.length)]];
                this.item = randomItem;
                
                // 暂时禁用道具箱
                box.active = false;
                setTimeout(() => { box.active = true; }, 3000);
                
                createParticles(box.x, box.y, 'item', 15);
                
                if (this.isPlayer) {
                    updateUI();
                }
            }
        });
    }
    
    createDriftParticles() {
        if (Math.random() < 0.3) {
            const offset = (Math.random() - 0.5) * 20;
            const px = this.x - Math.cos(this.angle) * 20 + Math.cos(this.angle + Math.PI/2) * offset;
            const py = this.y - Math.sin(this.angle) * 20 + Math.sin(this.angle + Math.PI/2) * offset;
            particles.push({
                x: px,
                y: py,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 30,
                color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)`,
                size: Math.random() * 5 + 3
            });
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 无敌效果闪烁
        if (this.invincible && Math.floor(gameTime / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // 缩小效果
        const scale = this.shrunk ? 0.6 : 1;
        ctx.scale(scale, scale);
        
        // 旋转
        ctx.rotate(this.angle);
        
        // 绘制阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(5, 5, 22, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制赛车车身
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-20, -12, 40, 24, 8);
        ctx.fill();
        
        // 赛车边框
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 挡风玻璃
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.roundRect(-5, -8, 15, 16, 3);
        ctx.fill();
        
        // 车轮
        ctx.fillStyle = '#222';
        const wheelPositions = [
            { x: -12, y: -12 }, { x: 12, y: -12 },
            { x: -12, y: 10 }, { x: 12, y: 10 }
        ];
        wheelPositions.forEach(pos => {
            ctx.beginPath();
            ctx.roundRect(pos.x - 4, pos.y - 3, 8, 6, 2);
            ctx.fill();
        });
        
        // 角色标识
        ctx.restore();
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);
        
        // 角色emoji
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getCharacterEmoji(), 0, -20);
        
        // 道具指示
        if (this.item) {
            ctx.font = '14px Arial';
            ctx.fillText(this.item.emoji, 0, 20);
        }
        
        ctx.restore();
    }
    
    getCharacterEmoji() {
        const emojis = {
            'Mario': '🔴',
            'Luigi': '🟢',
            'Peach': '🩷',
            'Bowser': '🟤'
        };
        return emojis[this.character] || '🔴';
    }
}

// 玩家和AI赛车
let karts = [];

// 辅助函数：点到线段的距离
function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
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

// 创建粒子效果
function createParticles(x, y, type, count) {
    const colors = {
        'speed': ['#FFD700', '#FFA500', '#FF6347'],
        'collision': ['#888', '#AAA', '#666'],
        'item': ['#FF69B4', '#00CED1', '#FFD700'],
        'drift': ['#FF4500', '#FFD700', '#FF6347']
    };
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 40 + Math.random() * 20,
            color: colors[type][Math.floor(Math.random() * colors[type].length)],
            size: Math.random() * 6 + 2
        });
    }
}

// 绘制赛道
function drawTrack() {
    // 草地背景
    ctx.fillStyle = '#3d7a1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制赛道
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 赛道外边界
    ctx.lineWidth = GAME_CONFIG.TRACK_WIDTH + 20;
    ctx.strokeStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(TRACK_POINTS[0].x, TRACK_POINTS[0].y);
    for (let i = 1; i < TRACK_POINTS.length; i++) {
        ctx.lineTo(TRACK_POINTS[i].x, TRACK_POINTS[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    
    // 赛道主体
    ctx.lineWidth = GAME_CONFIG.TRACK_WIDTH;
    ctx.strokeStyle = '#4a4a4a';
    ctx.stroke();
    
    // 赛道中心线（虚线）
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD700';
    ctx.setLineDash([20, 20]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制检查点标记
    TRACK_POINTS.forEach((point, index) => {
        if (index === 0) {
            // 起点线
            ctx.fillStyle = '#FFF';
            ctx.fillRect(point.x - 40, point.y - GAME_CONFIG.TRACK_WIDTH/2, 80, GAME_CONFIG.TRACK_WIDTH);
            
            // 黑白格
            ctx.fillStyle = '#000';
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 8; j++) {
                    if ((i + j) % 2 === 0) {
                        ctx.fillRect(
                            point.x - 40 + i * 20,
                            point.y - GAME_CONFIG.TRACK_WIDTH/2 + j * 15,
                            20, 15
                        );
                    }
                }
            }
        }
    });
}

// 绘制障碍物
function drawObstacles() {
    OBSTACLES.forEach(obs => {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        
        if (obs.type === 'tree') {
            // 树干
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-8, 0, 16, 25);
            
            // 树冠
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(0, -10, obs.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 树冠高光
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.arc(-5, -15, obs.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (obs.type === 'rock') {
            // 石头
            ctx.fillStyle = '#808080';
            ctx.beginPath();
            ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 高光
            ctx.fillStyle = '#A9A9A9';
            ctx.beginPath();
            ctx.arc(-5, -5, obs.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    });
}

// 绘制道具箱
function drawItemBoxes() {
    ITEM_BOXES.forEach(box => {
        if (!box.active) return;
        
        ctx.save();
        ctx.translate(box.x, box.y);
        
        // 浮动动画
        const float = Math.sin(gameTime * 0.1) * 5;
        ctx.translate(0, float);
        
        // 旋转动画
        ctx.rotate(gameTime * 0.05);
        
        // 箱子
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(-20, -20, 40, 40);
        
        // 问号
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 2);
        
        // 边框
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.strokeRect(-20, -20, 40, 40);
        
        ctx.restore();
    });
}

// 绘制道具和投射物
function drawItems() {
    // 地面道具
    items.forEach((item, index) => {
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, item.x, item.y);
    });
    
    // 投射物
    projectiles.forEach(proj => {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(proj.emoji, proj.x, proj.y);
    });
}

// 更新粒子
function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.size *= 0.95;
        return p.life > 0;
    });
}

// 绘制粒子
function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 40;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// 更新投射物
function updateProjectiles() {
    projectiles = projectiles.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        
        // 边界反弹
        if (proj.x < 0 || proj.x > canvas.width) {
            proj.vx *= -1;
            proj.bounces--;
        }
        if (proj.y < 0 || proj.y > canvas.height) {
            proj.vy *= -1;
            proj.bounces--;
        }
        
        // 检查击中赛车
        karts.forEach(kart => {
            if (kart.id !== proj.owner && !kart.invincible) {
                const dist = Math.hypot(kart.x - proj.x, kart.y - proj.y);
                if (dist < 25) {
                    kart.stunned = true;
                    kart.stunTime = 60;
                    kart.vx *= 0.3;
                    kart.vy *= 0.3;
                    createParticles(kart.x, kart.y, 'collision', 15);
                    proj.bounces = 0;
                }
            }
        });
        
        return proj.bounces > 0;
    });
}

// 更新道具效果
function updateItems() {
    // 检查赛车碰到地面道具
    items = items.filter(item => {
        let hit = false;
        karts.forEach(kart => {
            if (kart.id !== item.owner) {
                const dist = Math.hypot(kart.x - item.x, kart.y - item.y);
                if (dist < 20) {
                    kart.stunned = true;
                    kart.stunTime = 90;
                    kart.speed *= 0.3;
                    createParticles(kart.x, kart.y, 'collision', 10);
                    hit = true;
                }
            }
        });
        return !hit;
    });
}

// 赛车间碰撞检测
function checkKartCollisions() {
    for (let i = 0; i < karts.length; i++) {
        for (let j = i + 1; j < karts.length; j++) {
            const k1 = karts[i];
            const k2 = karts[j];
            
            const dist = Math.hypot(k1.x - k2.x, k1.y - k2.y);
            const minDist = 35;
            
            if (dist < minDist) {
                // 推开
                const angle = Math.atan2(k2.y - k1.y, k2.x - k1.x);
                const force = (minDist - dist) * 0.5;
                
                k1.x -= Math.cos(angle) * force;
                k1.y -= Math.sin(angle) * force;
                k2.x += Math.cos(angle) * force;
                k2.y += Math.sin(angle) * force;
                
                // 速度交换
                const tempVx = k1.vx * 0.8;
                const tempVy = k1.vy * 0.8;
                k1.vx = k2.vx * 0.8;
                k1.vy = k2.vy * 0.8;
                k2.vx = tempVx;
                k2.vy = tempVy;
            }
        }
    }
}

// 计算排名
function calculateRanking() {
    // 根据圈数和检查点排序
    karts.sort((a, b) => {
        if (a.lap !== b.lap) return b.lap - a.lap;
        if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;
        return a.finishTime - b.finishTime;
    });
    
    karts.forEach((kart, index) => {
        kart.rank = index + 1;
    });
}

// 更新UI
function updateUI() {
    const player = karts.find(k => k.isPlayer);
    if (!player) return;
    
    document.getElementById('lapValue').textContent = `${Math.min(player.lap, GAME_CONFIG.TOTAL_LAPS)}/${GAME_CONFIG.TOTAL_LAPS}`;
    document.getElementById('rankValue').textContent = `${player.rank}/${GAME_CONFIG.PLAYER_COUNT}`;
    document.getElementById('speedValue').textContent = Math.floor(player.speed * 10);
    
    const itemBox = document.getElementById('itemBox');
    if (player.item) {
        itemBox.textContent = player.item.emoji;
        itemBox.style.borderColor = '#FFD700';
    } else {
        itemBox.textContent = '❓';
        itemBox.style.borderColor = '#666';
    }
}

// 游戏主循环
function gameLoop() {
    if (gameState === 'racing') {
        gameTime++;
        
        // 更新所有赛车
        karts.forEach(kart => kart.update());
        
        // 更新投射物
        updateProjectiles();
        
        // 更新道具
        updateItems();
        
        // 碰撞检测
        checkKartCollisions();
        
        // 更新粒子
        updateParticles();
        
        // 计算排名
        calculateRanking();
        
        // 更新UI
        updateUI();
        
        // 检查游戏结束
        const finishedCount = karts.filter(k => k.finished).length;
        if (finishedCount === GAME_CONFIG.PLAYER_COUNT) {
            endGame();
        }
    }
    
    // 绘制
    draw();
    
    requestAnimationFrame(gameLoop);
}

// 绘制场景
function draw() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制赛道
    drawTrack();
    
    // 绘制道具箱
    drawItemBoxes();
    
    // 绘制障碍物
    drawObstacles();
    
    // 绘制地面道具
    drawItems();
    
    // 绘制粒子（在赛车下方）
    drawParticles();
    
    // 绘制赛车
    karts.forEach(kart => kart.draw());
    
    // 绘制投射物
    projectiles.forEach(proj => {
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(proj.emoji, proj.x, proj.y);
    });
}

// 初始化游戏
function initGame() {
    gameTime = 0;
    particles = [];
    items = [];
    projectiles = [];
    
    // 创建赛车
    const colors = ['#FF0000', '#00AA00', '#FF69B4', '#8B4513'];
    const characters = ['Mario', 'Luigi', 'Peach', 'Bowser'];
    
    karts = [];
    for (let i = 0; i < GAME_CONFIG.PLAYER_COUNT; i++) {
        const startX = 150 + (i % 2) * 40;
        const startY = 350 + Math.floor(i / 2) * 40;
        karts.push(new Kart(
            i,
            startX,
            startY,
            colors[i],
            i === 0, // 第一个是玩家
            characters[i]
        ));
    }
    
    // 重置道具箱
    ITEM_BOXES.forEach(box => box.active = true);
}

// 开始游戏
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    
    initGame();
    
    // 倒计时
    gameState = 'countdown';
    let count = 3;
    const countdownEl = document.getElementById('countdown');
    countdownEl.classList.remove('hidden');
    countdownEl.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
        } else if (count === 0) {
            countdownEl.textContent = 'GO!';
            countdownEl.style.color = '#4ade80';
        } else {
            clearInterval(countdownInterval);
            countdownEl.classList.add('hidden');
            countdownEl.style.color = '#FFD700';
            gameState = 'racing';
        }
    }, 1000);
}

// 结束游戏
function endGame() {
    gameState = 'finished';
    const player = karts.find(k => k.isPlayer);
    
    document.getElementById('gameOverScreen').classList.remove('hidden');
    
    let rankText = '';
    switch (player.rank) {
        case 1: rankText = '🥇 第一名！恭喜冠军！'; break;
        case 2: rankText = '🥈 第二名！表现不错！'; break;
        case 3: rankText = '🥉 第三名！再接再厉！'; break;
        default: rankText = `第${player.rank}名...下次加油！`; break;
    }
    document.getElementById('finalRank').textContent = rankText;
}

// 重新开始
function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    startGame();
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
            e.preventDefault();
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

// 摇杆状态
const joystick = {
    active: false,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    maxDistance: 45 // 摇杆最大移动距离
};

// 触摸控制支持 - 虚拟摇杆
function setupTouchControls() {
    const joystickBase = document.getElementById('joystickBase');
    const joystickKnob = document.getElementById('joystick');
    const gasButton = document.getElementById('gasButton');
    const brakeButton = document.getElementById('brakeButton');
    const itemButton = document.getElementById('itemButton');
    const driftButton = document.getElementById('driftButton');
    
    if (!joystickBase) return; // 如果元素不存在则退出
    
    // 获取摇杆底座中心位置
    function getJoystickCenter() {
        const rect = joystickBase.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }
    
    // 更新摇杆位置
    function updateJoystick(touchX, touchY) {
        const center = getJoystickCenter();
        let dx = touchX - center.x;
        let dy = touchY - center.y;
        
        // 计算距离和角度
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // 限制摇杆移动范围
        const clampedDistance = Math.min(distance, joystick.maxDistance);
        
        // 更新摇杆位置
        joystick.currentX = Math.cos(angle) * clampedDistance;
        joystick.currentY = Math.sin(angle) * clampedDistance;
        
        // 应用样式
        joystickKnob.style.transform = `translate(calc(-50% + ${joystick.currentX}px), calc(-50% + ${joystick.currentY}px))`;
        
        // 更新输入状态（归一化到 -1 到 1）
        joystick.deltaX = joystick.currentX / joystick.maxDistance;
        joystick.deltaY = joystick.currentY / joystick.maxDistance;
        
        // 设置方向键状态
        keys.left = joystick.deltaX < -0.3;
        keys.right = joystick.deltaX > 0.3;
        keys.up = joystick.deltaY < -0.3;
        keys.down = joystick.deltaY > 0.3;
    }
    
    // 重置摇杆
    function resetJoystick() {
        joystick.active = false;
        joystick.currentX = 0;
        joystick.currentY = 0;
        joystick.deltaX = 0;
        joystick.deltaY = 0;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        joystickKnob.classList.remove('active');
        
        keys.left = false;
        keys.right = false;
        keys.up = false;
        keys.down = false;
    }
    
    // 摇杆触摸事件
    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystick.active = true;
        joystickKnob.classList.add('active');
        const touch = e.touches[0];
        updateJoystick(touch.clientX, touch.clientY);
    }, { passive: false });
    
    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystick.active) {
            const touch = e.touches[0];
            updateJoystick(touch.clientX, touch.clientY);
        }
    }, { passive: false });
    
    joystickBase.addEventListener('touchend', (e) => {
        e.preventDefault();
        resetJoystick();
    });
    
    joystickBase.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        resetJoystick();
    });
    
    // 鼠标支持（用于桌面测试）
    let mouseDown = false;
    joystickBase.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mouseDown = true;
        joystick.active = true;
        joystickKnob.classList.add('active');
        updateJoystick(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', (e) => {
        if (mouseDown && joystick.active) {
            updateJoystick(e.clientX, e.clientY);
        }
    });
    
    window.addEventListener('mouseup', () => {
        if (mouseDown) {
            mouseDown = false;
            resetJoystick();
        }
    });
    
    // 添加按钮触摸事件
    const addButtonListeners = (element, key) => {
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[key] = true;
            element.classList.add('active');
        }, { passive: false });
        
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
            element.classList.remove('active');
        });
        
        element.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys[key] = false;
            element.classList.remove('active');
        });
        
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            keys[key] = true;
            element.classList.add('active');
        });
        
        element.addEventListener('mouseup', (e) => {
            e.preventDefault();
            keys[key] = false;
            element.classList.remove('active');
        });
        
        element.addEventListener('mouseleave', () => {
            keys[key] = false;
            element.classList.remove('active');
        });
    };
    
    // 绑定按钮
    if (gasButton) addButtonListeners(gasButton, 'up');
    if (brakeButton) addButtonListeners(brakeButton, 'down');
    if (itemButton) addButtonListeners(itemButton, 'space');
    if (driftButton) addButtonListeners(driftButton, 'shift');
    
    // 防止触摸时页面滚动
    document.body.addEventListener('touchmove', (e) => {
        if (e.target.closest('#touchControls')) {
            e.preventDefault();
        }
    }, { passive: false });
}

// 防止双指缩放
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
});

document.addEventListener('gestureend', (e) => {
    e.preventDefault();
});

// 初始化触摸控制
setupTouchControls();

// 启动游戏循环
requestAnimationFrame(gameLoop);
