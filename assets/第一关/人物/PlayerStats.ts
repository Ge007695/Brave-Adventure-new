import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PlayerStats')
export class PlayerStats extends Component {
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
    private _experience: number = 0;
    public get experience(): number { return this._experience; }
    
    /** 升级所需经验 */
    @property
    expToLevelUp: number = 10;
    
    /** 当前等级 */
    private _level: number = 1;
    public get level(): number { return this._level; }
    
    /** 回调事件 */
    public onHealthChange: ((current: number, max: number) => void) | null = null;
    public onManaChange: ((current: number, max: number) => void) | null = null;
    public onExpChange: ((exp: number, level: number) => void) | null = null;
    public onLevelUp: ((newLevel: number) => void) | null = null;
    public onDeath: (() => void) | null = null;
    
    start() {
        this._health = this.maxHealth;
        this._mana = this.maxMana;
    }
    
    /** 受到伤害 */
    takeDamage(damage: number) {
        if (damage <= 0) return;
        this.health -= damage;
        console.log(`💔 受到伤害: ${damage}，剩余血量: ${this._health}`);
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
    
    /** 增加经验 */
    addExperience(amount: number) {
        if (amount <= 0) return;
        this._experience += amount;
        console.log(`✨ 获得经验: ${amount}，当前经验: ${this._experience}`);
        
        while (this._experience >= this.expToLevelUp) {
            this._experience -= this.expToLevelUp;
            this._level++;
            console.log(`🎉 升级了！当前等级: ${this._level}`);
            if (this.onLevelUp) this.onLevelUp(this._level);
        }
        
        if (this.onExpChange) this.onExpChange(this._experience, this._level);
    }
    
    /** 重置属性 */
    reset() {
        this._health = this.maxHealth;
        this._mana = this.maxMana;
        this._experience = 0;
        this._level = 1;
    }
}
