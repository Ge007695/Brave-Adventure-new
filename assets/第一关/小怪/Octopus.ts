import { _decorator, Component, Sprite, SpriteFrame, Node, Color, UITransform } from 'cc';
import { GameOverUI } from './GameOverUI';
import { PlayerStats } from '../人物/PlayerStats';
import { InkBullet } from './InkBullet';
const { ccclass, property } = _decorator;

@ccclass('Octopus')
export class Octopus extends Component {
    @property(SpriteFrame) octopusSprite: SpriteFrame | null = null;
    @property({ type: GameOverUI }) gameOverUI: GameOverUI | null = null;
    @property expReward: number = 1;
    @property maxHp: number = 1;

    // ===== 移动（全部世界坐标） =====
    @property({ tooltip: '移动速度(像素/秒)' }) moveSpeedX: number = 80;
    @property({ tooltip: '世界左边界' }) leftBound: number = 100;
    @property({ tooltip: '世界右边界' }) rightBound: number = 1180;
    @property({ tooltip: '距边界多少像素回头' }) boundaryMargin: number = 60;
    @property({ tooltip: '最短移动时间(秒)' }) minMoveTime: number = 1.0;
    @property({ tooltip: '最长移动时间(秒)' }) maxMoveTime: number = 3.0;
    @property({ tooltip: '最短停顿时间(秒)' }) minIdleTime: number = 0.3;
    @property({ tooltip: '最长停顿时间(秒)' }) maxIdleTime: number = 1.0;

    // ===== 跳跃 =====
    @property jumpForce: number = 400;
    @property gravity: number = 800;
    @property({ tooltip: '世界地面Y坐标' }) groundY: number = 100;
    @property({ tooltip: '跳跃最短间隔(秒)' }) minJumpInterval: number = 2.0;
    @property({ tooltip: '跳跃最长间隔(秒)' }) maxJumpInterval: number = 5.0;

    // ===== 攻击 =====
    @property({ tooltip: '世界坐标攻击范围' }) attackRange: number = 300;
    @property({ tooltip: '攻击冷却(秒)' }) attackCooldown: number = 1.5;

    // ===== 内部状态 =====
    private sprite: Sprite | null = null;
    private isDead: boolean = false;
    private velocityY: number = 0;
    private isGrounded: boolean = true;

    // 漫游方向 & 精灵朝向（完全分离）
    private roamDir: number = 1;
    private faceDir: number = 1;
    private attackFaceLeft: number = 0;

    private moveState: 'idle' | 'moving' = 'idle';
    private stateTimer: number = 0;

    // 跳跃
    private jumpTimer: number = 0;
    private jumpCooldown: number = 3;

    // 攻击
    private attackTimer: number = 0;

    // 子弹
    private inkBullets: Node[] = [];
    private maxInkBullets: number = 5;
    private _origMaxHp: number = 1;

    private readonly VER: string = 'V8-WORLDCOORD';

    // ==================== 辅助：世界坐标读写 ====================

    private get worldX(): number { return this.node.worldPosition.x; }
    private get worldY(): number { return this.node.worldPosition.y; }
    private setWorldX(x: number) {
        const wp = this.node.worldPosition;
        this.node.setWorldPosition(x, wp.y, wp.z);
    }
    private setWorldY(y: number) {
        const wp = this.node.worldPosition;
        this.node.setWorldPosition(wp.x, y, wp.z);
    }
    private setWorldXY(x: number, y: number) {
        const wp = this.node.worldPosition;
        this.node.setWorldPosition(x, y, wp.z);
    }

    // ==================== 生命周期 ====================

    start() {
        const sl = this.leftBound + this.boundaryMargin;
        const sr = this.rightBound - this.boundaryMargin;

        console.log('═══════════════════════════════');
        console.log('🐙 章鱼脚本: ' + this.VER);
        console.log('  边界: [' + this.leftBound + ', ' + this.rightBound + '] 边距=' + this.boundaryMargin);
        console.log('  安全区: [' + sl + ', ' + sr + ']');
        console.log('  当前 worldPosition=' + this.worldX.toFixed(0) + ' localPosition=' + this.node.position.x.toFixed(0));

        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) { console.error('❌ 无Sprite'); return; }
        if (this.octopusSprite) this.sprite.spriteFrame = this.octopusSprite;

