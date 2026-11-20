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
