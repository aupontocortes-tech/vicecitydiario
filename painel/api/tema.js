/**
 * GET  /api/tema?canal=  → mostra o tema do PRÓXIMO vídeo.
 * POST /api/tema?canal=  → { senha, acao: 'trocar' } manda o próximo tema para o fim da fila.
 *
 * Mente Secreta: o próximo é o 1º arquivo (ordem alfabética) de roteiros/fila/.
 *   Trocar = renomeia esse arquivo com o maior número da fila + 1 (um commit só).
 * Outros canais: o próximo é a 1ª sugestão pendente "- [ ]" do CONFIG_CANAL.md
 *   (é a que a rotina usa). Sem sugestão pendente, o robô escolhe o tema na hora.
 *   Trocar = move essa sugestão para depois da última pendente.
 */

import { OWNER, obterCanal } from './canais.js';
import {
  headersGithub,
  senhaCorreta,
  lerBody,
  parseSugestao,
  montarLinhaSugestao,
  aplicarItensNaSecao,
  itensDaSecao,
  lerArquivo,
  lerMutarGravar,
} from './config.js';

const SECAO_SUGESTOES = 'SUGESTÕES DE VÍDEO';
const PASTA_FILA = 'roteiros/fila';
const BRANCH = 'main';

function responder(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(obj);
}

function erro(status, msg) {
  const e = new Error(msg);
  e.codigo = status;
  return e;
}

async function gh(token, caminho, opcoes = {}) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${caminho}`, {
    ...opcoes,
    headers: headersGithub(token, opcoes.body ? { 'Content-Type': 'application/json' } : {}),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GitHub ${opcoes.method || 'GET'} ${caminho} ${r.status}: ${t.slice(0, 160)}`);
  }
  return r.json();
}

// ---------- Mente Secreta: fila de roteiros ----------

