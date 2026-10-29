/**
 * Vídeos longos (deitados) — botão "Vídeos longos" do app.
 * GET  /api/longos?canal=vf            -> roteiros na fila e já publicados
 * POST /api/longos?canal=vf {senha, arquivo} -> dispara o GitHub Actions que monta e publica
 */
import crypto from 'crypto';
import { OWNER, obterCanal } from './canais.js';
import { headersGithub } from './config.js';

const UA = { 'User-Agent': 'ViceCityDiarioPainel/1.0', Accept: 'application/vnd.github+json' };
const ultimo = {};

function responder(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(obj);
}
function senhaOk(a, b) {
  if (!b || typeof a !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b), n = Math.max(x.length, y.length, 1);
  const px = Buffer.alloc(n), py = Buffer.alloc(n); x.copy(px); y.copy(py);
  return crypto.timingSafeEqual(px, py) && x.length === y.length;
}
async function lerBody(req) {
  if (req.body != null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const c = []; for await (const k of req) c.push(k); const raw = Buffer.concat(c).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
async function listar(canal, sub, token) {
  const url = `https://api.github.com/repos/${OWNER}/${canal.repo}/contents/${canal.pastaLongos}/${sub}?ref=main`;
  let r = await fetch(url, { headers: token ? headersGithub(token) : UA });
  if (r.status === 401 && token) r = await fetch(url, { headers: UA });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const itens = (await r.json()).filter((i) => i.type === 'file' && i.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(itens.map(async (i) => {
    try {
      const d = await (await fetch(i.download_url, { headers: { 'User-Agent': UA['User-Agent'] } })).json();
      const falas = (d.partes || []).flatMap((p) => p.falas || []);
      const palavras = falas.reduce((n, f) => n + String(f.text || '').split(/\s+/).filter(Boolean).length, 0);
      return {
        arquivo: `${canal.pastaLongos}/${sub}/${i.name}`,
        titulo: String(d.titulo || i.name).replace(/\s*\|.*$/, ''),
        tituloPt: String(d.titulo_pt || ''),
        resumoPt: String(d.resumo_pt || ''),
        partes: (d.partes || []).length,
        minutos: Math.round(palavras / 140),
        videoId: String(d.video_id || ''),
        videoIdPt: String(d.video_id_pt || ''),
        textoPt: (d.partes || []).flatMap((p) => (p.falas || []).map((f) => String(f.pt || ''))).filter(Boolean),
      };
    } catch { return { arquivo: `${canal.pastaLongos}/${sub}/${i.name}`, titulo: i.name, erro: true }; }
  }));
}

export default async function handler(req, res) {
  const canal = obterCanal(req);
  if (!canal.pastaLongos) return responder(res, 200, { canal: canal.id, semLongos: true, fila: [], publicados: [] });
  const token = process.env.GITHUB_TOKEN;

  if (!req.method || req.method === 'GET') {
    try {
      const [fila, publicados] = await Promise.all([listar(canal, 'fila', token), listar(canal, 'publicados', token)]);
      return responder(res, 200, { canal: canal.id, fila, publicados: publicados.reverse() });
    } catch (e) {
      console.error('[api/longos]', e);
      return responder(res, 502, { erro: 'Não consegui ler os vídeos longos agora.' });
    }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return responder(res, 405, { erro: 'Método não permitido' }); }

  let body; try { body = await lerBody(req); } catch { return responder(res, 400, { erro: 'JSON inválido.' }); }
  if (!senhaOk(body.senha, process.env.SENHA_PAINEL)) return responder(res, 401, { erro: 'Senha errada' });
  const arquivo = String(body.arquivo || '');
  if (!new RegExp(`^${canal.pastaLongos}/fila/[\\w.-]+\\.json$`).test(arquivo)) return responder(res, 400, { erro: 'Roteiro inválido.' });
  if (!token) return responder(res, 503, { erro: 'GITHUB_TOKEN não configurado na Vercel.' });
  if (Date.now() - (ultimo[arquivo] || 0) < 30 * 60 * 1000) return responder(res, 429, { erro: 'Esse vídeo já está sendo produzido. Aguarde.' });
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${canal.repo}/actions/workflows/${canal.workflowLongo}/dispatches`, {
    method: 'POST', headers: headersGithub(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ref: 'main', inputs: { arquivo } }),
  });
  if (r.status !== 204) {
    console.error('[api/longos] github', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return responder(res, 502, { erro: 'O GitHub não aceitou o pedido. Confira o GITHUB_TOKEN.' });
  }
  ultimo[arquivo] = Date.now();
  return responder(res, 200, { ok: true, mensagem: 'Vídeo longo em produção! Fica pronto em 30 a 60 minutos.' });
}
