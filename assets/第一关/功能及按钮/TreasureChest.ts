import { _decorator, Component, Node, Animation, Label, Color, UITransform, Graphics, tween, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 奖励条目
 */
interface RewardEntry {
    name: string;      // 物品名称
    icon: string;      // emoji 图标
    type: string;      // coin / health / mana
    value: number;     // 数量或数值
    weight: number;    // 权重，越大越容易抽中
}

/**
 * 宝箱交互脚本
 * - 玩家靠近时显示"按 E 打开"提示
 * - 按 E 键后播放打开动画
 * - 从奖池中随机抽取奖励并弹出提示
 * - 1 秒后宝箱消失
 */
@ccclass('TreasureChest')
export class TreasureChest extends Component {
    // ==================== 可配置属性 ====================

    @property({ tooltip: '触发交互的距离(像素)' })
    interactRange: number = 150;

    @property({ tooltip: '提示文字在宝箱上方的偏移（像素），负数则显示在下方' })
    promptOffsetY: number = -80;

    @property({ tooltip: '打开后延迟消失(秒)' })
    despawnDelay: number = 1.0;

    // ── 奖励1 ──
    @property({ tooltip: '奖励1-名称' }) r1Name: string = '金币';
    @property({ tooltip: '奖励1-图标' }) r1Icon: string = '🪙';
    @property({ tooltip: '奖励1-类型' }) r1Type: string = 'coin';
    @property({ tooltip: '奖励1-数量/数值' }) r1Value: number = 1;
    @property({ tooltip: '奖励1-权重(越高越容易中)' }) r1Weight: number = 5;

    // ── 奖励2 ──
    @property({ tooltip: '奖励2-名称' }) r2Name: string = '生命药水';
    @property({ tooltip: '奖励2-图标' }) r2Icon: string = '❤️';
    @property({ tooltip: '奖励2-类型' }) r2Type: string = 'health';
    @property({ tooltip: '奖励2-数量/数值' }) r2Value: number = 20;
    @property({ tooltip: '奖励2-权重(越高越容易中)' }) r2Weight: number = 3;

    // ── 奖励3 ──
    @property({ tooltip: '奖励3-名称' }) r3Name: string = '魔力药水';
    @property({ tooltip: '奖励3-图标' }) r3Icon: string = '💙';
    @property({ tooltip: '奖励3-类型' }) r3Type: string = 'mana';
    @property({ tooltip: '奖励3-数量/数值' }) r3Value: number = 20;
    @property({ tooltip: '奖励3-权重(越高越容易中)' }) r3Weight: number = 2;

    // ── 奖励4（可选）──
    @property({ tooltip: '奖励4-名称（留空则禁用）' }) r4Name: string = '';
    @property({ tooltip: '奖励4-图标' }) r4Icon: string = '';
    @property({ tooltip: '奖励4-类型' }) r4Type: string = 'coin';
    @property({ tooltip: '奖励4-数量/数值' }) r4Value: number = 0;
    @property({ tooltip: '奖励4-权重' }) r4Weight: number = 0;

    // ==================== 内部状态 ====================

    private animation: Animation | null = null;
    private playerNode: Node | null = null;
    private isOpened: boolean = false;
    private promptNode: Node | null = null;
    private promptLabel: Label | null = null;

    /** 本次抽中的奖励 */
    private pickedReward: RewardEntry | null = null;

    // ==================== 生命周期 ====================

    start() {
        this.animation = this.getComponent(Animation);
        if (!this.animation) {
            console.warn('⚠️ 宝箱缺少 Animation 组件，请挂载 宝箱打开.anim');
        }

        this.createPrompt();
    }

    update(_dt: number) {
        if (this.isOpened) return;

        const player = this.findPlayer();
        if (!player) return;

        const dist = this.getDist(player);
        const inRange = dist <= this.interactRange;

        if (this.promptNode) {
            this.promptNode.active = inRange;
        }

        if (inRange && this.promptNode) {
            this.promptNode.setWorldPosition(
                this.node.worldPosition.x,
                this.node.worldPosition.y + this.promptOffsetY,
                this.node.worldPosition.z
            );
        }
    }

    // ==================== 创建提示 ====================

    private createPrompt() {
        this.promptNode = new Node('InteractPrompt');
        this.node.parent?.addChild(this.promptNode);
        this.promptNode.active = false;

        const transform = this.promptNode.addComponent(UITransform);
        transform.setContentSize(180, 36);

        const bgNode = new Node('PromptBg');
        this.promptNode.addChild(bgNode);
        bgNode.setPosition(0, 0, 0);

        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(180, 36);

        const bg = bgNode.addComponent(Graphics);
        bg.fillColor = new Color(0, 0, 0, 160);
        bg.roundRect(-90, -18, 180, 36, 8);
        bg.fill();

        const labelNode = new Node('PromptLabel');
        this.promptNode.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(170, 30);

        this.promptLabel = labelNode.addComponent(Label);
        this.promptLabel.string = '按 E 打开宝箱';
        this.promptLabel.fontSize = 16;
        this.promptLabel.color = new Color(255, 220, 100, 255);
        this.promptLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.promptLabel.verticalAlign = Label.VerticalAlign.CENTER;
    }

    // ==================== 公开方法 ====================

    public tryOpen(): boolean {
        if (this.isOpened) return false;

        const player = this.findPlayer();
        if (!player) return false;

        const dist = this.getDist(player);
        if (dist > this.interactRange) return false;

        this.open();
        return true;
    }

    // ==================== 核心逻辑 ====================

    private open() {
        this.isOpened = true;

        if (this.promptNode) {
            this.promptNode.active = false;
        }

        // 播放打开动画
        if (this.animation) {
            this.animation.play('宝箱打开');
        }

        // 随机抽取奖励
        this.pickedReward = this.randomPick();

        // 发放奖励
        this.grantReward();

        // 弹出提示
        this.showRewardPopup();

        // 延迟消失
        this.scheduleOnce(() => {
            this.despawn();
        }, this.despawnDelay);
    }

    // ==================== 随机抽奖 ====================

    /** 根据权重从奖池中随机抽取 */
    private randomPick(): RewardEntry {
        const pool = this.buildPool();
        if (pool.length === 0) {
            return { name: '金币', icon: '🪙', type: 'coin', value: 1, weight: 1 };
        }

        const totalWeight = pool.reduce((sum, r) => sum + r.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const reward of pool) {
            rand -= reward.weight;
            if (rand <= 0) return reward;
        }
        return pool[pool.length - 1];
    }

    /** 收集所有有效奖励条目 */
    private buildPool(): RewardEntry[] {
        const pool: RewardEntry[] = [];
        const add = (name: string, icon: string, type: string, value: number, weight: number) => {
            if (name && weight > 0) {
                pool.push({ name, icon, type, value, weight });
            }
        };
        add(this.r1Name, this.r1Icon, this.r1Type, this.r1Value, this.r1Weight);
        add(this.r2Name, this.r2Icon, this.r2Type, this.r2Value, this.r2Weight);
        add(this.r3Name, this.r3Icon, this.r3Type, this.r3Value, this.r3Weight);
        add(this.r4Name, this.r4Icon, this.r4Type, this.r4Value, this.r4Weight);
        return pool;
    }

    // ==================== 奖励放入背包 ====================

    private grantReward() {
        if (!this.pickedReward) return;

        const bag = this.findBagManager();
        if (!bag) return;

        const r = this.pickedReward;

        // 金币类型：走 addGold 同步到 PlayerDataManager（跨场景累积）
        if (r.type === 'coin') {
            if (typeof (bag as any).addGold === 'function') {
                (bag as any).addGold(r.value);
                console.log(`🪙 宝箱奖励金币 +${r.value}（已同步到全局数据）`);
            }
            return;
        }

        // 其他物品：放入背包
        if (typeof (bag as any).addItem === 'function') {
            const added = (bag as any).addItem(r.name, r.icon, r.type, r.value, 1);
            if (added) {
                console.log(`🎒 宝箱奖励已放入背包：${r.icon} ${r.name} x1`);
            } else {
                console.warn('🎒 背包已满，无法放入宝箱奖励！');
            }
        }
    }

    /** 在 Canvas 上查找 BagManager 组件 */
    private findBagManager(): any {
        const canvas = this.node.parent;
        if (!canvas) return null;
        return canvas.getComponent('BagManager');
    }

    // ==================== 奖励弹窗 ====================

    private showRewardPopup() {
        if (!this.pickedReward) return;

        const canvas = this.node.parent;
        if (!canvas) return;

        const popup = new Node('RewardPopup');
        canvas.addChild(popup);

        const chestWorldPos = this.node.worldPosition;
        popup.setPosition(
            chestWorldPos.x - canvas.worldPosition.x,
            chestWorldPos.y - canvas.worldPosition.y + 120,
            0
        );

        const transform = popup.addComponent(UITransform);
        transform.setContentSize(260, 60);

        // 背景
        const bgNode = new Node('PopupBg');
        popup.addChild(bgNode);
        bgNode.setPosition(0, 0, 0);

        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(260, 60);

        const bg = bgNode.addComponent(Graphics);
        bg.fillColor = new Color(20, 20, 35, 245);
        bg.roundRect(-130, -30, 260, 60, 12);
        bg.fill();

        bg.strokeColor = new Color(220, 180, 60, 255);
        bg.lineWidth = 2.5;
        bg.roundRect(-130, -30, 260, 60, 12);
        bg.stroke();

        // 文字
        const labelNode = new Node('PopupLabel');
        popup.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);

        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(240, 40);

        const label = labelNode.addComponent(Label);
        label.string = `${this.pickedReward.icon} 获得了 ${this.pickedReward.name} x${this.pickedReward.value}！`;
        label.fontSize = 22;
        label.color = new Color(255, 240, 180, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // 动画
        popup.setScale(0.3, 0.3, 1);
        tween(popup)
            .to(0.25, { scale: new Vec3(1.05, 1.05, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .delay(1.5)
            .by(0.5, { position: new Vec3(0, 50, 0) })
            .call(() => {
                if (popup && popup.isValid) {
                    popup.destroy();
                }
            })
            .start();
    }

    // ==================== 宝箱消失 ====================

    private despawn() {
        if (this.promptNode && this.promptNode.isValid) {
            this.promptNode.destroy();
        }
        this.node.active = false;
    }

    // ==================== 玩家检测 ====================

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

    private getDist(target: Node): number {
        const a = this.node.worldPosition;
        const b = target.worldPosition;
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}
