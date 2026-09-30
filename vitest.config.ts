import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    globals: true,
  },
  projects: [
    {
      // Tests de lógica pura / base de datos — sin DOM
      plugins: [tailwindcss(), react()],
      test: {
        name: 'node',
        environment: 'node',
        include: ['src/db/**/*.test.ts', 'src/logic/**/*.test.ts'],
      },
    },
    {
      // Tests de componentes React — necesitan jsdom
      plugins: [tailwindcss(), react()],
      test: {
        name: 'jsdom',
        environment: 'jsdom',
        include: ['src/components/**/*.test.tsx'],
        globals: true,
      },
    },
  ],
})
