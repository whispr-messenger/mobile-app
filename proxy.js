const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/', createProxyMiddleware({
  target: 'https://whispr-api.roadmvn.com',
  changeOrigin: true,
  on: {
    proxyRes: (proxyRes) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    },
  },
}));

app.listen(8083, () => console.log('Proxy on http://localhost:8083 → https://whispr-api.roadmvn.com'));
