// DeepSeek 余额桌宠 —— 渲染层
// 拖拽(屏幕坐标)、四分之一吸附(可关)、镜像、Q弹、缩放、点击刷新、右键菜单、自定义名称。
// 新增：悬停详情、闲置半透明、变动弹跳、提示音效、随机语录、自定义图片、今日消耗。
'use strict'

var CLICK_SQ = 9
var ANIM_MS = 700
var CHANGE_MS = 900
var BUBBLE_MS = 5000
var LAST_VIEW_STORAGE_KEY = 'dshp.lastViewedBalance.v1'
// 峰谷时段（北京时间）：工作日 9–12 与 14–18 点为高峰；2026-08-23 起周末全天谷价
var PEAK_HOURS = [[9, 12], [14, 18]]
var WEEKEND_VALLEY_FROM_SEC = Math.floor(Date.UTC(2026, 7, 22, 16, 0, 0) / 1000)

var root = document.getElementById('root')
var body = document.getElementById('body')
var img = document.getElementById('img')
var labelEl = document.getElementById('labelEl')
var amountEl = document.getElementById('amountEl')
var decreaseEl = document.getElementById('decreaseEl')
var hintEl = document.getElementById('hintEl')
var timeEl = document.getElementById('timeEl')
var peakEl = document.getElementById('peakEl')
var memFillEl = document.getElementById('memFill')
var memFillFillEl = document.getElementById('memFillFill')
var menu = document.getElementById('menu')
var menuStats = document.getElementById('menuStats')
var bubbleEl = document.getElementById('bubble')

var state = {
  scale: 1,
  h: 'right',
  hOff: 0,
  v: 'bottom',
  vOff: 0,
  left: 0,
  top: 0,
  size: 196,
  snap: true,
  label: 'DeepSeek 余额',
  refreshSec: 30,
  balance: null,
  currency: null,
  granted: null,
  toppedUp: null,
  status: 'loading',
  message: '',
  lowThreshold: 5,
  flags: {
    showTime: true,
    idleTransparency: true, idleSec: 5,
    bounceAnim: true, decreaseHintEnabled: true,
    sound: true, volume: 0.7, bounceStrength: 'normal',
    bubbleMode: 'hover', clickSound: true, clickSoundSet: 'duck',
    quotesEnabled: false, quotesText: '',
    contentMode: 'balance',   // balance | memory 显示内容：余额 / 系统内存
    memoryStyle: 'fill',      // fill | bubble 内存显示方式：图形填充 / 气泡显示
    displayStyle: 'bubble',   // bubble | bar 桌宠显示方式：气泡 / 横条
    customImage: false,
    agentAnimationEnabled: false,
    agentType: 'codex',
    agentClickAnimation: true,
  },
  quotes: [],
  mem: null,
  todayUsed: null,
  lastViewedBalance: null,
  lastViewedCurrency: null,
}
var busy = false
var settleTimer = null
var drag = null
var dragFrame = null
var animId = null
var idleTimer = null
var lastActivity = Date.now()
var idleOn = false
var mouseThrough = false
var whaleHovering = false
var bubbleShown = false
var bubbleHideTimer = null
var peakShown = false
var detailType = 'peak'
var hitCanvas = null
var hitData = null
var hitReady = false
var memoryTimer = null
var screen = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

function fmt(balance, currency) {
  var num = Number(balance)
  var fixed = isFinite(num) ? num.toFixed(2) : '--'
  return currency === 'CNY' ? '¥ ' + fixed : fixed + (currency ? ' ' + currency : '')
}

function readLastViewedBalance() {
  try {
    var saved = JSON.parse(localStorage.getItem(LAST_VIEW_STORAGE_KEY) || 'null')
    var balance = Number(saved && saved.balance)
    if (!isFinite(balance)) return null
    return { balance: balance, currency: String((saved && saved.currency) || 'CNY') }
  } catch (err) {
    return null
  }
}

function saveLastViewedBalance(balance, currency) {
  state.lastViewedBalance = Number(balance)
  state.lastViewedCurrency = currency || 'CNY'
  try {
    localStorage.setItem(LAST_VIEW_STORAGE_KEY, JSON.stringify({
      balance: state.lastViewedBalance,
      currency: state.lastViewedCurrency,
    }))
  } catch (err) {}
}

var restoredLastView = readLastViewedBalance()
if (restoredLastView) {
  state.lastViewedBalance = restoredLastView.balance
  state.lastViewedCurrency = restoredLastView.currency
}

function publishBar() {
  if (!window.pet.updateBar) return
  window.pet.updateBar({
    balance: state.balance,
    currency: state.currency || 'CNY',
    todayUsed: state.todayUsed,
    peak: isPeakTime(),
    decreaseHintEnabled: state.flags.decreaseHintEnabled,
  }).catch(function () {})
}

function setLabelEl(text) {
  var label = text || 'DeepSeek 余额'
  labelEl.textContent = label
  var len = label.length
  var size = len <= 8 ? 68 : Math.max(34, Math.round(68 * 8 / len))
  labelEl.style.fontSize = 'calc(var(--dshp-u) * ' + size + ')'
}
function applyLabel(text) {
  state.label = text || 'DeepSeek 余额'
  applyContentLabel()
}
function applyContentLabel() {
  if (state.flags.contentMode === 'memory') setLabelEl('系统内存')
  else setLabelEl(state.label)
}

