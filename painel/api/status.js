/**
 * GET /api/status
 * Últimas execuções do workflow publicar.yml no GitHub Actions.
 * Usa GITHUB_TOKEN (opcional) se o repositório for privado ou para mais cota.
 */

const OWNER = 'aupontocortes-tech';
const REPO = 'vicecitydiario';
const WORKFLOW = 'publicar.yml';
const RUNS_URL =
  `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=8`;

/** Traduz conclusion/status da API do GitHub para o painel. */
function traduzirStatus(run) {
  if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'pending') {
    return { codigo: 'rodando', rotulo: '⏳ rodando' };
  }
  if (run.conclusion === 'success') {
    return { codigo: 'sucesso', rotulo: '✅ postou' };
  }
  if (run.conclusion === 'cancelled') {
    return { codigo: 'cancelado', rotulo: '⏹ cancelado' };
  }
  // failure, timed_out, action_required, etc.
  return { codigo: 'falhou', rotulo: '❌ falhou' };
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ViceCityDiarioPainel/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Token opcional configurado na Vercel (nunca no código)
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resposta = await fetch(RUNS_URL, { headers });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      console.error('[api/status] GitHub', resposta.status, detalhe.slice(0, 200));
      throw new Error(`GitHub respondeu ${resposta.status}`);
    }

    const dados = await resposta.json();
    const runs = (dados.workflow_runs || []).map((run) => {
      const st = traduzirStatus(run);
      return {
        id: run.id,
        nome: run.name || 'Publicar Shorts',
        status: st.codigo,
        rotulo: st.rotulo,
        criadoEm: run.created_at,
        atualizadoEm: run.updated_at,
        url: run.html_url,
        evento: run.event,
        branch: run.head_branch,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    return res.status(200).json({
      atualizadoEm: new Date().toISOString(),
      workflow: WORKFLOW,
      repositorio: `${OWNER}/${REPO}`,
      runs,
    });
  } catch (err) {
    console.error('[api/status]', err);
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(502).json({
      erro: 'Não foi possível ler o status do robô no GitHub agora. Tente de novo em instantes.',
    });
  }
}
