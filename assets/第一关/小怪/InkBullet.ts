import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
const { ccclass, property } = _decorator;

@ccclass('InkBullet')
export class InkBullet extends Component {
    private direction: number = 1;
    private speed: number = 320;
    private owner: any = null;
    private damage: number = 10;
    private damageRange: number = 45;
    private lifeTimer: number = 0;
    private maxLifeTime: number = 4;
    private effectSprite: SpriteFrame | null = null;
    private effectDuration: number = 0.8;
    private effectScale: number = 0.9;
    private initialized: boolean = false;

    init(
        direction: number,
        owner: any,
        damage: number,
        speed: number,
        effectSprite: SpriteFrame | null,
        effectDuration: number,
        damageRange: number,
        effectScale: number
    ) {
        this.direction = direction;
        this.owner = owner;
        this.damage = damage;
        this.speed = speed;
        this.effectSprite = effectSprite;
        this.effectDuration = effectDuration;
        this.damageRange = damageRange;
        this.effectScale = effectScale;
        this.initialized = true;
    }

    update(deltaTime: number) {
        if (!this.initialized) return;

        this.lifeTimer += deltaTime;

        const pos = this.node.worldPosition;
        const newX = pos.x + this.direction * this.speed * deltaTime;
        this.node.setWorldPosition(newX, pos.y, pos.z);

        this.checkCollision();

        if (this.lifeTimer >= this.maxLifeTime) {
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
                stats.takeDamage(this.damage);
            }
            this.showInkEffect(player);
            this.owner?.removeInkBullet(this.node);
        }
    }

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

    private showInkEffect(player: Node) {
        if (!this.effectSprite) return;

        const oldEffect = player.getChildByName('InkHitEffect');
        if (oldEffect && oldEffect.isValid) {
            oldEffect.destroy();
        }

        const effectNode = new Node('InkHitEffect');
        player.addChild(effectNode);
        effectNode.setPosition(0, 20, 0);
        effectNode.setScale(this.effectScale, this.effectScale, 1);

        const transform = effectNode.addComponent(UITransform);
        transform.setContentSize(78, 100);

        const sprite = effectNode.addComponent(Sprite);
        sprite.spriteFrame = this.effectSprite;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        setTimeout(() => {
            if (effectNode && effectNode.isValid) {
                effectNode.destroy();
            }
        }, this.effectDuration * 1000);
    }
}
