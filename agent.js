// src/agent.ts
var agent = {
  id: 'pi-meme',
  name: 'Pi meme',
  dir: '~/.pi-meme',
  config: '~/.config/pi-meme-magpie/agent.json',
  ua: ['pi-meme', 'pi meme'],
  notice:
    '\u5728 Pi meme \u4E2D\u9009\u62E9 Magpie \u63D0\u4F9B\u5546\u7684\u6A21\u578B\u3002\u4F1A\u8BDD\u6B63\u5728\u8FD0\u884C\u65F6\uFF0C\u914D\u7F6E\u4F1A\u5728\u7A7A\u95F2\u540E\u81EA\u52A8\u540C\u6B65\u3002',
}
function connect({ gateway, models }) {
  if (!gateway?.key || !gateway.v1 || !gateway.url)
    throw new Error('Magpie \u6CA1\u6709\u63D0\u4F9B\u5B8C\u6574\u7684\u7F51\u5173\u5730\u5740\u548C\u5BC6\u94A5')
  if (!Array.isArray(models)) throw new Error('Magpie \u6CA1\u6709\u63D0\u4F9B\u6A21\u578B\u76EE\u5F55')
  const catalog = /* @__PURE__ */ new Map()
  for (const model of models) {
    if (!model.id?.trim()) continue
    const configured = {
      id: model.id,
      name: model.name?.trim() || model.id,
      input: model.images ? ['text', 'image'] : ['text'],
    }
    if (Number.isSafeInteger(model.context) && model.context > 0) configured.contextWindow = model.context
    if (Number.isSafeInteger(model.output) && model.output > 0) configured.maxTokens = model.output
    const levels = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max']
    const supported = levels.filter((level) => model.efforts?.includes(level))
    configured.reasoning = supported.length > 0
    if (supported.length)
      configured.thinkingLevelMap = Object.fromEntries(
        levels.map((level) => [level, supported.includes(level) ? level : null]),
      )
    catalog.set(model.id, configured)
  }
  return {
    version: 1,
    gatewayKey: gateway.key,
    provider: {
      id: 'magpie',
      name: 'Magpie',
      api: 'openai-completions',
      baseUrl: gateway.v1.replace(/\/+$/, ''),
      models: [...catalog.values()].sort((left, right) => left.id.localeCompare(right.id)),
    },
  }
}
export { agent, connect }
