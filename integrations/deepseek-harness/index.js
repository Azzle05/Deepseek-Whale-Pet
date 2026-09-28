import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'whale-pet-harness-bridge'
export const inject = []

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const configPath = process.env.DSH_WHALE_PET_BRIDGE_CONFIG
  ? path.resolve(process.env.DSH_WHALE_PET_BRIDGE_CONFIG)
  : path.join(moduleDir, 'bridge-config.json')
const defaultConfig = {
  outputPath: '../../harness-agent-events.jsonl',
  flushIntervalMs: 80,
  heartbeatMs: 30000,
  maxFileBytes: 2 * 1024 * 1024,
}

function readConfig() {
  let config = {}
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    config = {}
  }
  const outputValue = process.env.DSH_WHALE_PET_EVENT_PATH || config.outputPath || defaultConfig.outputPath
  const outputPath = path.isAbsolute(outputValue)
    ? outputValue
    : path.resolve(moduleDir, outputValue)
  return {
    outputPath,
    flushIntervalMs: clampNumber(config.flushIntervalMs, 20, 1000, defaultConfig.flushIntervalMs),
    heartbeatMs: clampNumber(config.heartbeatMs, 1000, 5 * 60 * 1000, defaultConfig.heartbeatMs),
    maxFileBytes: clampNumber(config.maxFileBytes, 64 * 1024, 64 * 1024 * 1024, defaultConfig.maxFileBytes),
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function safeLabel(value, maxLength = 120) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function sessionId(session) {
  return safeLabel(session && session.id ? session.id : '', 160)
}

function stateForEvent(type, data) {
  const eventData = data && typeof data === 'object' ? data : {}
  switch (type) {
    case 'turn/start':
    case 'user/message':
    case 'step/start':
      return 'think'
    case 'assistant/chunk': {
      const chunkType = eventData.chunk && eventData.chunk.type
      if (chunkType === 'reasoning-delta') return 'think'
      if (chunkType === 'text-delta') return 'reply'
      if (chunkType === 'tool-call-delta') return 'tool'
      return ''
    }
    case 'assistant/message':
      return 'reply'
    case 'tool/call':
    case 'tool/code-dispatch-start':
    case 'tool/code-dispatch':
    case 'command/run':
    case 'step/end':
      return 'tool'
    case 'tool/result': {
      const message = eventData.message && typeof eventData.message === 'object' ? eventData.message : {}
      return eventData.error || message.isError || message.error ? 'error' : 'run'
    }
    case 'approval/asked':
      return 'approval'
    case 'approval/decided':
      return 'run'
    case 'command/done':
      return eventData.kind === 'error' ? 'error' : 'run'
    case 'turn/end': {
      const kind = eventData.reason && eventData.reason.kind ? eventData.reason.kind : 'completed'
      if (kind === 'completed') return 'done'
      if (kind === 'aborted' || kind === 'interrupted') return 'interrupted'
      if (kind === 'blocked') return 'wait'
      return 'error'
    }
    default:
      return ''
  }
}

function detailForEvent(type, data) {
  const eventData = data && typeof data === 'object' ? data : {}
  if (type === 'tool/call') return safeLabel(eventData.name, 80)
  if (type === 'command/run') return safeLabel(eventData.name, 80)
  if (type === 'approval/asked') return safeLabel(eventData.toolName, 80)
  return ''
}

function reasonForEvent(type, data) {
  if (type !== 'turn/end') return ''
  const eventData = data && typeof data === 'object' ? data : {}
  return safeLabel(eventData.reason && eventData.reason.kind, 40)
}

function turnForEvent(data) {
  const turn = Number(data && data.turn)
  return Number.isSafeInteger(turn) && turn > 0 ? turn : null
}

function stepForEvent(data) {
  const step = Number(data && data.step)
  return Number.isSafeInteger(step) && step >= 0 ? step : null
}

export function apply(ctx) {
  const config = readConfig()
  const recentWrites = new Map()
  let queue = []
  let flushTimer = null
  let disposed = false

  function rotateIfNeeded() {
    try {
      const stat = fs.statSync(config.outputPath)
      if (stat.size < config.maxFileBytes) return
      const rotatedPath = config.outputPath + '.1'
      fs.rmSync(rotatedPath, { force: true })
      fs.renameSync(config.outputPath, rotatedPath)
    } catch (error) {
      if (error && error.code !== 'ENOENT') throw error
    }
  }

  function flush() {
    flushTimer = null
    if (!queue.length) return
    const batch = queue
    queue = []
    try {
      fs.mkdirSync(path.dirname(config.outputPath), { recursive: true })
      rotateIfNeeded()
      fs.appendFileSync(config.outputPath, batch.join(''), 'utf8')
    } catch {
      // Status capture must never interfere with the running Harness process.
    }
  }

  function enqueue(record) {
    if (disposed) return
    queue.push(JSON.stringify(record) + os.EOL)
    if (queue.length >= 200) {
      if (flushTimer) clearTimeout(flushTimer)
      flush()
      return
    }
    if (!flushTimer) flushTimer = setTimeout(flush, config.flushIntervalMs)
  }

  function shouldWrite(key, now) {
    const previous = recentWrites.get(key) || 0
    if (previous && now - previous < config.heartbeatMs) return false
    recentWrites.set(key, now)
    if (recentWrites.size > 2000) {
      const cutoff = now - Math.max(config.heartbeatMs * 4, 5 * 60 * 1000)
      for (const [entryKey, timestamp] of recentWrites) {
        if (timestamp < cutoff) recentWrites.delete(entryKey)
      }
    }
    return true
  }

  function writeState(session, event, state, options = {}) {
    if (!state) return
    const now = Number.isFinite(Number(options.time)) && Number(options.time) > 0
      ? Number(options.time)
      : Date.now()
    const sid = sessionId(session)
    const turn = turnForEvent(options.data)
    const step = stepForEvent(options.data)
    const eventType = safeLabel(options.eventType || '', 80)
    const key = [sid, turn, step, eventType, state, safeLabel(options.detail || '', 80)].join('|')
    if (!shouldWrite(key, now)) return
    enqueue({
      at: now,
      seq: Number.isSafeInteger(Number(options.seq)) ? Number(options.seq) : null,
      session: sid,
      agent: 'harness',
      event: eventType,
      state,
      turn,
      step,
      tool: safeLabel(options.detail || '', 80) || null,
      reason: reasonForEvent(eventType, options.data) || null,
    })
  }

  ctx.on('session/event', (session, event) => {
    if (!event || typeof event.type !== 'string') return
    const data = event.data && typeof event.data === 'object' ? event.data : {}
    writeState(session, event, stateForEvent(event.type, data), {
      eventType: event.type,
      data,
      seq: event.seq,
      time: event.time,
      detail: detailForEvent(event.type, data),
    })
  }, { global: true })

  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'running') return
    const session = agent && agent.session ? agent.session : null
    writeState(session, null, 'think', {
      eventType: 'agent/status',
      seq: null,
      time: Date.now(),
      data: {},
    })
  }, { global: true })

  ctx.on('agent/disposed', ({ agent }) => {
    const session = agent && agent.session ? agent.session : null
    writeState(session, null, 'idle', {
      eventType: 'agent/disposed',
      seq: null,
      time: Date.now(),
      data: {},
    })
  }, { global: true })

  ctx.on('dispose', () => {
    disposed = true
    if (flushTimer) clearTimeout(flushTimer)
    flush()
  })
}
