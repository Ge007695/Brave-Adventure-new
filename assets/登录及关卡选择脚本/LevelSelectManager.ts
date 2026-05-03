// assets/scripts/LevelSelectManager.ts
import { _decorator, Component, Node, Button, director, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LevelSelectManager')
export class LevelSelectManager extends Component {

    @property(Node)
    backButton: Node = null;

    // 手动绑定6个按钮
    @property(Node)
    btnLevel1: Node = null;

    @property(Node)
    btnLevel2: Node = null;

    @property(Node)
    btnLevel3: Node = null;

    @property(Node)
    btnLevel4: Node = null;

    @property(Node)
    btnLevel5: Node = null;

    @property(Node)
    btnLevel6: Node = null;

    onLoad() {
        console.log("=== LevelSelect场景加载 ===");

        // 检查返回按钮绑定
        if (!this.backButton) {
            console.error("❌ 错误：backButton 未绑定！");
        } else {
            console.log("✅ backButton 已绑定:", this.backButton.name);

            // 检查Button组件
            const button = this.backButton.getComponent(Button);
            if (!button) {
                console.error("❌ 错误：backButton 没有Button组件");
            } else {
                console.log("✅ 找到Button组件，interactable:", button.interactable);
            }
        }

        // 绑定返回按钮
        if (this.backButton) {
            this.backButton.on(Button.EventType.CLICK, this.onBackToLogin, this);
            console.log("✅ 返回按钮事件已绑定");
        }

        // 绑定关卡按钮 - 全部解锁
        this.bindLevelButton(this.btnLevel1, 1);
        this.bindLevelButton(this.btnLevel2, 2);
        this.bindLevelButton(this.btnLevel3, 3);
        this.bindLevelButton(this.btnLevel4, 4);
        this.bindLevelButton(this.btnLevel5, 5);
        this.bindLevelButton(this.btnLevel6, 6);
    }

    // 绑定按钮事件 - 简化，所有都解锁
    bindLevelButton(buttonNode: Node, levelId: number) {
        if (!buttonNode) {
            console.error(`按钮 ${levelId} 未绑定！`);
            return;
        }

        const button = buttonNode.getComponent(Button);
        if (!button) {
            console.error(`按钮 ${levelId} 没有 Button 组件！`);
            return;
        }

        // 确保按钮可点击
        button.interactable = true;

        // 绑定点击事件
        button.node.on(Button.EventType.CLICK, () => {
            this.onLevelSelected(levelId);
        });
    }

    // 关卡被选择
    onLevelSelected(levelId: number) {
        console.log(`选择了关卡: ${levelId}`);

        // 缩放动画效果
        tween(this.node)
            .to(0.2, { scale: new Vec3(0.95, 0.95, 1) })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                // 加载对应关卡场景 - 重点修改：第一关指向Level-one
                let sceneName = '';
                if (levelId === 1) {
                    sceneName = 'Level-one'; // 第一关场景名改为Level-one
                } else {
                    sceneName = `assets/scenes/Level_${levelId}.scene`; // 其他关卡保持原有逻辑
                }

                director.loadScene(sceneName, (err) => {
                    if (err) {
                        console.error(`加载关卡 ${levelId} 失败:`, err);
                        alert(`关卡 ${levelId} 正在开发中！`);
                    }
                });
            })
            .start();
    }

    // 返回登录界面
    onBackToLogin() {
        // 使用你的实际文件名
        director.loadScene('loginscene');
    }
}