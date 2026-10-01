import json, math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
T = json.load(open('v3/timing.json'))
DUR = T['dur']; SEGS = {int(k): v for k, v in T['segs'].items()}; WORDS = T['words']
N = int(math.ceil(DUR * FPS))
def font(n, s): return ImageFont.truetype('fonts/' + n, s)
ANTON = {s: font('Anton.ttf', s) for s in (90, 110, 130, 150, 190)}
M9 = {s: font('Mont900.ttf', s) for s in (34, 40, 48, 58)}
M8 = font('Mont800.ttf', 28)
YEL = (255, 222, 40); WHITE = (255, 255, 255); GREEN = (60, 220, 110); PINK = (255, 60, 150)

# scene: (image, focus_x in 3840px space, zoom_dir, title, title_color, badge)
SC = {
 0: ('Lucia_Caminos_10', 1840, 1, 'QUEM É|LUCIA CAMINOS?', PINK, None),
 1: ('Lucia_Caminos_01', 2240, 1, 'LUTADORA|DESDE CRIANÇA', YEL, ('INFO OFICIAL • ROCKSTAR', GREEN)),
 2: ('Lucia_Caminos_07', 1680, -1, None, None, ('INFO OFICIAL • ROCKSTAR', GREEN)),
 3: ('Lucia_Caminos_05', 2100, 1, 'PENITENCIÁRIA|DE LEONIDA', YEL, ('INFO OFICIAL • ROCKSTAR', GREEN)),
 4: ('Lucia_Caminos_03', 1320, -1, 'PURA SORTE', WHITE, ('INFO OFICIAL • ROCKSTAR', GREEN)),
 5: ('Lucia_Caminos_09', 1600, 1, 'SÓ JOGADAS|INTELIGENTES', YEL, None),
 6: ('Lucia_Caminos_02', 1760, -1, 'O SONHO:|VIDA BOA', PINK, ('INFO OFICIAL • ROCKSTAR', GREEN)),
 7: ('Jason_and_Lucia_02', 1600, 1, None, None, None),
 8: ('Jason_and_Lucia_01', 1150, -1, '19 DE NOVEMBRO', YEL, ('DATA OFICIAL', GREEN)),
 9: ('Lucia_Caminos_06', 1900, 1, None, None, None),
}
IMG = {}
for k, (name, *_ ) in SC.items():
    if name not in IMG:
        im = Image.open('v3/img/' + name + '.jpg').convert('RGB')
        IMG[name] = im.resize((int(im.width * 1920 * 1.18 / im.height), int(1920 * 1.18)), Image.LANCZOS)

def ease(x): x = max(0, min(1, x)); return 1 - (1 - x) ** 3
def seg_at(t):
    cur = 0
    for k in sorted(SEGS):
        if t >= SEGS[k][0] - 0.2: cur = k
    return cur

# gradient overlays for legibility
grad = np.zeros((H, W, 4), np.uint8)
for y in range(H):
    a = 0
    if y < 700: a = int(200 * (1 - y / 700) ** 1.5)
    if y > 1200: a = max(a, int(230 * ((y - 1200) / 720) ** 1.3))
    grad[y, :, 3] = a
GRAD = Image.fromarray(grad, 'RGBA')

def bg(s, lt, segdur):
    name, fx, zd, *_ = SC[s]
    im = IMG[name]; sc = 1920 * 1.18 / 2160
    p = min(1, lt / max(segdur, 0.1))
    z = 1.0 + 0.10 * (p if zd > 0 else 1 - p)
    cw, ch = W / z * 1.0, H / z * 1.0
    # base crop window in resized image coords (resized height = 1920*1.18)
    cx = fx * sc + (p - 0.5) * 40 * zd; cy = im.height / 2
    x0 = max(0, min(im.width - cw * 1.18, cx - cw * 1.18 / 2)); y0 = max(0, min(im.height - ch * 1.18, cy - ch * 1.18 / 2))
    crop = im.crop((int(x0), int(y0), int(x0 + cw * 1.18), int(y0 + ch * 1.18))).resize((W, H), Image.BILINEAR)
    return crop.convert('RGBA')

def paste_text(base, s, f, center, scale, fill, stroke=10):
    if scale <= 0.01: return
    bb = f.getbbox(s, stroke_width=stroke); tw = bb[2] - bb[0] + 40; th = bb[3] - bb[1] + 40
    im = Image.new('RGBA', (tw, th), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((tw / 2, th / 2), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0), anchor='mm')
    if scale != 1: im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    base.alpha_composite(im, (int(center[0] - im.width / 2), int(center[1] - im.height / 2)))

