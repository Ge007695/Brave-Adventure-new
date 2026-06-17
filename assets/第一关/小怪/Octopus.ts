import { _decorator, Component, ERaycast2DType, PhysicsSystem2D, Sprite, SpriteFrame, Node, Color, UITransform, Label, Graphics, Vec2 } from 'cc';
import { GameOverUI } from './GameOverUI';
import { PlayerStats } from '../人物/PlayerStats';
import { InkBullet } from './InkBullet';

const { ccclass, property } = _decorator;

@ccclass('Octopus')
export class Octopus extends Component {
    @property(SpriteFrame) octopusSprite: SpriteFrame | null = null;
    @property(SpriteFrame) hitSprite: SpriteFrame | null = null;
    @property(SpriteFrame) inkSprite: SpriteFrame | null = null;
    @property({ tooltip: '受击状态显示时间(秒)' }) hitDuration: number = 0.2;
    @property({ type: GameOverUI }) gameOverUI: GameOverUI | null = null;

    @property expReward: number = 10;
    @property maxHp: number = 3;

    @property({ tooltip: '移动速度(像素/秒)' }) moveSpeedX: number = 80;
    @property({ tooltip: '世界左边界' }) leftBound: number = 100;
    @property({ tooltip: '世界右边界' }) rightBound: number = 1180;
    @property({ tooltip: '距边界多少像素回头' }) boundaryMargin: number = 60;
    @property({ tooltip: '最短移动时间(秒)' }) minMoveTime: number = 1.0;
    @property({ tooltip: '最长移动时间(秒)' }) maxMoveTime: number = 3.0;
    @property({ tooltip: '最短停顿时间(秒)' }) minIdleTime: number = 0.3;
    @property({ tooltip: '最长停顿时间(秒)' }) maxIdleTime: number = 1.0;
    @property({ tooltip: '随机目标至少离当前多远(像素)' }) minRoamDistance: number = 120;
    @property({ tooltip: '距离目标多近算到达(像素)' }) arriveDistance: number = 4;

    @property jumpForce: number = 400;
    @property gravity: number = 800;
    @property({ tooltip: '世界地面Y坐标' }) groundY: number = 100;
    @property({ tooltip: '跳跃最短间隔(秒)' }) minJumpInterval: number = 2.0;
    @property({ tooltip: '跳跃最长间隔(秒)' }) maxJumpInterval: number = 5.0;

    @property({ tooltip: '世界坐标攻击范围' }) attackRange: number = 300;
    @property({ tooltip: '攻击冷却(秒)' }) attackCooldown: number = 1.5;
    @property({ tooltip: '墨球命中伤害' }) attackDamage: number = 10;
    @property({ tooltip: '每次喷吐墨球数量' }) inkBulletCount: number = 3;
    @property({ tooltip: '墨球速度(像素/秒)' }) inkBulletSpeed: number = 320;
    @property({ tooltip: '三颗墨球之间的Y轴间距' }) inkBulletSpreadY: number = 28;
    @property({ tooltip: '墨球出生点X偏移' }) inkSpawnOffsetX: number = 70;
    @property({ tooltip: '墨球出生点Y偏移' }) inkSpawnOffsetY: number = 10;
    @property({ tooltip: '墨球显示缩放' }) inkBulletScale: number = 0.55;
    @property({ tooltip: '墨球命中半径' }) inkHitRange: number = 45;
    @property({ tooltip: '玩家身上墨迹持续时间(秒)' }) inkEffectDuration: number = 0.8;
    @property({ tooltip: '玩家身上墨迹缩放' }) inkEffectScale: number = 0.9;
    @property({ tooltip: '场上最多保留墨球数量' }) maxInkBullets: number = 12;

    private currentHp: number = 3;
    private hpBarBg: Node | null = null;
    private hpBarFill: Graphics | null = null;
    private hpLabel: Label | null = null;

    private sprite: Sprite | null = null;
    private normalSpriteFrame: SpriteFrame | null = null;
    private hitTimer: number = 0;
    private playerNode: Node | null = null;

