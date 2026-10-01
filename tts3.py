import sherpa_onnx, numpy as np, soundfile as sf, json, re
d='vits-piper-pt_BR-faber-medium/'
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=d+'pt_BR-faber-medium.onnx',tokens=d+'tokens.txt',data_dir=d+'espeak-ng-data'),num_threads=4))
tts=sherpa_onnx.OfflineTts(cfg)
# (segment_id, clause text)
clauses=[
(0,"Agora, quem é Lucia Caminos, a outra protagonista de GTA 6?"),
(1,"Segundo a Rockstar, o pai dela ensinou ela a lutar assim que ela aprendeu a andar."),
(2,"E a vida veio pra cima dela desde então."),
(3,"Lutando pela família, ela foi parar na Penitenciária de Leonida."),
(4,"Pura sorte tirou ela de lá."),
(5,"Agora, a lição foi aprendida: só jogadas inteligentes daqui pra frente."),
(6,"O sonho dela é a vida boa que a mãe sempre quis, desde os tempos de Liberty City."),
(7,"E ela tá pronta pra resolver isso com as próprias mãos."),
(8,"Ao lado do Jason. GTA 6 chega em 19 de novembro."),
(9,"Segue o canal pra mais detalhes de GTA 6."),
]
sr=None; audio=[]; t=0.0; words=[]; segs={}
lead=np.zeros(int(22050*0.15),dtype=np.float32); audio.append(lead); t=0.15
for i,(sid,c) in enumerate(clauses):
    sp=c.replace('Game Informer','Guêim Infórmer').replace('Rockstar','Róckstar').replace('GTA 6','GTA seis').replace('Duval','Duvál').replace('Keys','Quíis').replace('Lucia','Lúcia').replace('Caminos','Camínos').replace('Liberty City','Líberti Ciri').replace('Leonida','Leônida').replace('Jason','Djêison');a=tts.generate(sp,sid=0,speed=1.12); sr=a.sample_rate; x=np.array(a.samples,dtype=np.float32)
    # trim silence
    nz=np.where(np.abs(x)>0.01)[0]; x=x[max(0,nz[0]-200):nz[-1]+400]
    dur=len(x)/sr
    ws=c.split(); tot=sum(len(w)+1 for w in ws); cur=t
    for w in ws:
        wd=dur*(len(w)+1)/tot; words.append({'w':w,'s':round(cur,3),'e':round(cur+wd,3),'seg':sid}); cur+=wd
    segs.setdefault(sid,[t,t+dur]); segs[sid][1]=t+dur
    audio.append(x); t+=dur
    gap=0.32 if c.endswith(('.',':')) else 0.14
    if i<len(clauses)-1 and clauses[i+1][0]!=sid: gap=0.28
    audio.append(np.zeros(int(sr*gap),dtype=np.float32)); t+=gap
audio.append(np.zeros(int(sr*0.6),dtype=np.float32)); t+=0.6
y=np.concatenate(audio); y=y/np.max(np.abs(y))*0.89
sf.write('v3/narr.wav',y,sr)
json.dump({'words':words,'segs':segs,'dur':len(y)/sr},open('v3/timing.json','w'),indent=1,ensure_ascii=False)
open('v3/roteiro.txt','w').write("\n".join(c for _,c in clauses))
print(len(y)/sr, segs)
