// DeepSeek 余额桌宠 —— 主进程
// 透明置顶桌宠窗口、余额代理、配置/位置/尺寸持久化、设置窗口、单实例。
// 功能：低余额提醒、开机自启、消耗统计、闲置半透明、托盘、全局热键、自定义图片等。
'use strict'

const { app, BrowserWindow, ipcMain, screen, nativeImage, Tray, Menu, Notification, dialog, globalShortcut, shell } = require('electron')

// 允许 Web Audio 无需用户手势即可播放（余额刷新是后台动作）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { Readable, Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { pathToFileURL } = require('node:url')

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const UPDATE_REPO = 'Azzle05/Deepseek-Whale-Pet'
const UPDATE_RELEASES_URL = 'https://github.com/' + UPDATE_REPO + '/releases/latest'
const DEFAULT_SIZE = 196
const MIN_SIZE = 96
const MAX_SIZE = 588
const MIN_SCALE = 0.6
const MAX_SCALE = 3
const BAR_HEIGHT = 84
const AGENT_IDS = ['codex', 'claudecode', 'harness']
const AGENT_STATES = [
  'idle', 'link', 'wait', 'think', 'tool', 'run', 'reply',
  'approval', 'error', 'interrupted', 'done', 'hover', 'sleep', 'click',
  'low_balance', 'balance_increase', 'dragging',
]
const AGENT_STATE_FALLBACKS = {
  idle: ['sleep'],
  link: ['wait', 'think'],
  wait: ['link', 'think'],
  think: ['reply', 'run'],
  tool: ['run', 'think'],
  run: ['tool', 'think'],
  reply: ['think', 'done'],
  approval: ['wait'],
  error: ['interrupted'],
  interrupted: ['error'],
  done: ['idle'],
  hover: ['idle'],
  sleep: ['idle'],
  click: [],
  low_balance: ['idle'],
  balance_increase: ['idle'],
  dragging: ['idle'],
}
const AGENT_STATUS_FRESH_MS = 5 * 60 * 1000
const CODEX_WATCH_INTERVAL_MS = 800
const CODEX_HOOK_WATCH_INTERVAL_MS = 250
const CODEX_DONE_HOLD_MS = 4000
const DEFAULT_SLEEP_MINUTES = 10
const MIN_SLEEP_MINUTES = 1
const MAX_SLEEP_MINUTES = 60
const CODEX_TAIL_CHUNK_BYTES = 512 * 1024
const CODEX_MAX_PENDING_BYTES = 4 * 1024 * 1024
const CODEX_DETAIL_LIMIT = 120
const CODEX_HOOK_MARKER = 'deepseek-whale-pet-codex-hook.ps1'
const CODEX_HOOK_LEGACY_MARKER = 'codex-hook.ps1'
const CODEX_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
  'Interrupt',
  'SessionEnd',
]
const CLAUDE_HOOK_WATCH_INTERVAL_MS = 250
const CLAUDE_DONE_HOLD_MS = 4000
const CLAUDE_TAIL_CHUNK_BYTES = 512 * 1024
const CLAUDE_MAX_PENDING_BYTES = 4 * 1024 * 1024
const CLAUDE_HOOK_MARKER = 'deepseek-whale-pet-claude-hook.ps1'
const CLAUDE_HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'Notification',
  'PreCompact',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'SessionEnd',
]
const HARNESS_HOOK_WATCH_INTERVAL_MS = 250
const HARNESS_DONE_HOLD_MS = 4000
const HARNESS_TAIL_CHUNK_BYTES = 512 * 1024
const HARNESS_MAX_PENDING_BYTES = 4 * 1024 * 1024
const HARNESS_BRIDGE_ID = 'whale-pet-harness-bridge'
const HARNESS_BRIDGE_PACKAGE = 'dsh-whale-pet-harness-bridge'
const HARNESS_PATCH_BEGIN = '# BEGIN DeepSeek Whale Pet Harness bridge'
const HARNESS_PATCH_END = '# END DeepSeek Whale Pet Harness bridge'
const HARNESS_PROFILE = 'web'

// ---------------------------------------------------------------------------
// 配置（AppData/deepseek-whale-pet/config.json）
// ---------------------------------------------------------------------------
const configPath = () => path.join(app.getPath('userData'), 'config.json')
const historyPath = () => path.join(app.getPath('userData'), 'history.json')
const customImagePath = () => path.join(app.getPath('userData'), 'custom-whale.png')
const customAudioPath = () => path.join(app.getPath('userData'), 'custom-click.mp3')

function defaultConfig() {
  return {
    apiKey: '',
    balanceUrl: '',
    snap: true,
    label: 'DeepSeek 余额',
    refreshSec: 30,
    scale: 1,
    x: null,
    y: null,
    lowBalanceAlert: true,
    lowThreshold: 5,
    autoStart: false,
    idleTransparency: true,
    idleSec: 5,
    trackStats: true,
    bounceAnim: true,
    decreaseHintEnabled: true,
    sound: true,
    volume: 0.7,
    bounceStrength: 'normal',
    sleepMinutes: DEFAULT_SLEEP_MINUTES, // 1-60 分钟，空闲后进入睡眠
    bubbleMode: 'click',      // always | hover | click 气泡显示模式
    clickSound: true,          // 点击气泡时的音效开关
    clickSoundSet: 'duck',     // duck | fx1 | custom 点击音效类型
    quotesEnabled: false,
    quotesText: '',
    contentMode: 'balance',   // balance | memory 显示内容：余额 / 系统内存
    memoryStyle: 'fill',      // fill | bubble 内存显示方式：图形填充 / 气泡显示
    displayStyle: 'bubble',    // bubble | bar 桌宠显示方式：气泡 / 横条
    customImage: false,
    hotkey: true,
    showTime: true,
    displayMode: 'tray',   // all | taskbar | tray | hidden
    alwaysOnTop: true,      // 是否始终置顶
    agentAnimationEnabled: false, // 实验性：Agent 状态 GIF 动画
    agentType: 'codex',          // codex | claudecode | harness
    agentClickAnimation: true,   // 点击鲸鱼时播放 click 状态 GIF
    codexHookEnabled: false,     // 通过 Codex Hook 获取低延迟状态事件
    claudeHookEnabled: false,    // 通过 Claude Code Hook 获取低延迟状态事件
    harnessHookEnabled: false,   // 通过 DeepSeek Harness bridge 获取低延迟状态事件
  }
}

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
    return { ...defaultConfig(), ...c }
  } catch {
    return defaultConfig()
  }
}

function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch }
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.error('[whale-pet] save config failed:', err)
  }
  return next
}

const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback

function rendererConfig(c, includeSecrets) {
  const contentMode = c.contentMode === 'memory' ? 'memory' : 'balance'
  const data = {
    hasKey: !!String(c.apiKey || '').trim(),
    scale: c.scale,
    snap: c.snap !== false,
    label: c.label || 'DeepSeek 余额',
    refreshSec: c.refreshSec,
    lowBalanceAlert: !!c.lowBalanceAlert,
    lowThreshold: c.lowThreshold,
    idleTransparency: c.idleTransparency !== false,
    idleSec: c.idleSec,
    trackStats: c.trackStats !== false,
    bounceAnim: c.bounceAnim !== false,
    decreaseHintEnabled: c.decreaseHintEnabled !== false,
    sound: c.sound !== false,
    quotesEnabled: !!c.quotesEnabled,
    quotesText: c.quotesText || '',
    contentMode,
    memoryStyle: c.memoryStyle === 'bubble' ? 'bubble' : 'fill',
    displayStyle: contentMode === 'memory' || c.displayStyle !== 'bar' ? 'bubble' : 'bar',
    volume: c.volume,
    bounceStrength: oneOf(c.bounceStrength, ['minimal', 'soft', 'normal', 'strong'], 'normal'),
    sleepMinutes: clamp(Number(c.sleepMinutes) || DEFAULT_SLEEP_MINUTES, MIN_SLEEP_MINUTES, MAX_SLEEP_MINUTES),
    bubbleMode: oneOf(c.bubbleMode, ['always', 'hover', 'click'], 'click'),
    clickSound: c.clickSound !== false,
    clickSoundSet: oneOf(c.clickSoundSet, ['duck', 'fx1', 'custom'], 'duck'),
    customImage: !!c.customImage,
    hotkey: c.hotkey !== false,
    autoStart: !!c.autoStart,
    displayMode: oneOf(c.displayMode, ['all', 'taskbar', 'tray', 'hidden'], 'tray'),
    alwaysOnTop: c.alwaysOnTop !== false,
    showTime: c.showTime !== false,
    agentAnimationEnabled: !!c.agentAnimationEnabled,
    agentType: oneOf(c.agentType, AGENT_IDS, 'codex'),
    agentClickAnimation: c.agentClickAnimation !== false,
    codexHookEnabled: !!c.codexHookEnabled,
    claudeHookEnabled: !!c.claudeHookEnabled,
    harnessHookEnabled: !!c.harnessHookEnabled,
  }
  if (includeSecrets) {
    data.apiKey = c.apiKey
    data.balanceUrl = c.balanceUrl || ''
  }
  return data
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const petSize = (scale) => Math.round(clamp(DEFAULT_SIZE * scale, MIN_SIZE, MAX_SIZE))

let petWin = null
let barWin = null
let settingsWin = null
let tray = null
let latestBarData = null
let balanceCache = null
let balanceInFlight = null
let posSaveTimer = null
let balanceFetchCount = 0
let stats = { today: '', todayUsed: 0, lastBalance: null }
let lastLowAlertAt = 0
let cfg = loadConfig()
let petRendererReady = false
let latestAgentEvent = null
let agentEventSeq = 0
let latestUpdateRelease = null
let downloadedUpdatePath = ''
let updateDownloadInFlight = null
let agentRuntimeStatus = {
  source: '',
  agent: '',
  state: '',
  event: '',
  detail: '',
  updatedAt: 0,
  watcherActive: false,
  watcherPath: '',
  hookWatcherActive: false,
  hookPath: '',
  claudeHookWatcherActive: false,
  claudeHookPath: '',
  harnessHookWatcherActive: false,
  harnessHookPath: '',
}
let agentStatusByAgent = {
  codex: { agent: 'codex', source: '', state: '', event: '', detail: '', updatedAt: 0 },
  claudecode: { agent: 'claudecode', source: '', state: '', event: '', detail: '', updatedAt: 0 },
  harness: { agent: 'harness', source: '', state: '', event: '', detail: '', updatedAt: 0 },
}
let codexWatcher = null
let codexHookWatcher = null
let codexDoneIdleTimer = null
let agentIdleToSleepTimer = null
let agentIdleToSleepAgent = ''
let lastCodexHookEventAt = 0
let codexHookLastError = ''
let claudeHookWatcher = null
let claudeDoneIdleTimer = null
let claudeHookLastError = ''
let harnessHookWatcher = null
let harnessDoneIdleTimer = null
let harnessHookLastError = ''

// ---------------------------------------------------------------------------
// 消耗统计（按自然日累计，持久化到 history.json）
// ---------------------------------------------------------------------------
function todayKey() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

function loadStats() {
  try {
    const h = JSON.parse(fs.readFileSync(historyPath(), 'utf8'))
    const today = todayKey()
    if (h.today === today) {
      stats = { today, todayUsed: h.todayUsed || 0, lastBalance: typeof h.lastBalance === 'number' ? h.lastBalance : null }
    } else {
      stats = { today, todayUsed: 0, lastBalance: typeof h.lastBalance === 'number' ? h.lastBalance : null }
    }
  } catch {
    stats = { today: todayKey(), todayUsed: 0, lastBalance: null }
  }
  return stats
}

function saveStats() {
  try {
    fs.mkdirSync(path.dirname(historyPath()), { recursive: true })
    fs.writeFileSync(historyPath(), JSON.stringify(stats), 'utf8')
  } catch (err) { /* ignore */ }
}

function recordBalance(nb) {
  if (typeof nb !== 'number' || !isFinite(nb)) return
  if (stats.lastBalance !== null && nb < stats.lastBalance) {
    stats.todayUsed = Math.round((stats.todayUsed + (stats.lastBalance - nb)) * 100) / 100
  }
  stats.lastBalance = nb
  saveStats()
}

// ---------------------------------------------------------------------------
// 低余额提醒
// ---------------------------------------------------------------------------
function notifyLowBalance(total, currency) {
  const now = Date.now()
  // 至少 10 分钟内不重复提醒
  if (now - lastLowAlertAt < 10 * 60 * 1000) return
  lastLowAlertAt = now
  const sym = currency === 'CNY' ? '¥' : (currency || '')
  const n = new Notification({
    title: '🐋 DeepSeek 余额不足提醒',
    body: '当前余额：' + sym + ' ' + Number(total).toFixed(2) + ' ' + (currency || '') + '\n记得及时充值，避免任务中断～',
  })
  n.show()
}

// ---------------------------------------------------------------------------
// 桌宠窗口
// ---------------------------------------------------------------------------
let startupServicesScheduled = false

function scheduleStartupServices() {
  if (startupServicesScheduled) return
  startupServicesScheduled = true
  setImmediate(() => {
    if (petWin && !petWin.isDestroyed()) applyDisplayMode(cfg.displayMode)
    syncBarWindow()
    updateHotkey(cfg.hotkey)
    syncCodexHookInstallation()
    syncClaudeHookInstallation()
    syncHarnessHookInstallation()
    updateAgentWatcher()
  })
}

function createPetWindow(posOverride) {
  petRendererReady = false
  const size = petSize(cfg.scale)
  const wa = screen.getPrimaryDisplay().workArea
  const mode = cfg.displayMode || 'all'
  // 任务栏图标只在 all / taskbar 模式显示（运行时 setSkipTaskbar 在 Windows 上不可靠，
  // 必须在创建窗口时用 skipTaskbar 参数决定）
  const skipTaskbar = (mode === 'tray' || mode === 'hidden')

  let x = cfg.x
  let y = cfg.y
  if (posOverride && typeof posOverride.x === 'number' && typeof posOverride.y === 'number') {
    x = posOverride.x
    y = posOverride.y
  }
  if (typeof x !== 'number' || typeof y !== 'number' ||
      x < wa.x - size || x > wa.x + wa.width - 1 ||
      y < wa.y - size || y > wa.y + wa.height - 1) {
    x = wa.x + wa.width - size
    y = wa.y + wa.height - size
  }

  petWin = new BrowserWindow({
    width: size,
    height: size,
    x,
    y,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  petWin.setAlwaysOnTop(true, 'screen-saver')
  petWin.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  petWin.webContents.on('did-finish-load', () => {
    petRendererReady = true
    flushPendingAgentEvent()
    scheduleStartupServices()
  })
  petWin.once('ready-to-show', () => {
    petWin.show()
    petWin.focus()
  })
  petWin.on('closed', () => {
    petRendererReady = false
    petWin = null
  })
}

function barSize(scale) {
  const pet = petSize(scale)
  return {
    width: Math.round(clamp(pet * 1.46, 268, 320)),
    height: BAR_HEIGHT,
  }
}

function barBoundsForPet() {
  if (!petWin || petWin.isDestroyed()) return null
  const pet = petWin.getBounds()
  const size = barSize(cfg.scale)
  const work = screen.getDisplayMatching(pet).workArea
  let x = pet.x + Math.round(pet.width * 0.46) - size.width
  let y = pet.y + pet.height - size.height - Math.max(4, Math.round(pet.height * 0.03))
  x = Math.round(clamp(x, work.x, Math.max(work.x, work.x + work.width - size.width)))
  y = Math.round(clamp(y, work.y, Math.max(work.y, work.y + work.height - size.height)))
  return { x, y, width: size.width, height: size.height }
}

function createBarWindow() {
  if (barWin && !barWin.isDestroyed()) return
  const bounds = barBoundsForPet()
  barWin = new BrowserWindow({
    ...(bounds || { width: 270, height: BAR_HEIGHT }),
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  barWin.setAlwaysOnTop(true, 'screen-saver')
  barWin.setIgnoreMouseEvents(true)
  barWin.loadFile(path.join(__dirname, 'renderer', 'bar.html'))
  barWin.webContents.on('did-finish-load', () => {
    if (latestBarData && barWin && !barWin.isDestroyed()) {
      barWin.webContents.send('pet:bar-data', latestBarData)
    }
  })
  barWin.once('ready-to-show', () => {
    if (barWin && !barWin.isDestroyed()) {
      barWin.showInactive()
      if (petWin && !petWin.isDestroyed()) petWin.moveTop()
    }
  })
  barWin.on('closed', () => { barWin = null })
}

function syncBarWindow() {
  const c = cfg
  const shouldShow = c.displayStyle === 'bar' && c.contentMode !== 'memory'
  if (!shouldShow) {
    if (barWin && !barWin.isDestroyed()) barWin.hide()
    return
  }
  if (!barWin || barWin.isDestroyed()) createBarWindow()
  if (!barWin || barWin.isDestroyed()) return
  const bounds = barBoundsForPet()
  if (bounds) barWin.setBounds(bounds)
  barWin.setAlwaysOnTop(c.alwaysOnTop !== false, 'screen-saver')
  barWin.setIgnoreMouseEvents(true)
  if (!barWin.isVisible()) {
    barWin.showInactive()
    if (petWin && !petWin.isDestroyed()) petWin.moveTop()
  }
}

function syncBarBounds() {
  if (!barWin || barWin.isDestroyed() || !barWin.isVisible()) return
  const bounds = barBoundsForPet()
  if (bounds) barWin.setBounds(bounds)
}

// 运行时 setSkipTaskbar 在 Windows 上不可靠，切换任务栏显隐需重建窗口
function recreatePetWindow() {
  const pos = petWin && !petWin.isDestroyed() ? petWin.getPosition() : null
  if (petWin && !petWin.isDestroyed()) petWin.destroy()
  petWin = null
  createPetWindow(pos ? { x: pos[0], y: pos[1] } : null)
  applyDisplayMode(cfg.displayMode)
  syncBarWindow()
}

function schedulePosSave() {
  if (posSaveTimer) clearTimeout(posSaveTimer)
  posSaveTimer = setTimeout(() => {
    posSaveTimer = null
    if (!petWin || petWin.isDestroyed()) return
    const [x, y] = petWin.getPosition()
    cfg = saveConfig({ x, y })
  }, 500)
}

// ---------------------------------------------------------------------------
// 余额拉取（主进程代理，key 不出主进程）
// ---------------------------------------------------------------------------
async function fetchBalance() {
  balanceFetchCount++
  if (balanceInFlight) return balanceInFlight
  balanceInFlight = (async () => {
    const cfgNow = loadConfig()
    const key = cfgNow.apiKey.trim()
    const url = (cfgNow.balanceUrl || '').trim() || BALANCE_URL
    if (!key) {
      return { ok: false, code: 'NO_KEY', error: '未配置 API Key（右键小鲸鱼 → 设置）' }
    }
    try {
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(20000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (data && data.error && (data.error.message || data.error)) || ('HTTP ' + res.status)
        const payload = { ok: false, code: 'HTTP_' + res.status, error: String(msg).slice(0, 200), transient: res.status >= 500 }
        if (!payload.transient) console.error('[whale-pet]', payload.code, payload.error)
        return payload
      }
      const info = Array.isArray(data.balance_infos) && data.balance_infos[0]
      if (!info) return { ok: false, code: 'EMPTY', error: '接口未返回余额数据', transient: true }
      const payload = {
        ok: true,
        totalBalance: info.total_balance,
        currency: info.currency || 'CNY',
        isAvailable: info.is_available !== false,
        grantedBalance: info.granted_balance,
        toppedUpBalance: info.topped_up_balance,
      }
      balanceCache = { at: Date.now(), payload }
      // 消耗统计
      if (cfgNow.trackStats) {
        recordBalance(Number(payload.totalBalance))
      }
      // 低余额提醒
      if (cfgNow.lowBalanceAlert && Number(payload.totalBalance) > 0 && Number(payload.totalBalance) < Number(cfgNow.lowThreshold)) {
        notifyLowBalance(payload.totalBalance, payload.currency)
      }
      return payload
    } catch (err) {
      const msg = String((err && err.message) || err).slice(0, 200)
      if (balanceCache && Date.now() - balanceCache.at < 10 * 60 * 1000) {
        return { ...balanceCache.payload, stale: true, error: msg }
      }
      return { ok: false, code: 'ERROR', error: msg, transient: true }
    } finally {
      balanceInFlight = null
    }
  })()
  return balanceInFlight
}

// ---------------------------------------------------------------------------
// 设置窗口
// ---------------------------------------------------------------------------
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 720,
    minWidth: 560,
    minHeight: 620,
    title: 'DeepSeek 鲸鱼桌宠 · 设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  settingsWin.setMenuBarVisibility(false)
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'))
  settingsWin.once('ready-to-show', () => settingsWin.show())
  settingsWin.on('closed', () => {
    settingsWin = null
    resetManualAgentTest()
  })
}

// ---------------------------------------------------------------------------
// 便携版自动更新
// ---------------------------------------------------------------------------
let updateState = {
  phase: 'idle',
  message: '尚未检查更新',
  currentVersion: '',
  latestVersion: '',
  updateAvailable: false,
  canDownload: false,
  readyToInstall: false,
  downloadable: false,
  releaseNotes: '',
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  sha256Verified: false,
  releasesUrl: UPDATE_RELEASES_URL,
}

function updatesDisabled() {
  return !app.isPackaged || process.argv.includes('--smoke-test')
}

function parseVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersions(a, b) {
  const av = parseVersion(a)
  const bv = parseVersion(b)
  if (!av || !bv) return 0
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1
  }
  return 0
}

function extractAssetSha256(body, assetName) {
  const text = String(body || '')
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(assetName)) continue
    const nearby = lines.slice(i, i + 4).join(' ')
    const match = nearby.match(/\b[a-f0-9]{64}\b/i)
    if (match) return match[0].toLowerCase()
  }
  const allHashes = text.match(/\b[a-f0-9]{64}\b/gi) || []
  return allHashes.length === 1 ? allHashes[0].toLowerCase() : ''
}

function updateStateSnapshot() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
  }
}

