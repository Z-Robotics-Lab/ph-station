# Agent Note：指挥员在浏览器里启停本地模型

Status: implemented

[English](2026-08-28-local-model-server-switch.md) | 中文

## 问题

控制台的本地骨干是跑在 llama.cpp 上的 27B，占掉 24 GB 显卡里约 19 GB。要在它后面拉起仿真，得先把这块显存放出来；用完再把服务起回去——两次 `~/models/launch_llamacpp.sh` 加一次 `kill`，而这三件事只存在于终端里。指挥员只有浏览器。同一天加上的 `hostVitals` 让天花板可见了，却没给出任何可做的动作。

缺的从来不是模型**路由**：控制台的模型选择器里 `deepseek-official` 与 `local-qwen` 早就并列。够不着的只有进程。

## 决定

board 上的 `model_server(action)`（`status` / `start` / `stop`）与桥接方法 `modelServer`，在解释它存在理由的那条显存进度条正下方渲染成一行：一个状态徽章加一个按钮。

一切会执行的东西都归 board 所有。启动脚本是模块常量 `_MODEL_SCRIPT`；动作词是调用方能提供的全部内容，白名单锁死三个值。接受调用方给的路径或命令行，等于在 harness 机器上开一个远程执行口子，而且从浏览器标签页就能够到。

进程身份看 `/proc/<pid>/exe`，不看 argv。写这个启动脚本的 here-doc 出现在编辑器的命令行里时，同时带着 `llama-server` 和 `--port 30001`——只匹配 argv 会把一个文本编辑器认领下来，随后杀掉。`start` 遇到已在跑的服务就认领，不再拉第二个；否则以 `start_new_session`（setsid）拉起——2026-08-28 有一个 runtime 就是被启动终端的进程组整组拆掉、在战役中途死掉的。`stop` 只对一个 pid 发 SIGTERM：pid 记在 `runs/model-server.pid`，且在动手那一刻重新验证身份；记录被回收或损坏就拒杀。绝不做模式匹配击杀——本仓库有过一次匹配到自己的事故。

`running` 为真而 `healthy` 为假，就是那 1–2 分钟的加载窗口：服务早就占住端口，却还答不了 `/v1/models`。没有这个中间徽章，整段加载都会显示成"停止"，并诱使人再点一次启动。

UI 只渲染与转发。状态由 board 的两个布尔量得出，按钮交回一个字面动作词；点击立刻置 pending，把按钮按住，直到轮询确认进程真的换了状态——或者报回 `error`，此时把按钮交还，而不是让唯一的控制项永远禁用。行内文案用双语讲清分工：这个开关只管服务进程；请求发给哪个模型由模型选择器决定。

## 考虑过的替代方案

**接受调用方给的脚本路径或命令。** 直接否决：与"brief 不许命名 provider"是同一条规则。一个浏览器够得到的 board 面去执行调用方的字符串就是远程执行漏洞，客户端再怎么消毒也不改变信任边界在哪。

**按模式击杀（`pkill -f llama-server`）。** 否决：本仓库已经因为模式匹配到杀手自己的 shell 而丢过进程。pidfile 加上重新验证的 `/proc/<pid>/exe`，要么精确杀一个，要么一个都不杀。

**只信 pidfile。** 否决：现在正在跑的这个服务是在 cockpit 之外启动的，根本没有记录；而 pid 会比它命名的进程活得更久。靠扫描确定身份让 `status` 对被认领的服务说真话，让 `stop` 对被回收的 pid 保持安全；pidfile 记录本面启动过什么，护栏才是授权击杀的东西。

**把状态并进 `host_vitals`。** 否决：`host_vitals` 从不抛异常也从不改变状态，而侧栏唯一的控制项不该搭在一个"没有 NVIDIA 驱动就降级"的读上。分开两个面还有一个好处：`hostVitals` 挂掉时开关仍然可用——它是指挥员释放显卡的唯一途径。

**让按钮顺便切换模型路由。** 否决：选择器已经在做这件事，一个控件同时做两件事会让"停掉服务"和"改用云端"变得含混。这一行用文案说明分工，而不是替人猜。

## 影响

侧栏在既有的体征轮询上每 5s 多发一次 board 调用。`start` 会阻塞至多约 1 秒，等启动脚本走到 `exec`，好让回复给出真实 pid，而不是对刚刚拉起的进程说"没在跑"；此后还要加载几分钟，期间显示加载中徽章。

`model_server` 三个面都有，所以聊天里的 LLM 可以停掉正在为它服务的进程。这是有意为之——这个工具被明确描述为进程开关，而且控制台的另一条路由一直在——但它确实是一项真实能力，不是暴露上的疏忽。

`runs/model-server.pid` 与 `runs/model-server.log` 进入 runs 目录树。两者都过不了 `is_store` 或 `is_session`，任何列表都不会看见它们。

## 测试

harness 仓库的 `tests/test_model_server.py`（8 个测试，基座车道 666 → 674）伪造 `/proc`、健康探测与 `nvidia-smi`，覆盖：三种状态及按本进程 pid 取到的显存；冒名者用例——一个仅在命令行里提到二进制名与端口的 shell 不会被认领；动作白名单，并把 `Popen` 与 `os.kill` 设成绊线，证明被拒的动作确实什么都没跑；已在跑时认领而非重复拉起；拉起时的 argv 与 `start_new_session`；对匹配 pid 的 SIGTERM；pidfile 被回收或损坏时的拒杀；以及三脸字节等价（含 CLI 省略参数时读而不写）。

`packages/client/ui-ph-ops/tests/operator-rail.client.spec.tsx` 新增四例：三个徽章及其按钮文案；board 仍报告在跑时按钮保持禁用；错误路径把按钮交还；以及 `hostVitals` 挂掉时开关依然存在。

`storecli model_server status` 在本机对着运行中的服务真跑过，返回 `running`、`healthy`、pid、模型路径与 21734 MiB。`start` 也真跑过，认领了运行中的服务且没有拉起第二个。`stop` **没有**对运行中的服务执行：它正在为指挥员的控制台提供服务。
