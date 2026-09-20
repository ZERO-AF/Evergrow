# WoW (WotLK) transformation — design contract

2026-09-18 · local prototype pass. This document is the binding contract for the
WoW-ification: tab-targeting combat, ten WotLK classes, ten races, class skill
kits, WoW-style effects, WoW character creation, WoW-flavored gear. The free
talent atlas stays and gains class-gated clusters.

Reference data extracted from `world-of-claudecraft` lives in `.wow-ref/`
(woc-classes.json, woc-talents.json). Ability names use real WoW names per the
user's explicit request (private prototype).

## 1. Classes

`WowClassId` = warrior | paladin | hunter | rogue | priest | deathKnight |
shaman | mage | warlock | druid. WoW class colors:

| Class | Color | Resource | Secondary | Armor | Weapons |
| --- | --- | --- | --- | --- | --- |
| Warrior | #C79C6E | rage 0–100 | — | plate | all melee, bows |
| Paladin | #F58CBA | mana | — | plate | sword/axe/mace + shield |
| Hunter | #ABD473 | mana (WotLK) | pet | leather | bow + melee |
| Rogue | #FFF569 | energy 100 | combo points | leather | dagger/sword/axe/mace |
| Priest | #FFFFFF | mana | — | cloth | wand/staff/mace |
| Death Knight | #C41F3B | runic power 0–100 | 6 runes | plate | all melee |
| Shaman | #0070DE | mana | totems | leather | axe/mace/staff + shield |
| Mage | #69CCF0 | mana | — | cloth | staff/wand/dagger/sword |
| Warlock | #9482C9 | mana | demon pet, soul shards | cloth | staff/wand/dagger/sword |
| Druid | #FF7D0A | mana | forms (bear→rage, cat→energy+combo) | leather | staff/mace/dagger |

Resources ride the existing `Player.mana`/`maxMana` fields; `resourceType` on
the class decides semantics and HUD presentation:

- **rage**: starts 0, +gain on dealing/taking hits, decays 3/s after 8s out of
  combat, cap 100. Costs read as rage.
- **energy**: cap 100, regenerates 10/s always (replaces mana regen).
- **focus**: unused (hunger stays mana per WotLK).
- **runicPower**: starts 0, +10 per rune spent, decays 3/s out of combat.
- **mana**: current behavior (base 1/s + regen modifiers).
- **comboPoints** (rogue/cat): `player.comboPoints` 0–5 + `comboTargetId`;
  builders add, finishers spend and scale, target switch/death resets.
- **runes** (DK): `player.runes` = {blood:[readyAt×2], frost:[×2], unholy:[×2]};
  spend marks `readyAt = time + 10s`; rune-cost skills check availability;
  each rune spent grants 10 runic power. Transient; full on load.
- **soulShards** (warlock): `player.soulShards` 0–4, +1 per kill, spent by
  demon summons and Soulburn-empowered casts. Transient; 3 on load.

## 2. Races

`WowRaceId` = human | dwarf | nightElf | gnome | draenei | orc | undead |
tauren | troll | bloodElf. Each grants one active racial skill (R key, own
slot, not one of the five) plus passive `StatModifiers` applied in
`characterModifierSources`. Class availability (DK = all races):

| Race | Classes | Racial active | Passives |
| --- | --- | --- | --- |
| Human | war pal rog pri dk mage lock | Every Man for Himself (break control, 2min) | +3% spirit→manaRegen, +5% XP |
| Dwarf | war pal hun rog pri dk | Stoneform (armor+bleed/poison cleanse, 2min) | +5 frost res, +3% crit dmg |
| Night Elf | war hun rog pri dk mage dru | Shadowmeld (stealth 6s, 2min) | +2% dodge→moveSpeed, +3 nature res |
| Gnome | war rog pri dk mage lock | Escape Artist (break root/slow, 1.75min) | +5% int, +3 arcane res |
| Draenei | war pal hun pri dk sha mage | Gift of the Naaru (HoT 20% hp, 3min) | +5 shadow res, +1% hit→crit |
| Orc | war hun rog dk sha lock | Blood Fury (+15% damage 15s, 2min) | +5% pet damage, -10% stun duration |
| Undead | war rog pri dk mage lock | Will of the Forsaken (break fear/control, 2min) | +5 shadow res, cannibalize on kill +2% hp |
| Tauren | war hun dk sha dru | War Stomp (AoE stun 1.5s, 2min) | +5% max hp, +3 nature res |
| Troll | war hun rog pri sha mage dru dk | Berserking (+20% haste 10s, 3min) | +5% damage vs beasts→xp, +10% regen in combat |
| Blood Elf | pal hun rog pri dk mage | Arcane Torrent (AoE silence +15 mana, 2min) | +5 arcane res, +2% crit |

