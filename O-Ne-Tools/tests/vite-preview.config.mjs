import { defineConfig } from 'vite';

// Development only. Production remains the existing static GitHub Pages site.
export default defineConfig({
  appType: 'mpa',
  plugins: [{
    name: 'card-workspace-qa-entry',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== '/') return next();
        response.writeHead(302, { Location: '/O-Ne-Tools/tests/workspace-preview.html' });
        response.end();
      });
    },
  }],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
});
