import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))
const dirs = ['api', 'assets', 'common', 'components', 'config', 'constants', 'helpers', 'layout', 'pages', 'routes', 'slices', 'utils']

export default defineConfig(({ mode }) => {
  const e = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  return {
    plugins: [react()],
    resolve: {
      alias: [
        ...dirs.map((d) => ({ find: new RegExp(`^${d}/`), replacement: `${src(d)}/` })),
        { find: /^store$/, replacement: src('store.ts') },
        { find: /^@netagiri\/shared$/, replacement: src('shared/index.ts') },
      ],
    },
    build: { outDir: 'build' },
    server: {
      port: Number(process.env.PORT || 5173),
      host: true,
      allowedHosts: true,
      // Local dev: same-origin /api (socket.io) is forwarded to the game server.
      proxy: e.VITE_PROXY_TARGET ? { '/api': { target: e.VITE_PROXY_TARGET, ws: true, changeOrigin: true } } : undefined,
    },
  }
})
