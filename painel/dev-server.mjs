/**
 * Servidor local para testar o painel sem login na Vercel.
 * Uso: node dev-server.mjs
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import videos from './api/videos.js';
import status from './api/status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
};

/** Adaptador no estilo Vercel (req, res.status().json()). */
function adaptar(handler) {
  return async (req, res) => {
    const fakeRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(obj) {
        const body = JSON.stringify(obj);
        res.writeHead(this.statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          ...this.headers,
        });
        res.end(body);
      },
    };
    try {
      await handler(req, fakeRes);
      // Se o handler não fechou a resposta (raro), evita hang
      if (!res.writableEnded) {
        res.writeHead(fakeRes.statusCode, fakeRes.headers);
        res.end();
      }
    } catch (err) {
      console.error(err);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ erro: 'Erro interno no servidor local' }));
      }
    }
  };
}

const rotasApi = {
  '/api/videos': adaptar(videos),
  '/api/status': adaptar(status),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (rotasApi[pathname]) {
    return rotasApi[pathname](req, res);
  }

  let arquivo = pathname === '/' ? '/index.html' : pathname;
  // Evita path traversal
  arquivo = path.normalize(arquivo).replace(/^(\.\.[/\\])+/, '');
  const caminho = path.join(__dirname, arquivo);

  if (!caminho.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(caminho, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    const ext = path.extname(caminho);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Painel local em http://localhost:${PORT}`);
});
