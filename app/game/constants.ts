// 农场游戏常量
import { Crop } from './types';

// 作物数据
export const CROPS: Crop[] = [
  {
    id: 'wheat',
    name: '小麦',
    description: '基础作物，生长快，价值低',
    growTime: 5000, // 5秒
    value: 10,
    cost: 5,
    icon: '🌾'
  },
  {
    id: 'carrot',
    name: '胡萝卜',
    description: '常见蔬菜，生长适中，价值中等',
    growTime: 10000, // 10秒
    value: 25,
    cost: 15,
    icon: '🥕'
  },
  {
    id: 'potato',
    name: '土豆',
    description: '淀粉类作物，生长较慢，价值较高',
    growTime: 15000, // 15秒
    value: 40,
    cost: 25,
    icon: '🥔'
  },
  {
    id: 'tomato',
    name: '番茄',
    description: '水果类作物，生长慢，价值高',
    growTime: 20000, // 20秒
    value: 60,
    cost: 40,
    icon: '🍅'
  },
  {
    id: 'eggplant',
    name: '茄子',
    description: '高级蔬菜，生长很慢，价值很高',
    growTime: 30000, // 30秒
    value: 100,
    cost: 70,
    icon: '🍆'
  },
  {
    id: 'melon',
    name: '西瓜',
    description: '稀有水果，生长极慢，价值极高',
    growTime: 60000, // 1分钟
    value: 200,
    cost: 150,
    icon: '🍉'
  }
];

// 初始游戏状态
export const INITIAL_PLOTS_COUNT = 6;
export const INITIAL_COINS = 100;
export const INITIAL_UNLOCKED_CROPS = ['wheat'];

// 游戏更新间隔（毫秒）
export const GAME_UPDATE_INTERVAL = 1000;