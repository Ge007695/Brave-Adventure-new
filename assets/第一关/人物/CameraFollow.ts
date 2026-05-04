import { _decorator, Component, Node, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Node)
    target: Node | null = null;

    @property
    smoothSpeed: number = 0.1;

    // 地图边界，4张1280的图，总宽度5120
    @property
    mapLeft: number = 0;

    @property
    mapRight: number = 5120;

    private cameraWidth: number = 0;

    start() {
        // 获取屏幕宽度
        const visibleSize = view.getVisibleSize();
        this.cameraWidth = visibleSize.width;
    }

    lateUpdate() {
        if (!this.target) return;

        const playerX = this.target.worldPosition.x;
        const cameraPos = this.node.worldPosition;
        let targetCamX = cameraPos.x;

        // 1. 计算死区：中间50%不跟随，左右各1/4触发跟随
        const deadZoneLeft = cameraPos.x - this.cameraWidth * 0.25;
        const deadZoneRight = cameraPos.x + this.cameraWidth * 0.25;

        // 2. 超出左边界，相机跟随向左
        if (playerX < deadZoneLeft) {
            targetCamX = playerX + this.cameraWidth * 0.25;
        }
        // 超出右边界，相机跟随向右
        else if (playerX > deadZoneRight) {
            targetCamX = playerX - this.cameraWidth * 0.25;
        }

        // 3. 限制相机不超出地图，避免空白
        const minCamX = this.mapLeft + this.cameraWidth / 2;
        const maxCamX = this.mapRight - this.cameraWidth / 2;
        targetCamX = Math.max(minCamX, Math.min(maxCamX, targetCamX));

        // 4. 平滑移动相机
        const newX = cameraPos.x + (targetCamX - cameraPos.x) * this.smoothSpeed;
        this.node.setWorldPosition(newX, cameraPos.y, cameraPos.z);
    }
}