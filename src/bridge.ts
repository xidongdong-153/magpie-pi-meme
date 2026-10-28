import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { createNodeHostClient, type NodeHostClient } from '@pi-meme/client/node-host-client'
import type {
  ConfiguredProvider,
  ModelConfigResult,
  ModelConfigSnapshot,
  SaveModelProvider,
} from '@pi-meme/contracts/model-config'
import type { LocalHostStatus } from '@pi-meme/contracts/host-runtime'
import type { Handoff } from './agent.js'

type State = {
  version: 1
  hostId: string
  expected: ConfiguredProvider
  keyHash: string
  applied: boolean
}

export type SyncResult = { status: 'idle' | 'applied' | 'removed' | 'waiting'; message?: string }

async function jsonFile(file: string): Promise<unknown> {
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new Error('无法读取 Pi meme 插件的私有配置，请检查文件权限')
  }
  try {
    return JSON.parse(content)
  } catch {
    throw new Error('Pi meme 插件的私有配置不是有效 JSON，已保留现有提供商')
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export class Bridge {
  private lastSignature?: string
  private lastInstance?: string
  private client?: NodeHostClient
  private clientInstance?: string
  private readonly handoffPath: string
  private readonly statePath: string
  private readonly origin: string

  constructor(
    private readonly directory: string,
    hostUrl = 'http://127.0.0.1:3185',
  ) {
    const url = new URL(hostUrl)
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error('本机试用插件只连接 127.0.0.1 上的 Pi meme Host')
    this.origin = url.origin
    this.handoffPath = path.join(directory, 'agent.json')
    this.statePath = path.join(directory, 'bridge-state.json')
  }

  dispose() {
    this.client?.dispose()
    this.client = undefined
  }

  private async response(url: string, init?: RequestInit) {
    let response: Response
    try {
      response = await fetch(`${this.origin}${url}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(5000) })
    } catch {
      throw new Error('等待本机 Pi meme 启动，插件会自动重试')
    }
    if (!response.ok) {
      if (response.status === 401) throw new Error('Pi meme 拒绝本机免令牌登录，请使用本机 Desktop Host')
      throw new Error(`Pi meme 返回 HTTP ${response.status}，插件会自动重试`)
    }
    return response
  }

  private async state(): Promise<State | undefined> {
    const value = await jsonFile(this.statePath)
    if (value === undefined) return undefined
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.hostId !== 'string' ||
      !object(value.expected) ||
      typeof value.expected.id !== 'string' ||
      !/^magpie(?:-\d+)?$/.test(value.expected.id) ||
      typeof value.keyHash !== 'string' ||
      typeof value.applied !== 'boolean'
    )
      throw new Error('Pi meme 插件的同步记录无效，已停止修改提供商')
    return value as State
  }

  private async saveState(state: State) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const temporary = `${this.statePath}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      await rename(temporary, this.statePath)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  async sync(): Promise<SyncResult> {
    const raw = await jsonFile(this.handoffPath)
    let handoff: Handoff | undefined
    if (object(raw) && raw.gatewayKey !== undefined) {
      if (
        raw.version !== 1 ||
        typeof raw.gatewayKey !== 'string' ||
        !raw.gatewayKey ||
        !object(raw.provider) ||
        raw.provider.id !== 'magpie' ||
        !Array.isArray(raw.provider.models)
      )
        throw new Error('Magpie 连接配置不完整，已保留现有提供商')
      handoff = raw as Handoff
      await chmod(this.handoffPath, 0o600)
    } else if (raw !== undefined && (!object(raw) || raw.provider !== undefined)) {
      throw new Error('Magpie 连接配置不完整，已保留现有提供商')
    }
    const previous = await this.state()
    if ((!handoff || !handoff.provider.models.length) && !previous)
      return { status: 'idle', message: handoff ? 'Magpie 暂时没有可同步的模型，请先配置供应商或账号' : undefined }
    const statusResponse = await this.response('/api/status')
    const host = (await statusResponse.json()) as LocalHostStatus
    if (host.product !== 'pi-meme' || host.runtimeProtocolVersion !== 1 || !host.hostId || !host.instanceId)
      throw new Error('本机端口不是兼容的 Pi meme Host，未发送任何配置或密钥')
    if (previous && previous.hostId !== host.hostId) throw new Error('Pi meme Host 身份发生变化，已停止修改提供商')
    const signature = hash(JSON.stringify(handoff ?? null))
    if (this.lastSignature === signature && this.lastInstance === host.instanceId) return { status: 'idle' }
    if (this.clientInstance !== host.instanceId) this.dispose()
    this.client ??= await createNodeHostClient({
      url: this.origin,
      token: '',
      hostId: host.hostId,
      clientId: 'magpie-pi-meme',
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    }).catch(() => {
      throw new Error('Pi meme 本机认证失败，请确认 Desktop Host 允许本机免令牌登录')
    })
    this.clientInstance = host.instanceId
    const rpc = async <T>(method: string, args: unknown[] = []): Promise<T> => {
      try {
        return await this.client!.rpc<T>(method, args)
      } catch (cause) {
        if (cause instanceof Error && /正在运行|正在连接|正在修改|正在保存/.test(cause.message))
          throw new Error('Pi meme 会话或配置正在变更，等待空闲后自动同步')
        throw new Error('Pi meme 拒绝模型配置，请检查提供商 ID、协议与模型参数')
      }
    }
    const snapshot = await rpc<ModelConfigSnapshot>('models:get')
    let providerId = previous?.expected.id ?? 'magpie'
    if (!previous) {
      for (let suffix = 2; snapshot.providers.some((provider) => provider.id === providerId); suffix++)
        providerId = `magpie-${suffix}`
    }
    const current = snapshot.providers.find((provider) => provider.id === providerId)
    if (current && previous && !isDeepStrictEqual(current, previous.expected))
      throw new Error('Magpie 提供商已被手动修改，插件已暂停自动同步')
    const wanted = handoff && handoff.provider.models.length ? handoff : undefined
    if (!wanted) {
      if (current) {
        const result = await rpc<ModelConfigResult>('models:delete', [providerId, snapshot.revision])
        if (result.reconnectError) {
          await this.saveState({ ...previous!, applied: false })
          return { status: 'waiting', message: 'Magpie 提供商已移除，等待 Pi meme 空闲后重连' }
        }
      } else if (previous && !previous.applied) await rpc('models:reconnect')
      await rm(this.statePath, { force: true })
      this.lastSignature = signature
      this.lastInstance = host.instanceId
      return { status: 'removed', message: '已移除本插件创建的 Magpie 提供商' }
    }
    if (previous && !current)
      throw new Error('Magpie 提供商已被手动删除；关闭再打开 Magpie 中的 Pi meme 开关可重新连接')
    const keyHash = hash(wanted.gatewayKey)
    if (
      current &&
      previous?.keyHash === keyHash &&
      isDeepStrictEqual(current.models, wanted.provider.models) &&
      current.baseUrl === wanted.provider.baseUrl &&
      current.name === wanted.provider.name
    ) {
      if (!previous.applied) await rpc('models:reconnect')
      if (!previous.applied) await this.saveState({ ...previous, applied: true })
    } else {
      const input: SaveModelProvider = {
        revision: snapshot.revision,
        originalId: current?.id,
        provider: { ...wanted.provider, id: providerId },
        apiKey: wanted.gatewayKey,
      }
      const saved = await rpc<ModelConfigResult>('models:save', [input])
      const expected = saved.snapshot.providers.find((provider) => provider.id === providerId)
      if (!expected) throw new Error('Pi meme 没有返回已保存的 Magpie 提供商，请检查同步记录')
      await this.saveState({ version: 1, hostId: host.hostId, expected, keyHash, applied: !saved.reconnectError })
      if (saved.reconnectError) return { status: 'waiting', message: 'Magpie 模型已保存，等待 Pi meme 空闲后重连' }
    }
    this.lastSignature = signature
    this.lastInstance = host.instanceId
    return {
      status: 'applied',
      message: `已同步 ${wanted.provider.models.length} 个 Magpie 模型到 Pi meme（提供商 ${providerId}）`,
    }
  }
}
