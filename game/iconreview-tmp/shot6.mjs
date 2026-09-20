import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/stable.html');
await p.waitForTimeout(200);
await p.screenshot({ path: 'iconreview-tmp/stable.png' });
await b.close();
console.log('done');
