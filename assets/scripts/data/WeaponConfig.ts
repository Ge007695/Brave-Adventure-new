/**
 * 武器配置表
 *
 * 每把武器的属性定义，新增武器只需在此文件中添加条目即可，
 * 商店、武器管理器等会自动读取。
 */

/** 武器配置类型 */
export interface WeaponConfig {
    id: string;          // 唯一标识
    name: string;        // 显示名称
    icon: string;        // emoji 图标
    description: string; // 描述文字
    damage: number;      // 每次攻击伤害值
    range: number;       // 攻击检测范围（像素）
    speed: number;       // 攻击速度倍率 (1.0 = 默认)
    price: number;       // 商店购买价格 (0 = 默认拥有)
}

/** 默认武器ID */
export const DEFAULT_WEAPON_ID = 'sword';

/** 武器数据表 */
export const WEAPONS: Record<string, WeaponConfig> = {
    // ── 默认武器：铁剑（初始拥有）──
    sword: {
        id: 'sword',
        name: '铁剑',
        icon: '🗡️',
        description: '一把普通的铁剑，勇者的初始装备',
        damage: 1,
        range: 200,
        speed: 1.0,
        price: 0,
    },

    // ── 可购买武器 ──
    spear: {
        id: 'spear',
        name: '长枪',
        icon: '🔱',
        description: '攻击距离更远，但速度略慢',
        damage: 2,
        range: 280,
        speed: 0.8,
        price: 50,
    },

    dagger: {
        id: 'dagger',
        name: '匕首',
        icon: '🔪',
        description: '攻击速度极快，但范围较短',
        damage: 1,
        range: 120,
        speed: 1.8,
        price: 30,
    },

    greatsword: {
        id: 'greatsword',
        name: '巨剑',
        icon: '⚔️',
        description: '伤害极高但攻速缓慢的重型武器',
        damage: 3,
        range: 220,
        speed: 0.5,
        price: 100,
    },
};

/** 获取武器配置，找不到时返回默认武器 */
export function getWeaponConfig(id: string): WeaponConfig {
    return WEAPONS[id] || WEAPONS[DEFAULT_WEAPON_ID];
}

/** 获取所有武器ID列表（用于商店遍历） */
export function getAllWeaponIds(): string[] {
    return Object.keys(WEAPONS);
}
