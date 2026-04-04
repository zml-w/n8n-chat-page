'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { saveComfyUIConfig, loadComfyUIConfig } from './actions'
import { ComfyUIConfig, LoadComfyUIConfigResult } from './types'

interface ComfyUIConfigProps {
  onConfigSaved?: () => void
}

const ComfyUIConfigComponent: React.FC<ComfyUIConfigProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<ComfyUIConfig>({ apiUrl: 'http://localhost:8188' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        const result = await loadComfyUIConfig()
        if (result.success && result.data) {
          setConfig(result.data)
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

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await saveComfyUIConfig(config)
      if (result.success) {
        setSuccess('ComfyUI 配置保存成功！')
        onConfigSaved?.()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(result.error || '保存配置失败')
      }
    } catch (err) {
      setError('保存配置时发生意外错误')
    } finally {
      setIsSaving(false)
    }
  }

  const handleApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, apiUrl: e.target.value }))
  }

  return (
    <div>
      {isLoading ? (
        <div key="loading" className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <Card key="config" className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>ComfyUI 配置</CardTitle>
            <CardDescription>设置您的 ComfyUI 服务器连接详情</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert key="error" variant="destructive" className="mb-4">
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert key="success" variant="default" className="mb-4">
                <AlertTitle>成功</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">ComfyUI API 地址</Label>
                <Input
                  id="apiUrl"
                  value={config.apiUrl}
                  onChange={handleApiUrlChange}
                  placeholder="http://localhost:8188"
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  输入您正在运行的 ComfyUI 服务器的地址
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存配置'
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default ComfyUIConfigComponent
