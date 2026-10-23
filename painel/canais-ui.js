/**
 * Canais que aparecem no painel (parte visual).
 * NOVO CANAL: copie um bloco abaixo, troque os dados, coloque o ícone na pasta painel/
 * e adicione o mesmo id em painel/api/canais.js (repositório, horários, rotina).
 *
 * cor: cor de destaque do canal | corTexto: cor do texto em cima da cor de destaque
 * icone: imagem redonda do canal | slots: horários diários (hora em Brasília)
 * rotinas: botões de "fazer vídeo agora" (tipo precisa existir em api/canais.js)
 */
window.CANAIS_LISTA = [
  {
    id: 'vcd',
    nome: 'Vice City Diário',
    curto: 'Vice City',
    cor: '#ff3c96',
    corTexto: '#ffffff',
    icone: '/icon.jpg',
    placeholder: 'Ex.: Quem é Boobie Mike em GTA 6?',
    slots: [
      { hora: 8, tipo: 'Screenshots', sub: 'Imagens do jogo' },
      { hora: 12, tipo: 'Trechos de trailer', sub: 'Cortes do trailer' },
      { hora: 14, tipo: 'Screenshots', sub: 'Imagens do jogo' },
    ],
    rotinas: [
      { tipo: 'screenshots', rotulo: 'Screenshots', icone: '📸', classe: 'screenshots' },
      { tipo: 'trailer', rotulo: 'Trailer', icone: '🎬', classe: 'trailer' },
    ],
  },
  {
    id: 'nv',
    nome: 'Nunca Visto',
    curto: 'Nunca Visto',
    cor: '#28e6dc',
    corTexto: '#120a1f',
    icone: '/icon-nv.jpg',
    placeholder: 'Ex.: Um fato que quase ninguém viu',
    slots: [{ hora: 18, tipo: 'Curiosidade', sub: 'Short de curiosidade' }],
    rotinas: [{ tipo: 'curiosidade', rotulo: 'Curiosidade', icone: '✨', classe: 'curiosidade' }],
  },
  {
    id: 'ms',
    nome: 'Mente Secreta',
    curto: 'Mente Secreta',
    cor: '#7c5cbf',
    corTexto: '#ffffff',
    icone: '/icon-ms.jpg?v=2',
    placeholder: 'Ex.: Por que a gente confia em quem fala com segurança?',
    slots: [{ hora: 12, tipo: 'Psicologia', sub: 'Agendado pro meio-dia' }],
    rotinas: [{ tipo: 'psicologia', rotulo: 'Publicar agora', icone: '🧠', classe: 'curiosidade' }],
  },
  {
    id: 'vf',
    nome: 'Veil Frequency',
    curto: 'Veil Frequency',
    cor: '#c1121f',
    corTexto: '#ffffff',
    icone: '/icon-veil.jpg',
    placeholder: 'Ex.: A transmission from a lighthouse that was torn down in 1961',
    slots: [{ hora: 18, tipo: 'Terror (inglês)', sub: 'Vai ao ar às 18h' }],
    rotinas: [{ tipo: 'terror', rotulo: 'Publicar agora', icone: '📻', classe: 'curiosidade' }],
  },
];

/** Aplica a cor do canal no <body> (variáveis CSS usadas pelo tema). */
window.aplicarTemaCanal = function (canal) {
  const b = document.body;
  b.style.setProperty('--cor-canal', canal.cor);
  b.style.setProperty('--cor-canal-texto', canal.corTexto || '#ffffff');
  b.classList.toggle('canal-tema', canal.id !== window.CANAIS_LISTA[0].id);
  b.classList.toggle('canal-ms', canal.id === 'ms');
  b.classList.toggle('canal-veil', canal.id === 'vf');
};

/** Monta os botões do seletor de canal. */
window.montarSeletorCanais = function (el, atual) {
  el.innerHTML = window.CANAIS_LISTA.map((c) =>
    `<button type="button" class="btn-canal" data-canal="${c.id}" aria-pressed="${c.id === atual}" title="${c.nome}">${c.curto || c.nome}</button>`
  ).join('');
  const ativo = el.querySelector('[aria-pressed="true"]');
  if (ativo) ativo.scrollIntoView({ inline: 'center', block: 'nearest' });
};
