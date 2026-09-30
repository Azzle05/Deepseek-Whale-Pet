# 第三方来源与许可说明

本文件用于说明当前项目 `DeepSeek 鲸鱼桌宠 v1.6.3` 的来源链、保留的许可证、
参考内容以及第三方素材的授权边界。此文件是来源说明，不会替代任何第三方的
原始许可或授权确认。

## 1. qijiamin0822/deepseek-whale-pet

- 项目地址：[qijiamin0822/deepseek-whale-pet](https://github.com/qijiamin0822/deepseek-whale-pet)
- 用途：当前 Electron 桌面桌宠的直接上游源码。
- 许可：仓库根目录随附 MIT License。
- 原始版权声明：`Copyright (c) 2026 qijiamin0822`

本项目继续保留仓库根目录的 `LICENSE` 文件，并在其中增加当前版本的修改版权行。
MIT 许可证要求分发原软件或其重要部分时保留原版权声明和许可文本。

## 2. MeteorNOX/DeepSeek-Balance-Whale-Widget

- 项目地址：[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)
- 用途：qijiamin0822 的桌宠项目在此基础上参考和改造，当前项目间接沿用其中的界面与交互思路。

## 3. Agent GIF 素材

- 原作者：B 站用户 **赤风RED**
- 个人主页：[https://space.bilibili.com/356746604](https://space.bilibili.com/356746604?spm_id_from=333.788.upinfo.head.click)
- 相关视频：[BV1V88G6TEvg](https://www.bilibili.com/video/BV1V88G6TEvg)
- 用途：本项目实验性 Agent 状态动画所使用的 GIF 素材。

这些 GIF 的版权归原作者所有。仓库中的来源署名用于说明素材出处，不替代原作者
对复制、修改、再分发或商业使用的授权。若尚未取得明确许可，公开发布、商业使用
或二次改编前应联系原作者确认授权范围，或移除并替换为拥有明确授权的素材。

## 4. `2026-09-18_PetKit_桌宠全流程技术包`

- 原作者：B 站用户 **雾理莎**
- 个人主页：[https://space.bilibili.com/63949809](https://space.bilibili.com/63949809?spm_id_from=333.788.upinfo.detail.click)
- 相关视频：[BV1EqeP6PEmM](https://www.bilibili.com/video/BV1EqeP6PEmM)
- 用途：本项目 Agent 状态动画的技术参考来源。

本项目的 Agent 状态动画在以下方面参考了该技术包：

- 动画素材的统一画布与透明边缘处理。
- Agent 事件到动画状态的映射思路。
- GIF 在整数循环边界轮换，避免半帧切换。
- 最短驻留时间，避免状态短暂闪烁。
- 约 250ms 的渐隐渐显切换。
- `hover`、`click`、`idle`、`sleep` 等交互与空闲调度。
- 素材透明度、播放兼容性和状态机诊断测试方法。

Electron 桌面化、余额查询、Codex/Claude Code Hook、JSONL 监听和
DeepSeek Harness Cordis 桥接等，属于本项目结合实际需求进行的扩展实现。

该技术包及其中的代码、文档和素材不因本项目参考其设计思路而自动采用 MIT
许可证。若未来直接复制、分发或改编该技术包中的代码、文档或素材，应单独核对
原作者的授权条件。

## 5. 图片、音频、图标与其他素材

当前仓库的 `assets/` 目录包含鲸鱼图片和音效文件，`build/icon.ico` 包含应用图标。
这些素材部分沿用自上游项目，未在本仓库中统一声明为当前维护者原创。

根目录的 MIT License 适用于其明确覆盖的代码和软件文本，并不自动等同于所有图片、
音频、GIF、角色形象、名称或品牌素材都可以无条件复制、再分发或商业使用。若准备
商业使用或提交应用商店，应逐项确认素材权利人的授权，或替换为拥有明确授权的素材。

## 6. 本版本代码修改

除第三方来源和素材外，当前 v1.6.3 的代码整理、设置界面调整、功能定制、文档和
构建配置由 Azzle 维护。当前版本的修改版权声明为：

`Modifications Copyright (c) 2026 Azzle`
