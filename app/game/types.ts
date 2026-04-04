// 农场游戏类型定义
export interface Crop {
  id: string;
  name: string;
  description: string;
  growTime: number; // 生长时间（毫秒）
  value: number; // 收获价值
  cost: number; // 种植成本
  icon: string;
}

export interface Plot {
  id: number;
  crop: Crop | null;
  plantedAt: number | null;
  readyAt: number | null;
  isHarvestable: boolean;
}

export interface Player {
  coins: number;
  plots: Plot[];
  unlockedCrops: string[];
}

export interface GameState {
  player: Player;
  crops: Crop[];
  lastUpdate: number;
}