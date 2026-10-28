// src/index.ts
import { chmod as chmod2, mkdir as mkdir2 } from 'node:fs/promises'
import { homedir } from 'node:os'
import path2 from 'node:path'
import { clearInterval, setInterval } from 'node:timers'

// src/bridge.ts
import { createHash, randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

// ../../../packages/client/src/app-host-client.ts
function createAppHostClient(transport) {
  function call(method, args, idempotencyKey) {
    let length = args.length
    while (length && args[length - 1] === void 0) length--
    return transport.call(method, args.slice(0, length), idempotencyKey)
  }
  return {
    apiVersion: 2,
    models: { list: () => call('models.list', []) },
    imageGeneration: {
      getConfig: () => call('imageGeneration.getConfig', []),
      saveModel: (input) => call('imageGeneration.saveModel', [input]),
      deleteModel: (id, revision) => call('imageGeneration.deleteModel', [id, revision]),
      setDefault: (id, revision) => call('imageGeneration.setDefault', [id, revision]),
      test: (id) => call('imageGeneration.test', [id]),
    },
    schedules: {
      list: () => call('schedules.list', []),
      get: (ref) => call('schedules.get', [ref]),
      create: (input, options) => call('schedules.create', [input], options.idempotencyKey),
      update: (ref, input, options) => call('schedules.update', [ref, input], options.idempotencyKey),
      pause: (ref, options) => call('schedules.pause', [ref], options.idempotencyKey),
      resume: (ref, options) => call('schedules.resume', [ref], options.idempotencyKey),
      delete: (ref, options) => call('schedules.delete', [ref], options.idempotencyKey),
      runNow: (ref, options) => call('schedules.runNow', [ref], options.idempotencyKey),
      stopRun: (ref, options) => call('schedules.stopRun', [ref], options.idempotencyKey),
      runs: (ref, input) => call('schedules.runs', [ref, input]),
      markRead: (ref, runId, options) => call('schedules.markRead', [ref, runId], options.idempotencyKey),
      resetSession: (ref, options) => call('schedules.resetSession', [ref], options.idempotencyKey),
    },
    capabilities: () => call('capabilities', []),
    plugins: {
      getDefaultAgentPlugins: () => call('plugins.getDefaultAgentPlugins', []),
      setDefaultAgentPlugins: (ids, options) => call('plugins.setDefaultAgentPlugins', [ids], options.idempotencyKey),
    },
    projects: {
      list: () => call('projects.list', []),
      get: (ref) => call('projects.get', [ref]),
      register: (input, options) => call('projects.register', [input], options.idempotencyKey),
    },
    sessions: {
      create: (input, options) => call('sessions.create', [input], options.idempotencyKey),
      list: (input) => call('sessions.list', [input]),
      get: (ref) => call('sessions.get', [ref]),
      snapshot: (ref) => call('sessions.snapshot', [ref]),
      history: (ref, input) => call('sessions.history', [ref, input]),
      messages: (ref, input) => call('sessions.messages', [ref, input]),
      message: (ref, input) => call('sessions.message', [ref, input]),
      configure: (ref, config, options) => call('sessions.configure', [ref, config], options.idempotencyKey),
      submit: (ref, input, options) => call('sessions.submit', [ref, input], options.idempotencyKey),
      stop: (ref, options) => call('sessions.stop', [ref], options.idempotencyKey),
      stopTask: (ref, options) => call('sessions.stopTask', [ref], options.idempotencyKey),
      continueTask: (ref, configuration, options) =>
        call('sessions.continueTask', [ref, configuration ?? null], options.idempotencyKey),
      pause: (ref, options) => call('sessions.pause', [ref], options.idempotencyKey),
      resume: (ref, options) => call('sessions.resume', [ref], options.idempotencyKey),
      receipt: (id) => call('sessions.receipt', [id]),
      submissions: (ref) => call('sessions.submissions', [ref]),
      cancelSubmission: (id, options) => call('sessions.cancelSubmission', [id], options.idempotencyKey),
    },
    events: {
      read: (input) => call('events.read', [input]),
      subscribe: transport.subscribe.bind(transport),
    },
    files: {
      list: (ref, relativePath) => call('files.list', [ref, relativePath]),
      read: (ref, relativePath) => call('files.read', [ref, relativePath]),
      preview: (ref, relativePath) => call('files.preview', [ref, relativePath]),
      search: (ref, input) => call('files.search', [ref, input]),
      write: (ref, input, options) => call('files.write', [ref, input], options.idempotencyKey),
    },
    terminal: {
      open: (ref, input, options) => call('terminal.open', [ref, input], options.idempotencyKey),
      attach: (ref) => call('terminal.attach', [ref]),
      input: (ref, data, options) => call('terminal.input', [ref, data], options.idempotencyKey),
      resize: (ref, size, options) => call('terminal.resize', [ref, size], options.idempotencyKey),
      close: (ref, options) => call('terminal.close', [ref], options.idempotencyKey),
    },
    git: {
      environment: (ref) => call('git.environment', [ref]),
      snapshot: (ref) => call('git.snapshot', [ref]),
      diff: (ref, input) => call('git.diff', [ref, input]),
    },
    interaction: {
      respond: (ref, input, options) => call('interaction.respond', [ref, input], options.idempotencyKey),
    },
    agents: {
      list: (ref) => call('agents.list', [ref]),
      get: (id) => call('agents.get', [id]),
      stop: (id, options) => call('agents.stop', [id], options.idempotencyKey),
    },
    activities: {
      list: (ref) => call('activities.list', [ref]),
      logs: (ref, id) => call('activities.logs', [ref, id]),
      stop: (ref, id, options) => call('activities.stop', [ref, id], options.idempotencyKey),
    },
    goals: {
      get: (ref) => call('goals.get', [ref]),
      start: (ref, input, options) => call('goals.start', [ref, input], options.idempotencyKey),
      edit: (ref, input, options) => call('goals.edit', [ref, input], options.idempotencyKey),
      pause: (ref, input, options) => call('goals.pause', [ref, input], options.idempotencyKey),
      resume: (ref, input, options) => call('goals.resume', [ref, input], options.idempotencyKey),
      clear: (ref, input, options) => call('goals.clear', [ref, input], options.idempotencyKey),
    },
    plans: { list: (ref) => call('plans.list', [ref]) },
  }
}

// ../../../packages/client/src/node-host-client.ts
async function createNodeHostClient(options) {
  const request = options.fetch ?? fetch
  const baseUrl = new URL(options.url)
  if (
    baseUrl.username ||
    baseUrl.password ||
    (baseUrl.protocol !== 'https:' &&
      !(baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname)))
  )
    throw new Error(
      '\u8FDC\u7A0B Host \u5FC5\u987B\u4F7F\u7528\u4E0D\u542B\u8D26\u53F7\u4FE1\u606F\u7684 HTTPS \u5730\u5740',
    )
  let hostId = options.hostId
  let cookie = ''
  let authentication
  let disposed = false
  const closers = /* @__PURE__ */ new Set()
  const authenticate = () => {
    authentication ??= (async () => {
      const response = await request(new URL('/api/auth', options.url), {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(3e4),
        headers: { 'Content-Type': 'application/json', Origin: baseUrl.origin },
        body: JSON.stringify({ token: options.token }),
      })
      if (!response.ok) throw new Error('Host \u767B\u5F55\u5931\u8D25')
      const identity = await response.json()
      if (!identity.hostId || (hostId && hostId !== identity.hostId))
        throw new Error('Host \u8EAB\u4EFD\u5DF2\u53D8\u5316')
      hostId = identity.hostId
      cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
      if (!cookie) throw new Error('Host \u6CA1\u6709\u8FD4\u56DE\u8BA4\u8BC1 Cookie')
    })().finally(() => {
      authentication = void 0
    })
    return authentication
  }
  await authenticate()
  async function call(pathname, input) {
    if (disposed) throw new Error('Host \u5BA2\u6237\u7AEF\u5DF2\u5173\u95ED')
    const body = JSON.stringify({ ...input, hostId, clientId: options.clientId })
    const send = () =>
      request(new URL(pathname, options.url), {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: baseUrl.origin },
        body,
      })
    let response = await send()
    if (response.status === 401) {
      await authenticate()
      if (disposed) throw new Error('Host \u5BA2\u6237\u7AEF\u5DF2\u5173\u95ED')
      response = await send()
    }
    const value = await response.json()
    if (!response.ok) {
      const error = value.error
      throw new Error(typeof error === 'string' ? error : `Host \u8BF7\u6C42\u5931\u8D25\uFF1A${response.status}`)
    }
    if (value.hostId !== hostId) throw new Error('Host \u8EAB\u4EFD\u5DF2\u53D8\u5316')
    if (pathname === '/api/rpc' && (!('requestId' in value) || value.requestId !== input.requestId))
      throw new Error('Host \u8FD4\u56DE\u4E86\u4E0D\u5339\u914D\u7684\u8BF7\u6C42\u6807\u8BC6')
    if (value.error) throw Object.assign(new Error(value.error.message), { code: value.error.code })
    return value.result
  }
  const api = createAppHostClient({
    call: (method, args, idempotencyKey) => call('/api/control', { apiVersion: 2, method, args, idempotencyKey }),
    async subscribe(input, listener) {
      const webSocket = options.webSocket
      if (!webSocket) throw new Error('\u6B64 Node \u5BA2\u6237\u7AEF\u672A\u914D\u7F6E WebSocket')
      let stopped = false
      let timer
      let socket
      let after = input.after
      async function connect() {
        if (stopped || disposed) return
        await authenticate()
        if (stopped || disposed) return
        const url = new URL('/api/control/events', options.url)
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        url.searchParams.set('clientId', options.clientId)
        url.searchParams.set('subscription', JSON.stringify({ ...input, after }))
        socket = webSocket(url.toString(), { Cookie: cookie, Origin: baseUrl.origin })
        socket.on('message', (data) => {
          let event
          try {
            event = JSON.parse(data.toString())
          } catch {
            socket?.close()
            return
          }
          if (event.hostId !== hostId) {
            stopped = true
            socket?.close()
            return
          }
          if (
            event.stream !== 'live' &&
            event.type !== 'resync' &&
            after?.journalEpoch === event.journalEpoch &&
            after.seq >= event.seq
          )
            return
          if (event.stream !== 'live') after = { journalEpoch: event.journalEpoch, seq: event.seq }
          listener(event)
        })
        socket.on('error', () => socket?.close())
        socket.on('close', () => {
          if (!stopped && !disposed)
            timer = setTimeout(() => {
              void connect().catch(schedule)
            }, 1e3)
        })
      }
      function schedule() {
        if (!stopped && !disposed)
          timer = setTimeout(() => {
            void connect().catch(schedule)
          }, 1e3)
      }
      await connect()
      const close = () => {
        stopped = true
        if (timer) clearTimeout(timer)
        socket?.close()
        closers.delete(close)
      }
      closers.add(close)
      return close
    },
  })
  return Object.assign(api, {
    rpc: (method, args = []) => call('/api/rpc', { requestId: crypto.randomUUID(), method, args }),
    dispose() {
      disposed = true
      for (const close of [...closers]) close()
    },
  })
}

