from playwright.sync_api import sync_playwright
import glob,os,subprocess
U='http://localhost:8787';A=["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
Q='/?lat=12.31822&lon=-1.49668'
with sync_playwright() as p:
    b=p.chromium.launch(args=A);errs=[]
    ctx=b.new_context(viewport={'width':1280,'height':720},record_video_dir='vid',record_video_size={'width':1280,'height':720})
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto(U+Q);pg.wait_for_timeout(15000);pg.select_option('#scen','2024-08-16');pg.wait_for_timeout(3000)
    pg.evaluate("$('hour').value=0.3;draw()");pg.wait_for_timeout(2500);pg.screenshot(path='v3_desktop_home_debut.png')
    pg.evaluate("$('hour').value=2.2;draw()");pg.wait_for_timeout(2500);pg.screenshot(path='v3_desktop_home_pluie_pic.png')
    pg.evaluate("$('hour').value=4.5;draw()");pg.wait_for_timeout(2500);pg.screenshot(path='v3_desktop_home_max_eau.png')
    pg.evaluate("$('hour').value=0;$('speed').value='1';draw();$('play').click()");pg.wait_for_timeout(24000)
    ctx.close()
    m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    m.on('pageerror',lambda e:errs.append('M:'+str(e)))
    m.goto(U+Q);m.wait_for_timeout(15000);m.select_option('#scen','2024-08-16');m.wait_for_timeout(2000)
    m.evaluate("$('hour').value=2.2;draw()");m.wait_for_timeout(3000);m.screenshot(path='v3_mobile_home_pluie_pic.png')
    m.evaluate("$('hour').value=4.5;draw()");m.wait_for_timeout(3000);m.screenshot(path='v3_mobile_home_max_eau.png')
    print(errs[:6]);b.close()
v=sorted(glob.glob('vid/*.webm'),key=os.path.getmtime)[-1]
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',v,'-ss','24','-c:v','libx264','-pix_fmt','yuv420p','-crf','26','/workspace/ouaga-flood/v2shots/v3_playback_maison_2024.mp4'])
