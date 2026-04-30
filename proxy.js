const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
  'https://whispr-preprod.roadmvn.com',
];

const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : DEFAULT_ALLOWED_ORIGINS)
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

// Handle CORS preflight for all routes
app.use((req, res, next) => {
  const allowedOrigin = resolveAllowedOrigin(req.headers.origin);

  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.set({
        'Access-Control-Allow-Origin': allowedOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
        'Access-Control-Max-Age': '86400',
      });
    }
    return res.sendStatus(204);
  }
  next();
});

app.use('/', createProxyMiddleware({
  target: 'https://whispr-preprod.roadmvn.com',
  changeOrigin: true,
  on: {
    proxyRes: (proxyRes, req) => {
      const allowedOrigin = resolveAllowedOrigin(req.headers.origin);
      if (allowedOrigin) {
        proxyRes.headers['access-control-allow-origin'] = allowedOrigin;
        proxyRes.headers['vary'] = 'Origin';
        proxyRes.headers['access-control-allow-headers'] = 'Authorization, Content-Type, Accept';
        proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
      } else {
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-headers'];
        delete proxyRes.headers['access-control-allow-methods'];
      }
    },
  },
}));

app.listen(8083, () => console.log('Proxy on http://localhost:8083 → https://whispr-preprod.roadmvn.com'));
