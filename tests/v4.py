from playwright.sync_api import sync_playwright
import urllib.parse
U='https://ouaga-inondations-3d.akwalife.workers.dev';A=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
with sync_playwright() as p:
    b=p.chromium.launch(args=A);errs=[];pops=[]
    m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    m.on('pageerror',lambda e:errs.append(str(e)));m.context.on('page',lambda pg:pops.append(pg.url))
    m.goto(U+'/?lat=12.31822&lon=-1.49668');m.wait_for_timeout(16000)
    m.evaluate("document.querySelector('.btn.wa').scrollIntoView({block:'center'})");m.wait_for_timeout(500);m.screenshot(path='v4_mobile_fiche_whatsapp.png')
    print('TEXT:',m.evaluate("shareText()"))
    m.click('.btn.wa');m.wait_for_timeout(2500);print('POPUP:',pops[:1])
    m.click('text=Chez moi, c\'était différent');m.wait_for_timeout(800);m.screenshot(path='v4_mobile_form_haut.png')
    m.check('input[value=genou]');m.fill('textarea[name=texte]','TEST AUTOMATIQUE – à supprimer');m.set_input_files('input[name=photo0]','/tmp/test_big.png')
    m.evaluate("document.querySelector('#temsub').scrollIntoView()");m.wait_for_timeout(300);m.screenshot(path='v4_mobile_form_bas.png')
    m.click('#temsub');m.wait_for_timeout(6000);m.screenshot(path='v4_mobile_form_merci.png');print('ID:',m.evaluate('window.TEMID'))
    print(errs[:5]);b.close()
