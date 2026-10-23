/**
 * GET /api/roteiros?canal=ms|vf
 * Lista os roteiros que ainda vão ser publicados (pasta da fila no GitHub), na ordem de publicação.
 * Só leitura. Usa GITHUB_TOKEN se existir (mais cota); o repositório é público.
 */

import { OWNER, obterCanal } from './canais.js';
import { headersGithub } from './config.js';

const PASTA_PADRAO = 'roteiros/fila';

function responder(res, status, obj, cache = false) {
  res.setHeader('Cache-Control', cache ? 's-maxage=60, stale-while-revalidate=120' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(obj);
}

function limpar(r, arquivo, ordem) {
  const cenas = (r.scenes || []).map((s) => ({
    texto: String(s.text || ''),
    pt: s.pt ? String(s.pt) : '',
    voz: s.voz ? String(s.voz) : '',
  }));
  return {
    arquivo,
    ordem,
    titulo: String(r.titulo || r.title || arquivo).replace(/\s*#Shorts\s*$/i, ''),
    tituloPt: String(r.titulo_pt || ''),
    resumoPt: String(r.resumo_pt || ''),
    narrador: String(r.narrador || ''),
    cenas,
    palavras: cenas.reduce((n, c) => n + c.texto.split(/\s+/).filter(Boolean).length, 0),
  };
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return responder(res, 405, { erro: 'Método não permitido' });
  }
  const canal = obterCanal(req);
  const usaFila = canal.id === 'ms' || Boolean(canal.pastaFila);
  if (!usaFila) {
    return responder(res, 200, {
      canal: canal.id,
      semFila: true,
      mensagem: 'Neste canal o robô escolhe o tema e escreve o roteiro na hora de gravar.',
      roteiros: [],
    }, true);
  }
  const pasta = canal.pastaFila || PASTA_PADRAO;
  const token = process.env.GITHUB_TOKEN;
  try {
    const url = `https://api.github.com/repos/${OWNER}/${canal.repo}/contents/${pasta}?ref=main`;
    const semToken = { Accept: 'application/vnd.github+json', 'User-Agent': 'ViceCityDiarioPainel/1.0' };
    let r = await fetch(url, { headers: token ? headersGithub(token) : semToken });
    if (r.status === 401 && token) r = await fetch(url, { headers: semToken }); // token sem acesso: o repositório é público
    if (r.status === 404) return responder(res, 200, { canal: canal.id, roteiros: [] }, true);
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const lista = (await r.json())
      .filter((i) => i.type === 'file' && i.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 14);
    const roteiros = await Promise.all(lista.map(async (i, k) => {
      try {
        const raw = await fetch(i.download_url, { headers: { 'User-Agent': 'ViceCityDiarioPainel/1.0' } });
        return limpar(await raw.json(), i.name, k);
      } catch {
        return { arquivo: i.name, ordem: k, titulo: i.name, erro: true, cenas: [] };
      }
    }));
    return responder(res, 200, { canal: canal.id, roteiros, atualizadoEm: new Date().toISOString() }, true);
  } catch (err) {
    console.error('[api/roteiros]', err);
    return responder(res, 502, { erro: 'Não consegui ler os roteiros no GitHub agora. Tente de novo em instantes.' });
  }
}
