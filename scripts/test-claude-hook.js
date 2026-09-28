'use strict'

const assert = require('node:assert/strict')
const childProcess = require('node:child_process')
const fs = require('node:fs')
const Module = require('node:module')
const os = require('node:os')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const mainPath = path.join(projectRoot, 'main.js')

function createTempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-whale-pet-' + name + '-'))
}

function loadMainForTest(userDataPath, claudeHomePath) {
  const source = fs.readFileSync(mainPath, 'utf8') + `
module.exports.__claudeHookTest = {
  claudeHookEventMapping,
  claudeHookInstallStatus,
  installClaudeHook,
  syncClaudeHookInstallation,
  uninstallClaudeHook,
  stopClaudeHookWatcher,
  clearClaudeDoneIdleTimer,
  enableClaudeHookForTest() {
    cfg = saveConfig({ agentAnimationEnabled: true, agentType: 'claudecode', claudeHookEnabled: true })
  },
}
`
  const listeners = new Map()
  const handlers = new Map()
  const app = {
    commandLine: { appendSwitch() {} },
    getPath(name) {
      if (name === 'userData') return userDataPath
      if (name === 'temp') return os.tmpdir()
      return userDataPath
    },
    on(event, callback) {
      listeners.set(event, callback)
    },
    quit() {},
    requestSingleInstanceLock() {
      return true
    },
    setLoginItemSettings() {},
    setAppUserModelId() {},
    whenReady() {
      return new Promise(() => {})
    },
  }
  const electron = {
    app,
    BrowserWindow: class {},
    Menu: { buildFromTemplate: () => ({}) },
    Notification: class {},
    Tray: class {},
    dialog: {},
    globalShortcut: {
      register: () => true,
      unregisterAll() {},
    },
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      },
      on() {},
    },
    nativeImage: {
      createFromPath: () => ({}),
    },
    screen: {
      getPrimaryDisplay: () => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      }),
    },
  }

  const originalLoad = Module._load
  const originalClaudeHome = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = claudeHomePath
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') return electron
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    const testModule = new Module(mainPath, module)
    testModule.filename = mainPath
    testModule.paths = Module._nodeModulePaths(projectRoot)
    testModule._compile(source, mainPath)
    return {
      api: testModule.exports.__claudeHookTest,
      handlers,
      restore() {
        if (originalClaudeHome === undefined) delete process.env.CLAUDE_CONFIG_DIR
        else process.env.CLAUDE_CONFIG_DIR = originalClaudeHome
        Module._load = originalLoad
      },
    }
  } catch (err) {
    if (originalClaudeHome === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalClaudeHome
    Module._load = originalLoad
    throw err
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function countWhaleGroups(root) {
  const hooks = root && root.hooks && typeof root.hooks === 'object' ? root.hooks : {}
  let count = 0
  for (const groups of Object.values(hooks)) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      if (JSON.stringify(group).includes('deepseek-whale-pet-claude-hook.ps1')) count++
    }
  }
  return count
}

const root = createTempRoot('claude-hook')
const claudeHome = path.join(root, 'claude-home')
const userData = path.join(root, 'user-data')
fs.mkdirSync(claudeHome, { recursive: true })
fs.mkdirSync(userData, { recursive: true })

const settingsPath = path.join(claudeHome, 'settings.json')
const initialSettings = {
  env: {
    ANTHROPIC_AUTH_TOKEN: 'test-token',
    ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  },
  includeCoAuthoredBy: false,
  hooks: {
    Stop: [
      {
        hooks: [{ type: 'command', command: 'echo user-claude-hook' }],
      },
    ],
  },
}
fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2) + '\n', 'utf8')

