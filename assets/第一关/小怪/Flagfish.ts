import { _decorator, Component, Sprite, SpriteFrame, Collider2D, Node, Color } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
const { ccclass, property } = _decorator;

/**
 * 旗鱼小怪脚本
 * 在指定范围内自动左右移动，通过代码直接切换 SpriteFrame 实现左右方向图片切换
 * 与玩家重叠时每次扣25血
 */
@ccclass('Flagfish')
export class Flagfish extends Component {
    // ==================== 可调节参数 ====================

    /** 移动速度（像素/秒） */
    @property
    moveSpeed: number = 100;

    /** 移动范围左边界（世界坐标X） */
    @property
    leftBound: number = 0;

    /** 移动范围右边界（世界坐标X） */
    @property
    rightBound: number = 1280;

    /** 初始移动方向：true=向右，false=向左 */
    @property
    startMoveRight: boolean = true;

    /** 向右的 SpriteFrame（旗鱼-右.png） */
    @property(SpriteFrame)
    rightSprite: SpriteFrame | null = null;

    /** 向左的 SpriteFrame（旗鱼-左.png） */
    @property(SpriteFrame)
    leftSprite: SpriteFrame | null = null;

    /** 检测重叠的范围（像素） */
    @property({ tooltip: '检测重叠的范围（像素）' })
    overlapRange: number = 60;

    /** 扣血冷却时间（秒），防止每帧重复扣血 */
    @property({ tooltip: '扣血冷却时间（秒）' })
    damageCooldown: number = 0.5;

    // ==================== 内部状态 ====================

    /** 当前是否向右移动 */
    private movingRight: boolean = true;

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    /** 是否已停止更新（碰撞后停止移动） */
    private isStopped: boolean = false;

    /** 扣血计时器 */
    private damageTimer: number = 0;

    start() {
        // ★ 自动移除所有 Collider 组件（防止场景/预制体中残留的碰撞器干扰）
        const colliders = this.getComponents(Collider2D);
        for (const c of colliders) {
            this.node.removeComponent(c);
            console.log('🧹 旗鱼: 已移除 Collider 组件');
        }

        // 获取 Sprite 组件
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('❌ 旗鱼找不到 Sprite 组件！请确保已添加 Sprite 组件');
            return;
        }

        if (!this.rightSprite || !this.leftSprite) {
            console.error('❌ 旗鱼未设置 rightSprite 或 leftSprite！请在属性面板中拖入对应的 SpriteFrame');
            return;
        }

        // 设置初始方向
        this.movingRight = this.startMoveRight;

        // 设置初始图片
        this.updateSpriteFrame();
    }

    update(deltaTime: number) {
        if (!this.sprite || this.isStopped) return;

        // 移动逻辑
        const direction = this.movingRight ? 1 : -1;
        const moveDistance = direction * this.moveSpeed * deltaTime;

        const pos = this.node.position;
        let newX = pos.x + moveDistance;

        if (newX >= this.rightBound) {
            newX = this.rightBound;
            this.movingRight = false;
            this.updateSpriteFrame();
        } else if (newX <= this.leftBound) {
            newX = this.leftBound;
            this.movingRight = true;
            this.updateSpriteFrame();
        }

        this.node.setPosition(newX, pos.y, pos.z);

        // ===== 扣血检测 =====

        // 扣血冷却计时
        if (this.damageTimer > 0) {
            this.damageTimer -= deltaTime;
        }

        // 检测与玩家是否重叠
        const player = this.findPlayer();
        if (!player) return;

        const dist = this.getDist(player);
        if (dist < this.overlapRange && this.damageTimer <= 0) {
            const stats = player.getComponent(PlayerStats);
            if (stats) {
                stats.takeDamage(25);
                console.log('💥 旗鱼与玩家重叠，扣血25！');
                this.damageTimer = this.damageCooldown;
            }
        }
    }

    /**
     * 根据当前方向切换 SpriteFrame
     */
    private updateSpriteFrame() {
        if (!this.sprite) return;

        if (this.movingRight && this.rightSprite) {
            this.sprite.spriteFrame = this.rightSprite;
        } else if (!this.movingRight && this.leftSprite) {
            this.sprite.spriteFrame = this.leftSprite;
        }
    }

    /**
     * 设置移动范围
     * @param left 左边界
     * @param right 右边界
     */
    setBounds(left: number, right: number) {
        this.leftBound = left;
        this.rightBound = right;
    }

    /**
     * 设置移动速度
     * @param speed 速度值
     */
    setSpeed(speed: number) {
        this.moveSpeed = speed;
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
