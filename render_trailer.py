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
src: T1 (Trailer 1, 90s), T2 (Trailer 2), EXT (An Extended Look), ou "clip:Arquivo.HASH.mp4"
(clipes de personagem em rockstargames.com/VI/_next/static/media/). start em segundos no vídeo de origem.
focus: 0 = esquerda, 0.5 = centro, 1 = direita (onde fica o recorte vertical).
Saída: saida_dir/final.mp4"""
import sys, os, json, subprocess, math, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = {
    'T1': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Trailer_1/GTAVI_Trailer_1.mp4',
    'T2': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_Trailer_2/GTAVI_Trailer_2.mp4',
    'EXT': 'https://media-rockstargames-com.akamaized.net/VI/downloads/videos/GTAVI_An_Extended_Look/GTAVI_An_Extended_Look.mp4',
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

def source_file(src):
    os.makedirs(CACHE, exist_ok=True)
    if src.startswith('clip:'):
        name = src[5:]; url = 'https://www.rockstargames.com/VI/_next/static/media/' + name
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

def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]
    T = json.load(open(os.path.join(out, 'timing.json'), encoding='utf-8'))
    DUR = T['dur']; SEGS = T['segs']; WORDS = T['words']; SC = spec['scenes']
    assert len(SC) == len(SEGS), 'número de cenas diferente da narração'
    # 1) cortes de vídeo por cena
    bounds = [0.0] + [SEGS[i][0] - 0.14 for i in range(1, len(SEGS))] + [DUR]
    parts = []
    for i, sc in enumerate(SC):
        p = source_file(sc['src']); iw, ih = probe_wh(p)
        dur = bounds[i + 1] - bounds[i]; cw = min(iw, int(ih * 9 / 16)); cw -= cw % 2
        x = int((iw - cw) * float(sc.get('focus', 0.5)))
        z = 1.06  # leve zoom-in durante a cena
        vf = (f"crop={cw}:{ih}:{x}:0,scale={W}:{H},"
              f"zoompan=z='1+({z}-1)*on/({dur}*{FPS})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1")
        o = os.path.join(out, f'part{i:02d}.mp4')
        run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(sc['start']), '-i', p, '-t', f'{dur:.3f}', '-an', '-vf', vf,
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
    final = os.path.join(out, 'final.mp4')
    dec = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', base, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-i', os.path.join(out, 'narr.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '4200k',
                            '-bufsize', '8000k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
                            '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-shortest', '-movflags', '+faststart', final], stdin=subprocess.PIPE)
    n = int(math.ceil(DUR * FPS)); fs = W * H * 3; last = None
    for i in range(n):
        raw = dec.stdout.read(fs)
        if len(raw) < fs: raw = last
        last = raw
        t = i / FPS; s = max(k for k in range(len(SEGS)) if t >= bounds[k]); lt = t - bounds[s]; sc = SC[s]
        im = Image.frombytes('RGB', (W, H), raw).convert('RGBA'); im.alpha_composite(GRAD); d = ImageDraw.Draw(im)
        if sc.get('badge'):
            col = (255, 150, 30) if 'RUMOR' in sc['badge'].upper() or 'NÃO' in sc['badge'].upper() else GREEN
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
                d.rounded_rectangle((W / 2 - bw / 2, 380 - 85 * k, W / 2 + bw / 2, 380 + 85 * k), int(42 * k), fill=(230, 30, 40))
                if k > 0.9: d.text((W / 2, 384), 'SEGUE O CANAL', font=M9[58], fill=WHITE, anchor='mm')
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
        d.text((W / 2, 1800), spec.get('credit', 'Imagens: trailers oficiais Rockstar Games • Vice City Diário'), font=M8,
               fill=(255, 255, 255, 210), anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0))
        d.rectangle((0, H - 14, W * t / DUR, H), fill=PINK)
        enc.stdin.write(im.convert('RGB').tobytes())
    enc.stdin.close(); enc.wait(); dec.terminate()
    print('ok', final, round(os.path.getsize(final) / 1e6, 1), 'MB')

if __name__ == '__main__':
    main()
