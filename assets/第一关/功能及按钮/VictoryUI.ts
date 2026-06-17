import { _decorator, Button, Color, Component, director, Graphics, Label, Node, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('VictoryUI')
export class VictoryUI extends Component {

    @property({ tooltip: '第二关通关标题（游戏通关）' })
    gameCompleteTitle: string = '🎉 游戏通关！';

    @property({ tooltip: '第二关通关描述' })
    gameCompleteDesc: string = '你击败了巨狼，拯救了整片大陆！';

    @property({ tooltip: '是否为最终关卡（勾选后显示"游戏通关"，隐藏"下一关"按钮）' })
    isFinalLevel: boolean = false;

    private container: Node | null = null;
    private cameraNode: Node | null = null;
    private initialized: boolean = false;

    start() {
        this.findCamera();
        this.buildUI();
    }

    lateUpdate() {
        if (!this.container || !this.container.active || !this.cameraNode) return;
        const camPos = this.cameraNode.worldPosition.clone();
        this.container.setWorldPosition(camPos.x, camPos.y, camPos.z);
    }

    show() {
        this.buildUI();
        if (!this.cameraNode) this.findCamera();
        if (this.container) {
            if (this.cameraNode) {
                const camPos = this.cameraNode.worldPosition.clone();
                this.container.setWorldPosition(camPos.x, camPos.y, camPos.z);
            }
            this.container.active = true;
        }
    }

    private findCamera() {
        const scene = director.getScene();
        if (!scene) return;
        const canvas = scene.getChildByName('Canvas');
        if (canvas) {
            this.cameraNode = canvas.getChildByName('Camera');
        }
    }

    hide() {
        if (this.container) {
            this.container.active = false;
        }
    }

    private buildUI() {
        if (this.initialized) return;
        this.initialized = true;

        this.container = new Node('VictoryContainer');
        this.container.parent = this.node;
        this.container.setPosition(0, 0, 0);
        this.container.active = false;
        this.container.addComponent(UITransform).setContentSize(1280, 720);

        // ── 全屏暗色遮罩 ──
        const overlay = new Node('Overlay');
        overlay.parent = this.container;
        overlay.addComponent(UITransform).setContentSize(1280, 720);
        const g = overlay.addComponent(Graphics);
        g.fillColor = new Color(0, 5, 20, 200);
        g.rect(-640, -360, 1280, 720);
        g.fill();

        // ── 面板 ──
        const panel = new Node('Panel');
        panel.parent = this.container;
        panel.setPosition(0, 0, 0);
        panel.addComponent(UITransform).setContentSize(520, 400);

        // 面板背景
        const bg = new Node('Bg');
        bg.parent = panel;
        bg.addComponent(UITransform).setContentSize(520, 400);
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(15, 20, 40, 245);
        bgG.roundRect(-260, -200, 520, 400, 14);
        bgG.fill();
        bgG.strokeColor = new Color(60, 180, 220, 120);
        bgG.lineWidth = 3;
        bgG.roundRect(-260, -200, 520, 400, 14);
        bgG.stroke();

        // ── 顶部装饰条 ──
        const topBar = new Node('TopBar');
        topBar.parent = panel;
        topBar.setPosition(0, 148);
        topBar.addComponent(UITransform).setContentSize(520, 100);
        const tbG = topBar.addComponent(Graphics);
        tbG.fillColor = new Color(12, 60, 80, 255);
        tbG.rect(-260, -50, 520, 100);
        tbG.fill();

        const goldLine = new Node('GoldLine');
        goldLine.parent = topBar;
        goldLine.setPosition(0, -45);
        goldLine.addComponent(UITransform).setContentSize(420, 3);
        const glG = goldLine.addComponent(Graphics);
        glG.fillColor = new Color(255, 200, 60, 255);
        glG.rect(-210, -1, 420, 3);
        glG.fill();

        // ── ⭐ 胜利图标（简化：用五角星图案） ──
        const star = new Node('StarIcon');
        star.parent = panel;
        star.setPosition(0, 120);
        star.addComponent(UITransform).setContentSize(80, 80);
        const sG = star.addComponent(Graphics);
        sG.fillColor = new Color(255, 210, 50, 255);
        this.drawStar(sG, 0, 4, 28, 12);

        const titleText = this.isFinalLevel ? this.gameCompleteTitle : '🎉 恭喜通关！';
        const descText = this.isFinalLevel ? this.gameCompleteDesc : '你击败了深海巨章，拯救了这片海域！';

        // ── 标题 ──
        const titleNode = new Node('Title');
        titleNode.parent = panel;
        titleNode.setPosition(0, 65);
        titleNode.addComponent(UITransform).setContentSize(400, 56);
        const title = titleNode.addComponent(Label);
        title.string = titleText;
        title.fontSize = 44;
        title.color = new Color(255, 220, 100, 255);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;

        // ── 描述 ──
        const descNode = new Node('Desc');
        descNode.parent = panel;
        descNode.setPosition(0, 0);
        descNode.addComponent(UITransform).setContentSize(400, 40);
        const desc = descNode.addComponent(Label);
        desc.string = descText;
        desc.fontSize = 18;
        desc.color = new Color(180, 200, 220, 255);
        desc.horizontalAlign = Label.HorizontalAlign.CENTER;
        desc.verticalAlign = Label.VerticalAlign.CENTER;

        // ── 按钮：下一关（第二关不显示） ──
        if (!this.isFinalLevel) {
            this.createButton(panel, 'NextBtn', -120, -80, 190, 52,
                new Color(50, 150, 200, 255), '▶ 下一关', 24, new Color(255, 255, 255, 255),
                () => {
                    director.loadScene('Level-two');
                },
            );
        }

        // ── 按钮：返回主菜单（通关后居中显示） ──
        const homeBtnX = this.isFinalLevel ? 0 : 120;
        this.createButton(panel, 'HomeBtn', homeBtnX, -80, 190, 52,
            new Color(60, 60, 90, 255), '🏠 返回主菜单', 22, new Color(220, 220, 240, 255),
            () => {
                director.loadScene('LevelSelect');
            },
        );

        // ── 底部提示 ──
        const tipNode = new Node('Tip');
        tipNode.parent = panel;
        tipNode.setPosition(0, -140);
        tipNode.addComponent(UITransform).setContentSize(400, 30);
        const tip = tipNode.addComponent(Label);
        tip.string = this.isFinalLevel ? '感谢游玩 · 全部关卡已通关' : '感谢游玩 · 勇士的冒险仍在继续';
        tip.fontSize = 14;
        tip.color = new Color(120, 130, 160, 255);
        tip.horizontalAlign = Label.HorizontalAlign.CENTER;
        tip.verticalAlign = Label.VerticalAlign.CENTER;

        console.log('✅ VictoryUI 创建完成');
    }

    private createButton(
        parent: Node, name: string,
        x: number, y: number, w: number, h: number,
        bgColor: Color, text: string, fontSize: number, textColor: Color,
        onClick: () => void,
    ) {
        const btn = new Node(name);
        btn.parent = parent;
        btn.setPosition(x, y, 0);
        btn.addComponent(UITransform).setContentSize(w, h);

        const g = btn.addComponent(Graphics);
        g.fillColor = bgColor;
        g.roundRect(-w / 2, -h / 2, w, h, 8);
        g.fill();

        const button = btn.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = bgColor;
        button.hoverColor = new Color(
            Math.min(255, bgColor.r + 30), Math.min(255, bgColor.g + 30), Math.min(255, bgColor.b + 30), 255
        );
        btn.on(Button.EventType.CLICK, onClick, this);

        const lbl = new Node('Label');
        lbl.parent = btn;
        lbl.addComponent(UITransform).setContentSize(w, h);
        const l = lbl.addComponent(Label);
        l.string = text;
        l.fontSize = fontSize;
        l.color = textColor;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
    }

    private drawStar(g: Graphics, cx: number, cy: number, outerR: number, innerR: number) {
        const points: [number, number][] = [];
        const spikes = 5;
        const startAngle = -Math.PI / 2;
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = startAngle + (Math.PI / spikes) * i;
            points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
        }
        g.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            g.lineTo(points[i][0], points[i][1]);
        }
        g.close();
        g.fill();
    }
}