// src/bridge.ts
async function jsonFile(file) {
  let content
  try {
    content = await readFile(file, 'utf8')
  } catch (cause) {
    if (cause.code === 'ENOENT') return void 0
    throw new Error(
      '\u65E0\u6CD5\u8BFB\u53D6 Pi meme \u63D2\u4EF6\u7684\u79C1\u6709\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u6743\u9650',
    )
  }
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(
      'Pi meme \u63D2\u4EF6\u7684\u79C1\u6709\u914D\u7F6E\u4E0D\u662F\u6709\u6548 JSON\uFF0C\u5DF2\u4FDD\u7559\u73B0\u6709\u63D0\u4F9B\u5546',
    )
  }
}
function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
var Bridge = class {
  constructor(directory, hostUrl = 'http://127.0.0.1:3185') {
    this.directory = directory
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
      throw new Error('\u672C\u673A\u8BD5\u7528\u63D2\u4EF6\u53EA\u8FDE\u63A5 127.0.0.1 \u4E0A\u7684 Pi meme Host')
    this.origin = url.origin
    this.handoffPath = path.join(directory, 'agent.json')
    this.statePath = path.join(directory, 'bridge-state.json')
  }
  directory
  lastSignature
  lastInstance
  client
  clientInstance
  handoffPath
  statePath
  origin
  dispose() {
    this.client?.dispose()
    this.client = void 0
  }
  async response(url, init) {
    let response
    try {
      response = await fetch(`${this.origin}${url}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(5e3) })
    } catch {
      throw new Error('\u7B49\u5F85\u672C\u673A Pi meme \u542F\u52A8\uFF0C\u63D2\u4EF6\u4F1A\u81EA\u52A8\u91CD\u8BD5')
    }
    if (!response.ok) {
      if (response.status === 401)
        throw new Error(
          'Pi meme \u62D2\u7EDD\u672C\u673A\u514D\u4EE4\u724C\u767B\u5F55\uFF0C\u8BF7\u4F7F\u7528\u672C\u673A Desktop Host',
        )
      throw new Error(`Pi meme \u8FD4\u56DE HTTP ${response.status}\uFF0C\u63D2\u4EF6\u4F1A\u81EA\u52A8\u91CD\u8BD5`)
    }
    return response
  }
  async state() {
    const value = await jsonFile(this.statePath)
    if (value === void 0) return void 0
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
      throw new Error(
        'Pi meme \u63D2\u4EF6\u7684\u540C\u6B65\u8BB0\u5F55\u65E0\u6548\uFF0C\u5DF2\u505C\u6B62\u4FEE\u6539\u63D0\u4F9B\u5546',
      )
    return value
  }
  async saveState(state) {
    await mkdir(this.directory, { recursive: true, mode: 448 })
    const temporary = `${this.statePath}.${randomUUID()}.tmp`
    try {
      await writeFile(
        temporary,
        `${JSON.stringify(state, null, 2)}
`,
        { mode: 384, flag: 'wx' },
      )
      await rename(temporary, this.statePath)
    } finally {
      await rm(temporary, { force: true })
    }
  }
  async sync() {
    const raw = await jsonFile(this.handoffPath)
    let handoff
    if (object(raw) && raw.gatewayKey !== void 0) {
      if (
        raw.version !== 1 ||
        typeof raw.gatewayKey !== 'string' ||
        !raw.gatewayKey ||
        !object(raw.provider) ||
        raw.provider.id !== 'magpie' ||
        !Array.isArray(raw.provider.models)
      )
        throw new Error(
          'Magpie \u8FDE\u63A5\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u5DF2\u4FDD\u7559\u73B0\u6709\u63D0\u4F9B\u5546',
        )
      handoff = raw
      await chmod(this.handoffPath, 384)
    } else if (raw !== void 0 && (!object(raw) || raw.provider !== void 0)) {
      throw new Error(
        'Magpie \u8FDE\u63A5\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u5DF2\u4FDD\u7559\u73B0\u6709\u63D0\u4F9B\u5546',
      )
    }
    const previous = await this.state()
    if ((!handoff || !handoff.provider.models.length) && !previous)
      return {
        status: 'idle',
        message: handoff
          ? 'Magpie \u6682\u65F6\u6CA1\u6709\u53EF\u540C\u6B65\u7684\u6A21\u578B\uFF0C\u8BF7\u5148\u914D\u7F6E\u4F9B\u5E94\u5546\u6216\u8D26\u53F7'
          : void 0,
      }
    const statusResponse = await this.response('/api/status')
    const host = await statusResponse.json()
    if (host.product !== 'pi-meme' || host.runtimeProtocolVersion !== 1 || !host.hostId || !host.instanceId)
      throw new Error(
        '\u672C\u673A\u7AEF\u53E3\u4E0D\u662F\u517C\u5BB9\u7684 Pi meme Host\uFF0C\u672A\u53D1\u9001\u4EFB\u4F55\u914D\u7F6E\u6216\u5BC6\u94A5',
      )
    if (previous && previous.hostId !== host.hostId)
      throw new Error(
        'Pi meme Host \u8EAB\u4EFD\u53D1\u751F\u53D8\u5316\uFF0C\u5DF2\u505C\u6B62\u4FEE\u6539\u63D0\u4F9B\u5546',
      )
    const signature = hash(JSON.stringify(handoff ?? null))
    if (this.lastSignature === signature && this.lastInstance === host.instanceId) return { status: 'idle' }
    if (this.clientInstance !== host.instanceId) this.dispose()
    this.client ??= await createNodeHostClient({
      url: this.origin,
      token: '',
      hostId: host.hostId,
      clientId: 'magpie-pi-meme',
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5e3) }),
    }).catch(() => {
      throw new Error(
        'Pi meme \u672C\u673A\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u786E\u8BA4 Desktop Host \u5141\u8BB8\u672C\u673A\u514D\u4EE4\u724C\u767B\u5F55',
      )
    })
    this.clientInstance = host.instanceId
    const rpc = async (method, args = []) => {
      try {
        return await this.client.rpc(method, args)
      } catch (cause) {
        if (cause instanceof Error && /正在运行|正在连接|正在修改|正在保存/.test(cause.message))
          throw new Error(
            'Pi meme \u4F1A\u8BDD\u6216\u914D\u7F6E\u6B63\u5728\u53D8\u66F4\uFF0C\u7B49\u5F85\u7A7A\u95F2\u540E\u81EA\u52A8\u540C\u6B65',
          )
        throw new Error(
          'Pi meme \u62D2\u7EDD\u6A21\u578B\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u63D0\u4F9B\u5546 ID\u3001\u534F\u8BAE\u4E0E\u6A21\u578B\u53C2\u6570',
        )
      }
    }
    const snapshot = await rpc('models:get')
    let providerId = previous?.expected.id ?? 'magpie'
    if (!previous) {
      for (let suffix = 2; snapshot.providers.some((provider) => provider.id === providerId); suffix++)
        providerId = `magpie-${suffix}`
    }
    const current = snapshot.providers.find((provider) => provider.id === providerId)
    if (current && previous && !isDeepStrictEqual(current, previous.expected))
      throw new Error(
        'Magpie \u63D0\u4F9B\u5546\u5DF2\u88AB\u624B\u52A8\u4FEE\u6539\uFF0C\u63D2\u4EF6\u5DF2\u6682\u505C\u81EA\u52A8\u540C\u6B65',
      )
    const wanted = handoff && handoff.provider.models.length ? handoff : void 0
    if (!wanted) {
      if (current) {
        const result = await rpc('models:delete', [providerId, snapshot.revision])
        if (result.reconnectError) {
          await this.saveState({ ...previous, applied: false })
          return {
            status: 'waiting',
            message:
              'Magpie \u63D0\u4F9B\u5546\u5DF2\u79FB\u9664\uFF0C\u7B49\u5F85 Pi meme \u7A7A\u95F2\u540E\u91CD\u8FDE',
          }
        }
      } else if (previous && !previous.applied) await rpc('models:reconnect')
      await rm(this.statePath, { force: true })
      this.lastSignature = signature
      this.lastInstance = host.instanceId
      return {
        status: 'removed',
        message: '\u5DF2\u79FB\u9664\u672C\u63D2\u4EF6\u521B\u5EFA\u7684 Magpie \u63D0\u4F9B\u5546',
      }
    }
    if (previous && !current)
      throw new Error(
        'Magpie \u63D0\u4F9B\u5546\u5DF2\u88AB\u624B\u52A8\u5220\u9664\uFF1B\u5173\u95ED\u518D\u6253\u5F00 Magpie \u4E2D\u7684 Pi meme \u5F00\u5173\u53EF\u91CD\u65B0\u8FDE\u63A5',
      )
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
      const input = {
        revision: snapshot.revision,
        originalId: current?.id,
        provider: { ...wanted.provider, id: providerId },
        apiKey: wanted.gatewayKey,
      }
      const saved = await rpc('models:save', [input])
      const expected = saved.snapshot.providers.find((provider) => provider.id === providerId)
      if (!expected)
        throw new Error(
          'Pi meme \u6CA1\u6709\u8FD4\u56DE\u5DF2\u4FDD\u5B58\u7684 Magpie \u63D0\u4F9B\u5546\uFF0C\u8BF7\u68C0\u67E5\u540C\u6B65\u8BB0\u5F55',
        )
      await this.saveState({ version: 1, hostId: host.hostId, expected, keyHash, applied: !saved.reconnectError })
      if (saved.reconnectError)
        return {
          status: 'waiting',
          message: 'Magpie \u6A21\u578B\u5DF2\u4FDD\u5B58\uFF0C\u7B49\u5F85 Pi meme \u7A7A\u95F2\u540E\u91CD\u8FDE',
        }
    }
    this.lastSignature = signature
    this.lastInstance = host.instanceId
    return {
      status: 'applied',
      message: `\u5DF2\u540C\u6B65 ${wanted.provider.models.length} \u4E2A Magpie \u6A21\u578B\u5230 Pi meme\uFF08\u63D0\u4F9B\u5546 ${providerId}\uFF09`,
    }
  }
}

// src/index.ts
var stopPrevious
async function piMeme(input, options = {}) {
  stopPrevious?.()
  const directory = path2.join(homedir(), '.config/pi-meme-magpie')
  await mkdir2(directory, { recursive: true, mode: 448 })
  await chmod2(directory, 448)
  const bridge = new Bridge(directory, options.hostUrl)
  let stopped = false
  let running = false
  let lastMessage = ''
  const report = async (message, level) => {
    if (message === lastMessage) return
    lastMessage = message
    await input.client.app.log({ body: { service: 'pi-meme', level, message } })
  }
  const tick = async () => {
    if (stopped || running) return
    running = true
    try {
      const result = await bridge.sync()
      if (result.message) await report(result.message, result.status === 'waiting' ? 'warn' : 'info')
    } catch (cause) {
      if (!stopped)
        await report(
          cause instanceof Error
            ? cause.message
            : 'Pi meme \u6A21\u578B\u540C\u6B65\u5931\u8D25\uFF0C\u7A0D\u540E\u81EA\u52A8\u91CD\u8BD5',
          'warn',
        )
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => {
    void tick()
  }, 2e3)
  timer.unref()
  stopPrevious = () => {
    stopped = true
    clearInterval(timer)
    bridge.dispose()
  }
  void tick()
  return {}
}
export { piMeme as default }
