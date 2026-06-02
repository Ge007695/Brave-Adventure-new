import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { PlayerStats } from './PlayerStats';
const { ccclass, property } = _decorator;

@ccclass('FinalBoss')
export class FinalBoss extends Component {
    @property
    maxHp: number = 12;

    @property
    damage: number = 18;

    @property
    attackCooldown: number = 1.2;

    @property
    attackRange: number = 360;

    @property
    expReward: number = 10;

    private currentHp: number = 0;
    private attackTimer: number = 0;
    private isDead: boolean = false;
    private playerNode: Node | null = null;
    private hpBarFill: Graphics | null = null;
    private hpLabel: Label | null = null;
    private baseScaleX: number = 1;
    private baseScaleY: number = 1;
    private baseScaleZ: number = 1;

    public init(
        player: Node | null,
        maxHp: number,
        damage: number,
        attackCooldown: number,
        attackRange: number,
        expReward: number
    ) {
        this.playerNode = player;
        this.maxHp = Math.max(1, Math.floor(maxHp));
        this.damage = Math.max(1, damage);
        this.attackCooldown = Math.max(0.1, attackCooldown);
        this.attackRange = Math.max(1, attackRange);
        this.expReward = Math.max(0, expReward);
        this.currentHp = this.maxHp;
        this.attackTimer = this.attackCooldown * 0.5;
        this.isDead = false;
        this.baseScaleX = this.node.scale.x;
        this.baseScaleY = this.node.scale.y;
        this.baseScaleZ = this.node.scale.z;
        this.createHpBar();
        this.updateHpBar();
    }

    start() {
        if (this.currentHp <= 0) {
            this.init(null, this.maxHp, this.damage, this.attackCooldown, this.attackRange, this.expReward);
        }
    }

    update(deltaTime: number) {
        if (this.isDead) return;

        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }

        const player = this.findPlayer();
        if (!player || this.attackTimer > 0) return;

        const dist = this.getDistance(player);
        if (dist <= this.attackRange) {
            this.attack(player);
        }
    }

    public getAttackHitPosition(): { x: number; y: number } {
        const pos = this.node.worldPosition;
        return { x: pos.x, y: pos.y - 210 };
    }

    public getAttackHitRangeX(): number {
        return 260;
    }

    public getAttackHitRangeY(): number {
        return 190;
    }

    public takeDamage(damage: number) {
        if (this.isDead) return;

        this.currentHp = Math.max(0, this.currentHp - Math.max(1, damage));
        this.updateHpBar();
        this.flashOnHit();

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    public takeHit() {
        this.takeDamage(1);
    }

    private attack(player: Node) {
        this.attackTimer = this.attackCooldown;

        const stats = player.getComponent(PlayerStats);
        if (stats) {
            stats.takeDamage(this.damage);
        }

        this.showAttackPulse();
    }

    private createHpBar() {
        const oldBar = this.node.getChildByName('BossHpBar');
        if (oldBar && oldBar.isValid) {
            oldBar.destroy();
        }

        const barWidth = 260;
        const barHeight = 16;
        const hpBar = new Node('BossHpBar');
        this.node.addChild(hpBar);
        hpBar.setPosition(0, 205, 0);

        const transform = hpBar.addComponent(UITransform);
        transform.setContentSize(barWidth, 44);

        const bg = hpBar.addComponent(Graphics);
        bg.fillColor = new Color(8, 8, 20, 220);
        bg.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
        bg.fill();
        bg.strokeColor = new Color(230, 50, 62, 255);
        bg.lineWidth = 2;
        bg.rect(-barWidth / 2, -barHeight / 2, barWidth, barHeight);
        bg.stroke();

        const fillNode = new Node('BossHpFill');
        hpBar.addChild(fillNode);
        fillNode.setPosition(-barWidth / 2, 0, 0);

        const fillTransform = fillNode.addComponent(UITransform);
        fillTransform.setContentSize(barWidth, barHeight);
        fillTransform.setAnchorPoint(0, 0.5);
        this.hpBarFill = fillNode.addComponent(Graphics);

        const labelNode = new Node('BossHpText');
        hpBar.addChild(labelNode);
        labelNode.setPosition(0, 22, 0);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(barWidth, 24);

        this.hpLabel = labelNode.addComponent(Label);
        this.hpLabel.fontSize = 18;
        this.hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.hpLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.hpLabel.color = new Color(255, 245, 220, 255);
    }

    private updateHpBar() {
        if (!this.hpBarFill || !this.hpLabel) return;

        const barWidth = 260;
        const barHeight = 16;
        const percent = Math.max(0, this.currentHp / this.maxHp);

        this.hpBarFill.clear();
        this.hpBarFill.fillColor = percent > 0.35
            ? new Color(230, 45, 62, 255)
            : new Color(255, 132, 45, 255);
        this.hpBarFill.rect(0, -barHeight / 2, barWidth * percent, barHeight);
        this.hpBarFill.fill();

        this.hpLabel.string = `${this.currentHp}/${this.maxHp}`;
    }

    private flashOnHit() {
        this.node.setScale(this.baseScaleX * 1.04, this.baseScaleY * 1.04, this.baseScaleZ);
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid && !this.isDead) {
                this.node.setScale(this.baseScaleX, this.baseScaleY, this.baseScaleZ);
            }
        }, 0.08);
    }

    private showAttackPulse() {
        const pulse = new Node('BossAttackPulse');
        this.node.addChild(pulse);
        pulse.setPosition(0, -210, 0);

        const transform = pulse.addComponent(UITransform);
        transform.setContentSize(360, 110);

        const gfx = pulse.addComponent(Graphics);
        gfx.fillColor = new Color(255, 42, 70, 70);
        gfx.rect(-180, -55, 360, 110);
        gfx.fill();
        gfx.strokeColor = new Color(255, 80, 90, 180);
        gfx.lineWidth = 3;
        gfx.rect(-180, -55, 360, 110);
        gfx.stroke();

        this.scheduleOnce(() => {
            if (pulse && pulse.isValid) {
                pulse.destroy();
            }
        }, 0.18);
    }

    private die() {
        if (this.isDead) return;

        this.isDead = true;
        this.addExpToPlayer();
        this.node.active = false;
    }

    private addExpToPlayer() {
        const player = this.findPlayer();
        if (!player) return;

        const stats = player.getComponent(PlayerStats);
        if (stats) {
            stats.addExperience(this.expReward);
        }
    }

    private findPlayer(): Node | null {
        if (this.playerNode && this.playerNode.isValid) {
            return this.playerNode;
        }

        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }

        this.playerNode = this.searchForPlayer(root);
        return this.playerNode;
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

    private getDistance(target: Node): number {
        const bossPos = this.getAttackHitPosition();
        const targetPos = target.worldPosition;
        return Math.sqrt((targetPos.x - bossPos.x) ** 2 + (targetPos.y - bossPos.y) ** 2);
    }
}
