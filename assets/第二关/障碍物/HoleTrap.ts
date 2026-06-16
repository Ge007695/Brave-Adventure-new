import { _decorator, Component, Node } from 'cc';
import { PlayerStats } from '../../第一关/人物/PlayerStats';

const { ccclass, property } = _decorator;

@ccclass('HoleTrap')
export class HoleTrap extends Component {

    @property({ tooltip: '每次扣血量' })
    damage: number = 30;

    @property({ tooltip: '触发距离（像素）' })
    triggerRange: number = 80;

    @property({ tooltip: '伤害冷却（秒），防止每帧扣血' })
    damageCooldown: number = 2.0;

    private _damageTimer: number = 0;
    private _playerNode: Node | null = null;

    update(dt: number) {
        if (this._damageTimer > 0) {
            this._damageTimer -= dt;
        }

        if (!this._playerNode) {
            this._playerNode = this.findPlayer();
        }
        if (!this._playerNode) return;

        const dist = this.getDist(this._playerNode);

        if (dist < this.triggerRange && this._damageTimer <= 0) {
            const stats = this._playerNode.getComponent(PlayerStats);
            if (stats) {
                stats.takeDamage(this.damage);
                this._damageTimer = this.damageCooldown;
                console.log(`🕳️ 洞陷阱造成 ${this.damage} 点伤害`);
            }
        }
    }

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