function applyFlags(c) {
  if (!c) return
  var f = state.flags
  if (typeof c.showTime === 'boolean') { f.showTime = c.showTime; applyTime() }
  if (typeof c.idleTransparency === 'boolean') f.idleTransparency = c.idleTransparency
  if (typeof c.idleSec === 'number') f.idleSec = c.idleSec
  if (typeof c.bounceAnim === 'boolean') f.bounceAnim = c.bounceAnim
  if (typeof c.decreaseHintEnabled === 'boolean') f.decreaseHintEnabled = c.decreaseHintEnabled
  if (typeof c.bounceStrength === 'string') f.bounceStrength = c.bounceStrength
  if (typeof c.sound === 'boolean') f.sound = c.sound
  if (typeof c.volume === 'number') { f.volume = c.volume; setVolume() }
  if (typeof c.bubbleMode === 'string') { f.bubbleMode = c.bubbleMode; applyBubbleMode() }
  if (typeof c.clickSound === 'boolean') f.clickSound = c.clickSound
  if (typeof c.clickSoundSet === 'string') { f.clickSoundSet = c.clickSoundSet; refreshClickSound() }
  if (typeof c.quotesEnabled === 'boolean') f.quotesEnabled = c.quotesEnabled
  if (typeof c.quotesText === 'string') {
    f.quotesText = c.quotesText
    state.quotes = c.quotesText.split(/[;；\n]+/).map(function (s) { return s.trim() }).filter(function (s) { return s.length > 0 })
  }
  if (typeof c.contentMode === 'string') {
    var nm = (c.contentMode === 'memory') ? 'memory' : 'balance'
    if (f.contentMode !== nm) {
      f.contentMode = nm
      applyContentLabel()
      applyMemFill()
      updateContentMode()
      resetPeak()
      render()
    }
  }
  if (typeof c.memoryStyle === 'string') {
    var ns = (c.memoryStyle === 'bubble') ? 'bubble' : 'fill'
    if (f.memoryStyle !== ns) { f.memoryStyle = ns; applyMemFill() }
  }
  if (typeof c.displayStyle === 'string') f.displayStyle = (c.displayStyle === 'bar') ? 'bar' : 'bubble'
  if (f.contentMode === 'memory') f.displayStyle = 'bubble'
  if (typeof c.lowThreshold === 'number') state.lowThreshold = c.lowThreshold
  if (typeof c.customImage === 'boolean') f.customImage = c.customImage
  if (typeof c.agentAnimationEnabled === 'boolean') f.agentAnimationEnabled = c.agentAnimationEnabled
  if (typeof c.agentType === 'string') f.agentType = c.agentType
  if (typeof c.agentClickAnimation === 'boolean') f.agentClickAnimation = c.agentClickAnimation
  applyDisplayStyle()
  if (window.__dshpAgentAnimation) window.__dshpAgentAnimation.configure(c)
}

var timeShown = ''
function applyTime() {
  timeEl.style.display = state.flags.showTime ? 'block' : 'none'
  updateTime()
}
function updateTime() {
  var d = new Date()
  var p = function (n) { return String(n).padStart(2, '0') }
  var txt = p(d.getHours()) + ':' + p(d.getMinutes())
  if (txt !== timeShown) { timeShown = txt; timeEl.textContent = txt }
}

function applyImage() {
  var src = '../assets/DSniang1.png'
  if (!state.flags.customImage) {
    img.src = src
    applyMemMask(src)
    return
  }
  window.pet.getImageUrl().then(function (r) {
    src = (r && r.url) ? r.url : '../assets/DSniang1.png'
    img.src = src
    applyMemMask(src)
  })
}
function applyMemMask(src) {
  try { memFillEl.style.webkitMaskImage = 'url("' + src + '")' } catch (err) {}
}
function applyMemFill() {
  var on = (state.flags.contentMode === 'memory' && state.flags.memoryStyle === 'fill')
  if (on) memFillEl.classList.add('dshp-memfill-on')
  else memFillEl.classList.remove('dshp-memfill-on')
  if (!on) memFillFillEl.style.height = '0%'
}
function updateMemFill() {
  var p = (state.mem && typeof state.mem.percent === 'number') ? state.mem.percent : 0
  memFillFillEl.style.height = clamp(p, 0, 100) + '%'
}
function updateMemory() {
  if (!window.pet.getMemory) return
  window.pet.getMemory().then(function (m) {
    state.mem = m
    updateMemFill()
    if (state.flags.contentMode === 'memory') {
      if (peakShown) renderMemoryDetail()
      else renderMemoryNormal()
    }
  }).catch(function () {})
}
function updateContentMode() {
  if (state.flags.contentMode === 'memory') {
    if (!memoryTimer) {
      memoryTimer = setInterval(updateMemory, 2000)
      updateMemory()
    }
  } else if (memoryTimer) {
    clearInterval(memoryTimer)
    memoryTimer = null
  }
}

// ---------------------------------------------------------------------------
// 音效（Web Audio 合成，无需音频文件）
// ---------------------------------------------------------------------------
var audioCtx = null
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {})
    }
    return audioCtx
  } catch (err) { return null }
}
function beep(kind) {
  if (!state.flags.sound) return
  var ctx = ensureAudio()
  if (!ctx) return
  try {
    var t = ctx.currentTime
    var notes = kind === 'up' ? [880, 1318.5] : (kind === 'down' ? [523.25, 392] : [392, 392])
    var vol = getVolume()
    notes.forEach(function (freq, idx) {
      var osc = ctx.createOscillator()
      var gain = ctx.createGain()
      osc.type = 'sine'
      var start = t + idx * 0.12
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12 * vol, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.3)
    })
  } catch (err) { /* ignore */ }
}
// 首次用户点击时解锁音频（兼容自动播放策略）
function unlockAudio() {
  var ctx = ensureAudio()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {})
}
root.addEventListener('pointerdown', unlockAudio)

