"""Capture the supplied v14 UI without modifying its implementation."""
from pathlib import Path
import argparse,json,hashlib
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('baseline');args=parser.parse_args()
root=Path(__file__).resolve().parent;out=root/'screenshots/v15-before';out.mkdir(parents=True,exist_ok=True)
source=Path(args.baseline);data={'baselineSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'captures':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
 p=b.new_page(viewport={'width':1440,'height':900});p.set_content(source.read_text(),wait_until='load');p.wait_for_function('window.Littlewild')
 p.locator('[data-act=land-demo]').click();p.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()')
 for route,name in [('construction','01-build'),('v10-guide','02-guide')]:
  p.evaluate('(route)=>Littlewild.open(route)',route);p.wait_for_timeout(100);p.screenshot(path=str(out/(name+'.png')))
  data['captures'].append({'route':route,'file':name+'.png','rect':p.locator('#modal').bounding_box(),'backgroundInert':p.evaluate('document.getElementById("app").inert')})
 b.close()
(root/'verification/v15/baseline-observation.json').write_text(json.dumps(data,indent=2))
