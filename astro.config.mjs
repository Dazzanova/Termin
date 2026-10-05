// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      {
        name: 'preferences-form-handler',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (
              req.method === 'POST' &&
              (req.url === '/settings' || req.url === '/settings/' || req.url === '/api/preferences')
            ) {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const contentType = req.headers['content-type'] || '';
                  let platforms = [];

                  if (contentType.includes('application/json')) {
                    const parsed = JSON.parse(body || '{}');
                    platforms = Array.isArray(parsed.platforms)
                      ? parsed.platforms
                      : Array.isArray(parsed.enabledPlatforms)
                        ? parsed.enabledPlatforms
                        : [];
                  } else {
                    const params = new URLSearchParams(body);
                    platforms = params.getAll('platforms');
                  }

                  const { saveSubmittedPlatforms } = await server.ssrLoadModule(
                    '/src/lib/preferences/repository.ts'
                  );

                  saveSubmittedPlatforms(platforms);

                  if (req.headers.accept?.includes('application/json')) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: true, redirect: '/' }));
                  } else {
                    res.writeHead(302, { Location: '/' });
                    res.end();
                  }
                } catch (err) {
                  next(err);
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
  },
});
