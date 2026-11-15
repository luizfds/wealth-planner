// Reproducible #308 evidence: the same invented household, clock and viewports in both checkouts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {demoHousehold,demoReceipts} from '../src/calc/demo.js';
import {state,setState,migrateState} from '../src/state.js';
import {recalcComputedItems} from '../src/calc/engine.js';

const checkout=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.env.POLISH_ROOT||checkout),out=path.resolve(process.env.POLISH_SHOTS||'/tmp/polish-308');
const today='2026-11-03';
setState(migrateState(demoHousehold(today)));recalcComputedItems();demoReceipts(state,today);
state.savingsGoals=state.savingsGoals.slice(0,1);state.tax.privateHospitalCover=false;state.autoPrices.on=false;
const fixture=JSON.stringify(state);
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  let file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch(),base='http://127.0.0.1:'+server.address().port;
const manifest=[];
try{
  for(const width of [390,1280])for(const theme of ['light','dark']){
    const ctx=await browser.newContext({viewport:{width,height:width===390?844:800},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
    try{
      await ctx.addInitScript(fixture=>{
        localStorage.setItem('wealthPlanner.v1',fixture);localStorage.setItem('wealthPlanner.hasSeenIntro','1');localStorage.setItem('wealthPlanner.tour','skipped');
      },fixture);
      await ctx.route(/fonts\.(googleapis|gstatic)\.com|docs\.google\.com|coingecko|frankfurter|dropboxapi|anthropic|rates\/cash-rate\.json/,r=>r.abort());
      const page=await ctx.newPage();await page.clock.setFixedTime(new Date(today+'T10:00:00'));
      await page.goto(base+'/index.html');
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-wp-ready'));
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const go=async(pg,sub)=>{
        await page.evaluate(async({pg,sub})=>{
          const nav=await import('/src/components/nav.js');await nav.showPage(pg);
          if(pg==='dashboard')await nav.showDashboardSubpage(sub);
          if(pg==='settings')await nav.showAccountsSubpage(sub);
          if(pg==='tax')await nav.showTaxSubpage(sub);
          if(pg==='reports'){
            const chooser=document.querySelector('[data-report-choose]');if(chooser)chooser.click();
            document.querySelector('[data-report="cashflow"]')?.click();
          }
          window.scrollTo(0,0);
        },{pg,sub});
        await page.waitForFunction(pg=>document.body.dataset.currentPage===pg,pg);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      };
      const shot=async name=>{
        await page.evaluate(()=>document.querySelectorAll('#toastWrap .toast').forEach(e=>e.remove()));
        const file=name+'-'+width+'-'+theme+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});
        manifest.push({file,view:await page.evaluate(()=>location.pathname),width,theme});
      };
      await go('dashboard','overview');await shot('home');
      await page.locator('#notifBellBtn').click();await shot('notifications');
      await page.locator('#notifBellBtn').click();
      await go('properties');await shot('property');
      await go('tax','year');await page.evaluate(()=>document.querySelectorAll('.app-page:not([hidden]) details').forEach(d=>d.open=true));await shot('tax');
      await go('settings','categories');await shot('categories');
      await go('settings','preferences');await page.evaluate(()=>document.querySelectorAll('.app-page:not([hidden]) details').forEach(d=>d.open=true));await shot('preferences');
      await go('reports');await page.waitForFunction(()=>!!document.querySelector('.app-page:not([hidden]) svg'));await shot('report');
    }finally{await ctx.close();}
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({today,root,scenes:manifest},null,2));
  console.log('Saved '+manifest.length+' synthetic-household photographs to '+out);
}finally{await browser.close();await new Promise(r=>server.close(r));}
