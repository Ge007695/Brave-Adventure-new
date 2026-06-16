import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { PlayerStats } from '../../第一关/人物/PlayerStats';

const { ccclass, property } = _decorator;

enum MushroomState {
    IDLE,
    WARNING,
    GAS_ACTIVE,
    COOLDOWN,
}

@ccclass('PoisonMushroom')
export class PoisonMushroom extends Component {

    // ==================== 可配置属性 ====================

    @property({ tooltip: '警告触发距离（像素），玩家进入此范围显示感叹号' })
    warningRange: number = 150;

    @property({ tooltip: '毒气伤害距离（像素），玩家在此范围内受毒气伤害' })
    gasDamageRange: number = 120;

    @property({ tooltip: '警告持续时间（秒），感叹号显示多久后释放毒气' })
    warningDuration: number = 1.5;

    @property({ tooltip: '毒气持续时间（秒）' })
    gasDuration: number = 3.0;

    @property({ tooltip: '毒气结束后的冷却时间（秒）' })
    cycleCooldown: number = 5.0;

    @property({ tooltip: '每次毒气伤害扣血量' })
    damage: number = 20;

    @property({ tooltip: '毒气伤害间隔（秒），防止每帧扣血' })
    damageCooldown: number = 1.0;

    @property({ type: Node, tooltip: '感叹号子节点（挂载 Sprite 用感叹号.png）' })
    exclamationNode: Node | null = null;

    @property({ type: Node, tooltip: '毒气子节点（挂载 Sprite 用毒气.png）' })
    gasNode: Node | null = null;

    // ==================== 内部状态 ====================

    private _state: MushroomState = MushroomState.IDLE;
    private _timer: number = 0;
    private _damageTimer: number = 0;
    private _playerNode: Node | null = null;

    // ==================== 生命周期 ====================

    start() {
        // 初始隐藏感叹号和毒气
        if (this.exclamationNode) this.exclamationNode.active = false;
        if (this.gasNode) this.gasNode.active = false;
    }

    update(dt: number) {
        // 查找玩家
        if (!this._playerNode) {
            this._playerNode = this.findPlayer();
        }
        if (!this._playerNode) return;

        const dist = this.getDist(this._playerNode);

        switch (this._state) {
            case MushroomState.IDLE:
                if (dist < this.warningRange) {
                    this.enterWarning();
                }
                break;

            case MushroomState.WARNING:
                // 玩家离开范围 → 取消警告
                if (dist >= this.warningRange) {
                    this.enterIdle();
                    break;
                }
                this._timer -= dt;
                if (this._timer <= 0) {
                    this.enterGasActive();
                }
                break;

            case MushroomState.GAS_ACTIVE:
                // 毒气范围内持续扣血
                if (dist < this.gasDamageRange) {
                    this._damageTimer -= dt;
                    if (this._damageTimer <= 0) {
                        this.dealDamage();
                        this._damageTimer = this.damageCooldown;
                    }
                }
                this._timer -= dt;
                if (this._timer <= 0) {
                    this.enterCooldown();
                }
                break;

            case MushroomState.COOLDOWN:
                this._timer -= dt;
                if (this._timer <= 0) {
                    this.enterIdle();
                }
                break;
        }
    }

    // ==================== 状态切换 ====================

    /** 回到空闲状态，隐藏所有效果 */
    private enterIdle() {
        this._state = MushroomState.IDLE;
        this._timer = 0;
        if (this.exclamationNode) this.exclamationNode.active = false;
        if (this.gasNode) this.gasNode.active = false;
    }

    /** 进入警告状态，显示感叹号 */
    private enterWarning() {
        this._state = MushroomState.WARNING;
        this._timer = this.warningDuration;
        if (this.exclamationNode) {
            this.exclamationNode.active = true;
            // 弹出动画
            this.exclamationNode.setScale(0, 0, 1);
            tween(this.exclamationNode)
                .to(0.15, { scale: new Vec3(1, 1, 1) })
                .start();
        }
        console.log('🍄 蘑菇：警告！玩家靠近...');
    }

    /** 释放毒气 */
    private enterGasActive() {
        this._state = MushroomState.GAS_ACTIVE;
        this._timer = this.gasDuration;
        this._damageTimer = 0; // 立即可以扣血
        if (this.exclamationNode) this.exclamationNode.active = false;
        if (this.gasNode) {
            this.gasNode.active = true;
            // 毒气扩散动画
            this.gasNode.setScale(0.3, 0.3, 1);
            tween(this.gasNode)
                .to(0.3, { scale: new Vec3(1, 1, 1) })
                .start();
        }
        console.log('🍄 蘑菇：释放毒气！');
    }

    /** 毒气消散，进入冷却 */
    private enterCooldown() {
        this._state = MushroomState.COOLDOWN;
        this._timer = this.cycleCooldown;
        if (this.gasNode) this.gasNode.active = false;
        console.log('🍄 蘑菇：毒气消散，冷却中...');
    }

    // ==================== 伤害 ====================

    /** 对玩家造成毒气伤害 */
    private dealDamage() {
        if (!this._playerNode) return;
        const stats = this._playerNode.getComponent(PlayerStats);
        if (stats) {
            stats.takeDamage(this.damage);
            console.log(`🍄 毒气造成 ${this.damage} 点伤害`);
        }
    }

    // ==================== 玩家查找（项目通用模式） ====================

    /** 查找场景中的玩家节点 */
    private findPlayer(): Node | null {
        let root = this.node;
        while (root.parent) root = root.parent;
        return this.searchForPlayer(root);
    }

    /** 递归搜索挂载了 move 组件的节点（即玩家） */
    private searchForPlayer(node: Node): Node | null {
        if (node.getComponent('move')) return node;
        for (const child of node.children) {
            const found = this.searchForPlayer(child);
            if (found) return found;
        }
        return null;
    }

    /** 计算与目标节点的欧几里得距离 */
    private getDist(p: Node): number {
        const a = this.node.worldPosition;
        const b = p.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}
