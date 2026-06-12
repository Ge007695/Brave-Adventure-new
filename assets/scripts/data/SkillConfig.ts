/**
 * 技能配置表
 *
 * 每个技能的属性定义，新增技能只需在此文件中添加条目即可，
 * 商店、技能管理器等会自动读取。
 */

/** 技能类型 */
export enum SkillType {
    /** 发射物：朝玩家朝向发射飞行弹幕 */
    Projectile = 'projectile',
    /** 自愈：直接回复玩家生命值 */
    SelfHeal = 'selfHeal',
    /** 范围伤害：以玩家为中心对周围敌人造成伤害 */
    AOE = 'aoe',
    /** 增益Buff：给玩家加临时增益效果 */
    Buff = 'buff',
}

/** 技能配置类型 */
export interface SkillConfig {
    id: string;          // 唯一标识
    name: string;        // 显示名称
    icon: string;        // emoji 图标
    description: string; // 描述文字
    type: SkillType;     // 技能类型
    manaCost: number;    // 释放所需魔力
    cooldown: number;    // 冷却时间（秒）
    price: number;       // 商店购买价格

    // 以下字段按技能类型选填
    damage?: number;     // type=projectile/aoe 时：造成的伤害
    range?: number;      // type=projectile/aoe 时：影响范围
    speed?: number;      // type=projectile 时：弹幕飞行速度
    heal?: number;       // type=selfHeal 时：回复生命值
    duration?: number;   // type=buff 时：增益持续时间（秒）
    buffDamageMul?: number; // type=buff 时：攻击力倍率
    buffDefenseMul?: number; // type=buff 时：防御力倍率
}

/** 技能数据表 */
export const SKILLS: Record<string, SkillConfig> = {
    fireball: {
        id: 'fireball',
        name: '火球术',
        icon: '🔥',
        description: '朝前方发射一枚火球，命中敌人造成伤害',
        type: SkillType.Projectile,
        manaCost: 15,
        cooldown: 3,
        price: 30,
        damage: 5,
        range: 400,
        speed: 500,
    },

    heal: {
        id: 'heal',
        name: '治愈术',
        icon: '💚',
        description: '恢复自身30点生命值',
        type: SkillType.SelfHeal,
        manaCost: 20,
        cooldown: 8,
        price: 40,
        heal: 30,
    },

    whirlwind: {
        id: 'whirlwind',
        name: '旋风斩',
        icon: '🌀',
        description: '旋转攻击周围敌人，造成范围伤害',
        type: SkillType.AOE,
        manaCost: 25,
        cooldown: 6,
        price: 60,
        damage: 4,
        range: 300,
    },

    shield: {
        id: 'shield',
        name: '护盾',
        icon: '🛡️',
        description: '获得持续5秒的护盾，受到伤害减半',
        type: SkillType.Buff,
        manaCost: 30,
        cooldown: 12,
        price: 50,
        duration: 5,
        buffDamageMul: 1.0,
        buffDefenseMul: 0.5,
    },
};

/** 获取技能配置，找不到时返回 undefined */
export function getSkillConfig(id: string): SkillConfig | undefined {
    return SKILLS[id];
}

/** 获取所有技能ID列表（用于商店遍历） */
export function getAllSkillIds(): string[] {
    return Object.keys(SKILLS);
}
