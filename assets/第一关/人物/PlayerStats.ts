import { _decorator, Component, AudioSource, AudioClip } from 'cc';
import { PlayerDataManager } from '../../scripts/data/PlayerDataManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerStats')
export class PlayerStats extends Component {
    /** 受击音效（默认小怪攻击音效） */
    @property({ type: AudioClip, tooltip: '默认受击音效，可用于小怪攻击' })
    hitClip: AudioClip | null = null;

    @property({ tooltip: '受击音效音量 (0~1)', range: [0, 1, 0.01], slide: true })
    hitClipVolume: number = 1;

    private _audioSource: AudioSource | null = null;

    /** 受到伤害时的倍率（Buff系统使用，默认为1，护盾时设为0.5） */
    public damageMultiplier: number = 1;

    /** 最大血量 */
    @property
    maxHealth: number = 100;
    
    /** 当前血量 */
    private _health: number = 100;
    public get health(): number { return this._health; }
    public set health(value: number) {
        this._health = Math.max(0, Math.min(value, this.maxHealth));
        if (this.onHealthChange) this.onHealthChange(this._health, this.maxHealth);
        if (this._health <= 0) {
            if (this.onDeath) this.onDeath();
        }
    }
    
    /** 最大魔力 */
    @property
    maxMana: number = 100;
    
    /** 当前魔力 */
    private _mana: number = 100;
    public get mana(): number { return this._mana; }
    public set mana(value: number) {
        this._mana = Math.max(0, Math.min(value, this.maxMana));
        if (this.onManaChange) this.onManaChange(this._mana, this.maxMana);
    }
    
    /** 当前经验 */
    public get experience(): number { return this._experience; }

    /** 基础升级经验：100 + (等级-1) × 20，如 Lv2→3 需 120，Lv3→4 需 140 */
    @property({ tooltip: '基础升级经验值' })
    baseExpToLevelUp: number = 100;

    /** 当前等级升到下一级所需经验 = 100 + (当前等级 - 1) × 20 */
    public getExpNeeded(): number {
        return this.baseExpToLevelUp + (this._level - 1) * 20;
    }

    /** 当前等级 */
    private _level: number = 1;
    public get level(): number { return this._level; }

    /** 当前经验 */
    private _experience: number = 0;

    /** 初始等级（在编辑器中设置，启动时自动应用属性加成） */
    @property({ tooltip: '初始等级（启动时自动应用属性加成）' })
    initialLevel: number = 1;

    /** 初始经验（在编辑器中设置） */
    @property({ tooltip: '初始经验值' })
    initialExperience: number = 0;

    /** 勾选后每次进入游戏自动重置为 1 级 0 经验（调试用） */
    @property({ tooltip: '勾选后每次进入游戏重置为1级0经验' })
    resetLevelOnStart: boolean = false;

    /** 回调事件 */
    public onHealthChange: ((current: number, max: number) => void) | null = null;
    public onManaChange: ((current: number, max: number) => void) | null = null;
    public onExpChange: ((exp: number, level: number) => void) | null = null;
    public onLevelUp: ((newLevel: number) => void) | null = null;
    public onDeath: (() => void) | null = null;
    
    start() {
        // 加载等级和经验
        if (this.resetLevelOnStart) {
            // 重置模式：强制 1 级 0 经验
            this._level = 1;
            this._experience = 0;
            PlayerDataManager.getInstance().saveLevelAndExp(1, 0);
            console.log('🔄 已重置为 1 级 0 经验');
        } else if (this.initialLevel > 1) {
            // 编辑器覆盖模式（调试用）
            this._level = this.initialLevel;
            this._experience = this.initialExperience;
        } else {
            // 正常模式：从持久化存档读取
            const pdm = PlayerDataManager.getInstance();
            const savedLevel = pdm.getLevel();
            const savedExp = pdm.getExperience();
            this._level = savedLevel > 1 ? savedLevel : 1;
            this._experience = savedLevel > 1 ? savedExp : 0;
            if (savedLevel > 1) {
                console.log(`💾 从存档加载: Lv.${this._level}，经验 ${this._experience}`);
            }
        }

        // 根据初始等级，应用对应的属性加成
        if (this._level > 1) {
            const levelBonus = (this._level - 1) * this.statPerLevel;
            this.maxHealth += levelBonus;
            this.maxMana += levelBonus;
            console.log(`📊 初始等级 Lv.${this._level}，应用属性加成: +${levelBonus} 血量/魔力，升级经验: ${this.getExpNeeded()}`);
        }

        this._health = this.maxHealth;
        this._mana = this.maxMana;

        // 初始化受击音效
        this._audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this._audioSource.loop = false;
    }

    /**
     * 受到伤害
     * @param damage 伤害值
     * @param customHitClip 可选，传入自定义受击音效（如BOSS攻击音效）
     * @param customVolume 可选，传入自定义音量 (0~1)，仅当传入customHitClip时生效
     */
    takeDamage(damage: number, customHitClip?: AudioClip, customVolume?: number) {
        if (damage <= 0) return;
        const actualDamage = Math.max(1, Math.round(damage * this.damageMultiplier));
        this.health -= actualDamage;
        console.log(`💔 受到伤害: ${actualDamage} (原始 ${damage} × ${this.damageMultiplier})，剩余血量: ${this._health}`);

        // 播放受击音效：优先使用传入的自定义音效，否则使用默认hitClip
        const clip = customHitClip || this.hitClip;
        const volume = customHitClip ? (customVolume ?? 1) : this.hitClipVolume;
        if (clip && this._audioSource) {
            this._audioSource.playOneShot(clip, volume);
        }
    }
    
    /** 恢复生命 */
    heal(amount: number) {
        this.health += amount;
    }
    
    /** 使用魔力 */
    useMana(amount: number): boolean {
        if (this._mana < amount) return false;
        this.mana -= amount;
        return true;
    }
    
    /** 恢复魔力 */
    restoreMana(amount: number) {
        this.mana += amount;
    }
    
    /** 每次升级增加的血量和魔力上限 */
    @property({ tooltip: '每级增加的血量和魔力上限' })
    statPerLevel: number = 20;

    /** 增加经验 */
    addExperience(amount: number) {
        if (amount <= 0) return;
        this._experience += amount;
        console.log(`✨ 获得经验: ${amount}，当前经验: ${this._experience}`);

        while (this._experience >= this.getExpNeeded()) {
            this._experience -= this.getExpNeeded();
            this._level++;
            // 升级增加血量和魔力上限
            this.maxHealth += this.statPerLevel;
            this.maxMana += this.statPerLevel;
            // 升级回满血量和魔力
            this._health = this.maxHealth;
            this._mana = this.maxMana;
            console.log(`🎉 升级了！当前等级: ${this._level}，血量上限: ${this.maxHealth}，魔力上限: ${this.maxMana}`);
            if (this.onLevelUp) this.onLevelUp(this._level);
            // 升级后刷新UI
            if (this.onHealthChange) this.onHealthChange(this._health, this.maxHealth);
            if (this.onManaChange) this.onManaChange(this._mana, this.maxMana);
        }

        if (this.onExpChange) this.onExpChange(this._experience, this._level);

        // 持久化存档
        PlayerDataManager.getInstance().saveLevelAndExp(this._level, this._experience);
    }
    
    /** 重置属性 */
    reset() {
        this._health = this.maxHealth;
        this._mana = this.maxMana;
        this._experience = this.initialExperience;
        this._level = this.initialLevel;
    }
}
