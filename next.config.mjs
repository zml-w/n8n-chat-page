/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 忽略 TS 构建错误 (保持你的原设置)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 2. 图片配置 (保持你的原设置)
  images: {
    unoptimized: true,
  },

  // 3. 【核心修复】解决聊天记录存储不全的问题
  // 将 Server Actions 的请求体限制从默认的 1MB 提升到 50MB
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // 注意：我移除了 'eslint' 块（Next.js 16 不再支持在 config 中配置）
  // 注意：我移除了 'webpack' 块（为了兼容 Next.js 16 的 Turbopack 默认模式）
}

export default nextConfig