import { NextResponse } from 'next/server';
import { GameState } from '@/app/game/types';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// 定义游戏数据存储路径
const DATA_DIR = join(process.cwd(), 'data', 'game');
const GAME_DATA_FILE = join(DATA_DIR, 'gameState.json');

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export async function POST(request: Request) {
  try {
    // 解析请求体中的游戏状态数据
    const gameState: GameState = await request.json();

    // 保存数据到文件
    writeFileSync(GAME_DATA_FILE, JSON.stringify(gameState, null, 2), 'utf8');

    return NextResponse.json({ success: true, message: '游戏数据已保存' });
  } catch (error) {
    console.error('保存游戏数据失败:', error);
    return NextResponse.json(
      { success: false, message: '保存游戏数据失败' },
      { status: 500 }
    );
  }
}
