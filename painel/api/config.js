/**
 * GET/POST /api/config
 * Lê e grava CONFIG_CANAL.md na raiz do repositório via API do GitHub.
 * Segredos só em process.env: GITHUB_TOKEN e SENHA_PAINEL.
 */

import crypto from 'crypto';

const OWNER = 'aupontocortes-tech';
const REPO = 'vicecitydiario';
const PATH = 'CONFIG_CANAL.md';
const BRANCH = 'main';
const CONTENTS_URL =
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

const SECAO_SUGESTOES = 'SUGESTÕES DE VÍDEO';
const LIMITE_ITEM = 300;

/** Markdown inicial se o arquivo ainda não existir no repositório. */
const ARQUIVO_INICIAL = `# Configuração do canal Vice City Diário

Arquivo editado pelo painel. Não coloque senhas aqui.

## FONTES

## FONTES SÓ PARA CONFIRMAR

## FONTES PROIBIDAS

## O QUE PROCURAR

## EVITAR

## ESTILO DOS VÍDEOS

## OPINIÕES DO THIAGO

## ${SECAO_SUGESTOES}
`;

function headersGithub(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ViceCityDiarioPainel/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

/** Compara senha sem vazar o tamanho exato em tempo constante aproximado. */
function senhaCorreta(enviada, esperada) {
  if (!esperada || typeof enviada !== 'string') return false;
  const a = Buffer.from(String(enviada));
  const b = Buffer.from(String(esperada));
  const len = Math.max(a.length, b.length, 1);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  const iguais = crypto.timingSafeEqual(pa, pb);
  return iguais && a.length === b.length;
}

/** Lê o corpo JSON (Vercel já parseia; local precisa do stream). */
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

/** Quebra o markdown em seções ## TÍTULO → itens "- ...". */
function parseMarkdown(md) {
  const linhas = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const secoes = {};
  let atual = null;
  const ordem = [];

  for (const linha of linhas) {
    const h = linha.match(/^##\s+(.+?)\s*$/);
    if (h) {
      atual = h[1].trim();
      if (!secoes[atual]) {
        secoes[atual] = [];
        ordem.push(atual);
      }
      continue;
    }
    if (atual == null) continue;
    const item = linha.match(/^-+\s+(.*)$/);
    if (item) {
      secoes[atual].push(item[1]);
    }
  }

  return { secoes, ordem, linhas };
}

/** Interpreta uma linha de sugestão: [ ]/[x] texto | fonte: ... (data). */
function parseSugestao(conteudo, indice) {
  const raw = String(conteudo || '').trim();
  const m = raw.match(
    /^\[([ xX])\]\s*(.+?)(?:\s*\|\s*fonte:\s*(.+?))?\s*(?:\((\d{2}\/\d{2}\/\d{4})\))?\s*$/
  );

  if (!m) {
    return {
      indice,
      feito: false,
      texto: raw.replace(/^\[[ xX]\]\s*/, ''),
      fonte: '',
      data: '',
      bruto: raw,
    };
  }

  return {
    indice,
    feito: m[1].toLowerCase() === 'x',
    texto: (m[2] || '').trim(),
    fonte: (m[3] || '').trim(),
    data: m[4] || '',
    bruto: raw,
  };
}

/** Monta a linha markdown de uma sugestão. */
function montarLinhaSugestao({ feito, texto, fonte, data }) {
  const marca = feito ? 'x' : ' ';
  const fonteParte = fonte ? ` | fonte: ${fonte}` : '';
  const dataParte = data ? ` (${data})` : '';
  return `- [${marca}] ${texto}${fonteParte}${dataParte}`;
}

/** Data de hoje em Brasília (DD/MM/AAAA). */
function dataHojeBrasilia() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

/**
 * Reconstrói o markdown alterando só os itens de uma seção.
 * Preserva título, textos fora de lista e outras seções.
 */
function aplicarItensNaSecao(md, tituloSecao, novosItensLinhas) {
  const texto = String(md || '').replace(/\r\n/g, '\n');
  const linhas = texto.split('\n');
  const header = `## ${tituloSecao}`;
  let inicio = -1;

  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].trim() === header || linhas[i].match(new RegExp(`^##\\s+${escapeRegex(tituloSecao)}\\s*$`))) {
      inicio = i;
      break;
    }
  }

  // Seção inexistente → cria no final
  if (inicio === -1) {
    const base = texto.trimEnd();
    const bloco = [`## ${tituloSecao}`, ...novosItensLinhas, ''].join('\n');
    return `${base}\n\n${bloco}`.trimEnd() + '\n';
  }

  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (/^##\s+/.test(linhas[i])) {
      fim = i;
      break;
    }
  }

  // Mantém linhas que NÃO são itens de lista (comentários/vazios entre o título e o fim)
  const antes = linhas.slice(0, inicio + 1);
  const depois = linhas.slice(fim);
  const meioOriginal = linhas.slice(inicio + 1, fim);
  const naoItens = meioOriginal.filter((l) => !/^-\s+/.test(l) && l.trim() !== '');

  // Se só havia itens, não reintroduz lixo; se havia notas, preserva após os itens
  const meio = [...novosItensLinhas];
  if (naoItens.length && novosItensLinhas.length === 0) {
    // seção esvaziada: deixa uma linha em branco
  }

  const juntar = [...antes, ...meio];
  if (depois.length) {
    if (juntar[juntar.length - 1] !== '') juntar.push('');
    juntar.push(...depois);
  }

  let out = juntar.join('\n');
  if (!out.endsWith('\n')) out += '\n';
  return out;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lista itens "- ..." de uma seção (conteúdo sem o "- "). */
