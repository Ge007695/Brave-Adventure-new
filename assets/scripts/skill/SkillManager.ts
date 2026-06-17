import { _decorator, Component, Node, Graphics, Color, UITransform, Vec3, input, Input, EventKeyboard, KeyCode } from 'cc';
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
    @property({ tooltip: '⚠️ 调试模式：勾选后自动解锁并装备全部技能（正式发布前请关闭）' })
    debugMode: boolean = false;

    @property({ tooltip: '重置数据：勾选后启动时清除所有技能解锁状态' })
    resetSkillsOnStart: boolean = false;

    // ═══════════════════════════════════════════════════════════
    // 技能强度覆盖（0 = 使用 SkillConfig 默认值，>0 时覆盖）
    // 可在编辑器 Inspector 面板中直接调整，无需改代码
    // ═══════════════════════════════════════════════════════════

    @property({ group: '⚔️ 破空斩', tooltip: '伤害（0=默认6）' })
    slashDamage: number = 0;

    @property({ group: '⚔️ 破空斩', tooltip: '射程（0=默认500）' })
    slashRange: number = 0;

    @property({ group: '⚔️ 破空斩', tooltip: '飞行速度（0=默认900）' })
    slashSpeed: number = 0;

    @property({ group: '💚 治愈术', tooltip: '回复生命值（0=默认30）' })
    healAmount: number = 0;

    @property({ group: '🌀 旋风斩', tooltip: '每跳伤害（0=默认4）' })
    whirlwindDamage: number = 0;

    @property({ group: '🌀 旋风斩', tooltip: '伤害范围（0=默认300）' })
    whirlwindRange: number = 0;

    @property({ group: '🌑 影刃瞬突', tooltip: '伤害（0=默认5）' })
    shadowDashDamage: number = 0;

    @property({ group: '🌑 影刃瞬突', tooltip: '冲刺距离（0=默认350）' })
    shadowDashRange: number = 0;

    @property({ group: '🌑 影刃瞬突', tooltip: '冲刺速度（0=默认2400）' })
    shadowDashSpeed: number = 0;

    private _playerStats: PlayerStats | null = null;
    private _pdm: PlayerDataManager;

    /** 每个技能槽的冷却计时器 */
    private _cooldowns: CooldownInfo[] = [
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
        { timer: 0, total: 0 },
    ];

    // DOM 事件兜底
    private _onKeyDownDom: ((e: KeyboardEvent) => void) | null = null;

    // 旋风斩状态
    private _whirlwindActive: boolean = false;
    private _whirlwindAngle: number = 0;
    private _whirlwindVFX: Node | null = null;
    private _whirlwindHitTimers: Map<any, number> = new Map();

    onLoad() {
        this._pdm = PlayerDataManager.getInstance();
        this._playerStats = this.getComponent(PlayerStats);

        // 重置技能数据（编辑器勾选后生效，运行一次后手动取消勾选）
        if (this.resetSkillsOnStart) {
            this._pdm.resetSkills();
            console.log('🔧 [SkillManager] 已重置技能解锁状态（金币和武器保留）');
        }

        // 调试模式：自动解锁并装备全部技能
        if (this.debugMode) {
            this.setupDebugSkills();
        }

        // Cocos 原生输入系统（主通道）
        input.on(Input.EventType.KEY_DOWN, this.onSkillKeyDown, this);

        // DOM 事件监听（兜底通道，画布失焦时也能接收按键）
        this._onKeyDownDom = (e: KeyboardEvent) => {
            const idx = SKILL_KEYS.indexOf(e.key.toLowerCase());
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
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onSkillKeyDown, this);
        if (this._onKeyDownDom) {
            document.removeEventListener('keydown', this._onKeyDownDom);
        }
    }

    // ==================== 键盘输入处理 ====================

    /** Cocos 原生键盘事件 → 技能槽映射 */
    private skillKeyMap: Record<number, number> = {
        [KeyCode.KEY_Y]: 0,
        [KeyCode.KEY_U]: 1,
        [KeyCode.KEY_I]: 2,
        [KeyCode.KEY_O]: 3,
    };

    private onSkillKeyDown(event: EventKeyboard): void {
        const slot = this.skillKeyMap[event.keyCode];
        if (slot !== undefined) {
            this.tryUseSkill(slot);
        }
    }

    // ==================== 主入口 ====================

    /**
     * 尝试使用指定槽位的技能
     * @param slot 槽位索引 0-3
     */
    public tryUseSkill(slot: number): void {
        if (!this._playerStats) {
            console.warn('⚠️ [技能] PlayerStats 未找到，无法使用技能');
            return;
        }

        const config = this._pdm.getEquippedSkillConfig(slot);
        if (!config) {
            console.log(`⚠️ [技能] 槽位 ${slot + 1} (${SKILL_KEYS[slot]}键) 未装备技能`);
            return;
        }

        // 检查解锁
        if (!this._pdm.isSkillUnlocked(config.id)) {
            console.log(`🔒 [技能] ${config.name} 未解锁，请先到商店购买`);
            return;
        }

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
                this.executeWhirlwind(config);
                break;
            case SkillType.Dash:
                this.executeDash(config);
                break;
        }
    }

    // ==================== ⚔️ 发射物：破空斩 ====================

    private executeProjectile(config: SkillConfig): void {
        const dir = this.getFacingDir();

        // 蓄力特效：玩家身上短暂闪光
        this.showChargeEffect(dir);

        // 延迟 0.2 秒后发射剑气
        this.scheduleOnce(() => {
            this.launchSlashBeam(config, dir);
        }, 0.2);
    }

    /** 蓄力特效：角色身上剑形光芒 */
    private showChargeEffect(dir: number): void {
        const pos = this.node.worldPosition.clone();
        const glow = new Node('ChargeGlow');
        const parent = this.getSceneRoot();
        parent.addChild(glow);
        glow.setWorldPosition(pos.x + dir * 30, pos.y + 10, pos.z);

        glow.addComponent(UITransform).setContentSize(50, 140);
        const g = glow.addComponent(Graphics);

        // 外层光晕
        g.fillColor = new Color(180, 210, 255, 80);
        g.roundRect(-12, -65, 24, 130, 6); g.fill();

        // 中层
        g.fillColor = new Color(220, 235, 255, 150);
        g.roundRect(-6, -58, 12, 116, 4); g.fill();

        // 核心白光
        g.fillColor = new Color(250, 252, 255, 220);
        g.roundRect(-3, -52, 6, 104, 2); g.fill();

        // 顶部汇聚光点
        g.fillColor = new Color(255, 255, 255, 255);
        g.circle(0, 48, 5); g.fill();

        this.scheduleOnce(() => {
            if (glow && glow.isValid) glow.destroy();
        }, 0.35);
    }

    /** 绘制月牙形（两弧同向弯曲，外凸内收，形成 🌙 形状） */
    private drawCrescent(g: Graphics, cx: number, cy: number, dir: number,
        width: number, height: number, color: Color): void {
        const hh = height / 2;            // 半高
        const outer = width;              // 外弧凸出量
        const inner = width * 0.65;       // 内弧凸出量（同向但较小 → 月牙薄厚）
        const tipX = cx - dir * 5;        // 两尖端落在弧背侧

        g.fillColor = color;
        g.moveTo(tipX, cy + hh);          // 下月尖
        // 外弧（锋刃）：大幅凸出
        g.bezierCurveTo(
            cx + dir * outer, cy + hh,
            cx + dir * outer, cy - hh,
            tipX, cy - hh,               // 上月尖
        );
        // 内弧（月弯）：同向凸出但幅度较小
        g.bezierCurveTo(
            cx + dir * inner, cy - hh,
            cx + dir * inner, cy + hh,
            tipX, cy + hh,               // 回到下月尖
        );
        g.close();
        g.fill();
    }

    /** 描边月牙外弧 */
    private strokeCrescent(g: Graphics, cx: number, cy: number, dir: number,
        width: number, height: number): void {
        const hh = height / 2;
        const outer = width;
        const tipX = cx - dir * 5;

        g.moveTo(tipX, cy + hh);
        g.bezierCurveTo(
            cx + dir * outer, cy + hh,
            cx + dir * outer, cy - hh,
            tipX, cy - hh,
        );
        g.stroke();
    }

    /** 发射半月形剑气 */
    private launchSlashBeam(config: SkillConfig, dir: number): void {
        const beam = new Node('SlashBeam');
        const parent = this.getSceneRoot();
        parent.addChild(beam);

        const pos = this.node.worldPosition.clone();
        beam.setWorldPosition(pos.x + dir * 75, pos.y + 10, pos.z);

        beam.addComponent(UITransform).setContentSize(180, 130);
        const g = beam.addComponent(Graphics);

        // 三层半月形叠加，外大内小，形成辉光→剑气→核心的层次感

        // 第1层：外层辉光（最大、最淡）
        this.drawCrescent(g, 0, 0, dir, 95, 110,
            new Color(160, 200, 255, 45));

        // 第2层：中层光芒
        this.drawCrescent(g, 0, 0, dir, 78, 96,
            new Color(210, 230, 255, 120));

        // 第3层：主剑气（雪亮白色）
        this.drawCrescent(g, 0, 0, dir, 68, 88,
            new Color(240, 248, 255, 235));

        // 第4层：核心锋刃（纯白高亮，略窄）
        this.drawCrescent(g, 0, 0, dir, 52, 72,
            new Color(255, 255, 255, 255));

        // 第5层：刃身流光纹理（最内，极薄）
        this.drawCrescent(g, 0, 0, dir, 36, 56,
            new Color(255, 255, 255, 230));

        // 外弧光线：沿剑气外缘勾勒一条细亮线
        g.strokeColor = new Color(255, 255, 255, 200);
        g.lineWidth = 2;
        this.strokeCrescent(g, 0, 0, dir, 68, 88);

        // 飞行（编辑器可覆盖）
        const speed = this.slashSpeed > 0 ? this.slashSpeed : (config.speed || 900);
        const maxDist = this.slashRange > 0 ? this.slashRange : (config.range || 500);
        const slashDmg = this.slashDamage > 0 ? this.slashDamage : (config.damage || 6);
        let traveled = 0;
        let destroyed = false;
        let particleTimer = 0;

        const stepCallback = () => {
            if (!beam || !beam.isValid || destroyed) return;

            const step = speed * 0.016;
            traveled += step;
            const cp = beam.worldPosition;
            beam.setWorldPosition(cp.x + dir * step, cp.y, cp.z);

            // 粒子拖尾：每隔几帧生成气流粒子
            particleTimer += 0.016;
            if (particleTimer >= 0.03) {
                particleTimer = 0;
                this.spawnSlashParticle(cp.x - dir * 60, cp.y);
            }

            // 超出射程
            if (traveled >= maxDist) {
                destroyed = true;
                this.unschedule(stepCallback);
                this.destroySlashBeam(beam);
                return;
            }

            // 碰撞检测（剑气判定范围更大）
            if (this.checkSlashHit(beam.worldPosition, slashDmg)) {
                destroyed = true;
                this.unschedule(stepCallback);
                this.destroySlashBeam(beam);
            }
        };

        this.schedule(stepCallback, 0.016);

        // 超时自动清理
        this.scheduleOnce(() => {
            if (!destroyed && beam && beam.isValid) {
                destroyed = true;
                this.unschedule(stepCallback);
                beam.destroy();
            }
        }, maxDist / speed + 0.5);
    }

    /** 生成剑气拖尾粒子 */
    private spawnSlashParticle(x: number, y: number): void {
        const particle = new Node('SlashParticle');
        const parent = this.getSceneRoot();
        parent.addChild(particle);
        particle.setWorldPosition(
            x + (Math.random() - 0.5) * 50,
            y + (Math.random() - 0.5) * 30,
            0
        );

        const size = 2 + Math.random() * 4;
        particle.addComponent(UITransform).setContentSize(size * 3, size * 3);
        const g = particle.addComponent(Graphics);
        const alpha = 120 + Math.random() * 100;
        g.fillColor = new Color(210, 235, 255, alpha);
        g.circle(0, 0, size); g.fill();

        this.scheduleOnce(() => {
            if (particle && particle.isValid) particle.destroy();
        }, 0.25);
    }

    /** 剑气碰撞检测（宽矩形判定，覆盖剑气横扫范围） */
    private checkSlashHit(pos: Vec3, damage: number): boolean {
        const root = this.getSceneRoot();
        const enemies = this.findAllEnemies(root);

        for (const enemy of enemies) {
            if (!enemy.node || !enemy.node.activeInHierarchy) continue;

            const epos = enemy.node.worldPosition;
            const dx = Math.abs(pos.x - epos.x);
            const dy = Math.abs(pos.y - epos.y);

            // 剑气是横向宽矩形，X轴判定更宽
            if (dx < 90 && dy < 60 && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(damage);
                console.log(`⚔️ 剑气命中: ${enemy.node.name}`);
                return true;
            }
        }
        return false;
    }

    /** 剑气消散特效 */
    private destroySlashBeam(beam: Node): void {
        if (!beam || !beam.isValid) return;

        const pos = beam.worldPosition.clone();
        beam.destroy();

        // 白色十字光爆
        const hitFx = new Node('SlashImpact');
        const parent = this.getSceneRoot();
        parent.addChild(hitFx);
        hitFx.setWorldPosition(pos.x, pos.y, pos.z);
        hitFx.addComponent(UITransform).setContentSize(160, 100);
        const g = hitFx.addComponent(Graphics);

        // 横向闪光
        g.fillColor = new Color(220, 240, 255, 160);
        g.roundRect(-70, -12, 140, 24, 8); g.fill();
        // 纵向闪光
        g.fillColor = new Color(240, 248, 255, 200);
        g.roundRect(-4, -40, 8, 80, 3); g.fill();
        // 中心爆点
        g.fillColor = new Color(255, 255, 255, 255);
        g.circle(0, 0, 14); g.fill();
        g.fillColor = new Color(200, 230, 255, 180);
        g.circle(0, 0, 24); g.fill();

        // 粒子飞散
        for (let i = 0; i < 8; i++) {
            const p = new Node('Spark');
            parent.addChild(p);
            const angle = (Math.PI * 2 * i) / 8;
            const dist = 30 + Math.random() * 40;
            p.setWorldPosition(
                pos.x + Math.cos(angle) * dist,
                pos.y + Math.sin(angle) * dist,
                pos.z
            );
            p.addComponent(UITransform).setContentSize(12, 12);
            const pg = p.addComponent(Graphics);
            pg.fillColor = new Color(230, 245, 255, 200);
            pg.circle(0, 0, 4 + Math.random() * 3); pg.fill();

            this.scheduleOnce(() => {
                if (p && p.isValid) p.destroy();
            }, 0.25);
        }

        this.scheduleOnce(() => {
            if (hitFx && hitFx.isValid) hitFx.destroy();
        }, 0.3);
    }

    // ==================== 💚 自愈：治愈术 ====================

    private executeSelfHeal(config: SkillConfig): void {
        if (!this._playerStats) return;
        const healAmt = this.healAmount > 0 ? this.healAmount : (config.heal || 0);
        this._playerStats.heal(healAmt);
        console.log(`💚 治愈术：回复 ${healAmt} 点生命`);

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

    // ==================== 🌀 旋风斩（三阶段：蓄力 → 旋转爆发 → 收尾消散） ====================

    private executeWhirlwind(config: SkillConfig): void {
        if (this._whirlwindActive) return;
        this._whirlwindActive = true;
        this._whirlwindAngle = 0;
        this._whirlwindHitTimers.clear();

        const myPos = this.node.worldPosition.clone();
        const root = this.getSceneRoot();

        // 创建 VFX 根节点
        this._whirlwindVFX = new Node('WhirlwindVFX');
        root.addChild(this._whirlwindVFX);
        this._whirlwindVFX.setWorldPosition(myPos.x, myPos.y, myPos.z);

        // 开始蓄力阶段
        this.phaseWhirlwindCharge(config, root);
    }

    // ============ 第一阶段：蓄力（0.3s） ============

    private phaseWhirlwindCharge(_config: SkillConfig, root: Node): void {
        const vfxRoot = this._whirlwindVFX!;

        // ── 1. 地面青色圆形风纹法阵 ──
        const runeNode = new Node('GroundRune');
        vfxRoot.addChild(runeNode);
        runeNode.setPosition(0, -40);
        runeNode.addComponent(UITransform).setContentSize(300, 300);
        const runeG = runeNode.addComponent(Graphics);

        // 外圈
        runeG.strokeColor = new Color(60, 200, 220, 180);
        runeG.lineWidth = 3;
        runeG.circle(0, 0, 120); runeG.stroke();

        // 内圈
        runeG.strokeColor = new Color(100, 220, 240, 140);
        runeG.lineWidth = 2;
        runeG.circle(0, 0, 80); runeG.stroke();

        // 法阵符文线条（十字+斜线）
        runeG.strokeColor = new Color(80, 210, 230, 100);
        runeG.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8;
            runeG.moveTo(Math.cos(a) * 50, Math.sin(a) * 50);
            runeG.lineTo(Math.cos(a) * 100, Math.sin(a) * 100);
            runeG.stroke();
        }

        // 法阵中心菱形
        runeG.strokeColor = new Color(120, 230, 250, 160);
        runeG.lineWidth = 2;
        runeG.moveTo(0, 25); runeG.lineTo(25, 0);
        runeG.lineTo(0, -25); runeG.lineTo(-25, 0);
        runeG.close(); runeG.stroke();

        // ── 2. 气流粒子环绕 ──
        const particleContainer = new Node('ChargeParticles');
        vfxRoot.addChild(particleContainer);

        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const dist = 70 + Math.random() * 40;
            const p = new Node('Particle');
            particleContainer.addChild(p);
            p.setPosition(Math.cos(angle) * dist, Math.sin(angle) * dist);
            p.addComponent(UITransform).setContentSize(14, 14);
            const pg = p.addComponent(Graphics);
            const chargeAlpha = 160 + Math.random() * 90;
            pg.fillColor = new Color(150, 230, 255, chargeAlpha);
            pg.circle(0, 0, 2.5 + Math.random() * 3); pg.fill();
            // 亮芯
            if (Math.random() > 0.4) {
                pg.fillColor = new Color(220, 245, 255, 200);
                pg.circle(0, 0, 1 + Math.random() * 1.5); pg.fill();
            }
        }

        // 粒子环绕动画
        let chargeElapsed = 0;
        const chargeInterval = 0.016;

        const chargeTick = () => {
            if (!this._whirlwindActive || !vfxRoot || !vfxRoot.isValid) {
                this.unschedule(chargeTick);
                return;
            }
            chargeElapsed += chargeInterval;

            // 旋转法阵
            const t = chargeElapsed / 0.3;
            runeNode.setRotationFromEuler(0, 0, t * 60);

            // 粒子环绕旋转 + 逐渐加速
            const speed = 60 + t * 200;
            particleContainer.setRotationFromEuler(0, 0, chargeElapsed * speed);

            // 粒子逐渐向中心靠拢
            const scale = 1 - t * 0.3;
            particleContainer.setScale(scale, scale);

            // 画面轻微晃动（模拟空气扭曲）
            const shakeX = Math.sin(chargeElapsed * 50) * 1.5 * t;
            const shakeY = Math.cos(chargeElapsed * 47) * 1.5 * t;
            vfxRoot.setPosition(shakeX, shakeY);

            if (chargeElapsed >= 0.3) {
                this.unschedule(chargeTick);
                vfxRoot.setPosition(0, 0);
                // 销毁蓄力粒子
                particleContainer.destroy();
                // 进入旋转爆发阶段
                this.phaseWhirlwindSpin(_config, root);
            }
        };
        this.schedule(chargeTick, chargeInterval);

        console.log('🌀 [旋风斩] 蓄力阶段开始');
    }

    // ============ 第二阶段：旋转爆发（0.8s，2圈） ============

    private phaseWhirlwindSpin(config: SkillConfig, root: Node): void {
        const vfxRoot = this._whirlwindVFX!;
        const damage = this.whirlwindDamage > 0 ? this.whirlwindDamage : (config.damage || 4);
        const range = this.whirlwindRange > 0 ? this.whirlwindRange : (config.range || 300);
        const spinDuration = 0.8;
        const tickInterval = 0.2; // 每0.2s判定一次伤害
        const totalRotations = 2;
        const totalAngle = totalRotations * 360;

        let spinElapsed = 0;

        // ── 获取或创建法阵节点（蓄力阶段已创建） ──
        const runeNode = vfxRoot.getChildByName('GroundRune') || (() => {
            const n = new Node('GroundRune');
            vfxRoot.addChild(n);
            n.setPosition(0, -40);
            n.addComponent(UITransform).setContentSize(400, 400);
            return n;
        })();

        // ── 创建旋风龙卷节点 ──
        const tornadoNode = new Node('Tornado');
        vfxRoot.addChild(tornadoNode);
        tornadoNode.setPosition(0, 10);
        tornadoNode.addComponent(UITransform).setContentSize(500, 500);
        const tornadoG = tornadoNode.addComponent(Graphics);

        // ── 创建剑光节点 ──
        const swordArcNode = new Node('SwordArcs');
        vfxRoot.addChild(swordArcNode);
        swordArcNode.setPosition(0, 10);
        swordArcNode.addComponent(UITransform).setContentSize(300, 300);
        const swordG = swordArcNode.addComponent(Graphics);

        // ── 创建残影容器 ──
        const afterimageContainer = new Node('Afterimages');
        vfxRoot.addChild(afterimageContainer);

        let hitTickTimer = 0;
        let afterimageTimer = 0;

        const spinTick = () => {
            if (!this._whirlwindActive || !vfxRoot || !vfxRoot.isValid) {
                this.unschedule(spinTick);
                return;
            }
            spinElapsed += 0.016;

            // 非线性缓动：开始快，结束稍慢（模拟2圈旋转）
            const linearT = Math.min(spinElapsed / spinDuration, 1);
            // 使用 ease-out: 开始全速，收尾略缓
            const easedT = 1 - Math.pow(1 - linearT, 1.5);
            const angle = easedT * totalAngle;
            this._whirlwindAngle = angle;

            // ── 更新龙卷旋风 ──
            tornadoG.clear();
            this.drawTornado(tornadoG, linearT, range);

            // ── 更新剑光 ──
            swordG.clear();
            this.drawSwordArcs(swordG, angle, linearT);

            // ── 法阵放大 + 旋转 + 波纹 ──
            const runeScale = 1 + linearT * 0.8;
            runeNode.setScale(runeScale, runeScale);
            runeNode.setRotationFromEuler(0, 0, angle * 1.2);

            // 更新法阵Graphics（波纹）
            const runeG = runeNode.getComponent(Graphics);
            if (runeG) {
                runeG.clear();
                this.drawGroundRune(runeG, linearT, range);
            }

            // ── 残影 ──
            afterimageTimer += 0.016;
            if (afterimageTimer >= 0.05) {
                afterimageTimer = 0;
                this.spawnWhirlwindAfterimage(afterimageContainer);
            }

            // ── 碎风粒子（每帧3颗） ──
            this.spawnWhirlwindParticle(root, range);
            this.spawnWhirlwindParticle(root, range);
            this.spawnWhirlwindParticle(root, range);

            // ── VFX 跟随玩家 ──
            const pp = this.node.worldPosition.clone();
            vfxRoot.setWorldPosition(pp.x, pp.y, pp.z);

            // ── 伤害判定 ──
            hitTickTimer += 0.016;
            if (hitTickTimer >= tickInterval) {
                hitTickTimer -= tickInterval;
                this.checkWhirlwindHit(damage, range);
            }

            if (linearT >= 1) {
                this.unschedule(spinTick);
                // 进入收尾阶段
                this.phaseWhirlwindFade(config, root, tornadoNode, swordArcNode, runeNode, afterimageContainer);
            }
        };
        this.schedule(spinTick, 0.016);

        console.log('🌀 [旋风斩] 旋转爆发阶段开始');
    }

    /** 绘制龙卷旋风 */
    private drawTornado(g: Graphics, t: number, range: number): void {
        const maxR = range * (0.6 + t * 0.5);
        const layers = 6;

        for (let i = 0; i < layers; i++) {
            const lt = i / (layers - 1); // 0(内) → 1(外)
            const r = maxR * (0.15 + lt * 0.85);
            const alpha = Math.round(180 - lt * 150);

            // 颜色渐变：内层亮白 → 中层浅青 → 外层淡蓝
            const red = Math.round(180 + lt * 75);   // 180 → 255
            const green = Math.round(230 - lt * 30);  // 230 → 200
            const blue = Math.round(255 - lt * 20);   // 255 → 235

            g.strokeColor = new Color(red, green, blue, alpha);
            g.lineWidth = 3 + lt * 2;

            // 扭曲螺旋线（每个圆略带椭圆偏移模拟旋风）
            const cx = Math.sin(t * 5 + i) * 5;
            const cy = Math.cos(t * 5 + i) * 3;
            const rx = r;
            const ry = r * (0.7 + lt * 0.2);
            g.ellipse(cx, cy, rx, ry);
            g.stroke();

            // 内层多加一条亮线
            if (i < 2) {
                g.strokeColor = new Color(220, 245, 255, 200);
                g.lineWidth = 1.5;
                g.ellipse(cx, cy, rx * 0.85, ry * 0.85);
                g.stroke();
            }
        }

        // 中心亮核
        g.fillColor = new Color(230, 250, 255, 160);
        g.circle(0, 0, 18); g.fill();
        g.fillColor = new Color(255, 255, 255, 220);
        g.circle(0, 0, 8); g.fill();
    }

    /** 绘制旋转剑光 */
    private drawSwordArcs(g: Graphics, angle: number, _t: number): void {
        const arcCount = 4; // 4道剑光残影
        for (let i = 0; i < arcCount; i++) {
            const a = (angle - i * 65) * (Math.PI / 180);
            const alpha = Math.round(200 - i * 45);
            const dist = 85 + i * 8;

            // 宽厚弧形剑光
            g.fillColor = new Color(180, 240, 255, alpha);

            const cx = Math.cos(a) * dist;
            const cy = Math.sin(a) * dist;
            const arcLen = 60 + i * 5;
            const arcW = 14 - i * 2;

            // 用贝塞尔曲线绘制弧光
            const startA = a + Math.PI / 2 - 0.5;
            const endA = a + Math.PI / 2 + 0.5;
            const sx = cx + Math.cos(startA) * arcLen;
            const sy = cy + Math.sin(startA) * arcLen;
            const ex = cx + Math.cos(endA) * arcLen;
            const ey = cy + Math.sin(endA) * arcLen;

            g.moveTo(cx - Math.cos(a) * arcW * 0.3, cy - Math.sin(a) * arcW * 0.3);
            g.lineTo(sx, sy);
            g.lineTo(ex, ey);
            g.lineTo(cx + Math.cos(a) * arcW * 0.3, cy + Math.sin(a) * arcW * 0.3);
            g.close();
            g.fill();

            // 剑光外缘亮线
            g.strokeColor = new Color(220, 250, 255, 180);
            g.lineWidth = 1.5;
            g.moveTo(sx, sy);
            g.lineTo(ex, ey);
            g.stroke();
        }
    }

    /** 绘制地面法阵 */
    private drawGroundRune(g: Graphics, t: number, range: number): void {
        const r = range * (0.5 + t * 0.6);

        // 外圈波纹
        const wavePhase = t * 10;
        for (let w = 0; w < 3; w++) {
            const wr = r * (0.7 + w * 0.25) + Math.sin(wavePhase + w) * 10;
            const wAlpha = Math.round(140 - w * 40 - t * 40);
            g.strokeColor = new Color(80, 210, 230, Math.max(20, wAlpha));
            g.lineWidth = 2 + w;
            g.circle(0, 0, wr);
            g.stroke();
        }

        // 十字线
        g.strokeColor = new Color(100, 220, 240, 100);
        g.lineWidth = 1;
        g.moveTo(-r * 0.8, 0); g.lineTo(r * 0.8, 0); g.stroke();
        g.moveTo(0, -r * 0.8); g.lineTo(0, r * 0.8); g.stroke();

        // 中心辉光
        g.fillColor = new Color(150, 230, 255, 80);
        g.circle(0, 0, 30 + t * 15); g.fill();
    }

    /** 旋风粒子 */
    private spawnWhirlwindParticle(root: Node, range: number): void {
        const p = new Node('WindParticle');
        root.addChild(p);

        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * (range - 40);
        const pp = this.node.worldPosition.clone();
        p.setWorldPosition(
            pp.x + Math.cos(angle) * dist,
            pp.y + Math.sin(angle) * dist * 0.6,
            pp.z
        );

        const size = 2 + Math.random() * 6;
        p.addComponent(UITransform).setContentSize(size * 5, size * 5);
        const pg = p.addComponent(Graphics);
        const alpha = 140 + Math.random() * 110;
        pg.fillColor = new Color(
            170 + Math.random() * 85,
            210 + Math.random() * 45,
            255,
            alpha
        );
        pg.circle(0, 0, size); pg.fill();

        // 亮芯（大部分都有）
        if (Math.random() > 0.3) {
            pg.fillColor = new Color(235, 248, 255, 220);
            pg.circle(0, 0, size * 0.5); pg.fill();
        }

        // 偶尔多一个外层光晕
        if (Math.random() > 0.7) {
            pg.fillColor = new Color(150, 220, 255, 80);
            pg.circle(0, 0, size * 1.4); pg.fill();
        }

        this.scheduleOnce(() => {
            if (p && p.isValid) p.destroy();
        }, 0.5 + Math.random() * 0.4);
    }

    /** 旋风斩残影 */
    private spawnWhirlwindAfterimage(container: Node): void {
        const ai = new Node('AI');
        container.addChild(ai);
        ai.addComponent(UITransform).setContentSize(80, 140);

        const g = ai.addComponent(Graphics);
        const alpha = 60 + Math.random() * 60;

        // 3层残影
        for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 10;
            g.fillColor = new Color(140 + i * 30, 210 + i * 15, 240 + i * 10, alpha - i * 15);
            g.ellipse(offset, 0, 16 - i * 3, 50 - i * 8);
            g.fill();
        }

        this.scheduleOnce(() => {
            if (ai && ai.isValid) ai.destroy();
        }, 0.3);
    }

    /** 旋风斩伤害判定 */
    private checkWhirlwindHit(damage: number, range: number): void {
        const myPos = this.node.worldPosition;
        const enemies = this.findAllEnemies(this.getSceneRoot());

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

                // 怪物身上炸开青色打击光点（3-4颗）
                const ePos = enemy.node.worldPosition.clone();
                this.spawnWhirlwindHitSpark(ePos);
                this.spawnWhirlwindHitSpark(ePos);
                this.spawnWhirlwindHitSpark(ePos);
                if (Math.random() > 0.5) this.spawnWhirlwindHitSpark(ePos);
            }
        }

        if (hitCount > 0) {
            console.log(`🌀 旋风斩命中 ${hitCount} 个敌人`);
        }
    }

    /** 命中青色打击光点 */
    private spawnWhirlwindHitSpark(pos: Vec3): void {
        const root = this.getSceneRoot();
        const spark = new Node('HitSpark');
        root.addChild(spark);
        spark.setWorldPosition(
            pos.x + (Math.random() - 0.5) * 40,
            pos.y + (Math.random() - 0.5) * 30,
            pos.z
        );
        spark.addComponent(UITransform).setContentSize(36, 36);

        const g = spark.addComponent(Graphics);
        // 外层光晕
        g.fillColor = new Color(140, 220, 255, 100);
        g.circle(0, 0, 9); g.fill();
        // 核心
        g.fillColor = new Color(190, 240, 255, 220);
        g.circle(0, 0, 5); g.fill();
        // 十字星（更大）
        g.fillColor = new Color(220, 250, 255, 190);
        g.roundRect(-8, -2, 16, 4, 1.5); g.fill();
        g.roundRect(-2, -8, 4, 16, 1.5); g.fill();
        // 对角碎屑
        if (Math.random() > 0.5) {
            g.fillColor = new Color(200, 240, 255, 150);
            g.roundRect(-4, -4, 8, 8, 1); g.fill();
        }

        this.scheduleOnce(() => {
            if (spark && spark.isValid) spark.destroy();
        }, 0.3);
    }

    // ============ 第三阶段：收尾消散（0.4s） ============

    private phaseWhirlwindFade(
        _config: SkillConfig, root: Node,
        tornadoNode: Node, swordArcNode: Node,
        runeNode: Node, afterimageContainer: Node,
    ): void {
        const vfxRoot = this._whirlwindVFX!;
        const fadeDuration = 0.4;
        let fadeElapsed = 0;

        const fadeTick = () => {
            if (!vfxRoot || !vfxRoot.isValid) {
                this.unschedule(fadeTick);
                this.cleanupWhirlwind();
                return;
            }
            fadeElapsed += 0.016;
            const ft = Math.min(fadeElapsed / fadeDuration, 1);

            // 旋转逐步放缓
            const speed = 1 - ft;
            const angle = this._whirlwindAngle + speed * 120 * 0.016;
            this._whirlwindAngle = angle;
            swordArcNode.setRotationFromEuler(0, 0, angle);

            // 旋风缩小 + 淡出
            const scale = 1 - ft * 0.7;
            tornadoNode.setScale(scale, scale);

            // 法阵缩小淡出
            const runeScale = 1.8 - ft * 0.6;
            runeNode.setScale(runeScale, runeScale);

            // 残影容器缩小
            afterimageContainer.setScale(scale, scale);

            // VFX 跟随
            const pp = this.node.worldPosition.clone();
            vfxRoot.setWorldPosition(pp.x, pp.y, pp.z);

            if (ft >= 1) {
                this.unschedule(fadeTick);
                // 最后一缕气流炸开
                this.spawnFinalBurst(root);
                this.cleanupWhirlwind();
            }
        };
        this.schedule(fadeTick, 0.016);

        console.log('🌀 [旋风斩] 收尾消散阶段开始');
    }

    /** 收尾炸开的气流 */
    private spawnFinalBurst(root: Node): void {
        const pp = this.node.worldPosition.clone();
        const burst = new Node('FinalBurst');
        root.addChild(burst);
        burst.setWorldPosition(pp.x, pp.y, pp.z);
        burst.addComponent(UITransform).setContentSize(200, 200);

        const g = burst.addComponent(Graphics);
        // 爆散光圈
        g.strokeColor = new Color(150, 230, 255, 180);
        g.lineWidth = 3;
        g.circle(0, 0, 70); g.stroke();
        g.strokeColor = new Color(200, 245, 255, 120);
        g.lineWidth = 2;
        g.circle(0, 0, 90); g.stroke();

        // 飘散上升粒子
        for (let i = 0; i < 20; i++) {
            const p = new Node('FloatParticle');
            root.addChild(p);
            const angle = (Math.PI * 2 * i) / 20;
            const dist = 40 + Math.random() * 30;
            p.setWorldPosition(
                pp.x + Math.cos(angle) * dist,
                pp.y + Math.sin(angle) * dist,
                pp.z
            );
            p.addComponent(UITransform).setContentSize(12, 12);
            const pg = p.addComponent(Graphics);
            const burstAlpha = 160 + Math.random() * 90;
            pg.fillColor = new Color(170, 230, 255, burstAlpha);
            pg.circle(0, 0, 3 + Math.random() * 3); pg.fill();
            // 亮芯
            if (Math.random() > 0.3) {
                pg.fillColor = new Color(230, 248, 255, 200);
                pg.circle(0, 0, 1.5 + Math.random() * 2); pg.fill();
            }

            this.scheduleOnce(() => {
                if (p && p.isValid) p.destroy();
            }, 0.6 + Math.random() * 0.3);
        }

        this.scheduleOnce(() => {
            if (burst && burst.isValid) burst.destroy();
        }, 0.5);
    }

    /** 清理旋风斩状态 */
    private cleanupWhirlwind(): void {
        if (this._whirlwindVFX && this._whirlwindVFX.isValid) {
            this._whirlwindVFX.destroy();
        }
        this._whirlwindVFX = null;
        this._whirlwindActive = false;
        this._whirlwindAngle = 0;
        this._whirlwindHitTimers.clear();
        console.log('🌀 [旋风斩] 技能结束');
    }

    // ==================== 🌑 Dash：影刃瞬突 ====================

    private executeDash(config: SkillConfig): void {
        const dir = this.getFacingDir();
        const dashDist = this.shadowDashRange > 0 ? this.shadowDashRange : (config.range || 350);
        const dashSpeed = this.shadowDashSpeed > 0 ? this.shadowDashSpeed : (config.speed || 2400);
        const damage = this.shadowDashDamage > 0 ? this.shadowDashDamage : (config.damage || 5);
        const startPos = this.node.worldPosition.clone();
        const root = this.getSceneRoot();

        let traveled = 0;
        let finished = false;
        let hitEnemies: Set<any> = new Set(); // 防止重复命中
        let afterimageTimer = 0;
        let bladeMarkTimer = 0;

        // 冲刺前瞬间：角色轻微闪烁
        this.showDashFlash(startPos, dir);

        const stepCallback = () => {
            if (finished) return;

            const step = dashSpeed * 0.016;
            traveled += step;
            const cp = this.node.worldPosition.clone();
            const newX = cp.x + dir * step;
            this.node.setWorldPosition(newX, cp.y, cp.z);

            // 残影轨迹：每隔 0.04 秒生成一道残影
            afterimageTimer += 0.016;
            if (afterimageTimer >= 0.04) {
                afterimageTimer = 0;
                this.spawnAfterimage(this.node.worldPosition.clone(), dir);
            }

            // 地面暗影刃痕：每隔 0.08 秒生成一道刃痕
            bladeMarkTimer += 0.016;
            if (bladeMarkTimer >= 0.08) {
                bladeMarkTimer = 0;
                this.spawnBladeMark(this.node.worldPosition.clone(), dir, root);
            }

            // 碰撞检测
            this.checkDashHit(this.node.worldPosition, damage, hitEnemies);

            // 冲刺结束
            if (traveled >= dashDist) {
                finished = true;
                this.unschedule(stepCallback);
                this.playDashEndEffect(this.node.worldPosition.clone(), dir, root);
            }
        };

        this.schedule(stepCallback, 0.016);

        // 超时兜底
        this.scheduleOnce(() => {
            if (!finished) {
                finished = true;
                this.unschedule(stepCallback);
                this.playDashEndEffect(this.node.worldPosition.clone(), dir, root);
            }
        }, dashDist / dashSpeed + 0.3);

        console.log(`🌑 影刃瞬突：向${dir > 0 ? '右' : '左'}冲刺 ${dashDist} 距离`);
    }

    // ---- 冲刺前闪光 ----
    private showDashFlash(pos: Vec3, dir: number): void {
        const flash = new Node('DashFlash');
        const root = this.getSceneRoot();
        root.addChild(flash);
        flash.setWorldPosition(pos.x + dir * 20, pos.y, pos.z);
        flash.addComponent(UITransform).setContentSize(120, 160);
        const g = flash.addComponent(Graphics);

        // 暗紫色十字光芒（偏向冲刺方向）
        g.fillColor = new Color(140, 60, 200, 120);
        g.roundRect(-50, -8, 100, 16, 4); g.fill();
        g.fillColor = new Color(180, 80, 240, 180);
        g.roundRect(-6, -55, 12, 110, 3); g.fill();
        // 中心白点
        g.fillColor = new Color(220, 200, 255, 255);
        g.circle(0, 0, 8); g.fill();

        this.scheduleOnce(() => {
            if (flash && flash.isValid) flash.destroy();
        }, 0.25);
    }

    // ---- 残影（深紫 + 墨色层层叠叠） ----
    private spawnAfterimage(pos: Vec3, dir: number): void {
        const ai = new Node('Afterimage');
        const root = this.getSceneRoot();
        root.addChild(ai);
        ai.setWorldPosition(pos.x, pos.y, pos.z);

        const layers = 5; // 5层叠影
        for (let i = 0; i < layers; i++) {
            const layer = new Node('Layer');
            layer.parent = ai;
            // 每层略微偏移，形成叠影效果
            layer.setPosition((i - 2) * 8 * dir, (i - 2) * 3);
            layer.addComponent(UITransform).setContentSize(80, 140);
            const g = layer.addComponent(Graphics);

            // 墨色→深紫渐变：外层暗，内层偏紫
            const t = i / (layers - 1);
            const r = Math.round(25 + t * 55);   // 25 → 80
            const gVal = Math.round(5 + t * 15);   // 5 → 20
            const b = Math.round(30 + t * 80);    // 30 → 110
            const alpha = Math.round(40 + t * 100); // 40 → 140

            g.fillColor = new Color(r, gVal, b, alpha);
            // 人形轮廓简化：椭圆身体
            g.ellipse(0, 0, 18 - i * 2, 55 - i * 6);
            g.fill();

            // 边缘紫光描边（最外层）
            if (i === 0 || i === layers - 1) {
                g.strokeColor = new Color(160, 60, 220, 140);
                g.lineWidth = 1.5;
                g.ellipse(0, 0, 18 - i * 2, 55 - i * 6);
                g.stroke();
            }
        }

        // 自动销毁
        this.scheduleOnce(() => {
            if (ai && ai.isValid) ai.destroy();
        }, 0.4);
    }

    // ---- 暗影刃痕（半透明，停留在地面） ----
    private spawnBladeMark(pos: Vec3, dir: number, root: Node): void {
        const mark = new Node('BladeMark');
        root.addChild(mark);
        // 刃痕位置略微在角色身后偏下
        mark.setWorldPosition(pos.x - dir * 40, pos.y - 40, pos.z);
        mark.addComponent(UITransform).setContentSize(100, 40);
        const g = mark.addComponent(Graphics);

        // 主刃痕：深紫半透明
        g.fillColor = new Color(100, 40, 180, 100);
        // 细长剑痕形状
        g.moveTo(-45, 0);
        g.lineTo(40, -8);
        g.lineTo(45, 0);
        g.lineTo(40, 8);
        g.close();
        g.fill();

        // 内层亮紫细线
        g.strokeColor = new Color(180, 100, 240, 160);
        g.lineWidth = 2;
        g.moveTo(-40, 0);
        g.lineTo(35, 0);
        g.stroke();

        // 刃痕逐渐消散
        this.scheduleOnce(() => {
            if (mark && mark.isValid) mark.destroy();
        }, 1.2);
    }

    // ---- 冲刺路径碰撞检测 ----
    private checkDashHit(pos: Vec3, damage: number, hitEnemies: Set<any>): void {
        const root = this.getSceneRoot();
        const enemies = this.findAllEnemies(root);

        for (const enemy of enemies) {
            if (!enemy.node || !enemy.node.activeInHierarchy) continue;
            if (hitEnemies.has(enemy)) continue;

            const epos = enemy.node.worldPosition;
            const dx = Math.abs(pos.x - epos.x);
            const dy = Math.abs(pos.y - epos.y);

            // 冲刺判定范围：较宽的矩形
            if (dx < 70 && dy < 55 && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(damage);
                hitEnemies.add(enemy);
                console.log(`🌑 影刃瞬突命中: ${enemy.node.name}`);

                // 命中特效：暗紫色刀光碎屑
                this.playDashHitEffect(epos.clone());
            }
        }
    }

    // ---- 命中特效：暗紫色刀光碎屑 ----
    private playDashHitEffect(pos: Vec3): void {
        const root = this.getSceneRoot();
        const fx = new Node('DashHitFx');
        root.addChild(fx);
        fx.setWorldPosition(pos.x, pos.y, pos.z);
        fx.addComponent(UITransform).setContentSize(120, 100);
        const g = fx.addComponent(Graphics);

        // 中心爆点
        g.fillColor = new Color(160, 60, 220, 200);
        g.circle(0, 0, 16); g.fill();
        g.fillColor = new Color(200, 120, 255, 140);
        g.circle(0, 0, 28); g.fill();

        // 十字刀光
        g.fillColor = new Color(140, 50, 200, 160);
        g.roundRect(-45, -5, 90, 10, 3); g.fill();
        g.fillColor = new Color(180, 80, 240, 180);
        g.roundRect(-4, -35, 8, 70, 2); g.fill();

        // 碎屑粒子
        for (let i = 0; i < 10; i++) {
            const shard = new Node('Shard');
            root.addChild(shard);
            const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
            const dist = 25 + Math.random() * 50;
            shard.setWorldPosition(
                pos.x + Math.cos(angle) * dist,
                pos.y + Math.sin(angle) * dist,
                pos.z
            );
            shard.addComponent(UITransform).setContentSize(14, 14);
            const sg = shard.addComponent(Graphics);
            const shardAlpha = 160 + Math.random() * 90;
            sg.fillColor = new Color(
                130 + Math.random() * 70,
                40 + Math.random() * 40,
                200 + Math.random() * 55,
                shardAlpha
            );
            // 不规则菱形碎屑
            sg.moveTo(0, 5);
            sg.lineTo(4, 0);
            sg.lineTo(0, -4);
            sg.lineTo(-5, 0);
            sg.close();
            sg.fill();

            // 碎屑白色高亮边
            sg.strokeColor = new Color(220, 200, 255, 120);
            sg.lineWidth = 0.8;
            sg.moveTo(0, 5); sg.lineTo(4, 0); sg.stroke();

            this.scheduleOnce(() => {
                if (shard && shard.isValid) shard.destroy();
            }, 0.35);
        }

        // 命中闪光自动消除
        this.scheduleOnce(() => {
            if (fx && fx.isValid) fx.destroy();
        }, 0.3);
    }

    // ---- 冲刺结束收尾特效 ----
    private playDashEndEffect(pos: Vec3, dir: number, root: Node): void {
        const endFx = new Node('DashEndFx');
        root.addChild(endFx);
        // 略微偏向冲刺方向
        endFx.setWorldPosition(pos.x + dir * 15, pos.y, pos.z);
        endFx.addComponent(UITransform).setContentSize(160, 140);
        const g = endFx.addComponent(Graphics);

        // 暗紫色爆散光环
        g.fillColor = new Color(100, 30, 170, 80);
        g.circle(0, 0, 60); g.fill();
        g.strokeColor = new Color(160, 70, 220, 200);
        g.lineWidth = 3;
        g.circle(0, 0, 55); g.stroke();

        // 多道刃痕沿冲刺方向排列
        for (let i = -2; i <= 2; i++) {
            g.fillColor = new Color(140, 50, 200, 100);
            g.roundRect(-55, i * 15 - 2, 110, 4, 2); g.fill();
        }

        // 中心汇聚点
        g.fillColor = new Color(200, 150, 255, 200);
        g.circle(0, 0, 10); g.fill();

        this.scheduleOnce(() => {
            if (endFx && endFx.isValid) endFx.destroy();
        }, 0.5);
    }

    // ==================== 工具方法 ====================

    /** 获取玩家朝向：1=右，-1=左（从 move 组件读取） */
    private getFacingDir(): number {
        const moveComp = this.getComponent('move') as any;
        if (moveComp && moveComp.lastFaceRight !== undefined) {
            return moveComp.lastFaceRight ? 1 : -1;
        }
        // 兜底：检查 scale.x
        return this.node.scale.x >= 0 ? 1 : -1;
    }

    /** 获取场景根节点（Canvas）用于生成剑气 / 特效等 */
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
            for (const compName of ['Octopus', 'FinalBoss', 'Flagfish', 'HermitCrab', 'Bee', 'WolfBoss']) {
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

    /** 是否有Buff激活中（保留接口兼容性，当前版本无Buff技能） */
    public isShieldActive(): boolean {
        return false;
    }
}
