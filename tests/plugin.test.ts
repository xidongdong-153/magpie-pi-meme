import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type {
  ConfiguredModel,
  ConfiguredProvider,
  ModelConfigSnapshot,
  SaveModelProvider,
} from '@pi-meme/contracts/model-config'
import { agent, connect } from '../src/agent.ts'
import { Bridge } from '../src/bridge.ts'

const gateway = { url: 'http://127.0.0.1:3425', v1: 'http://127.0.0.1:3425/v1', key: 'fixture-magpie-key' }
const models = [
  {
    id: 'vendor/model.with.dots',
    name: '测试模型',
    context: 128000,
    output: 16000,
    images: true,
    efforts: ['low', 'high', 'xhigh'],
  },
]

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'magpie-pi-meme-'))
  const handoff = path.join(directory, 'agent.json')
  const state = {
    hostId: 'fixture-host',
    instanceId: 'fixture-instance',
    revision: 0,
    provider: undefined as ConfiguredProvider | undefined,
    others: [] as ConfiguredProvider[],
    key: '',
    busy: false,
    failReconnect: false,
    saves: 0,
    deletes: 0,
    reconnects: 0,
  }
  const snapshot = (): ModelConfigSnapshot => ({
    path: '/fixture/models.json',
    revision: String(state.revision),
    providers: structuredClone([...state.others, ...(state.provider ? [state.provider] : [])]),
  })
  const server = createServer(async (request, response) => {
    const send = (value: unknown, status = 200, headers: Record<string, string> = {}) => {
      response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
      response.end(JSON.stringify(value))
    }
    if (request.url === '/api/status')
      return send({ product: 'pi-meme', runtimeProtocolVersion: 1, hostId: state.hostId, instanceId: state.instanceId })
    if (request.url === '/api/auth') {
      assert.equal(request.headers.origin, `http://127.0.0.1:${(server.address() as { port: number }).port}`)
      return send({ hostId: state.hostId }, 200, { 'Set-Cookie': 'fixture-session=local; HttpOnly; Path=/' })
    }
    if (request.url !== '/api/rpc' || request.headers.cookie !== 'fixture-session=local') return send({}, 401)
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      requestId: string
      hostId: string
      method: string
      args: unknown[]
    }
    const result = (value: unknown) => send({ requestId: input.requestId, hostId: state.hostId, result: value })
    const error = (message: string) =>
      send({ requestId: input.requestId, hostId: state.hostId, error: { code: 'fixture-error', message } })
    assert.equal(input.hostId, state.hostId)
    if (input.method === 'models:get') return result(snapshot())
    if (state.busy) return error('有会话正在运行，请停止后再修改运行时配置')
    if (input.method === 'models:save') {
      const value = input.args[0] as SaveModelProvider
      if (value.revision !== String(state.revision)) return error('修订冲突')
      if (state.others.some((provider) => provider.id === value.provider.id)) return error('不能修改既有提供商')
      if (state.provider && value.originalId !== state.provider.id) return error('服务商 ID 已存在')
      state.key = value.apiKey ?? state.key
      const reordered = value.provider.models.map(
        (model) =>
          Object.fromEntries(
            Object.entries(model).sort(([left], [right]) => left.localeCompare(right)),
          ) as ConfiguredModel,
      )
      state.provider = { ...value.provider, models: reordered, hasApiKey: Boolean(state.key) }
      state.revision++
      state.saves++
      return result({
        snapshot: snapshot(),
        reconnectError: state.failReconnect ? '配置已保存，但重连失败' : undefined,
      })
    }
    if (input.method === 'models:delete') {
      assert.deepEqual(input.args, [state.provider?.id, String(state.revision)])
      state.provider = undefined
      state.key = ''
      state.revision++
      state.deletes++
      return result({
        snapshot: snapshot(),
        reconnectError: state.failReconnect ? '删除已保存，但重连失败' : undefined,
      })
    }
    if (input.method === 'models:reconnect') {
      if (state.failReconnect) return error('重连失败')
      state.reconnects++
      return result(undefined)
    }
    return error('方法不存在')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  const origin = `http://127.0.0.1:${port}`
  const bridge = new Bridge(directory, origin)
  return {
    origin,
    directory,
    handoff,
    state,
    bridge,
    async connected(key = gateway.key) {
      await writeFile(handoff, JSON.stringify(connect({ gateway: { ...gateway, key }, models })), { mode: 0o600 })
    },
    async dispose() {
      bridge.dispose()
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test('Agent 不绑定默认模型；保留模型 ID、已知能力和独立密钥字段', () => {
  assert.equal('model' in agent, false)
  const connected = connect({ gateway, models: [...models, { id: 'vendor/id-only' }] })
  assert.equal(connected.gatewayKey, gateway.key)
  assert.equal(connected.provider.id, 'magpie')
  assert.equal(connected.provider.api, 'openai-completions')
  const full = connected.provider.models.find((model) => model.id === models[0].id)!
  assert.equal(full.contextWindow, 128000)
  assert.deepEqual(full.input, ['text', 'image'])
  assert.deepEqual(full.thinkingLevelMap, {
    minimal: null,
    low: 'low',
    medium: null,
    high: 'high',
    xhigh: 'xhigh',
    max: null,
  })
  const minimal = connected.provider.models.find((model) => model.id === 'vendor/id-only')!
  assert.equal(minimal.contextWindow, undefined)
  assert.equal(minimal.maxTokens, undefined)
  assert.equal(minimal.reasoning, false)
})

test('空模型目录不连接 Host，也不创建空提供商', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'magpie-pi-meme-empty-'))
  try {
    await writeFile(path.join(directory, 'agent.json'), JSON.stringify(connect({ gateway, models: [] })), {
      mode: 0o600,
    })
    assert.equal((await new Bridge(directory, 'http://127.0.0.1:1').sync()).status, 'idle')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('通过本机认证 RPC 注入、幂等保持、轮换密钥，关闭后只清理自己的提供商', async () => {
  const f = await fixture()
  try {
    await f.connected()
    assert.equal((await f.bridge.sync()).status, 'applied')
    assert.equal(f.state.provider?.id, 'magpie')
    assert.equal(f.state.provider?.models[0].id, models[0].id)
    assert.equal(f.state.key, gateway.key)
    const saved = await readFile(path.join(f.directory, 'bridge-state.json'), 'utf8')
    assert.ok(!saved.includes(gateway.key))
    assert.equal((await f.bridge.sync()).status, 'idle')
    assert.equal(f.state.saves, 1)
    await f.connected('rotated-fixture-key')
    assert.equal((await f.bridge.sync()).status, 'applied')
    assert.equal(f.state.saves, 2)
    assert.equal(f.state.key, 'rotated-fixture-key')
    if (process.platform !== 'win32') assert.equal((await stat(f.handoff)).mode & 0o777, 0o600)
    await writeFile(f.handoff, '{}')
    assert.equal((await f.bridge.sync()).status, 'removed')
    assert.equal(f.state.provider, undefined)
    assert.equal(f.state.key, '')
    assert.equal(f.state.deletes, 1)
    assert.equal((await f.bridge.sync()).status, 'idle')
  } finally {
    await f.dispose()
  }
})

test('忙碌不写入；保存或删除后的重连失败可重试，重复尝试不重写密钥', async () => {
  const f = await fixture()
  try {
    await f.connected()
    f.state.busy = true
    await assert.rejects(f.bridge.sync(), /空闲/)
    assert.equal(f.state.saves, 0)
    assert.equal(f.state.key, '')
    f.state.busy = false
    f.state.failReconnect = true
    assert.equal((await f.bridge.sync()).status, 'waiting')
    f.state.failReconnect = false
    assert.equal((await f.bridge.sync()).status, 'applied')
    assert.equal(f.state.saves, 1)
    assert.equal(f.state.reconnects, 1)
    f.state.failReconnect = true
    await writeFile(f.handoff, '{}')
    assert.equal((await f.bridge.sync()).status, 'waiting')
    f.state.failReconnect = false
    assert.equal((await f.bridge.sync()).status, 'removed')
    assert.equal(f.state.deletes, 1)
    assert.equal(f.state.reconnects, 2)
  } finally {
    await f.dispose()
  }
})

test('已有同名提供商时自动选择空闲 ID，重启、更新和断开仅操作插件自己的条目', async () => {
  const f = await fixture()
  try {
    await f.connected()
    const original = connect({ gateway, models }).provider
    f.state.others = [
      { ...original, name: '用户已有配置', api: 'openai-responses', hasApiKey: true },
      { ...original, id: 'magpie-2', name: '另一条已有配置', hasApiKey: false },
    ]
    const unchanged = structuredClone(f.state.others)
    assert.equal((await f.bridge.sync()).status, 'applied')
    assert.equal(f.state.provider?.id, 'magpie-3')
    assert.deepEqual(f.state.others, unchanged)
    f.bridge.dispose()
    const restarted = new Bridge(f.directory, f.origin)
    try {
      await f.connected('rotated-after-restart')
      assert.equal((await restarted.sync()).status, 'applied')
      assert.equal(f.state.provider?.id, 'magpie-3')
      assert.equal(f.state.saves, 2)
      await writeFile(f.handoff, '{}')
      assert.equal((await restarted.sync()).status, 'removed')
      assert.equal(f.state.provider, undefined)
      assert.deepEqual(f.state.others, unchanged)
    } finally {
      restarted.dispose()
    }
  } finally {
    await f.dispose()
  }
})

test('手工修改插件创建的配置后暂停同步', async () => {
  const f = await fixture()
  try {
    await f.connected()
    await f.bridge.sync()
    f.state.provider!.name = '用户修改的名称'
    await f.connected('changed-key')
    await assert.rejects(f.bridge.sync(), /手动修改/)
    assert.equal(f.state.saves, 1)
    assert.equal(f.state.provider!.name, '用户修改的名称')
  } finally {
    await f.dispose()
  }
})

test('损坏的配置不泄露正文；Host 身份变化时停止同步；删除连接文件等同关闭', async () => {
  const f = await fixture()
  try {
    await f.connected()
    await f.bridge.sync()
    await writeFile(f.handoff, '{ "key": fixture-private-content')
    await assert.rejects(
      f.bridge.sync(),
      (cause: unknown) => cause instanceof Error && !cause.message.includes('fixture-private-content'),
    )
    assert.equal(f.state.saves, 1)
    await f.connected()
    f.state.hostId = 'different-host'
    await assert.rejects(f.bridge.sync(), /身份发生变化/)
    f.state.hostId = 'fixture-host'
    await rm(f.handoff)
    assert.equal((await f.bridge.sync()).status, 'removed')
  } finally {
    await f.dispose()
  }
})
