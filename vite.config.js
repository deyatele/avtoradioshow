import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public', // Directory containing static assets
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html', // Entry point
      },
      external: [], // We don't need to externalize anything here since hls.js is loaded separately
      output: {
        manualChunks(id) {
          if (id.includes('src/App.js')) {
            return 'app';
          }
          if (id.includes('src/RadioPlayer.js')) {
            return 'radio';
          }
          if (id.includes('src/VideoPlayer.js')) {
            return 'video';
          }
          if (id.includes('src/utils.js') || id.includes('src/global-functions.js') || id.includes('src/loging.js')) {
            return 'utils';
          }
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name].[hash].[ext]';
          }
          return 'assets/[name].[hash].[ext]';
        }
      }
    },
    minify: 'terser', // Use terser for better minification
    sourcemap: false // Disable sourcemaps for production
  },
  server: {
    host: true,
    port: 3000
  }
});