import { NextResponse } from 'next/server';
import { GameState } from '@/app/game/types';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 定义游戏数据存储路径
const GAME_DATA_FILE = join(process.cwd(), 'data', 'game', 'gameState.json');

export async function GET() {
  try {
    // 检查文件是否存在
    if (!existsSync(GAME_DATA_FILE)) {
      return NextResponse.json({ success: true, data: null });
    }

    // 读取文件内容
    const data = readFileSync(GAME_DATA_FILE, 'utf8');
    const gameState: GameState = JSON.parse(data);

    return NextResponse.json({ success: true, data: gameState });
  } catch (error) {
    console.error('加载游戏数据失败:', error);
    return NextResponse.json(
      { success: false, message: '加载游戏数据失败' },
      { status: 500 }
    );
  }
}
