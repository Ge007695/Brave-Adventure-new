import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Label, Color, Graphics, AudioSource, AudioClip } from 'cc';
import { PlayerStats } from '../../第一关/人物/PlayerStats';
import { PlayerDataManager } from '../../scripts/data/PlayerDataManager';

const { ccclass, property } = _decorator;

@ccclass('WolfBoss')
export class WolfBoss extends Component {

    // ==================== 属性 ====================

    @property({ tooltip: '总血量' })
    maxHp: number = 15;

    @property({ type: SpriteFrame, tooltip: '常态图' })
    normalSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '咆哮图' })
    roarSprite: SpriteFrame | null = null;

    @property({ tooltip: '咆哮伤害' })
    roarDamage: number = 20;

    @property({ tooltip: '咆哮伤害范围（像素）' })
    roarRange: number = 300;

    @property({ tooltip: '咆哮冷却时间（秒）' })
    roarCooldown: number = 3.5;

    @property({ tooltip: '咆哮持续时间（秒）' })
    roarDuration: number = 1.5;

    @property({ type: AudioClip, tooltip: '咆哮音效' })
    roarClip: AudioClip | null = null;

    @property({ tooltip: '攻击判定范围 X' })
    attackHitRangeX: number = 200;

    @property({ tooltip: '攻击判定范围 Y' })
    attackHitRangeY: number = 300;

    @property({ tooltip: '击败经验奖励（第二关BOSS = 第一关100 + 20）' })
    expReward: number = 120;

    @property({ tooltip: '击杀掉落金币' })
    goldReward: number = 50;

    // ==================== 内部状态 ====================

    private _currentHp: number = 15;
    private _sprite: Sprite | null = null;
    private _playerNode: Node | null = null;
    private _roarTimer: number = 0;
    private _roarStateTimer: number = 0;
    private _isRoaring: boolean = false;
    private _hpBarFill: Graphics | null = null;
    private _hpLabel: Label | null = null;
    private _nameLabel: Label | null = null;
    private _audioSource: AudioSource | null = null;

    // ==================== 初始化 ====================

    start() {
        this._currentHp = this.maxHp;

        // 获取或创建 Sprite
        this._sprite = this.getComponent(Sprite);
        if (!this._sprite) {
            this._sprite = this.node.addComponent(Sprite);
        }

        // 固定显示尺寸，防止切换图片时大小变化
        const transform = this.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(350, 420);
        }
        this._sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._sprite.trim = false;

        // 显示常态图
        if (this.normalSprite) {
            this._sprite.spriteFrame = this.normalSprite;
        }

        this._roarTimer = this.roarCooldown;

        // 创建血条和Boss名字（参考FinalBoss）
        this.createHpBar();

        // 初始化音效
        this._audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this._audioSource.loop = false;
    }

    /**
     * 由 CameraFollow.spawnBoss() 调用
     */
    public init(player: Node | null) {
        this._playerNode = player;
        console.log('🐺 狼Boss已激活！');
    }

    // ==================== 主循环 ====================

    update(dt: number) {
        // 找玩家
        if (!this._playerNode) {
            this._playerNode = this.findPlayer();
        }
        if (!this._playerNode) return;

        if (this._isRoaring) {
            // 咆哮中
            this._roarStateTimer -= dt;
            if (this._roarStateTimer <= 0) {
                this.endRoar();
            }
        } else {
            // 冷却倒计时
            this._roarTimer -= dt;
            if (this._roarTimer <= 0) {
                this.startRoar(); // 定时咆哮，不管玩家在哪里
            }
        }
    }

    // ==================== 咆哮 ====================

    private startRoar() {
        this._isRoaring = true;
        this._roarStateTimer = this.roarDuration;

        // 切换到咆哮图
        if (this._sprite && this.roarSprite) {
            this._sprite.spriteFrame = this.roarSprite;
        }

        // 播放咆哮音效
        if (this.roarClip && this._audioSource) {
            this._audioSource.playOneShot(this.roarClip, 1);
        }

        // 对范围内玩家造成伤害
        if (this._playerNode) {
            const dist = this.getDist(this._playerNode);
            if (dist < this.roarRange) {
                const stats = this._playerNode.getComponent(PlayerStats);
                if (stats) {
                    stats.takeDamage(this.roarDamage);
                    console.log(`🐺 狼咆哮！造成 ${this.roarDamage} 点伤害`);
                }
            }
        }
    }

    private endRoar() {
        this._isRoaring = false;
        this._roarTimer = this.roarCooldown;

        // 切回常态图
        if (this._sprite && this.normalSprite) {
            this._sprite.spriteFrame = this.normalSprite;
        }
    }

    // ==================== 受击 ====================

    /**
     * @param damage  原始伤害值
     * @param source  来源: 'rocket' | 'melee' | undefined
     */
    public takeDamage(damage: number, source?: string) {
        const actualDamage = Math.max(1, damage);

        this._currentHp -= actualDamage;
        console.log(`🐺 狼Boss受到 ${actualDamage} 点伤害 (来源: ${source || 'unknown'})，剩余HP: ${this._currentHp}/${this.maxHp}`);

        this.updateHpBar();

        // 受击闪烁
        this.flashHit();

        if (this._currentHp <= 0) {
            this.die();
        }
    }

    /** 受击闪烁 */
    private flashHit() {
        if (!this._sprite) return;
        const orig = this._sprite.color.clone();
        this._sprite.color = new Color(255, 100, 100, 255);
        this.scheduleOnce(() => {
            if (this._sprite && this._sprite.isValid) {
                this._sprite.color = orig;
            }
        }, 0.1);
    }

    // ==================== 死亡 ====================

    private die() {
        console.log('🐺 狼Boss被击败！');
        this.addExp();
        this.dropGold();
        // CameraFollow 检测到 node.active=false 后触发胜利
        this.node.active = false;
    }

    private dropGold() {
        if (this.goldReward <= 0) return;
        PlayerDataManager.getInstance().addGold(this.goldReward);
        console.log(`🪙 狼Boss掉落金币 +${this.goldReward}`);
    }

    private addExp() {
        const player = this._playerNode || this.findPlayer();
        if (!player) return;
        let stats = player.getComponent(PlayerStats);
        if (!stats) {
            stats = player.addComponent(PlayerStats);
        }
        stats.addExperience(this.expReward);
    }

    // ==================== 攻击接口（兼容火箭弹/近战/技能） ====================

    public getAttackHitPosition(): { x: number; y: number } {
        return this.node.worldPosition;
    }

    public getAttackHitRangeX(): number {
        return this.attackHitRangeX;
    }

    public getAttackHitRangeY(): number {
        return this.attackHitRangeY;
    }

    // ==================== 血条 ====================

    private createHpBar() {
        // Boss 名字标签
        const nameNode = new Node('BossName');
        nameNode.parent = this.node;
        nameNode.setPosition(0, 240, 0);
        const nameTransform = nameNode.addComponent(UITransform);
        nameTransform.setContentSize(300, 40);
        this._nameLabel = nameNode.addComponent(Label);
        this._nameLabel.string = 'BOSS · 巨狼';
        this._nameLabel.fontSize = 30;
        this._nameLabel.color = new Color(255, 60, 60, 255);
        this._nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._nameLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 血条背景
        const barBg = new Node('HpBarBg');
        barBg.parent = this.node;
        barBg.setPosition(0, 200, 0);
        barBg.addComponent(UITransform).setContentSize(260, 24);
        const bgGfx = barBg.addComponent(Graphics);
        bgGfx.fillColor = new Color(40, 40, 40, 200);
        bgGfx.roundRect(-130, -12, 260, 24, 4);
        bgGfx.fill();

        // 血条填充
        const barFill = new Node('HpBarFill');
        barFill.parent = this.node;
        barFill.setPosition(-130, 200, 0);
        barFill.addComponent(UITransform).setContentSize(260, 24);
        this._hpBarFill = barFill.addComponent(Graphics);

        // 血量文字
        const labelNode = new Node('HpLabel');
        labelNode.parent = this.node;
        labelNode.setPosition(0, 200, 0);
        labelNode.addComponent(UITransform).setContentSize(260, 24);
        this._hpLabel = labelNode.addComponent(Label);
        this._hpLabel.fontSize = 18;
        this._hpLabel.color = Color.WHITE;
        this._hpLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this._hpLabel.verticalAlign = Label.VerticalAlign.CENTER;

        this.updateHpBar();
    }

    private updateHpBar() {
        if (!this._hpBarFill || !this._hpLabel) return;

        const ratio = Math.max(0, this._currentHp / this.maxHp);
        const fillWidth = 260 * ratio;

        // 颜色：绿 → 黄 → 红
        let color: Color;
        if (ratio > 0.5) {
            color = new Color(80, 200, 80, 255);
        } else if (ratio > 0.25) {
            color = new Color(220, 180, 40, 255);
        } else {
            color = new Color(220, 50, 50, 255);
        }

        this._hpBarFill.clear();
        this._hpBarFill.fillColor = color;
        this._hpBarFill.rect(0, -12, fillWidth, 24);
        this._hpBarFill.fill();

        this._hpLabel.string = `${this._currentHp} / ${this.maxHp}`;
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
