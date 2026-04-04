"use client"

import type React from "react"
import { io } from "socket.io-client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Send,
  Settings,
  Bot,
  User,
  Loader2,
  X,
  Pencil,
  Trash2,
  Menu,
  Plus,
  MessageSquare,
  ImageIcon,
  Copy,
  Camera,
  Check,
  Trash,
  Minimize2,
  ArrowUpToLine,
  ArrowDownToLine,
  LayoutTemplate,
  SlidersHorizontal,
  CheckSquare,
  RefreshCw,
  ChevronRight,
  ChevronUp,
  Image as LucideImage,
  Palette,
  Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ComfyUIMain from "@/app/comfyui/Main"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// 引入 Actions
import { 
  sendMessageToN8n, 
  saveStorageItem, 
  loadGlobalSettings, 
  getSessionsFromFileSystem, 
  saveSessionToFile, 
  deleteSessionFile 
} from "@/app/actions"
import { cn } from "@/lib/utils"
import * as htmlToImage from "html-to-image"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ImageDisplayMode = "standard" | "square" | "small" | "custom" | "collapsed"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  image?: string
  timestamp: Date
}

interface Session {
  id: string
  name: string
  messages: Message[]
  lastModified: number
  parameters?: {
    contextSize?: number
    webhookUrl?: string
    maxImageResolution?: number
    imageDisplayMode?: ImageDisplayMode
    userRoleName?: string
    aiRoleName?: string
  }
}

interface CustomButton {
  id: string
  label: string
  params: string // JSON string
  isActive?: boolean
}

const saveSetting = (key: string, value: string) => {
  saveStorageItem(key, value).catch((err) => {
    console.error(`Failed to save ${key} to local file:`, err)
  })
}

function MessageImage({
  src,
  mode = "standard",
  customMaxPixels = 1000000,
}: {
  src: string
  mode?: ImageDisplayMode
  customMaxPixels?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(mode === "collapsed")

  if (mode === "standard") {
    return (
      <img
        src={src || "/placeholder.svg"}
        alt="Generated"
        className="rounded-lg mb-2 bg-background/50 object-contain shadow-sm border border-border max-w-full h-auto"
      />
    )
  }

  if (mode === "collapsed" && isCollapsed) {
    return (
      <div 
        className="w-full max-w-sm border border-border rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors cursor-pointer group p-3 flex items-center gap-3 select-none"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="w-10 h-10 rounded bg-background flex items-center justify-center border border-border/50 text-muted-foreground group-hover:text-primary transition-colors">
          <LucideImage className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">包含一张图片</p>
          <p className="text-xs text-muted-foreground">点击展开查看</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    )
  }

  const getDimensions = () => {
    let targetPixels = 2073600 
    if (mode === "square") targetPixels = 250000
    if (mode === "small") targetPixels = 40000
    if (mode === "custom") targetPixels = customMaxPixels

    const maxDim = Math.round(Math.sqrt(targetPixels))
    return `${maxDim}px`
  }

  const dim = getDimensions()
  
  const currentStyle = isExpanded || (mode === "collapsed" && !isCollapsed)
    ? { maxWidth: "100%", height: "auto" }
    : { maxWidth: dim, maxHeight: dim, width: "auto", height: "auto" }

  return (
    <div className="relative group/image inline-flex flex-col mt-2 max-w-full">
      <img
        src={src || "/placeholder.svg"}
        alt="Generated"
        className={cn(
          "rounded-lg transition-all duration-300 ease-in-out bg-background/50 object-contain shadow-sm border border-border",
          "cursor-zoom-in hover:shadow-md" 
        )}
        style={currentStyle}
        onClick={() => {
           if (mode !== "collapsed") {
             setIsExpanded(!isExpanded)
           }
        }}
      />

      {mode !== "collapsed" && isExpanded && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity shadow-md w-8 h-8"
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(false)
          }}
        >
          <Minimize2 className="w-4 h-4" />
        </Button>
      )}

      {mode === "collapsed" && !isCollapsed && (
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground border border-border/50"
          onClick={() => setIsCollapsed(true)}
        >
          <ChevronUp className="w-4 h-4" /> 收起图片
        </Button>
      )}
    </div>
  )
}

