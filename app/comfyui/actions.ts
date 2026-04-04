"use server"

import { ComfyUIConfig, ComfyUIWorkflow, LoadComfyUIConfigResult, LoadComfyUIWorkflowsResult } from './types'
import { ensureDirs } from '../actions'

export async function saveComfyUIConfig(config: ComfyUIConfig) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, error: "Environment error" }
    const { fs, path, DATA_DIR } = env

    const comfyUIDir = path.join(DATA_DIR, 'comfyui')
    await fs.mkdir(comfyUIDir, { recursive: true })

    const configPath = path.join(comfyUIDir, 'config.json')
    await fs.writeFile(configPath, JSON.stringify(config), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Failed to save ComfyUI config:', error)
    return { success: false, error: 'Failed to save ComfyUI config' }
  }
}

export async function loadComfyUIConfig(): Promise<LoadComfyUIConfigResult> {
  try {
    const env = await ensureDirs()
    
    // 默认配置 - 更新为 935x800
    const defaultConfig: ComfyUIConfig = { 
      apiUrl: 'http://localhost:8188',
      uiWidth: 935,
      uiHeight: 800
    }

    if (!env) return { success: false, data: defaultConfig, error: 'Environment error' }
    const { fs, path, DATA_DIR } = env

    const configPath = path.join(DATA_DIR, 'comfyui', 'config.json')
    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const parsedConfig = JSON.parse(content)
      return { success: true, data: { ...defaultConfig, ...parsedConfig } }
    } catch {
      return { success: true, data: defaultConfig }
    }
  } catch (error) {
    console.error('Failed to load ComfyUI config:', error)
    // Error fallback also updated
    return { success: false, data: { apiUrl: 'http://localhost:8188', uiWidth: 935, uiHeight: 800 }, error: 'Failed to load ComfyUI config' }
  }
}

// ... rest of the file remains exactly the same ...
// (sanitizeFilename, saveComfyUIWorkflow, loadComfyUIWorkflows, deleteComfyUIWorkflow, 
// loadComfyUITagFiles, loadComfyUITagFileContent, executeComfyUIWorkflow)

function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim()
}

export async function saveComfyUIWorkflow(workflow: ComfyUIWorkflow) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, error: "Environment error" }
    const { fs, path, DATA_DIR } = env

    const comfyUIDir = path.join(DATA_DIR, 'comfyui')
    const workflowsDir = path.join(comfyUIDir, 'workflows')
    const imagesDir = path.join(DATA_DIR, 'comfyui', 'images')
    await fs.mkdir(workflowsDir, { recursive: true })
    await fs.mkdir(imagesDir, { recursive: true })

    const workflowToSave = {
      ...workflow,
      originalContent: typeof workflow.originalContent === 'string' ? workflow.originalContent : JSON.stringify(workflow.originalContent || {})
    }

    const sanitizedName = sanitizeFilename(workflow.name)
    const newWorkflowPath = path.join(workflowsDir, `${sanitizedName}.json`)
    
    let oldWorkflowPath: string | null = null
    let oldWorkflowName: string | null = null
    const files = await fs.readdir(workflowsDir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(workflowsDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const existingWorkflow = JSON.parse(content) as ComfyUIWorkflow
        
        if (existingWorkflow.id === workflow.id && file !== `${sanitizedName}.json`) {
          oldWorkflowPath = filePath
          oldWorkflowName = existingWorkflow.name
          break
        }
      }
    }
    
    await fs.writeFile(newWorkflowPath, JSON.stringify(workflowToSave), 'utf-8')
    
    if (oldWorkflowPath) {
      await fs.unlink(oldWorkflowPath)
    }
    
    if (oldWorkflowName && oldWorkflowName !== workflow.name) {
      const oldImagesDir = path.join(imagesDir, sanitizeFilename(oldWorkflowName))
      const newImagesDir = path.join(imagesDir, sanitizeFilename(workflow.name))
      try {
        await fs.access(oldImagesDir)
        await fs.rename(oldImagesDir, newImagesDir)
      } catch {}
    }
    
    return { success: true }
  } catch (error) {
    console.error('Failed to save ComfyUI workflow:', error)
    return { success: false, error: 'Failed to save ComfyUI workflow' }
  }
}

