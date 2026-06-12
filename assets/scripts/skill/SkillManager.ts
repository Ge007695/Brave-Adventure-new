import { _decorator, Component, Node, Graphics, Color, UITransform, Vec3 } from 'cc';
import { PlayerStats } from '../../第一关/人物/PlayerStats';
import { PlayerDataManager } from '../data/PlayerDataManager';
import { SkillType, SkillConfig, SKILLS } from '../data/SkillConfig';

const { ccclass, property } = _decorator;

/** 技能冷却信息 */
interface CooldownInfo {
    timer: number;      // 剩余冷却时间（秒）
    total: number;      // 总冷却时间
}

/** 技能按键映射 */
const SKILL_KEYS = ['y', 'u', 'i', 'o'];

/**
 * 技能管理器（跨关卡共享）
 * 挂载到任意关卡的玩家节点即可生效。
 * 数据走 PlayerDataManager（localStorage 持久化），解锁状态全关卡通用。
 */
@ccclass('SkillManager')
export class SkillManager extends Component {
    @property({ tooltip: '调试模式：自动解锁并装备全部技能' })
    debugMode: boolean = false;

    private _playerStats: PlayerStats | null = null;
    private _pdm: PlayerDataManager;

    /** 每个技能槽的冷却计时器 */
    private _cooldowns: CooldownInfo[] = [
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
    ];

    /** Buff 状态 */
    private _buffTimer: number = 0;
    private _buffVisual: Node | null = null;

    // DOM 事件兜底
    private _onKeyDownDom: ((e: KeyboardEvent) => void) | null = null;

    onLoad() {
        this._pdm = PlayerDataManager.getInstance();
        this._playerStats = this.getComponent(PlayerStats);

        // 调试模式：自动解锁并装备全部技能
        if (this.debugMode) {
            this.setupDebugSkills();
        }

        // DOM 事件监听（兜底）
        this._onKeyDownDom = (e: KeyboardEvent) => {
            const idx = SKILL_KEYS.indexOf(e.key);
            if (idx >= 0) {
                this.tryUseSkill(idx);
            }
        };
        document.addEventListener('keydown', this._onKeyDownDom);

        // 打印当前技能状态
        this.printSkillStatus();
    }

    /** 调试用：解锁全部技能并装备到4个槽位 */
    private setupDebugSkills(): void {
        const allIds = Object.keys(SKILLS);
        for (const id of allIds) {
            this._pdm.unlockSkill(id);
        }
        for (let i = 0; i < 4 && i < allIds.length; i++) {
            this._pdm.equipSkill(i, allIds[i]);
        }
        console.log('🔧 [SkillManager] 调试模式：已解锁并装备全部技能');
    }

    private printSkillStatus(): void {
        const equipped = this._pdm.getEquippedSkills();
        for (let i = 0; i < 4; i++) {
            const id = equipped[i];
            if (id) {
                const cfg = this._pdm.getEquippedSkillConfig(i);
                const unlocked = this._pdm.isSkillUnlocked(id);
                console.log(`  [${SKILL_KEYS[i]}] 槽位${i + 1}: ${cfg?.icon} ${cfg?.name} ${unlocked ? '✅已解锁' : '🔒未解锁'}`);
            } else {
                console.log(`  [${SKILL_KEYS[i]}] 槽位${i + 1}: 空`);
            }
        }
    }

    update(deltaTime: number) {
        // 更新冷却
        for (const cd of this._cooldowns) {
            if (cd.timer > 0) cd.timer -= deltaTime;
        }

        // 更新Buff计时
        if (this._buffTimer > 0) {
            this._buffTimer -= deltaTime;

            // 护盾跟随玩家
            if (this._buffVisual && this._buffVisual.isValid) {
                const pos = this.node.worldPosition.clone();
                this._buffVisual.setWorldPosition(pos.x, pos.y, pos.z);
            }

            if (this._buffTimer <= 0) {
                this.deactivateShield();
            }
        }
    }

