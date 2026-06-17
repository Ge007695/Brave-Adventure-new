import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { Bee } from './Bee';

const { ccclass, property } = _decorator;

@ccclass('BeeHiveTree')
export class BeeHiveTree extends Component {

    // ==================== 可配置属性 ====================

    @property({ tooltip: '触发蜜蜂的距离（像素）' })
    triggerRange: number = 250;

    @property({ tooltip: '每批蜜蜂生成间隔（秒）' })
    spawnInterval: number = 2.0;

    @property({ tooltip: '同时存在的最大蜜蜂数' })
    maxBees: number = 4;

    @property({ tooltip: '每批生成的蜜蜂数量' })
    beesPerWave: number = 2;

    @property({ tooltip: '蜜蜂生成 Y 轴偏移（相对树）' })
    spawnOffsetY: number = 150;

    @property({ tooltip: '蜜蜂生成 X 轴随机偏移范围' })
    spawnSpreadX: number = 60;

    @property({ tooltip: '每只蜜蜂的追踪速度' })
    beeSpeed: number = 150;

    @property({ tooltip: '每只蜜蜂的伤害' })
    beeDamage: number = 15;

    @property({ tooltip: '每只蜜蜂的血量' })
    beeHealth: number = 1;

    @property({ tooltip: '蜜蜂缩放比例', range: [0.1, 3, 0.1], slide: true })
    beeScale: number = 0.6;

    @property({ type: SpriteFrame, tooltip: '蜜蜂动画帧1' })
    beeFrame1: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '蜜蜂动画帧2' })
    beeFrame2: SpriteFrame | null = null;

    // ==================== 内部状态 ====================

    private _playerNode: Node | null = null;
    private _spawnTimer: number = 0;
    private _activeBees: Bee[] = [];
    private _spawnParent: Node | null = null; // 蜜蜂生成在哪

    // ==================== 生命周期 ====================

    start() {
        // 蜜蜂统一生成到 Canvas 下，便于管理
        let root = this.node;
        while (root.parent) root = root.parent;

        const canvas = root.getChildByName('Canvas');
        this._spawnParent = canvas || root;
    }

    update(dt: number) {
        // 清理已销毁的蜜蜂引用
        this.cleanupDeadBees();

        // 递减生成冷却
        if (this._spawnTimer > 0) {
            this._spawnTimer -= dt;
        }

        // 查找玩家
        if (!this._playerNode) {
            this._playerNode = this.findPlayer();
        }
        if (!this._playerNode) return;

        const dist = this.getDist(this._playerNode);

        // 玩家在触发范围内 → 生成蜜蜂
        if (dist < this.triggerRange) {
            if (this._spawnTimer <= 0 && this._activeBees.length < this.maxBees) {
                this.spawnBeeWave();
                this._spawnTimer = this.spawnInterval;
            }
        }
    }

    // ==================== 蜜蜂生成 ====================

    /** 生成一波蜜蜂 */
    private spawnBeeWave() {
        const count = Math.min(this.beesPerWave, this.maxBees - this._activeBees.length);

        for (let i = 0; i < count; i++) {
            this.spawnSingleBee();
        }

        console.log(`🐝 蜂窝释放了 ${count} 只蜜蜂！`);
    }

    /** 生成单只蜜蜂 */
    private spawnSingleBee() {
        if (!this._spawnParent || !this._playerNode) return;
        if (!this.beeFrame1 || !this.beeFrame2) {
            console.warn('🐝 蜜蜂动画帧未设置！请在编辑器中拖入 beeFrame1 和 beeFrame2');
            return;
        }

        // 创建蜜蜂节点
        const beeNode = new Node('Bee');
        this._spawnParent.addChild(beeNode);

        // 初始位置：树上方的随机位置
        const treePos = this.node.worldPosition;
        const offsetX = (Math.random() - 0.5) * 2 * this.spawnSpreadX;
        beeNode.setWorldPosition(
            treePos.x + offsetX,
            treePos.y + this.spawnOffsetY,
            treePos.z,
        );

        // 设置初始缩放
        beeNode.setScale(this.beeScale, this.beeScale, 1);

        // 添加 Bee 组件
        const bee = beeNode.addComponent(Bee);
        bee.speed = this.beeSpeed;
        bee.damage = this.beeDamage;
        bee.health = this.beeHealth;

        // 初始化蜜蜂（传入玩家引用和动画帧）
        bee.init(this._playerNode, this.beeFrame1, this.beeFrame2);

        this._activeBees.push(bee);
    }

    // ==================== 清理 ====================

    /** 清理已销毁的蜜蜂引用 */
    private cleanupDeadBees() {
        this._activeBees = this._activeBees.filter(
            b => b && b.node && b.node.isValid,
        );
    }

    // ==================== 玩家查找 ====================

    private findPlayer(): Node | null {
        let root = this.node;
        while (root.parent) root = root.parent;
        return this.searchForPlayer(root);
    }

    private searchForPlayer(node: Node): Node | null {
        if (node.getComponent('move')) return node;
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
