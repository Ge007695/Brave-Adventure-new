import { _decorator, Component, Node, Button, Label, Color, UITransform, Vec2, director, Graphics, Size } from 'cc';
const { ccclass } = _decorator;

/**
 * 闯关失败界面 - 精美的游戏结束 UI
 *
 * 使用独立的子节点容器承载所有 UI 元素，不操作宿主节点的 active，
 * 因此脚本可以安全地挂在 Canvas 或任意节点下。
 *
 * 包含：
 * - 全屏暗红色半透明遮罩
 * - 居中面板（深色背景 + 顶部暗红装饰条）
 * - 💀 骷髅图标 + "闯关失败" 大标题
 * - 死亡描述文字
 * - "重新开始" 和 "返回主菜单" 两个按钮
 *
 * 所有 UI 元素由代码自动创建，不依赖外部图片资源
 */
@ccclass('GameOverUI')
export class GameOverUI extends Component {

    /** 是否已初始化 */
    private initialized: boolean = false;

    /** 游戏结束 UI 的根容器（挂在 this.node 下） */
    private container: Node | null = null;

    /** 主摄像机引用 */
    private cameraNode: Node | null = null;

    start() {
        // 只查找摄像机，不操作 this.node.active
        this.findCamera();
    }

    /**
     * 每帧让容器跟随摄像机位置（项目没有独立 UI 相机，Canvas 由主相机渲染）
     */
    lateUpdate() {
        if (!this.container || !this.container.active || !this.cameraNode) return;
        const camPos = this.cameraNode.worldPosition.clone();
        this.container.setWorldPosition(camPos.x, camPos.y, camPos.z);
    }

    // ====================================================
    // 工具：查找节点
    // ====================================================

    private findCamera() {
        const scene = director.getScene();
        if (!scene) return;

        // 优先从 Canvas 下找
        const canvas = scene.getChildByName('Canvas');
        if (canvas) {
            this.cameraNode = canvas.getChildByName('Camera');
            if (this.cameraNode) return;
        }

        // 从场景根找
        this.cameraNode = scene.getChildByName('Camera');

        // 递归兜底
        if (!this.cameraNode) {
            this.cameraNode = this.findNodeRecursive(scene, (n) =>
                n.name === 'Camera' || !!n.getComponent('cc.Camera')
            );
        }
    }

    private findNodeRecursive(root: Node, predicate: (n: Node) => boolean): Node | null {
        if (predicate(root)) return root;
        for (const child of root.children) {
            const found = this.findNodeRecursive(child, predicate);
            if (found) return found;
        }
        return null;
    }

    // ====================================================
    // 工具：Graphics 绘制
    // ====================================================

    private fillRect(node: Node, w: number, h: number, color: Color) {
        const gfx = node.getComponent(Graphics) || node.addComponent(Graphics);
        gfx.fillColor = color;
        gfx.rect(-w / 2, -h / 2, w, h);
        gfx.fill();
    }

    private fillRoundRect(node: Node, w: number, h: number, r: number, color: Color) {
        const gfx = node.getComponent(Graphics) || node.addComponent(Graphics);
        gfx.fillColor = color;
        gfx.roundRect(-w / 2, -h / 2, w, h, r);
        gfx.fill();
    }

    // ====================================================
    // 工具：创建按钮
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

        this.fillRoundRect(btnNode, w, h, 8, bgColor);

        const button = btnNode.addComponent(Button);
        button.transition = Button.Transition.COLOR;
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
    // 构建完整 UI（只执行一次）
    // ====================================================

