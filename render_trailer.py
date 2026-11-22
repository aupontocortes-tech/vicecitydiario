"""Short vertical (1080x1920) com trechos dos TRAILERS OFICIAIS da Rockstar (sem áudio original),
narração, títulos, selo e legendas palavra a palavra.
Uso: python3 render_trailer.py spec.json saida_dir   (rode antes: python3 tts_lines.py spec.json saida_dir)
spec.json:
{
 "scenes": [
   {"text": "frase narrada", "src": "T2", "start": 12.5, "focus": 0.5,
    "title": "LINHA 1|LINHA 2", "title_color": "yellow", "badge": "OFICIAL • ROCKSTAR"},
   ...
 ],
 "credit": "Imagens: trailers oficiais Rockstar Games • Vice City Diário"
}
src: T1 (Trailer 1, 90s), T2 (Trailer 2), EXT (An Extended Look, 26 min), LAUNCH (Launch Trailer 15/10/2026, 780 MB), OUTNOW (trailer "Out Now" do dia do lançamento, 255 MB), PRELOAD (trailer do pré-download 10/11/2026), ou "clip:Arquivo.HASH.mp4"
(clipes de personagem em rockstargames.com/VI/_next/static/media/), ou "url:https://..." (vídeo .mp4 ou
imagem .jpg/.png OFICIAL, só de domínios da Rockstar; imagem vira cena parada com zoom lento).
start em segundos no vídeo de origem (ignorado em imagem).
tag (opcional): selo PEQUENO no canto superior esquerdo, ex. "CENA DE GTA 5". Use SEMPRE que a cena for de outro jogo.
focus: 0 = esquerda, 0.5 = centro, 1 = direita (onde fica o recorte vertical).
forte (opcional): "90 HORAS" ou ["2 FINAIS"] = palavra forte que pula grande em cima quando o narrador fala (números entram sozinhos).
icone (opcional): check, x, alerta, dinheiro, estrela, pergunta, seta + "icone_em": "palavra" (quando aparece).
trans (opcional): zoom, flash, whip = efeito na troca de cena (padrão: alterna sozinho, com som de whoosh).
mov (opcional): zoom_in, zoom_out, pan, pan_rev, punch, drift — se omitir, varia sozinho e nunca repete o da cena anterior.
vel (opcional): 0.8 = câmera lenta (cena de ação/impacto).
capa (opcional): ["LINHA 1", "LINHA 2"] = texto gigante da capa (use o dado mais forte: "90 HOURS", "2 ENDINGS").
capa_selo (opcional): selo rosa neon embaixo do texto, ex. "OFFICIAL". capa_cena (opcional): índice da cena da imagem da capa.
Saída: saida_dir/final.mp4 e saida_dir/capa.jpg (capa chamativa; o yt.py aplica sozinho)."""
import re, sys, os, json, subprocess, math, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = {
    'T1': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Trailer_1/GTAVI_Trailer_1.mp4',
    'T2': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Trailer_2/GTAVI_Trailer_2.mp4',
    'EXT': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_An_Extended_Look/GTAVI_An_Extended_Look.mp4',
    'LAUNCH': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Launch_Trailer/GTAVI_Launch_Trailer.mp4',
    'OUTNOW': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Out_Now/GTAVI_Out_Now.mp4',
    # PRELOAD: o robô acha o link .mp4 oficial (rockstargames.com/VI/launch-trailer e /VI/media/videos) e põe aqui ou usa "url:<link>"
}
CACHE = os.environ.get('VCD_CACHE', '/tmp/vcd_cache')
COLORS = {'yellow': (255, 222, 40), 'white': (255, 255, 255), 'pink': (255, 60, 150), 'teal': (40, 230, 220), 'orange': (255, 150, 30)}
GREEN = (60, 220, 110); PINK = (255, 60, 150); YEL = (255, 222, 40); WHITE = (255, 255, 255)

