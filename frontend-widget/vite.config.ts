import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { transform } from 'esbuild'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function widgetDevPlugin(): Plugin {
  return {
    name: 'widget-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/widget.js') return next()
        const src = readFileSync(resolve(__dirname, 'src/widget-entry.ts'), 'utf-8')
        const result = await transform(src, { loader: 'ts', format: 'iife' })
        res.setHeader('Content-Type', 'application/javascript')
        res.end(result.code)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), widgetDevPlugin()],
  server: { port: 3002 },
  preview: { port: 3002 },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        widget: 'src/widget-entry.ts',
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'widget' ? 'widget.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
