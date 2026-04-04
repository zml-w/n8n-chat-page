"use server"

// 动态导入 fs 和 path 以兼容 Next.js 环境
async function getFs() {
  try {
    const fs = await import("fs/promises")
    const path = await import("path")
    return { fs, path }
  } catch (e) {
    console.warn("File system module not available.")
    return null
  }
}

// 工具：净化文件名，防止非法字符导致文件系统错误
function sanitizeFileName(name: string) {
  // 替换 \ / : * ? " < > | 为下划线，并去除首尾空格
  let safeName = name.replace(/[\\/:*?"<>|]/g, "_").trim()
  // 避免文件名为空或全是点
  if (!safeName || safeName === "." || safeName === "..") {
    safeName = "Untitled_Session"
  }
  // 限制文件名长度，防止文件系统报错
  return safeName.substring(0, 50)
}

// 初始化目录结构
export async function ensureDirs() {
  const modules = await getFs()
  if (!modules) return null

  const { fs, path } = modules
  const DATA_DIR = path.join(process.cwd(), "data")
  const SESSIONS_DIR = path.join(DATA_DIR, "sessions")
  const IMAGES_ROOT_DIR = path.join(DATA_DIR, "images")

  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.mkdir(SESSIONS_DIR, { recursive: true })
    await fs.mkdir(IMAGES_ROOT_DIR, { recursive: true })
    return { fs, path, DATA_DIR, SESSIONS_DIR, IMAGES_ROOT_DIR }
  } catch (e) {
    console.error("Error creating directories:", e)
    return null
  }
}

// 保存全局设置
export async function saveStorageItem(key: string, value: string) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, error: "Environment error" }
    const { fs, path, DATA_DIR } = env

    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filePath = path.join(DATA_DIR, `${safeKey}.json`)

    await fs.writeFile(filePath, JSON.stringify({ value }), "utf-8")
    return { success: true }
  } catch (error) {
    console.error(`Failed to save ${key}:`, error)
    return { success: false, error: "Failed to save settings" }
  }
}

// 加载全局设置
export async function loadGlobalSettings() {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: {} }
    const { fs, path, DATA_DIR } = env

    const files = await fs.readdir(DATA_DIR)
    const data: Record<string, string> = {}

    for (const file of files) {
      if (file.endsWith(".json") && !file.startsWith("session_")) {
        const key = file.replace(".json", "")
        try {
          const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8")
          const json = JSON.parse(content)
          if (json && typeof json.value !== "undefined") {
            data[key] = json.value
          }
        } catch (e) {
          // 忽略读取错误
        }
      }
    }
    return { success: true, data }
  } catch (error) {
    return { success: false, data: {} }
  }
}

/**
 * 保存会话到文件
 * 修复了图片保存逻辑，确保完整性
 */
export async function saveSessionToFile(session: any, previousName?: string) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, error: "No FS access" }
    const { fs, path, SESSIONS_DIR, IMAGES_ROOT_DIR } = env

    const currentSafeName = sanitizeFileName(session.name)
    
    // 1. 处理重命名逻辑
    if (previousName && previousName !== session.name) {
      const oldSafeName = sanitizeFileName(previousName)
      
      const oldJsonPath = path.join(SESSIONS_DIR, `${oldSafeName}.json`)
      const newJsonPath = path.join(SESSIONS_DIR, `${currentSafeName}.json`)
      
      const oldImgDir = path.join(IMAGES_ROOT_DIR, oldSafeName)
      const newImgDir = path.join(IMAGES_ROOT_DIR, currentSafeName)

      try {
        await fs.access(oldJsonPath)
        await fs.rename(oldJsonPath, newJsonPath)
      } catch (e) {}

      try {
        await fs.access(oldImgDir)
        await fs.rename(oldImgDir, newImgDir)
      } catch (e) {}
    }

    // 2. 确保当前会话的图片文件夹存在
    const currentImgDir = path.join(IMAGES_ROOT_DIR, currentSafeName)
    try {
      await fs.access(currentImgDir)
    } catch {
      await fs.mkdir(currentImgDir, { recursive: true })
    }

    // 3. 深拷贝 session 防止修改原始对象
    const sessionToSave = JSON.parse(JSON.stringify(session))

    for (const msg of sessionToSave.messages) {
      if (msg.image) {
        // 如果是 Base64 数据，保存为文件
        if (msg.image.startsWith("data:image")) {
          const base64Data = msg.image.split(";base64,").pop()
          const extension = msg.image.substring("data:image/".length, msg.image.indexOf(";"))
          const ext = extension === "jpeg" ? "jpg" : extension || "png"
          
          const fileName = `${msg.id}.${ext}`
          const filePath = path.join(currentImgDir, fileName)

          // 仅当文件不存在时写入，提高性能
          let fileExists = false
          try {
            await fs.access(filePath)
            fileExists = true
          } catch {
            fileExists = false
          }

          if (!fileExists && base64Data) {
            await fs.writeFile(filePath, base64Data, { encoding: "base64" })
          }

          // JSON 中只保存文件名
          msg.image = fileName
        } 
        else if (typeof msg.image === "string") {
            // 确保只保留文件名，防止路径污染
            msg.image = path.basename(msg.image)
        }
      }
    }

    // 4. 写入 JSON 文件
    const filePath = path.join(SESSIONS_DIR, `${currentSafeName}.json`)
    await fs.writeFile(filePath, JSON.stringify(sessionToSave, null, 2), "utf-8")

    return { success: true }
  } catch (error) {
    console.error("Failed to save session:", error)
    return { success: false, error: String(error) }
  }
}