## 3. Combat model

**Tab targeting.** `Input.targetId?: number|null` + `Input.cycleTarget?: 1|-1`.
`player.targetId` persists on the sim. Tab cycles on-screen enemies
(`enemyInCombatViewport`; headless fallback: 700u + LOS) sorted by angular
distance from facing then distance — deterministic inside the sim. Click on an
enemy sets target (renderer hover id → Input.targetId). Target clears on
death, restore/reset/revive, or 60u+ out of range for ranged classes? No —
WoW keeps target; only death/clear drops it. `p.angle` faces the target while
auto-attacking or casting a targeted skill; otherwise cursor aim rules.

**Auto-attack.** `player.autoAttack: boolean`. Toggled on by: LMB attack
press with a valid target, any offensive skill landing, or tab+attack. Off
by: pressing attack with no target, ESC, target death. While on and target is
valid + within weapon reach + LOS → `startAttack` fires when ready (replaces
held-LMB repeat; held LMB still works as before for point attacks).

**GCD.** `player.gcd` set to 1.5s (rogue/cat 1.0s) on every skill activation;
`offGcd` skills (stances/forms/racials flagged) skip it. Checked in
activateSkill and added to skillBuffer recovery. Basic attacks unaffected.

**Casted spells.** `SkillDefinition.castTime` (0 = instant as today).
`player.casting: {skill, elapsed, duration, targetId, x, y} | null`. During a
cast movement runs at 45% speed, dodge cancels, cast bar UI shows progress.
On completion the recipe executes against the snapshotted target/point.
Channeled skills (`channel:{duration,ticks}`) occupy the same slot, tick per
interval, movement allowed at 45%.

**Skill targeting modes.** `SkillDefinition.targetMode`:
'enemy' (needs live target in range), 'point' (cursor, current behavior),
'self' (instant self), 'enemyOrPoint' (target if present else cursor).
Melee 'enemy' skills fail with an out-of-range cue beyond reach.

**Execute/conditional gates.** `executeThreshold` (hp fraction), `requiresStealth`,
`requiresForm`, `requiresCombo`, `requiresBehind` checked in activateSkill.

**Crowd control on enemies** (new `Enemy` fields, ticked in combat-status):
- `rootTime` — cannot move, may still attack.
- `fearTime` — wanders away, cannot attack; does NOT break on damage.
- `incapacitateTime` — cannot act; breaks on any damage.
- `polymorphTime` — incapacitate + cannot attack + regenerates; breaks on damage.
- `silenceTime` — cannot start windup for projectile/ground attacks.
All respect existing rank control scaling. Stun/freeze/stagger unchanged.

**DoTs.** `Enemy.burn*` migrates into `enemy.dots: ActiveDot[]`
{school: DamageType|'bleed'|'poison', dps, remaining, tick, name, icon}.
Non-stacking per dot id (strongest/longest wins, same rule as burn).
Burn becomes a fire dot; status-art/enemy-debuffs read `dots`.

**Player buffs.** `player.buffs: ActiveBuffState[]` {id, name, icon: SkillId,
stats: StatModifiers, remaining, absorb?, tickHeal?, exclusiveGroup?,
reflect?, imbue?, form?, stealth?}. Combat paths read a bounded stat set
(damage/spell %, speeds, armor, move, regen, crit, maxHp/Mana, attributes)
via `buffStats(player)`; absorbs join the ward slot in mitigateSkillHit;
exclusiveGroup replaces same-group buffs (aspects/seals/stances/forms).