export function Chat() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isStorageLoaded, setIsStorageLoaded] = useState(false)
  
  const lastSavedNameRef = useRef<string>("")

  // Settings State
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState("")
  const [botAvatar, setBotAvatar] = useState("")
  const [backgroundImage, setBackgroundImage] = useState("")
  const [contextSize, setContextSize] = useState(10)
  const [waitingText, setWaitingText] = useState("思考中...")
  const [welcomeMessage, setWelcomeMessage] = useState("你好！我是你的AI助手。请问有什么可以帮你的吗？")
  const [imageDisplayMode, setImageDisplayMode] = useState<ImageDisplayMode>("standard")
  const [maxImageResolution, setMaxImageResolution] = useState<number>(1000000)

  const [userRoleName, setUserRoleName] = useState("User")
  const [aiRoleName, setAiRoleName] = useState("AI")
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [commonPhrases, setCommonPhrases] = useState<string[]>(["继续", "详细解释一下", "总结以上内容", "翻译成中文"])
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([])
  const [newButtonLabel, setNewButtonLabel] = useState("")
  const [newButtonParams, setNewButtonParams] = useState("{}")
  const [isManageButtonsOpen, setIsManageButtonsOpen] = useState(false)

  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null)
  const [editPhraseText, setEditPhraseText] = useState("")
  const [newPhraseText, setNewPhraseText] = useState("")

  // Chat Frame State
  const [showChatFrame, setShowChatFrame] = useState(true)
  const [chatFrameWidth, setChatFrameWidth] = useState(800)

  // Edit/Delete State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editSessionName, setEditSessionName] = useState("")
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const [isClearingChat, setIsClearingChat] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  // ComfyUI State
  const [isComfyUIOpen, setIsComfyUIOpen] = useState(false)

  // Session Params State
  const [isSessionParamsOpen, setIsSessionParamsOpen] = useState(false)
  const [currentSessionParams, setCurrentSessionParams] = useState<{
    contextSize: number
    webhookUrl: string
    maxImageResolution: number
    imageDisplayMode: ImageDisplayMode
    userRoleName: string
    aiRoleName: string
  }>({
    contextSize,
    webhookUrl,
    maxImageResolution,
    imageDisplayMode,
    userRoleName,
    aiRoleName,
  })

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // 滚动到底部的辅助函数
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }

  // 监听 messages 变化自动滚动
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, isLoading])

  // Socket.io
  useEffect(() => {
    const socket = io("http://localhost:4000")
    socket.on("connect", () => console.log(">>> Socket Connected"))
    socket.on("message-from-n8n", (data: any) => {
      let content = ""
      let image = undefined
      const messageData = typeof data === "object" && data !== null ? data : { text: JSON.stringify(data) }
      content = messageData.output || messageData.text || ""

      if (messageData.image) {
        let rawImage = String(messageData.image)
        rawImage = rawImage.replace(/\s/g, "")
        if (rawImage.includes("base64,")) {
          const splitData = rawImage.split("base64,")
          image = `data:image/png;base64,${splitData[splitData.length - 1]}`
        } else if (rawImage.startsWith("http")) {
          image = rawImage
        } else {
          image = `data:image/png;base64,${rawImage}`
        }
      }

      if (content || image) {
        const botMessage: Message = {
          id: Date.now().toString() + Math.random().toString(),
          role: "assistant",
          content: content,
          image: image,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botMessage])
        // 确保收到消息时也滚动
        setTimeout(scrollToBottom, 100)
      }
    })
    return () => {
      socket.disconnect()
    }
  }, [])

  // --- 初始化加载数据 ---
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. 加载全局设置
        const settingsResult = await loadGlobalSettings()
        const data = settingsResult.success ? settingsResult.data : {}

        if (data["n8n_webhook_url"]) setWebhookUrl(data["n8n_webhook_url"])
        if (data["n8n_user_avatar"]) setUserAvatar(data["n8n_user_avatar"])
        if (data["n8n_bot_avatar"]) setBotAvatar(data["n8n_bot_avatar"])
        if (data["n8n_bg_image"]) setBackgroundImage(data["n8n_bg_image"])
        if (data["n8n_context_size"]) setContextSize(Number.parseInt(data["n8n_context_size"]))
        if (data["n8n_waiting_text"]) setWaitingText(data["n8n_waiting_text"])
        if (data["n8n_welcome_message"]) setWelcomeMessage(data["n8n_welcome_message"])
        if (data["n8n_image_display_mode"]) setImageDisplayMode(data["n8n_image_display_mode"] as ImageDisplayMode)
        if (data["n8n_max_image_resolution"]) setMaxImageResolution(Number.parseInt(data["n8n_max_image_resolution"]))
        if (data["n8n_user_role_name"]) setUserRoleName(data["n8n_user_role_name"])
        if (data["n8n_ai_role_name"]) setAiRoleName(data["n8n_ai_role_name"])
        if (data["n8n_common_phrases"]) setCommonPhrases(JSON.parse(data["n8n_common_phrases"]))
        if (data["n8n_custom_buttons"]) setCustomButtons(JSON.parse(data["n8n_custom_buttons"]))
        if (data["n8n_show_chat_frame"]) setShowChatFrame(data["n8n_show_chat_frame"] === "true")
        if (data["n8n_chat_frame_width"]) setChatFrameWidth(Number.parseInt(data["n8n_chat_frame_width"]))

        // 2. 加载会话列表
        const sessionsResult = await getSessionsFromFileSystem()
        const loadedSessions = sessionsResult.success && sessionsResult.data ? sessionsResult.data : []
        
        const formattedSessions = loadedSessions.map((session: any) => ({
            ...session,
            messages: session.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })),
            parameters: session.parameters || {
              contextSize: Number.parseInt(data["n8n_context_size"] || "10"),
              webhookUrl: data["n8n_webhook_url"] || "",
              maxImageResolution: Number.parseInt(data["n8n_max_image_resolution"] || "1000000"),
              imageDisplayMode: (data["n8n_image_display_mode"] as ImageDisplayMode) || "standard",
            },
          }))

        setSessions(formattedSessions)

        // 3. 恢复选中会话
        const savedCurrentSessionId = data["n8n_current_session_id"]
        if (formattedSessions.length > 0) {
            const sessionToRestore = formattedSessions.find((s: Session) => s.id === savedCurrentSessionId)
            if (sessionToRestore) {
              setCurrentSessionId(sessionToRestore.id)
              setMessages(sessionToRestore.messages)
              lastSavedNameRef.current = sessionToRestore.name // 初始化 ref
            } else {
              setCurrentSessionId(formattedSessions[0].id)
              setMessages(formattedSessions[0].messages)
              lastSavedNameRef.current = formattedSessions[0].name // 初始化 ref
            }
        } else {
            createFirstSession(data["n8n_webhook_url"], data["n8n_image_display_mode"] as ImageDisplayMode)
        }

      } catch (error) {
        console.error("Failed to load initial data", error)
        createFirstSession()
      } finally {
        setIsStorageLoaded(true)
      }
    }

    loadData()
  }, [])

  // --- 会话自动保存 ---
  useEffect(() => {
    if (!isStorageLoaded || !currentSessionId) return

    const currentSession = sessions.find(s => s.id === currentSessionId)
    if (currentSession) {
        const sessionToSave = {
          ...currentSession,
          messages: currentSession.messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          })),
          parameters: currentSession.parameters || { contextSize, webhookUrl, maxImageResolution, imageDisplayMode },
        }
        
        const previousName = lastSavedNameRef.current

        // 调用后端，传入 previousName 以处理文件重命名
        saveSessionToFile(sessionToSave, previousName)
            .then((res) => {
                if (res.success) {
                    // 保存成功后更新 ref
                    lastSavedNameRef.current = currentSession.name
                }
            })
            .catch(err => console.warn("Auto-save failed:", err))
    }
  }, [sessions, currentSessionId, isStorageLoaded])

  // --- 全局设置保存 ---
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_context_size", contextSize.toString()) }, [contextSize, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_waiting_text", waitingText) }, [waitingText, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_welcome_message", welcomeMessage) }, [welcomeMessage, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_webhook_url", webhookUrl) }, [webhookUrl, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_max_image_resolution", maxImageResolution.toString()) }, [maxImageResolution, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_image_display_mode", imageDisplayMode) }, [imageDisplayMode, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_user_role_name", userRoleName) }, [userRoleName, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_ai_role_name", aiRoleName) }, [aiRoleName, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_common_phrases", JSON.stringify(commonPhrases)) }, [commonPhrases, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_custom_buttons", JSON.stringify(customButtons)) }, [customButtons, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_show_chat_frame", showChatFrame.toString()) }, [showChatFrame, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded) saveSetting("n8n_chat_frame_width", chatFrameWidth.toString()) }, [chatFrameWidth, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded && userAvatar) saveSetting("n8n_user_avatar", userAvatar) }, [userAvatar, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded && botAvatar) saveSetting("n8n_bot_avatar", botAvatar) }, [botAvatar, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded && backgroundImage) saveSetting("n8n_bg_image", backgroundImage) }, [backgroundImage, isStorageLoaded])
  useEffect(() => { if (isStorageLoaded && currentSessionId) saveSetting("n8n_current_session_id", currentSessionId) }, [currentSessionId, isStorageLoaded])

  useEffect(() => {
    if (currentSessionId && sessions.length > 0) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId ? { ...session, messages, lastModified: Date.now() } : session,
        ),
      )
    }
  }, [messages])

  // --- 会话管理 ---

  const createFirstSession = (initialUrl?: string, initialMode?: ImageDisplayMode) => {
    const newSession: Session = {
      id: Math.random().toString(36).substring(7),
      name: "新对话",
      messages: [{ id: "welcome", role: "assistant", content: welcomeMessage, timestamp: new Date() }],
      lastModified: Date.now(),
      parameters: { 
          contextSize, 
          webhookUrl: initialUrl || webhookUrl, 
          maxImageResolution, 
          imageDisplayMode: initialMode || imageDisplayMode 
      },
    }
    setSessions([newSession])
    setCurrentSessionId(newSession.id)
    setMessages(newSession.messages)
    lastSavedNameRef.current = newSession.name
  }

  const createNewSession = () => {
    const newSession: Session = {
      id: Math.random().toString(36).substring(7),
      name: `新对话 ${sessions.length + 1}`,
      messages: [{ id: "welcome", role: "assistant", content: welcomeMessage, timestamp: new Date() }],
      lastModified: Date.now(),
      parameters: { 
          contextSize, 
          webhookUrl, 
          maxImageResolution, 
          imageDisplayMode 
      },
    }
    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setMessages(newSession.messages)
    lastSavedNameRef.current = newSession.name
  }

  const switchSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      setCurrentSessionId(session.id)
      setMessages(session.messages)
      lastSavedNameRef.current = session.name
    }
  }

  const deleteSession = async (session: Session, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const newSessions = sessions.filter((s) => s.id !== session.id)
    setSessions(newSessions)

    await deleteSessionFile(session.name)

    if (session.id === currentSessionId) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id)
        setMessages(newSessions[0].messages)
        lastSavedNameRef.current = newSessions[0].name
      } else {
        createFirstSession()
      }
    }
  }

  const saveSessionName = async (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (editingSessionId) {
      const oldSession = sessions.find(s => s.id === editingSessionId)
      const oldName = oldSession?.name
      const newName = editSessionName.trim() || "无标题对话"

      if (oldName && oldName !== newName) {
          setSessions((prev) =>
            prev.map((s) => (s.id === editingSessionId ? { ...s, name: newName } : s)),
          )
          
          if (oldSession) {
             const sessionToSave = { ...oldSession, name: newName }
             await saveSessionToFile(sessionToSave, oldName)
             
             if (editingSessionId === currentSessionId) {
                 lastSavedNameRef.current = newName
             }
          }
      }
      
      setEditingSessionId(null)
    }
  }

  const handleSettingFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "user" | "bot" | "bg") => {
    const file = e.target.files?.[0]
    if (file) {
      const MAX_FILE_SIZE = 2 * 1024 * 1024
      if (file.size > MAX_FILE_SIZE) {
        alert(`文件大小不能超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (type === "user") setUserAvatar(result)
        if (type === "bot") setBotAvatar(result)
        if (type === "bg") setBackgroundImage(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }

  const handleClearChat = () => {
    setMessages([])
    setIsClearingChat(false)
  }

  const startEditing = (message: Message) => {
    setEditingMessageId(message.id)
    setEditText(message.content)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditText("")
  }

  const saveEdit = (id: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, content: editText } : msg)))
    setEditingMessageId(null)
    setEditText("")
  }

  const startEditingSession = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditSessionName(session.name)
  }

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedMessageId(id)
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  const scrollToTop = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (viewport) viewport.scrollTop = 0
    }
  }

  const currentSessionName = sessions.find((s) => s.id === currentSessionId)?.name || ""
  const currentSessionObj = sessions.find((s) => s.id === currentSessionId)

  const effectiveUserRoleName = currentSessionObj?.parameters?.userRoleName || userRoleName
  const effectiveAiRoleName = currentSessionObj?.parameters?.aiRoleName || aiRoleName

  const activeMode = currentSessionObj?.parameters?.imageDisplayMode ?? imageDisplayMode
  const activeCustomRes = currentSessionObj?.parameters?.maxImageResolution ?? maxImageResolution

  useEffect(() => {
    if (currentSessionObj) {
      setCurrentSessionParams({
        contextSize: currentSessionObj.parameters?.contextSize ?? contextSize,
        webhookUrl: currentSessionObj.parameters?.webhookUrl ?? webhookUrl,
        maxImageResolution: currentSessionObj.parameters?.maxImageResolution ?? maxImageResolution,
        imageDisplayMode: currentSessionObj.parameters?.imageDisplayMode ?? imageDisplayMode,
        userRoleName: currentSessionObj.parameters?.userRoleName ?? userRoleName,
        aiRoleName: currentSessionObj.parameters?.aiRoleName ?? aiRoleName,
      })
    }
  }, [currentSessionId, sessions])

  const saveSessionParams = () => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId ? { ...session, parameters: { ...currentSessionParams } } : session,
      ),
    )
    setIsSessionParamsOpen(false)
  }

  const copyMessageAsImage = async (id: string) => {
    const element = messageRefs.current[id]
    if (element) {
      try {
        const dataUrl = await htmlToImage.toPng(element, { fontEmbedCSS: "", backgroundColor: "#ffffff" })
        const blob = await (await fetch(dataUrl)).blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        setCopiedMessageId(`img-${id}`)
        setTimeout(() => setCopiedMessageId(null), 2000)
      } catch (error) {
        console.error("Failed to copy image", error)
        alert("无法生成图片截图，可能是由于浏览器安全限制。")
      }
    }
  }

  const handleSendMessage = async (
    e?: React.FormEvent,
    overrideInput?: string,
    overrideHistory?: Message[],
    overrideImage?: string,
    extraParams?: Record<string, any>,
    skipUserMessageAppend?: boolean,
  ) => {
    e?.preventDefault()
    const textToSend = overrideInput || input

    const activeCustomParams: Record<string, any> = {}
    
    customButtons.forEach((btn) => {
      if (btn.isActive) {
        try {
          const params = JSON.parse(btn.params)
          Object.assign(activeCustomParams, params)
        } catch (e) {
          console.error(`Error parsing params for button "${btn.label}":`, e)
        }
      }
    })

    const finalCustomParams = { ...activeCustomParams, ...extraParams }

    if (!textToSend.trim() && Object.keys(finalCustomParams).length === 0) return

    const currentSession = sessions.find((s) => s.id === currentSessionId)
    const effectiveWebhookUrl = currentSession?.parameters?.webhookUrl || webhookUrl
    const effectiveContextSize = currentSession?.parameters?.contextSize ?? contextSize
    const effectiveUserRole = currentSession?.parameters?.userRoleName || userRoleName
    const effectiveAiRole = currentSession?.parameters?.aiRoleName || aiRoleName

    if (!effectiveWebhookUrl) {
      setIsSettingsOpen(true)
      return
    }

    let userMessage: Message
    let currentMessages = overrideHistory ? [...overrideHistory] : [...messages]

    if (overrideInput) {
      userMessage = {
        id: Date.now().toString(),
        role: "user",
        content: textToSend,
        timestamp: new Date(),
      }
      if (!skipUserMessageAppend) {
        currentMessages = [...currentMessages, userMessage]
        setMessages(currentMessages)
      }
    } else {
      userMessage = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp: new Date(),
      }
      if (!skipUserMessageAppend) {
        currentMessages = [...currentMessages, userMessage]
        setMessages(currentMessages)
        setInput("")
      }
    }

    setIsLoading(true)
    
    // 自动重命名逻辑：如果是第一条消息，更新会话名称
    if (messages.length === 1 && messages[0].role === "assistant") {
      const newName = input.slice(0, 20) || "新对话"
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, name: newName } : s)),
      )
    }

    try {
      const formData = new FormData()
      formData.append("webhookUrl", effectiveWebhookUrl)
      formData.append("message", userMessage.content)
      formData.append("sessionId", currentSessionId)
      formData.append("memoryLength", effectiveContextSize.toString())

      const historyMessages = currentMessages
        .filter((msg) => msg.id !== "welcome")
        .slice(-Math.max(1, effectiveContextSize))
        .map((msg) => {
          const roleName = msg.role === "user" ? effectiveUserRole : effectiveAiRole
          return `${roleName}: ${msg.content}`
        })
        .join("\n\n")

      formData.append("chatHistory", historyMessages)

      if (Object.keys(finalCustomParams).length > 0) {
        formData.append("customParams", JSON.stringify(finalCustomParams))
      }

      const result = await sendMessageToN8n(formData)

      if (result.success) {
        let content = ""
        let image = undefined
        const responseData = Array.isArray(result.data) ? result.data[0] : result.data
        if (typeof responseData === "object" && responseData !== null) {
          content = responseData.output || responseData.text || ""
          if (responseData.image) {
            let rawImage = String(responseData.image)
            rawImage = rawImage.replace(/\s/g, "")
            if (rawImage.includes("base64,")) {
              const splitData = rawImage.split("base64,")
              image = `data:image/png;base64,${splitData[splitData.length - 1]}`
            } else if (rawImage.startsWith("http")) {
              image = rawImage
            } else {
              image = `data:image/png;base64,${rawImage}`
            }
          }
        } else {
          content = typeof result.data === "string" ? result.data : JSON.stringify(result.data)
        }
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: content,
          image: image,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botMessage])
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `错误: ${result.error}。`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "抱歉，出错了。请重试。",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // AI 重新生成
  const handleRegenerate = async (assistantMessageId: string) => {
    const index = messages.findIndex((m) => m.id === assistantMessageId)
    if (index === -1) return

    const previousUserMessage = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === "user")
    if (!previousUserMessage) return

    const newHistory = messages.slice(0, index)
    setMessages(newHistory)

    await handleSendMessage(undefined, previousUserMessage.content, newHistory, undefined, undefined, true)
  }

  // User 重新发送 (新增功能)
  const handleUserResend = async (userMessageId: string, content: string) => {
    const index = messages.findIndex((m) => m.id === userMessageId)
    if (index === -1) return
    // 截断到此消息之前（即删除该条及之后的所有消息，准备重新发送）
    const newHistory = messages.slice(0, index)
    // 更新状态
    setMessages(newHistory)
    // 重新发送该内容
    await handleSendMessage(undefined, content, newHistory, undefined, undefined, false)
  }

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
    setSelectedMessageIds(new Set())
  }

  const toggleMessageSelection = (id: string) => {
    const newSelected = new Set(selectedMessageIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedMessageIds(newSelected)
  }

  const deleteSelectedMessages = () => {
    if (selectedMessageIds.size === 0) return
    setMessages((prev) => prev.filter((msg) => !selectedMessageIds.has(msg.id)))
    setSelectedMessageIds(new Set())
    setIsBatchMode(false)
  }

  const screenshotSelectedMessages = async () => {
    if (selectedMessageIds.size === 0) return
    const container = document.createElement("div")
    container.style.position = "absolute"
    container.style.top = "-9999px"
    container.style.left = "0"
    container.style.width = "800px"
    container.style.backgroundColor = "white"
    container.style.padding = "20px"
    container.style.display = "flex"
    container.style.flexDirection = "column"
    container.style.gap = "10px"
    document.body.appendChild(container)

    try {
      for (const id of Array.from(selectedMessageIds)) {
        const element = messageRefs.current[id]
        if (element) {
          const clone = element.cloneNode(true) as HTMLElement
          const actions = clone.querySelectorAll("button")
          actions.forEach((btn) => btn.remove())
          container.appendChild(clone)
        }
      }

      const dataUrl = await htmlToImage.toPng(container, { fontEmbedCSS: "", backgroundColor: "#ffffff" })
      const link = document.createElement("a")
      link.download = `chat-batch-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error("Batch screenshot failed", error)
      alert("批量截图失败")
    } finally {
      document.body.removeChild(container)
      setIsBatchMode(false)
      setSelectedMessageIds(new Set())
    }
  }

  const addCustomButton = () => {
    if (!newButtonLabel) return
    try {
      JSON.parse(newButtonParams)
    } catch (e) {
      alert("参数 JSON 格式错误，请检查语法 (例如: {\"key\": \"value\"})")
      return
    }

    const newButton: CustomButton = {
      id: Date.now().toString(),
      label: newButtonLabel,
      params: newButtonParams,
      isActive: false,
    }
    setCustomButtons([...customButtons, newButton])
    setNewButtonLabel("")
    setNewButtonParams("{}")
  }

  const deleteCustomButton = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCustomButtons((prev) => prev.filter((b) => b.id !== id))
  }

  const handleCustomButtonClick = (targetBtn: CustomButton) => {
    setCustomButtons((prev) => prev.map((btn) => (btn.id === targetBtn.id ? { ...btn, isActive: !btn.isActive } : btn)))
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const addCommonPhrase = () => {
    if (newPhraseText.trim()) {
      setCommonPhrases([...commonPhrases, newPhraseText.trim()])
      setNewPhraseText("")
    }
  }

  const updateCommonPhrase = (index: number) => {
    if (editPhraseText.trim()) {
      const newPhrases = [...commonPhrases]
      newPhrases[index] = editPhraseText.trim()
      setCommonPhrases(newPhrases)
      setEditingPhraseIndex(null)
      setEditPhraseText("")
    }
  }

  const deleteCommonPhrase = (index: number) => {
    const newPhrases = commonPhrases.filter((_, i) => i !== index)
    setCommonPhrases(newPhrases)
  }

  return (
    <div
      className="flex flex-col h-screen bg-background text-foreground font-sans transition-colors duration-300 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
    >
      <AlertDialog
        open={!!messageToDelete || isClearingChat}
        onOpenChange={(open) => {
          if (!open) {
            setMessageToDelete(null)
            setIsClearingChat(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isClearingChat ? "确定要清空所有消息吗？" : "确定要删除这条消息吗？"}</AlertDialogTitle>
            <AlertDialogDescription>此操作无法撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isClearingChat) {
                  handleClearChat()
                } else if (messageToDelete) {
                  handleDeleteMessage(messageToDelete)
                  setMessageToDelete(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingChat ? "清空" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isBatchMode && (
        <div className="bg-secondary/90 backdrop-blur border-b border-border p-2 flex items-center justify-between sticky top-[57px] z-20 shadow-md">
          <div className="flex gap-2 ml-4">
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteSelectedMessages}
              disabled={selectedMessageIds.size === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" /> 删除选中
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={screenshotSelectedMessages}
              disabled={selectedMessageIds.size === 0}
            >
              <Camera className="w-4 h-4 mr-1" /> 截图选中
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleBatchMode}>
              <X className="w-4 h-4" /> 退出
            </Button>
          </div>
          <span className="text-sm font-medium mr-4">已选择 {selectedMessageIds.size} 条消息</span>
        </div>
      )}

      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-1">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] flex flex-col">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between pr-6">
                    <span>历史对话</span>
                    <Button variant="outline" size="sm" onClick={createNewSession} className="h-8 px-2 bg-transparent">
                      <Plus className="w-4 h-4 mr-1" /> 新对话
                    </Button>
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => switchSession(session.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group",
                          currentSessionId === session.id ? "bg-secondary" : "hover:bg-secondary/50",
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          {editingSessionId === session.id ? (
                            <Input
                              value={editSessionName}
                              onChange={(e) => setEditSessionName(e.target.value)}
                              onBlur={saveSessionName}
                              onKeyDown={(e) => e.key === "Enter" && saveSessionName(e)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 text-sm py-1 px-2"
                              autoFocus
                            />
                          ) : (
                            <span className="truncate text-sm font-medium">{session.name || "无标题对话"}</span>
                          )}
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={(e) => startEditingSession(session, e)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => deleteSession(session, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
              {botAvatar ? (
                <img src={botAvatar || "/placeholder.svg"} alt="Bot" className="w-full h-full object-cover" />
              ) : (
                <Bot className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
            <h1 className="text-lg font-semibold hidden sm:block">{currentSessionName || "新对话"}</h1>

            <Button
              variant={isBatchMode ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={toggleBatchMode}
              title="批量操作模式"
            >
              <CheckSquare className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsSessionParamsOpen(true)}
              title="对话参数设置"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsClearingChat(true)}
              title="清空消息"
            >
              <Trash className="w-4 h-4" />
            </Button>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Settings className="w-4 h-4" />
                  <span className="sr-only">设置</span>
                </Button>
              </DialogTrigger>
            </Dialog>

            <Dialog open={isSessionParamsOpen} onOpenChange={setIsSessionParamsOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>对话参数设置</DialogTitle>
                  <DialogDescription>为当前对话配置专属参数。</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="session-webhook-url">Webhook URL</Label>
                    <Input
                      id="session-webhook-url"
                      placeholder="https://your-n8n-instance.com/webhook/..."
                      value={currentSessionParams.webhookUrl}
                      onChange={(e) => setCurrentSessionParams({ ...currentSessionParams, webhookUrl: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2 pt-2">
                    <Label>图片显示模式</Label>
                    <Select
                      value={currentSessionParams.imageDisplayMode}
                      onValueChange={(val: ImageDisplayMode) =>
                        setCurrentSessionParams({ ...currentSessionParams, imageDisplayMode: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择模式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">标准模式 (2MP)</SelectItem>
                        <SelectItem value="square">中图模式 (约 500x500)</SelectItem>
                        <SelectItem value="small">小图模式 (约 200x200)</SelectItem>
                        <SelectItem value="collapsed">折叠模式 (默认隐藏)</SelectItem>
                        <SelectItem value="custom">自定义总像素</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentSessionParams.imageDisplayMode === "custom" && (
                    <div className="grid gap-2 pt-2 pl-4 border-l-2 border-primary/20">
                      <Label htmlFor="session-max-res">自定义最大像素</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="session-max-res"
                          type="number"
                          value={currentSessionParams.maxImageResolution}
                          onChange={(e) =>
                            setCurrentSessionParams({
                              ...currentSessionParams,
                              maxImageResolution: Number.parseInt(e.target.value) || 1000000,
                            })
                          }
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          (约 {Math.round(Math.sqrt(currentSessionParams.maxImageResolution))}px)
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="grid gap-2">
                      <Label htmlFor="session-user-role">用户角色名</Label>
                      <Input
                        id="session-user-role"
                        value={currentSessionParams.userRoleName}
                        onChange={(e) =>
                          setCurrentSessionParams({ ...currentSessionParams, userRoleName: e.target.value })
                        }
                        placeholder={userRoleName}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="session-ai-role">AI 角色名</Label>
                      <Input
                        id="session-ai-role"
                        value={currentSessionParams.aiRoleName}
                        onChange={(e) =>
                          setCurrentSessionParams({ ...currentSessionParams, aiRoleName: e.target.value })
                        }
                        placeholder={aiRoleName}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 pt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="session-context-size">上下文记忆长度 ({currentSessionParams.contextSize})</Label>
                    </div>
                    <Slider
                      id="session-context-size"
                      min={0}
                      max={50}
                      step={1}
                      value={[currentSessionParams.contextSize]}
                      onValueChange={(vals) =>
                        setCurrentSessionParams({ ...currentSessionParams, contextSize: vals[0] })
                      }
                    />
                  </div>
                  <Button onClick={saveSessionParams} className="w-full">
                    保存设置
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* 清空消息和设置按钮移到这里 */}
            <div className="flex items-center gap-1 ml-4">
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>设置</DialogTitle>
                    <DialogDescription>全局配置</DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="connection">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="connection">连接</TabsTrigger>
                      <TabsTrigger value="basic">基础</TabsTrigger>
                      <TabsTrigger value="image">图像</TabsTrigger>
                      <TabsTrigger value="personalization">个性化</TabsTrigger>
                    </TabsList>

                    <TabsContent value="connection" className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="webhook-url">Webhook URL</Label>
                        <Input
                          id="webhook-url"
                          placeholder="https://your-n8n-instance.com/webhook/..."
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">确保 n8n 工作流接收 POST 请求并返回 JSON。</p>
                      </div>

                      <div className="grid gap-4 pt-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="context-size">上下文记忆长度 ({contextSize})</Label>
                        </div>
                        <Slider
                          id="context-size"
                          min={0}
                          max={50}
                          step={1}
                          value={[contextSize]}
                          onValueChange={(vals) => setContextSize(vals[0])}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="grid gap-2">
                          <Label htmlFor="user-role-name">用户角色名</Label>
                          <Input
                            id="user-role-name"
                            value={userRoleName}
                            onChange={(e) => setUserRoleName(e.target.value)}
                            placeholder="User"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="ai-role-name">AI 角色名</Label>
                          <Input
                            id="ai-role-name"
                            value={aiRoleName}
                            onChange={(e) => setAiRoleName(e.target.value)}
                            placeholder="AI"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="basic" className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="waiting-text">等待提示语</Label>
                        <Input
                          id="waiting-text"
                          value={waitingText}
                          onChange={(e) => setWaitingText(e.target.value)}
                          placeholder="思考中..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="welcome-message">开场白 (新对话生效)</Label>
                        <Textarea
                          id="welcome-message"
                          value={welcomeMessage}
                          onChange={(e) => setWelcomeMessage(e.target.value)}
                          placeholder="你好！我是你的AI助手..."
                          rows={4}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="image" className="space-y-4 py-4">
                      <div className="grid gap-4">
                        <Label>默认图片显示模式</Label>
                        <Select
                          value={imageDisplayMode}
                          onValueChange={(val: ImageDisplayMode) => setImageDisplayMode(val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择模式" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">标准模式 (2MP)</SelectItem>
                            <SelectItem value="square">中图模式 (约 500x500)</SelectItem>
                            <SelectItem value="small">小图模式 (约 200x200)</SelectItem>
                            <SelectItem value="collapsed">折叠模式 (默认隐藏)</SelectItem>
                            <SelectItem value="custom">自定义总像素</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {imageDisplayMode === "custom" && (
                        <div className="grid gap-4 pl-4 border-l-2 border-primary/20">
                          <Label>自定义全局最大像素</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={maxImageResolution}
                              onChange={(e) => setMaxImageResolution(Number.parseInt(e.target.value) || 1000000)}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            设置显示图片的总像素限制。例如 1000000 (100万像素) 约为 1000x1000 大小。
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="personalization" className="space-y-4 py-4">
                      <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                          <Label htmlFor="chat-frame" className="cursor-pointer">
                            聊天背景框
                          </Label>
                        </div>
                        <Switch id="chat-frame" checked={showChatFrame} onCheckedChange={setShowChatFrame} />
                      </div>

                      {showChatFrame && (
                        <div className="grid gap-4 px-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm flex items-center gap-2">
                              <SlidersHorizontal className="w-3 h-3" /> 边框宽度 ({chatFrameWidth}px)
                            </Label>
                          </div>
                          <Slider
                            min={400}
                            max={1600}
                            step={50}
                            value={[chatFrameWidth]}
                            onValueChange={(vals) => setChatFrameWidth(vals[0])}
                          />
                        </div>
                      )}

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <span>用户头像</span>
                          {userAvatar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUserAvatar("")}
                              className="h-6 px-2 text-xs"
                            >
                              恢复默认
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary border flex-shrink-0">
                            {userAvatar ? (
                              <img src={userAvatar || "/placeholder.svg"} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 m-2 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSettingFileUpload(e, "user")}
                            className="text-sm cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <span>助手头像</span>
                          {botAvatar && (
                            <Button variant="ghost" size="sm" onClick={() => setBotAvatar("")} className="h-6 px-2 text-xs">
                              恢复默认
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary border flex-shrink-0">
                            {botAvatar ? (
                              <img src={botAvatar || "/placeholder.svg"} className="w-full h-full object-cover" />
                            ) : (
                              <Bot className="w-6 h-6 m-2 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSettingFileUpload(e, "bot")}
                            className="text-sm cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <span>背景图片</span>
                          {backgroundImage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBackgroundImage("")}
                              className="h-6 px-2 text-xs"
                            >
                              恢复默认
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded-md overflow-hidden bg-secondary border flex-shrink-0 relative">
                            {backgroundImage ? (
                              <img src={backgroundImage || "/placeholder.svg"} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 m-auto mt-2.5 text-muted-foreground" />
                            )}
                          </div>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSettingFileUpload(e, "bg")}
                            className="text-sm cursor-pointer"
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* 右上角功能区域 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => window.location.href = '/'}
            title="返回主页"
          >
            <Home className="w-5 h-5" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Palette className="w-4 h-4 mr-2" />
                功能区
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => setIsComfyUIOpen(true)}
                >
                  ComfyUI
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => router.push('/game')}
                >
                  挂机农场
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div
            className={cn(
              "min-h-full py-6 transition-all duration-300",
              showChatFrame
                ? "bg-card/80 border-x border-border/60 shadow-xl mx-auto px-4 sm:px-8"
                : "w-full px-4 sm:px-6 lg:px-8",
            )}
            style={{
              maxWidth: showChatFrame ? `${chatFrameWidth}px` : undefined,
            }}
          >
            <div className={cn("mx-auto space-y-6 pb-4", !showChatFrame && "max-w-3xl")}>
              {messages.length === 0 && !isStorageLoaded && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4 bg-card/30 backdrop-blur-sm p-8 rounded-3xl mx-auto mt-10">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">加载中...</h3>
                  </div>
                </div>
              )}
              {messages.length === 0 && isStorageLoaded && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center text-muted-foreground space-y-4 bg-card/30 backdrop-blur-sm p-8 rounded-3xl mx-auto mt-10">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">欢迎使用 n8n AI</h3>
                    <p className="text-sm opacity-80">配置 Webhook URL 开始对话</p>
                  </div>
                </div>
              )}

              <div className={cn("max-w-[800px] mx-auto w-full", showChatFrame && "my-4")}>
                <div className="space-y-6 py-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      ref={(el) => { messageRefs.current[message.id] = el }}
                      className={cn(
                        "flex gap-4 p-4 rounded-xl transition-colors relative group",
                        message.role === "assistant" ? "bg-muted/50" : "bg-[#4DC3FE]/50 text-black flex-row-reverse",
                        isBatchMode && "cursor-pointer hover:bg-muted",
                      )}
                      onClick={() => isBatchMode && toggleMessageSelection(message.id)}
                    >
                      {isBatchMode && (
                        <div className="flex items-center justify-center mr-2">
                          <Checkbox checked={selectedMessageIds.has(message.id)} />
                        </div>
                      )}

                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-background border border-border">
                        {message.role === "assistant" ? (
                          botAvatar ? (
                            <img
                              src={botAvatar || "/placeholder.svg"}
                              alt="Bot"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Bot className="w-5 h-5 text-primary" />
                          )
                        ) : userAvatar ? (
                          <img
                            src={userAvatar || "/placeholder.svg"}
                            alt="User"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-primary" />
                        )}
                      </div>

                      <div className={cn("flex-1 min-w-0 space-y-2")}>
                        <div
                          className={cn(
                            "flex items-center justify-between",
                            message.role === "user" && "flex-row-reverse",
                          )}
                        >
                          <span className="font-medium text-sm">
                            {message.role === "assistant" ? effectiveAiRoleName : effectiveUserRoleName}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {message.image && (
                          <MessageImage
                            src={message.image}
                            mode={activeMode}
                            customMaxPixels={activeCustomRes}
                          />
                        )}
                        {editingMessageId === message.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(message.id)}>
                                保存
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "prose prose-sm max-w-none break-words whitespace-pre-wrap leading-relaxed",
                              message.role === "assistant" ? "dark:prose-invert" : "text-black prose-invert",
                            )}
                          >
                            {message.content}
                          </div>
                        )}

                        {!isBatchMode && (
                        <div
                          className={cn(
                            "flex gap-1 mt-2",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                            <div className="flex gap-1 bg-background/80 backdrop-blur rounded-md p-1 shadow-sm border border-border">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => copyMessage(message.content, message.id)}
                                title="复制文本"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => copyMessageAsImage(message.id)}
                                title="生成截图"
                              >
                                {copiedMessageId === `img-${message.id}` ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Camera className="w-3 h-3" />
                                )}
                              </Button>
                              {message.role === "assistant" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleRegenerate(message.id)}
                                  title="重新生成"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}
                              
                              {/* 用户重新发送按钮 */}
                              {message.role === "user" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleUserResend(message.id, message.content)}
                                  title="重新发送 (将截断后续历史)"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}

                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditing(message)}
                                  title="编辑"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => setMessageToDelete(message.id)}
                                  title="删除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            </div>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 w-full justify-start">
                      <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center mt-1 overflow-hidden border border-border/50">
                        {botAvatar ? (
                          <img src={botAvatar || "/placeholder.svg"} alt="Bot" className="w-full h-full object-cover" />
                        ) : (
                          <Bot className="w-4 h-4 text-secondary-foreground" />
                        )}
                      </div>
                      <div className="bg-card border border-border text-card-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{waitingText}</span>
                      </div>
                    </div>
                  )}
                  <div ref={endOfMessagesRef} />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur hover:bg-accent opacity-60 hover:opacity-100 transition-all"
            onClick={scrollToTop}
            title="回到顶部"
          >
            <ArrowUpToLine className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur hover:bg-accent opacity-60 hover:opacity-100 transition-all"
            onClick={scrollToBottom}
            title="跳到底部"
          >
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="py-2 px-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-center">
        <div
          className="w-full transition-all duration-300"
          style={{ maxWidth: showChatFrame ? `${chatFrameWidth}px` : "768px" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-2 text-muted-foreground bg-transparent flex-shrink-0"
                >
                  <MessageSquare className="w-3 h-3" /> 常用语
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="flex flex-col gap-1">
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {commonPhrases.map((phrase, idx) => (
                      <div key={idx} className="flex items-center gap-1 group">
                        {editingPhraseIndex === idx ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editPhraseText}
                              onChange={(e) => setEditPhraseText(e.target.value)}
                              className="h-7 text-xs"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateCommonPhrase(idx)}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setEditingPhraseIndex(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start font-normal h-8 flex-1 truncate"
                              onClick={() => setInput((prev) => prev + phrase)}
                            >
                              {phrase}
                            </Button>
                            <div className="hidden group-hover:flex items-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingPhraseIndex(idx)
                                  setEditPhraseText(phrase)
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteCommonPhrase(idx)
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-2 mt-1 flex gap-1">
                    <Input
                      placeholder="添加新常用语..."
                      value={newPhraseText}
                      onChange={(e) => setNewPhraseText(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button size="sm" variant="secondary" onClick={addCommonPhrase} disabled={!newPhraseText.trim()}>
                      添加
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {customButtons.map((btn) => (
                <Button
                  key={btn.id}
                  variant={btn.isActive ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs flex-shrink-0 gap-1",
                    btn.isActive && "ring-2 ring-primary ring-offset-2",
                  )}
                  onClick={() => handleCustomButtonClick(btn)}
                  title={btn.isActive ? "已激活：发送时将附带参数" : "点击激活"}
                >
                  {btn.label}
                </Button>
              ))}
              <Dialog open={isManageButtonsOpen} onOpenChange={setIsManageButtonsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Plus className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>管理自定义按钮</DialogTitle>
                    <DialogDescription>添加或删除快捷按钮，激活后发送消息会自动附带参数。</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label>按钮名称</Label>
                      <Input
                        value={newButtonLabel}
                        onChange={(e) => setNewButtonLabel(e.target.value)}
                        placeholder="例如：总结全文"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>JSON 参数</Label>
                      <Textarea
                        value={newButtonParams}
                        onChange={(e) => setNewButtonParams(e.target.value)}
                        placeholder='{"action": "summarize"}'
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button onClick={addCustomButton} disabled={!newButtonLabel}>
                      添加按钮
                    </Button>

                    <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
                      <Label>已添加的按钮</Label>
                      {customButtons.length === 0 && <p className="text-sm text-muted-foreground">暂无自定义按钮</p>}
                      {customButtons.map((btn) => (
                        <div key={btn.id} className="flex items-center justify-between p-2 border rounded-md">
                          <span className="text-sm font-medium">{btn.label}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => deleteCustomButton(btn.id, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

            </div>
          </div>

          {/* ComfyUI Dialog */}
          <Dialog open={isComfyUIOpen} onOpenChange={setIsComfyUIOpen}>
            <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>ComfyUI 功能</DialogTitle>
              </DialogHeader>
              <ComfyUIMain onClose={() => setIsComfyUIOpen(false)} />
            </DialogContent>
          </Dialog>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="relative flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isStorageLoaded ? `输入消息... (Enter 发送, Shift+Enter 换行)` : "正在连接本地存储..."}
              className="min-h-[44px] max-h-[200px] resize-none py-3 px-4 rounded-xl border-border focus:ring-1 focus:ring-primary pr-12 scrollbar-hide"
              disabled={!isStorageLoaded}
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className={cn(
                "absolute right-2 bottom-2 h-8 w-8 rounded-lg transition-all",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}