function setUpdateState(patch, broadcast = true) {
  updateState = {
    ...updateState,
    ...patch,
    currentVersion: app.getVersion(),
    releasesUrl: UPDATE_RELEASES_URL,
  }
  if (broadcast && settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('pet:update-status', updateStateSnapshot())
  }
  return updateStateSnapshot()
}

async function checkForUpdates() {
  if (updatesDisabled()) {
    return setUpdateState({
      phase: 'disabled',
      message: '开发模式或自检模式下不检查更新，正式便携版可用。',
      updateAvailable: false,
      canDownload: false,
      readyToInstall: false,
    })
  }

  setUpdateState({
    phase: 'checking',
    message: '正在检查最新版本…',
    updateAvailable: false,
    canDownload: false,
    readyToInstall: false,
    downloadable: false,
    releaseNotes: '',
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    sha256Verified: false,
  })

  try {
    const response = await fetch('https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest', {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'DeepSeek-Whale-Pet/' + app.getVersion(),
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error('GitHub API HTTP ' + response.status)
    const release = await response.json()
    const latestVersion = String(release.tag_name || '').replace(/^v/i, '')
    const updateAvailable = compareVersions(latestVersion, app.getVersion()) > 0
    const asset = (Array.isArray(release.assets) ? release.assets : [])
      .find((item) => /^DeepSeek-Whale-Pet-.*-portable\.exe$/i.test(String(item.name || '')))
    const assetName = asset ? path.basename(String(asset.name)) : ''
    const sha256 = asset ? extractAssetSha256(release.body, assetName) : ''
    latestUpdateRelease = {
      latestVersion,
      asset: asset ? {
        name: assetName,
        url: String(asset.browser_download_url || ''),
        size: Number(asset.size) || 0,
      } : null,
      sha256,
      htmlUrl: String(release.html_url || UPDATE_RELEASES_URL),
      releaseNotes: String(release.body || '').trim(),
    }

    if (!updateAvailable) {
      return setUpdateState({
        phase: 'current',
        message: '当前已是最新版本 v' + app.getVersion() + '。',
        latestVersion,
        updateAvailable: false,
        canDownload: false,
        readyToInstall: false,
        downloadable: false,
        releaseNotes: latestUpdateRelease.releaseNotes,
      })
    }
    if (!asset || !assetName || !sha256) {
      return setUpdateState({
        phase: 'manual',
        message: '发现新版本 v' + latestVersion + '，但缺少可校验的便携版文件或 SHA256。请前往 Releases 手动下载。',
        latestVersion,
        updateAvailable: true,
        canDownload: false,
        readyToInstall: false,
        downloadable: false,
        releaseNotes: latestUpdateRelease.releaseNotes,
      })
    }
    return setUpdateState({
      phase: 'available',
      message: '发现新版本 v' + latestVersion + '，可以下载更新。',
      latestVersion,
      updateAvailable: true,
      canDownload: true,
      readyToInstall: false,
      downloadable: true,
      releaseNotes: latestUpdateRelease.releaseNotes,
    })
  } catch (err) {
    return setUpdateState({
      phase: 'error',
      message: '检查更新失败：' + String((err && err.message) || err),
      updateAvailable: false,
      canDownload: false,
      readyToInstall: false,
      downloadable: false,
    })
  }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const input = fs.createReadStream(filePath)
    input.on('error', reject)
    hash.on('error', reject)
    hash.on('finish', () => resolve(hash.digest('hex').toLowerCase()))
    input.pipe(hash)
  })
}

async function downloadUpdate() {
  if (updatesDisabled()) {
    return setUpdateState({ phase: 'disabled', message: '开发模式或自检模式下不下载更新。' })
  }
  if (updateDownloadInFlight) return updateDownloadInFlight
  const release = latestUpdateRelease
  if (!release || !release.asset || !release.sha256) {
    return setUpdateState({
      phase: 'manual',
      message: '没有可自动下载的更新，请先检查更新或前往 Releases 手动下载。',
      canDownload: false,
    })
  }
  if (downloadedUpdatePath && fs.existsSync(downloadedUpdatePath)) {
    return setUpdateState({
      phase: 'ready',
      message: '更新包已下载并校验，可以安装并重启。',
      updateAvailable: true,
      canDownload: false,
      readyToInstall: true,
    })
  }

  updateDownloadInFlight = (async () => {
    const tempDir = path.join(app.getPath('temp'), 'deepseek-whale-pet-update')
    const destination = path.join(tempDir, release.asset.name)
    try {
      fs.mkdirSync(tempDir, { recursive: true })
      setUpdateState({
        phase: 'downloading',
        message: '正在下载更新包…',
        updateAvailable: true,
        canDownload: false,
        readyToInstall: false,
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: Number(release.asset.size) || 0,
        sha256Verified: false,
      })
      const response = await fetch(release.asset.url, {
        headers: { 'User-Agent': 'DeepSeek-Whale-Pet/' + app.getVersion() },
        signal: AbortSignal.timeout(300000),
      })
      if (!response.ok || !response.body) throw new Error('下载 HTTP ' + response.status)
      const totalBytes = Number(response.headers.get('content-length'))
        || Number(release.asset.size)
        || 0
      let downloadedBytes = 0
      let lastProgressAt = 0
      const progressStream = new Transform({
        transform(chunk, _encoding, callback) {
          downloadedBytes += chunk.length
          const now = Date.now()
          if (now - lastProgressAt >= 200 || (totalBytes && downloadedBytes >= totalBytes)) {
            lastProgressAt = now
            const progress = totalBytes
              ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              : 0
            setUpdateState({
              phase: 'downloading',
              message: totalBytes
                ? '正在下载更新包… ' + progress + '%'
                : '正在下载更新包… ' + formatBytes(downloadedBytes),
              downloadProgress: progress,
              downloadedBytes,
              totalBytes,
            })
          }
          callback(null, chunk)
        },
      })
      await pipeline(Readable.fromWeb(response.body), progressStream, fs.createWriteStream(destination))
      setUpdateState({
        phase: 'verifying',
        message: '下载完成，正在校验 SHA256…',
        downloadProgress: 100,
        downloadedBytes,
        totalBytes,
        sha256Verified: false,
      })
      const actualSha256 = await sha256File(destination)
      if (actualSha256 !== release.sha256) {
        try { fs.unlinkSync(destination) } catch { /* ignore */ }
        throw new Error('SHA256 校验失败')
      }
      downloadedUpdatePath = destination
      return setUpdateState({
        phase: 'ready',
        message: '更新包已下载并通过 SHA256 校验，可以安装并重启。',
        updateAvailable: true,
        canDownload: false,
        readyToInstall: true,
        downloadProgress: 100,
        downloadedBytes,
        totalBytes,
        sha256Verified: true,
      })
    } catch (err) {
      downloadedUpdatePath = ''
      return setUpdateState({
        phase: 'error',
        message: '下载更新失败：' + String((err && err.message) || err) + '。旧版本未改变。',
        updateAvailable: true,
        canDownload: true,
        readyToInstall: false,
        sha256Verified: false,
      })
    } finally {
      updateDownloadInFlight = null
    }
  })()
  return updateDownloadInFlight
}

function formatBytes(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  if (value < 1024) return Math.round(value) + ' B'
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB'
  if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB'
  return (value / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function portableExecutablePath() {
  const portableFile = String(process.env.PORTABLE_EXECUTABLE_FILE || '').trim()
  if (portableFile && fs.existsSync(portableFile)) return portableFile

  const portableDir = String(process.env.PORTABLE_EXECUTABLE_DIR || '').trim()
  if (portableDir && fs.existsSync(portableDir)) {
    try {
      const candidates = fs.readdirSync(portableDir)
        .filter((name) => /^DeepSeek-Whale-Pet-.*-portable\.exe$/i.test(name))
        .map((name) => {
          const fullPath = path.join(portableDir, name)
          return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
      if (candidates[0]) return candidates[0].fullPath
    } catch { /* fall through */ }
  }
  return process.execPath
}

async function installUpdate() {
  if (updatesDisabled()) {
    return setUpdateState({ phase: 'disabled', message: '开发模式或自检模式下不安装更新。' })
  }
  if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) {
    return setUpdateState({
      phase: 'error',
      message: '没有可安装的更新包，请先下载。',
      readyToInstall: false,
    })
  }

  const targetFile = portableExecutablePath()
  const helperDir = path.dirname(downloadedUpdatePath)
  const helperPath = path.join(helperDir, 'apply-update.ps1')
  const backupFile = path.join(helperDir, 'previous-version-backup.exe')
  const script = [
    'param([int]$TargetProcessId, [string]$DownloadedFile, [string]$TargetFile, [string]$BackupFile)',
    '$ErrorActionPreference = "Stop"',
    '$deadline = (Get-Date).AddMinutes(2)',
    'while (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue) {',
    '  if ((Get-Date) -gt $deadline) { exit 2 }',
    '  Start-Sleep -Milliseconds 300',
    '}',
    'if (-not (Test-Path -LiteralPath $DownloadedFile)) { throw "Downloaded update is missing" }',
    'Copy-Item -LiteralPath $TargetFile -Destination $BackupFile -Force',
    'if (-not (Test-Path -LiteralPath $BackupFile)) { throw "Backup creation failed" }',
    'try {',
    '  Copy-Item -LiteralPath $DownloadedFile -Destination $TargetFile -Force',
    '  $newProcess = Start-Process -FilePath $TargetFile -PassThru',
    '  Start-Sleep -Seconds 5',
    '  if ($null -eq $newProcess -or $newProcess.HasExited) { throw "Updated application failed to start" }',
    '} catch {',
    '  Copy-Item -LiteralPath $BackupFile -Destination $TargetFile -Force',
    '  Start-Process -FilePath $TargetFile',
    '  Start-Sleep -Milliseconds 500',
    '  throw',
    '}',
    'Remove-Item -LiteralPath $DownloadedFile -Force -ErrorAction SilentlyContinue',
    'Remove-Item -LiteralPath $BackupFile -Force -ErrorAction SilentlyContinue',
    'Start-Sleep -Seconds 1',
    'Remove-Item -LiteralPath (Split-Path -Parent $MyInvocation.MyCommand.Path) -Recurse -Force -ErrorAction SilentlyContinue',
  ].join('\r\n')

  try {
    fs.writeFileSync(helperPath, script, 'utf8')
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden',
      '-File', helperPath,
      String(process.pid),
      downloadedUpdatePath,
      targetFile,
      backupFile,
    ], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    })
    child.unref()
    setUpdateState({
      phase: 'installing',
      message: '正在退出旧版本并安装更新…',
      readyToInstall: false,
      canDownload: false,
      downloadProgress: 100,
      sha256Verified: true,
    })
    setTimeout(() => app.quit(), 150)
    return updateStateSnapshot()
  } catch (err) {
    return setUpdateState({
      phase: 'error',
      message: '启动更新安装器失败：' + String((err && err.message) || err),
      readyToInstall: true,
    })
  }
}

