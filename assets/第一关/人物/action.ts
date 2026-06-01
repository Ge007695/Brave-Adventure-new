import { _decorator, Component, RigidBody2D, Vec2, PhysicsSystem2D, Animation, Node, input, Input, EventKeyboard, KeyCode } from 'cc';
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
    private lastKeyJ: boolean = false;

    /** 公开方法：外部（面板关闭时）可调用来强制重置所有输入状态 */
    public resetInputState(): void {
        this.keyA = false;
        this.keyD = false;
        this.keyK = false;
        this.lastKeyK = false;
        this.lastKeyJ = false;
        console.log('🔄 输入状态已重置');
    }

    // ✅ 【新增】记录最后朝向（静止时也能正确攻击）
    private lastFaceRight: boolean = true; 

    private isAttacking: boolean = false;
    private attackCD: number = 0.5;
    private attackTimer: number = 0;

    /** 攻击检测范围 */
    @property
    attackRange: number = 100;

    /** 攻击伤害值 */
    @property
    attackDamage: number = 1;

    // DOM 事件兜底：画布失焦时仍能接收键盘输入
    private _onKeyDownDom: ((e: KeyboardEvent) => void) | null = null;
    private _onKeyUpDom: ((e: KeyboardEvent) => void) | null = null;

    onLoad() {
        // 1. Cocos 原生输入系统
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

        // 2. DOM 事件兜底（画布失焦时 document 仍能收到按键）
        this._onKeyDownDom = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'a': this.keyA = true; break;
                case 'd': this.keyD = true; break;
                case 'k': this.keyK = true; break;
                case 'j': this.tryAttack(); break;
                case 'e': this.tryInteract(); break;
            }
        };
        this._onKeyUpDom = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'a': this.keyA = false; break;
                case 'd': this.keyD = false; break;
                case 'k': this.keyK = false; break;
            }
        };
        document.addEventListener('keydown', this._onKeyDownDom);
        document.addEventListener('keyup', this._onKeyUpDom);
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
            if (this.stableFrames >= 1.5) {
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

        this.lastPosY = currentPosY;
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

    /** 攻击逻辑（供 Cocos input 和 DOM 事件共用） */
    private tryAttack() {
        if (this.isAttacking || this.attackTimer > 0) return;

        this.isAttacking = true;
        this.attackTimer = this.attackCD;

        let attackAnim = "";
        if (this.keyA) {
            attackAnim = "leftattack";
        } else if (this.keyD) {
            attackAnim = "rightattack";
        } else {
            attackAnim = this.lastFaceRight ? "rightattack" : "leftattack";
        }
        this.animation.play(attackAnim);

        this.scheduleOnce(() => {
            this.checkAttackHit();
        }, 0.15);

        setTimeout(() => {
            this.isAttacking = false;
        }, 350);
    }

    /** 交互逻辑：寻找最近的宝箱并尝试打开 */
    private tryInteract() {
        const chests = this.findNearbyChests();
        for (const chest of chests) {
            if (chest.tryOpen()) {
                console.log('🎁 打开宝箱成功');
                break; // 一次只开一个宝箱
            }
        }
    }

    /** 在场景中查找所有宝箱组件 */
    private findNearbyChests(): any[] {
        const result: any[] = [];
        let root = this.node;
        while (root.parent) {
            root = root.parent;
        }
        this.searchForChest(root, result);
        return result;
    }

    private searchForChest(node: Node, result: any[]) {
        const chest = node.getComponent('TreasureChest');
        if (chest) {
            result.push(chest);
        }
        for (const child of node.children) {
            this.searchForChest(child, result);
        }
    }

    private onKeyDown(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_A: this.keyA = true; break;
            case KeyCode.KEY_D: this.keyD = true; break;
            case KeyCode.KEY_K: this.keyK = true; break;
            case KeyCode.KEY_J: this.tryAttack(); break;
            case KeyCode.KEY_E: this.tryInteract(); break;
        }
    }

    private onKeyUp(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_A: this.keyA = false; break;
            case KeyCode.KEY_D: this.keyD = false; break;
            case KeyCode.KEY_K: this.keyK = false; break;
        }
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

    /**
     * 检测攻击是否命中小怪
     */
    private checkAttackHit() {
        const myPos = this.node.worldPosition;
        const attackDir = this.lastFaceRight ? 1 : -1;

        const canvas = this.node.parent;
        if (!canvas) return;

        const enemies: any[] = [];
        this.findAllOctopusInChildren(canvas, enemies);

        let hitCount = 0;
        for (const enemy of enemies) {
            const enemyNode = enemy.node as Node;
            if (!enemyNode || !enemyNode.activeInHierarchy) continue;

            const enemyPos = enemyNode.worldPosition;
            const dx = enemyPos.x - myPos.x;
            const dy = Math.abs(enemyPos.y - myPos.y);

            const inFront = attackDir > 0 ? dx > 0 : dx < 0;
            const inXRange = Math.abs(dx) <= this.attackRange;
            const inYRange = dy <= 120;

            if (inFront && inXRange && inYRange && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(this.attackDamage);
                hitCount++;
                console.log(`⚔️ 攻击命中小怪: ${enemyNode.name}`);
            }
        }

        if (hitCount === 0) {
            console.log('⚔️ 攻击未命中');
        }
    }

    private findAllOctopusInChildren(node: Node, result: any[]) {
        const octopus = node.getComponent('Octopus');
        if (octopus) {
            result.push(octopus);
        }

        for (const child of node.children) {
            this.findAllOctopusInChildren(child, result);
        }
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        if (this._onKeyDownDom) document.removeEventListener('keydown', this._onKeyDownDom);
        if (this._onKeyUpDom) document.removeEventListener('keyup', this._onKeyUpDom);
    }
}