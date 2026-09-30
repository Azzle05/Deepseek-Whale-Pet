// 预加载脚本：通过 contextBridge 暴露安全的桌宠 API 给渲染层
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pet', {
  // 余额
  getBalance: () => ipcRenderer.invoke('pet:get-balance'),
  // 屏幕/位置
  getScreen: () => ipcRenderer.invoke('pet:get-screen'),
  getPosition: () => ipcRenderer.invoke('pet:get-position'),
  setPosition: (x, y) => ipcRenderer.invoke('pet:set-position', { x, y }),
  // 拖动期间的无 Promise 快速通道；主进程会合并同一时刻的移动请求
  setPositionFast: (x, y) => ipcRenderer.send('pet:set-position-fast', { x, y }),
  // 尺寸
  getSize: () => ipcRenderer.invoke('pet:get-size'),
  setScale: (scale) => ipcRenderer.invoke('pet:set-scale', { scale }),
  // 配置
  getConfig: () => ipcRenderer.invoke('pet:get-config'),
  getFullConfig: () => ipcRenderer.invoke('pet:get-full-config'),
  saveApiKey: (apiKey) => ipcRenderer.invoke('pet:save-key', { apiKey }),
  saveSettings: (settings) => ipcRenderer.invoke('pet:save-settings', settings),
  // 统计
  getStats: () => ipcRenderer.invoke('pet:get-stats'),
  // 横条窗口数据
  updateBar: (data) => ipcRenderer.invoke('pet:update-bar', data),
  // 系统内存
  getMemory: () => ipcRenderer.invoke('pet:get-memory'),
  // 自动更新
  getUpdateStatus: () => ipcRenderer.invoke('pet:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('pet:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('pet:download-update'),
  installUpdate: () => ipcRenderer.invoke('pet:install-update'),
  openUpdateReleases: () => ipcRenderer.invoke('pet:open-update-releases'),
  // 闲置透明度
  setIdle: (idle) => ipcRenderer.invoke('pet:set-idle', { idle }),
  // 鼠标穿透（闲置时透明区域不挡点击）
  setMouseThrough: (ignore) => ipcRenderer.invoke('pet:set-ignore-mouse', { ignore }),
  // 图片
  getImageUrl: () => ipcRenderer.invoke('pet:get-image-url'),
  chooseImage: () => ipcRenderer.invoke('pet:choose-image'),
  // 自定义点击音效
  getAudioUrl: () => ipcRenderer.invoke('pet:get-audio-url'),
  chooseAudio: () => ipcRenderer.invoke('pet:choose-audio'),
  // 实验性 Agent 状态动画
  getAgentAssets: (agent, state) => ipcRenderer.invoke('pet:get-agent-assets', { agent, state }),
  getAgentStatus: () => ipcRenderer.invoke('pet:get-agent-status'),
  getCodexHookStatus: () => ipcRenderer.invoke('pet:get-codex-hook-status'),
  installCodexHook: () => ipcRenderer.invoke('pet:install-codex-hook'),
  uninstallCodexHook: () => ipcRenderer.invoke('pet:uninstall-codex-hook'),
  getClaudeHookStatus: () => ipcRenderer.invoke('pet:get-claude-hook-status'),
  installClaudeHook: () => ipcRenderer.invoke('pet:install-claude-hook'),
  uninstallClaudeHook: () => ipcRenderer.invoke('pet:uninstall-claude-hook'),
  getHarnessHookStatus: () => ipcRenderer.invoke('pet:get-harness-hook-status'),
  installHarnessHook: () => ipcRenderer.invoke('pet:install-harness-hook'),
  uninstallHarnessHook: () => ipcRenderer.invoke('pet:uninstall-harness-hook'),
  setAgentState: (agent, state) => ipcRenderer.invoke('pet:set-agent-state', { agent, state }),
  wakeAgent: (agent) => ipcRenderer.invoke('pet:wake-agent', { agent }),
  // 事件
  onRefreshRequested: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('pet:refresh', listener)
    return () => ipcRenderer.removeListener('pet:refresh', listener)
  },
  onConfigUpdated: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('pet:config-updated', listener)
    return () => ipcRenderer.removeListener('pet:config-updated', listener)
  },
  onBarData: (cb) => {
    const listener = (_e, data) => cb(data)
    ipcRenderer.on('pet:bar-data', listener)
    return () => ipcRenderer.removeListener('pet:bar-data', listener)
  },
  onAgentState: (cb) => {
    const listener = (_e, data) => cb(data)
    ipcRenderer.on('pet:agent-state', listener)
    return () => ipcRenderer.removeListener('pet:agent-state', listener)
  },
  onAgentStatus: (cb) => {
    const listener = (_e, data) => cb(data)
    ipcRenderer.on('pet:agent-status', listener)
    return () => ipcRenderer.removeListener('pet:agent-status', listener)
  },
  onUpdateStatus: (cb) => {
    const listener = (_e, data) => cb(data)
    ipcRenderer.on('pet:update-status', listener)
    return () => ipcRenderer.removeListener('pet:update-status', listener)
  },
  // 其它
  openSettings: () => ipcRenderer.invoke('pet:open-settings'),
  quit: () => ipcRenderer.invoke('pet:quit'),
})
