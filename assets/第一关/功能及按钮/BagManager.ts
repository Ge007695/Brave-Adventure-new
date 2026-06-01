import { _decorator, Component, Node, Button, Label, Color, UITransform, Vec2, director, Graphics } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';

const { ccclass, property } = _decorator;

/** 背包物品数据结构 */
interface BagItem {
    name: string;    // 物品名
    icon: string;    // emoji 图标
    type: string;    // 'health' | 'mana' | 'coin'
    value: number;   // 使用效果数值
    count: number;   // 数量
}

/**
 * 背包面板管理器
 * - 点击物品 → 弹出确认弹窗 → 使用物品（回血/回蓝等）
 * - 外部（宝箱等）可通过 addItem() 添加物品
 * - 物品使用/添加后数量实时更新
 */
@ccclass('BagManager')
export class BagManager extends Component {
    private bagBtn: Node | null = null;
    private overlay: Node | null = null;
    private bagPanel: Node | null = null;
    private cameraNode: Node | null = null;

    private bagSlots: BagItem[] = [];
    private slotNodes: Node[] = [];          // 格子节点引用
    private maxSlots: number = 20;
    private isPanelOpen: boolean = false;

    // 确认弹窗
    private confirmDialog: Node | null = null;
    private pendingUseIndex: number = -1;    // 待使用的格子索引
    private playerNode: Node | null = null;

    // ==================== 生命周期 ====================

    start() {
        if (director.isPaused()) {
            director.resume();
        }

        const scene = director.getScene();
        if (scene) {
            this.cameraNode = scene.getChildByName('Camera');
            if (!this.cameraNode) {
                const canvas = scene.getChildByName('Canvas');
                if (canvas) this.cameraNode = canvas.getChildByName('Camera');
            }
            if (!this.cameraNode) this.cameraNode = this.findCameraRecursive(scene);
        }

        // 初始化空背包
        for (let i = 0; i < this.maxSlots; i++) {
            this.bagSlots.push({ name: '', icon: '', type: '', value: 0, count: 0 });
        }

        this.createBagButton();
        this.createOverlay();
        this.createBagPanel();
        this.createConfirmDialog();
    }

    lateUpdate() {
        if (!this.cameraNode) return;
        const camPos = this.cameraNode.worldPosition.clone();
        const z = camPos.z;

        if (this.bagBtn) this.bagBtn.setWorldPosition(camPos.x + 170, camPos.y - 320, z);
        if (this.overlay) this.overlay.setWorldPosition(camPos.x, camPos.y, z);
        if (this.bagPanel) this.bagPanel.setWorldPosition(camPos.x, camPos.y, z);
        if (this.confirmDialog) this.confirmDialog.setWorldPosition(camPos.x, camPos.y, z);
    }

    // ==================== 公开 API：添加物品 ====================

    /**
     * 由宝箱等外部系统调用，向背包添加物品
     * @returns 是否成功添加（背包满时返回 false）
     */
    public addItem(name: string, icon: string, type: string, value: number, count: number = 1): boolean {
        // 先找同名同类型的格子叠放
        for (const slot of this.bagSlots) {
            if (slot.name === name && slot.type === type) {
                slot.count += count;
                this.refreshAllSlots();
                console.log(`🎒 背包：${name} +${count}（现有 ${slot.count} 个）`);
                return true;
            }
        }

        // 找空格子
        for (const slot of this.bagSlots) {
            if (slot.name === '') {
                slot.name = name;
                slot.icon = icon;
                slot.type = type;
                slot.value = value;
                slot.count = count;
                this.refreshAllSlots();
                console.log(`🎒 背包：获得 ${name} x${count}`);
                return true;
            }
        }

        console.warn('🎒 背包已满！');
        return false;
    }

    // ==================== 创建背包按钮 ====================

    private findCameraRecursive(node: Node): Node | null {
        if (node.name === 'Camera' || node.getComponent('cc.Camera')) return node;
        for (const child of node.children) {
            const found = this.findCameraRecursive(child);
            if (found) return found;
        }
        return null;
    }

    private fillRect(node: Node, w: number, h: number, color: Color) {
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = color;
        gfx.rect(-w / 2, -h / 2, w, h);
        gfx.fill();
    }

