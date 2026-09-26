# DeepSeek 鲸鱼桌宠

> 透明置顶的 Windows 桌面小鲸鱼，实时显示 DeepSeek API 余额，也可以切换为系统内存监控。

![DeepSeek 鲸鱼桌宠](./screenshot.png)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43-47848F)](https://www.electronjs.org/)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D6)](#)

**当前版本：v1.4.0**  
**当前版本维护者：Azzle**

## 特性

- **实时余额**：定时后台刷新、单击刷新、滚动数字和余额减少提示。
- **两种余额界面**：鲸鱼气泡或桌宠左下方伸出的桌面横条。
- **内存显示**：可切换显示系统内存占用，支持鲸鱼透明填充或气泡数值。
- **提醒与统计**：低余额通知、今日消耗记录、峰谷时段提示。
- **桌面交互**：拖拽、边缘吸附、左侧镜像、可调大小、按压回弹和音效。
- **显示控制**：气泡常显、悬停显示或点击显示；运行时可将任务栏入口收进托盘。
- **便携使用**：提供单文件 Windows Portable EXE，免安装运行。
- **本地配置**：API Key 仅保存在当前电脑，不会上传到项目仓库。

## 下载与运行

从 Releases 下载 `DeepSeek-Whale-Pet-1.4.0-portable.exe`，双击运行即可。

1. 右键小鲸鱼，选择 **设置**。
2. 填入 DeepSeek API Key，可选择保存并测试连接。
3. 余额显示后，默认每 30 秒自动刷新，单击小鲸鱼也可以手动刷新。

API Key 可在 [DeepSeek 开放平台](https://platform.deepseek.com) 获取。

## 从源码运行

```powershell
npm install
npm start
```

构建 Windows 便携版：

```powershell
npm run dist
```

产物默认输出到 `dist/`。配置和本地历史记录保存在 Windows 用户目录的 `AppData` 下。

## 技术栈

- Electron
- Node.js
- 原生 JavaScript、HTML 和 CSS

## 来源与致谢

本项目是在以下开源项目基础上继续修改和维护的桌面应用：

1. [qijiamin0822/deepseek-whale-pet](https://github.com/qijiamin0822/deepseek-whale-pet)：当前桌宠版本的直接上游，提供 Electron 桌面化实现。
2. [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)：更早的 DSH 网页挂件项目，其界面和交互思路被上方桌宠项目参考。

感谢以上项目的作者和贡献者。当前 v1.4.0 的代码整理、设置界面调整、功能移除与新构建由 Azzle 维护。

详细授权与素材说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 开源协议

项目代码采用 [MIT License](LICENSE)。原项目许可证及版权声明已按许可证要求保留。  
第三方图片、音频和品牌素材的授权范围可能与代码许可证不同，公开发布或商业使用前请阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