// ---------------------------------------------------------------------------
// 点按音效：由设置里的“点击音效”类型决定
//  - duck（默认）：按 Ya1、松 Ya2，连贯成一句完整的鸭叫
//  - fx1 / custom：按下播放单一音效，松开不再补放
// ---------------------------------------------------------------------------
var pressAudio = null
var releaseAudio = null
var pressing = false
var pressEnded = false
var releasePlayed = false
var releaseTimer = null
function makeAudio(src, volume) {
  try {
    var a = new Audio(src)
    a.preload = 'auto'
    a.volume = (typeof volume === 'number') ? volume : getVolume()
    return a
  } catch (err) { return null }
}
function getVolume() {
  var v = state.flags.volume
  if (typeof v !== 'number' || !isFinite(v)) v = 0.7
  return clamp(v, 0, 1)
}
function setVolume() {
  var pv = getVolume()
  var list = [pressAudio, releaseAudio, clickAudio]
  for (var i = 0; i < list.length; i++) {
    if (list[i]) list[i].volume = pv
  }
}
// 初始先按默认“鸭叫”挂载，随后 refreshClickSound() 会按设置覆盖
pressAudio = makeAudio('../assets/Ya1.mp3')
releaseAudio = makeAudio('../assets/Ya2.mp3')
function playPressDuck() {
  if (!pressAudio || !state.flags.clickSound) return
  try {
    if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
    if (releaseAudio) { releaseAudio.pause(); releaseAudio.currentTime = 0 }
    pressEnded = false
    releasePlayed = false
    pressAudio.onended = function () {
      pressEnded = true
      // 第一段已播完且已松开 → 补播第二段；按住中则等 pressUp()
      if (!pressing && !releasePlayed) playReleaseDuck()
    }
    pressAudio.currentTime = 0
    var pp = pressAudio.play()
    if (pp && typeof pp.catch === 'function') pp.catch(function () {})
  } catch (err) { /* ignore */ }
}
function playReleaseDuck() {
  if (releasePlayed || !releaseAudio || !state.flags.clickSound) return
  releasePlayed = true
  try {
    releaseAudio.currentTime = 0
    var pp = releaseAudio.play()
    if (pp && typeof pp.catch === 'function') pp.catch(function () {})
  } catch (err) { /* ignore */ }
}
window.__dshpDuckAudioTest = function () {
  return [pressAudio, releaseAudio].map(function (a) {
    if (!a) return null
    var d = a.duration
    return { readyState: a.readyState, duration: isFinite(d) ? d : null, error: a.error ? a.error.code : null }
  })
}

