import { _decorator, Component, Node, Sprite, SpriteFrame, Collider2D, IPhysics2DContact, Vec3, tween, UITransform, BoxCollider2D, RigidBody2D, Vec2, PhysicsSystem2D, EPhysics2DDrawFlags } from 'cc';
import { GameOverUI } from './GameOverUI';
const { ccclass, property } = _decorator;

/**
 * 墨汁子弹脚本
 * 墨汁向前飞行，碰到人物触发游戏失败，碰到其他物体或飞行一段时间后消失
 */
@ccclass('InkBullet')
export class InkBullet extends Component {
    /** 飞行速度 */
    private speed: number = 400;
    /** 飞行方向（-1=向左，1=向右） */
    private direction: number = -1;
    /** 最大存活时间（秒） */
    private maxLifetime: number = 3;
    /** 已存活时间 */
    private lifetime: number = 0;
    /** 是否已经触发碰撞 */
    private isTriggered: boolean = false;
    /** 所属章鱼的 gameOverUI 引用 */
    private gameOverUI: GameOverUI | null = null;

    /**
     * 初始化墨汁子弹
     * @param dir 飞行方向 -1=向左，1=向右
     * @param speed 飞行速度
     * @param ui 闯关失败界面引用
     */
    init(dir: number, speed: number, ui: GameOverUI | null) {
        this.direction = dir;
        this.speed = speed;
        this.gameOverUI = ui;
    }

    start() {
        // 确保墨汁有碰撞组件
        let collider = this.getComponent(Collider2D);
        if (!collider) {
            // 如果没有碰撞组件，自动添加 BoxCollider2D
            const boxCollider = this.addComponent(BoxCollider2D);
            const transform = this.getComponent(UITransform);
            if (transform) {
                boxCollider.size = transform.contentSize;
            }
        }
    }

    update(deltaTime: number) {
        if (this.isTriggered) return;

        // 更新存活时间
        this.lifetime += deltaTime;
        if (this.lifetime >= this.maxLifetime) {
            this.destroyBullet();
            return;
        }

        // 向前飞行
        const pos = this.node.position;
        this.node.setPosition(pos.x + this.direction * this.speed * deltaTime, pos.y, pos.z);
    }

    /**
     * 碰撞回调 - 墨汁碰到人物触发失败，碰到其他物体消失
     */
    onCollisionEnter(otherCollider: Collider2D, selfCollider: Collider2D, contact: IPhysics2DContact) {
        if (this.isTriggered) return;
        this.isTriggered = true;

        // 禁用物理接触
        contact.disabled = true;

        // 判断碰撞对象是否是人物（通过节点名称或标签判断）
        const otherNode = otherCollider.node;
        // 人物节点通常有 move 脚本或 RigidBody2D 且不是静态的
        const isPlayer = otherNode.getComponent('move') !== null 
            || otherNode.name.includes('右移') 
            || otherNode.name.includes('人物');

        if (isPlayer) {
            console.log('💥 墨汁击中人物！');
            // 显示闯关失败界面
            if (this.gameOverUI) {
                this.gameOverUI.show();
            }
        }

        // 墨汁碰到任何物体都消失
        this.destroyBullet();
    }

    /**
     * 销毁墨汁子弹
     */
    private destroyBullet() {
        // 添加一个简单的消失动画效果
        tween(this.node)
            .to(0.1, { scale: new Vec3(0, 0, 0) })
            .call(() => {
                this.node.destroy();
            })
            .start();
    }
}


/**
 * 章鱼小怪脚本
 * 章鱼静止不动，面向左方
 * 当检测到人物靠近到一定距离时，向左边发射墨汁攻击
 * 人物碰到墨汁会触发游戏失败
 */
@ccclass('Octopus')
export class Octopus extends Component {
    // ==================== 可调节参数 ====================

    /** 章鱼的 SpriteFrame（拖入章鱼.png） */
    @property(SpriteFrame)
    octopusSprite: SpriteFrame | null = null;

    /** 墨汁的 SpriteFrame（拖入 ink.png） */
    @property(SpriteFrame)
    inkSprite: SpriteFrame | null = null;

    /** 检测人物的距离（像素），人物进入此范围章鱼会攻击 */
    @property
    detectDistance: number = 400;

    /** 攻击冷却时间（秒） */
    @property
    attackCooldown: number = 1;

    /** 墨汁飞行速度 */
    @property
    inkSpeed: number = 400;

    /** 闯关失败界面节点 */
    @property({ type: GameOverUI, tooltip: '拖入场景中的 GameOverUI 节点' })
    gameOverUI: GameOverUI | null = null;

    // ==================== 内部状态 ====================

    /** Sprite 组件引用 */
    private sprite: Sprite | null = null;