        this._origMaxHp = this.maxHp;

        // ★ 钳制初始世界位置到安全区
        const wx = this.worldX;
        if (wx < sl || wx > sr) {
            const cx = Math.max(sl, Math.min(sr, wx));
            this.setWorldX(cx);
            console.log('🔧 钳制初始世界位置: ' + wx.toFixed(0) + ' → ' + cx.toFixed(0));
        }

        this.attackTimer = 1 + Math.random();
        this.jumpTimer = Math.random() * this.minJumpInterval;
        this.jumpCooldown = this.minJumpInterval + Math.random() * (this.maxJumpInterval - this.minJumpInterval);

        this.roamDir = Math.random() > 0.5 ? 1 : -1;
        this.faceDir = this.roamDir;
        this.enterMoving();

        console.log('═══════════════════════════════');
    }

    update(dt: number) {
        if (!this.sprite || this.isDead) return;

        this.attackTimer += dt;
        this.jumpTimer += dt;

        // 攻击面朝计时器
        if (this.attackFaceLeft > 0) {
            this.attackFaceLeft -= dt;
            if (this.attackFaceLeft <= 0) {
                this.faceDir = this.roamDir;
            }
        }

        // 攻击
        const player = this.findPlayer();
        if (player) {
            const dist = this.getDist(player);
            console.log('🔍 玩家距离: ' + dist.toFixed(0) + ' 攻击范围: ' + this.attackRange + ' 冷却: ' + this.attackTimer.toFixed(1) + '/' + this.attackCooldown);
            if (dist < this.attackRange && this.attackTimer >= this.attackCooldown) {
                console.log('⚔️ 发动攻击！');
                this.doAttack(player);
            }
        }

        // 漫游
        this.updateRoam(dt);

        // 跳跃
        if (this.jumpTimer >= this.jumpCooldown && this.isGrounded) {
            this.doJump();
            this.jumpTimer = 0;
            this.jumpCooldown = this.minJumpInterval + Math.random() * (this.maxJumpInterval - this.minJumpInterval);
        }

        // 重力（世界Y坐标）
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

        // 翻转精灵
        const sx = this.node.scale.x;
        const tsx = this.faceDir > 0 ? Math.abs(sx) : -Math.abs(sx);
        if (Math.abs(sx - tsx) > 0.001) {
            this.node.setScale(tsx, this.node.scale.y, this.node.scale.z);
        }
    }

    // ==================== 漫游 ====================

    private updateRoam(dt: number) {
        const sl = this.leftBound + this.boundaryMargin;
        const sr = this.rightBound - this.boundaryMargin;
        const wx = this.worldX;

        if (this.moveState === 'idle') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) this.enterMoving();
            return;
        }

        // 移动状态
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) { this.enterIdle(); return; }

        // 已在边界外 → 翻转漫游方向
        if (wx >= sr && this.roamDir > 0) {
            this.roamDir = -1;
            if (this.attackFaceLeft <= 0) this.faceDir = this.roamDir;
        } else if (wx <= sl && this.roamDir < 0) {
            this.roamDir = 1;
            if (this.attackFaceLeft <= 0) this.faceDir = this.roamDir;
        }

        // 计算新世界X
        let nx = wx + this.roamDir * this.moveSpeedX * dt;

        // 边界钳制
        if (nx > sr) {
            nx = sr;
            this.roamDir = -1;
            if (this.attackFaceLeft <= 0) this.faceDir = this.roamDir;
        } else if (nx < sl) {
            nx = sl;
            this.roamDir = 1;
            if (this.attackFaceLeft <= 0) this.faceDir = this.roamDir;
        }

        this.setWorldX(nx);
    }

    private enterMoving() {
        this.moveState = 'moving';
        const wx = this.worldX;
        const sl = this.leftBound + this.boundaryMargin;
        const sr = this.rightBound - this.boundaryMargin;

        // 智能选方向
        const distL = wx - sl;
        const distR = sr - wx;

        if (distL < 5) {
            this.roamDir = 1;
        } else if (distR < 5) {
            this.roamDir = -1;
        } else {
            this.roamDir = Math.random() > 0.5 ? 1 : -1;
        }

        if (this.attackFaceLeft <= 0) {
            this.faceDir = this.roamDir;
        }

        this.stateTimer = this.minMoveTime + Math.random() * (this.maxMoveTime - this.minMoveTime);
        console.log('▶️  移动 ' + this.stateTimer.toFixed(1) + '秒 方向=' +
            (this.roamDir > 0 ? '右' : '左') + ' worldX=' + wx.toFixed(0) +
            ' 安全区=[' + sl.toFixed(0) + ',' + sr.toFixed(0) + ']');
    }

    private enterIdle() {
        this.moveState = 'idle';
        this.stateTimer = this.minIdleTime + Math.random() * (this.maxIdleTime - this.minIdleTime);
        console.log('⏸️  停顿 ' + this.stateTimer.toFixed(1) + '秒 worldX=' + this.worldX.toFixed(0));
    }

    // ==================== 跳跃 ====================

    private doJump() {
        if (!this.isGrounded) return;
        this.velocityY = this.jumpForce;
        this.isGrounded = false;
        console.log('🦘 跳跃！');
    }

    // ==================== 攻击 ====================

    private doAttack(player: Node) {
        this.attackTimer = 0;
        console.log('⚔️ 章鱼攻击玩家！');

        const dir = player.worldPosition.x > this.worldX ? 1 : -1;
        this.faceDir = dir;
        this.attackFaceLeft = 0.4;

        const stats = player.getComponent(PlayerStats);
        if (stats) {
            stats.takeDamage(25);
            console.log('💥 玩家扣血！');
        }
    }

    private fireInk(dir: number) {
    }

    // ==================== 工具 ====================

    private findPlayer(): Node | null {
        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }
        const player = this.searchForPlayer(root);
        if (!player) {
            console.warn('❌ Octopus: 没找到玩家！');
        }
        return player;
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

    private getDist(p: Node): number {
        const a = this.node.worldPosition, b = p.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    public removeInkBullet(ink: Node) {
        const i = this.inkBullets.indexOf(ink);
        if (i > -1) this.inkBullets.splice(i, 1);
        if (ink && ink.isValid) ink.destroy();
    }

    // ==================== 受击/死亡 ====================

    public takeHit() {
        if (this.isDead) return;
        this.maxHp--;
        if (this.maxHp <= 0) { this.die(); return; }
        if (this.sprite) {
            const o = this.sprite.color.clone();
            this.sprite.color = new Color(255, 255, 255);
            setTimeout(() => { if (this.sprite) this.sprite.color = o; }, 100);
        }
    }

    private die() {
        if (this.isDead) return;
        this.isDead = true;
        this.addExp();
        for (const ink of this.inkBullets) ink.destroy();
        this.inkBullets = [];
        this.node.active = false;
        setTimeout(() => {
            this.isDead = false;
            this.maxHp = this._origMaxHp;
            this.node.active = true;
            const sl = this.leftBound + this.boundaryMargin;
            const sr = this.rightBound - this.boundaryMargin;
            const cx = Math.max(sl, Math.min(sr, this.worldX));
            this.setWorldX(cx);
            this.roamDir = Math.random() > 0.5 ? 1 : -1;
            this.faceDir = this.roamDir;
            this.attackFaceLeft = 0;
            this.enterIdle();
        }, 5000);
    }

    private addExp() {
        const p = this.findPlayer();
        if (!p) return;
        let s = p.getComponent(PlayerStats);
        if (!s) s = p.addComponent(PlayerStats);
        s.addExperience(this.expReward);
    }

    protected onDestroy() {
        for (const ink of this.inkBullets) ink.destroy();
    }
}