def fpath(n):
    for p in (os.path.join(HERE, 'fonts', n), os.path.join(HERE, n), os.path.join('fonts', n)):
        if os.path.exists(p): return p
    raise FileNotFoundError(n)
ANTON = {s: ImageFont.truetype(fpath('Anton.ttf'), s) for s in (90, 110, 130, 150)}
M9 = {s: ImageFont.truetype(fpath('Mont900.ttf'), s) for s in (34, 58)}
M8 = ImageFont.truetype(fpath('Mont800.ttf'), 28)

def run(cmd): subprocess.run(cmd, check=True)

USADOS = os.path.join(HERE, 'usados.json')   # trechos já usados (fonte, segundo, data) para não repetir cena

def checa_repetidos(spec):
    """Para o render se alguma cena usar um trecho (±8 s) já usado nos últimos 30 dias."""
    import datetime
    if os.environ.get('VCD_PERMITE_REPETIDO') == '1': return
    try: us = json.load(open(USADOS))
    except Exception: us = []
    hoje = datetime.date.today(); rep = []
    for i, sc in enumerate(spec['scenes']):
        if 'start' not in sc: continue
        for u in us:
            if u['src'] == sc['src'] and abs(u['start'] - float(sc['start'])) < 8 and (hoje - datetime.date.fromisoformat(u['data'])).days <= 30:
                rep.append(f"cena {i}: {sc['src']} {sc['start']}s (já usado em {u['data']})"); break
    if rep:
        raise SystemExit('CENA REPETIDA — troque o trecho (use outro momento do Extended Look de 26 min ou os trailers novos):\n' + '\n'.join(rep))

def grava_usados(spec):
    import datetime
    try: us = json.load(open(USADOS))
    except Exception: us = []
    hoje = datetime.date.today()
    us = [u for u in us if (hoje - datetime.date.fromisoformat(u['data'])).days <= 30]
    for sc in spec['scenes']:
        if 'start' in sc: us.append({'src': sc['src'], 'start': float(sc['start']), 'data': hoje.isoformat()})
    json.dump(us, open(USADOS, 'w'), indent=0)

def source_file(src):
    os.makedirs(CACHE, exist_ok=True)
    local = src if os.path.isabs(src) else os.path.join(HERE, src)
    if os.path.isfile(local): return local  # ex.: "clipes/perseguicao_01.mp4"
    if src.startswith('clip:'):
        name = src[5:]; url = 'https://www.rockstargames.com/VI/_next/static/media/' + name
    elif src.startswith('url:'):
        url = src[4:].strip(); host = urllib.parse.urlparse(url).hostname or ''
        if not (host == 'rockstargames.com' or host.endswith('.rockstargames.com') or host.endswith('rockstargames-com.akamaized.net')):
            raise SystemExit('url: só aceita material oficial da Rockstar (rockstargames.com): ' + url)
        name = 'url_' + os.path.basename(urllib.parse.urlparse(url).path)
    else:
        url = SRC[src]; name = os.path.basename(url)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p) or os.path.getsize(p) < 1000:
        print('baixando', name); run(['curl', '-sSL', '-A', 'Mozilla/5.0', '-o', p, url])
    return p

def probe_wh(p):
    o = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p],
                       capture_output=True, text=True, check=True).stdout.strip().split(',')
    return int(o[0]), int(o[1])

def ease(x): x = max(0, min(1, x)); return 1 - (1 - x) ** 3
def pop(lt, t0, dur=0.3):
    k = (lt - t0) / dur
    if k < 0: return 0
    if k >= 1: return 1
    return ease(k / 0.6) * 1.15 if k < 0.6 else 1.15 - 0.15 * ease((k - 0.6) / 0.4)

def paste_text(base, s, f, center, scale, fill, stroke=10):
    if scale <= 0.01: return
    bb = f.getbbox(s, stroke_width=stroke); tw = bb[2] - bb[0] + 40; th = bb[3] - bb[1] + 40
    im = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((tw / 2, th / 2), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0), anchor='mm')
    if scale != 1: im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    base.alpha_composite(im, (int(center[0] - im.width / 2), int(center[1] - im.height / 2)))

