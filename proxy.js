const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Handle CORS preflight for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    });
    return res.sendStatus(204);
  }
  next();
});

app.use('/', createProxyMiddleware({
  target: 'https://whispr-api.roadmvn.com',
  changeOrigin: true,
  on: {
    proxyRes: (proxyRes) => {
      proxyRes.headers['access-control-allow-origin'] = '*';
      proxyRes.headers['access-control-allow-headers'] = 'Authorization, Content-Type, Accept';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    },
  },
}));

app.listen(8083, () => console.log('Proxy on http://localhost:8083 → https://whispr-api.roadmvn.com'));