**Allies (pets).** `sim.allies: Ally[]` (cap 6): {id, kind, x,y,vx,vy,hp,maxHp,
damage, attackSpeed, range, remaining?, targetId, name}. AI: follow player,
attack player's target or player's attacker, leash 70u. Enemy AI picks the
nearest hostile of {player, allies} via the existing `EnemyAIContext.target`
precedent. Allies grant no XP/loot, are not persisted (resummon on load),
and die to enemy attacks (damageAlly path). Hunter/warlock pets are
permanent until dismissed/dead; army/infernal/images are timed.

**Stealth.** `player.stealth: number` (remaining). Enemy sense treats a
stealthed player as invisible beyond 25u; dealing/taking damage or casting
breaks it. Vanish additionally drops enemy targets (awareness reset).

**Interrupts.** Interrupt skills apply stagger + `silenceTime` (4s).

**Pull.** Death Grip slides the enemy toward the player through `world.move`
substeps + alert.

**Taunt.** Forces `enemy.targetOverride = player` for its duration (matters
with pets); also small damage-taken debuff for solo relevance.

## 4. Skill kits (atlas clusters)

Each class gets a gated cluster in the atlas: ~10–14 actives + 2 passive
specialties, arranged as a compact ring/leaf pocket at origin-adjacent depth
(basics 2–6 pts, advanced 8–15, ultimates 23–33 — same economy). Nodes carry
`classId`; allocation/routes/unlock/validation reject foreign classes; the
atlas dims them with the class color. Existing 30 weapon skills + 7 auras
stay class-free. Racial skills unlock automatically (no node).

New `SkillDefinition` fields: `classId?`, `raceId?`, `resource?: 'rage'|
'energy'|'runicPower'|'mana'` (defaults by class), `runeCost?`, `combo?`
('build'|'spend'), `castTime`, `channel?`, `targetMode`, `offGcd`,
`executeThreshold`, `requiresStealth`, `requiresForm`, `requiresBehind`,
`givesRunicPower`, `shardCost`, `summon?`.

New `SkillExecution` kinds (handlers in skill-combat.ts):
`strike` (instant weapon hit w/ target), `dot` (apply DoT to target),
`heal` (instant/HoT self or target-ally→self), `buff` (player.buffs entry),
`cc` (root/fear/incap/poly/silence on target or radius), `interrupt`,
`pull`, `taunt`, `summon` (ally), `channel` (timed ticks), `form`
(druid shapeshift), `stealth`, `comboStrike` (builder/finisher),
`runeStrike` (rune-cost strike), `cleanse` (self dispel/heal hybrid).
Existing kinds unchanged; `projectile`/`ground`/`chain`/`radial`/`cone`/
`sweep`/`dash`/`backstab`/`step`/`ward`/`guard`/`stance` gain optional
`dot`, `cc`, `heal`, `buff` payload fields where needed.

### Class kits (WoW names, mapped to recipes)

- **Warrior** (rage): Heroic Strike(strike,onNextSwing→instant), Charge(dash+stun),
  Thunder Clap(radial+slow), Hamstring(strike+slow), Overpower(strike,after dodge→proc→cheap),
  Execute(strike,executeThreshold .2), Whirlwind(sweep), Pummel(interrupt),
  Sunder Armor(strike+sunder debuff), Battle Shout(buff), Berserker Rage(buff+rage),
  Shield Slam(strike,shield), Shield Block(guard), Revenge(strike,shield),
  Shield Wall(buff -60% dmg), Bladestorm(channel sweep, ultimate),
  Mortal Strike(strike+heal-reduce→wound), Bloodthirst(strike+selfheal), Slam(strike castTime).
