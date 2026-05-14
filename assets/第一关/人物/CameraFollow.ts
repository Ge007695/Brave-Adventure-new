import { _decorator, Component, Node, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Node)
    target: Node | null = null;

    @property([Node])
    uiContainers: Node[] = [];

    @property
    smoothSpeed: number = 0.1;

    @property
    uiOffsetX: number = -450;

    @property
    uiOffsetY: number = 220;

    @property
    mapLeft: number = 0;

    @property
    mapRight: number = 5120;

    private cameraWidth: number = 0;

    private currentOffsetX: number = 0;

    start() {
        const visibleSize = view.getVisibleSize();
        this.cameraWidth = visibleSize.width;
        this.currentOffsetX = this.node.worldPosition.x;
    }

    lateUpdate() {
        if (!this.target) return;

        const playerX = this.target.worldPosition.x;
        const cameraPos = this.node.worldPosition;
        let targetCamX = cameraPos.x;

        const deadZoneLeft = cameraPos.x - this.cameraWidth * 0.25;
        const deadZoneRight = cameraPos.x + this.cameraWidth * 0.25;

        if (playerX < deadZoneLeft) {
            targetCamX = playerX + this.cameraWidth * 0.25;
        }
        else if (playerX > deadZoneRight) {
            targetCamX = playerX - this.cameraWidth * 0.25;
        }

        const minCamX = this.mapLeft + this.cameraWidth / 2;
        const maxCamX = this.mapRight - this.cameraWidth / 2;
        targetCamX = Math.max(minCamX, Math.min(maxCamX, targetCamX));

        const newX = cameraPos.x + (targetCamX - cameraPos.x) * this.smoothSpeed;
        this.node.setWorldPosition(newX, cameraPos.y, cameraPos.z);

        for (const ui of this.uiContainers) {
            ui.setWorldPosition(
                newX + this.uiOffsetX,
                cameraPos.y + this.uiOffsetY,
                cameraPos.z
            );
        }
    }
}