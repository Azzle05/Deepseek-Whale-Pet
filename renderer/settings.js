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
  if (c.bounceStrength === 'soft' || c.bounceStrength === 'strong') bounceStrengthInput.value = c.bounceStrength
  else bounceStrengthInput.value = 'normal'
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
  var dm = (c.displayMode === 'taskbar' || c.displayMode === 'tray' || c.displayMode === 'hidden') ? c.displayMode : 'all'
  var dmRadio = document.querySelector('input[name=displayMode][value="' + dm + '"]')
  if (dmRadio) dmRadio.checked = true
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
    sound: soundInput.checked,
    volume: Math.max(0, Math.min(1, num(volumeInput.value, 70) / 100)),
    bubbleMode: (document.querySelector('input[name=bubbleMode]:checked') || {}).value || 'hover',
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
    displayMode: (document.querySelector('input[name=displayMode]:checked') || {}).value || 'all',
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
