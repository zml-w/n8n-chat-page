'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, PanelBottom, PanelRight, Monitor, Trash2, Edit2, Plus, Code, ArrowLeft, Check, RefreshCcw } from 'lucide-react'
import { ComfyUIConfig, ComfyUIWorkflow } from './types'
import { executeComfyUIWorkflow, saveComfyUIWorkflow, loadComfyUITagFiles, loadComfyUITagFileContent, loadComfyUIPromptCompletionFile, saveComfyUIConfig } from './actions'

// --- JSON编辑器独立组件 ---
interface JsonEditorPanelProps {
  workflowJson: string
  setWorkflowJson: (value: string) => void
  setRightPanelMode: (mode: 'images' | 'json' | 'presets') => void
  handleSaveJson: () => Promise<void>
}

const JsonEditorPanel: React.FC<JsonEditorPanelProps> = ({ 
  workflowJson, 
  setWorkflowJson, 
  setRightPanelMode, 
  handleSaveJson 
}) => (
  <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-3 border-b bg-muted/10 shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
              <Code className="h-4 w-4" /> 编辑工作流 JSON
          </h3>
          <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRightPanelMode('images')}>取消</Button>
              <Button size="sm" onClick={handleSaveJson}>保存更改</Button>
          </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
          <textarea
              value={workflowJson}
              onChange={(e) => setWorkflowJson(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-[#1e1e1e] text-[#d4d4d4]"
              spellCheck={false}
          />
      </div>
  </div>
)

interface ComfyUIOperationProps {
  config: ComfyUIConfig
  selectedWorkflow: ComfyUIWorkflow | null
  onBack?: () => void
}

const ComfyUIOperation: React.FC<ComfyUIOperationProps> = ({ config, selectedWorkflow, onBack }) => {
  // --- 布局状态 ---
  const [layoutMode, setLayoutMode] = useState<'bottom' | 'side'>('side')
  
  // --- 右侧面板显示模式 ---
  const [rightPanelMode, setRightPanelMode] = useState<'images' | 'json' | 'presets'>('images')

  const [currentWorkflow, setCurrentWorkflow] = useState<ComfyUIWorkflow | null>(selectedWorkflow)
  
  useEffect(() => {
    setCurrentWorkflow(selectedWorkflow)
    if (selectedWorkflow) {
        setSaveGeneratedImages(selectedWorkflow.saveImages || false)
    }
  }, [selectedWorkflow])
  
  const [prompt, setPrompt] = useState('')
  const [width, setWidth] = useState(512)
  const [height, setHeight] = useState(512)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  
  // JSON Editor State
  const [workflowJson, setWorkflowJson] = useState('')
  
  // Resolution & Preset State
  const [resolution, setResolution] = useState('512x512')
  const [isSeedRandom, setIsSeedRandom] = useState(true)
  const [seed, setSeed] = useState(Math.floor(Math.random() * 1000000000))
  const [customResolutions, setCustomResolutions] = useState<Map<string, {width: number, height: number}>>(new Map([
    ['832x1216', {width: 832, height: 1216}],
    ['1024x1024', {width: 1024, height: 1024}],
    ['1216x832', {width: 1216, height: 832}],
    ['512x512', {width: 512, height: 512}]
  ]))
  
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingWorkflowName, setEditingWorkflowName] = useState(currentWorkflow?.name || '')
  
  // Preset Editor Temp State
  const [newPresetW, setNewPresetW] = useState('')
  const [newPresetH, setNewPresetH] = useState('')
  
  const [saveGeneratedImages, setSaveGeneratedImages] = useState(currentWorkflow?.saveImages || false)
  const [tagFiles, setTagFiles] = useState<string[]>([])
  const [selectedTagFile, setSelectedTagFile] = useState<string>('')
  const [tagFileContents, setTagFileContents] = useState<string[]>([])

  // 搜索相关状态
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false)
  const [promptCompletionData, setPromptCompletionData] = useState<string[]>([])
  
  // 搜索相关引用
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // 加载tag文件
  useEffect(() => {
    const fetchTagFiles = async () => {
      const result = await loadComfyUITagFiles()
      if (result.success) {
        setTagFiles(result.data)
        if (result.data.length > 0) {
          setSelectedTagFile(result.data[0])
          const contentResult = await loadComfyUITagFileContent(result.data[0])
          if (contentResult.success) {
            setTagFileContents(contentResult.data)
          }
        }
      }
    }
    fetchTagFiles()
  }, [])

  // 加载提示词补全文件
  useEffect(() => {
    const fetchPromptCompletionFile = async () => {
      const result = await loadComfyUIPromptCompletionFile()
      if (result.success) {
        setPromptCompletionData(result.data)
      }
    }
    fetchPromptCompletionFile()
  }, [])

  // 监听点击事件，实现失去焦点关闭搜索列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const handleTagFileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFile = e.target.value
    setSelectedTagFile(selectedFile)
    if (selectedFile) {
      const contentResult = await loadComfyUITagFileContent(selectedFile)
      if (contentResult.success) {
        setTagFileContents(contentResult.data)
      } else {
        setTagFileContents([])
      }
    } else {
      setTagFileContents([])
    }
  }

  // 搜索提示词功能
  // 添加搜索防抖引用
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setSearchInput(input)
    
    if (input.trim() === '') {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    
    // 清除之前的搜索超时
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // 设置新的搜索超时，延迟300ms执行搜索
    searchTimeoutRef.current = setTimeout(() => {
      // 在提示词数据中搜索
      const results = promptCompletionData.filter(line => {
        // 支持中英文搜索
        const lowerInput = input.toLowerCase()
        return line.toLowerCase().includes(lowerInput)
      })
      
      // 排序：中文在前，英文在后
      const sortedResults = results.sort((a, b) => {
        const hasChineseA = /[\u4e00-\u9fa5]/.test(a)
        const hasChineseB = /[\u4e00-\u9fa5]/.test(b)
        
        if (hasChineseA && !hasChineseB) return -1
        if (!hasChineseA && hasChineseB) return 1
        return 0
      })
      
      // 限制搜索结果数量为前50条，避免渲染过多DOM元素
      setSearchResults(sortedResults.slice(0, 50))
      setShowSearchResults(true)
    }, 300)
  }

  // 选择搜索结果
  const handleSelectSearchResult = (result: string) => {
    // 将选择的提示词添加到当前提示词的末尾
    setPrompt(prev => prev ? `${prev}, ${result}` : result)
    setSearchInput('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  const handleRandomTag = () => {
    if (tagFileContents.length === 0) return
    const randomIndex = Math.floor(Math.random() * tagFileContents.length)
    const randomTag = tagFileContents[randomIndex]
    setPrompt(prev => prev ? `${prev}\n${randomTag}` : randomTag)
  }

  const handleClearPrompt = () => setPrompt('')

  const handleCopyPrompt = async () => {
    if (prompt) {
      await navigator.clipboard.writeText(prompt)
    }
  }

  // 切换到 JSON 编辑模式
  const handleOpenJsonEditor = () => {
    setWorkflowJson(currentWorkflow?.originalContent || JSON.stringify(currentWorkflow?.content, null, 2))
    setRightPanelMode('json')
  }

  // 保存 JSON
  const handleSaveJson = async () => {
    try {
        const c = JSON.parse(workflowJson);
        const u = {...currentWorkflow!, content: c, originalContent: workflowJson, saveImages: saveGeneratedImages};
        await saveComfyUIWorkflow(u);
        setCurrentWorkflow(u);
        setRightPanelMode('images');
        setError(null);
    } catch(e) { 
        setError('JSON 格式错误'); 
    }
  }

  const handleGenerate = async () => {
    if (!currentWorkflow) {
      setError('请先选择一个工作流')
      return
    }

    // 确保我们在生成时看到图像
    setRightPanelMode('images')
    setIsGenerating(true)
    setError(null)

    try {
      const currentSeed = isSeedRandom ? Math.floor(Math.random() * 1000000000) : seed
      setSeed(currentSeed)
      
      const result = await executeComfyUIWorkflow(config, currentWorkflow, { prompt, width, height, seed: currentSeed }, saveGeneratedImages)
      
      if (result.success && result.data?.images && result.data.images.length > 0) {
        setGeneratedImages(result.data.images)
      } else {
        setError(result.error || '生成图像时发生错误，请重试')
      }
    } catch (err) {
      setError('生成图像时发生意外错误，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 8) {
      setWidth(value)
      const newResolution = `${value}x${height}`
      setResolution(newResolution)
      if (!customResolutions.has(newResolution)) {
        const newResolutions = new Map(customResolutions)
        newResolutions.set(newResolution, { width: value, height })
        setCustomResolutions(newResolutions)
      }
    }
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 8) {
      setHeight(value)
      const newResolution = `${width}x${value}`
      setResolution(newResolution)
      if (!customResolutions.has(newResolution)) {
        const newResolutions = new Map(customResolutions)
        newResolutions.set(newResolution, { width, height: value })
        setCustomResolutions(newResolutions)
      }
    }
  }

  // --- 右侧内容组件：图片列表 ---
  const ImageViewer = () => (
    <div className={`relative h-full w-full flex flex-col justify-center overflow-hidden bg-slate-50/50 dark:bg-slate-900/50`}>
        {isGenerating && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="font-medium text-lg animate-pulse">正在生成图像...</p>
                <p className="text-sm text-muted-foreground mt-2">请稍候，ComfyUI 正在处理</p>
            </div>
        )}

        {generatedImages.length > 0 ? (
            <div className="p-4 h-full overflow-y-auto w-full">
                <div className="space-y-6 w-full">
                    {generatedImages.map((image, index) => (
                        <Card key={`image-${index}`} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="relative group">
                                <img
                                    src={image}
                                    alt={`Generated ${index + 1}`}
                                    className="w-full h-auto object-contain bg-slate-50 dark:bg-slate-900 max-h-[800px]"
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        ) : (
            !isGenerating && (
                <div className="text-center text-muted-foreground p-8">
                    <Monitor className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>暂无生成结果</p>
                    <p className="text-xs mt-1">在左侧配置参数并点击“生成图像”</p>
                </div>
            )
        )}
    </div>
  )

  // --- 右侧内容组件：预设管理 ---
  const PresetsManagerPanel = () => (
    <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between p-3 border-b bg-muted/10 shrink-0">
            <h3 className="font-semibold flex items-center gap-2">
                <Monitor className="h-4 w-4" /> 分辨率预设管理
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setRightPanelMode('images')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> 返回
            </Button>
        </div>
        
        <div className="p-4 border-b bg-muted/5">
            <Label className="text-xs mb-2 block font-medium">添加新预设</Label>
            <div className="flex gap-2 items-center">
                <Input placeholder="宽" type="number" value={newPresetW} onChange={e=>setNewPresetW(e.target.value)} className="flex-1 h-8" />
                <span className="text-muted-foreground">x</span>
                <Input placeholder="高" type="number" value={newPresetH} onChange={e=>setNewPresetH(e.target.value)} className="flex-1 h-8" />
                <Button size="sm" onClick={() => {
                    if(newPresetW && newPresetH) {
                        const k = `${newPresetW}x${newPresetH}`;
                        setCustomResolutions(new Map(customResolutions.set(k, {width:+newPresetW, height:+newPresetH})));
                        setNewPresetW(''); setNewPresetH('');
                    }
                }}><Plus className="h-4 w-4 mr-1" />添加</Button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {Array.from(customResolutions.entries()).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
                    <span className="font-mono text-sm font-medium">{key}</span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                        onClick={() => {
                            const newMap = new Map(customResolutions);
                            newMap.delete(key);
                            setCustomResolutions(newMap);
                            if(resolution === key) {
                                setResolution('512x512'); setWidth(512); setHeight(512);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full">
      {error && (
        <div className="px-4 pt-2">
            <Alert variant="destructive" className="py-2">
            <AlertTitle className="text-xs font-bold">错误</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
        </div>
      )}

      {/* --- 内容区域 --- */}
      <div className={`p-4 flex-1 overflow-hidden ${layoutMode === 'side' ? "flex gap-4" : "flex flex-col gap-4 overflow-y-auto"}`}>
        
        {/* 左侧/上方：参数配置区 */}
        <div className={`${layoutMode === 'side' ? 'w-[400px] shrink-0 h-full flex flex-col' : 'w-full shrink-0'}`}>
            <Card className={`flex flex-col ${layoutMode === 'side' ? 'h-full' : ''} shadow-sm`}>
                {/* 紧凑的头部区域 - 优化空白 */}
                <CardHeader className="py-2 px-4 shrink-0 space-y-1.5">
                    {/* 第一行：返回按钮 + 标题 + 重命名 */}
                    <div className="flex items-center gap-2 overflow-hidden h-7">
                        {/* 返回按钮 */}
                        {onBack && (
                            <Button size="icon" variant="outline" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={onBack}>
                                <ArrowLeft className="h-3 w-3" />
                            </Button>
                        )}
                        
                        {isEditingName ? (
                            <div className="flex items-center gap-1 flex-1">
                                <Input
                                    value={editingWorkflowName}
                                    onChange={(e) => setEditingWorkflowName(e.target.value)}
                                    className="h-6 w-full text-sm"
                                    autoFocus
                                />
                                <Button size="icon" className="h-6 w-6" onClick={async () => {
                                    if (currentWorkflow) {
                                        const updated = { ...currentWorkflow, name: editingWorkflowName, saveImages: saveGeneratedImages }
                                        await saveComfyUIWorkflow(updated)
                                        setCurrentWorkflow(updated)
                                    }
                                    setIsEditingName(false)
                                }}><Check className="h-3 w-3" /></Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 w-full">
                                <CardTitle className="text-base truncate flex-1" title={currentWorkflow?.name}>
                                    {currentWorkflow ? currentWorkflow.name : '未选择工作流'}
                                </CardTitle>
                                {currentWorkflow && (
                                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => {
                                        setEditingWorkflowName(currentWorkflow.name); setIsEditingName(true)
                                    }}>
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 第二行：工具栏 (布局、JSON、保存) - 紧凑排列 */}
                    {selectedWorkflow && (
                    <div className="flex justify-between items-center pt-1">
                        <div className="flex items-center gap-2">
                             {/* 布局切换 */}
                             <div className="flex items-center border rounded-md bg-muted/30 p-0.5">
                                <button
                                    onClick={() => setLayoutMode('bottom')}
                                    className={`p-1 rounded-sm transition-all ${layoutMode === 'bottom' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="上下布局"
                                >
                                    <PanelBottom className="h-3.5 w-3.5" />
                                </button>
                                <div className="w-px h-3 bg-border mx-0.5"></div>
                                <button
                                    onClick={() => setLayoutMode('side')}
                                    className={`p-1 rounded-sm transition-all ${layoutMode === 'side' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    title="左右布局"
                                >
                                    <PanelRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* JSON 编辑按钮 */}
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`h-6 px-2 text-xs ${rightPanelMode === 'json' ? 'bg-primary/10 text-primary' : ''}`}
                                onClick={handleOpenJsonEditor}
                            >
                                <Code className="h-3 w-3 mr-1.5" />
                                编辑JSON
                            </Button>
                        </div>

                        {/* 保存图片开关 */}
                        <div className="flex items-center gap-2">
                            <Switch
                                id="save-img"
                                className="scale-75 origin-right"
                                checked={saveGeneratedImages}
                                onCheckedChange={async (c) => {
                                    setSaveGeneratedImages(c);
                                    if(currentWorkflow) {
                                        const u = {...currentWorkflow, saveImages: c};
                                        setCurrentWorkflow(u);
                                        await saveComfyUIWorkflow(u)
                                    }
                                }}
                            />
                            <Label htmlFor="save-img" className="text-xs font-normal cursor-pointer whitespace-nowrap">
                                保存生成图像
                            </Label>
                        </div>
                    </div>
                    )}
                </CardHeader>
                
                {/* 参数内容区 */}
                <CardContent className={`space-y-2 overflow-y-auto px-4 pb-4 ${layoutMode === 'side' ? 'flex-1 flex flex-col' : ''}`}>
                    {/* 提示词 */}
                    <div className="space-y-1.5 flex-1 flex flex-col">
                        {/* 标题和搜索框在同一行 */}
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-semibold text-muted-foreground">提示词</Label>
                            {/* 搜索输入框 */}
                        <div className="relative" ref={searchContainerRef}>
                                <Input
                                    type="text"
                                    value={searchInput}
                                    onChange={handleSearchInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            // 如果有防抖定时器，先清除它
                                            if (searchTimeoutRef.current) {
                                                clearTimeout(searchTimeoutRef.current)
                                            }
                                            // 立即执行搜索
                                            const input = searchInput
                                            if (input.trim() !== '') {
                                                const results = promptCompletionData.filter(line => {
                                                    const lowerInput = input.toLowerCase()
                                                    return line.toLowerCase().includes(lowerInput)
                                                })
                                                const sortedResults = results.sort((a, b) => {
                                                    const hasChineseA = /[\u4e00-\u9fa5]/.test(a)
                                                    const hasChineseB = /[\u4e00-\u9fa5]/.test(b)
                                                    if (hasChineseA && !hasChineseB) return -1
                                                    if (!hasChineseA && hasChineseB) return 1
                                                    return 0
                                                })
                                                setSearchResults(sortedResults.slice(0, 50))
                                                setShowSearchResults(true)
                                            }
                                        }
                                    }}
                                    placeholder="搜索标签..."
                                    className="w-48 h-7 text-xs px-2 pr-6 border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                                {/* 搜索结果下拉菜单 */}
                                {showSearchResults && searchResults.length > 0 && (
                                    <div className="absolute right-0 top-full mt-1 w-full max-h-60 overflow-y-auto bg-background border border-input rounded-md shadow-lg z-10">
                                        {searchResults.map((result, index) => {
                                            // 分割中文和英文部分
                                            const [chinese, english] = result.split(',');
                                            // 判断中文部分的长度，超过7个字符才允许换行
                                            const isLongText = chinese.length > 7;
                                            return (
                                                <div
                                                    key={index}
                                                    className="px-2 py-1 text-xs cursor-pointer hover:bg-muted flex flex-wrap items-center gap-1"
                                                    onClick={() => handleSelectSearchResult(result)}
                                                >
                                                    {/* 中文部分添加标签边框，超过7个字符才换行 */}
                                                    <span 
                                                        className={`px-1 py-0.5 border border-primary/50 rounded text-primary ${isLongText ? 'whitespace-normal' : 'whitespace-nowrap'}`}
                                                    >
                                                        {chinese}
                                                    </span>
                                                    {/* 英文部分 */}
                                                    <span className="text-muted-foreground">
                                                        {english}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* 提示词输入框 */}
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="输入提示词..."
                            className="w-full min-h-[100px] flex-1 p-2 text-sm border border-input rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                            spellCheck={false}
                        />
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedTagFile}
                                onChange={handleTagFileChange}
                                className="flex-1 h-7 text-xs border border-input rounded-md bg-background px-1"
                            >
                                <option value="">选择tag文件</option>
                                {tagFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleRandomTag} disabled={!selectedTagFile}>
                                随机Tag
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleClearPrompt}>清空</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCopyPrompt} disabled={!prompt}>
                                复制
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        {/* 分辨率 */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-semibold text-muted-foreground">分辨率</Label>
                                <Button 
                                    variant="link" 
                                    size="sm" 
                                    className={`h-auto p-0 text-xs ${rightPanelMode === 'presets' ? 'text-primary font-bold' : 'text-primary'}`}
                                    onClick={() => setRightPanelMode('presets')}
                                >
                                    管理预设
                                </Button>
                            </div>
                            <select
                                value={resolution}
                                onChange={(e) => {
                                    const v = e.target.value; setResolution(v);
                                    const r = customResolutions.get(v);
                                    if(r) { setWidth(r.width); setHeight(r.height); }
                                }}
                                className="w-full h-8 px-2 text-sm border border-input rounded-md bg-background"
                            >
                                {Array.from(customResolutions.keys()).map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">宽</span>
                                    <Input type="number" value={width} onChange={handleWidthChange} className="pl-6 h-7 text-xs" />
                                </div>
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground">高</span>
                                    <Input type="number" value={height} onChange={handleHeightChange} className="pl-6 h-7 text-xs" />
                                </div>
                            </div>
                        </div>

                        {/* 随机种 */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">随机种 (Seed)</Label>
                            <div className="flex gap-2">
                                <div className="flex bg-muted rounded-md p-0.5 shrink-0 h-8 items-center">
                                    <button onClick={() => setIsSeedRandom(true)} className={`px-2 py-0.5 text-xs rounded-sm transition-all h-full ${isSeedRandom ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>随机</button>
                                    <button onClick={() => setIsSeedRandom(false)} className={`px-2 py-0.5 text-xs rounded-sm transition-all h-full ${!isSeedRandom ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>固定</button>
                                </div>
                                <div className="relative flex-1">
                                     <Input 
                                        type="number" 
                                        value={seed} 
                                        onChange={(e) => { setSeed(parseInt(e.target.value) || 0); setIsSeedRandom(false); }}
                                        className="font-mono h-8 text-xs pr-8"
                                    />
                                    <Button 
                                        size="icon" variant="ghost" 
                                        className="absolute right-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => setSeed(Math.floor(Math.random() * 1000000000))}
                                        title="重新随机生成一个种子"
                                    >
                                        <RefreshCcw className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                
                <CardFooter className="pt-2 pb-4 px-4 border-t shrink-0">
                    <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating || !selectedWorkflow}
                        className="w-full h-10 text-sm font-medium"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                        '生成图像'
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>

        {/* 右侧/下方：结果区域 (根据模式显示不同内容) */}
        <div className={`space-y-6 ${layoutMode === 'side' ? 'flex-1 min-w-0 h-full flex flex-col' : ''}`}>
            
            {layoutMode === 'side' && rightPanelMode === 'images' && generatedImages.length > 0 && (
                <h3 className="text-sm font-semibold mb-2 shrink-0 px-1">生成结果</h3>
            )}

            <div className={`relative rounded-lg border border-dashed border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden ${layoutMode === 'side' ? 'h-full' : 'min-h-[400px]'}`}>
                {rightPanelMode === 'images' && <ImageViewer />}
                {rightPanelMode === 'json' && (
                    <JsonEditorPanel 
                        workflowJson={workflowJson}
                        setWorkflowJson={setWorkflowJson}
                        setRightPanelMode={setRightPanelMode}
                        handleSaveJson={handleSaveJson}
                    />
                )}
                {rightPanelMode === 'presets' && <PresetsManagerPanel />}
            </div>
        </div>

      </div>

    </div>
  )
}

export default ComfyUIOperation