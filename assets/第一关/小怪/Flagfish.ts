import { _decorator, Component, Sprite, SpriteFrame, Collider2D, IPhysics2DContact, director } from 'cc';
import { GameOverUI } from './GameOverUI';
const { ccclass, property } = _decorator;

/**
 * 旗鱼小怪脚本
 * 在指定范围内自动左右移动，通过代码直接切换 SpriteFrame 实现左右方向图片切换
 * 与玩家碰撞时显示闯关失败界面
 */
@ccclass('Flagfish')
export class Flagfish extends Component {
    // ==================== 可调节参数 ====================

    /** 移动速度（像素/秒） */
    @property
    moveSpeed: number = 100;

    /** 移动范围左边界（世界坐标X） */
    @property
    leftBound: number = 0;

    /** 移动范围右边界（世界坐标X） */
    @property
    rightBound: number = 1280;

    /** 初始移动方向：true=向右，false=向左 */
    @property
    startMoveRight: boolean = true;

    /** 向右的 SpriteFrame（旗鱼-右.png） */
    @property(SpriteFrame)
    rightSprite: SpriteFrame | null = null;

    /** 向左的 SpriteFrame（旗鱼-左.png） */
    @property(SpriteFrame)
    leftSprite: SpriteFrame | null = null;

    /** 闯关失败界面节点（在场景中拖入） */
    @property({ type: GameOverUI, tooltip: '拖入场景中的 GameOverUI 节点' })
    gameOverUI: GameOverUI | null = null;

    // ==================== 内部状态 ====================

    /** 当前是否向右移动 */
    private movingRight: boolean = true;

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    /** 是否已经触发碰撞（防止重复触发） */
    private isTriggered: boolean = false;

    /** 是否已停止更新（碰撞后停止移动） */
    private isStopped: boolean = false;

    start() {
        // 获取 Sprite 组件
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('❌ 旗鱼找不到 Sprite 组件！请确保已添加 Sprite 组件');
            return;
        }

        if (!this.rightSprite || !this.leftSprite) {
            console.error('❌ 旗鱼未设置 rightSprite 或 leftSprite！请在属性面板中拖入对应的 SpriteFrame');
            return;
        }

        // 设置初始方向
        this.movingRight = this.startMoveRight;

        // 设置初始图片
        this.updateSpriteFrame();
    }

    update(deltaTime: number) {
        if (!this.sprite || this.isStopped) return;

        // 计算移动距离
        const direction = this.movingRight ? 1 : -1;
        const moveDistance = direction * this.moveSpeed * deltaTime;

        // 更新位置
        const pos = this.node.position;
        let newX = pos.x + moveDistance;

        // 检查是否到达边界，到达则掉头
        if (newX >= this.rightBound) {
            newX = this.rightBound;
            this.movingRight = false;
            this.updateSpriteFrame();
        } else if (newX <= this.leftBound) {
            newX = this.leftBound;
            this.movingRight = true;
            this.updateSpriteFrame();
        }

        // 应用新位置
        this.node.setPosition(newX, pos.y, pos.z);
    }

    /**
     * 碰撞回调 - 当旗鱼的 Collider 与其他 Collider 碰撞时自动调用
     * 人物与小怪有重合部分就弹出失败界面
     */
    onCollisionEnter(otherCollider: Collider2D, selfCollider: Collider2D, contact: IPhysics2DContact) {
        // 防止重复触发
        if (this.isTriggered) return;
        this.isTriggered = true;

        console.log('💥 旗鱼与玩家发生碰撞！');

        // 禁用物理接触，防止人物被推着走
        contact.disabled = true;

        // 停止小怪移动
        this.isStopped = true;

        // 显示闯关失败界面
        if (this.gameOverUI) {
            this.gameOverUI.show();
        } else {
            console.error('❌ 未设置 gameOverUI，请在 Flagfish 属性面板中拖入 GameOverUI 节点');
        }
    }

    /**
     * 根据当前方向切换 SpriteFrame
     */
    private updateSpriteFrame() {
        if (!this.sprite) return;

        if (this.movingRight && this.rightSprite) {
            this.sprite.spriteFrame = this.rightSprite;
        } else if (!this.movingRight && this.leftSprite) {
            this.sprite.spriteFrame = this.leftSprite;
        }
    }

    /**
     * 设置移动范围
     * @param left 左边界
     * @param right 右边界
     */
    setBounds(left: number, right: number) {
        this.leftBound = left;
        this.rightBound = right;
    }

    /**
     * 设置移动速度
     * @param speed 速度值
     */
    setSpeed(speed: number) {
        this.moveSpeed = speed;
    }
}
