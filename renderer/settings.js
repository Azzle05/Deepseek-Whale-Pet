'use strict'
var $ = function (id) { return document.getElementById(id) }
var keyInput = $('keyInput')
var labelInput = $('labelInput')
var urlInput = $('urlInput')
var refreshInput = $('refreshInput')
var snapInput = $('snapInput')
var lowAlertInput = $('lowAlertInput')
var lowThresholdInput = $('lowThresholdInput')
var trackStatsInput = $('trackStatsInput')
var idleInput = $('idleInput')
var idleSecInput = $('idleSecInput')
var showTimeInput = $('showTimeInput')
var bounceInput = $('bounceInput')
var decreaseHintInput = $('decreaseHintInput')
var bounceStrengthInput = $('bounceStrengthInput')
var sleepMinutesInput = $('sleepMinutesInput')
var soundInput = $('soundInput')
var volumeInput = $('volumeInput')
var volumeValue = $('volumeValue')
var clickSoundInput = $('clickSoundInput')
var clickSoundSetInput = $('clickSoundSetInput')
var audioBtn = $('audioBtn')
var quotesInput = $('quotesInput')
var quotesTextInput = $('quotesTextInput')
var memoryStyleWrap = $('memoryStyleWrap')
var displayStyleWrap = $('displayStyleWrap')
var bubbleModeWrap = $('bubbleModeWrap')
var agentAnimationInput = $('agentAnimationInput')
var agentAnimationOptions = $('agentAnimationOptions')
var agentTypeInput = $('agentTypeInput')
var agentClickAnimationInput = $('agentClickAnimationInput')
var codexHookWrap = $('codexHookWrap')
var codexHookInput = $('codexHookInput')
var codexHookStatusDot = $('codexHookStatusDot')
var codexHookStatusText = $('codexHookStatusText')
var codexHookEventCount = $('codexHookEventCount')
var codexHookRuntimeText = $('codexHookRuntimeText')
var codexHookInstallBtn = $('codexHookInstallBtn')
var codexHookUninstallBtn = $('codexHookUninstallBtn')
var codexDetectedText = $('codexDetectedText')
var codexTutorialBtn = $('codexTutorialBtn')
var codexTutorialPanel = $('codexTutorialPanel')
var claudeHookWrap = $('claudeHookWrap')
var claudeHookInput = $('claudeHookInput')
var claudeHookStatusDot = $('claudeHookStatusDot')
var claudeHookStatusText = $('claudeHookStatusText')
var claudeHookEventCount = $('claudeHookEventCount')
var claudeHookRuntimeText = $('claudeHookRuntimeText')
var claudeHookInstallBtn = $('claudeHookInstallBtn')
var claudeHookUninstallBtn = $('claudeHookUninstallBtn')
var claudeDetectedText = $('claudeDetectedText')
var claudeTutorialBtn = $('claudeTutorialBtn')
var claudeTutorialPanel = $('claudeTutorialPanel')
var harnessHookWrap = $('harnessHookWrap')
var harnessHookInput = $('harnessHookInput')
var harnessHookStatusDot = $('harnessHookStatusDot')
var harnessHookStatusText = $('harnessHookStatusText')
var harnessHookEventCount = $('harnessHookEventCount')
var harnessHookRuntimeText = $('harnessHookRuntimeText')
var harnessHookInstallBtn = $('harnessHookInstallBtn')
var harnessHookUninstallBtn = $('harnessHookUninstallBtn')
var harnessDetectedText = $('harnessDetectedText')
var harnessTutorialBtn = $('harnessTutorialBtn')
var harnessTutorialPanel = $('harnessTutorialPanel')
var agentTestGrid = $('agentTestGrid')
var agentStatusDot = $('agentStatusDot')
var agentStatusText = $('agentStatusText')
var agentLastEvent = $('agentLastEvent')
var agentLastUpdate = $('agentLastUpdate')
var preferredDisplayStyle = 'bubble'
var scaleInput = $('scaleInput')
var scaleValue = $('scaleValue')
var customImageInput = $('customImageInput')
var imageBtn = $('imageBtn')
var autoStartInput = $('autoStartInput')
var hotkeyInput = $('hotkeyInput')
var alwaysTopInput = $('alwaysTopInput')
var saveBtn = $('saveBtn')
var testBtn = $('testBtn')
var statusEl = $('status')
var currentVersionText = $('currentVersionText')
var updateStateText = $('updateStateText')
var updateMessageText = $('updateMessageText')
var updateCheckBtn = $('updateCheckBtn')
var updateDownloadBtn = $('updateDownloadBtn')
var updateInstallBtn = $('updateInstallBtn')
var updateReleaseBtn = $('updateReleaseBtn')

