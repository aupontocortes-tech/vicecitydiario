/**
 * Conectar as contas do TikTok (uma por canal) ao robô de postagem.
 * POST /api/tiktok-login {senha, canal}  -> {url} para o login do TikTok (state assinado)
 * GET  /api/tiktok-login?code=..&state=.. -> volta do TikTok: troca o código pela chave e guarda criptografada no GitHub
 * GET  /api/tiktok-login?status=1         -> quais canais já estão conectados
 * Segredos só em process.env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, GITHUB_TOKEN, SENHA_PAINEL.
 */
import crypto from 'crypto';
import { OWNER } from './canais.js';
import { headersGithub, senhaCorreta } from './config.js';

const REPO = 'vicecitydiario';
const REDIRECT = 'https://vicecitydiario-5aof.vercel.app/api/tiktok-login';
const CANAIS = { ms: 'Mente Secreta', nv: 'Nunca Visto', vcd: 'Leonida Daily (GTA)' };
const SCOPES = 'user.info.basic,video.publish,video.upload';

function chave() { return crypto.createHash('sha256').update('meuscanais-tiktok:' + (process.env.TIKTOK_CLIENT_SECRET || '').trim()).digest(); }
function assina(txt) { return crypto.createHmac('sha256', chave()).update(txt).digest('base64url').slice(0, 32); }
function cifra(obj) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
async function lerBody(req) {
  if (req.body != null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const c = []; for await (const k of req) c.push(k); const raw = Buffer.concat(c).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
function pagina(res, status, titulo, texto) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title><body style="font-family:system-ui;background:#120a1f;color:#f3eef8;padding:32px;max-width:520px;margin:auto">
<h1 style="font-size:1.4rem">${titulo}</h1><p style="font-size:1.05rem;line-height:1.5">${texto}</p>
<p><a style="color:#28e6dc;font-weight:700" href="/tiktok.html">← Voltar ao app</a></p></body>`);
}
async function salvaNoGithub(canal, conteudo, token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/tiktok/contas/${canal}.enc`;
  const atual = await fetch(url + '?ref=main', { headers: headersGithub(token) });
  const sha = atual.ok ? (await atual.json()).sha : undefined;
  const r = await fetch(url, { method: 'PUT', headers: headersGithub(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message: `TikTok: conta conectada (${canal})`, content: Buffer.from(conteudo).toString('base64'), branch: 'main', sha }) });
  if (!r.ok) throw new Error('GitHub ' + r.status);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = (process.env.TIKTOK_CLIENT_KEY || '').trim(), secret = (process.env.TIKTOK_CLIENT_SECRET || '').trim(), token = process.env.GITHUB_TOKEN;
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'POST') {
    let b; try { b = await lerBody(req); } catch { return res.status(400).json({ erro: 'JSON inválido' }); }
    if (!senhaCorreta(b.senha, process.env.SENHA_PAINEL)) return res.status(401).json({ erro: 'Senha errada' });
    if (!CANAIS[b.canal]) return res.status(400).json({ erro: 'Canal inválido' });
    if (!key || !secret) return res.status(503).json({ erro: 'Falta colocar TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no Vercel.' });
    const base = `${b.canal}.${Date.now()}`; const state = `${base}.${assina(base)}`;
    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(key)}&scope=${encodeURIComponent(SCOPES)}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&state=${encodeURIComponent(state)}`;
    return res.status(200).json({ url });
  }

  if (q.status) {   // quais canais já estão conectados
    const out = {};
    await Promise.all(Object.keys(CANAIS).map(async (c) => {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/tiktok/contas/${c}.enc?ref=main`, { headers: headersGithub(token) });
      out[c] = r.ok;
    }));
    return res.status(200).json(out);
  }

  // volta do TikTok
  if (q.error) return pagina(res, 400, 'Login cancelado', 'O TikTok não autorizou: ' + String(q.error_description || q.error));
  const [canal, ts, sig] = String(q.state || '').split('.');
  if (!CANAIS[canal] || !sig || assina(`${canal}.${ts}`) !== sig || Date.now() - Number(ts) > 30 * 60 * 1000)
    return pagina(res, 400, 'Link expirado', 'Volte ao app e toque em "Conectar" de novo.');
  try {
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: key, client_secret: secret, code: String(q.code), grant_type: 'authorization_code', redirect_uri: REDIRECT }) });
    const t = await r.json();
    if (!t.refresh_token) throw new Error(t.error_description || t.error || 'sem refresh_token');
    let nome = '';
    try {
      const u = await (await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
      nome = u?.data?.user?.display_name || '';
    } catch {}
    await salvaNoGithub(canal, cifra({ canal, open_id: t.open_id, refresh_token: t.refresh_token, scope: t.scope, nome, quando: new Date().toISOString() }), token);
    return pagina(res, 200, '✅ Conta conectada', `A conta <b>${nome || 'do TikTok'}</b> agora posta os vídeos do <b>${CANAIS[canal]}</b> sozinha.`);
  } catch (e) {
    console.error('[tiktok-login]', e);
    return pagina(res, 500, 'Não deu certo', 'Erro ao conectar: ' + String(e.message).slice(0, 200));
  }
}
