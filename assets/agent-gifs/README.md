# Agent GIF 素材说明 / Agent GIF Assets

本目录用于实验性的 Agent 状态动画功能。首版只适配 Codex、Claude Code 和 Harness。

This directory is reserved for the experimental Agent status animation feature.
The first supported agents are Codex, Claude Code, and Harness.

## 目录结构 / Structure

```text
agent-gifs/
  common/
    idle/
    link/
    wait/
    think/
    tool/
    run/
    reply/
    approval/
    error/
    interrupted/
    done/
    hover/
    sleep/
    click/
    low_balance/
    balance_increase/
    dragging/

  idle_codex/          # 可选，仅在 Codex 需要专属 idle 时创建
  think_claudecode/    # 可选，仅在 Claude Code 需要专属 think 时创建
  approval_harness/    # 可选，仅在 Harness 需要专属 approval 时创建
```

所有 Agent 默认共用 `common/<状态>/` 中的 GIF，不需要为每个 Agent 复制素材。

All agents share the GIFs in `common/<state>/` by default. Do not duplicate the
same assets for each agent.

如果某个 Agent 的某个状态需要单独使用 GIF，只创建
`<状态>_<agent>/` 目录，并把 GIF 直接放入该目录。

If an agent needs different GIFs for one state, create a `<state>_<agent>/`
directory and put the GIF files directly inside it.

示例 / Examples:

```text
idle_codex/
think_claudecode/
approval_harness/
```

支持的首版 Agent 标识 / Supported agent identifiers:

```text
codex
claudecode
harness
```

不要预先创建这些专属目录。只有确实需要特殊素材时才创建。

Do not create these special directories in advance. Create one only when that
agent actually needs a different animation.

## 查找规则 / Lookup Rules

例如 Codex 进入 `idle` 时 / For example, when Codex enters `idle`:

1. 优先查找 `idle_codex/` 中的 GIF。
2. 如果该目录不存在或没有 GIF，则使用 `common/idle/`。
3. 在最终选中的目录内随机选择一个 GIF 循环播放。

1. Look in `idle_codex/` first.
2. If it does not exist or contains no GIF, use `common/idle/`.
3. Randomly choose one GIF from the selected directory and play it in a loop.

同一目录可以放置多张 GIF，程序每次触发状态时随机选择。

Multiple GIFs may be placed in the same directory. The application chooses one
at random each time the state is triggered.

## 核心状态 / Core States

| 状态 / State | 说明 / Meaning |
| --- | --- |
| `idle` | Agent 空闲 / Agent is idle |
| `link` | 已发送请求，等待首次响应 / Request sent, waiting for the first response |
| `wait` | 排队或等待 / Waiting or queued |
| `think` | 思考、推理或生成计划 / Reasoning or generating a plan |
| `tool` | 准备或选择工具 / Preparing or selecting a tool |
| `run` | 执行工具、命令或文件操作 / Running a tool, command, or file operation |
| `reply` | 正在生成回复 / Streaming or producing a reply |
| `approval` | 等待用户批准 / Waiting for user approval |
| `error` | 连接、请求或 Agent 错误 / Connection, request, or Agent error |

## 可选状态 / Optional States

| 状态 / State | 说明 / Meaning |
| --- | --- |
| `interrupted` | 当前任务被中断 / The current task was interrupted |
| `done` | 任务完成 / The task completed |
| `hover` | 鼠标悬停在桌宠上 / The pointer is hovering over the pet |
| `sleep` | 长时间闲置 / The pet has been idle for a long time |
| `click` | 点击桌宠 / The pet was clicked |
| `low_balance` | 余额低于设置阈值 / Balance is below the configured threshold |
| `balance_increase` | 后台检测到余额增长 / A background refresh detected an increased balance |
| `dragging` | 正在拖动桌宠 / The pet is being dragged |

## GIF 规则 / GIF Rules

- 使用透明背景 GIF。 / Use transparent GIF files.
- 同一 Agent 的动画尽量保持相同画布尺寸和主体位置。
  Keep the same canvas size and position for animations belonging to one agent.
- 状态目录内不要再建子目录。 / Do not create subdirectories inside a state directory.
- 公共素材放入 `common/<状态>/`。 / Shared assets belong in `common/<state>/`.
- 特殊素材放入 `<状态>_<agent>/`，目录名使用小写。
  Agent-specific assets belong in `<state>_<agent>/`, using lowercase names.
- 某些状态可以按实现阶段定义回退规则。
  Fallback rules between states will be defined during implementation.
