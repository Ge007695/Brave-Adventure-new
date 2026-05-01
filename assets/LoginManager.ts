// LoginManager.ts
import { _decorator, Component, Node, Button, director,Vec3, UIOpacity } from 'cc';
import { tween } from 'cc';
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

    // 在 LoginManager.ts 中找到 onStartGame 方法，修改为：
onStartGame() {
    console.log("开始游戏 -> 进入关卡选择");
    
    // ❌ 错误：这样会影响 Canvas 节点的透明度
    // tween(this.node)  // this.node 是 Canvas
    
    // ✅ 正确：只对按钮或特定容器做动画
    tween(this.btnStart)
        .to(0.3, { scale: new Vec3(0.8, 0.8, 1) })
        .call(() => {
            director.loadScene('LevelSelect', (err) => {
                if (err) {
                    console.error('加载失败:', err);
                    alert('关卡选择场景加载失败');
                }
            });
        })
        .start();
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