async function openUpdateReleases() {
  await shell.openExternal(UPDATE_RELEASES_URL)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 显示位置模式：all(全显示) | taskbar(仅任务栏) | tray(仅托盘) | hidden(全隐藏)
// ---------------------------------------------------------------------------
function applyDisplayMode(mode) {
  if (!petWin || petWin.isDestroyed()) return
  const m = mode || 'all'
  // 桌宠本体始终显示，与显示位置无关；置顶只由「始终置顶」决定
  petWin.setAlwaysOnTop(loadConfig().alwaysOnTop !== false, 'screen-saver')
  petWin.show()
  // 任务栏显隐由创建窗口时的 skipTaskbar 决定（运行时切换不可靠，需重建）
  const showTray = (m === 'all' || m === 'tray')
  updateTray(showTray)
}

// ---------------------------------------------------------------------------
// 托盘
// ---------------------------------------------------------------------------
function buildTrayImage() {
  try {
    const p = path.join(__dirname, 'assets', 'DSniang02.png')
    return nativeImage.createFromPath(p).resize({ width: 16, height: 16 })
  } catch {
    return nativeImage.createEmpty()
  }
}

function updateTray(enabled) {
  if (!enabled) {
    if (tray) { tray.destroy(); tray = null }
    return
  }
  if (tray) return
  tray = new Tray(buildTrayImage())
  tray.setToolTip('DeepSeek 鲸鱼桌宠')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🔄 立即刷新', click: () => { if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:refresh') } },
    { label: '⚙️ 设置…', click: () => openSettings() },
    { label: '✕ 退出', click: () => app.quit() },
  ]))
  tray.on('click', () => { if (petWin && !petWin.isDestroyed()) petWin.show() })
}

// ---------------------------------------------------------------------------
// 全局热键
// ---------------------------------------------------------------------------
function updateHotkey(enabled) {
  globalShortcut.unregisterAll()
  // 全隐藏时的安全恢复热键（始终可用）
  try {
    globalShortcut.register('Control+Shift+H', () => {
      const cur = loadConfig().displayMode || 'all'
      const next = cur === 'hidden' ? 'all' : 'hidden'
      cfg = saveConfig({ displayMode: next })
      applyDisplayMode(next)
      if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:config-updated')
    })
  } catch (err) { /* ignore */ }
  if (!enabled) return
  globalShortcut.register('Control+Shift+R', () => {
    if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:refresh')
  })
}

// ---------------------------------------------------------------------------
// 开机自启
// ---------------------------------------------------------------------------
function updateAutoStart(enabled) {
  try {
    // 便携版运行时 process.execPath 指向临时解压目录，注册后开机自启会失效；
    // electron-builder 便携版会注入 PORTABLE_EXECUTABLE_FILE 指向真实的便携版 exe 路径
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: exePath,
      args: [],
    })
    console.log('[whale-pet] autoStart set=' + enabled + ' path=' + exePath)
  } catch (err) {
    console.error('[whale-pet] setLoginItemSettings failed:', err)
  }
}