- **Paladin**: Crusader Strike(strike), Judgement of Righteousness(projectile holy),
  Seal of Command(buff imbue), Consecration(ground holy), Hammer of Justice(cc stun),
  Holy Light(heal castTime), Flash of Light(heal fast), Divine Shield(buff immune→absorb+invuln),
  Divine Protection(guard), Lay on Hands(heal full, long cd), Avenging Wrath(buff +dmg),
  Hammer of Wrath(projectile, execute .2), Exorcism(projectile holy),
  Holy Shock(strike-or-heal), Repentance(cc incap), Blessing of Kings(buff stats).
- **Hunter**: Arcane Shot(projectile), Aimed Shot(projectile castTime),
  Multi-Shot(projectile offsets), Serpent Sting(dot nature), Concussive Shot(projectile+slow),
  Scatter Shot(projectile+incap), Freezing Trap(cc freeze ground→radial),
  Disengage(step retreat), Aspect of the Hawk(buff), Feign Death(stealth+drop),
  Call Pet/Revive Pet(summon beast), Kill Command(pet strike buff),
  Bestial Wrath(buff pet+self), Volley(ground arrowRain channel), Explosive Shot(projectile fire dot).
- **Rogue** (energy+combo): Sinister Strike(comboStrike build), Eviscerate(comboStrike spend),
  Backstab(comboStrike build, requiresBehind bonus), Ambush(comboStrike stealth),
  Garrote(comboStrike stealth+dot), Rupture(comboStrike spend→dot), Kidney Shot(comboStrike spend→stun),
  Slice and Dice(comboStrike spend→haste buff), Stealth(stealth), Vanish(stealth+drop aggro),
  Sap(cc incap stealth), Gouge(cc incap), Kick(interrupt), Sprint(buff move),
  Evasion(buff dodge→block), Blind(cc incap), Fan of Knives(radial daggers), Adrenaline Rush(buff energy).
- **Priest**: Smite(projectile holy), Shadow Word: Pain(dot shadow), Mind Blast(projectile shadow),
  Mind Flay(channel shadow+slow), Power Word: Shield(ward), Renew(hot), Flash Heal(heal fast),
  Heal(heal castTime), Psychic Scream(cc fear radial), Dispel Magic(cleanse→purge target buff→damage?),
  Shadowform(buff/form), Holy Nova(radial heal+damage), Prayer of Healing(big heal),
  Inner Fire(buff armor+sp), Fear Ward→skip, Mana Burn→skip, Shadow Word: Death(projectile execute-ish backlash).
- **Death Knight** (runes+runic): Icy Touch(strike frost, 1 frost rune), Plague Strike(strike+dot, 1 unholy),
  Blood Strike(strike, 1 blood), Death Strike(strike+heal, frost+unholy), Obliterate(strike big, frost+unholy),
  Scourge Strike(strike shadow, frost+unholy), Death Coil(projectile shadow, runic power),
  Death Grip(pull), Chains of Ice(cc root, frost), Mind Freeze(interrupt),
  Blood Boil(radial, blood), Death and Decay(ground, 3 runes), Frost Presence/Blood Presence/Unholy Presence(stance buffs),
  Icebound Fortitude(buff), Anti-Magic Shell(ward), Raise Dead(summon ghoul), Army of the Dead(summon ×4, ultimate),
  Strangulate(cc silence), Death Pact(sacrifice ghoul→heal).
- **Shaman**: Lightning Bolt(projectile nature castTime), Chain Lightning(chain),
  Earth Shock(strike+interrupt-ish→interrupt), Flame Shock(projectile fire+dot), Frost Shock(projectile frost+slow),
  Lava Burst(projectile fire, +crit vs flame-shocked→conditional), Stormstrike(strike×2, enhancement),
  Earth Shock, Wind Shear(interrupt), Healing Wave(heal castTime), Lesser Healing Wave(heal fast),
  Chain Heal(chain heal→self bounce? self+ally→self), Searing Totem(summon attacker),
  Healing Stream Totem(summon HoT aura), Earthbind Totem(summon slow aura), Grounding→skip,
  Ghost Wolf(buff move form), Bloodlust(buff haste ultimate), Shamanistic Rage(buff mana),
  Feral Spirit(summon ×2 wolves), Thunderstorm(radial knockback→stagger+mana).
