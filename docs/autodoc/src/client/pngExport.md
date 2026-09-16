# src/client/pngExport.ts

> 最近分析：2026-08-29 · 文件哈希：2455fbed · 变更 2 次

## 业务接口

### downloadSvgAsPng `async downloadSvgAsPng(svg: string, fileName: string, width = 540, height = 720): Promise<void>`

**用途**：SVG 字符串栅格化为 PNG 并触发浏览器下载
**内部调用**：业务 → `triggerDownload` · 未解析 → `resolve`, `reject`
**最近变更**：08-29 新增

### triggerDownload `triggerDownload(blob: Blob, fileName: string): void`

**用途**：用 <a download> 触发浏览器下载 Blob
**内部调用**：未解析 → `setTimeout`
**最近变更**：08-29 新增

## 实现接口

（无）

## 辅助/工具函数

（无）
