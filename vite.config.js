import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo-name>/ — the BASE_PATH env var
// (set by the deploy workflow) injects that prefix at build time so asset
// URLs resolve. Local dev/build defaults to '/' since BASE_PATH is unset.
export default defineConfig({
  base: process.env.BASE_PATH || '/'
});