function show(msg, cls) {
  statusEl.textContent = msg
  statusEl.className = cls || ''
}

window.pet.getFullConfig().then(function (c) {
  if (!c) return
  if (c.apiKey) keyInput.value = c.apiKey
  if (c.label) labelInput.value = c.label
  if (c.balanceUrl) urlInput.value = c.balanceUrl
  if (typeof c.refreshSec === 'number') refreshInput.value = c.refreshSec
  snapInput.checked = c.snap !== false
  lowAlertInput.checked = c.lowBalanceAlert !== false
  if (typeof c.lowThreshold === 'number') lowThresholdInput.value = c.lowThreshold
  trackStatsInput.checked = c.trackStats !== false
  idleInput.checked = c.idleTransparency !== false
  if (typeof c.idleSec === 'number') idleSecInput.value = c.idleSec
  showTimeInput.checked = c.showTime !== false
  bounceInput.checked = c.bounceAnim !== false
  decreaseHintInput.checked = c.decreaseHintEnabled !== false
  if (c.bounceStrength === 'minimal' || c.bounceStrength === 'soft' || c.bounceStrength === 'strong') bounceStrengthInput.value = c.bounceStrength
  else bounceStrengthInput.value = 'normal'
  if (typeof c.sleepMinutes === 'number') sleepMinutesInput.value = String(c.sleepMinutes)
  soundInput.checked = c.sound !== false
  if (typeof c.volume === 'number') {
    volumeInput.value = Math.round(c.volume * 100)
    volumeValue.textContent = Math.round(c.volume * 100) + '%'
  }
  var bm = (c.bubbleMode === 'always' || c.bubbleMode === 'click') ? c.bubbleMode : 'hover'
  var bmRadio = document.querySelector('input[name=bubbleMode][value="' + bm + '"]')
  if (bmRadio) bmRadio.checked = true
  clickSoundInput.checked = c.clickSound !== false
  clickSoundSetInput.value = (c.clickSoundSet === 'fx1' || c.clickSoundSet === 'custom') ? c.clickSoundSet : 'duck'
  quotesInput.checked = !!c.quotesEnabled
  if (c.quotesText) quotesTextInput.value = c.quotesText
  var cm = (c.contentMode === 'memory') ? 'memory' : 'balance'
  var cmRadio = document.querySelector('input[name=contentMode][value="' + cm + '"]')
  if (cmRadio) cmRadio.checked = true
  var ms = (c.memoryStyle === 'bubble') ? 'bubble' : 'fill'
  var msRadio = document.querySelector('input[name=memoryStyle][value="' + ms + '"]')
  if (msRadio) msRadio.checked = true
  preferredDisplayStyle = c.displayStyle === 'bar' ? 'bar' : 'bubble'
  var dsRadio = document.querySelector('input[name=displayStyle][value="' + preferredDisplayStyle + '"]')
  if (dsRadio) dsRadio.checked = true
  toggleMemoryStyle()
  customImageInput.checked = !!c.customImage
  if (typeof c.scale === 'number') {
    scaleInput.value = c.scale
    scaleValue.textContent = Math.round(c.scale * 100) + '%'
  }
  autoStartInput.checked = !!c.autoStart
  hotkeyInput.checked = c.hotkey !== false
  alwaysTopInput.checked = c.alwaysOnTop !== false
  var dm = (c.displayMode === 'taskbar' || c.displayMode === 'tray' || c.displayMode === 'hidden') ? c.displayMode : 'tray'
  var dmRadio = document.querySelector('input[name=displayMode][value="' + dm + '"]')
  if (dmRadio) dmRadio.checked = true
  agentAnimationInput.checked = !!c.agentAnimationEnabled
  agentTypeInput.value = (c.agentType === 'claudecode' || c.agentType === 'harness') ? c.agentType : 'codex'
  agentClickAnimationInput.checked = c.agentClickAnimation !== false
  codexHookInput.checked = !!c.codexHookEnabled
  claudeHookInput.checked = !!c.claudeHookEnabled
  harnessHookInput.checked = !!c.harnessHookEnabled
  toggleAgentAnimationOptions()
})

