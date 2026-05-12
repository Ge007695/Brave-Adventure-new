import { _decorator, Component, Sprite, SpriteFrame, Collider2D, IPhysics2DContact } from 'cc';
import { GameOverUI } from './GameOverUI';
const { ccclass, property } = _decorator;

/**
 * 寄居蟹小怪脚本
 * 继承自旗鱼思路，但寄居蟹不会移动（静止不动），只有一张图片
 * 可以自由调整位置，支持放置多只
 * 与玩家碰撞时显示闯关失败界面
 */
@ccclass('HermitCrab')
export class HermitCrab extends Component {
    // ==================== 可调节参数 ====================

    /** 寄居蟹的 SpriteFrame（拖入寄居蟹.png） */
    @property(SpriteFrame)
    crabSprite: SpriteFrame | null = null;

    /** 闯关失败界面节点（在场景中拖入 GameOverUI 节点） */
    @property({ type: GameOverUI, tooltip: '拖入场景中的 GameOverUI 节点' })
    gameOverUI: GameOverUI | null = null;

    // ==================== 内部状态 ====================

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    /** 是否已经触发碰撞（防止重复触发） */
    private isTriggered: boolean = false;

    start() {
        // 获取 Sprite 组件
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('❌ 寄居蟹找不到 Sprite 组件！请确保已添加 Sprite 组件');
            return;
        }

        // 设置寄居蟹图片
        if (this.crabSprite) {
            this.sprite.spriteFrame = this.crabSprite;
        } else {
            console.error('❌ 寄居蟹未设置 crabSprite！请在属性面板中拖入寄居蟹.png 的 SpriteFrame');
        }
    }

    /**
     * 碰撞回调 - 当寄居蟹的 Collider 与其他 Collider 碰撞时自动调用
     * 人物碰到寄居蟹就弹出失败界面
     */
    onCollisionEnter(otherCollider: Collider2D, selfCollider: Collider2D, contact: IPhysics2DContact) {
        // 防止重复触发
        if (this.isTriggered) return;
        this.isTriggered = true;

        console.log('💥 寄居蟹与玩家发生碰撞！');

        // 禁用物理接触，防止人物被推着走
        contact.disabled = true;

        // 显示闯关失败界面
        if (this.gameOverUI) {
            this.gameOverUI.show();
        } else {
            console.error('❌ 未设置 gameOverUI，请在 HermitCrab 属性面板中拖入 GameOverUI 节点');
        }
    }
}
