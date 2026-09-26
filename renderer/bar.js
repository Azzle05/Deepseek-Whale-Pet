'use strict'

var balanceRow = document.getElementById('balanceRow')
var todayText = document.getElementById('todayText')
var peakText = document.getElementById('peakText')
var decreaseEl = document.createElement('div')
decreaseEl.className = 'decrease'
balanceRow.appendChild(decreaseEl)

var state = {
  balance: null,
  currency: 'CNY',
  todayUsed: null,
  peak: false,
  decreaseHintEnabled: true,
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

function fmt(balance, currency) {
  var num = Number(balance)
  var fixed = isFinite(num) ? num.toFixed(2) : '--'
  return currency === 'CNY' ? '¥ ' + fixed : fixed + (currency ? ' ' + currency : '')
}

function buildToken(text) {
  var token = document.createElement('span')
  token.className = 'odo-token'
  token.textContent = text
  return token
}

function buildDigit(target, start, animate) {
  var digit = document.createElement('span')
  digit.className = 'odo-digit'
  var track = document.createElement('span')
  track.className = 'odo-track'
  for (var i = 0; i <= 9; i++) {
    var cell = document.createElement('span')
    cell.className = 'odo-cell'
    cell.textContent = String(i)
    track.appendChild(cell)
  }
  track.style.transition = animate ? '' : 'none'
  track.style.transform = 'translateY(' + (-clamp(start, 0, 9) * 1.05) + 'em)'
  digit.appendChild(track)
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      track.style.transition = ''
      track.style.transform = 'translateY(' + (-target * 1.05) + 'em)'
    })
  })
  return digit
}

function previousDigitAt(text, index) {
  var digits = String(text || '').replace(/\D/g, '')
  var n = parseInt(digits.charAt(Math.min(index, Math.max(0, digits.length - 1))), 10)
  return isFinite(n) ? n : 0
}

function renderBalance(value, animate) {
  var text = fmt(value, state.currency)
  var oldText = balanceRow.getAttribute('data-value') || ''
  var odo = document.createElement('span')
  odo.className = 'odo'
  var digitIndex = 0
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i)
    if (ch >= '0' && ch <= '9') {
      var start = animate ? previousDigitAt(oldText, digitIndex) : Number(ch)
      odo.appendChild(buildDigit(Number(ch), start, animate))
      digitIndex++
    } else {
      odo.appendChild(buildToken(ch))
    }
  }
  while (balanceRow.firstChild && balanceRow.firstChild !== decreaseEl) balanceRow.removeChild(balanceRow.firstChild)
  balanceRow.insertBefore(odo, decreaseEl)
  balanceRow.setAttribute('data-value', text)
}

function showDecrease(delta) {
  if (!state.decreaseHintEnabled || !(delta > 0)) return
  decreaseEl.textContent = '-' + delta.toFixed(2) + ' 元'
  decreaseEl.classList.remove('run')
  void decreaseEl.offsetWidth
  decreaseEl.classList.add('run')
}

function renderInfo() {
  var used = (state.todayUsed === null || state.todayUsed === undefined || !isFinite(Number(state.todayUsed)))
    ? '--'
    : (state.currency === 'CNY' ? '¥' : '') + Number(state.todayUsed).toFixed(2)
  todayText.textContent = '今日 ' + used
  peakText.textContent = state.peak ? '高峰' : '空闲'
  peakText.className = state.peak ? 'peak-on' : 'peak-off'
}

window.pet.onBarData(function (data) {
  if (!data) return
  var nextBalance = Number(data.balance)
  if (!isFinite(nextBalance)) nextBalance = null
  var grew = state.balance === null && nextBalance !== null
  var changed = state.balance !== null && nextBalance !== null && Math.abs(nextBalance - state.balance) > 0.000001
  var delta = changed ? state.balance - nextBalance : 0
  state.balance = nextBalance
  state.currency = data.currency || 'CNY'
  state.todayUsed = (typeof data.todayUsed === 'number') ? data.todayUsed : null
  state.peak = !!data.peak
  state.decreaseHintEnabled = data.decreaseHintEnabled !== false
  renderBalance(state.balance, grew || changed)
  renderInfo()
  if (changed && delta > 0) showDecrease(delta)
})
