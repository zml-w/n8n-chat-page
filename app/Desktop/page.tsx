'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Calendar, Clock, Book, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// 类型定义
type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

type Countdown = {
  id: string;
  title: string;
  date: string;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

const DesktopPage = () => {
  // 状态管理
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [newCountdown, setNewCountdown] = useState<{ title: string; date: string }>({ title: '', date: '' });
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // 实时时钟
  useEffect(() => {
    // 设置初始时间
    setCurrentTime(new Date());
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 加载本地存储数据
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) setTodos(JSON.parse(savedTodos));

    const savedCountdowns = localStorage.getItem('countdowns');
    if (savedCountdowns) setCountdowns(JSON.parse(savedCountdowns));

    const savedNotes = localStorage.getItem('notes');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  // 保存到本地存储
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem('countdowns', JSON.stringify(countdowns));
  }, [countdowns]);

  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
  }, [notes]);

  // 今日待办功能
  const addTodo = () => {
    if (newTodo.trim()) {
      setTodos([...todos, { id: Date.now().toString(), text: newTodo, completed: false }]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  // 倒数日功能
  const addCountdown = () => {
    if (newCountdown.title.trim() && newCountdown.date) {
      setCountdowns([...countdowns, { id: Date.now().toString(), ...newCountdown }]);
      setNewCountdown({ title: '', date: '' });
    }
  };

  const deleteCountdown = (id: string) => {
    setCountdowns(countdowns.filter(countdown => countdown.id !== id));
  };

  const calculateDaysLeft = (date: string) => {
    const targetDate = new Date(date);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // 笔记本功能
  const addNote = () => {
    if (newNote.title.trim() && newNote.content.trim()) {
      setNotes([...notes, { id: Date.now().toString(), ...newNote, createdAt: new Date().toISOString() }]);
      setNewNote({ title: '', content: '' });
    }
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  // 可编辑标题状态
  const [editingTitle, setEditingTitle] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('My Dashboard');

  // 双击编辑标题
  const handleDoubleClick = () => {
    setEditingTitle(true);
  };

  // 失去焦点时保存标题
  const handleBlur = () => {
    setEditingTitle(false);
  };

  // 按回车键保存标题
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingTitle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {editingTitle ? (
            <Input
              value={dashboardTitle}
              onChange={(e) => setDashboardTitle(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 border-0 focus-visible:ring-0"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
              onDoubleClick={handleDoubleClick}
            >
              {dashboardTitle}
            </h1>
          )}
          <div className="flex items-center gap-4">
            <div className="text-lg font-mono text-gray-700 dark:text-gray-300">
              {currentTime ? currentTime.toLocaleTimeString() : '00:00:00'}
            </div>
            <Button
              onClick={() => window.location.href = '/chat'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              进入聊天UI
            </Button>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="todos" className="w-full">
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger value="todos" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              今日待办
            </TabsTrigger>
            <TabsTrigger value="countdowns" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              倒数日
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              笔记本
            </TabsTrigger>
            <TabsTrigger value="clock" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              时钟
            </TabsTrigger>
          </TabsList>

          {/* 今日待办标签页 */}
          <TabsContent value="todos" className="space-y-4">
            <Card className="p-6">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="添加新的待办事项..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                />
                <Button onClick={addTodo}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div key={todo.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleTodo(todo.id)}
                        className={todo.completed ? 'text-green-500' : 'text-gray-400'}
                      >
                        <Check className={`h-4 w-4 ${todo.completed ? 'block' : 'hidden'}`} />
                        <div className={`h-4 w-4 rounded-full border-2 ${todo.completed ? 'border-green-500' : 'border-gray-300 dark:border-gray-600'}`}></div>
                      </Button>
                      <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                        {todo.text}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTodo(todo.id)}
                      className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {todos.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    暂无待办事项，添加一个新的开始吧！
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* 倒数日标签页 */}
          <TabsContent value="countdowns" className="space-y-4">
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Input
                  placeholder="倒数日标题..."
                  value={newCountdown.title}
                  onChange={(e) => setNewCountdown({ ...newCountdown, title: e.target.value })}
                />
                <Input
                  type="date"
                  value={newCountdown.date}
                  onChange={(e) => setNewCountdown({ ...newCountdown, date: e.target.value })}
                />
              </div>
              <Button onClick={addCountdown} className="mb-4">
                <Plus className="mr-2 h-4 w-4" />
                添加倒数日
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {countdowns.map((countdown) => (
                  <div key={countdown.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{countdown.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCountdown(countdown.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {new Date(countdown.date).toLocaleDateString()}
                    </p>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {calculateDaysLeft(countdown.date)} 天
                    </div>
                  </div>
                ))}
                {countdowns.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8 col-span-2">
                    暂无倒数日，添加一个新的开始吧！
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* 笔记本标签页 */}
          <TabsContent value="notes" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-2 mb-4">
                <Input
                  placeholder="笔记标题..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                />
                <Textarea
                  placeholder="笔记内容..."
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  className="min-h-[100px]"
                />
                <Button onClick={addNote} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  保存笔记
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{note.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNote(note.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                      {note.content}
                    </p>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8 col-span-2">
                    暂无笔记，添加一个新的开始吧！
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* 时钟标签页 */}
          <TabsContent value="clock" className="space-y-4">
            <Card className="p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-6xl font-mono text-gray-800 dark:text-gray-200 mb-4">
                  {currentTime ? currentTime.toLocaleTimeString() : '00:00:00'}
                </div>
                <div className="text-2xl text-gray-600 dark:text-gray-400">
                  {currentTime ? currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : '加载中...'}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* 底部导航栏 */}
      <footer className="sticky bottom-0 z-50 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-3 flex justify-center gap-4">
          <Button
            onClick={() => window.location.href = '/chat'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            聊天UI
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default DesktopPage;