- **Mage**: Fireball(projectile fire castTime), Frostbolt(projectile frost+slow castTime),
  Pyroblast(projectile big castTime+dot), Fire Blast(projectile instant), Scorch(projectile fast),
  Arcane Missiles(channel), Arcane Explosion(radial), Frost Nova(cc root radial),
  Ice Lance(projectile, ×3 vs frozen→conditional), Cone of Cold(cone frost+slow),
  Blizzard(ground frost channel), Blink(step), Polymorph(cc poly), Counterspell(interrupt),
  Ice Block(buff immune), Ice Barrier(ward), Mana Shield(ward mana), Evocation(channel mana),
  Mirror Image(summon ×3), Combustion(buff crit), Icy Veins(buff haste), Arcane Power(buff),
  Dragon's Breath(cone fire+incap), Living Bomb(dot+explode), Deep Freeze(cc stun vs frozen).
- **Warlock**: Shadow Bolt(projectile shadow castTime), Immolate(projectile fire+dot),
  Corruption(dot shadow instant), Curse of Agony(dot ramping), Unstable Affliction(dot+silence on dispel→dot),
  Drain Life(channel shadow+heal), Drain Soul(channel execute), Searing Pain(projectile fire),
  Shadowburn(projectile instant), Chaos Bolt(projectile big), Conflagrate(strike consumes immolate→burst),
  Fear(cc fear), Howl of Terror(cc fear radial), Death Coil→(warlock: projectile+horrify+heal),
  Life Tap(buff→resource swap hp→mana), Demon Armor(buff), Fel Armor(buff),
  Summon Imp/Felhunter/Felguard(summon demon), Soul Link(buff share dmg), Metamorphosis(form buff ultimate),
  Seed of Corruption(dot→explode), Rain of Fire(ground fire), Hellfire(radial channel self-harm→skip),
  Shadowfury(cc stun ground), Soulstone→skip, Banish→skip.
- **Druid**: Wrath(projectile nature castTime), Starfire(projectile arcane big castTime),
  Moonfire(projectile arcane+dot), Insect Swarm(dot nature), Entangling Roots(cc root),
  Hurricane(ground nature channel), Starfall(ground arcane ultimate), Healing Touch(heal big castTime),
  Regrowth(heal+hot), Rejuvenation(hot), Swiftmend(heal consumes hot→instant),
  Lifebloom(hot stacked→hot), Wild Growth(hot radial), Barkskin(buff),
  Bear Form(form→rage), Cat Form(form→energy+combo+stealth-capable), Moonkin Form(form→armor+spell),
  Travel Form(form move), Maul(strike bear), Swipe(radial bear), Bash(cc stun bear),
  Feral Charge(dash bear), Mangle(strike bear+bleed), Claw(comboStrike cat), Rake(comboStrike cat+dot),
  Rip(comboStrike spend dot cat), Ferocious Bite(comboStrike spend cat), Prowl(stealth cat),
  Pounce(cc stun cat stealth), Dash(buff move cat), Faerie Fire(debuff sunder), Innervate(buff mana), Rebirth→skip.

Racial actives are `raceId`-gated skills with `offGcd`, auto-known (no node).

## 5. Character creation & save

`CharacterSheet` gains `classId: WowClassId`, `raceId: WowRaceId`.
`CHARACTER_SAVE_VERSION` → 5. v4→v5 migration: raceId='human', classId
inferred from equipped weapon (bow→hunter, staff→mage, wand→priest,
dagger→rogue, shield→paladin, 2H melee→warrior). `createCharacterSheet`
takes (classId, raceId) and builds the class's starter gear via a per-class
`CLASS_STARTERS` table (weapon+offhand+armor look). Title screen becomes a
WoW-style creation: left column race (with class-colored availability),
right column class (icon, color, description), center live portrait in
starter gear, name + seed. Slot cards show class color + race + level.

## 6. HUD & presentation

