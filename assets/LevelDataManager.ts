// assets/scripts/LevelDataManager.ts
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

interface LevelData {
    id: number;
    unlocked: boolean;
    score: number;  // 0-3颗星
    bestTime?: number;  // 最佳通关时间
}

@ccclass('LevelDataManager')
export class LevelDataManager extends Component {
    
    private static instance: LevelDataManager = null;
    private levels: LevelData[] = [];
    
    static getInstance(): LevelDataManager {
        if (!LevelDataManager.instance) {
            LevelDataManager.instance = new LevelDataManager();
        }
        return LevelDataManager.instance;
    }
    
    constructor() {
        super();
        this.loadLevelData();
    }
    
    // 加载关卡数据
    loadLevelData() {
        const saved = localStorage.getItem('game_levels');
        if (saved) {
            this.levels = JSON.parse(saved);
        } else {
            // 初始化数据
            this.levels = [
                { id: 1, unlocked: true, score: 0 },
                { id: 2, unlocked: false, score: 0 },
                { id: 3, unlocked: false, score: 0 },
                { id: 4, unlocked: false, score: 0 },
                { id: 5, unlocked: false, score: 0 },
                { id: 6, unlocked: false, score: 0 },
            ];
            this.saveLevelData();
        }
    }
    
    // 保存关卡数据
    saveLevelData() {
        localStorage.setItem('game_levels', JSON.stringify(this.levels));
    }
    
    // 解锁关卡
    unlockLevel(levelId: number) {
        const level = this.levels.find(l => l.id === levelId);
        if (level) {
            level.unlocked = true;
            this.saveLevelData();
        }
    }
    
    // 更新关卡分数
    updateLevelScore(levelId: number, score: number) {
        const level = this.levels.find(l => l.id === levelId);
        if (level && score > level.score) {
            level.score = score;
            this.saveLevelData();
        }
    }
    
    // 获取所有关卡数据
    getAllLevels(): LevelData[] {
        return [...this.levels];
    }
    
    // 获取特定关卡
    getLevel(levelId: number): LevelData | null {
        return this.levels.find(l => l.id === levelId) || null;
    }
}