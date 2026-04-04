'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Edit2, Check } from 'lucide-react'
import { ComfyUIConfig, ComfyUIWorkflow } from './types'
import { loadComfyUIConfig, saveComfyUIConfig } from './actions'
import ComfyUIWorkflows from './Workflows'
import ComfyUIOperation from './Operation'

interface ComfyUIMainProps {
  onClose?: () => void
}

const ComfyUIMain: React.FC<ComfyUIMainProps> = ({ onClose }) => {
  const [config, setConfig] = useState<ComfyUIConfig>({ apiUrl: 'http://localhost:8188' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('workflows')
  const [selectedWorkflow, setSelectedWorkflow] = useState<ComfyUIWorkflow | null>(null)
  const [isInOperationMode, setIsInOperationMode] = useState(false)
  const [isSavingApiUrl, setIsSavingApiUrl] = useState(false)
  const [showApiUrlEdit, setShowApiUrlEdit] = useState(false)
  const [apiUrl, setApiUrl] = useState(config.apiUrl)
  
  // 自定义标签文本状态
  const [tabText, setTabText] = useState(config.tabText || '')
  const [isEditingTabText, setIsEditingTabText] = useState(false)
  const [editTabInputRef, setEditTabInputRef] = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        const result = await loadComfyUIConfig()
        if (result.success && result.data) {
          setConfig(result.data)
          setApiUrl(result.data.apiUrl)
          setTabText(result.data.tabText || '')
        } else {
          setError(result.error || '加载配置失败')
        }
      } catch (err) {
        setError('加载配置时发生意外错误')
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleSaveApiUrl = async () => {
    setIsSavingApiUrl(true)
    try {
      const result = await saveComfyUIConfig({ ...config, apiUrl })
      if (result.success) {
        setConfig(prev => ({ ...prev, apiUrl }))
        setShowApiUrlEdit(false)
        setError(null)
      } else {
        setError(result.error || '保存API地址失败')
      }
    } catch (err) {
      setError('保存API地址时发生意外错误')
    } finally {
      setIsSavingApiUrl(false)
    }
  }

  const handleWorkflowSelect = (workflow: ComfyUIWorkflow) => {
    setSelectedWorkflow(workflow)
    setIsInOperationMode(true)
  }

  const handleBackFromOperation = () => {
    setIsInOperationMode(false)
    loadComfyUIConfig().then(res => {
        if(res.success) {
          setConfig(res.data)
          setApiUrl(res.data.apiUrl)
        }
    });
  }
  
  // 双击标签开始编辑
  const handleDoubleClickTab = () => {
    setIsEditingTabText(true)
  }
  
  // 保存标签文本
  const handleSaveTabText = async () => {
    // 更新配置并保存
    const updatedConfig = { ...config, tabText }
    setConfig(updatedConfig)
    await saveComfyUIConfig(updatedConfig)
    
    // 退出编辑模式
    setIsEditingTabText(false)
  }
  
  // 输入框聚焦效果
  useEffect(() => {
    if (isEditingTabText && editTabInputRef) {
      editTabInputRef.focus()
      editTabInputRef.select()
    }
  }, [isEditingTabText])

  // --- 修复关键点 ---
  // 移除所有外层 padding 和 尺寸限制
  // 直接渲染 Operation 组件，让其占据整个可用空间
  if (isInOperationMode && selectedWorkflow) {
    return (
      <div className="flex items-center justify-center p-0 m-0 w-full h-full">
        <ComfyUIOperation
          key="operation"
          config={config}
          selectedWorkflow={selectedWorkflow}
          onBack={handleBackFromOperation}
        />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {isLoading ? (
        <div key="loading" className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <Alert key="error" variant="destructive" className="mb-4">
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card key="main" className="shadow-md">
            <CardHeader className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">ComfyUI 集成</CardTitle>
                <CardDescription>在工作流api中使用{'{{提示词}}'},{'{{宽}}'},{'{{高}}'},{'{{随机种}}'}实现动态参数</CardDescription>
              </div>
              
              {/* API地址设置 */}
              <div className="flex items-center gap-2">
                {showApiUrlEdit ? (
                  <div className="flex items-center gap-1 bg-background p-1 rounded-md border shadow-sm">
                    <Input
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="API地址"
                      className="h-6 w-[200px] text-xs"
                      autoFocus
                    />
                    <Button size="icon" className="h-6 w-6" onClick={handleSaveApiUrl} disabled={isSavingApiUrl}>
                      {isSavingApiUrl ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button size="icon" className="h-6 w-6" onClick={() => {
                      setApiUrl(config.apiUrl)
                      setShowApiUrlEdit(false)
                    }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">API:</span>
                    <span className="text-sm truncate max-w-[200px]">{config.apiUrl}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowApiUrlEdit(true)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4 w-full justify-start">
                  <TabsTrigger value="workflows" className="px-6 relative">
                    {isEditingTabText ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={setEditTabInputRef}
                          type="text"
                          value={tabText}
                          onChange={(e) => setTabText(e.target.value)}
                          onBlur={handleSaveTabText}
                          onKeyPress={(e) => e.key === 'Enter' && handleSaveTabText()}
                          className="w-full h-full p-1 text-sm border border-input rounded-md bg-background"
                        />
                      </div>
                    ) : (
                      <div onDoubleClick={handleDoubleClickTab} className="cursor-pointer px-2 py-1">
                        {tabText || '（双击编辑）'}
                      </div>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="mt-0">
                  <ComfyUIWorkflows onWorkflowSelect={handleWorkflowSelect} />
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>


        </>
      )}
    </div>
  )
}

export default ComfyUIMain