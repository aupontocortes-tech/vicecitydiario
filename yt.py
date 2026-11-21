import os,sys,json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
TK=os.path.expanduser('~/mnt/Videos/GTA6_CHANNEL/token.json')
if os.environ.get('YT_TOKEN_JSON'):
    c=Credentials.from_authorized_user_info(json.loads(os.environ['YT_TOKEN_JSON']))
    if not c.valid: c.refresh(Request())
else:
    c=Credentials.from_authorized_user_file(TK)
    if not c.valid: c.refresh(Request()); open(TK,'w').write(c.to_json())
yt=build('youtube','v3',credentials=c)
if sys.argv[1]=='me':
    r=yt.channels().list(part='snippet',mine=True).execute(); print([(i['id'],i['snippet']['title']) for i in r.get('items',[])])
elif sys.argv[1]=='ptmap':
    # Mapa vídeo em inglês -> versão [PT] não listada (para o botão "Ver em português" do app).
    # Junta cada "[PT] ..." com o vídeo sem [PT] enviado mais perto no tempo (mesma publicação).
    import datetime
    up=yt.channels().list(part='contentDetails',mine=True).execute()['items'][0]['contentDetails']['relatedPlaylists']['uploads']
    itens=[]; tok=None
    for _ in range(4):
        r=yt.playlistItems().list(part='snippet',playlistId=up,maxResults=50,pageToken=tok).execute()
        itens+=r.get('items',[]); tok=r.get('nextPageToken')
        if not tok: break
    t=lambda i: datetime.datetime.fromisoformat(i['snippet']['publishedAt'].replace('Z','+00:00'))
    pts=[i for i in itens if i['snippet']['title'].startswith('[PT]')]; ens=[i for i in itens if not i['snippet']['title'].startswith('[PT]')]
    p=sys.argv[2] if len(sys.argv)>2 else 'painel/pt_map.json'
    try: mapa=json.load(open(p))
    except Exception: mapa={}
    for pt in pts:
        perto=min(ens,key=lambda e: abs((t(e)-t(pt)).total_seconds()),default=None)
        if perto and abs((t(perto)-t(pt)).total_seconds())<900:
            mapa[perto['snippet']['resourceId']['videoId']]=pt['snippet']['resourceId']['videoId']
    json.dump(mapa,open(p,'w'),indent=0); print('ptmap',len(mapa))
elif sys.argv[1]=='up':
    m=json.load(open(sys.argv[3]))
    body={'snippet':{'title':m['title'],'description':m['description'],'tags':m.get('tags',[]),'categoryId':'20','defaultLanguage':('en' if m.get('lang')=='en' else 'pt-BR'),'defaultAudioLanguage':('en' if m.get('lang')=='en' else 'pt-BR')},
          'status':{'privacyStatus':m.get('privacy','public'),'selfDeclaredMadeForKids':False,'containsSyntheticMedia':False}}
    r=yt.videos().insert(part='snippet,status',body=body,media_body=MediaFileUpload(sys.argv[2],chunksize=-1,resumable=True)).execute()
    print(r['id'], r['status'])
    import os
    for capa in (m.get('capa') or '', os.path.splitext(sys.argv[2])[0] + '.jpg', os.path.join(os.path.dirname(os.path.abspath(sys.argv[2])), 'capa.jpg')):
        if capa and os.path.exists(capa):
            try:
                yt.thumbnails().set(videoId=r['id'], media_body=MediaFileUpload(capa, mimetype='image/jpeg')).execute(); print('capa ok', capa)
            except Exception as e: print('AVISO: capa não aplicada:', e)
            break
    print('VIDEO_ID='+r['id'])
