/** Route water coverage audit (wayfinder world-t13): samples every ship/turtle
 * route polyline and reports the share of samples over water — i.e. outside any
 * authored zone rect (zoneAt → null). Sea lanes should keep ≥90% of each route
 * over water; the residual is the short dock→anchorage shore hop.
 *
 * Run: node --experimental-strip-types scripts/route-water-coverage.ts */
import { TRANSPORTS, zoneAt } from '../src/world-atlas.ts';
import { transportRoute } from '../src/transport-content.ts';

const SAMPLES_PER_ROUTE = 2000;
const MIN_COVERAGE = 0.9;

let failed = false;
for (const t of TRANSPORTS) {
  if (t.kind !== 'ship' && t.kind !== 'turtle') continue;
  const route = transportRoute(t.id);
  if (!route) { console.log(`${t.id}: UNRESOLVED`); failed = true; continue; }
  let over = 0;
  for (let i = 0; i < SAMPLES_PER_ROUTE; i++) {
    const distance = (i + 0.5) / SAMPLES_PER_ROUTE * route.length;
    // Walk the polyline without importing the runtime helper.
    let remaining = distance, x = 0, y = 0;
    for (let s = 0; s + 1 < route.points.length; s++) {
      const a = route.points[s], b = route.points[s + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (remaining <= seg || s + 2 === route.points.length) {
        const k = seg > 0 ? Math.min(1, remaining / seg) : 0;
        x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k;
        break;
      }
      remaining -= seg;
    }
    if (!zoneAt(x, y)) over++;
  }
  const coverage = over / SAMPLES_PER_ROUTE;
  const ok = coverage >= MIN_COVERAGE;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.id}: ${(coverage * 100).toFixed(1)}% over water (${route.points.length} pts, ${Math.round(route.length)}u)`);
}
process.exit(failed ? 1 : 0);
