import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
// Synthetic-only accessibility scan. Run with the CI-pinned Playwright and axe-core versions.
// Browser emulation and accessibility-tree checks do not certify physical devices or screen readers.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let f=path.join(root,pathname === '/' ? 'index.html' : pathname);
  if(!f.startsWith(root+'/') || !fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const axe=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const results=[];
const views=[['dashboard','dashboard-sub','overview'],['dashboard','dashboard-sub','insights'],['expenses','expenses-sub','budget'],['expenses','expenses-sub','spending'],['plan','plan-sub','scenarios'],['reports','report','cashflow'],['reports','report','networth']];
const widths=process.env.A11Y_WIDTHS ? process.env.A11Y_WIDTHS.split(',').map(Number) : [390,1280];
const schemes=process.env.A11Y_SCHEMES ? process.env.A11Y_SCHEMES.split(',') : ['light','dark'];
for(const width of widths)for(const scheme of schemes){
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:scheme,isMobile:width<700,hasTouch:width<700});
 await context.route(/fonts\.(googleapis|gstatic)\.com|docs\.google\.com|coingecko|frankfurter|dropboxapi|anthropic/,r=>r.abort());
 await context.addInitScript(()=>localStorage.setItem('wealthPlanner.hasSeenIntro','1'));
 const page=await context.newPage();
 await page.goto(base+'/index.html?mock=1');await page.waitForFunction(()=>document.documentElement.hasAttribute('data-wp-ready'));await page.waitForTimeout(1200);
 await page.evaluate(axe);
 async function scan(name){
  const result=await page.evaluate(async()=>{
   const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
   // axe cannot resolve contrast for single-character badges, glyphs and SVG labels.
   const luminance = color => {
    const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
   };
   const contrastChecks = [];
   document.querySelectorAll('.notif-badge:not([hidden]),.icon-btn,.btn-danger,.rc-label').forEach(el => {
    if(!el.getClientRects().length || el.closest('[disabled]')) return;
    let parent = el, background = null;
    while(parent){
     const style = getComputedStyle(parent), channels = style.backgroundColor.match(/[\d.]+/g);
     if(style.backgroundImage !== 'none') return;
     if(channels && (channels.length === 3 || Number(channels[3]) === 1)){ background = style.backgroundColor; break; }
     parent = parent.parentElement;
    }
    if(!background) return;
    const style = getComputedStyle(el), foreground = el.matches('.rc-label') ? style.fill : style.color;
    const a = luminance(foreground), b = luminance(background);
    contrastChecks.push({element:el.outerHTML.slice(0,250),foreground,background,ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)});
   });
   return {contrastChecks,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}))};
  });
  const layout = await page.evaluate(() => ({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  const accessibilityTree = await page.locator('body').ariaSnapshot();
  results.push({name,width,scheme,...result,accessibilityTree,layout});
  if(process.env.A11Y_DIR && ['onboarding','plan/scenarios','reports/networth','setup/1','setup/2'].includes(name)){
   fs.mkdirSync(process.env.A11Y_DIR,{recursive:true});
   await page.screenshot({path:path.join(process.env.A11Y_DIR, width+'-'+scheme+'-'+name.replaceAll('/','-')+'.png'),fullPage:true});
  }
  console.log(JSON.stringify({name,width,scheme,violations:result.violations.map(v=>({id:v.id,count:v.nodes.length})),contrastFailures:result.contrastChecks.filter(c=>c.ratio<4.5)}));
 }
 for(const [pg,attr,sub]of views){
  await page.evaluate(p=>{const b=document.querySelector('.mobile-tab[data-page="'+p+'"]')||document.querySelector('[data-page="'+p+'"]')||document.querySelector('[data-avatar-go="'+p+'"]');b.click();},pg);
  await page.waitForTimeout(300);
  await page.evaluate(([a,s])=>document.querySelector('[data-'+a+'="'+s+'"]').click(),[attr,sub]);await page.waitForTimeout(500);
  await scan(pg+'/'+sub);
  if(pg==='expenses'&&sub==='budget'){
   await page.locator('#recurringRuleForm').evaluate(f=>{f.closest('details').open=true;});
   await scan('recurring-rule-form');
  }
 }
 await page.evaluate(async()=>{
  const s=await import('/src/state.js');s.setState(s.defaultState());
  (await import('/src/calc/engine.js')).recalcComputedItems();
  const nav=await import('/src/components/nav.js');nav.showPage('dashboard');nav.showDashboardSubpage('overview');
  (await import('/src/components/redraw.js')).renderAll();
 });
 await page.waitForTimeout(500);
 await page.locator('#dashboardSetup [data-firstrun-open]').click();
 for(let step=1;step<=5;step++){
  await scan('setup/'+step);
  if(step<5) await page.locator('[data-fr-next]').click();
 }
 await page.locator('[data-fr-close]').click();
 await page.waitForFunction(()=>!document.querySelector('#firstRunRoot [role="dialog"]'));
 await page.goto(base+'/onboarding.html');await page.evaluate(axe);await scan('onboarding');
 await page.goto(base+'/welcome.html');await page.evaluate(axe);await scan('welcome');
 await context.close();
}
if(process.env.A11Y_DIR){
 fs.mkdirSync(process.env.A11Y_DIR,{recursive:true});
 fs.writeFileSync(path.join(process.env.A11Y_DIR,'results.json'),JSON.stringify(results,null,2));
}
await browser.close();server.close();

const failed=results.filter(r=>r.violations.length || r.layout.scrollWidth > r.layout.viewport + 1 || r.contrastChecks.some(c=>c.ratio<4.5));
console.log('Accessibility scan: '+results.length+' states, '+failed.length+' with violations, contrast failures or page overflow.');
if(failed.length) process.exitCode=1;
