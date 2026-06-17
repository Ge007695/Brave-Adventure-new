import { _decorator, Component, RigidBody2D, Vec2, PhysicsSystem2D, Animation, Node, AudioSource, AudioClip, Prefab, instantiate, input, Input, EventKeyboard, KeyCode } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('move')
export class move extends Component {
    @property moveSpeed: number = 300;
    @property jumpForce: number = 500;
    @property totalMapWidth: number = 5120;
    @property({ tooltip: '进入关底区域并触发BOSS的世界X坐标' })
    bossTriggerX: number = 3840;
    @property({ tooltip: '最后一张背景的左边界世界X坐标' })
    finalBackgroundLeftX: number = 3840;
    @property({ tooltip: '角色在地图左右边界保留的距离' })
    boundaryPadding: number = 20;

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
        this.keyU = false;
        this.lastKeyK = false;
        this.lastKeyJ = false;
        this.lastKeyU = false;
        console.log('🔄 输入状态已重置');
    }

    // ✅ 【新增】记录最后朝向（静止时也能正确攻击）
    public lastFaceRight: boolean = true;

    private isAttacking: boolean = false;
    private attackCD: number = 0.5;
    private attackTimer: number = 0;
    private bossAreaLocked: boolean = false;

    // 火箭攻击状态
    private isLaunching: boolean = false;
    private rocketTimer: number = 0;
    private keyU: boolean = false;
    private lastKeyU: boolean = false;

    /** 攻击检测范围 */
    @property
    attackRange: number = 100;

    /** 攻击伤害值 */
    @property
    attackDamage: number = 1;

    /** 攻击音效 */
    @property({ type: AudioClip })
    hitClip: AudioClip | null = null;

    @property({ tooltip: '攻击音效音量 (0~1)', range: [0, 1, 0.01], slide: true })
    hitClipVolume: number = 1;

    // ==================== 火箭攻击（远程）相关属性 ====================

    @property({ type: Prefab, tooltip: '火箭子弹预制体（挂载 RocketBullet 脚本）' })
    rocketBulletPrefab: Prefab | null = null;

    @property({ tooltip: '火箭攻击冷却时间（秒）' })
    rocketCD: number = 0.8;

    @property({ tooltip: '火箭弹伤害（0=使用预制体默认值）' })
    rocketDamage: number = 0;

    @property({ tooltip: '发射动画名称（朝右）' })
    rightLaunchAnim: string = 'rightlaunch';

    @property({ tooltip: '发射动画名称（朝左）' })
    leftLaunchAnim: string = 'leftlaunch';

    @property({ tooltip: '发射动画结束后延迟多久生成子弹（秒）' })
    launchSpawnDelay: number = 0.15;

    @property({ type: AudioClip, tooltip: '火箭发射音效' })
    rocketClip: AudioClip | null = null;

    @property({ tooltip: '火箭发射音效音量 (0~1)', range: [0, 1, 0.01], slide: true })
    rocketClipVolume: number = 1;

    private _audioSource: AudioSource | null = null;

    // DOM 事件兜底：画布失焦时仍能接收键盘输入
    private _onKeyDownDom: ((e: KeyboardEvent) => void) | null = null;
    private _onKeyUpDom: ((e: KeyboardEvent) => void) | null = null;

    onLoad() {
        // 初始化音效
        this._audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this._audioSource.loop = false;

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
                case 'h': this.tryRocketAttack(); break;
                case 'e': this.tryInteract(); break;
            }
        };
        this._onKeyUpDom = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case 'a': this.keyA = false; break;
                case 'd': this.keyD = false; break;
                case 'k': this.keyK = false; break;
                case 'h': this.keyU = false; break;
            }
        };
        document.addEventListener('keydown', this._onKeyDownDom);
        document.addEventListener('keyup', this._onKeyUpDom);
    }

    start() {
        // 强制重启物理引擎，防止从暂停状态切场景后物理卡死
        PhysicsSystem2D.instance.enable = false;
        PhysicsSystem2D.instance.enable = true;

        this.scheduleOnce(() => {
            this.initRigidBody();
        }, 0.1);
    }

    private initRigidBody() {
        this.rb = this.getComponent(RigidBody2D);
        if (this.rb) {
            this.rb.fixedRotation = true;
            this.rb.wakeUp();
            // 再确保物理系统运行中
            if (!PhysicsSystem2D.instance.enable) {
                PhysicsSystem2D.instance.enable = true;
            }
            this.rb.applyForceToCenter(new Vec2(0, 0), true); // 轻微激活
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

        if (this.rocketTimer > 0) {
            this.rocketTimer -= deltaTime;
        }

        this.updateBossAreaLock();

        if (this.isAttacking) {
            const vel = this.rb.linearVelocity;
            this.rb.linearVelocity = new Vec2(0, vel.y);
            return;
        }

        if (this.isLaunching) {
            const vel = this.rb.linearVelocity;
            this.rb.linearVelocity = new Vec2(0, vel.y);
            return;
        }

        let dir = 0;
        const x = this.node.worldPosition.x;
        const minX = this.getMoveMinX();
        const maxX = this.totalMapWidth - this.boundaryPadding;
        
        if (this.keyA && x > minX) dir = -1;
        if (this.keyD && x < maxX) dir = 1;

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

    private updateBossAreaLock() {
        if (!this.bossAreaLocked && this.node.worldPosition.x >= this.bossTriggerX) {
            this.bossAreaLocked = true;
        }

        if (!this.bossAreaLocked) return;

        const minX = this.getMoveMinX();
        const maxX = this.totalMapWidth - this.boundaryPadding;
        const pos = this.node.worldPosition;
        const clampedX = Math.max(minX, Math.min(maxX, pos.x));

        if (Math.abs(clampedX - pos.x) > 0.001) {
            this.node.setWorldPosition(clampedX, pos.y, pos.z);

            if (this.rb) {
                const vel = this.rb.linearVelocity;
                const shouldStopLeft = clampedX === minX && vel.x < 0;
                const shouldStopRight = clampedX === maxX && vel.x > 0;
                if (shouldStopLeft || shouldStopRight) {
                    this.rb.linearVelocity = new Vec2(0, vel.y);
                }
            }
        }
    }

    private getMoveMinX(): number {
        return this.bossAreaLocked
            ? this.finalBackgroundLeftX + this.boundaryPadding
            : this.boundaryPadding;
    }
    
    private updateAnimation() {
        if (!this.animation || this.isAttacking || this.isLaunching) return;

        let targetAnim: string | null = null;
        if (this.keyD) targetAnim = 'rightmove';
        else if (this.keyA) targetAnim = 'leftmove';

        if (targetAnim) {
            const state = this.animation.getState(targetAnim);
            if (!state || !state.isPlaying) this.animation.play(targetAnim);
        } else {
            // 静止时：跳转到面对方向的移动动画第一帧，作为待机姿态
            const idleAnim = this.lastFaceRight ? 'rightmove' : 'leftmove';
            const state = this.animation.getState(idleAnim);
            if (!state || !state.isPlaying) {
                this.animation.play(idleAnim);
            }
            // 立即跳到第 0 帧，然后停止，角色就不会卡在攻击/发射的最后一帧
            const idleState = this.animation.getState(idleAnim);
            if (idleState) {
                idleState.time = 0;
            }
            this.animation.stop();
        }
    }

    /** 攻击逻辑（供 Cocos input 和 DOM 事件共用） */
    private tryAttack() {
        if (this.isAttacking || this.attackTimer > 0) return;

        this.isAttacking = true;
        this.attackTimer = this.attackCD;

        // 播放攻击音效
        if (this.hitClip && this._audioSource) {
            this._audioSource.playOneShot(this.hitClip, this.hitClipVolume);
        }

        let attackAnim = "";
        if (this.keyA) {
            attackAnim = "leftattack";
        } else if (this.keyD) {
            attackAnim = "rightattack";
        } else {
            attackAnim = this.lastFaceRight ? "rightattack" : "leftattack";
        }
        if (this.animation) {
            this.animation.play(attackAnim);
        }

        this.scheduleOnce(() => {
            this.checkAttackHit();
        }, 0.15);

        setTimeout(() => {
            this.isAttacking = false;
            this.updateAnimation();
        }, 350);
    }

    /** 火箭攻击逻辑 */
    private tryRocketAttack() {
        if (this.isAttacking || this.isLaunching || this.rocketTimer > 0) return;
        if (!this.rocketBulletPrefab) {
            console.warn('🚀 火箭子弹预制体未设置！请在编辑器中拖入 rocketBulletPrefab');
            return;
        }

        // Boss区域消耗蓝量，其他区域不消耗
        if (this.bossAreaLocked) {
            const stats = this.getComponent('PlayerStats') as any;
            if (stats && typeof stats.useMana === 'function' && !stats.useMana(20)) {
                console.log('🚀 蓝量不足，无法发射火箭！');
                return;
            }
        }

        this.isLaunching = true;
        this.rocketTimer = this.rocketCD;

        // 播放火箭发射音效
        if (this.rocketClip && this._audioSource) {
            this._audioSource.playOneShot(this.rocketClip, this.rocketClipVolume);
        }

        // 播放发射动画
        const launchAnim = this.lastFaceRight ? this.rightLaunchAnim : this.leftLaunchAnim;
        if (this.animation) {
            this.animation.play(launchAnim);
        }

        // 延迟生成子弹（等发射动画播放到位）
        this.scheduleOnce(() => {
            this.spawnRocketBullet();
        }, this.launchSpawnDelay);

        // 发射动作结束（总时长 = 延迟 + 少量收尾）
        setTimeout(() => {
            this.isLaunching = false;
            this.updateAnimation();
        }, (this.launchSpawnDelay + 0.2) * 1000);
    }

    /** 在玩家前方生成火箭子弹 */
    private spawnRocketBullet() {
        if (!this.rocketBulletPrefab) return;

        // 找到 Canvas 节点作为子弹的父节点
        let canvas = this.node.parent;
        if (!canvas) return;

        const bulletNode = instantiate(this.rocketBulletPrefab);
        canvas.addChild(bulletNode);

        // 设置子弹初始位置（玩家前方偏移一点）
        const playerPos = this.node.worldPosition;
        const dir = this.lastFaceRight ? 1 : -1;
        const spawnOffsetX = dir * 60; // 在玩家前方60像素生成
        bulletNode.setWorldPosition(playerPos.x + spawnOffsetX, playerPos.y, 0);

        // 初始化子弹方向
        const bullet = bulletNode.getComponent('RocketBullet') as any;
        if (bullet && typeof bullet.init === 'function') {
            bullet.init(dir);
            // 编辑器覆盖伤害值
            if (this.rocketDamage > 0) {
                bullet.damage = this.rocketDamage;
            }
        } else {
            console.warn('🚀 子弹预制体上未找到 RocketBullet 组件！');
        }

        console.log(`🚀 火箭子弹已生成，方向: ${dir === 1 ? '右' : '左'}`);
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
            case KeyCode.KEY_H: this.tryRocketAttack(); break;
            case KeyCode.KEY_E: this.tryInteract(); break;
        }
    }

    private onKeyUp(event: EventKeyboard) {
        switch (event.keyCode) {
            case KeyCode.KEY_A: this.keyA = false; break;
            case KeyCode.KEY_D: this.keyD = false; break;
            case KeyCode.KEY_K: this.keyK = false; break;
            case KeyCode.KEY_H: this.keyU = false; break;
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
     * 检测攻击是否命中敌人
     */
    private checkAttackHit() {
        const myPos = this.node.worldPosition;
        const attackDir = this.lastFaceRight ? 1 : -1;

        const canvas = this.node.parent;
        if (!canvas) return;

        const enemies: any[] = [];
        this.findAllAttackTargetsInChildren(canvas, enemies);

        let hitCount = 0;
        for (const enemy of enemies) {
            const enemyNode = enemy.node as Node;
            if (!enemyNode || !enemyNode.activeInHierarchy) continue;

            const enemyPos = typeof enemy.getAttackHitPosition === 'function'
                ? enemy.getAttackHitPosition()
                : enemyNode.worldPosition;
            const dx = enemyPos.x - myPos.x;
            const dy = Math.abs(enemyPos.y - myPos.y);
            const rangeX = typeof enemy.getAttackHitRangeX === 'function'
                ? enemy.getAttackHitRangeX()
                : this.attackRange;
            const rangeY = typeof enemy.getAttackHitRangeY === 'function'
                ? enemy.getAttackHitRangeY()
                : 120;

            const inFront = attackDir > 0 ? dx > 0 : dx < 0;
            const inXRange = Math.abs(dx) <= rangeX;
            const inYRange = dy <= rangeY;

            if (inFront && inXRange && inYRange && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(this.attackDamage, 'melee');
                hitCount++;
                console.log(`⚔️ 攻击命中敌人: ${enemyNode.name}`);
            }
        }

        if (hitCount === 0) {
            console.log('⚔️ 攻击未命中');
        }
    }

    private findAllAttackTargetsInChildren(node: Node, result: any[]) {
        const octopus = node.getComponent('Octopus');
        if (octopus) {
            result.push(octopus);
        }

        const finalBoss = node.getComponent('FinalBoss');
        if (finalBoss) {
            result.push(finalBoss);
        }

        const vine = node.getComponent('Vine');
        if (vine) {
            result.push(vine);
        }

        const bee = node.getComponent('Bee');
        if (bee) {
            result.push(bee);
        }

        const wolfBoss = node.getComponent('WolfBoss');
        if (wolfBoss) {
            result.push(wolfBoss);
        }

        for (const child of node.children) {
            this.findAllAttackTargetsInChildren(child, result);
        }
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        if (this._onKeyDownDom) document.removeEventListener('keydown', this._onKeyDownDom);
        if (this._onKeyUpDom) document.removeEventListener('keyup', this._onKeyUpDom);
    }
}
