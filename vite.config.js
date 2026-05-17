import { resolve } from 'path'

const localApiRoutes = {
  '/api/payroll': './api/payroll.js',
  '/api/quiz-config': './api/quiz-config.js',
  '/api/quiz-leaderboard': './api/quiz-leaderboard.js',
  '/api/quiz-manual-signup': './api/quiz-manual-signup.js',
  '/api/quiz-profile': './api/quiz-profile.js',
  '/api/quiz-questions': './api/quiz-questions.js',
  '/api/quiz-signin': './api/quiz-signin.js',
  '/api/quiz-submit': './api/quiz-submit.js',
};

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) return undefined;

  try {
    return JSON.parse(rawBody);
  } catch (_error) {
    return rawBody;
  }
}

function attachVercelResponseHelpers(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };

  res.json = (body) => {
    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return res;
  };

  res.send = (body) => {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
      return res.json(body);
    }
    res.end(body);
    return res;
  };
}

function localApiPlugin() {
  return {
    name: 'bmas-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const routePath = requestUrl.pathname.replace(/\/$/, '');
        const modulePath = localApiRoutes[routePath];

        if (!modulePath) {
          next();
          return;
        }

        try {
          req.query = Object.fromEntries(requestUrl.searchParams.entries());
          req.body = await readRequestBody(req);
          attachVercelResponseHelpers(res);

          const handlerModule = await server.ssrLoadModule(modulePath);
          await handlerModule.default(req, res);
        } catch (error) {
          console.error(`[local-api] ${routePath}`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
          }
          res.end(JSON.stringify({ error: 'Local API route failed.' }));
        }
      });
    },
  };
}

export default {
  plugins: [localApiPlugin()],
  build: {
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quiz: resolve(__dirname, 'employment-law-quiz.html'),
        about: resolve(__dirname, 'about.html'),
        careers: resolve(__dirname, 'careers.html'),
        clients: resolve(__dirname, 'clients.html'),
        contact: resolve(__dirname, 'contact.html'),
        market: resolve(__dirname, 'market.html'),
        services: resolve(__dirname, 'services.html'),
        'why-us': resolve(__dirname, 'why-us.html'),
        'payroll-calculator': resolve(__dirname, 'payroll-calculator.html'),
      }
    }
  }
}