    onDestroy() {
        if (this._onKeyDownDom) {
            document.removeEventListener('keydown', this._onKeyDownDom);
        }
        this.deactivateShield();
    }

    // ==================== 主入口 ====================

    /**
     * 尝试使用指定槽位的技能
     * @param slot 槽位索引 0-3
     */
    public tryUseSkill(slot: number): void {
        if (!this._playerStats) return;

        const config = this._pdm.getEquippedSkillConfig(slot);
        if (!config) return; // 槽位为空

        // 检查解锁
        if (!this._pdm.isSkillUnlocked(config.id)) return;

        // 检查冷却
        const cd = this._cooldowns[slot];
        if (cd.timer > 0) {
            console.log(`⏳ ${config.name} 冷却中 (${cd.timer.toFixed(1)}秒)`);
            return;
        }

        // 检查魔力
        if (this._playerStats.mana < config.manaCost) {
            console.log(`💙 魔力不足！需要 ${config.manaCost}，当前 ${this._playerStats.mana}`);
            return;
        }

        // 扣除魔力 & 进入冷却
        this._playerStats.useMana(config.manaCost);
        cd.timer = config.cooldown;
        cd.total = config.cooldown;

        // 执行技能
        this.executeSkill(config, slot);

        console.log(`✨ 释放技能: ${config.name} (槽位${slot + 1})`);
    }

    // ==================== 技能执行分发 ====================

    private executeSkill(config: SkillConfig, _slot: number): void {
        switch (config.type) {
            case SkillType.Projectile:
                this.executeProjectile(config);
                break;
            case SkillType.SelfHeal:
                this.executeSelfHeal(config);
                break;
            case SkillType.AOE:
                this.executeAOE(config);
                break;
            case SkillType.Buff:
                this.executeBuff(config);
                break;
        }
    }

    // ==================== 🔥 发射物：火球术 ====================

    private executeProjectile(config: SkillConfig): void {
        const dir = this.getFacingDir();
        const fireball = new Node('Fireball');
        const parent = this.getSceneRoot();
        parent.addChild(fireball);

        const pos = this.node.worldPosition.clone();
        fireball.setWorldPosition(pos.x + dir * 60, pos.y + 30, pos.z);

        // 绘制火球
        const radius = 18;
        fireball.addComponent(UITransform).setContentSize(radius * 4, radius * 4);
        const g = fireball.addComponent(Graphics);
        g.fillColor = new Color(255, 140, 30, 120);
        g.circle(0, 0, radius + 6); g.fill();
        g.fillColor = new Color(255, 200, 50, 255);
        g.circle(0, 0, radius); g.fill();
        g.fillColor = new Color(255, 255, 200, 200);
        g.circle(-4, 4, radius * 0.4); g.fill();

        // 飞行：每隔0.016秒移动一步
        const speed = config.speed || 400;
        const maxDist = config.range || 400;
        let traveled = 0;
        let destroyed = false;

        const stepCallback = () => {
            if (!fireball || !fireball.isValid || destroyed) return;

            const step = speed * 0.016;
            traveled += step;
            const cp = fireball.worldPosition;
            fireball.setWorldPosition(cp.x + dir * step, cp.y, cp.z);

            // 超出射程
            if (traveled >= maxDist) {
                destroyed = true;
                this.unschedule(stepCallback);
                this.destroyFireball(fireball);
                return;
            }

            // 碰撞检测
            if (this.checkFireballHit(fireball.worldPosition, config.damage || 1)) {
                destroyed = true;
                this.unschedule(stepCallback);
                this.destroyFireball(fireball);
            }
        };

        this.schedule(stepCallback, 0.016);

        // 超时自动清理
        this.scheduleOnce(() => {
            if (!destroyed && fireball && fireball.isValid) {
                destroyed = true;
                this.unschedule(stepCallback);
                fireball.destroy();
            }
        }, maxDist / speed + 1);
    }

