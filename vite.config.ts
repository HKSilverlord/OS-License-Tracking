import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Supabase credentials reach the client through Vite's own `import.meta.env`
// (VITE_* prefix), so no loadEnv/define plumbing is needed here.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
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
});