    private isDead: boolean = false;
    private velocityY: number = 0;
    private isGrounded: boolean = true;

    private roamDir: number = 1;
    private faceDir: number = 1;
    private attackFaceLeft: number = 0;

    private moveState: 'idle' | 'moving' = 'idle';
    private stateTimer: number = 0;
    private targetX: number = 0;

    private jumpTimer: number = 0;
    private jumpCooldown: number = 3;

    private attackTimer: number = 0;
    private inkBullets: Node[] = [];

    private get worldX(): number {
        return this.node.worldPosition.x;
    }

    private get worldY(): number {
        return this.node.worldPosition.y;
    }

    start() {
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('Octopus 缺少 Sprite 组件');
            return;
        }

        if (this.octopusSprite) {
            this.sprite.spriteFrame = this.octopusSprite;
        }
        this.normalSpriteFrame = this.sprite.spriteFrame;

        this.currentHp = this.maxHp;
        this.createHpBar();

        const [sl, sr] = this.getSafeBounds();
        this.setWorldX(this.clamp(this.worldX, sl, sr));
        this.setWorldY(Math.max(this.worldY, this.groundY));

        this.attackTimer = this.randomRange(0, this.attackCooldown);
        this.jumpTimer = 0;
        this.jumpCooldown = this.randomRange(this.minJumpInterval, this.maxJumpInterval);

