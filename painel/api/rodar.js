/**
 * POST /api/rodar
 * Dispara uma rotina do Claude Code (gatilho API) — screenshots ou trailer.
 *
 * Variáveis de ambiente (Vercel):
 *   SENHA_PAINEL
 *   ROTINA_8H_URL   + ROTINA_8H_TOKEN   → Vice City Diário, tipo "screenshots"
 *   ROTINA_12H_URL  + ROTINA_12H_TOKEN  → Vice City Diário, tipo "trailer"
 *   ROTINA_NV_URL   + ROTINA_NV_TOKEN   → Nunca Visto, tipo "curiosidade"
 *   GITHUB_TOKEN (precisa de Actions: write no repo mentesecreta) → Mente Secreta, tipo "psicologia"
 *
 * Formato oficial do gatilho API (claude.ai/code → Rotinas → gatilho API):
 *   POST <URL_DO_GATILHO>
 *   Authorization: Bearer <TOKEN>
 *   anthropic-version: 2023-06-01
 *   Content-Type: application/json
 *   body: { "text": "contexto opcional" }
 *
 * Se a tela do Claude mudar o cabeçalho/corpo, ajuste a função dispararRotina abaixo.
 */

import crypto from 'crypto';
import { OWNER, obterCanal } from './canais.js';

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Último disparo por canal+tipo, em memória da instância serverless.
 * Em cold start a memória zera — o navegador também bloqueia 30 min (localStorage).
 */
const ultimoDisparo = {};

function senhaCorreta(enviada, esperada) {
  if (!esperada || typeof enviada !== 'string') return false;
  const a = Buffer.from(String(enviada));
  const b = Buffer.from(String(esperada));
  const len = Math.max(a.length, b.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return crypto.timingSafeEqual(pa, pb) && a.length === b.length;
}

async function lerBody(req) {
  if (req.body != null) {
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {};
    }
    if (typeof req.body === 'object') return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function responder(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(obj);
}

/** Rotina do canal, ou null se o tipo não existir nele. */
function rotinaDoCanal(canal, tipo) {
  return (canal.rotinas || []).find((r) => r.tipo === tipo) || null;
}

/**
 * Chama o endpoint /fire da rotina Claude Code.
 * Ajuste headers/body aqui se o modal "API" da rotina mostrar outro formato.
 */
async function dispararRotina(url, token, mensagem) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
      'User-Agent': 'ViceCityDiarioPainel/1.0',
    },
    body: JSON.stringify({ text: mensagem }),
  });

  const corpo = await resposta.text().catch(() => '');
  return { status: resposta.status, corpo };
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  const senhaEnv = process.env.SENHA_PAINEL;
  if (!senhaEnv) {
    return responder(res, 503, { erro: 'SENHA_PAINEL não configurada na Vercel.' });
  }

  let body;
  try {
    body = await lerBody(req);
  } catch {
    return responder(res, 400, { erro: 'JSON inválido.' });
  }

  if (!senhaCorreta(body.senha, senhaEnv)) {
    return responder(res, 401, { erro: 'Senha errada' });
  }

  const canal = obterCanal(req);
  const tipo = body.tipo;
  const rotina = rotinaDoCanal(canal, tipo);
  if (!rotina) {
    return responder(res, 400, { erro: 'Tipo inválido para este canal.' });
  }

  // Proteção contra clique duplo (servidor), separada por canal
  const chave = `${canal.id}:${tipo}`;
  const agora = Date.now();
  const ultimo = ultimoDisparo[chave] || 0;
  const falta = COOLDOWN_MS - (agora - ultimo);
  if (falta > 0) {
    const min = Math.ceil(falta / 60000);
    return responder(res, 429, {
      erro: `Aguarde ${min} min antes de disparar de novo este tipo.`,
      cooldownSegundos: Math.ceil(falta / 1000),
    });
  }

  // Canais que publicam pelo GitHub Actions (ex.: Mente Secreta)
  if (rotina.github) {
    const gh = process.env.GITHUB_TOKEN;
    if (!gh) return responder(res, 503, { erro: 'GITHUB_TOKEN não configurado na Vercel.' });
    try {
      const r = await fetch(
        `https://api.github.com/repos/${OWNER}/${canal.repo}/actions/workflows/${rotina.github.workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${gh}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'ViceCityDiarioPainel/1.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main', inputs: rotina.github.inputs || {} }),
        }
      );
      if (r.status !== 204) {
        console.error('[api/rodar] github', r.status, (await r.text().catch(() => '')).slice(0, 200));
        return responder(res, 502, { erro: 'O GitHub não aceitou o disparo. Confira o GITHUB_TOKEN (Actions: write).' });
      }
      ultimoDisparo[chave] = Date.now();
      return responder(res, 200, {
        ok: true, canal: canal.id, tipo,
        mensagem: 'Vídeo em produção! Fica no ar em ~10 min.',
        cooldownSegundos: Math.floor(COOLDOWN_MS / 1000),
      });
    } catch (err) {
      console.error('[api/rodar] github', err);
      return responder(res, 502, { erro: 'Erro ao chamar o GitHub. Tente de novo em instantes.' });
    }
  }

  if (!rotina.url || !rotina.token) {
    return responder(res, 503, {
      erro: `Variáveis da rotina ${rotina.rotulo || tipo} não configuradas na Vercel.`,
    });
  }

  // Só aceita https (evita SSRF para endereços internos)
  try {
    const u = new URL(rotina.url);
    if (u.protocol !== 'https:') {
      return responder(res, 500, { erro: 'URL da rotina deve ser https.' });
    }
  } catch {
    return responder(res, 500, { erro: 'URL da rotina inválida.' });
  }

  try {
    const resultado = await dispararRotina(rotina.url, rotina.token, rotina.mensagem);

    if (resultado.status < 200 || resultado.status >= 300) {
      console.error('[api/rodar] rotina', tipo, resultado.status, resultado.corpo.slice(0, 200));
      return responder(res, 502, {
        erro: 'A rotina não aceitou o disparo. Confira URL/token na Vercel.',
      });
    }

    ultimoDisparo[chave] = Date.now();

    return responder(res, 200, {
      ok: true,
      canal: canal.id,
      tipo,
      mensagem: 'Vídeo em produção! Fica pronto em ~20 min.',
      cooldownSegundos: Math.floor(COOLDOWN_MS / 1000),
    });
  } catch (err) {
    console.error('[api/rodar]', err);
    return responder(res, 502, {
      erro: 'Erro ao chamar a rotina. Tente de novo em instantes.',
    });
  }
}
