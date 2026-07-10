import { readFileSync } from 'fs'
import { basename, resolve } from 'path'

const localApiRoutes = {
  '/api/account-delete': './api/account-delete.js',
  '/api/account-signup': './api/account-signup.js',
  '/api/compliance-lead': './api/compliance-lead.js',
  '/api/payroll': './api/payroll.js',
  '/api/quiz-config': './api/quiz-config.js',
  '/api/quiz-leaderboard': './api/quiz-leaderboard.js',
  '/api/quiz-manual-signup': './api/quiz-manual-signup.js',
  '/api/quiz-profile': './api/quiz-profile.js',
  '/api/quiz-questions': './api/quiz-questions.js',
  '/api/quiz-signin': './api/quiz-signin.js',
  '/api/quiz-submit': './api/quiz-submit.js',
  '/api/documents': './api/documents.js',
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

function readPartial(name) {
  return readFileSync(resolve(__dirname, 'partials', name), 'utf8');
}

const pageByFile = {
  'about.html': 'about',
  'account.html': 'documents',
  'analytics.html': 'analytics',
  'careers.html': 'careers',
  'clients.html': 'clients',
  'compliance-check.html': 'compliance',
  'contact.html': 'contact',
  'checkout.html': 'documents',
  'employment-law-quiz.html': 'quiz',
  'hr-metrics-calculator.html': 'hr-metrics',
  'index.html': 'home',
  'job-details.html': 'careers',
  'market.html': 'market',
  'documents.html': 'documents',
  'library.html': 'documents',
  'reader.html': 'documents',
  'payroll-calculator.html': 'payroll',
  'service-cafeteria.html': 'service-cafeteria',
  'services.html': 'services',
  'why-us.html': 'why-us',
};

function classFor(active, current, activeClass, inactiveClass) {
  return active === current ? activeClass : inactiveClass;
}

function renderTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => values[key] || '');
}

function renderHeader(filename) {
  const header = readPartial('header.html');
  const activePage = pageByFile[basename(filename)] || 'home';
  const activeNav = 'text-slate-900 font-medium';
  const inactiveNav = 'hover:text-slate-900';
  const activeMobile = 'block py-2 font-medium text-slate-900';
  const inactiveMobile = 'block py-2';
  const activeTool = 'rounded px-3 py-2 bg-slate-50 text-slate-900 font-medium';
  const inactiveTool = 'rounded px-3 py-2 hover:bg-slate-50';
  const activeMobileTool = 'block py-2 pl-3 font-medium text-slate-900';
  const inactiveMobileTool = 'block py-2 pl-3';
  const isToolPage = ['compliance', 'payroll', 'quiz', 'service-cafeteria', 'hr-metrics', 'documents'].includes(activePage);

  return renderTemplate(header, {
    headerClass:
      activePage === 'home'
        ? 'fixed w-full z-30 bg-white/70 backdrop-blur-md border-b border-white/40'
        : 'fixed w-full z-30 bg-white/80 backdrop-blur-md border-b',
    navAboutClass: classFor(activePage, 'about', activeNav, inactiveNav),
    navServicesClass: classFor(activePage, 'services', activeNav, inactiveNav),
    navMarketClass: classFor(activePage, 'market', activeNav, inactiveNav),
    navClientsClass: classFor(activePage, 'clients', activeNav, inactiveNav),
    navWhyUsClass: classFor(activePage, 'why-us', activeNav, inactiveNav),
    navToolsClass: isToolPage ? activeNav : inactiveNav,
    navCareersClass: classFor(activePage, 'careers', activeNav, inactiveNav),
    navContactClass: classFor(activePage, 'contact', activeNav, inactiveNav),
    navPayrollMenuClass: classFor(activePage, 'payroll', activeTool, inactiveTool),
    navHrMetricsMenuClass: classFor(activePage, 'hr-metrics', activeTool, inactiveTool),
    navDocumentsMenuClass: classFor(activePage, 'documents', activeTool, inactiveTool),
    navComplianceMenuClass: classFor(activePage, 'compliance', activeTool, inactiveTool),
    navQuizMenuClass: classFor(activePage, 'quiz', activeTool, inactiveTool),
    navCafeteriaMenuClass: classFor(activePage, 'service-cafeteria', activeTool, inactiveTool),
    mobileAboutClass: classFor(activePage, 'about', activeMobile, inactiveMobile),
    mobileServicesClass: classFor(activePage, 'services', activeMobile, inactiveMobile),
    mobileMarketClass: classFor(activePage, 'market', activeMobile, inactiveMobile),
    mobileClientsClass: classFor(activePage, 'clients', activeMobile, inactiveMobile),
    mobileWhyUsClass: classFor(activePage, 'why-us', activeMobile, inactiveMobile),
    mobileCareersClass: classFor(activePage, 'careers', activeMobile, inactiveMobile),
    mobileContactClass: classFor(activePage, 'contact', activeMobile, inactiveMobile),
    mobilePayrollClass: classFor(activePage, 'payroll', activeMobileTool, inactiveMobileTool),
    mobileHrMetricsClass: classFor(activePage, 'hr-metrics', activeMobileTool, inactiveMobileTool),
    mobileDocumentsClass: classFor(activePage, 'documents', activeMobileTool, inactiveMobileTool),
    mobileComplianceClass: classFor(activePage, 'compliance', activeMobileTool, inactiveMobileTool),
    mobileQuizClass: classFor(activePage, 'quiz', activeMobileTool, inactiveMobileTool),
    mobileCafeteriaClass: classFor(activePage, 'service-cafeteria', activeMobileTool, inactiveMobileTool),
  });
}

function sharedPartialsPlugin() {
  return {
    name: 'bmas-shared-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const filename = basename(ctx.filename || '');
        const shouldInjectAnalytics = filename !== 'analytics.html' && !html.includes('/assets/site-analytics.js');
        const withAnalytics = shouldInjectAnalytics
          ? html.replace('</body>', '<script src="/assets/site-analytics.js" defer></script>\n</body>')
          : html;

        return withAnalytics
          .replace('<!-- bmas:header -->', renderHeader(ctx.filename || 'index.html'))
          .replace('<!-- bmas:footer -->', readPartial('footer.html'))
          .replace('<!-- bmas:consult-modal -->', readPartial('consult-modal.html'));
      },
    },
  };
}

export default {
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [sharedPartialsPlugin(), localApiPlugin()],
  build: {
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        analytics: resolve(__dirname, 'analytics.html'),
        quiz: resolve(__dirname, 'employment-law-quiz.html'),
        about: resolve(__dirname, 'about.html'),
        account: resolve(__dirname, 'account.html'),
        careers: resolve(__dirname, 'careers.html'),
        'job-details': resolve(__dirname, 'job-details.html'),
        clients: resolve(__dirname, 'clients.html'),
        contact: resolve(__dirname, 'contact.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        market: resolve(__dirname, 'market.html'),
        services: resolve(__dirname, 'services.html'),
        'why-us': resolve(__dirname, 'why-us.html'),
        'compliance-check': resolve(__dirname, 'compliance-check.html'),
        'payroll-calculator': resolve(__dirname, 'payroll-calculator.html'),
        'hr-metrics-calculator': resolve(__dirname, 'hr-metrics-calculator.html'),
        'service-cafeteria': resolve(__dirname, 'service-cafeteria.html'),
        documents: resolve(__dirname, 'documents.html'),
        library: resolve(__dirname, 'library.html'),
        reader: resolve(__dirname, 'reader.html'),
      }
    }
  }
}
