import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 藤蔓障碍物脚本
 * - 玩家靠近时减速
 * - 玩家攻击一定次数后藤蔓消失，减速效果立即恢复
 * - 消失一段时间后藤蔓会重新出现
 * 挂载到藤蔓节点上即可使用
 */
@ccclass('Vine')
export class Vine extends Component {
    // ==================== 减速相关参数 ====================

    @property({ tooltip: '触发减速的检测范围（像素），玩家与藤蔓的距离小于此值时触发' })
    slowRange: number = 120;

    @property({ tooltip: '减速持续时长（秒）' })
    slowDuration: number = 3;

    @property({ tooltip: '减速比例（0~1），0.5 表示移速降为原来的50%' })
    slowRatio: number = 0.5;

    @property({ tooltip: '减速冷却时间（秒），防止玩家反复进出藤蔓区域被连续减速' })
    slowCooldown: number = 5;

    // ==================== 攻击破坏 & 重生相关参数 ====================

    @property({ tooltip: '藤蔓被攻击多少次后消失' })
    maxHits: number = 3;

    @property({ tooltip: '藤蔓消失后多少秒重新出现（设为 0 或负数则永久消失）' })
    respawnTime: number = 8;

    // ==================== 内部状态 ====================

    /** 玩家节点引用 */
    private playerNode: Node | null = null;

    /** 玩家 move 脚本引用 */
    private playerMove: any = null;

    /** 玩家原始移动速度（用于恢复） */
    private originalSpeed: number = 300;

    /** 当前是否处于减速状态 */
    private isSlowing: boolean = false;

    /** 减速计时器（剩余秒数） */
    private slowTimer: number = 0;

    /** 冷却计时器（剩余秒数） */
    private cooldownTimer: number = 0;

    /** 玩家是否正在藤蔓范围内 */
    private playerInRange: boolean = false;

    /** 已受击次数 */
    private currentHits: number = 0;

    /** 藤蔓是否已被摧毁（隐藏状态） */
    private isDead: boolean = false;

    /** 重生计时器（剩余秒数） */
    private respawnTimer: number = 0;

    start() {
        this.findPlayer();
    }

    update(deltaTime: number) {
        // 藤蔓已死 → 等待重生
        if (this.isDead) {
            // respawnTime <= 0 表示永久消失，不重生
            if (this.respawnTime <= 0) return;

            this.respawnTimer -= deltaTime;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return;
        }

        if (!this.playerNode || !this.playerNode.activeInHierarchy) {
            this.findPlayer();
            return;
        }

        // 更新冷却计时器
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }

        // 更新减速计时器
        if (this.isSlowing) {
            this.slowTimer -= deltaTime;
            if (this.slowTimer <= 0) {
                this.restoreSpeed();
            }
        }

        // 检测玩家是否在范围内
        const distance = this.getDistanceToPlayer();
        const wasInRange = this.playerInRange;
        this.playerInRange = distance <= this.slowRange;

        // 玩家刚刚进入范围 → 触发减速
        if (this.playerInRange && !wasInRange && this.cooldownTimer <= 0 && !this.isSlowing) {
            this.applySlow();
        }
    }

    // ==================== 攻击系统接口 ====================

    /**
     * 受击回调（由玩家攻击系统调用）
     * @param damage 受到的伤害值
     */
    public takeDamage(damage: number) {
        if (this.isDead) return;

        this.currentHits += damage;
        console.log(`🌿 藤蔓受到攻击！${this.currentHits}/${this.maxHits}`);

        if (this.currentHits >= this.maxHits) {
            this.onDestroyed();
        }
    }

    /**
     * 返回受击判定中心点（供玩家攻击系统使用）
     */
    public getAttackHitPosition(): { x: number; y: number } {
        return this.node.worldPosition;
    }

    /**
     * 返回受击判定 X 轴范围（供玩家攻击系统使用）
     */
    public getAttackHitRangeX(): number {
        return this.slowRange;
    }

    /**
     * 返回受击判定 Y 轴范围（供玩家攻击系统使用）
     */
    public getAttackHitRangeY(): number {
        return 120;
    }

    // ==================== 内部方法 ====================

    /**
     * 在场景中查找玩家节点（通过搜索带有 'move' 组件的节点）
     */
    private findPlayer() {
        let root: Node = this.node;
        while (root.parent) {
            root = root.parent;
        }

        this.playerNode = this.searchForPlayer(root);
        if (this.playerNode) {
            this.playerMove = this.playerNode.getComponent('move') as any;
            if (this.playerMove) {
                this.originalSpeed = this.playerMove.moveSpeed;
                console.log(`🌿 藤蔓找到玩家: ${this.playerNode.name}`);
            }
        }
    }

    /**
     * 递归搜索带有 'move' 组件的节点
     */
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

    /**
     * 计算藤蔓与玩家之间的距离
     */
    private getDistanceToPlayer(): number {
        if (!this.playerNode) return Infinity;

        const vinePos = this.node.worldPosition;
        const playerPos = this.playerNode.worldPosition;
        const dx = vinePos.x - playerPos.x;
        const dy = vinePos.y - playerPos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 对玩家施加减速效果
     */
    private applySlow() {
        if (!this.playerMove) {
            this.findPlayer();
            if (!this.playerMove) return;
        }

        this.originalSpeed = this.playerMove.moveSpeed;

        const slowedSpeed = Math.round(this.originalSpeed * this.slowRatio);
        this.playerMove.moveSpeed = slowedSpeed;

        this.isSlowing = true;
        this.slowTimer = this.slowDuration;

        console.log(
            `🌿 玩家进入藤蔓范围！移速 ${this.originalSpeed} → ${slowedSpeed}，持续 ${this.slowDuration} 秒`
        );
    }

    /**
     * 恢复玩家的原始移动速度
     */
    private restoreSpeed() {
        if (this.playerMove) {
            this.playerMove.moveSpeed = this.originalSpeed;
            console.log(`🌿 减速效果结束，移速恢复为 ${this.originalSpeed}`);
        }

        this.isSlowing = false;
        this.slowTimer = 0;
        this.cooldownTimer = this.slowCooldown;
    }

    /**
     * 藤蔓被摧毁：隐藏并开始重生倒计时
     */
    private onDestroyed() {
        console.log(`🌿 藤蔓被摧毁！${this.respawnTime > 0 ? ` ${this.respawnTime} 秒后重生` : ' 永久消失'}`);

        // 立即恢复玩家速度
        if (this.isSlowing) {
            this.restoreSpeed();
        }

        // 隐藏节点
        this.isDead = true;
        this.node.active = false;

        // 启动重生倒计时
        if (this.respawnTime > 0) {
            this.respawnTimer = this.respawnTime;
        }
    }

    /**
     * 藤蔓重生：重新显示并重置所有状态
     */
    private respawn() {
        console.log('🌿 藤蔓重新出现！');

        // 重新显示节点
        this.node.active = true;
        this.isDead = false;

        // 重置所有状态
        this.currentHits = 0;
        this.respawnTimer = 0;
        this.isSlowing = false;
        this.slowTimer = 0;
        this.cooldownTimer = 0;
        this.playerInRange = false;

        // 重新确认玩家引用（防止玩家在藤蔓消失期间被重建）
        this.findPlayer();
    }

    /**
     * 强制立即恢复速度（供外部调用，如切换场景、手动重置）
     */
    public forceRestoreSpeed() {
        if (this.isSlowing) {
            this.restoreSpeed();
        }
    }

    onDestroy() {
        // 节点销毁前确保恢复速度
        this.forceRestoreSpeed();
    }
}
