import { WeaponConfig, DEFAULT_WEAPON_ID, WEAPONS } from './WeaponConfig';
import { SkillConfig, SKILLS } from './SkillConfig';

/** 玩家持久数据结构 */
interface PlayerData {
    gold: number;
    level: number;
    experience: number;
    weapons: {
        unlocked: string[];
        equipped: string;
    };
    skills: {
        unlocked: string[];
        equipped: (string | null)[];  // 4个技能槽
    };
}

const STORAGE_KEY = 'brave_adventure_player';
const MAX_SKILL_SLOTS = 4;

/**
 * 玩家数据管理器（全局单例）
 *
 * 管理金币、武器解锁/装备、技能解锁/装备，数据通过 localStorage 持久化。
 * 不依赖 Cocos Component，可在任何地方直接 import 使用。
 *
 * 用法：
 *   import { PlayerDataManager } from './PlayerDataManager';
 *   const pdm = PlayerDataManager.getInstance();
 *   pdm.addGold(100);
 *   pdm.unlockWeapon('spear');
 */
export class PlayerDataManager {
    private static _instance: PlayerDataManager | null = null;

    private _data: PlayerData;

    private constructor() {
        this._data = this.load();
    }

    // ==================== 单例 ====================

    static getInstance(): PlayerDataManager {
        if (!PlayerDataManager._instance) {
            PlayerDataManager._instance = new PlayerDataManager();
        }
        return PlayerDataManager._instance;
    }

    // ==================== 持久化 ====================

