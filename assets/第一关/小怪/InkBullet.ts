import { _decorator, Component, Node, Sprite, Color, UITransform } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
const { ccclass, property } = _decorator;

@ccclass('InkBullet')
export class InkBullet extends Component {
    private direction: number = 1;
    private speed: number = 200;
    private owner: any = null;
    private damageRange: number = 60;
    private leftBound: number = 0;
    private rightBound: number = 500;

    init(direction: number, owner: any, leftBound: number, rightBound: number) {
        this.direction = direction;
        this.owner = owner;
        this.leftBound = leftBound;
        this.rightBound = rightBound;
    }

    update(deltaTime: number) {
        const pos = this.node.position;
        const newX = pos.x + this.direction * this.speed * deltaTime;
        this.node.setPosition(newX, pos.y, pos.z);

        this.checkCollision();

        if (newX > this.rightBound + 100 || newX < this.leftBound - 100) {
            this.owner?.removeInkBullet(this.node);
        }
    }

    private checkCollision() {
        const player = this.findPlayer();
        if (!player) return;

        const bulletPos = this.node.worldPosition;
        const playerPos = player.worldPosition;
        const dist = Math.sqrt(
            Math.pow(playerPos.x - bulletPos.x, 2) +
            Math.pow(playerPos.y - bulletPos.y, 2)
        );

        if (dist < this.damageRange) {
            const stats = player.getComponent(PlayerStats);
            if (stats) {
                stats.takeDamage(10);
            }
            this.owner?.removeInkBullet(this.node);
        }
    }

    private findPlayer(): Node | null {
        const canvas = this.node.parent;
        if (!canvas) return null;

        for (const child of canvas.children) {
            if (child.getComponent('move')) {
                return child;
            }
        }
        return null;
    }
}