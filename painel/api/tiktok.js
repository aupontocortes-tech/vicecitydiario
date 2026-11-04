/**
 * Vídeos prontos para postar no TikTok (botão "TikTok" do app).
 * GET /api/tiktok?canal=nv|ms|vcd -> últimos vídeos guardados na release "tiktok" do repositório do canal.
 */
import { OWNER, obterCanal } from './canais.js';
import { headersGithub } from './config.js';

const UA = { 'User-Agent': 'MeusCanaisPainel/1.0', Accept: 'application/vnd.github+json' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const canal = obterCanal(req);
  const token = process.env.GITHUB_TOKEN;
  try {
    let r = await fetch(`https://api.github.com/repos/${OWNER}/${canal.repo}/releases/tags/tiktok`, { headers: token ? headersGithub(token) : UA });
    if (r.status === 401 && token) r = await fetch(`https://api.github.com/repos/${OWNER}/${canal.repo}/releases/tags/tiktok`, { headers: UA });
    if (r.status === 404) return res.status(200).json({ canal: canal.id, videos: [] });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const assets = (await r.json()).assets || [];
    // só os vídeos deste canal (no repositório do Mente Secreta também ficam os do Veil, se um dia forem)
    const pref = { vcd: 'gta_', nv: 'nv_', ms: 'ms_', vf: 'vf_' }[canal.id] || '';
    const mp4 = assets.filter((a) => a.name.endsWith('.mp4') && a.name.startsWith(pref)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
    const videos = await Promise.all(mp4.map(async (a) => {
      const base = a.name.replace(/\.mp4$/, '');
      const js = assets.find((x) => x.name === base + '.json');
      let meta = {};
      if (js) { try { meta = await (await fetch(js.browser_download_url, { headers: { 'User-Agent': UA['User-Agent'] } })).json(); } catch {} }
      return { nome: base, url: a.browser_download_url, tamanhoMB: Math.round(a.size / 1e5) / 10, data: a.created_at,
               titulo: meta.titulo || base, legenda: meta.legenda || '', idioma: meta.idioma || 'pt' };
    }));
    return res.status(200).json({ canal: canal.id, videos });
  } catch (e) {
    console.error('[api/tiktok]', e);
    return res.status(502).json({ erro: 'Não consegui carregar agora.' });
  }
}
