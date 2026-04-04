'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { GameState, Crop } from './types';
import { initializeGameState, updateGameState, plantCrop, harvestCrop, unlockCrop, getAvailableCrops, getHarvestableCount } from './gameLogic';
import { GAME_UPDATE_INTERVAL } from './constants';

const FarmGame: React.FC = () => {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string>('wheat');
  const [loading, setLoading] = useState<boolean>(true);
  
  // 使用ref保存最新的游戏状态引用
  const gameStateRef = React.useRef<GameState | null>(null);
  
  // 更新ref中的游戏状态
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 返回聊天UI
  const handleBackToChat = async () => {
    // 保存当前游戏状态
    if (gameState) {
      await saveGameData(gameState);
    }
    // 导航回聊天页面
    router.push('/');
  };

  // 加载游戏数据
  const loadGameData = useCallback(async () => {
    try {
      const response = await fetch('/api/game/load');
      const data = await response.json();
      if (data.success && data.data) {
        setGameState(data.data);
      } else {
        setGameState(initializeGameState());
      }
    } catch (error) {
      console.error('加载游戏数据失败:', error);
      setGameState(initializeGameState());
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存游戏数据
  const saveGameData = useCallback(async (state: GameState) => {
    try {
      await fetch('/api/game/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state),
      });
    } catch (error) {
      console.error('保存游戏数据失败:', error);
    }
  }, []);

  // 加载游戏数据
  useEffect(() => {
    loadGameData();
  }, [loadGameData]);

  // 游戏定时任务管理
  useEffect(() => {
    console.log('启动游戏定时任务');
    
    // 定义常量
    const AUTO_SAVE_INTERVAL = 30000; // 30秒
    
    // 立即保存一次游戏数据
    if (gameStateRef.current) {
      saveGameData(gameStateRef.current);
    }
    
    // 作物生长定时器
    const growthInterval = setInterval(() => {
      setGameState(prev => {
        if (!prev) return prev;
        return updateGameState(prev);
      });
    }, GAME_UPDATE_INTERVAL);
    
    // 自动保存定时器
    const saveInterval = setInterval(() => {
      console.log('执行自动保存');
      if (gameStateRef.current) {
        saveGameData(gameStateRef.current);
      }
    }, AUTO_SAVE_INTERVAL);

    // 清理函数
    return () => {
      console.log('清理游戏定时任务');
      clearInterval(growthInterval);
      clearInterval(saveInterval);
    };
  }, [saveGameData]);

  // 种植作物处理函数
  const handlePlant = useCallback((plotId: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = plantCrop(prev, plotId, selectedCrop);
      return newState || prev;
    });
  }, [selectedCrop]);

  // 收获作物处理函数
  const handleHarvest = useCallback((plotId: number) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = harvestCrop(prev, plotId);
      return newState || prev;
    });
  }, []);

  // 解锁作物处理函数
  const handleUnlockCrop = useCallback((cropId: string) => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = unlockCrop(prev, cropId);
      return newState || prev;
    });
  }, []);

  // 获取可用作物
  const availableCrops = gameState ? getAvailableCrops(gameState) : [];
  // 获取可收获的作物数量
  const harvestableCount = gameState ? getHarvestableCount(gameState) : 0;

  // 计算作物生长进度
  const getGrowthProgress = (readyAt: number | null, plantedAt: number | null): number => {
    if (!readyAt || !plantedAt) return 0;
    
    const now = Date.now();
    const total = readyAt - plantedAt;
    const elapsed = now - plantedAt;
    
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex justify-start mb-4">
        <Button onClick={handleBackToChat} variant="outline">
          ← 返回聊天
        </Button>
      </div>
      <h1 className="text-3xl font-bold text-center mb-6">🏡 挂机农场</h1>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">加载中...</div>
        </div>
      ) : gameState ? (
        <>
          {/* 玩家信息栏 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>玩家信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="text-xl">💰 金币: {gameState.player.coins}</div>
                <div className="text-lg">🎯 可收获: {harvestableCount}</div>
              </div>
            </CardContent>
          </Card>

          {/* 种植选择区 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>种植作物</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Select value={selectedCrop} onValueChange={setSelectedCrop}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="选择作物" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCrops.map(crop => (
                      <SelectItem key={crop.id} value={crop.id}>
                        <span className="mr-2">{crop.icon}</span>
                        {crop.name} - 成本: {crop.cost} 金币
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  {availableCrops.find(c => c.id === selectedCrop) && (
                    <div className="p-2 bg-muted rounded">
                      <div className="font-semibold">
                        {availableCrops.find(c => c.id === selectedCrop)?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {availableCrops.find(c => c.id === selectedCrop)?.description}
                      </div>
                      <div className="text-sm mt-1">
                        生长时间: {(availableCrops.find(c => c.id === selectedCrop)?.growTime || 0) / 1000} 秒
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 农场地块区 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>农场地块</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {gameState.player.plots.map(plot => (
                  <div
                    key={plot.id}
                    className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center"
                  >
                    {plot.crop ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="text-4xl mb-2">{plot.crop.icon}</div>
                        <div className="text-sm font-semibold">{plot.crop.name}</div>
                        
                        {plot.isHarvestable ? (
                          <div className="mt-2">
                            <Button
                              onClick={() => handleHarvest(plot.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              收获 (+{plot.crop.value} 金币)
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full mt-2">
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${getGrowthProgress(plot.readyAt, plot.plantedAt)}%` }}
                              />
                            </div>
                            <div className="text-xs text-center mt-1">
                              生长中...
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handlePlant(plot.id)}
                        disabled={!gameState.crops.find(c => c.id === selectedCrop) || gameState.player.coins < (gameState.crops.find(c => c.id === selectedCrop)?.cost || 0)}
                        className="w-full h-full flex flex-col items-center justify-center"
                      >
                        <div className="text-2xl mb-1">🌱</div>
                        种植 {gameState.crops.find(c => c.id === selectedCrop)?.name}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 解锁作物区 */}
          <Card>
            <CardHeader>
              <CardTitle>解锁新作物</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {gameState.crops.map(crop => {
                  const isUnlocked = gameState.player.unlockedCrops.includes(crop.id);
                  const unlockCost = crop.cost * 5;
                  
                  return (
                    <div
                      key={crop.id}
                      className={`p-4 border rounded-lg transition-all ${isUnlocked ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-gray-300 dark:border-gray-700'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-3xl mr-3">{crop.icon}</span>
                          <div>
                            <div className="font-semibold">{crop.name}</div>
                            <div className="text-xs text-muted-foreground">{crop.description}</div>
                          </div>
                        </div>
                        {isUnlocked ? (
                          <span className="text-green-600 dark:text-green-400 font-semibold">已解锁</span>
                        ) : (
                          <Button
                            onClick={() => handleUnlockCrop(crop.id)}
                            disabled={gameState.player.coins < unlockCost}
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            解锁 ({unlockCost} 金币)
                          </Button>
                        )}
                      </div>
                      {isUnlocked && (
                        <div className="mt-2 text-sm">
                          <div>💰 种植成本: {crop.cost} 金币</div>
                          <div>⏱️ 生长时间: {crop.growTime / 1000} 秒</div>
                          <div>💎 收获价值: {crop.value} 金币</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">加载失败，请刷新页面重试</div>
        </div>
      )}
    </div>
  );
};

export default FarmGame;