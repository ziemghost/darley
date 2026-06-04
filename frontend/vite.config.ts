import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// Base path for GitHub Pages. Repo is assumed to be named "darley".
// If the repo name differs, set VITE_BASE (the workflow does this automatically).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '', '');
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? '/',
  };
});
