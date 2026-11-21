# Configuração do canal Vice City Diário

Arquivo editado pelo painel. Não coloque senhas aqui.

## IDIOMA DO CANAL: INGLÊS (desde 01/11/2026 — VALE MAIS que qualquer regra de idioma, voz ou script do prompt e deste arquivo)
O canal agora é para o público dos EUA. Cada execução publica 2 vídeos do MESMO Short:
1) VERSÃO EM INGLÊS (pública) — a que conta para o canal.
   - Roteiro em inglês americano natural e simples, 30-40s, no máximo 2,6 palavras por segundo (fala clara, sem atropelar; explique sem pular etapa). Gancho forte no 1º segundo, fatos concretos, final com pergunta para comentar.
   - Use SEMPRE tts_lines.py + render_trailer.py (servem para trechos de trailer E para screenshots: "src": "url:<link .jpg/.mp4 da Rockstar>"). NÃO use tts3.py nem render3.py (são só em português).
   - spec.json com "lang": "en" (a voz em inglês baixa sozinha). Títulos na tela, selos e legendas em inglês: selos "OFFICIAL", "RUMOR", "FANS SPOTTED", "GTA 5 FOOTAGE". O botão final já sai "FOLLOW FOR MORE". Nomes difíceis: use "pron" (ex.: "Leonida": "Leh-oh-nee-dah").
   - publicar/AAAA-MM-DD_HHMM.mp4 + .json: {"title": "... #Shorts" (inglês), "description": inglês + fonte + "Fan channel, not affiliated with Rockstar Games." + hashtags em inglês (#GTA6 #GTAVI #Rockstar), "tags": [inglês], "lang": "en", "privacy": "public"}.
   - Escolha de assunto: o que interessa ao público americano (as regras de histórico/variedade continuam valendo; o histórico antigo em português também conta como assunto já feito).
2) VERSÃO EM PORTUGUÊS (não listada) — só para o Thiago entender o que saiu.
   - Mesmas cenas/imagens, texto traduzido para português (spec_pt.json sem "lang", voz pt-BR de sempre, títulos e selos em português).
   - publicar/AAAA-MM-DD_HHMM_pt.mp4 + _pt.json: {"title": "[PT] <título em português>", "description": "Versão em português (não listada) do Short em inglês.", "lang": "pt", "privacy": "unlisted"}.
   - Se a versão em português falhar, publique só a em inglês e diga no relatório.
- Faça os 2 no MESMO commit/push. Relatório para o Thiago continua em português (com o título em inglês + tradução).

## LINKS OFICIAIS CONFIRMADOS (20/11/2026) — use em "src"
- 'LAUNCH' (Launch Trailer) e 'OUTNOW' (trailer "Grand Theft Auto VI: Out Now", saiu no lançamento): já estão no render_trailer.py. O Out Now é o mais novo: dê prioridade a ele.
- Clipes de personagem (Jason, Lucia, Cal Hampton, Boobie Ike, Dre'Quan Priest, Real Dimez, Raul Bautista, Brian Heder + animação da capa): pacote oficial https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Videos.zip (121 MB, 9 vídeos). Baixe, extraia e use cada arquivo com "url:" ou local.
- Screenshots oficiais (138): https://media-rockstargames-com.akamaized.net/VI/downloads/screenshots/GTAVI_Screenshots.zip ; Ultimate Edition (51): .../GTAVI_Ultimate_Edition_Benefits.zip ; Vintage Vice City (12): .../GTAVI_Vintage_Vice_City_Pack.zip. Imagem parada: no máximo 1 por vídeo.
- 'PRELOAD' (trailer do pré-download): ainda sem .mp4 direto confirmado; use só se achar o link na página da Rockstar.

## CENAS: MENOS REPETIÇÃO (21/11/2026) — o Thiago notou vídeo repetido (gato)
- A maior parte das cenas estava saindo de T1 e T2 (90 s cada), que o público já viu em todo vídeo. Nova regra: no máximo 1 cena de T1 e 1 de T2 por vídeo.
- O grosso das cenas (pelo menos metade) tem que vir de fontes menos usadas: An Extended Look (26 min, tem muito momento ainda não usado: varra do minuto 2 ao 25), 'OUTNOW', 'LAUNCH' e os clipes de personagem do pacote oficial GTAVI_Videos.zip (Jason, Lucia, Cal Hampton, Boobie Ike, Dre'Quan Priest, Real Dimez, Raul Bautista, Brian Heder).
- Antes de escolher cenas, leia usados.json e fuja dos trechos já usados (o render agora bloqueia ±8 s nos últimos 30 dias).
- A cena precisa ter relação com a fala do momento (gato na fala do gato = cena com animal ou bodega; se não houver, escolha cena neutra de rua/cidade que ainda não tenha sido usada, nunca a mesma cena de sempre).

## FONTES

## FONTES SÓ PARA CONFIRMAR

## FONTES PROIBIDAS

## LIMITE DE POSTAGEM E FORÇA DO ASSUNTO (20/11/2026)
- Dados de 20/11: 5 vídeos no mesmo dia. Os 3 primeiros (dinheiro, Jason gordo, morte e perda de dinheiro) fizeram de 961 a 1.959 views; os 2 últimos (cachorro de jet ski, gato no carro) fizeram 15 e 2. Vídeo demais no mesmo dia divide o público, e detalhe pequeno não segura.
- MÁXIMO 3 vídeos públicos por dia, com pelo menos 4 horas entre um e outro (veja o horário do último em publicar/ pelo git log). Se já bateu o limite, deixe o vídeo pronto na fila para o dia seguinte.
- EXCEÇÃO — NOTÍCIA GRANDE PASSA NA FRENTE: novidade OFICIAL da Rockstar ou que todo mundo está comentando nas últimas 24 h (trailer/vídeo novo, DLC, GTA Online, recorde de vendas oficial, nota/análise grande, atualização, polêmica grande) pode sair mesmo acima do limite (no máximo 1 extra por dia, 2 h depois do último). Nesse caso o vídeo da fila espera.
- Assunto tem que mexer com o jogador: dinheiro, morte, recorde, tamanho do mapa, segredo grande, regra que muda o jeito de jogar. Detalhe fofo ou pequeno (bicho, objeto) só se for absurdo E aparecer na imagem.
- Se a imagem oficial não MOSTRA o que o título promete (ex.: "gato no carro" sem gato na tela), escolha outro assunto.
- 1º quadro: o título completo e forte já na tela (nunca só metade, tipo "DON'T STEAL").

## IMAGEM TEM QUE BATER COM A FALA (20/11/2026 — REGRA DURA)
- Problema: as cenas estavam genéricas e não mostravam o que a narração dizia.
- Escolha o assunto PELA IMAGEM: antes de escrever, veja se existe trecho oficial que MOSTRA aquilo (folha de contato dos trailers, do Extended Look e dos clipes de personagem). Sem imagem que mostre, troque de assunto.
- Cada frase tem que ter uma cena que mostre o que ela diz: falou de dinheiro, aparece dinheiro, assalto ou loja; falou de polícia, aparece polícia; falou de Jason, aparece o Jason; falou de mar ou jet ski, aparece água e jet ski. Proibido cena "qualquer" do trailer só para preencher.
- Quando não existir imagem exata para uma frase, reescreva a frase para falar do que a imagem mostra, ou use selo pequeno "ILUSTRATIVO" (no máximo 1 cena por vídeo).
- QC obrigatório antes de publicar: para CADA cena, tire 1 quadro do final.mp4, descreva em 5 palavras o que aparece e compare com a frase. Se não bater, troque o trecho e renderize de novo. Escreva no relatório a lista "frase → o que aparece".

## CENAS NOVAS, SEM REPETIR (20/11/2026)
- Problema: os vídeos estavam repetindo as mesmas cenas. Fontes oficiais que DEVEM entrar no rodízio:
  1. Launch Trailer (15/10/2026) — página rockstargames.com/VI/launch-trailer. Ache o link .mp4 oficial (media-rockstargames-com.akamaized.net/VI/downloads/videos/...) e use "src": "url:<link>". Depois de achar, grave o link no SRC do render_trailer.py como 'LAUNCH' e faça commit.
  2. Trailer do pré-download (10/11/2026, "Pre-Load Now") — mesma coisa, como 'PRELOAD'.
  3. An Extended Look (EXT) tem 26 MINUTOS: use a parte toda (corridas, caiaque, mergulho, missões, cidade), não só os primeiros minutos.
  4. Clipes de personagem em rockstargames.com/VI/_next/static/media/ e qualquer vídeo novo que aparecer no Newswire.
- O render_trailer.py agora PARA se uma cena usar um trecho (±4 s) já usado nos últimos 14 dias e diz qual trocar. Escolha outro momento. Depois de publicar, faça commit do usados.json (é a memória do que já foi usado).
- Num mesmo vídeo, no máximo 3 cenas do mesmo trailer.
- Gameplay de outros canais/streamers/"no copyright": NÃO. Quem posta não é dono dos direitos (a Rockstar é) e a política da Rockstar só cobre o jogador postando o próprio gameplay, sem fins comerciais. Dá strike e bloqueio por conteúdo reutilizado.

## EDIÇÃO HUMANA, NÃO ROBÓTICA (20/11/2026)
- O render_trailer.py agora varia o movimento de câmera sozinho em cada cena (zoom in, zoom out, pan para os lados, "punch" rápido, câmera na mão) e nunca repete o da cena anterior. Não precisa configurar.
- Use isso a favor: escolha cenas que tenham coisa acontecendo dos dois lados do quadro (o pan revela), e em cena de impacto (batida, tiro, salto) ponha "mov": "punch" ou "vel": 0.8 (câmera lenta).
- Varie o "focus" (0.2 / 0.5 / 0.8) entre cenas do mesmo trailer: é outro enquadramento, parece outro ângulo.
- Ritmo: troque de cena a cada 2-3 s; frase de impacto pode ter cena mais curta (1,5 s).

## CAPA (20/11/2026) — TODO Short sai com capa chamativa
- O render_trailer.py gera saida/capa.jpg sozinho (escolhe a cena limpa mais colorida e forte) e o yt.py aplica na hora de publicar. Só preencha no spec.json:
  "capa": ["LINHA 1", "LINHA 2"]  → o dado mais forte do vídeo, no máximo 3 palavras por linha (ex.: ["GTA 6 HAS", "2 ENDINGS"], ["7.8 MILLION", "WATCHING"]). A última linha sai amarela.
  "capa_selo": "KOTAKU REVIEW" (opcional, fonte em selo vermelho), "capa_cena": 3 (opcional, se outra cena tiver imagem melhor).
- A capa promete o mesmo que o título e o vídeo entregam. Nada de capa enganosa.
- Confira capa.jpg no QC (texto legível, personagem ou carro bem visível). Se o yt.py disser "capa não aplicada", avise no relatório.

## MODELO QUE DEU CERTO (30 mil views e ~230 curtidas, 19/11/2026: "GTA 6 tem mais de um final" — reviews da Kotaku/Gfinity + 80-90 horas de jogo) — COPIE ESTA FÓRMULA
- Assunto: o que o JOGO TEM DE VERDADE e que o jogador quer saber antes de jogar (finais, duração, escolhas, o que fazer depois dos créditos), tirado de análises de sites grandes (Kotaku, Gfinity, IGN) e de falas da Rockstar.
- Estrutura: revelação forte → fonte na tela (selo verde "KOTAKU REVIEW") → números concretos (90 horas, 2 finais) → "suas escolhas importam" → o que dá pra fazer depois dos créditos → fecho com humor ("GOODBYE SLEEP") → FOLLOW FOR MORE.
- 1º segundo: o título do 1º quadro já aparece COMPLETO e é o dado mais forte do vídeo (ex.: "90 HOURS", "2 ENDINGS"); nunca abrir com frase pela metade (ex.: "MORE THAN"). Esse vídeo abriu fraco e mesmo assim bateu 30 mil — com abertura forte rende mais.
- Curtidas baixas (menos de 1%): termine com uma pergunta direta para o público responder nos comentários (ex.: "Which ending will you pick? Comment below") ANTES do follow.
- Título grande em 2 linhas no topo (branco + amarelo/rosa), legenda palavra a palavra embaixo, selo verde com a fonte, só cenas em movimento trocando a cada 2-3 s.
- PROIBIDO: cena com marca d'água ou nome de outro criador (ex.: "@usuario Follow" de TikTok). Só cena limpa da Rockstar.
- Spoiler: diga QUE existe mais de um final, nunca QUAL é o final.

## SEMANA DE LANÇAMENTO (19/11 a 03/12/2026) — VALE MAIS que "O QUE PROCURAR"
- O jogo saiu. O público agora quer o jogo de verdade e o que os jogadores estão descobrindo. Todo Short desta fase é sobre o jogo lançado (nada de hype de trailer antigo ou contagem regressiva).
- Formatos, nesta ordem de prioridade:
  1. O QUE OS JOGADORES DESCOBRIRAM: segredos, easter eggs, detalhes absurdos, recordes. Só o que site confiável publicou (IGN, GameSpot, Eurogamer, Polygon, Kotaku, The Verge, Rockstar Intel, VGC), com a fonte na descrição.
  2. NOTAS E NÚMEROS: nota no Metacritic/OpenCritic, recordes oficiais de venda ou de jogadores.
  3. PRIMEIRAS HORAS: dicas e "o que fazer primeiro" que a imprensa publicou.
  4. MATERIAL NOVO DA ROCKSTAR (trailer de lançamento, screenshots novos, Newswire).
- Banco de imagens oficial para esta fase: os 39 screenshots da Launch Gallery (rockstargames.com/VI/launch-gallery, 05/11/2026) e os vídeos de gameplay oficiais que a Rockstar já soltou (rockstargames.com/VI/media/videos). TODA cena tem que ser VÍDEO EM MOVIMENTO (trailers, An Extended Look, vídeos de gameplay oficiais, ou clipes/). Imagem parada derruba a retenção: no máximo 1 screenshot por vídeo, e só se não existir cena em vídeo do assunto. Troque de cena a cada 2-3 segundos. Se não houver vídeo oficial que mostre o assunto, escolha outro assunto.
- Título com a descoberta concreta no começo (ex.: "Players found a hidden ___ in GTA 6"). Nada de promessa que o vídeo não cumpre.
- Imagens: só material oficial da Rockstar (trailers, incluindo o de lançamento, e screenshots) ou arquivos da pasta clipes/ com crédito. NUNCA gameplay de outros canais ou streamers fora da pasta clipes/ (dá strike e bloqueia monetização por conteúdo reutilizado).
- Spoiler: não conte o final nem reviravolta grande da história. Se o assunto for spoiler leve, escreva "SPOILER" no 1º segundo.
- Descoberta que só aparece em post de rede social, sem site confiável confirmando: selo "FANS SPOTTED" e a palavra "reportedly" na narração.

## O QUE PROCURAR
- A PARTIR DE 19/11 (lançamento): toda execução confere primeiro se a Rockstar soltou material novo (rockstargames.com/VI, Newswire, rockstargames.com/VI/media/videos e /screenshots). Material oficial novo = prioridade máxima de vídeo. O Thiago NÃO vai comprar o jogo: nunca sugira gravar gameplay próprio.
- Se existir a pasta clipes/ no repositório (clipes que o Thiago baixou de canais "no copyright" ou de streamers que liberam cortes), pode usar esses arquivos como "src" local, com crédito do canal de origem na descrição (o arquivo clipes/CREDITOS.md diz de onde veio cada um). Nunca baixe vídeo do YouTube você mesmo.
- Até o lançamento (19/11), dê prioridade a estes formatos, que são os que mais dão views no canal:
  - MOMENTOS DO TRAILER: "os 3 momentos mais insanos", "a cena que ninguém percebeu" (com cenas dos trailers em movimento).
  - VERDADE OU MENTIRA: boato que está rodando + resposta clara (confirmado x rumor).
  - GTA 5 x GTA 6: comparar 1 coisa lado a lado (carros, polícia, água, personagens, mapa).
  - LUGAR REAL: o lugar de Miami/Flórida que inspirou um local do jogo.
  - CONTAGEM REGRESSIVA: só nas 2 últimas semanas antes do lançamento, no máximo 2x por semana.
- Notícia só entra se for GRANDE (anúncio oficial da Rockstar, gameplay novo, notas/análises, data, polêmica que está todo mundo comentando).
- SEMPRE trechos em movimento (trailers e gameplay oficial). Screenshot parado: no máximo 1 por vídeo.

## EVITAR
- ASSUNTO REPETIDO: antes de escolher, anote o TEMA PRINCIPAL dos últimos 20 vídeos do feed (ex.: vendas/números, veículos, trailer na TV, polícia, mapa, personagens). Se o seu tema for o mesmo de algum deles, mesmo com título diferente, escolha outro. Na dúvida, escolha outro.
- Notícia técnica ou de nicho que não gera hype: tamanho em GB, pré-download, disco na caixa, política/deputados, prêmios, preço de edição de colecionador. Esses vídeos ficaram com menos de 50 views.
- Se o único assunto disponível for fraco, escolha um dos formatos de "O QUE PROCURAR" em vez de uma notícia pequena.
- Não baixar o "An Extended Look" inteiro (14 GB). Use primeiro o Trailer 1, o Trailer 2 e os clipes curtos de personagem. Se precisar do Extended Look, recorte só os trechos necessários direto do link com ffmpeg (-ss e -t), sem baixar o arquivo todo.

## ESTILO DOS VÍDEOS
- VOZ (19/11/2026): tts_lines.py usa voz neural natural (inglês: Andrew; português: Antonio) via edge-tts, instala sozinho. A voz antiga (piper) era robótica e foi removida. Se a voz falhar, NÃO publique e avise. Escreva o roteiro como fala natural: frases curtas, vírgulas onde se respira.
- CENAS DE GTA 5: só use se tiver VÍDEO em movimento do GTA 5 com uso permitido (oficial da Rockstar ou clipe da pasta clipes/ com crédito), sempre com o selo "CENA DE GTA 5". Se só achar imagem parada, NÃO faça vídeo de GTA 5 x GTA 6: escolha outro formato.

## OPINIÕES DO THIAGO

## SUGESTÕES DE VÍDEO
- [x] COOL DOG: se você ficar longe da costa, ouve latidos e um cachorro de óculos escuros chega de jet ski para te resgatar e te leva à "Dog Island", com dinheiro e comida. Gancho: "Die at sea in GTA 6 and a dog on a jet ski saves you." Fonte: Windows Central (matéria sobre os clipes mais engraçados dos primeiros jogadores). Cite na descrição; se ainda só aparecer em rede social, use selo FANS SPOTTED e "reportedly". (20/11/2026)
- [x] GATOS DAS BODEGAS: dá para fazer carinho, mas roubar carro com gato dentro termina com arranhão e o gato voando pela janela (clipe viral). Gancho: "Don't steal a car with a cat inside in GTA 6." Fonte: Windows Central (matéria sobre os clipes mais engraçados dos primeiros jogadores). Cite na descrição; se ainda só aparecer em rede social, use selo FANS SPOTTED e "reportedly". (20/11/2026)
- [x] PINTAR O QUARTO: dá para escolher cor e pintar as paredes do quarto, e isso melhora o relacionamento com a Lucia. Gancho: "Painting your bedroom changes your relationship in GTA 6." Fonte: Windows Central (matéria sobre os clipes mais engraçados dos primeiros jogadores). Cite na descrição; se ainda só aparecer em rede social, use selo FANS SPOTTED e "reportedly". (20/11/2026)
- [x] CELULAR DO JOGO: o telefone tem um feed de vídeos curtos e posts com comentários realistas (um TikTok dentro do GTA). Gancho: "GTA 6 has its own TikTok inside the phone." Fonte: Windows Central (matéria sobre os clipes mais engraçados dos primeiros jogadores). Cite na descrição; se ainda só aparecer em rede social, use selo FANS SPOTTED e "reportedly". (20/11/2026)
- [ ] JOYSYSTEM: no console da casa dá para jogar minigames na TV do esconderijo (jogo dentro do jogo). Gancho: "You can play video games inside GTA 6." Fonte: Windows Central (matéria sobre os clipes mais engraçados dos primeiros jogadores). Cite na descrição; se ainda só aparecer em rede social, use selo FANS SPOTTED e "reportedly". (20/11/2026)
- [x] Quero vídeo inédito sobre o jogo ,quero engajamento (18/11/2026)
- [x] Sobre as novas imagem do jogo que a rockstar publicou , (07/11/2026)
- [x] SWAP MID-CHASE: a Rockstar confirmou em entrevistas que dá pra trocar entre Jason e Lucia no meio de uma perseguição (ideia vinda de Red Dead Redemption 2). Confirme na fonte oficial/entrevista antes de gravar; use trechos dos trailers com os dois juntos. (01/11/2026)
- [x] POLÍCIA NOVA (notícia oficial nova, por isso pode mesmo com o assunto polícia esgotado): a Rockstar confirmou uma mudança no funcionamento da polícia de GTA 6 em relação aos jogos anteriores. Diga exatamente o que mudou, segundo a fonte. (01/11/2026)
- [x] (2/2 feito: Hot Coffee 26/10/2026; países que baniram GTA 27/10/2026) Vídeo no estilo polêmica + curiosidade proibida (tipo "GTA vai ter cenas de sexo?").
- [x] (CANCELADO) TESTE GTA 5 x GTA 6 (1/3): A POLÍCIA. Alterne cenas oficiais de GTA 5 (com selo "CENA DE GTA 5") e trechos dos trailers de GTA 6, comparando o que já foi mostrado/confirmado. Se não achar material oficial do GTA 5, faça só com GTA 6 e avise no relatório. (25/10/2026)
- [x] TESTE GTA 5 x GTA 6 (2/3): OS CARROS E AS PERSEGUIÇÕES. Mesmo formato: cenas oficiais de GTA 5 com selo "CENA DE GTA 5" x trechos dos trailers de GTA 6. (25/10/2026)
- [x] (CANCELADO) TESTE GTA 5 x GTA 6 (3/3): LOS SANTOS x VICE CITY (a cidade, as praias, o movimento nas ruas). Mesmo formato, com selo "CENA DE GTA 5" nas cenas do 5. (25/10/2026)
- [x] GTA 6 pode ser indicado au goty , jogo do ano (16/10/2026)
- [x] ANÁLISE DO TRAILER DE LANÇAMENTO (15/10/2026), com destaque para o casal Jason e Lucia. Fatos: lançamento em 19/11 (PS5 e Xbox Series X|S), música "Flower in a Hurricane" (Justice com Tame Impala, SZA e King Gizzard), Lucia com tornozeleira, golpe que dá errado em Leonida. Destaque: o momento íntimo (15/10/2026)
- [x] Rumores que a versão do PC vai vai lançar junto com a versão online acho que no começo do ano em março se puder pesquisar para mim a fonte e a não se a se o rumo é foi lançado mesmo (14/10/2026)
- [x] NOTÍCIA/VERDADE OU MENTIRA: GTA 6 vai ter nudez? Segundo relatos da imprensa sobre o vazamento do Cyberleek (gameplay vazado em 8/10), Jason apareceria nu em parte das cenas e Lucia apareceria de costas, de roupa íntima. Trate como RUMOR (selo RUMOR + a palavra "rumor" na narração): a Rockstar não confirmou. Cite só o que sites confiáveis relataram. Use SÓ imagens oficiais da Rockstar do Jason e da Lucia (nada do vazamento, nada sensual). Pode comparar com o que a classificação etária oficial já confirmou. Não repetir o ângulo dos vídeos de 06/10 e 08/10. (12/10/2026)
- [x] GTA 6 vazou de novo: 25 minutos de gameplay!" (08/10/2026)
- [x] SUPOSTO RETORNO DO HACKER DE GTA 6? 👀” (06/10/2026)
- [x] GTA vai ter conteúdo mais 18 com senas de sexo ? Verifica nas fontes mas não pos algo que vai violar alguma diretrizes (06/10/2026)

## PAUSAS
