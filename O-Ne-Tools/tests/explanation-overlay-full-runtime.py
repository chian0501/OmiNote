"""Full deployed V0.4.9 runtime smoke tests with opt-in Overlay.
Runs original CSS and JS, package/sequence/gallery helpers in offline Chromium.
Only script transport is inlined. Real-origin localStorage and real OS IME popup
are not tested. No fonts or credentials are embedded in generated samples.
Requires: playwright, pillow, Chromium. OVERLAY_QA_DIR controls output directory.
"""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
def script(s):return '<script>\n'+s.replace('</script','<\\/script')+'\n</script>'
def build():
 html=(ROOT/'explanation-card.html').read_text()
 html=re.sub(r'<link rel="stylesheet" href="\./([^?" ]+)(?:[^" ]*)">',lambda m:'<style>'+ (ROOT/m[1]).read_text()+'</style>',html)
 resources={name:(ROOT/name).read_text() for name in ['project-package-v1.js','batch-render-v1.js','ai-json-guide-v1.js']}
 # Offline transport only; application state, rendering, serializers and UI scripts are unmodified.
 hook='''(function(){const sources=%s;const original=document.write.bind(document);document.write=function(markup){return original(String(markup).replace(/<script src="\\.\\/([^?\"]+)[^\"]*"><\\/script>/g,(_,name)=>{if(!sources[name])throw new Error('Unknown offline dependency '+name);return '<script>'+sources[name].replace(/<\\/script/gi,'<\\\\/script')+'</'+'script>';}));};})();'''%json.dumps(resources,ensure_ascii=False)
 preload='<style id="one-tools-ui-css">'+(ROOT/'one-tools-ui-v1.css').read_text()+'</style>'+script((ROOT/'one-tools-ui-v1.js').read_text())+script(hook)
 html=html.replace('</head>',preload+'</head>')
 html=re.sub(r'<script src="\./([^?" ]+)(?:[^" ]*)"></script>',lambda m:script((ROOT/m[1]).read_text()),html)
 footer='<style>'+(ROOT/'explanation-card-overlay-pilot-v1.css').read_text()+'</style>'+script("window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{"+(ROOT/'explanation-card-overlay-pilot-v1.js').read_text()+"},100));")
 html=html.replace('</body>',footer+'</body>')
 return html

