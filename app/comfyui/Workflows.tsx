'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Loader2, Trash2, Edit2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ComfyUIWorkflow } from './types'
import { saveComfyUIWorkflow, loadComfyUIWorkflows, deleteComfyUIWorkflow } from './actions'

interface ComfyUIWorkflowsProps {
  onWorkflowSelect?: (workflow: ComfyUIWorkflow) => void
}

const ComfyUIWorkflows: React.FC<ComfyUIWorkflowsProps> = ({ onWorkflowSelect }) => {
  const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importName, setImportName] = useState('')
  const [importFileContent, setImportFileContent] = useState<string | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)

  useEffect(() => {
    const loadWorkflows = async () => {
      setIsLoading(true)
      try {
        const result = await loadComfyUIWorkflows()
        if (result.success && result.data) {
          setWorkflows(result.data)
        } else {
          setError(result.error || '加载工作流失败')
        }
      } catch (err) {
        setError('加载工作流时发生意外错误')
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkflows()
  }, [])

  const handleImport = async () => {
    if (!importFileContent) {
      setError('请选择工作流文件')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // 直接保存原始的JSON字符串，不进行前端解析
      // 解析和模板变量替换将在后端执行
      
      // 但我们需要验证JSON格式（不包含模板变量）
      // 先替换模板变量为默认值，验证基本结构
      const tempJson = importFileContent
        .replace(/{{宽}}/g, '512')
        .replace(/{{高}}/g, '512')
        .replace(/{{提示词}}/g, '')
      
      // 验证JSON结构
      JSON.parse(tempJson)
      
      // 创建新工作流，只保存原始JSON字符串
      const newWorkflow: ComfyUIWorkflow = {
        id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: importName || importFileName?.replace('.json', '') || 'Untitled Workflow',
        content: {}, // 空对象，实际使用originalContent
        originalContent: importFileContent, // 保存原始的JSON字符串，包含模板变量
        createdAt: new Date().toISOString(),
        saveImages: false // 默认不保存图像
      }

      const result = await saveComfyUIWorkflow(newWorkflow)
      if (result.success) {
        setWorkflows(prev => [...prev, newWorkflow])
        setSuccess('工作流导入成功！')
        setIsImportDialogOpen(false)
        setImportName('')
        setImportFileContent(null)
        setImportFileName(null)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || '导入工作流失败')
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'SyntaxError') {
          setError('JSON 格式无效，请检查文件语法错误。')
        } else {
          setError(`错误：${err.message}`)
        }
      } else {
        setError('无效的 JSON 文件或发生意外错误')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (workflowId: string) => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await deleteComfyUIWorkflow(workflowId)
      if (result.success) {
        setWorkflows(prev => prev.filter(w => w.id !== workflowId))
        setSuccess('工作流删除成功！')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || '删除工作流失败')
      }
    } catch (err) {
      setError('删除工作流时发生意外错误')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditStart = (workflow: ComfyUIWorkflow) => {
    setEditingId(workflow.id)
    setEditingName(workflow.name)
  }

  const handleEditSave = async (workflowId: string) => {
    if (!editingName.trim()) {
      setError('工作流名称不能为空')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const workflowToUpdate = workflows.find(w => w.id === workflowId)
      if (!workflowToUpdate) throw new Error('Workflow not found')

      const updatedWorkflow: ComfyUIWorkflow = {
        ...workflowToUpdate,
        name: editingName.trim()
      }

      const result = await saveComfyUIWorkflow(updatedWorkflow)
      if (result.success) {
        setWorkflows(prev => prev.map(w => w.id === workflowId ? updatedWorkflow : w))
        setSuccess('工作流名称更新成功！')
        setEditingId(null)
        setEditingName('')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || '更新工作流名称失败')
      }
    } catch (err) {
      setError('更新工作流时发生意外错误')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setImportFileName(file.name)
      
      // 读取文件内容
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setImportFileContent(event.target.result as string)
        }
      }
      reader.readAsText(file)
      
      if (!importName) {
        setImportName(file.name.replace('.json', ''))
      }
    }
  }

  const handleSaveImagesToggle = async (workflowId: string, checked: boolean) => {
    setIsSaving(true)
    setError(null)

    try {
      const workflowToUpdate = workflows.find(w => w.id === workflowId)
      if (!workflowToUpdate) throw new Error('Workflow not found')

      const updatedWorkflow: ComfyUIWorkflow = {
        ...workflowToUpdate,
        saveImages: checked
      }

      const result = await saveComfyUIWorkflow(updatedWorkflow)
      if (result.success) {
        setWorkflows(prev => prev.map(w => w.id === workflowId ? updatedWorkflow : w))
      } else {
        setError(result.error || '更新工作流失败')
      }
    } catch (err) {
      setError('更新工作流时发生意外错误')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="default">
          <AlertTitle>成功</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">ComfyUI 工作流</h2>
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Upload className="mr-2 h-4 w-4" />
              导入工作流
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导入 ComfyUI 工作流</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="importName">工作流名称</Label>
                <Input
                  id="importName"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="输入工作流名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="importFile">工作流 JSON 文件</Label>
                <Input
                  id="importFile"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {importFileName && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {importFileName}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleImport} 
                disabled={isSaving || !importFileContent}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  '导入工作流'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">暂无导入的工作流</p>
            <Button 
                variant="default" 
                onClick={() => setIsImportDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                导入您的第一个工作流
              </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-2">
                    {editingId === workflow.id ? (
                      <Input
                        key={`input-${workflow.id}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="h-8"
                        onBlur={() => handleEditSave(workflow.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(workflow.id)}
                      />
                    ) : (
                      <CardTitle key={`title-${workflow.id}`} className="text-lg">{workflow.name}</CardTitle>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {editingId === workflow.id ? (
                      <Button
                        key={`save-${workflow.id}`}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEditSave(workflow.id)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        key={`edit-${workflow.id}`}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleEditStart(workflow)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      key={`delete-${workflow.id}`}
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(workflow.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  创建于：{new Date(workflow.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {JSON.stringify(workflow.content).substring(0, 150)}...
                </p>
                <div className="flex items-center justify-between mt-3">
                  <Label htmlFor={`save-images-${workflow.id}`} className="text-sm font-medium">
                    保存生成图像
                  </Label>
                  <Switch
                    id={`save-images-${workflow.id}`}
                    checked={workflow.saveImages || false}
                    onCheckedChange={(checked) => handleSaveImagesToggle(workflow.id, checked)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                variant="default"
                className="w-full"
                onClick={() => onWorkflowSelect?.(workflow)}
              >
                使用此工作流
              </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default ComfyUIWorkflows