- Target frame (top-center, extends enemy-plate): portrait-less WoW-style
  plate — name, level, rank crest, class-colored hp bar, cast bar (enemy
  windup progress), debuff strip (existing enemyDebuffs + new dots/CC).
- Player frame (top-left WoW-style): hp/resource bars, class color, buff
  strip (existing BuffBar + new buffs), combo points, runes (DK), shards.
- Cast bar above the action bar during `player.casting`.
- GCD sweep on skill icons (reuse cooldown sweep).
- Resource orb restyle: right orb shows resource type color (rage red,
  energy yellow, runic blue, mana blue) + label; DK rune row under it.
- Action bar: 5 skill slots + LMB + R racial + Q potion + Space dodge.
- Class colors in ui-theme (`--ui-class-*`), skill icons get class-tinted
  glass themes; new school colors holy(#ffd76e)/shadow(#8a6fb8)/nature(#7fd06a).
- `DamageType`/`ProjectileStyle` += 'holy' | 'shadow' | 'nature'; bleed/poison
  are physical/nature dots without new projectile styles.
- Status art: bleed (drips), poison (green motes), shadow (violet wisps),
  holy (gold seal), polymorph (critter blob), fear (panic lines), root
  (ground grasp), silence (muted glyph), stealth (translucent player).

## 7. Gear

- `Item.classId?` restriction field (optional; relics + tier pieces).
- New offhand kind `relic` (totem/libram/idol/sigil) usable by
  sha/pal/dru/dk — grants `skill:*` bonuses.
- Weapon families += 'fist' | 'polearm' | 'gun' (profiles reuse melee/bow
  machinery; fist=dagger-fast, polearm=2H reach, gun=bow).
- WoW naming: tier-flavored base names per armor style, legendary/unique
  names (Thunderfury, Sulfuras, Warglaive, Atiesh…) as `unique-content`
  entries with class flavor. Item sets: skip (out of scope v1).

## 8. File ownership (implementation waves)

Wave 1 (parallel):
- **Model/Status**: model.ts, combat-status.ts, ground-effects.ts,
  player-skill-effects.ts, enemy-state.ts — new fields, dots, CC, buffs.
- **Skill engine**: skill-content.ts, skill-execution-content.ts,
  skill-combat.ts, skill-progression.ts, skill-target-point.ts — schema +
  handlers + resolveSkill resources.
- **Sim/AI**: simulation.ts, enemy-ai.ts, combat-damage.ts, game-input.ts,
  ranged-aim.ts, combat-visibility.ts — targeting, auto-attack, GCD,
  resources, allies, stealth, enemy CC behavior.
- **Tree**: skill-tree.ts, skill-tree-content.ts, skill-tree-routes.ts,
  skill-tree-upgrade.ts, character.ts, character-commands.ts — class
  clusters + gating.
- **Save/Items**: character-types.ts, character-save.ts, items.ts,
  inventory.ts, character-session.ts, save-bundle.ts, character-stats.ts,
  character-stat-details.ts — schema v5, starters, class validation.
- **Content data**: wow-classes.ts, wow-races.ts, wow-skills.ts (authored
  by lead — contract), class starter gear.

Wave 2 (parallel): title/creation UI, HUD/frames/castbar, icons/theme,
status/spell art, input wiring (game.ts/game-keyboard/control-bindings/
ui-hit-test/touch/gamepad), gear naming/relics/uniques.

Wave 3: integration, tests, critique agents (code/balance/visual 1–10),
docs, `npm run check`.

## 9. Invariants carried forward

Deterministic 120Hz sim; one contact owner (combat-damage); exactly-once
rewards; payload snapshots; headless core (no DOM in sim/model/content);
acyclic imports; bounded effects; native-res UI after postfx; fixed CRT;
5 assignable slots + LMB + R racial + Q + Space; assignments persist
through gear swaps; invalid saves preserved never overwritten; resolveSkill
shared by combat+UI; execution recipes are content (no skill-name branches
in handlers — new mechanics go through recipe fields).
