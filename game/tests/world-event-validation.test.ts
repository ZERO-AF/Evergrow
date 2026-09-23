import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshWorldEvents, validWorldEvents } from '../src/world-event-state.ts';

// Regression: checkWorldEvents iterated [active, ...history] and rejected on a
// null active — every save with no live invasion (the common case) failed
// validation and reset the schedule + war chests on load.
test('fresh world events (null active) round-trip validates', () => {
  const rt = JSON.parse(JSON.stringify(freshWorldEvents()));
  assert.equal(validWorldEvents(rt), true);
});