const loaded = loadMainForTest(userData, claudeHome)
try {
  const firstInstall = loaded.api.installClaudeHook()
  assert.equal(firstInstall.ok, true, 'install should succeed')
  assert.equal(firstInstall.installed, true, 'install should report connected')
  assert.equal(countWhaleGroups(readJson(settingsPath)), 12, 'should install exactly twelve hook groups')
  assert.equal(
    Array.isArray(readJson(settingsPath).hooks.PostToolUseFailure),
    true,
    'tool failure should have its own hook event',
  )

  const mappings = [
    ['SessionStart', 'link'],
    ['UserPromptSubmit', 'think'],
    ['PreToolUse', 'tool'],
    ['PostToolUse', 'run'],
    ['PostToolUseFailure', 'error'],
    ['PermissionRequest', 'approval'],
    ['PreCompact', 'wait'],
    ['SubagentStart', 'tool'],
    ['SubagentStop', 'run'],
    ['Stop', 'done'],
    ['SessionEnd', 'idle'],
  ]
  for (const [event, state] of mappings) {
    assert.equal(
      loaded.api.claudeHookEventMapping({ hook_event_name: event }).state,
      state,
      event + ' should map to ' + state,
    )
  }
  assert.equal(
    loaded.api.claudeHookEventMapping({ hook_event_name: 'Notification', message: 'Permission required' }).state,
    'approval',
    'permission notification should map to approval',
  )
  assert.equal(
    loaded.api.claudeHookEventMapping({ hook_event_name: 'Notification', message: 'Waiting for input' }).state,
    'wait',
    'general notification should map to wait',
  )

  if (process.platform === 'win32') {
    const scriptPath = path.join(userData, 'deepseek-whale-pet-claude-hook.ps1')
    fs.writeFileSync(scriptPath, 'legacy hook script', 'utf8')
    loaded.api.enableClaudeHookForTest()
    loaded.api.syncClaudeHookInstallation()
    const scriptBytes = fs.readFileSync(scriptPath)
    assert.deepEqual([...scriptBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'hook script should be UTF-8 with BOM')
    assert.match(fs.readFileSync(scriptPath, 'utf8'), /payloadBase64/, 'sync should refresh an existing hook script')

    const hookPayload = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-session',
      transcript_path: 'C:\\Users\\test\\.claude\\projects\\session.jsonl',
      prompt: '中文事件测试\r\n包含换行、引号 " 和反斜杠 \\，以及反引号 `。',
    }
    const hookRun = childProcess.spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { input: JSON.stringify(hookPayload), encoding: 'utf8' },
    )
    assert.equal(hookRun.status, 0, 'hook script should execute successfully')
    const eventLines = fs.readFileSync(path.join(userData, 'claude-agent-events.jsonl'), 'utf8').trim().split(/\r?\n/)
    const eventRecord = JSON.parse(eventLines[eventLines.length - 1])
    assert.equal(typeof eventRecord.payloadBase64, 'string', 'hook script should store payload as base64')
    const decodedPayload = JSON.parse(Buffer.from(eventRecord.payloadBase64, 'base64').toString('utf8'))
    assert.equal(decodedPayload.hook_event_name, 'UserPromptSubmit', 'hook script should log the incoming event')
    assert.equal(decodedPayload.prompt, hookPayload.prompt, 'hook script should preserve multiline text exactly')
  }

  loaded.api.enableClaudeHookForTest()
  loaded.handlers.get('pet:save-settings')(null, { displayMode: 'all' })
  const savedConfig = loaded.handlers.get('pet:get-full-config')()
  assert.equal(savedConfig.agentType, 'claudecode', 'partial settings saves should preserve the selected agent')

  const secondInstall = loaded.api.installClaudeHook()
  assert.equal(secondInstall.ok, true, 'repeat install should succeed')
  assert.equal(countWhaleGroups(readJson(settingsPath)), 12, 'repeat install should not duplicate hooks')

  const uninstall = loaded.api.uninstallClaudeHook()
  assert.equal(uninstall.ok, true, 'uninstall should succeed')
  assert.equal(countWhaleGroups(readJson(settingsPath)), 0, 'uninstall should remove only whale hooks')

  const finalSettings = readJson(settingsPath)
  assert.equal(finalSettings.env.ANTHROPIC_AUTH_TOKEN, 'test-token', 'uninstall should preserve env')
  assert.equal(finalSettings.env.ANTHROPIC_BASE_URL, 'https://api.deepseek.com/anthropic', 'uninstall should preserve env URL')
  assert.equal(finalSettings.includeCoAuthoredBy, false, 'uninstall should preserve unrelated settings')
  assert.equal(finalSettings.hooks.Stop.length, 1, 'existing user hook should be preserved')
  assert.equal(finalSettings.hooks.Stop[0].hooks[0].command, 'echo user-claude-hook', 'existing user hook should remain unchanged')
  assert.equal(
    fs.existsSync(settingsPath + '.deepseek-whale-pet.bak'),
    true,
    'settings backup should exist',
  )
} finally {
  loaded.api.stopClaudeHookWatcher()
  loaded.api.clearClaudeDoneIdleTimer()
  loaded.restore()
  fs.rmSync(root, { recursive: true, force: true })
}

console.log('claude hook smoke: ok')
