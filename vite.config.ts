import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // allow remote preview through Cloudflare quick tunnels
    allowedHosts: ['.trycloudflare.com'],
  },
});
