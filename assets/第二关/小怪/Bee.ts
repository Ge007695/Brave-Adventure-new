import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { PlayerStats } from '../../第一关/人物/PlayerStats';

const { ccclass, property } = _decorator;

@ccclass('Bee')
export class Bee extends Component {

    // ==================== 可配置属性 ====================

    @property({ tooltip: '追踪飞行速度（像素/秒）' })
    speed: number = 150;

    @property({ tooltip: '碰到玩家时的伤害' })
    damage: number = 15;

    @property({ tooltip: '血量（被攻击时扣除）' })
    health: number = 1;

    @property({ tooltip: '最大存活时间（秒），超时自动销毁' })
    maxLifetime: number = 8;

    @property({ tooltip: '翅膀动画帧间隔（秒）' })
    frameInterval: number = 0.15;

    @property({ type: SpriteFrame, tooltip: '蜜蜂动画帧1' })
    frame1: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '蜜蜂动画帧2' })
    frame2: SpriteFrame | null = null;

    @property({ tooltip: '碰撞检测距离（像素）' })
    hitRange: number = 50;

    @property({ tooltip: '追踪时 Y 轴浮动幅度' })
    wobbleAmplitude: number = 20;

    @property({ tooltip: '浮动频率' })
    wobbleFrequency: number = 3;

    // ==================== 内部状态 ====================

    private _sprite: Sprite | null = null;
    private _playerNode: Node | null = null;
    private _frameTimer: number = 0;
    private _showingFrame1: boolean = true;
    private _lifetime: number = 0;
    private _wobblePhase: number = 0;

    // ==================== 初始化 ====================

    /**
     * 由 BeeHiveTree 调用，初始化蜜蜂
     * @param player  玩家节点（追踪目标）
     * @param f1      动画帧1
     * @param f2      动画帧2
     */
    public init(player: Node, f1: SpriteFrame, f2: SpriteFrame) {
        this._playerNode = player;
        this.frame1 = f1;
        this.frame2 = f2;

        // 确保有 Sprite 组件
        this._sprite = this.getComponent(Sprite);
        if (!this._sprite) {
            this._sprite = this.addComponent(Sprite);
        }
        this._sprite.sizeMode = Sprite.SizeMode.TRIMMED;

        // 确保有 UITransform
        let transform = this.getComponent(UITransform);
        if (!transform) {
            transform = this.addComponent(UITransform);
            transform.setContentSize(60, 50);
        }

        // 显示第一帧
        if (this.frame1) {
            this._sprite.spriteFrame = this.frame1;
        }

        // 随机初始浮动相位，避免所有蜜蜂同步浮动
        this._wobblePhase = Math.random() * Math.PI * 2;

        console.log('🐝 蜜蜂已生成，开始追踪玩家！');
    }

    // ==================== 生命周期 ====================

    update(dt: number) {
        this._lifetime += dt;

        // 超时自毁
        if (this._lifetime >= this.maxLifetime) {
            this.destroyBee();
            return;
        }

        // 翅膀动画
        this.updateAnimation(dt);

        // 追踪玩家
        if (this._playerNode && this._playerNode.activeInHierarchy) {
            this.chasePlayer(dt);

            // 检测碰撞
            if (this.checkPlayerHit()) {
                this.dealDamageToPlayer();
                this.destroyBee();
                return;
            }
        }
    }

    // ==================== 翅膀动画 ====================

    private updateAnimation(dt: number) {
        if (!this.frame1 || !this.frame2 || !this._sprite) return;

        this._frameTimer += dt;
        if (this._frameTimer >= this.frameInterval) {
            this._frameTimer = 0;
            this._showingFrame1 = !this._showingFrame1;
            this._sprite.spriteFrame = this._showingFrame1 ? this.frame1 : this.frame2;
        }
    }

    // ==================== 追踪 ====================

    private chasePlayer(dt: number) {
        if (!this._playerNode) return;

        const myPos = this.node.worldPosition;
        const targetPos = this._playerNode.worldPosition;

        // 方向向量
        const dx = targetPos.x - myPos.x;
        const dy = targetPos.y - myPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1) return; // 已到达

        // 归一化方向
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Y 轴正弦浮动
        this._wobblePhase += dt * this.wobbleFrequency;
        const wobble = Math.sin(this._wobblePhase) * this.wobbleAmplitude;

        // 新位置
        const newX = myPos.x + dirX * this.speed * dt;
        const newY = myPos.y + (dirY * this.speed * dt) + wobble * dt;

        this.node.setWorldPosition(newX, newY, myPos.z);

        // 根据飞行方向翻转精灵（素材默认朝左，向右飞时翻转）
        const sc = this.node.scale;
        if (dirX > 0) {
            this.node.setScale(-Math.abs(sc.x), sc.y, sc.z);
        } else {
            this.node.setScale(Math.abs(sc.x), sc.y, sc.z);
        }
    }

    // ==================== 碰撞检测 ====================

    private checkPlayerHit(): boolean {
        if (!this._playerNode) return false;
        const a = this.node.worldPosition;
        const b = this._playerNode.worldPosition;
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
        return dist < this.hitRange;
    }

    private dealDamageToPlayer() {
        if (!this._playerNode) return;
        const stats = this._playerNode.getComponent(PlayerStats);
        if (stats) {
            stats.takeDamage(this.damage);
            console.log(`🐝 蜜蜂撞到玩家，造成 ${this.damage} 点伤害`);
        }
    }

    // ==================== 销毁 ====================

    private destroyBee() {
        if (this.node && this.node.isValid) {
            this.node.destroy();
        }
    }

    // ==================== 攻击接口（兼容火箭弹/近战/技能） ====================

    /**
     * 受到攻击
     */
    public takeDamage(damage: number) {
        this.health -= damage;
        console.log(`🐝 蜜蜂受到 ${damage} 点伤害，剩余血量 ${this.health}`);
        if (this.health <= 0) {
            console.log('🐝 蜜蜂被击杀！');
            this.destroyBee();
        }
    }

    /** 攻击命中判定位置 */
    public getAttackHitPosition(): { x: number; y: number } {
        return this.node.worldPosition;
    }

    /** 攻击命中判定范围 X */
    public getAttackHitRangeX(): number {
        return this.hitRange;
    }

    /** 攻击命中判定范围 Y */
    public getAttackHitRangeY(): number {
        return this.hitRange;
    }
}
