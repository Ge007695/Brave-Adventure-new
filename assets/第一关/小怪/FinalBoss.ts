import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, AudioClip } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
import { PlayerDataManager } from '../../scripts/data/PlayerDataManager';
const { ccclass, property } = _decorator;

@ccclass('FinalBoss')
export class FinalBoss extends Component {
    // ── 精灵图 ──
    @property({ type: SpriteFrame, tooltip: 'BOSS正常精灵图' })
    normalSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'BOSS受击精灵图' })
    hitSprite: SpriteFrame | null = null;

    // ── 原子吐息攻击 ──
    @property({ type: SpriteFrame, tooltip: '原子吐息攻击图' })
    breathSprite: SpriteFrame | null = null;

    @property({ tooltip: '吐息伤害' })          breathDamage: number = 25;
    @property({ tooltip: '吐息范围(像素)' })    breathRange: number = 500;
    @property({ tooltip: '吐息冷却(秒)' })      breathCooldown: number = 2.5;
    @property({ tooltip: '吐息图显示时间(秒)' }) breathFlashDuration: number = 0.6;

    // ── 触手攻击 ──
    @property({ type: SpriteFrame, tooltip: '触手攻击图' })
    tentacleSprite: SpriteFrame | null = null;

    @property({ tooltip: '触手伤害' })          tentacleDamage: number = 15;
    @property({ tooltip: '触手范围(像素)' })    tentacleRange: number = 300;
    @property({ tooltip: '触手冷却(秒)' })      tentacleCooldown: number = 1.5;
    @property({ tooltip: '触手图显示时间(秒)' }) tentacleFlashDuration: number = 0.4;

    // ── 属性 ──
    @property({ tooltip: '最大血量' })          maxHp: number = 12;
    @property({ tooltip: '击败经验奖励' })       expReward: number = 100;
    @property({ tooltip: '击杀掉落金币' })       goldReward: number = 50;

    // ── 水平移动 ──
    @property({ tooltip: '移动速度(像素/秒)' })  moveSpeed: number = 200;
    @property({ tooltip: '最短移动(秒)' })        minMoveTime: number = 1.2;
    @property({ tooltip: '最长移动(秒)' })        maxMoveTime: number = 3.0;
    @property({ tooltip: '最短停顿(秒)' })        minIdleTime: number = 0.3;
    @property({ tooltip: '最长停顿(秒)' })        maxIdleTime: number = 1.5;
    @property({ tooltip: '移动左边界(世界X)' })  leftBound: number = 3840;
    @property({ tooltip: '移动右边界(世界X)' })  rightBound: number = 5000;

    // ── 跳跃 ──
    @property({ tooltip: '跳跃初速度' })          jumpForce: number = 500;
    @property({ tooltip: '重力加速度' })          gravity: number = 800;
    @property({ tooltip: '地面Y坐标' })           groundY: number = 360;
    @property({ tooltip: '最短跳跃间隔(秒)' })    minJumpInterval: number = 2.0;
    @property({ tooltip: '最长跳跃间隔(秒)' })    maxJumpInterval: number = 5.0;

    /** BOSS 攻击命中玩家时的音效 */
    @property({ type: AudioClip, tooltip: 'BOSS攻击命中玩家音效' })
    bossHitClip: AudioClip | null = null;

    @property({ tooltip: 'BOSS攻击音效音量 (0~1)', range: [0, 1, 0.01], slide: true })
    bossHitClipVolume: number = 1;

    // ── 受击 ──
    @property({ tooltip: '受击图显示时间(秒)' }) hitFlashDuration: number = 0.35;

    // ── 内部状态 ──
    private currentHp: number = 0;
    private isDead: boolean = false;
    private playerNode: Node | null = null;
    private initialized: boolean = false;

    private sprite: Sprite | null = null;
    private hpBarFill: Graphics | null = null;
    private hpLabel: Label | null = null;

    // 水平移动
    private moveDir: number = 1;
    private moveState: 'idle' | 'moving' = 'idle';
    private stateTimer: number = 0;

    // 垂直跳跃
    private velocityY: number = 0;
    private isGrounded: boolean = true;
    private jumpTimer: number = 0;
    private jumpCooldown: number = 3;

    // 受击计时器
    private hitTimer: number = 0;

    // 攻击冷却计时器
    private breathTimer: number = 0;
    private tentacleTimer: number = 0;
    // 攻击图闪烁
    private attackFlashTimer: number = 0;
    private flashAttackSprite: SpriteFrame | null = null;
    // 全局攻击锁：一次攻击后至少等这么久才能下一次
    private globalAttackLock: number = 0;

    // ── 初始化 ──
    public init(player: Node | null, left: number, right: number, gy: number) {
        this.playerNode = player;
        this.leftBound = left;
        this.rightBound = right;
        this.groundY = gy;
        this.doSetup();
    }

    start() {
        if (!this.initialized && this.currentHp <= 0) {
            this.doSetup();
        }
    }

    private doSetup() {
        if (this.initialized) return;
        this.initialized = true;

        this.currentHp = this.maxHp;
        this.breathTimer = this.breathCooldown * 0.5;
        this.tentacleTimer = this.tentacleCooldown * 0.3;
        this.isDead = false;
        this.attackFlashTimer = 0;
        this.flashAttackSprite = null;

        this.setupSprite();
        this.createHpBar();
        this.updateHpBar();
        this.addBossLabel();
        this.enterMoving();
        this.jumpTimer = 0;
        this.jumpCooldown = this.minJumpInterval + Math.random() * (this.maxJumpInterval - this.minJumpInterval);
    }

    // ── 每帧 ──
    update(deltaTime: number) {
        if (this.isDead || !this.initialized) return;

        // 冷却计时
        if (this.breathTimer > 0) this.breathTimer -= deltaTime;
        if (this.tentacleTimer > 0) this.tentacleTimer -= deltaTime;
        if (this.globalAttackLock > 0) this.globalAttackLock -= deltaTime;

        // 受击恢复
        this.updateHitSprite(deltaTime);

        // 攻击图闪烁恢复
        this.updateAttackFlash(deltaTime);

        // 攻击检测（全局锁防止连续攻击）
        const player = this.findPlayer();
        if (player && this.attackFlashTimer <= 0 && this.globalAttackLock <= 0) {
            const dist = this.getDistance(player);
            const breathReady = this.breathTimer <= 0 && dist <= this.breathRange;
            const tentacleReady = this.tentacleTimer <= 0 && dist <= this.tentacleRange;

            if (breathReady && tentacleReady) {
                // 两种都就绪时随机选
                if (Math.random() < 0.5) {
                    this.doBreathAttack(player);
                } else {
                    this.doTentacleAttack(player);
                }
            } else if (breathReady) {
                this.doBreathAttack(player);
            } else if (tentacleReady) {
                this.doTentacleAttack(player);
            }
        }

        // 水平移动 + 跳跃
        this.updateRoam(deltaTime);
        this.updateJump(deltaTime);

        // 保持朝向
        this.updateFacing();
    }

    // ── 精灵 ──
    private setupSprite() {
        // 先在自己身上找，再去子节点里找（兼容图片挂在子节点的情况）
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            for (const child of this.node.children) {
                const s = child.getComponent(Sprite);
                if (s) { this.sprite = s; break; }
            }
        }
        if (!this.sprite) this.sprite = this.node.addComponent(Sprite);
        if (this.normalSprite) this.sprite.spriteFrame = this.normalSprite;
        this.sprite.sizeMode = Sprite.SizeMode.TRIMMED;
    }

    // ── 标签 ──
    private addBossLabel() {
        const old = this.node.getChildByName('BossName');
        if (old && old.isValid) return;
        const n = new Node('BossName');
        this.node.addChild(n);
        n.setPosition(0, 555, 0);
        n.addComponent(UITransform).setContentSize(650, 100);
        const l = n.addComponent(Label);
        l.string = 'BOSS · 深海巨章';
        l.fontSize = 50;
        l.lineHeight = 80;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.color = new Color(255, 62, 72, 255);
    }

    // ── 水平移动 ──
    private updateRoam(dt: number) {
        if (this.moveState === 'idle') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) this.enterMoving();
            return;
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) { this.enterIdle(); return; }

        const wx = this.node.worldPosition.x;
        let nx = wx + this.moveDir * this.moveSpeed * dt;
        const margin = 80;
        const sl = this.leftBound + margin, sr = this.rightBound - margin;
        if (nx <= sl) { nx = sl; this.moveDir = 1; }
        if (nx >= sr) { nx = sr; this.moveDir = -1; }

        this.node.setWorldPosition(nx, this.node.worldPosition.y, this.node.worldPosition.z);
    }

    private enterMoving() {
        this.moveState = 'moving';
        this.moveDir = Math.random() > 0.5 ? 1 : -1;
        this.stateTimer = this.minMoveTime + Math.random() * (this.maxMoveTime - this.minMoveTime);
    }

    private enterIdle() {
        this.moveState = 'idle';
        this.stateTimer = this.minIdleTime + Math.random() * (this.maxIdleTime - this.minIdleTime);
    }

    // ── 跳跃 ──
    private updateJump(dt: number) {
        this.jumpTimer += dt;
        if (this.jumpTimer >= this.jumpCooldown && this.isGrounded) {
            this.velocityY = this.jumpForce;
            this.isGrounded = false;
            this.jumpTimer = 0;
            this.jumpCooldown = this.minJumpInterval + Math.random() * (this.maxJumpInterval - this.minJumpInterval);
        }

        this.velocityY -= this.gravity * dt;
        let ny = this.node.worldPosition.y + this.velocityY * dt;
        if (ny <= this.groundY) {
            ny = this.groundY;
            this.velocityY = 0;
            this.isGrounded = true;
        }

        this.node.setWorldPosition(this.node.worldPosition.x, ny, this.node.worldPosition.z);
    }

    // ── 朝向 ──
    private updateFacing() {
        const sx = this.node.scale.x;
        const base = Math.abs(sx);
        const target = this.moveDir > 0 ? base : -base;
        if (Math.abs(sx - target) > 0.001) {
            this.node.setScale(target, this.node.scale.y, this.node.scale.z);
            // 血条和名字始终正向显示，不被BOSS翻转
            const hpBar = this.node.getChildByName('BossHpBar');
            if (hpBar) hpBar.setScale(1 / target, 1, 1);
            const bossName = this.node.getChildByName('BossName');
            if (bossName) bossName.setScale(1 / target, 1, 1);
        }
    }

    // ── 原子吐息攻击 ──
    private doBreathAttack(player: Node) {
        this.breathTimer = this.breathCooldown * (0.7 + Math.random() * 0.6);
        this.globalAttackLock = 2.5 + Math.random() * 0.5;
        const stats = player.getComponent(PlayerStats);
        if (stats) stats.takeDamage(this.breathDamage, this.bossHitClip, this.bossHitClipVolume);
        this.flashAttack(this.breathSprite, this.breathFlashDuration);
        this.showBreathEffect(player);
    }

    // ── 触手攻击 ──
    private doTentacleAttack(player: Node) {
        this.tentacleTimer = this.tentacleCooldown * (0.7 + Math.random() * 0.6);
        this.globalAttackLock = 2.5 + Math.random() * 0.5;
        const stats = player.getComponent(PlayerStats);
        if (stats) stats.takeDamage(this.tentacleDamage, this.bossHitClip, this.bossHitClipVolume);
        this.flashAttack(this.tentacleSprite, this.tentacleFlashDuration);
        this.showTentacleEffect(player);
    }

    // ── 攻击图闪烁 ──
    private flashAttack(spriteFrame: SpriteFrame | null, duration: number) {
        if (!this.sprite || !spriteFrame) return;
        this.sprite.spriteFrame = spriteFrame;
        this.attackFlashTimer = duration;
        this.flashAttackSprite = spriteFrame;
    }

    private updateAttackFlash(dt: number) {
        if (this.attackFlashTimer <= 0) return;
        this.attackFlashTimer -= dt;
        if (this.attackFlashTimer <= 0 && this.sprite) {
            // 恢复：优先受击图，否则正常图
            if (this.hitTimer > 0 && this.hitSprite) {
                this.sprite.spriteFrame = this.hitSprite;
            } else if (this.normalSprite) {
                this.sprite.spriteFrame = this.normalSprite;
            }
            this.flashAttackSprite = null;
        }
    }

    // ── 吐息特效 ──
    private showBreathEffect(player: Node) {
        const dir = player.worldPosition.x > this.node.worldPosition.x ? 1 : -1;
        const bx = this.node.worldPosition.x + dir * 60;
        const by = this.node.worldPosition.y - 80;
        const z = this.node.worldPosition.z;
        const beamLen = 440;   // 水炮射程
        const beamW = 32;     // 水炮粗细

        // ── 1. 主水炮：多层叠加的椭圆光束 ──
        const layers = [
            { w: beamW + 20, h: 16, color: new Color(140, 210, 255, 100), dur: 0.55 },
            { w: beamW + 8,  h: 12, color: new Color(180, 230, 255, 200), dur: 0.65 },
            { w: beamW,      h: 8,  color: new Color(220, 245, 255, 250), dur: 0.75 },
        ];
        layers.forEach((layer, li) => {
            for (let i = 0; i < 4; i++) {
                const n = new Node('BeamSegment');
                this.node.parent?.addChild(n);
                const cx = bx + dir * (beamLen * (i + 0.5) / 4);
                n.setWorldPosition(cx, by, z);
                n.addComponent(UITransform).setContentSize(layer.w, layer.h);
                const g = n.addComponent(Graphics);
                g.fillColor = new Color(layer.color.r, layer.color.g, layer.color.b, layer.color.a - i * 20);
                g.ellipse(-layer.w / 2, -layer.h / 2, layer.w, layer.h); g.fill();
                this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, layer.dur + i * 0.06 + li * 0.05);
            }
        });

        // ── 2. 细密飞溅水珠 ──
        for (let i = 0; i < 25; i++) {
            const n = new Node('SplashDrop');
            this.node.parent?.addChild(n);
            const t = i / 24;
            const cx = bx + dir * beamLen * t;
            const cy = by + (Math.sin(t * Math.PI * 3) * 35 + (Math.random() - 0.5) * 50);
            n.setWorldPosition(cx, cy, z);
            const r = 3 + Math.random() * 4;
            n.addComponent(UITransform).setContentSize(r * 3, r * 3);
            const g = n.addComponent(Graphics);
            g.fillColor = new Color(180, 220, 255, 180 + Math.floor(Math.random() * 70));
            g.circle(0, 0, r); g.fill();
            g.strokeColor = new Color(220, 240, 255, 200);
            g.lineWidth = 0.5;
            g.circle(0, 0, r); g.stroke();
            this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.3 + Math.random() * 0.5);
        }

        // ── 3. 沿途飘洒气泡 ──
        for (let i = 0; i < 10; i++) {
            const n = new Node('Bubble');
            this.node.parent?.addChild(n);
            const t = Math.random();
            const cx = bx + dir * beamLen * t;
            const cy = by + (Math.random() - 0.5) * 100;
            n.setWorldPosition(cx, cy, z);
            const r = 2 + Math.random() * 6;
            n.addComponent(UITransform).setContentSize(r * 3, r * 3);
            const g = n.addComponent(Graphics);
            g.strokeColor = new Color(200, 235, 255, 130 + Math.floor(Math.random() * 80));
            g.lineWidth = 1.5;
            g.circle(0, 0, r); g.stroke();
            // 气泡高光
            g.fillColor = new Color(255, 255, 255, 100);
            g.circle(-r * 0.25, r * 0.3, r * 0.35); g.fill();
            // 气泡缓慢上飘
            const startY = cy;
            this.schedule(() => {
                if (!n || !n.isValid) return;
                const elapsed = (Date.now() * 0.001) % 1;
                n.setWorldPosition(n.worldPosition.x, startY + elapsed * 40, z);
                n.setScale(1 - elapsed * 0.3, 1 - elapsed * 0.3, 1);
            }, 0.03, 15); // 15次约0.45秒
            this.scheduleOnce(() => { if (n && n.isValid) { n.destroy(); } }, 0.8);
        }

        // ── 4. 落点环形溅射水环 ──
        for (let ring = 0; ring < 2; ring++) {
            const n = new Node('SplashRing');
            this.node.parent?.addChild(n);
            const hitX = bx + dir * beamLen;
            const hitY = by;
            n.setWorldPosition(hitX, hitY, z);
            n.addComponent(UITransform).setContentSize(200, 200);
            const g = n.addComponent(Graphics);
            const maxR = 30 + ring * 20;
            g.strokeColor = new Color(180, 220, 255, 220 - ring * 80);
            g.lineWidth = 4 + ring * 2;
            g.circle(0, 0, 10); g.stroke();
            // 环形扩散动画
            const startTime = Date.now();
            const duration = 0.5 + ring * 0.15;
            this.schedule(() => {
                if (!n || !n.isValid) return;
                const elapsed = (Date.now() - startTime) * 0.001;
                const progress = Math.min(1, elapsed / duration);
                g.clear();
                g.strokeColor = new Color(180, 220, 255, Math.floor((220 - ring * 80) * (1 - progress)));
                g.lineWidth = (4 + ring * 2) * (1 - progress * 0.5);
                g.circle(0, 0, 10 + progress * maxR); g.stroke();
            }, 0.016, 30);
            this.scheduleOnce(() => { if (n && n.isValid) { n.destroy(); } }, duration);
        }
    }

    // ── 触手特效（狂暴甩击·血雾猩红）──
    private showTentacleEffect(player: Node) {
        const dir = player.worldPosition.x > this.node.worldPosition.x ? 1 : -1;
        const bx = this.node.worldPosition.x;
        const by = this.node.worldPosition.y - 70;
        const z = this.node.worldPosition.z;

        // ══════════════════════════════════════
        // 1. 周身血雾蒸腾
        // ══════════════════════════════════════
        for (let i = 0; i < 20; i++) {
            const n = new Node('BloodMist');
            this.node.parent?.addChild(n);
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 120;
            n.setWorldPosition(bx + Math.cos(angle) * dist, by - 30 + Math.sin(angle) * dist * 0.7, z);
            const r = 6 + Math.random() * 16;
            n.addComponent(UITransform).setContentSize(r * 3, r * 3);
            const g = n.addComponent(Graphics);
            const a = 80 + Math.floor(Math.random() * 100);
            g.fillColor = new Color(160, 25, 40, a);
            g.circle(0, 0, r); g.fill();
            g.fillColor = new Color(200, 40, 55, Math.floor(a * 0.5));
            g.circle(0, 0, r * 0.5); g.fill();
            this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.4 + Math.random() * 0.5);
        }

        // ══════════════════════════════════════
        // 2. 多条粗壮腕足向四周狂暴甩击
        // ══════════════════════════════════════
        const tentacleCount = 5;
        for (let t = 0; t < tentacleCount; t++) {
            const angleOffset = (t - 2) * 0.35; // 扇形分布
            const sweepDist = 200 + Math.random() * 150;
            const segments = 6 + t;

            for (let seg = 0; seg < segments; seg++) {
                const n = new Node('Tentacle');
                this.node.parent?.addChild(n);
                const ratio = seg / (segments - 1);
                const cx = bx + dir * (50 + sweepDist * ratio) + (1 - ratio) * Math.sin(angleOffset) * 70;
                const cy = by + Math.sin(angleOffset) * 40 - ratio * 60 - Math.sin(ratio * Math.PI) * 50;
                n.setWorldPosition(cx, cy, z);
                const sw = 55 - ratio * 20;
                const sh = 36 - ratio * 10;
                n.addComponent(UITransform).setContentSize(sw + 30, sh + 20);
                const g = n.addComponent(Graphics);
                // 暗红肉质基底
                g.fillColor = new Color(50, 8, 18, 220 - ratio * 25);
                g.roundRect(-sw / 2, -sh / 2, sw, sh, sh / 2); g.fill();
                // 主体肉色
                g.fillColor = new Color(150, 22, 40, 235 - ratio * 20);
                g.roundRect(-sw / 2 + 3, -sh / 2 + 2, sw - 6, sh - 4, (sh - 4) / 2); g.fill();
                // 高光
                g.strokeColor = new Color(210, 55, 75, 180 - ratio * 15);
                g.lineWidth = 2;
                g.moveTo(-sw / 2 + 8, sh / 4);
                g.lineTo(sw / 2 - 8, sh / 4); g.stroke();
                this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.45 + ratio * 0.15 + t * 0.04);
            }

            // 每根触手上的吸盘
            for (let s = 0; s < 8; s++) {
                const n = new Node('Sucker');
                this.node.parent?.addChild(n);
                const ratio = Math.random();
                const sx = bx + dir * (50 + sweepDist * ratio) + (1 - ratio) * Math.sin(angleOffset) * 70;
                const sy = by + Math.sin(angleOffset) * 40 - ratio * 60 - Math.sin(ratio * Math.PI) * 50 + (Math.random() - 0.5) * 20;
                n.setWorldPosition(sx, sy, z);
                const r = 2 + Math.random() * 3.5;
                n.addComponent(UITransform).setContentSize(r * 3, r * 3);
                const sg = n.addComponent(Graphics);
                sg.fillColor = new Color(190, 140, 155, 170);
                sg.circle(0, 0, r); sg.fill();
                sg.strokeColor = new Color(100, 30, 45, 200);
                sg.lineWidth = 1;
                sg.circle(0, 0, r); sg.stroke();
                this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.3 + Math.random() * 0.4);
            }
        }

        // ══════════════════════════════════════
        // 3. 赤红溅射碎沫 + 暗红碎石炸裂
        // ══════════════════════════════════════
        for (let i = 0; i < 30; i++) {
            const n = new Node('Debris');
            this.node.parent?.addChild(n);
            const angle = -0.5 + Math.random() * 1.0; // 前方扇形
            const dist = 60 + Math.random() * 200;
            const dx = Math.cos(angle) * dist * dir;
            const dy = Math.sin(angle) * dist - 30;
            n.setWorldPosition(bx + dx, by + dy, z);
            const sz = 2 + Math.random() * 7;
            n.addComponent(UITransform).setContentSize(sz * 3, sz * 3);
            const g = n.addComponent(Graphics);
            const r = Math.random();
            if (r < 0.5) {
                // 碎石
                g.fillColor = new Color(80, 15, 20, 200 + Math.floor(Math.random() * 50));
                g.moveTo(-sz, 0); g.lineTo(0, sz); g.lineTo(sz, -sz * 0.3); g.close(); g.fill();
                g.strokeColor = new Color(200, 40, 30, 180);
                g.lineWidth = 0.8;
                g.moveTo(-sz, 0); g.lineTo(0, sz); g.lineTo(sz, -sz * 0.3); g.close(); g.stroke();
            } else {
                // 碎沫血滴
                g.fillColor = new Color(210, 35, 45, 190 + Math.floor(Math.random() * 60));
                g.ellipse(-sz, -sz * 0.5, sz * 2, sz); g.fill();
            }
            this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.35 + Math.random() * 0.5);
        }

        // ══════════════════════════════════════
        // 4. 碎石拖曳暗红火星轨迹
        // ══════════════════════════════════════
        for (let i = 0; i < 15; i++) {
            const n = new Node('Spark');
            this.node.parent?.addChild(n);
            const angle = -0.6 + Math.random() * 1.2;
            const dist = 80 + Math.random() * 160;
            n.setWorldPosition(bx + Math.cos(angle) * dist * dir, by + Math.sin(angle) * dist - 40, z);
            const r = 1 + Math.random() * 2.5;
            n.addComponent(UITransform).setContentSize(r * 3, r * 3);
            const sg = n.addComponent(Graphics);
            // 内核亮红
            sg.fillColor = new Color(255, 180, 60, 220);
            sg.circle(0, 0, r); sg.fill();
            // 外焰暗红
            sg.fillColor = new Color(220, 40, 30, 140);
            sg.circle(0, 0, r * 1.8); sg.fill();
            // 拖尾
            sg.strokeColor = new Color(200, 60, 20, 120);
            sg.lineWidth = 1;
            sg.moveTo(0, 0);
            sg.lineTo(-dir * (5 + Math.random() * 8), -(2 + Math.random() * 4));
            sg.stroke();
            this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.25 + Math.random() * 0.4);
        }

        // ══════════════════════════════════════
        // 5. 尖牙巨口（BOSS本体短暂切换）
        // ══════════════════════════════════════
        const jaw = new Node('FangedMaw');
        this.node.parent?.addChild(jaw);
        jaw.setWorldPosition(bx + dir * 80, by - 20, z);
        jaw.addComponent(UITransform).setContentSize(100, 80);
        const jg = jaw.addComponent(Graphics);
        // 口腔暗红
        jg.fillColor = new Color(40, 5, 10, 220);
        jg.ellipse(-40, -25, 80, 50); jg.fill();
        // 上牙
        for (let ti = -3; ti <= 3; ti++) {
            jg.fillColor = new Color(240, 230, 210, 230);
            jg.moveTo(ti * 10 - 4, 10);
            jg.lineTo(ti * 10, -18);
            jg.lineTo(ti * 10 + 4, 10);
            jg.close(); jg.fill();
            // 下牙
            jg.moveTo(ti * 10 - 3, -15);
            jg.lineTo(ti * 10, 14);
            jg.lineTo(ti * 10 + 3, -15);
            jg.close(); jg.fill();
        }
        this.scheduleOnce(() => { if (jaw && jaw.isValid) jaw.destroy(); }, 0.45);

        // ══════════════════════════════════════
        // 6. 环形赤红冲击波
        // ══════════════════════════════════════
        const shockwave = new Node('Shockwave');
        this.node.parent?.addChild(shockwave);
        shockwave.setWorldPosition(bx, by, z);
        shockwave.addComponent(UITransform).setContentSize(400, 400);
        const swG = shockwave.addComponent(Graphics);
        const swStart = Date.now();
        const swDur = 0.7;
        this.schedule(() => {
            if (!shockwave || !shockwave.isValid) return;
            const el = (Date.now() - swStart) * 0.001;
            const pct = Math.min(1, el / swDur);
            swG.clear();
            // 主冲击波
            swG.strokeColor = new Color(220, 35, 50, Math.floor(220 * (1 - pct)));
            swG.lineWidth = 8 * (1 - pct * 0.6);
            swG.circle(0, 0, 20 + pct * 170); swG.stroke();
            // 外层辉光
            swG.strokeColor = new Color(255, 70, 80, Math.floor(120 * (1 - pct)));
            swG.lineWidth = 18 * (1 - pct * 0.7);
            swG.circle(0, 0, 20 + pct * 170); swG.stroke();
        }, 0.016, 44);
        this.scheduleOnce(() => { if (shockwave && shockwave.isValid) shockwave.destroy(); }, swDur);

        // ══════════════════════════════════════
        // 7. 命中扇形猩红爆溅
        // ══════════════════════════════════════
        for (let b = 0; b < 3; b++) {
            const burst = new Node('Burst');
            this.node.parent?.addChild(burst);
            const hitX = bx + dir * 300;
            const hitY = by;
            burst.setWorldPosition(hitX, hitY, z);
            burst.addComponent(UITransform).setContentSize(200, 160);
            const bg = burst.addComponent(Graphics);
            const bStart = Date.now();
            const bDur = 0.4 + b * 0.12;
            this.schedule(() => {
                if (!burst || !burst.isValid) return;
                const el = (Date.now() - bStart) * 0.001;
                const pct = Math.min(1, el / bDur);
                bg.clear();
                const fanAngles = 20;
                for (let f = 0; f < fanAngles; f++) {
                    const spread = (-0.5 + f / (fanAngles - 1)) * 1.2;
                    const len = (30 + Math.random() * 60) * pct;
                    bg.strokeColor = new Color(230, 30 + f * 3, 40 + f * 2, Math.floor(200 * (1 - pct)));
                    bg.lineWidth = 1.5 + Math.random() * 2;
                    bg.moveTo(0, 0);
                    bg.lineTo(Math.cos(spread) * len * dir, Math.sin(spread) * len);
                    bg.stroke();
                }
            }, 0.016, 25 + b * 8);
            this.scheduleOnce(() => { if (burst && burst.isValid) burst.destroy(); }, bDur);
        }

        // ══════════════════════════════════════
        // 8. 星点水花四散浮空
        // ══════════════════════════════════════
        for (let i = 0; i < 25; i++) {
            const n = new Node('WaterStar');
            this.node.parent?.addChild(n);
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 180;
            n.setWorldPosition(bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist * 0.5 - 20, z);
            const r = 1 + Math.random() * 2.5;
            n.addComponent(UITransform).setContentSize(r * 4, r * 4);
            const wg = n.addComponent(Graphics);
            // 水花星形
            wg.fillColor = new Color(220, 180, 190, 160 + Math.floor(Math.random() * 80));
            for (let p = 0; p < 4; p++) {
                const pa = (Math.PI / 2) * p + Math.random() * 0.3;
                wg.moveTo(0, 0);
                wg.lineTo(Math.cos(pa) * r * 1.5, Math.sin(pa) * r * 1.5);
            }
            wg.fill();
            this.scheduleOnce(() => { if (n && n.isValid) n.destroy(); }, 0.4 + Math.random() * 0.5);
        }

        // ══════════════════════════════════════
        // 9. 赤红尾迹弧线
        // ══════════════════════════════════════
        for (let i = 0; i < 5; i++) {
            const arc = new Node('TrailArc');
            this.node.parent?.addChild(arc);
            arc.setWorldPosition(bx, by - 30, z);
            arc.addComponent(UITransform).setContentSize(250, 120);
            const ag = arc.addComponent(Graphics);
            const x0 = dir * 30, y0 = 10;
            ag.strokeColor = new Color(200, 35, 45, 100 - i * 18);
            ag.lineWidth = 4 + i * 1.5;
            ag.moveTo(x0, y0);
            ag.quadraticCurveTo(dir * 120, -20 + i * 15, dir * 200, -5 + i * 8);
            ag.stroke();
            ag.strokeColor = new Color(255, 60, 70, 70 - i * 12);
            ag.lineWidth = 1.5;
            ag.moveTo(x0, y0);
            ag.quadraticCurveTo(dir * 120, -20 + i * 15, dir * 200, -5 + i * 8);
            ag.stroke();
            this.scheduleOnce(() => { if (arc && arc.isValid) arc.destroy(); }, 0.35 + i * 0.07);
        }
    }

    // ── 受击 ──
    public takeDamage(dmg: number) {
        if (this.isDead || !this.initialized) return;
        this.currentHp = Math.max(0, this.currentHp - Math.max(1, dmg));
        this.updateHpBar();
        console.log(`[FinalBoss] 受击 dmg=${dmg} hp=${this.currentHp}/${this.maxHp}`);
        if (this.currentHp > 0) {
            this.showHitSprite();
        }
        if (this.currentHp <= 0) this.die();
    }

    public takeHit() { this.takeDamage(1); }

    private showHitSprite() {
        console.log(`[FinalBoss] showHitSprite sprite=${!!this.sprite} hitSprite=${!!this.hitSprite}`);
        if (!this.sprite || !this.hitSprite) return;
        this.sprite.spriteFrame = this.hitSprite;
        this.hitTimer = this.hitFlashDuration;
        console.log(`[FinalBoss] 切到受击图, hitTimer=${this.hitTimer}`);
    }

    private updateHitSprite(dt: number) {
        if (this.hitTimer <= 0) return;
        if (!this.sprite) {
            console.log(`[FinalBoss] ⚠️ updateHitSprite: sprite为null!`);
            return;
        }
        this.hitTimer -= dt;
        console.log(`[FinalBoss] updateHitSprite hitTimer=${this.hitTimer.toFixed(3)} normalSprite=${!!this.normalSprite}`);
        if (this.hitTimer <= 0 && this.normalSprite) {
            this.sprite.spriteFrame = this.normalSprite;
            console.log(`[FinalBoss] ✅ 恢复到正常图`);
        }
    }

    // ── 攻击判定 ──
    public getAttackHitPosition(): { x: number; y: number } {
        const p = this.node.worldPosition;
        return { x: p.x, y: p.y - 120 };
    }
    public getAttackHitRangeX(): number { return 320; }
    public getAttackHitRangeY(): number { return 260; }

    // ── 血条 ──
    private createHpBar() {
        const old = this.node.getChildByName('BossHpBar');
        if (old && old.isValid) old.destroy();
        const bw = 260, bh = 30;
        const bar = new Node('BossHpBar');
        this.node.addChild(bar);
        bar.setPosition(0, 500, 0);
        bar.addComponent(UITransform).setContentSize(bw, 50);

        const bg = bar.addComponent(Graphics);
        bg.fillColor = new Color(8, 8, 20, 220);
        bg.rect(-bw / 2, -bh / 2, bw, bh); bg.fill();
        bg.strokeColor = new Color(230, 50, 62, 255);
        bg.lineWidth = 2;
        bg.rect(-bw / 2, -bh / 2, bw, bh); bg.stroke();

        const fill = new Node('BossHpFill');
        bar.addChild(fill);
        fill.setPosition(-bw / 2, 0, 0);
        const ft = fill.addComponent(UITransform);
        ft.setContentSize(bw, bh); ft.setAnchorPoint(0, 0.5);
        this.hpBarFill = fill.addComponent(Graphics);

        const lbl = new Node('BossHpText');
        bar.addChild(lbl);
        lbl.setPosition(0, 24, 0);
        lbl.addComponent(UITransform).setContentSize(bw, 24);
        this.hpLabel = lbl.addComponent(Label);
        this.hpLabel.fontSize = 18;
        this.hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.hpLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.hpLabel.color = new Color(255, 245, 220, 255);
    }

    private updateHpBar() {
        if (!this.hpBarFill || !this.hpLabel) return;
        const bw = 260, bh = 18;
        const pct = Math.max(0, this.currentHp / this.maxHp);
        this.hpBarFill.clear();
        this.hpBarFill.fillColor = pct > 0.35 ? new Color(230, 45, 62, 255) : new Color(255, 132, 45, 255);
        this.hpBarFill.rect(0, -bh / 2, bw * pct, bh);
        this.hpBarFill.fill();
        this.hpLabel.string = `${this.currentHp}/${this.maxHp}`;
    }

    // ── 死亡 ──
    private die() {
        if (this.isDead) return;
        this.isDead = true;
        this.addExp();
        this.dropGold();
        this.node.active = false;
    }

    private dropGold(): void {
        if (this.goldReward <= 0) return;
        PlayerDataManager.getInstance().addGold(this.goldReward);
        this.tryUpdateBagGold();
    }

    private tryUpdateBagGold(): void {
        let node: Node | null = this.node;
        while (node && node.parent) node = node.parent;
        if (node) {
            const bag = (node as any).getComponent('BagManager');
            if (bag && typeof bag.syncGoldFromPDM === 'function') {
                bag.syncGoldFromPDM();
            }
        }
    }

    private addExp() {
        const p = this.findPlayer();
        if (!p) return;
        const s = p.getComponent(PlayerStats);
        if (s) s.addExperience(this.expReward);
    }

    // ── 查找玩家 ──
    private findPlayer(): Node | null {
        if (this.playerNode && this.playerNode.isValid) return this.playerNode;
        let root = this.node;
        while (root.parent) root = root.parent;
        this.playerNode = this.searchPlayer(root);
        return this.playerNode;
    }

    private searchPlayer(node: Node): Node | null {
        if (node.getComponent('move')) return node;
        for (const c of node.children) {
            const f = this.searchPlayer(c);
            if (f) return f;
        }
        return null;
    }

    private getDistance(t: Node): number {
        const a = this.getAttackHitPosition();
        const b = t.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}
