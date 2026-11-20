"""Narração a partir de spec.json (voz neural natural da Microsoft, grátis).
Uso: python3 tts_lines.py spec.json saida_dir
Gera saida_dir/narr.wav e saida_dir/timing.json. Se a voz neural falhar, PARA (nunca usar voz robótica)."""
import sys, json, os, asyncio, ssl, subprocess, tempfile, time
import numpy as np, soundfile as sf

PRON = {'Game Informer': 'Guêim Infórmer', 'Rockstar': 'Róckstar', 'GTA 6': 'GTA seis', 'GTA 5': 'GTA cinco',
        'GTA VI': 'GTA seis', 'Lucia': 'Lúcia', 'Jason': 'Djêison', 'Vice City': 'Vaice Ciri', 'Leonida': 'Leônida', 'Shorts': 'Xórts'}
PRON_EN = {'GTA 6': 'GTA six', 'GTA VI': 'GTA six', 'GTA 5': 'GTA five', 'Leonida': 'Leh-oh-nee-dah', 'Lucia': 'Loo-see-ah', 'jet ski': 'jet skee', 'Jet Ski': 'jet skee', 'Metacritic': 'Meh-tuh-critic', 'Jason': 'Jay-sun'}

spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
EN = spec.get('lang', 'pt') == 'en'
VOZ, RATE, PITCH = ('en-US-AndrewMultilingualNeural', '+0%', '+0Hz') if EN else ('pt-BR-AntonioNeural', '+4%', '+0Hz')
VOZ = os.environ.get('VC_VOZ', VOZ)
ca = '/root/.ccr/ca-bundle.crt'
if os.path.exists(ca):
    _o = ssl.create_default_context
    def _c(*a, **k):
        c = _o(*a, **k); c.load_verify_locations(ca); return c
    ssl.create_default_context = _c
try: import edge_tts
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '--break-system-packages', 'edge-tts'], check=True); import edge_tts
pron = dict(PRON_EN if EN else PRON); pron.update(spec.get('pron', {}))
SR = 24000; audio = [np.zeros(int(SR * 0.12), np.float32)]; t = 0.12; words = []; segs = []
tmp = tempfile.mkdtemp()
for i, sc in enumerate(spec['scenes']):
    c = sc['text']; sp = c
    for k, v in pron.items(): sp = sp.replace(k, v)
    mp3 = os.path.join(tmp, f'{i}.mp3'); wav = mp3[:-4] + '.wav'
    for tent in range(6):
        try:
            asyncio.run(edge_tts.Communicate(sp, VOZ, rate=RATE, pitch=PITCH).save(mp3))
            if os.path.getsize(mp3) > 1000: break
        except Exception as e: print('  voz: tentando de novo', e); time.sleep(3 + tent * 2)
    else:
        print('ERRO: voz neural falhou. NÃO publique este vídeo (sem voz robótica).'); sys.exit(1)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', str(SR), wav], check=True)
    x, _ = sf.read(wav, dtype='float32'); nz = np.where(np.abs(x) > 0.01)[0]
    x = x[max(0, nz[0] - 200):nz[-1] + 600]; dur = len(x) / SR
    ws = c.split(); tot = sum(len(w) + 1 for w in ws); cur = t
    for w in ws:
        wd = dur * (len(w) + 1) / tot; words.append({'w': w, 's': round(cur, 3), 'e': round(cur + wd, 3), 'seg': i}); cur += wd
    segs.append([t, t + dur]); audio.append(x); t += dur
    fim = c.rstrip()[-1:] if c.strip() else '.'
    gap = 0.42 if fim in '?!' else 0.26 if fim in '.…' else 0.16
    audio.append(np.zeros(int(SR * gap), np.float32)); t += gap
    time.sleep(0.4)
audio.append(np.zeros(int(SR * 0.5), np.float32)); t += 0.5
y = np.concatenate(audio); y = y / np.max(np.abs(y)) * 0.89
sf.write(os.path.join(out, 'narr.wav'), y, SR)
json.dump({'words': words, 'segs': segs, 'dur': len(y) / SR}, open(os.path.join(out, 'timing.json'), 'w'), ensure_ascii=False)
print('narração (voz neural)', VOZ, round(len(y) / SR, 2), 's,', len(segs), 'cenas')
