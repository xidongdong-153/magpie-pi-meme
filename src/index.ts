import { chmod, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { clearInterval, setInterval } from 'node:timers'
import { Bridge } from './bridge.js'

type PluginInput = {
  client: { app: { log: (input: { body: { service: string; level: string; message: string } }) => Promise<unknown> } }
}
let stopPrevious: (() => void) | undefined

export default async function piMeme(input: PluginInput, options: { hostUrl?: string } = {}) {
  stopPrevious?.()
  const directory = path.join(homedir(), '.config/pi-meme-magpie')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const bridge = new Bridge(directory, options.hostUrl)
  let stopped = false
  let running = false
  let lastMessage = ''
  const report = async (message: string, level: string) => {
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
      if (!stopped) await report(cause instanceof Error ? cause.message : 'Pi meme 模型同步失败，稍后自动重试', 'warn')
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => {
    void tick()
  }, 2000)
  timer.unref()
  stopPrevious = () => {
    stopped = true
    clearInterval(timer)
    bridge.dispose()
  }
  void tick()
  return {}
}
