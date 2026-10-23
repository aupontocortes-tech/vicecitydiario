/**
 * Configuração dos canais do painel.
 * Segredos só em process.env — este arquivo não guarda token.
 * NOVO CANAL: adicione aqui (repo, channelId, horários, rotina) E em painel/canais-ui.js (nome, cor, ícone, botões).
 * ?canal=vcd (padrão), ?canal=nv ou ?canal=ms.
 */

export const OWNER = 'aupontocortes-tech';

const ARQUIVO_VCD = `# Configuração do canal Vice City Diário

Arquivo editado pelo painel. Não coloque senhas aqui.

## FONTES

## FONTES SÓ PARA CONFIRMAR

## FONTES PROIBIDAS

## O QUE PROCURAR

## EVITAR

## ESTILO DOS VÍDEOS

## OPINIÕES DO THIAGO

## SUGESTÕES DE VÍDEO

## PAUSAS
`;

const ARQUIVO_NV = `# Configuração do canal Nunca Visto

Arquivo editado pelo painel. Não coloque senhas aqui.

## SUGESTÕES DE VÍDEO

## EVITAR

## PAUSAS
`;

const ARQUIVO_MS = `# Configuração do canal Mente Secreta

Arquivo editado pelo painel. Não coloque senhas aqui.

## SUGESTÕES DE VÍDEO

## EVITAR

## PAUSAS
`;

const ARQUIVO_VF = `# Configuração do canal Veil Frequency

Arquivo editado pelo painel. Não coloque senhas aqui.

## SUGESTÕES DE VÍDEO

## EVITAR

## PAUSAS
`;

const CANAIS = {
  vcd: {
    id: 'vcd',
    nome: 'Vice City Diário',
    repo: 'vicecitydiario',
    channelId: 'UCF-LmLBkuqN8Qz9Bf0rWolA',
    horarios: ['08h', '12h', '14h'],
    arquivoInicial: ARQUIVO_VCD,
    rotinas: [
      {
        tipo: 'screenshots',
        url: process.env.ROTINA_8H_URL,
        token: process.env.ROTINA_8H_TOKEN,
        rotulo: 'screenshots (8h)',
        mensagem:
          'Disparo manual pelo painel Vice City Diário: produzir Short com screenshots agora.',
      },
      {
        tipo: 'trailer',
        url: process.env.ROTINA_12H_URL,
        token: process.env.ROTINA_12H_TOKEN,
        rotulo: 'trailer (12h)',
        mensagem:
          'Disparo manual pelo painel Vice City Diário: produzir Short com trecho de trailer agora.',
      },
    ],
  },
  nv: {
    id: 'nv',
    nome: 'Nunca Visto',
    repo: 'nuncavisto',
    channelId: 'UCIKnhxWJaxbmCudg2Qp9YhA',
    horarios: ['18h'],
    arquivoInicial: ARQUIVO_NV,
    rotinas: [
      {
        tipo: 'curiosidade',
        url: process.env.ROTINA_NV_URL,
        token: process.env.ROTINA_NV_TOKEN,
        rotulo: 'curiosidade (18h)',
        mensagem:
          'Disparo manual pelo painel Nunca Visto: produzir 1 Short de curiosidade agora.',
      },
    ],
  },
  ms: {
    id: 'ms',
    nome: 'Mente Secreta',
    repo: 'mentesecreta',
    channelId: process.env.MS_CHANNEL_ID || 'UCyR9GXiWtZCoHhvhrJZoUzQ',
    horarios: ['12h'],
    arquivoInicial: ARQUIVO_MS,
    rotinas: [
      {
        // Este canal não usa rotina do Claude: o botão dispara o GitHub Actions (publica na hora)
        tipo: 'psicologia',
        github: { workflow: 'publicar.yml', inputs: { modo: 'agora' } },
        rotulo: 'publicar agora',
        mensagem: '',
      },
    ],
  },
  vf: {
    id: 'vf',
    nome: 'Veil Frequency',
    repo: 'mentesecreta', // mora na pasta veil/ do repositório do Mente Secreta
    configPath: 'veil/CONFIG_CANAL.md',
    pastaFila: 'veil/serie/fila',
    workflow: 'veil.yml',
    channelId: process.env.VF_CHANNEL_ID || 'UCoe34hx015k4fnSI9IwwElg',
    horarios: ['18h'],
    arquivoInicial: ARQUIVO_VF,
    rotinas: [
      {
        // Publica pelo GitHub Actions (workflow veil.yml), igual ao Mente Secreta
        tipo: 'terror',
        github: { workflow: 'veil.yml', inputs: { modo: 'agora' } },
        rotulo: 'publicar agora',
        mensagem: '',
      },
    ],
  },
};

/** Lê ?canal= da query (Vercel em req.query, local na URL). Padrão: vcd. */
export function idCanal(req) {
  let bruto = '';
  const q = req?.query?.canal;
  if (Array.isArray(q)) bruto = q[0] || '';
  else if (typeof q === 'string') bruto = q;
  else {
    try {
      bruto = new URL(req?.url || '/', 'http://localhost').searchParams.get('canal') || '';
    } catch {
      bruto = '';
    }
  }
  const id = String(bruto).trim().toLowerCase();
  return CANAIS[id] ? id : 'vcd';
}

/** Canal completo para as rotas. Nunca enviar este objeto inteiro ao navegador. */
export function obterCanal(req) {
  return CANAIS[idCanal(req)];
}

/** Dados públicos, sem URL nem token de rotina. */
export function resumoPublico(canal) {
  return {
    id: canal.id,
    nome: canal.nome,
    horarios: canal.horarios,
    rotinas: canal.rotinas.map((r) => ({ tipo: r.tipo, rotulo: r.rotulo })),
  };
}

export default function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    canais: Object.values(CANAIS).map(resumoPublico),
  });
}
