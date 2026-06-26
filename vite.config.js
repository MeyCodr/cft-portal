import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || 3001

  return {
    base: '/phncft',
    publicDir: 'src/public',
    plugins: [
      react(),
      {
        name: 'block-root',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/' || req.url === '') {
              res.statusCode = 404
              res.end('404 Not Found')
              return
            }
            next()
          })
        }
      }
    ],
    server: {
      port: 3000,
      proxy: {
        '/phncft/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        }
      }
    }
  }
})