    /** 攻击计时器 */
    private attackTimer: number = 0;

    /** 人物节点引用（会在场景中查找） */
    private playerNode: Node | null = null;

    /** 墨汁预制体节点（用于复用） */
    private inkPrefab: Node | null = null;

    start() {
        // 获取 Sprite 组件
        this.sprite = this.getComponent(Sprite);
        if (!this.sprite) {
            console.error('❌ 章鱼找不到 Sprite 组件！请确保已添加 Sprite 组件');
            return;
        }

        // 设置章鱼图片
        if (this.octopusSprite) {
            this.sprite.spriteFrame = this.octopusSprite;
        } else {
            console.error('❌ 章鱼未设置 octopusSprite！请在属性面板中拖入章鱼.png 的 SpriteFrame');
        }

        // 查找人物节点（在 Canvas 下查找带有 move 脚本的节点）
        this.findPlayerNode();

        // 创建墨汁预制体模板
        this.createInkPrefab();
    }

    update(deltaTime: number) {
        // 更新攻击计时器
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }

        // 如果没有找到人物节点，继续查找
        if (!this.playerNode) {
            this.findPlayerNode();
            return;
        }

        // 检测人物距离
        const distance = this.getDistanceToPlayer();
        if (distance <= this.detectDistance && this.attackTimer <= 0) {
            this.fireInk();
            this.attackTimer = this.attackCooldown;
        }
    }

    /**
     * 查找场景中的人物节点
     */
    private findPlayerNode() {
        // 获取场景根节点
        const canvas = this.node.parent;
        if (!canvas) return;

        // 遍历 Canvas 的子节点，查找带有 move 脚本的节点
        for (const child of canvas.children) {
            if (child.getComponent('move')) {
                this.playerNode = child;
                console.log('🐙 章鱼找到人物节点:', child.name);
                break;
            }
        }

        // 如果没找到，尝试通过名称查找
        if (!this.playerNode) {
            // 查找名称包含"右移"或"人物"的节点
            for (const child of canvas.children) {
                if (child.name.includes('右移') || child.name.includes('人物')) {
                    this.playerNode = child;
                    console.log('🐙 章鱼通过名称找到人物节点:', child.name);
                    break;
                }
            }
        }
    }

    /**
     * 计算章鱼到人物的距离
     */
    private getDistanceToPlayer(): number {
        if (!this.playerNode) return Infinity;

        const myPos = this.node.worldPosition;
        const playerPos = this.playerNode.worldPosition;

        const dx = playerPos.x - myPos.x;
        const dy = playerPos.y - myPos.y;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 创建墨汁预制体模板
     */
    private createInkPrefab() {
        this.inkPrefab = new Node('InkBullet');
        
        // 添加 UITransform
        const transform = this.inkPrefab.addComponent(UITransform);
        transform.setContentSize(40, 40);

        // 添加 Sprite 组件
        const sprite = this.inkPrefab.addComponent(Sprite);
        if (this.inkSprite) {
            sprite.spriteFrame = this.inkSprite;
        }

        // 添加 BoxCollider2D 用于碰撞检测
        const collider = this.inkPrefab.addComponent(BoxCollider2D);
        collider.size = transform.contentSize;

        // 添加 InkBullet 脚本
        this.inkPrefab.addComponent(InkBullet);

        // 初始设置为非激活
        this.inkPrefab.active = false;
    }

    /**
     * 发射墨汁
     */
    private fireInk() {
        if (!this.inkPrefab || !this.inkSprite) return;

        console.log('🐙 章鱼发射墨汁！');

        // 克隆墨汁节点
        const inkNode = new Node('InkBullet');
        
        // 复制组件
        const transform = inkNode.addComponent(UITransform);
        transform.setContentSize(40, 40);

        const sprite = inkNode.addComponent(Sprite);
        sprite.spriteFrame = this.inkSprite;

        const collider = inkNode.addComponent(BoxCollider2D);
        collider.size = transform.contentSize;

        // 添加 InkBullet 脚本并初始化
        const inkScript = inkNode.addComponent(InkBullet);
        inkScript.init(-1, this.inkSpeed, this.gameOverUI); // 章鱼面向左，所以方向为 -1

        // 设置墨汁的初始位置（章鱼的位置，稍微偏左一点）
        const myPos = this.node.worldPosition;
        inkNode.setPosition(myPos.x - 50, myPos.y, myPos.z);

        // 将墨汁添加到 Canvas 下（与章鱼同级）
        const canvas = this.node.parent;
        if (canvas) {
            canvas.addChild(inkNode);
        } else {
            // 如果找不到 Canvas，就添加到场景根节点
            const scene = this.node.scene;
            if (scene) {
                scene.addChild(inkNode);
            }
        }
    }
}