// ---------------------------------------------------------------------------
// 自定义图片
// ---------------------------------------------------------------------------
async function chooseCustomImage() {
  const r = await dialog.showOpenDialog(settingsWin || petWin, {
    title: '选择鲸鱼图片（建议 1026×1026 PNG）',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  })
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false }
  try {
    const src = r.filePaths[0]
    fs.copyFileSync(src, customImagePath())
    cfg = saveConfig({ customImage: true })
    if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:config-updated')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

// ---------------------------------------------------------------------------
// 自定义点击音效
// ---------------------------------------------------------------------------
async function chooseCustomAudio() {
  const r = await dialog.showOpenDialog(settingsWin || petWin, {
    title: '选择点击音效音频（mp3 / wav / ogg / m4a）',
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
    properties: ['openFile'],
  })
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false }
  try {
    const src = r.filePaths[0]
    fs.copyFileSync(src, customAudioPath())
    cfg = saveConfig({ clickSoundSet: 'custom' })
    if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:config-updated')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

// ---------------------------------------------------------------------------
// Agent GIF 素材索引
// 只解析状态目录，并缓存每张 GIF 的循环时长；帧数据不常驻内存。
// ---------------------------------------------------------------------------
const gifMetaCache = new Map()

function createGifByteReader(filePath) {
  const stat = fs.statSync(filePath)
  const fd = fs.openSync(filePath, 'r')
  const chunk = Buffer.allocUnsafe(256 * 1024)
  let chunkStart = 0
  let chunkEnd = 0
  let chunkPos = 0

  function fill() {
    const absolute = chunkStart + chunkPos
    if (absolute >= stat.size) return false
    const bytesRead = fs.readSync(fd, chunk, 0, Math.min(chunk.length, stat.size - absolute), absolute)
    if (bytesRead <= 0) return false
    chunkStart = absolute
    chunkEnd = bytesRead
    chunkPos = 0
    return true
  }

  function byte() {
    if (chunkPos >= chunkEnd && !fill()) throw new Error('GIF file is truncated')
    return chunk[chunkPos++]
  }

  function skip(length) {
    let remaining = Math.max(0, Number(length) || 0)
    while (remaining > 0) {
      if (chunkPos >= chunkEnd && !fill()) throw new Error('GIF file is truncated')
      const count = Math.min(remaining, chunkEnd - chunkPos)
      chunkPos += count
      remaining -= count
    }
  }

  return {
    byte,
    skip,
    size: stat.size,
    close: () => fs.closeSync(fd),
  }
}

function skipGifSubBlocks(reader) {
  while (true) {
    const size = reader.byte()
    if (size === 0) return
    reader.skip(size)
  }
}

function readGifMetadata(filePath) {
  const stat = fs.statSync(filePath)
  const cached = gifMetaCache.get(filePath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached

  const reader = createGifByteReader(filePath)
  try {
    const signature = String.fromCharCode(
      reader.byte(), reader.byte(), reader.byte(),
      reader.byte(), reader.byte(), reader.byte()
    )
    if (signature !== 'GIF87a' && signature !== 'GIF89a') throw new Error('Not a GIF file')

    reader.skip(4) // 逻辑屏幕宽高
    const packed = reader.byte()
    reader.skip(2) // 背景色索引与像素宽高比
    if (packed & 0x80) reader.skip(3 * (1 << ((packed & 0x07) + 1)))

    let frameCount = 0
    let durationMs = 0
    let pendingDelay = 0
    while (true) {
      const marker = reader.byte()
      if (marker === 0x3b) break
      if (marker === 0x21) {
        const label = reader.byte()
        const blockSize = reader.byte()
        if (label === 0xf9 && blockSize >= 4) {
          reader.skip(1) // 处置方式、透明色标志
          const low = reader.byte()
          const high = reader.byte()
          pendingDelay = low | (high << 8)
          reader.skip(blockSize - 3)
          skipGifSubBlocks(reader)
        } else if (blockSize > 0) {
          reader.skip(blockSize)
          skipGifSubBlocks(reader)
        }
        continue
      }
      if (marker !== 0x2c) throw new Error('Unexpected GIF block')

      reader.skip(8) // 图像位置与尺寸
      const imagePacked = reader.byte()
      if (imagePacked & 0x80) reader.skip(3 * (1 << ((imagePacked & 0x07) + 1)))
      reader.skip(1) // LZW 最小码长
      skipGifSubBlocks(reader)
      frameCount++
      const delayMs = pendingDelay <= 1 ? 100 : pendingDelay * 10
      durationMs += clamp(delayMs, 20, 60000)
      pendingDelay = 0
    }

    if (frameCount === 0) throw new Error('GIF has no frames')
    const meta = {
      durationMs: Math.max(100, Math.round(durationMs)),
      frameCount,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
    }
    gifMetaCache.set(filePath, meta)
    return meta
  } finally {
    reader.close()
  }
}

function agentGifDirectories(agent, state) {
  const root = path.join(__dirname, 'assets', 'agent-gifs')
  return [
    path.join(root, state + '_' + agent),
    path.join(root, 'common', state),
  ]
}

function resolveAgentGifAssets(rawAgent, rawState) {
  const agent = AGENT_IDS.includes(rawAgent) ? rawAgent : 'codex'
  const requestedState = AGENT_STATES.includes(rawState) ? rawState : 'idle'
  const candidates = [requestedState].concat(AGENT_STATE_FALLBACKS[requestedState] || [])
  if (!candidates.includes('idle')) candidates.push('idle')

  for (const state of [...new Set(candidates)]) {
    for (const dir of agentGifDirectories(agent, state)) {
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      const files = entries
        .filter((entry) => entry.isFile() && /\.gif$/i.test(entry.name))
        .map((entry) => path.join(dir, entry.name))
        .sort((a, b) => a.localeCompare(b))
      if (files.length === 0) continue

      const assets = files.map((filePath) => {
        let meta
        try {
          meta = readGifMetadata(filePath)
        } catch (err) {
          console.error('[whale-pet] GIF metadata failed:', filePath, err)
          meta = { durationMs: 3200, frameCount: 0, size: 0 }
        }
        return {
          name: path.basename(filePath),
          url: pathToFileURL(filePath).href,
          durationMs: meta.durationMs,
          frameCount: meta.frameCount,
          size: meta.size,
        }
      })
      return {
        agent,
        requestedState,
        state,
        fallback: state !== requestedState,
        directory: path.relative(path.join(__dirname, 'assets', 'agent-gifs'), dir).replace(/\\/g, '/'),
        assets,
      }
    }
  }
  return { agent, requestedState, state: requestedState, fallback: false, directory: '', assets: [] }
}

function normalizeAgentId(value) {
  return AGENT_IDS.includes(value) ? value : 'codex'
}

function normalizeAgentState(value) {
  return AGENT_STATES.includes(value) ? value : 'idle'
}

function compactAgentDetail(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > CODEX_DETAIL_LIMIT ? text.slice(0, CODEX_DETAIL_LIMIT - 1) + '…' : text
}

function codexHomePath() {
  const configured = String(process.env.CODEX_HOME || '').trim()
  return configured || path.join(os.homedir(), '.codex')
}

function codexConfigPath() {
  return path.join(codexHomePath(), 'config.toml')
}

function codexHooksPath() {
  return path.join(codexHomePath(), 'hooks.json')
}

function codexHookScriptPath() {
  return path.join(app.getPath('userData'), CODEX_HOOK_MARKER)
}

function codexLegacyHookScriptPath() {
  return path.join(app.getPath('userData'), CODEX_HOOK_LEGACY_MARKER)
}

function codexHookEventPath() {
  return path.join(app.getPath('userData'), 'agent-events.jsonl')
}

function codexHookInstallStatePath() {
  return path.join(app.getPath('userData'), 'codex-hook-state.json')
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function readCodexHookInstallState() {
  try {
    const value = readJsonObject(codexHookInstallStatePath(), true)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function writeCodexHookInstallState() {
  const statePath = codexHookInstallStatePath()
  if (fs.existsSync(statePath)) return
  const backupPath = codexConfigPath() + '.deepseek-whale-pet.bak'
  const source = fs.existsSync(backupPath)
    ? readTextIfExists(backupPath)
    : readTextIfExists(codexConfigPath())
  const section = readTomlFeaturesSection(source)
  const state = {
    version: 1,
    installedAt: Date.now(),
    configHadFeaturesSection: section.hasFeatures,
    configHooksSetting: section.hooksSetting,
  }
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

function backupFileOnce(filePath) {
  if (!fs.existsSync(filePath)) return ''
  const backupPath = filePath + '.deepseek-whale-pet.bak'
  try {
    if (!fs.existsSync(backupPath)) fs.copyFileSync(filePath, backupPath)
    return backupPath
  } catch (err) {
    console.error('[whale-pet] Codex config backup failed:', err)
    return ''
  }
}

function readJsonObject(filePath, allowMissing) {
  if (!fs.existsSync(filePath)) {
    if (allowMissing) return {}
    throw new Error('文件不存在：' + filePath)
  }
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim()
  if (!text) return {}
  const value = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('JSON 顶层不是对象：' + filePath)
  }
  return value
}

function readTomlFeaturesSection(text) {
  const lines = String(text || '').split(/\r?\n/)
  let inFeatures = false
  let hasFeatures = false
  let hooksSetting = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^\[[^\]]+\]\s*(?:#.*)?$/.test(trimmed)) {
      inFeatures = /^\[features\]\s*(?:#.*)?$/i.test(trimmed)
      if (inFeatures) hasFeatures = true
      continue
    }
    if (!inFeatures) continue
    const match = trimmed.match(/^hooks\s*=\s*(true|false)\b/i)
    if (match) hooksSetting = match[1].toLowerCase() === 'true'
  }
  return { hasFeatures, hooksSetting }
}

function tomlFeaturesHooksEnabled(text) {
  return readTomlFeaturesSection(text).hooksSetting === true
}

function setTomlFeaturesHooks(enabled) {
  const filePath = codexConfigPath()
  const exists = fs.existsSync(filePath)
  if (!exists && !enabled) return
  const source = readTextIfExists(filePath)
  const lines = source ? source.split(/\r?\n/) : []
  let featuresIndex = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!/^\[[^\]]+\]\s*(?:#.*)?$/.test(trimmed)) continue
    if (featuresIndex >= 0) {
      sectionEnd = i
      break
    }
    if (/^\[features\]\s*(?:#.*)?$/i.test(trimmed)) featuresIndex = i
  }

  if (featuresIndex < 0) {
    if (!enabled) return
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (lines.length) lines.push('')
    lines.push('[features]')
    lines.push('hooks = true')
  } else {
    let hookIndex = -1
    for (let i = featuresIndex + 1; i < sectionEnd; i++) {
      if (/^\s*hooks\s*=/.test(lines[i])) {
        hookIndex = i
        break
      }
    }
    if (hookIndex >= 0) lines[hookIndex] = 'hooks = ' + (enabled ? 'true' : 'false')
    else if (enabled) lines.splice(featuresIndex + 1, 0, 'hooks = true')
    else return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, lines.join('\r\n').replace(/\s*$/, '') + '\r\n', 'utf8')
}

function removeTomlFeaturesHooks(removeEmptyFeaturesSection) {
  const filePath = codexConfigPath()
  if (!fs.existsSync(filePath)) return
  const lines = readTextIfExists(filePath).split(/\r?\n/)
  let featuresIndex = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!/^\[[^\]]+\]\s*(?:#.*)?$/.test(trimmed)) continue
    if (featuresIndex >= 0) {
      sectionEnd = i
      break
    }
    if (/^\[features\]\s*(?:#.*)?$/i.test(trimmed)) featuresIndex = i
  }
  if (featuresIndex < 0) return

  let hookIndex = -1
  for (let i = featuresIndex + 1; i < sectionEnd; i++) {
    if (/^\s*hooks\s*=/.test(lines[i])) {
      hookIndex = i
      break
    }
  }
  if (hookIndex >= 0) {
    lines.splice(hookIndex, 1)
    sectionEnd--
  }

  if (removeEmptyFeaturesSection) {
    const hasRemainingSectionContent = lines
      .slice(featuresIndex + 1, sectionEnd)
      .some((line) => line.trim())
    if (!hasRemainingSectionContent) {
      let removeEnd = sectionEnd
      if (removeEnd < lines.length && !lines[removeEnd].trim()) removeEnd++
      lines.splice(featuresIndex, removeEnd - featuresIndex)
    }
  }
  fs.writeFileSync(filePath, lines.join('\r\n').replace(/\s*$/, '') + '\r\n', 'utf8')
}

function codexHookGroup(event) {
  const markerPath = codexHookScriptPath()
  const command = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + markerPath + '"'
  const hook = {
    type: 'command',
    command,
    commandWindows: command,
    timeout: 10,
  }
  const group = {
    hooks: [hook],
  }
  if (event === 'PreToolUse' || event === 'PermissionRequest' || event === 'PostToolUse') {
    group.matcher = '*'
  }
  return group
}

function isWhalePetHookGroup(group) {
  try {
    const serialized = JSON.stringify(group)
    return [codexHookScriptPath(), codexLegacyHookScriptPath()].some((filePath) => {
      const encodedPath = JSON.stringify(filePath).slice(1, -1)
      return serialized.includes(encodedPath)
    })
  } catch {
    return false
  }
}

function countInstalledCodexHookEvents(root) {
  const hooks = root && root.hooks && typeof root.hooks === 'object' ? root.hooks : {}
  return CODEX_HOOK_EVENTS.filter((event) => {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : []
    return groups.some(isWhalePetHookGroup)
  }).length
}

function countAllCodexHookEvents(root) {
  const hooks = root && root.hooks && typeof root.hooks === 'object' ? root.hooks : {}
  return Object.keys(hooks).filter((event) => Array.isArray(hooks[event]) && hooks[event].length > 0).length
}

function mergeCodexHooks(enabled) {
  const filePath = codexHooksPath()
  if (!fs.existsSync(filePath) && !enabled) return
  const root = readJsonObject(filePath, true)
  if (!root.hooks || typeof root.hooks !== 'object' || Array.isArray(root.hooks)) root.hooks = {}

  for (const event of CODEX_HOOK_EVENTS) {
    const current = Array.isArray(root.hooks[event]) ? root.hooks[event] : []
    const kept = current.filter((group) => !isWhalePetHookGroup(group))
    if (enabled) kept.push(codexHookGroup(event))
    if (kept.length) root.hooks[event] = kept
    else delete root.hooks[event]
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(root, null, 2) + '\n', 'utf8')
}

function codexHookInstallStatus() {
  let root = {}
  let parseError = ''
  try {
    root = readJsonObject(codexHooksPath(), true)
  } catch (err) {
    parseError = err.message || String(err)
  }
  const installedEvents = parseError ? 0 : countInstalledCodexHookEvents(root)
  let featureHooks = false
  try {
    featureHooks = tomlFeaturesHooksEnabled(readTextIfExists(codexConfigPath()))
  } catch (err) {
    parseError = parseError || err.message || String(err)
  }
  const installed = installedEvents === CODEX_HOOK_EVENTS.length && featureHooks
  return {
    installed,
    installedEvents,
    totalEvents: CODEX_HOOK_EVENTS.length,
    featureHooks,
    hooksPath: codexHooksPath(),
    configPath: codexConfigPath(),
    eventPath: codexHookEventPath(),
    error: codexHookLastError || parseError,
  }
}

function codexHookStatusSnapshot() {
  const status = codexHookInstallStatus()
  const latest = agentStatusByAgent.codex || {}
  return {
    ...status,
    detected: fs.existsSync(codexHomePath()),
    detectedPath: codexHomePath(),
    enabled: !!cfg.codexHookEnabled,
    desired: !!cfg.agentAnimationEnabled && !!cfg.codexHookEnabled,
    watcherActive: !!agentRuntimeStatus.hookWatcherActive,
    watcherPath: agentRuntimeStatus.hookPath || '',
    lastSource: latest.source || '',
    lastEvent: latest.event || '',
    lastState: latest.state || '',
    lastDetail: latest.detail || '',
    lastUpdatedAt: Number(latest.updatedAt) || 0,
  }
}

function writeCodexHookScript() {
  const filePath = codexHookScriptPath()
  const logPath = codexHookEventPath().replace(/'/g, "''")
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    `$LogPath = '${logPath}'`,
    '$stdin = [Console]::OpenStandardInput()',
    '$memory = New-Object System.IO.MemoryStream',
    '$stdin.CopyTo($memory)',
    '$payloadBytes = $memory.ToArray()',
    'if ($payloadBytes.Length -eq 0) { exit 0 }',
    '$payloadBase64 = [Convert]::ToBase64String($payloadBytes)',
    '$json = \'{"recordedAt":\' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + \',"payloadBase64":"\' + $payloadBase64 + \'"}\'',
    '$dir = [System.IO.Path]::GetDirectoryName($LogPath)',
    'if ($dir -and -not [System.IO.Directory]::Exists($dir)) { [System.IO.Directory]::CreateDirectory($dir) | Out-Null }',
    '$utf8 = New-Object System.Text.UTF8Encoding($false)',
    '[System.IO.File]::AppendAllText($LogPath, $json + [Environment]::NewLine, $utf8)',
    'exit 0',
    '',
  ].join('\r\n')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '\uFEFF' + script, 'utf8')
}

function installCodexHook() {
  try {
    backupFileOnce(codexConfigPath())
    backupFileOnce(codexHooksPath())
    writeCodexHookInstallState()
    writeCodexHookScript()
    mergeCodexHooks(true)
    setTomlFeaturesHooks(true)
    codexHookLastError = ''
  } catch (err) {
    codexHookLastError = err.message || String(err)
    console.error('[whale-pet] install Codex hook failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !codexHookLastError, error: codexHookLastError, ...codexHookStatusSnapshot() }
}

function uninstallCodexHook() {
  try {
    backupFileOnce(codexConfigPath())
    backupFileOnce(codexHooksPath())
    const installState = readCodexHookInstallState()
    mergeCodexHooks(false)
    let root = {}
    try {
      root = readJsonObject(codexHooksPath(), true)
    } catch {
      root = {}
    }
    const hasOtherHooks = countAllCodexHookEvents(root) > 0
    const hadFeaturesSection = installState.configHadFeaturesSection === true
    const originalHooksSetting = installState.configHooksSetting
    if (hasOtherHooks || originalHooksSetting === true) {
      setTomlFeaturesHooks(true)
    } else if (originalHooksSetting === false) {
      setTomlFeaturesHooks(false)
    } else {
      removeTomlFeaturesHooks(!hadFeaturesSection)
    }
    try {
      fs.rmSync(codexHookInstallStatePath(), { force: true })
    } catch {
      // The state file is non-critical after the config has been restored.
    }
    codexHookLastError = ''
  } catch (err) {
    codexHookLastError = err.message || String(err)
    console.error('[whale-pet] uninstall Codex hook failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !codexHookLastError, error: codexHookLastError, ...codexHookStatusSnapshot() }
}

function syncCodexHookInstallation() {
  const want = !!cfg.agentAnimationEnabled && !!cfg.codexHookEnabled
  const status = codexHookInstallStatus()
  if (want && !status.installed) installCodexHook()
  else if (want) {
    try {
      // Keep the locally generated hook script current even when hooks.json is already installed.
      writeCodexHookScript()
      codexHookLastError = ''
    } catch (err) {
      codexHookLastError = err.message || String(err)
      console.error('[whale-pet] refresh Codex hook script failed:', err)
    }
  }
  else if (!want && status.installedEvents > 0) uninstallCodexHook()
}

function claudeHomePath() {
  const configured = String(process.env.CLAUDE_CONFIG_DIR || '').trim()
  return configured || path.join(os.homedir(), '.claude')
}

function claudeSettingsPath() {
  return path.join(claudeHomePath(), 'settings.json')
}

function claudeHookScriptPath() {
  return path.join(app.getPath('userData'), CLAUDE_HOOK_MARKER)
}

function claudeHookEventPath() {
  return path.join(app.getPath('userData'), 'claude-agent-events.jsonl')
}

function claudeHookGroup(event) {
  const markerPath = claudeHookScriptPath()
  const command = 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + markerPath + '"'
  const group = {
    hooks: [
      {
        type: 'command',
        command,
        timeout: 10,
      },
    ],
  }
  if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure' ||
      event === 'PermissionRequest' ||
      event === 'Notification' || event === 'SubagentStart' || event === 'SubagentStop') {
    group.matcher = '*'
  }
  return group
}

function isWhaleClaudeHookGroup(group) {
  try {
    const encodedPath = JSON.stringify(claudeHookScriptPath()).slice(1, -1)
    return JSON.stringify(group).includes(encodedPath)
  } catch {
    return false
  }
}

function countInstalledClaudeHookEvents(root) {
  const hooks = root && root.hooks && typeof root.hooks === 'object' ? root.hooks : {}
  return CLAUDE_HOOK_EVENTS.filter((event) => {
    const groups = Array.isArray(hooks[event]) ? hooks[event] : []
    return groups.some(isWhaleClaudeHookGroup)
  }).length
}

function mergeClaudeHooks(enabled) {
  const filePath = claudeSettingsPath()
  if (!fs.existsSync(filePath) && !enabled) return
  const root = readJsonObject(filePath, true)
  if (!root.hooks || typeof root.hooks !== 'object' || Array.isArray(root.hooks)) root.hooks = {}

  for (const event of CLAUDE_HOOK_EVENTS) {
    const current = Array.isArray(root.hooks[event]) ? root.hooks[event] : []
    const kept = current.filter((group) => !isWhaleClaudeHookGroup(group))
    if (enabled) kept.push(claudeHookGroup(event))
    if (kept.length) root.hooks[event] = kept
    else delete root.hooks[event]
  }
  if (!enabled && Object.keys(root.hooks).length === 0) delete root.hooks

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(root, null, 2) + '\n', 'utf8')
}

function claudeHookInstallStatus() {
  let root = {}
  let parseError = ''
  try {
    root = readJsonObject(claudeSettingsPath(), true)
  } catch (err) {
    parseError = err.message || String(err)
  }
  const installedEvents = parseError ? 0 : countInstalledClaudeHookEvents(root)
  return {
    installed: installedEvents === CLAUDE_HOOK_EVENTS.length,
    installedEvents,
    totalEvents: CLAUDE_HOOK_EVENTS.length,
    settingsPath: claudeSettingsPath(),
    eventPath: claudeHookEventPath(),
    error: claudeHookLastError || parseError,
  }
}

function claudeHookStatusSnapshot() {
  const status = claudeHookInstallStatus()
  const latest = agentStatusByAgent.claudecode || {}
  return {
    ...status,
    detected: fs.existsSync(claudeHomePath()),
    detectedPath: claudeHomePath(),
    enabled: !!cfg.claudeHookEnabled,
    desired: !!cfg.agentAnimationEnabled && !!cfg.claudeHookEnabled,
    watcherActive: !!agentRuntimeStatus.claudeHookWatcherActive,
    watcherPath: agentRuntimeStatus.claudeHookPath || '',
    lastSource: latest.source || '',
    lastEvent: latest.event || '',
    lastState: latest.state || '',
    lastDetail: latest.detail || '',
    lastUpdatedAt: Number(latest.updatedAt) || 0,
  }
}

function writeClaudeHookScript() {
  const filePath = claudeHookScriptPath()
  const logPath = claudeHookEventPath().replace(/'/g, "''")
  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    `$LogPath = '${logPath}'`,
    '$stdin = [Console]::OpenStandardInput()',
    '$memory = New-Object System.IO.MemoryStream',
    '$stdin.CopyTo($memory)',
    '$payloadBytes = $memory.ToArray()',
    'if ($payloadBytes.Length -eq 0) { exit 0 }',
    '$payloadBase64 = [Convert]::ToBase64String($payloadBytes)',
    '$json = \'{"recordedAt":\' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + \',"payloadBase64":"\' + $payloadBase64 + \'"}\'',
    '$dir = [System.IO.Path]::GetDirectoryName($LogPath)',
    'if ($dir -and -not [System.IO.Directory]::Exists($dir)) { [System.IO.Directory]::CreateDirectory($dir) | Out-Null }',
    '$utf8 = New-Object System.Text.UTF8Encoding($false)',
    '[System.IO.File]::AppendAllText($LogPath, $json + [Environment]::NewLine, $utf8)',
    'exit 0',
    '',
  ].join('\r\n')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '\uFEFF' + script, 'utf8')
}

function installClaudeHook() {
  try {
    backupFileOnce(claudeSettingsPath())
    writeClaudeHookScript()
    mergeClaudeHooks(true)
    claudeHookLastError = ''
  } catch (err) {
    claudeHookLastError = err.message || String(err)
    console.error('[whale-pet] install Claude hook failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !claudeHookLastError, error: claudeHookLastError, ...claudeHookStatusSnapshot() }
}

function uninstallClaudeHook() {
  try {
    backupFileOnce(claudeSettingsPath())
    mergeClaudeHooks(false)
    claudeHookLastError = ''
  } catch (err) {
    claudeHookLastError = err.message || String(err)
    console.error('[whale-pet] uninstall Claude hook failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !claudeHookLastError, error: claudeHookLastError, ...claudeHookStatusSnapshot() }
}

function syncClaudeHookInstallation() {
  const want = !!cfg.agentAnimationEnabled && !!cfg.claudeHookEnabled
  const status = claudeHookInstallStatus()
  if (want && !status.installed) installClaudeHook()
  else if (want) {
    try {
      writeClaudeHookScript()
      claudeHookLastError = ''
    } catch (err) {
      claudeHookLastError = err.message || String(err)
      console.error('[whale-pet] refresh Claude hook script failed:', err)
    }
  }
  else if (!want && status.installedEvents > 0) uninstallClaudeHook()
}

function harnessHomePath() {
  const configured = String(process.env.DSH_HOME || '').trim()
  return configured || path.join(os.homedir(), '.dsh')
}

function harnessProfilePath() {
  return path.join(harnessHomePath(), 'profiles', HARNESS_PROFILE)
}

function harnessPatchPath() {
  return path.join(harnessProfilePath(), 'cordis.patch.yml')
}

function harnessNodeModulesPath() {
  return path.join(harnessProfilePath(), 'node_modules')
}

function harnessBridgeLinkPath() {
  return path.join(harnessNodeModulesPath(), HARNESS_BRIDGE_PACKAGE)
}

function harnessPluginInstallPath() {
  return path.join(app.getPath('userData'), 'integrations', 'deepseek-harness')
}

function harnessPluginSourcePath() {
  const candidates = []
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'integrations', 'deepseek-harness'))
    candidates.push(path.join(process.resourcesPath, 'integrations', 'deepseek-harness'))
  }
  const appPath = typeof app.getAppPath === 'function' ? app.getAppPath() : __dirname
  candidates.push(path.join(appPath, 'integrations', 'deepseek-harness'))
  candidates.push(path.join(__dirname, 'integrations', 'deepseek-harness'))
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.js'))) || candidates[candidates.length - 1]
}

function harnessHookEventPath() {
  return path.join(app.getPath('userData'), 'harness-agent-events.jsonl')
}

function harnessPatchBlock() {
  return [
    HARNESS_PATCH_BEGIN,
    '- insert:',
    '    - id: ' + HARNESS_BRIDGE_ID,
    '      name: ' + HARNESS_BRIDGE_PACKAGE,
    HARNESS_PATCH_END,
    '',
  ].join('\r\n')
}

function removeHarnessPatchBlock(text) {
  const source = String(text || '')
  const begin = source.indexOf(HARNESS_PATCH_BEGIN)
  if (begin < 0) return source
  const endMarker = source.indexOf(HARNESS_PATCH_END, begin)
  if (endMarker < 0) return source
  let end = endMarker + HARNESS_PATCH_END.length
  if (source.slice(end, end + 2) === '\r\n') end += 2
  else if (source.charAt(end) === '\n') end += 1
  return source.slice(0, begin).replace(/\s+$/, '') + (source.slice(end).trim() ? '\n' + source.slice(end).replace(/^\s+/, '') : '')
}

function harnessPatchHasEntries(text) {
  return String(text || '').split(/\r?\n/).some((line) => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('#')
  })
}

function mergeHarnessPatch(enabled) {
  const filePath = harnessPatchPath()
  if (!fs.existsSync(filePath) && !enabled) return
  const source = readTextIfExists(filePath)
  const withoutBlock = removeHarnessPatchBlock(source).replace(/\s*$/, '')
  let next = ''

  if (enabled) {
    const block = harnessPatchBlock().replace(/\s*$/, '')
    if (/^\s*\[\]\s*$/m.test(withoutBlock)) {
      next = withoutBlock.replace(/^\s*\[\]\s*$/m, block)
    } else if (withoutBlock) {
      next = withoutBlock + '\r\n' + block
    } else {
      next = block
    }
  } else {
    next = harnessPatchHasEntries(withoutBlock)
      ? withoutBlock
      : (withoutBlock ? withoutBlock + '\r\n' : '') + '[]'
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, next.replace(/\s*$/, '') + '\r\n', 'utf8')
}

function normalizeComparablePath(value) {
  const resolved = path.resolve(String(value || ''))
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function readHarnessJunctionTarget() {
  const linkPath = harnessBridgeLinkPath()
  try {
    if (!fs.lstatSync(linkPath).isSymbolicLink()) return ''
    const target = fs.readlinkSync(linkPath)
    return path.resolve(path.dirname(linkPath), target)
  } catch {
    return ''
  }
}

function ensureHarnessJunction() {
  const linkPath = harnessBridgeLinkPath()
  const installPath = harnessPluginInstallPath()
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })

  try {
    const stat = fs.lstatSync(linkPath)
    if (stat.isSymbolicLink()) {
      const currentTarget = readHarnessJunctionTarget()
      if (normalizeComparablePath(currentTarget) === normalizeComparablePath(installPath)) return
      fs.unlinkSync(linkPath)
    } else {
      throw new Error('DSH 插件目标已存在且不是本应用创建的 junction：' + linkPath)
    }
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err
  }

  fs.symlinkSync(installPath, linkPath, 'junction')
}

function removeHarnessJunction() {
  const linkPath = harnessBridgeLinkPath()
  try {
    const stat = fs.lstatSync(linkPath)
    if (!stat.isSymbolicLink()) return
    const target = readHarnessJunctionTarget()
    if (normalizeComparablePath(target) !== normalizeComparablePath(harnessPluginInstallPath())) return
    fs.unlinkSync(linkPath)
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err
  }
}

function copyHarnessPluginFiles() {
  const source = harnessPluginSourcePath()
  const target = harnessPluginInstallPath()
  if (!fs.existsSync(path.join(source, 'index.js'))) {
    throw new Error('找不到 Harness bridge 插件源码：' + source)
  }
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, { recursive: true, force: true })
}

function harnessHookInstallStatus() {
  let installed = false
  let installedEvents = 0
  let parseError = ''
  try {
    const patchText = readTextIfExists(harnessPatchPath())
    installedEvents = patchText.includes(HARNESS_PATCH_BEGIN) && patchText.includes(HARNESS_BRIDGE_PACKAGE) ? 1 : 0
    const pluginReady = fs.existsSync(path.join(harnessPluginInstallPath(), 'index.js'))
    const linkReady = normalizeComparablePath(readHarnessJunctionTarget()) === normalizeComparablePath(harnessPluginInstallPath())
    installed = installedEvents === 1 && pluginReady && linkReady
  } catch (err) {
    parseError = err.message || String(err)
  }
  return {
    installed,
    installedEvents,
    totalEvents: 1,
    pluginPath: harnessPluginInstallPath(),
    sourcePath: harnessPluginSourcePath(),
    profilePath: harnessProfilePath(),
    patchPath: harnessPatchPath(),
    linkPath: harnessBridgeLinkPath(),
    eventPath: harnessHookEventPath(),
    error: harnessHookLastError || parseError,
  }
}

function harnessHookStatusSnapshot() {
  const status = harnessHookInstallStatus()
  const latest = agentStatusByAgent.harness || {}
  return {
    ...status,
    detected: fs.existsSync(harnessHomePath()),
    detectedPath: harnessHomePath(),
    enabled: !!cfg.harnessHookEnabled,
    desired: !!cfg.agentAnimationEnabled && !!cfg.harnessHookEnabled,
    watcherActive: !!agentRuntimeStatus.harnessHookWatcherActive,
    watcherPath: agentRuntimeStatus.harnessHookPath || '',
    lastSource: latest.source || '',
    lastEvent: latest.event || '',
    lastState: latest.state || '',
    lastDetail: latest.detail || '',
    lastUpdatedAt: Number(latest.updatedAt) || 0,
  }
}

function installHarnessHook() {
  try {
    backupFileOnce(harnessPatchPath())
    copyHarnessPluginFiles()
    ensureHarnessJunction()
    mergeHarnessPatch(true)
    harnessHookLastError = ''
  } catch (err) {
    harnessHookLastError = err.message || String(err)
    console.error('[whale-pet] install Harness bridge failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !harnessHookLastError, error: harnessHookLastError, ...harnessHookStatusSnapshot() }
}

function uninstallHarnessHook() {
  try {
    backupFileOnce(harnessPatchPath())
    mergeHarnessPatch(false)
    removeHarnessJunction()
    harnessHookLastError = ''
  } catch (err) {
    harnessHookLastError = err.message || String(err)
    console.error('[whale-pet] uninstall Harness bridge failed:', err)
  }
  updateAgentWatcher()
  broadcastAgentStatus()
  return { ok: !harnessHookLastError, error: harnessHookLastError, ...harnessHookStatusSnapshot() }
}

function syncHarnessHookInstallation() {
  const want = !!cfg.agentAnimationEnabled && !!cfg.harnessHookEnabled
  const status = harnessHookInstallStatus()
  if (want && !status.installed) installHarnessHook()
  else if (want) {
    try {
      copyHarnessPluginFiles()
      ensureHarnessJunction()
      mergeHarnessPatch(true)
      harnessHookLastError = ''
    } catch (err) {
      harnessHookLastError = err.message || String(err)
      console.error('[whale-pet] refresh Harness bridge failed:', err)
    }
  }
  else if (!want && status.installedEvents > 0) uninstallHarnessHook()
}

function harnessHookEventMapping(record) {
  if (!record || typeof record !== 'object') return null
  if (record.agent && record.agent !== 'harness') return null
  const state = AGENT_STATES.includes(record.state) ? record.state : ''
  if (!state) return null
  return {
    state,
    event: String(record.event || ''),
    detail: record.tool || record.reason || '',
    session: String(record.session || ''),
    seq: Number.isSafeInteger(Number(record.seq)) ? Number(record.seq) : '',
    at: Number(record.at) || 0,
  }
}

function handleHarnessHookLine(line) {
  const text = line.toString('utf8').replace(/^\uFEFF/, '').replace(/\r$/, '').trim()
  if (!text) return
  let record
  try {
    record = JSON.parse(text)
  } catch {
    return
  }
  const mapped = harnessHookEventMapping(record)
  if (!mapped) return
  queueAgentEvent('harness', mapped.state, {
    source: 'harness-bridge',
    event: mapped.event,
    detail: mapped.detail,
    eventId: 'harness-bridge-' + mapped.session + '-' + mapped.seq + '-' + mapped.event + '-' + mapped.at,
    force: mapped.state === 'done',
  })
}

function consumeHarnessHookBytes(watcher, chunk) {
  if (!chunk || chunk.length === 0) return
  const data = watcher.partial.length ? Buffer.concat([watcher.partial, chunk]) : chunk
  let start = 0
  let newline = data.indexOf(0x0a, start)
  while (newline >= 0) {
    if (newline > start) handleHarnessHookLine(data.subarray(start, newline))
    start = newline + 1
    newline = data.indexOf(0x0a, start)
  }
  watcher.partial = start < data.length ? data.subarray(start) : Buffer.alloc(0)
  if (watcher.partial.length > HARNESS_MAX_PENDING_BYTES) watcher.partial = Buffer.alloc(0)
}

function pollHarnessHookEvents() {
  const watcher = harnessHookWatcher
  if (!watcher || !watcher.active) return
  let stat
  try {
    stat = fs.statSync(watcher.filePath)
  } catch {
    return
  }
  if (stat.size < watcher.offset) {
    watcher.offset = 0
    watcher.partial = Buffer.alloc(0)
  }
  if (stat.size <= watcher.offset) return

  const buffer = Buffer.allocUnsafe(Math.min(HARNESS_TAIL_CHUNK_BYTES, stat.size - watcher.offset))
  let fd = null
  try {
    fd = fs.openSync(watcher.filePath, 'r')
    let position = watcher.offset
    while (position < stat.size) {
      const length = Math.min(buffer.length, stat.size - position)
      const bytesRead = fs.readSync(fd, buffer, 0, length, position)
      if (bytesRead <= 0) break
      consumeHarnessHookBytes(watcher, buffer.subarray(0, bytesRead))
      position += bytesRead
    }
    watcher.offset = position
  } catch {
    // Harness events are best effort; the next poll will retry.
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch {}
    }
  }
}

function setHarnessHookWatcherStatus(active, filePath) {
  agentRuntimeStatus = {
    ...agentRuntimeStatus,
    harnessHookWatcherActive: !!active,
    harnessHookPath: filePath || '',
  }
  broadcastAgentStatus()
}

function stopHarnessHookWatcher() {
  if (!harnessHookWatcher) return
  if (harnessHookWatcher.timer) clearInterval(harnessHookWatcher.timer)
  harnessHookWatcher = null
  setHarnessHookWatcherStatus(false, '')
}

function startHarnessHookWatcher() {
  if (harnessHookWatcher && harnessHookWatcher.active) return
  const filePath = harnessHookEventPath()
  let offset = 0
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > HARNESS_MAX_PENDING_BYTES) {
      fs.truncateSync(filePath, 0)
      offset = 0
    } else {
      offset = stat.size
    }
  } catch {
    offset = 0
  }
  harnessHookWatcher = {
    active: true,
    timer: null,
    filePath,
    offset,
    partial: Buffer.alloc(0),
  }
  harnessHookWatcher.timer = setInterval(pollHarnessHookEvents, HARNESS_HOOK_WATCH_INTERVAL_MS)
  setHarnessHookWatcherStatus(true, filePath)
}

function agentStatusSnapshot() {
  const selectedAgent = normalizeAgentId(cfg.agentType)
  const selectedStatus = agentStatusByAgent[selectedAgent] || {}
  const updatedAt = Number(selectedStatus.updatedAt) || 0
  let hookEnabled = !!cfg.codexHookEnabled
  let hookWatcherActive = !!agentRuntimeStatus.hookWatcherActive
  let hookPath = agentRuntimeStatus.hookPath || ''
  let watcherActive = !!agentRuntimeStatus.watcherActive
  let watcherPath = agentRuntimeStatus.watcherPath || ''
  if (selectedAgent === 'claudecode') {
    hookEnabled = !!cfg.claudeHookEnabled
    hookWatcherActive = !!agentRuntimeStatus.claudeHookWatcherActive
    hookPath = agentRuntimeStatus.claudeHookPath || ''
    watcherActive = !!agentRuntimeStatus.claudeHookWatcherActive
    watcherPath = agentRuntimeStatus.claudeHookPath || ''
  } else if (selectedAgent === 'harness') {
    hookEnabled = !!cfg.harnessHookEnabled
    hookWatcherActive = !!agentRuntimeStatus.harnessHookWatcherActive
    hookPath = agentRuntimeStatus.harnessHookPath || ''
    watcherActive = !!agentRuntimeStatus.harnessHookWatcherActive
    watcherPath = agentRuntimeStatus.harnessHookPath || ''
  }
  return {
    enabled: !!cfg.agentAnimationEnabled,
    selectedAgent,
    connected: updatedAt > 0 && Date.now() - updatedAt < AGENT_STATUS_FRESH_MS,
    source: selectedStatus.source || '',
    agent: selectedStatus.agent || selectedAgent,
    state: selectedStatus.state || '',
    event: selectedStatus.event || '',
    detail: selectedStatus.detail || '',
    updatedAt,
    watcherActive,
    watcherPath,
    hookEnabled,
    hookWatcherActive,
    hookPath,
    agents: {
      codex: { ...agentStatusByAgent.codex },
      claudecode: { ...agentStatusByAgent.claudecode },
      harness: { ...agentStatusByAgent.harness },
    },
  }
}

function broadcastAgentStatus() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('pet:agent-status', agentStatusSnapshot())
  }
}

function sendAgentState(rawAgent, rawState, options = {}) {
  const timestamp = Date.now()
  const payload = {
    agent: normalizeAgentId(rawAgent),
    state: normalizeAgentState(rawState),
    timestamp,
    eventId: String(options.eventId || ''),
    force: !!options.force,
    suppressClick: !!options.suppressClick,
    source: String(options.source || ''),
    event: String(options.event || ''),
    detail: compactAgentDetail(options.detail),
  }
  latestAgentEvent = payload
  agentStatusByAgent = {
    ...agentStatusByAgent,
    [payload.agent]: {
      agent: payload.agent,
      source: payload.source,
      state: payload.state,
      event: payload.event,
      detail: payload.detail,
      updatedAt: timestamp,
    },
  }
  agentRuntimeStatus = {
    ...agentRuntimeStatus,
    source: payload.source,
    agent: payload.agent,
    state: payload.state,
    event: payload.event,
    detail: payload.detail,
    updatedAt: timestamp,
  }
  broadcastAgentStatus()
  if (petRendererReady && petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:agent-state', payload)
  }
  return payload
}

function flushPendingAgentEvent() {
  if (!latestAgentEvent || !petRendererReady || !petWin || petWin.isDestroyed()) return
  petWin.webContents.send('pet:agent-state', latestAgentEvent)
}

function nextAgentEventId(prefix) {
  agentEventSeq++
  return prefix + '-' + Date.now().toString(36) + '-' + agentEventSeq.toString(36)
}

function clearCodexDoneIdleTimer() {
  if (!codexDoneIdleTimer) return
  clearTimeout(codexDoneIdleTimer)
  codexDoneIdleTimer = null
}

function clearClaudeDoneIdleTimer() {
  if (!claudeDoneIdleTimer) return
  clearTimeout(claudeDoneIdleTimer)
  claudeDoneIdleTimer = null
}

function clearHarnessDoneIdleTimer() {
  if (!harnessDoneIdleTimer) return
  clearTimeout(harnessDoneIdleTimer)
  harnessDoneIdleTimer = null
}

function clearAgentIdleToSleepTimer() {
  if (agentIdleToSleepTimer) {
    clearTimeout(agentIdleToSleepTimer)
    agentIdleToSleepTimer = null
  }
  agentIdleToSleepAgent = ''
}

function agentIdleToSleepMs() {
  return clamp(
    Number(cfg.sleepMinutes) || DEFAULT_SLEEP_MINUTES,
    MIN_SLEEP_MINUTES,
    MAX_SLEEP_MINUTES,
  ) * 60 * 1000
}

function scheduleAgentIdleToSleep(agent) {
  const normalizedAgent = normalizeAgentId(agent)
  if (!cfg.agentAnimationEnabled || normalizeAgentId(cfg.agentType) !== normalizedAgent) {
    clearAgentIdleToSleepTimer()
    return
  }
  if (agentIdleToSleepTimer && agentIdleToSleepAgent === normalizedAgent) return

  clearAgentIdleToSleepTimer()
  agentIdleToSleepAgent = normalizedAgent
  const sleepMs = agentIdleToSleepMs()
  agentIdleToSleepTimer = setTimeout(() => {
    agentIdleToSleepTimer = null
    if (!cfg.agentAnimationEnabled || normalizeAgentId(cfg.agentType) !== normalizedAgent) {
      agentIdleToSleepAgent = ''
      return
    }
    agentIdleToSleepAgent = ''
    queueAgentEvent(normalizedAgent, 'sleep', {
      source: normalizedAgent + '-idle-timeout',
      event: 'idle-to-sleep',
      detail: 'sleep-after-' + Math.round(sleepMs / 60000) + 'm-idle',
      force: true,
    })
  }, sleepMs)
}

function scheduleCodexIdleAfterDone() {
  clearCodexDoneIdleTimer()
  codexDoneIdleTimer = setTimeout(() => {
    codexDoneIdleTimer = null
    if (!cfg.agentAnimationEnabled || normalizeAgentId(cfg.agentType) !== 'codex') return
    queueAgentEvent('codex', 'idle', {
      source: 'codex-completion',
      event: 'idle-after-stop',
      detail: 'idle',
      force: true,
    })
  }, CODEX_DONE_HOLD_MS)
}

function scheduleClaudeIdleAfterDone() {
  clearClaudeDoneIdleTimer()
  claudeDoneIdleTimer = setTimeout(() => {
    claudeDoneIdleTimer = null
    if (!cfg.agentAnimationEnabled || normalizeAgentId(cfg.agentType) !== 'claudecode') return
    queueAgentEvent('claudecode', 'idle', {
      source: 'claude-completion',
      event: 'idle-after-stop',
      detail: 'idle',
      force: true,
    })
  }, CLAUDE_DONE_HOLD_MS)
}

function scheduleHarnessIdleAfterDone() {
  clearHarnessDoneIdleTimer()
  harnessDoneIdleTimer = setTimeout(() => {
    harnessDoneIdleTimer = null
    if (!cfg.agentAnimationEnabled || normalizeAgentId(cfg.agentType) !== 'harness') return
    queueAgentEvent('harness', 'idle', {
      source: 'harness-completion',
      event: 'idle-after-stop',
      detail: 'idle',
      force: true,
    })
  }, HARNESS_DONE_HOLD_MS)
}

function queueAgentEvent(agent, state, options = {}) {
  const normalizedAgent = normalizeAgentId(agent)
  const normalizedState = normalizeAgentState(state)
  if (normalizedAgent === 'codex') {
    if (normalizedState === 'done') {
      clearAgentIdleToSleepTimer()
      scheduleCodexIdleAfterDone()
    } else {
      clearCodexDoneIdleTimer()
    }
  } else if (normalizedAgent === 'claudecode') {
    if (normalizedState === 'done') {
      clearAgentIdleToSleepTimer()
      scheduleClaudeIdleAfterDone()
    } else {
      clearClaudeDoneIdleTimer()
    }
  } else if (normalizedAgent === 'harness') {
    if (normalizedState === 'done') {
      clearAgentIdleToSleepTimer()
      scheduleHarnessIdleAfterDone()
    } else {
      clearHarnessDoneIdleTimer()
    }
  }
  if (normalizedState === 'idle') scheduleAgentIdleToSleep(normalizedAgent)
  else if (normalizedState !== 'done') clearAgentIdleToSleepTimer()
  return sendAgentState(normalizedAgent, normalizedState, {
    ...options,
    eventId: options.eventId || nextAgentEventId(options.source || 'agent'),
  })
}

function resetManualAgentTest() {
  if (!latestAgentEvent || latestAgentEvent.source !== 'manual') return
  queueAgentEvent(latestAgentEvent.agent, 'idle', {
    source: 'manual-reset',
    event: 'settings-closed',
    detail: 'idle',
    force: true,
  })
}

function parseAgentEventArgs(args) {
  const list = Array.isArray(args) ? args : []
  let agent = ''
  let state = ''
  for (let i = 0; i < list.length; i++) {
    const arg = String(list[i] || '')
    if (arg === '--agent-event') {
      if (AGENT_IDS.includes(list[i + 1])) agent = list[i + 1]
      if (AGENT_STATES.includes(list[i + 2])) state = list[i + 2]
      i += 2
      continue
    }
    if (arg === '--agent-agent') {
      if (AGENT_IDS.includes(list[i + 1])) agent = list[i + 1]
      i++
      continue
    }
    if (arg === '--agent-state') {
      if (AGENT_STATES.includes(list[i + 1])) state = list[i + 1]
      i++
      continue
    }
    const eventMatch = arg.match(/^--agent-event=([^:]+)[:,/](.+)$/)
    if (eventMatch) {
      if (AGENT_IDS.includes(eventMatch[1])) agent = eventMatch[1]
      if (AGENT_STATES.includes(eventMatch[2])) state = eventMatch[2]
    }
  }
  if (!agent || !state) return null
  return { agent, state }
}

function newestChildDirectory(root, matcher) {
  let entries
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return ''
  }
  const names = entries
    .filter((entry) => entry.isDirectory() && (!matcher || matcher(entry.name)))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  return names.length ? path.join(root, names[0]) : ''
}

function findNewestCodexSessionFile() {
  const root = path.join(os.homedir(), '.codex', 'sessions')
  const yearDir = newestChildDirectory(root, (name) => /^\d{4}$/.test(name))
  if (!yearDir) return ''
  const monthDir = newestChildDirectory(yearDir, (name) => /^\d{2}$/.test(name))
  if (!monthDir) return ''
  const dayDir = newestChildDirectory(monthDir, (name) => /^\d{2}$/.test(name))
  if (!dayDir) return ''

  let entries
  try {
    entries = fs.readdirSync(dayDir, { withFileTypes: true })
  } catch {
    return ''
  }
  const candidates = []
  for (const entry of entries) {
    if (!entry.isFile() || !/\.jsonl$/i.test(entry.name)) continue
    const filePath = path.join(dayDir, entry.name)
    try {
      const stat = fs.statSync(filePath)
      candidates.push({ filePath, mtimeMs: stat.mtimeMs })
    } catch {
      // The session may be rotated while scanning.
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates.length ? candidates[0].filePath : ''
}

function setAgentWatcherStatus(active, filePath) {
  agentRuntimeStatus = {
    ...agentRuntimeStatus,
    watcherActive: !!active,
    watcherPath: filePath || '',
  }
  broadcastAgentStatus()
}

function codexEventMapping(record) {
  if (!record || typeof record !== 'object') return null
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {}
  const outerType = String(record.type || '')
  const innerType = String(payload.type || '')
  const eventType = innerType || outerType
  const detail = payload.name || payload.tool_name || payload.message || payload.text || payload.call_id || ''

  if (eventType === 'task_started') return { state: 'link', event: eventType, detail }
  if (eventType === 'user_message') return { state: 'think', event: eventType, detail }
  if (eventType === 'reasoning') return { state: 'think', event: eventType, detail }
  if (eventType === 'function_call') return { state: 'tool', event: eventType, detail }
  if (eventType === 'function_call_output') return { state: 'run', event: eventType, detail }
  if (eventType === 'agent_message' || eventType === 'message') {
    if (eventType === 'message' && payload.role && payload.role !== 'assistant') return null
    return { state: 'reply', event: eventType, detail }
  }
  if (eventType === 'task_complete') return { state: 'done', event: eventType, detail }
  if (eventType === 'turn_aborted' || eventType === 'interrupted') {
    return { state: 'interrupted', event: eventType, detail }
  }
  if (eventType === 'error' || outerType === 'error') return { state: 'error', event: eventType, detail }
  return null
}

function handleCodexLogLine(line) {
  const text = line.toString('utf8').replace(/\r$/, '').trim()
  if (!text) return
  let record
  try {
    record = JSON.parse(text)
  } catch {
    return
  }
  const mapped = codexEventMapping(record)
  if (!mapped) return
  if (cfg.codexHookEnabled && Date.now() - lastCodexHookEventAt < 2500) return
  queueAgentEvent('codex', mapped.state, {
    source: 'codex-session',
    event: mapped.event,
    detail: mapped.detail,
    force: mapped.state === 'done',
  })
}

function codexHookEventMapping(payload) {
  if (!payload || typeof payload !== 'object') return null
  const event = String(payload.hook_event_name || '')
  const detail = payload.tool_name || payload.prompt || payload.last_assistant_message || payload.reason || payload.source || ''
  if (event === 'SessionStart') return { state: 'link', event, detail }
  if (event === 'UserPromptSubmit') return { state: 'think', event, detail }
  if (event === 'PreToolUse') return { state: 'tool', event, detail }
  if (event === 'PostToolUse') return { state: 'run', event, detail }
  if (event === 'PermissionRequest') return { state: 'approval', event, detail }
  if (event === 'Stop') return { state: 'done', event, detail }
  if (event === 'Interrupt') return { state: 'interrupted', event, detail }
  if (event === 'SessionEnd') return { state: 'idle', event, detail }
  return null
}

function handleCodexHookLine(line) {
  const text = line.toString('utf8').replace(/^\uFEFF/, '').replace(/\r$/, '').trim()
  if (!text) return
  let record
  try {
    record = JSON.parse(text)
  } catch {
    return
  }
  let payload = null
  if (record && typeof record.payloadBase64 === 'string') {
    try {
      payload = JSON.parse(Buffer.from(record.payloadBase64, 'base64').toString('utf8'))
    } catch {
      return
    }
  } else if (record && typeof record.payload === 'string') {
    try {
      payload = JSON.parse(record.payload)
    } catch {
      return
    }
  } else {
    payload = record && record.payload
  }
  const mapped = codexHookEventMapping(payload)
  if (!mapped) return
  lastCodexHookEventAt = Date.now()
  const sessionId = String(payload.session_id || '')
  const turnId = String(payload.turn_id || '')
  queueAgentEvent('codex', mapped.state, {
    source: 'codex-hook',
    event: mapped.event,
    detail: mapped.detail,
    eventId: 'codex-hook-' + sessionId + '-' + turnId + '-' + mapped.event + '-' + String(record.recordedAt || ''),
    force: mapped.state === 'done',
  })
}

function claudeHookEventMapping(payload) {
  if (!payload || typeof payload !== 'object') return null
  const event = String(payload.hook_event_name || '')
  const detail = payload.tool_name || payload.prompt || payload.message ||
    payload.reason || payload.agent_type || payload.trigger || payload.source || ''
  if (event === 'SessionStart') return { state: 'link', event, detail }
  if (event === 'UserPromptSubmit') return { state: 'think', event, detail }
  if (event === 'PreToolUse') return { state: 'tool', event, detail }
  if (event === 'PostToolUse') return { state: 'run', event, detail }
  if (event === 'PostToolUseFailure') return { state: 'error', event, detail }
  if (event === 'PermissionRequest') return { state: 'approval', event, detail }
  if (event === 'Notification') {
    const notification = [payload.notification_type, payload.title, payload.message]
      .filter(Boolean)
      .join(' ')
    const needsApproval = /permission|approv|allow|授权|批准|允许/i.test(notification)
    return { state: needsApproval ? 'approval' : 'wait', event, detail }
  }
  if (event === 'PreCompact') return { state: 'wait', event, detail }
  if (event === 'SubagentStart') return { state: 'tool', event, detail }
  if (event === 'SubagentStop') return { state: 'run', event, detail }
  if (event === 'Stop') return { state: 'done', event, detail }
  if (event === 'SessionEnd') return { state: 'idle', event, detail }
  return null
}

function handleClaudeHookLine(line) {
  const text = line.toString('utf8').replace(/^\uFEFF/, '').replace(/\r$/, '').trim()
  if (!text) return
  let record
  try {
    record = JSON.parse(text)
  } catch {
    return
  }
  let payload = null
  if (record && typeof record.payloadBase64 === 'string') {
    try {
      payload = JSON.parse(Buffer.from(record.payloadBase64, 'base64').toString('utf8'))
    } catch {
      return
    }
  } else if (record && typeof record.payload === 'string') {
    try {
      payload = JSON.parse(record.payload)
    } catch {
      return
    }
  } else {
    payload = record && record.payload
  }
  const mapped = claudeHookEventMapping(payload)
  if (!mapped) return
  const sessionId = String(payload.session_id || '')
  const detailId = String(payload.tool_use_id || payload.agent_id || payload.trigger || '')
  queueAgentEvent('claudecode', mapped.state, {
    source: 'claude-hook',
    event: mapped.event,
    detail: mapped.detail,
    eventId: 'claude-hook-' + sessionId + '-' + detailId + '-' + mapped.event + '-' + String(record.recordedAt || ''),
    force: mapped.state === 'done',
  })
}

function consumeCodexHookBytes(watcher, chunk) {
  if (!chunk || chunk.length === 0) return
  const data = watcher.partial.length ? Buffer.concat([watcher.partial, chunk]) : chunk
  let start = 0
  let newline = data.indexOf(0x0a, start)
  while (newline >= 0) {
    if (newline > start) handleCodexHookLine(data.subarray(start, newline))
    start = newline + 1
    newline = data.indexOf(0x0a, start)
  }
  watcher.partial = start < data.length ? data.subarray(start) : Buffer.alloc(0)
  if (watcher.partial.length > CODEX_MAX_PENDING_BYTES) watcher.partial = Buffer.alloc(0)
}

function consumeClaudeHookBytes(watcher, chunk) {
  if (!chunk || chunk.length === 0) return
  const data = watcher.partial.length ? Buffer.concat([watcher.partial, chunk]) : chunk
  let start = 0
  let newline = data.indexOf(0x0a, start)
  while (newline >= 0) {
    if (newline > start) handleClaudeHookLine(data.subarray(start, newline))
    start = newline + 1
    newline = data.indexOf(0x0a, start)
  }
  watcher.partial = start < data.length ? data.subarray(start) : Buffer.alloc(0)
  if (watcher.partial.length > CLAUDE_MAX_PENDING_BYTES) watcher.partial = Buffer.alloc(0)
}

function pollClaudeHookEvents() {
  const watcher = claudeHookWatcher
  if (!watcher || !watcher.active) return
  let stat
  try {
    stat = fs.statSync(watcher.filePath)
  } catch {
    return
  }
  if (stat.size < watcher.offset) {
    watcher.offset = 0
    watcher.partial = Buffer.alloc(0)
  }
  if (stat.size <= watcher.offset) return

  const buffer = Buffer.allocUnsafe(Math.min(CLAUDE_TAIL_CHUNK_BYTES, stat.size - watcher.offset))
  let fd = null
  try {
    fd = fs.openSync(watcher.filePath, 'r')
    let position = watcher.offset
    while (position < stat.size) {
      const length = Math.min(buffer.length, stat.size - position)
      const bytesRead = fs.readSync(fd, buffer, 0, length, position)
      if (bytesRead <= 0) break
      consumeClaudeHookBytes(watcher, buffer.subarray(0, bytesRead))
      position += bytesRead
    }
    watcher.offset = position
  } catch {
    // Hook events are best effort; the next poll will retry.
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch {}
    }
  }
}

function pollCodexHookEvents() {
  const watcher = codexHookWatcher
  if (!watcher || !watcher.active) return
  let stat
  try {
    stat = fs.statSync(watcher.filePath)
  } catch {
    return
  }
  if (stat.size < watcher.offset) {
    watcher.offset = 0
    watcher.partial = Buffer.alloc(0)
  }
  if (stat.size <= watcher.offset) return

  const buffer = Buffer.allocUnsafe(Math.min(CODEX_TAIL_CHUNK_BYTES, stat.size - watcher.offset))
  let fd = null
  try {
    fd = fs.openSync(watcher.filePath, 'r')
    let position = watcher.offset
    while (position < stat.size) {
      const length = Math.min(buffer.length, stat.size - position)
      const bytesRead = fs.readSync(fd, buffer, 0, length, position)
      if (bytesRead <= 0) break
      consumeCodexHookBytes(watcher, buffer.subarray(0, bytesRead))
      position += bytesRead
    }
    watcher.offset = position
  } catch {
    // Hook events are best effort; the next poll will retry.
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch {}
    }
  }
}

function setCodexHookWatcherStatus(active, filePath) {
  agentRuntimeStatus = {
    ...agentRuntimeStatus,
    hookWatcherActive: !!active,
    hookPath: filePath || '',
  }
  broadcastAgentStatus()
}

function stopCodexHookWatcher() {
  if (!codexHookWatcher) return
  if (codexHookWatcher.timer) clearInterval(codexHookWatcher.timer)
  codexHookWatcher = null
  setCodexHookWatcherStatus(false, '')
}

function startCodexHookWatcher() {
  if (codexHookWatcher && codexHookWatcher.active) return
  const filePath = codexHookEventPath()
  let offset = 0
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > CODEX_MAX_PENDING_BYTES) {
      fs.truncateSync(filePath, 0)
      offset = 0
    } else {
      offset = stat.size
    }
  } catch {
    offset = 0
  }
  codexHookWatcher = {
    active: true,
    timer: null,
    filePath,
    offset,
    partial: Buffer.alloc(0),
  }
  codexHookWatcher.timer = setInterval(pollCodexHookEvents, CODEX_HOOK_WATCH_INTERVAL_MS)
  setCodexHookWatcherStatus(true, filePath)
}

