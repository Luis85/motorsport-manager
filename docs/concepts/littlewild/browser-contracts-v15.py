"""Assignment/placement, legacy migration and independently bundled scenario checks."""
from pathlib import Path
import json, subprocess, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'verification/v15';OUT.mkdir(parents=True,exist_ok=True)
results=[]
def check(name,action):
    try:
        assert action() is not False
        results.append(dict(name=name,passed=True))
    except Exception as e:
        results.append(dict(name=name,passed=False,error=str(e))); print('FAIL',name,str(e))
def eq(a,b):
    assert a==b,(a,b)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport=dict(width=1440,height=900));errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((ROOT/'littlewild.html').read_text(),wait_until='load');page.wait_for_function('window.Littlewild')
    page.locator('[data-act=land-demo]').click();page.wait_for_timeout(200)
    page.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()')
    before=page.evaluate('Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))')
    page.evaluate("Littlewild.open('construction')")
    page.locator('[data-build=select][data-id=shelter]').click()
    page.locator('#build-actor').select_option('c2');page.locator('#build-approach').select_option('careful')
    check('Alternate builder selection does not mutate either creature policy',lambda:eq(page.evaluate('Littlewild.engine.creatures.map(c=>({id:c.id,n:c.orders.length,approach:c.buildPolicy.approach}))'),before))
    page.locator('[data-build=place]').click()
    tile=page.evaluate("""()=>{let e=Littlewild.engine;for(let y=1;y<18;y++)for(let x=1;x<18;x++)if(e.canBuild(x,y)&&!e.placementIssue('shelter',x,y))return{x,y};throw Error('No free plot')}""")
    page.evaluate('(tile)=>{Littlewild.world.hover=tile;Littlewild.world.keyboardTile=tile;}',tile)
    page.locator('#world').focus();page.keyboard.press('Enter');page.wait_for_timeout(100)
    order=page.evaluate('Littlewild.engine.creatures.find(c=>c.id==="c2").orders.at(-1)')
    check('Keyboard placement creates an actual construction task',lambda:eq(order['type'],'build'))
    check('Placement targets the explicitly assigned companion',lambda:eq(page.evaluate('Littlewild.engine.creatures.find(c=>c.id==="c2").orders.length'),before[1]['n']+1))
    check('Placement does not add an order to the first creature',lambda:eq(page.evaluate('Littlewild.engine.creatures[0].orders.length'),before[0]['n']))
    check('Placed task retains the draft construction approach',lambda:eq(order['approach'],'careful'))
    check('Placement keeps existing per-creature default policy',lambda:eq(page.evaluate('Littlewild.engine.creatures[1].buildPolicy.approach'),before[1]['approach']))
    check('Placing a plan does not pay remote supplies',lambda:eq(order['paid'],False))
    saved=page.evaluate('Littlewild.snapshot()')
    check('Placed plan round-trips through scenario-aware save',lambda:page.evaluate('(doc)=>{let e=LWStory.commit(LWStory.inspect(doc));return e.creatures.find(c=>c.id==="c2").orders.at(-1).approach==="careful";}',saved))
    # Real legacy fixture is harvested separately from the supplied, hash-pinned v14 artifact.
    fixture=ROOT/'source/fixtures/actual-v14-story.json'
    if fixture.exists():
        doc=json.loads(fixture.read_text());page.evaluate('(doc)=>Littlewild.setEngine(LWStory.commit(LWStory.inspect(doc)))',doc)
        check('Authentic v14 browser story stays format 8',lambda:eq(page.evaluate('Littlewild.snapshot().version'),8))
        check('Authentic v14 story keeps its creature skills',lambda:eq(page.evaluate('Littlewild.snapshot().state.colony.creatures.map(c=>c.skills)'),[c['skills'] for c in doc['state']['colony']['creatures']]))
    check('No browser errors during placement/save workflow',lambda:eq(errors,[]))
    # Build with ONLY an external pack, not the dual-pack showcase.
    artifact=OUT/'emberworks.html'
    subprocess.run([sys.executable,'source/build.py','--pack','source/content/emberworks.pack.json','--output',str(artifact)],cwd=ROOT,check=True,timeout=60,capture_output=True)
    page=browser.new_page(viewport=dict(width=1280,height=800));page.set_content(artifact.read_text(),wait_until='load');page.wait_for_function('window.Littlewild')
    check('Custom-build welcome is branded from its input pack',lambda:page.title().startswith('Emberworks'))
    check('Custom artifact contains one selectable pack',lambda:eq(page.evaluate('LWScenarios.builtins().length'),1))
    page.locator('[data-act=begin]').click();page.wait_for_timeout(100)
    check('Custom-build start uses the pack-defined first scene',lambda:eq(page.evaluate('Littlewild.engine.scenarioContext.sceneId'),'workshop-first-morning'))
    check('Custom-build start uses the authored companion name',lambda:eq(page.evaluate('Littlewild.engine.creatures[0].name'),'Rivet'))
    check('Custom-build start uses an authored world profile',lambda:eq(page.evaluate('LWWorldProfile.current.name'),'Copper Shore'))
    browser.close()
report=dict(passed=sum(r['passed'] for r in results),total=len(results),results=results)
(OUT/'browser-contract-results.json').write_text(json.dumps(report,indent=2));print(str(report['passed'])+'/'+str(report['total']))
if report['passed']!=report['total']:sys.exit(1)