    private load(): PlayerData {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw) as PlayerData;
                // 确保数据结构完整（兼容旧版本存档）
                return this.migrate(data);
            }
        } catch (e) {
            console.warn('[PlayerData] 读取存档失败，使用默认数据', e);
        }
        return this.defaultData();
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('[PlayerData] 保存存档失败', e);
        }
    }

    /** 数据迁移：补齐可能缺失的字段 */
    private migrate(data: any): PlayerData {
        const defaults = this.defaultData();
        if (data.gold == null) data.gold = defaults.gold;
        if (data.level == null) data.level = defaults.level;
        if (data.experience == null) data.experience = defaults.experience;
        if (!data.weapons) data.weapons = defaults.weapons;
        if (!data.weapons.unlocked) data.weapons.unlocked = defaults.weapons.unlocked;
        if (!data.weapons.equipped) data.weapons.equipped = defaults.weapons.equipped;
        if (!data.skills) data.skills = defaults.skills;
        if (!data.skills.unlocked) data.skills.unlocked = defaults.skills.unlocked;
        if (!data.skills.equipped) data.skills.equipped = defaults.skills.equipped;
        return data as PlayerData;
    }

    private defaultData(): PlayerData {
        return {
            gold: 0,
            level: 1,
            experience: 0,
            weapons: {
                unlocked: [DEFAULT_WEAPON_ID],
                equipped: DEFAULT_WEAPON_ID,
            },
            skills: {
                unlocked: [],
                equipped: [null, null, null, null],
            },
        };
    }

    /** 重置所有数据（调试用） */
    reset(): void {
        this._data = this.defaultData();
        this.save();
    }

    /** 只重置技能解锁和装备状态（保留金币和武器） */
    resetSkills(): void {
        const defaults = this.defaultData();
        this._data.skills = defaults.skills;
        this.save();
        console.log('🔧 [PlayerData] 技能数据已重置');
    }

    // ==================== 金币 ====================

    getGold(): number {
        return this._data.gold;
    }

    addGold(amount: number): void {
        if (amount <= 0) return;
        this._data.gold += amount;
        this.save();
        console.log(`🪙 获得金币 +${amount}，当前余额: ${this._data.gold}`);
    }

    /** 直接设置金币数量（调试/编辑器用） */
    setGold(amount: number): void {
        if (amount < 0) amount = 0;
        this._data.gold = amount;
        this.save();
        console.log(`🪙 设置金币为 ${this._data.gold}`);
    }

    /** @returns 是否消费成功 */
    spendGold(amount: number): boolean {
        if (amount <= 0) return true;
        if (this._data.gold < amount) {
            console.warn(`🪙 金币不足！需要 ${amount}，当前 ${this._data.gold}`);
            return false;
        }
        this._data.gold -= amount;
        this.save();
        console.log(`🪙 消费金币 -${amount}，当前余额: ${this._data.gold}`);
        return true;
    }

    // ==================== 武器 ====================

    /** 获取所有已解锁的武器ID */
    getUnlockedWeapons(): string[] {
        return [...this._data.weapons.unlocked];
    }

    /** 检查武器是否已解锁 */
    isWeaponUnlocked(id: string): boolean {
        return this._data.weapons.unlocked.indexOf(id) !== -1;
    }

    /** 解锁武器 */
    unlockWeapon(id: string): void {
        if (this.isWeaponUnlocked(id)) return;
        this._data.weapons.unlocked.push(id);
        this.save();
        console.log(`🗡️ 解锁武器: ${id}`);
    }

    /** 装备武器 */
    equipWeapon(id: string): void {
        if (!this.isWeaponUnlocked(id)) {
            console.warn(`🗡️ 武器未解锁，无法装备: ${id}`);
            return;
        }
        this._data.weapons.equipped = id;
        this.save();
        console.log(`🗡️ 装备武器: ${id}`);
    }

    /** 获取当前装备的武器ID */
    getEquippedWeaponId(): string {
        return this._data.weapons.equipped;
    }

    /** 获取当前装备的武器配置 */
    getEquippedWeaponConfig(): WeaponConfig {
        const id = this._data.weapons.equipped;
        return WEAPONS[id] || WEAPONS[DEFAULT_WEAPON_ID];
    }

    // ==================== 技能 ====================

    /** 获取所有已解锁的技能ID */
    getUnlockedSkills(): string[] {
        return [...this._data.skills.unlocked];
    }

    /** 检查技能是否已解锁 */
    isSkillUnlocked(id: string): boolean {
        return this._data.skills.unlocked.indexOf(id) !== -1;
    }

    /** 解锁技能 */
    unlockSkill(id: string): void {
        if (this.isSkillUnlocked(id)) return;
        this._data.skills.unlocked.push(id);
        this.save();
        console.log(`✨ 解锁技能: ${id}`);
    }

    /**
     * 将技能装备到指定槽位
     * @param slot 槽位索引 0-3
     * @param id 技能ID，传 null 卸下
     */
    equipSkill(slot: number, id: string | null): void {
        if (slot < 0 || slot >= MAX_SKILL_SLOTS) {
            console.warn(`✨ 无效技能槽位: ${slot}`);
            return;
        }
        if (id !== null && !this.isSkillUnlocked(id)) {
            console.warn(`✨ 技能未解锁，无法装备: ${id}`);
            return;
        }
        // 如果该技能已在其他槽位，先卸下
        for (let i = 0; i < MAX_SKILL_SLOTS; i++) {
            if (i !== slot && this._data.skills.equipped[i] === id) {
                this._data.skills.equipped[i] = null;
            }
        }
        this._data.skills.equipped[slot] = id;
        this.save();
        console.log(`✨ 技能槽 ${slot + 1}: ${id || '空'}`);
    }

    /** 获取所有技能槽的装备状态 */
    getEquippedSkills(): (string | null)[] {
        return [...this._data.skills.equipped];
    }

    /** 获取指定槽位的技能配置 */
    getEquippedSkillConfig(slot: number): SkillConfig | null {
        const id = this._data.skills.equipped[slot];
        if (!id) return null;
        return SKILLS[id] || null;
    }

    /** 获取所有已装备且已解锁的技能配置列表 */
    getActiveSkillConfigs(): SkillConfig[] {
        const result: SkillConfig[] = [];
        for (const id of this._data.skills.equipped) {
            if (id && this.isSkillUnlocked(id) && SKILLS[id]) {
                result.push(SKILLS[id]);
            }
        }
        return result;
    }

    // ==================== 等级 & 经验 ====================

    getLevel(): number {
        return this._data.level;
    }

    setLevel(level: number): void {
        if (level < 1) level = 1;
        this._data.level = level;
        this.save();
    }

    getExperience(): number {
        return this._data.experience;
    }

    setExperience(exp: number): void {
        if (exp < 0) exp = 0;
        this._data.experience = exp;
        this.save();
    }

    /** 同时保存等级和经验（减少写入次数） */
    saveLevelAndExp(level: number, exp: number): void {
        this._data.level = Math.max(1, level);
        this._data.experience = Math.max(0, exp);
        this.save();
    }

    // ==================== 调试 ====================

    /** 打印当前数据状态（调试用） */
    debugPrint(): void {
        console.log('── 玩家数据 ──');
        console.log(`⭐ 等级: Lv.${this._data.level}  经验: ${this._data.experience}`);
        console.log(`🪙 金币: ${this._data.gold}`);
        console.log(`🗡️ 武器: 已解锁 [${this._data.weapons.unlocked.join(', ')}]  装备中: ${this._data.weapons.equipped}`);
        console.log(`✨ 技能: 已解锁 [${this._data.skills.unlocked.join(', ')}]  装备: [${this._data.skills.equipped.map(s => s || '空').join(', ')}]`);
    }
}
