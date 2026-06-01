import { _decorator, Component, Node, Button, Label, Color, UITransform, Vec2, director, Graphics } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 游戏内设置面板管理器
 * - 屏幕底部左侧显示"设置"按钮
 * - 点击后弹出居中的精美设置面板
 * - 包含音效开关、音乐开关、操作说明、返回主菜单等功能
 *
 * 背景颜色通过 Graphics 组件绘制纯色矩形，不依赖任何外部图片资源
 *
 * 相机跟随适配：
 * - 摄像机移动时，通过 lateUpdate 手动设置 worldPosition，
 *   让所有 UI 元素始终固定在屏幕正确位置（相对于相机偏移）
 *
 * 暂停管理：
 * - 使用 isPanelOpen 防重复 pause/resume，确保 director 暂停计数不叠加
 * - start() 中强制清除前一个场景可能残留的暂停状态
 */
@ccclass('UIManager')
export class UIManager extends Component {
    private settingBtn: Node | null = null;
    private overlay: Node | null = null;       // 半透明遮罩
    private settingPanel: Node | null = null;  // 设置面板
    private cameraNode: Node | null = null;    // 主相机引用

    // 设置项状态
    private soundEnabled: boolean = true;
    private musicEnabled: boolean = true;

    // 面板是否正在显示（防止重复 pause）
    private isPanelOpen: boolean = false;

    start() {
        // 关键：强制清除前一个场景可能残留的暂停状态
        // 场景切换时，如果没有正确 resume，新场景会卡住
        if (director.isPaused()) {
            director.resume();
        }

        // 找到场景中的 Camera 节点
        const scene = director.getScene();
        if (scene) {
            // 尝试从场景根找 Camera
            this.cameraNode = scene.getChildByName('Camera');
            if (!this.cameraNode) {
                // 尝试从 Canvas 下找
                const canvas = scene.getChildByName('Canvas');
                if (canvas) {
                    this.cameraNode = canvas.getChildByName('Camera');
                }
            }
            // 还找不到就遍历
            if (!this.cameraNode) {
                this.cameraNode = this.findCameraRecursive(scene);
            }
        }

        this.createSettingButton();
        this.createOverlay();
        this.createSettingPanel();
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
        // 手动设置所有 UI 的世界坐标，使其始终相对于相机固定
        if (!this.cameraNode) return;
        const camPos = this.cameraNode.worldPosition.clone();
        // 保持 Z 与相机一致
        const z = camPos.z;

        // settingBtn：屏幕底部左侧，相对相机下移 320px、左移 170px
        if (this.settingBtn) {
            this.settingBtn.setWorldPosition(camPos.x - 170, camPos.y - 320, z);
        }
        // overlay：全屏遮罩，与相机位置对齐
        if (this.overlay) {
            this.overlay.setWorldPosition(camPos.x, camPos.y, z);
        }
        // settingPanel：居中面板，与相机位置对齐
        if (this.settingPanel) {
            this.settingPanel.setWorldPosition(camPos.x, camPos.y, z);
        }
    }

    // ====================================================
    // 工具：用 Graphics 绘制纯色矩形背景
    // ====================================================
    private fillRect(node: Node, w: number, h: number, color: Color) {
        const gfx = node.addComponent(Graphics);
        gfx.fillColor = color;
        gfx.rect(-w / 2, -h / 2, w, h);
        gfx.fill();
    }

    // ====================================================
    // 工具：创建可点击的按钮节点（带背景色 + 标签）
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

        // 背景色块
        this.fillRect(btnNode, w, h, bgColor);

        // Button 组件
        const button = btnNode.addComponent(Button);
        button.transition = 1; // COLOR
        button.normalColor = bgColor;
        if (pressedColor) button.pressedColor = pressedColor;
        if (hoverColor) button.hoverColor = hoverColor;
        button.node.on(Button.EventType.CLICK, onClick, this);

        // 文字标签
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
    // 1. 创建底部中央设置按钮
    // ====================================================
    createSettingButton() {
        const root = this.node;
        if (!root) return;

        this.settingBtn = this.createButton(
            root, 'SettingButton',
            0, 0,            // 本地坐标不重要，lateUpdate 会覆盖世界坐标
            280, 64,
            new Color(30, 30, 40, 220),
            '⚙ 设 置', 26, new Color(220, 220, 240),
            () => this.showSettingPanel(),
            new Color(60, 60, 80, 240),
            new Color(50, 50, 65, 235),
        );
    }

