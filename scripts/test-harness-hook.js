'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const projectRoot = path.resolve(__dirname, '..')
const mainPath = path.join(projectRoot, 'main.js')
const pluginPath = path.join(projectRoot, 'integrations', 'deepseek-harness', 'index.js')

function createTempRoot(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'deepseek-whale-pet-' + name + '-'))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function testBridgePlugin() {
  const root = createTempRoot('harness-plugin')
  const eventPath = path.join(root, 'harness-agent-events.jsonl')
  const originalEventPath = process.env.DSH_WHALE_PET_EVENT_PATH
  process.env.DSH_WHALE_PET_EVENT_PATH = eventPath
  try {
    const plugin = await import(pathToFileURL(pluginPath).href + '?test=' + Date.now())
    const listeners = new Map()
    const ctx = {
      on(name, callback) {
        const current = listeners.get(name) || []
        current.push(callback)
        listeners.set(name, current)
      },
    }
    plugin.apply(ctx)

    function emit(name, ...args) {
      for (const callback of listeners.get(name) || []) callback(...args)
    }

    const session = { id: 'harness-test-session' }
    emit('session/event', session, {
      type: 'turn/start',
      seq: 1,
      time: 1000,
      data: { turn: 1, step: 0, prompt: 'SECRET_PROMPT' },
    })
    emit('session/event', session, {
      type: 'assistant/chunk',
      seq: 2,
      time: 1001,
      data: { turn: 1, step: 1, chunk: { type: 'reasoning-delta', text: 'SECRET_REASONING' } },
    })
    emit('session/event', session, {
      type: 'tool/call',
      seq: 3,
      time: 1002,
      data: { turn: 1, step: 2, name: 'read_file', arguments: 'SECRET_TOOL_ARGUMENT' },
    })
    emit('session/event', session, {
      type: 'tool/result',
      seq: 4,
      time: 1003,
      data: { turn: 1, step: 2, message: { isError: false }, result: 'SECRET_TOOL_OUTPUT' },
    })
    emit('session/event', session, {
      type: 'approval/asked',
      seq: 5,
      time: 1004,
      data: { turn: 1, step: 3, toolName: 'write_file' },
    })
    emit('session/event', session, {
      type: 'turn/end',
      seq: 6,
      time: 1005,
      data: { turn: 1, step: 3, reason: { kind: 'completed' } },
    })

    await wait(250)
    const lines = fs.readFileSync(eventPath, 'utf8').trim().split(/\r?\n/)
    const records = lines.map((line) => JSON.parse(line))
    assert.deepEqual(
      records.map((record) => record.state),
      ['think', 'think', 'tool', 'run', 'approval', 'done'],
      'Harness events should map to the expected pet states',
    )
    assert.equal(records[0].agent, 'harness', 'records should be marked as Harness events')
    assert.equal(records[2].tool, 'read_file', 'tool name should be retained for status display')
    assert.equal(records[5].reason, 'completed', 'turn-end reason should be retained')

    const serialized = JSON.stringify(records)
    for (const secret of [
      'SECRET_PROMPT',
      'SECRET_REASONING',
      'SECRET_TOOL_ARGUMENT',
      'SECRET_TOOL_OUTPUT',
    ]) {
      assert.equal(serialized.includes(secret), false, 'privacy-sensitive content must not be written')
    }
  } finally {
    if (originalEventPath === undefined) delete process.env.DSH_WHALE_PET_EVENT_PATH
    else process.env.DSH_WHALE_PET_EVENT_PATH = originalEventPath
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function loadMainForTest(userDataPath, dshHomePath) {
  const source = fs.readFileSync(mainPath, 'utf8') + `
module.exports.__harnessHookTest = {
  harnessHookEventMapping,
  harnessHookInstallStatus,
  installHarnessHook,
  syncHarnessHookInstallation,
  uninstallHarnessHook,
  stopHarnessHookWatcher,
  clearHarnessDoneIdleTimer,
  enableHarnessHookForTest() {
    cfg = saveConfig({ agentAnimationEnabled: true, agentType: 'harness', harnessHookEnabled: true })
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
  const originalDshHome = process.env.DSH_HOME
  process.env.DSH_HOME = dshHomePath
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
      api: testModule.exports.__harnessHookTest,
      handlers,
      restore() {
        if (originalDshHome === undefined) delete process.env.DSH_HOME
        else process.env.DSH_HOME = originalDshHome
        Module._load = originalLoad
      },
    }
  } catch (err) {
    if (originalDshHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = originalDshHome
    Module._load = originalLoad
    throw err
  }
}

function testMainIntegration() {
  const root = createTempRoot('harness-main')
  const dshHome = path.join(root, 'dsh-home')
  const userData = path.join(root, 'user-data')
  const profilePath = path.join(dshHome, 'profiles', 'web')
  const patchPath = path.join(profilePath, 'cordis.patch.yml')
  const linkPath = path.join(profilePath, 'node_modules', 'dsh-whale-pet-harness-bridge')
  const pluginInstallPath = path.join(userData, 'integrations', 'deepseek-harness')
  fs.mkdirSync(profilePath, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(
    patchPath,
    [
      '- insert:',
      '    - id: user-plugin',
      '      name: user-plugin',
      '',
    ].join('\r\n'),
    'utf8',
  )

  const loaded = loadMainForTest(userData, dshHome)
  try {
    const firstInstall = loaded.api.installHarnessHook()
    assert.equal(firstInstall.ok, true, 'Harness install should succeed')
    assert.equal(firstInstall.installed, true, 'Harness install should report connected')

    const installedPatch = fs.readFileSync(patchPath, 'utf8')
    assert.match(installedPatch, /user-plugin/, 'existing patch entries should be preserved')
    assert.equal(
      (installedPatch.match(/BEGIN DeepSeek Whale Pet Harness bridge/g) || []).length,
      1,
      'Harness patch block should be present exactly once',
    )
    assert.equal(
      fs.existsSync(path.join(pluginInstallPath, 'index.js')),
      true,
      'bridge plugin files should be installed',
    )
    assert.equal(
      path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath)).toLowerCase(),
      path.resolve(pluginInstallPath).toLowerCase(),
      'DSH profile junction should target the installed bridge plugin',
    )

    const secondInstall = loaded.api.installHarnessHook()
    assert.equal(secondInstall.ok, true, 'repeat Harness install should succeed')
    assert.equal(
      (fs.readFileSync(patchPath, 'utf8').match(/BEGIN DeepSeek Whale Pet Harness bridge/g) || []).length,
      1,
      'repeat install should not duplicate the Harness patch block',
    )

    const status = loaded.api.harnessHookInstallStatus()
    assert.equal(status.installedEvents, 1, 'Harness status should report one bridge entry')
    assert.equal(status.totalEvents, 1, 'Harness status should report one expected bridge entry')

    assert.deepEqual(
      loaded.api.harnessHookEventMapping({
        agent: 'harness',
        state: 'think',
        event: 'turn/start',
        session: 's1',
        seq: 1,
        at: 1000,
      }),
      {
        state: 'think',
        event: 'turn/start',
        detail: '',
        session: 's1',
        seq: 1,
        at: 1000,
      },
      'Harness bridge records should map into the pet event pipeline',
    )

    const uninstall = loaded.api.uninstallHarnessHook()
    assert.equal(uninstall.ok, true, 'Harness uninstall should succeed')
    assert.equal(uninstall.installed, false, 'Harness uninstall should report disconnected')
    const finalPatch = fs.readFileSync(patchPath, 'utf8')
    assert.match(finalPatch, /user-plugin/, 'uninstall should preserve user patch entries')
    assert.equal(finalPatch.includes('BEGIN DeepSeek Whale Pet Harness bridge'), false, 'uninstall should remove the Harness block')
    assert.equal(fs.existsSync(linkPath), false, 'uninstall should remove the DSH profile junction')
  } finally {
    loaded.api.stopHarnessHookWatcher()
    loaded.api.clearHarnessDoneIdleTimer()
    loaded.restore()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function main() {
  await testBridgePlugin()
  testMainIntegration()
  console.log('harness hook smoke: ok')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