    private createButton(
        parent: Node, name: string,
        x: number, y: number, w: number, h: number,
        bgColor: Color, labelText: string, labelFontSize: number, labelColor: Color,
        onClick: () => void, pressedColor?: Color, hoverColor?: Color,
    ): Node {
        const btnNode = new Node(name);
        btnNode.parent = parent;

        const btnTransform = btnNode.addComponent(UITransform);
        btnTransform.setContentSize(w, h);
        btnTransform.setAnchorPoint(new Vec2(0.5, 0.5));
        btnNode.setPosition(x, y);

        this.fillRect(btnNode, w, h, bgColor);

        const button = btnNode.addComponent(Button);
        button.transition = 1;
        button.normalColor = bgColor;
        if (pressedColor) button.pressedColor = pressedColor;
        if (hoverColor) button.hoverColor = hoverColor;
        button.node.on(Button.EventType.CLICK, onClick, this);

        const labelNode = new Node('Label');
        labelNode.parent = btnNode;
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(w - 10, h - 4);
        labelNode.setPosition(0, 0);

        const label = labelNode.addComponent(Label);
        label.string = labelText;
        label.fontSize = labelFontSize;
        label.color = labelColor;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        return btnNode;
    }

    // ==================== 1. 背包按钮 ====================

    createBagButton() {
        const root = this.node;
        if (!root) return;

        this.bagBtn = this.createButton(root, 'BagButton', 0, 0, 280, 64,
            new Color(30, 40, 30, 220), '🎒 背 包', 26, new Color(220, 240, 220),
            () => this.showBagPanel(),
            new Color(60, 80, 60, 240), new Color(50, 65, 50, 235),
        );
    }

    // ==================== 2. 遮罩 ====================

    createOverlay() {
        const root = this.node;
        if (!root) return;

        this.overlay = new Node('BagOverlay');
        this.overlay.parent = root;
        this.overlay.active = false;

        const overlayTransform = this.overlay.addComponent(UITransform);
        overlayTransform.setContentSize(1280, 720);
        this.overlay.setPosition(0, 0);

        this.fillRect(this.overlay, 1280, 720, new Color(0, 0, 0, 160));

        const overlayBtn = this.overlay.addComponent(Button);
        overlayBtn.transition = 0;
        overlayBtn.node.on(Button.EventType.CLICK, this.hideBagPanel, this);
    }

    // ==================== 3. 背包面板 ====================