function setClaudeHookWatcherStatus(active, filePath) {
  agentRuntimeStatus = {
    ...agentRuntimeStatus,
    claudeHookWatcherActive: !!active,
    claudeHookPath: filePath || '',
  }
  broadcastAgentStatus()
}

function stopClaudeHookWatcher() {
  if (!claudeHookWatcher) return
  if (claudeHookWatcher.timer) clearInterval(claudeHookWatcher.timer)
  claudeHookWatcher = null
  setClaudeHookWatcherStatus(false, '')
}

function startClaudeHookWatcher() {
  if (claudeHookWatcher && claudeHookWatcher.active) return
  const filePath = claudeHookEventPath()
  let offset = 0
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > CLAUDE_MAX_PENDING_BYTES) {
      fs.truncateSync(filePath, 0)
      offset = 0
    } else {
      offset = stat.size
    }
  } catch {
    offset = 0
  }
  claudeHookWatcher = {
    active: true,
    timer: null,
    filePath,
    offset,
    partial: Buffer.alloc(0),
  }
  claudeHookWatcher.timer = setInterval(pollClaudeHookEvents, CLAUDE_HOOK_WATCH_INTERVAL_MS)
  setClaudeHookWatcherStatus(true, filePath)
}

function consumeCodexBytes(watcher, chunk) {
  if (!chunk || chunk.length === 0) return
  const data = watcher.partial.length ? Buffer.concat([watcher.partial, chunk]) : chunk
  let start = 0
  let newline = data.indexOf(0x0a, start)
  while (newline >= 0) {
    if (newline > start) handleCodexLogLine(data.subarray(start, newline))
    start = newline + 1
    newline = data.indexOf(0x0a, start)
  }
  watcher.partial = start < data.length ? data.subarray(start) : Buffer.alloc(0)
  if (watcher.partial.length > CODEX_MAX_PENDING_BYTES) watcher.partial = Buffer.alloc(0)
}