// ---------------------------------------------------------------------------
// 点击音效（可切换小黄鸭 / 音效1 / 自定义文件）
// ---------------------------------------------------------------------------
var clickAudio = null
var clickAudioSrc = ''
function setClickAudio(src) {
  try {
    clickAudio = new Audio(src)
    clickAudio.preload = 'auto'
    clickAudio.volume = getVolume()
    clickAudioSrc = src
  } catch (err) { clickAudio = null }
}
function refreshClickSound() {
  var set = state.flags.clickSoundSet
  if (set === 'fx1') {
    pressAudio = makeAudio('../assets/D1.mp3')
    releaseAudio = makeAudio('../assets/D2.mp3')
    setClickAudio('../assets/D1.mp3')
    return
  }
  if (set === 'custom') {
    window.pet.getAudioUrl().then(function (r) {
      if (state.flags.clickSoundSet !== 'custom') return
      var url = (r && r.url) ? r.url : '../assets/Ya1.mp3'
      pressAudio = makeAudio(url)
      releaseAudio = null
      setClickAudio(url)
    }).catch(function () {
      if (state.flags.clickSoundSet !== 'custom') return
      pressAudio = makeAudio('../assets/Ya1.mp3')
      releaseAudio = makeAudio('../assets/Ya2.mp3')
      setClickAudio('../assets/Ya1.mp3')
    })
    return
  }
  // duck（默认）：按 Ya1、松 Ya2 两段连贯
  pressAudio = makeAudio('../assets/Ya1.mp3')
  releaseAudio = makeAudio('../assets/Ya2.mp3')
  setClickAudio('../assets/Ya1.mp3')
}
function playClickSound() {
  if (!state.flags.clickSound) return
  if (!clickAudio) refreshClickSound()
  try {
    if (clickAudio) {
      clickAudio.currentTime = 0
      var pp = clickAudio.play()
      if (pp && typeof pp.catch === 'function') pp.catch(function () {})
    }
  } catch (err) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// 峰谷判定（跟网页版一致）：点击气泡查看当前是否处于 API 使用高峰
// ---------------------------------------------------------------------------
function isPeakTime(sec) {
  var n = (typeof sec === 'number' && isFinite(sec)) ? sec : Date.now() / 1000
  var bj = new Date(n * 1000 + 8 * 3600 * 1000)
  if (n >= WEEKEND_VALLEY_FROM_SEC) {
    var dow = bj.getUTCDay()
    if (dow === 0 || dow === 6) return false
  }
  var hour = bj.getUTCHours()
  for (var i = 0; i < PEAK_HOURS.length; i++) {
    if (hour >= PEAK_HOURS[i][0] && hour < PEAK_HOURS[i][1]) return true
  }
  return false
}
function renderPeak() {
  if (!peakShown) return
  setPeakTextVisible(true)
  var on = isPeakTime()
  var t = state.todayUsed
  var used = (t !== null && t !== undefined && isFinite(Number(t)))
    ? (state.currency === 'CNY' ? '¥' : '') + Number(t).toFixed(2)
    : '--'
  peakEl.className = 'dshp-peak'
  peakEl.innerHTML =
    '<div class="dshp-peak-title">当前时间段为：</div>' +
    '<div class="dshp-peak-state ' + (on ? 'dshp-peak-on' : 'dshp-peak-off') + '">' +
      (on ? '高峰时段' : '空闲时段') + '</div>' +
    '<div class="dshp-peak-used">今日已用 ' + used + '</div>'
}
function renderQuote() {
  var q = randomQuote()
  if (!q) { renderPeak(); return }
  peakEl.className = 'dshp-quote'
  peakEl.textContent = q
}
function renderMemoryDetail() {
  var m = state.mem
  var pct = (m && typeof m.percent === 'number') ? m.percent : null
  var stateTxt = (pct === null) ? '检测中…' : pct.toFixed(1) + '%'
  var low = (pct !== null && pct >= 80)
  peakEl.className = 'dshp-peak'
  peakEl.innerHTML =
    '<div class="dshp-peak-title">系统内存占用</div>' +
    '<div class="dshp-peak-state ' + (low ? 'dshp-peak-on' : 'dshp-peak-off') + '">' + stateTxt + '</div>' +
    '<div class="dshp-peak-used">' + fmtBytes(m && m.used) + ' / ' + fmtBytes(m && m.total) + '</div>'
}
function renderDetail() {
  if (state.flags.contentMode === 'memory') {
    detailType = 'memory'
    renderMemoryDetail()
    return
  }
  if (state.flags.quotesEnabled && state.quotes.length > 0) {
    detailType = 'quote'
    renderQuote()
  } else {
    detailType = 'peak'
    renderPeak()
  }
}
function toggleDetail() {
  peakShown = !peakShown
  if (peakShown) {
    setPeakTextVisible(true)
    renderDetail()
  } else {
    peakEl.innerHTML = ''
    peakEl.className = 'dshp-peak'
    setPeakTextVisible(false)
  }
}
function setPeakTextVisible(on) {
  labelEl.style.display = on ? 'none' : ''
  amountEl.style.display = on ? 'none' : ''
  hintEl.style.display = on ? 'none' : ''
  timeEl.style.display = on ? 'none' : (state.flags.showTime ? 'block' : 'none')
}
function resetPeak() {
  if (!peakShown) return
  peakShown = false
  peakEl.innerHTML = ''
  peakEl.className = 'dshp-peak'
  setPeakTextVisible(false)
}

function fmtBytes(b) {
  if (typeof b !== 'number' || !isFinite(b) || b < 0) return '--'
  var gb = b / (1024 * 1024 * 1024)
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  var mb = b / (1024 * 1024)
  if (mb >= 1) return mb.toFixed(0) + ' MB'
  return Math.round(b / 1024) + ' KB'
}
function renderMemoryNormal() {
  if (peakShown) return
  var m = state.mem
  var pct = (m && typeof m.percent === 'number') ? m.percent : null
  renderPlainAmount((pct === null) ? '--' : pct.toFixed(1) + '%')
  hintEl.textContent = '已用 ' + fmtBytes(m && m.used) + ' / ' + fmtBytes(m && m.total)
  amountEl.classList.remove('dshp-low')
}

// ---------------------------------------------------------------------------
// 弹跳
// ---------------------------------------------------------------------------
function bounce() {
  if (!state.flags.bounceAnim) return
  var s = (state.flags.bounceStrength === 'soft' || state.flags.bounceStrength === 'strong') ? state.flags.bounceStrength : 'normal'
  body.classList.remove('dshp-bounce-soft', 'dshp-bounce-normal', 'dshp-bounce-strong')
  void body.offsetWidth  // 强制重绘以重启动画
  body.classList.add('dshp-bounce-' + s)
}

// ---------------------------------------------------------------------------
// 随机语录
// ---------------------------------------------------------------------------
function randomQuote() {
  if (!state.flags.quotesEnabled || state.quotes.length === 0) return null
  return state.quotes[Math.floor(Math.random() * state.quotes.length)]
}

// ---------------------------------------------------------------------------
// 闲置半透明
// ---------------------------------------------------------------------------
function markActivity() {
  lastActivity = Date.now()
  if (idleOn) {
    idleOn = false
    window.pet.setIdle(false)
  }
}
function checkIdle() {
  if (!state.flags.idleTransparency) return
  if (!idleOn && Date.now() - lastActivity > state.flags.idleSec * 1000) {
    idleOn = true
    window.pet.setIdle(true)
  }
}

// ---------------------------------------------------------------------------
// 命中检测 + 气泡显隐 + 鼠标穿透
// ---------------------------------------------------------------------------
function setupHitTest() {
  try {
    hitCanvas = document.createElement('canvas')
    hitCanvas.width = 610
    hitCanvas.height = 610
    var probe = new Image()
    probe.onload = function () {
      try {
        var ctx = hitCanvas.getContext('2d')
        ctx.drawImage(probe, 0, 0, 610, 610)
        // 一次性读取整块像素备用，之后可释放离屏画布，避免反复 getImageData 的内存/CPU 开销
        hitData = ctx.getImageData(0, 0, 610, 610)
        hitCanvas = null
        hitReady = true
      } catch (err) {}
    }
    probe.onerror = function () { hitReady = true } // 加载失败时按整体命中兜底
    probe.src = '../assets/DSniang1.png'
  } catch (err) { hitReady = true }
}
function isWhaleHit(e) {
  if (!hitData || !hitReady) return true
  try {
    var r = img.getBoundingClientRect()
    if (!r || r.width <= 0 || r.height <= 0) return false
    var lx = Math.floor((e.clientX - r.left) / r.width * 610)
    var ly = Math.floor((e.clientY - r.top) / r.height * 610)
    if (lx < 0 || ly < 0 || lx >= 610 || ly >= 610) return false
    if (state.h === 'left') lx = 610 - lx
    var idx = (ly * 610 + lx) * 4
    return hitData.data[idx + 3] > 10
  } catch (err) { return true }
}
function isOverBubble(e) {
  try {
    var el = document.elementFromPoint(e.clientX, e.clientY)
    return !!(el && el.closest && el.closest('#bubble'))
  } catch (err) { return false }
}
function showBubble() {
  if (state.flags.displayStyle === 'bar') return
  if (!bubbleShown) {
    bubbleShown = true
    bubbleEl.classList.add('dshp-bubble-open')
    settleViewedBalance()
  }
  if (bubbleHideTimer) { clearTimeout(bubbleHideTimer); bubbleHideTimer = null }
  // 点击显示模式：气泡自己展开，一段时间后自动收起
  if (state.flags.bubbleMode === 'click') {
    bubbleHideTimer = setTimeout(function () { bubbleHideTimer = null; hideBubble() }, BUBBLE_MS)
  }
}
function hideBubble() {
  bubbleShown = false
  if (bubbleHideTimer) { clearTimeout(bubbleHideTimer); bubbleHideTimer = null }
  bubbleEl.classList.remove('dshp-bubble-open')
  resetPeak()
}
function scheduleHideBubble() {
  if (!bubbleShown) return
  if (bubbleHideTimer) clearTimeout(bubbleHideTimer)
  bubbleHideTimer = setTimeout(function () { bubbleHideTimer = null; hideBubble() }, 900)
}
function applyBubbleMode() {
  if (state.flags.displayStyle === 'bar') {
    hideBubble()
    return
  }
  if (state.flags.bubbleMode === 'always') showBubble()
  else hideBubble()
}
function applyDisplayStyle() {
  var bar = state.flags.displayStyle === 'bar' && state.flags.contentMode !== 'memory'
  if (bar) state.flags.displayStyle = 'bar'
  else state.flags.displayStyle = 'bubble'
  root.classList.toggle('dshp-bar-mode', bar)
  if (bar) hideBubble()
  else applyBubbleMode()
  publishBar()
}
function setMouseThrough(ignore) {
  if (mouseThrough !== ignore) {
    mouseThrough = ignore
    window.pet.setMouseThrough(ignore)
  }
}
function setCursor(v) {
  document.body.style.cursor = v || ''
}

function setWhaleHover(active) {
  active = !!active
  if (whaleHovering === active) return
  whaleHovering = active
  if (window.__dshpAgentAnimation && window.__dshpAgentAnimation.setHover) {
    window.__dshpAgentAnimation.setHover(active)
  }
}

// 全局指针移动：决定鼠标穿透状态，并让气泡在悬停/离开时渐显渐隐。
// 关键点：闲置时只有鲸鱼本体是“可交互”的，其余透明区域（含原气泡位置）一律交给鼠标穿透，
// 这样点击桌宠周围不会再被窗口挡住。悬停鲸鱼时接管鼠标以便按住/点击/拖动。
function onDocPointerMove(e) {
  markActivity()
  // 拖动时窗口位置由快速通道接管，跳过命中检测和气泡检测，避免每帧额外开销。
  if (drag && drag.active) {
    setMouseThrough(false)
    return
  }
  var overWhale = isWhaleHit(e)
  setWhaleHover(overWhale)
  // 拖拽中 / 右键菜单打开时，必须保持接收鼠标，避免拖动或点菜单被穿透打断
  if (menu.classList.contains('dshp-open')) {
    setMouseThrough(false)
    return
  }
  var overBubble = bubbleShown && isOverBubble(e)
  var m = state.flags.bubbleMode
  if (overWhale || overBubble) {
    setMouseThrough(false)
    setCursor(overWhale ? 'grab' : 'pointer')
    if (m === 'click') {
      // 点击显示：悬停鲸鱼不自动展开，仅已展开时重置自动收起计时
      if (bubbleShown && (overWhale || overBubble)) showBubble()
    } else {
      // 常显 / 悬停：命中鲸鱼即展开
      if (overWhale) showBubble()
    }
  } else {
    setMouseThrough(true)
    setCursor('')
    if (m === 'hover') scheduleHideBubble()
  }
}
document.addEventListener('pointermove', onDocPointerMove, true)
document.addEventListener('pointerleave', function () { setWhaleHover(false) }, true)
window.addEventListener('blur', function () { setWhaleHover(false) })

// 测试钩子：返回音频上下文状态（自检用）
window.__dshpAudioTest = function () {
  var ctx = ensureAudio()
  return ctx ? ctx.state : 'none'
}

// ---------------------------------------------------------------------------
// 余额
// ---------------------------------------------------------------------------
function settleViewedBalance() {
  if (state.flags.contentMode === 'memory' || state.balance === null) return false
  var current = Number(state.balance)
  var currency = state.currency || 'CNY'
  if (!isFinite(current)) return false

  if (state.lastViewedBalance === null || !isFinite(Number(state.lastViewedBalance)) ||
      (state.lastViewedCurrency && state.lastViewedCurrency !== currency)) {
    saveLastViewedBalance(current, currency)
    state.status = 'ok'
    renderAmount(current, currency, false)
    hintEl.textContent = state.message || '点击刷新'
    return false
  }

  var previous = Number(state.lastViewedBalance)
  var delta = previous - current
  if (Math.abs(delta) <= 0.000001) {
    saveLastViewedBalance(current, currency)
    state.status = 'ok'
    renderAmount(current, currency, false)
    hintEl.textContent = state.message || '点击刷新'
    return false
  }

  if (state.lowThreshold > 0 && current < state.lowThreshold) {
    amountEl.classList.add('dshp-low')
    beep('low')
  } else {
    amountEl.classList.remove('dshp-low')
    beep(delta > 0 ? 'down' : 'up')
  }

  state.status = 'changing'
  animateAmount(previous, current, currency, ANIM_MS)
  if (delta > 0) showDecrease(delta)
  bounce()
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(function () {
    settleTimer = null
    if (state.status === 'changing') {
      state.status = 'ok'
      hintEl.textContent = state.message || '点击刷新'
    }
  }, CHANGE_MS)
  saveLastViewedBalance(current, currency)
  return true
}

function refresh(manual) {
  if (busy) return
  busy = true
  // 后台刷新不触碰已显示的数字；用户查看或手动刷新时才结算并滚动。
  if (state.balance === null && bubbleShown) { state.status = 'loading'; render() }
  var fb = window.__dshpFakeBalance
  var balancePromise = (fb !== null && fb !== undefined)
    ? Promise.resolve(typeof fb === 'function' ? fb() : fb)
    : window.pet.getBalance()
  balancePromise
    .then(function (data) {
      if (data && data.ok) {
        var nb = Number(data.totalBalance)
        var nc = String(data.currency || 'CNY')
        state.balance = nb
        state.currency = nc
        state.granted = data.grantedBalance
        state.toppedUp = data.toppedUpBalance
        state.message = data.stale ? '网络抖动，沿用上次余额' : ''
        // 内存模式下只更新余额数据备用，不触碰桌宠/气泡显示，避免覆盖内存占用画面
        if (state.flags.contentMode === 'memory') {
          state.status = 'ok'
          return
        }
        if (manual || (bubbleShown && !amountEl.getAttribute('data-value'))) {
          settleViewedBalance()
        } else {
          state.status = 'ok'
        }
      } else {
        state.message = (data && data.error) ? String(data.error) : '获取失败'
        if (state.balance === null) {
          state.status = 'error'
          render()
        }
      }
    })
    .catch(function () {
      state.status = 'error'
      state.message = '获取失败'
      render()
    })
    .finally(function () { busy = false; refreshStats(); publishBar() })
}

function shownAmount() {
  var txt = String(amountEl.getAttribute('data-value') || '').replace(/[^\d.\-]/g, '')
  var n = parseFloat(txt)
  return isFinite(n) ? n : state.balance
}

function animateAmount(from, to, currency, duration) {
  if (animId) cancelAnimationFrame(animId)
  animId = null
  renderAmount(to, currency, from !== null && isFinite(from) && Number(from) !== Number(to))
}

function previousDigitAt(text, index) {
  var digits = String(text || '').replace(/\D/g, '')
  if (!digits) return 0
  var pos = Math.min(index, digits.length - 1)
  var n = parseInt(digits.charAt(pos), 10)
  return isFinite(n) ? n : 0
}

function buildOdometerDigit(target, start, animate) {
  var digit = document.createElement('span')
  digit.className = 'dshp-odo-digit'
  var track = document.createElement('span')
  track.className = 'dshp-odo-track'
  for (var i = 0; i <= 9; i++) {
    var cell = document.createElement('span')
    cell.className = 'dshp-odo-cell'
    cell.textContent = String(i)
    track.appendChild(cell)
  }
  track.style.transition = 'none'
  track.style.transform = 'translateY(' + (-clamp(start, 0, 9) * 1.05) + 'em)'
  digit.appendChild(track)
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      track.style.transition = ''
      track.style.transform = 'translateY(' + (-clamp(target, 0, 9) * 1.05) + 'em)'
    })
  })
  return digit
}