export async function loadComfyUIWorkflows(): Promise<LoadComfyUIWorkflowsResult> {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: [], error: 'Environment error' }
    const { fs, path, DATA_DIR } = env

    const workflowsDir = path.join(DATA_DIR, 'comfyui', 'workflows')
    try {
      await fs.access(workflowsDir)
    } catch {
      await fs.mkdir(workflowsDir, { recursive: true })
      return { success: true, data: [] }
    }

    const files = await fs.readdir(workflowsDir)
    const workflows: ComfyUIWorkflow[] = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(workflowsDir, file), 'utf-8')
          const workflow = JSON.parse(content) as ComfyUIWorkflow
          workflows.push(workflow)
        } catch (e) {
          console.error(`Failed to read workflow ${file}:`, e)
        }
      }
    }

    return { success: true, data: workflows }
  } catch (error) {
    console.error('Failed to load ComfyUI workflows:', error)
    return { success: false, data: [], error: 'Failed to load ComfyUI workflows' }
  }
}

export async function deleteComfyUIWorkflow(workflowId: string) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, error: "Environment error" }
    const { fs, path, DATA_DIR } = env
    const workflowsDir = path.join(DATA_DIR, 'comfyui', 'workflows')
    const files = await fs.readdir(workflowsDir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(workflowsDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const workflow = JSON.parse(content) as ComfyUIWorkflow
        if (workflow.id === workflowId) {
          await fs.unlink(filePath)
          const imagesDir = path.join(DATA_DIR, 'comfyui', 'images')
          const workflowImagesDir = path.join(imagesDir, sanitizeFilename(workflow.name))
          try {
            await fs.rm(workflowImagesDir, { recursive: true, force: true })
          } catch {}
          return { success: true }
        }
      }
    }
    return { success: true }
  } catch (error) {
    console.error('Failed to delete ComfyUI workflow:', error)
    return { success: false, error: 'Failed to delete ComfyUI workflow' }
  }
}

export async function loadComfyUITagFiles() {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: [], error: "Environment error" }
    const { fs, path, DATA_DIR } = env
    const tagDir = path.join(DATA_DIR, 'comfyui', 'tag')
    try {
      await fs.access(tagDir)
    } catch {
      await fs.mkdir(tagDir, { recursive: true })
      return { success: true, data: [] }
    }
    const files = await fs.readdir(tagDir)
    const txtFiles = files.filter(file => file.endsWith('.txt'))
    return { success: true, data: txtFiles }
  } catch (error) {
    console.error('Failed to load ComfyUI tag files:', error)
    return { success: false, data: [], error: 'Failed to load ComfyUI tag files' }
  }
}

export async function loadComfyUITagFileContent(filename: string) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: [], error: "Environment error" }
    const { fs, path, DATA_DIR } = env
    const tagDir = path.join(DATA_DIR, 'comfyui', 'tag')
    const filePath = path.join(tagDir, filename)
    try {
      await fs.access(filePath)
    } catch {
      return { success: false, data: [], error: 'Tag file not found' }
    }
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    return { success: true, data: lines }
  } catch (error) {
    console.error('Failed to load ComfyUI tag file content:', error)
    return { success: false, data: [], error: 'Failed to load ComfyUI tag file content' }
  }
}

export async function loadComfyUIPromptCompletionFile() {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: [], error: "Environment error" }
    const { fs } = env
    const filePath = "D:\\111\\ZML\\n8n\\chat\\n8n-chat-page\\data\\comfyui\\prompt\\22w补全提示词.txt"
    try {
      await fs.access(filePath)
    } catch {
      return { success: false, data: [], error: 'Prompt completion file not found' }
    }
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    return { success: true, data: lines }
  } catch (error) {
    console.error('Failed to load ComfyUI prompt completion file:', error)
    return { success: false, data: [], error: 'Failed to load ComfyUI prompt completion file' }
  }
}

