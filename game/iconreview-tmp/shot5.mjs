import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1060, height: 410 } });
await p.goto('file:///' + process.cwd().replace(/\\/g,'/') + '/iconreview-tmp/school.html');
await p.waitForTimeout(300);
await p.locator('#c').screenshot({ path: 'iconreview-tmp/schools.png' });
await b.close();
console.log('done');
