// Bundles the standalone desktop-proxy + sweeper service (railway/server.ts) for
// deployment to Railway. See railway/server.ts for why this needs bundling.
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

await esbuild.build({
  entryPoints: [path.join(root, 'railway/server.ts')],
  outfile: path.join(root, 'dist/railway-server.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  alias: { 'server-only': path.join(root, 'railway/server-only-stub.js') },
  external: ['@prisma/client', '.prisma/client'],
  logLevel: 'info',
})

console.log('Built dist/railway-server.js')
