/** PvP match announcements (wayfinder T08): WoW-style callouts — the match-start
 * horn and "Fight!", first blood, killing sprees, flag pickups/captures, node
 * assaults and the victory/defeat banner.
 *
 * Headless and deterministic: the match loop (pvp-match.ts) owns one announcer
 * per match, feeds it scoreboard snapshots and objective events, and the game
 * layer drains `PvpAnnouncement`s to chat, the center-screen flash and audio
 * cues. Nothing here touches the DOM. */
import type { CombatLogKind } from './combat-log.ts';
import type { Combatant, PvpTeam } from './pvp-combatant.ts';
import type { PvpMatch, PvpObjectiveEvent } from './pvp-instance.ts';
import type { PvpScoreboard } from './pvp-scoreboard.ts';
import { pvpMap } from './pvp-floor.ts';
import './arena-maps.ts';
import './bg-maps.ts';

/** Audio stinger names; audio.ts owns the synthesis. */
export type PvpCue = 'horn' | 'fight' | 'firstBlood' | 'spree' | 'objective' | 'warning' | 'victory' | 'defeat';

/** One callout: chat line plus an optional center-screen flash and audio cue. */
export interface PvpAnnouncement {
    readonly text: string;
    readonly chat?: CombatLogKind;
    /** Center-screen flash: ability-sized headline + smaller advice line. */
    readonly flash?: { title: string; subtitle?: string; color: string };
    readonly cue?: PvpCue;
}

const GOLD = '#e8c15a';
const ALLY = '#8fd18a';
const ENEMY = '#f34e60';
const IVORY = '#e3ddc4';


const side = (team: PvpTeam): string => team === 'A' ? 'Your team' : 'The enemy';
const mapName = (match: PvpMatch): string => pvpMap(match.mapId)?.name ?? match.mapId;

/** Killing-spree thresholds → callout label (WoW's spree/rampage/dominating). */
const SPREES: readonly [number, string][] = [[7, 'is Dominating'], [5, 'is on a Rampage'], [3, 'is on a Killing Spree']];

/**
 * Per-match announcer. `update` diffs consecutive scoreboard snapshots (fresh
 * kills, deaths, spree counts) and maps controller objective events to callouts.
 * Announcements queue until `drain` — the game layer presents them.
 */
export class PvpAnnouncer {
    private readonly queue: PvpAnnouncement[] = [];
    private phase: PvpMatch['phase'] | undefined;
    private firstBlood = false;
    /** Roster display names by combatant (spec identities differ from roster names). */
    private names = new Map<Combatant, string>();
    private readonly kills = new Map<number, number>();
    private readonly deaths = new Map<number, number>();
    /** Consecutive kills without dying, per combatant (keyed by roster name). */
    private readonly spree = new Map<number, number>();
    private readonly spreeTier = new Map<number, number>();

    /** Pull every queued callout. */
    drain(): PvpAnnouncement[] { return this.queue.splice(0); }

    private say(announcement: PvpAnnouncement): void { this.queue.push(announcement); }

    /** Direct callout for match-loop beats that aren't kills or objective
     * events: the countdown, time warnings, sudden death. */
    announce(announcement: PvpAnnouncement): void { this.say(announcement); }

    /** Roster names for callouts — combatant actors carry spec identities. */
    bind(roster: readonly Combatant[], match: PvpMatch): void {
        this.names = new Map(roster.map((c, i) => [c, match.roster[i]?.name ?? c.name ?? 'Combatant']));
    }

    private nameOf(combatant: Combatant | undefined): string {
        return combatant ? this.names.get(combatant) ?? combatant.name ?? 'Someone' : 'Someone';
    }

    /** One match tick: phase transitions, kill diff, then objective events. */
    update(match: PvpMatch, board: PvpScoreboard, events: readonly PvpObjectiveEvent[]): void {
        if (match.phase !== this.phase) {
            const entered = match.phase;
            this.phase = entered;
            if (entered === 'prep') {
                this.say({ text: `${mapName(match)} — the gates are closed.`, chat: 'system',
                    flash: { title: mapName(match), subtitle: 'The battle begins soon', color: GOLD }, cue: 'horn' });
            } else if (entered === 'live') {
                this.say({ text: 'Fight!', chat: 'system',
                    flash: { title: 'Fight!', color: GOLD }, cue: 'fight' });
            }
        }
        if (match.phase !== 'live') return;
        this.scanKills(board);
        for (const event of events) this.objective(event);
    }

