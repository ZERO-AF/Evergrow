import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 360 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/ally.html');
await p.waitForTimeout(300);
await p.locator('#c').screenshot({ path: 'iconreview-tmp/allies.png' });
await b.close();
console.log('done');