async function listarFila(token, canal, ref = BRANCH) {
  let itens;
  try {
    itens = await gh(token, `${canal.repo}/contents/${PASTA_FILA}?ref=${ref}`);
  } catch (e) {
    if (String(e.message).includes(' 404')) return [];
    throw e;
  }
  return itens
    .filter((i) => i.type === 'file' && i.name.endsWith('.json'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

async function tituloRoteiro(token, canal, item, ref = BRANCH) {
  try {
    const arq = await gh(token, `${canal.repo}/contents/${item.path}?ref=${ref}`);
    const json = JSON.parse(Buffer.from(arq.content || '', 'base64').toString('utf8'));
    return String(json.titulo || '').replace(/\s*#shorts\s*$/i, '').trim() || item.name;
  } catch {
    return item.name;
  }
}

async function proximoDaFila(token, canal, ref = BRANCH) {
  const fila = await listarFila(token, canal, ref);
  if (!fila.length) {
    return { modo: 'fila', proximo: null, restantes: 0, aviso: 'Fila vazia. A tarefa de domingo cria novos roteiros.' };
  }
  return {
    modo: 'fila',
    proximo: { texto: await tituloRoteiro(token, canal, fila[0], ref) },
    restantes: fila.length,
  };
}

async function trocarNaFila(token, canal) {
  const fila = await listarFila(token, canal);
  if (fila.length < 2) throw erro(400, 'Só tem um roteiro na fila, não dá para trocar.');

  const primeiro = fila[0];
  const numeros = fila.map((f) => parseInt(f.name, 10)).filter((n) => Number.isFinite(n));
  const novoNum = String((numeros.length ? Math.max(...numeros) : fila.length) + 1).padStart(2, '0');
  const resto = primeiro.name.replace(/^\d+_?/, '') || primeiro.name;
  const novoCaminho = `${PASTA_FILA}/${novoNum}_${resto}`;

  // Um commit só: cria o arquivo com o nome novo (mesmo conteúdo) e apaga o antigo.
  const ref = await gh(token, `${canal.repo}/git/ref/heads/${BRANCH}`);
  const commitAtual = await gh(token, `${canal.repo}/git/commits/${ref.object.sha}`);
  const arvore = await gh(token, `${canal.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: commitAtual.tree.sha,
      tree: [
        { path: novoCaminho, mode: '100644', type: 'blob', sha: primeiro.sha },
        { path: primeiro.path, mode: '100644', type: 'blob', sha: null },
      ],
    }),
  });
  const novoCommit = await gh(token, `${canal.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `Painel: trocar tema (${primeiro.name} vai para o fim da fila)`,
      tree: arvore.sha,
      parents: [ref.object.sha],
    }),
  });
  await gh(token, `${canal.repo}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: novoCommit.sha, force: false }),
  });
  return novoCommit.sha;
}

// ---------- Outros canais: sugestões pendentes ----------

function sugestoesDe(texto) {
  return itensDaSecao(texto, SECAO_SUGESTOES).map((b, i) => parseSugestao(b, i));
}

async function proximaSugestao(token, canal) {
  const arq = await lerArquivo(token, canal);
  const lista = sugestoesDe(arq ? arq.texto : canal.arquivoInicial);
  const pendentes = lista.filter((s) => !s.feito);
  if (!pendentes.length) {
    return {
      modo: 'sugestao',
      proximo: null,
      restantes: 0,
      aviso: 'Nenhuma sugestão pendente: o robô escolhe o tema na hora de fazer o vídeo.',
    };
  }
  return { modo: 'sugestao', proximo: { texto: pendentes[0].texto }, restantes: pendentes.length };
}

async function trocarSugestao(token, canal) {
  await lerMutarGravar(
    token,
    canal,
    (textoBase) => {
      const lista = sugestoesDe(textoBase);
      const pend = lista.map((s, i) => (s.feito ? -1 : i)).filter((i) => i >= 0);
      if (pend.length < 2) throw erro(400, 'Só tem uma sugestão pendente, não dá para trocar.');
      const [item] = lista.splice(pend[0], 1);
      const ultimo = pend[pend.length - 1] - 1; // posição da última pendente depois do splice
      lista.splice(ultimo + 1, 0, item);
      return aplicarItensNaSecao(textoBase, SECAO_SUGESTOES, lista.map((s) => montarLinhaSugestao(s)));
    },
    'Painel: trocar tema (sugestão vai para o fim)'
  );
}

// ---------- Handler ----------

export default async function handler(req, res) {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  const canal = obterCanal(req);
  const token = process.env.GITHUB_TOKEN;
  if (!token) return responder(res, 503, { erro: 'GITHUB_TOKEN não configurado na Vercel.' });

  const usaFila = canal.id === 'ms';
  const ler = (ref) => (usaFila ? proximoDaFila(token, canal, ref) : proximaSugestao(token, canal));

  try {
    if (method === 'GET') return responder(res, 200, await ler());

    const senhaEnv = process.env.SENHA_PAINEL;
    if (!senhaEnv) return responder(res, 503, { erro: 'SENHA_PAINEL não configurada na Vercel.' });
    let body;
    try {
      body = await lerBody(req);
    } catch {
      return responder(res, 400, { erro: 'JSON inválido.' });
    }
    if (!senhaCorreta(body.senha, senhaEnv)) return responder(res, 401, { erro: 'Senha errada' });
    if (body.acao !== 'trocar') return responder(res, 400, { erro: 'Ação inválida.' });

    let ref;
    if (usaFila) ref = await trocarNaFila(token, canal);
    else await trocarSugestao(token, canal);

    return responder(res, 200, { ok: true, mensagem: 'Tema trocado!', ...(await ler(ref)) });
  } catch (err) {
    console.error('[api/tema]', err);
    if (err.codigo === 400) return responder(res, 400, { erro: err.message });
    return responder(res, 502, { erro: 'Erro ao falar com o GitHub. Tente de novo em instantes.' });
  }
}