    private checkFireballHit(pos: Vec3, damage: number): boolean {
        const root = this.getSceneRoot();
        const enemies = this.findAllEnemies(root);

        for (const enemy of enemies) {
            if (!enemy.node || !enemy.node.activeInHierarchy) continue;

            const epos = enemy.node.worldPosition;
            const dx = pos.x - epos.x;
            const dy = pos.y - epos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 50 && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(damage);
                console.log(`🔥 火球命中: ${enemy.node.name}`);
                return true;
            }
        }
        return false;
    }

    private destroyFireball(fireball: Node): void {
        if (!fireball || !fireball.isValid) return;

        // 爆炸小特效
        const pos = fireball.worldPosition.clone();
        fireball.destroy();

        const explosion = new Node('Explosion');
        const parent = this.getSceneRoot();
        parent.addChild(explosion);
        explosion.setWorldPosition(pos.x, pos.y, pos.z);
        explosion.addComponent(UITransform).setContentSize(60, 60);
        const g = explosion.addComponent(Graphics);
        g.fillColor = new Color(255, 180, 30, 180);
        g.circle(0, 0, 20);
        g.fill();
        g.fillColor = new Color(255, 100, 20, 100);
        g.circle(0, 0, 30);
        g.fill();

        this.scheduleOnce(() => {
            if (explosion && explosion.isValid) explosion.destroy();
        }, 0.2);
    }

    // ==================== 💚 自愈：治愈术 ====================

    private executeSelfHeal(config: SkillConfig): void {
        if (!this._playerStats) return;
        const healAmount = config.heal || 0;
        this._playerStats.heal(healAmount);
        console.log(`💚 治愈术：回复 ${healAmount} 点生命`);

        // 绿色光环特效
        this.showHealEffect();
    }

    private showHealEffect(): void {
        const node = new Node('HealEffect');
        const parent = this.getSceneRoot();
        parent.addChild(node);
        const pos = this.node.worldPosition.clone();
        node.setWorldPosition(pos.x, pos.y, pos.z);
        node.addComponent(UITransform).setContentSize(140, 140);
        const g = node.addComponent(Graphics);
        // 外层大光环
        g.fillColor = new Color(80, 255, 120, 80);
        g.circle(0, 0, 65); g.fill();
        // 内层实心光
        g.fillColor = new Color(120, 255, 160, 150);
        g.circle(0, 0, 40); g.fill();
        // 十字星光
        g.fillColor = new Color(200, 255, 220, 255);
        g.circle(0, 0, 10); g.fill();

        this.scheduleOnce(() => {
            if (node && node.isValid) node.destroy();
        }, 0.5);
    }

    // ==================== 🌀 范围伤害：旋风斩 ====================

    private executeAOE(config: SkillConfig): void {
        const root = this.getSceneRoot();
        const enemies = this.findAllEnemies(root);
        const myPos = this.node.worldPosition;
        const range = config.range || 300;
        const damage = config.damage || 1;
        let hitCount = 0;

        for (const enemy of enemies) {
            if (!enemy.node || !enemy.node.activeInHierarchy) continue;

            const epos = enemy.node.worldPosition;
            const dx = myPos.x - epos.x;
            const dy = myPos.y - epos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= range && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(damage);
                hitCount++;
            }
        }

        console.log(`🌀 旋风斩：命中 ${hitCount} 个敌人`);

        // AOE 视觉特效
        this.showAOEEffect(range);
    }

    private showAOEEffect(range: number): void {
        const node = new Node('AOEEffect');
        const parent = this.getSceneRoot();
        parent.addChild(node);
        const pos = this.node.worldPosition.clone();
        node.setWorldPosition(pos.x, pos.y, pos.z);
        node.addComponent(UITransform).setContentSize(range * 2, range * 2);
        const g = node.addComponent(Graphics);

        // 填充底色
        g.fillColor = new Color(100, 180, 255, 60);
        g.circle(0, 0, range); g.fill();

        // 多层旋风圈
        for (let i = 0; i < 3; i++) {
            const alpha = 220 - i * 60;
            g.strokeColor = new Color(150, 200, 255, alpha);
            g.lineWidth = 5 + i * 3;
            g.circle(0, 0, range * (0.5 + i * 0.2));
            g.stroke();
        }

        this.scheduleOnce(() => {
            if (node && node.isValid) node.destroy();
        }, 0.4);
    }

    // ==================== 🛡️ Buff：护盾 ====================

    private executeBuff(config: SkillConfig): void {
        const duration = config.duration || 5;
        this._buffTimer = duration;

        // 设置减伤
        if (this._playerStats) {
            this._playerStats.damageMultiplier = config.buffDefenseMul || 0.5;
        }

        // 护盾视觉效果
        this.showShieldVisual();

        console.log(`🛡️ 护盾：持续 ${duration} 秒，受到伤害 ×${config.buffDefenseMul || 0.5}`);
    }

    private showShieldVisual(): void {
        this.deactivateShield();

        this._buffVisual = new Node('ShieldEffect');
        // 挂在场景根节点，update中跟随玩家位置
        const parent = this.getSceneRoot();
        parent.addChild(this._buffVisual);
        const pos = this.node.worldPosition.clone();
        this._buffVisual.setWorldPosition(pos.x, pos.y, pos.z);
        this._buffVisual.addComponent(UITransform).setContentSize(180, 180);
        const g = this._buffVisual.addComponent(Graphics);
        // 半透明填充
        g.fillColor = new Color(80, 160, 255, 60);
        g.circle(0, 0, 70); g.fill();
        // 外圈
        g.strokeColor = new Color(100, 180, 255, 220);
        g.lineWidth = 6;
        g.circle(0, 0, 70); g.stroke();
        // 内圈
        g.strokeColor = new Color(160, 220, 255, 180);
        g.lineWidth = 3;
        g.circle(0, 0, 55); g.stroke();
    }

    private deactivateShield(): void {
        if (this._buffVisual && this._buffVisual.isValid) {
            this._buffVisual.destroy();
        }
        this._buffVisual = null;
        this._buffTimer = 0;

        if (this._playerStats) {
            this._playerStats.damageMultiplier = 1;
        }

        console.log('🛡️ 护盾效果结束');
    }

    // ==================== 工具方法 ====================

    /** 获取玩家朝向：1=右，-1=左 */
    private getFacingDir(): number {
        return this.node.scale.x >= 0 ? 1 : -1;
    }

    /** 获取场景根节点（Canvas）用于生成火球等 */
    private getSceneRoot(): Node {
        let root = this.node;
        while (root.parent && root.parent.parent) {
            root = root.parent;
        }
        return root;
    }

    /** 查找场景中所有敌人组件 */
    private findAllEnemies(node: Node): any[] {
        const result: any[] = [];

        const search = (n: Node) => {
            // 匹配已知的敌人组件名
            for (const compName of ['Octopus', 'FinalBoss', 'Flagfish', 'HermitCrab']) {
                const comp = n.getComponent(compName);
                if (comp) {
                    result.push(comp);
                    break; // 一个节点只取一个敌人组件
                }
            }
            for (const child of n.children) {
                search(child);
            }
        };

        search(node);
        return result;
    }

    // ==================== 公开查询 ====================

    /** 获取指定槽位的冷却进度 (0-1)，供 UI 使用 */
    public getCooldownProgress(slot: number): number {
        const cd = this._cooldowns[slot];
        if (cd.total <= 0) return 0;
        return Math.max(0, cd.timer / cd.total);
    }

    /** 获取指定槽位装备的技能配置 */
    public getSkillConfig(slot: number): SkillConfig | null {
        return this._pdm.getEquippedSkillConfig(slot);
    }

    /** 护盾是否激活中 */
    public isShieldActive(): boolean {
        return this._buffTimer > 0;
    }
}