function pollCodexSession() {
  const watcher = codexWatcher
  if (!watcher || !watcher.active) return
  const newest = findNewestCodexSessionFile()
  if (!newest) return

  if (watcher.filePath !== newest) {
    watcher.filePath = newest
    watcher.partial = Buffer.alloc(0)
    let startAt = 0
    try {
      startAt = fs.statSync(newest).size
    } catch {
      startAt = 0
    }
    watcher.offset = startAt
    setAgentWatcherStatus(true, newest)
  }

  let stat
  try {
    stat = fs.statSync(watcher.filePath)
  } catch {
    return
  }
  const start = stat.size < watcher.offset ? 0 : watcher.offset
  if (start === 0 && stat.size < watcher.offset) {
    watcher.partial = Buffer.alloc(0)
  }
  if (stat.size <= start) {
    watcher.offset = start
    return
  }

  const buffer = Buffer.allocUnsafe(Math.min(CODEX_TAIL_CHUNK_BYTES, stat.size - start))
  let fd = null
  try {
    fd = fs.openSync(watcher.filePath, 'r')
    let position = start
    while (position < stat.size) {
      const length = Math.min(buffer.length, stat.size - position)
      const bytesRead = fs.readSync(fd, buffer, 0, length, position)
      if (bytesRead <= 0) break
      consumeCodexBytes(watcher, buffer.subarray(0, bytesRead))
      position += bytesRead
    }
    watcher.offset = position
  } catch {
    // Session files are best effort; a later poll will retry.
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch {}
    }
  }
}

function stopCodexSessionWatcher() {
  if (!codexWatcher) return
  if (codexWatcher.timer) clearInterval(codexWatcher.timer)
  codexWatcher = null
  setAgentWatcherStatus(false, '')
}

function startCodexSessionWatcher() {
  if (codexWatcher && codexWatcher.active) return
  const filePath = findNewestCodexSessionFile()
  codexWatcher = {
    active: true,
    timer: null,
    filePath,
    offset: 0,
    partial: Buffer.alloc(0),
  }
  if (filePath) {
    try {
      codexWatcher.offset = fs.statSync(filePath).size
    } catch {
      codexWatcher.offset = 0
    }
  }
  codexWatcher.timer = setInterval(pollCodexSession, CODEX_WATCH_INTERVAL_MS)
  setAgentWatcherStatus(!!filePath, filePath)
}

