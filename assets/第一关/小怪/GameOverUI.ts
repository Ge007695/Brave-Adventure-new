import { _decorator, Component, Node, Button, director, Label, Sprite, Color, UITransform, Size } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 闯关失败界面
 * 显示"闯关失败"文字和一个"返回关卡选择"按钮
 * 所有 UI 元素由代码自动创建，无需在编辑器中手动搭建
 */
@ccclass('GameOverUI')
export class GameOverUI extends Component {

    /** 是否已初始化 */
    private initialized: boolean = false;

    start() {
        this.buildUI();
        // 初始隐藏
        this.node.active = false;
    }

    /**
     * 代码创建 UI 元素
     */
    private buildUI() {
        if (this.initialized) return;
        this.initialized = true;

        // 获取或添加 UITransform 作为背景
        let bgTransform = this.node.getComponent(UITransform);
        if (!bgTransform) {
            bgTransform = this.node.addComponent(UITransform);
        }
        bgTransform.setContentSize(new Size(1280, 720));

        // 添加半透明黑色背景 Sprite
        let bgSprite = this.node.getComponent(Sprite);
        if (!bgSprite) {
            bgSprite = this.node.addComponent(Sprite);
        }
        bgSprite.color = new Color(0, 0, 0, 180);
        bgSprite.sizeMode = 0; // CUSTOM

        // ===== 创建"闯关失败"文字 =====
        const failLabelNode = new Node('failLabel');
        this.node.addChild(failLabelNode);
        failLabelNode.setPosition(0, 100, 0);

        const labelTransform = failLabelNode.addComponent(UITransform);
        labelTransform.setContentSize(new Size(600, 100));

        const label = failLabelNode.addComponent(Label);
        label.string = '闯关失败';
        label.fontSize = 72;
        label.lineHeight = 80;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.color = new Color(255, 0, 0, 255);

        // ===== 创建"返回关卡选择"按钮 =====
        const btnNode = new Node('backButton');
        this.node.addChild(btnNode);
        btnNode.setPosition(0, -50, 0);

        const btnTransform = btnNode.addComponent(UITransform);
        btnTransform.setContentSize(new Size(300, 80));

        const btn = btnNode.addComponent(Button);
        btn.transition = Button.Transition.COLOR;
        btn.normalColor = new Color(200, 200, 200, 255);
        btn.pressedColor = new Color(150, 150, 150, 255);
        btn.hoverColor = new Color(220, 220, 220, 255);
        btn.target = btnNode;

        // 按钮上的文字
        const btnLabelNode = new Node('Label');
        btnNode.addChild(btnLabelNode);
        btnLabelNode.setPosition(0, 0, 0);

        const btnLabelTransform = btnLabelNode.addComponent(UITransform);
        btnLabelTransform.setContentSize(new Size(300, 80));

        const btnLabel = btnLabelNode.addComponent(Label);
        btnLabel.string = '返回关卡选择';
        btnLabel.fontSize = 36;
        btnLabel.lineHeight = 45;
        btnLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        btnLabel.verticalAlign = Label.VerticalAlign.CENTER;
        btnLabel.color = new Color(255, 255, 255, 255);

        // 绑定按钮点击事件
        btn.node.on(Button.EventType.CLICK, this.onBackToLevelSelect, this);
    }

    /**
     * 显示失败界面
     */
    show() {
        this.buildUI();
        this.node.active = true;
    }

    /**
     * 点击返回按钮，跳转到关卡选择界面
     */
    private onBackToLevelSelect() {
        director.loadScene('LevelSelect');
    }
}
