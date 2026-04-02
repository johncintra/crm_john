import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = resolve(process.cwd());

const shared = {
  root,
  configFile: false,
  plugins: [react()],
  publicDir: 'public',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}'
  }
};

await build({
  ...shared,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html')
      },
      output: {
        entryFileNames: 'assets/popup.js',
        chunkFileNames: 'assets/popup-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/popup.css';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  }
});

await build({
  ...shared,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'assets/background.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});

await build({
  ...shared,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, 'src/content/content-app.tsx'),
      formats: ['iife'],
      name: 'CRMJohnContent',
      fileName: () => 'assets/content.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/content.css';
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  }
});
