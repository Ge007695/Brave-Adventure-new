import { _decorator, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { PlayerStats } from './PlayerStats';
const { ccclass, property } = _decorator;

@ccclass('FinalBoss')
export class FinalBoss extends Component {
    // ── 精灵图 ──
    @property({ type: SpriteFrame, tooltip: 'BOSS正常精灵图' })
    normalSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'BOSS受击精灵图' })
    hitSprite: SpriteFrame | null = null;

    // ── 属性 ──
    @property({ tooltip: '最大血量' })          maxHp: number = 12;
    @property({ tooltip: '每次攻击伤害' })       damage: number = 18;
    @property({ tooltip: '攻击冷却(秒)' })       attackCooldown: number = 1.2;
    @property({ tooltip: '攻击范围(像素)' })     attackRange: number = 360;
    @property({ tooltip: '击败经验奖励' })       expReward: number = 10;

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

    // ── 受击 ──
    @property({ tooltip: '受击图显示时间(秒)' }) hitFlashDuration: number = 0.35;

    // ── 内部状态 ──
    private currentHp: number = 0;
    private attackTimer: number = 0;
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
        this.attackTimer = this.attackCooldown * 0.5;
        this.isDead = false;

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

        // 攻击冷却
        if (this.attackTimer > 0) this.attackTimer -= deltaTime;

        // 受击恢复
        this.updateHitSprite(deltaTime);

        // 攻击检测
        const player = this.findPlayer();
        if (player && this.attackTimer <= 0) {
            if (this.getDistance(player) <= this.attackRange) {
                this.attack(player);
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
        n.setPosition(0, 320, 0);
        n.addComponent(UITransform).setContentSize(300, 64);
        const l = n.addComponent(Label);
        l.string = 'BOSS · 深海巨章';
        l.fontSize = 36;
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
        }
    }

    // ── 攻击 ──
    private attack(player: Node) {
        this.attackTimer = this.attackCooldown;
        const stats = player.getComponent(PlayerStats);
        if (stats) stats.takeDamage(this.damage);
        this.showAttackPulse();
    }

    private showAttackPulse() {
        const p = new Node('BossAttackPulse');
        this.node.addChild(p);
        p.setPosition(0, -180, 0);
        p.addComponent(UITransform).setContentSize(360, 110);
        const g = p.addComponent(Graphics);
        g.fillColor = new Color(255, 42, 70, 70);
        g.rect(-180, -55, 360, 110); g.fill();
        g.strokeColor = new Color(255, 80, 90, 180);
        g.lineWidth = 3;
        g.rect(-180, -55, 360, 110); g.stroke();
        this.scheduleOnce(() => { if (p && p.isValid) p.destroy(); }, 0.18);
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
        const bw = 300, bh = 18;
        const bar = new Node('BossHpBar');
        this.node.addChild(bar);
        bar.setPosition(0, 260, 0);
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
        const bw = 300, bh = 18;
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
        this.node.active = false;
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
