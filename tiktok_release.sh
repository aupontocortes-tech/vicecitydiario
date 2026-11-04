#!/usr/bin/env bash
# Guarda o vídeo publicado numa "release" do GitHub chamada tiktok, para o app Meus Canais oferecer o download pro TikTok.
# Uso: bash tiktok_release.sh VIDEO.mp4 META.json NOME   (precisa de GH_TOKEN). Nunca derruba a publicação: erros só avisam.
set +e
V="$1"; M="$2"; N="$3"; T=$(mktemp -d)
gh release view tiktok >/dev/null 2>&1 || gh release create tiktok --title "Vídeos para o TikTok" --notes "Gerado pelo robô. O app Meus Canais lista daqui." >/dev/null
cp "$V" "$T/$N.mp4"
python3 - "$M" "$T/$N.json" <<'PY'
import json, sys, re
m = json.load(open(sys.argv[1], encoding='utf-8'))
t = (m.get('title') or m.get('titulo') or '').replace('#Shorts', '').strip()
d = m.get('description') or m.get('descricao') or ''
tags = m.get('hashtags') or ' '.join(dict.fromkeys(re.findall(r'#\w+', d)))
tags = ' '.join(x for x in tags.split() if x.lower() != '#shorts')
json.dump({'titulo': t, 'legenda': (t + '\n\n' + tags + ' #fyp').strip(), 'idioma': m.get('lang', 'pt')}, open(sys.argv[2], 'w'), ensure_ascii=False)
PY
gh release upload tiktok "$T/$N.mp4" "$T/$N.json" --clobber && echo "TikTok: $N guardado"
# guarda só os 10 vídeos mais novos (20 arquivos)
gh release view tiktok --json assets -q '.assets|sort_by(.createdAt)|reverse|.[20:]|.[].name' | while read -r a; do gh release delete-asset tiktok "$a" -y; done
exit 0
