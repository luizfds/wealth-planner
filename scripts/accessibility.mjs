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
const browser=await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
const axe=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const results=[];
const views=[['dashboard','dashboard-sub','overview'],['dashboard','dashboard-sub','insights'],['expenses','expenses-sub','budget'],['expenses','expenses-sub','income'],['expenses','expenses-sub','spending'],['plan','plan-sub','scenarios'],['assets','assets-sub','summary'],['assets','assets-sub','Cash'],['assets','assets-sub','Super'],['assets','assets-sub','Vehicle'],['tax','tax-sub','year'],['tax','tax-sub','returns'],['tax','tax-sub','people'],['plan','plan-sub','goals'],['reports','report','cashflow'],['reports','report','networth']];
views.push(['assets','assets-sub','Shares'], ['properties',null,null]);
const widths=process.env.A11Y_WIDTHS ? process.env.A11Y_WIDTHS.split(',').map(Number) : [390,1280];
const schemes=process.env.A11Y_SCHEMES ? process.env.A11Y_SCHEMES.split(',') : ['light','dark'];
for(const width of widths)for(const scheme of schemes){
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:scheme,isMobile:width<700,hasTouch:width<700});
 await context.route(/fonts\.(googleapis|gstatic)\.com|docs\.google\.com|coingecko|frankfurter|dropboxapi|anthropic/,r=>r.abort());
 await context.addInitScript(()=>localStorage.setItem('wealthPlanner.hasSeenIntro','1'));
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);
 await page.goto(base+'/index.html?mock=1');await page.waitForFunction(()=>document.documentElement.hasAttribute('data-wp-ready'));await page.waitForTimeout(1200);
 await page.evaluate(axe);
 async function scan(name, selector){
  // A toast caught mid-fade (opacity between 0 and 1) fails color-contrast for the 200ms it takes to go — the
  // ?mock=1 "Sample data generated" one fades at ~3s, right as Home → Insights is scanned, so the job failed
  // whenever a runner landed on that moment. Wait it out; a toast fully shown is still scanned.
  await page.waitForFunction(()=>![...document.querySelectorAll('.toast')].some(t=>{const o=Number(getComputedStyle(t).opacity);return o>0&&o<1;}),null,{timeout:5000}).catch(()=>{});
  const result=await page.evaluate(async selector=>{
   const scope=selector ? document.querySelector(selector) : document;
   if(!scope) throw new Error("Missing accessibility scan scope: "+selector);
   const r=await window.axe.run(scope,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
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
  }, selector || null);
  const layout = await page.evaluate(() => ({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  const nativeTree = await cdp.send('Accessibility.getFullAXTree');
  const accessibilityTree = nativeTree.nodes.filter(n=>!n.ignored).map(n=>({id:n.nodeId,role:n.role?.value,name:n.name?.value,description:n.description?.value,children:n.childIds}));
  results.push({name,scope:selector || "document",width,scheme,...result,accessibilityTree,layout});
  if(process.env.A11Y_DIR && (name.startsWith('app-dialog/') || name.startsWith('ledger-editor/') || name.startsWith('income-editor/') || name.startsWith('asset-editor/') || name.startsWith('vehicle-editor/') || ['onboarding','plan/scenarios','reports/networth','setup/1','setup/2'].includes(name))){
   fs.mkdirSync(process.env.A11Y_DIR,{recursive:true});
   const shot=path.join(process.env.A11Y_DIR, width+'-'+scheme+'-'+name.replaceAll('/','-')+'.png');
   if(name.startsWith('ledger-editor/') || name.startsWith('income-editor/') || name.startsWith('asset-editor/') || name.startsWith('vehicle-editor/')) await page.locator('.m-row.open').screenshot({path:shot});
   else await page.screenshot({path:shot,fullPage:true});
  }
  console.log(JSON.stringify({name,scope:selector || "document",width,scheme,violations:result.violations.map(v=>({id:v.id,count:v.nodes.length,nodes:v.nodes})),contrastFailures:result.contrastChecks.filter(c=>c.ratio<4.5)}));
 }
 for(const [pg,attr,sub]of views){
  await page.evaluate(p=>{const b=document.querySelector('.mobile-tab[data-page="'+p+'"]')||document.querySelector('[data-page="'+p+'"]')||document.querySelector('[data-avatar-go="'+p+'"]');b.click();},pg);
  await page.waitForTimeout(300);
  if(attr) await page.evaluate(([a,s])=>document.querySelector('[data-'+a+'="'+s+'"]').click(),[attr,sub]);await page.waitForTimeout(500);
  if(pg==='assets') await page.locator('#netWorthPanel').evaluate(e=>{const d=e.closest('details');if(d)d.open=true;});
  // #261: Tax's forms and Plan's goal editor, every section open (and a goal open) — the fields axe should see.
  if(pg==='tax'||sub==='goals'){
   await page.evaluate(()=>{ document.querySelectorAll('.app-page:not([hidden]) details').forEach(d=>{d.open=true;}); const t=document.querySelector('#savingsGoalsBody [data-goal-toggle][aria-expanded="false"]'); if(t) t.click(); });
   await page.waitForTimeout(300);
   await page.evaluate(()=>document.querySelectorAll('.app-page:not([hidden]) details').forEach(d=>{d.open=true;}));
  }
  if(pg==='assets' && sub==='Shares') await scan('list-toolbar/Shares', '#assetsSub-Shares .record-toolbar');
  else await scan(pg+'/'+sub);
  // #306: the default lists and the controls moved behind their toolbars.
  if(pg==='assets' && (sub==='Shares'||sub==='Super')){
   await page.locator('#assetsSub-'+sub+' .record-toolbar [data-asset-list-filters]').click();
   await scan('list-filters/'+sub, '#assetListFilters-'+sub);
   await page.locator('#assetListFilters-'+sub+' [data-asset-list-filters]').click();
   if(sub==='Shares') for(const tool of ['prices','trades']){
    await page.locator('#assetsSub-Shares .record-toolbar [data-overflow-toggle]').click();
    await page.locator('#assetsSub-Shares [data-asset-list-tool="'+tool+'"]').click();
    await scan('list-tools/'+tool, '[data-asset-tool-panel="'+tool+'"]');
    await page.locator('[data-asset-tool-panel="'+tool+'"] > [data-asset-list-tool]').click();
   }
  }
  if(pg==='expenses' && sub==='spending'){
   await page.locator('#transactionsTable .record-toolbar [data-cf-panel]').click();
   await scan('list-filters/spending');
   await page.locator('#cfFilterRow [data-cf-panel]').click();
   await page.locator('#transactionsTable [data-cf-search]').click();
   await scan('list-search/spending');
  }
  if(pg==='expenses'&&sub==='budget'){
   await page.locator('#recurringRuleForm').evaluate(f=>{f.closest('details').open=true;});
   await scan('recurring-rule-form');
   // #261: shared ledger fields, including their conditional tax controls and error state.
   // #278: scan the whole document with the row modal open, including background isolation.
   const row=page.locator('[data-line-id="demo-groceries"]');
   await row.evaluate(el=>{const toggle=el.closest('.m-card').querySelector('[data-budget-group-toggle]');if(toggle?.getAttribute('aria-expanded')!=='true')toggle?.click();});
   await row.locator('[data-row-toggle]').first().click();
   await row.locator('.row-more-options').evaluate(el=>el.open=true);
   // Desktop enters from opacity:0. Measure final colours after its actual animation,
   // rather than comparing partially blended text during the entrance.
   await row.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
   await scan('ledger-editor/timing');
   await row.locator('.f-deductible').check();
   await scan('ledger-editor/personal-claim');
   const owner=row.locator('.f-deductperson');
   await owner.selectOption(await owner.locator('option[value^="property:"]').first().getAttribute('value'));
   await scan('ledger-editor/property-claim');
   await row.getByLabel('Amount',{exact:true}).fill('');
   await scan('ledger-editor/invalid-amount');
   await row.locator('.m-row-edit [data-row-toggle]').click();
   await page.waitForFunction(()=>!document.querySelector('[data-line-id="demo-groceries"]').classList.contains('open'));

  }
  if(pg==='expenses'&&sub==='income'){
   const index=await page.evaluate(async()=> (await import('/src/state.js')).state.income.findIndex(x=>x.id==='demo-pay-alex'));
   const row=page.locator('#incomeGroups .m-row[data-index="'+index+'"]');
   await row.locator('[data-row-toggle]').first().click();
   await row.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
   await scan('income-editor/monthly');
   await row.getByLabel('Frequency',{exact:true}).selectOption('Weekly');
   await scan('income-editor/weekly');
   await row.getByLabel('Frequency',{exact:true}).selectOption('Fortnightly');
   await scan('income-editor/fortnightly');
   await row.getByLabel('Salary sacrifice',{exact:true}).selectOption('Sacrifice %');
   await scan('income-editor/percent');
   await row.getByLabel('Sacrifice percentage',{exact:true}).fill('');
   await scan('income-editor/invalid-sacrifice');
   await row.getByLabel('Sacrifice percentage',{exact:true}).fill('5');
   await row.getByLabel('Salary sacrifice',{exact:true}).selectOption('Sacrifice $');
   await row.getByLabel('Sacrifice amount',{exact:true}).fill('500');
   await scan('income-editor/amount');
   const draft=row.getByRole('group',{name:'Record a pay change',exact:true}).getByLabel('New amount',{exact:true});
   const original=await draft.inputValue();await draft.fill('1500');
   await scan('income-editor/pay-change-draft');
   await draft.fill(original);
   await row.locator('.m-row-summary[data-row-toggle]').click();
   await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
  }

  if(pg==='assets'&&['Cash','Super','Vehicle'].includes(sub)){
   const assetId=sub==='Cash'?'demo-cash-everyday':sub==='Super'?'demo-super-alex':'demo-car';
   const index=await page.evaluate(async id=>(await import('/src/state.js')).state.assets.findIndex(x=>x.id===id),assetId);
   const row=page.locator('#assetsSub-'+sub+' .m-row[data-index="'+index+'"]');
   await row.locator('[data-row-toggle]').first().click();
   await row.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
   await scan(sub==='Vehicle'?'vehicle-editor/computed':'asset-editor/'+sub.toLowerCase());
   if(sub==='Vehicle'){
    await row.getByLabel('Depreciation per year',{exact:true}).fill('');
    await page.evaluate(async()=> (await import('/src/components/redraw.js')).renderAll());
    if(await row.locator('.v-deprate').inputValue()!=='') throw new Error('Blank rate was replaced during redraw');
    await scan('vehicle-editor/blank-rate');
    await row.getByLabel('Purchase date',{exact:true}).fill('');
    await scan('vehicle-editor/stored-value');
   }
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.m-row.open'));
  }

 }

 // Shared questions: names, password/error states and explicit three-way cancellation (#256).
 for(const kind of ['text','password','unlock','error','confirm','choice']){
  await page.evaluate(async kind=>{
   const d=await import('/src/lib/dialogs.js');
   if(kind==='text')d.textDialog('Name this example scenario.','',{title:'Scenario name',required:true});
   else if(kind==='password'||kind==='error')d.textDialog('Keep this passphrase somewhere safe.','',{title:'Protect your data',label:'Passphrase',password:true,repeat:true,required:true});
   else if(kind==='unlock')d.textDialog('Enter the passphrase for the existing synced copy.','',{title:'Unlock synced copy',label:'Passphrase',accept:'Unlock sync',password:true,required:true});
   else if(kind==='choice')d.choiceDialog('Choose which copy to keep.',{title:'Choose copy',accept:'Load saved copy',alternative:'Use this copy'});
   else d.confirmDialog('This replaces the example household.',{title:'Replace household',accept:'Replace household',danger:true});
  },kind);
  await page.locator('.app-dialog').waitFor();
  if(kind==='error')await page.locator('[data-dialog-submit]').click();
  await scan('app-dialog/'+kind);
  await page.locator('[data-dialog-cancel]').click();
  await page.locator('.app-dialog').waitFor({state:'detached'});
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