function updateAgentWatcher() {
  const selectedAgent = normalizeAgentId(cfg.agentType)
  const animationEnabled = !!cfg.agentAnimationEnabled
  const shouldWatchCodexSession = animationEnabled && selectedAgent === 'codex' && !cfg.codexHookEnabled
  const shouldWatchCodexHook = animationEnabled && !!cfg.codexHookEnabled
  const shouldWatchClaude = animationEnabled && !!cfg.claudeHookEnabled
  const shouldWatchHarness = animationEnabled && !!cfg.harnessHookEnabled

  if (!animationEnabled) clearAgentIdleToSleepTimer()
  if (!shouldWatchCodexSession) clearCodexDoneIdleTimer()
  if (shouldWatchCodexSession) startCodexSessionWatcher()
  else stopCodexSessionWatcher()
  if (shouldWatchCodexHook) startCodexHookWatcher()
  else stopCodexHookWatcher()

  if (!shouldWatchClaude) clearClaudeDoneIdleTimer()
  if (shouldWatchClaude && cfg.claudeHookEnabled) startClaudeHookWatcher()
  else stopClaudeHookWatcher()

  if (!shouldWatchHarness) clearHarnessDoneIdleTimer()
  if (shouldWatchHarness && cfg.harnessHookEnabled) startHarnessHookWatcher()
  else stopHarnessHookWatcher()

  if (!animationEnabled || agentIdleToSleepAgent && agentIdleToSleepAgent !== selectedAgent) {
    clearAgentIdleToSleepTimer()
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
let pendingFastPetPosition = null
let fastPetPositionScheduled = false

function applyPetPosition(x, y, options = {}) {
  if (!petWin || petWin.isDestroyed()) return { x: 0, y: 0 }
  const nx = Math.round(Number(x))
  const ny = Math.round(Number(y))
  if (!isFinite(nx) || !isFinite(ny)) {
    const [px, py] = petWin.getPosition()
    return { x: px, y: py }
  }
  // 用 setBounds 显式固定宽高再移动：Windows 显示缩放非 100% 时，setPosition 拖动无边框
  // 窗口会按移动方向被拉伸放大；这里锁定为正方形，避免拖动时变形（修复「拖动放大」）
  const size = petSize(cfg.scale)
  petWin.setBounds({ x: nx, y: ny, width: size, height: size })
  syncBarBounds()
  if (options.persist) schedulePosSave()
  return { x: nx, y: ny }
}

function flushFastPetPosition() {
  fastPetPositionScheduled = false
  const next = pendingFastPetPosition
  pendingFastPetPosition = null
  if (next) applyPetPosition(next.x, next.y)
}

ipcMain.handle('pet:get-balance', () => fetchBalance())
ipcMain.handle('pet:get-screen', () => {
  const d = screen.getPrimaryDisplay()
  return { workArea: d.workArea, bounds: d.bounds }
})
ipcMain.handle('pet:get-position', () => {
  if (!petWin || petWin.isDestroyed()) return { x: 0, y: 0 }
  const [x, y] = petWin.getPosition()
  return { x, y }
})
ipcMain.handle('pet:set-position', (_e, { x, y } = {}) => applyPetPosition(x, y, { persist: true }))
ipcMain.on('pet:set-position-fast', (_e, { x, y } = {}) => {
  pendingFastPetPosition = { x, y }
  if (fastPetPositionScheduled) return
  fastPetPositionScheduled = true
  setImmediate(flushFastPetPosition)
})
ipcMain.handle('pet:get-size', () => {
  const scale = cfg.scale
  return { size: petSize(scale), scale, minSize: MIN_SIZE, maxSize: MAX_SIZE }
})
ipcMain.handle('pet:set-scale', (_e, { scale }) => {
  const next = Math.round(clamp(scale, MIN_SCALE, MAX_SCALE) * 10) / 10
  cfg = saveConfig({ scale: next })
  if (petWin && !petWin.isDestroyed()) {
    const b = petWin.getBounds()
    const size = petSize(next)
    petWin.setBounds({ x: b.x, y: b.y, width: size, height: size })
    syncBarWindow()
  }
  return { scale: next, size: petSize(next) }
})
ipcMain.handle('pet:get-config', () => {
  return rendererConfig(loadConfig(), false)
})
ipcMain.handle('pet:get-full-config', () => {
  return rendererConfig(loadConfig(), true)
})
ipcMain.handle('pet:save-settings', (_e, settings) => {
  const s = settings || {}
  const apiKey = String(s.apiKey || '').trim()
  const balanceUrl = String(s.balanceUrl || '').trim()
  const label = String(s.label || '').trim() || 'DeepSeek 余额'
  let refreshSec = Number(s.refreshSec)
  if (!Number.isFinite(refreshSec)) refreshSec = 30
  refreshSec = Math.round(clamp(refreshSec, 0, 3600))
  let lowThreshold = Number(s.lowThreshold)
  if (!Number.isFinite(lowThreshold)) lowThreshold = 5
  lowThreshold = clamp(lowThreshold, 0, 100000)
  let scale = Number(s.scale)
  if (!Number.isFinite(scale)) scale = cfg.scale
  scale = Math.round(clamp(scale, MIN_SCALE, MAX_SCALE) * 10) / 10
  // 缺失的字段保留当前已保存的值，避免部分保存把设置重置回默认
  const cur = loadConfig()
  let sleepMinutes = Number(s.sleepMinutes)
  if (!Number.isFinite(sleepMinutes)) sleepMinutes = cur.sleepMinutes
  sleepMinutes = Math.round(clamp(sleepMinutes, MIN_SLEEP_MINUTES, MAX_SLEEP_MINUTES))
  let volume = Number(s.volume)
  if (!Number.isFinite(volume)) volume = cur.volume
  volume = clamp(volume, 0, 1)
  const bool = function (v, dft) { return typeof v === 'boolean' ? v : dft }
  const contentMode = (s.contentMode === 'memory') ? 'memory' : 'balance'
  const displayStyle = (contentMode === 'memory' || s.displayStyle !== 'bar') ? 'bubble' : 'bar'
  const patch = {
    apiKey, balanceUrl,
    snap: bool(s.snap, cur.snap !== false),
    label,
    refreshSec,
    scale,
    lowBalanceAlert: bool(s.lowBalanceAlert, !!cur.lowBalanceAlert),
    lowThreshold,
    idleTransparency: bool(s.idleTransparency, cur.idleTransparency !== false),
    idleSec: clamp(Number(s.idleSec) || cur.idleSec || 5, 1, 300),
    trackStats: bool(s.trackStats, cur.trackStats !== false),
    bounceAnim: bool(s.bounceAnim, cur.bounceAnim !== false),
    decreaseHintEnabled: bool(s.decreaseHintEnabled, cur.decreaseHintEnabled !== false),
    sound: bool(s.sound, cur.sound !== false),
    volume,
    bounceStrength: oneOf(s.bounceStrength, ['minimal', 'soft', 'normal', 'strong'], cur.bounceStrength || 'normal'),
    sleepMinutes,
    bubbleMode: oneOf(s.bubbleMode, ['always', 'hover', 'click'], cur.bubbleMode || 'click'),
    clickSound: bool(s.clickSound, cur.clickSound !== false),
    clickSoundSet: (s.clickSoundSet === 'fx1' || s.clickSoundSet === 'custom') ? s.clickSoundSet : 'duck',
    quotesEnabled: bool(s.quotesEnabled, !!cur.quotesEnabled),
    quotesText: String(s.quotesText || '').trim(),
    contentMode,
    memoryStyle: (s.memoryStyle === 'bubble') ? 'bubble' : 'fill',
    displayStyle,
    customImage: bool(s.customImage, !!cur.customImage),
    hotkey: bool(s.hotkey, cur.hotkey !== false),
    autoStart: bool(s.autoStart, !!cur.autoStart),
    displayMode: oneOf(s.displayMode, ['all', 'taskbar', 'tray', 'hidden'], cur.displayMode || 'tray'),
    alwaysOnTop: bool(s.alwaysOnTop, cur.alwaysOnTop !== false),
    showTime: bool(s.showTime, cur.showTime !== false),
    agentAnimationEnabled: bool(s.agentAnimationEnabled, !!cur.agentAnimationEnabled),
    agentType: oneOf(s.agentType, AGENT_IDS, normalizeAgentId(cur.agentType)),
    agentClickAnimation: bool(s.agentClickAnimation, cur.agentClickAnimation !== false),
    codexHookEnabled: bool(s.codexHookEnabled, !!cur.codexHookEnabled),
    claudeHookEnabled: bool(s.claudeHookEnabled, !!cur.claudeHookEnabled),
    harnessHookEnabled: bool(s.harnessHookEnabled, !!cur.harnessHookEnabled),
  }
  const oldMode = cur.displayMode || 'all'
  const oldSkip = (oldMode === 'tray' || oldMode === 'hidden')
  const newSkip = (patch.displayMode === 'tray' || patch.displayMode === 'hidden')
  cfg = saveConfig(patch)
  syncCodexHookInstallation()
  syncClaudeHookInstallation()
  syncHarnessHookInstallation()
  // 缩放变化时同步窗口尺寸
  if (petWin && !petWin.isDestroyed()) {
    const b = petWin.getBounds()
    const size = petSize(cfg.scale)
    petWin.setBounds({ x: b.x, y: b.y, width: size, height: size })
  }
  if (oldSkip !== newSkip) {
    // 任务栏显隐状态变化 -> 重建窗口以应用创建期 skipTaskbar
    recreatePetWindow()
  } else {
    applyDisplayMode(cfg.displayMode)
  }
  syncBarWindow()
  updateHotkey(cfg.hotkey)
  updateAutoStart(cfg.autoStart)
  updateAgentWatcher()
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:refresh')
    petWin.webContents.send('pet:config-updated')
  }
  return { ok: true, hasKey: !!apiKey }
})
ipcMain.handle('pet:save-key', (_e, { apiKey }) => {
  cfg = saveConfig({ apiKey: String(apiKey || '').trim() })
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:refresh')
  return { ok: true, hasKey: !!cfg.apiKey.trim() }
})
ipcMain.handle('pet:get-stats', () => {
  loadStats()
  return { today: stats.today, todayUsed: stats.todayUsed, lastBalance: stats.lastBalance }
})
ipcMain.handle('pet:get-memory', () => {
  const total = os.totalmem()
  const free = os.freemem()
  const used = Math.max(0, total - free)
  const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0
  return { total, free, used, percent }
})
ipcMain.handle('pet:get-agent-assets', (_e, { agent, state } = {}) => {
  return resolveAgentGifAssets(agent, state)
})
ipcMain.handle('pet:get-agent-status', () => agentStatusSnapshot())
ipcMain.handle('pet:get-codex-hook-status', () => codexHookStatusSnapshot())
ipcMain.handle('pet:install-codex-hook', () => installCodexHook())
ipcMain.handle('pet:uninstall-codex-hook', () => uninstallCodexHook())
ipcMain.handle('pet:get-claude-hook-status', () => claudeHookStatusSnapshot())
ipcMain.handle('pet:install-claude-hook', () => installClaudeHook())
ipcMain.handle('pet:uninstall-claude-hook', () => uninstallClaudeHook())
ipcMain.handle('pet:get-harness-hook-status', () => harnessHookStatusSnapshot())
ipcMain.handle('pet:install-harness-hook', () => installHarnessHook())
ipcMain.handle('pet:uninstall-harness-hook', () => uninstallHarnessHook())
ipcMain.handle('pet:set-agent-state', (_e, { agent, state } = {}) => {
  const payload = queueAgentEvent(agent, state, {
    force: true,
    source: 'manual',
    event: 'manual',
    detail: state,
  })
  return { ok: true, ...payload }
})
ipcMain.handle('pet:wake-agent', (_e, { agent } = {}) => {
  clearAgentIdleToSleepTimer()
  const normalizedAgent = normalizeAgentId(agent || cfg.agentType)
  const payload = queueAgentEvent(normalizedAgent, 'idle', {
    force: true,
    source: 'user-wake',
    event: 'wake',
    detail: 'idle',
    suppressClick: true,
  })
  return { ok: true, ...payload }
})
ipcMain.handle('pet:set-idle', (_e, { idle }) => {
  if (petWin && !petWin.isDestroyed()) {
    petWin.setOpacity(idle ? 0.4 : 1)
  }
  return { idle: !!idle }
})
ipcMain.handle('pet:set-ignore-mouse', (_e, { ignore }) => {
  if (petWin && !petWin.isDestroyed()) {
    // 透明区域鼠标穿透：true 时透明像素不再拦截点击，forward 让移动事件仍进入页面，
    // 从而能在悬停到鲸鱼本体时重新接管鼠标
    petWin.setIgnoreMouseEvents(!!ignore, { forward: true })
  }
  return { ignore: !!ignore }
})
ipcMain.handle('pet:update-bar', (_e, data) => {
  latestBarData = data || null
  if (barWin && !barWin.isDestroyed() && latestBarData) {
    barWin.webContents.send('pet:bar-data', latestBarData)
  }
  return { ok: true }
})
ipcMain.handle('pet:get-update-status', () => updateStateSnapshot())
ipcMain.handle('pet:check-for-updates', () => checkForUpdates())
ipcMain.handle('pet:download-update', () => downloadUpdate())
ipcMain.handle('pet:install-update', () => installUpdate())
ipcMain.handle('pet:open-update-releases', () => openUpdateReleases())
ipcMain.handle('pet:get-image-url', () => {
  const c = loadConfig()
  if (c.customImage && fs.existsSync(customImagePath())) {
    return { url: 'file://' + customImagePath().replace(/\\/g, '/') }
  }
  return { url: '' }
})
ipcMain.handle('pet:get-audio-url', () => {
  if (fs.existsSync(customAudioPath())) {
    return { url: 'file://' + customAudioPath().replace(/\\/g, '/') }
  }
  return { url: '' }
})
ipcMain.handle('pet:choose-image', () => chooseCustomImage())
ipcMain.handle('pet:choose-audio', () => chooseCustomAudio())
ipcMain.handle('pet:open-settings', () => openSettings())
ipcMain.handle('pet:quit', () => {
  if (posSaveTimer) clearTimeout(posSaveTimer)
  app.quit()
})

// ---------------------------------------------------------------------------
// 启动（单实例 + whenReady）
// ---------------------------------------------------------------------------
const isSmokeTest = process.argv.includes('--smoke-test')
const isCaptureDemo = process.argv.includes('--capture-demo')
const startupAgentEvent = parseAgentEventArgs(process.argv)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  if (startupAgentEvent) {
    queueAgentEvent(startupAgentEvent.agent, startupAgentEvent.state, {
      source: 'cli',
      event: 'command-line',
      force: true,
      detail: '--agent-event',
    })
  }

  app.on('second-instance', (_event, commandLine) => {
    const event = parseAgentEventArgs(commandLine)
    if (event) {
      queueAgentEvent(event.agent, event.state, {
        source: 'cli',
        event: 'command-line',
        force: true,
        detail: '--agent-event',
      })
    }
    if (petWin && !petWin.isDestroyed()) {
      petWin.show()
      petWin.focus()
    }
  })

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId('com.azzle.deepseek-whale-pet')
    console.log('[boot] userData=' + app.getPath('userData'))
    loadStats()
    createPetWindow()

    if (isSmokeTest) {
      await new Promise((r) => setTimeout(r, 3500))
      if (petWin && !petWin.isDestroyed()) {
        try {
          const info = await petWin.webContents.executeJavaScript(`(() => {
            const el = (s) => document.querySelector(s)
            return {
              pet: !!el('.dshp-root'),
              imgLoaded: !!el('.dshp-img') && el('.dshp-img').complete && el('.dshp-img').naturalWidth > 0,
              label: el('.dshp-label') ? el('.dshp-label').textContent : null,
              time: el('.dshp-time') ? el('.dshp-time').textContent : null,
              amount: el('.dshp-amount') ? el('.dshp-amount').textContent : null,
              hint: el('.dshp-hint') ? el('.dshp-hint').textContent : null,
              bodyText: document.body.innerText,
            }
          })()`)
          console.log('[smoke] DOM=' + JSON.stringify(info))
          try {
            await petWin.webContents.executeJavaScript(`window.pet.setPosition(120, 130)`)
            await new Promise((r) => setTimeout(r, 400))
            const pos = await petWin.webContents.executeJavaScript(`window.pet.getPosition()`)
            console.log('[smoke] pos-ipc=' + JSON.stringify(pos))
          } catch (err) { console.error('[smoke] pos-ipc failed:', err) }
          const image = await petWin.webContents.capturePage()
          const outDir = process.env.WHALE_PET_SMOKE_DIR || app.getPath('temp')
          fs.mkdirSync(outDir, { recursive: true })
          const shot = path.join(outDir, 'whale-pet-smoke.png')
          fs.writeFileSync(shot, image.toPNG())
          const bmp = nativeImage.createFromBuffer(image.toPNG()).toBitmap()
          let opaque = 0
          const total = bmp.length / 4
          for (let i = 0; i < bmp.length; i += 4) if (bmp[i + 3] > 8) opaque++
          console.log('[smoke] pixels total=' + total + ' opaque=' + opaque + ' ratio=' + (opaque / total).toFixed(3))
          console.log('[smoke] screenshot=' + shot)

          // 设置窗口检查
          openSettings()
          await new Promise((r) => setTimeout(r, 1800))
          if (settingsWin && !settingsWin.isDestroyed()) {
            const sinfo = await settingsWin.webContents.executeJavaScript(
              `(() => ({
                title: document.title,
                hasInput: !!document.getElementById('keyInput'),
                hasLabel: !!document.getElementById('labelInput'),
                hasSnap: !!document.getElementById('snapInput'),
                hasUrl: !!document.getElementById('urlInput'),
                hasRefresh: !!document.getElementById('refreshInput'),
                hasLow: !!document.getElementById('lowAlertInput'),
                hasThreshold: !!document.getElementById('lowThresholdInput'),
                hasAutoStart: !!document.getElementById('autoStartInput'),
                hasIdle: !!document.getElementById('idleInput'),
                hasStats: !!document.getElementById('trackStatsInput'),
                hasBounce: !!document.getElementById('bounceInput'),
                hasBounceStrength: !!document.getElementById('bounceStrengthInput'),
                hasSound: !!document.getElementById('soundInput'),
                hasBubbleMode: !!document.getElementById('bubbleModeGroup'),
                hasClickSound: !!document.getElementById('clickSoundInput'),
                hasClickSoundSet: !!document.getElementById('clickSoundSetInput'),
                hasAudioBtn: !!document.getElementById('audioBtn'),
                hasQuotes: !!document.getElementById('quotesInput'),
                hasImage: !!document.getElementById('imageBtn'),
                hasHotkey: !!document.getElementById('hotkeyInput'),
                hasDisplayMode: !!document.querySelector('input[name=displayMode]'),
                hasAlwaysTop: !!document.getElementById('alwaysTopInput'),
                hasShowTime: !!document.getElementById('showTimeInput'),
                hasAgentAnimation: !!document.getElementById('agentAnimationInput'),
                hasAgentType: !!document.getElementById('agentTypeInput'),
                hasAgentClick: !!document.getElementById('agentClickAnimationInput'),
                hasAgentTest: !!document.getElementById('agentTestGrid'),
                hasAgentSleepHint: document.body.innerText.includes('空闲达到上方分钟数后进入睡眠'),
                hasSleepMinutes: !!document.getElementById('sleepMinutesInput'),
                hasThreeAgentPanels: document.querySelectorAll('.agent-panel').length === 3,
                hasCodexHookWrap: !!document.getElementById('codexHookWrap'),
                hasCodexHook: !!document.getElementById('codexHookInput'),
                hasCodexHookStatus: !!document.getElementById('codexHookStatusPanel'),
                hasCodexDetected: !!document.getElementById('codexDetectedText'),
                hasCodexHookInstall: !!document.getElementById('codexHookInstallBtn'),
                hasCodexHookUninstall: !!document.getElementById('codexHookUninstallBtn'),
                hasCodexTutorial: !!document.getElementById('codexTutorialPanel'),
                hasClaudeHookWrap: !!document.getElementById('claudeHookWrap'),
                hasClaudeHook: !!document.getElementById('claudeHookInput'),
                hasClaudeHookStatus: !!document.getElementById('claudeHookStatusPanel'),
                hasClaudeDetected: !!document.getElementById('claudeDetectedText'),
                hasClaudeHookInstall: !!document.getElementById('claudeHookInstallBtn'),
                hasClaudeHookUninstall: !!document.getElementById('claudeHookUninstallBtn'),
                hasClaudeTutorial: !!document.getElementById('claudeTutorialPanel'),
                hasHarnessHookWrap: !!document.getElementById('harnessHookWrap'),
                hasHarnessHook: !!document.getElementById('harnessHookInput'),
                hasHarnessHookStatus: !!document.getElementById('harnessHookStatusPanel'),
                hasHarnessDetected: !!document.getElementById('harnessDetectedText'),
                hasHarnessHookInstall: !!document.getElementById('harnessHookInstallBtn'),
                hasHarnessHookUninstall: !!document.getElementById('harnessHookUninstallBtn'),
                hasHarnessTutorial: !!document.getElementById('harnessTutorialPanel'),
                hasUpdateCheck: !!document.getElementById('updateCheckBtn'),
                hasUpdateDownload: !!document.getElementById('updateDownloadBtn'),
                hasUpdateInstall: !!document.getElementById('updateInstallBtn'),
                hasUpdateReleases: !!document.getElementById('updateReleaseBtn'),
              }))()`
            )
            console.log('[smoke] settings=' + JSON.stringify(sinfo))
          // 布局自检：body 不应滚动（避免双滚动条），只有内层滚动区滚动
          try {
            const lay = await settingsWin.webContents.executeJavaScript(`(() => {
              const sc = document.querySelector('.scroll')
              return {
                winH: window.innerHeight,
                bodyScrollH: document.body.scrollHeight,
                bodyOverflow: document.body.scrollHeight - window.innerHeight,
                scrollOverflow: sc ? sc.scrollHeight - sc.clientHeight : -1
              }
            })()`)
            console.log('[smoke] settings-layout=' + JSON.stringify(lay))
          } catch (err) { console.error('[smoke] settings-layout failed:', err) }
          // 设置窗口复选框是否反映保存的值（idleTransparency 应为 false）
          try {
            const boxes = await settingsWin.webContents.executeJavaScript(`(() => ({
              idle: document.getElementById('idleInput').checked,
              snap: document.getElementById('snapInput').checked,
            }))()`)
            console.log('[smoke] settings-boxes=' + JSON.stringify(boxes))
          // 自动保存自检：勾选 snap 开关（不点保存），等 1 秒看配置是否自动写入
          try {
            const snapBefore = loadConfig().snap
            await settingsWin.webContents.executeJavaScript(`(() => {
              var el = document.getElementById('snapInput')
              el.checked = true
              el.dispatchEvent(new Event('change', { bubbles: true }))
            })()`)
            await new Promise((r) => setTimeout(r, 1200))
            const snapAfter = loadConfig().snap
            console.log('[smoke] auto-save snap before=' + snapBefore + ' after=' + snapAfter)
          } catch (err) { console.error('[smoke] auto-save test failed:', err) }
          } catch (err) { console.error('[smoke] settings-boxes failed:', err) }
          // 音频状态检查（音效功能）
          try {
            const audioState = await petWin.webContents.executeJavaScript(`window.__dshpAudioTest()`)
            console.log('[smoke] audio-state=' + audioState)
          // 鸭叫按压音效检查（加载状态）
          try {
            const duckAudio = await petWin.webContents.executeJavaScript(`window.__dshpDuckAudioTest ? window.__dshpDuckAudioTest() : null`)
            console.log('[smoke] duck-audio=' + JSON.stringify(duckAudio))
          } catch (err) { console.error('[smoke] duck-audio failed:', err) }
          // 气泡/鼠标穿透自检：悬停鲸鱼时气泡展开并接管鼠标，移开后气泡自动收起并恢复穿透
          try {
            const ui = await petWin.webContents.executeJavaScript(`(async () => {
              for (let i = 0; i < 60; i++) {
                if (window.__dshpUiDebug && window.__dshpUiDebug().hitReady) break
                await new Promise(function (r) { setTimeout(r, 60) })
              }
              var d = window.__dshpUiDebug()
              var r = d.whaleRect
              var x = r.left + r.width * 0.5
              var y = r.top + r.height * 0.5
              document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
              await new Promise(function (r) { setTimeout(r, 150) })
              var onWhale = window.__dshpUiDebug()
              document.dispatchEvent(new PointerEvent('pointermove', { clientX: 6, clientY: 6, bubbles: true }))
              await new Promise(function (r) { setTimeout(r, 80) })
              var offWhale = window.__dshpUiDebug()
              await new Promise(function (r) { setTimeout(r, 1100) })
              var afterHide = window.__dshpUiDebug()
              return {
                hitReady: onWhale.hitReady,
                whaleOpen: onWhale.bubbleShown,
                whaleThrough: onWhale.mouseThrough,
                offThrough: offWhale.mouseThrough,
                hiddenShown: afterHide.bubbleShown
              }
            })()`)
            console.log('[smoke] ui-hover=' + JSON.stringify(ui))
          } catch (err) { console.error('[smoke] ui-hover failed:', err) }
          // 打印桌宠实际应用的功能开关（验证设置记忆）
          try {
            const flags = await petWin.webContents.executeJavaScript(`window.__dshpFlags ? window.__dshpFlags() : null`)
            const cfgState = await petWin.webContents.executeJavaScript(`window.__dshpConfig ? window.__dshpConfig() : null`)
            console.log('[smoke] applied-flags=' + JSON.stringify(flags) + ' cfg=' + JSON.stringify(cfgState))
          // Agent GIF 自检：解析循环时长、状态轮换、单击/连击边界
          try {
            const agentProbe = await petWin.webContents.executeJavaScript(`(async () => {
              const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
              const assets = await window.pet.getAgentAssets('codex', 'click')
              window.__dshpAgentAnimation.configure({ agentAnimationEnabled: true, agentType: 'codex', agentClickAnimation: true })
              window.__dshpAgentAnimation.setState('think')
              await wait(700)
              const stateStatus = window.__dshpAgentAnimation.status()
              const stateDurationMs = stateStatus.assetDurationMs || 3200
              const rotateAfter = Math.max(10500, stateDurationMs * Math.ceil(10000 / stateDurationMs) + 800)
              await wait(rotateAfter)
              const rotatedStatus = window.__dshpAgentAnimation.status()

              window.__dshpAgentAnimation.click()
              let singleStarted = null
              for (let i = 0; i < 30; i++) {
                await wait(30)
                const current = window.__dshpAgentAnimation.status()
                if (current.clickActive) {
                  singleStarted = current
                  break
                }
              }
              if (!singleStarted) throw new Error('click asset did not start')
              const singleCycleOk = singleStarted.clickCycles === 1
                && Math.abs((singleStarted.clickEndsAt - singleStarted.clickStartedAt) - singleStarted.clickDurationMs) < 5
              await wait(Math.max(0, singleStarted.clickEndsAt - performance.now()) + 350)
              const singleAfter = window.__dshpAgentAnimation.status()

              const sessionsBeforeRapid = singleAfter.clickSessionCount
              window.__dshpAgentAnimation.click()
              let rapidStarted = null
              for (let i = 0; i < 30; i++) {
                await wait(25)
                const current = window.__dshpAgentAnimation.status()
                if (current.clickActive) {
                  rapidStarted = current
                  break
                }
              }
              if (!rapidStarted) throw new Error('rapid click asset did not start')
              window.__dshpAgentAnimation.click()
              await wait(60)
              window.__dshpAgentAnimation.click()
              await wait(60)
              const rapidDuring = window.__dshpAgentAnimation.status()
              await wait(Math.max(0, rapidDuring.clickEndsAt - performance.now()) + 350)
              const rapidAfter = window.__dshpAgentAnimation.status()
              window.__dshpAgentAnimation.configure({ agentAnimationEnabled: false, agentType: 'codex', agentClickAnimation: true })
              return {
                clickAssets: assets ? assets.assets.length : 0,
                firstDurationMs: assets && assets.assets[0] ? assets.assets[0].durationMs : 0,
                firstFrames: assets && assets.assets[0] ? assets.assets[0].frameCount : 0,
                stateStatus,
                rotatedStatus,
                rotationChanged: rotatedStatus.stateLoadCount > stateStatus.stateLoadCount,
                singleStarted,
                singleCycleOk,
                singleEnded: !singleAfter.clickActive,
                rapidDuring,
                rapidExtended: rapidDuring.clickCycles >= 1 && rapidDuring.clickEndsAt > rapidDuring.clickStartedAt,
                rapidSingleSession: rapidDuring.clickSessionCount === sessionsBeforeRapid + 1,
                rapidEnded: !rapidAfter.clickActive
              }
            })()`)
            console.log('[smoke] agent-gif=' + JSON.stringify(agentProbe))
          } catch (err) { console.error('[smoke] agent-gif failed:', err) }
          // 显示模式自检：4 种模式下桌宠都应始终可见（模式只影响任务栏/托盘图标）
          // 注意：切换任务栏组会重建桌宠窗口，因此从稳定的设置窗口发 saveSettings
          try {
            const visMap = {}
            for (const m of ['all', 'taskbar', 'tray', 'hidden']) {
              await settingsWin.webContents.executeJavaScript(`window.pet.saveSettings({ displayMode: '${m}' })`)
              await new Promise((r) => setTimeout(r, 2000))   // 重建窗口需时间
              visMap[m] = petWin.isVisible()
            }
            await settingsWin.webContents.executeJavaScript(`window.pet.saveSettings({ displayMode: 'all' })`)
            await new Promise((r) => setTimeout(r, 2000))
            console.log('[smoke] display-mode visible-map=' + JSON.stringify(visMap))
          } catch (err) { console.error('[smoke] display-mode test failed:', err) }
          } catch (err) { console.error('[smoke] flags check failed:', err) }
          // 余额结算自检：后台刷新不改屏幕数字，展开气泡时按上次查看值滚动并显示减少值
          try {
            const flashTest = await petWin.webContents.executeJavaScript(`(async () => {
              window.__dshpHideBubble()
              window.__dshpSetFakeBalance({ ok: true, totalBalance: '10.00', currency: 'CNY' })
              window.__dshpTestRefresh()
              await new Promise(function (r) { setTimeout(r, 700) })
              var before = window.__dshpTestState()
              window.__dshpSetFakeBalance({ ok: true, totalBalance: '9.50', currency: 'CNY' })
              window.__dshpTestAutoRefresh()
              await new Promise(function (r) { setTimeout(r, 800) })
              var afterAuto = window.__dshpTestState()
              window.__dshpShowBubble()
              await new Promise(function (r) { setTimeout(r, 80) })
              var afterView = window.__dshpTestState()
              await new Promise(function (r) { setTimeout(r, 800) })
              window.__dshpSetFakeBalance({ ok: true, totalBalance: '9.20', currency: 'CNY' })
              window.__dshpTestRefresh()
              await new Promise(function (r) { setTimeout(r, 80) })
              var afterManual = window.__dshpTestState()
              window.__dshpSetFakeBalance(null)
              return {
                before: before,
                afterAuto: afterAuto,
                afterView: afterView,
                afterManual: afterManual,
              }
            })()`)
            console.log('[smoke] refresh-flash=' + JSON.stringify(flashTest))
          } catch (err) {
            console.error('[smoke] refresh-flash test failed:', err)
          }
          } catch (err) { console.error('[smoke] audio check failed:', err) }
          }
        } catch (err) {
          console.error('[smoke] failed:', err)
        }
      }
      app.quit()
      return
    }

    if (isCaptureDemo) {
      const outDir = process.env.WHALE_PET_CAPTURE_DIR || app.getPath('temp')
      fs.mkdirSync(outDir, { recursive: true })
      const save = async (w, name) => {
        if (!w || w.isDestroyed()) return
        const img = await w.webContents.capturePage()
        fs.writeFileSync(path.join(outDir, name), img.toPNG())
        console.log('[capture] ' + name)
      }
      await new Promise((r) => setTimeout(r, 3500))   // 等首次余额
      if (petWin && !petWin.isDestroyed()) {
        await save(petWin, 'shot-balance.png')
        // 余额变化弹跳
        await petWin.webContents.executeJavaScript(`window.__dshpSetFakeBalance({ ok: true, totalBalance: '9.99', currency: 'CNY' })`)
        await petWin.webContents.executeJavaScript(`window.__dshpTestRefresh()`)
        await new Promise((r) => setTimeout(r, 1600))
        await save(petWin, 'shot-balance-change.png')
        // 低余额提醒
        await petWin.webContents.executeJavaScript(`window.__dshpSetFakeBalance({ ok: true, totalBalance: '2.00', currency: 'CNY' })`)
        await petWin.webContents.executeJavaScript(`window.__dshpTestRefresh()`)
        await new Promise((r) => setTimeout(r, 1600))
        await save(petWin, 'shot-low.png')
        // 恢复真实余额
        await petWin.webContents.executeJavaScript(`window.__dshpSetFakeBalance(null)`)
        await petWin.webContents.executeJavaScript(`window.__dshpTestRefresh()`)
        await new Promise((r) => setTimeout(r, 1200))
        // 右键菜单
        await petWin.webContents.executeJavaScript(`(() => {
          var m = document.getElementById('menu')
          m.style.left = '14px'; m.style.top = '8px'
          m.classList.add('dshp-open')
        })()`)
        await new Promise((r) => setTimeout(r, 500))
        await save(petWin, 'shot-menu.png')
        // 设置窗口
        openSettings()
        await new Promise((r) => setTimeout(r, 1600))
        if (settingsWin && !settingsWin.isDestroyed()) await save(settingsWin, 'shot-settings.png')
        console.log('[capture] done -> ' + outDir)
      }
      app.quit()
      return
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