    private buildUI() {
        if (this.initialized) return;
        this.initialized = true;

        // ---- 创建独立容器，作为 this.node 的子节点 ----
        this.container = new Node('GameOverContainer');
        this.container.parent = this.node;
        this.container.setPosition(0, 0, 0);
        this.container.active = false; // 初始隐藏

        const containerTransform = this.container.addComponent(UITransform);
        containerTransform.setContentSize(new Size(1280, 720));

        // ====================================================
        // 1. 全屏暗红色遮罩
        // ====================================================
        const overlay = new Node('Overlay');
        overlay.parent = this.container;
        overlay.setPosition(0, 0, 0);

        const overlayTransform = overlay.addComponent(UITransform);
        overlayTransform.setContentSize(1280, 720);
        const overlayGfx = overlay.addComponent(Graphics);
        overlayGfx.fillColor = new Color(20, 0, 5, 200);
        overlayGfx.rect(-640, -360, 1280, 720);
        overlayGfx.fill();

        // ====================================================
        // 2. 面板
        // ====================================================
        const panel = new Node('GameOverPanel');
        panel.parent = this.container;
        panel.setPosition(0, 0, 0);

        const panelTransform = panel.addComponent(UITransform);
        panelTransform.setContentSize(560, 440);

        // 面板背景
        const panelBg = new Node('PanelBg');
        panelBg.parent = panel;
        panelBg.setPosition(0, 0);
        panelBg.addComponent(UITransform).setContentSize(560, 440);
        this.fillRoundRect(panelBg, 560, 440, 12, new Color(25, 22, 35, 250));

        // 外发光边框
        const borderGlow = new Node('BorderGlow');
        borderGlow.parent = panel;
        borderGlow.setPosition(0, 0);
        borderGlow.addComponent(UITransform).setContentSize(564, 444);
        const borderGfx = borderGlow.addComponent(Graphics);
        borderGfx.strokeColor = new Color(180, 40, 40, 80);
        borderGfx.lineWidth = 3;
        borderGfx.roundRect(-282, -222, 564, 444, 14);
        borderGfx.stroke();

        // ---- 顶部装饰条 ----
        const topBar = new Node('TopBar');
        topBar.parent = panel;
        topBar.setPosition(0, 170);
        topBar.addComponent(UITransform).setContentSize(560, 100);
        this.fillRect(topBar, 560, 100, new Color(60, 12, 12, 255));

        const midBar = new Node('MidBar');
        midBar.parent = topBar;
        midBar.setPosition(0, -10);
        midBar.addComponent(UITransform).setContentSize(560, 30);
        this.fillRect(midBar, 560, 30, new Color(120, 20, 20, 255));

        const goldLine = new Node('GoldLine');
        goldLine.parent = topBar;
        goldLine.setPosition(0, -45);
        goldLine.addComponent(UITransform).setContentSize(460, 2);
        this.fillRect(goldLine, 460, 2, new Color(200, 130, 40, 255));

        // ---- 💀 骷髅图标 ----
        const skullNode = new Node('SkullIcon');
        skullNode.parent = panel;
        skullNode.setPosition(0, 140);
        skullNode.addComponent(UITransform).setContentSize(80, 80);
        this.drawSkullIcon(skullNode);

        // ---- 主标题 ----
        const titleNode = new Node('TitleLabel');
        titleNode.parent = panel;
        titleNode.setPosition(0, 80);
        titleNode.addComponent(UITransform).setContentSize(400, 60);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = '闯 关 失 败';
        titleLabel.fontSize = 48;
        titleLabel.color = new Color(255, 200, 200, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        titleLabel.verticalAlign = Label.VerticalAlign.CENTER;
        titleLabel.lineHeight = 60;

        // ---- 分隔线 ----
        const divider = new Node('Divider');
        divider.parent = panel;
        divider.setPosition(0, 35);
        divider.addComponent(UITransform).setContentSize(360, 2);
        this.fillRect(divider, 360, 2, new Color(100, 80, 100, 200));

        // ---- 死亡描述 ----
        const descNode = new Node('DescLabel');
        descNode.parent = panel;
        descNode.setPosition(0, 0);
        descNode.addComponent(UITransform).setContentSize(400, 40);
        const descLabel = descNode.addComponent(Label);
        descLabel.string = '你被敌人击败了，勇士…';
        descLabel.fontSize = 22;
        descLabel.color = new Color(180, 170, 190, 255);
        descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // ---- 鼓励提示 ----
        const hintNode = new Node('HintLabel');
        hintNode.parent = panel;
        hintNode.setPosition(0, -32);
        hintNode.addComponent(UITransform).setContentSize(400, 30);
        const hintLabel = hintNode.addComponent(Label);
        hintLabel.string = '不要放弃，再来一次吧！';
        hintLabel.fontSize = 16;
        hintLabel.color = new Color(130, 120, 140, 255);
        hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        hintLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // ====================================================
        // 3. 按钮
        // ====================================================

        this.createButton(
            panel, 'RestartBtn',
            -110, -95, 190, 52,
            new Color(200, 140, 40, 255),
            '🔄 重新开始', 24, new Color(255, 255, 240, 255),
            () => this.onRestart(),
            new Color(160, 100, 20, 255),
            new Color(220, 160, 60, 255),
        );

        this.createButton(
            panel, 'BackBtn',
            110, -95, 190, 52,
            new Color(50, 50, 70, 255),
            '🏠 返回主菜单', 24, new Color(220, 220, 240, 255),
            () => this.onBackToLevelSelect(),
            new Color(35, 35, 50, 255),
            new Color(65, 65, 90, 255),
        );

        // ---- 底部装饰 ----
        const bottomLine = new Node('BottomLine');
        bottomLine.parent = panel;
        bottomLine.setPosition(0, -160);
        bottomLine.addComponent(UITransform).setContentSize(200, 1);
        this.fillRect(bottomLine, 200, 1, new Color(80, 70, 90, 150));

        const tipNode = new Node('TipLabel');
        tipNode.parent = panel;
        tipNode.setPosition(0, -185);
        tipNode.addComponent(UITransform).setContentSize(400, 30);
        const tipLabel = tipNode.addComponent(Label);
        tipLabel.string = '重新开始将回到当前关卡的存档点';
        tipLabel.fontSize = 14;
        tipLabel.color = new Color(100, 95, 115, 255);
        tipLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        tipLabel.verticalAlign = Label.VerticalAlign.CENTER;

        console.log('✅ GameOverUI 创建完成（容器模式）');
    }

    // ====================================================
    // 骷髅图标绘制
    // ====================================================

    private drawSkullIcon(node: Node) {
        const gfx = node.getComponent(Graphics) || node.addComponent(Graphics);

        // 头部轮廓
        gfx.fillColor = new Color(210, 200, 190, 255);
        gfx.roundRect(-22, -8, 44, 50, 18);
        gfx.fill();

        // 眼睛孔
        gfx.fillColor = new Color(25, 22, 35, 255);
        gfx.circle(-10, 8, 7);
        gfx.fill();
        gfx.circle(10, 8, 7);
        gfx.fill();

        // 鼻孔
        gfx.fillColor = new Color(25, 22, 35, 255);
        gfx.ellipse(-3, -8, 4, 5);
        gfx.fill();
        gfx.ellipse(3, -8, 4, 5);
        gfx.fill();

        // 牙齿
        gfx.fillColor = new Color(210, 200, 190, 255);
        gfx.rect(-12, -18, 7, 10);
        gfx.fill();
        gfx.rect(-2, -20, 6, 12);
        gfx.fill();
        gfx.rect(5, -18, 7, 10);
        gfx.fill();

        // 交叉骨
        gfx.strokeColor = new Color(200, 180, 170, 220);
        gfx.lineWidth = 3;
        gfx.moveTo(-24, -24); gfx.lineTo(-6, -8); gfx.stroke();
        gfx.moveTo(24, -24); gfx.lineTo(6, -8); gfx.stroke();
        gfx.moveTo(-18, -12); gfx.lineTo(-30, -30); gfx.stroke();
        gfx.moveTo(18, -12); gfx.lineTo(30, -30); gfx.stroke();
    }

    // ====================================================
    // 显示 / 隐藏
    // ====================================================

    /**
     * 显示游戏结束界面
     */
    show() {
        this.buildUI();

        // 确保摄像机引用
        if (!this.cameraNode) {
            this.findCamera();
        }

        // 激活容器
        if (this.container) {
            this.container.active = true;

            // 立即对齐摄像机位置（pause 后 lateUpdate 不跑，必须在暂停前设好）
            if (this.cameraNode) {
                const camPos = this.cameraNode.worldPosition.clone();
                this.container.setWorldPosition(camPos.x, camPos.y, camPos.z);
            }
        }

        // 暂停游戏
        if (!director.isPaused()) {
            director.pause();
        }

        console.log('💀 GameOverUI.show() — 闯关失败界面已显示');
    }

    /**
     * 隐藏游戏结束界面
     */
    hide() {
        if (this.container) {
            this.container.active = false;
        }

        if (director.isPaused()) {
            director.resume();
        }
    }

    // ====================================================
    // 按钮回调
    // ====================================================

    private onRestart() {
        console.log('🔄 重新开始按钮被点击');

        // 先恢复运行
        if (director.isPaused()) {
            director.resume();
        }

        // 重新加载当前场景（获取当前运行中的场景名）
        const currentScene = director.getScene()?.name || 'Level-one';
        console.log(`🔄 重新加载场景: ${currentScene}`);
        director.loadScene(currentScene);
    }

    private onBackToLevelSelect() {
        if (director.isPaused()) {
            director.resume();
        }
        director.loadScene('LevelSelect');
    }
}
