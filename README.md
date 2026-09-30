# DeepSeek 鲸鱼桌宠 / DeepSeek Whale Pet

> 透明置顶的 Windows 桌面小鲸鱼，实时显示 DeepSeek API 余额，也可以切换为系统内存监控。
>
> A transparent, always-on-top Windows whale pet for DeepSeek API balance and system memory monitoring.

![DeepSeek 鲸鱼桌宠 / DeepSeek Whale Pet](./screenshot.png)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43-47848F)](https://www.electronjs.org/)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6)](#)
[![GitHub release](https://img.shields.io/github/v/release/Azzle05/Deepseek-Whale-Pet?display_name=tag&sort=semver)](https://github.com/Azzle05/Deepseek-Whale-Pet/releases/latest)

[GitHub 仓库](https://github.com/Azzle05/Deepseek-Whale-Pet) |
[最新版本](https://github.com/Azzle05/Deepseek-Whale-Pet/releases/latest)

**当前版本 / Current release:** v1.6.3

**维护者 / Maintainer:** Azzle

[中文说明](#中文说明) | [English](#english)

## 中文说明

### 功能

- **实时余额**：定时刷新、点击刷新、滚动数字和余额减少提示。
- **两种余额界面**：鲸鱼气泡，或从桌宠左下方伸出的紧凑横条。
- **系统内存监控**：可切换显示系统内存占用，支持鲸鱼透明填充和气泡数值两种方式。
- **提醒与统计**：低余额提醒、今日消耗记录、API 高峰与空闲时段提示。
- **桌面交互**：拖拽、边缘吸附、左侧镜像、`60%-300%` 缩放、按压回弹和点击音效。
- **气泡控制**：支持常显、悬停显示、点击显示三种模式。
- **托盘运行**：运行时可隐藏任务栏入口，并通过托盘菜单操作。
- **自动更新**：从 GitHub Releases 检查新版，下载便携版并校验 SHA256 后替换重启；校验失败时保留旧版本。
- **Agent 状态动画（实验性）**：支持 Codex、Claude Code 和 Harness 状态驱动 GIF。
- **扩展动画状态**：支持低余额、余额增长和拖动状态；睡眠时间可在设置中以 1–60 分钟调整。
- **Codex 精准状态接入（实验性）**：可选启用本机 Codex Hook，低延迟显示思考、工具、回复等状态；默认关闭。
- **Claude Code / Harness 精准状态接入（实验性）**：通过本机 Hook 或 Cordis 插件接收状态；默认关闭。
- **本地配置**：API Key 和其他设置只保存在当前电脑，不会上传到项目仓库。

### 下载与运行

从 [最新 Releases](https://github.com/Azzle05/Deepseek-Whale-Pet/releases/latest)
下载 `DeepSeek-Whale-Pet-1.6.3-portable.exe`，双击运行即可。

SHA256 以对应 Release 页面公布的最终构建值为准。

1. 右键小鲸鱼，选择 **设置**。
2. 填入 DeepSeek API Key，可选择保存并测试连接。
3. 余额显示后，默认每 30 秒自动刷新，单击小鲸鱼也可以手动刷新。

API Key 可在 [DeepSeek 开放平台](https://platform.deepseek.com) 获取。

> 便携版目前没有购买商业代码签名证书，因此 Windows SmartScreen 可能显示
> “未知发布者”。请只从本仓库的 Releases 页面下载，并核对 Release 中提供的
> SHA256；不要运行来源不明的二次打包版本。

### 自动更新

设置页的“自动更新”区域可以检查 GitHub Releases 中的最新版本。自动下载仅接受
固定的便携版文件名，并在安装前校验 Release 描述中公布的 SHA256。校验缺失或
失败时不会覆盖当前程序，而是提示前往 Releases 手动下载。开发模式和自检模式
不会执行更新安装。

### Agent 状态动画（实验性）

在设置中开启 **Agent 状态动画** 并选择 Agent 后，桌宠会进入纯 GIF 模式，
隐藏原来的鲸鱼图片和内存填充层，避免多张动画叠加。

- 状态切换使用 250ms 渐隐渐显。
- 同一状态播放约 10 秒后，会在 GIF 整数循环边界随机轮换同目录素材。
- 鼠标悬停时切换到 `hover` GIF，移出后恢复之前的 Agent 状态。
- 单击一次完整播放一轮 `click` GIF；连续点击会延长循环，停止点击后淡出。
- `think` 状态会保留足够时间，避免被随后到达的工具调用事件瞬间覆盖。
- 空闲状态达到设置的睡眠时间后，会自动淡入 `sleep` GIF；点击桌宠可立即唤醒。
- 设置页中的测试状态只用于预览；关闭设置窗口后会自动回到空闲状态。

三个 Agent 的精准状态接入相互独立，可以同时启用。切换当前显示的 Agent
只会改变桌宠正在播放的素材，不会卸载其他 Agent 已经配置好的接入。

应用运行时也可以从本机命令传入状态：

```powershell
DeepSeek-Whale-Pet.exe --agent-event codex think
DeepSeek-Whale-Pet.exe --agent-agent codex --agent-state tool
```

选择 Codex 时，应用会从最新的
`~/.codex/sessions/YYYY/MM/DD/*.jsonl` 会话文件末尾开始监听。设置页会显示
当前监听状态、最近事件和更新时间。素材目录、完整状态映射和目录规则见
[`assets/agent-gifs/README.md`](assets/agent-gifs/README.md)。

#### Codex 精准状态接入

**快速启用：**

1. 打开设置中的 **Agent 动画**，开启 **启用 Agent 状态动画**。
2. 在 **Codex** 配置区开启 **Codex 精准状态接入**。
3. 点击 **检查并修复接入**。
4. 如需在桌宠中显示 Codex，将 Agent 类型选择为 **Codex**。
5. 如果 Codex 正在运行，重启 Codex，并确认可能出现的 Hook 信任提示。

Codex 接入只取决于总开关和 Codex 自己的接入开关，当前显示的 Agent 不影响安装。
该方式比 JSONL 轮询更及时，Hook 事件优先，JSONL 仍作为备用来源。

启用时会修改以下本机文件：

- `~/.codex/hooks.json`：添加或更新本应用的 8 个 Hook 事件。
- `~/.codex/config.toml`：确保 `[features]` 中的 `hooks = true`。
- `%APPDATA%\deepseek-whale-pet\`：保存 Hook 脚本、事件日志和安装前状态。

首次修改前会保留：

- `config.toml.deepseek-whale-pet.bak`
- `hooks.json.deepseek-whale-pet.bak`

关闭对应的 Codex 接入开关时，应用只移除自己添加的 Hook 组，不会删除用户已有的
Hook；切换当前显示的 Agent 不会移除 Codex Hook。如果原本已有其他 Hook，会保留
`hooks = true`。如果 Codex 已打开，首次接入后通常需要重启 Codex，并确认是否出现
Hook 信任提示。

如果状态长时间不更新，可以依次检查：

- Codex 配置区中的精准状态接入开关是否仍然开启。
- 点击 **检查并修复接入**，确认状态面板显示 Hook 事件数量正常。
- 完全退出并重新打开 Codex，让 Hook 配置重新加载。
- 如果 Codex 拒绝 Hook，请检查其信任提示或安全设置。

状态映射：

| Codex Hook 事件 | 桌宠状态 |
| --- | --- |
| `SessionStart` | `link` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `tool` |
| `PostToolUse` | `run` |
| `PermissionRequest` | `approval` |
| `Stop` | `done`，短暂显示后自动回到 `idle` |
| `Interrupt` | `interrupted` |
| `SessionEnd` | `idle` |

该功能默认关闭，不影响余额查询、系统内存、气泡、音效和其他桌面交互。

#### Claude Code 精准状态接入

**快速启用：**

1. 在设置中开启 **Agent 状态动画**。
2. 在 **Claude Code** 配置区开启 **Claude Code 精准状态接入**。
3. 点击 **检查并修复接入**。
4. 如需在桌宠中显示 Claude Code，将 Agent 类型选择为 **Claude Code**。
5. 如果 Claude Code 正在运行，重启当前 Claude Code 会话。

该接入使用 Claude Code 自己的 Hook 配置，与 Codex Hook 分开保存，不会互相覆盖。
通过 ccswitch 等方式配置在 `env` 中的 `ANTHROPIC_BASE_URL`、
`ANTHROPIC_AUTH_TOKEN` 等内容会原样保留。

启用时会修改以下本机文件：

- `~/.claude/settings.json`：添加或更新本应用的 12 个 Hook 事件，并保留已有 Hook。
- `%APPDATA%\deepseek-whale-pet\`：保存 Claude Hook 脚本和事件日志。

首次修改前会保留 `settings.json.deepseek-whale-pet.bak`。关闭对应的 Claude Code
接入开关时，应用只会移除自己添加的 Hook；切换当前显示的 Agent 不会移除接入。
如果设置中还有其他 Hook，它们不会被删除。

如果状态长时间不更新，可以依次检查：

- Claude Code 配置区中的精准状态接入开关是否仍然开启。
- 点击 **检查并修复接入**，确认状态面板显示 `12 / 12`。
- 完全退出并重新打开 Claude Code，让 Hook 配置重新加载。
- 如果 Claude Code 在更新后修改了 Hook 事件，请重新点击 **检查并修复接入**。

Claude Code Hook 状态映射：

| Claude Code Hook 事件 | 桌宠状态 |
| --- | --- |
| `SessionStart` | `link` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `tool` |
| `PostToolUse` | `run` |
| `PostToolUseFailure` | `error` |
| `PermissionRequest` | `approval` |
| `Notification` | 根据通知内容显示 `approval` 或 `wait` |
| `PreCompact` | `wait` |
| `SubagentStart` | `tool` |
| `SubagentStop` | `run` |
| `Stop` | `done`，短暂显示后自动回到 `idle` |
| `SessionEnd` | `idle` |

该功能默认关闭，只在总开关和 Claude Code 自己的精准接入开关均已打开时生效；
无需将 Claude Code 设为当前显示的 Agent。

#### DeepSeek Harness 精准状态接入

**快速启用：**

1. 在设置中开启 **Agent 状态动画**。
2. 在 **Harness** 配置区开启 **Harness 精准状态接入**。
3. 点击 **检查并修复接入**。
4. 如需在桌宠中显示 Harness，将 Agent 类型选择为 **Harness**。
5. 完全退出并重新启动 DSH，让 Cordis 配置重新加载。

该接入通过一个只读事件桥接插件工作：

`DSH Cordis 插件 -> 脱敏 JSONL -> 桌宠文件监听 -> Agent GIF`

插件只写入时间、序号、会话 ID、事件名、标准化状态、工具名和结束原因。不会写入
提示词、回复、推理内容、工具参数、工具输出、Token 或凭据。事件文件位于
`%APPDATA%\deepseek-whale-pet\harness-agent-events.jsonl`。

启用时会修改或创建：

- `~/.dsh/profiles/web/cordis.patch.yml`：添加或更新本应用的 Cordis 插件接入块。
- `%APPDATA%\deepseek-whale-pet\integrations\deepseek-harness\`：保存桥接插件。
- `~/.dsh/profiles/web/node_modules\dsh-whale-pet-harness-bridge`：创建指向应用数据目录的 junction。

首次修改 `cordis.patch.yml` 前会保留 `cordis.patch.yml.deepseek-whale-pet.bak`。
关闭对应的 Harness 接入开关时，只移除本应用添加的插件接入项和 junction；
切换当前显示的 Agent 不会移除接入。

如果状态长时间不更新，可以依次检查：

- Harness 配置区中的精准状态接入开关是否仍然开启。
- 点击 **检查并修复接入**，确认状态面板显示 `1 / 1`。
- 完全退出并重新启动 DSH；只刷新页面不一定能重新加载 Cordis 插件。
- 如果自定义了 `DSH_HOME`，请确保 DSH 与桌宠在相同的环境变量下启动。

Harness 状态映射：

| Harness 事件 | 桌宠状态 |
| --- | --- |
| `turn/start`、`user/message`、`step/start`、推理增量 | `think` |
| 文本增量、`assistant/message` | `reply` |
| 工具调用、命令运行、代码分发 | `tool` |
| 工具成功返回 | `run` |
| 工具失败返回 | `error` |
| `approval/asked` | `approval` |
| `approval/decided` | `run` |
| `turn/end=completed` | `done`，短暂显示后自动回到 `idle` |
| `turn/end=aborted/interrupted` | `interrupted` |
| `turn/end=blocked` | `wait` |
| `agent/disposed` | `idle` |

### 本地数据与隐私

- API Key、刷新间隔和其他设置保存在
  `%APPDATA%\deepseek-whale-pet\config.json`。
- 今日消耗历史保存在同一目录的 `history.json`。
- 自定义鲸鱼图片和点击音效也保存在本机应用数据目录。
- 查询余额时，API Key 和请求会发送到你在设置中配置的 DeepSeek API 地址，这是
  查询所必需的；应用不包含遥测，不会额外上传到本仓库或分析服务。
- Hook 事件日志会保留 Codex 或 Claude Code 传入的完整事件 JSON，其中可能包含提示词、
  工具参数等数据。日志只保存在本机，请不要公开分享 `agent-events.jsonl`、
  `claude-agent-events.jsonl` 或整个数据目录。
- Harness 事件日志采用脱敏元数据格式，不记录提示词、回复、推理、工具参数、工具输出、
  Token 或凭据；它仍会包含本机会话 ID 和工具名，请不要公开分享
  `harness-agent-events.jsonl` 或整个数据目录。
- Hook 脚本、事件日志和安装前状态保存在同一目录；不希望继续使用时，先关闭
  对应的精准状态接入，再退出应用。

### 从源码运行

```powershell
npm install
npm start
```

构建 Windows 便携版：

```powershell
npm run dist
```

运行测试：

```powershell
npm run test:hook
npm run test:claude-hook
npm run test:harness-hook
npm run test:agent-runtime
npm run smoke
```

产物默认输出到 `dist/`。配置和本地历史记录保存在 Windows 用户目录的
`AppData` 下。

### 技术栈

- Electron
- Node.js
- 原生 JavaScript、HTML 和 CSS

### 来源与致谢

本项目在以下开源项目、素材和公开技术资料的共同基础上继续开发：

1. [qijiamin0822/deepseek-whale-pet](https://github.com/qijiamin0822/deepseek-whale-pet)：
   当前桌宠版本的直接上游，提供 Electron 桌面化实现。
2. [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)：
   更早的 DSH 网页挂件项目，其界面和交互思路被上方桌宠项目参考。
3. B 站用户 [赤风RED](https://space.bilibili.com/356746604?spm_id_from=333.788.upinfo.head.click)：
   本项目 Agent 状态动画所用 GIF 素材的原作者。相关视频：
   [BV1V88G6TEvg](https://www.bilibili.com/video/BV1V88G6TEvg)。
4. B 站用户 [雾理莎](https://space.bilibili.com/63949809?spm_id_from=333.788.upinfo.detail.click)：
   `2026-09-18_PetKit_桌宠全流程技术包` 的作者和技术参考来源。相关视频：
   [BV1EqeP6PEmM](https://www.bilibili.com/video/BV1EqeP6PEmM)。
   本项目的 Agent 状态动画在素材统一画布与透明边缘处理、状态映射、GIF
   整数循环边界轮换、最短驻留、250ms 渐隐渐显、hover/click/idle/sleep
   调度，以及素材与状态机诊断测试等方面参考了该技术包。Electron
   桌面化、余额查询、Hook/JSONL 接入和 Cordis 桥接等属于本项目结合实际需求
   的扩展实现。

感谢以上项目、素材作者和技术资料的作者。当前 v1.6.3 的代码整理、
设置界面调整、功能定制、文档与新构建由 Azzle 维护。

上述第三方 GIF、视频和技术包版权归各自原作者所有，本项目不会对其另行授予
许可。公开分发、商业使用或二次改编前，请确认并获得原作者要求的授权。

详细授权与素材说明见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

### 开源协议

项目代码采用 [MIT License](LICENSE)。原项目许可证及版权声明已按许可证要求保留。

第三方图片、音频和品牌素材的授权范围可能与代码许可证不同。公开发布或商业使用前，
请阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## English

### Features

- **Live balance**: Scheduled refresh, click-to-refresh, rolling digits, and balance decrease hints.
- **Two balance layouts**: A whale speech bubble or a compact bar extending from the lower-left side.
- **System memory monitoring**: Display memory usage as a translucent whale fill or a bubble value.
- **Alerts and statistics**: Low-balance alerts, today's usage, and API peak/off-peak indicators.
- **Desktop interaction**: Dragging, edge snapping, horizontal mirroring, `60%-300%` scaling, bounce feedback, and click sounds.
- **Bubble modes**: Keep the bubble visible, show it on hover, or show it after a click.
- **Tray support**: Hide the taskbar entry while the app is running and use the tray menu instead.
- **Automatic updates**: Check GitHub Releases, download the portable build, verify SHA256, then replace and restart. The current version is preserved if verification fails.
- **Agent state animation (experimental)**: State-driven GIF animation for Codex, Claude Code, and Harness.
- **Extended animation states**: Low balance, balance increase, and dragging states; the sleep delay is configurable from 1 to 60 minutes.
- **Codex precise state bridge (experimental)**: Optional local Codex Hook for low-latency thinking, tool, completion, and idle states. Disabled by default.
- **Claude Code / Harness precise state bridge (experimental)**: Optional local Hook or Cordis plugin integration for agent states. Disabled by default.
- **Local configuration**: API keys and settings stay on the current computer and are not uploaded to the repository.

### Download and Run

Download `DeepSeek-Whale-Pet-1.6.3-portable.exe` from the
[latest Releases](https://github.com/Azzle05/Deepseek-Whale-Pet/releases/latest)
and run it directly.

The SHA256 published on the matching Release page is authoritative.

1. Right-click the whale and open **Settings**.
2. Enter a DeepSeek API key. You can save it and test the connection.
3. After the balance is loaded, it refreshes every 30 seconds by default. Click the whale to refresh manually.

An API key can be created on the [DeepSeek Platform](https://platform.deepseek.com).

> The portable build is not signed with a commercial code-signing certificate,
> so Windows SmartScreen may show an "Unknown publisher" warning. Download it
> only from this repository's Releases page and verify the SHA256 published
> with the release.

### Automatic Updates

The **Automatic Updates** section in Settings checks the latest GitHub Release.
Automatic downloads accept only the expected portable executable name and verify
the SHA256 published in the Release description before installation. If the hash
is missing or does not match, the current executable is preserved and the app
offers the Releases page for a manual download. Development and smoke-test runs
never install updates.

### Agent State Animation (Experimental)

Enable **Agent State Animation** in Settings and choose an agent. The pet then
enters GIF-only mode, hiding the original whale image and memory fill layer so
multiple animations do not overlap.

- State changes use a 250 ms cross-fade.
- A state rotates to another GIF in the same directory at an integer-loop boundary after about 10 seconds.
- Hovering switches to the `hover` GIF; leaving restores the previous agent state.
- One click plays a complete `click` GIF loop. Repeated clicks extend the loop, then it fades out.
- The `think` state remains visible long enough to avoid being replaced immediately by a following tool event.
- After the configured sleep delay without a new event, the idle state fades into the `sleep` GIF. Clicking the pet wakes it immediately.
- Test states in Settings are previews; closing the Settings window returns the pet to idle.

The Codex, Claude Code, and Harness integrations are independent and can be enabled
at the same time. Switching the displayed agent only changes the animation assets;
it does not uninstall integrations configured for the other agents.

You can also send a state from the local command line while the app is running:

```powershell
DeepSeek-Whale-Pet.exe --agent-event codex think
DeepSeek-Whale-Pet.exe --agent-agent codex --agent-state tool
```

When Codex is selected, the app tails the newest
`~/.codex/sessions/YYYY/MM/DD/*.jsonl` file and only reads appended events.
The Settings page shows the watcher status, latest event, and update time.
See [`assets/agent-gifs/README.md`](assets/agent-gifs/README.md) for the asset
directories, state mappings, and naming rules.

#### Codex Precise State Bridge

**Quick setup:**

1. Open the **Agent Animation** section in Settings and enable **Agent State Animation**.
2. Enable **Codex Precise State Bridge** in the **Codex** panel.
3. Click **Check and Repair Integration**.
4. To display Codex in the pet, select **Codex** as the agent type.
5. If Codex is running, restart it and confirm any Hook trust prompt.

Codex integration depends only on the master switch and its own bridge switch;
the currently displayed agent does not affect installation. This path has lower
latency than JSONL polling. Hook events take priority, while the JSONL watcher
remains available as a fallback.

Enabling the bridge modifies these local files:

- `~/.codex/hooks.json`: adds or updates the app's eight Hook events.
- `~/.codex/config.toml`: ensures `hooks = true` under `[features]`.
- `%APPDATA%\deepseek-whale-pet\`: stores the Hook script, event log, and
  the pre-install state used for safe restoration.

Before the first change, backups are kept as:

- `config.toml.deepseek-whale-pet.bak`
- `hooks.json.deepseek-whale-pet.bak`

Turning the Codex bridge switch off removes only groups added by this app.
Switching the displayed agent does not remove the Codex Hook. Existing user Hooks
are preserved, and `hooks = true` is retained when other Hooks remain. If Codex is
already running, restart it after the first installation and confirm any Hook
trust prompt.

If the state does not update, check that:

- The precise state bridge in the **Codex** panel is still enabled.
- **Check and Repair Integration** reports a valid Hook event count.
- Codex has been fully restarted so it can reload its Hook configuration.
- Codex has not rejected the Hook through a trust or security prompt.

Hook state mapping:

| Codex Hook event | Pet state |
| --- | --- |
| `SessionStart` | `link` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `tool` |
| `PostToolUse` | `run` |
| `PermissionRequest` | `approval` |
| `Stop` | `done`, briefly, then automatically back to `idle` |
| `Interrupt` | `interrupted` |
| `SessionEnd` | `idle` |

This feature is disabled by default and does not affect balance checks, system
memory display, bubbles, sounds, or other desktop interactions.

#### Claude Code Precise State Bridge

**Quick setup:**

1. Enable **Agent State Animation** in Settings.
2. Enable **Claude Code Precise State Bridge** in the **Claude Code** panel.
3. Click **Check and Repair Integration**.
4. To display Claude Code in the pet, select **Claude Code** as the agent type.
5. If Claude Code is running, restart the current Claude Code session.

This bridge uses Claude Code's own Hook settings and is stored separately from the
Codex bridge, so the two integrations do not overwrite each other. Existing values
under `env`, including `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` used by
ccswitch, are preserved.

Enabling the bridge modifies these local files:

- `~/.claude/settings.json`: adds or updates the app's 12 Hook events while
  preserving existing Hooks.
- `%APPDATA%\deepseek-whale-pet\`: stores the Claude Hook script and event log.

The first change keeps a backup named `settings.json.deepseek-whale-pet.bak`.
Turning the Claude Code bridge switch off removes only groups added by this app;
switching the displayed agent does not remove the integration. Other user Hooks
are retained.

If the state does not update, check that:

- The precise state bridge in the **Claude Code** panel is still enabled.
- **Check and Repair Integration** reports `12 / 12` events.
- Claude Code has been fully restarted so it can reload its Hook settings.
- The integration is checked again after a Claude Code update changes Hook events.

Claude Code Hook state mapping:

| Claude Code Hook event | Pet state |
| --- | --- |
| `SessionStart` | `link` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `tool` |
| `PostToolUse` | `run` |
| `PostToolUseFailure` | `error` |
| `PermissionRequest` | `approval` |
| `Notification` | `approval` or `wait`, depending on the notification |
| `PreCompact` | `wait` |
| `SubagentStart` | `tool` |
| `SubagentStop` | `run` |
| `Stop` | `done`, briefly, then automatically back to `idle` |
| `SessionEnd` | `idle` |

This feature is disabled by default and only runs when the master switch and the
Claude Code bridge switch are enabled. Claude Code does not need to be the
currently displayed agent.

#### DeepSeek Harness Precise State Bridge

**Quick setup:**

1. Enable **Agent State Animation** in Settings.
2. Enable **Harness Precise State Bridge** in the **Harness** panel.
3. Click **Check and Repair Integration**.
4. To display Harness in the pet, select **Harness** as the agent type.
5. Fully quit and restart DSH so Cordis reloads the plugin configuration.

This bridge uses a metadata-only Cordis plugin:

`DSH Cordis plugin -> privacy-preserving JSONL -> pet file watcher -> agent GIF`

The plugin writes only timestamps, sequence numbers, session IDs, event names,
normalized pet states, tool names, and turn-end reasons. It never records prompts,
assistant text, reasoning text, tool arguments, tool output, tokens, or credentials.
The event file is `%APPDATA%\deepseek-whale-pet\harness-agent-events.jsonl`.

Enabling the bridge modifies or creates:

- `~/.dsh/profiles/web/cordis.patch.yml`: adds or updates this app's Cordis plugin entry.
- `%APPDATA%\deepseek-whale-pet\integrations\deepseek-harness\`: stores the bridge plugin.
- `~/.dsh/profiles/web/node_modules\dsh-whale-pet-harness-bridge`: creates a junction to the app-data plugin directory.

Before the first change to `cordis.patch.yml`, a backup is kept as
`cordis.patch.yml.deepseek-whale-pet.bak`. Turning the Harness bridge switch off
removes only the app-created entry and junction; switching the displayed agent
does not remove the integration.

If the state does not update, check that:

- The precise state bridge in the **Harness** panel is still enabled.
- **Check and Repair Integration** reports `1 / 1`.
- DSH has been fully restarted; refreshing the page may not reload a Cordis plugin.
- If `DSH_HOME` is customized, start DSH and the pet with the same environment.

Harness state mapping:

| Harness event | Pet state |
| --- | --- |
| `turn/start`, `user/message`, `step/start`, reasoning delta | `think` |
| Text delta, `assistant/message` | `reply` |
| Tool call, command run, code dispatch | `tool` |
| Successful tool result | `run` |
| Failed tool result | `error` |
| `approval/asked` | `approval` |
| `approval/decided` | `run` |
| `turn/end=completed` | `done`, briefly, then automatically back to `idle` |
| `turn/end=aborted/interrupted` | `interrupted` |
| `turn/end=blocked` | `wait` |
| `agent/disposed` | `idle` |

### Local Data and Privacy

- The API key, refresh interval, and other settings are stored in
  `%APPDATA%\deepseek-whale-pet\config.json`.
- Today's usage history is stored in `history.json` in the same directory.
- Custom whale images and click sounds remain in the local application data directory.
- Balance checks send the API key and request to the DeepSeek API address you
  configure, which is required for the query. The app contains no telemetry and
  does not otherwise upload data to this repository or an analytics service.
- The Hook event logs store the complete event JSON supplied by Codex or Claude
  Code, which may include prompts, tool arguments, and related data. The logs
  remain local; do not publish `agent-events.jsonl`, `claude-agent-events.jsonl`,
  or the entire data directory.
- The Harness event log uses privacy-preserving metadata and does not record
  prompts, replies, reasoning, tool arguments, tool output, tokens, or credentials.
  It still includes local session IDs and tool names; do not publish
  `harness-agent-events.jsonl` or the entire data directory.
- Hook scripts, event logs, and pre-install state are stored in the same
  directory. To stop using a bridge, turn off the corresponding precise state
  bridge before exiting the app.

### Run from Source

```powershell
npm install
npm start
```

Build the Windows portable executable:

```powershell
npm run dist
```

Run the tests:

```powershell
npm run test:hook
npm run test:claude-hook
npm run test:harness-hook
npm run test:agent-runtime
npm run smoke
```

The output is written to `dist/` by default. Configuration and local history are
stored under the Windows user `AppData` directory.

### Tech Stack

- Electron
- Node.js
- Vanilla JavaScript, HTML, and CSS

### Credits

This project is developed and maintained on the combined basis of the
following open-source projects, assets, and credited public technical
references:

1. [qijiamin0822/deepseek-whale-pet](https://github.com/qijiamin0822/deepseek-whale-pet):
   the direct upstream Electron desktop pet implementation.
2. [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget):
   the earlier DSH web widget whose interface and interaction ideas were referenced by the upstream desktop pet.
3. Bilibili creator [赤风RED](https://space.bilibili.com/356746604?spm_id_from=333.788.upinfo.head.click):
   the original author of the GIF assets used for this project's Agent state
   animation. Related video:
   [BV1V88G6TEvg](https://www.bilibili.com/video/BV1V88G6TEvg).
4. Bilibili creator [雾理莎](https://space.bilibili.com/63949809?spm_id_from=333.788.upinfo.detail.click):
   the author of `2026-09-18_PetKit_桌宠全流程技术包`, which served as a
   technical reference. Related video:
   [BV1EqeP6PEmM](https://www.bilibili.com/video/BV1EqeP6PEmM).
   This project's Agent state animation references that package for concepts
   including normalized asset canvases and transparent-edge handling, state
   mapping, rotation at integer GIF loop boundaries, minimum dwell time,
   250 ms cross-fades, hover/click/idle/sleep scheduling, and asset and
   state-machine diagnostics. The Electron desktop integration, balance
   queries, Hook/JSONL integration, and Cordis bridge are project-specific
   extensions shaped around this application's requirements.

Thanks to the authors of those projects, assets, and technical references.
The v1.6.3 code cleanup, settings redesign, feature customization,
documentation, and builds are maintained by Azzle.

Copyright in the third-party GIFs, videos, and technical package remains with
their respective original authors; this project does not grant any additional
rights to them. Confirm the required permission from the original authors
before public redistribution, commercial use, or derivative use.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for detailed attribution and
asset licensing information.

### License

The project code is released under the [MIT License](LICENSE). The original
copyright notices and license text are retained as required.

Third-party images, audio, character artwork, and branding may have different
licensing terms from the code. Read
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before public release or
commercial use.