function clearAmountVisual() {
  var nodes = Array.prototype.slice.call(amountEl.childNodes)
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i] !== decreaseEl) amountEl.removeChild(nodes[i])
  }
}

function renderAmount(value, currency, animate) {
  var text = fmt(value, currency)
  var oldText = amountEl.getAttribute('data-value') || ''
  if (text === oldText && animate !== true) return
  clearAmountVisual()
  var odo = document.createElement('span')
  odo.className = 'dshp-odo'
  odo.setAttribute('aria-hidden', 'true')
  var digitIndex = 0
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i)
    if (ch >= '0' && ch <= '9') {
      var target = Number(ch)
      var start = animate ? previousDigitAt(oldText, digitIndex) : target
      odo.appendChild(buildOdometerDigit(target, start, animate))
      digitIndex++
    } else {
      var token = document.createElement('span')
      token.className = 'dshp-odo-token'
      token.textContent = ch
      odo.appendChild(token)
    }
  }
  amountEl.insertBefore(odo, decreaseEl)
  amountEl.setAttribute('data-value', text)
  amountEl.setAttribute('aria-label', text)
}

function renderPlainAmount(text) {
  clearAmountVisual()
  var span = document.createElement('span')
  span.textContent = text
  amountEl.insertBefore(span, decreaseEl)
  amountEl.setAttribute('data-value', text)
  amountEl.setAttribute('aria-label', text)
}