def badge(d, x, y, s, col):
    f = M9[34]; bb = d.textbbox((0, 0), s, font=f); w = bb[2] - bb[0] + 44
    d.rounded_rectangle((x - w / 2, y - 32, x + w / 2, y + 32), 14, fill=col)
    d.text((x, y + 2), s, font=f, fill=(10, 10, 10), anchor='mm')

# ===== EDIÇÃO PROFISSIONAL (21/11/2026): transições, palavra forte, sinais e efeitos sonoros =====
TRANS = ['zoom', 'flash', 'whip']
def acha_palavra(WORDS, seg, alvo):
    """Momento em que o narrador fala 'alvo' dentro da cena seg (None se não achar)."""
    a = alvo.upper().strip('.,:?!$%').split()[0] if alvo.strip() else ''
    for w in WORDS:
        if w.get('seg') == seg and a and a in w['w'].upper().strip('.,:?!'):
            return w['s']
    return None

def eventos(SC, WORDS, bounds):
    """Lista de (t, tipo, valor): palavra forte e sinais, sincronizados com a fala."""
    ev = []
    for i, sc in enumerate(SC):
        fortes = sc.get('forte') or []
        if isinstance(fortes, str): fortes = [fortes]
        if not fortes and not sc.get('title'):   # automático: número dito na cena vira palavra forte
            for w in WORDS:
                if w.get('seg') == i and re.search(r'\d', w['w']):
                    fortes = [w['w'].strip('.,:?!')]; break
        for fw in fortes[:2]:
            t = acha_palavra(WORDS, i, fw); ev.append((t if t is not None else bounds[i] + 0.25, 'forte', fw.upper()))
        if sc.get('icone'):
            t = acha_palavra(WORDS, i, sc['icone_em']) if sc.get('icone_em') else None
            ev.append((t if t is not None else bounds[i] + 0.35, 'icone', sc['icone']))
    return ev

def desenha_icone(im, nome, cx, cy, k):
    if k <= 0.01: return
    r = int(95 * k); lay = Image.new('RGBA', (2 * r + 30, 2 * r + 30), (0, 0, 0, 0)); g = ImageDraw.Draw(lay); c = r + 15
    cores = {'check': (40, 200, 90), 'x': (230, 40, 50), 'alerta': (255, 200, 0), 'dinheiro': (40, 170, 80), 'estrela': (255, 200, 0), 'pergunta': (40, 130, 240), 'seta': (255, 200, 0)}
    col = cores.get(nome, (255, 200, 0)); lw = max(4, int(16 * k))
    if nome == 'alerta':
        g.polygon([(c, c - r), (c + r, c + r * 0.8), (c - r, c + r * 0.8)], fill=col, outline=(0, 0, 0), width=6)
        g.text((c, c + r * 0.2), '!', font=ImageFont.truetype(fpath('Anton.ttf'), max(10, int(110 * k))), fill=(0, 0, 0), anchor='mm')
    elif nome == 'estrela':
        pts = [(c + r * math.cos(math.radians(-90 + j * 36)) * (1 if j % 2 == 0 else 0.45), c + r * math.sin(math.radians(-90 + j * 36)) * (1 if j % 2 == 0 else 0.45)) for j in range(10)]
        g.polygon(pts, fill=col, outline=(0, 0, 0), width=6)
    elif nome == 'seta':
        g.polygon([(c - r * 0.35, c - r), (c + r * 0.35, c - r), (c + r * 0.35, c), (c + r * 0.8, c), (c, c + r), (c - r * 0.8, c), (c - r * 0.35, c)], fill=col, outline=(0, 0, 0), width=6)
    else:
        g.ellipse((c - r, c - r, c + r, c + r), fill=col, outline=(0, 0, 0), width=6)
        if nome == 'check': g.line([(c - r * 0.5, c), (c - r * 0.12, c + r * 0.4), (c + r * 0.55, c - r * 0.4)], fill=(255, 255, 255), width=lw, joint='curve')
        elif nome == 'x': g.line([(c - r * 0.45, c - r * 0.45), (c + r * 0.45, c + r * 0.45)], fill=(255, 255, 255), width=lw); g.line([(c + r * 0.45, c - r * 0.45), (c - r * 0.45, c + r * 0.45)], fill=(255, 255, 255), width=lw)
        else:
            simb = {'dinheiro': '$', 'pergunta': '?'}.get(nome, '!')
            g.text((c, c + 4), simb, font=ImageFont.truetype(fpath('Anton.ttf'), max(10, int(120 * k))), fill=(255, 255, 255), anchor='mm', stroke_width=4, stroke_fill=(0, 0, 0))
    im.alpha_composite(lay, (int(cx - c), int(cy - c)))

