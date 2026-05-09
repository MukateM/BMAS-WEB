export default {
  build: {
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: 'index.html',
        quiz: 'employment-law-quiz.html'
      }
    }
  }
}