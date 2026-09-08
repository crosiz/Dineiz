import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      // @dineiz/pos-logic is a pnpm workspace package reached through a
      // symlink in node_modules. Vite/Rollup decide whether a CJS module
      // needs CJS->ESM conversion by checking whether its *resolved* path
      // contains "node_modules" — but pnpm symlinks resolve outside of it
      // (to packages/pos-logic/dist/index.js), so that check silently
      // fails and Rollup falls back to a shallower export scan that misses
      // most of pos-logic's named exports (formatPKR, computeOrderTotals,
      // etc. all come back `undefined` in a production build — confirmed
      // by actually running `pnpm build` and grepping the output, not
      // assumed). preserveSymlinks keeps Vite working off the
      // node_modules/@dineiz/pos-logic import path instead of resolving
      // through the symlink, so the node_modules check matches and the
      // conversion runs correctly, same as it does for a normal dependency.
      preserveSymlinks: true,
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    // Dev mode has the same root cause but a different symptom: it doesn't
    // pre-bundle (CJS->ESM) linked packages by default, so pos-logic's CJS
    // dist/index.js gets served to the browser as-is and throws "exports is
    // not defined" (no CJS globals in a real ESM browser context). Forcing
    // it into optimizeDeps makes dev mode pre-bundle it like any other
    // dependency.
    optimizeDeps: {
      include: ['@dineiz/pos-logic']
    },
    plugins: [tailwindcss(), react()]
  }
})