    // ====================================================
    // 2. 创建半透明遮罩层
    // ====================================================
    createOverlay() {
        const root = this.node;
        if (!root) return;

        this.overlay = new Node('Overlay');
        this.overlay.parent = root;
        this.overlay.active = false;

        const overlayTransform = this.overlay.addComponent(UITransform);
        overlayTransform.setContentSize(1280, 720);
        this.overlay.setPosition(0, 0);

        // 半透明黑色遮罩
        this.fillRect(this.overlay, 1280, 720, new Color(0, 0, 0, 160));

        // 点击遮罩关闭面板
        const overlayBtn = this.overlay.addComponent(Button);
        overlayBtn.transition = 0; // NONE
        overlayBtn.node.on(Button.EventType.CLICK, this.hideSettingPanel, this);
    }

    // ====================================================
    // 3. 创建设置面板（居中显示）
    // ====================================================
    createSettingPanel() {
        const root = this.node;
        if (!root) return;

        // ============ 面板容器 ============
        this.settingPanel = new Node('SettingPanel');
        this.settingPanel.parent = root;
        this.settingPanel.active = false;

        const panelTransform = this.settingPanel.addComponent(UITransform);
        panelTransform.setContentSize(520, 480);
        this.settingPanel.setPosition(0, 0);

        // 面板主体背景 - 深色
        const panelBgNode = new Node('PanelBg');
        panelBgNode.parent = this.settingPanel;
        panelBgNode.setPosition(0, 0);
        const panelBgTransform = panelBgNode.addComponent(UITransform);
        panelBgTransform.setContentSize(520, 480);
        this.fillRect(panelBgNode, 520, 480, new Color(35, 35, 50, 255));

        // 顶部装饰条 - 金色
        const topBarNode = new Node('TopBar');
        topBarNode.parent = this.settingPanel;
        topBarNode.setPosition(0, 190);
        const topBarTransform = topBarNode.addComponent(UITransform);
        topBarTransform.setContentSize(520, 100);
        this.fillRect(topBarNode, 520, 100, new Color(200, 160, 60, 255));

        // 面板标题文字
        const titleNode = new Node('Title');
        titleNode.parent = topBarNode;
        titleNode.setPosition(0, 25);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(400, 60);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '⚙ 游戏设置';
        titleLabel.fontSize = 36;
        titleLabel.color = new Color(30, 20, 10);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 副标题
        const subTitleNode = new Node('SubTitle');
        subTitleNode.parent = topBarNode;
        subTitleNode.setPosition(0, -8);
        const subTitleTransform = subTitleNode.addComponent(UITransform);
        subTitleTransform.setContentSize(300, 30);
        const subTitleLabel = subTitleNode.addComponent(Label);
        subTitleLabel.string = '调整你的游戏体验';
        subTitleLabel.fontSize = 16;
        subTitleLabel.color = new Color(80, 60, 30);
        subTitleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        subTitleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // ============ 关闭按钮（右上角）============
        this.createButton(
            this.settingPanel, 'CloseBtn',
            235, 220, 44, 44,
            new Color(200, 60, 60),
            '✕', 24, Color.WHITE,
            () => this.hideSettingPanel(),
            new Color(160, 30, 30),
            new Color(220, 80, 80),
        );

        // ============ 设置项分隔线 ============
        const dividerNode = new Node('Divider');
        dividerNode.parent = this.settingPanel;
        dividerNode.setPosition(0, 140);
        const dividerTransform = dividerNode.addComponent(UITransform);
        dividerTransform.setContentSize(440, 2);
        this.fillRect(dividerNode, 440, 2, new Color(80, 80, 100));

        // ============ 音效设置项 ============
        this.createSettingItem(100, '🔊 音效', '开启或关闭游戏音效', this.soundEnabled,
            (val) => { this.soundEnabled = val; }
        );

        // ============ 音乐设置项 ============
        this.createSettingItem(40, '🎵 背景音乐', '开启或关闭背景音乐', this.musicEnabled,
            (val) => { this.musicEnabled = val; }
        );

        // ============ 操作说明按钮 ============
        this.createActionButton(-20, '📖 操作说明', () => {
            // TODO
        });

        // ============ 返回主菜单按钮 ============
        this.createActionButton(-80, '🏠 返回主菜单', () => {
            // 先关闭面板 + 恢复运行，再切场景
            this.hideSettingPanel();
            // 兜底：确保没有任何残留暂停
            if (director.isPaused()) {
                director.resume();
            }
            director.loadScene('LevelSelect');
        });

        // ============ 底部版本信息 ============
        const versionNode = new Node('Version');
        versionNode.parent = this.settingPanel;
        versionNode.setPosition(0, -185);
        const versionTransform = versionNode.addComponent(UITransform);
        versionTransform.setContentSize(300, 30);
        const versionLabel = versionNode.addComponent(Label);
        versionLabel.string = '版本 1.0.0';
        versionLabel.fontSize = 14;
        versionLabel.color = new Color(120, 120, 140);
        versionLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        versionLabel.verticalAlign = Label.VerticalAlign.CENTER;
    }

