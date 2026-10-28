import type { ConfiguredModel, SaveModelProvider } from '@pi-meme/contracts/model-config'

export type GatewayModel = {
  id: string
  name?: string
  context?: number
  output?: number
  images?: boolean
  efforts?: string[]
  native_endpoints?: string[]
}

export type ConnectionInput = {
  gateway: { url: string; v1: string; key: string }
  models: GatewayModel[]
}

export type Handoff = {
  version: 1
  gatewayKey: string
  provider: SaveModelProvider['provider']
}

export const agent = {
  id: 'pi-meme',
  name: 'Pi meme',
  dir: '~/.pi-meme',
  config: '~/.config/pi-meme-magpie/agent.json',
  ua: ['pi-meme', 'pi meme'],
  notice: '在 Pi meme 中选择 Magpie 提供商的模型。会话正在运行时，配置会在空闲后自动同步。',
}

export function connect({ gateway, models }: ConnectionInput): Handoff {
  if (!gateway?.key || !gateway.v1 || !gateway.url) throw new Error('Magpie 没有提供完整的网关地址和密钥')
  if (!Array.isArray(models)) throw new Error('Magpie 没有提供模型目录')
  const catalog = new Map<string, ConfiguredModel>()
  for (const model of models) {
    if (!model.id?.trim()) continue
    const configured: ConfiguredModel = {
      id: model.id,
      name: model.name?.trim() || model.id,
      input: model.images ? ['text', 'image'] : ['text'],
    }
    if (Number.isSafeInteger(model.context) && model.context! > 0) configured.contextWindow = model.context
    if (Number.isSafeInteger(model.output) && model.output! > 0) configured.maxTokens = model.output
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
