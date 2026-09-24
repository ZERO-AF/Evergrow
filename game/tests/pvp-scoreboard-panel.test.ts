import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { PvpMatch } from '../src/pvp-instance.ts';
import type { PvpScoreboard, PvpScoreRow } from '../src/pvp-scoreboard.ts';

// Panel imports its .css for the bundler; strip it for the headless test.
const assets = registerHooks({ load(url, context, next) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return next(url, context);
} });
// Dynamic import is required: the .css stub hook must be registered before the
// panel module loads (same pattern as navigation-ui-regressions.test.ts).
const { PvpScoreboardPanel } = await import('../src/pvp-scoreboard-panel.ts');
assets.deregister();

/** Minimal element surface: the panel sets className/hidden/innerHTML and
 * appends itself to the mount. */
class ElementStub extends EventTarget {
    hidden = false;
    className = '';
    innerHTML = '';
    append() {}
    remove() {}
    setAttribute() {}
}

function setup(t: test.TestContext) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const doc = { createElement: () => new ElementStub() };
    Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
    t.after(() => {
        if (original) Object.defineProperty(globalThis, 'document', original);
        else Reflect.deleteProperty(globalThis, 'document');
    });
    const mount = new ElementStub();
    const panel = new PvpScoreboardPanel(mount as unknown as HTMLElement, { leave() {} });
    return { panel, element: panel.element as unknown as ElementStub };
}

const match = (mode: 'arena' | 'battleground'): PvpMatch => ({
    mode, bracket: '2v2', mapId: 'arena-nagrand', phase: 'live', score: { A: 1, B: 0 }, roster: [],
}) as unknown as PvpMatch;

const row = (over: Partial<PvpScoreRow>): PvpScoreRow => ({
    name: 'Custom', team: 'A', classId: 'warrior', role: 'dd',
    isPlayer: false, kills: 0, deaths: 0, damageDone: 0, healingDone: 0,
    damageTaken: 0, objectives: 0, alive: true, ...over,
});

const board = (rows: PvpScoreRow[]): PvpScoreboard => ({ rows, kills: { A: 0, B: 0 } });

test('arena scoreboard renders WotLK columns with class-colored names and a highlighted player row', t => {
    const { panel, element } = setup(t);
    panel.open(match('arena'), board([
        row({ name: 'Custom', isPlayer: true, kills: 2, damageDone: 1854 }),
        row({ name: 'Ally', classId: 'priest', role: 'heal', healingDone: 900 }),
        row({ name: 'Foe', team: 'B', classId: 'mage', deaths: 1, alive: false }),
    ]));
    const html = element.innerHTML;
    // WotLK column headers; no Objectives column in arenas.
    for (const col of ['Name', 'Killing Blows', 'Deaths', 'Damage Done', 'Healing Done'])
        assert.ok(html.includes(`>${col}<`), `missing column ${col}`);
    assert.ok(!html.includes('>Objectives<'), 'arena hides the objectives column');
    // Class-colored name (warrior #C79C6E, mage #69CCF0) and the player highlight.
    assert.ok(html.includes('<strong style="color:#C79C6E">Custom</strong>'));
    assert.ok(html.includes('<strong style="color:#69CCF0">Foe</strong>'));
    assert.ok(html.includes('pvp-score-row is-player'));
    assert.ok(html.includes('pvp-score-row is-dead'), 'dead rows dim');
    // Team bands tinted ally/enemy.
    assert.ok(html.includes('pvp-score-team is-ally'));
    assert.ok(html.includes('pvp-score-team is-enemy'));
    panel.dispose();
});

test('battleground scoreboard adds the objectives column', t => {
    const { panel, element } = setup(t);
    panel.open(match('battleground'), board([row({ objectives: 2 })]));
    assert.ok(element.innerHTML.includes('>Objectives<'));
    assert.ok(element.innerHTML.includes('has-obj'));
    panel.dispose();
});

test('end-of-match board shows the victory banner, rewards and leave button', t => {
    const { panel, element } = setup(t);
    panel.open(match('arena'), board([row({})]), {
        winner: 'A', exitAt: performance.now() + 15000,
        rewards: { honor: 320, arenaPoints: 180, reputation: 0 },
    });
    const html = element.innerHTML;
    assert.ok(html.includes('Victory!'));
    assert.ok(html.includes('is-victory'));
    assert.ok(html.includes('320 Honor'));
    assert.ok(html.includes('180 Arena Points'));
    assert.ok(html.includes('data-pvp-leave'));
    panel.dispose();
});