function showDecrease(delta) {
  var n = Number(delta)
  if (!state.flags.decreaseHintEnabled || !isFinite(n) || n <= 0.000001) return
  decreaseEl.textContent = '-' + n.toFixed(2) + ' 元'
  decreaseEl.classList.remove('dshp-decrease-run')
  void decreaseEl.offsetWidth
  decreaseEl.classList.add('dshp-decrease-run')
}

function render() {
  if (state.status === 'changing') return
  if (state.flags.contentMode === 'memory') {
    renderMemoryNormal()
    return
  }
  if (state.status === 'ok') {
    renderAmount(state.balance, state.currency, false)
    hintEl.textContent = state.message || '点击刷新'
  } else if (state.status === 'loading') {
    renderPlainAmount('--')
    hintEl.textContent = '加载中…'
  } else {
    if (state.balance !== null) renderAmount(state.balance, state.currency, false)
    else renderPlainAmount('--')
    hintEl.textContent = state.message || '获取失败'
  }
  publishBar()
}

// ---------------------------------------------------------------------------
// 拖拽 + Q弹
// ---------------------------------------------------------------------------
var dragFrameId = null
function scheduleExpress() {
  if (dragFrameId) return
  dragFrameId = requestAnimationFrame(function () {
    dragFrameId = null
    if (drag && drag.active && window.pet.setPositionFast) {
      window.pet.setPositionFast(state.left, state.top)
      return
    }
    express()
  })
}

