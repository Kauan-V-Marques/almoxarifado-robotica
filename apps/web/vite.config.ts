/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // No GitHub Pages o site fica em /almoxarifado-robotica/
  base: mode === 'demo' ? '/almoxarifado-robotica/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos próprios: mudam pouco e ficam no cache do navegador
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          data: ['@tanstack/react-query', 'zod', 'react-hook-form', '@hookform/resolvers'],
        },
      },
    },
  },
  server: {
    // Em desenvolvimento, /api vai para a API local (evita CORS e mantém o cookie no mesmo site)
    proxy: { '/api': 'http://localhost:3333' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // No Node o fetch exige URL absoluta
    env: { VITE_API_URL: 'http://localhost:3000' },
  },
}));
