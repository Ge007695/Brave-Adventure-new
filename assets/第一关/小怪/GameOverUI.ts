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
        this.node.setPosition(0, 0, 0);

        const bgSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        bgSprite.color = new Color(0, 0, 0, 200);
        bgSprite.sizeMode = 0;

        const panelNode = new Node('panel');
        this.node.addChild(panelNode);
        panelNode.setPosition(150, -400, 0);

        const panelTransform = panelNode.addComponent(UITransform);
        panelTransform.setContentSize(new Size(600, 400));

        const panelSprite = panelNode.addComponent(Sprite);
        panelSprite.color = new Color(50, 50, 50, 255);
        panelSprite.sizeMode = 0;

        const failLabelNode = new Node('failLabel');
        panelNode.addChild(failLabelNode);
        failLabelNode.setPosition(300, 280, 0);

        const labelTransform = failLabelNode.addComponent(UITransform);
        labelTransform.setContentSize(new Size(400, 80));

        const label = failLabelNode.addComponent(Label);
        label.string = '游戏结束';
        label.fontSize = 56;
        label.lineHeight = 80;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.color = new Color(255, 50, 50, 255);

        const descLabelNode = new Node('descLabel');
        panelNode.addChild(descLabelNode);
        descLabelNode.setPosition(300, 220, 0);

        const descTransform = descLabelNode.addComponent(UITransform);
        descTransform.setContentSize(new Size(400, 40));

        const descLabel = descLabelNode.addComponent(Label);
        descLabel.string = '你被敌人击败了';
        descLabel.fontSize = 24;
        descLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabel.color = new Color(200, 200, 200, 255);

        const btnNode = new Node('backButton');
        panelNode.addChild(btnNode);
        btnNode.setPosition(300, 100, 0);

        const btnTransform = btnNode.addComponent(UITransform);
        btnTransform.setContentSize(new Size(200, 60));

        const btnSprite = btnNode.addComponent(Sprite);
        btnSprite.color = new Color(100, 100, 100, 255);
        btnSprite.sizeMode = 0;

        const btn = btnNode.addComponent(Button);
        btn.transition = Button.Transition.COLOR;
        btn.normalColor = new Color(100, 100, 100, 255);
        btn.pressedColor = new Color(150, 50, 50, 255);
        btn.hoverColor = new Color(120, 120, 120, 255);
        btn.target = btnNode;

        const btnLabelNode = new Node('Label');
        btnNode.addChild(btnLabelNode);
        btnLabelNode.setPosition(0, 0, 0);

        const btnLabelTransform = btnLabelNode.addComponent(UITransform);
        btnLabelTransform.setContentSize(new Size(200, 60));

        const btnLabel = btnLabelNode.addComponent(Label);
        btnLabel.string = '返回主菜单';
        btnLabel.fontSize = 28;
        btnLabel.lineHeight = 35;
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