function onPointerDown(e) {
  if (e.button !== 0) return
  // 点气泡：切换峰值显示 + 播放点击音效，不触发拖拽
  if (e.target && e.target.closest && e.target.closest('#bubble')) {
    markActivity()
    toggleDetail()
    playClickSound()
    if (state.flags.bubbleMode === 'click') showBubble()
    return
  }
  // 只对鲸鱼本体命中区域做出反应，其余透明区域交给鼠标穿透
  if (!isWhaleHit(e)) return
  try { root.setPointerCapture(e.pointerId) } catch (err) {}
  setMouseThrough(false)
  markActivity()
  showBubble()
  var rect = root.getBoundingClientRect()
  drag = {
    active: true,
    ready: false,
    startScreenX: e.screenX,
    startScreenY: e.screenY,
    grabX: 0,
    grabY: 0,
    w: rect.width,
    h: rect.height,
    moved: false,
    vp: screen.workArea
  }
  root.classList.add('dshp-dragging')
  pressDown()
  window.pet.getPosition().then(function (pos) {
    if (!drag || !drag.active) return
    drag.grabX = drag.startScreenX - pos.x
    drag.grabY = drag.startScreenY - pos.y
    drag.ready = true
  })
}

function onPointerMove(e) {
  if (!drag || !drag.active || !drag.ready) return
  var mx = e.screenX - drag.startScreenX
  var my = e.screenY - drag.startScreenY
  if (mx * mx + my * my >= CLICK_SQ) drag.moved = true
  var wa = drag.vp
  state.left = clamp(e.screenX - drag.grabX, wa.x, Math.max(wa.x, wa.x + wa.width - drag.w))
  state.top = clamp(e.screenY - drag.grabY, wa.y, Math.max(wa.y, wa.y + wa.height - drag.h))
  scheduleExpress()
}

function endDrag(e, clickAllowed) {
  if (!drag || !drag.active) return
  drag.active = false
  pressUp()
  root.classList.remove('dshp-dragging')
  try {
    if (root.hasPointerCapture && root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId)
  } catch (err) {}
  if (clickAllowed && !drag.moved) {
    if (window.__dshpAgentAnimation) window.__dshpAgentAnimation.click()
    refresh(true)
    showBubble()
    return
  }
  if (dragFrameId) { cancelAnimationFrame(dragFrameId); dragFrameId = null }
  var wa = drag.vp
  var left = clamp(e.screenX - drag.grabX, wa.x, Math.max(wa.x, wa.x + wa.width - drag.w))
  var top = clamp(e.screenY - drag.grabY, wa.y, Math.max(wa.y, wa.y + wa.height - drag.h))
  if (state.snap) {
    var centerX = left + drag.w / 2
    var centerY = top + drag.h / 2
    if (centerX < wa.x + wa.width / 4) { state.h = 'left'; state.hOff = 0 }
    else if (centerX > wa.x + wa.width * 3 / 4) { state.h = 'right'; state.hOff = 0 }
    else { state.h = null; state.hOff = left }
    if (centerY < wa.y + wa.height / 4) { state.v = 'top'; state.vOff = 0 }
    else if (centerY > wa.y + wa.height * 3 / 4) { state.v = 'bottom'; state.vOff = 0 }
    else { state.v = null; state.vOff = top }
  } else {
    state.h = null
    state.v = null
    state.hOff = left
    state.vOff = top
  }
  state.left = left
  state.top = top
  settle()
}

// 按压时从顶部往下压扁、底部不动、微加宽，模拟被压的 Q 弹手感；强度随设置变化
var SQUISHES = {
  soft:   'scale(1.03, 0.86)',
  normal: 'scale(1.05, 0.72)',
  strong: 'scale(1.10, 0.55)',
}
function squish() {
  var s = (state.flags.bounceStrength === 'soft' || state.flags.bounceStrength === 'strong') ? state.flags.bounceStrength : 'normal'
  return SQUISHES[s] || SQUISHES.normal
}
function pressDown() {
  body.style.transform = squish()
  pressing = true
  playPressDuck()
}
function pressUp() {
  body.style.transform = 'scale(1)'
  pressing = false
  // 第一段已播完（长按情况）→ 立即接第二段
  if (pressEnded) { playReleaseDuck(); return }
  // 快速点击：在第一段结束前约 100ms 起播第二段，让两句鸭叫连贯
  var durKnown = false, remainMs = 0
  try {
    var dur = pressAudio ? pressAudio.duration : 0
    if (isFinite(dur) && dur > 0) {
      durKnown = true
      remainMs = (dur - pressAudio.currentTime) * 1000
    }
  } catch (err) { /* ignore */ }
  if (durKnown) {
    releaseTimer = setTimeout(function () {
      releaseTimer = null
      playReleaseDuck()
    }, Math.max(0, remainMs - 100))
  }
  // 时长未知时交给 pressAudio.onended 兜底
}

root.addEventListener('pointerdown', onPointerDown)
root.addEventListener('pointermove', onPointerMove)
root.addEventListener('pointerup', function (e) { endDrag(e, true) })
root.addEventListener('pointercancel', function (e) { endDrag(e, false) })
window.addEventListener('resize', function () {
  window.pet.getSize().then(function (r) {
    if (r && typeof r.size === 'number') state.size = r.size
    settle()
  })
})

// ---------------------------------------------------------------------------
// 位置/吸附
// ---------------------------------------------------------------------------
function express() {
  return window.pet.setPosition(state.left, state.top)
}

