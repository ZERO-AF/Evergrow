import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/fallback.html');
await p.screenshot({ path: 'iconreview-tmp/fallback.png', fullPage: true });
await b.close();
console.log('done');
