// Experimental Agent GIF animation controller.
// Keeps at most three decoded images alive: two cross-fade layers and one click layer.
'use strict'

;(function () {
  var FADE_MS = 250
  var ROTATE_MS = 10000
  var MIN_DWELL_MS = 2000
  // Keep reasoning visible long enough before rapid tool events replace it.
  var DWELL_STATES = ['think', 'tool', 'run']
  var PRIORITY_STATES = ['error', 'interrupted', 'dragging', 'balance_increase', 'low_balance']
  var AGENT_IDS = ['codex', 'claudecode', 'harness']
  var STATE_IDS = [
    'idle', 'link', 'wait', 'think', 'tool', 'run', 'reply',
    'approval', 'error', 'interrupted', 'done', 'hover', 'sleep', 'click',
    'low_balance', 'balance_increase', 'dragging',
  ]

  var root = document.getElementById('root')
  var layers = [
    document.getElementById('agentGifA'),
    document.getElementById('agentGifB'),
  ]
  var clickLayer = document.getElementById('agentClickGif')
  if (!root || !layers[0] || !layers[1] || !clickLayer) return

  var config = {
    enabled: false,
    agent: 'codex',
    clickEnabled: true,
  }
  var currentAgent = ''
  var baseState = 'idle'
  var baseForce = false
  var currentState = ''
  var desiredState = ''
  var currentLayer = -1
  var currentAsset = null
  var currentAssets = []
  var currentAssetStartedAt = 0
  var currentStateStartedAt = 0
  var hoverActive = false
  var lastNonHoverState = 'idle'
  var draggingActive = false
  var lowBalanceActive = false
  var balanceIncreaseUntil = 0
  var balanceIncreaseTimer = null
  var requestToken = 0
  var stateLoadCount = 0
  var acceptedEventId = ''
  var rotationTimer = null
  var dwellTimer = null
  var dwellPendingState = ''
  var dwellMinAt = 0
  var layerTimers = [null, null]
  var layerTokens = [0, 0]
  var clickSessionCount = 0
  var click = {
    active: false,
    pending: false,
    asset: null,
    startedAt: 0,
    lastClickAt: 0,
    cycleEndsAt: 0,
    currentCycle: 0,
    continuationRequested: false,
    token: 0,
    endTimer: null,
    cleanupTimer: null,
  }

  function now() {
    return performance.now()
  }

  function normalizeAgent(value) {
    return AGENT_IDS.indexOf(value) >= 0 ? value : 'codex'
  }

  function normalizeState(value) {
    return STATE_IDS.indexOf(value) >= 0 ? value : 'idle'
  }

  function isDwellState(state) {
    return DWELL_STATES.indexOf(state) >= 0
  }

  function isPriorityState(state) {
    return PRIORITY_STATES.indexOf(state) >= 0
  }

  function clearRotation() {
    if (rotationTimer) {
      clearTimeout(rotationTimer)
      rotationTimer = null
    }
  }

  function clearDwell() {
    if (dwellTimer) {
      clearTimeout(dwellTimer)
      dwellTimer = null
    }
    dwellPendingState = ''
    dwellMinAt = 0
  }

  function clearLayerTimer(index) {
    if (layerTimers[index]) {
      clearTimeout(layerTimers[index])
      layerTimers[index] = null
    }
  }

  function clearClickTimers() {
    if (click.endTimer) {
      clearTimeout(click.endTimer)
      click.endTimer = null
    }
    if (click.cleanupTimer) {
      clearTimeout(click.cleanupTimer)
      click.cleanupTimer = null
    }
  }

  function clearBalanceIncrease() {
    balanceIncreaseUntil = 0
    if (balanceIncreaseTimer) {
      clearTimeout(balanceIncreaseTimer)
      balanceIncreaseTimer = null
    }
  }

  function effectiveState() {
    if (draggingActive) return 'dragging'
    if (balanceIncreaseUntil > now()) return 'balance_increase'
    if (lowBalanceActive) return 'low_balance'
    if (hoverActive) return 'hover'
    return baseState || 'idle'
  }

  function applyEffectiveState(options) {
    if (!config.enabled) return
    options = options || {}
    var nextState = effectiveState()
    requestState(nextState, {
      force: !!options.force || baseForce,
      allowDuringHover: nextState !== 'hover',
    })
    baseForce = false
  }

  function setAgentMode(active) {
    root.classList.toggle('dshp-agent-mode', !!active)
    if (!active) root.classList.remove('dshp-agent-clicking')
  }

  function setClicking(active) {
    root.classList.toggle('dshp-agent-clicking', !!active)
  }

  function resetStateLayers(removeSources) {
    setAgentMode(false)
    clearRotation()
    clearDwell()
    requestToken++
    for (var i = 0; i < layers.length; i++) {
      clearLayerTimer(i)
      layerTokens[i]++
      layers[i].classList.remove('dshp-agent-gif-on')
      if (removeSources) layers[i].removeAttribute('src')
    }
    currentAgent = ''
    baseState = 'idle'
    baseForce = false
    currentState = ''
    desiredState = ''
    currentLayer = -1
    currentAsset = null
    currentAssets = []
    currentAssetStartedAt = 0
    currentStateStartedAt = 0
    acceptedEventId = ''
  }

  function stopClick(removeSource) {
    clearClickTimers()
    setClicking(false)
    click.token++
    click.active = false
    click.pending = false
    click.startedAt = 0
    click.lastClickAt = 0
    click.cycleEndsAt = 0
    click.currentCycle = 0
    click.continuationRequested = false
    clickLayer.classList.remove('dshp-agent-gif-on')
    if (removeSource) {
      click.asset = null
      clickLayer.removeAttribute('src')
    }
  }

  function stopAll() {
    hoverActive = false
    lastNonHoverState = 'idle'
    draggingActive = false
    lowBalanceActive = false
    clearBalanceIncrease()
    resetStateLayers(true)
    stopClick(true)
  }

  function chooseAsset(assets, avoidUrl) {
    if (!Array.isArray(assets) || assets.length === 0) return null
    var candidates = assets
    if (assets.length > 1 && avoidUrl) {
      candidates = assets.filter(function (asset) { return asset.url !== avoidUrl })
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  function assetDuration(asset) {
    return Math.max(100, Number(asset && asset.durationMs) || 3200)
  }

  function scheduleLayerSourceCleanup(index, token) {
    clearLayerTimer(index)
    layerTimers[index] = setTimeout(function () {
      layerTimers[index] = null
      if (index === currentLayer || token !== layerTokens[index]) return
      layers[index].classList.remove('dshp-agent-gif-on')
      layers[index].removeAttribute('src')
    }, FADE_MS + 120)
  }

  function scheduleRotation() {
    clearRotation()
    if (!config.enabled || !currentAsset || currentAssets.length < 2) return
    var duration = assetDuration(currentAsset)
    var loops = Math.max(1, Math.ceil(ROTATE_MS / duration))
    rotationTimer = setTimeout(function () {
      rotationTimer = null
      if (!config.enabled || !currentState || !currentAsset) return
      var nextAsset = chooseAsset(currentAssets, currentAsset.url)
      if (nextAsset) loadStateAsset(nextAsset, currentState, requestToken)
    }, duration * loops)
  }

  function currentLoopEndAfter(minAt) {
    var duration = assetDuration(currentAsset)
    var cycleStart = currentAssetStartedAt || now()
    var cycles = Math.max(1, Math.ceil(Math.max(0, minAt - cycleStart) / duration))
    return cycleStart + cycles * duration
  }

  function scheduleDwellRelease() {
    if (!dwellPendingState || !isDwellState(currentState)) return
    var boundary = currentLoopEndAfter(dwellMinAt)
    var wait = Math.max(0, boundary - now())
    if (dwellTimer) clearTimeout(dwellTimer)
    dwellTimer = setTimeout(releaseDwell, wait + 5)
  }

  function releaseDwell() {
    dwellTimer = null
    if (!config.enabled || !dwellPendingState || !isDwellState(currentState)) return
    var boundary = currentLoopEndAfter(dwellMinAt)
    if (now() < boundary - 2) {
      scheduleDwellRelease()
      return
    }
    var nextState = dwellPendingState
    dwellPendingState = ''
    dwellMinAt = 0
    if (nextState === currentState) return
    requestState(nextState, { force: true, dwellRelease: true })
  }

  function deferUntilDwellEnds(state) {
    dwellPendingState = state
    dwellMinAt = now() + MIN_DWELL_MS
    scheduleDwellRelease()
  }

  function loadStateAsset(asset, state, token) {
    if (!config.enabled || !asset || token !== requestToken) return
    var nextIndex = currentLayer === 0 ? 1 : 0
    var nextLayer = layers[nextIndex]
    var previousIndex = currentLayer
    var previousLayer = previousIndex >= 0 ? layers[previousIndex] : null
    clearLayerTimer(nextIndex)
    layerTokens[nextIndex]++
    var loadToken = layerTokens[nextIndex]
    var settled = false

    function activate() {
      if (settled) return
      settled = true
      if (loadToken !== layerTokens[nextIndex] || token !== requestToken || !config.enabled) return

      var stateChanged = state !== currentState
      var activatedAt = now()
      nextLayer.classList.add('dshp-agent-gif-on')
      setAgentMode(true)
      if (previousLayer && previousLayer !== nextLayer) {
        previousLayer.classList.remove('dshp-agent-gif-on')
      }
      currentLayer = nextIndex
      currentAsset = asset
      currentState = state
      currentAssetStartedAt = activatedAt
      if (stateChanged || !currentStateStartedAt) currentStateStartedAt = activatedAt
      stateLoadCount++
      if (previousIndex >= 0 && previousLayer !== nextLayer) {
        scheduleLayerSourceCleanup(previousIndex, layerTokens[previousIndex])
      }
      scheduleRotation()
      if (dwellPendingState) scheduleDwellRelease()
    }

    nextLayer.onload = activate
    nextLayer.onerror = function () {
      if (loadToken !== layerTokens[nextIndex] || token !== requestToken) return
      nextLayer.classList.remove('dshp-agent-gif-on')
      nextLayer.removeAttribute('src')
      currentAsset = null
      currentAssetStartedAt = 0
      if (state !== 'idle') requestState('idle', { force: true })
    }
    nextLayer.classList.remove('dshp-agent-gif-on')
    nextLayer.removeAttribute('src')
    nextLayer.src = asset.url
    if (nextLayer.complete && nextLayer.naturalWidth > 0) activate()
  }

  function requestState(rawState, options) {
    if (!config.enabled) return
    options = options || {}
    var agent = config.agent
    var state = normalizeState(rawState)

    if (options.eventId) {
      if (options.eventId === acceptedEventId) return
      acceptedEventId = options.eventId
    }

    if (hoverActive && state !== 'hover' && !options.allowDuringHover) {
      lastNonHoverState = state
      return
    }

    if (!options.force && currentAgent === agent) {
      if (state === desiredState) {
        if (state === currentState && dwellPendingState) clearDwell()
        return
      }
      if (state === currentState) {
        if (dwellPendingState && dwellPendingState !== state) clearDwell()
        return
      }
      var protectedState = isDwellState(currentState) ? currentState : desiredState
      if (isDwellState(protectedState) && !isPriorityState(state)) {
        deferUntilDwellEnds(state)
        return
      }
    }

    clearDwell()
    desiredState = state
    var token = ++requestToken
    clearRotation()
    window.pet.getAgentAssets(agent, state).then(function (result) {
      if (token !== requestToken || !config.enabled) return
      if (!result || !Array.isArray(result.assets) || result.assets.length === 0) {
        currentAssets = []
        currentAsset = null
        if (state === 'hover' && hoverActive) return
        if (state !== 'idle') requestState('idle', { force: true })
        else resetStateLayers(false)
        return
      }
      currentAgent = agent
      currentAssets = result.assets
      var asset = chooseAsset(currentAssets, currentAsset && currentAsset.url)
      if (asset) loadStateAsset(asset, state, token)
    }).catch(function () {
      if (token === requestToken && state !== 'idle') requestState('idle', { force: true })
    })
  }

  function setBaseState(rawState, options) {
    options = options || {}
    var state = normalizeState(rawState)
    if (options.eventId) {
      if (options.eventId === acceptedEventId) return
      acceptedEventId = options.eventId
    }
    baseState = state
    baseForce = !!options.force
    lastNonHoverState = state
    applyEffectiveState({ force: !!options.force })
  }

  function configure(next) {
    if (!next) return
    var wasEnabled = config.enabled
    var previousAgent = config.agent
    config.enabled = !!next.agentAnimationEnabled
    config.agent = normalizeAgent(next.agentType)
    config.clickEnabled = next.agentClickAnimation !== false

    if (!config.enabled) {
      hoverActive = false
      lastNonHoverState = 'idle'
      stopAll()
      return
    }
    if (!wasEnabled || previousAgent !== config.agent) {
      resetStateLayers(true)
      baseState = 'idle'
      applyEffectiveState({ force: true })
    }
  }

  function scheduleClickCycle(waitMs) {
    if (!click.active) return
    if (click.endTimer) clearTimeout(click.endTimer)
    click.endTimer = setTimeout(onClickCycleEnd, Math.max(0, waitMs))
  }

  function onClickCycleEnd() {
    click.endTimer = null
    if (!click.active) return
    var duration = assetDuration(click.asset)
    var current = now()
    if (click.cycleEndsAt < current - duration) click.cycleEndsAt = current + duration
    if (click.continuationRequested) {
      click.continuationRequested = false
      click.currentCycle++
      click.cycleEndsAt += duration
      scheduleClickCycle(click.cycleEndsAt - current)
      return
    }
    endClick()
  }

  function startClickAsset(asset, reuseSource) {
    if (!config.enabled || !config.clickEnabled || !asset) return
    clearClickTimers()
    var token = ++click.token
    clickSessionCount++
    click.pending = false
    click.asset = asset
    click.active = true
    click.startedAt = 0
    click.cycleEndsAt = 0
    click.currentCycle = 0
    var settled = false

    function beginPlayback() {
      if (settled || token !== click.token || !click.active) return
      settled = true
      var startedAt = now()
      click.startedAt = startedAt
      click.currentCycle = 1
      click.cycleEndsAt = startedAt + assetDuration(click.asset)
      setClicking(true)
      clickLayer.classList.add('dshp-agent-gif-on')
      scheduleClickCycle(click.cycleEndsAt - startedAt)
    }

    if (reuseSource && clickLayer.complete && clickLayer.naturalWidth > 0) {
      beginPlayback()
      return
    }

    clickLayer.classList.remove('dshp-agent-gif-on')
    clickLayer.onload = beginPlayback
    clickLayer.onerror = function () {
      if (token === click.token) stopClick(true)
    }
    clickLayer.removeAttribute('src')
    void clickLayer.offsetWidth
    clickLayer.src = asset.url
    if (clickLayer.complete && clickLayer.naturalWidth > 0) beginPlayback()
  }

  function endClick() {
    if (!click.active) return
    click.active = false
    click.continuationRequested = false
    setClicking(false)
    clickLayer.classList.remove('dshp-agent-gif-on')
    var token = click.token
    clearClickTimers()
    click.cleanupTimer = setTimeout(function () {
      click.cleanupTimer = null
      if (click.active || click.pending || token !== click.token) return
      click.asset = null
      click.startedAt = 0
      click.cycleEndsAt = 0
      click.currentCycle = 0
      clickLayer.removeAttribute('src')
    }, FADE_MS + 80)
  }

  function notifyClick() {
    if (!config.enabled || !config.clickEnabled) return
    var clickedAt = now()
    click.lastClickAt = clickedAt
    if (click.active || click.pending) {
      click.continuationRequested = true
      return
    }

    if (click.asset) {
      click.continuationRequested = false
      startClickAsset(click.asset, true)
      return
    }

    click.pending = true
    click.continuationRequested = false
    var token = ++click.token
    window.pet.getAgentAssets(config.agent, 'click').then(function (result) {
      if (token !== click.token || !config.enabled || !config.clickEnabled) return
      var asset = chooseAsset(result && result.assets)
      if (!asset) {
        click.pending = false
        return
      }
      startClickAsset(asset, false)
    }).catch(function () {
      if (token === click.token) click.pending = false
    })
  }

  function setDragging(active) {
    active = !!active
    if (draggingActive === active) return
    draggingActive = active
    applyEffectiveState({ force: true })
  }

  function setLowBalance(active) {
    active = !!active
    if (lowBalanceActive === active) return
    lowBalanceActive = active
    applyEffectiveState({ force: true })
  }

  function pulseBalanceIncrease() {
    clearBalanceIncrease()
    balanceIncreaseUntil = now() + 4000
    applyEffectiveState({ force: true })
    balanceIncreaseTimer = setTimeout(function () {
      balanceIncreaseTimer = null
      balanceIncreaseUntil = 0
      applyEffectiveState({ force: true })
    }, 4000)
  }

  function setHover(active) {
    active = !!active
    if (!config.enabled) {
      hoverActive = false
      return
    }
    if (active === hoverActive) return

    hoverActive = active
    if (active) {
      lastNonHoverState = baseState
      applyEffectiveState({ force: true })
      return
    }
    applyEffectiveState({ force: true })
  }

  configure({
    agentAnimationEnabled: false,
    agentType: 'codex',
    agentClickAnimation: true,
  })

  if (window.pet && window.pet.onAgentState) {
    window.pet.onAgentState(function (event) {
      if (!event || normalizeAgent(event.agent) !== config.agent) return
      setBaseState(event.state, {
        force: !!event.force,
        eventId: event.eventId || '',
      })
    })
  }

  window.__dshpAgentAnimation = {
    configure: configure,
    setState: function (state) { setBaseState(state, { force: true, manual: true }) },
    setHover: setHover,
    setDragging: setDragging,
    setLowBalance: setLowBalance,
    pulseBalanceIncrease: pulseBalanceIncrease,
    click: notifyClick,
    stop: stopAll,
    status: function () {
      return {
        enabled: config.enabled,
        agent: config.agent,
        state: currentState,
        desiredState: desiredState,
        baseState: baseState,
        draggingActive: draggingActive,
        lowBalanceActive: lowBalanceActive,
        balanceIncreaseActive: balanceIncreaseUntil > now(),
        layer: currentLayer,
        asset: currentAsset ? currentAsset.name : '',
        assetDurationMs: currentAsset ? assetDuration(currentAsset) : 0,
        assetCount: currentAssets.length,
        stateLoadCount: stateLoadCount,
        dwellPendingState: dwellPendingState,
        clickActive: click.active,
        clickPending: click.pending,
        clickAsset: click.asset ? click.asset.name : '',
        clickDurationMs: click.asset ? assetDuration(click.asset) : 0,
        clickStartedAt: click.startedAt,
        clickEndsAt: click.cycleEndsAt,
        clickCycles: click.currentCycle,
        clickContinuationRequested: click.continuationRequested,
        clickSessionCount: clickSessionCount,
        hoverActive: hoverActive,
        lastNonHoverState: lastNonHoverState,
      }
    },
  }
})()