function num(v, dft) {
  var n = parseFloat(v)
  return isFinite(n) ? n : dft
}

function collect() {
  return {
    apiKey: keyInput.value.trim(),
    label: labelInput.value.trim() || 'DeepSeek 余额',
    balanceUrl: urlInput.value.trim(),
    refreshSec: Math.max(0, Math.min(3600, Math.round(num(refreshInput.value, 30)))),
    snap: snapInput.checked,
    lowBalanceAlert: lowAlertInput.checked,
    lowThreshold: Math.max(0, num(lowThresholdInput.value, 5)),
    trackStats: trackStatsInput.checked,
    idleTransparency: idleInput.checked,
    idleSec: Math.max(1, Math.min(300, Math.round(num(idleSecInput.value, 5)))),
    showTime: showTimeInput.checked,
    bounceAnim: bounceInput.checked,
    decreaseHintEnabled: decreaseHintInput.checked,
    bounceStrength: bounceStrengthInput.value,
    sleepMinutes: Math.max(1, Math.min(60, Math.round(num(sleepMinutesInput.value, 10)))),
    sound: soundInput.checked,
    volume: Math.max(0, Math.min(1, num(volumeInput.value, 70) / 100)),
    bubbleMode: (document.querySelector('input[name=bubbleMode]:checked') || {}).value || 'click',
    clickSound: clickSoundInput.checked,
    clickSoundSet: clickSoundSetInput.value,
    quotesEnabled: quotesInput.checked,
    quotesText: quotesTextInput.value,
    contentMode: (document.querySelector('input[name=contentMode]:checked') || {}).value || 'balance',
    memoryStyle: (document.querySelector('input[name=memoryStyle]:checked') || {}).value || 'fill',
    displayStyle: (document.querySelector('input[name=contentMode]:checked') || {}).value === 'memory'
      ? 'bubble'
      : ((document.querySelector('input[name=displayStyle]:checked') || {}).value || 'bubble'),
    scale: num(scaleInput.value, 1),
    customImage: customImageInput.checked,
    autoStart: autoStartInput.checked,
    hotkey: hotkeyInput.checked,
    alwaysOnTop: alwaysTopInput.checked,
    displayMode: (document.querySelector('input[name=displayMode]:checked') || {}).value || 'tray',
    agentAnimationEnabled: agentAnimationInput.checked,
    agentType: agentTypeInput.value,
    agentClickAnimation: agentClickAnimationInput.checked,
    codexHookEnabled: codexHookInput.checked,
    claudeHookEnabled: claudeHookInput.checked,
    harnessHookEnabled: harnessHookInput.checked,
  }
}

function updateScaleLabel() {
  scaleValue.textContent = Math.round(num(scaleInput.value, 1) * 100) + '%'
}
scaleInput.addEventListener('input', updateScaleLabel)

function updateVolumeLabel() {
  volumeValue.textContent = Math.round(num(volumeInput.value, 70)) + '%'
}
volumeInput.addEventListener('input', updateVolumeLabel)

function currentContentMode() {
  return (document.querySelector('input[name=contentMode]:checked') || {}).value || 'balance'
}

function currentDisplayStyle() {
  return (document.querySelector('input[name=displayStyle]:checked') || {}).value || 'bubble'
}

