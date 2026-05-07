import { _decorator, Component, RigidBody2D, Vec2, PhysicsSystem2D, Animation } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('move')
export class move extends Component {
    @property moveSpeed: number = 300;
    @property jumpForce: number = 500;
    @property totalMapWidth: number = 5120;

    private rb!: RigidBody2D;
    private maxJump = 2;
    private jumpCount = 0;
    private canJump = true;
    private lastPosY: number = 0;
    private stableFrames = 0;
    
    private animation!: Animation;

    private keyA: boolean = false;
    private keyD: boolean = false;
    private keyK: boolean = false;
    private lastKeyK: boolean = false;

    // ✅ 【新增】记录最后朝向（静止时也能正确攻击）
    private lastFaceRight: boolean = true; 

    private isAttacking: boolean = false;
    private attackCD: number = 0.5;
    private attackTimer: number = 0;

    private onKeyDownHandler!: (e: KeyboardEvent) => void;
    private onKeyUpHandler!: (e: KeyboardEvent) => void;

    onLoad() {
        this.onKeyDownHandler = this.onKeyDown.bind(this);
        this.onKeyUpHandler = this.onKeyUp.bind(this);
        document.addEventListener('keydown', this.onKeyDownHandler);
        document.addEventListener('keyup', this.onKeyUpHandler);
    }

    start() {
        if (!PhysicsSystem2D.instance.enable) {
            PhysicsSystem2D.instance.enable = true;
        }
        
        this.scheduleOnce(() => {
            this.initRigidBody();
        }, 0.05);
    }
    
    private initRigidBody() {
        this.rb = this.getComponent(RigidBody2D);
        if (this.rb) {
            this.rb.fixedRotation = true;
            this.rb.wakeUp();
        } else {
            console.error("❌ 找不到RigidBody2D组件！");
        }
        
        this.animation = this.getComponent(Animation);
        if (this.animation) {
            this.animation.stop();
            this.setAnimationLoop('rightmove', true);
            this.setAnimationLoop('leftmove', true);
        } else {
            console.error("❌ 找不到Animation组件！");
        }
    }

    update(deltaTime: number) {
        if (!this.rb) {
            this.rb = this.getComponent(RigidBody2D);
            if (!this.rb) return;
        }

        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }

        if (this.isAttacking) {
            const vel = this.rb.linearVelocity;
            this.rb.linearVelocity = new Vec2(0, vel.y);
            return;
        }

        let dir = 0;
        const x = this.node.worldPosition.x;
        
        if (this.keyA && x > 20) dir = -1;
        if (this.keyD && x < this.totalMapWidth - 20) dir = 1;

        // ✅ 记录最后朝向
        if (dir === 1) this.lastFaceRight = true;
        if (dir === -1) this.lastFaceRight = false;

        const vel = this.rb.linearVelocity;
        this.rb.linearVelocity = new Vec2(dir * this.moveSpeed, vel.y);

        const currentPosY = this.node.worldPosition.y;
        const posDelta = Math.abs(currentPosY - this.lastPosY);
        const isNearZero = Math.abs(vel.y) < 50;
        const isPosStable = posDelta < 0.5;
        
        if (!this.canJump && isNearZero && isPosStable) {
            this.stableFrames++;
            if (this.stableFrames >= 2) {
                this.jumpCount = 0;
                this.canJump = true;
                this.stableFrames = 0;
            }
        } else {
            this.stableFrames = 0;
        }
        
        this.lastPosY = currentPosY;

        if (this.keyK && !this.lastKeyK && this.canJump && this.jumpCount < this.maxJump) {
            this.rb.linearVelocity = new Vec2(vel.x, this.jumpForce);
            this.jumpCount++;
            if (this.jumpCount >= this.maxJump) {
                this.canJump = false;
                this.stableFrames = 0;
            }
        }
        
        this.lastKeyK = this.keyK;
        this.updateAnimation();
    }
    
    private updateAnimation() {
        if (!this.animation || this.isAttacking) return;

        let targetAnim: string | null = null;
        if (this.keyD) targetAnim = 'rightmove';
        else if (this.keyA) targetAnim = 'leftmove';
        
        if (targetAnim) {
            const state = this.animation.getState(targetAnim);
            if (!state || !state.isPlaying) this.animation.play(targetAnim);
        } else {
            this.animation.stop();
        }
    }

    private onKeyDown(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') this.keyA = true;
        if (k === 'd') this.keyD = true;
        if (k === 'k') this.keyK = true;

        // ✅ 【修复】静止/移动都能正确判断左右攻击
        if (k === 'j' && !this.isAttacking && this.attackTimer <= 0) {
            this.isAttacking = true;
            this.attackTimer = this.attackCD;

            let attackAnim = "";
            if (this.keyA) {
                attackAnim = "leftattack";
            } else if (this.keyD) {
                attackAnim = "rightattack";
            } else {
                // 静止时使用最后朝向
                attackAnim = this.lastFaceRight ? "rightattack" : "leftattack";
            }
            
            this.animation.play(attackAnim);

            setTimeout(() => {
                this.isAttacking = false;
            }, 350);
        }
    }

    private onKeyUp(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') this.keyA = false;
        if (k === 'd') this.keyD = false;
        if (k === 'k') this.keyK = false;
    }
    
    private playAnimation(animName: string) {
        if (!this.animation) return;
        const state = this.animation.getState(animName);
        if (!state || !state.isPlaying) this.animation.play(animName);
    }
    
    private stopAnimation() {
        if (!this.animation) return;
        this.animation.stop();
    }
    
    private setAnimationLoop(animName: string, loop: boolean = true) {
        if (!this.animation) return;
        this.animation.play(animName);
        const state = this.animation.getState(animName);
        if (state) {
            state.repeatCount = loop ? Infinity : 1;
            state.wrapMode = loop ? 2 : 1;
        }
        this.animation.stop();
    }
    
    onCollisionEnter(other: any) {}
    onCollisionExit(other: any) {}

    onDestroy() {
        document.removeEventListener('keydown', this.onKeyDownHandler);
        document.removeEventListener('keyup', this.onKeyUpHandler);
    }
}