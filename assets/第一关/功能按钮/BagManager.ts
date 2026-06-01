import { _decorator, Component, Node, Button, Label, Color, UITransform, Vec2, director, Graphics } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 背包面板管理器
 * - 屏幕底部右侧显示"背包"按钮（设置按钮在左侧，背包在右侧）
 * - 点击后弹出居中的背包界面，展示道具格子
 * - 背景颜色通过 Graphics 组件绘制，不依赖外部图片
 *
 * 相机跟随适配：通过 lateUpdate 手动设置 worldPosition
 *
 * 暂停管理：
 * - 使用 isPanelOpen 防重复 pause/resume
 * - start() 中强制清除残留暂停状态
 */
@ccclass('BagManager')
export class BagManager extends Component {
    private bagBtn: Node | null = null;
    private overlay: Node | null = null;
    private bagPanel: Node | null = null;
    private cameraNode: Node | null = null;

    // 背包数据：最多 20 格
    private bagSlots: { name: string; count: number; icon: string }[] = [];
    private maxSlots: number = 20;

    // 面板是否正在显示（防止重复 pause）
    private isPanelOpen: boolean = false;

    start() {
        // 强制清除前一个场景可能残留的暂停状态
        if (director.isPaused()) {
            director.resume();
        }

        // 找到场景中的 Camera 节点
        const scene = director.getScene();
        if (scene) {
            this.cameraNode = scene.getChildByName('Camera');
            if (!this.cameraNode) {
                const canvas = scene.getChildByName('Canvas');
                if (canvas) {
                    this.cameraNode = canvas.getChildByName('Camera');
                }
            }
            if (!this.cameraNode) {
                this.cameraNode = this.findCameraRecursive(scene);
            }
        }

        // 初始化背包数据（示例：前 5 格有物品）
        this.bagSlots = [
            { name: '生命药水', count: 3, icon: '❤️' },
            { name: '魔法药水', count: 2, icon: '💙' },
            { name: '铁剑', count: 1, icon: '⚔️' },
            { name: '盾牌', count: 1, icon: '🛡️' },
            { name: '金币', count: 999, icon: '🪙' },
        ];
        // 剩余空格填充 null
        while (this.bagSlots.length < this.maxSlots) {
            this.bagSlots.push({ name: '', count: 0, icon: '' });
        }

        this.createBagButton();
        this.createOverlay();
        this.createBagPanel();
    }

    private findCameraRecursive(node: Node): Node | null {
        if (node.name === 'Camera') return node;
        if (node.getComponent('cc.Camera')) return node;
        for (const child of node.children) {
            const found = this.findCameraRecursive(child);
            if (found) return found;
        }
        return null;
    }

    lateUpdate() {
        if (!this.cameraNode) return;
        const camPos = this.cameraNode.worldPosition.clone();
        const z = camPos.z;

        // bagBtn：屏幕底部右侧，与设置按钮同行
        if (this.bagBtn) {
            this.bagBtn.setWorldPosition(camPos.x + 170, camPos.y - 320, z);
        }
        // overlay & bagPanel：与相机位置对齐（居中）
        if (this.overlay) {
            this.overlay.setWorldPosition(camPos.x, camPos.y, z);
        }
        if (this.bagPanel) {
            this.bagPanel.setWorldPosition(camPos.x, camPos.y, z);
        }
    }

    // ====================================================
    // 工具：Graphics 绘制纯色矩形
    // ====================================================
    private fillRect(node: Node, w: number, h: number, color: Color) {
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = color;
        gfx.rect(-w / 2, -h / 2, w, h);
        gfx.fill();
    }

