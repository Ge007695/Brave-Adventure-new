import { _decorator, Component, AudioSource, AudioClip, Node, input, Input } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 背景音乐管理器
 * 挂载到场景中的持久节点（如 Camera 或 Canvas），
 * 普通区域循环播放 normalBGM，BOSS 出现后切换为 bossBGM。
 * 每关可独立配置不同的 BGM。
 */
@ccclass('BGMManager')
export class BGMManager extends Component {
    @property({ type: AudioClip, tooltip: '普通区域背景音乐（循环）' })
    normalBGM: AudioClip | null = null;

    @property({ tooltip: '普通BGM音量 (0~1)', range: [0, 1, 0.01], slide: true })
    normalBGMVolume: number = 1;

    @property({ type: AudioClip, tooltip: 'BOSS战背景音乐（循环）' })
    bossBGM: AudioClip | null = null;

    @property({ tooltip: 'BOSSBGM音量 (0~1)', range: [0, 1, 0.01], slide: true })
    bossBGMVolume: number = 1;

    @property({ type: Node, tooltip: 'BOSS容器节点（BOSS未出现时为inactive）' })
    bossNode: Node | null = null;

    private _audioSource: AudioSource | null = null;
    private _bossWasActive: boolean = false;
    private _hasResumed: boolean = false;

    start() {
        this._audioSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this._audioSource.loop = true;

        // 尝试播放BGM（可能被浏览器自动播放策略阻止）
        if (this.normalBGM) {
            this._audioSource.volume = this.normalBGMVolume;
            this._audioSource.clip = this.normalBGM;
            this._audioSource.play();
        }

        // 兜底：浏览器首次用户交互后恢复音频播放
        input.on(Input.EventType.KEY_DOWN, this._onFirstInteraction, this);
        input.on(Input.EventType.TOUCH_START, this._onFirstInteraction, this);
    }

    private _onFirstInteraction() {
        if (this._hasResumed) return;
        this._hasResumed = true;

        // 移除监听
        input.off(Input.EventType.KEY_DOWN, this._onFirstInteraction, this);
        input.off(Input.EventType.TOUCH_START, this._onFirstInteraction, this);

        // 如果BGM还没播放（被浏览器阻止了），重新播放
        if (this._audioSource && !this._audioSource.playing && this.normalBGM) {
            console.log('🔊 用户交互后恢复背景音乐');
            this._audioSource.volume = this.normalBGMVolume;
            this._audioSource.clip = this.normalBGM;
            this._audioSource.play();
        }
    }

    update() {
        if (!this.bossNode || !this.bossBGM || !this._audioSource) return;

        const bossAlive = this.isBossAlive();

        // BOSS 刚出现 → 切换到 BOSS BGM
        if (bossAlive && !this._bossWasActive) {
            this._bossWasActive = true;
            console.log('🎵 BOSS 出现，切换 BOSS 背景音乐');
            this._audioSource.stop();
            this._audioSource.volume = this.bossBGMVolume;
            this._audioSource.clip = this.bossBGM;
            this._audioSource.play();
        }

        // BOSS 被击败 → 切回普通 BGM
        if (!bossAlive && this._bossWasActive) {
            this._bossWasActive = false;
            console.log('🎵 BOSS 击败，恢复普通背景音乐');
            this._audioSource.stop();
            if (this.normalBGM) {
                this._audioSource.volume = this.normalBGMVolume;
                this._audioSource.clip = this.normalBGM;
                this._audioSource.play();
            }
        }
    }

    /**
     * 检测 BOSS 是否存活
     * bossNode 通常是一个容器节点，其子节点挂有 FinalBoss 组件
     */
    private isBossAlive(): boolean {
        if (!this.bossNode || !this.bossNode.activeInHierarchy) return false;

        // 在子节点中查找是否有存活的 FinalBoss
        for (const child of this.bossNode.children) {
            if (child.activeInHierarchy && child.getComponent('FinalBoss')) {
                return true;
            }
        }

        return false;
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this._onFirstInteraction, this);
        input.off(Input.EventType.TOUCH_START, this._onFirstInteraction, this);
    }
}