    createBagPanel() {
        const root = this.node;
        if (!root) return;

        const panelW = 640;
        const panelH = 520;

        this.bagPanel = new Node('BagPanel');
        this.bagPanel.parent = root;
        this.bagPanel.active = false;

        const panelTransform = this.bagPanel.addComponent(UITransform);
        panelTransform.setContentSize(panelW, panelH);
        this.bagPanel.setPosition(0, 0);

        // 背景
        const bgNode = new Node('PanelBg');
        bgNode.parent = this.bagPanel;
        bgNode.setPosition(0, 0);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(panelW, panelH);
        this.fillRect(bgNode, panelW, panelH, new Color(35, 40, 50, 255));

        // 标题栏
        const topBarNode = new Node('TopBar');
        topBarNode.parent = this.bagPanel;
        topBarNode.setPosition(0, panelH / 2 - 50);
        const topBarTransform = topBarNode.addComponent(UITransform);
        topBarTransform.setContentSize(panelW, 100);
        this.fillRect(topBarNode, panelW, 100, new Color(60, 100, 140, 255));

        // 标题
        const titleNode = new Node('Title');
        titleNode.parent = topBarNode;
        titleNode.setPosition(0, 22);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(400, 55);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '🎒 背 包';
        titleLabel.fontSize = 36;
        titleLabel.color = new Color(230, 240, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 副标题
        const subNode = new Node('SubTitle');
        subNode.parent = topBarNode;
        subNode.setPosition(0, -12);
        const subTransform = subNode.addComponent(UITransform);
        subTransform.setContentSize(300, 28);
        const subLabel = subNode.addComponent(Label);
        subLabel.string = `物品栏 0/${this.maxSlots}`;
        subLabel.fontSize = 16;
        subLabel.color = new Color(160, 190, 220);
        subLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        subLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (this.bagPanel as any)['_slotCountLabel'] = subLabel;

        // 关闭按钮
        this.createButton(this.bagPanel, 'CloseBtn',
            panelW / 2 - 30, panelH / 2 - 30, 40, 40,
            new Color(200, 60, 60), '✕', 22, Color.WHITE,
            () => this.hideBagPanel(),
            new Color(160, 30, 30), new Color(220, 80, 80),
        );

        // 道具格子
        const gridStartX = -270;
        const gridStartY = 145;
        const slotSize = 96;
        const gap = 10;
        const cols = 5;

        this.slotNodes = [];
        for (let i = 0; i < this.maxSlots; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const slotX = gridStartX + col * (slotSize + gap) + slotSize / 2;
            const slotY = gridStartY - row * (slotSize + gap) - slotSize / 2;

            const slotNode = this.createSlot(i, slotX, slotY, slotSize);
            this.slotNodes.push(slotNode);
        }
    }

    // ==================== 创建单个格子 ====================

    private createSlot(index: number, x: number, y: number, size: number): Node {
        if (!this.bagPanel) return new Node();

        const slotNode = new Node('Slot_' + index);
        slotNode.parent = this.bagPanel;
        slotNode.setPosition(x, y);
        const slotTransform = slotNode.addComponent(UITransform);
        slotTransform.setContentSize(size, size);

        // 在 slotNode 上存 index 以便点击时知道是哪个格子
        (slotNode as any)['_slotIndex'] = index;

        // 整个格子作为一个可点击按钮
        const bgNode = new Node('SlotBg');
        bgNode.parent = slotNode;
        bgNode.setPosition(0, 0);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(size, size);

        const data = this.bagSlots[index];
        const isOccupied = data && data.name !== '';

        this.fillRect(bgNode, size, size,
            isOccupied ? new Color(45, 50, 60, 255) : new Color(30, 33, 38, 255));

        // 边框
        const borderNode = new Node('Border');
        borderNode.parent = slotNode;
        borderNode.setPosition(0, 0);
        const borderTransform = borderNode.addComponent(UITransform);
        borderTransform.setContentSize(size, size);
        const borderGfx = borderNode.addComponent(Graphics);
        borderGfx.strokeColor = isOccupied ? new Color(100, 140, 180) : new Color(60, 65, 75);
        borderGfx.lineWidth = 2;
        borderGfx.rect(-size / 2, -size / 2, size, size);
        borderGfx.stroke();

        // 图标节点（占位，refreshSlot 时会更新内容）
        const iconNode = new Node('Icon');
        iconNode.parent = slotNode;
        iconNode.setPosition(0, 8);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(size - 10, 40);
        const iconLabel = iconNode.addComponent(Label);
        iconLabel.fontSize = 32;
        iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        iconLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (slotNode as any)['_iconLabel'] = iconLabel;

        // 名称节点
        const nameNode = new Node('Name');
        nameNode.parent = slotNode;
        nameNode.setPosition(0, -20);
        const nameTransform = nameNode.addComponent(UITransform);
        nameTransform.setContentSize(size - 4, 22);
        const nameLabel = nameNode.addComponent(Label);
        nameLabel.fontSize = 12;
        nameLabel.color = new Color(200, 210, 225);
        nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        nameLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (slotNode as any)['_nameLabel'] = nameLabel;

        // 数量角标
        const countNode = new Node('Count');
        countNode.parent = slotNode;
        countNode.setPosition(size / 2 - 16, -size / 2 + 12);
        const countTransform = countNode.addComponent(UITransform);
        countTransform.setContentSize(30, 20);
        const countLabel = countNode.addComponent(Label);
        countLabel.fontSize = 14;
        countLabel.color = new Color(255, 220, 100);
        countLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        countLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (slotNode as any)['_countLabel'] = countLabel;
        (slotNode as any)['_countNode'] = countNode;

        // 初始填充
        this.refreshSlotVisual(slotNode, index);

        return slotNode;
    }

    // ==================== 刷新单个格子显示 ====================

    private refreshSlotVisual(slotNode: Node, index: number) {
        const data = this.bagSlots[index];
        if (!data) return;

        const isOccupied = data.name !== '';

        // 更新背景色
        const bgNode = slotNode.getChildByName('SlotBg');
        if (bgNode) {
            const gfx = bgNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = isOccupied ? new Color(45, 50, 60, 255) : new Color(30, 33, 38, 255);
                gfx.rect(-48, -48, 96, 96);
                gfx.fill();
            }
        }

        // 更新边框色
        const borderNode = slotNode.getChildByName('Border');
        if (borderNode) {
            const borderGfx = borderNode.getComponent(Graphics);
            if (borderGfx) {
                borderGfx.clear();
                borderGfx.strokeColor = isOccupied ? new Color(100, 140, 180) : new Color(60, 65, 75);
                borderGfx.lineWidth = 2;
                borderGfx.rect(-48, -48, 96, 96);
                borderGfx.stroke();
            }
        }

        // 更新图标
        const iconLabel = (slotNode as any)['_iconLabel'] as Label;
        if (iconLabel) iconLabel.string = isOccupied ? data.icon : '';

        // 更新名称
        const nameLabel = (slotNode as any)['_nameLabel'] as Label;
        if (nameLabel) nameLabel.string = isOccupied ? data.name : '';

        // 更新数量
        const countLabel = (slotNode as any)['_countLabel'] as Label;
        const countNode = (slotNode as any)['_countNode'] as Node;
        if (countLabel) countLabel.string = isOccupied && data.count > 1 ? data.count.toString() : '';
        if (countNode) countNode.active = isOccupied && data.count > 1;

        // 更新点击按钮：有物品才能点击
        let btn = slotNode.getComponent(Button);
        if (isOccupied && !btn) {
            btn = slotNode.addComponent(Button);
            btn.transition = 0; // 无过渡，外观由 Graphics 控制
            btn.node.on(Button.EventType.CLICK, () => this.onSlotClick(index), this);
        } else if (!isOccupied && btn) {
            btn.node.off(Button.EventType.CLICK, () => this.onSlotClick(index), this);
            slotNode.removeComponent(btn);
        }
    }