    /** Match settled: the banner plus a closing chat line. */
    finish(match: PvpMatch, winner: PvpTeam | null): void {
        const score = `${match.score.A} – ${match.score.B}`;
        if (winner === 'A') this.say({ text: `Victory! ${score}`, chat: 'system',
            flash: { title: 'Victory!', subtitle: score, color: GOLD }, cue: 'victory' });
        else if (winner === 'B') this.say({ text: `Defeat. ${score}`, chat: 'system',
            flash: { title: 'Defeat', subtitle: score, color: ENEMY }, cue: 'defeat' });
        else this.say({ text: `Draw. ${score}`, chat: 'system',
            flash: { title: 'Draw', subtitle: score, color: IVORY }, cue: 'defeat' });
    }
    /** New kills/deaths since the last snapshot → first blood and sprees.
     * Rows are plain data; names can repeat across NPC builds, so diff by the stable row id. */
    private scanKills(board: PvpScoreboard): void {
        for (const row of board.rows) {
            const lastKills = this.kills.get(row.id) ?? 0;
            const lastDeaths = this.deaths.get(row.id) ?? 0;
            if (row.deaths > lastDeaths) {
                this.deaths.set(row.id, row.deaths);
                this.spree.set(row.id, 0);
                this.spreeTier.set(row.id, 0);
                if (row.isPlayer) this.say({ text: 'You were slain.', chat: 'death' });
            }
            if (row.kills > lastKills) {
                this.kills.set(row.id, row.kills);
                const streak = (this.spree.get(row.id) ?? 0) + (row.kills - lastKills);
                this.spree.set(row.id, streak);
                if (!this.firstBlood) {
                    this.firstBlood = true;
                    this.say({ text: `${row.name} drew First Blood!`, chat: 'system',
                        flash: { title: 'First Blood', subtitle: row.name, color: row.team === 'A' ? ALLY : ENEMY }, cue: 'firstBlood' });
                }
                const tier = this.spreeTier.get(row.id) ?? 0;
                const next = SPREES.find(([at]) => streak >= at && at > tier);
                if (next) {
                    this.spreeTier.set(row.id, next[0]);
                    const label = row.isPlayer ? `You ${next[1].replace('is', 'are')}` : `${row.name} ${next[1]}`;
                    this.say({ text: `${label}!`, chat: 'system',
                        flash: { title: label, color: row.team === 'A' ? ALLY : ENEMY }, cue: 'spree' });
                }
            }
        }
    }

    /** One controller event → callout (and scoreboard text for captures). */
    private objective(event: PvpObjectiveEvent): void {
        switch (event.kind) {
            case 'flag-pickup':
                this.say({ text: `${this.nameOf(event.combatant)} picked up the ${event.team === 'A' ? 'enemy' : 'your'} flag!`, chat: 'system',
                    flash: { title: 'Flag taken', subtitle: this.nameOf(event.combatant), color: event.team === 'A' ? ALLY : ENEMY }, cue: 'objective' });
                break;
            case 'flag-drop':
                this.say({ text: `${side(event.owner ?? event.team)} flag was dropped.`, chat: 'system' });
                break;
            case 'flag-return':
                this.say({ text: `${this.nameOf(event.combatant)} returned the ${event.team === 'A' ? 'your' : 'enemy'} flag.`, chat: 'system',
                    flash: { title: 'Flag returned', subtitle: this.nameOf(event.combatant), color: event.team === 'A' ? ALLY : ENEMY }, cue: 'objective' });
                break;
            case 'flag-capture': {
                const score = event.score ? ` (${event.score.A}–${event.score.B})` : '';
                this.say({ text: `${this.nameOf(event.combatant)} captured the flag!${score}`, chat: 'system',
                    flash: { title: 'Flag captured!', subtitle: `${this.nameOf(event.combatant)}${score}`, color: event.team === 'A' ? GOLD : ENEMY }, cue: 'objective' });
                break;
            }
            case 'flag-assault':
                this.say({ text: `${this.nameOf(event.combatant)} is vulnerable — focused assault burns the flag carrier!`, chat: 'system',
                    flash: { title: 'Focused Assault', subtitle: `${this.nameOf(event.combatant)} burns`, color: ENEMY }, cue: 'warning' });
                break;
            case 'node-assault':
                if (event.owner === 'A') this.say({ text: `${event.node} is under attack!`, chat: 'system',
                    flash: { title: `${event.node}`, subtitle: 'under attack!', color: ENEMY }, cue: 'warning' });
                else this.say({ text: `Your team is assaulting ${event.node}.`, chat: 'system' });
                break;
            case 'node-capture':
                this.say({ text: `${side(event.team)} captured ${event.node}.`, chat: 'system',
                    flash: { title: `${event.node}`, subtitle: event.team === 'A' ? 'captured' : 'lost', color: event.team === 'A' ? ALLY : ENEMY }, cue: 'objective' });
                break;
        }
    }
}
