import { _decorator, Component, Node, Label, Sprite, director } from 'cc';
import { PlayerStats } from '../人物/PlayerStats';
import { GameOverUI } from '../小怪/GameOverUI';
const { ccclass, property } = _decorator;

@ccclass('PlayerStatusUI')
export class PlayerStatusUI extends Component {
    @property(Node)
    playerNode: Node | null = null;

    @property(Node)
    gameOverUI: Node | null = null;

    @property(Sprite)
    healthFill: Sprite | null = null;

    @property(Label)
    healthLabel: Label | null = null;

    @property(Sprite)
    manaFill: Sprite | null = null;

    @property(Label)
    manaLabel: Label | null = null;

    @property(Sprite)
    expFill: Sprite | null = null;

    @property(Label)
    expLabel: Label | null = null;

    @property(Label)
    levelLabel: Label | null = null;

    private playerStats: PlayerStats | null = null;

    start() {
        this.bindPlayerStats();
        this.updateAllBars();
    }

    private bindPlayerStats() {
        console.log('🔍 bindPlayerStats 开始');

        if (!this.playerNode) {
            let root = this.node;
            while (root.parent) {
                root = root.parent;
            }
            console.log('🔍 搜索玩家节点，从: ' + root.name);
            this.playerNode = this.searchForPlayer(root);
            console.log('🔍 搜索结果: ' + (this.playerNode ? this.playerNode.name : 'null'));
        }

        if (this.playerNode) {
            console.log('🔍 找到玩家节点: ' + this.playerNode.name);
            this.playerStats = this.playerNode.getComponent(PlayerStats);
            if (!this.playerStats) {
                console.log('🔍 添加 PlayerStats 组件');
                this.playerStats = this.playerNode.addComponent(PlayerStats);
            }

            this.playerStats.onHealthChange = (current, max) => {
                this.updateHealthBar(current, max);
            };

            this.playerStats.onManaChange = (current, max) => {
                this.updateManaBar(current, max);
            };

            this.playerStats.onExpChange = (exp, level) => {
                this.updateExpBar(exp, level);
            };

            this.playerStats.onLevelUp = (newLevel) => {
                console.log('🎉🎉🎉 升级了！');
            };

            this.playerStats.onDeath = () => {
                console.log('💀 玩家死亡！游戏结束！');
                this.onPlayerDeath();
            };

            console.log('✅ PlayerStatusUI 绑定玩家成功');
        } else {
            console.warn('❌ PlayerStatusUI: 没找到玩家节点');
        }
    }

    private searchForPlayer(node: Node): Node | null {
        if (node.getComponent('move')) {
            return node;
        }
        for (const child of node.children) {
            const found = this.searchForPlayer(child);
            if (found) return found;
        }
        return null;
    }

    private updateHealthBar(current: number, max: number) {
        if (!this.healthFill || !this.healthLabel) return;
        const percent = Math.max(0, Math.min(1, current / max));
        this.healthFill.fillRange = percent;
        this.healthLabel.string = `${Math.floor(current)} / ${max}`;
    }

    private updateManaBar(current: number, max: number) {
        if (!this.manaFill || !this.manaLabel) return;
        const percent = Math.max(0, Math.min(1, current / max));
        this.manaFill.fillRange = percent;
        this.manaLabel.string = `${Math.floor(current)} / ${max}`;
    }

    private updateExpBar(current: number, level: number) {
        if (!this.expFill || !this.expLabel || !this.levelLabel || !this.playerStats) return;

        const percent = Math.max(0, Math.min(1, current / this.playerStats.expToLevelUp));
        this.expFill.fillRange = percent;
        this.expLabel.string = `${current} / ${this.playerStats.expToLevelUp}`;
        this.levelLabel.string = `Lv.${level}`;
    }

    private updateAllBars() {
        if (!this.playerStats) return;
        this.updateHealthBar(this.playerStats.health, this.playerStats.maxHealth);
        this.updateManaBar(this.playerStats.mana, this.playerStats.maxMana);
        this.updateExpBar(this.playerStats.experience, this.playerStats.level);
    }

    private onPlayerDeath() {
        // 兜底：如果引用丢失，自动在场景中查找 GameOverUI 组件
        if (!this.gameOverUI) {
            const scene = director.getScene();
            if (scene) {
                const canvas = scene.getChildByName('Canvas');
                if (canvas) {
                    this.gameOverUI = canvas;
                }
            }
        }

        if (this.gameOverUI) {
            console.log('🎮 尝试显示游戏结束界面');
            const ui = this.gameOverUI.getComponent(GameOverUI);
            if (ui) {
                ui.show();
                console.log('✅ GameOverUI.show() 已调用');
            } else {
                // 兜底：如果节点上没找到组件，全局搜索
                const scene = director.getScene();
                if (scene) {
                    const found = this.findGameOverUI(scene);
                    if (found) {
                        found.show();
                        console.log('✅ 通过搜索找到 GameOverUI 并调用 show()');
                    }
                }
            }
        } else {
            console.warn('⚠️ GameOverUI 节点未设置且无法自动找到');
        }

        if (this.playerNode) {
            console.log('💀 隐藏玩家节点');
            this.playerNode.active = false;
        }
    }

    /** 递归搜索场景中的 GameOverUI 组件 */
    private findGameOverUI(node: Node): GameOverUI | null {
        const comp = node.getComponent(GameOverUI);
        if (comp) return comp;
        for (const child of node.children) {
            const found = this.findGameOverUI(child);
            if (found) return found;
        }
        return null;
    }
}