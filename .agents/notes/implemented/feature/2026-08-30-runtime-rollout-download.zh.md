# Agent Note: Runtime rollout 视频属于可丢弃的实时状态

Status: implemented

[English](2026-08-30-runtime-rollout-download.md) | 中文

## 问题

实时取景窗只显示当前帧，而稀疏 keyframe 无法保留诊断操作失败所需的完整运动过程。若把每一帧或视频都当作封存证据，会增加 store 体积，并混淆操作员便利功能与实验评价事实之间的区别。

## 决定

启用画面转储的 physical-harness runtime 在任务结束时把当前任务的渲染帧合成为 `runs/<session>/rollout.mp4`。新任务会删除上一条视频，编码结束后删除临时帧；编码失败不会改变任务完成状态或证据。

motherboard 通过其他 runtime 状态使用的同一条 `board.store` → `board.storecli` → MCP 与 ph-station host bridge 提供视频。只有操作员点击后，执行图取景窗才下载返回的字节；host 与浏览器都不解释视频内容。

## 备选方案

**把视频封存为任务证据。** 未采用，因为任务结果与验证谓词不依赖视频，而把视频保存在 append-only 证据库会产生很高的永久存储成本。

**在浏览器中录制取景窗。** 未采用，因为浏览器可见性、标签页限速和网络帧传输会让结果不完整且依赖操作员状态。

**通过静态文件服务暴露 runs 目录。** 未采用，因为这会在 board Remote 之外增加第二条访问路径，并扩大 gateway 的文件服务权限。

## 后果

操作员可以从执行取景窗下载最近一条完整 rollout，同时不改变实验判定。录制要求启用画面转储并安装 `ffmpeg`；系统只保留最近一个任务视频，base64 Remote 响应也比普通面板读取更大。

## 测试

motherboard 测试覆盖任务生命周期内的视频合成、替换、清理，以及隔离 `ffmpeg` 后 storecli/MCP 的字节等价读取。客户端测试覆盖显式的字节到 MP4 浏览器下载，host 与 client 的 TypeScript 构建面则固定 Remote 接线。
