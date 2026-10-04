"""Narração pt-BR a partir de spec.json.
Uso: python3 tts_lines.py spec.json saida_dir
spec.json: {"scenes":[{"text":"frase 1", ...}, ...]}
Gera saida_dir/narr.wav e saida_dir/timing.json (palavras e início/fim de cada cena).
Precisa da pasta vits-piper-pt_BR-faber-medium/ ao lado."""
import sys, json, os
import numpy as np, soundfile as sf, sherpa_onnx

PRON = {'Game Informer': 'Guêim Infórmer', 'Rockstar': 'Róckstar', 'GTA 6': 'GTA seis', 'GTA 5': 'GTA cinco',
        'GTA VI': 'GTA seis', 'Lucia': 'Lúcia', 'Jason': 'Djêison', 'Keys': 'Quíis', 'Vice City': 'Vaice Ciri',
        'Leonida': 'Leônida', 'Trailer': 'Trêiler', 'trailer': 'trêiler', 'Shorts': 'Xórts'}

spec = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vits-piper-pt_BR-faber-medium') + '/'
if not os.path.isdir(d): d = 'vits-piper-pt_BR-faber-medium/'
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d + 'pt_BR-faber-medium.onnx', tokens=d + 'tokens.txt', data_dir=d + 'espeak-ng-data'),
    num_threads=4)))
pron = dict(PRON); pron.update(spec.get('pron', {}))
sr = 22050; audio = [np.zeros(int(sr * 0.15), np.float32)]; t = 0.15; words = []; segs = []
for i, sc in enumerate(spec['scenes']):
    c = sc['text']; sp = c
    for k, v in pron.items(): sp = sp.replace(k, v)
    a = tts.generate(sp, sid=0, speed=1.12); sr = a.sample_rate; x = np.array(a.samples, np.float32)
    nz = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, nz[0] - 200):nz[-1] + 400]; dur = len(x) / sr
    ws = c.split(); tot = sum(len(w) + 1 for w in ws); cur = t
    for w in ws:
        wd = dur * (len(w) + 1) / tot; words.append({'w': w, 's': round(cur, 3), 'e': round(cur + wd, 3), 'seg': i}); cur += wd
    segs.append([t, t + dur]); audio.append(x); t += dur
    gap = 0.28; audio.append(np.zeros(int(sr * gap), np.float32)); t += gap
audio.append(np.zeros(int(sr * 0.5), np.float32)); t += 0.5
y = np.concatenate(audio); y = y / np.max(np.abs(y)) * 0.89
sf.write(os.path.join(out, 'narr.wav'), y, sr)
json.dump({'words': words, 'segs': segs, 'dur': len(y) / sr}, open(os.path.join(out, 'timing.json'), 'w'), ensure_ascii=False)
print('narração', round(len(y) / sr, 2), 's,', len(segs), 'cenas')
