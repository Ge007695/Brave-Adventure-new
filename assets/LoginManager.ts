// LoginManager.ts
import { _decorator, Component, Node, Button, Label, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoginManager')
export class LoginManager extends Component {

    @property(Node)
    btnStart: Node = null;

    @property(Node)
    btnLogin: Node = null;

    @property(Node)
    btnRegister: Node = null;

    @property(Node)
    btnCharacter: Node = null;

    @property(Node)
    btnSettings: Node = null;

    start() {
        // 绑定按钮点击事件
        this.btnStart.on(Button.EventType.CLICK, this.onStartGame, this);
        this.btnLogin.on(Button.EventType.CLICK, this.onLogin, this);
        this.btnRegister.on(Button.EventType.CLICK, this.onRegister, this);
        this.btnCharacter.on(Button.EventType.CLICK, this.onCharacter, this);
        this.btnSettings.on(Button.EventType.CLICK, this.onSettings, this);
    }

    onStartGame() {
        console.log("开始游戏");
        // 这里可以跳转到游戏主场景
        director.loadScene('GameScene'); // 假设你有 GameScene
    }

    onLogin() {
        console.log("登录账号");
        // 可弹出登录弹窗或跳转登录页
    }

    onRegister() {
        console.log("注册账号");
        // 可弹出注册弹窗
    }

    onCharacter() {
        console.log("角色");
        // 跳转到角色选择界面
    }

    onSettings() {
        console.log("设置");
        // 打开设置面板
    }
}