function settle() {
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(function () {
    settleTimer = null
    var wa = screen.workArea
    var s = state.size
    var left, top
    if (state.snap) {
      left = state.h === 'left' ? wa.x : (state.h === 'right' ? wa.x + wa.width - s : state.left)
      top = state.v === 'top' ? wa.y : (state.v === 'bottom' ? wa.y + wa.height - s : state.top)
      left = state.h === null ? clamp(left, wa.x, Math.max(wa.x, wa.x + wa.width - s)) : left
      top = state.v === null ? clamp(top, wa.y, Math.max(wa.y, wa.y + wa.height - s)) : top
    } else {
      left = clamp(state.left, wa.x, Math.max(wa.x, wa.x + wa.width - s))
      top = clamp(state.top, wa.y, Math.max(wa.y, wa.y + wa.height - s))
    }
    state.left = left
    state.top = top
    updateMirror()
    express()
  }, 0)
}

function updateMirror() {
  if (state.snap && state.h === 'left') root.classList.add('dshp-left')
  else root.classList.remove('dshp-left')
}

// ---------------------------------------------------------------------------
// 右键菜单
// ---------------------------------------------------------------------------
function hideMenu() { menu.classList.remove('dshp-open') }
window.addEventListener('contextmenu', function (e) {
  e.preventDefault()
  var mw = menu.offsetWidth || 150
  var mh = menu.offsetHeight || 150
  var x = Math.min(e.clientX, window.innerWidth - mw)
  var y = Math.min(e.clientY, window.innerHeight - mh)
  menu.style.left = Math.max(0, x) + 'px'
  menu.style.top = Math.max(0, y) + 'px'
  menu.classList.add('dshp-open')
})
window.addEventListener('pointerdown', function (e) {
  if (!menu.contains(e.target)) hideMenu()
})
menu.addEventListener('click', function (e) {
  var act = e.target.getAttribute && e.target.getAttribute('data-act')
  if (!act) return
  hideMenu()
  if (act === 'refresh') { showBubble(); refresh(true) }
  else if (act === 'settings') window.pet.openSettings()
  else if (act === 'quit') window.pet.quit()
})

function refreshStats() {
  window.pet.getStats().then(function (st) {
    if (st) {
      state.todayUsed = (typeof st.todayUsed === 'number' && isFinite(st.todayUsed)) ? st.todayUsed : null
      menuStats.textContent = '今日消耗：' + (state.currency === 'CNY' ? '¥ ' : '') + Number(state.todayUsed || 0).toFixed(2)
      if (peakShown && detailType === 'peak') renderPeak()
      publishBar()
    }
  })
}

// ---------------------------------------------------------------------------
// 悬停详情 + 闲置
// ---------------------------------------------------------------------------
root.addEventListener('pointermove', markActivity)
root.addEventListener('pointerdown', markActivity)
setInterval(checkIdle, 1000)

// ---------------------------------------------------------------------------
// 配置更新
// ---------------------------------------------------------------------------
window.pet.onConfigUpdated(function () {
  window.pet.getConfig().then(function (c) {
    if (!c) return
    if (typeof c.snap === 'boolean') state.snap = c.snap
    if (typeof c.label === 'string') applyLabel(c.label)
    if (typeof c.refreshSec === 'number') {
      state.refreshSec = c.refreshSec
      startAutoRefresh()
    }
    applyFlags(c)
    applyImage()
    settle()
    refreshStats()
  })
})

// ---------------------------------------------------------------------------
// 定时刷新
// ---------------------------------------------------------------------------
var refreshTimer = null
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = null
  var sec = state.refreshSec
  if (sec > 0) {
    refreshTimer = setInterval(function () { refresh(false) }, sec * 1000)
  }
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------
Promise.all([window.pet.getPosition(), window.pet.getScreen(), window.pet.getSize(), window.pet.getConfig()])
  .then(function (res) {
    state.left = res[0].x
    state.top = res[0].y
    screen = res[1]
    state.size = res[2].size
    state.scale = res[2].scale
    if (res[3]) {
      if (typeof res[3].scale === 'number') state.scale = res[3].scale
      if (typeof res[3].snap === 'boolean') state.snap = res[3].snap
      if (typeof res[3].label === 'string') applyLabel(res[3].label)
      if (typeof res[3].refreshSec === 'number') state.refreshSec = res[3].refreshSec
      applyFlags(res[3])
    } else {
      applyLabel('DeepSeek 余额')
    }
    applyBubbleMode()
    refreshClickSound()
    applyImage()
    applyTime()
    startAutoRefresh()
    refreshStats()
    settle()
    setupHitTest()
    refresh(false)
    setInterval(updateTime, 1000)
  })
  .catch(function () {
    applyLabel('DeepSeek 余额')
    applyDisplayStyle()
    applyBubbleMode()
    refreshClickSound()
    setupHitTest()
    refresh(false)
  })

window.pet.onRefreshRequested(function () { showBubble(); refresh(true); refreshStats() })

// 测试钩子（仅自检使用）
window.__dshpTestRefresh = function () { refresh(true) }
window.__dshpTestAutoRefresh = function () { refresh(false) }
window.__dshpShowBubble = function () { showBubble() }
window.__dshpHideBubble = function () { hideBubble() }
window.__dshpTestState = function () {
  return {
    amount: amountEl.getAttribute('data-value') || amountEl.textContent,
    decrease: decreaseEl.textContent || '',
    status: state.status,
  }
}
window.__dshpSetFakeBalance = function (v) { window.__dshpFakeBalance = v }
window.__dshpFlags = function () { return JSON.parse(JSON.stringify(state.flags)) }
window.__dshpConfig = function () { return { snap: state.snap, label: state.label, refreshSec: state.refreshSec } }
window.__dshpUiDebug = function () {
  var r = img.getBoundingClientRect()
  return {
    mouseThrough: mouseThrough,
    bubbleShown: bubbleShown,
    hitReady: hitReady,
    whaleRect: { left: r.left, top: r.top, width: r.width, height: r.height },
  }
}
