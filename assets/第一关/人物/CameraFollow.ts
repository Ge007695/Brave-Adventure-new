import { _decorator, Component, Node, view } from 'cc';
import { FinalBoss } from './FinalBoss';
const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Node)
    target: Node | null = null;

    @property([Node])
    uiContainers: Node[] = [];

    @property
    smoothSpeed: number = 0.1;

    @property({ tooltip: '人物属性UI相对相机的X偏移' })
    uiOffsetX: number = -450;

    @property({ tooltip: '人物属性UI相对相机的Y偏移' })
    uiOffsetY: number = 220;

    @property
    mapLeft: number = 0;

    @property
    mapRight: number = 5120;

    // ── BOSS 相关 ──
    @property({ tooltip: '是否启用关底BOSS，第二关请关闭' })
    enableBoss: boolean = true;

    @property({ type: Node, tooltip: '场景中预置的BOSS节点（挂好FinalBoss脚本），初始inactive' })
    bossNode: Node | null = null;

    // victoryUI 直接挂在 Canvas 上，不需要手动拖引用

    @property({ tooltip: '进入关底区域并触发BOSS的世界X坐标' })
    bossTriggerX: number = 3840;

    @property({ tooltip: '最后一张背景的左边界世界X坐标' })
    finalBackgroundLeftX: number = 3840;

    @property({ tooltip: '进入关底时是否立即把镜头切到最后一张背景' })
    snapCameraOnBossEnter: boolean = true;

    private cameraWidth: number = 0;
    private currentOffsetX: number = 0;
    private bossAreaLocked: boolean = false;
    private bossWasActive: boolean = false;

    start() {
        const visibleSize = view.getVisibleSize();
        this.cameraWidth = visibleSize.width;
        this.currentOffsetX = this.node.worldPosition.x;
    }

    lateUpdate() {
        if (!this.target) return;

        const playerX = this.target.worldPosition.x;
        const cameraPos = this.node.worldPosition;
        const justEnteredBossArea = this.enableBoss && !this.bossAreaLocked && playerX >= this.bossTriggerX;
        if (justEnteredBossArea) {
            this.bossAreaLocked = true;
            this.spawnBoss();
        }

        let targetCamX = cameraPos.x;
        const deadZoneLeft = cameraPos.x - this.cameraWidth * 0.25;
        const deadZoneRight = cameraPos.x + this.cameraWidth * 0.25;

        if (playerX < deadZoneLeft) {
            targetCamX = playerX + this.cameraWidth * 0.25;
        } else if (playerX > deadZoneRight) {
            targetCamX = playerX - this.cameraWidth * 0.25;
        }

        const minCamX = this.mapLeft + this.cameraWidth / 2;
        const maxCamX = this.mapRight - this.cameraWidth / 2;
        targetCamX = Math.max(minCamX, Math.min(maxCamX, targetCamX));

        if (this.enableBoss && this.bossAreaLocked) {
            const [bossMinCamX, bossMaxCamX] = this.getBossCameraRange();
            targetCamX = Math.max(bossMinCamX, Math.min(bossMaxCamX, targetCamX));

            // BOSS 击败后弹出胜利 UI（从 Canvas 上找 VictoryUI 组件）
            // bossNode 是空父节点，实际 BOSS（FinalBoss 脚本）在子节点上
            const bossChild = this.bossNode?.children[0];
            const bossAlive = bossChild?.activeInHierarchy ?? false;
            if (this.bossWasActive && !bossAlive) {
                this.bossAreaLocked = false;
                const canvas = this.node.parent;
                if (canvas) {
                    const vu = (canvas as any).getComponent('VictoryUI');
                    if (vu && vu.show) {
                        vu.show();
                        console.log('🎉 VictoryUI 已显示');
                    }
                }
            }
            if (bossAlive) {
                this.bossWasActive = true;
            }
        }

        const newX = justEnteredBossArea && this.snapCameraOnBossEnter
            ? targetCamX
            : cameraPos.x + (targetCamX - cameraPos.x) * this.smoothSpeed;
        this.node.setWorldPosition(newX, cameraPos.y, cameraPos.z);

        for (const ui of this.uiContainers) {
            if (!ui || !ui.isValid) continue;
            ui.setWorldPosition(
                newX + this.uiOffsetX,
                cameraPos.y + this.uiOffsetY,
                cameraPos.z
            );
        }
    }

    private getBossCameraRange(): [number, number] {
        const bossMinCamX = this.finalBackgroundLeftX + this.cameraWidth / 2;
        const bossMaxCamX = this.mapRight - this.cameraWidth / 2;
        if (bossMinCamX <= bossMaxCamX) return [bossMinCamX, bossMaxCamX];
        const center = (this.finalBackgroundLeftX + this.mapRight) * 0.5;
        return [center, center];
    }

    private spawnBoss() {
        if (!this.bossNode || !this.bossNode.isValid) {
            console.warn('⚠️ CameraFollow: bossNode 未设置，无法生成BOSS');
            return;
        }

        this.bossNode.active = true;

        const finalBoss = this.bossNode.getComponent(FinalBoss);
        if (finalBoss) {
            finalBoss.init(
                this.target,
                this.finalBackgroundLeftX,
                this.mapRight,
                this.bossNode.worldPosition.y,
            );
        }
    }
}
