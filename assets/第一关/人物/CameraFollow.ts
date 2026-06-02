import { _decorator, Color, Component, Graphics, Label, Node, UITransform, view } from 'cc';
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

    @property({ tooltip: '人物属性UI相对相机的X偏移：数值越小越靠左，越大越靠右' })
    uiOffsetX: number = -450;

    @property({ tooltip: '人物属性UI相对相机的Y偏移：数值越大越靠上，越小越靠下' })
    uiOffsetY: number = 220;

    @property
    mapLeft: number = 0;

    @property
    mapRight: number = 5120;

    @property({ tooltip: '进入关底区域并触发BOSS的世界X坐标' })
    bossTriggerX: number = 3840;

    @property({ tooltip: '最后一张背景的左边界世界X坐标' })
    finalBackgroundLeftX: number = 3840;

    @property({ tooltip: 'BOSS生成位置的世界X坐标' })
    bossSpawnX: number = 4480;

    @property({ tooltip: 'BOSS生成位置的世界Y坐标' })
    bossSpawnY: number = 360;

    @property({ tooltip: 'BOSS显示缩放' })
    bossScale: number = 1;

    @property({ tooltip: '进入关底时是否立即把镜头切到最后一张背景' })
    snapCameraOnBossEnter: boolean = true;

    @property({ tooltip: 'BOSS最大血量' })
    bossMaxHp: number = 12;

    @property({ tooltip: 'BOSS每次攻击伤害' })
    bossDamage: number = 18;

    @property({ tooltip: 'BOSS攻击冷却时间(秒)' })
    bossAttackCooldown: number = 1.2;

    @property({ tooltip: 'BOSS攻击范围' })
    bossAttackRange: number = 360;

    @property({ tooltip: '击败BOSS获得经验' })
    bossExpReward: number = 10;

    private cameraWidth: number = 0;
    private currentOffsetX: number = 0;
    private bossAreaLocked: boolean = false;
    private bossNode: Node | null = null;

    start() {
        const visibleSize = view.getVisibleSize();
        this.cameraWidth = visibleSize.width;
        this.currentOffsetX = this.node.worldPosition.x;
    }

    lateUpdate() {
        if (!this.target) return;

        const playerX = this.target.worldPosition.x;
        const cameraPos = this.node.worldPosition;
        const justEnteredBossArea = !this.bossAreaLocked && playerX >= this.bossTriggerX;
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

        if (this.bossAreaLocked) {
            const [bossMinCamX, bossMaxCamX] = this.getBossCameraRange();
            targetCamX = Math.max(bossMinCamX, Math.min(bossMaxCamX, targetCamX));
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

        if (bossMinCamX <= bossMaxCamX) {
            return [bossMinCamX, bossMaxCamX];
        }

        const center = (this.finalBackgroundLeftX + this.mapRight) * 0.5;
        return [center, center];
    }

    private spawnBoss() {
        if (this.bossNode && this.bossNode.isValid) {
            this.bossNode.active = true;
            return;
        }

        const parent = this.node.parent;
        if (!parent) return;

        const boss = new Node('FinalBoss');
        parent.addChild(boss);
        // 把 BOSS 放到所有背景／地形之后、UI 之前渲染，避免被遮挡
        boss.setSiblingIndex(parent.children.length - 1);
        boss.setWorldPosition(this.bossSpawnX, this.bossSpawnY, 0);
        boss.setScale(this.bossScale, this.bossScale, 1);

        const transform = boss.addComponent(UITransform);
        transform.setContentSize(520, 460);

        this.drawBoss(boss);
        this.addBossName(boss);

        const finalBoss = boss.addComponent(FinalBoss);
        finalBoss.init(
            this.target,
            this.bossMaxHp,
            this.bossDamage,
            this.bossAttackCooldown,
            this.bossAttackRange,
            this.bossExpReward
        );

        this.bossNode = boss;
    }

    private drawBoss(boss: Node) {
        const tentacleLayer = this.createGraphicsLayer(boss, 'BossTentacles');
        const bodyLayer = this.createGraphicsLayer(boss, 'BossBody');
        const highlightLayer = this.createGraphicsLayer(boss, 'BossHighlight');
        const hornLayer = this.createGraphicsLayer(boss, 'BossHorns');
        const eyeLayer = this.createGraphicsLayer(boss, 'BossEyes');
        const pupilLayer = this.createGraphicsLayer(boss, 'BossPupils');
        const mouthLayer = this.createGraphicsLayer(boss, 'BossMouth');
        const teethLayer = this.createGraphicsLayer(boss, 'BossTeeth');

        for (let i = -3; i <= 3; i++) {
            const x = i * 58;
            const sway = i % 2 === 0 ? -24 : 24;
            this.fillPolygon(tentacleLayer, [
                [x - 24, -76],
                [x + 24, -76],
                [x + 44 + sway, -190],
                [x + 10 + sway, -235],
                [x - 38 + sway, -182],
            ], new Color(6, 9, 35, 210));
        }

        this.fillPolygon(bodyLayer, [
            [-214, -96],
            [-255, -34],
            [-236, 70],
            [-162, 154],
            [-54, 205],
            [58, 203],
            [158, 154],
            [232, 66],
            [252, -34],
            [214, -96],
            [98, -136],
            [-98, -136],
        ], new Color(13, 18, 57, 240));

        this.fillPolygon(highlightLayer, [
            [-155, -60],
            [-122, 98],
            [-28, 156],
            [72, 148],
            [144, 76],
            [164, -62],
            [72, -106],
            [-74, -106],
        ], new Color(25, 33, 92, 185));

        this.fillPolygon(hornLayer, [
            [-172, 145],
            [-126, 212],
            [-72, 166],
        ], new Color(7, 9, 31, 230));

        this.fillPolygon(hornLayer, [
            [172, 145],
            [126, 212],
            [72, 166],
        ], new Color(7, 9, 31, 230));

        eyeLayer.fillColor = new Color(238, 245, 255, 255);
        eyeLayer.rect(-105, 48, 58, 34);
        eyeLayer.rect(48, 48, 58, 34);
        eyeLayer.fill();

        pupilLayer.fillColor = new Color(214, 38, 66, 255);
        pupilLayer.rect(-82, 50, 18, 30);
        pupilLayer.rect(70, 50, 18, 30);
        pupilLayer.fill();

        this.fillPolygon(mouthLayer, [
            [-86, -34],
            [-34, -58],
            [0, -48],
            [34, -58],
            [86, -34],
            [40, -88],
            [-40, -88],
        ], new Color(105, 10, 34, 245));

        for (let i = -3; i <= 3; i++) {
            const x = i * 24;
            this.fillPolygon(teethLayer, [
                [x - 7, -48],
                [x + 7, -48],
                [x, -76],
            ], new Color(246, 238, 204, 255));
        }
    }

    private addBossName(boss: Node) {
        const labelNode = new Node('BossName');
        boss.addChild(labelNode);
        labelNode.setPosition(0, 238, 0);

        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(220, 64);

        const label = labelNode.addComponent(Label);
        label.string = 'BOSS';
        label.fontSize = 42;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 62, 72, 255);
    }

    private createGraphicsLayer(parent: Node, name: string): Graphics {
        const node = new Node(name);
        parent.addChild(node);
        node.setPosition(0, 0, 0);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(520, 460);

        return node.addComponent(Graphics);
    }

    private fillPolygon(gfx: Graphics, points: [number, number][], color: Color) {
        if (points.length === 0) return;

        gfx.fillColor = color;
        gfx.moveTo(points[0][0], points[0][1]);

        for (let i = 1; i < points.length; i++) {
            gfx.lineTo(points[i][0], points[i][1]);
        }

        gfx.lineTo(points[0][0], points[0][1]);
        gfx.fill();
    }
}