function toggleDisplayStyle() {
  var memoryMode = currentContentMode() === 'memory'
  var bar = document.querySelector('input[name=displayStyle][value="bar"]')
  var bubble = document.querySelector('input[name=displayStyle][value="bubble"]')
  if (bar) bar.disabled = memoryMode
  if (memoryMode) {
    if (bubble) bubble.checked = true
  } else if (bar && preferredDisplayStyle === 'bar') {
    bar.checked = true
  } else if (bubble) {
    bubble.checked = true
  }
  displayStyleWrap.style.opacity = memoryMode ? '.55' : '1'
  bubbleModeWrap.style.display = currentDisplayStyle() === 'bar' ? 'none' : ''
}

// 内存显示方式仅在“系统内存”模式下可见
function toggleMemoryStyle() {
  var cm = currentContentMode()
  memoryStyleWrap.style.display = cm === 'memory' ? '' : 'none'
  toggleDisplayStyle()
}

function toggleAgentAnimationOptions() {
  var enabled = agentAnimationInput.checked
  agentAnimationOptions.style.opacity = enabled ? '1' : '.62'
  agentTypeInput.disabled = !enabled
  agentClickAnimationInput.disabled = !enabled
  codexHookInstallBtn.disabled = !enabled || !codexHookInput.checked
  claudeHookInstallBtn.disabled = !enabled || !claudeHookInput.checked
  harnessHookInstallBtn.disabled = !enabled || !harnessHookInput.checked
}

function formatAgentStatusTime(timestamp) {
  var value = Number(timestamp)
  if (!isFinite(value) || value <= 0) return '--'
  var d = new Date(value)
  var p = function (n) { return String(n).padStart(2, '0') }
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
}

function renderAgentStatus(status) {
  if (!status) return
  var connected = !!status.connected
  var watching = !!status.watcherActive
  agentStatusDot.className = 'agent-status-dot' + (connected || watching ? ' on' : '')
  if (!status.enabled) {
    agentStatusText.textContent = '实验功能已关闭'
  } else if (connected) {
    agentStatusText.textContent = '已接收 Agent 事件 · ' + (status.agent || status.selectedAgent || '--')
  } else if (watching) {
    if (status.selectedAgent === 'claudecode') {
      agentStatusText.textContent = '正在监听 Claude Code Hook 事件'
    } else if (status.selectedAgent === 'harness') {
      agentStatusText.textContent = '正在监听 Harness 插件事件'
    } else {
      agentStatusText.textContent = '正在监听 Codex 新会话事件'
    }
  } else {
    agentStatusText.textContent = '等待 Agent 事件'
  }

  var eventParts = []
  if (status.event) eventParts.push(status.event)
  if (status.state) eventParts.push(status.state)
  if (status.detail) eventParts.push(status.detail)
  agentLastEvent.textContent = eventParts.length ? eventParts.join(' · ') : '--'
  agentLastUpdate.textContent = formatAgentStatusTime(status.updatedAt)
}

function renderUpdateStatus(status) {
  if (!status) return
  currentVersionText.textContent = status.currentVersion ? 'v' + status.currentVersion : '--'
  updateMessageText.textContent = status.message || '尚未检查更新。'
  updateCheckBtn.disabled = status.phase === 'checking' || status.phase === 'downloading' || status.phase === 'installing'
  updateDownloadBtn.disabled = !status.canDownload
  updateInstallBtn.disabled = !status.readyToInstall
  updateDownloadBtn.textContent = status.phase === 'downloading' ? '下载中…' : '下载更新'
  updateInstallBtn.textContent = status.phase === 'installing' ? '正在安装…' : '安装并重启'
}

