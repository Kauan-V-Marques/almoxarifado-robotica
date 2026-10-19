import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes usam um banco real; rodar um arquivo por vez evita disputa pelos dados
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
