import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './src/lib')
    }
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-backend-cpu',
      '@mediapipe/pose',
      '@mediapipe/face_detection',
      '@mediapipe/face_mesh'
    ],
    exclude: ['@tensorflow/tfjs-backend-webgpu']
  },
  envDir: '.',
  server: {
    watch: {
      usePolling: true,
      interval: 100
    },
    host: true,
    port: 5174,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // no rewrite: keep /api prefix so Express sees /api/*
      }
    },
    hmr: {
      timeout: 5000
    },
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
    headers: {
      'Cache-Control': 'public, max-age=600',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      external: ['@tensorflow/tfjs-backend-webgpu'],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom']
        }
      }
    }
  },
  json: {
    stringify: true
  }
})