def transicao(im, tipo, lt):
    """Efeito no começo da cena (troca de cena com ação)."""
    if tipo == 'zoom' and lt < 0.22:
        z = 1 + 0.12 * (1 - ease(lt / 0.22)); cw, ch = int(W / z), int(H / z)
        return im.crop(((W - cw) // 2, (H - ch) // 2, (W - cw) // 2 + cw, (H - ch) // 2 + ch)).resize((W, H))
    if tipo == 'whip' and lt < 0.18:
        sh = int(W * 0.22 * (1 - ease(lt / 0.18))); a = np.asarray(im, np.float32)
        b = sum(np.roll(a, -int(sh * j / 4), axis=1) for j in range(5)) / 5
        return Image.fromarray(b.astype(np.uint8), 'RGBA')
    if tipo == 'flash' and lt < 0.15:
        fl = Image.new('RGBA', (W, H), (255, 255, 255, int(170 * (1 - lt / 0.15)))); im = im.copy(); im.alpha_composite(fl)
    return im

def mixa_sfx(out, cortes, ev, DUR):
    """Narração + whoosh nas trocas de cena + pop na palavra forte / sinal (volume baixo, sem cobrir a voz)."""
    import soundfile as sf
    v, sr = sf.read(os.path.join(out, 'narr.wav'), dtype='float32')
    if v.ndim > 1: v = v.mean(1)
    mix = np.copy(v); rng = np.random.default_rng(7)
    def add(sig, t, g):
        a = int(t * sr)
        if a >= len(mix): return
        b = min(len(mix), a + len(sig)); mix[a:b] += sig[:b - a] * g
    n = int(0.32 * sr); x = np.linspace(0, 1, n)
    ruido = rng.standard_normal(n); ruido = np.convolve(ruido, np.ones(18) / 18, 'same')
    whoosh = ruido * np.sin(np.pi * x) ** 2
    n2 = int(0.09 * sr); x2 = np.arange(n2) / sr
    popf = np.sin(2 * np.pi * (900 - 4000 * x2) * x2) * np.exp(-x2 * 45)
    for t in cortes: add(whoosh / (np.abs(whoosh).max() + 1e-6), max(0, t - 0.12), 0.16)
    for t, tipo, _ in ev: add(popf, t, 0.22)
    mix = mix / max(1.0, np.abs(mix).max() / 0.95)
    p = os.path.join(out, 'narr_fx.wav'); sf.write(p, mix, sr); return p

def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
    global CTA; CTA = spec.get('cta_text') or ('FOLLOW FOR MORE' if spec.get('lang') == 'en' else 'SEGUE O CANAL')
    T = json.load(open(os.path.join(out, 'timing.json'), encoding='utf-8'))
    DUR = T['dur']; SEGS = T['segs']; WORDS = T['words']; SC = spec['scenes']
    assert len(SC) == len(SEGS), 'número de cenas diferente da narração'
    checa_repetidos(spec)
    # 1) cortes de vídeo por cena
    bounds = [0.0] + [SEGS[i][0] - 0.14 for i in range(1, len(SEGS))] + [DUR]
    parts = []; prev_mov = None
    for i, sc in enumerate(SC):
        p = source_file(sc['src']); iw, ih = probe_wh(p)
        dur = bounds[i + 1] - bounds[i]; cw = min(iw, int(ih * 9 / 16)); cw -= cw % 2
        fo = float(sc.get('focus', 0.5)); x = int((iw - cw) * fo)
        N = max(1, int(dur * FPS))
        # movimento de câmera variado (edição "humana"): cada cena tem um, sem repetir o da anterior
        MOVS = ['zoom_in', 'pan', 'punch', 'zoom_out', 'drift', 'pan_rev']
        mov = sc.get('mov') or MOVS[(i * 7 + int(float(sc.get('start', 0)) * 3)) % len(MOVS)]
        if i > 0 and mov == prev_mov: mov = MOVS[(MOVS.index(mov) + 2) % len(MOVS)]
        prev_mov = mov
        cen = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        if mov in ('pan', 'pan_rev') and iw - cw > 40:
            a0, a1 = max(0.0, fo - 0.22), min(1.0, fo + 0.22)
            if mov == 'pan_rev': a0, a1 = a1, a0
            X0, X1 = int((iw - cw) * a0), int((iw - cw) * a1)
            vf = (f"crop={cw}:{ih}:'{X0}+({X1}-{X0})*min(t/{dur:.3f},1)':0,scale={W}:{H},"
                  f"zoompan=z='1.04':{cen}:d=1:s={W}x{H}:fps={FPS},setsar=1")
        else:
            zexp = {'zoom_in': f"1+0.10*on/{N}", 'zoom_out': f"1.12-0.10*on/{N}",
                    'punch': f"1+0.16*max(0,1-on/{0.25 * FPS:.1f})+0.03*on/{N}",
                    'drift': "1.08", 'pan': f"1+0.06*on/{N}", 'pan_rev': f"1+0.06*on/{N}"}[mov]
            pos = "x='iw/2-(iw/zoom/2)+14*sin(on/9)':y='ih/2-(ih/zoom/2)+10*sin(on/13)'" if mov == 'drift' else cen
            vf = (f"crop={cw}:{ih}:{x}:0,scale={W}:{H},"
                  f"zoompan=z='{zexp}':{pos}:d=1:s={W}x{H}:fps={FPS},setsar=1")
        vel = float(sc.get('vel', 1.0))   # 0.8 = câmera lenta em cena de ação (opcional)
        if vel != 1.0: vf = f"setpts=PTS/{vel}," + vf
        o = os.path.join(out, f'part{i:02d}.mp4')
        is_img = p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
        inp = ['-loop', '1', '-i', p] if is_img else ['-ss', str(sc.get('start', 0)), '-i', p]
        run(['ffmpeg', '-y', '-loglevel', 'error', *inp, '-t', f'{dur:.3f}', '-an', '-vf', vf,
             '-r', str(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', o])
        parts.append(o)
    lst = os.path.join(out, 'parts.txt'); open(lst, 'w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    base = os.path.join(out, 'base.mp4')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', base])
    # 2) legendas
    chunks, cur = [], []
    for w in WORDS:
        cur.append(w); txt = ' '.join(x['w'] for x in cur)
        if len(cur) >= 3 or len(txt) >= 15 or w['w'][-1] in '.,:?!': chunks.append(cur); cur = []
    if cur: chunks.append(cur)
    CH = [(c[0]['s'], min(chunks[i + 1][0]['s'] if i + 1 < len(chunks) else DUR, c[-1]['e'] + 0.45), c) for i, c in enumerate(chunks)]
    grad = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        a = 0
        if y < 650: a = int(190 * (1 - y / 650) ** 1.5)
        if y > 1200: a = max(a, int(230 * ((y - 1200) / 720) ** 1.3))
        grad[y, :, 3] = a
    GRAD = Image.fromarray(grad, 'RGBA')
    EV = eventos(SC, WORDS, bounds)
    try: AUDIO = mixa_sfx(out, bounds[1:-1], EV, DUR)
    except Exception as e: print('AVISO: sem efeitos sonoros:', e); AUDIO = os.path.join(out, 'narr.wav')
    final = os.path.join(out, 'final.mp4')
    dec = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', base, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', AUDIO, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '4200k',
                            '-bufsize', '8000k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
                            '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', final], stdin=subprocess.PIPE)
    n = int(math.ceil(DUR * FPS)); fs = W * H * 3; last = None
    for i in range(n):
        raw = dec.stdout.read(fs)
        if len(raw) < fs: raw = last
        last = raw
        t = i / FPS; s = max(k for k in range(len(SEGS)) if t >= bounds[k]); lt = t - bounds[s]; sc = SC[s]
        im = Image.frombytes('RGB', (W, H), raw).convert('RGBA')
        if s > 0: im = transicao(im, sc.get('trans') or TRANS[s % len(TRANS)], lt)
        im.alpha_composite(GRAD); d = ImageDraw.Draw(im)
        if sc.get('tag'):
            f = M9[34]; tb = d.textbbox((0, 0), sc['tag'], font=f)
            d.rounded_rectangle((36, 60, 36 + tb[2] - tb[0] + 36, 116), 12, fill=(0, 0, 0, 200))
            d.text((54, 88), sc['tag'], font=f, fill=WHITE, anchor='lm')
        if sc.get('badge'):
            col = (255, 150, 30) if 'RUMOR' in sc['badge'].upper() or 'NÃO' in sc['badge'].upper() or 'NOT' in sc['badge'].upper() else GREEN
            badge(d, W / 2, 170, sc['badge'], col)
        if sc.get('title'):
            lines = sc['title'].split('|')
            for j, ln in enumerate(lines):
                f = ANTON[150] if len(ln) <= 11 else (ANTON[130] if len(ln) <= 15 else ANTON[110])
                c = COLORS.get(sc.get('title_color', 'yellow'), YEL) if j == len(lines) - 1 else WHITE
                paste_text(im, ln, f, (W / 2, 320 + j * (f.size + 10)), pop(lt, 0.05 + 0.2 * j), c)
        if sc.get('cta') and lt > 0.3:
            k = pop(lt, 0.3); bw = 680 * k
            if bw > 10:
                d.rounded_rectangle((W / 2 - bw / 2, 380 - 85 * k, W / 2 + bw / 2, 380 + 85 * k), int(42 * k), fill=(255, 45, 150))
                if k > 0.9: d.text((W / 2, 384), CTA, font=M9[58], fill=WHITE, anchor='mm')
        for (te, tipo, val) in EV:
            if te <= t < te + 1.4:
                fade = 1 if t < te + 1.15 else max(0, 1 - (t - te - 1.15) / 0.25)
                if tipo == 'forte':
                    yf = 700 if sc.get('title') else 470
                    f = ImageFont.truetype(fpath('Anton.ttf'), 170 if len(val) <= 9 else 130)
                    paste_text(im, val, f, (W / 2, yf), pop(t, te, 0.25) * fade, (255, 45, 150) if sc.get("forte_cor") == "red" else YEL, stroke=14)
                else:
                    desenha_icone(im, val, W - 170, 1020, pop(t, te, 0.25) * fade)
        d = ImageDraw.Draw(im)
        for (cs, ce, c) in CH:
            if cs <= t < ce:
                words = [x['w'].strip('.,:?!').upper() for x in c]; f = ANTON[110]; sp = 26
                ws = [d.textlength(w, font=f) for w in words]; tot = sum(ws) + sp * (len(ws) - 1)
                if tot > 990: f = ANTON[90]; ws = [d.textlength(w, font=f) for w in words]; tot = sum(ws) + sp * (len(ws) - 1)
                x = W / 2 - tot / 2
                for w, wd, xw in zip(words, ws, c):
                    d.text((x, 1500), w, font=f, fill=YEL if xw['s'] <= t < xw['e'] + 0.05 else WHITE, stroke_width=10, stroke_fill=(0, 0, 0), anchor='lm')
                    x += wd + sp
                break
        d.text((W / 2, 1800), spec.get('credit', 'Images: official Rockstar Games trailers' if spec.get('lang') == 'en' else 'Imagens: trailers oficiais Rockstar Games • Vice City Diário'), font=M8,
               fill=(255, 255, 255, 210), anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0))
        d.rectangle((0, H - 14, W * t / DUR, H), fill=PINK)
        enc.stdin.write(im.convert('RGB').tobytes())
    enc.stdin.close(); enc.wait(); dec.terminate()
    print('ok', final, round(os.path.getsize(final) / 1e6, 1), 'MB')
    grava_usados(spec)
    try: fazer_capa(spec, out, parts)
    except Exception as e: print('AVISO: capa não gerada:', e)

def fazer_capa(spec, out, parts):
    """Capa chamativa 1080x1920: cena limpa (sem legenda) mais forte + dado principal em letras gigantes."""
    import tempfile
    tmp = tempfile.mkdtemp(); melhor = None
    idx = [spec['capa_cena']] if isinstance(spec.get('capa_cena'), int) else range(len(parts))
    for i in idx:
        for frac in (0.35, 0.7):
            dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', parts[i]], capture_output=True, text=True).stdout.strip() or 1)
            f = os.path.join(tmp, f'{i}_{frac}.png')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{dur * frac:.2f}', '-i', parts[i], '-frames:v', '1', f])
            if not os.path.exists(f): continue
            a = np.asarray(Image.open(f).convert('RGB').resize((270, 480)), np.float32)
            sat = (a.max(2) - a.min(2)).mean(); con = a.mean(2).std(); lum = a.mean()
            nota = sat + con - abs(lum - 120) * 0.4          # colorido, contrastado e nem escuro nem estourado
            if melhor is None or nota > melhor[0]: melhor = (nota, f)
    if not melhor: return
    im = Image.open(melhor[1]).convert('RGB').resize((W, H))
    from PIL import ImageEnhance
    im = ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(1.25)).enhance(1.12).convert('RGBA')
    g = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        a = 0
        if y < 900: a = int(215 * (1 - y / 900) ** 1.2)
        if y > 1500: a = max(a, int(140 * ((y - 1500) / 420)))
        g[y, :, 3] = a
    im.alpha_composite(Image.fromarray(g, 'RGBA')); d = ImageDraw.Draw(im)
    linhas = spec.get('capa') or (SC0 := spec['scenes'][0]).get('title', '').split('|')
    linhas = [l.strip().upper() for l in linhas if l.strip()][:3]
    y = 260
    for j, ln in enumerate(linhas):
        tam = 230
        while tam > 90:
            f = ImageFont.truetype(fpath('Anton.ttf'), tam)
            if d.textlength(ln, font=f) <= W - 80: break
            tam -= 8
        cor = YEL if j == len(linhas) - 1 else WHITE
        d.text((W / 2, y + tam / 2), ln, font=f, fill=cor, anchor='mm', stroke_width=max(10, tam // 11), stroke_fill=(0, 0, 0))
        y += tam + 18
    if spec.get('capa_selo'):
        f = M9[58]; tw = d.textlength(spec['capa_selo'], font=f)
        d.rounded_rectangle((W / 2 - tw / 2 - 34, y + 20, W / 2 + tw / 2 + 34, y + 120), 22, fill=(255, 45, 150))
        d.text((W / 2, y + 70), spec['capa_selo'], font=f, fill=WHITE, anchor='mm')
    p = os.path.join(out, 'capa.jpg'); im.convert('RGB').save(p, quality=90); print('capa', p)

if __name__ == '__main__':
    main()
