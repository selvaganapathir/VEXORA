import { defineConfig } from 'vite';
export default defineConfig({ base: process.env.GITHUB_ACTIONS ? '/VEXORA/' : '/', build: { target: 'es2022' } });