    // ==================== 刷新所有格子 ====================

    private refreshAllSlots() {
        for (let i = 0; i < this.slotNodes.length; i++) {
            this.refreshSlotVisual(this.slotNodes[i], i);
        }
        this.updateSlotCount();
    }

    /** 更新副标题的物品栏计数 */
    private updateSlotCount() {
        if (!this.bagPanel) return;
        const used = this.bagSlots.filter(s => s.name !== '').length;
        const subLabel = (this.bagPanel as any)['_slotCountLabel'] as Label;
        if (subLabel) {
            subLabel.string = `物品栏 ${used}/${this.maxSlots}`;
        }
    }

    // ==================== 格子点击 ====================

    private onSlotClick(index: number) {
        const data = this.bagSlots[index];
        if (!data || data.name === '') return;

        // 显示确认弹窗
        this.showConfirmDialog(index, data);
    }

    // ==================== 确认弹窗 ====================

    private createConfirmDialog() {
        const root = this.node;
        if (!root) return;

        this.confirmDialog = new Node('ConfirmDialog');
        this.confirmDialog.parent = root;
        this.confirmDialog.active = false;

        const dialogTransform = this.confirmDialog.addComponent(UITransform);
        dialogTransform.setContentSize(360, 200);
        this.confirmDialog.setPosition(0, 0);

        // 半透明遮底
        const dimBg = new Node('DimBg');
        dimBg.parent = this.confirmDialog;
        dimBg.setPosition(0, 0);
        const dimTransform = dimBg.addComponent(UITransform);
        dimTransform.setContentSize(1280, 720);
        this.fillRect(dimBg, 1280, 720, new Color(0, 0, 0, 120));

        // 弹窗主体
        const bodyNode = new Node('DialogBody');
        bodyNode.parent = this.confirmDialog;
        bodyNode.setPosition(0, 0);
        const bodyTransform = bodyNode.addComponent(UITransform);
        bodyTransform.setContentSize(360, 200);

        // 背景
        this.fillRect(bodyNode, 360, 200, new Color(40, 45, 60, 255));

        // 边框
        const bodyGfx = bodyNode.getComponent(Graphics);
        if (bodyGfx) {
            bodyGfx.strokeColor = new Color(120, 150, 200, 255);
            bodyGfx.lineWidth = 3;
            bodyGfx.rect(-180, -100, 360, 200);
            bodyGfx.stroke();
        }

        // 标题
        const titleNode = new Node('DialogTitle');
        titleNode.parent = bodyNode;
        titleNode.setPosition(0, 55);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(300, 40);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '使用物品';
        titleLabel.fontSize = 26;
        titleLabel.color = new Color(255, 240, 200, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (this.confirmDialog as any)['_titleLabel'] = titleLabel;

        // 描述文字
        const descNode = new Node('DialogDesc');
        descNode.parent = bodyNode;
        descNode.setPosition(0, 10);
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(300, 30);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = '';
        descLabel.fontSize = 18;
        descLabel.color = new Color(200, 200, 220, 255);
        descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (this.confirmDialog as any)['_descLabel'] = descLabel;

        // 确认按钮
        this.createButton(bodyNode, 'ConfirmBtn',
            -80, -50, 130, 48,
            new Color(60, 140, 80), '✔ 确认', 20, Color.WHITE,
            () => this.onConfirmUse(),
            new Color(40, 100, 60), new Color(80, 160, 100),
        );

        // 取消按钮
        this.createButton(bodyNode, 'CancelBtn',
            80, -50, 130, 48,
            new Color(140, 60, 60), '✘ 取消', 20, Color.WHITE,
            () => this.hideConfirmDialog(),
            new Color(100, 40, 40), new Color(160, 80, 80),
        );
    }

    private showConfirmDialog(index: number, data: BagItem) {
        if (!this.confirmDialog) return;

        this.pendingUseIndex = index;
        this.confirmDialog.active = true;

        // 注意：不在这里调 director.pause()，因为背包面板打开时已经暂停了

        const titleLabel = (this.confirmDialog as any)['_titleLabel'] as Label;
        if (titleLabel) {
            titleLabel.string = `${data.icon} ${data.name}`;
        }

        const descLabel = (this.confirmDialog as any)['_descLabel'] as Label;
        if (descLabel) {
            const effectText = data.type === 'health' ? `回复 ${data.value} 点生命值`
                : data.type === 'mana' ? `回复 ${data.value} 点魔力值`
                : `获得 ${data.value} 个${data.name}`;
            descLabel.string = `确定要使用吗？(${effectText})`;
        }
    }

    private hideConfirmDialog() {
        if (this.confirmDialog) this.confirmDialog.active = false;
        this.pendingUseIndex = -1;

        // 注意：不在这里调 director.resume()，由 hideBagPanel 统一负责恢复
    }

    // ==================== 确认使用物品 ====================

    private onConfirmUse() {
        if (this.pendingUseIndex < 0) return;

        const data = this.bagSlots[this.pendingUseIndex];
        if (!data || data.name === '') return;

        // 找到玩家并应用效果
        const player = this.findPlayer();
        if (!player) return;

        const stats = player.getComponent(PlayerStats);
        if (!stats) return;

        let effectApplied = true;
        switch (data.type) {
            case 'health':
                stats.heal(data.value);
                console.log(`💚 使用 ${data.name}：回复 ${data.value} 点生命`);
                break;
            case 'mana':
                stats.restoreMana(data.value);
                console.log(`💙 使用 ${data.name}：回复 ${data.value} 点魔力`);
                break;
            default:
                console.log(`🪙 使用 ${data.name}`);
                break;
        }

        if (effectApplied) {
            data.count--;
            if (data.count <= 0) {
                // 清空格子
                data.name = '';
                data.icon = '';
                data.type = '';
                data.value = 0;
                data.count = 0;
            }
            this.refreshAllSlots();
        }

        this.hideConfirmDialog();
    }

    // ==================== 玩家检测 ====================

    private findPlayer(): Node | null {
        if (this.playerNode && this.playerNode.isValid) return this.playerNode;

        // 通过 move 组件查找玩家（不依赖节点名称）
        const scene = director.getScene();
        if (!scene) return null;
        this.playerNode = this.searchForPlayer(scene);
        return this.playerNode;
    }

    private searchForPlayer(node: Node): Node | null {
        if (node.getComponent('move')) return node;
        for (const child of node.children) {
            const found = this.searchForPlayer(child);
            if (found) return found;
        }
        return null;
    }

    // ==================== 显示/隐藏 ====================

    showBagPanel() {
        if (this.isPanelOpen) return;
        if (this.overlay) this.overlay.active = true;
        if (this.bagPanel) {
            this.bagPanel.active = true;
            this.refreshAllSlots(); // 打开时刷新
        }
        this.isPanelOpen = true;

        if (!director.isPaused()) {
            director.pause();
        }
    }

    hideBagPanel() {
        if (!this.isPanelOpen) return;

        // 如果确认弹窗开着，先关掉
        this.hideConfirmDialog();

        if (this.overlay) this.overlay.active = false;
        if (this.bagPanel) this.bagPanel.active = false;
        this.isPanelOpen = false;

        if (director.isPaused()) {
            director.resume();
        }

        this.resetPlayerInput();
    }

    private resetPlayerInput() {
        const scene = director.getScene();
        if (!scene) return;
        const canvas = scene.getChildByName('Canvas');
        if (!canvas) return;
        const player = canvas.getChildByName('Player');
        if (!player) return;
        const moveComp = player.getComponent('move') as any;
        if (moveComp && typeof moveComp.resetInputState === 'function') {
            moveComp.resetInputState();
        }
    }
}
