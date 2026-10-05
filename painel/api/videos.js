/**
 * GET /api/videos
 * Lê o feed Atom público do canal e devolve JSON com os Shorts recentes.
 * Cache na edge da Vercel para não estourar o YouTube.
 */

const CHANNEL_ID = 'UCF-LmLBkuqN8Qz9Bf0rWolA';
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

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

export default async function handler(req, res) {
  // Só GET
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const resposta = await fetch(FEED_URL, {
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

    // Cache de 2 minutos na CDN da Vercel (+ stale enquanto revalida)
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return res.status(200).json({
      atualizadoEm: new Date().toISOString(),
      canalId: CHANNEL_ID,
      total: videos.length,
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
