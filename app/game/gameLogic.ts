// 农场游戏核心逻辑
import { Player, Plot, Crop, GameState } from './types';
import { CROPS, INITIAL_PLOTS_COUNT, INITIAL_COINS, INITIAL_UNLOCKED_CROPS } from './constants';

// 初始化玩家数据
export const initializePlayer = (): Player => {
  const plots: Plot[] = [];
  for (let i = 0; i < INITIAL_PLOTS_COUNT; i++) {
    plots.push({
      id: i,
      crop: null,
      plantedAt: null,
      readyAt: null,
      isHarvestable: false
    });
  }

  return {
    coins: INITIAL_COINS,
    plots,
    unlockedCrops: INITIAL_UNLOCKED_CROPS
  };
};

// 初始化游戏状态
export const initializeGameState = (): GameState => {
  return {
    player: initializePlayer(),
    crops: CROPS,
    lastUpdate: Date.now()
  };
};

// 更新游戏状态（处理作物生长）
export const updateGameState = (state: GameState): GameState => {
  const now = Date.now();
  const updatedPlots = state.player.plots.map(plot => {
    if (!plot.crop || !plot.readyAt) return plot;

    const isHarvestable = now >= plot.readyAt;
    return {
      ...plot,
      isHarvestable
    };
  });

  return {
    ...state,
    player: {
      ...state.player,
      plots: updatedPlots
    },
    lastUpdate: now
  };
};

// 种植作物
export const plantCrop = (state: GameState, plotId: number, cropId: string): GameState | null => {
  const crop = state.crops.find(c => c.id === cropId);
  if (!crop) return null;

  if (state.player.coins < crop.cost) return null;

  const plotIndex = state.player.plots.findIndex(p => p.id === plotId);
  if (plotIndex === -1) return null;

  const plot = state.player.plots[plotIndex];
  if (plot.crop) return null;

  const now = Date.now();
  const updatedPlots = [...state.player.plots];
  updatedPlots[plotIndex] = {
    ...plot,
    crop,
    plantedAt: now,
    readyAt: now + crop.growTime,
    isHarvestable: false
  };

  return {
    ...state,
    player: {
      ...state.player,
      coins: state.player.coins - crop.cost,
      plots: updatedPlots
    },
    lastUpdate: now
  };
};

// 收获作物
export const harvestCrop = (state: GameState, plotId: number): GameState | null => {
  const plotIndex = state.player.plots.findIndex(p => p.id === plotId);
  if (plotIndex === -1) return null;

  const plot = state.player.plots[plotIndex];
  if (!plot.crop || !plot.isHarvestable) return null;

  const updatedPlots = [...state.player.plots];
  updatedPlots[plotIndex] = {
    ...plot,
    crop: null,
    plantedAt: null,
    readyAt: null,
    isHarvestable: false
  };

  return {
    ...state,
    player: {
      ...state.player,
      coins: state.player.coins + plot.crop.value,
      plots: updatedPlots
    },
    lastUpdate: Date.now()
  };
};

// 解锁新作物
export const unlockCrop = (state: GameState, cropId: string): GameState | null => {
  const crop = state.crops.find(c => c.id === cropId);
  if (!crop) return null;

  if (state.player.unlockedCrops.includes(cropId)) return null;

  if (state.player.coins < crop.cost * 5) return null;

  return {
    ...state,
    player: {
      ...state.player,
      coins: state.player.coins - crop.cost * 5,
      unlockedCrops: [...state.player.unlockedCrops, cropId]
    },
    lastUpdate: Date.now()
  };
};

// 获取玩家可用的作物
export const getAvailableCrops = (state: GameState): Crop[] => {
  return state.crops.filter(crop => state.player.unlockedCrops.includes(crop.id));
};

// 获取可收获的地块数量
export const getHarvestableCount = (state: GameState): number => {
  return state.player.plots.filter(plot => plot.isHarvestable).length;
};

// 自动收获所有可收获的作物
export const autoHarvestAll = (state: GameState): GameState => {
  let updatedState = { ...state };
  let hasChanges = false;

  for (const plot of updatedState.player.plots) {
    if (plot.isHarvestable) {
      const result = harvestCrop(updatedState, plot.id);
      if (result) {
        updatedState = result;
        hasChanges = true;
      }
    }
  }

  return hasChanges ? updatedState : state;
};