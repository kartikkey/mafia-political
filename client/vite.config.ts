import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))
const dirs = ['api', 'assets', 'common', 'components', 'config', 'constants', 'helpers', 'layout', 'pages', 'routes', 'slices', 'utils']

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...dirs.map((d) => ({ find: new RegExp(`^${d}/`), replacement: `${src(d)}/` })),
      { find: /^store$/, replacement: src('store.ts') },
    ],
  },
  server: { port: 5173, host: true },
})