function renderCodexHookStatus(status) {
  if (!status) return
  var installed = !!status.installed
  var active = !!status.watcherActive
  codexHookStatusDot.className = 'agent-status-dot' + (installed ? ' on' : '')
  codexHookEventCount.textContent = String(status.installedEvents || 0) + ' / ' + String(status.totalEvents || 0)
  codexHookRuntimeText.textContent = active ? '正在监听事件文件' : '尚未监听'
  codexHookUninstallBtn.disabled = !installed && !Number(status.installedEvents)
  codexDetectedText.textContent = status.detected
    ? '已检测到本机 Codex 配置'
    : '未检测到本机 Codex 配置，请先安装并运行一次 Codex'
  codexDetectedText.title = status.detectedPath || ''

  if (!status.enabled) {
    codexHookStatusText.textContent = '未启用接入'
  } else if (!status.desired) {
    codexHookStatusText.textContent = '已启用配置；打开 Agent 动画后生效'
  } else if (installed && active) {
    codexHookStatusText.textContent = '已接入，正在接收 Codex 状态'
  } else if (installed) {
    codexHookStatusText.textContent = '已接入；切换到当前显示后开始接收'
  } else if (status.error) {
    codexHookStatusText.textContent = '接入失败：' + status.error
  } else {
    codexHookStatusText.textContent = '尚未完整接入，请检查并修复'
  }
}

function refreshCodexHookStatus() {
  return window.pet.getCodexHookStatus().then(renderCodexHookStatus)
}

function renderClaudeHookStatus(status) {
  if (!status) return
  var installed = !!status.installed
  var active = !!status.watcherActive
  claudeHookStatusDot.className = 'agent-status-dot' + (installed ? ' on' : '')
  claudeHookEventCount.textContent = String(status.installedEvents || 0) + ' / ' + String(status.totalEvents || 0)
  claudeHookRuntimeText.textContent = active ? '正在监听事件文件' : '尚未监听'
  claudeHookUninstallBtn.disabled = !installed && !Number(status.installedEvents)
  claudeDetectedText.textContent = status.detected
    ? '已检测到本机 Claude Code 配置'
    : '未检测到本机 Claude Code 配置，请先安装并运行一次 Claude Code'
  claudeDetectedText.title = status.detectedPath || ''

  if (!status.enabled) {
    claudeHookStatusText.textContent = '未启用接入'
  } else if (!status.desired) {
    claudeHookStatusText.textContent = '已启用配置；打开 Agent 动画后生效'
  } else if (installed && active) {
    claudeHookStatusText.textContent = '已接入，正在接收 Claude Code 状态'
  } else if (installed) {
    claudeHookStatusText.textContent = '已接入；切换到当前显示后开始接收'
  } else if (status.error) {
    claudeHookStatusText.textContent = '接入失败：' + status.error
  } else {
    claudeHookStatusText.textContent = '尚未完整接入，请检查并修复'
  }
}

function refreshClaudeHookStatus() {
  return window.pet.getClaudeHookStatus().then(renderClaudeHookStatus)
}

function renderHarnessHookStatus(status) {
  if (!status) return
  var installed = !!status.installed
  var active = !!status.watcherActive
  harnessHookStatusDot.className = 'agent-status-dot' + (installed ? ' on' : '')
  harnessHookEventCount.textContent = String(status.installedEvents || 0) + ' / ' + String(status.totalEvents || 0)
  harnessHookRuntimeText.textContent = active ? '正在监听事件文件' : '尚未监听'
  harnessHookUninstallBtn.disabled = !installed && !Number(status.installedEvents)
  harnessDetectedText.textContent = status.detected
    ? '已检测到本机 Harness 配置'
    : '未检测到本机 Harness 配置，请先安装并启动一次 DSH'
  harnessDetectedText.title = status.detectedPath || ''

  if (!status.enabled) {
    harnessHookStatusText.textContent = '未启用接入'
  } else if (!status.desired) {
    harnessHookStatusText.textContent = '已启用配置；打开 Agent 动画后生效'
  } else if (installed && active) {
    harnessHookStatusText.textContent = '已接入，正在接收 Harness 状态'
  } else if (installed) {
    harnessHookStatusText.textContent = '已接入；切换到当前显示并重启 DSH 后开始接收'
  } else if (status.error) {
    harnessHookStatusText.textContent = '接入失败：' + status.error
  } else {
    harnessHookStatusText.textContent = '尚未完整接入，请检查并修复'
  }
}

function refreshHarnessHookStatus() {
  return window.pet.getHarnessHookStatus().then(renderHarnessHookStatus)
}