function itensDaSecao(md, titulo) {
  const { secoes } = parseMarkdown(md);
  return secoes[titulo] || [];
}

/** Lê o arquivo no GitHub. Retorna { sha, texto } ou null se 404. */
async function lerArquivo(token) {
  const url = `${CONTENTS_URL}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: headersGithub(token) });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GitHub GET ${res.status}: ${t.slice(0, 180)}`);
  }

  const dados = await res.json();
  const texto = Buffer.from(dados.content || '', 'base64').toString('utf8');
  return { sha: dados.sha, texto };
}

/** Grava o arquivo (cria ou atualiza). Lança erro com codigo 409 em conflito. */
async function gravarArquivo(token, texto, sha, mensagem) {
  const corpo = {
    message: mensagem,
    content: Buffer.from(texto, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) corpo.sha = sha;

  const res = await fetch(CONTENTS_URL, {
    method: 'PUT',
    headers: headersGithub(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(corpo),
  });

  if (res.status === 409) {
    const err = new Error('CONFLITO_409');
    err.codigo = 409;
    throw err;
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${res.status}: ${t.slice(0, 180)}`);
  }

  return res.json();
}

/**
 * Lê → aplica mutação → grava.
 * Se der 409, lê de novo e tenta a mutação mais uma vez.
 */
async function lerMutarGravar(token, mutator, mensagem) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const arq = await lerArquivo(token);
    const textoBase = arq ? arq.texto : ARQUIVO_INICIAL;
    const sha = arq ? arq.sha : null;
    const textoNovo = mutator(textoBase);
    try {
      await gravarArquivo(token, textoNovo, sha, mensagem);
      return;
    } catch (err) {
      if (err.codigo === 409 && tentativa === 0) continue;
      throw err;
    }
  }
}

function responderJson(res, status, obj, cache = false) {
  if (cache) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(obj);
}

function montarRespostaLeitura(texto, sha) {
  const { secoes, ordem } = parseMarkdown(texto);
  const brutos = secoes[SECAO_SUGESTOES] || [];
  const sugestoes = brutos.map((b, i) => parseSugestao(b, i));

  // Seções “normais” (sem o conteúdo bruto das sugestões tipado)
  const secoesLimpas = {};
  for (const nome of ordem) {
    if (nome === SECAO_SUGESTOES) continue;
    secoesLimpas[nome] = secoes[nome] || [];
  }

  return {
    atualizadoEm: new Date().toISOString(),
    sha: sha || null,
    secoes: secoesLimpas,
    ordemSecoes: ordem.filter((n) => n !== SECAO_SUGESTOES),
    sugestoes,
  };
}

export default async function handler(req, res) {
  const method = req.method || 'GET';

  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return responderJson(res, 405, { erro: 'Método não permitido' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return responderJson(res, 503, {
      erro: 'GITHUB_TOKEN não configurado na Vercel.',
    });
  }

  try {
    if (method === 'GET') {
      const arq = await lerArquivo(token);
      if (!arq) {
        return responderJson(
          res,
          200,
          montarRespostaLeitura(ARQUIVO_INICIAL, null),
          true
        );
      }
      return responderJson(res, 200, montarRespostaLeitura(arq.texto, arq.sha), true);
    }

    // ----- POST: exige senha -----
    const senhaEnv = process.env.SENHA_PAINEL;
    if (!senhaEnv) {
      return responderJson(res, 503, {
        erro: 'SENHA_PAINEL não configurada na Vercel.',
      });
    }

    let body;
    try {
      body = await lerBody(req);
    } catch {
      return responderJson(res, 400, { erro: 'JSON inválido.' });
    }

    if (!senhaCorreta(body.senha, senhaEnv)) {
      return responderJson(res, 401, { erro: 'Senha errada' });
    }

    const acao = body.acao;
    if (!['adicionar', 'editar', 'apagar'].includes(acao)) {
      return responderJson(res, 400, { erro: 'Ação inválida.' });
    }

    const tipo = body.tipo || (body.secao === SECAO_SUGESTOES ? 'sugestao' : 'secao');

    // ========== Sugestões de vídeo ==========
    if (tipo === 'sugestao' || body.secao === SECAO_SUGESTOES) {
      // Validação antecipada (não depende do estado do arquivo)
      if (acao === 'adicionar') {
        const texto = String(body.texto || body.novoTexto || '').trim();
        const fonte = String(body.fonte || '').trim();
        if (!texto) {
          return responderJson(res, 400, { erro: 'Sugestão obrigatória.' });
        }
        if (texto.length > LIMITE_ITEM) {
          return responderJson(res, 400, {
            erro: `Sugestão com no máximo ${LIMITE_ITEM} caracteres.`,
          });
        }
        if (fonte.length > LIMITE_ITEM) {
          return responderJson(res, 400, {
            erro: `Fonte com no máximo ${LIMITE_ITEM} caracteres.`,
          });
        }
      } else if (acao === 'editar') {
        const texto = String(body.texto || body.novoTexto || '').trim();
        if (!texto) {
          return responderJson(res, 400, { erro: 'Sugestão obrigatória.' });
        }
        if (texto.length > LIMITE_ITEM) {
          return responderJson(res, 400, {
            erro: `Sugestão com no máximo ${LIMITE_ITEM} caracteres.`,
          });
        }
      }

      await lerMutarGravar(
        token,
        (textoBase) => {
          const lista = itensDaSecao(textoBase, SECAO_SUGESTOES).map((b, i) =>
            parseSugestao(b, i)
          );

          if (acao === 'adicionar') {
            const texto = String(body.texto || body.novoTexto || '').trim();
            const fonte = String(body.fonte || '').trim();
            const nova = montarLinhaSugestao({
              feito: false,
              texto,
              fonte,
              data: dataHojeBrasilia(),
            });
            const novasLinhas = [nova, ...lista.map((s) => montarLinhaSugestao(s))];
            return aplicarItensNaSecao(textoBase, SECAO_SUGESTOES, novasLinhas);
          }

          const indice = Number(body.indice ?? body.item);
          if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length) {
            const err = new Error('Sugestão não encontrada.');
            err.codigo = 400;
            throw err;
          }

          if (acao === 'apagar') {
            const rest = lista.filter((_, i) => i !== indice);
            return aplicarItensNaSecao(
              textoBase,
              SECAO_SUGESTOES,
              rest.map((s) => montarLinhaSugestao(s))
            );
          }

          const atual = lista[indice];
          const texto = String(body.texto || body.novoTexto || '').trim();
          const fonte =
            body.fonte !== undefined ? String(body.fonte || '').trim() : atual.fonte;
          lista[indice] = {
            ...atual,
            texto,
            fonte,
            data: atual.data || dataHojeBrasilia(),
          };
          return aplicarItensNaSecao(
            textoBase,
            SECAO_SUGESTOES,
            lista.map((s) => montarLinhaSugestao(s))
          );
        },
        `Painel: ${acao} em ${SECAO_SUGESTOES}`
      );

      const depois = await lerArquivo(token);
      return responderJson(res, 200, {
        ok: true,
        mensagem:
          acao === 'adicionar'
            ? 'Sugestão enviada!'
            : acao === 'apagar'
              ? 'Sugestão apagada.'
              : 'Sugestão atualizada.',
        ...(depois
          ? montarRespostaLeitura(depois.texto, depois.sha)
          : montarRespostaLeitura(ARQUIVO_INICIAL, null)),
      });
    }

    // ========== Seções genéricas (tela Fontes) ==========
    const secao = String(body.secao || '').trim();
    if (!secao || secao === SECAO_SUGESTOES) {
      return responderJson(res, 400, { erro: 'Seção inválida.' });
    }

    if (acao === 'adicionar' || acao === 'editar') {
      const novo = String(body.novoTexto || body.texto || '').trim();
      if (!novo) return responderJson(res, 400, { erro: 'Texto obrigatório.' });
      if (novo.length > LIMITE_ITEM) {
        return responderJson(res, 400, {
          erro: `Item com no máximo ${LIMITE_ITEM} caracteres.`,
        });
      }
    }

    await lerMutarGravar(
      token,
      (textoBase) => {
        let itens = [...itensDaSecao(textoBase, secao)];
        if (acao === 'adicionar') {
          itens.push(String(body.novoTexto || body.texto || '').trim());
        } else {
          const indice = Number(body.item ?? body.indice);
          if (!Number.isInteger(indice) || indice < 0 || indice >= itens.length) {
            const err = new Error('Item não encontrado.');
            err.codigo = 400;
            throw err;
          }
          if (acao === 'apagar') {
            itens = itens.filter((_, i) => i !== indice);
          } else {
            itens[indice] = String(body.novoTexto || body.texto || '').trim();
          }
        }
        return aplicarItensNaSecao(
          textoBase,
          secao,
          itens.map((t) => `- ${t}`)
        );
      },
      `Painel: ${acao} em ${secao}`
    );

    const depois = await lerArquivo(token);
    return responderJson(res, 200, {
      ok: true,
      mensagem: 'Salvo!',
      ...(depois
        ? montarRespostaLeitura(depois.texto, depois.sha)
        : montarRespostaLeitura(ARQUIVO_INICIAL, null)),
    });
  } catch (err) {
    console.error('[api/config]', err);
    if (err.codigo === 400) {
      return responderJson(res, 400, { erro: err.message });
    }
    return responderJson(res, 502, {
      erro: 'Erro ao salvar. Tente de novo em instantes.',
    });
  }
}
