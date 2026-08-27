# Agent Note: 指挥员侧栏显示主机自身的余量

Status: implemented

[English](2026-08-28-host-vitals-in-the-operator-rail.md) | 中文

## 问题

驾驶舱拥有的每一个实时面读的都是 *harness*：会话链、运行时状态文件、事件 feed、取景帧。没有一个读的是 *harness 所运行的那台机器*。一个常驻 runtime 被打满的 4090 打爆，而侧栏当时报的是 模式 execution / 心跳 3s——直到显存耗尽的那一刻，所有 harness 信号都是健康的。操作员只用浏览器、从不开终端，所以 `nvidia-smi` 根本不是一条可用的诊断路径；天花板的第一个征兆就是 runtime 已经没了。

## 决定

新增一个板面脸 `host_vitals(path)`，以及侧栏 运行体征 卡片底部的一组 `hostVitals` 行：每张 GPU 的显存及占用它的计算进程、物理内存、以及 `runs/` 所在文件系统的可用空间。

所有数字都归 harness 所有。`board/store.py` 执行两次 `nvidia-smi --query-… --format=csv,noheader,nounits` 读取，并按 GPU uuid 做连接（`--query-compute-apps` 不带 index 列，uuid 是唯一能把进程配到卡上的键），读 `/proc/meminfo` 取 `MemTotal − MemAvailable`，再调 `os.statvfs`——零新增 Python 依赖，不引入 `psutil`，不引入 `pynvml`。它还把每张卡的进程按占用降序排好，于是面板不必自己排序就能点名最大占用者：这是宪章里「统计住在 `board/`」的规矩。

这是与 `runtime_status` 同族的活状态——永远不是链行、永远不是封存证据，并且绝不抛异常。`nvidia-smi` 缺失、超时、非零退出、`/proc/meminfo` 无法解析、路径不存在，都降级为空 `gpu` 列表或零值。没有 NVIDIA 驱动的主机是正常部署，不是故障；探测失败必须只在一张卡片上留一个空档，而不是把整个轮询拖下水。

三个脸保持字节等价（`board/store.py`、`board/storecli.py`、`board/mcp_server.py`），因此聊天 LLM 与面板读到的是同一个 dict。桥接方法无参——这次读取是主机寻址而非会话寻址——gateway 自动在 `POST /api/board/hostVitals` 提供它。

侧栏用自己的 5s 节奏轮询它，而不是共享的 15s 证据节奏，并且自己吞掉自己的失败：`hostVitals` 读取失败只清掉这几行，任务卡片照常存活。TypeScript 只从比例里挑一个颜色（≥90% 红、≥75% 黄），别的什么都不做——不执行命令，不派生数字。

## 考虑过的替代方案

**引入 GPU 指标依赖（`pynvml`、`psutil`）。** 否决：`nvidia-smi`、`/proc/meminfo`、`statvfs` 只是三次短读取；为一个状态面板往 harness venv 里加运行时依赖，等于在这个面板本就要看护的机器上多造一种故障模式。

**把整个侧栏的轮询提到 5s。** 否决：证据层的读取每次都要拉起一个 Python `storecli` 子进程，而会话链按任务速度变化。只有主机数字会自己动——显存被填满时没有任何东西写入 board——所以只有它们需要更快的 tick。

**把告警阈值算在板面侧。** 否决：阈值是展示选择，不是统计量。那样板面就得下发一个面板只能照抄的判定，而另一套部署想换个界限就得改 harness。

**`nvidia-smi` 缺失时大声失败。** 否决——虽与仓库「配置错误大声失败」的通则相反：这个脸是活采样，属于那个把不存在的 `runtime_status.json` 读成 `null` 的家族。纯 CPU 主机是受支持的部署，所以空 `gpu` 列表才是诚实答案，而不是错误。

## 后果

侧栏每 5s 多发一次板面调用，代价是每 tick 一个 `storecli` 子进程加一对 `nvidia-smi`——与既有的每轮读取同一量级，并且随它们一起在标签页隐藏时暂停。操作员会在下一个任务认领 runtime 之前，看见那张 94% 的卡变红，旁边点着名 `sglang::scheduler`。

GPU/内存/磁盘三行复用进度卡已有的 `meterTrack`/`meterFill` 计量条，而不是新增带字形的 `VitalRow`，因此内嵌的 tabler 图标子集一个都没有增加。`usePolledLoad` 增加了一个可选节奏参数，默认仍是未改动的 `POLL_MS`；它在 `ui-ph-panels` 里的孪生体没有被动过。

## 测试

harness 仓库的 `tests/test_host_vitals.py`（4 个测试，基座车道 662 → 666）把两处主机读取都做了 monkeypatch，覆盖按 uuid 的连接及其降序排名、`MemTotal − MemAvailable` 读取、把 `ts` 钉死后的三脸字节等价，以及降级契约——二进制缺失、超时、非零退出、`/proc/meminfo` 无法解析、路径不存在——每一种都断言得到空列表或零值，而不是异常。

`packages/client/ui-ph-ops/tests/operator-rail.client.spec.tsx` 增加了告警用例：一张 23000/24564 MiB 的卡渲染出 `94%`、恰好一条 fail 色的计量条填充、以及那个进程名，而 30% 的内存与 88% 已用的磁盘都留在该色之外。
