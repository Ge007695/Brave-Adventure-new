import { _decorator, Component, Node, Camera, find } from 'cc';
const { ccclass, executeInEditMode } = _decorator;

@ccclass('FollowCamera')
@executeInEditMode // 编辑器里也能实时看到效果
export class FollowCamera extends Component {

    private mainCamera: Camera | null = null;

    onLoad() {
        // 自动找到主摄像机
        const cameraNode = find("Camera");
        if (cameraNode) {
            this.mainCamera = cameraNode.getComponent(Camera);
        }
    }

    lateUpdate(deltaTime: number) {
        if (!this.mainCamera) return;

        // 让 UI 位置 = 摄像机位置 + 左上角偏移
        // 这样 UI 永远贴在屏幕左上角
        const cameraPos = this.mainCamera.node.worldPosition;
        this.node.worldPosition = cameraPos;
    }
}


