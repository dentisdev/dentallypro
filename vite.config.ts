import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const cwd = (process as any).cwd ? (process as any).cwd() : '.';
  const env = loadEnv(mode, cwd, '');

  const apiKey = 
    process.env.API_KEY || 
    process.env.VITE_API_KEY || 
    process.env.GOOGLE_API_KEY || 
    env.API_KEY || 
    env.VITE_API_KEY || 
    '';

  return {
    // Changed base to empty string for relative paths (Critical for GitHub Pages)
    base: '', 
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    build: {
      outDir: 'dist',
      target: 'esnext',
    }
  };
});