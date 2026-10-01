import sys, json, pickle
from google_auth_oauthlib.flow import Flow
CS='/'.join([__import__('os').path.expanduser('~'),'mnt/Videos/GTA6_CHANNEL/client_secret.json'])
SC=['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly']
if sys.argv[1]=='url':
    f=Flow.from_client_secrets_file(CS,scopes=SC,redirect_uri='http://localhost')
    url,state=f.authorization_url(access_type='offline',prompt='consent')
    pickle.dump({'state':state,'cv':f.code_verifier},open(__import__('os').path.expanduser('~/vcd/st.pkl'),'wb'))
    print(url)
else:
    s=pickle.load(open(__import__('os').path.expanduser('~/vcd/st.pkl'),'rb'))
    f=Flow.from_client_secrets_file(CS,scopes=SC,redirect_uri='http://localhost',state=s['state'])
    f.code_verifier=s['cv']
    import os; os.environ['OAUTHLIB_INSECURE_TRANSPORT']='1'; os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE']='1'
    f.fetch_token(authorization_response=sys.argv[2])
    open(os.path.expanduser('~/mnt/Videos/GTA6_CHANNEL/token.json'),'w').write(f.credentials.to_json())
    print('OK', bool(f.credentials.refresh_token))
