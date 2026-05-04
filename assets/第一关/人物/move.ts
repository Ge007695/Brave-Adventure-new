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
    private canJump = true; // 是否可以跳跃
    private lastPosY: number = 0; // 上一帧Y位置
    private stableFrames = 0; // 连续稳定帧数
    
    // 动画组件引用
    private animation!: Animation;

    // 确保所有按键状态属性都正确定义
    private keyA: boolean = false;
    private keyD: boolean = false;
    private keyK: boolean = false; // 明确声明 keyK
    private lastKeyK: boolean = false; // 明确声明 lastKeyK

    // 保存绑定后的函数引用，用于正确移除监听器
    private onKeyDownHandler!: (e: KeyboardEvent) => void;
    private onKeyUpHandler!: (e: KeyboardEvent) => void;

    onLoad() {
        // 注册键盘监听（预先绑定this，确保可以正确移除）
        this.onKeyDownHandler = this.onKeyDown.bind(this);
        this.onKeyUpHandler = this.onKeyUp.bind(this);
        document.addEventListener('keydown', this.onKeyDownHandler);
        document.addEventListener('keyup', this.onKeyUpHandler);
    }

    start() {
        // 🔧 场景切换后强制确保物理系统开启
        if (!PhysicsSystem2D.instance.enable) {
            PhysicsSystem2D.instance.enable = true;
            console.log("🔧 物理系统在start中被强制开启");
        }
        
        // 🔧 延迟一帧再初始化刚体，确保场景完全加载
        this.scheduleOnce(() => {
            this.initRigidBody();
        }, 0.05);
    }
    
    private initRigidBody() {
        // 初始化刚体，强制唤醒（解决场景切换瘫痪）
        this.rb = this.getComponent(RigidBody2D);
        if (this.rb) {
            this.rb.fixedRotation = true;
            this.rb.wakeUp();
            console.log("✅ 刚体初始化成功，状态:", this.rb.type, "激活:", this.rb.enabled);
        } else {
            console.error("❌ 找不到RigidBody2D组件！");
        }
        
        // 初始化动画组件
        this.animation = this.getComponent(Animation);
        if (this.animation) {
            console.log("✅ 动画组件初始化成功");
            // 确保开始时不播放任何动画
            this.animation.stop();
            // 设置动画为循环模式
            this.setAnimationLoop('rightmove', true);
            this.setAnimationLoop('leftmove', true);
        } else {
            console.error("❌ 找不到Animation组件！请确保已添加Animation组件并配置动画剪辑");
        }
    }

    update() {
        if (!this.rb) {
            // 🔧 运行时动态查找刚体
            this.rb = this.getComponent(RigidBody2D);
            if (!this.rb) return; // 安全校验
        }

        // 📊 调试：输出按键状态
        console.log(`📊 按键状态: A=${this.keyA}, D=${this.keyD}, K=${this.keyK}`);

        // 移动逻辑
        let dir = 0;
        const x = this.node.worldPosition.x;
        console.log(`📍 当前位置: x=${x.toFixed(2)}`);
        
        if (this.keyA && x > 20) dir = -1;
        if (this.keyD && x < this.totalMapWidth - 20) dir = 1;

        console.log(`🎮 移动方向: ${dir}, 速度: ${dir * this.moveSpeed}`);

        const vel = this.rb.linearVelocity;
        this.rb.linearVelocity = new Vec2(dir * this.moveSpeed, vel.y);
        console.log(`⚡ 刚体速度: (${vel.x.toFixed(2)}, ${vel.y.toFixed(2)})`);

        // 落地检测
        const currentPosY = this.node.worldPosition.y;
        const posDelta = Math.abs(currentPosY - this.lastPosY);
        const isNearZero = Math.abs(vel.y) < 50;
        const isPosStable = posDelta < 0.5; // 位置变化很小
        
        // 📊 输出状态
        console.log(`👣 速度Y: ${vel.y.toFixed(2)}, 位置变化: ${posDelta.toFixed(3)}, canJump: ${this.canJump}, 稳定帧: ${this.stableFrames}`);
        
        // 只有当跳跃次数已达到上限且持续稳定时才认为落地
        if (!this.canJump && isNearZero && isPosStable) {
            this.stableFrames++;
            // 需要连续稳定3帧才认为真正落地（防止误判）
            if (this.stableFrames >= 3) {
                this.jumpCount = 0;
                this.canJump = true;
                this.stableFrames = 0;
                console.log(`✅ 真正落地！跳跃次数已重置`);
            }
        } else {
            this.stableFrames = 0;
        }
        
        // 更新上一帧位置
        this.lastPosY = currentPosY;

        // 二段跳逻辑：只有在跳跃次数小于最大跳跃数且可以跳跃时才能跳
        if (this.keyK && !this.lastKeyK && this.canJump && this.jumpCount < this.maxJump) {
            this.rb.linearVelocity = new Vec2(vel.x, this.jumpForce);
            this.jumpCount++;
            // 达到最大跳跃次数后禁止跳跃，直到真正落地
            if (this.jumpCount >= this.maxJump) {
                this.canJump = false;
                this.stableFrames = 0; // 重置稳定帧计数
            }
            console.log(`⬆️ 跳跃！当前跳跃次数: ${this.jumpCount}/${this.maxJump}, canJump: ${this.canJump}`);
        }
        
        // 更新上一帧按键状态
        this.lastKeyK = this.keyK;
        
        // 🔄 动画循环控制：按住按键时确保动画持续播放
        this.updateAnimation();
    }
    
    /**
     * 更新动画状态：确保按住按键时动画持续循环播放
     */
    private updateAnimation() {
        if (!this.animation) return;
        
        // 根据当前按键状态确定应该播放的动画
        let targetAnim: string | null = null;
        if (this.keyD) {
            targetAnim = 'rightmove';
        } else if (this.keyA) {
            targetAnim = 'leftmove';
        }
        
        if (targetAnim) {
            // 获取当前动画状态
            const state = this.animation.getState(targetAnim);
            
            if (!state || !state.isPlaying) {
                // 切换到正确的动画
                this.animation.play(targetAnim);
                console.log(`🎬 播放动画: ${targetAnim}`);
            }
        } else {
            // 没有按键时停止动画
            this.animation.stop();
            console.log(`⏹️ 停止动画`);
        }
    }

    private onKeyDown(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') {
            this.keyA = true;
            console.log("⬅️ 按下 A 键");
            // 播放向左移动动画
            this.playAnimation('leftmove');
        }
        if (k === 'd') {
            this.keyD = true;
            console.log("➡️ 按下 D 键");
            // 播放向右移动动画
            this.playAnimation('rightmove');
        }
        if (k === 'k') {
            this.keyK = true;
            console.log("⬆️ 按下 K 键");
        }
    }

    private onKeyUp(e: KeyboardEvent) {
        const k = e.key.toLowerCase();
        if (k === 'a') {
            this.keyA = false;
            console.log("✖️ 松开 A 键");
            // 只有当D键也没按下时才停止动画
            if (!this.keyD) {
                this.stopAnimation();
            }
        }
        if (k === 'd') {
            this.keyD = false;
            console.log("✖️ 松开 D 键");
            // 只有当A键也没按下时才停止动画
            if (!this.keyA) {
                this.stopAnimation();
            }
        }
        if (k === 'k') {
            this.keyK = false;
            console.log("✖️ 松开 K 键");
        }
    }
    
    /**
     * 播放指定动画
     */
    private playAnimation(animName: string) {
        if (!this.animation) return;
        
        // 获取指定动画的状态
        const state = this.animation.getState(animName);
        
        // 如果动画状态不存在或未在播放，则播放动画
        if (!state || !state.isPlaying) {
            this.animation.play(animName);
            console.log(`🎬 播放动画: ${animName}`);
        }
    }
    
    /**
     * 停止所有动画
     */
    private stopAnimation() {
        if (!this.animation) return;
        
        this.animation.stop();
        console.log(`⏹️ 停止动画`);
    }
    
    /**
     * 设置动画循环模式
     */
    private setAnimationLoop(animName: string, loop: boolean = true) {
        if (!this.animation) return;
        
        // 先播放一次动画以创建状态
        this.animation.play(animName);
        
        const state = this.animation.getState(animName);
        if (state) {
            // 设置循环模式
            state.repeatCount = loop ? Infinity : 1;
            state.wrapMode = loop ? 2 : 1; // 2 = Loop, 1 = Normal
            console.log(`🔧 设置动画 ${animName} 循环模式: ${loop}`);
        }
        
        // 立即停止，等待按键触发
        this.animation.stop();
    }
    
    // 碰撞开始时
    onCollisionEnter(other: any) {
        console.log(`🤝 碰撞开始: ${other.node?.name}`);
    }
    
    // 碰撞结束时
    onCollisionExit(other: any) {
        console.log(`👋 碰撞结束: ${other.node?.name}`);
    }
    
    // 最佳实践：组件销毁时移除监听器，防止内存泄漏
    onDestroy() {
        document.removeEventListener('keydown', this.onKeyDownHandler);
        document.removeEventListener('keyup', this.onKeyUpHandler);
    }
}