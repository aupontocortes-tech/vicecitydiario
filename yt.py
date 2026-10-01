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
    body={'snippet':{'title':m['title'],'description':m['description'],'tags':m.get('tags',[]),'categoryId':'20','defaultLanguage':'pt-BR','defaultAudioLanguage':'pt-BR'},
          'status':{'privacyStatus':m.get('privacy','public'),'selfDeclaredMadeForKids':False,'containsSyntheticMedia':False}}
    r=yt.videos().insert(part='snippet,status',body=body,media_body=MediaFileUpload(sys.argv[2],chunksize=-1,resumable=True)).execute()
    print(r['id'], r['status'])
