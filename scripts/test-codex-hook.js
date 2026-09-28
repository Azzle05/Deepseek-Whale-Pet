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

function loadMainForTest(userDataPath, codexHomePath) {
  const source = fs.readFileSync(mainPath, 'utf8') + `
module.exports.__codexHookTest = {
  codexHookEventMapping,
  codexHookInstallStatus,
  installCodexHook,
  syncCodexHookInstallation,
  uninstallCodexHook,
  stopCodexHookWatcher,
  stopCodexSessionWatcher,
  clearCodexDoneIdleTimer,
  enableCodexHookForTest() {
    cfg = saveConfig({ agentAnimationEnabled: true, agentType: 'codex', codexHookEnabled: true })
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
      getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    },
  }

  const originalLoad = Module._load
  const originalCodexHome = process.env.CODEX_HOME
  process.env.CODEX_HOME = codexHomePath
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
      api: testModule.exports.__codexHookTest,
      handlers,
      restore() {
        if (originalCodexHome === undefined) delete process.env.CODEX_HOME
        else process.env.CODEX_HOME = originalCodexHome
        Module._load = originalLoad
      },
    }
  } catch (err) {
    if (originalCodexHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = originalCodexHome
    Module._load = originalLoad
    throw err
  }
}

function countWhaleGroups(root) {
  const events = root && root.hooks && typeof root.hooks === 'object' ? root.hooks : {}
  let count = 0
  for (const groups of Object.values(events)) {
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      if (JSON.stringify(group).includes('deepseek-whale-pet-codex-hook.ps1')) count++
    }
  }
  return count
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runScenario(name, initialConfig, initialHooks) {
  const root = createTempRoot(name)
  const codexHome = path.join(root, 'codex-home')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(codexHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  const configPath = path.join(codexHome, 'config.toml')
  const hooksPath = path.join(codexHome, 'hooks.json')
  fs.writeFileSync(configPath, initialConfig, 'utf8')
  fs.writeFileSync(hooksPath, JSON.stringify(initialHooks, null, 2), 'utf8')

  const loaded = loadMainForTest(userData, codexHome)
  try {
    const firstInstall = loaded.api.installCodexHook()
    assert.equal(firstInstall.ok, true, name + ': install should succeed')
    assert.equal(firstInstall.installed, true, name + ': install should report connected')
    assert.equal(countWhaleGroups(readJson(hooksPath)), 8, name + ': should install exactly eight hook groups')
    assert.equal(
      loaded.api.codexHookEventMapping({ hook_event_name: 'Stop' }).state,
      'done',
      name + ': Stop should map to done before returning to idle',
    )

    if (process.platform === 'win32') {
      const scriptPath = path.join(userData, 'deepseek-whale-pet-codex-hook.ps1')
      fs.writeFileSync(scriptPath, 'legacy hook script', 'utf8')
      loaded.api.enableCodexHookForTest()
      loaded.api.syncCodexHookInstallation()
      const scriptBytes = fs.readFileSync(scriptPath)
      assert.deepEqual([...scriptBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], name + ': hook script should be UTF-8 with BOM')
      assert.match(
        fs.readFileSync(scriptPath, 'utf8'),
        /payloadBase64/,
        name + ': repeat startup should refresh an existing hook script',
      )
      const hookPayload = {
        hook_event_name: 'UserPromptSubmit',
        session_id: 'test-session',
        turn_id: 'test-turn',
        prompt: '中文事件测试\r\n包含换行、引号 " 和反斜杠 \\，以及反引号 `。',
      }
      const hookRun = childProcess.spawnSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { input: JSON.stringify(hookPayload), encoding: 'utf8' },
      )
      assert.equal(hookRun.status, 0, name + ': hook script should execute successfully')
      const eventLines = fs.readFileSync(path.join(userData, 'agent-events.jsonl'), 'utf8').trim().split(/\r?\n/)
      const eventRecord = JSON.parse(eventLines[eventLines.length - 1])
      assert.equal(typeof eventRecord.payloadBase64, 'string', name + ': hook script should store payload as base64')
      const decodedPayload = JSON.parse(Buffer.from(eventRecord.payloadBase64, 'base64').toString('utf8'))
      assert.equal(decodedPayload.hook_event_name, 'UserPromptSubmit', name + ': hook script should log the incoming event')
      assert.equal(decodedPayload.prompt, hookPayload.prompt, name + ': hook script should preserve multiline text exactly')
    }

    const secondInstall = loaded.api.installCodexHook()
    assert.equal(secondInstall.ok, true, name + ': repeat install should succeed')
    assert.equal(countWhaleGroups(readJson(hooksPath)), 8, name + ': repeat install should not duplicate hooks')

    const uninstall = loaded.api.uninstallCodexHook()
    assert.equal(uninstall.ok, true, name + ': uninstall should succeed')
    assert.equal(countWhaleGroups(readJson(hooksPath)), 0, name + ': uninstall should remove only whale hooks')

    return {
      configAfterUninstall: fs.readFileSync(configPath, 'utf8'),
      hooksAfterUninstall: readJson(hooksPath),
      backups: {
        config: fs.existsSync(configPath + '.deepseek-whale-pet.bak'),
        hooks: fs.existsSync(hooksPath + '.deepseek-whale-pet.bak'),
      },
    }
  } finally {
    loaded.api.stopCodexHookWatcher()
    loaded.api.stopCodexSessionWatcher()
    loaded.api.clearCodexDoneIdleTimer()
    loaded.restore()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

const noFeatures = runScenario(
  'no-features',
  'model = "gpt-test"\n',
  {
    hooks: {},
  },
)
assert.equal(noFeatures.backups.config, true, 'config backup should exist')
assert.equal(noFeatures.backups.hooks, true, 'hooks backup should exist')
assert.equal(/\[features\]/.test(noFeatures.configAfterUninstall), false, 'empty app-created features section should be removed')

const userHooks = runScenario(
  'user-hooks',
  'model = "gpt-test"\n',
  {
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'echo user-hook' }] }],
    },
  },
)
assert.equal(userHooks.hooksAfterUninstall.hooks.Stop.length, 1, 'user hook should be preserved')
assert.match(userHooks.configAfterUninstall, /\[features\][\s\S]*hooks = true/, 'hooks should stay enabled while user hooks exist')

const originalHooksEnabled = runScenario(
  'original-hooks-enabled',
  '[features]\nhooks = true\njs_repl = false\n',
  { hooks: {} },
)
assert.match(originalHooksEnabled.configAfterUninstall, /\[features\][\s\S]*hooks = true/, 'original hooks=true should be restored')
assert.match(originalHooksEnabled.configAfterUninstall, /js_repl = false/, 'other feature settings should be preserved')

console.log('codex hook smoke: ok')