    // ====================================================
    // 工具：带文字标签的按钮
    // ====================================================
    private createButton(
        parent: Node,
        name: string,
        x: number, y: number,
        w: number, h: number,
        bgColor: Color,
        labelText: string,
        labelFontSize: number,
        labelColor: Color,
        onClick: () => void,
        pressedColor?: Color,
        hoverColor?: Color,
    ): Node {
        const btnNode = new Node(name);
        btnNode.parent = parent;

        const btnTransform = btnNode.addComponent(UITransform);
        btnTransform.setContentSize(w, h);
        btnTransform.anchorPoint = new Vec2(0.5, 0.5);
        btnNode.setPosition(x, y);

        this.fillRect(btnNode, w, h, bgColor);

        const button = btnNode.addComponent(Button);
        button.transition = 1; // COLOR
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

    // ====================================================
    // 1. 创建背包按钮（屏幕底部右侧）
    // ====================================================
    createBagButton() {
        const root = this.node;
        if (!root) return;

        this.bagBtn = this.createButton(
            root, 'BagButton',
            0, 0,
            280, 64,
            new Color(30, 40, 30, 220),
            '🎒 背 包', 26, new Color(220, 240, 220),
            () => this.showBagPanel(),
            new Color(60, 80, 60, 240),
            new Color(50, 65, 50, 235),
        );
    }

    // ====================================================
    // 2. 创建半透明遮罩
    // ====================================================
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

    // ====================================================
    // 3. 创建背包面板（居中，道具格子网格）
    // ====================================================
    createBagPanel() {
        const root = this.node;
        if (!root) return;

        const panelW = 640;
        const panelH = 520;

        // ============ 面板容器 ============
        this.bagPanel = new Node('BagPanel');
        this.bagPanel.parent = root;
        this.bagPanel.active = false;

        const panelTransform = this.bagPanel.addComponent(UITransform);
        panelTransform.setContentSize(panelW, panelH);
        this.bagPanel.setPosition(0, 0);

        // ============ 面板背景 ============
        const bgNode = new Node('PanelBg');
        bgNode.parent = this.bagPanel;
        bgNode.setPosition(0, 0);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(panelW, panelH);
        this.fillRect(bgNode, panelW, panelH, new Color(35, 40, 50, 255));

        // ============ 顶部标题栏 ============
        const topBarNode = new Node('TopBar');
        topBarNode.parent = this.bagPanel;
        topBarNode.setPosition(0, panelH / 2 - 50);
        const topBarTransform = topBarNode.addComponent(UITransform);
        topBarTransform.setContentSize(panelW, 100);
        this.fillRect(topBarNode, panelW, 100, new Color(60, 100, 140, 255));

        // 标题文字
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
        subLabel.string = `物品栏 ${this.getUsedSlots()}/${this.maxSlots}`;
        subLabel.fontSize = 16;
        subLabel.color = new Color(160, 190, 220);
        subLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        subLabel.verticalAlign = Label.VerticalAlign.CENTER;
        // 保存引用以便更新
        (this.bagPanel as any)['_slotCountLabel'] = subLabel;

        // ============ 关闭按钮 ============
        this.createButton(
            this.bagPanel, 'CloseBtn',
            panelW / 2 - 30, panelH / 2 - 30, 40, 40,
            new Color(200, 60, 60),
            '✕', 22, Color.WHITE,
            () => this.hideBagPanel(),
            new Color(160, 30, 30),
            new Color(220, 80, 80),
        );

        // ============ 道具格子区域 ============
        const gridStartX = -270;
        const gridStartY = 145;
        const slotSize = 96;
        const gap = 10;
        const cols = 5;
        const rows = 4;

        for (let i = 0; i < this.maxSlots; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const slotX = gridStartX + col * (slotSize + gap) + slotSize / 2;
            const slotY = gridStartY - row * (slotSize + gap) - slotSize / 2;

            this.createSlot(i, slotX, slotY, slotSize);
        }
    }

    // ====================================================
    // 创建单个道具格子
    // ====================================================
    private createSlot(index: number, x: number, y: number, size: number) {
        if (!this.bagPanel) return;

        const slotNode = new Node('Slot_' + index);
        slotNode.parent = this.bagPanel;
        slotNode.setPosition(x, y);
        const slotTransform = slotNode.addComponent(UITransform);
        slotTransform.setContentSize(size, size);

        // 格子背景
        const bgNode = new Node('SlotBg');
        bgNode.parent = slotNode;
        bgNode.setPosition(0, 0);
        const bgTransform = bgNode.addComponent(UITransform);
        bgTransform.setContentSize(size, size);

        const data = this.bagSlots[index];
        const isOccupied = data && data.name !== '';

        // 背景色：有物品 vs 空格
        this.fillRect(bgNode, size, size,
            isOccupied ? new Color(45, 50, 60, 255) : new Color(30, 33, 38, 255)
        );

        // 格子边框
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

        if (isOccupied) {
            // 图标
            const iconNode = new Node('Icon');
            iconNode.parent = slotNode;
            iconNode.setPosition(0, 8);
            const iconTransform = iconNode.addComponent(UITransform);
            iconTransform.setContentSize(size - 10, 40);
            const iconLabel = iconNode.addComponent(Label);
            iconLabel.string = data.icon;
            iconLabel.fontSize = 32;
            iconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            iconLabel.verticalAlign = Label.VerticalAlign.CENTER;

            // 物品名称
            const nameNode = new Node('Name');
            nameNode.parent = slotNode;
            nameNode.setPosition(0, -20);
            const nameTransform = nameNode.addComponent(UITransform);
            nameTransform.setContentSize(size - 4, 22);
            const nameLabel = nameNode.addComponent(Label);
            nameLabel.string = data.name;
            nameLabel.fontSize = 12;
            nameLabel.color = new Color(200, 210, 225);
            nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            nameLabel.verticalAlign = Label.VerticalAlign.CENTER;

            // 数量角标
            if (data.count > 1) {
                const countNode = new Node('Count');
                countNode.parent = slotNode;
                countNode.setPosition(size / 2 - 16, -size / 2 + 12);
                const countTransform = countNode.addComponent(UITransform);
                countTransform.setContentSize(30, 20);
                const countLabel = countNode.addComponent(Label);
                countLabel.string = data.count.toString();
                countLabel.fontSize = 14;
                countLabel.color = new Color(255, 220, 100);
                countLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
                countLabel.verticalAlign = Label.VerticalAlign.CENTER;
            }
        }
    }

    // ====================================================
    // 获取已使用的格子数
    // ====================================================
    private getUsedSlots(): number {
        return this.bagSlots.filter(s => s.name !== '').length;
    }

    // ====================================================
    // 显示/隐藏背包面板（带防重复 pause/resume 保护）
    // ====================================================
    showBagPanel() {
        if (this.isPanelOpen) return; // 已打开，忽略
        if (this.overlay) this.overlay.active = true;
        if (this.bagPanel) this.bagPanel.active = true;
        this.isPanelOpen = true;

        // 只在游戏正常运行时暂停
        if (!director.isPaused()) {
            director.pause();
        }
    }

    hideBagPanel() {
        if (!this.isPanelOpen) return; // 已关闭，忽略
        if (this.overlay) this.overlay.active = false;
        if (this.bagPanel) this.bagPanel.active = false;
        this.isPanelOpen = false;

        // 只在游戏暂停时恢复
        if (director.isPaused()) {
            director.resume();
        }

        // 重置玩家输入状态，防止面板打开期间按键状态卡住
        this.resetPlayerInput();
    }

    /** 重置场景中玩家角色的输入状态 */
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