import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Serves api/aircraft.ts during `npm run dev`, so the app works locally
 * without the Vercel CLI. In production Vercel deploys `api/` as functions.
 */
function devApi(): Plugin {
  return {
    name: 'plane-goes-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/aircraft', async (req: IncomingMessage & { originalUrl?: string }, res: ServerResponse) => {
        const mod = await server.ssrLoadModule('/api/aircraft.ts');
        const response: Response = await mod.GET(new Request(`http://localhost${req.originalUrl ?? req.url}`));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [devApi()],
  test: {
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
