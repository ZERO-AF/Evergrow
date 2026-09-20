import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/icons.html');
await p.screenshot({ path: 'iconreview-tmp/icons.png', fullPage: true });
await b.close();
console.log('done');