def pop(lt, t0, dur=0.3):
    k = (lt - t0) / dur
    if k < 0: return 0
    if k >= 1: return 1
    return ease(k / 0.6) * 1.15 if k < 0.6 else 1.15 - 0.15 * ease((k - 0.6) / 0.4)

def badge(d, x, y, s, col):
    f = M9[34]; bb = d.textbbox((0, 0), s, font=f); w = bb[2] - bb[0] + 44
    d.rounded_rectangle((x - w / 2, y - 32, x + w / 2, y + 32), 14, fill=col)
    d.text((x, y + 2), s, font=f, fill=(10, 10, 10), anchor='mm')

chunks = []; cur = []
for w in WORDS:
    cur.append(w); txt = ' '.join(x['w'] for x in cur)
    if len(cur) >= 3 or len(txt) >= 15 or w['w'][-1] in '.,:?': chunks.append(cur); cur = []
if cur: chunks.append(cur)
CH = []
for i, c in enumerate(chunks):
    nxt = chunks[i + 1][0]['s'] if i + 1 < len(chunks) else DUR
    CH.append((c[0]['s'], min(nxt, c[-1]['e'] + 0.45), c))
def caption(base, t):
    for (s, e, c) in CH:
        if s <= t < e:
            d = ImageDraw.Draw(base)
            words = [x['w'].strip('.,:?').upper() for x in c]
            f = ANTON[110]; sp = 26
            ws = [d.textlength(w, font=f) for w in words]; tot = sum(ws) + sp * (len(ws) - 1)
            if tot > 990: f = ANTON[90]; ws = [d.textlength(w, font=f) for w in words]; tot = sum(ws) + sp * (len(ws) - 1)
            x = W / 2 - tot / 2
            for w, wd, xw in zip(words, ws, c):
                col = YEL if xw['s'] <= t < xw['e'] + 0.05 else WHITE
                d.text((x, 1500), w, font=f, fill=col, stroke_width=10, stroke_fill=(0, 0, 0), anchor='lm'); x += wd + sp
            return

def frame(i):
    t = i / FPS; s = seg_at(t)
    st = SEGS[s][0] - 0.2 if s > 0 else 0
    en = SEGS[s + 1][0] - 0.2 if s + 1 in SEGS else DUR
    lt = t - st
    base = bg(s, lt, en - st)
    base.alpha_composite(GRAD)
    d = ImageDraw.Draw(base)
    _, _, _, title, tcol, bd = SC[s]
    if bd: badge(d, W / 2, 170, bd[0], bd[1])
    if title:
        lines = title.split('|')
        for j, ln in enumerate(lines):
            f = ANTON[150] if len(ln) <= 12 else ANTON[110]
            if s == 0: f = ANTON[190] if j == 1 and len(ln) <= 12 else ANTON[130]
            paste_text(base, ln, f, (W / 2, 330 + j * (f.size + 10)), pop(lt, 0.05 + 0.2 * j), tcol if j == len(lines) - 1 else WHITE)
    if s == 9 and lt > 0.3:
        k = pop(lt, 0.3); bw = 680 * k
        if bw > 10:
            d.rounded_rectangle((W / 2 - bw / 2, 380 - 85 * k, W / 2 + bw / 2, 380 + 85 * k), int(42 * k), fill=(230, 30, 40))
            if k > 0.9: d.text((W / 2, 384), 'SEGUE O CANAL', font=M9[58], fill=WHITE, anchor='mm')
    caption(base, t)
    d.text((W / 2, 1800), 'Imagens: Rockstar Games (oficiais) • Vice City Diário', font=M8, fill=(255, 255, 255, 210), anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0))
    d.rectangle((0, H - 14, W * t / DUR, H), fill=PINK)
    # punch-in on cuts
    if s > 0 and lt < 0.25:
        z = 1 + 0.08 * (1 - lt / 0.25); cw, chh = int(W / z), int(H / z)
        base = base.crop(((W - cw) // 2, (H - chh) // 2, (W - cw) // 2 + cw, (H - chh) // 2 + chh)).resize((W, H), Image.BILINEAR)
    arr = np.asarray(base.convert('RGB'), np.float32)
    if s > 0 and lt < 0.07: arr = arr * 0.5 + 127
    return arr.clip(0, 255).astype(np.uint8)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        for tt in sys.argv[1:]: Image.fromarray(frame(int(float(tt) * FPS))).save(f'v3/p_{tt}.png')
        sys.exit()
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', 'v3/noaudio.mp4'], stdin=subprocess.PIPE)
    for i in range(N):
        p.stdin.write(frame(i).tobytes())
    p.stdin.close(); p.wait(); print('done')
