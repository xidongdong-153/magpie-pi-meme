# Pi meme 的 Magpie Agent 插件

安装后，在 Magpie 的 Agent 页面打开「Pi meme」开关。插件会把 Magpie 模型同步为 Pi meme 中的一个普通自定义提供商，模型仍在 Pi meme 内选择。

## 安装

1. 打开本机 Pi meme Desktop，保持 Magpie 运行。
2. 在终端安装本目录，把 `/path/to/magpie-pi-meme` 换成仓库的实际路径：

```bash
magpie plugin add /path/to/magpie-pi-meme
```

3. 在 Magpie 的 Agent 页面打开「Pi meme」开关。
4. 等待约两秒，在 Pi meme 的模型选择器里选择 Magpie 模型。设置页的「自定义提供商」里也会显示 Magpie。

如果 Pi meme 正在运行会话，插件等它空闲后自动同步。不需要选择默认模型，不需要复制 API Key 或登记来源文件。

已安装旧版时，先移除旧安装，再添加本地目录并重新连接：

```bash
magpie plugin rm /path/to/magpie-pi-meme
magpie plugin add /path/to/magpie-pi-meme
magpie pi-meme provider magpie
```

## 连接与断开

默认连接 `http://127.0.0.1:3185` 的本机 Pi meme Host，使用 Pi meme 已有的本机自动登录。支持 Desktop 及开启本机自动登录的独立 Host，不支持要求访问令牌的 Host。按当前 `/api/status` 的 `product`、`hostId`、`instanceId`、`dataRoot` 和 `owner` 校验服务身份。

使用开发版或自定义本机端口时，可设置插件的 `hostUrl` 选项，例如：

```bash
magpie plugin options /path/to/magpie-pi-meme '{"hostUrl":"http://127.0.0.1:3180"}'
```

在 Magpie 的 Agent 页面关闭「Pi meme」开关，插件会在 Pi meme 空闲后移除自己创建的 Magpie 提供商。卸载插件前先关闭该开关并等待同步完成。

已有同名 `magpie` 提供商时，插件自动选择 `magpie-2`、`magpie-3` 等可用 ID，保留原有配置。更新、重启和关闭开关只操作插件自己创建的条目。连接后手工修改该条目的名称、地址或模型声明，会暂停后续自动同步；关闭开关前应恢复这些修改，或直接在 Pi meme 中删除该条目。重新连接可关闭再打开 Magpie 的开关。

## 同步内容

- 通过 Magpie 的 OpenAI Chat Completions 兼容入口访问所有模型，上游协议由 Magpie 转换。
- 保留 Magpie 给出的模型 ID、名称、上下文、输出上限和可表达的思考档位。缺失的上限不自行猜测。
- 模型默认支持文本和图片输入；Magpie 明确给出 `images: false` 时只声明文本输入。
- 提供商优先使用 ID `magpie`，同名时自动使用可用编号，显示名为 Magpie；不改变当前会话模型或新会话默认偏好。
- 复用 Pi meme 的 Node 客户端和现有 `models:get/save/delete/reconnect` RPC，不直接修改 Host 的模型和凭据文件。

Magpie 的 Agent 入口在受限 JavaScript 引擎中运行，只负责写入 `~/.config/pi-meme-magpie/agent.json`。同一个插件的 Bun 入口每两秒检查一次连接状态，通过本机 RPC 同步。

`agent.json` 中的网关 Key 为 Magpie 的标准连接标记；目录权限为 `0700`，同步时文件权限设为 `0600`。`bridge-state.json` 只记录 Host 身份、提供商公开快照和密钥摘要，不记录明文 Key。Pi meme 的模型 Key 仍由现有凭据存储保存。

加载和同步问题查看 Magpie 的插件日志，日志服务名为 `pi-meme`。插件不记录密钥或聊天内容。

## 本地开发

TypeScript 源码位于 `src/`，安装直接使用已生成的 `agent.js` 和 `index.js`，没有运行时 npm 依赖。

源码导入 `@pi-meme/contracts` 和 `@pi-meme/client`，这两个包随 Pi meme 工作区提供，未发布到 npm。将本仓库的源码和构建配置同步到 pi-meme 仓库的 `out/magpie/agent-pi-meme` 目录后，在 pi-meme 仓库根目录执行：

```bash
pnpm --dir out/magpie/agent-pi-meme type-check
pnpm --dir out/magpie/agent-pi-meme build
```

构建后将 `agent.js` 和 `index.js` 同步回本仓库；安装时直接加载这两个文件。

接口依据：<https://usemagpie.ai/docs/zh/plugins#agents>。
