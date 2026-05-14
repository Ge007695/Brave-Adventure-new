import { _decorator, Component, Sprite, SpriteFrame, Color, Node, Collider2D } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
const { ccclass, property } = _decorator;

/**
 * 寄居蟹小怪脚本
 * 继承自旗鱼思路，但寄居蟹不会移动（静止不动），只有一张图片
 * 可以自由调整位置，支持放置多只
 * 与玩家重叠时每次扣25血
 */
@ccclass('HermitCrab')
export class HermitCrab extends Component {
    // ==================== 可调节参数 ====================

    /** 寄居蟹的 SpriteFrame（拖入寄居蟹.png） */
    @property(SpriteFrame)
    crabSprite: SpriteFrame | null = null;

    /** 击败后获得的经验值 */
    @property
    expReward: number = 1;

    /** 小怪血量（被攻击多少次死亡） */
    @property
    maxHp: number = 1;

    /** 检测重叠的范围（像素） */
    @property({ tooltip: '检测重叠的范围（像素）' })
    overlapRange: number = 60;

    /** 扣血冷却时间（秒），防止每帧重复扣血 */
    @property({ tooltip: '扣血冷却时间（秒）' })
    damageCooldown: number = 0.5;

    /** 小怪是否死亡 */
    private isDead: boolean = false;

    // ==================== 内部状态 ====================

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    /** 扣血计时器 */
    private damageTimer: number = 0;

    start() {
        // ★ 自动移除所有 Collider 组件（防止场景/预制体中残留的碰撞器干扰）
        const colliders = this.getComponents(Collider2D);
        for (const c of colliders) {
            this.node.removeComponent(c);
            console.log('🧹 已移除 Collider 组件');
        }

        // 获取 Sprite 组件
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('❌ 寄居蟹找不到 Sprite 组件！请确保已添加 Sprite 组件');
            return;
        }

        // 设置寄居蟹图片
        if (this.crabSprite) {
            this.sprite.spriteFrame = this.crabSprite;
        } else {
            console.error('❌ 寄居蟹未设置 crabSprite！请在属性面板中拖入寄居蟹.png 的 SpriteFrame');
        }
    }

    update(dt: number) {
        if (this.isDead) return;

        // 扣血冷却计时
        if (this.damageTimer > 0) {
            this.damageTimer -= dt;
        }

        // 检测与玩家是否重叠
        const player = this.findPlayer();
        if (!player) return;

        const dist = this.getDist(player);
        if (dist < this.overlapRange && this.damageTimer <= 0) {
            // 重叠且冷却结束 → 扣血
            const stats = player.getComponent(PlayerStats);
            if (stats) {
                stats.takeDamage(25);
                console.log('💥 寄居蟹与玩家重叠，扣血25！');
                this.damageTimer = this.damageCooldown;
            }
        }
    }

    /**
     * 当被人物攻击时调用
     */
    public takeHit() {
        if (this.isDead) return;

        this.maxHp--;
        console.log(`💥 寄居蟹受到攻击，剩余血量: ${this.maxHp}`);

        if (this.maxHp <= 0) {
            this.die();
        } else {
            this.flashOnHit();
        }
    }

    private flashOnHit() {
        if (!this.sprite) return;
        const originalColor = this.sprite.color.clone();
        this.sprite.color = new Color(255, 255, 255);

        setTimeout(() => {
            if (this.sprite) {
                this.sprite.color = originalColor;
            }
        }, 100);
    }

    private die() {
        if (this.isDead) return;
        this.isDead = true;

        console.log(`💀 寄居蟹被击败！`);

        this.addExpToPlayer();

        this.node.active = false;

        setTimeout(() => {
            this.isDead = false;
            this.maxHp = this._originalMaxHp;
            this.node.active = true;
        }, 5000);
    }

    private _originalMaxHp: number = 1;

    @property
    set originalMaxHp(val: number) {
        this._originalMaxHp = val;
        this.maxHp = val;
    }

    get originalMaxHp(): number {
        return this._originalMaxHp;
    }

    private addExpToPlayer() {
        const canvas = this.node.parent;
        if (!canvas) return;

        for (const child of canvas.children) {
            const stats = child.getComponent(PlayerStats);
            if (stats) {
                stats.addExperience(this.expReward);
                break;
            }
        }
    }

    // ==================== 玩家检测 ====================

    private findPlayer(): Node | null {
        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }
        return this.searchForPlayer(root);
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
        const a = this.node.worldPosition;
        const b = p.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}