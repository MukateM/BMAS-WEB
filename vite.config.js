import { resolve } from 'path'

export default {
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