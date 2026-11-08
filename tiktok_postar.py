"""Posta no TikTok o vídeo mais novo de cada canal (que ainda não foi postado).
Roda no GitHub Actions (workflow tiktok.yml). Chaves: TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (Secrets).
As contas conectadas ficam criptografadas em tiktok/contas/<canal>.enc (feitas pelo app, /api/tiktok-login).
Os vídeos vêm da release "tiktok" de cada repositório (tiktok_release.sh)."""
import os, json, base64, hashlib, time, datetime, sys
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY, SECRET = os.environ['TIKTOK_CLIENT_KEY'].strip(), os.environ['TIKTOK_CLIENT_SECRET'].strip()
GH = {'Authorization': f"Bearer {os.environ['GH_TOKEN']}", 'Accept': 'application/vnd.github+json'}
CANAIS = {  # canal -> (repositório, prefixo do vídeo, filtro)
    'ms': ('mentesecreta', 'ms_', lambda n: True),
    'nv': ('nuncavisto', 'nv_', lambda n: True),
    'vcd': ('vicecitydiario', 'gta_', lambda n: n.endswith('_pt')),   # GTA: só a versão em português
}
AES = AESGCM(hashlib.sha256(('meuscanais-tiktok:' + SECRET).encode()).digest())
POSTADOS = 'tiktok/postados.json'
API = 'https://open.tiktokapis.com/v2'

def abre(c):
    raw = base64.b64decode(open(f'tiktok/contas/{c}.enc').read())
    return json.loads(AES.decrypt(raw[:12], raw[28:] + raw[12:28], None))
def fecha(obj):
    iv = os.urandom(12); ct = AES.encrypt(iv, json.dumps(obj).encode(), None)
    return base64.b64encode(iv + ct[-16:] + ct[:-16]).decode()

def renova(conta):
    r = requests.post(f'{API}/oauth/token/', data={'client_key': KEY, 'client_secret': SECRET,
                      'grant_type': 'refresh_token', 'refresh_token': conta['refresh_token']}, timeout=60).json()
    if 'access_token' not in r: raise RuntimeError(f"renovar chave falhou: {r}")
    conta['refresh_token'] = r.get('refresh_token', conta['refresh_token'])
    return r['access_token']

def video_novo(repo, pref, filtro, feitos):
    r = requests.get(f'https://api.github.com/repos/aupontocortes-tech/{repo}/releases/tags/tiktok', headers=GH, timeout=60)
    if r.status_code == 404: return None
    assets = r.json().get('assets', [])
    limite = (datetime.datetime.utcnow() - datetime.timedelta(days=2)).isoformat()   # nada de vídeo velho
    mp4 = sorted([a for a in assets if a['name'].startswith(pref) and a['name'].endswith('.mp4')
                  and filtro(a['name'][:-4]) and a['name'] not in feitos and a['created_at'] >= limite],
                 key=lambda a: a['created_at'])
    if not mp4: return None
    a = mp4[0]; base = a['name'][:-4]
    js = next((x for x in assets if x['name'] == base + '.json'), None)
    meta = requests.get(js['browser_download_url'], timeout=60).json() if js else {}
    return a, meta

def posta(token, caminho, legenda):
    H = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json; charset=UTF-8'}
    info = requests.post(f'{API}/post/publish/creator_info/query/', headers=H, timeout=60).json()
    opcoes = (info.get('data') or {}).get('privacy_level_options') or ['SELF_ONLY']
    priv = 'PUBLIC_TO_EVERYONE' if 'PUBLIC_TO_EVERYONE' in opcoes else opcoes[0]
    tam = os.path.getsize(caminho); chunk = tam if tam <= 60_000_000 else 10_000_000
    total = max(1, tam // chunk)
    body = {'post_info': {'title': legenda[:2200], 'privacy_level': priv, 'disable_comment': False,
                          'disable_duet': False, 'disable_stitch': False, 'is_aigc': False},
            'source_info': {'source': 'FILE_UPLOAD', 'video_size': tam, 'chunk_size': chunk, 'total_chunk_count': total}}
    r = requests.post(f'{API}/post/publish/video/init/', headers=H, json=body, timeout=60).json()
    if (r.get('error') or {}).get('code') == 'unaudited_client_can_only_post_to_private_accounts':
        # app ainda sem aprovação do TikTok: manda como RASCUNHO pra caixa de entrada do TikTok (o Thiago só toca em Publicar)
        priv = 'RASCUNHO'
        r = requests.post(f'{API}/post/publish/inbox/video/init/', headers=H, json={'source_info': body['source_info']}, timeout=60).json()
    if (r.get('error') or {}).get('code') not in (None, 'ok'): raise RuntimeError(f'init falhou: {r}')
    url, pid = r['data']['upload_url'], r['data']['publish_id']
    with open(caminho, 'rb') as f:
        for k in range(total):
            ini = k * chunk; fim = tam - 1 if k == total - 1 else ini + chunk - 1
            f.seek(ini); parte = f.read(fim - ini + 1)
            up = requests.put(url, data=parte, timeout=300, headers={'Content-Type': 'video/mp4',
                              'Content-Length': str(len(parte)), 'Content-Range': f'bytes {ini}-{fim}/{tam}'})
            if up.status_code not in (200, 201, 206): raise RuntimeError(f'upload falhou: {up.status_code} {up.text[:200]}')
    for _ in range(20):   # espera o TikTok processar
        time.sleep(15)
        s = requests.post(f'{API}/post/publish/status/fetch/', headers=H, json={'publish_id': pid}, timeout=60).json()
        st = (s.get('data') or {}).get('status')
        print('  status:', st)
        if st in ('PUBLISH_COMPLETE', 'SEND_TO_USER_INBOX', 'FAILED'): break
    return pid, priv, st

def main():
    feitos = json.load(open(POSTADOS)) if os.path.exists(POSTADOS) else {}
    mudou = False
    for c, (repo, pref, filtro) in CANAIS.items():
        if not os.path.exists(f'tiktok/contas/{c}.enc'): print(c, ': conta não conectada'); continue
        try:
            achado = video_novo(repo, pref, filtro, feitos.get(c, []))
            if not achado: print(c, ': nada novo'); continue
            a, meta = achado
            conta = abre(c); token = renova(conta)
            open(f'tiktok/contas/{c}.enc', 'w').write(fecha(conta)); mudou = True   # chave renovada
            arq = f'/tmp/{a["name"]}'
            open(arq, 'wb').write(requests.get(a['browser_download_url'], timeout=300).content)
            pid, priv, st = posta(token, arq, meta.get('legenda') or meta.get('titulo') or '')
            print(c, ': postado', a['name'], priv, st)
            if st != 'FAILED':
                feitos.setdefault(c, []).append(a['name']); feitos[c] = feitos[c][-50:]; mudou = True
        except Exception as e:
            print(c, ': ERRO', e)
    if mudou: json.dump(feitos, open(POSTADOS, 'w'), indent=1)

if __name__ == '__main__':
    main()