if __name__=='__main__':
 import os,base64,io,zipfile,hashlib
 from PIL import Image
 from playwright.sync_api import sync_playwright
 OUT=Path(os.environ.get('OVERLAY_QA_DIR',ROOT/'tests/full-overlay-qa-output'));OUT.mkdir(parents=True,exist_ok=True)
 HTML=build();(OUT/'full-sample.html').write_text(HTML)
 results=[];errors=[]
 def check(name,value):
  results.append({'name':name,'pass':bool(value)});print(('PASS ' if value else 'FAIL ')+name,flush=True)
  if not value:raise AssertionError(name)
 def png(page):return page.evaluate("(()=>{const out=document.createElement('canvas');renderCanvas(out);return out.toDataURL()})()")
 def open_block(page,kind='title',index=0):
  page.evaluate('([kind,index])=>ONEExplanationOverlayPilot.open(state.blocks.filter(b=>b.kind===kind)[index].id)',[kind,index]);page.wait_for_timeout(60)
 def select_offsets(page,a,b):
  page.evaluate('''([a,b])=>{const editor=document.querySelector('.one-overlay-active .rich'),w=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let n,pos=0,start,end;while(n=w.nextNode()){let l=n.textContent.length;if(!start&&a<=pos+l)start=[n,a-pos];if(b<=pos+l){end=[n,b-pos];break;}pos+=l;}const r=document.createRange();r.setStart(...start);r.setEnd(...end);getSelection().removeAllRanges();getSelection().addRange(r);saveSelection();}''',[a,b])
 def image_click(page):
  page.locator('#previewCanvas').scroll_into_view_if_needed();rect=page.locator('#previewCanvas').bounding_box();l=page.evaluate('layoutCard(canvas.getContext("2d"))')
  page.mouse.click(rect['x']+(l['imageX']+l['imageW']/2)*rect['width']/l['width'],rect['y']+(l['imageY']+80)*rect['height']/l['height'])
 def new(browser,width=1600):
  page=browser.new_page(viewport={'width':width,'height':1000},accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(HTML);page.wait_for_function('window.ONEExplanationOverlayPilot');page.wait_for_timeout(300);return page
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   page=new(b)
   check('all production format/sequence/gallery/package/backup/UI modules loaded',page.evaluate('!!(ONEExplanationFormatCore&&__ONE_V049__&&__ONE_V040__&&ONEProjectPackage&&ONEEditBackup&&ONEAfterEditDock)'))
   check('original formal HTML has no pilot script', 'overlay-pilot' not in (ROOT/'explanation-card.html').read_text())
   check('same shared format core with minimal adapter',page.evaluate("ONEExplanationFormatCore.version==='FORMAT_CORE_V3_20260904'"))
   start=png(page);open_block(page);check('opening overlay leaves full export pixels unchanged',start==png(page))
   page.keyboard.press('Control+a');page.keyboard.insert_text('原位中文輸入')
   check('full runtime typing updates canonical title',page.evaluate('state.blocks[0].html.includes("原位中文輸入")'))
   page.locator('#fontSizeVisualButton').click();page.locator('[data-size="56"]').click()
   check('56px works in production toolbar',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs.every(r=>r.style.size===56)'))
   page.keyboard.press('Control+z');page.wait_for_timeout(50)
   check('full runtime undo restores prior size',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===68'))
   page.keyboard.press('Control+Shift+z');page.wait_for_timeout(50)
   check('full runtime redo restores 56px',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===56'))
   before=png(page)
   with page.expect_download() as dl:page.evaluate('document.getElementById("exportPng").click()')
   check('real PNG button exports latest overlay pixels',Path(dl.value.path()).read_bytes()==base64.b64decode(before.split(',')[1]))
   check('no overlay left on PNG export',page.evaluate('!ONEExplanationOverlayPilot.state().activeBlockId'))
   page.close()
   page=new(b)
   page.evaluate('state.blocks[2].html=\'<span style="color:#FFBE37;font-weight:800">黃字</span>與白字\';renderEditor();renderCanvas()')
   open_block(page,'body');select_offsets(page,0,2);page.locator('#underlineBtn').click();page.locator('#italicBtn').click()
   check('mixed Rich Text retains untouched run style',page.evaluate('(()=>{const r=htmlToParagraphs(state.blocks[2].html,"body")[0].runs;return r[0].style.underline&&r[0].style.italic&&!r[1].style.underline})()'))
   page.locator('#copyStyleBtn').click();open_block(page,'subtitle');page.keyboard.press('Control+a');page.locator('#applyStyleBtn').click()
   check('existing painter works across on-canvas blocks',page.evaluate('state.blocks[1].html.includes("一句副標")&&htmlToParagraphs(state.blocks[1].html,"subtitle")[0].runs[0].style.underline'))
   page.close()
   page=new(b);open_block(page);original=page.evaluate('state.blocks[0].html');page.keyboard.press('Control+a')
   cdp=page.context.new_cdp_session(page);cdp.send('Input.imeSetComposition',{'text':'正在選字','selectionStart':4,'selectionEnd':4})
   check('composition protected with all production event listeners',page.evaluate('ONEExplanationOverlayPilot.state().composing') and page.evaluate('state.blocks[0].html')==original)
   page.evaluate('document.getElementById("exportPng").click()')
   check('PNG guarded during unconfirmed composition',page.evaluate('ONEExplanationOverlayPilot.state().composing&&!!ONEExplanationOverlayPilot.state().activeBlockId'))
   cdp.send('Input.insertText',{'text':'完整組字測試'});page.wait_for_timeout(100)
   check('composition commit preserves Chinese in full runtime',page.evaluate('state.blocks[0].html.includes("完整組字測試")'))
   page.keyboard.press('Control+z');page.wait_for_timeout(50);check('full runtime IME undo restores previous string',page.evaluate('state.blocks[0].html')==original)
   page.close()
   page=new(b)
   # Reuse production sequence import, not stubbed assets. Use synthetic image data only.
   page.evaluate('''async()=>{const payload=projectPayload();payload.data.blocks=[block('title','逐幕測試'),block('subtitle','原位改字'),block('body','第一項'),block('body','第二項'),block('body','第三項')];payload.data.sequence={enabled:true,visibleCount:1,frames:[]};payload.assets.sequence_images=payload.data.blocks.slice(2).map((b,i)=>{const c=document.createElement('canvas');c.width=400;c.height=500;const ctx=c.getContext('2d');ctx.fillStyle=['#cc0000','#00aa00','#0000cc'][i];ctx.fillRect(0,0,400,500);const name='synthetic-step-'+(i+1)+'.png';payload.data.sequence.frames.push({blockId:b.id,image:{...payload.data.image,name,fit:'cover'}});return{block_id:b.id,name,mime_type:'image/png',data_url:c.toDataURL()}});await loadProjectPayload(payload);}''')
   check('real sequence import restores all three image assets',page.evaluate('__ONE_V049__.getSequenceAssets().size===3'))
   open_block(page,'body',2)
   check('outline selection advances through actual per-step image API',page.evaluate('state.sequence.visibleCount===3&&state.image.name==="synthetic-step-3.png"'))
   page.keyboard.press('Control+a');page.keyboard.insert_text('第三項已修改');page.locator('#oneOverlayDone').click()
   image_click(page);page.wait_for_timeout(50)
   check('clicking image opens current third-step crop drawer',page.evaluate('imageDrawerOpen&&document.getElementById("imageDrawerTitle").textContent.includes("3")'))
   page.locator('#closeImageDrawer').click()
   before=png(page);open_block(page,'body',1)
   page.keyboard.press('Control+a');page.keyboard.insert_text('第二項格式保留')
   with page.expect_download() as dl:page.evaluate('document.getElementById("exportProject").click()')
   onecard=json.loads(Path(dl.value.path()).read_text())
   check('.onecard includes edited line and all per-step images','第二項格式保留' in onecard['data']['blocks'][3]['html'] and len(onecard['assets']['sequence_images'])==3)
   page.evaluate('__ONE_V049__.activateStep(0)');open_block(page)
   page.keyboard.press('Control+a');page.keyboard.insert_text('專案封存測試')
   with page.expect_download() as dl:page.evaluate('document.querySelector("[data-action=export-package]").click()')
   zipbytes=Path(dl.value.path()).read_bytes();(OUT/'project-test.zip').write_bytes(zipbytes)
   with zipfile.ZipFile(io.BytesIO(zipbytes)) as z:
    jname=next(n for n in z.namelist() if n.endswith('.json') and '/' not in n);project=json.loads(z.read(jname));assets=[n for n in z.namelist() if n.startswith('assets/')];previewname=next(n for n in z.namelist() if n.endswith('.png') and '/' not in n)
    check('real project ZIP contains all per-step assets',len(assets)==3)
    check('project ZIP JSON has latest title','專案封存測試' in project['data']['blocks'][0]['html'])
    expected_png=base64.b64decode(png(page).split(',')[1]);(OUT/'zip-preview.png').write_bytes(z.read(previewname));(OUT/'zip-expected.png').write_bytes(expected_png)
    check('project ZIP preview contains full text, no overlay gap',Image.open(io.BytesIO(z.read(previewname))).tobytes()==Image.open(io.BytesIO(expected_png)).tobytes())
   # Restore through actual package file input after destroying data, preserving same source semantics.
   page.evaluate('state.blocks[0].html="待取代";renderEditor();renderCanvas()')
   page.locator('[data-one-project-package-ui] input[type=file]').set_input_files({'name':'project-test.zip','mimeType':'application/zip','buffer':zipbytes})
   page.wait_for_function('state.blocks[0].html.includes("專案封存測試")&&__ONE_V049__.getSequenceAssets().size===3')
   page.wait_for_timeout(500)
   check('project ZIP restores canonical title and all images',page.evaluate('state.blocks[0].html.includes("專案封存測試")&&__ONE_V049__.getSequenceAssets().size===3'))
   with page.expect_download() as dl:page.evaluate('document.getElementById("exportSequenceAll").click()')
   with zipfile.ZipFile(io.BytesIO(Path(dl.value.path()).read_bytes())) as z:
    imgs=[Image.open(io.BytesIO(z.read(n))).convert('RGB') for n in z.namelist() if n.endswith('.png')]
    check('real cumulative export produces three PNGs',len(imgs)==3)
    check('all cumulative PNG dimensions identical',len({im.size for im in imgs})==1)
    check('per-step image order preserved',[im.getpixel((100,100)) for im in imgs]==[(204,0,0),(0,170,0),(0,0,204)])
   check('export-all returns to original active step',page.evaluate('state.sequence.visibleCount===1'))
   open_block(page,'title');page.keyboard.press('Control+a');page.keyboard.insert_text('這裡可以直接改字');page.wait_for_timeout(100)
   page.screenshot(path=str(OUT/'full-overlay-editing.png'),full_page=True)
   page.evaluate('ONEExplanationOverlayPilot.finish()');page.screenshot(path=str(OUT/'full-overlay-finished.png'),full_page=True)
   page.evaluate('window.__ONE_V049__.runQa()');page.wait_for_timeout(250)
   check('existing V0.4.9 runtime image/package QA still passes',page.evaluate('document.body.dataset.qa==="pass"'))
   page.close()
   page=new(b);page.locator('#galleryMode').click();page.wait_for_timeout(100)
   check('gallery safely uses existing editor',page.evaluate('state.mode==="gallery"&&!ONEExplanationOverlayPilot.state().enabled'))
   page.evaluate('__ONE_V040__.setGalleryLayout("triple")');check('existing triple gallery layout still works',page.evaluate('state.gallery.layout==="triple"'))
   page.close()
   check('no uncaught browser errors in full runtime',not errors)
   b.close()
 finally:
  report={'scope':'full V0.4.9 production HTML/CSS/JS with offline script transport; opt-in Overlay', 'tests':results,'pass_count':sum(t['pass'] for t in results),'total':len(results),'browser_errors':errors,'not_verified':['real OS Zhuyin/Pinyin candidate popup','native origin localStorage persistence','actual deployed iframe launcher over HTTP','multi-line DOM/Canvas parity','remaining UI and note sequence redesign'], 'source_sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in ROOT.glob('explanation-card-*.js')}}
  (OUT/'full-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'passed':report['pass_count'],'total':report['total'],'errors':errors},ensure_ascii=False))