window.pet.getAgentStatus().then(renderAgentStatus)
if (window.pet.onAgentStatus) window.pet.onAgentStatus(renderAgentStatus)
if (window.pet.getUpdateStatus) window.pet.getUpdateStatus().then(renderUpdateStatus)
if (window.pet.onUpdateStatus) window.pet.onUpdateStatus(renderUpdateStatus)
refreshCodexHookStatus()
refreshClaudeHookStatus()
refreshHarnessHookStatus()

agentAnimationInput.addEventListener('change', toggleAgentAnimationOptions)
agentTypeInput.addEventListener('change', toggleAgentAnimationOptions)
codexHookInput.addEventListener('change', function () {
  toggleAgentAnimationOptions()
  setTimeout(refreshCodexHookStatus, 700)
})
claudeHookInput.addEventListener('change', function () {
  toggleAgentAnimationOptions()
  setTimeout(refreshClaudeHookStatus, 700)
})
harnessHookInput.addEventListener('change', function () {
  toggleAgentAnimationOptions()
  setTimeout(refreshHarnessHookStatus, 700)
})
updateCheckBtn.addEventListener('click', async function () {
  updateCheckBtn.disabled = true
  updateMessageText.textContent = '正在检查最新版本…'
  var result = await window.pet.checkForUpdates()
  renderUpdateStatus(result)
})
updateDownloadBtn.addEventListener('click', async function () {
  updateDownloadBtn.disabled = true
  var result = await window.pet.downloadUpdate()
  renderUpdateStatus(result)
})
updateInstallBtn.addEventListener('click', async function () {
  updateInstallBtn.disabled = true
  var result = await window.pet.installUpdate()
  renderUpdateStatus(result)
})
updateReleaseBtn.addEventListener('click', function () {
  window.pet.openUpdateReleases()
})
Array.prototype.forEach.call(document.querySelectorAll('input[name=contentMode]'), function (r) {
  r.addEventListener('change', toggleMemoryStyle)
})
Array.prototype.forEach.call(document.querySelectorAll('input[name=displayStyle]'), function (r) {
  r.addEventListener('change', function () {
    if (currentContentMode() !== 'memory') preferredDisplayStyle = currentDisplayStyle()
    toggleDisplayStyle()
  })
})
// 任何开关/输入改动后自动保存（防抖 500ms），不用手动点保存
var saveTimer = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(function () {
    saveTimer = null
    window.pet.saveSettings(collect()).then(function (r) {
      if (r && r.ok) statusEl.textContent = '已自动保存 ✓'
      statusEl.className = r && r.ok ? 'ok' : 'err'
      refreshCodexHookStatus()
      refreshClaudeHookStatus()
      refreshHarnessHookStatus()
    })
  }, 500)
}
Array.prototype.forEach.call(document.querySelectorAll('input, textarea, select'), function (el) {
  el.addEventListener('change', scheduleSave)
  el.addEventListener('input', scheduleSave)
})

saveBtn.addEventListener('click', async function () {
  var r = await window.pet.saveSettings(collect())
  show(r && r.ok ? '已保存。桌宠已用新配置自动刷新。' : '保存失败', r && r.ok ? 'ok' : 'err')
  refreshHarnessHookStatus()
})

testBtn.addEventListener('click', async function () {
  var r = await window.pet.saveSettings(collect())
  if (!r || !r.ok) { show('保存失败', 'err'); return }
  show('正在测试…', 'muted')
  var b = await window.pet.getBalance()
  if (b && b.ok) {
    show('✅ 连接成功，当前余额：' + (b.currency === 'CNY' ? '¥ ' : '') + Number(b.totalBalance).toFixed(2) + (b.currency !== 'CNY' && b.currency ? ' ' + b.currency : ''), 'ok')
  } else {
    show('❌ ' + ((b && b.error) || '测试失败'), 'err')
  }
})

