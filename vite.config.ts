import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@domain': path.resolve(__dirname, './src/domain'),
        '@data': path.resolve(__dirname, './src/data'),
        '@presentation': path.resolve(__dirname, './src/presentation'),
        '@ui': path.resolve(__dirname, './src/ui'),
        '@core': path.resolve(__dirname, './src/core'),
        '@ioc': path.resolve(__dirname, './src/ioc'),
      }
    }
  };
});
