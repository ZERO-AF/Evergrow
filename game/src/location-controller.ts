import { planDungeonTravel, type DungeonAction, type PersistDungeon } from './dungeon-command.ts';
import { executePortalTravel } from './travel-command.ts';
import { boardTransport, disembarkTransport, executeTransportPortal, startFlight, unlockFlight } from './transport.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { Simulation } from './simulation.ts';
import type { WorldQuery } from './model.ts';
import type { PortalAnchor } from './travel.ts';
export type TransportAction =
    | { kind: 'board'; routeId: string }
    | { kind: 'disembark' }
    | { kind: 'portal'; routeId: string }
    | { kind: 'unlockFlight'; masterId: string }
    | { kind: 'fly'; fromId: string; toId: string };
export interface LocationHost {
    simulation(): Simulation;
    surface(): WorldQuery;
    persist: PersistDungeon;
    restoreWorld(checkpoint: CharacterCheckpoint): void;
    arrived(): void;
    notify(message: string): void;
}
/** Called inside the application's durable-action barrier. No world/camera change before persistence. */
export class LocationController {
    private host: LocationHost;
    constructor(host: LocationHost) { this.host = host; }
    async dungeon(action: DungeonAction): Promise<boolean> {
        const host = this.host, sim = host.simulation();
        const result = await planDungeonTravel(sim, action, host.surface(), host.persist);
        if (!result.ok) {
            sim.portal.cancel();
            host.notify(result.message);
            return false;
        }
        host.restoreWorld(result.checkpoint);
        sim.restoreCheckpoint(result.checkpoint);
        sim.relocate(sim.player.x, sim.player.y);
        host.arrived();
        host.notify(result.message);
        return true;
    }
    async portal(anchor: PortalAnchor, returning: boolean): Promise<boolean> {
        const host = this.host, sim = host.simulation();
        if (sim.dungeonFloor || returning && sim.travel.returnTo?.dungeon)
            return this.dungeon(returning ? { kind: 'return', anchor } : { kind: 'town', anchor });
        const result = await executePortalTravel(sim, anchor, returning, host.persist);
        if (!result.ok) {
            host.notify(result.message);
            return false;
        }
        host.arrived();
        return true;
    }
    /** Staged transport travel (wayfinder world-t04): vehicle boarding, portal
     * hops, flight-master unlocks and taxi rides all persist before commit. */
    async transport(action: TransportAction): Promise<boolean> {
        const host = this.host, sim = host.simulation();
        const result = action.kind === 'board' ? await boardTransport(sim, action.routeId, host.persist)
            : action.kind === 'disembark' ? await disembarkTransport(sim, host.persist)
            : action.kind === 'portal' ? await executeTransportPortal(sim, action.routeId, host.persist)
            : action.kind === 'unlockFlight' ? await unlockFlight(sim, action.masterId, host.persist)
            : await startFlight(sim, action.fromId, action.toId, host.persist);
        if (!result.ok) { host.notify(result.message); return false; }
        if (action.kind !== 'unlockFlight') host.arrived();
        if (result.message) host.notify(result.message);
        return true;
    }
}
