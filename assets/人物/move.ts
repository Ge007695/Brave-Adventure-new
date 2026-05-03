import { _decorator, Component, RigidBody2D, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('move')
export class move extends Component {
    @property moveSpeed: number = 300;
    @property jumpForce: number = 500;
    @property totalMapWidth: number = 5120;

    private rb!: RigidBody2D;
    private readonly maxJump = 2;
    private jumpCount = 0;

    // 按键状态
    private keyA = false;
    private keyD = false;
    private keyK = false;
    private lastKeyK = false;

    start() {
        this.rb = this.getComponent(RigidBody2D)!;
        this.rb.fixedRotation = true;
        
        // ✅ 修复：场景切换后强制唤醒刚体
        this.rb.wakeUp();
    }

    onLoad() {
        // ✅ 修复：全局监听，场景切换也稳定
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    // ✅ 修复：销毁脚本时移除监听（防止场景切换冲突）
    onDestroy() {
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
        document.removeEventListener('keyup', this.onKeyUp.bind(this));
    }

    private onKeyDown(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') this.keyA = true;
        if (k === 'd') this.keyD = true;
        if (k === 'k') this.keyK = true;
    }

    private onKeyUp(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') this.keyA = false;
        if (k === 'd') this.keyD = false;
        if (k === 'k') this.keyK = false;
    }

    update() {
        // 移动 + 边界
        const playerX = this.node.worldPosition.x;
        let dir = 0;
        if (this.keyA && playerX > 20) dir = -1;
        if (this.keyD && playerX < this.totalMapWidth - 20) dir = 1;

        const vel = this.rb.linearVelocity;
        this.rb.linearVelocity = new Vec2(dir * this.moveSpeed, vel.y);

        // 落地重置跳跃
        if (Math.abs(vel.y) < 1) {
            this.jumpCount = 0;
        }

        // 二段跳
        if (this.keyK && !this.lastKeyK) {
            if (this.jumpCount < this.maxJump) {
                this.rb.linearVelocity = new Vec2(vel.x, this.jumpForce);
                this.jumpCount++;
            }
        }

        this.lastKeyK = this.keyK;
    }
}