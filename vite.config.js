import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/usapon-memo/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(new Date().toISOString())
  }
});
