import { _decorator, Component, Node, Sprite, SpriteFrame, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 火箭子弹脚本
 * - 朝指定方向匀速飞行
 * - 飞行一定距离后自动销毁
 * - 命中敌人时造成伤害并销毁
 * 挂载到火箭子弹预制体上使用
 */
@ccclass('RocketBullet')
export class RocketBullet extends Component {
    // ==================== 可调节参数 ====================

    @property({ tooltip: '子弹飞行速度（像素/秒）' })
    speed: number = 600;

    @property({ tooltip: '最大飞行距离（像素），超过后自动销毁' })
    maxDistance: number = 800;

    @property({ tooltip: '子弹伤害值' })
    damage: number = 10;

    @property({ tooltip: '命中检测范围（像素），子弹与敌人的距离小于此值算命中' })
    hitRange: number = 60;

    // ==================== 精灵帧（在编辑器/代码中设置） ====================

    @property({ type: SpriteFrame, tooltip: '向右飞的火箭精灵' })
    rightSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '向左飞的火箭精灵' })
    leftSprite: SpriteFrame | null = null;

    // ==================== 内部状态 ====================

    /** 飞行方向：1 = 右，-1 = 左 */
    private direction: number = 1;

    /** 起始位置 X 坐标 */
    private startX: number = 0;

    /** 已飞行距离 */
    private traveledDistance: number = 0;

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    // ==================== 公开方法 ====================

    /**
     * 初始化子弹（由外部调用）
     * @param dir 飞行方向，1 = 右，-1 = 左
     */
    public init(dir: number) {
        this.direction = dir === -1 ? -1 : 1;
        this.startX = this.node.worldPosition.x;
        this.traveledDistance = 0;

        // 根据方向切换精灵
        if (!this.sprite) {
            this.sprite = this.getComponent(Sprite);
        }

        if (this.sprite) {
            if (this.direction === 1 && this.rightSprite) {
                this.sprite.spriteFrame = this.rightSprite;
            } else if (this.direction === -1 && this.leftSprite) {
                this.sprite.spriteFrame = this.leftSprite;
            }
        }

        console.log(`🚀 火箭发射！方向: ${this.direction === 1 ? '右' : '左'}`);
    }

    // ==================== 生命周期 ====================

    update(deltaTime: number) {
        // 移动
        const moveX = this.direction * this.speed * deltaTime;
        const pos = this.node.worldPosition;
        this.node.setWorldPosition(pos.x + moveX, pos.y, pos.z);

        // 累计飞行距离
        this.traveledDistance += Math.abs(moveX);

        // 超过最大距离 → 销毁
        if (this.traveledDistance >= this.maxDistance) {
            console.log('🚀 火箭飞行距离达到上限，销毁');
            this.node.destroy();
            return;
        }

        // 检测是否命中敌人
        this.checkEnemyHit();
    }

    // ==================== 内部方法 ====================

    /**
     * 检测是否击中场景中的敌人
     */
    private checkEnemyHit() {
        // 找到场景根节点
        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }

        const enemies = this.findEnemies(root);
        const bulletPos = this.node.worldPosition;

        for (const enemy of enemies) {
            const enemyNode = enemy.node as Node;
            if (!enemyNode || !enemyNode.activeInHierarchy) continue;

            const enemyPos = enemyNode.worldPosition;
            const dx = bulletPos.x - enemyPos.x;
            const dy = bulletPos.y - enemyPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.hitRange) {
                this.onHitEnemy(enemy, enemyNode);
                return; // 只命中一个敌人
            }
        }
    }

    /**
     * 在场景中搜索所有可被攻击的敌人
     */
    private findEnemies(node: Node): any[] {
        const result: any[] = [];

        const targets = ['Octopus', 'FinalBoss', 'Flagfish', 'HermitCrab', 'Vine', 'Bee'];
        for (const name of targets) {
            const comp = node.getComponent(name);
            if (comp) {
                result.push(comp);
            }
        }

        for (const child of node.children) {
            result.push(...this.findEnemies(child));
        }

        return result;
    }

    /**
     * 命中敌人
     */
    private onHitEnemy(enemy: any, enemyNode: Node) {
        console.log(`🚀 火箭命中敌人: ${enemyNode.name}`);

        // 调用敌人的受伤方法
        if (typeof enemy.takeDamage === 'function') {
            enemy.takeDamage(this.damage);
        }

        // 命中后销毁子弹
        this.node.destroy();
    }
}
