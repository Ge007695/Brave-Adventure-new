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
        this.node.active = false;
    }

    /**
     * 代码创建 UI 元素
     */
    private buildUI() {
        if (this.initialized) return;
        this.initialized = true;

        const bgTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        bgTransform.setContentSize(new Size(1280, 720));
        bgTransform.setAnchorPoint(0, 0);
        this.node.setPosition(0, 0, 0);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(0, 0, 0, 180);
        bgSprite.sizeMode = 0;

        const failLabelNode = new Node('failLabel');
        this.node.addChild(failLabelNode);
        failLabelNode.setPosition(640, 460, 0);

        const labelTransform = failLabelNode.addComponent(UITransform);
        labelTransform.setContentSize(new Size(600, 100));

        const label = failLabelNode.addComponent(Label);
        label.string = '闯关失败';
        label.fontSize = 72;
        label.lineHeight = 80;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.color = new Color(255, 0, 0, 255);

        const btnNode = new Node('backButton');
        this.node.addChild(btnNode);
        btnNode.setPosition(640, 260, 0);

        const btnTransform = btnNode.addComponent(UITransform);
        btnTransform.setContentSize(new Size(300, 80));

        const btn = btnNode.addComponent(Button);
        btn.transition = Button.Transition.COLOR;
        btn.normalColor = new Color(200, 200, 200, 255);
        btn.pressedColor = new Color(150, 150, 150, 255);
        btn.hoverColor = new Color(220, 220, 220, 255);
        btn.target = btnNode;

        const btnLabelNode = new Node('Label');
        btnNode.addChild(btnLabelNode);

        const btnLabelTransform = btnLabelNode.addComponent(UITransform);
        btnLabelTransform.setContentSize(new Size(300, 80));

        const btnLabel = btnLabelNode.addComponent(Label);
        btnLabel.string = '返回关卡选择';
        btnLabel.fontSize = 36;
        btnLabel.lineHeight = 45;
        btnLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        btnLabel.verticalAlign = Label.VerticalAlign.CENTER;
        btnLabel.color = new Color(255, 255, 255, 255);

        btn.node.on(Button.EventType.CLICK, this.onBackToLevelSelect, this);
        console.log('✅ GameOverUI UI 创建完成');
    }

    /**
     * 显示失败界面
     */
    show() {
        this.buildUI();
        this.node.active = true;
        console.log('🎮 GameOverUI.show() 调用成功');
    }

    /**
     * 点击返回按钮，跳转到关卡选择界面
     */
    private onBackToLevelSelect() {
        director.loadScene('LevelSelect');
    }
}