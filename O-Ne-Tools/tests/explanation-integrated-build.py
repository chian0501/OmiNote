"""Build the opt-in screenshot-repair candidate as a standalone HTML.
Applies exact SHA-256-pinned source changes, then inlines dependencies for offline use.
No fonts, credentials, user media, or network credentials are embedded.
"""
from pathlib import Path
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
def script(s):return '<script>\n'+s.replace('</script','<\\/script')+'\n</script>'
def source(name):
 text=(ROOT/name).read_text()
 spec=json.loads((ROOT/'explanation-card-screenshot-repair-v2.json').read_text())['files'].get(name)
 if spec:
  digest=hashlib.sha256(text.encode()).hexdigest()
  if digest==spec['result_sha256']:return text
  if digest!=spec['source_sha256']:raise ValueError('Source mismatch: '+name)
  for change in spec['replacements']:
   if text.count(change['before'])!=1:raise ValueError('Non-unique patch: '+name)
   text=text.replace(change['before'],change['after'])
  if hashlib.sha256(text.encode()).hexdigest()!=spec['result_sha256']:raise ValueError('Result mismatch: '+name)
 return text

def build():
 html=(ROOT/'explanation-card.html').read_text()
 html=html.replace('</head>',script((ROOT/'explanation-card-sequence-model-v1.js').read_text())+'</head>')
 html=re.sub(r'<link rel="stylesheet" href="\./([^?" ]+)(?:[^" ]*)">',lambda m:'<style>'+ source(m[1])+'</style>',html)
 resources={name:(ROOT/name).read_text() for name in ['project-package-v1.js','batch-render-v1.js','ai-json-guide-v1.js']}
 # Inline existing package helpers; candidate source changes are isolated in the manifest.
 hook='''(function(){const sources=%s;const original=document.write.bind(document);document.write=function(markup){return original(String(markup).replace(/<script src="\\.\\/([^?\"]+)[^\"]*"><\\/script>/g,(_,name)=>{if(!sources[name])throw new Error('Unknown offline dependency '+name);return '<script>'+sources[name].replace(/<\\/script/gi,'<\\\\/script')+'</'+'script>';}));};})();'''%json.dumps(resources,ensure_ascii=False)
 preload='<style id="one-tools-ui-css">'+(ROOT/'one-tools-ui-v1.css').read_text()+'</style>'+script((ROOT/'one-tools-ui-v1.js').read_text())+script(hook)
 html=html.replace('</head>',preload+'</head>')
 html=re.sub(r'<script src="\./([^?" ]+)(?:[^" ]*)"></script>',lambda m:script(source(m[1])),html)
 footer='<style>'+(ROOT/'explanation-card-overlay-pilot-v1.css').read_text()+'</style>'+script("window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{"+source('explanation-card-overlay-pilot-v1.js')+"},100));")
 html=html.replace('</body>',footer+'</body>')
 html=html.replace('</body>','<style>'+(ROOT/'explanation-card-workspace-v2.css').read_text()+'</style>'+script("window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{"+(ROOT/'explanation-card-workspace-v2.js').read_text()+"},150));")+'</body>')
 return html