imageBtn.addEventListener('click', async function () {
  var r = await window.pet.chooseImage()
  if (r && r.ok) {
    customImageInput.checked = true
    show('✅ 图片已设置，保存后生效。', 'ok')
  } else {
    show('未选择或读取失败。', 'err')
  }
})

audioBtn.addEventListener('click', async function () {
  var r = await window.pet.chooseAudio()
  if (r && r.ok) {
    clickSoundSetInput.value = 'custom'
    clickSoundInput.checked = true
    scheduleSave()
    show('✅ 自定义音效已设置。', 'ok')
  } else {
    show('未选择或读取失败。', 'err')
  }
})

codexHookInstallBtn.addEventListener('click', async function () {
  if (!agentAnimationInput.checked || !codexHookInput.checked) {
    show('请先打开 Agent 动画和 Codex 的“启用接入”。', 'err')
    return
  }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  codexHookInstallBtn.disabled = true
  var result = await window.pet.installCodexHook()
  renderCodexHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Codex Hook 已检查并修复。' : ('接入失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

claudeHookInstallBtn.addEventListener('click', async function () {
  if (!agentAnimationInput.checked || !claudeHookInput.checked) {
    show('请先打开 Agent 动画和 Claude Code 的“启用接入”。', 'err')
    return
  }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  claudeHookInstallBtn.disabled = true
  var result = await window.pet.installClaudeHook()
  renderClaudeHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Claude Code Hook 已检查并修复。' : ('接入失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

harnessHookInstallBtn.addEventListener('click', async function () {
  if (!agentAnimationInput.checked || !harnessHookInput.checked) {
    show('请先打开 Agent 动画和 Harness 的“启用接入”。', 'err')
    return
  }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  harnessHookInstallBtn.disabled = true
  var result = await window.pet.installHarnessHook()
  renderHarnessHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Harness 插件已检查并修复，请重启 DSH 使配置生效。' : ('接入失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

codexHookUninstallBtn.addEventListener('click', async function () {
  codexHookInput.checked = false
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  var result = await window.pet.uninstallCodexHook()
  renderCodexHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Codex 接入已移除，原有配置备份仍然保留。' : ('移除失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

claudeHookUninstallBtn.addEventListener('click', async function () {
  claudeHookInput.checked = false
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  var result = await window.pet.uninstallClaudeHook()
  renderClaudeHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Claude Code 接入已移除，原有配置备份仍然保留。' : ('移除失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

harnessHookUninstallBtn.addEventListener('click', async function () {
  harnessHookInput.checked = false
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await window.pet.saveSettings(collect())
  var result = await window.pet.uninstallHarnessHook()
  renderHarnessHookStatus(result)
  toggleAgentAnimationOptions()
  show(result && result.ok ? 'Harness 接入已移除，原有配置备份仍然保留。' : ('移除失败：' + ((result && result.error) || '未知错误')), result && result.ok ? 'ok' : 'err')
})

function toggleTutorial(button, panel) {
  var open = !panel.classList.contains('open')
  panel.classList.toggle('open', open)
  button.setAttribute('aria-expanded', open ? 'true' : 'false')
  button.textContent = open ? '收起教程' : '配置教程'
}

codexTutorialBtn.addEventListener('click', function () {
  toggleTutorial(codexTutorialBtn, codexTutorialPanel)
})
claudeTutorialBtn.addEventListener('click', function () {
  toggleTutorial(claudeTutorialBtn, claudeTutorialPanel)
})
harnessTutorialBtn.addEventListener('click', function () {
  toggleTutorial(harnessTutorialBtn, harnessTutorialPanel)
})

agentTestGrid.addEventListener('click', async function (e) {
  var state = e.target && e.target.getAttribute && e.target.getAttribute('data-agent-state')
  if (!state) return
  if (!agentAnimationInput.checked) {
    agentAnimationInput.checked = true
    toggleAgentAnimationOptions()
  }
  var r = await window.pet.saveSettings(collect())
  if (!r || !r.ok) {
    show('实验功能设置保存失败。', 'err')
    return
  }
  await window.pet.setAgentState(agentTypeInput.value, state)
  show('已切换测试状态：' + state, 'ok')
})
