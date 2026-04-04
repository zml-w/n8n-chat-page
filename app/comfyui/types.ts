export interface ComfyUIConfig {
  apiUrl: string;
  uiWidth?: number;  // 容器宽度
  uiHeight?: number; // 容器高度
  tabText?: string;  // 标签页自定义文本
}

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  content: any;
  createdAt: string;
  originalContent?: string; // 保存原始的JSON字符串，包含模板变量
  saveImages?: boolean; // 是否保存生成的图像到专属文件夹
}

export interface ComfyUIExecutionParams {
  prompt: string;
  width: number;
  height: number;
}

export interface LoadComfyUIConfigResult {
  success: boolean;
  data: ComfyUIConfig;
  error?: string;
}

export interface LoadComfyUIWorkflowsResult {
  success: boolean;
  data: ComfyUIWorkflow[];
  error?: string;
}

export interface ComfyUIExecutionResult {
  success: boolean;
  images?: string[];
  error?: string;
  message?: string;
}