export async function executeComfyUIWorkflow(
  config: ComfyUIConfig,
  workflow: ComfyUIWorkflow,
  params: { prompt: string; width: number; height: number; seed?: number },
  saveGeneratedImages: boolean
) {
  try {
    let workflowContent: string
    if (workflow.originalContent) {
      workflowContent = workflow.originalContent
    } else {
      workflowContent = JSON.stringify(workflow.content)
    }
    
    const seedValue = params.seed !== undefined ? params.seed : Math.floor(Math.random() * 1000000000000000);
    let processedContent = workflowContent
        .replace(/{{宽}}/g, params.width.toString())
        .replace(/{{高}}/g, params.height.toString())
        .replace(/{{随机种}}/g, seedValue.toString());

    const PROMPT_PLACEHOLDER = '__PROMPT_PLACEHOLDER_TOKEN_V1__';
    processedContent = processedContent.replace(/{{提示词}}/g, PROMPT_PLACEHOLDER);

    let parsedWorkflow;
    try {
        parsedWorkflow = JSON.parse(processedContent);
    } catch (error) {
        console.error('Failed to parse workflow content after variable substitution:', error);
        throw new Error('工作流 JSON 格式解析失败，请检查模板变量替换后的格式');
    }

    const replacePromptVariables = (obj: any): any => {
        if (typeof obj === 'string') {
            if (obj.includes(PROMPT_PLACEHOLDER)) {
                return obj.replace(new RegExp(PROMPT_PLACEHOLDER, 'g'), params.prompt);
            }
            return obj;
        } else if (Array.isArray(obj)) {
            return obj.map(replacePromptVariables);
        } else if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    newObj[key] = replacePromptVariables(obj[key]);
                }
            }
            return newObj;
        }
        return obj;
    };

    parsedWorkflow = replacePromptVariables(parsedWorkflow);

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`[ComfyUI] Sending request. Seed: ${seedValue}, ClientID: ${clientId}`);
    
    const requestBody = {
      prompt: parsedWorkflow,
      client_id: clientId
    };

    const response = await fetch(`${config.apiUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`Failed to execute workflow: ${response.statusText}`)
    }

    const result = await response.json()
    const promptId = result.prompt_id

    let attempts = 0
    const maxAttempts = 300 
    const delay = 1000
    
    let finalResult: { success: boolean; data?: { images: string[] }; error?: string } | null = null

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay))
      attempts++

      try {
        const historyUrl = `${config.apiUrl}/history/${promptId}`;
        const statusResponse = await fetch(historyUrl, { headers: { 'Cache-Control': 'no-cache' } })
        if (!statusResponse.ok) continue
        const history = await statusResponse.json()
        const promptHistory = history[promptId]
        
        if (promptHistory) {
          if (promptHistory.status && promptHistory.status.completed === false) continue;

          if (promptHistory.status && promptHistory.status.status_str === 'error') {
             console.error('[ComfyUI] Execution Error:', promptHistory.status);
             finalResult = { success: false, error: 'ComfyUI 报告执行错误，请检查服务器日志' };
             break;
          }

          if (promptHistory.outputs && Object.keys(promptHistory.outputs).length > 0) {
            const images: string[] = []
            for (const nodeId in promptHistory.outputs) {
              const nodeOutput = promptHistory.outputs[nodeId]
              if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
                for (const image of nodeOutput.images) {
                  const imageUrl = `${config.apiUrl}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`
                  try {
                    const imageResponse = await fetch(imageUrl)
                    if (imageResponse.ok) {
                      const arrayBuffer = await imageResponse.arrayBuffer()
                      if (arrayBuffer.byteLength > 0) {
                        const buffer = Buffer.from(arrayBuffer)
                        const mimeType = imageResponse.headers.get('content-type') || 'image/png'
                        const base64 = buffer.toString('base64')
                        const imageData = `data:${mimeType};base64,${base64}`
                        images.push(imageData)
                        if (saveGeneratedImages) {
                          const env = await ensureDirs()
                          if (env) {
                            const { fs, path, DATA_DIR } = env
                            const imagesDir = path.join(DATA_DIR, 'comfyui', 'images')
                            const workflowImagesDir = path.join(imagesDir, sanitizeFilename(workflow.name))
                            await fs.mkdir(workflowImagesDir, { recursive: true })
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                            const filename = `${timestamp}-${image.filename}`
                            const imagePath = path.join(workflowImagesDir, filename)
                            await fs.writeFile(imagePath, buffer)
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error('[ComfyUI] Failed to fetch image:', error)
                  }
                }
              }
            }
            if (images.length > 0) {
              finalResult = { success: true, data: { images: images } }
              break
            }
          } else if (promptHistory.error) {
              finalResult = { success: false, error: JSON.stringify(promptHistory.error) }
              break
          }
        }
      } catch (error) {
        console.warn('[ComfyUI] Polling error:', error);
      }
    }
    
    if (finalResult) {
      return finalResult
    } else {
      throw new Error('生成超时：ComfyUI 未在规定时间内返回结果')
    }
  } catch (error) {
    console.error('Failed to execute ComfyUI workflow:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}