import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2400, height: 580 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/atlas.html');
await p.waitForTimeout(400);
await p.locator('#c').screenshot({ path: 'iconreview-tmp/sanctums.png' });
await b.close();
console.log('done');
