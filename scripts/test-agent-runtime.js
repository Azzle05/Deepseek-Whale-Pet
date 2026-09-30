'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const os = require('node:os')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const mainPath = path.join(projectRoot, 'main.js')
const settingsHtmlPath = path.join(projectRoot, 'renderer', 'settings.html')

function createTempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-whale-pet-' + name + '-'))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadMainForTest(userDataPath, homes) {
  const originalSource = fs.readFileSync(mainPath, 'utf8')
  assert.match(
    originalSource,
    /function agentIdleToSleepMs\(\)/,
    'production sleep delay should be configurable',
  )
  const source = originalSource.replace(
    /function agentIdleToSleepMs\(\) \{[\s\S]*?\n\}/,
    'function agentIdleToSleepMs() { return 45 }',
  ) + `
module.exports.__agentRuntimeTest = {
  setConfig(patch) {
    cfg = saveConfig(patch)
    return { ...cfg }
  },
  getConfig() {
    return { ...cfg }
  },
  queueAgentEvent,
  updateAgentWatcher,
  clearAgentIdleToSleepTimer,
  getLatestEvent() {
    return latestAgentEvent ? { ...latestAgentEvent } : null
  },
  getIdleTimerState() {
    return {
      active: !!agentIdleToSleepTimer,
      agent: agentIdleToSleepAgent,
    }
  },
  codexHookInstallStatus,
  claudeHookInstallStatus,
  harnessHookInstallStatus,
  syncCodexHookInstallation,
  syncClaudeHookInstallation,
  syncHarnessHookInstallation,
  stopCodexHookWatcher,
  stopClaudeHookWatcher,
  stopHarnessHookWatcher,
  clearCodexDoneIdleTimer,
  clearClaudeDoneIdleTimer,
  clearHarnessDoneIdleTimer,
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
    getAppPath() {
      return projectRoot
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
  const originalEnv = {
    CODEX_HOME: process.env.CODEX_HOME,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    DSH_HOME: process.env.DSH_HOME,
  }
  process.env.CODEX_HOME = homes.codex
  process.env.CLAUDE_CONFIG_DIR = homes.claude
  process.env.DSH_HOME = homes.harness
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
      api: testModule.exports.__agentRuntimeTest,
      handlers,
      restore() {
        for (const [key, value] of Object.entries(originalEnv)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
        Module._load = originalLoad
      },
    }
  } catch (err) {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    Module._load = originalLoad
    throw err
  }
}

async function testSleepStateMachine(api) {
  api.setConfig({
    agentAnimationEnabled: true,
    agentType: 'codex',
  })
  api.queueAgentEvent('codex', 'idle', {
    source: 'runtime-test',
    event: 'idle',
  })
  assert.equal(api.getIdleTimerState().active, true, 'idle should start the sleep timer')
  await wait(100)
  assert.equal(api.getLatestEvent().state, 'sleep', 'idle should enter sleep after the timeout')
  assert.equal(api.getLatestEvent().event, 'idle-to-sleep', 'sleep should keep its diagnostic event name')

  api.queueAgentEvent('codex', 'idle', {
    source: 'runtime-test',
    event: 'idle',
  })
  await wait(12)
  api.queueAgentEvent('codex', 'think', {
    source: 'runtime-test',
    event: 'work-resumed',
  })
  assert.equal(api.getIdleTimerState().active, false, 'new work should cancel the sleep timer')
  await wait(80)
  assert.equal(api.getLatestEvent().state, 'think', 'new work should prevent the delayed sleep event')

  api.queueAgentEvent('codex', 'idle', {
    source: 'runtime-test',
    event: 'idle',
  })
  api.setConfig({ agentAnimationEnabled: false })
  api.updateAgentWatcher()
  assert.equal(api.getIdleTimerState().active, false, 'disabling animation should cancel the sleep timer')
  await wait(80)
  assert.equal(api.getLatestEvent().state, 'idle', 'disabled animation should not emit sleep later')
}

function testIndependentInstallations(api, homes) {
  fs.mkdirSync(homes.codex, { recursive: true })
  fs.mkdirSync(homes.claude, { recursive: true })
  fs.mkdirSync(path.join(homes.harness, 'profiles', 'web'), { recursive: true })
  fs.writeFileSync(path.join(homes.codex, 'config.toml'), 'model = "test"\n', 'utf8')
  fs.writeFileSync(path.join(homes.codex, 'hooks.json'), '{"hooks":{}}\n', 'utf8')
  fs.writeFileSync(path.join(homes.claude, 'settings.json'), '{}\n', 'utf8')
  fs.writeFileSync(path.join(homes.harness, 'profiles', 'web', 'cordis.patch.yml'), '[]\n', 'utf8')

  api.setConfig({
    agentAnimationEnabled: true,
    agentType: 'codex',
    codexHookEnabled: true,
    claudeHookEnabled: true,
    harnessHookEnabled: true,
  })
  api.syncCodexHookInstallation()
  api.syncClaudeHookInstallation()
  api.syncHarnessHookInstallation()
  assert.equal(api.codexHookInstallStatus().installed, true, 'Codex should install independently')
  assert.equal(api.claudeHookInstallStatus().installed, true, 'Claude Code should install independently')
  assert.equal(api.harnessHookInstallStatus().installed, true, 'Harness should install independently')

  api.setConfig({ agentType: 'claudecode' })
  api.syncCodexHookInstallation()
  api.syncClaudeHookInstallation()
  api.syncHarnessHookInstallation()
  assert.equal(api.codexHookInstallStatus().installed, true, 'switching the displayed agent should keep Codex installed')
  assert.equal(api.claudeHookInstallStatus().installed, true, 'switching the displayed agent should keep Claude installed')
  assert.equal(api.harnessHookInstallStatus().installed, true, 'switching the displayed agent should keep Harness installed')

  api.setConfig({
    codexHookEnabled: false,
    claudeHookEnabled: false,
    harnessHookEnabled: false,
  })
  api.syncCodexHookInstallation()
  api.syncClaudeHookInstallation()
  api.syncHarnessHookInstallation()
  assert.equal(api.codexHookInstallStatus().installedEvents, 0, 'Codex should uninstall when its own switch is off')
  assert.equal(api.claudeHookInstallStatus().installedEvents, 0, 'Claude should uninstall when its own switch is off')
  assert.equal(api.harnessHookInstallStatus().installedEvents, 0, 'Harness should uninstall when its own switch is off')
}

function testSettingsSurface() {
  const html = fs.readFileSync(settingsHtmlPath, 'utf8')
  const requiredIds = [
    'codexHookWrap',
    'codexHookInput',
    'codexDetectedText',
    'codexHookInstallBtn',
    'codexHookUninstallBtn',
    'codexTutorialBtn',
    'codexTutorialPanel',
    'claudeHookWrap',
    'claudeHookInput',
    'claudeDetectedText',
    'claudeHookInstallBtn',
    'claudeHookUninstallBtn',
    'claudeTutorialBtn',
    'claudeTutorialPanel',
    'harnessHookWrap',
    'harnessHookInput',
    'harnessDetectedText',
    'harnessHookInstallBtn',
    'harnessHookUninstallBtn',
    'harnessTutorialBtn',
    'harnessTutorialPanel',
    'sleepMinutesInput',
    'updateCheckBtn',
    'updateDownloadBtn',
    'updateInstallBtn',
    'updateReleaseBtn',
  ]
  for (const id of requiredIds) {
    assert.match(html, new RegExp('id="' + id + '"'), 'settings page should include #' + id)
  }
  assert.equal((html.match(/class="agent-panel"/g) || []).length, 3, 'settings page should show three Agent panels')
  for (const label of ['Codex 首次配置', 'Claude Code 首次配置', 'Harness 首次配置']) {
    assert.match(html, new RegExp(label), 'settings page should include ' + label)
  }
  assert.match(html, /空闲达到上方分钟数后进入睡眠/, 'settings page should explain the configurable sleep delay')
  assert.match(html, /data-agent-state="low_balance"/, 'settings page should expose low balance GIF testing')
  assert.match(html, /data-agent-state="balance_increase"/, 'settings page should expose balance increase GIF testing')
  assert.match(html, /data-agent-state="dragging"/, 'settings page should expose dragging GIF testing')
}

async function main() {
  const root = createTempRoot('agent-runtime')
  const homes = {
    codex: path.join(root, 'codex-home'),
    claude: path.join(root, 'claude-home'),
    harness: path.join(root, 'dsh-home'),
  }
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(userData, { recursive: true })

  const loaded = loadMainForTest(userData, homes)
  try {
    await testSleepStateMachine(loaded.api)
    testIndependentInstallations(loaded.api, homes)
    testSettingsSurface()
  } finally {
    loaded.api.clearAgentIdleToSleepTimer()
    loaded.api.stopCodexHookWatcher()
    loaded.api.stopClaudeHookWatcher()
    loaded.api.stopHarnessHookWatcher()
    loaded.api.clearCodexDoneIdleTimer()
    loaded.api.clearClaudeDoneIdleTimer()
    loaded.api.clearHarnessDoneIdleTimer()
    loaded.restore()
    fs.rmSync(root, { recursive: true, force: true })
  }
  console.log('agent runtime smoke: ok')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
