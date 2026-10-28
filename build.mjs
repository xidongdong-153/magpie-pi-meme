import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
await Promise.all([
  build({
    entryPoints: [path.join(directory, 'src/agent.ts')],
    outfile: path.join(directory, 'agent.js'),
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2020',
    legalComments: 'none',
  }),
  build({
    entryPoints: [path.join(directory, 'src/index.ts')],
    outfile: path.join(directory, 'index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    legalComments: 'none',
  }),
])
console.log('已生成 Magpie Agent 入口 agent.js 和同步入口 index.js')
