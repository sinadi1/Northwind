/**
 * End-to-end tests (Playwright). Start the site first, then run:
 *   npm start            (serves http://localhost:8080)
 *   npm install && npx playwright install chromium
 *   npm test
 * The FakeStoreAPI is mocked so tests are fast and deterministic.
 * Set BASE_URL to test a deployed site, e.g. BASE_URL=https://my-site.netlify.app/ npm test
 */
const { chromium } = require('playwright');
const path=require('path');
const B=process.env.BASE_URL||'http://localhost:8080/';
const S=path.join(__dirname,'..','docs','screenshots')+path.sep;
const P=[{id:1,title:"Backpack Pro",price:109.95,description:"Laptop bag",category:"men's clothing",image:"https://fakestoreapi.com/i/1.jpg",rating:{rate:3.9,count:120}},{id:2,title:"Rain Jacket",price:39.99,description:"Waterproof",category:"women's clothing",image:"https://fakestoreapi.com/i/2.jpg",rating:{rate:4.7,count:130}}];
let fails=0; const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+': '+m); if(!c)fails++;};
const titles=pg=>pg.$$eval('#task-list .task-title',e=>e.map(x=>x.textContent));
async function mock(pg){
  await pg.route('https://fakestoreapi.com/i/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'}));
  await pg.route('https://fakestoreapi.com/products/categories',r=>r.fulfill({json:["men's clothing","women's clothing"]}));
  await pg.route('https://fakestoreapi.com/products',r=>r.fulfill({json:P}));
}
async function signIn(pg,email,pw,next=''){await pg.goto(B+'login.html'+next);await pg.fill('#login-email',email);await pg.fill('#login-password',pw);await pg.click('#login-form button[type=submit]');}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:800}}); const pg=await ctx.newPage(); await mock(pg);
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{if(m.type()==='error'&&!/net::ERR|Failed to load resource/.test(m.text()))errs.push(m.text())});
  // --- guard
  for (const p of ['index.html','tasks.html','products.html']) { await pg.goto(B+p); await pg.waitForURL(/login\.html/); ok(pg.url().includes('next='+p),`guard redirects signed-out ${p} -> login?next=${p}`); }
  await pg.goto(B+'login.html?next=https://evil.example/x'); await pg.fill('#login-email','demo@northwind.test'); await pg.fill('#login-password','Demo-Pass-2026'); await pg.click('#login-form button[type=submit]');
  await pg.waitForURL(/index\.html/); ok(new URL(pg.url()).origin===B.slice(0,-1),'open-redirect blocked (next=https://evil... ignored)');
  await pg.click('#logout-button'); await pg.waitForURL(/login\.html/); ok(true,'logout returns to login');
  ok(await pg.evaluate(()=>localStorage.getItem('northwind:session')===null),'session cleared on logout');
  // --- wrong password + lockout
  await signIn(pg,'demo@northwind.test','wrong-password-1'); await pg.waitForSelector('#auth-banner .banner');
  ok((await pg.textContent('#auth-banner')).includes('Incorrect email or password'),'wrong password -> friendly error');
  for(let i=0;i<4;i++){ await pg.fill('#login-password','wrong-password-'+i); await pg.click('#login-form button[type=submit]'); await pg.waitForTimeout(500);} 
  await pg.fill('#login-password','Demo-Pass-2026'); await pg.click('#login-form button[type=submit]'); await pg.waitForTimeout(600);
  ok((await pg.textContent('#auth-banner')).includes('Too many failed attempts'),'5 failures -> account temporarily locked (even correct password refused)');
  await pg.evaluate(()=>{const a=JSON.parse(localStorage.getItem('northwind:attempts'));for(const k in a)a[k].until=0;localStorage.setItem('northwind:attempts',JSON.stringify(a));});
  // --- demo login + dashboard
  await pg.click('#fill-demo'); await pg.click('#login-form button[type=submit]'); await pg.waitForURL(/index\.html/);
  ok((await pg.textContent('#user-name')).includes('Demo User'),'header shows signed-in user');
  ok((await pg.textContent('#kpi-total'))==='5','dashboard KPI total = 5 sample tasks');
  await pg.screenshot({path:S+'dashboard-1280px.png',fullPage:true});
  // --- tasks CRUD
  await pg.goto(B+'tasks.html'); await pg.waitForSelector('#task-list .task-title');
  ok((await titles(pg)).length===5,'5 seeded tasks listed');
  await pg.click('#new-task-button'); await pg.click('#task-submit');
  ok((await pg.textContent('#task-title-error')).includes('required'),'create: empty title blocked with message');
  await pg.fill('#task-title','Ship capstone'); await pg.fill('#task-description','Deploy to Netlify'); await pg.check('#priority-high'); await pg.fill('#task-due','2030-01-01'); await pg.click('#task-submit');
  ok((await titles(pg)).includes('Ship capstone'),'CREATE: new task appears');
  ok(await pg.evaluate(()=>document.activeElement.id)==='new-task-button','focus returns to "New task" after dialog closes');
  await pg.fill('#task-search','capstone'); await pg.waitForTimeout(350);
  ok(JSON.stringify(await titles(pg))==='["Ship capstone"]','READ: search filters live');
  await pg.click('#task-list button:has-text("Edit")'); await pg.fill('#task-title','Ship capstone v2'); await pg.selectOption('#task-status','in-progress'); await pg.click('#task-submit');
  ok((await titles(pg))[0]==='Ship capstone v2','UPDATE: title edited');
  await pg.fill('#task-search',''); await pg.waitForTimeout(350);
  await pg.click('#status-tabs button:has-text("In progress")');
  ok((await titles(pg)).includes('Ship capstone v2'),'status tab filters (In progress)');
  await pg.click('#status-tabs button:has-text("All")');
  await pg.screenshot({path:S+'tasks-1280px.png',fullPage:true});
  await pg.reload(); await pg.waitForSelector('#task-list .task-title');
  ok((await titles(pg)).includes('Ship capstone v2'),'PERSIST: task survives reload');
  await pg.fill('#task-search','v2'); await pg.waitForTimeout(350);
  await pg.click('#task-list button:has-text("Delete")'); await pg.click('#confirm-delete');
  await pg.fill('#task-search',''); await pg.waitForTimeout(350);
  ok(!(await titles(pg)).includes('Ship capstone v2')&&(await titles(pg)).length===5,'DELETE: removed after confirm');
  // --- store + per-user cart
  await pg.goto(B+'products.html'); await pg.waitForSelector('#product-grid .product-title');
  await pg.click('#product-grid li:nth-child(1) .btn'); ok((await pg.textContent('#cart-heading')).includes('(1)'),'store: add to cart (signed in)');
  await pg.goto(B+'index.html'); ok((await pg.textContent('#kpi-cart'))==='1','dashboard cart KPI reflects cart');
  await pg.click('#logout-button'); await pg.waitForURL(/login\.html/);
  // --- register new user; isolation
  await pg.goto(B+'register.html'); await pg.fill('#reg-name','Asha Verma'); await pg.fill('#reg-email','asha@example.com'); await pg.fill('#reg-password','Sunrise-Garden-42'); await pg.fill('#reg-confirm','Sunrise-Garden-41'); await pg.click('#register-form button[type=submit]');
  ok((await pg.textContent('#reg-confirm-error')).length>0 || (await pg.textContent('#auth-banner')).length>0,'register: mismatched confirm password rejected');
  await pg.fill('#reg-confirm','Sunrise-Garden-42'); await pg.click('#register-form button[type=submit]'); await pg.waitForURL(/index\.html/);
  ok((await pg.textContent('#user-name')).includes('Asha'),'register: new account signed in');
  ok((await pg.textContent('#kpi-total'))==='0'&&(await pg.textContent('#kpi-cart'))==='0','isolation: new user has no tasks and empty cart');
  ok(await pg.evaluate(()=>{const u=JSON.parse(localStorage.getItem('northwind:users')).find(x=>x.email==='asha@example.com');return !JSON.stringify(u).includes('Sunrise')&&u.hash&&u.salt;}),'password stored only as salted hash');
  await pg.click('#logout-button'); await pg.waitForURL(/login\.html/);
  await pg.goto(B+'register.html'); await pg.fill('#reg-name','Dup'); await pg.fill('#reg-email','ASHA@example.com'); await pg.fill('#reg-password','Sunrise-Garden-42'); await pg.fill('#reg-confirm','Sunrise-Garden-42'); await pg.click('#register-form button[type=submit]'); await pg.waitForSelector('#auth-banner .banner');
  ok((await pg.textContent('#auth-banner')).includes('already exists'),'register: duplicate email (case-insensitive) rejected');
  await signIn(pg,'asha@example.com','Sunrise-Garden-42'); await pg.waitForURL(/index\.html/); ok(true,'re-login with registered account works');
  // --- logged-in user visiting login is redirected
  await pg.goto(B+'login.html'); await pg.waitForURL(/index\.html/); ok(true,'signed-in user visiting login is redirected to app');
  // --- expired session
  await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('northwind:session'));s.expires=Date.now()-1;localStorage.setItem('northwind:session',JSON.stringify(s));});
  await pg.goto(B+'tasks.html'); await pg.waitForURL(/login\.html/); ok(true,'expired session -> redirected to login');
  ok(errs.length===0,'no JS errors ('+errs.join(' | ')+')');
  await ctx.close();
  // --- responsive overflow, signed in, 4 widths x pages, both themes
  let bad=0;
  for(const theme of ['light','dark']) for(const w of [320,768,1024,1440]){
    const c=await b.newContext({viewport:{width:w,height:800},colorScheme:theme}); const p=await c.newPage(); await mock(p);
    await signIn(p,'demo@northwind.test','Demo-Pass-2026'); await p.waitForURL(/index\.html/);
    for(const pageName of ['index','tasks','products','accessibility','login','register']){
      if(pageName==='login'||pageName==='register'){await p.evaluate(()=>localStorage.removeItem('northwind:session'));}
      await p.goto(B+pageName+'.html'); await p.waitForTimeout(150);
      const r=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
      if(r[0]>r[1]){bad++;console.log('OVERFLOW',theme,w,pageName,r);}
      if(theme==='light'&&w===320&&pageName==='tasks'){await p.screenshot({path:S+'tasks-320px.png',fullPage:true});}
      if(pageName==='login'&&w===768&&theme==='light') await p.screenshot({path:S+'login-768px.png',fullPage:true});
      if(pageName==='login'){await signIn(p,'demo@northwind.test','Demo-Pass-2026');await p.waitForURL(/index\.html/);} 
    }
    await c.close();
  }
  ok(bad===0,'no horizontal overflow: 6 pages x 4 widths x 2 themes');
  console.log(fails?fails+' FAILURES':'ALL TESTS PASSED'); await b.close();
})();