        this.enterMoving();
    }

    update(dt: number) {
        if (!this.sprite || this.isDead) return;

        this.attackTimer += dt;
        this.jumpTimer += dt;
        this.updateHitSprite(dt);

        if (this.attackFaceLeft > 0) {
            this.attackFaceLeft -= dt;
            if (this.attackFaceLeft <= 0) {
                this.faceDir = this.roamDir;
            }
        }

        const player = this.findPlayer();
        if (player) {
            const dist = this.getDist(player);
            if (dist < this.attackRange && this.attackTimer >= this.attackCooldown) {
                this.doAttack(player);
            }
        }

        this.updateRoam(dt);
        this.updateJump(dt);
        this.updateFacing();
        this.syncHpBarPosition();
    }

    private updateRoam(dt: number) {
        const [sl, sr] = this.getSafeBounds();

        if (this.moveState === 'idle') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.enterMoving();
            }
            return;
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.enterIdle();
            return;
        }

        const wx = this.worldX;
        let nx = wx + this.roamDir * this.moveSpeedX * dt;

        const reachedTarget = this.roamDir > 0
            ? nx >= this.targetX
            : nx <= this.targetX;

        if (reachedTarget) {
            nx = this.targetX;
        }

        nx = this.clamp(nx, sl, sr);
        this.setWorldX(nx);

        if (reachedTarget || nx <= sl || nx >= sr) {
            this.enterIdle();
        }
    }

    private enterMoving() {
        this.moveState = 'moving';

        const [sl, sr] = this.getSafeBounds();
        const wx = this.clamp(this.worldX, sl, sr);
        this.setWorldX(wx);

        this.targetX = this.pickRoamTargetX(wx, sl, sr);

        if (Math.abs(this.targetX - wx) <= this.arriveDistance) {
            this.enterIdle();
            return;
        }

        this.roamDir = this.targetX > wx ? 1 : -1;

        if (this.attackFaceLeft <= 0) {
            this.faceDir = this.roamDir;
        }

        this.stateTimer = this.randomRange(this.minMoveTime, this.maxMoveTime);
    }

    private enterIdle() {
        this.moveState = 'idle';
        this.stateTimer = this.randomRange(this.minIdleTime, this.maxIdleTime);
    }

    private pickRoamTargetX(wx: number, sl: number, sr: number): number {
        const width = sr - sl;
        if (width <= 0) return sl;

        const minDistance = Math.min(this.minRoamDistance, width * 0.5);
        let target = this.randomRange(sl, sr);

        for (let i = 0; i < 8 && Math.abs(target - wx) < minDistance; i++) {
            target = this.randomRange(sl, sr);
        }

        if (Math.abs(target - wx) <= this.arriveDistance) {
            target = wx < (sl + sr) * 0.5 ? sr : sl;
        }

        return this.clamp(target, sl, sr);
    }

    private updateJump(dt: number) {
        if (this.jumpTimer >= this.jumpCooldown && this.isGrounded) {
            this.doJump();
            this.jumpTimer = 0;
            this.jumpCooldown = this.randomRange(this.minJumpInterval, this.maxJumpInterval);
        }

        this.velocityY -= this.gravity * dt;

        let ny = this.worldY + this.velocityY * dt;
        if (ny <= this.groundY) {
            ny = this.groundY;
            this.velocityY = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        this.setWorldY(ny);
    }

    private doJump() {
        if (!this.isGrounded) return;

        // 射线检测头上有没有平台障碍物，防止穿墙
        const from = this.node.worldPosition.clone();
        const to = new Vec2(from.x, from.y + 200);
        const hits = PhysicsSystem2D.instance.raycast(from, to, ERaycast2DType.Closest);
        if (hits.length > 0) {
            const ceilingY = hits[0].point.y;
            const clearance = ceilingY - from.y;
            // 头上空间不够跳跃高度，就缩减跳跃力度甚至取消
            if (clearance < 40) {
                return; // 头顶太低，不跳
            }
            // 缩减跳跃力，让它刚好不撞头
            const maxReach = Math.sqrt(2 * this.gravity * clearance);
            this.velocityY = Math.min(this.jumpForce, maxReach * 0.85);
        } else {
            this.velocityY = this.jumpForce;
        }
        this.isGrounded = false;
    }

    private updateFacing() {
        const sx = this.node.scale.x;
        const targetScaleX = this.faceDir > 0 ? Math.abs(sx) : -Math.abs(sx);

        if (Math.abs(sx - targetScaleX) > 0.001) {
            this.node.setScale(targetScaleX, this.node.scale.y, this.node.scale.z);
        }

        // 血条永远正面显示，不被章鱼翻转影响
        if (this.hpBarBg && this.hpBarBg.isValid) {
            const barScaleX = this.node.scale.x > 0 ? 1 : -1;
            this.hpBarBg.setScale(barScaleX, 1, 1);
        }
    }

    /** 同步血条世界坐标并确保渲染在最上层 */
    private syncHpBarPosition() {
        if (!this.hpBarBg || !this.hpBarBg.isValid) return;
        const pos = this.node.worldPosition;
        this.hpBarBg.setWorldPosition(pos.x, pos.y + 95, pos.z);
        // 始终保持为最后一个子节点，确保不被平台遮挡
        const parent = this.hpBarBg.parent;
        if (parent && this.hpBarBg.getSiblingIndex() < parent.children.length - 1) {
            this.hpBarBg.setSiblingIndex(parent.children.length - 1);
        }
    }

    private updateHitSprite(dt: number) {
        if (!this.sprite || this.hitTimer <= 0) return;

        this.hitTimer -= dt;
        if (this.hitTimer <= 0 && this.normalSpriteFrame) {
            this.sprite.spriteFrame = this.normalSpriteFrame;
        }
    }

    private showHitSprite() {
        if (!this.sprite || !this.hitSprite) return;

        this.sprite.spriteFrame = this.hitSprite;
        this.hitTimer = this.hitDuration;
    }

    private doAttack(player: Node) {
        this.attackTimer = 0;

        const dir = player.worldPosition.x > this.worldX ? 1 : -1;
        this.faceDir = dir;
        this.attackFaceLeft = 0.4;

        this.fireInkBurst(dir);
    }

    private fireInkBurst(dir: number) {
        if (!this.inkSprite) {
            console.warn('Octopus 缺少 inkSprite，无法生成墨球');
            return;
        }

        const parent = this.getBulletParent();
        const count = Math.max(1, Math.floor(this.inkBulletCount));
        const totalSpreadY = (count - 1) * this.inkBulletSpreadY;

        for (let i = 0; i < count; i++) {
            if (this.inkBullets.length >= this.maxInkBullets) {
                const oldInk = this.inkBullets.shift();
                if (oldInk && oldInk.isValid) {
                    oldInk.destroy();
                }
            }

            const offsetY = i * this.inkBulletSpreadY - totalSpreadY * 0.5;
            const ink = new Node('InkBullet');
            parent.addChild(ink);
            ink.setWorldPosition(
                this.worldX + dir * this.inkSpawnOffsetX,
                this.worldY + this.inkSpawnOffsetY + offsetY,
                this.node.worldPosition.z
            );
            ink.setScale(this.inkBulletScale, this.inkBulletScale, 1);

            const transform = ink.addComponent(UITransform);
            transform.setContentSize(78, 100);

            const sprite = ink.addComponent(Sprite);
            sprite.spriteFrame = this.inkSprite;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const bullet = ink.addComponent(InkBullet);
            bullet.init(
                dir,
                this,
                this.attackDamage,
                this.inkBulletSpeed,
                this.inkSprite,
                this.inkEffectDuration,
                this.inkHitRange,
                this.inkEffectScale
            );

            this.inkBullets.push(ink);
        }
    }

    private getBulletParent(): Node {
        let parent = this.node;
        while (parent.parent && parent.parent.parent) {
            parent = parent.parent;
        }
        return parent;
    }

    private createHpBar() {
        const barWidth = 80;
        const barHeight = 10;

        // ── 血条挂在 Canvas 上（渲染在最上层，不被翻转影响，不被平台遮挡）──
        this.hpBarBg = new Node('HpBarBg');
        const canvas = this.node.parent;
        if (canvas) {
            canvas.addChild(this.hpBarBg);
            this.hpBarBg.setSiblingIndex(canvas.children.length - 1);
        }
        this.hpBarBg.setWorldPosition(
            this.node.worldPosition.x,
            this.node.worldPosition.y + 95,
            this.node.worldPosition.z,
        );

        const bgTransform = this.hpBarBg.addComponent(UITransform);
        bgTransform.setContentSize(barWidth, barHeight);

        // 黑色半透明背景
        const bgGfx = this.hpBarBg.addComponent(Graphics);
        bgGfx.fillColor = new Color(0, 0, 0, 200);
        bgGfx.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
        bgGfx.fill();

        // 灰色边框
        bgGfx.strokeColor = new Color(100, 100, 100, 255);
        bgGfx.lineWidth = 1;
        bgGfx.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
        bgGfx.stroke();

        // ── 红色血量填充条（锚点左对齐，受伤时从右侧缩短）──
        const hpFillNode = new Node('HpBarFill');
        this.hpBarBg.addChild(hpFillNode);
        hpFillNode.setPosition(-barWidth / 2, 0, 0);

        const fillTransform = hpFillNode.addComponent(UITransform);
        fillTransform.setContentSize(barWidth, barHeight);
        fillTransform.setAnchorPoint(0, 0.5);

        this.hpBarFill = hpFillNode.addComponent(Graphics);
        this.drawFillRect(barWidth, barHeight, new Color(80, 200, 60, 255));

        // ── 血量数字标签（显示在血条上方）──
        const labelNode = new Node('HpLabel');
        this.hpBarBg.addChild(labelNode);
        labelNode.setPosition(0, barHeight / 2 + 6, 0);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(barWidth, 16);

        this.hpLabel = labelNode.addComponent(Label);
        this.hpLabel.string = `${this.currentHp}/${this.maxHp}`;
        this.hpLabel.fontSize = 12;
        this.hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.hpLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.hpLabel.color = new Color(255, 255, 255, 255);
    }

    /** 在 hpBarFill 中绘制指定宽度的实心矩形 */
    private drawFillRect(width: number, height: number, color: Color) {
        if (!this.hpBarFill) return;
        this.hpBarFill.clear();
        this.hpBarFill.fillColor = color;
        // 锚点 (0, 0.5)，原点在左中，从 (0, -h/2) 向右画
        this.hpBarFill.rect(0, -height / 2, width, height);
        this.hpBarFill.fill();
    }

    private updateHpBar() {
        if (!this.hpBarFill || !this.hpLabel) return;

        const barWidth = 80;
        const barHeight = 10;
        const percent = Math.max(0, this.currentHp / this.maxHp);

        // 血量颜色渐变：绿(健康) → 橙(中等) → 红(危险)
        let fillColor: Color;
        if (percent > 0.6) {
            fillColor = new Color(80, 200, 60, 255);
        } else if (percent > 0.3) {
            fillColor = new Color(255, 180, 40, 255);
        } else {
            fillColor = new Color(255, 60, 40, 255);
        }

        this.drawFillRect(barWidth * percent, barHeight, fillColor);
        this.hpLabel.string = `${Math.max(0, this.currentHp)}/${this.maxHp}`;
    }

    public takeDamage(damage: number) {
        if (this.isDead) return;

        this.currentHp -= damage;
        this.updateHpBar();

        if (this.currentHp > 0) {
            this.showHitSprite();
        }

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    public takeHit() {
        this.takeDamage(1);
    }

    public removeInkBullet(ink: Node) {
        const index = this.inkBullets.indexOf(ink);
        if (index > -1) {
            this.inkBullets.splice(index, 1);
        }

        if (ink && ink.isValid) {
            ink.destroy();
        }
    }

    private die() {
        if (this.isDead) return;

        this.isDead = true;
        this.addExp();

        for (const ink of this.inkBullets) {
            if (ink && ink.isValid) {
                ink.destroy();
            }
        }

        this.inkBullets = [];
        // 隐藏血条（血条是父节点的子节点，章鱼 deactive 不会自动隐藏它）
        if (this.hpBarBg && this.hpBarBg.isValid) {
            this.hpBarBg.active = false;
        }
        this.node.active = false;
    }

    private addExp() {
        const player = this.findPlayer();
        if (!player) return;

        let stats = player.getComponent(PlayerStats);
        if (!stats) {
            stats = player.addComponent(PlayerStats);
        }

        stats.addExperience(this.expReward);
    }

    private findPlayer(): Node | null {
        if (this.playerNode && this.playerNode.isValid) {
            return this.playerNode;
        }

        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }

        this.playerNode = this.searchForPlayer(root);
        return this.playerNode;
    }

    private searchForPlayer(node: Node): Node | null {
        if (node.getComponent('move')) {
            return node;
        }

        for (const child of node.children) {
            const found = this.searchForPlayer(child);
            if (found) return found;
        }

        return null;
    }

    private getDist(target: Node): number {
        const a = this.node.worldPosition;
        const b = target.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    private getSafeBounds(): [number, number] {
        const left = Math.min(this.leftBound, this.rightBound);
        const right = Math.max(this.leftBound, this.rightBound);

        let sl = left + this.boundaryMargin;
        let sr = right - this.boundaryMargin;

        if (sl > sr) {
            const mid = (left + right) * 0.5;
            sl = mid;
            sr = mid;
        }

        return [sl, sr];
    }

    private setWorldX(x: number) {
        const wp = this.node.worldPosition;
        this.node.setWorldPosition(x, wp.y, wp.z);
    }

    private setWorldY(y: number) {
        const wp = this.node.worldPosition;
        this.node.setWorldPosition(wp.x, y, wp.z);
    }

    private randomRange(min: number, max: number): number {
        if (max < min) {
            const temp = min;
            min = max;
            max = temp;
        }

        return min + Math.random() * (max - min);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    protected onDestroy() {
        for (const ink of this.inkBullets) {
            if (ink && ink.isValid) {
                ink.destroy();
            }
        }
        this.inkBullets = [];

        if (this.hpBarBg && this.hpBarBg.isValid) {
            this.hpBarBg.destroy();
        }
    }
}
