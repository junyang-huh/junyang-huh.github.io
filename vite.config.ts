import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const endpoint = env.VITE_AVAILABILITY_API_URL;
  if (endpoint && !/^https?:\/\//.test(endpoint)) throw new Error('API URL must use HTTP or HTTPS');
  return {
    base: '/availability/',
    server: {
      host: '127.0.0.1',
      proxy: endpoint ? {
        '/availability-api': {
          target: new URL(endpoint).origin,
          changeOrigin: true,
          rewrite: () => new URL(endpoint).pathname + new URL(endpoint).search,
        },
      } : undefined,
    },
  };
});
