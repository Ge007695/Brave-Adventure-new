import { _decorator, Component, Node, Button, Label, Color, UITransform, Graphics } from 'cc';
import { PlayerDataManager } from '../data/PlayerDataManager';
import { SKILLS, getAllSkillIds, SkillConfig, SKILL_SLOT_KEYS } from '../data/SkillConfig';

const { ccclass } = _decorator;

@ccclass('ShopPanel')
export class ShopPanel extends Component {
    private _pdm: PlayerDataManager;

    // UI 节点
    private shopBtn: Node | null = null;
    private overlay: Node | null = null;
    private panel: Node | null = null;
    private goldLabel: Label | null = null;
    private gridContainer: Node | null = null;
    private itemNodes: Node[] = [];
    private isPanelOpen: boolean = false;

    // ==================== 生命周期 ====================

    onLoad() {
        this._pdm = PlayerDataManager.getInstance();
    }

    start() {
        this.createShopButton();
        this.createOverlay();
        this.createPanel();
    }

    // ==================== 工具方法 ====================

    private fillRect(node: Node, w: number, h: number, color: Color): void {
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.rect(-w / 2, -h / 2, w, h);
        g.fill();
    }

    private roundRect(node: Node, w: number, h: number, r: number, color: Color): void {
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-w / 2, -h / 2, w, h, r);
        g.fill();
    }

    private createButton(parent: Node, name: string, x: number, y: number, w: number, h: number,
        bgColor: Color, text: string, fontSize: number, textColor: Color,
        onClick: () => void): Node {
        const btnNode = new Node(name);
        btnNode.parent = parent;
        btnNode.addComponent(UITransform).setContentSize(w, h);
        btnNode.setPosition(x, y);
        this.fillRect(btnNode, w, h, bgColor);

        const button = btnNode.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = bgColor;
        button.pressedColor = new Color(
            Math.max(0, bgColor.r - 30), Math.max(0, bgColor.g - 30), Math.max(0, bgColor.b - 30), bgColor.a);
        btnNode.on(Button.EventType.CLICK, onClick, this);

        const lbl = new Node('Label');
        lbl.parent = btnNode;
        lbl.addComponent(UITransform).setContentSize(w, h);
        const l = lbl.addComponent(Label);
        l.string = text; l.fontSize = fontSize; l.color = textColor;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        return btnNode;
    }

    private createLabel(parent: Node, text: string, fontSize: number, color: Color,
        x: number, y: number, w: number, h: number): Label {
        const n = new Node('Label');
        n.parent = parent;
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(w, h);
        const l = n.addComponent(Label);
        l.string = text; l.fontSize = fontSize; l.color = color;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        return l;
    }

    // ==================== 1. 商店按钮 ====================

    private createShopButton(): void {
        this.shopBtn = this.createButton(this.node, 'ShopButton',
            0, -280, 240, 60,
            new Color(200, 150, 40, 230), '🛒 技能商店', 24, new Color(255, 240, 200),
            () => this.showPanel());
    }

    // ==================== 2. 遮罩 ====================

    private createOverlay(): void {
        this.overlay = new Node('ShopOverlay');
        this.overlay.parent = this.node;
        this.overlay.active = false;
        this.overlay.addComponent(UITransform).setContentSize(1280, 720);
        this.fillRect(this.overlay, 1280, 720, new Color(0, 0, 0, 170));
        // 遮罩不再响应点击，只能通过 ✕ 按钮关闭面板
    }

    // ==================== 3. 面板 ====================

    private createPanel(): void {
        const pw = 700, ph = 560;

        this.panel = new Node('ShopPanel');
        this.panel.parent = this.node;
        this.panel.active = false;
        this.panel.addComponent(UITransform).setContentSize(pw, ph);

        // 背景
        const bg = new Node('Bg');
        bg.parent = this.panel;
        bg.addComponent(UITransform).setContentSize(pw, ph);
        this.roundRect(bg, pw, ph, 14, new Color(25, 28, 40, 250));

        // 顶部栏
        const topBar = new Node('TopBar');
        topBar.parent = this.panel;
        topBar.setPosition(0, ph / 2 - 55);
        topBar.addComponent(UITransform).setContentSize(pw, 110);
        this.fillRect(topBar, pw, 110, new Color(140, 80, 180, 255));

        this.createLabel(topBar, '✨ 技能商店', 38, new Color(255, 240, 220),
            0, 18, 300, 50);
        this.createLabel(topBar, '用金币解锁强力技能', 16, new Color(220, 190, 230),
            0, -18, 300, 24);

        // 金币
        const goldNode = new Node('GoldDisplay');
        goldNode.parent = topBar;
        goldNode.setPosition(pw / 2 - 120, 0);
        goldNode.addComponent(UITransform).setContentSize(160, 40);
        this.goldLabel = goldNode.addComponent(Label);
        this.goldLabel.string = `🪙 ${this._pdm.getGold()}`;
        this.goldLabel.fontSize = 26;
        this.goldLabel.color = new Color(255, 240, 100, 255);
        this.goldLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.goldLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 关闭按钮
        this.createButton(this.panel, 'CloseBtn',
            pw / 2 - 25, ph / 2 - 25, 40, 40,
            new Color(200, 60, 60, 255), '✕', 22, Color.WHITE,
            () => this.hidePanel());

        // 物品网格容器
        this.gridContainer = new Node('GridContainer');
        this.gridContainer.parent = this.panel;
        this.gridContainer.setPosition(0, -40);
        this.gridContainer.addComponent(UITransform).setContentSize(pw - 40, ph - 160);
    }

    // ==================== 4. 刷新技能列表 ====================

    private refreshGrid(): void {
        // 清除旧的
        for (const n of this.itemNodes) {
            if (n && n.isValid) n.destroy();
        }
        this.itemNodes = [];

        const ids = getAllSkillIds();
        if (!ids || ids.length === 0) return;

        const colCount = 2;
        const itemW = 310, itemH = 210;
        const gapX = 30, gapY = 24;

        ids.forEach((id, index) => {
            const col = index % colCount;
            const row = Math.floor(index / colCount);
            const startX = -(colCount - 1) * (itemW + gapX) / 2;
            const x = startX + col * (itemW + gapX);
            const y = 95 - row * (itemH + gapY);

            const item = this.createSkillCard(id, x, y, itemW, itemH);
            if (item) this.itemNodes.push(item);
        });
    }

    private createSkillCard(id: string, x: number, y: number, w: number, h: number): Node | null {
        const config = SKILLS[id];
        if (!config) return null;

        const card = new Node('Skill_' + id);
        card.parent = this.gridContainer;
        card.setPosition(x, y);
        card.addComponent(UITransform).setContentSize(w, h);

        // 背景
        this.roundRect(card, w, h, 10, new Color(38, 42, 55, 255));

        const isUnlocked = this._pdm.isSkillUnlocked(id);
        const equippedSkills = this._pdm.getEquippedSkills();
        const isEquipped = equippedSkills.indexOf(id) !== -1;

        // 图标（大）—— 左侧
        this.createLabel(card, config.icon, 46, Color.WHITE,
            -w / 2 + 50, h / 2 - 55, 80, 56);

        // 类型标签 —— 图标下方
        const typeLabel: Record<string, string> = {
            projectile: '⚔️ 剑气', selfHeal: '💚 治愈', aoe: '🌀 范围', buff: '🛡️ 增益', dash: '🌑 突刺',
        };
        this.createLabel(card, typeLabel[config.type] || config.type, 12, new Color(180, 190, 210),
            -w / 2 + 50, h / 2 - 92, 80, 18);

        // 名称 + 按键 —— 右侧上方
        const keyName = SKILL_SLOT_KEYS[config.slot] || '?';
        this.createLabel(card, `${config.name}  [${keyName}]`, 22, new Color(255, 240, 200),
            35, h / 2 - 48, w - 115, 26);

        // 蓝耗/冷却 —— 名称下方
        const desc = `蓝耗:${config.manaCost}  冷却:${config.cooldown}s`;
        this.createLabel(card, desc, 13, new Color(160, 170, 190),
            35, h / 2 - 72, w - 115, 18);

        // 技能描述 —— 右下方（避开左侧图标列和其他文字）
        if (config.description) {
            const d = this.createLabel(card, config.description, 12, new Color(140, 150, 170),
                25, -16, w - 95, 32);
            if (d) d.lineHeight = 16;
        }

        // 底部按钮
        const btnY = -h / 2 + 38;
        if (isEquipped) {
            this.createLabel(card, '✅ 已装备', 18, new Color(100, 220, 120),
                0, btnY, w - 20, 34);
        } else if (isUnlocked) {
            this.createButton(card, 'EquipBtn', 0, btnY, 110, 34,
                new Color(60, 140, 80, 255), '装 备', 17, Color.WHITE,
                () => {
                    this._pdm.equipSkill(config.slot, id);
                    this.refreshGrid();
                    this.updateGoldDisplay();
                });
        } else {
            const canAfford = this._pdm.getGold() >= config.price;
            this.createButton(card, 'BuyBtn', 0, btnY, 150, 34,
                canAfford ? new Color(200, 140, 30, 255) : new Color(70, 70, 70, 255),
                canAfford ? `🪙${config.price} 购买` : `🪙${config.price} (金币不足)`,
                15, canAfford ? Color.WHITE : new Color(140, 140, 140),
                () => {
                    if (this._pdm.spendGold(config.price)) {
                        this._pdm.unlockSkill(id);
                        this._pdm.equipSkill(config.slot, id);
                        this.refreshGrid();
                        this.updateGoldDisplay();
                    }
                });
        }

        return card;
    }

    private updateGoldDisplay(): void {
        if (this.goldLabel) {
            this.goldLabel.string = `🪙 ${this._pdm.getGold()}`;
        }
    }

    // ==================== 5. 显示/隐藏 ====================

    private showPanel(): void {
        if (this.isPanelOpen) return;
        this.isPanelOpen = true;
        this.updateGoldDisplay();
        this.refreshGrid();
        if (this.overlay) this.overlay.active = true;
        if (this.panel) this.panel.active = true;
    }

    private hidePanel(): void {
        if (!this.isPanelOpen) return;
        this.isPanelOpen = false;
        if (this.overlay) this.overlay.active = false;
        if (this.panel) this.panel.active = false;
    }
}