- 发布项目前记录每张 GIF 的来源和许可证。
  Record the source and license of every GIF before publishing the project.

## 运行事件接入 / Runtime Event Bridge

桌宠可以接收本机命令传入的状态事件。应用已运行时，再次执行下面的命令会把
事件交给现有实例处理。

The pet accepts local state events from the command line. If the application is
already running, another launch forwards the event to the existing instance.

```powershell
DeepSeek-Whale-Pet.exe --agent-event codex think
DeepSeek-Whale-Pet.exe --agent-agent codex --agent-state think
```

支持的首版 Agent / Supported agents:

```text
codex
claudecode
harness
```

支持的动画状态 / Supported animation states:

```text
idle link wait think tool run reply approval
error interrupted done hover sleep click
low_balance balance_increase dragging
```

Codex 开启实验功能并选中 Codex 后，桌宠会自动尾随
`~/.codex/sessions/YYYY/MM/DD/` 中最新的 JSONL 会话日志。监听从文件末尾开始，
只读取新追加的内容，不会把历史日志整文件加载到内存。

When the experimental feature is enabled with Codex selected, the pet tails the
newest JSONL file under `~/.codex/sessions/YYYY/MM/DD/`. It starts at end of file
and reads appended bytes only, so historical logs are not loaded into memory.

Codex 会话映射 / Codex session mapping:

| Codex 事件 / Event | 动画状态 / State |
| --- | --- |
| `task_started` | `link` |
| `user_message` | `think` |
| `reasoning` | `think` |
| `function_call` | `tool` |
| `function_call_output` | `run` |
| `agent_message` / assistant `message` | `reply` |
| `task_complete` | `done` |
| `turn_aborted` / `interrupted` | `interrupted` |
| `error` | `error` |

Codex 设置页还可以开启 **Codex 精准状态接入**。该选项会安装本机 Hook，
优先通过 Hook 获取状态；Hook 不可用时仍使用上面的 JSONL 会话监听。
Hook 事件映射见项目根目录的 `README.md`。

The Settings page can also enable **Codex Precise State Bridge**. It installs a
local Hook for lower-latency state events. The JSONL watcher above remains a
fallback when the Hook is unavailable. See the project root `README.md` for the
Hook event mapping.

Claude Code 开启 **Claude Code 精准状态接入** 后，桌宠会通过独立的 Claude Hook
读取状态。Claude 配置写入 `~/.claude/settings.json`，不会覆盖已有的 `env`、其他
Hook 或 ccswitch 设置。关闭开关或切换 Agent 时会移除本应用添加的 Hook。

When **Claude Code Precise State Bridge** is enabled, the pet reads state events
from a separate Claude Hook. Claude configuration is written to
`~/.claude/settings.json` without overwriting existing `env` values, other Hooks,
or ccswitch settings. Turning the switch off or changing agents removes only the
Hooks added by this app.

Claude Hook 状态映射 / Claude Hook state mapping:

| Claude Code 事件 / Event | 动画状态 / State |
| --- | --- |
| `SessionStart` | `link` |
| `UserPromptSubmit` | `think` |
| `PreToolUse` | `tool` |
| `PostToolUse` | `run` |
| `PostToolUseFailure` | `error` |
| `PermissionRequest` | `approval` |
| `Notification` | `approval` 或 `wait` |
| `PreCompact` | `wait` |
| `SubagentStart` | `tool` |
| `SubagentStop` | `run` |
| `Stop` | `done`，随后回到 `idle` |
| `SessionEnd` | `idle` |

## 播放策略 / Playback Rules

- 状态切换使用 250ms 渐隐渐显。 / State changes use a 250ms cross-fade.
- 同一状态至少播放约 10 秒，并在 GIF 整数循环边界随机切换同目录素材。
  A state rotates to another GIF at an integer-loop boundary after about 10 seconds.
- 单击一次播放一轮 `click` GIF；连续点击会延长循环，停止点击后在当前循环结束
  时淡出。 / One click plays one complete `click` loop; repeated clicks extend the
  loop and the animation fades after the final cycle.
- `dragging` 在拖动超过阈值时显示，释放后回到基础 Agent 状态。
  / `dragging` is shown after the pointer movement passes the drag threshold and
  is released back to the base Agent state when dragging ends.
- `balance_increase` 在后台余额上涨后短暂显示约 4 秒。
  / `balance_increase` is shown briefly for about 4 seconds after a background
  balance increase.
- `low_balance` 在余额低于设置阈值时显示，恢复到阈值以上后回到基础状态。
  / `low_balance` remains active while the balance is below the configured
  threshold and returns to the base state after recovery.
