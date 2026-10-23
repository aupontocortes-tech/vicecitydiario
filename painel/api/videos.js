/**
 * GET /api/videos
 * Lê o feed Atom público do canal e devolve JSON com os Shorts recentes.
 * Cache na edge da Vercel para não estourar o YouTube.
 */

import { obterCanal } from './canais.js';

/** Extrai o conteúdo de uma tag simples (sem aninhamento). */
function tag(xml, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

/** Decodifica entidades HTML básicas do título. */
function decode(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Converte cada <entry> do feed Atom em um objeto de vídeo.
 */
function parseEntries(xml) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);

  return entries.map((entry) => {
    const id =
      tag(entry, 'yt:videoId') ||
      (tag(entry, 'id').match(/video:([A-Za-z0-9_-]+)/) || [])[1] ||
      '';

    const viewsMatch = entry.match(/media:statistics[^>]*views="(\d+)"/i);
    const views = viewsMatch ? Number(viewsMatch[1]) : 0;

    // Link direto do Short no YouTube (abre o app/site do canal)
    const url = id
      ? `https://www.youtube.com/shorts/${id}`
      : (() => {
          const linkMatch = entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i);
          return linkMatch ? linkMatch[1] : '';
        })();

    return {
      id,
      titulo: decode(tag(entry, 'title')),
      publicado: tag(entry, 'published'),
      url,
      thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
      views,
    };
  }).filter((v) => v.id);
}

/**
 * Converte textos do YouTube em pt-BR ("303", "1.634", "1,4 mil") para número.
 */
function parseViewsPt(texto) {
  const m = String(texto).match(/([\d.,]+)\s*(mil|mi)?\s*visualiza/i);
  if (!m) return null;

  const bruto = m[1];
  const unidade = (m[2] || '').toLowerCase();
  let n;

  if (unidade) {
    n = Number(bruto.replace(/\./g, '').replace(',', '.'));
    if (unidade === 'mil') n *= 1000;
    if (unidade === 'mi') n *= 1000000;
  } else if (bruto.includes('.') && bruto.includes(',')) {
    n = Number(bruto.replace(/\./g, '').replace(',', '.'));
  } else if ((bruto.match(/\./g) || []).length >= 1 && !bruto.includes(',')) {
    const partes = bruto.split('.');
    n = partes.every((p, i) => i === 0 || p.length === 3)
      ? Number(bruto.replace(/\./g, ''))
      : Number(bruto);
  } else if (bruto.includes(',')) {
    n = Number(bruto.replace(',', '.'));
  } else {
    n = Number(bruto);
  }

  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * Views atuais de todos os Shorts do canal.
 * O feed Atom só traz 15 vídeos e as views dele ficam desatualizadas.
 */
async function buscarViewsAoVivo(channelId) {
  const resposta = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20241001.00.00',
          hl: 'pt',
          gl: 'BR',
        },
      },
      browseId: channelId,
      params: 'EgZzaG9ydHPyBgUKA5oBAA%3D%3D',
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!resposta.ok) {
    throw new Error(`YouTube shorts respondeu ${resposta.status}`);
  }

  const dados = await resposta.text();
  const mapa = new Map();

  const itens = dados.matchAll(
    /accessibilityText":"((?:\\.|[^"\\])*)"[\s\S]{0,800}?"videoId":"([A-Za-z0-9_-]{11})"/g
  );

  for (const item of itens) {
    const texto = item[1].replace(/\\u0026/g, '&');
    const views = parseViewsPt(texto);
    if (views == null || mapa.has(item[2])) continue;
    const titulo = texto.split(/,\s*[\d.,]+\s*(?:mil|mi)?\s*visualiza/i)[0].trim();
    mapa.set(item[2], { views, titulo });
  }

  return mapa;
}

/** Quantidade de inscritos do canal, no texto público do YouTube. */
async function buscarInscritos(channelId) {
  const resposta = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20241001.00.00',
          hl: 'pt',
          gl: 'BR',
        },
      },
      browseId: channelId,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!resposta.ok) {
    throw new Error(`YouTube canal respondeu ${resposta.status}`);
  }

  const dados = await resposta.text();
  const m = dados.match(/"content":"((?:\\.|[^"\\])*inscritos)"/i);
  if (!m) return null;
  const texto = m[1].replace(/\\u0026/g, '&').replace(/inscritos/i, 'visualizações');
  return parseViewsPt(texto);
}

export default async function handler(req, res) {
  // Só GET
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const canal = obterCanal(req);

  if (!canal.channelId) {
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      atualizadoEm: new Date().toISOString(),
      canal: canal.id,
      canalId: '',
      total: 0,
      totalShorts: 0,
      somaViews: 0,
      inscritos: null,
      destaque: null,
      videos: [],
    });
  }

  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${canal.channelId}`;
    const resposta = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'ViceCityDiarioPainel/1.0 (+https://vercel.app)',
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
    });

    if (!resposta.ok) {
      throw new Error(`YouTube feed respondeu ${resposta.status}`);
    }

    const xml = await resposta.text();
    const videos = parseEntries(xml);

    let somaViews = videos.reduce((acc, v) => acc + (v.views || 0), 0);
    let totalShorts = videos.length;
    let destaque = null;
    let inscritos = null;

    try {
      const aoVivo = await buscarViewsAoVivo(canal.channelId);
      if (aoVivo.size) {
        const ids = new Set();
        somaViews = 0;
        for (const [id, info] of aoVivo) {
          somaViews += info.views;
          ids.add(id);
          if (!destaque || info.views > destaque.views) destaque = info;
        }
        for (const video of videos) {
          const info = aoVivo.get(video.id);
          if (info) video.views = info.views;
          else if (!ids.has(video.id)) {
            somaViews += video.views || 0;
            ids.add(video.id);
          }
        }
        totalShorts = ids.size;
      }
    } catch (err) {
      console.error('[api/videos] views ao vivo', err);
    }

    try {
      inscritos = await buscarInscritos(canal.channelId);
    } catch (err) {
      console.error('[api/videos] inscritos', err);
    }

    // Cache de 2 minutos na CDN da Vercel (+ stale enquanto revalida)
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return res.status(200).json({
      atualizadoEm: new Date().toISOString(),
      canal: canal.id,
      canalId: canal.channelId,
      total: videos.length,
      totalShorts,
      somaViews,
      inscritos,
      destaque,
      videos,
    });
  } catch (err) {
    console.error('[api/videos]', err);
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(502).json({
      erro: 'Não foi possível carregar os vídeos do canal agora. Tente de novo em instantes.',
    });
  }
}
