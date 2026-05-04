import { _decorator, Component, Node, Button, director, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LevelSelectManager')
export class LevelSelectManager extends Component {
    @property(Node) backButton: Node = null;
    @property(Node) btnLevel1: Node = null;
    @property(Node) btnLevel2: Node = null;
    @property(Node) btnLevel3: Node = null;
    @property(Node) btnLevel4: Node = null;
    @property(Node) btnLevel5: Node = null;
    @property(Node) btnLevel6: Node = null;

    onLoad() {
        this.backButton?.on(Button.EventType.CLICK, this.onBackToLogin, this);
        this.bindAllLevels();
    }

    private bindAllLevels() {
        this.bindLevelButton(this.btnLevel1, 1);
        this.bindLevelButton(this.btnLevel2, 2);
        this.bindLevelButton(this.btnLevel3, 3);
        this.bindLevelButton(this.btnLevel4, 4);
        this.bindLevelButton(this.btnLevel5, 5);
        this.bindLevelButton(this.btnLevel6, 6);
    }

    private bindLevelButton(buttonNode: Node, levelId: number) {
        if (!buttonNode) return;
        const btn = buttonNode.getComponent(Button);
        if (!btn) return;

        btn.node.on(Button.EventType.CLICK, () => {
            this.loadLevel(levelId);
        });
    }

    private loadLevel(levelId: number) {
        tween(this.node)
            .to(0.2, { scale: Vec3.ONE.clone().multiplyScalar(0.95) })
            .to(0.2, { scale: Vec3.ONE })
            .call(() => {
                // 🔥 标准场景加载，无任何错误
                director.loadScene(levelId === 1 ? "Level-one" : `Level_${levelId}`);
            })
            .start();
    }

    private onBackToLogin() {
        director.loadScene("loginscene");
    }
}