export async function deleteSessionFile(sessionName: string) {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false }
    const { fs, path, SESSIONS_DIR, IMAGES_ROOT_DIR } = env

    const safeName = sanitizeFileName(sessionName)

    const jsonPath = path.join(SESSIONS_DIR, `${safeName}.json`)
    try { await fs.unlink(jsonPath) } catch (e) {}

    const imgDir = path.join(IMAGES_ROOT_DIR, safeName)
    try { await fs.rm(imgDir, { recursive: true, force: true }) } catch (e) {}

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function getSessionsFromFileSystem() {
  try {
    const env = await ensureDirs()
    if (!env) return { success: false, data: [] }
    const { fs, path, SESSIONS_DIR, IMAGES_ROOT_DIR } = env

    let files = []
    try {
      files = await fs.readdir(SESSIONS_DIR)
    } catch (e) {
      return { success: true, data: [] }
    }
    
    const sessions = []

    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const content = await fs.readFile(path.join(SESSIONS_DIR, file), "utf-8")
          const session = JSON.parse(content)
          
          const safeName = sanitizeFileName(session.name)
          const sessionImgDir = path.join(IMAGES_ROOT_DIR, safeName)

          if (session.messages) {
            for (const msg of session.messages) {
              if (msg.image && !msg.image.startsWith("data:")) {
                const fileName = path.basename(msg.image)
                const imagePath = path.join(sessionImgDir, fileName)
                
                try {
                  const imageBuffer = await fs.readFile(imagePath)
                  const ext = path.extname(imagePath).replace(".", "") || "png"
                  const base64 = imageBuffer.toString("base64")
                  msg.image = `data:image/${ext};base64,${base64}`
                } catch (imgErr) {
                   msg.image = null 
                }
              }
            }
          }

          sessions.push(session)
        } catch (e) {
          console.error(`Error reading session ${file}`, e)
        }
      }
    }

    sessions.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))

    return { success: true, data: sessions }
  } catch (error) {
    console.error("Failed to load sessions:", error)
    return { success: false, data: [] }
  }
}

export async function sendMessageToN8n(formData: FormData) {
  try {
    const webhookUrl = formData.get("webhookUrl") as string
    const message = formData.get("message") as string
    const sessionId = formData.get("sessionId") as string
    const memoryLength = formData.get("memoryLength") as string
    const chatHistory = formData.get("chatHistory") as string
    const customParamsStr = formData.get("customParams") as string
    const customParams = customParamsStr ? JSON.parse(customParamsStr) : {}

    if (!webhookUrl) throw new Error("需要 Webhook URL")

    const payload = {
      chatInput: message,
      sessionId: sessionId,
      memoryLength: memoryLength ? Number.parseInt(memoryLength) : 10,
      chatHistory: chatHistory,
      timestamp: new Date().toISOString(),
      ...customParams,
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return { success: false, error: `无法连接到 n8n: ${response.statusText}` }
    }

    const contentType = response.headers.get("content-type")
    let botResponse: any

    if (contentType && (contentType.startsWith("image/") || contentType.includes("application/octet-stream"))) {
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      const mimeType = contentType.includes("image/") ? contentType : "image/png"
      return { success: true, data: { image: `data:${mimeType};base64,${base64}` } }
    }

    let data
    if (contentType && contentType.includes("application/json")) {
      data = await response.json()
    } else {
      data = { output: await response.text() }
    }

    // 统一处理返回格式
    const extractImage = (item: any) => {
      if (!item || !item.image) return null
      const imgData = item.image
      if (typeof imgData === "string") {
        return imgData.startsWith("data:") ? imgData : `data:image/png;base64,${imgData}`
      }
      if (typeof imgData === "object" && imgData.data) {
        return `data:${imgData.mimeType || "image/png"};base64,${imgData.data}`
      }
      return null
    }

    if (Array.isArray(data)) {
        const item = data[0]
        botResponse = {
            text: item.output || item.text || item.content || "",
            image: extractImage(item)
        }
    } else if (typeof data === "object") {
        botResponse = {
            text: data.output || data.text || data.answer || data.content || "",
            image: extractImage(data)
        }
    } else {
        botResponse = data
    }

    return { success: true, data: botResponse }
  } catch (error) {
    console.error("Server Action Error:", error)
    return { success: false, error: error instanceof Error ? error.message : "未知错误" }
  }
}