    // ====================================================
    // 创建开关类型的设置项
    // ====================================================
    private createSettingItem(
        yPos: number,
        title: string,
        description: string,
        initialValue: boolean,
        onToggle: (value: boolean) => void
    ) {
        if (!this.settingPanel) return;

        const itemNode = new Node('SettingItem_' + title);
        itemNode.parent = this.settingPanel;
        itemNode.setPosition(0, yPos);
        const itemTransform = itemNode.addComponent(UITransform);
        itemTransform.setContentSize(480, 50);

        // 标题
        const titleNode = new Node('ItemTitle');
        titleNode.parent = itemNode;
        titleNode.setPosition(-180, 6);
        const titleTransform = titleNode.addComponent(UITransform);
        titleTransform.setContentSize(280, 30);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = title;
        titleLabel.fontSize = 22;
        titleLabel.color = new Color(230, 230, 245);
        titleLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 描述
        const descNode = new Node('ItemDesc');
        descNode.parent = itemNode;
        descNode.setPosition(-180, -14);
        const descTransform = descNode.addComponent(UITransform);
        descTransform.setContentSize(280, 20);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = description;
        descLabel.fontSize = 13;
        descLabel.color = new Color(140, 140, 160);
        descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        descLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 开关按钮
        let currentValue = initialValue;
        const toggleNode = new Node('ToggleBtn');
        toggleNode.parent = itemNode;
        toggleNode.setPosition(170, 0);
        const toggleTransform = toggleNode.addComponent(UITransform);
        toggleTransform.setContentSize(80, 36);

        const updateToggleColor = (val: boolean) => {
            const gfx = toggleNode.getComponent(Graphics);
            if (gfx) {
                gfx.clear();
                gfx.fillColor = val ? new Color(80, 180, 80) : new Color(100, 100, 100);
                gfx.roundRect(-40, -18, 80, 36, 6);
                gfx.fill();
            }
        };
        updateToggleColor(initialValue);

        const toggleBtn = toggleNode.addComponent(Button);
        toggleBtn.transition = 1;
        toggleBtn.normalColor = initialValue ? new Color(80, 180, 80) : new Color(100, 100, 100);
        toggleBtn.pressedColor = new Color(60, 140, 60);

        const toggleLabelNode = new Node('ToggleLabel');
        toggleLabelNode.parent = toggleNode;
        toggleLabelNode.setPosition(0, 0);
        const toggleLabelTransform = toggleLabelNode.addComponent(UITransform);
        toggleLabelTransform.setContentSize(80, 36);
        const toggleLabel = toggleLabelNode.addComponent(Label);
        toggleLabel.string = initialValue ? '开' : '关';
        toggleLabel.fontSize = 18;
        toggleLabel.color = Color.WHITE;
        toggleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        toggleLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // 点击切换
        toggleBtn.node.on(Button.EventType.CLICK, () => {
            currentValue = !currentValue;
            updateToggleColor(currentValue);
            toggleBtn.normalColor = currentValue ? new Color(80, 180, 80) : new Color(100, 100, 100);
            toggleLabel.string = currentValue ? '开' : '关';
            onToggle(currentValue);
        });
    }

    // ====================================================
    // 创建操作按钮类型的设置项
    // ====================================================
    private createActionButton(
        yPos: number,
        label: string,
        onClick: () => void
    ) {
        if (!this.settingPanel) return;

        this.createButton(
            this.settingPanel, 'ActionBtn_' + label,
            0, yPos, 440, 50,
            new Color(50, 50, 70),
            label, 22, new Color(220, 220, 240),
            onClick,
            new Color(30, 30, 50),
            new Color(65, 65, 90),
        );
    }

    // ====================================================
    // 显示/隐藏设置面板（带防重复 pause/resume 保护）
    // ====================================================
    showSettingPanel() {
        if (this.isPanelOpen) return; // 已打开，忽略
        if (this.overlay) this.overlay.active = true;
        if (this.settingPanel) this.settingPanel.active = true;
        this.isPanelOpen = true;

        // 只在游戏正常运行时暂停
        if (!director.isPaused()) {
            director.pause();
        }
    }

    hideSettingPanel() {
        if (!this.isPanelOpen) return; // 已关闭，忽略
        if (this.overlay) this.overlay.active = false;
        if (this.settingPanel) this.settingPanel.active = false;
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