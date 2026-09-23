import { activityStatus } from './activity-status.ts';
import { MapIconVisibility } from './map-legend-content.ts';
import { dungeonInteractionChests, dungeonRunExit } from './dungeon-locations.ts';
import { RiftPanel } from './rift-panel.ts';
import { RiftWorld } from './rift-world.ts';
import { drawRiftHUD } from './rift-hud.ts';
import { controls } from './control-preferences.ts';
import { isGameplayAction, type ControlAction } from './control-bindings.ts';
import { activeBuffs } from './active-buffs.ts';
import { ExpeditionPanel } from './expedition-panel.ts';
import { executeDropItem, type DropItemSource } from './drop-item-command.ts';
import { hoveredGroundLoot, showGroundLootNames, type GroundLootNameplates } from './ground-loot-hover.ts';
import type { LootFilterMode } from './loot.ts';
import { startDungeonEvent } from './dungeon-events.ts';
import { encounterScaleAt } from './encounter-scaling.ts';
import { MUSIC_FILES } from './music-content.ts';
import { audioVolume, DEFAULT_AUDIO, type AudioChannel } from './audio-preferences.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { isTrialKind } from './event-recipes.ts';
import { eventInteractionSites } from './poi-content.ts';
import { basicAttackWeapon } from './equipment.ts';
import { GroundLootHighlight } from './ground-loot-highlight.ts';
import { createAppearanceEditor } from './character-editor.ts';
import { executeAppearanceChange, executeSavedAppearanceChange } from './character-commands.ts';
import type { SaveSlot } from './character-storage.ts';
import { validCharacterLook, type CharacterLook } from './character-look.ts';
import { directionalAimProfile } from './ranged-aim.ts';
import { FramePacer } from './frame-pacer.ts';
import { ThorRuntime } from './thor-runtime.ts';
import { nativeController, clearNativeController } from './thor-native.ts';
import type { PadSnapshot } from './gamepad-input.ts';
import { JourneyController } from './journey-controller.ts';
import { LocationController } from './location-controller.ts';
import { bindTouchCanvas } from './touch-canvas.ts';
import { skillTargetPoint } from './skill-target-point.ts';
import { deriveAttackStats } from './equipment.ts';
import { TouchHUD } from './touch-hud.ts';
import { resolveSkill } from './skill-progression.ts';
import { skillWeapon } from './skill-content.ts';
import { FrameProfiler } from './frame-profiler.ts';
import { PerformanceMonitor } from './performance-monitor.ts';
import { drawJourneyDestination } from './journey-marker.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { DungeonWorld } from './dungeon-world.ts';
import { generateDungeon, type DungeonEntrance, type DungeonChestTarget } from './dungeon.ts';
import { currentDungeon } from './dungeon-state.ts';
import { claimDungeonChest, dungeonChestProblem, expeditionTableProblem, type DungeonAction } from './dungeon-command.ts';
import { DungeonMap, drawCryptMinimap } from './dungeon-map.ts';
import { EventPanel } from './poi-panel.ts';
import { EVENT_RULES, focusEvent, eventClaimed, isEventKind, type EventSite, type EventChoice } from './poi-content.ts';
import { executeEvent, eventProblem, claimCompletedEvent, pendingEventReward } from './poi-command.ts';
import { activatePortalAnchor } from './travel-command.ts';
import { townPortalAnchor, withinPortalReach, portalMapMarkers, type PortalAnchor } from './travel.ts';
import { portalActionMode, portalDestinations } from './portal-destination.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { CharacterSheet } from './character-types.ts';
import { ServicePanel } from './service-panel.ts';
import { buildingNPC, focusNPC, canInteractNPC, focusedStableMaster, stableMastersNear, battlemastersNear, focusedBattlemaster, positionedNPC, npcTown, type TownNPC, type StableMaster, type Battlemaster } from './npcs.ts';
import type { ServiceQuote } from './commerce.ts';
import { StablePanel, type StableActions } from './stable-panel.ts';
import { PvpPanel, type PvpPanelActions } from './pvp-panel.ts';
import { pvpBracketLabel, type PvpSetup } from './pvp-setup.ts';
import { enterPvpMatch, exitPvpMatch, currentPvpMatch } from './pvp-instance.ts';
import { drainPvpAnnouncements, pvpScoreboard, updatePvpMatch, type PvpMatchEnd } from './pvp-match.ts';
import { awardMatchRewards } from './pvp-rewards.ts';
import { FlightPanel } from './flight-panel.ts';
import { flightMasterAt, flightDestinations, transportPrompt } from './transport.ts';
import { flightPoint, type FlightPoint } from './transport-content.ts';
import { pvpScoreboardSummary } from './pvp-scoreboard.ts';
import { PvpScoreboardPanel, PVP_SCOREBOARD_SECONDS } from './pvp-scoreboard-panel.ts';
import type { PvpAnnouncement } from './pvp-announce.ts';
import { PvpVendorPanel } from './pvp-vendor-panel.ts';
import { executePvpBuy, focusedPvpVendor, pvpVendorsNear, type PvpVendor } from './pvp-vendor.ts';
import { BadgeVendorPanel } from './badge-vendor-panel.ts';
import { executeBadgeBuy, focusedBadgeVendor, badgeVendorsNear, type BadgeVendor } from './badge-vendor.ts';
import { TrainerPanel } from './trainer-panel.ts';
import { executeLearnSkill, executeUpgradeRank } from './trainer-command.ts';
import { trainersNear, focusedTrainer, type Trainer } from './trainer-npc.ts';
import { QuartermasterPanel } from './quartermaster-panel.ts';
import { executeQuartermasterBuy } from './quartermaster-command.ts';
import { quartermastersNear, focusedQuartermaster, type Quartermaster } from './quartermaster-npc.ts';
import { SocketingPanel } from './socket-panel.ts';
import { activateStabledPet, stableActivePet, releasePet, freshPetStable, PET_RULES, type PetStable } from './pet-content.ts';
import { executePetTalentLearn, executePetTalentReset } from './pet-talent-command.ts';
import { ChroniclePanel } from './chronicle-panel.ts';
import { metric } from './chronicle.ts';
import { trackCommerce } from './chronicle-tracking.ts';
import { executeService } from './commerce-command.ts';
import { PanelCoordinator } from './panel-coordinator.ts';
import { bindGameKeyboard } from './game-keyboard.ts';
import { createCharacter as createPlayerCharacter } from './character.ts';
import type { WowClassId, WowRaceId } from './wow-types.ts';
import { AreaNoticeTracker, areaLevelLabel, areaThreat, type AreaBannerNotice } from './area-banner.ts';
import { activityLevel } from './activity-level.ts';
import { getZoneAt } from './zone-progression.ts';
import { SaveHub, type SaveMode } from './save-hub.ts';
import { SAVE_BUNDLE_LIMIT } from './save-bundle.ts';
import { CharacterSession } from './character-session.ts';
import { TitleScreen, type CoopEntry } from './title-screen.ts';
import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { executeCharacterCommand, type CharacterCommand } from './character-commands.ts';
import { Lifetime } from './lifetime.ts';
import { World } from './world.ts';
import { createWorld } from './authored-world.ts';
import { isWorldSeed } from './world-seed.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameAudio } from './audio.ts';
import { Exploration } from './exploration.ts';
import { WorldMap } from './world-map.ts';
import { GameInput } from './game-input.ts';
import { GamepadInput, PAD } from './gamepad-input.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { GameShell } from './game-shell.ts';
import { isGameUIPoint, isUIRectPoint, projectUIRect } from './ui-hit-test.ts';
import type { GamePhase } from './game-phase.ts';
import type { Input, Player } from './model.ts';
import { GAME_FEATURES } from './game-features.ts';
import { playerFaction, startingZone } from './factions.ts';
import { ActionBars, applyBarInput, activateBarSlot, executeBarCommand } from './action-bar.ts';
import { ActionBarPanel } from './action-bar-panel.ts';
import { actionBarSlotAt, drawActionBars, isActionBarPoint } from './hud-action-bars.ts';
import { ChatFrame, drawEmoteBubble, logCombatEvents, pushChatMessage } from './chat-frame.ts';
import { ChatInput } from './chat-input.ts';
import { Emotes } from './emote.ts';
import { useConsumableId } from './consumable-command.ts';
import { isConsumableItem } from './consumable-content.ts';
import { MinimapTracking, collectTrackingBlips, drawTrackingBlips, minimapView, minimapWorldBounds } from './minimap-tracking.ts';
import { ZoneBanner } from './minimap-zone.ts';
import { ProfessionPanel } from './profession-panel.ts';
import { findRecipe } from './profession-content.ts';
import { gatherInteract, executeGather, executeCraft, executeDisenchant, executeUse } from './profession-command.ts';
import { executeEnchant, type EnchantTarget } from './enchant-command.ts';
import { COMPANION_IDS, COMPANIONS } from './companion-content.ts';
import { companionOwned, activeCompanion, summonCompanion } from './companion-state.ts';
import { gatherChannelOf, gatherChannelReady, gatherNodeBlips } from './gather-node.ts';
import { hearthstoneCast, executeHearthstone, hearthstoneHome, bindInteract, focusedInnkeeper, innkeepersNear } from './hearthstone.ts';
import { freshFishing, fishingBite, fishingCast, fishingCatch, fishingCancel, fishingZoneAt, type FishingSession } from './fishing.ts';
import { randomSource } from './random-source.ts';
import { GlyphPanel } from './glyph-panel.ts';
import { executeGlyphSocket, executeGlyphUnsocket, executeGlyphBuy } from './glyph-command.ts';
import { buyBag } from './bag-state.ts';
import { AchievementPanel } from './achievement-panel.ts';
import { AchievementToasts } from './achievement-toast.ts';
import { achievementTrack, type AchievementEvent } from './achievement-state.ts';
import { QuestPanel } from './quest-panel.ts';
import { questInteract, questAccept, questAbandon, questTurnIn, questOnExplore, type QuestGreeting } from './quest-command.ts';
import { questMarkers, questMapMarkers, drawQuestMapMarker } from './quest-marker.ts';
import type { QuestId } from './quest-content.ts';
import { dismount, mountToggle } from './mount-command.ts';
import { MOUNT_IDS, MOUNTS, isMountId, type MountId } from './mount-content.ts';
import { mountUnlocked, preferredMount } from './mount-state.ts';
import { isRaidEntranceId } from './raid-boss-content.ts';
import { isRaid2EntranceId } from './raid2-boss-content.ts';
import { isRaid3EntranceId } from './raid3-boss-content.ts';
import { isRaid4EntranceId } from './raid4-boss-content.ts';
import { isRaid5EntranceId } from './raid5-boss-content.ts';
import { isRaid6EntranceId } from './raid6-boss-content.ts';
import { isRaid7EntranceId } from './raid7-boss-content.ts';
import { isRaid8EntranceId } from './raid8-boss-content.ts';
import { isRaid9EntranceId } from './raid9-boss-content.ts';
import { TransmogPanel } from './transmog-panel.ts';
import { executeTransmogApply, executeTransmogClear } from './transmog-command.ts';
import { executeDualSpecUnlock, executeSpecSwap, executeSpecRename } from './dual-spec-command.ts';
import { cycleNameplateMode } from './nameplate-settings.ts';
import { pendingWorldEventReward, claimWorldEventReward } from './world-event-command.ts';
import { SpellbookPanel } from './spellbook-panel.ts';
import { StatsPanel } from './stats-panel.ts';
import { ReputationPanel } from './reputation-panel.ts';
import { DungeonFinderPanel } from './dungeon-finder-panel.ts';
import { AuctionHousePanel } from './auction-panel.ts';
import { GuildPanel } from './guild-panel.ts';
import { BuffFrame } from './buff-frame-art.ts';
import { queueForDungeon, leaveQueue } from './dungeon-finder-command.ts';
import { spawnDungeonParty } from './party-state.ts';
import { tickDungeonParty } from './party-ai.ts';
import { PartyFrame } from './party-frame.ts';
import { postAuction, buyoutAuction, cancelAuction, collectAuctionProceeds, tickAuctions } from './auction-command.ts';
import { foundGuild, guildVaultDeposit, guildVaultWithdraw } from './guild-command.ts';
import { cancelBuff } from './buff-frame.ts';
import { repOnQuestTurnIn, repClaimReward } from './reputation-command.ts';
import { UiLayoutPanel, registerPanelFrames } from './ui-layout-panel.ts';
import { uiEditMode, setUiEditMode } from './ui-layout.ts';
import { registerHotbarFrames, hotbarPointerDown, hotbarPointerMove, hotbarPointerUp, drawHotbarEditOverlay } from './hotbar-layout.ts';
import { repairInteract } from './durability-command.ts';
import { addGroundItem } from './ground-loot.ts';
import { treasureLanding } from './treasure-flight.ts';
import { drawSpiritWorld } from './spirit-world-art.ts';
import { presentationProfile, presentationViewport, type PresentationProfile } from './presentation-viewport.ts';
import { MailPanel } from './mail-panel.ts';
import { mailRecipients, sendMail, collectMail, readMail, deleteMail, tickMail, type MailRepository } from './mail-command.ts';
import { focusedMailbox, mailboxesNear } from './mail-content.ts';
import { mailOf } from './mail-state.ts';
import { HolidayPanel } from './holiday-panel.ts';
import { playActivity, buyPrize } from './holiday-command.ts';
import { faireActive, faireBooths, faireSite, faireVendor, type FaireBooth, type FaireNPC, type FaireSite } from './holiday-content.ts';
import { focusedFaireVendor } from './holiday-state.ts';
import { CalendarPanel } from './calendar-panel.ts';
import { DamageMeter } from './damage-meter.ts';
import { DamageMeterPanel } from './damage-meter-panel.ts';
import { ALLY_TEMPLATES } from './wow-allies.ts';
import { NetPanel } from './net-panel.ts';
import { NetHostSession } from './net-host.ts';
import { NetClientSession } from './net-client.ts';
import { connectWebSocket } from './net-transport.ts';
import { NET_PROTOCOL_VERSION, type MsgHello } from './net-protocol.ts';
import { playerFieldsOf, worldFieldsOf, mergeCheckpoint } from './character-save.ts';

/** Coordinates browser lifecycle, simulation and presentation; system rules live in their owners. */
export class Game {
  private thor!: ThorRuntime;
  private journeys!: JourneyController;
  private locations!: LocationController;

  private lifetime = new Lifetime();
  overworld = createWorld(7319);
  world: World = this.overworld;
  private riftPanel: RiftPanel;
  private activeRiftPortal: string|null=null;
  private expeditionPanel: ExpeditionPanel;
  private activeExpeditionTable: string | null = null;
  private mapIcons = new MapIconVisibility();
  private dungeonMap: DungeonMap;
  private activeDungeonEntrance: DungeonEntrance | null = null;
  private activeFlightMaster: FlightPoint | null = null;
  sim = new Simulation(this.world, { seed: 7319 });
  renderer: Renderer;
  /** Second world renderer for couch co-op split-screen; created lazily when
   * the players separate beyond the shared camera's reach. */
  private renderer2: Renderer | null = null;
  /** Offscreen canvas the two half-views are composited into before PostFX. */
  private splitCanvas: HTMLCanvasElement | null = null;
  /** True while the co-op view is split into two half-screen viewports. */
  private coopSplit = false;
  /** Full logical world-view size; the split halves are carved from this. */
  private viewW = 960;
  private viewH = 600;
  /** Wheel zoom saved while the shared co-op camera drives the zoom. */
  private savedZoom: number | undefined;
  audio: GameAudio;
  private exploration: Exploration;
  private titleScreen: TitleScreen;
  private session: CharacterSession;
  private nextAutosave = 0;
  private areaNotices = new AreaNoticeTracker();
  private saveError = '';
  private worldMap: WorldMap;
  private shell: GameShell;
  private groundLootHighlight: GroundLootHighlight;
  private inventoryPanel: InventoryPanel;
  private appearanceEditor?:ReturnType<typeof createAppearanceEditor>;
  private appearanceFromPause = false;
  private appearanceFromHall = false;
  private skillPanel: SkillTreePanel;
  private servicePanel: ServicePanel;
  private eventPanel: EventPanel;
  private flightPanel: FlightPanel;
  private activeEvent: EventSite | null = null;
  private projectedBeacons = new Set<string>();
  private activeNPC: TownNPC | null = null;
  private stablePanel!: StablePanel;
  private activeStableMaster: StableMaster | null = null;
  private pvpPanel!: PvpPanel;
  private activeBattlemaster: Battlemaster | null = null;
  private pvpVendorPanel!: PvpVendorPanel;
  private badgeVendorPanel!: BadgeVendorPanel;
  private activePvpVendor: PvpVendor | null = null;
  private activeBadgeVendor: BadgeVendor | null = null;
  private pvpScorePanel!: PvpScoreboardPanel;
  /** Settled match awaiting the scoreboard countdown/Leave before teardown. */
  private pendingPvpEnd: PvpMatchEnd | null = null;
  private pvpExitAt = 0;
  readonly canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiContext: CanvasRenderingContext2D;
  fx: PostFX;
  private panels: PanelCoordinator;
  private chronicle: ChroniclePanel;
  get phase(): GamePhase { return this.panels?.phase ?? 'ready'; }
  private muted = false;
  private groundLootNames: GroundLootNameplates = 'always';
  private lootFilter: LootFilterMode = 'off';
  private nextScore = 0;
  private audioPhase: GamePhase = 'ready';
  private nativeBackground = false;
  private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  private touch!: TouchHUD;
  private bars = new ActionBars(localStorage);
  private input = new GameInput(controls, () => this.bars.page);

  private gamepad = new GamepadInput();
  /** Second controller for couch co-op player two; bound to gamepad index 1. */
  private gamepad2 = new GamepadInput();
  /** Online co-op session: NetHostSession when hosting, NetClientSession when
   * joined. Null = offline single/couch play. */
  private net: import('./net-host.ts').NetHostSession | import('./net-client.ts').NetClientSession | null = null;
  private netPanel!: NetPanel;
  /** While a client is joined to a different-seed host world, the client's own
   * overworld/map/exploration are parked here and restored on leave. */
  private netWorldSwap: { overworld: World; exploration: Exploration; worldMap: WorldMap } | null = null;
  /** The client's own checkpoint captured just before joining — restored on
   * leave so no host world state (enemies, time, kills, camps, position) leaks
   * into the solo game or its autosave. */
  private netPreJoin: import('./character-save.ts').CharacterCheckpoint | null = null;
  /** The couch partner's own save slot + write token, so their progress
   * persists back to their slot (null for guest/'new' partners). */
  private coopPartnerSlot: number | null = null;
  private coopPartnerToken: string | null = null;
  private gamepadMenu = new GamepadMenu();
  private usingGamepad = false;
  private clearWorldTouch: (() => void) | undefined;
  private mouse = this.input.pointer;
  private pointerOverEffects = false;
  readonly performance = new FrameProfiler(new URLSearchParams(location.search).has('profile'));
  private last = performance.now();
  private animation = 0;
  private nextFrameErrorNotice = 0;
  private framePacer = new FramePacer(60);
  private performanceMonitor: PerformanceMonitor;
  private nextPerformanceCounters = 0;
  private performancePhase: GamePhase | null = null;
  private abort = new AbortController();
  private disposed = false;
  private saveClient: SaveHub;
  private _hallBusy = false;
  private get hallBusy() { return this._hallBusy; }
  private set hallBusy(value: boolean) { this._hallBusy=value; this.titleScreen?.setBusy(value); }
  private savingAction = false;
  private nextAuctionTick = 0;
  private nextMailTick = 0;
  /** MailRepository adapter over the save hub: slot reads, CAS writes, roster list. */
  private readonly mailRepository: MailRepository = {
    read: index => this.saveClient.read(index),
    write: (index, record, expected) => this.saveClient.write(index, record, expected),
    list: () => this.saveClient.list(),
  };
  private nextEventClaim = 0;
  private actionPending: Promise<unknown> = Promise.resolve();
  private autosave: Promise<boolean> | null = null;
  private saveAgain = false;
  private chatFrame = new ChatFrame();
  private emotes = new Emotes();
  private chatInput!: ChatInput;
  private actionBarPanel!: ActionBarPanel;
  private dungeonFinderPanel!: DungeonFinderPanel;
  private mailPanel!: MailPanel;
 private socketingPanel!: SocketingPanel;
  private holidayPanel!: HolidayPanel;
  private calendarPanel!: CalendarPanel;
 private trainerPanel!: TrainerPanel;
 private quartermasterPanel!: QuartermasterPanel;
 private activeTrainer: Trainer | null = null;
 private activeQuartermaster: Quartermaster | null = null;
  private damageMeter!: DamageMeter;
  private damageMeterPanel!: DamageMeterPanel;
  private auctionPanel!: AuctionHousePanel;
  private activeFaireVendor: FaireNPC | null = null;
  private activeFaireSite: FaireSite | null = null;
  private activeFaireBooths: readonly FaireBooth[] = [];
  private guildPanel!: GuildPanel;
  private buffFrame!: BuffFrame;
  private partyFrame!: PartyFrame;
  private zoneBanner = new ZoneBanner();
  private minimapTracking = new MinimapTracking();
  private fishing: FishingSession = freshFishing();
  private questPanel!: QuestPanel;
  private professionPanel!: ProfessionPanel;
  private achievementPanel!: AchievementPanel;
  private achievementToasts!: AchievementToasts;
  private glyphPanel!: GlyphPanel;
  private spellbookPanel!: SpellbookPanel;
  private statsPanel!: StatsPanel;
  private reputationPanel!: ReputationPanel;
  private transmogPanel!: TransmogPanel;
  private uiLayoutPanel!: UiLayoutPanel;
  private pendingGiver: QuestGreeting | null = null;
  private mapFocus: { x: number; y: number } | null = null;
  private readonly presentation: PresentationProfile;

  constructor(root: HTMLElement) {
    this.presentation = presentationProfile({
      android: !!window.EvergrowAndroid,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
    });
    this.lifetime.defer(() => this.abort.abort());
    this.lifetime.defer(() => cancelAnimationFrame(this.animation));
    this.lifetime.defer(() => { if(this.world !== this.overworld) this.world.dispose(); this.overworld.dispose(); });
    try {
      this.renderer = new Renderer(true, this.performance);
      this.audio = this.lifetime.own(new GameAudio(MUSIC_FILES));
      this.exploration = new Exploration(this.world, { storage: null });
      this.lifetime.defer(() => this.exploration.dispose());
      this.saveClient = this.lifetime.own(new SaveHub());
      this.session = new CharacterSession(this.saveClient, this.world.generationVersion, seed=>createWorld(seed));
      this.shell = this.lifetime.own(new GameShell(root, {
        shortcutMenuChanged: () => this.clearInput(),
        homePortal: () => { if (this.shouldShowHomePortal()) this.requestPortal(); },
        groundLootNames: () => this.groundLootNames,
        setGroundLootNames: mode => { this.groundLootNames = mode; this.savePreferences(); },
        lootFilter: () => this.lootFilter,
        setLootFilter: mode => { this.lootFilter = mode; this.savePreferences(); },
        volume: channel => this.audio.getVolumes()[channel], setVolume: (channel, value) => this.setAudioVolume(channel, value), panelSound: open => this.audio.panel(open),
        sound: () => this.toggleSound(), muted: () => this.muted, zoom: factor => this.renderer.zoomByWheel(-Math.log(factor)/.0016,0,this.canvas.getBoundingClientRect().height),
        lastSavedAt: () => this.session?.active?.record.updatedAt,
        saveLocation: () => this.saveClient.mode === 'cloud' ? 'Online' : 'Local',
        play: () => this.phase === 'paused' ? this.resume() : this.start(),
        save: () => this.durable(async () => { const saved = await this.saveCharacter(true); if (saved) await this.saveClient.flush(); return saved; }, false),
        openChronicle: () => { if(!this.savingAction)this.panels.open('chronicle'); },
        openAppearance: () => { if (!this.savingAction && this.panels.open('character')) this.editAppearance(true); },
        leaderboard: order => this.saveClient.leaderboard(order), leaderboardAvailable: () => this.saveClient.supported,
        returnToTitle: () => this.returnToTitle(), openMap: () => this.openMap(),
        openCharacter: () => this.openCharacterPanel('character'), openSkills: () => this.openCharacterPanel('skills'), openJourneys: () => this.journeys.open(),
        openTransmog: () => { if (!this.sim.ghost) this.panels.open('transmog'); },
        openArena: () => { if (!this.sim.ghost) this.panels.open('arena'); },
        editLayout: () => this.uiLayoutPanel.toggle(),
        coopActive: () => this.sim.coop,
        leaveCoop: () => this.leaveCoop(),
        canReleaseSpirit: () => this.sim.player.dead && !this.sim.ghost && !this.sim.dungeonFloor && !this.sim.expeditions.location,
        releaseSpirit: () => this.releaseSpirit(),
        resurrectGhost: mode => this.resurrectGhost(mode),
      }));
      this.lifetime.defer(controls.subscribe(() => { this.clearInput(); this.shell.refreshBindings(); }));
      this.canvas = this.shell.canvas;
      this.performanceMonitor = this.lifetime.own(new PerformanceMonitor(this.performance, root, {
        continuous: this.performance.enabled,
        releaseInput: () => this.clearInput(), returnFocus: () => this.canvas.focus(),
        isToggle: event => controls.action(event.code) === 'debug',
      }));
      this.groundLootHighlight = this.lifetime.own(new GroundLootHighlight(root, this.canvas));
      this.chatInput = this.lifetime.own(new ChatInput(this.canvas.parentElement!, {
        submit: text => this.emotes.submit(this.sim, text),
        restoreFocus: () => this.canvas.focus({ preventScroll: true }),
      }));
      this.uiCanvas = this.shell.uiCanvas;
      const uiContext = this.uiCanvas.getContext('2d');
      if (!uiContext) throw new Error('The HUD requires a 2D canvas context.');
      this.uiContext = uiContext;
      this.worldMap = new WorldMap(this.overworld, this.exploration, this.shell.mapMount, () => this.closeMap(), undefined, this.mapIcons);
      this.lifetime.defer(() => this.worldMap.dispose());
      this.worldMap.setEncounterLevelReader(poi => isEventKind(poi.kind)||poi.kind==='dungeon' ? activityLevel(poi,this.journeys.facts(),this.overworld.seed) : null);
    this.worldMap.setActivityStateReader(poi => activityStatus(poi, this.journeys.facts()));
    this.worldMap.setWorldEventReader(() => ({ state: this.sim.worldEvents, time: this.sim.time }));
    this.worldMap.setPortalMarkers(() => portalMapMarkers(this.sim.travel, band => this.overworld.getPortalAnchor(band)));
    this.worldMap.setLootMarkerReader(() => GAME_FEATURES.legendaryMoment ? this.sim.groundItems : []);
      this.inventoryPanel = this.lifetime.own(new InventoryPanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        assignSkill: (slot, skill) => this.characterAction({ type: 'assignSkill', slot, skill }),
        hudOptions: () => ({ groundEffects: this.sim.groundEffects, gamepad: this.usingGamepad, reducedMotion: this.reducedMotion }),
        openSkills: skill => { this.openCharacterPanel('skills'); this.skillPanel.inspectNode(skill ? `skill:${skill}` : 'origin', true); this.skillPanel.setDetailsVisible(true); },
        openGlyphs: () => this.panels.open('glyphs'),
        openBars: () => this.actionBarPanel.open(this.sim.player, this.bars),
        editAppearance:()=>this.editAppearance(),
        openChronicle:()=>{if(!this.savingAction)this.panels.open('chronicle');},
        equip: (index, slot) => this.characterAction({ type: 'equip', index, slot }),
        unequip: (slot, index) => this.characterAction({ type: 'unequip', slot, index }),
        move: (from, to) => this.characterAction({ type: 'moveItem', from, to }),
        lock: (id,locked) => this.characterAction({type:'lockItem',id,locked}),
        drop: source => { void this.dropInventoryItem(source); },
        equipBest: choice => this.characterAction({ type: 'equipBest', choice }),
        sort: mode => this.characterAction({ type: 'sortInventory', mode }),
        allocate: attribute => this.characterAction({ type: 'allocateAttribute', attribute }),
      }));
      this.skillPanel = this.lifetime.own(new SkillTreePanel(this.shell.panelMount, {
        develop: command => this.characterAction(command),
        close: () => this.closeCharacterPanel(),
        swapSpec: () => { void this.durable(async () => { const result = await executeSpecSwap(this.sim, c => this.persistTravel(c)); if (result.ok) this.skillPanel.refresh(this.sim.player); if (result.message) this.notify(result.message); }, undefined); },
        unlockSpec: () => { void this.durable(async () => { const result = await executeDualSpecUnlock(this.sim, c => this.persistTravel(c)); if (result.ok) this.skillPanel.refresh(this.sim.player); if (result.message) this.notify(result.message); }, undefined); },
        renameSpec: (index, name) => { void this.durable(async () => { const result = await executeSpecRename(this.sim, index, name, c => this.persistTravel(c)); if (result.ok) this.skillPanel.refresh(this.sim.player); if (result.message) this.notify(result.message); }, undefined); },
        allocate: id => this.characterAction({ type: 'allocateNode', id }),
        assign: (slot, skill) => this.characterAction({ type: 'assignSkill', slot, skill }),
      }));
      this.chronicle = this.lifetime.own(new ChroniclePanel(this.shell.panelMount,()=>this.resume()));
      this.titleScreen = this.lifetime.own(new TitleScreen(this.shell.titleMount, {
        sound: () => this.toggleSound(), muted: () => this.muted,
        volume: channel => this.audio.getVolumes()[channel], setVolume: (channel, value) => this.setAudioVolume(channel, value), panelSound: open => this.audio.panel(open),
        create: (index, name, classId, raceId, look, seed, coop) => { void this.createCharacter(index, name, classId, raceId, seed, look, coop); },
        editAppearance: slot => this.editHallAppearance(slot),
        continue: (index, coop) => this.continueCharacter(index, undefined, coop), continueRecovery: (index, token) => this.continueCharacter(index, token), remove: (index, expected) => this.deleteCharacter(index, expected),
        read: index => this.saveClient.inspect(index), source: mode => this.selectSaveSource(mode),
        retry: () => { void this.retryCloudSaves(); },
        leaderboard: order => this.saveClient.leaderboard(order),
        ...(!window.EvergrowAndroid ? { download: (index: number) => this.downloadSave(index), import: (index: number, file: File) => this.importSave(index, file) } : {}),
        useCloud: (index, expected) => this.resolveCloudSave(index, expected),
        arena: (mount, close) => new PvpPanel(mount, { ...this.pvpActions, close }, true),
      }));
      this.servicePanel = this.lifetime.own(new ServicePanel(this.shell.panelMount, {
        close: () => this.resume(), trade: quote => this.trade(quote),
        sort: (target, tab) => this.characterAction(target === 'storage' ? { type: 'sortStorage', tab } : { type: 'sortInventory', mode: 'compact' }),
        repair: () => this.durable(async () => {
          const npc = this.activeNPC ? this.liveNPC(this.activeNPC) : null;
          if (!npc) return { ok: false, message: 'This service is no longer in reach.' };
          const result = await repairInteract(this.sim, npc, c => this.persistTravel(c));
          if (result.ok) this.servicePanel.open(this.sim.player, npc);
          return { ok: result.ok, message: result.message ?? '' };
        }, { ok: false, message: 'Saving the previous action…' }),
        buyGlyph: glyphId => this.durable(async () => {
          const npc = this.activeNPC ? this.liveNPC(this.activeNPC) : null;
          if (!npc) return { ok: false, message: 'This service is no longer in reach.' };
          const result = await executeGlyphBuy(this.sim, npc, glyphId, c => this.persistTravel(c));
          return { ok: result.ok, message: result.message ?? '' };
        }, { ok: false, message: 'Saving the previous action…' }),
        buyBag: bagId => this.durable(async () => {
          const npc = this.activeNPC ? this.liveNPC(this.activeNPC) : null, p = this.sim.player;
          if (!npc || !canInteractNPC(npc, p, this.world)) return { ok: false, message: 'This service is no longer in reach.' };
          const checkpoint = this.sim.captureCheckpoint();
          const result = buyBag(checkpoint.character, npc, bagId);
          if (!result.ok) return { ok: false, message: result.message ?? 'That bag is not sold here.' };
          const saved = await this.persistTravel(checkpoint);
          if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. No gold was spent.' };
          p.character = checkpoint.character;
          const message = `Bought ${result.item!.name}.`;
          pushChatMessage(p, 'loot', message, this.sim.time);
          return { ok: true, message };
        }, { ok: false, message: 'Saving the previous action…' }),
        openSocketing: () => this.panels.open('socketing'),
      }));
      this.pvpScorePanel = this.lifetime.own(new PvpScoreboardPanel(this.shell.panelMount, { leave: () => this.leavePvpMatch() }));
      this.stablePanel = this.lifetime.own(new StablePanel(this.shell.panelMount, this.petActions));
      this.pvpPanel = this.lifetime.own(new PvpPanel(this.shell.panelMount, this.pvpActions));
      this.pvpVendorPanel = this.lifetime.own(new PvpVendorPanel(this.shell.panelMount, {
        close: () => this.resume(),
        buy: stockId => this.durable(async () => {
          const vendor = this.activePvpVendor;
          if (!vendor) return { ok: false, message: 'The quartermaster is no longer here.' };
          const result = await executePvpBuy(this.sim, vendor, stockId, c => this.persistTravel(c));
          if (result.message) this.notify(result.message);
          return result;
        }, { ok: false, message: 'Saving the previous action…' }),
      }));
      this.badgeVendorPanel = this.lifetime.own(new BadgeVendorPanel(this.shell.panelMount, {
        close: () => this.resume(),
        buy: stockId => this.durable(async () => {
          const vendor = this.activeBadgeVendor;
          if (!vendor) return { ok: false, message: 'The emblem quartermaster is no longer here.' };
          const result = await executeBadgeBuy(this.sim, vendor, stockId, c => this.persistTravel(c));
          if (result.message) this.notify(result.message);
          return result;
        }, { ok: false, message: 'Saving the previous action…' }),
      }));
      this.trainerPanel = this.lifetime.own(new TrainerPanel(this.shell.panelMount, {
        close: () => this.resume(),
        learn: skillId => this.durable(() => executeLearnSkill(this.sim, skillId, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
        upgrade: skillId => this.durable(() => executeUpgradeRank(this.sim, skillId, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
      }));
      this.quartermasterPanel = this.lifetime.own(new QuartermasterPanel(this.shell.panelMount, {
        close: () => this.resume(),
        buy: rewardId => this.durable(async () => {
          const vendor = this.activeQuartermaster;
          if (!vendor) return { ok: false, message: 'The quartermaster is no longer here.' };
          const result = await executeQuartermasterBuy(this.sim, vendor, rewardId, c => this.persistTravel(c));
          if (result.message) this.notify(result.message);
          return result;
        }, { ok: false, message: 'Saving the previous action…' }),
      }));
      this.socketingPanel = this.lifetime.own(new SocketingPanel(this.shell.panelMount, {
        onSocket: (target, gemIndex, socketIndex) => this.characterAction({ type: 'socketGem', gemIndex, target, socketIndex }),
        onUnsocket: (target, socketIndex) => this.characterAction({ type: 'unsocketGem', target, socketIndex }),
        onClose: () => this.resume(),
      }));
      this.riftPanel=this.lifetime.own(new RiftPanel(this.shell.panelMount,{close:()=>this.resume(),enter:async action=>{const ok=await this.switchDungeon(action);if(ok)this.resume();return ok;}}));
      this.expeditionPanel=this.lifetime.own(new ExpeditionPanel(this.shell.panelMount,{close:()=>this.resume(),enter:async action=>{const ok=await this.switchDungeon(action);if(ok)this.resume();return ok;}}));
      this.dungeonMap = this.lifetime.own(new DungeonMap(this.shell.mapMount,()=>this.closeMap(),()=>this.worldMap.open({x:this.sim.expeditions.surfaceX,y:this.sim.expeditions.surfaceY,angle:0}), this.mapIcons));
      this.eventPanel = this.lifetime.own(new EventPanel(this.shell.panelMount, {
        enter: entrance => { this.resume(); this.switchDungeon({kind:'enter',entrance}); },
        close: () => this.resume(), choose: (site, choice) => { this.resume(); this.startEvent(site, choice); },
      }));
      this.flightPanel = this.lifetime.own(new FlightPanel(this.shell.panelMount, {
        close: () => this.resume(),
        fly: (master, destination) => {
          const near = flightMasterAt(this.sim);
          if (!near || near.id !== master.id) return;
          this.resume();
          void this.durable(() => this.locations.transport({ kind: 'fly', fromId: master.id, toId: destination.id }), undefined);
        },
      }));
      this.questPanel = this.lifetime.own(new QuestPanel(this.shell.panelMount, this.canvas.parentElement!, {
        close: () => { if (this.phase === 'questLog') this.resume(); else this.questPanel.close(); },
        accept: id => this.questCommand('accept', id),
        turnIn: id => this.questCommand('turnIn', id),
        abandon: id => this.questCommand('abandon', id),
        map: id => {
          const marker = questMapMarkers(this.world, this.sim.player).find(m => m.quest.id === id);
          if (!marker) { this.notify('No known location for that quest yet.'); return; }
          this.mapFocus = { x: marker.x, y: marker.y };
          this.panels.transition('map', true);
        },
        service: () => {
          const anchor = this.pendingGiver?.anchor;
          if (anchor?.kind !== 'npc') return;
          this.activeNPC = anchor.npc;
          this.panels.transition('service', true);
        },
      }));
      this.professionPanel = this.lifetime.own(new ProfessionPanel(this.shell.panelMount, {
        close: () => this.resume(),
        craft: recipeId => this.professionCommand('craft', recipeId),
        disenchant: index => this.professionCommand('disenchant', index),
        use: materialId => this.professionCommand('use', materialId),
        enchant: (enchantId, target) => this.professionCommand('enchant', { enchantId, target }),
      }));
      this.achievementPanel = this.lifetime.own(new AchievementPanel(this.shell.panelMount, { close: () => this.resume() }));
      this.achievementToasts = this.lifetime.own(new AchievementToasts(this.canvas.parentElement!));
      this.glyphPanel = this.lifetime.own(new GlyphPanel(this.shell.panelMount, {
        close: () => this.resume(),
        socket: index => this.durable(() => executeGlyphSocket(this.sim, index, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
        unsocket: slot => this.durable(() => executeGlyphUnsocket(this.sim, slot, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
      }));
      this.actionBarPanel = this.lifetime.own(new ActionBarPanel(this.shell.panelMount, {
        close: () => this.actionBarPanel.close(),
        command: command => {
          const result = executeBarCommand(this.sim.player, this.bars, command);
          if (!result.ok) this.notify(result.message ?? 'That slot is unavailable.');
          else this.saveCharacter();
        },
      }));
      this.spellbookPanel = this.lifetime.own(new SpellbookPanel(this.shell.panelMount, {
        close: () => this.resume(),
        atlas: skill => { this.openCharacterPanel('skills'); this.skillPanel.inspectNode(`wow-${this.sim.player.character.classId}-${skill}`, true); this.skillPanel.setDetailsVisible(true); },
      }));
      this.statsPanel = this.lifetime.own(new StatsPanel(this.shell.panelMount, {
        close: () => this.resume(),
        setTitle: id => this.characterAction({ type: 'equipTitle', id }),
      }));
      this.reputationPanel = this.lifetime.own(new ReputationPanel(this.shell.panelMount, {
        close: () => this.resume(),
        claim: (faction, reward) => { void this.durable(async () => {
          const result = await repClaimReward(this.sim, faction, reward, c => this.persistTravel(c));
          this.notify(result.message ?? '');
          return result;
        }, undefined); },
      }));
      this.transmogPanel = this.lifetime.own(new TransmogPanel(this.shell.panelMount, {
        apply: (slot, sourceId) => this.durable(() => executeTransmogApply(this.sim, slot, sourceId, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
        clear: slot => this.durable(() => executeTransmogClear(this.sim, slot, c => this.persistTravel(c)), { ok: false, message: 'Saving the previous action…' }),
        close: () => this.resume(),
      }));
      // Wave-2 WoW panels: RDF, Auction House, Guild. Each rides the shared
      // persist-before-commit wrapper; the sheet persist builds a checkpoint.
      this.dungeonFinderPanel = this.lifetime.own(new DungeonFinderPanel(this.shell.panelMount, {
        queue: (id, heroic, group) => this.durable(async () => {
          const r = await queueForDungeon(this.sim, id, this.overworld, c => this.persistTravel(c), heroic, group);
          if (!r.ok) { this.notify(r.message ?? 'Could not queue.'); return false; }
          // Complete the travel transition like LocationController.dungeon.
          this.setLocationWorld(r.checkpoint);
          this.sim.restoreCheckpoint(r.checkpoint);
          this.sim.relocate(this.sim.player.x, this.sim.player.y);
          this.finishTravel();
          // 'Find Group' fills the party with AI members at the dungeon entrance.
          if (group) {
            const members = spawnDungeonParty(this.sim, currentDungeon(this.sim.expeditions)?.entrance.seed ?? this.overworld.seed ?? 0);
            if (members.length) this.notify(`Your party: ${members.map(m => m.party.name).join(', ')}.`);
          }
          this.notify(r.message);
          return true;
        }, false),
        leave: () => this.durable(async () => {
          const r = await leaveQueue(this.sim, c => this.persistTravel(c));
          if (!r.ok) this.notify(r.message ?? ''); return r.ok;
        }, false),
        close: () => this.resume(),
      }));
      this.auctionPanel = this.lifetime.own(new AuctionHousePanel(this.shell.panelMount, {
        post: (i, b, h) => this.durable(() => postAuction(this.sim.player, i, b, h, this.persistSheet), { ok: false, message: 'Saving…' }),
        buyout: id => this.durable(() => buyoutAuction(this.sim.player, id, this.persistSheet), { ok: false, message: 'Saving…' }),
        cancel: id => this.durable(() => cancelAuction(this.sim.player, id, this.persistSheet), { ok: false, message: 'Saving…' }),
        collect: () => this.durable(() => collectAuctionProceeds(this.sim.player, this.persistSheet), { ok: false, message: 'Saving…' }),
      }));
      this.guildPanel = this.lifetime.own(new GuildPanel(this.shell.panelMount, {
        close: () => this.resume(),
        found: name => { void this.durable(async () => { const r = await foundGuild(this.sim.player, name, this.persistSheet); this.notify(r.message ?? ''); }, undefined); },
        deposit: i => { void this.durable(async () => { const r = await guildVaultDeposit(this.sim.player, i, this.persistSheet); if (!r.ok) this.notify(r.message ?? ''); }, undefined); },
        withdraw: i => { void this.durable(async () => { const r = await guildVaultWithdraw(this.sim.player, i, this.persistSheet); if (!r.ok) this.notify(r.message ?? ''); }, undefined); },
      }));
      // Wave-3 WoW panels: Mailbox (cross-slot letters) and the Darkmoon Faire.
      // Mail rides persistSheet like the auction house; the faire stages a full
      // checkpoint (tickets + holiday ledger) through persistTravel.
      this.mailPanel = this.lifetime.own(new MailPanel(this.shell.panelMount, {
        close: () => this.resume(),
        recipients: () => mailRecipients(this.mailRepository, this.session.active?.index ?? -1),
        send: draft => this.durable(() => sendMail(this.sim.player, draft,
          { slot: this.session.active?.index ?? -1, name: this.session.active?.record.name ?? this.sim.player.name ?? '' },
          this.mailRepository, this.persistSheet), { ok: false, message: 'Saving…' }),
        collect: id => this.durable(() => collectMail(this.sim.player, id, this.persistSheet), { ok: false, message: 'Saving…' }),
        read: id => this.durable(() => readMail(this.sim.player, id, this.persistSheet), { ok: false, message: 'Saving…' }),
        remove: id => this.durable(() => deleteMail(this.sim.player, id, this.persistSheet), { ok: false, message: 'Saving…' }),
      }));
      this.holidayPanel = this.lifetime.own(new HolidayPanel(this.shell.panelMount, {
        close: () => this.resume(),
        play: booth => this.durable(() => playActivity(this.sim, booth, c => this.persistTravel(c)), { ok: false, message: 'Saving…' }),
        buy: stockId => this.durable(async () => {
          const vendor = this.activeFaireVendor;
          if (!vendor) return { ok: false, message: 'The prize vendor is no longer here.' };
          return buyPrize(this.sim, vendor, stockId, c => this.persistTravel(c));
        }, { ok: false, message: 'Saving…' }),
      }));
      // Wave-10 WoW modules: the calendar is a read-only modal panel; the damage
      // meter is a non-modal overlay fed from the combat-event stream.
      this.calendarPanel = this.lifetime.own(new CalendarPanel(this.shell.panelMount,
        () => ({ sheet: this.sim.player.character, worldEvents: this.sim.worldEvents, simTime: this.sim.time }),
        () => this.resume()));
      this.netPanel = this.lifetime.own(new NetPanel(this.shell.panelMount, {
        close: () => this.resume(),
        host: address => void this.netHost(address),
        join: (code, address) => void this.netJoin(code, address),
        leave: () => this.netLeave(),
        status: () => this.net ? `Connected — ${this.sim.netMode}` : '',
      }));
      this.damageMeter = new DamageMeter({
        sourceName: source => {
          if (source === 'player') return undefined;
          const id = Number(source.slice(5));
          const ally = this.sim.player.allies?.find(a => a.id === id);
          if (!ally) return undefined;
          const stable = this.sim.player.character.pets;
          const rec = ally.petId !== undefined ? [stable?.active, ...(stable?.stabled ?? [])].find(p => p?.id === ally.petId) : undefined;
          return rec?.name ?? ALLY_TEMPLATES[ally.kind]?.name;
        },
      });
      this.damageMeterPanel = this.lifetime.own(new DamageMeterPanel(this.shell.panelMount, this.damageMeter));
      this.buffFrame = this.lifetime.own(new BuffFrame());
      this.buffFrame.mount(this.canvas.parentElement!);
      this.buffFrame.onCancel = key => { const r = cancelBuff(this.sim.player, key); if (!r.ok) this.notify(r.message ?? ''); };
      this.partyFrame = this.lifetime.own(new PartyFrame());
      this.partyFrame.mount(this.canvas.parentElement!);
      this.uiLayoutPanel = this.lifetime.own(new UiLayoutPanel(this.shell.panelMount, { close: () => this.canvas.focus() }));
      registerPanelFrames();
      registerHotbarFrames();
      const game = this;
      this.journeys = this.lifetime.own(new JourneyController({
        get sim() { return game.sim; }, get world() { return game.world; }, get overworld() { return game.overworld; },
        get exploration() { return game.exploration; }, get phase() { return game.phase; },
        get navigationVisible() { return game.renderer.navigationVisible; },
        get savingAction() { return game.savingAction; }, get renderer() { return game.renderer; },
        get panels() { return game.panels; }, get worldMap() { return game.worldMap; }, get dungeonMap() { return game.dungeonMap; },
        durable: (work, fallback) => this.durable(work, fallback), persistTravel: c => this.persistTravel(c), resume: () => this.resume(),
      }, this.shell.panelMount, this.canvas.parentElement!));
      this.locations = new LocationController({
        simulation: () => this.sim, surface: () => this.overworld,
        persist: c => this.persistTravel(c), restoreWorld: c => this.setLocationWorld(c),
        arrived: () => this.finishTravel(), notify: message => this.notify(message),
      });
      this.panels = new PanelCoordinator({
        chronicle:{open:()=>{void this.chronicle.open(async onCached=>{await this.saveCharacter(true);return this.saveClient.chronicle(onCached);},this.session.active?.record.id);},close:()=>this.chronicle.close(false)},
        journeys:{open:()=>this.journeys.panel.open(this.journeys.selected),close:()=>this.journeys.panel.close()},
        event: { open: () => { if(this.activeRiftPortal)this.riftPanel.open(this.sim.expeditions,this.sim.player,this.activeRiftPortal); else if(this.activeExpeditionTable)this.expeditionPanel.open(this.sim.expeditions,this.sim.player.level,this.overworld.seed,this.activeExpeditionTable); else if(this.activeDungeonEntrance) this.eventPanel.openDungeon(this.activeDungeonEntrance); else if (this.activeEvent) this.eventPanel.open(this.activeEvent); else if (this.activeFlightMaster) this.flightPanel.open(this.activeFlightMaster, flightDestinations(this.sim, this.activeFlightMaster.id)); }, close: () => { this.eventPanel.close(); this.flightPanel.close(); this.expeditionPanel.close(); this.riftPanel.close(); this.activeRiftPortal=null; this.activeExpeditionTable=null; this.activeEvent = null; this.activeDungeonEntrance = null; this.activeFlightMaster = null; } },
        service: { open: () => { if (this.activeNPC) this.servicePanel.open(this.sim.player, this.activeNPC, this.overworld.seed); }, close: () => { this.servicePanel.close(); this.activeNPC = null; } },
        stable: { open: () => { this.stablePanel.open(this.activeStableMaster); this.shell.setStatus('Pet stable open. Game paused.'); }, close: () => { this.stablePanel.close(); this.activeStableMaster = null; } },
        arena: { open: () => { this.pvpPanel.open(this.activeBattlemaster); this.shell.setStatus('Arena & Battlegrounds open. Game paused.'); }, close: () => { this.pvpPanel.close(); this.activeBattlemaster = null; } },
        pvpVendor: { open: () => { if (this.activePvpVendor) this.pvpVendorPanel.open(this.sim.player, this.activePvpVendor); this.shell.setStatus('PvP quartermaster open. Game paused.'); }, close: () => { this.pvpVendorPanel.close(); this.activePvpVendor = null; } },
        badgeVendor: { open: () => { if (this.activeBadgeVendor) this.badgeVendorPanel.open(this.sim.player, this.activeBadgeVendor); this.shell.setStatus('Emblem quartermaster open. Game paused.'); }, close: () => { this.badgeVendorPanel.close(); this.activeBadgeVendor = null; } },
        map: { open: () => { const run=currentDungeon(this.sim.expeditions), glance=this.panels.mapHeld, focus=this.mapFocus; this.mapFocus=null; if(run) this.dungeonMap.open(this.sim.dungeonFloor!,run,this.sim.player,glance,this.sim.enemies); else this.worldMap.open(focus?{...focus,angle:0}:this.sim.player,glance); this.shell.setStatus(glance?'Exploration map open. Movement continues.':'World map open. Game paused.'); }, close: () => { this.worldMap.close(); this.dungeonMap.close(); this.mapFocus = null; } },
        character: { open: () => { this.inventoryPanel.open(this.sim.player); this.shell.setStatus('Character and inventory open. Game paused.'); }, close: () => this.inventoryPanel.close() },
        skills: { open: () => { this.skillPanel.open(this.sim.player); this.shell.setStatus('Skill tree open. Game paused.'); }, close: () => this.skillPanel.close() },
        achievements: { open: () => { this.achievementPanel.open(); this.shell.setStatus('Achievements open. Game paused.'); }, close: () => this.achievementPanel.close() },
        transmog: { open: () => { this.transmogPanel.open(); this.shell.setStatus('Transmogrify open. Game paused.'); }, close: () => this.transmogPanel.close() },
        questLog: { open: () => { const greeting = this.pendingGiver; if (greeting) this.questPanel.openGiver(greeting); else this.questPanel.open(); this.shell.setStatus('Quest log open. Game paused.'); }, close: () => { this.questPanel.close(); this.pendingGiver = null; } },
        professions: { open: () => { this.professionPanel.open(); this.shell.setStatus('Professions open. Game paused.'); }, close: () => this.professionPanel.close() },
        glyphs: { open: () => { this.glyphPanel.open(); this.shell.setStatus('Glyphs open. Game paused.'); }, close: () => this.glyphPanel.close() },
        spellbook: { open: () => { this.spellbookPanel.open(); this.shell.setStatus('Spellbook open. Game paused.'); }, close: () => this.spellbookPanel.close() },
        stats: { open: () => { this.statsPanel.open(); this.shell.setStatus('Character stats open. Game paused.'); }, close: () => this.statsPanel.close() },
        reputation: { open: () => { this.reputationPanel.open(); this.shell.setStatus('Reputation open. Game paused.'); }, close: () => this.reputationPanel.close() },
        calendar: { open: () => { this.calendarPanel.open(); this.shell.setStatus('Calendar open. Game paused.'); }, close: () => this.calendarPanel.close() },
        trainer: { open: () => { if (this.activeTrainer) this.trainerPanel.open(this.sim.player, this.activeTrainer); this.shell.setStatus('Class trainer open. Game paused.'); }, close: () => { this.trainerPanel?.close(); this.activeTrainer = null; } },
        quartermaster: { open: () => { if (this.activeQuartermaster) this.quartermasterPanel.open(this.sim.player, this.activeQuartermaster); this.shell.setStatus('Quartermaster open. Game paused.'); }, close: () => { this.quartermasterPanel?.close(); this.activeQuartermaster = null; } },
        socketing: { open: () => { this.socketingPanel.open(this.sim.player); this.shell.setStatus('Socketing open. Game paused.'); }, close: () => this.socketingPanel.close() },
        dungeonFinder: { open: () => { this.dungeonFinderPanel.open(this.sim.player); this.shell.setStatus('Dungeon Finder open. Game paused.'); }, close: () => this.dungeonFinderPanel.close() },
        auctionHouse: { open: () => { this.auctionPanel.open(this.sim.player); this.shell.setStatus('Auction House open. Game paused.'); }, close: () => this.auctionPanel.close() },
        guild: { open: () => { this.guildPanel.open(); this.guildPanel.update(this.sim.player); this.shell.setStatus('Guild open. Game paused.'); }, close: () => this.guildPanel.close() },
        mailbox: { open: () => { this.mailPanel.open(this.sim.player); this.shell.setStatus('Mailbox open. Game paused.'); }, close: () => this.mailPanel.close() },
        holiday: { open: () => { if (this.activeFaireSite) this.holidayPanel.open(this.sim, this.activeFaireSite, this.activeFaireBooths); this.shell.setStatus('Darkmoon Faire open. Game paused.'); }, close: () => { this.holidayPanel.close(); this.activeFaireVendor = null; } },
        net: { open: () => { this.netPanel.open(); this.shell.setStatus('Online co-op open. Game paused.'); }, close: () => this.netPanel.close() },
      }, {
        clearInput: preserveMovement => this.clearInput(preserveMovement), changed: phase => {
          if (phase !== this.audioPhase || phase === 'map') {
            if (phase !== 'dead' && this.audioPhase !== 'dead') this.audio.panel(!this.panels.simulationActive && phase !== 'ready');
            this.audioPhase = phase; this.nextScore = 0;
          }
          this.showMenu();
        },
        resumeGameplay: () => { this.journeys.refreshUI(); this.canvas.focus(); this.last = performance.now(); },
        save: () => { this.saveCharacter(); },
      });
      this.touch = this.lifetime.own(new TouchHUD(this.canvas.parentElement!, {
        activate: active => {
          if (active) this.shell.shortcutMenu.close(false);
          this.input.clear();
          // A fresh pad event switching away from touch must survive this presentation change.
          if(active || !this.usingGamepad) this.gamepad.clear();
          this.sim.clearInput(); this.usingGamepad = false; this.renderer.touchActive = active;
          if(this.touch) this.resize();
        },
        clearAttack: () => this.sim.clearBasicAttackInput(), cancelCombat: () => this.sim.clearCombatInput(),
        unlock: () => { void this.audio.unlock().catch(() => {}); }, notice: message => this.notify(message),
        menu: action => {
          if(this.savingAction || this.phase !== 'playing') return;
          if(this.sim.ghost && action !== 'pause' && action !== 'map' && action !== 'journeys' && action !== 'interact') return;
          if(action === 'pause') this.pause();
          else if(action === 'character') { this.openCharacterPanel('character'); this.inventoryPanel.openTouchTab('stats'); }
          else if(action === 'inventory') { this.openCharacterPanel('character'); this.inventoryPanel.openTouchTab('bag'); }
          else if(action === 'skills') this.openCharacterPanel('skills');
          else if(action === 'journeys') this.journeys.open();
          else if(action === 'map') this.openMap();
          else if(action === 'portal') this.requestPortal();
          else if(action === 'interact') this.interact();
        },
      }));
      this.thor = this.lifetime.own(new ThorRuntime({
        panelSound: open => this.audio.panel(open),
        get sim() { return game.sim; }, get phase() { return game.phase; },
        get session() { return game.session.active?.record ?? null; },
        get busy() { return game.savingAction || game.hallBusy; },
        get worldMap() { return game.worldMap; }, get seed() { return game.overworld.seed; },
        resume: () => this.resume(),
        panel: panel => { if(panel === 'journeys') this.journeys.open(); else if(panel === 'map') this.openMap(); else this.openCharacterPanel(panel); },
        equip: index => this.characterAction({type:'equip',index}),
        track: id => { void this.journeys.command({type:'track',id}); },
        portal: () => this.requestPortal(),
        background: () => {
          this.clearInput(); this.pause(); void this.saveCharacter(); this.nativeBackground = true; this.audio.setForeground(false); this.performance.suspend();
          if (this.animation) { cancelAnimationFrame(this.animation); this.animation = 0; }
        },
        foreground: () => {
          this.clearInput(); this.nativeBackground = false; this.audio.setForeground(!document.hidden);
          if (!document.hidden && !this.animation) {
            this.last = performance.now();
            this.animation = requestAnimationFrame(this.frame);
          }
        },
        back: () => { if(this.phase === 'ready' && this.titleScreen.dismissOverlay()) return; if(this.appearanceEditor){this.appearanceEditor.cancel();return;} if(this.thor.dismissInspection() || (this.phase === 'paused' && this.shell.backInMenu())) return; if(this.phase === 'playing') this.pause(); else if(this.phase !== 'ready' && this.phase !== 'dead') this.resume(); },
      }));
      this.fx = this.lifetime.own(new PostFX(this.canvas));
      try {
        const saved = JSON.parse(localStorage.getItem('evergrow-preferences') ?? 'null');
        if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
        if (saved?.groundLootNames === 'ctrl') this.groundLootNames = 'ctrl';
        if (saved?.lootFilter === 'hideCommon' || saved?.lootFilter === 'hideBelowRare' || saved?.lootFilter === 'hideBelowEpic') this.lootFilter = saved.lootFilter;
        for (const channel of ['master', 'sfx', 'music'] as const) this.audio.setVolume(channel, audioVolume(saved?.[channel], DEFAULT_AUDIO[channel]));
      } catch { /* Preferences are optional when storage is disabled. */ }
      // Presentation is fixed and motion follows the OS.
      this.savePreferences();
      this.audio.setEnabled(!this.muted);
      this.resize();
      this.bind();
      this.showMenu();
      this.saveClient.chart = record => this.session.active?.record.id === record.id ? this.exploration.snapshot() : undefined;
      this.saveClient.onChange = state => {
        if (this.disposed) return;
        this.titleScreen.setSource(state);
        if (state.mode === 'cloud' && this.session?.active) {
          const save = this.saveClient.statusForSlot(this.session.active.index);
          this.shell.setSaveStatus(save.message || save.status, !['Synced', 'Saving…'].includes(save.status));
        }
      };
      this.titleScreen.setSource({ ...this.saveClient.state, supported: !!import.meta.env.VITE_SITE_CLOUD && !window.EvergrowAndroid, mode: import.meta.env.VITE_SITE_CLOUD && !window.EvergrowAndroid ? 'cloud' : 'local', status: 'Loading…' });
      this.titleScreen.open([]);
      void this.saveClient.initialize().then(() => this.loadRoster());
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      try { this.lifetime.dispose(); } catch (cleanupError) { console.error(cleanupError); }
      throw error;
    }
  }

  private bind() {
    const signal = this.abort.signal;
    this.clearWorldTouch = bindTouchCanvas(this.canvas,signal,{
      enabled:()=>this.phase==='playing' && !this.savingAction && this.touch.active,
      pan:()=>{},
      zoom:factor=>{if(this.phase==='playing'&&!this.savingAction)this.renderer.zoomByWheel(-Math.log(factor)/.0016,0,this.canvas.getBoundingClientRect().height);},
      tap:point=>{
        if(this.phase!=='playing'||this.savingAction)return;
        const r=this.canvas.getBoundingClientRect();
        if(this.interact(this.renderer.screenToWorld(point.x*this.renderer.width/r.width,point.y*this.renderer.height/r.height))) this.touch.clear();
      },
    });
    window.addEventListener('pagehide', () => { this.performance.suspend(); this.audio.setForeground(false); this.clearInput(); void this.saveAndSync(); }, { signal });
    window.addEventListener('focus', () => this.clearInput(), { signal });
    window.addEventListener('pageshow', () => {
      this.audio.setForeground(!document.hidden && !this.nativeBackground);
      if (!document.hidden && !this.nativeBackground && !this.animation) {
        this.last = performance.now();
        this.animation = requestAnimationFrame(this.frame);
      }
    }, { signal });
    const unlockAudio = () => { void this.audio.unlock().catch(() => {}); };
    window.addEventListener('pointerdown', unlockAudio, { signal, capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { signal, capture: true });
    this.canvas.addEventListener('blur', () => { if (this.phase !== 'map') this.clearInput(); }, { signal });
    window.addEventListener('resize', () => this.resize(), { signal });
    window.visualViewport?.addEventListener('resize', () => { if(this.touch.active) this.resize(); }, {signal});
    window.addEventListener('blur', () => {
      this.mouse.present = false;
      this.clearInput();
      if (this.phase === 'playing' || this.phase === 'map') this.pause();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      this.audio.setForeground(!document.hidden && !this.nativeBackground);
      if (document.hidden) {
        this.performance.suspend();
        this.clearInput();
        if (this.phase === 'playing' || this.phase === 'map') this.pause();
        void this.saveAndSync();
        if (this.animation) { cancelAnimationFrame(this.animation); this.animation = 0; }
      } else {
        this.last = performance.now();
        if (!this.animation && !this.nativeBackground) {
          this.animation = requestAnimationFrame(this.frame);
        }
      }
    }, { signal });
    bindGameKeyboard(window, {
      clear: () => { this.clearInput(); this.panels.releaseMap(); },
      release: code => { this.input.keyUp(code); if (code === 'Tab') this.panels.releaseMap(); },
      intercept: event => {
        if (this.performanceMonitor.contains(event.target)) return false;
        if (!this.panels.mapHeld || event.defaultPrevented || this.appearanceEditor) return false;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
          || target instanceof HTMLElement && target.isContentEditable) return false;
        // Controller-generated events never feed the keyboard adapter.
        if (!event.isTrusted && this.usingGamepad) return false;
        const action = controls.action(event.code);
        if (event.code === 'Tab' && this.panels.mapHeld) return true;
        if (isGameplayAction(action)) {
          if (!this.savingAction) {
            if (event.isTrusted) { this.usingGamepad = false; this.touch.setActive(false); }
            this.input.keyDown(event.code);
          }
          return true;
        }
        if (action === 'map' && event.code !== 'Tab') {
          if (!event.repeat && !this.savingAction) this.panels.toggleMap();
          return true;
        }
        return false;
      },
      press: event => {
        if(this.appearanceEditor || event.defaultPrevented)return;
        if (this.savingAction) { event.preventDefault(); return; }
        if (event.isTrusted && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable)) { this.usingGamepad = false; this.touch.setActive(false); }
        if (event.code === 'Escape') {
          event.preventDefault();
          this.input.clearTarget();
          if (this.phase === 'ready' && this.titleScreen.dismissOverlay()) {event.stopPropagation();return;}
          if(this.phase==='chronicle'){event.stopPropagation();if(!event.repeat)this.resume();return;}
          if (!event.repeat) {
            if (uiEditMode()) { this.uiLayoutPanel.close(); setUiEditMode(false); return; }
            if (this.sim.portal.active) { this.sim.portal.cancel(); return; }
            if (this.pvpScorePanel.opened) { this.pvpScorePanel.close(); return; }
            if (this.panels.activePanel) this.resume();
            else if (this.phase === 'playing') this.pause();
            else if (this.phase === 'paused' && !this.shell.backInMenu()) this.resume();
          }
          return;
        }
        const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
          || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
        if (typing) return;
        if (event.code === 'Backquote' && !event.repeat && this.phase !== 'ready' && this.phase !== 'dead') { this.chatFrame.toggle(); event.preventDefault(); return; }
        if ((this.panels.activePanel || event.target instanceof HTMLButtonElement) && ['Tab', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete'].includes(event.code)) return;
        if (this.controlShortcut(controls.action(event.code), event.repeat, event.code === 'Tab')) { event.preventDefault(); return; }
        // Native menu controls retain their ordinary keyboard behavior.
        if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement
          || event.target instanceof HTMLButtonElement) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
        if (event.repeat) return;
        if (event.code === 'Enter' && (this.phase === 'dead' || this.phase === 'paused')) {
          event.preventDefault();
          this.phase === 'paused' ? this.resume() : this.start();
          return;
        }
        // WoW-style chat: Enter opens the edit box only while playing; the box
        // swallows every key until Enter/Escape closes it (chat-input.ts).
        if (event.code === 'Enter' && this.phase === 'playing' && GAME_FEATURES.combatLog
          && this.chatInput.show({ width: this.renderer.width, height: this.renderer.height })) {
          event.preventDefault();
          return;
        }
        if (event.code === 'KeyR' && this.phase === 'dead') { this.start(); return; }
        if (this.phase !== 'playing') return;
        if (controls.action(event.code)) event.preventDefault();
        this.input.keyDown(event.code);
      },
    }, signal);
    // Window-level tracking also follows the pointer across the DOM HUD buttons.
    window.addEventListener('pointermove', event => { if(event.pointerType !== 'touch') { this.updatePointer(event); if (hotbarPointerMove(this.mouse.x, this.mouse.y)) return; } }, { signal });
    this.canvas.addEventListener('pointerleave', () => { this.mouse.present = false; }, { signal });
    this.canvas.addEventListener('wheel', event => {
      if (!this.panels.simulationActive || event.ctrlKey || event.metaKey) return;
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      event.preventDefault();

      if (this.panels.mapHeld) {
        const map = currentDungeon(this.sim.expeditions) ? this.dungeonMap : this.worldMap;
        map.zoomExplorationByWheel(event.deltaY, event.deltaMode);
        return;
      }
      this.renderer.zoomByWheel(event.deltaY, event.deltaMode, this.canvas.getBoundingClientRect().height);
    }, { signal, passive: false });
    this.canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && this.panels.simulationActive && !this.savingAction) this.canvas.setPointerCapture(event.pointerId);
    }, { signal });
    window.addEventListener('pointerup', event => {
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, { signal });
    this.canvas.addEventListener('mousedown', event => {
      if (this.touch.active) return;
      if (!this.panels.simulationActive || this.savingAction) return;
      event.preventDefault();
      this.updatePointer(event);
      if (event.button === 0 && this.renderer.navigationVisible && !currentDungeon(this.sim.expeditions)
        && GAME_FEATURES.minimapTracking
        && this.minimapTracking.handleClick(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height)) return;
      if (event.button === 0 && hotbarPointerDown(this.bars, this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height)) return;
      if (event.button === 0) {
        const slot = actionBarSlotAt(this.bars, this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height);
        if (slot !== null) { this.activateBarSlot(slot); return; }
      }
      if (this.pointerInHUD()) return;
      if (event.button === 0 && this.interact(this.renderer.screenToWorld(this.mouse.x, this.mouse.y))) return;
      this.canvas.focus();
      if (this.controlShortcut(controls.action(`Mouse${event.button}`), false)) return;
      this.input.clickTarget(this.renderer.hoveredEnemyId);
      this.input.pointerDown(event.button);
      void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    }, { signal });
    window.addEventListener('mouseup', event => {
      hotbarPointerUp();
      this.input.pointerUp(event.button);
    }, { signal });
    this.canvas.addEventListener('auxclick', event => { event.preventDefault(); }, { signal });
    this.canvas.addEventListener('pointercancel', () => { hotbarPointerUp(); this.clearInput(); }, { signal });
  }

  private controlShortcut(action: ControlAction | undefined, repeat: boolean, tab = false): boolean {
    // Tab navigates focused interfaces, even when it is a gameplay binding.
    if (tab && this.phase !== 'playing') return false;
    // A released spirit keeps the map and logs but cannot open mutating panels or act.
    if (this.sim.ghost && action && !['map', 'journeys', 'questLog', 'achievements', 'stats', 'reputation', 'chronicle', 'interact', 'sound', 'debug', 'nameplates'].includes(action)) return true;
    if ((action === 'character' || action === 'skills') && this.panels.canOpen(action)) {
      if (!repeat) this.panels.toggle(action); return true;
    }
    if (action === 'journeys' && (this.panels.canOpen('journeys') || this.phase === 'journeys')) {
      if (!repeat) { if (this.phase === 'journeys') this.resume(); else this.journeys.open(); } return true;
    }
    if (action === 'map' && (this.panels.canOpen('map') || this.phase === 'map')) {
      if (!repeat) { if (tab) this.panels.holdMap(); else this.panels.toggleMap(); } return true;
    }
    if (action === 'questLog' && GAME_FEATURES.quests && (this.panels.canOpen('questLog') || this.phase === 'questLog')) { if (!repeat) this.panels.toggle('questLog'); return true; }
    if (action === 'pvpScore' && this.panels.simulationActive && currentPvpMatch(this.sim)) {
      if (!repeat) {
        if (this.pvpScorePanel.opened) this.pvpScorePanel.close();
        else this.pvpScorePanel.open(currentPvpMatch(this.sim)!, pvpScoreboard(this.sim));
      }
      return true;
    }
    if (action === 'professions' && GAME_FEATURES.professions && (this.panels.canOpen('professions') || this.phase === 'professions')) { if (!repeat) this.panels.toggle('professions'); return true; }
    if (action === 'achievements' && GAME_FEATURES.achievements && (this.panels.canOpen('achievements') || this.phase === 'achievements')) { if (!repeat) this.panels.toggle('achievements'); return true; }
    if (action === 'spellbook' && GAME_FEATURES.spellbook && (this.panels.canOpen('spellbook') || this.phase === 'spellbook')) { if (!repeat) this.panels.toggle('spellbook'); return true; }
    if (action === 'stats' && GAME_FEATURES.stats && (this.panels.canOpen('stats') || this.phase === 'stats')) { if (!repeat) this.panels.toggle('stats'); return true; }
    if (action === 'reputation' && GAME_FEATURES.reputation && (this.panels.canOpen('reputation') || this.phase === 'reputation')) { if (!repeat) this.panels.toggle('reputation'); return true; }
    if (action === 'transmog' && GAME_FEATURES.transmog && (this.panels.canOpen('transmog') || this.phase === 'transmog')) { if (!repeat) this.panels.toggle('transmog'); return true; }
    if (action === 'dungeonFinder' && GAME_FEATURES.dungeonFinder && (this.panels.canOpen('dungeonFinder') || this.phase === 'dungeonFinder')) { if (!repeat) this.panels.toggle('dungeonFinder'); return true; }
    if (action === 'auctionHouse' && GAME_FEATURES.auctionHouse && (this.panels.canOpen('auctionHouse') || this.phase === 'auctionHouse')) { if (!repeat) this.panels.toggle('auctionHouse'); return true; }
    if (action === 'guild' && GAME_FEATURES.guilds && (this.panels.canOpen('guild') || this.phase === 'guild')) { if (!repeat) this.panels.toggle('guild'); return true; }
    if (action === 'calendar' && (this.panels.canOpen('calendar') || this.phase === 'calendar')) { if (!repeat) this.panels.toggle('calendar'); return true; }
    if (action === 'net' && (this.panels.canOpen('net') || this.phase === 'net')) { if (!repeat) this.panels.toggle('net'); return true; }
    // The damage meter is a non-modal overlay: it toggles without pausing the sim.
    if (action === 'damageMeter') { if (!repeat) this.damageMeterPanel.toggle(); return true; }
    if (action === 'nameplates') { if (!repeat) this.notify(`Enemy nameplates: ${cycleNameplateMode()}`); return true; }
    if (action === 'editLayout') { if (!repeat) this.uiLayoutPanel.toggle(); return true; }

    if (action === 'sound') { if (!repeat) this.toggleSound(); return true; }
    if (action === 'debug') { if (!repeat && this.phase !== 'ready') this.performanceMonitor.setOpen(!this.performanceMonitor.isOpen); return true; }
    if (!this.panels.simulationActive) return false;
    if (action === 'portal') { if (!repeat) this.requestPortal(); return true; }
    if (action === 'interact') { if (!repeat) this.interact(); return true; }
    if (action === 'mount') { if (!repeat) this.toggleMount(); return true; }
    if (action === 'hearthstone') { if (!repeat) this.castHearthstone(); return true; }
    if (action === 'petCommand') { if (!repeat) this.cyclePetCommand(); return true; }
    return false;
  }

  private updatePointer(event: { clientX: number; clientY: number; target?: EventTarget | null }) {
    this.pointerOverEffects = event.target instanceof Element && !!event.target.closest('.buff-bar, .ui-explanation');
    this.usingGamepad = false;
    this.input.movePointer(event.clientX, event.clientY, this.canvas.getBoundingClientRect(),
      this.renderer.width, this.renderer.height);
    this.syncPerformanceInput();
    this.canvas.classList.toggle('hud-hover', this.pointerInHUD());
    this.worldMap.setMinimapPointer({ x: this.mouse.x, y: this.mouse.y });
  }

  private syncPerformanceInput() {
    const bounds = this.performanceMonitor.bounds;
    this.renderer.performanceUIBounds = bounds
      ? projectUIRect(bounds, this.canvas.getBoundingClientRect(), this.renderer.width, this.renderer.height) : null;
    const blocked = !this.usingGamepad && !this.touch?.active && this.mouse.present
      && isUIRectPoint(this.mouse.x, this.mouse.y, this.renderer.performanceUIBounds);
    if (this.input.setPointerUIBlocked(blocked)) this.sim.clearInput();
  }

  private pointerInHUD() {
    return this.pointerOverEffects || this.chatFrame.contains(this.mouse.x, this.mouse.y)
      || (this.renderer.navigationVisible && !currentDungeon(this.sim.expeditions)
        && (GAME_FEATURES.minimapTracking
        && this.minimapTracking.covers(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height)))
      || isGameUIPoint(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height,this.renderer.extraUIBounds,this.renderer.navigationVisible,this.renderer.performanceUIBounds)
      || isActionBarPoint(this.bars, this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height);
  }

  private resize() {
    this.touch?.clear(); this.clearWorldTouch?.();
    document.documentElement.style.setProperty('--touch-vh', `${window.visualViewport?.height ?? window.innerHeight}px`);
    const viewport = presentationViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      visualHeight: window.visualViewport?.height ?? window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      touchActive: !!this.touch?.active,
      profile: this.presentation,
    });
    this.canvas.width = viewport.worldBufferWidth;
    this.viewW = viewport.logicalWidth; this.viewH = viewport.logicalHeight;
    this.renderer.resize(viewport.logicalWidth, viewport.logicalHeight);
    // A live split must re-carve both halves from the new full width.
    if (this.coopSplit && this.renderer2) {
      const halfW = Math.floor(this.viewW / 2);
      this.renderer.resize(halfW, this.viewH);
      this.renderer2.resize(this.viewW - halfW, this.viewH);
    }
    // UI is rasterized at the display's native density, independently of the world buffer.
    this.uiCanvas.width = viewport.uiBufferWidth;
    this.uiCanvas.height = viewport.uiBufferHeight;
    this.renderer.resize(viewport.logicalWidth, viewport.logicalHeight);
    this.renderer.cursorPixelScale = { x: this.renderer.width / viewport.width, y: this.renderer.height / viewport.height };
    this.touch?.refreshLayout();
    this.renderer.touchViewport = this.touch?.viewport ?? null;
    this.renderer.touchTopInset = (this.touch?.safeTop ?? 0) * this.renderer.height / viewport.height;
    this.sim.setSpawnExclusion(this.coopSpawnExclusion());
    this.sim.setCombatViewport(this.renderer.combatViewport);
    this.mouse.x = this.renderer.width * 0.6;
    this.mouse.y = this.renderer.height * 0.43;
    this.shell.resizeControls(this.renderer.width, this.renderer.height);
    this.worldMap.resize();
    this.journeys.panel.resize(this.renderer.width, this.renderer.height);
  }

  /** Renders the world for the frame. Solo and shared-camera co-op draw once;
   * when the two players separate beyond what the shared camera can frame, the
   * screen splits into two half-width viewports composited side by side. */
  private renderCoopWorld(dt: number, settings: Parameters<Renderer['render']>[3]): HTMLCanvasElement {
    // Split-screen is couch co-op only. A net host also has sim.coop (the remote
    // partner is seated via enterCoop) but must keep its own single full view.
    const p2 = this.sim.coop && this.sim.netMode === null ? this.sim.players[1] : null;
    if (!p2) {
      // Co-op ended (or never started): restore the single full-width view.
      if (this.coopSplit) this.layoutSplit(false);
      this.coopSplit = false;
      this.renderer.splitActive = false;
      this.renderer.subject = null;
      this.renderer.render(this.sim, this.world, dt, settings);
      return this.renderer.canvas;
    }
    // Decide shared vs split from whether the shared camera can still frame both.
    const frameable = Math.min(
      this.viewW / 2 / (Math.abs(p2.x - this.sim.player.x) / 2 + 140),
      this.viewH / 2 / (Math.abs(p2.y - this.sim.player.y) / 2 + 110));
    // Hysteresis: split when the needed zoom drops below the floor, rejoin with margin.
    const wantSplit = this.coopSplit ? frameable < 1.05 : frameable < 0.82;
    if (wantSplit !== this.coopSplit) this.layoutSplit(wantSplit);
    if (!this.coopSplit || !this.renderer2) {
      this.renderer.render(this.sim, this.world, dt, settings);
      return this.renderer.canvas;
    }
    // Split: render each player's view into its half-width canvas, composite.
    this.renderer.render(this.sim, this.world, dt, settings);
    this.renderer2.render(this.sim, this.world, dt, settings);
    const w = this.renderer.width + this.renderer2.width, h = this.renderer.height;
    if (!this.splitCanvas) this.splitCanvas = document.createElement('canvas');
    if (this.splitCanvas.width !== w || this.splitCanvas.height !== h) {
      this.splitCanvas.width = w; this.splitCanvas.height = h;
    }
    const ctx = this.splitCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.renderer.canvas, 0, 0);
    ctx.drawImage(this.renderer2.canvas, this.renderer.width, 0);
    // Divider seam between the two views.
    ctx.fillStyle = '#050a0e';
    ctx.fillRect(this.renderer.width - 1, 0, 2, h);
    return this.splitCanvas;
  }

  /** Spawn exclusion covering every live camera. Solo and shared-camera co-op
   * use the primary renderer's envelope; a split adds the second renderer's
   * view so enemies never materialize on P2's half of the screen. */
  private coopSpawnExclusion() {
    const primary = this.renderer.spawnExclusionBounds(this.sim.player);
    const p2 = this.sim.coop && this.coopSplit && this.renderer2 ? this.sim.players[1] : null;
    if (!p2) return primary;
    const second = this.renderer2!.spawnExclusionBounds(p2);
    const x = Math.min(primary.x, second.x), y = Math.min(primary.y, second.y);
    return { x, y, width: Math.max(primary.x + primary.width, second.x + second.width) - x,
      height: Math.max(primary.y + primary.height, second.y + second.height) - y };
  }

  /** Lay out the shared/split world views. Entering split saves the wheel zoom
   * and halves both renderers across the full logical width; leaving restores
   * the primary renderer to full width and its saved zoom. */
  private layoutSplit(split: boolean) {
    this.coopSplit = split;
    this.renderer.splitActive = split;
    if (split) {
      const p2 = this.sim.players[1];
      this.savedZoom = this.renderer.zoomTarget;
      this.renderer2 ??= new Renderer(true, this.performance);
      this.renderer2.splitActive = true;
      this.renderer.subject = this.sim.player;
      this.renderer2.subject = p2;
      const halfW = Math.floor(this.viewW / 2);
      this.renderer.resize(halfW, this.viewH);
      this.renderer2.resize(this.viewW - halfW, this.viewH);
      this.renderer.snapTo(this.sim.player);
      this.renderer2.snapTo(p2);
    } else {
      this.renderer.subject = null;
      if (this.renderer2) this.renderer2.splitActive = false;
      this.renderer.resize(this.viewW, this.viewH);
      if (this.savedZoom !== undefined) { this.renderer.zoomTarget = this.savedZoom; this.savedZoom = undefined; }
      this.renderer.snapTo(this.sim.player);
    }
  }

  clearInput(preserveMovement = false) {
    this.chatInput?.close();
    this.touch?.clear(); this.clearWorldTouch?.();
    this.input.clear(preserveMovement);
    if (!preserveMovement) { this.gamepad.clear(); clearNativeController(); }
    this.gamepadMenu.clear();
    this.sim.clearInput(preserveMovement);
  }

  /** Defeat recovery keeps the character, allocations and loot; it never creates a new run. */
  async start() {
    if (this.disposed || this.phase !== 'dead' || !this.session.active) return;
    if(this.sim.dungeonFloor && !await this.switchDungeon({kind:'death'})) return;
    this.sim.revive(); this.enterWorld(); this.saveCharacter();
  }

  /** Release Spirit: the ghost wakes at the nearest settlement's spirit healer. */
  private releaseSpirit() {
    if (this.phase !== 'dead' || this.savingAction) return;
    const p = this.sim.player;
    const town = this.overworld.getNearestSettlement(p.x, p.y);
    const anchor = townPortalAnchor(town);
    if (!this.sim.releaseSpirit({ x: anchor.x, y: anchor.y, name: town.name })) return;
    this.enterWorld();
    this.notify(`Your spirit releases at ${town.name}. Return to your corpse to resurrect.`);
  }

  /** Ghost resurrection: at the corpse for a light penalty, at the healer for the heavy one. */
  private resurrectGhost(mode: 'corpse' | 'healer', player: Player = this.sim.player) {
    // Run as the acting player so a co-op partner's ghost resolves to their own
    // corpse/healer — a dead P2 resurrects themselves, not P1.
    this.sim.asPlayer(player, () => {
      if (!this.sim.ghost || this.savingAction) return;
      // A net client can't resurrect itself — the host owns the authoritative
      // sim, so forward the request and let the next snapshot apply the result.
      if (this.sim.netMode === 'client') {
        (this.net as import('./net-client.ts').NetClientSession | null)?.requestResurrect(mode);
        return;
      }
      const revived = mode === 'corpse' ? this.sim.resurrectAtCorpse() : this.sim.resurrectAtHealer();
      if (revived) { this.canvas.focus(); this.saveCharacter(); }
    });
  }

  /** Co-op death: each downed overworld player releases as a ghost at their
   * nearest spirit healer (WoW corpse run) while a teammate still stands.
   * Dungeon deaths keep the classic corpse/defeat flow (no release). */
  private releaseCoopSpirits() {
    for (const p of this.sim.players) {
      if (!p.dead || this.sim.ghostOf(p) || this.sim.dungeonFloor || this.sim.expeditions.location) continue;
      const town = this.overworld.getNearestSettlement(p.x, p.y);
      const anchor = townPortalAnchor(town);
      if (this.sim.releaseSpiritFor(p, { x: anchor.x, y: anchor.y, name: town.name }))
        this.notify(`${p.name ?? 'Your partner'}'s spirit releases at ${town.name}.`);
    }
  }
  /** Drop the co-op partner and continue solo. Restores single-renderer layout,
   * clears the partner's pad and returns focus to the primary player. */
  private leaveCoop() {
    // Persist the partner's progress to their own slot before dropping them.
    void this.saveCoopPartner();
    const partner = this.sim.exitCoop();
    if (!partner) return;
    if (this.coopSplit) { this.layoutSplit(false); this.coopSplit = false; }
    this.gamepad2.clear(); this.gamepad2.padIndex = null;
    this.renderer.reset(); this.renderer.snapTo(this.sim.player);
    this.resume();
    this.shell.setStatus(`${partner.name ?? 'Player 2'} left — continuing solo.`);
  }

  // ── Online co-op (wayfinder/T03) ───────────────────────────────────────────

  /** Host an online session: open a relay channel in a fresh room, then seat
   * remote players as they join. The host keeps the authoritative sim. */
  private async netHost(address: string) {
    if (this.net || this.savingAction) return;
    // Hosting requires a clean overworld footing: not dead, not in a dungeon or
    // PvP match, and not already sharing the couch with a local partner.
    if (this.sim.player.dead || this.sim.ghost || this.sim.dungeonFloor || this.sim.pvpCombatants || this.sim.coop) {
      this.netPanel.setStatus('Return to the overworld, alive and solo, before hosting.');
      return;
    }
    const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    this.netPanel.setStatus('Connecting to relay…');
    try {
      const channel = await connectWebSocket(`${address}/?room=${code}`);
      const session = new NetHostSession(this.sim);
      session.onPeerLeft = name => this.notify(`${name} left the session.`);
      // The relay uplink dropped: the room is unreachable, so clear the session
      // and let the player re-host instead of sitting on a dead socket.
      session.onClosed = () => { this.net = null; this.netPanel.setConnected(false); this.netPanel.setStatus('Relay connection lost.'); this.notify('Online session ended — relay connection lost.'); };
      session.attach(channel);
      this.net = session;
      this.netPanel.setRoom(code);
      this.netPanel.setConnected(true);
      this.netPanel.setStatus(`Hosting — share code ${code}`);
      this.notify(`Hosting online co-op. Share code ${code}.`);
    } catch {
      this.netPanel.setStatus('Could not reach the relay. Start it with: npm run net:relay');
    }
  }
  private async netJoin(code: string, address: string) {
    if (this.net || this.savingAction) return;
    // Joining requires a clean overworld footing: not dead, not in a dungeon or
    // PvP match, and not already sharing the couch with a local partner.
    if (this.sim.player.dead || this.sim.ghost || this.sim.dungeonFloor || this.sim.pvpCombatants || this.sim.coop) {
      this.netPanel.setStatus('Return to the overworld, alive and solo, before joining.');
      return;
    }
    this.netPanel.setStatus('Joining…');
    const session = new NetClientSession(this.sim);
    try {
      const channel = await connectWebSocket(`${address}/?room=${code}`);
      const checkpoint = this.sim.captureCheckpoint();
      // Park the client's own checkpoint: restored on leave so no host world
      // state (enemies, time, kills, camps, position) leaks into the solo game.
      this.netPreJoin = checkpoint;
      const hello: MsgHello = { type: 'hello', version: NET_PROTOCOL_VERSION,
        name: this.sim.player.name ?? 'Player', player: playerFieldsOf(checkpoint) };
      const welcome = await session.connect(channel, hello);
      // The world must match the host's exactly — seed AND generation version —
      // or the client's geography silently desyncs from the host's.
      if (welcome.worldVersion !== this.overworld.generationVersion) {
        throw new Error(`World version mismatch (host ${welcome.worldVersion}, yours ${this.overworld.generationVersion}).`);
      }
      if (welcome.worldSeed !== this.overworld.seed) this.swapToNetWorld(welcome.worldSeed);
      session.applyWorld();
      session.onKick = reason => { this.netLeave(true); this.notify(`Disconnected: ${reason}`); };
      session.onDisconnect = () => { this.netLeave(true); this.notify('Connection to host lost.'); };
      this.net = session;
      this.netPanel.setConnected(true);
      this.netPanel.setStatus(`Connected to ${code}.`);
      this.notify(`Joined ${session.worldSeed === this.overworld.seed ? 'the host' : 'a new world'} — playing together.`);
    } catch (err) {
      // A failed join must not leave a live orphaned session behind, nor a
      // parked world swap: restore the client's own world + checkpoint so a
      // later join/leave doesn't resurrect stale host geography.
      session.leave();
      this.restoreNetWorld();
      if (this.netPreJoin) { const c = this.netPreJoin; this.netPreJoin = null; this.sim.restoreCheckpoint(c); }
      this.netPanel.setStatus(err instanceof Error ? err.message : 'Could not join that session.');
    }
  }

  /** Point the client at a host world built from a different seed. The client's
   * own overworld/map/exploration are parked and restored by restoreNetWorld. */
  private swapToNetWorld(seed: number) {
    if (this.netWorldSwap) return; // already swapped
    this.netWorldSwap = { overworld: this.overworld, exploration: this.exploration, worldMap: this.worldMap };
    this.overworld = createWorld(seed);
    this.world = this.overworld;
    this.sim.world = this.overworld;
    // A guest's exploration is session-only — it must not write to the client's
    // own chart or fire discovery/quest/achievement hooks for the host's world.
    this.exploration = new Exploration(this.overworld, { storage: null });
    this.worldMap = this.buildWorldMap(this.overworld, this.exploration);
    this.worldMap.resize();
  }

  /** Restore the client's own overworld/map/exploration after a net session. */
  private restoreNetWorld() {
    const swap = this.netWorldSwap;
    if (!swap) return;
    this.netWorldSwap = null;
    this.overworld.dispose(); // the host world is disposable after the session
    this.exploration.dispose();
    this.worldMap.dispose();
    this.overworld = swap.overworld;
    this.exploration = swap.exploration;
    this.worldMap = swap.worldMap;
    this.world = this.overworld;
    this.sim.world = this.overworld;
    this.worldMap.resize();
  }
  private netLeave(quiet = false) {
    if (!this.net) return;
    this.net.leave();
    this.net = null;
    this.restoreNetWorld();
    // Restore the client's own pre-join checkpoint so no host world state —
    // puppet enemies, host time/kills/camps, host position — leaks into the
    // solo game or its autosave. restoreCheckpoint also unsticks the player.
    if (this.netPreJoin) {
      const checkpoint = this.netPreJoin;
      this.netPreJoin = null;
      this.sim.restoreCheckpoint(checkpoint);
      this.renderer.snapTo(this.sim.player);
    }
    this.netPanel.setConnected(false);
    this.netPanel.setStatus('Left session.');
    if (!quiet) this.notify('Left online co-op.');
  }

  private closeAppearanceEditor() {
    this.appearanceEditor?.dispose();this.appearanceEditor=undefined;this.clearInput();
    if(this.disposed)return;
    this.titleScreen.setEditorOpen(false, this.appearanceFromHall);
    this.appearanceFromHall = false;
    if (this.appearanceFromPause) { this.appearanceFromPause = false; if (this.phase === 'character') this.panels.resume(); }
    else if(this.phase==='character'){this.inventoryPanel.open(this.sim.player);this.inventoryPanel.element.querySelector<HTMLButtonElement>('[data-edit-appearance]')?.focus();}
  }
  private editAppearance(fromPause = false) {
    if(this.phase!=='character'||this.savingAction||this.appearanceEditor||!this.session.active)return;
    this.appearanceFromPause = fromPause;
    this.inventoryPanel.close();this.clearInput();
    this.appearanceEditor=createAppearanceEditor(this.shell.panelMount,{sheet:this.sim.player.character,name:this.session.active.record.name,
      onCancel:()=>this.closeAppearanceEditor(),
      onSave:look=>this.durable(async()=>{
        const result=await executeAppearanceChange(this.sim.player,look,async character=>{
          const checkpoint=this.sim.captureCheckpoint();checkpoint.character=character;
          const ok=await this.session.save(checkpoint,Date.now());return {ok,message:this.session.error};
        });
        if(result.ok)this.closeAppearanceEditor();return result;
      },{ok:false,message:'A save is already in progress.'}),
    });
  }
  private editHallAppearance(selected: SaveSlot) {
    if (this.phase !== 'ready' || this.hallBusy || this.appearanceEditor || this.disposed || !selected.record || selected.conflict) return;
    const slot = structuredClone(selected), record = slot.record!;
    let refreshOnCancel = false;
    this.appearanceFromHall = true;
    this.titleScreen.setEditorOpen(true); this.clearInput();
    this.appearanceEditor = createAppearanceEditor(this.shell.panelMount, {
      sheet: record.checkpoint.character, name: record.name,
      onCancel: () => { this.closeAppearanceEditor(); if (refreshOnCancel && !this.disposed) this.titleScreen.refreshSelected(); },
      onSave: async look => {
        if (this.hallBusy || this.disposed) return {ok:false, message:'A save is already in progress.'};
        this.hallBusy = true;
        try {
          const result = await executeSavedAppearanceChange(this.session.repository, slot, look, Date.now());
          refreshOnCancel = !result.ok;
          if (result.ok && !this.disposed) {
            this.titleScreen.updateSlot({...slot, record:result.record, token:result.token});
            this.closeAppearanceEditor();
          }
          return result;
        } finally { this.hallBusy = false; }
      },
    });
  }
  private async createCharacter(index: number, name: string, classId: WowClassId, raceId: WowRaceId, seed: number, look: CharacterLook, coop?: CoopEntry): Promise<boolean> {
    if (this.phase !== 'ready' || this.hallBusy || this.disposed) return false;
    if (!isWorldSeed(seed)) { this.titleScreen.message('Enter a whole world seed from 0 to 4294967295.'); return false; }
    if (!validCharacterLook(look)) return false;
    const world = createWorld(seed);
    const fresh = new Simulation(world, { seed, spawn: false });
    const created = createPlayerCharacter(fresh.player, name, classId, raceId, structuredClone(look));
    if (!created.ok) { this.titleScreen.message(created.message ?? 'Could not create character.'); world.dispose(); return false; }
    const checkpoint = fresh.captureCheckpoint(); world.dispose();
    this.hallBusy = true;
    try {
      if (!await this.session.create(index, name, seed, checkpoint, crypto.randomUUID(), Date.now())) {this.titleScreen.message(this.session.error);return false;}
    } finally {this.hallBusy=false;}
    await this.continueCharacter(index, undefined, coop);
    return true;
  }

  private async continueCharacter(index: number, recoveryToken?: string, coop?: CoopEntry) {
    if (this.phase !== 'ready' || this.hallBusy || this.disposed) return;
    this.netLeave(); // Loading a character ends any live online session.
    this.hallBusy = true;
    try {
    const record = await this.session.load(index, recoveryToken);
    if (this.disposed) return;
    if (!record) { await this.loadRoster(index); this.titleScreen.message(this.session.error); return; }
    if (this.world !== this.overworld) this.world.dispose();
    this.overworld.dispose();
    this.overworld = createWorld(record.worldSeed); this.world = this.overworld;
    const start = GAME_FEATURES.factions ? startingZone(record.checkpoint.character.raceId, this.overworld) : null;
    this.sim = new Simulation(this.world, { seed: record.worldSeed, ...(start ? { startX: start.spawn.x, startY: start.spawn.y } : {}) });
    this.setLocationWorld(record.checkpoint);
    this.sim.restoreCheckpoint(record.checkpoint);
    this.projectedBeacons.clear();
    if (this.sim.player.dead) { if(this.sim.dungeonFloor && !await this.switchDungeon({kind:'death'})) return; this.sim.revive(); }
    this.sim.player.name = record.name;
    this.worldMap.dispose(); this.exploration.dispose();
    this.exploration = new Exploration(this.overworld, { characterId: record.id, persistence: this.saveClient,
      onDiscover: poi => {
        metric(this.sim.player.chronicle,'places');metric(this.sim.player.chronicle,'place:'+poi.kind);
        this.trackAchievement({ type: 'explore', id: poi.id, poiKind: poi.kind });
        questOnExplore(this.sim, poi);
        // Shops share their settlement announcement; landmarks deserve their own.
        if (!['blacksmith', 'merchant', 'inn', 'chapel', 'jeweler', 'enchanter'].includes(poi.kind))
          this.shell.notifications.push({ kind: 'discovery', poi });
      },
    });
    await this.exploration.ready;
    if (this.disposed) return;
    this.worldMap = this.buildWorldMap(this.overworld, this.exploration);
    this.worldMap.resize(); this.titleScreen.close(); this.saveError = '';
    this.projectBeacons(); this.enterWorld();
    if (coop) await this.beginCoop(coop);
    if(this.sim.player.character.treeRefunded){
      this.openCharacterPanel('skills');this.skillPanel.inspectNode('origin');this.skillPanel.setDetailsVisible(true);
      this.shell.setStatus('Your skill points were refunded. Rebuild your skills while the game is paused.');
    }
    this.saveCharacter();
    } finally { this.hallBusy = false; }
  }

  /** Resolve the partner and bring a second player into the just-loaded world.
   * A saved slot is read (not session-loaded, so P1 keeps the active session);
   * 'guest'/'new' partners arrive already minted as a session-only Player. */
  private async beginCoop(entry: CoopEntry) {
    const partner = await this.resolveCoopPartner(entry);
    if (!partner || this.disposed) return;
    if (!this.sim.enterCoop(partner)) { this.shell.setStatus('Co-op is unavailable right now.'); return; }
    // Place the partner beside P1 on open ground.
    const p1 = this.sim.player;
    let placed = false;
    for (let r = 40; r <= 200 && !placed; r += 40) for (let i = 0; i < 12 && !placed; i++) {
      const x = p1.x + Math.cos(i * Math.PI / 6) * r, y = p1.y + Math.sin(i * Math.PI / 6) * r;
      if (!this.world.blocked(x, y, partner.radius)) { partner.x = x; partner.y = y; placed = true; }
    }
    if (!placed) { partner.x = p1.x + 40; partner.y = p1.y; }
    this.renderer.reset(); this.renderer.snapTo(p1);
    this.shell.setStatus(`${partner.name ?? 'Player 2'} joined — second controller drives them.`);
  }

  /** Build and wire a WorldMap against a world + exploration pair. Extracted so
   * both character load and online-co-op world swaps produce an identical map. */
  private buildWorldMap(world: World, exploration: Exploration): WorldMap {
    const map = new WorldMap(world, exploration, this.shell.mapMount, () => this.closeMap(), undefined, this.mapIcons);
    map.setEncounterLevelReader(poi => isEventKind(poi.kind)||poi.kind==='dungeon' ? activityLevel(poi,this.journeys.facts(),world.seed) : null);
    map.setActivityStateReader(poi => activityStatus(poi, this.journeys.facts()));
    map.setPortalMarkers(() => portalMapMarkers(this.sim.travel, band => world.getPortalAnchor(band)));
    map.setWorldEventReader(() => ({ state: this.sim.worldEvents, time: this.sim.time }));
    map.setLootMarkerReader(() => GAME_FEATURES.legendaryMoment ? this.sim.groundItems : []);
    return map;
  }

  private async resolveCoopPartner(entry: CoopEntry): Promise<Player | null> {
    this.coopPartnerSlot = null; this.coopPartnerToken = null;
    if (entry.p2Player) return entry.p2Player;
    if (typeof entry.p2Slot !== 'number') return null;
    const slot = await this.session.repository.read(entry.p2Slot);
    const record = slot.record;
    if (!record) { this.shell.setStatus('That partner could not be loaded.'); return null; }
    // Restore the partner's checkpoint into a throwaway sim, then lift the Player.
    const temp = new Simulation(this.world, { seed: record.worldSeed, spawn: false });
    temp.restoreCheckpoint(record.checkpoint);
    const partner = temp.player;
    partner.name = record.name;
    // The throwaway sim's reset() re-pointed the world's broken-container set to
    // its own empty set; hand the live sim's set back so opened chests stay open.
    this.world.setBrokenContainers?.(this.sim.brokenContainers);
    // Remember the slot + write token so the partner's progress persists back.
    this.coopPartnerSlot = entry.p2Slot; this.coopPartnerToken = slot.token;
    return partner;
  }

  /** Persist the co-op partner's progress to their own slot. The partner shares
   * the host's world state but keeps their own player fields (character, level,
   * xp, gear, position). No-op for guest/'new' partners with no slot. */
  private async saveCoopPartner() {
    const slot = this.coopPartnerSlot;
    const partner = this.sim.coop ? this.sim.players[1] : null;
    if (slot === null || slot === undefined || !partner) return;
    const world = worldFieldsOf(this.sim.captureCheckpoint({ clone: false }));
    const checkpoint = mergeCheckpoint(world, this.sim.netPlayerFields(partner));
    const result = await this.session.repository.write(slot, {
      ...(await this.session.repository.read(slot)).record!,
      updatedAt: Date.now(), checkpoint,
    }, this.coopPartnerToken);
    if (result.ok) this.coopPartnerToken = result.token;
  }

  private async deleteCharacter(index: number, expected: string | null) {
    if (this.phase !== 'ready' || this.hallBusy || this.disposed) return;
    this.hallBusy = true;
    this.titleScreen.setBusy(true);
    try {
    const slot = await this.session.repository.read(index);
    if (slot.token !== expected) { await this.loadRoster(index); this.titleScreen.message('This character changed. Review it before deleting.'); return; }
    const result = await this.session.repository.remove(index, expected);
    if (!result.ok) { this.titleScreen.message(result.message); return; }
    if (slot.record) {
      await this.saveClient.removeChart(`evergrow:exploration:1:${slot.record.worldVersion}:${slot.record.worldSeed}:${slot.record.id}`, slot.record.worldSeed, String(slot.record.worldVersion));
    }
    this.shell.notifications.clear();
    this.titleScreen.open(await this.session.repository.list(), index);
    } finally { this.hallBusy = false; this.titleScreen.setBusy(false); }
  }

  private enterWorld() {
    this.shell.notifications.clear();
    this.areaNotices.reset(this.currentArea().id);
    this.zoneBanner.reset(this.world, this.sim.player.x, this.sim.player.y);
    fishingCancel(this.fishing);
    this.bars.bind(this.session.active?.record.id ?? null);
    this.sim.player.name = this.session.active?.record.name;
    this.renderer.reset();
    this.renderer.snapTo(this.sim.player);
    this.sim.setSpawnExclusion(this.coopSpawnExclusion());
    this.sim.setCombatViewport(this.renderer.combatViewport);
    this.panels.transition('playing');
    void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    this.audio.setEnabled(!this.muted); this.last = performance.now(); this.nextAutosave = this.last + 20_000;
  }

  private async loadRoster(preferred?: number) {
    this.hallBusy = true;
    this.titleScreen.setRosterLoading(true);
    try {
      const slots = await this.session.repository.list();
      if (!this.disposed) { this.titleScreen.setSource(this.saveClient.state); this.titleScreen.open(slots, preferred); }
    } catch { this.titleScreen.setRosterLoading(false); this.titleScreen.message('Saves unavailable. Please retry.'); }
    finally { this.hallBusy = false; }
  }

  private async selectSaveSource(mode: SaveMode) {
    if (mode === this.saveClient.mode || this.phase !== 'ready' || this.hallBusy || this.session.active) return;
    await this.saveClient.select(mode); await this.loadRoster();
  }
  private async retryCloudSaves() {
    if (this.phase !== 'ready' || this.hallBusy || this.appearanceEditor || this.disposed) return;
    this.hallBusy = true;
    try { await this.saveClient.retry(); }
    finally { this.hallBusy = false; }
    if (!this.disposed) await this.loadRoster();
  }
  private async downloadSave(index: number) {
    if (this.saveClient.mode !== 'local' || this.phase !== 'ready' || this.hallBusy) return;
    this.hallBusy = true;
    try {
      const raw = await this.saveClient.export(index), blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `evergrow-character-${index + 1}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { this.titleScreen.message((error as Error).message); }
    finally { this.hallBusy = false; }
  }
  private async importSave(index: number, file: File) {
    if (this.saveClient.mode !== 'local' || this.phase !== 'ready' || this.hallBusy) return;
    this.hallBusy = true;
    try {
      if (file.size > SAVE_BUNDLE_LIMIT) throw new Error('Save file is too large.');
      const result = await this.saveClient.import(index, await file.text());
      if (!result.ok) throw new Error(result.message);
      await this.loadRoster(index);
    } catch (error) { this.titleScreen.message((error as Error).message); }
    finally { this.hallBusy = false; }
  }
  private async resolveCloudSave(index: number, expected: string | null) {
    if (this.phase !== 'ready' || this.hallBusy) return;
    this.hallBusy = true;
    try { await this.saveClient.useCloud(index, expected); await this.loadRoster(index); }
    catch (error) { this.titleScreen.message((error as Error).message, true); }
    finally { this.hallBusy = false; }
  }
  private saveCharacter(force = false): Promise<boolean> {
    // A net client is a guest in the host's world: its sim holds host state
    // (puppet enemies, host journeys/camps, host geography). Persisting that
    // would corrupt the client's own record, so co-op progress stays with the
    // host's session and the client's solo save is left untouched.
    if (this.sim.netMode === 'client') return Promise.resolve(true);
    if (this.savingAction && !force) return Promise.resolve(false);
    if (!this.session?.active) return Promise.resolve(true);
    if (this.autosave) { this.saveAgain = true; return this.autosave; }
    this.autosave = (async () => {
      let saved = false;
      do {
        this.saveAgain = false;
        saved = await this.session.save(this.sim.captureCheckpoint({ clone: false }), Date.now());
        const message = saved ? '' : this.session.error;
        if (!this.disposed) {
          if (message && message !== this.saveError) this.notify(message);
          this.saveError = message;
          const cloud = this.saveClient.statusForSlot(this.session.active!.index);
          this.shell.setSaveStatus(message || (this.saveClient.mode === 'cloud' ? cloud.message || cloud.status : ''), !saved || this.saveClient.mode === 'cloud' && !['Synced', 'Saving…'].includes(cloud.status));
        }
      } while (this.saveAgain && !this.savingAction && !this.disposed && saved);
      // Persist the couch partner's progress to their own slot alongside the
      // primary's save so a saved P2 keeps XP, loot, quests and position.
      if (saved && this.sim.coop && this.sim.netMode === null) await this.saveCoopPartner();
      await this.exploration.save();
      return saved;
    })().finally(() => { this.autosave = null; });
    return this.autosave;
  }

  /** Best effort on browser suspension; the recovery checkpoint is durable before uploading. */
  private async saveAndSync() {
    if (await this.saveCharacter()) await this.saveClient.flush();
  }

  /** Hold gameplay and new commands across save-before-commit; rendering continues. */
  private durable<T>(operation: () => Promise<T>, busy: T): Promise<T> {
    if (this.savingAction || this.disposed) return Promise.resolve(busy);
    this.savingAction = true; this.touch.update(this.sim.player,this.phase,true,performance.now()); this.clearWorldTouch?.(); this.input.clear(); this.gamepad.clear(); this.gamepadMenu.clear();
    const result = (async () => {
      try { await this.autosave; return await operation(); }
      finally { this.savingAction = false; this.clearInput(); this.last = performance.now(); }
    })();
    this.actionPending = result;
    return result;
  }

  private async returnToTitle() {
    return this.durable(async () => {
    if (!this.session.active || !await this.saveCharacter(true)) return;
    const index = this.session.active.index;
    await this.saveClient.flush();
    this.session.active = null;
    this.shell.setSaveStatus();
    this.shell.notifications.clear();
    this.netLeave();
    if(this.world!==this.overworld)this.world.dispose(); this.world=this.overworld;this.sim.world=this.world;
    this.sim.reset(); this.renderer.reset();
    this.bars?.bind(null); fishingCancel(this.fishing); this.achievementToasts?.clear();
    this.panels.transition('ready'); this.titleScreen.open(await this.session.repository.list(), index);
    }, undefined);
  }

  pause() { if (!this.disposed && !this.savingAction) this.panels.pause(); }

  resume() { if (!this.disposed && !this.savingAction) this.panels.resume(); }

  private openMap() { if (this.savingAction) return; this.panels.open('map'); }

  private closeMap() { if (this.phase === 'map') this.resume(); }

  private openCharacterPanel(panel: 'character' | 'skills') { if (!this.savingAction && !this.sim.ghost) this.panels.open(panel); }

  private closeCharacterPanel() {
    if (this.phase === 'character' || this.phase === 'skills') this.resume();
  }

  /** A town NPC at its current daily-routine position (world-t10). */
  private liveNPC<T extends TownNPC>(npc: T): T {
    return positionedNPC(npc, npcTown(this.world, npc), this.sim.time);
  }

  private interact(pointer?: {
      x: number;
      y: number;
  }, player: Player = this.sim.player): boolean {
      // Run as the acting player so a co-op partner's interact resolves their
      // own ghost, position and pickup channel — never the primary's.
      return this.sim.asPlayer(player, () => this.interactBody(pointer, player));
  }

  private interactBody(pointer: {
      x: number;
      y: number;
  } | undefined, p: Player): boolean {
      if (this.savingAction) return false;
      if (!this.panels.simulationActive)
          return false;
      if (this.sim.ghost) {
          const mode = this.sim.ghostPrompt();
          if (mode === 'corpse' || mode === 'healer') this.resurrectGhost(mode, p);
          return true;
      }
      // A net client is a guest in the host's world: world interactions (loot,
      // NPCs, dungeon entrances, containers) are host-authoritative and would
      // corrupt local state if run here. Ghost resurrection above still works
      // because it forwards to the host.
      if (this.sim.netMode === 'client') return false;
      const screen=pointer&&this.renderer.worldToScreen(pointer.x,pointer.y);
      const label=screen&&hoveredGroundLoot(this.renderer.groundLootLabels,screen.x,screen.y);
      const nearby=!pointer?this.sim.groundItems.filter(d=>Math.hypot(d.x-p.x,d.y-p.y)<=80).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]:undefined;
      const lootId=label?.id??nearby?.id;
      if(lootId!==undefined){
          // Only the primary's keyboard buffer is cleared; a partner's interact
          // must not eat P1's held input. sim.clearInput() is per-actor.
          this.canvas.focus(); if (p === this.sim.players[0]) this.input.clear(); this.sim.clearInput();
          const problem=this.sim.requestGroundItem(lootId);if(problem)this.notify(problem);
          return true;
      }
      if (this.fishing.bobber) {
          const catchResult = fishingCatch(this.fishing, p, this.sim.time, this.fishingRandom());
          if (catchResult.kind !== 'none') {
              if (catchResult.message) this.notify(catchResult.message);
              if (catchResult.kind === 'fish' || catchResult.kind === 'treasure') this.trackAchievement({ type: 'fish' });
              if (catchResult.kind === 'treasure' && catchResult.bagFull && catchResult.item) {
                  const id = this.sim.nextEntityIdentity;
                  addGroundItem(this.sim.groundItems, { id, item: catchResult.item,
                      ...treasureLanding(this.world, p.x, p.y, id, catchResult.item.seed) });
                  this.sim.reserveIdentity(id + 1);
              }
              return true;
          }
      }
      const run = currentDungeon(this.sim.expeditions);
      if (run) {
          const f = this.sim.dungeonFloor!, hit = (q: {
              x: number;
              y: number;
          }) => Math.hypot(p.x - q.x, p.y - q.y) < 75 && (!pointer || Math.hypot(pointer.x - q.x, pointer.y - (q.y - 20)) < 55);
          const event=f.events?.find(e=>!run.events?.[e.id]?.finished&&hit(e));
          if(event){
              this.sim.clearInput();this.sim.portal.cancel();
              void this.durable(async()=>{const result=await startDungeonEvent(this.sim,event.id,c=>this.persistTravel(c));this.notify(result.message);},undefined);
              return true;
          }
          const chest = dungeonInteractionChests(f,run).find(hit)?.index ?? -1;
          if (chest >= 0) {
              const problem = dungeonChestProblem(this.sim, chest);
              if (problem)
                  this.notify(problem);
              else {
                  this.sim.clearInput();
                  this.sim.portal.cancel();
                  void this.finishEvent({ ...f.chests[chest], kind: 'cryptChest', name: 'Crypt chest', index: chest }, null);
              }
              return true;
          }
          if (run.entrance.pvp ? hit(f.entry) || hit(dungeonRunExit(f,run)) : hit(f.entry) || ((run.states.warden?.hp ?? 0) <= 0 && hit(dungeonRunExit(f,run)))) {
              if (run.entrance.pvp) this.leavePvpMatch();
              else this.switchDungeon({ kind: 'exit' });
              return true;
          }
          return false;
      }
      const entrance = this.overworld.getDungeonEntrances(p.x - 80, p.y - 80, 160, 160).find(e => Math.hypot(e.x - p.x, e.y - p.y) < 75 && (!pointer || Math.hypot(pointer.x - e.x, pointer.y - (e.y - 20)) < 55));
      if (entrance) {
          const scaling = encounterScaleAt(entrance.x,entrance.y,this.overworld.seed,p.level);
          this.activeDungeonEntrance = this.sim.expeditions.runs.find(r=>r.entrance.id===entrance.id)?.entrance ?? {...entrance,scaling,level:scaling.base};
          this.panels.open('event');
          return true;
      }
      if (GAME_FEATURES.transport) {
          const tp = transportPrompt(this.sim);
          if (tp && tp.kind !== 'wait' && (!pointer || Math.hypot(pointer.x - tp.x, pointer.y - tp.y) < 90)) {
              if (tp.kind === 'flight') {
                  const master = flightPoint(tp.id);
                  if (master) {
                      if (this.sim.travel.flightPaths?.includes(master.id)) { this.activeFlightMaster = master; this.panels.open('event'); }
                      else void this.durable(async () => { const result = await this.locations.transport({ kind: 'unlockFlight', masterId: master.id }); if (!result) this.notify('Could not save.'); }, undefined);
                  }
              } else {
                  void this.durable(async () => {
                      const ok = await this.locations.transport(tp.kind === 'board' ? { kind: 'board', routeId: tp.id }
                          : tp.kind === 'disembark' ? { kind: 'disembark' }
                          : { kind: 'portal', routeId: tp.id });
                      if (!ok) this.notify('Could not save.');
                  }, undefined);
              }
              return true;
          }
      }
      const anchor = this.nearbyAnchor(pointer);
      if (anchor) {
          if (this.sim.travel.returnTo?.town === anchor.band)
              this.travelThrough(anchor, true);
          else {
              void this.durable(async () => {
                const result = await activatePortalAnchor(this.sim, anchor, c => this.persistTravel(c));
                this.notify(result.message);
              }, undefined);
          }
          return true;
      }
      const riftPortal=this.world.getBuildings(p.x-200,p.y-200,400,400).find(b=>b.kind==='rift'&&Math.hypot(p.x-b.door.x,p.y-b.door.y)<90&&(!pointer||Math.hypot(pointer.x-b.door.x,pointer.y-(b.door.y-65))<85));
      if(riftPortal){this.activeRiftPortal=riftPortal.id;this.panels.open('event');return true;}
      const table=this.world.getBuildings(p.x-180,p.y-180,360,360).find(b=>b.kind==='expedition'&&!expeditionTableProblem(b,p,this.world)&&(!pointer||Math.hypot(pointer.x-b.door.x,pointer.y-(b.door.y-25))<55));
      if(table){this.activeExpeditionTable=table.id;this.panels.open('event');return true;}
      {
          const gathered = gatherInteract(this.sim, pointer);
          if (gathered.handled) { if (gathered.problem) this.notify(gathered.problem); return true; }
          const greeting = questInteract(this.sim, this.world, pointer);
          if (greeting) { this.pendingGiver = greeting; if (!this.panels.open('questLog')) this.pendingGiver = null; return true; }
          const innkeeper = GAME_FEATURES.hearthstone ? focusedInnkeeper(innkeepersNear(this.world, p.x - 160, p.y - 160, 320, 320), p, this.world, pointer) : null;
          if (innkeeper) {
              void this.durable(async () => {
                  const result = await bindInteract(this.sim, innkeeper, c => this.persistTravel(c));
                  this.notify(result.message);
              }, undefined);
              return true;
          }
          const stableMaster = focusedStableMaster(stableMastersNear(this.world, p.x - 160, p.y - 160, 320, 320).map(m => this.liveNPC(m)), p, this.world, pointer);
          if (stableMaster) {
              this.activeStableMaster = stableMaster;
              this.panels.open('stable');
              return true;
          }
          const battlemaster = focusedBattlemaster(battlemastersNear(this.world, p.x - 160, p.y - 160, 320, 320).map(m => this.liveNPC(m)), p, this.world, pointer);
          if (battlemaster) {
              this.activeBattlemaster = battlemaster;
              this.panels.open('arena');
              return true;
          }
          const pvpVendor = focusedPvpVendor(pvpVendorsNear(this.world, p.x - 160, p.y - 160, 320, 320).map(v => this.liveNPC(v)), p, this.world, pointer);
          if (pvpVendor) {
              this.activePvpVendor = pvpVendor;
              this.panels.open('pvpVendor');
              return true;
          }
          const badgeVendor = focusedBadgeVendor(badgeVendorsNear(this.world, p.x - 160, p.y - 160, 320, 320).map(v => this.liveNPC(v)), p, this.world, pointer);
          if (badgeVendor) {
              this.activeBadgeVendor = badgeVendor;
              this.panels.open('badgeVendor');
              return true;
          }
          const trainer = focusedTrainer(trainersNear(this.world, p.x - 160, p.y - 160, 320, 320).map(t => this.liveNPC(t)), p, this.world, pointer);
          if (trainer) {
              this.activeTrainer = trainer;
              this.panels.open('trainer');
              return true;
          }
          const quartermaster = focusedQuartermaster(quartermastersNear(this.world, p.x - 160, p.y - 160, 320, 320).map(q => this.liveNPC(q)), p, this.world, pointer);
          if (quartermaster) {
              this.activeQuartermaster = quartermaster;
              this.panels.open('quartermaster');
              return true;
          }
          const mailbox = GAME_FEATURES.mail ? focusedMailbox(mailboxesNear(this.world, p.x - 160, p.y - 160, 320, 320), p, this.world, pointer) : null;
          if (mailbox) {
              this.panels.open('mailbox');
              return true;
          }
          if (GAME_FEATURES.holidays && faireActive(Date.now())) {
              const site = faireSite(this.world);
              const vendor = focusedFaireVendor(faireVendor(site), p, this.world, pointer);
              if (vendor) {
                  this.activeFaireVendor = vendor;
                  this.activeFaireSite = site;
                  this.activeFaireBooths = faireBooths(site);
                  this.panels.open('holiday');
                  return true;
              }
          }
      }
      const npcs = this.world.getBuildings(p.x - 220, p.y - 220, 440, 440).map(buildingNPC).filter((npc): npc is TownNPC => npc !== null).map(npc => this.liveNPC(npc));
      const npc = focusNPC(npcs, p, this.world, pointer);
      if (!npc) {
          const site = focusEvent(eventInteractionSites(this.world.getEventSites(p.x - 100, p.y - 100, 200, 200), this.sim.eventState), p, this.world, pointer);
          if (!site) {
              const cast = fishingCast(this.fishing, p, (x, y) => this.world.sampleWater(x, y),
                  fishingZoneAt(this.world, p.x, p.y, p.level), this.sim.time, this.fishingRandom(), pointer);
              if (cast.ok) return true;
              if (pointer) this.notify(cast.problem);
              return false;
          }
          const record = this.sim.eventState.sites[site.id];
          if (!record && !eventClaimed(this.sim.eventState, site.id) && (site.kind==='caravan'||isTrialKind(site.kind))) {
              if (this.sim.eventState.trial && site.kind !== 'caravan') {
                  this.notify('Finish the active trial.');
                  return true;
              }
              this.activeEvent = {...site,level:activityLevel(site,this.journeys.facts(),this.overworld.seed)};
              this.panels.open('event');
          }
          else
              this.startEvent(site, record?.choice ?? null);
          return true;
      }
      this.activeNPC = npc;
      this.panels.open('service');
      return true;
  }

  private startEvent(site: EventSite, choice: EventChoice | null): void {
    if (this.savingAction) return;
    const problem = eventProblem(this.sim, site, choice);
    if (problem) { this.notify(problem); return; }
    this.sim.portal.cancel(); this.sim.clearInput();
    if(site.kind==='watchtower'||site.kind==='standingStones')this.sim.eventChannel.start(site, choice);
    else void this.finishEvent(site,choice);
  }

  private async finishEvent(site:EventSite|DungeonChestTarget|null = this.sim.eventChannel.ready?this.sim.eventChannel.site:null, choice:EventChoice|null = this.sim.eventChannel.choice): Promise<void> {
    return this.durable(async () => {
      const channel = this.sim.eventChannel;
      if (!site)
          return;
      if (site.kind === 'cryptChest') {
          const result = await claimDungeonChest(this.sim, site.index, c => this.persistTravel(c));
          channel.cancel();
          if (result.ok) {
              if(result.celebration)this.renderer.handleEvents([result.celebration],this.reducedMotion);
              else if(!this.sim.dungeonFloor?.rift)this.renderer.handleEvents([{type:'blast',x:site.x,y:site.y,radius:70,duration:.6,color:'#d7c18a'}],this.reducedMotion);
          }
          this.notify(result.message);
          return;
      }
      const target = site.kind === 'watchtower' ? this.world.getPOIs(site.x - 2400, site.y - 2400, 4800, 4800)
          .filter(poi => poi.id !== site.id && !this.exploration.isDiscovered(poi.id) && Math.hypot(poi.x - site.x, poi.y - site.y) <= 2400
          && isEventKind(poi.kind))
          .sort((a, b) => Math.hypot(a.x - site.x, a.y - site.y) - Math.hypot(b.x - site.x, b.y - site.y))[0] : undefined;
      const result = await executeEvent(this.sim, site, choice, c => this.persistTravel(c), target);
      channel.cancel();
      this.notify(result.message);
      this.projectBeacons();
    }, undefined);
  }

  private projectBeacons(): void {
    for (const record of Object.values(this.sim.eventState.sites)) {
      if (record.kind !== 'watchtower' || record.phase !== 'claimed' || this.projectedBeacons.has(record.id)) continue;
      this.exploration.revealFromBeacon(record.x, record.y, record.beaconTarget);
      this.projectedBeacons.add(record.id);
    }
  }

  private nearbyAnchor(pointer?: { x: number; y: number }): PortalAnchor | undefined {
    const p = this.sim.player;
    return this.world.getSettlements(p.x - 150, p.y - 150, 300, 300).map(townPortalAnchor)
      .find(anchor => withinPortalReach(p, anchor, this.world)
        && (!pointer || Math.hypot(pointer.x - anchor.x, pointer.y - (anchor.y - 25)) < 42));
  }

  /** Sheet-level persist for the commerce commands (auction house, guild): the
   * staged character rides a fresh checkpoint so hp/mana stay consistent. */
  private persistSheet = async (character: CharacterSheet, hp: number, mana: number) => {
    const saved = await this.session.save({ ...this.sim.captureCheckpoint({ clone: false }), character, hp, mana }, Date.now());
    if (!saved) this.shell.setSaveStatus(this.session.error, true);
    return { ok: saved, message: this.session.error };
  };

  private async persistTravel(checkpoint: CharacterCheckpoint) {
    const ok = await this.session.save(checkpoint, Date.now());
    this.saveError = ok ? '' : this.session.error;
    this.shell.setSaveStatus(this.saveError || '', !ok);
    return { ok, message: this.saveError };
  }

  private shouldShowHomePortal(): boolean {
    return this.phase === 'playing' && !this.world.isSanctuary(this.sim.player.x, this.sim.player.y);
  }

  /** True while hosting with at least one seated remote client. World
   * transitions (portal/dungeon/hearthstone) are blocked then: the protocol has
   * no world-switch frame, so a host that travels would leave the client
   * rendering the old geography against new-coordinates snapshots. */
  private netHostHasGuests(): boolean {
    return this.sim.netMode === 'host' && (this.net as import('./net-host.ts').NetHostSession | null)?.clients.length ? true : false;
  }

  private requestPortal() {
    if (this.savingAction || !this.panels.simulationActive || !this.session.active || this.sim.ghost) return;
    if (this.sim.netMode === 'client') return; // travel is host-authoritative
    if (this.netHostHasGuests()) { this.notify('You cannot travel while a guest is connected.'); return; }
    const p = this.sim.player, link = this.sim.travel.returnTo;
    if (this.world.isSanctuary(p.x, p.y)) {
      const anchor = this.returnPortalInReach();
      if (anchor) { void this.travelThrough(anchor, true); }
      else if (link) { this.renderer.portalGuide = 4; this.notify('Return portal marked on your map.'); }
      else this.notify('Explore outside the sanctuary to open a town portal.');
      return;
    }
    this.sim.eventChannel.cancel();
    this.sim.clearCombatInput();
    const problem = this.sim.portal.start(p, this.world);
    if (problem) this.notify(problem);
  }

  private returnPortalInReach(): PortalAnchor | undefined {
    const link = this.sim.travel.returnTo;
    if (!link) return undefined;
    const anchor = this.overworld.getPortalAnchor(link.town);
    return withinPortalReach(this.sim.player, anchor, this.world) ? anchor : undefined;
  }

  private updatePortalPresentation(): void {
    const destinations = portalDestinations({ seed: this.overworld.seed,
      home: this.overworld.getPortalAnchor(this.sim.travel.homeTown, playerFaction(this.sim.player)), travel: this.sim.travel, expeditions: this.sim.expeditions });
    this.renderer.portalDestinations = destinations;
    if (!this.touch.active) return;
    const progress = this.sim.portal.active ? this.sim.portal.progress : null;
    const inSanctuary=this.world.isSanctuary(this.sim.player.x,this.sim.player.y),returnInReach=!!this.returnPortalInReach();
    const mode=portalActionMode(progress!==null,inSanctuary,!!destinations.returnTo,returnInReach);
    this.touch.setPortal({mode,progress,destination:mode==='locate'||mode==='return'?destinations.returnTo!:destinations.home});
  }

  private setLocationWorld(checkpoint: CharacterCheckpoint) {
      const run = checkpoint.expeditions && currentDungeon(checkpoint.expeditions);
      if (this.world !== this.overworld)
          this.world.dispose();
      this.world = run ? new (run.entrance.rift?RiftWorld:DungeonWorld)(generateDungeon(run.entrance.seed, run.entrance.level, run.entrance), run.entrance) : this.overworld;
      this.sim.world = this.world;
  }
  private switchDungeon(action: DungeonAction): Promise<boolean> {
    if (this.sim.netMode === 'client') return Promise.resolve(false); // dungeons are host-authoritative
    if (this.netHostHasGuests()) { this.notify('You cannot change location while a guest is connected.'); return Promise.resolve(false); }
    return this.durable(async () => {
      const ok = await this.locations.dungeon(action);
      if (ok && action.kind === 'enter') {
        const entrance = action.entrance;
        this.trackAchievement(isRaidEntranceId(entrance.id) || isRaid2EntranceId(entrance.id) || isRaid3EntranceId(entrance.id) || isRaid4EntranceId(entrance.id) || isRaid5EntranceId(entrance.id) || isRaid6EntranceId(entrance.id) || isRaid7EntranceId(entrance.id) || isRaid8EntranceId(entrance.id) || isRaid9EntranceId(entrance.id)
          ? { type: 'raid', id: entrance.id }
          : { type: 'dungeon', id: entrance.id, theme: entrance.theme });
      }
      return ok;
    }, false);
  }
  private travelThrough(anchor: PortalAnchor, returning: boolean): Promise<boolean> {
    return this.durable(() => this.locations.portal(anchor, returning), false);
  }
  private finishTravel(): void {
    this.panels.releaseMap();
    this.clearInput();
    this.renderer.reset(); this.renderer.snapTo(this.sim.player);
    this.sim.setSpawnExclusion(this.coopSpawnExclusion());
    this.sim.setCombatViewport(this.renderer.combatViewport);
    // Travel clears the old presentation; announce the destination after stable arrival.
    this.areaNotices.reset('');
    this.zoneBanner.reset(this.world, this.sim.player.x, this.sim.player.y);
    fishingCancel(this.fishing);
    this.worldMap.update(this.sim.player, 0);
    this.shell.portalTransition(); this.canvas.focus();
  }

  private currentArea(): AreaBannerNotice {
    const run = currentDungeon(this.sim.expeditions);
    return run ? { id: run.entrance.id, name: run.entrance.name, level: run.entrance.level }
      : getZoneAt(this.sim.player.x, this.sim.player.y, this.world.seed);
  }

  private async trade(quote: ServiceQuote): Promise<{ ok: boolean; message: string }> {
    return this.durable(async () => {
    const stored = this.activeNPC, p = this.sim.player;
    const npc = stored ? this.liveNPC(stored) : null;
    if (this.phase !== 'service' || !npc || !this.session.active || !canInteractNPC(npc, p, this.world))
      return { ok: false, message: 'This service is no longer in reach.' };
    let progress=p.chronicle;
    const result = await executeService(p, npc, this.world, quote, async (character, hp, mana) => {
      progress=structuredClone(p.chronicle);
      trackCommerce(progress,p.character.gold??0,character.gold??0,Math.max(0,...Object.values(character.equipped).filter(Boolean).map(i=>i!.recipe?.enhancement??0),...character.inventory.filter(Boolean).map(i=>i!.recipe?.enhancement??0)));
      const saved = await this.session.save({ ...this.sim.captureCheckpoint({ clone: false }), character, hp, mana, skillCooldowns: quote.request.type==='respec'?{}:p.skillCooldowns, chronicle:progress }, Date.now());
      if (!saved) this.shell.setSaveStatus(this.session.error, true);
      return { ok: saved, message: this.session.error };
    });
    if (result.ok) { p.chronicle=progress; this.saveError = ''; this.shell.setSaveStatus();
      if(quote.request.type==='sell'||quote.request.type==='sellMany')this.audio.play({type:'gold',x:p.x,y:p.y,amount:quote.price,balance:p.character.gold??0});
      else this.notify(result.message);
    }
    return result;
    }, { ok: false, message: 'Saving the previous action…' });
  }

  private async dropInventoryItem(source: DropItemSource) {
    await this.durable(async () => {
      if (this.phase !== 'character' || !this.session.active) return;
      const result = await executeDropItem(this.sim, source, async checkpoint => {
        const ok = await this.session.save(checkpoint, Date.now());
        if (!ok) this.shell.setSaveStatus(this.session.error, true);
        return { ok, message: this.session.error };
      });
      if (result.ok) {
        this.saveError = ''; this.shell.setSaveStatus();
        this.inventoryPanel.refresh(this.sim.player);
      }
      this.notify(result.message ?? 'Could not drop this item.');
    }, undefined);
  }

  private characterAction(command: CharacterCommand) {
    if (this.savingAction) return;
    if (this.sim.ghost && command.type === 'equip' && isConsumableItem(this.sim.player.character.inventory[command.index])) { this.notify('You are dead.'); return; }
    const result = executeCharacterCommand(this.sim.player, command);
    if (!result.ok) { this.notify(result.message ?? 'Action unavailable.'); return; }
    if (result.message) this.notify(result.message);
    if (this.phase === 'character') this.inventoryPanel.refresh(this.sim.player);
    if (this.phase === 'skills') this.skillPanel.refresh(this.sim.player);
    this.saveCharacter();
  }

  /** Hotbar consumable use: validates, consumes one charge, applies the buff. */
  private useConsumable(consumableId: string) {
    if (this.savingAction || this.sim.netMode === 'client') return; // host-authoritative
    const player = this.sim.player;
    if (player.dead || this.sim.ghost) { this.notify('You are dead.'); return; }
    const result = useConsumableId(player, consumableId, this.sim.time);
    if (!result.ok) { this.notify(result.message ?? 'Cannot use that.'); return; }
    this.saveCharacter();
  }

  /** Stable-master window actions: every mutation stages a checkpoint, persists, then commits. */
  private get petActions(): StableActions {
    const sheet = () => this.sim.player.character as typeof this.sim.player.character & { pets?: PetStable };
    return {
      close: () => this.resume(),
      activePet: () => sheet().pets?.active ?? null,
      stabledPets: () => sheet().pets?.stabled ?? [],
      stableCapacity: () => PET_RULES.stableSlots,
      swapPet: index => this.stableMutation(stable => {
        const next = activateStabledPet(stable, index);
        return next ? { ok: true, stable: next, message: 'Pet activated.' } : { ok: false, stable, message: 'That pet is no longer stabled here.' };
      }),
      stableActive: () => this.stableMutation(stable => {
        const next = stableActivePet(stable);
        return next ? { ok: true, stable: next, message: 'Pet stabled.' } : { ok: false, stable, message: stable.active ? 'The stable is full.' : 'No active pet to stable.' };
      }),
      renamePet: (petId, name) => this.stableMutation(stable => {
        const trimmed = name.trim().slice(0, 24);
        if (!trimmed) return { ok: false, stable, message: 'The pet needs a name.' };
        const pet = stable.active?.id === petId ? stable.active : stable.stabled.find(entry => entry.id === petId);
        if (!pet) return { ok: false, stable, message: 'That pet is no longer here.' };
        pet.name = trimmed;
        return { ok: true, stable, message: `Renamed to ${trimmed}.` };
      }),
      dismissPet: petId => this.stableMutation(stable => {
        const pet = stable.active?.id === petId ? stable.active : stable.stabled.find(entry => entry.id === petId);
        if (!pet) return { ok: false, stable, message: 'That pet is no longer here.' };
        return { ok: true, stable: releasePet(stable, petId), message: `${pet.name} released.` };
      }),
      learnPetTalent: talentId => this.durable(async () => {
        const result = await executePetTalentLearn(this.sim, talentId, c => this.persistTravel(c));
        return { ok: result.ok, message: result.message ?? '' };
      }, { ok: false, message: 'A save is already in progress.' }),
      resetPetTalents: () => this.durable(async () => {
        const result = await executePetTalentReset(this.sim, c => this.persistTravel(c));
        return { ok: result.ok, message: result.message ?? '' };
      }, { ok: false, message: 'A save is already in progress.' }),
      mounts: () => MOUNT_IDS.map(id => ({
        id, unlocked: mountUnlocked(this.sim.player, id), selected: preferredMount(this.sim.player) === id,
      })),
      selectMount: id => this.durable(async () => {
        const p = this.sim.player;
        if (!isMountId(id)) return { ok: false, message: 'Unknown mount.' };
        if (!mountUnlocked(p, id)) return { ok: false, message: `${MOUNTS[id].name} is still locked.` };
        const checkpoint = this.sim.captureCheckpoint();
        checkpoint.character.mount = id;
        const saved = await this.persistTravel(checkpoint);
        if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. Your mount preference is unchanged.' };
        p.character = checkpoint.character;
        if (p.mounted && p.mounted.id !== id) dismount(this.sim);
        if (!p.mounted) {
          this.resume();
          this.toggleMount(id);
          return { ok: true, message: `Summoning ${MOUNTS[id].name}…` };
        }
        return { ok: true, message: `${MOUNTS[id].name} selected.` };
      }, { ok: false, message: 'A save is already in progress.' }),
      companions: () => COMPANION_IDS.map(id => ({
        id, owned: companionOwned(this.sim.player, id), active: activeCompanion(this.sim.player) === id,
      })),
      summonCompanion: id => this.durable(async () => {
        const p = this.sim.player;
        const err = summonCompanion(p, id);
        if (err) return { ok: false, message: err };
        const checkpoint = this.sim.captureCheckpoint();
        checkpoint.achievements = { ...p.achievements };
        const saved = await this.persistTravel(checkpoint);
        if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. Your companion is unchanged.' };
        p.achievements = checkpoint.achievements;
        return { ok: true, message: id ? `Summoned ${COMPANIONS[id].name}.` : 'Companion dismissed.' };
      }, { ok: false, message: 'A save is already in progress.' }),
    };
  }

  private stableMutation(update: (stable: PetStable) => { ok: boolean; stable: PetStable; message: string }): Promise<{ ok: boolean; message: string }> {
    return this.durable(async () => {
      const checkpoint = this.sim.captureCheckpoint();
      const carrier = checkpoint.character as typeof checkpoint.character & { pets?: PetStable };
      const stable = carrier.pets ?? (carrier.pets = freshPetStable());
      const result = update(stable);
      if (!result.ok) return { ok: false, message: result.message };
      const saved = await this.persistTravel(checkpoint);
      if (!saved.ok) return { ok: false, message: saved.message ?? 'Could not save. The stable is unchanged.' };
      this.sim.player.character = checkpoint.character;
      // The live ally follows the stable: swap/stable/dismiss summon or despawn the pet.
      this.sim.syncPetAlly();
      return { ok: true, message: result.message };
    }, { ok: false, message: 'A save is already in progress.' });
  }

  /** PvP setup window actions. `character()` is null on the title screen — Custom mode
   * is the only way to queue without a loaded save. `enter` is the match-controller
   * seam: T06/T07 replace the notice with the real queue/match start. */
  private get pvpActions(): PvpPanelActions {
    return {
      close: () => this.resume(),
      character: () => {
        const record = this.session.active?.record;
        return record ? { name: record.name, level: record.checkpoint.level, classId: record.checkpoint.character.classId, raceId: record.checkpoint.character.raceId } : null;
      },
      enter: setup => this.enterPvp(setup),
    };
  }

  private pvpHost() {
    return { surface: () => this.overworld, persist: (c: Parameters<typeof this.persistTravel>[0]) => this.persistTravel(c), restoreWorld: (c: Parameters<typeof this.setLocationWorld>[0]) => this.setLocationWorld(c), arrived: () => this.finishTravel() };
  }

  private enterPvp(setup: PvpSetup): void {
    if (this.phase === 'arena') this.resume();
    else if (this.phase === 'ready') this.titleScreen.selectPage('characters');
    void this.durable(async () => {
      const result = await enterPvpMatch(this.sim, setup, this.pvpHost());
      this.notify(result.ok ? `${pvpBracketLabel(setup.bracket)} — ${result.message}` : result.message);
    }, undefined);
  }

  /** Match over: freeze on the scoreboard (Victory/Defeat banner + stats); the
   * countdown or Leave button runs the exit + award teardown. */
  private finishPvpMatch(end: PvpMatchEnd): void {
    this.pendingPvpEnd = end;
    this.pvpExitAt = performance.now() + PVP_SCOREBOARD_SECONDS * 1000;
    const match = currentPvpMatch(this.sim);
    if (match) this.pvpScorePanel.open(match, end.scoreboard, { winner: end.winner, exitAt: this.pvpExitAt });
    this.notify(pvpScoreboardSummary(end.scoreboard, end.result.won));
  }

  /** One announcement: chat line, center-screen flash, audio stinger. */
  private announcePvp(announcement: PvpAnnouncement): void {
    if (announcement.chat) pushChatMessage(this.sim.player, announcement.chat, announcement.text, this.sim.time);
    if (announcement.flash) this.renderer.announceFlash(announcement.flash.title, announcement.flash.subtitle ?? '', announcement.flash.color);
    if (announcement.cue) this.audio.pvpCue(announcement.cue);
  }

  /** Exit the match: leave the arena (restores the real character + start
   * point), then award Honor/Arena Points/rep on the restored sheet. */
  private leavePvpMatch(): void {
    const end = this.pendingPvpEnd;
    this.pendingPvpEnd = null;
    this.pvpScorePanel.close();
    void this.durable(async () => {
      const exit = await exitPvpMatch(this.sim, this.pvpHost());
      if (!exit.ok) this.notify(exit.message);
      if (!end) return;
      const award = await awardMatchRewards(this.sim, end.result, c => this.persistTravel(c));
      if (!award.ok) this.notify(award.message ?? 'The match rewards were lost.');
      for (const achievement of award.unlocked) this.notify(`Achievement: ${achievement.name}`);
    }, undefined);
  }

  private toggleMount(id?: MountId) {
    if (this.sim.ghost || this.sim.netMode === 'client') return; // mounts are host-authoritative
    const result = mountToggle(this.sim, id);
    if (result.message) this.notify(result.message);
    if (result.ok) {
      this.renderer.vfx.mountPoof(this.sim.player.x, this.sim.player.y);
      if (this.sim.player.mounted) this.trackAchievement({ type: 'mount', mount: this.sim.player.mounted.id });
    }
  }

  /** F cycles the hunter pet stance: attack → follow → stay → passive. */
  private cyclePetCommand() {
    const p = this.sim.player;
    if (this.sim.ghost) return;
    if (!p.character.pets?.active && !p.allies?.some(a => a.petId !== undefined && a.hp > 0)) {
      this.notify('You have no pet to command.');
      return;
    }
    const order = ['attack', 'follow', 'stay', 'passive'] as const;
    const next = order[(order.indexOf(p.petCommand ?? 'attack') + 1) % order.length]!;
    this.sim.setPetCommand(next);
    this.notify(`Pet command: ${next}.`);
  }

  private castHearthstone() {
    if (!GAME_FEATURES.hearthstone || this.sim.ghost || this.sim.netMode === 'client') return; // host-authoritative
    if (this.netHostHasGuests()) { this.notify('You cannot hearth while a guest is connected.'); return; }
    if (this.sim.dungeonFloor?.pvp) { this.notify('Hearthstones are sealed during a match.'); return; }
    const problem = hearthstoneCast(this.sim);
    if (problem) this.notify(problem);
  }

  private activateBarSlot(index: number) {
    const activation = activateBarSlot(this.sim.player, this.bars, index);
    if (!activation) return;
    if (activation.kind === 'skill') this.input.activateBarSlot(activation.index);
    else if (activation.kind === 'potion') this.input.pressHeal();
    else if (activation.kind === 'consumable') this.useConsumable(activation.id);
    else this.toggleMount(activation.id);
  }

  private trackAchievement(event: AchievementEvent) {
    if (!GAME_FEATURES.achievements) return;
    for (const def of achievementTrack(this.sim.player, event, this.sim.enemies)) {
      this.achievementToasts.show(def);
      pushChatMessage(this.sim.player, 'system', `Achievement earned: ${def.name}`, this.sim.time);
    }
  }

  private questCommand(kind: 'accept' | 'turnIn' | 'abandon', id: QuestId) {
    void this.durable(async () => {
      const result = kind === 'accept' ? await questAccept(this.sim, id, c => this.persistTravel(c))
        : kind === 'turnIn' ? await questTurnIn(this.sim, id, c => this.persistTravel(c))
        : await questAbandon(this.sim, id, c => this.persistTravel(c));
      if (result.ok && kind === 'turnIn') {
        this.renderer.vfx.questComplete(this.sim.player.x, this.sim.player.y);
        this.trackAchievement({ type: 'quest', id, questType: result.quest?.type });
        if (result.quest) repOnQuestTurnIn(this.sim, result.quest);
      }
      this.notify(result.message);
    }, undefined);
  }

  private professionCommand(kind: 'craft' | 'disenchant' | 'use' | 'enchant', arg: string | number | { enchantId: string; target: EnchantTarget }) {
    void this.durable(async () => {
      const result = kind === 'craft' ? await executeCraft(this.sim, String(arg), c => this.persistTravel(c))
        : kind === 'disenchant' ? await executeDisenchant(this.sim, Number(arg), c => this.persistTravel(c))
        : kind === 'enchant' ? await executeEnchant(this.sim, (arg as { enchantId: string; target: EnchantTarget }).enchantId, (arg as { enchantId: string; target: EnchantTarget }).target, c => this.persistTravel(c))
        : await executeUse(this.sim, String(arg), c => this.persistTravel(c));
      if (result.ok && kind === 'craft') {
        const found = findRecipe(String(arg));
        if (found) this.trackAchievement({ type: 'craft', profession: found.profession });
      }
      this.notify(result.message);
    }, undefined);
  }

  private readInput(player: Player = this.sim.player): Input {
    if (this.touch.active) {
      const p = player, touch = this.touch.input;
      const preview = touch.preview;
      const id = touch.aimingSlot !== null ? p.character.skillSlots[touch.aimingSlot] : null;
      const weapon = id ? skillWeapon(id,p.equipment) ?? basicAttackWeapon(p) : basicAttackWeapon(p);
      const distance = Math.min(900,deriveAttackStats(p.stats,weapon).range) * touch.distance;
      const raw = {x:p.x+touch.aim.x*distance,y:p.y+touch.aim.y*distance};
      const recipe = id ? resolveSkill(id,p.derived,p.character).recipe : null;
      let aim = recipe?.kind === 'ground' ? skillTargetPoint(this.world,p,raw,deriveAttackStats(p.stats,weapon).range) : raw;
      const assisted = this.renderer.resolveDirectionAim(this.sim, this.world, aim,
        directionalAimProfile(deriveAttackStats(p.stats,weapon).range, weapon.attackKind, recipe), p);
      if (assisted) aim = assisted;
      const screen = this.renderer.worldToScreen(aim.x,aim.y);
      this.mouse.x = screen.x; this.mouse.y = screen.y; this.mouse.present = true;
      if(preview) this.sim.clearCombatInput();
      const input = touch.consume(aim);
      return this.routeInput(assisted ? {...input,rangedAim:{x:assisted.x,y:assisted.y}} : input, player);
    }
    if (this.usingGamepad) return this.readPadInput(player, this.gamepad, true);
    const blocked = this.pointerInHUD();
    const p = player;
    const aim = blocked
      ? { x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100 }
      : this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    // A captured pointer still belongs to the canvas over a menu button.
    // Clear queued weapon inputs as well as suppressing the held buttons.
    if (blocked) this.sim.clearCombatInput();
    const input = this.input.consume(aim, blocked);
    const aimSkill = input.skillSlot !== null ? p.character.skillSlots[input.skillSlot] : null;
    const aimWeapon = aimSkill ? skillWeapon(aimSkill, p.equipment) ?? basicAttackWeapon(p) : basicAttackWeapon(p);
    const rangedAim = this.renderer.resolvePointerAim(this.sim, this.world, this.mouse.x, this.mouse.y, !blocked && this.mouse.present, aimWeapon);
    return this.routeInput(rangedAim ? { ...input, rangedAim: { x: rangedAim.x, y: rangedAim.y } } : input, player);
  }

  /** One gamepad's frame input for a given player: stick aim, skill slots and
   * direction-assist resolved against that player's position and weapon.
   * Aim state is per-pad so P2's neutral stick never inherits P1's angle, and
   * only the primary pad writes the shared mouse cursor. */
  private padAim = new Map<GamepadInput, { angle: number | null; distance: number }>();
  private readPadInput(p: Player, pad: GamepadInput, primary = false): Input {
    const state = this.padAim.get(pad) ?? { angle: null, distance: 200 };
    this.padAim.set(pad, state);
    if (pad.aim.x || pad.aim.y) {
      state.angle = Math.atan2(pad.aim.y, pad.aim.x);
      state.distance = 60 + Math.hypot(pad.aim.x, pad.aim.y) * 220;
    } else if (pad.move.x || pad.move.y) state.angle = Math.atan2(pad.move.y, pad.move.x);
    const angle = state.angle ?? p.angle;
    let aim = { x: p.x + Math.cos(angle) * state.distance, y: p.y + Math.sin(angle) * state.distance };
    const input = pad.gameplay(aim);
    const id = input.skillSlot !== null ? p.character.skillSlots[input.skillSlot] : null;
    const weapon = id ? skillWeapon(id,p.equipment) ?? basicAttackWeapon(p) : basicAttackWeapon(p);
    const recipe = id ? resolveSkill(id,p.derived,p.character).recipe : null;
    // Resolve aim against the acting player and store the indicator on the
    // renderer showing their view (renderer2 in split-screen, shared otherwise).
    const aimRenderer = this.coopSplit && this.renderer2 && p === this.sim.players[1] ? this.renderer2 : this.renderer;
    const assisted = aimRenderer.resolveDirectionAim(this.sim, this.world, aim,
      directionalAimProfile(deriveAttackStats(p.stats,weapon).range, weapon.attackKind, recipe), p);
    if (assisted) aim = assisted;
    if (primary) {
      const screen = this.renderer.worldToScreen(aim.x, aim.y);
      this.mouse.x = screen.x; this.mouse.y = screen.y; this.mouse.present = true;
    }
    // Controller aiming is independent of the last mouse position and HUD hit regions.
    return this.routeInput({ ...input, aimX: aim.x, aimY: aim.y,
      ...(assisted ? { rangedAim: { x: assisted.x, y: assisted.y } } : {}) }, p);
  }


  /** Bar translation at the input boundary: page switches, potion/mount extras. */
  private routeInput(input: Input, player: Player = this.sim.player): Input {
    if (input.barPage !== undefined) this.bars.page = Math.max(0, Math.min(2, input.barPage));
    const barred = applyBarInput(player, this.bars, input);
    // Mount/consumable commands run as the acting player so a co-op partner's
    // bar slot summons their mount / consumes their item, never the primary's.
    for (const id of barred.mounts) this.sim.asPlayer(player, () => this.toggleMount(id));
    for (const id of barred.consumables) this.sim.asPlayer(player, () => this.useConsumable(id));
    return barred.input;
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    try {
      this.frameBody(now);
    } catch (error) {
      // A fault in sim/render/UI must not kill the loop: reschedule first, then report.
      this.animation = requestAnimationFrame(this.frame);
      console.error('Frame fault; the game loop continues.', error);
      if (now >= this.nextFrameErrorNotice) {
        this.nextFrameErrorNotice = now + 10_000;
        this.notify('A rendering or simulation error was recovered. If it repeats, reload the page — your save is safe.');
      }
    }
  };

  private frameBody = (now: number) => {
    if (this.disposed) return;
    if (document.hidden || this.nativeBackground) {
      this.animation = 0;
      return;
    }
    if (window.EvergrowAndroid && !this.framePacer.ready(now)) {
      this.animation = requestAnimationFrame(this.frame);
      return;
    }
    if (this.performancePhase !== this.phase) { this.performance.suspend(); this.performancePhase = this.phase; }
    this.performance.begin(now);
    const pointerUIStart = this.performance.start();
    this.syncPerformanceInput();
    this.performance.end('monitor', pointerUIStart);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.pollGamepad(now);
    if (now >= this.nextScore) { this.updateScore(now); this.nextScore = now + 250; }
    this.touch.update(this.sim.player,this.phase,this.savingAction,now,this.sim.groundEffects);
    this.renderer.gamepadActive = this.usingGamepad;
    if (this.panels.simulationActive && !this.savingAction && !this.shell.shortcutMenu.isOpen) {
      // The simulation owns the fixed 120 Hz clock and render interpolation.
      this.sim.setSpawnExclusion(this.coopSpawnExclusion());
      this.sim.setCombatViewport(this.renderer.combatViewport);
      // PvP match lifecycle: prep countdown, win detection, scoreboard handoff.
      // Runs before sim.update so the prep hold is in place for the first step.
      const pvpEnd = updatePvpMatch(this.sim, dt);
      for (const announcement of drainPvpAnnouncements(this.sim)) this.announcePvp(announcement);
      if (pvpEnd) this.finishPvpMatch(pvpEnd);
      const livePvp = currentPvpMatch(this.sim);
      if (livePvp && this.pvpScorePanel.opened) this.pvpScorePanel.update(livePvp, pvpScoreboard(this.sim), this.pendingPvpEnd ? { winner: this.pendingPvpEnd.winner, exitAt: this.pvpExitAt } : undefined);
      if (this.pendingPvpEnd && now >= this.pvpExitAt) this.leavePvpMatch();
      const simulationStart = this.performance.start();
      // AI dungeon party: role targeting, tank threat, healer triage, exit despawn.
      tickDungeonParty(this.sim);
      const previousWeave = this.sim.player.affixBuffs?.spent;
      const p2 = this.sim.coop ? this.sim.players[1] : null;
      const p2Input = p2 ? this.readPadInput(p2, this.gamepad2) : undefined;
      // Online co-op: the host runs the authoritative sim and broadcasts
      // snapshots; a client sends input upstream and only interpolates.
      let events: import('./model.ts').CombatEvent[];
      if (this.sim.netMode === 'host' && this.net) {
        // NetHostSession.tick returns the drained events so the normal
        // renderer/audio/damage-meter pipeline keeps working unchanged.
        events = (this.net as import('./net-host.ts').NetHostSession).tick(dt, this.readInput());
      } else if (this.sim.netMode === 'client' && this.net) {
        const client = this.net as import('./net-client.ts').NetClientSession;
        client.sendInput(this.readInput());
        client.tick(dt);
        events = client.drainEvents();
      } else {
        this.sim.update(dt, this.readInput(), p2Input);
        events = this.sim.drainEvents();
      }
      const spentWeave = this.sim.player.affixBuffs?.spent;
      if (spentWeave && spentWeave !== previousWeave) this.audio.spellweave(spentWeave.kind);
      this.performance.end('simulation', simulationStart);
      this.renderer.handleEvents(events, this.reducedMotion);
      // The split-screen second view needs the same combat events — damage
      // numbers, hit sparks, shake — or P2's half renders combat with no feedback.
      if (this.coopSplit && this.renderer2) this.renderer2.handleEvents(events, this.reducedMotion);
      logCombatEvents(this.sim.player, events, this.sim.time);
      this.damageMeter.pushAll(events, this.sim.time * 1000);
      if (this.damageMeterPanel.isOpen) this.damageMeterPanel.update();
      for (const event of events) this.trackAchievement(event);
      for (const event of events) {
        if (event.type === 'loot') this.shell.notifications.push({ kind: 'loot', item: event.item });
        else if (event.type === 'journey') this.shell.notifications.announce(`${event.name} complete. Gained ${event.xp} XP.`);
        else if (event.type === 'level') this.shell.notifications.announce(`Level ${event.level}. Gained ${event.statPoints} attribute points and ${event.skillPoints} skill points.`);
        else if (event.type === 'notice') this.notify(event.message);
        else if (event.type === 'streak') {
          this.renderer.streakBanner.show({ count: event.count, bonusPercent: event.bonusPercent });
          this.audio.pvpCue('firstBlood');
        }
        if (!(event.type === 'cast' && event.enemyKind)) this.audio.play(event);
      }
      if (this.sim.hearthstone.ready) {
        void this.durable(async () => {
          const result = await executeHearthstone(this.sim,
            hearthstoneHome(this.sim, this.overworld.getPortalAnchor(this.sim.travel.homeTown, playerFaction(this.sim.player))), c => this.persistTravel(c));
          if (result.ok) this.finishTravel(); else this.notify(result.message);
        }, undefined);
      }
      if (GAME_FEATURES.transport && this.sim.transportArrival && !this.savingAction) {
        void this.durable(async () => {
          const ok = await this.locations.transport({ kind: 'disembark' });
          if (ok) this.finishTravel(); else this.notify('Could not save.');
        }, undefined);
      }
      if (gatherChannelReady(this.sim)) {
        const node = gatherChannelOf(this.sim)?.node;

        if (node) void this.durable(async () => {
          const result = await executeGather(this.sim, node, c => this.persistTravel(c));
          if (result.ok) {
            this.renderer.vfx.gatherSparkle(node.x, node.y);
            this.trackAchievement({ type: 'gather', profession: node.def.profession });
          }
          this.notify(result.message);
        }, undefined);
      }
      fishingBite(this.fishing, this.sim.player, this.sim.time, this.fishingRandom());
      if (this.sim.eventChannel.ready) this.finishEvent();
      else if(!this.savingAction&&!this.sim.player.dead&&!this.sim.dungeonFloor&&(!this.sim.portal.ready)&&now>=this.nextEventClaim) {
        this.nextEventClaim=now+250;
        const chest=Object.values(this.sim.eventState.sites).find(r=>pendingEventReward(this.sim,r));
        const invasion=pendingWorldEventReward(this.sim);
        if(invasion){void this.durable(async()=>{const result=await claimWorldEventReward(this.sim,invasion,c=>this.persistTravel(c));if(!result.ok){this.nextEventClaim=performance.now()+30000;this.notify(result.message);}},undefined);}
        if(chest){void this.durable(async()=>{const result=await claimCompletedEvent(this.sim,chest.id,c=>this.persistTravel(c));if(!result.ok){this.nextEventClaim=performance.now()+30000;this.notify(result.message);}},undefined);}
      }
      if(!this.savingAction&&!this.sim.player.dead&&this.sim.dungeonFloor&&!this.sim.portal.ready&&now>=this.nextEventClaim){
          this.nextEventClaim=now+250;
          const index=this.sim.dungeonFloor.chests.findIndex((_,i)=>!dungeonChestProblem(this.sim,i));
          if(index>=0)void this.durable(async()=>{const result=await claimDungeonChest(this.sim,index,c=>this.persistTravel(c));if(!result.ok){this.nextEventClaim=performance.now()+30000;this.notify(result.message);}
            else if(result.celebration){this.renderer.handleEvents([result.celebration],this.reducedMotion);this.notify(result.message);}},undefined);
      }
      // Market tick: settle AH sales/returns once a second while playing. The
      // savingAction window (not durable — that would eat held inputs) freezes
      // the sim for the persist so the commit can't clobber live mutations.
      if (!this.savingAction && !this.sim.player.dead && now >= this.nextAuctionTick
        && (this.sim.player.character.auctionHouse?.listings.length ?? 0) > 0) {
        this.nextAuctionTick = now + 1000;
        this.savingAction = true;
        void tickAuctions(this.sim.player, this.persistSheet)
          .then(result => { if (result.ok && result.message) this.notify(result.message); })
          .finally(() => { this.savingAction = false; });
      }
      // Mail tick: sweep expired letters once a second while playing; letters
      // still holding attachments bounce back to the sender's slot. Same
      // savingAction window as the market tick.
      if (GAME_FEATURES.mail && !this.savingAction && !this.sim.player.dead && now >= this.nextMailTick
        && (mailOf(this.sim.player.character)?.messages.length ?? 0) > 0) {
        this.nextMailTick = now + 1000;
        this.savingAction = true;
        void tickMail(this.sim.player, this.mailRepository, this.persistSheet)
          .then(result => { if (result.ok && result.message) this.notify(result.message); })
          .finally(() => { this.savingAction = false; });
      }
      if (this.sim.portal.ready) this.travelThrough(this.overworld.getPortalAnchor(this.sim.travel.homeTown, playerFaction(this.sim.player)), false);
      const run=currentDungeon(this.sim.expeditions);
      const zone = this.currentArea();
      this.renderer.areaBanner.retain(zone.id);
      if (this.areaNotices.update(zone.id, dt)) {
        this.renderer.areaBanner.show(zone);
        this.shell.notifications.announce(`${zone.name}. ${areaLevelLabel(zone)}. ${areaThreat(zone,this.sim.player.level).label}.`);
      }
      if (!run && GAME_FEATURES.minimapTracking) {
        const banner = this.zoneBanner.update(this.world, this.sim.player.x, this.sim.player.y, dt);
        if (banner) {
          pushChatMessage(this.sim.player, 'system', banner.subtitle ? `${banner.title} — ${banner.subtitle}` : banner.title, this.sim.time);
          this.trackAchievement({ type: 'zone', id: banner.key });
        }
      }
      if(run?.rift&&(this.sim.player.dead||run.rift.phase==='failed')){
        if(!this.savingAction)void this.switchDungeon({kind:'death'});
      } else if (this.sim.coop || this.sim.netMode === 'client') {
        // Co-op (couch or online): a downed player auto-releases as a ghost
        // (WoW corpse run) while a teammate still stands; only a full wipe
        // opens the defeat panel. A net client's ghost state arrives via the
        // host snapshot, so it never takes the solo defeat branch.
        if (this.sim.netMode !== 'client') this.releaseCoopSpirits();
        // A wipe = every roster member down (dead or already a released ghost).
        // Checking only `dead` misses ghosts: a released partner leaves dead=false,
        // so the party could end as permanent ghosts with no defeat panel.
        if (this.sim.players.every(pl => pl.dead || this.sim.ghostOf(pl) !== null) && !this.sim.pvpCombatants)
          this.panels.transition('dead', true);
      } else if (this.sim.player.dead && !this.sim.ghost && !this.sim.pvpCombatants) {
        this.panels.transition('dead', true);
      }
      if (now >= this.nextAutosave) { this.saveCharacter(); this.nextAutosave = now + 20_000; }
    }
    this.transmogPanel.update(this.sim.player);
    this.shell.setBuffs(activeBuffs(this.sim.player, this.sim.groundEffects));
    this.shell.setGhostPrompt(this.sim.ghost ? this.sim.ghostPrompt() ?? 'run' : null, this.sim.ghost?.healer.name);
    this.shell.shortcutMenu.setPoints(this.sim.player.character.statPoints, this.sim.player.character.skillPoints);
    this.updatePortalPresentation();
    this.renderer.pointerX = this.mouse.x;
    this.renderer.pointerY = this.mouse.y;
    this.renderer.inspectedEnemyId = this.shell.targetBuffs.held ? this.renderer.targetEffects?.id ?? null : null;
    this.renderer.pointerActive = this.mouse.present && (this.usingGamepad || this.touch.active || !this.pointerOverEffects);
    // Presentation existence does not reveal whether the Thor dashboard covers it.
    this.renderer.navigationVisible = !(this.touch.active && (window.innerWidth < 620 || this.touch.phoneLandscape));
    // Touch owns Map and Portal through its persistent menu; do not leave the
    // desktop minimap hit target behind after moving the touch projection.
    this.shell.setNavigationVisible(this.renderer.navigationVisible && !this.touch.active);
    this.shell.setHomePortalVisible(this.shouldShowHomePortal());
    this.journeys.update();
    const settings = {
      liveMap: this.panels.mapHeld,
      showGroundLootNames: showGroundLootNames(this.groundLootNames, controls.has('revealLoot'), this.input.held('revealLoot'), this.touch.active || this.usingGamepad),
      // Holding the reveal key bypasses the loot filter, standard ARPG behavior.
      lootFilter: GAME_FEATURES.lootFilter && !this.input.held('revealLoot') ? this.lootFilter : 'off',
      reducedMotion: this.reducedMotion, phase: this.phase,
    };
    if (this.phase === 'ready') {
      this.renderer.cameraX = -90 + (this.reducedMotion ? 0 : Math.sin(now / 24000) * 45);
      this.renderer.cameraY = -180 + (this.reducedMotion ? 0 : Math.cos(now / 31000) * 25);
    }
    const renderStart = this.performance.start();
    const worldSource = this.renderCoopWorld(dt, settings);
    this.performance.end('world', renderStart);
    // Legendary moment: a fresh epic+ landing gets its stinger here (the collect
    // event re-sounds it for vacuumed drops); named legendaries also toast.
    for (const moment of this.renderer.drainLootMoments()) {
      this.audio.lootMoment(moment.tier);
      if (moment.tier === 'legendary' || moment.tier === 'unique') {
        const drop = this.sim.groundItems.find(d => d.id === moment.id);
        if (drop) this.shell.notifications.push({ kind: 'loot', item: drop.item, dropped: true });
      }
    }
    const fxStart = this.performance.start();
    this.fx.render(worldSource, this.renderer.hurt, this.renderer.emission);
    this.performance.end('postfx', fxStart);
    const uiStart = this.performance.start();
    const ui = this.uiContext;
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    // Keep shared logical coordinates for drawing, aiming, and the HTML hit targets.
    ui.setTransform(this.uiCanvas.width / this.renderer.width, 0, 0,
      this.uiCanvas.height / this.renderer.height, 0, 0);
    if (this.phase !== 'ready') this.renderer.renderUI(ui, this.sim, this.world, settings);
    if (this.sim.ghost) {
      const p = this.sim.player, alpha = this.sim.interpolationAlpha;
      drawSpiritWorld(ui, this.sim.ghost,
        { x: p.prevX + (p.x - p.prevX) * alpha, y: p.prevY + (p.y - p.prevY) * alpha },
        (x, y) => this.renderer.worldToScreen(x, y), this.renderer.width, this.renderer.height,
        this.sim.time, this.reducedMotion);
    }
    if (this.phase !== 'ready') {
      this.chatFrame.draw(ui, this.sim.player, this.renderer.width, this.renderer.height, this.sim.time,
        { reducedMotion: this.reducedMotion, pointer: this.mouse.present ? this.mouse : null });
      if (GAME_FEATURES.minimapTracking) this.zoneBanner.draw(ui, this.renderer.width, this.renderer.height, this.reducedMotion);
      drawActionBars(ui, this.sim.player, this.bars, this.renderer.width, this.renderer.height, { simTime: this.sim.time });
      drawHotbarEditOverlay(ui, this.bars, this.renderer.width, this.renderer.height);
    }
    this.questPanel.update(this.sim.player, this.phase === 'playing' || this.phase === 'questLog', this.renderer.width, this.renderer.height);
    this.spellbookPanel.update(this.sim.player);
    this.statsPanel.update(this.sim.player, this.sim.time);
    if (this.phase === 'calendar') this.calendarPanel.update();
    this.partyFrame.render(this.sim);
    this.reputationPanel.update(this.sim.player);
    this.buffFrame.render(this.sim.player);
    this.dungeonFinderPanel.render();
    this.auctionPanel.update(this.sim.player);
    this.guildPanel.update(this.sim.player);
    this.professionPanel.update(this.sim.player);
    this.achievementPanel.update(this.sim.player);
    this.glyphPanel.update(this.sim.player);
    this.socketingPanel.update(this.sim.player);
    this.shell.setTargetEffects(this.phase === 'playing' ? this.renderer.targetEffects : null);
    this.groundLootHighlight.update(this.sim.player, this.sim.groundItems,
      this.renderer.groundLootLabels, this.renderer.width, this.renderer.height,
      this.phase === 'playing' && !this.savingAction && !this.touch.active && !this.usingGamepad
        && this.mouse.present && !this.pointerInHUD() ? this.mouse : null, this.sim.time,
      this.phase==='playing'?this.sim.groundPickup.id:null,
      this.phase === 'playing' && !this.savingAction && !this.touch.active && !this.usingGamepad);
    if(this.phase==='playing'&&this.journeys.marker?.known){
      const marker=this.journeys.marker,point=this.renderer.worldToScreen(marker.x,marker.y);
      if(point.x>20&&point.x<this.renderer.width-20&&point.y>35&&point.y<this.renderer.height-30
        &&!isGameUIPoint(point.x,point.y-35,this.renderer.width,this.renderer.height,this.renderer.extraUIBounds,this.renderer.navigationVisible,this.renderer.performanceUIBounds)
        &&hasLineOfSight(this.world,this.sim.player.x,this.sim.player.y,marker.x,marker.y))drawJourneyDestination(ui,point.x,point.y-35,8);
    }
    if(this.touch.active && this.touch.input.preview && this.phase === 'playing') {
      const preview = this.touch.input.preview, p = this.sim.player;
      const id = p.character.skillSlots[preview.slot];
      if(id) {
        const recipe = resolveSkill(id,p.derived,p.character).recipe;
        const origin = this.renderer.worldToScreen(p.x,p.y);
        const at = preview.targeting === 'self' ? origin : {x:this.mouse.x,y:this.mouse.y};
        ui.save(); ui.strokeStyle = preview.canceled ? '#e393a2' : '#d4d5ac'; ui.lineWidth = 1.5;
        ui.setLineDash([5,4]); ui.beginPath(); ui.moveTo(origin.x,origin.y); ui.lineTo(at.x,at.y); ui.stroke();
        const radius = 'radius' in recipe ? recipe.radius ?? 28 : 28;
        const edge = this.renderer.worldToScreen(p.x+radius,p.y);
        ui.beginPath(); ui.ellipse(at.x,at.y,Math.max(8,Math.abs(edge.x-origin.x)),Math.max(6,Math.abs(edge.x-origin.x)),0,0,Math.PI*2); ui.stroke(); ui.restore();
      }
    }
    const p = this.sim.player, alpha = this.sim.interpolationAlpha;
    const mapPlayer = { x: p.prevX + (p.x - p.prevX) * alpha,
      y: p.prevY + (p.y - p.prevY) * alpha, angle: p.angle };
    // Emote/say bubble rides the player's interpolated head like the mana cue.
    if (this.phase === 'playing' && !p.dead)
      drawEmoteBubble(ui, this.emotes.active(this.sim.time),
        this.renderer.worldToScreen(mapPlayer.x, mapPlayer.y - 43),
        this.renderer.width, this.renderer.height, this.sim.time);
    const dungeonRun=currentDungeon(this.sim.expeditions);
    if(dungeonRun?.rift && this.phase!=='ready')drawRiftHUD(ui,dungeonRun,this.renderer.width);
    if (this.phase !== 'ready' && !dungeonRun) this.worldMap.update(mapPlayer, dt);
    if (this.phase === 'map' && dungeonRun) {
      if(this.worldMap.isOpen)this.worldMap.update({x:this.sim.expeditions.surfaceX,y:this.sim.expeditions.surfaceY,angle:0},dt);
      else this.dungeonMap.update(mapPlayer,this.sim.enemies);
    }
    if (this.panels.mapHeld) {
      const rect = this.canvas.getBoundingClientRect();
      const pointer = this.mouse.present && !this.usingGamepad && !this.touch.active && !this.pointerInHUD()
        ? { x: rect.left + this.mouse.x / this.renderer.width * rect.width,
            y: rect.top + this.mouse.y / this.renderer.height * rect.height } : null;
      if (dungeonRun) this.dungeonMap.setExplorationPointer(pointer);
      else this.worldMap.setExplorationPointer(pointer);
    }
    if (this.phase !== 'ready' && (this.renderer.navigationVisible || this.touch.active)) {
      ui.save();
      if (this.touch.active) {
        const mapScale = this.renderer.navigationVisible ? 1 : .75;
        const physicalHeight = Math.max(1, visualViewport?.height ?? innerHeight);
        const mapTop = this.touch.minimapTop * this.renderer.height / physicalHeight;
        ui.globalAlpha = .58;
        ui.translate(this.renderer.width, mapTop); ui.scale(mapScale, mapScale); ui.translate(-this.renderer.width, -18);
      }
      if (dungeonRun) drawCryptMinimap(ui,this.sim.dungeonFloor!,dungeonRun,mapPlayer,this.renderer.width,this.renderer.height,this.journeys.marker,this.sim.time,this.sim.enemies,this.mapIcons);
      else this.worldMap.drawMinimap(ui, mapPlayer, this.renderer.width, this.renderer.height, this.sim.time,
        this.sim.enemies.filter(enemy => enemy.hp > 0).map(enemy => ({
          x: enemy.prevX + (enemy.x - enemy.prevX) * alpha,
          y: enemy.prevY + (enemy.y - enemy.prevY) * alpha, kind: enemy.kind, rank:enemy.rank,
        })));
      if (!dungeonRun && GAME_FEATURES.minimapTracking) {
        const bounds = minimapWorldBounds(mapPlayer, this.renderer.width, this.renderer.height);
        const blips = collectTrackingBlips({
          buildings: this.world.getBuildings(bounds.x, bounds.y, bounds.width, bounds.height),
          questGivers: questMarkers(this.world, this.sim.player, bounds.x, bounds.y, bounds.width, bounds.height)
            .map(m => ({ x: m.x, y: m.y, label: m.label, turnIn: m.mark === 'turnIn' })),
          gatherNodes: gatherNodeBlips(this.world, this.sim.player, this.sim.time, bounds.x, bounds.y, bounds.width, bounds.height),
        }, this.minimapTracking.filter);
        const view = minimapView(mapPlayer, this.renderer.width, this.renderer.height);
        drawTrackingBlips(ui, view, blips,
          (x, y) => this.exploration.isRevealed(x, y));
        for (const marker of questMapMarkers(this.world, this.sim.player)) drawQuestMapMarker(ui, view, marker);
      }
      ui.restore();
      if (!dungeonRun && GAME_FEATURES.minimapTracking && this.renderer.navigationVisible)
        this.minimapTracking.draw(ui, this.renderer.width, this.renderer.height,
          this.mouse.present && !this.usingGamepad && !this.touch.active ? this.mouse : null);
    }
    this.thor.update(now);
    this.performance.end('ui', uiStart);
    const monitorStart = this.performance.start();
    if (this.performance.enabled && now >= this.nextPerformanceCounters) {
      let enemies = 0;
      for (const enemy of this.sim.enemies) if (enemy.hp > 0) enemies++;
      this.performance.setCounters({ enemies, projectiles: this.sim.projectiles.length,
        groundEffects: this.sim.groundEffects.length, ...this.renderer.terrainStats });
      this.nextPerformanceCounters = now + 100;
    }
    this.performanceMonitor.update(now, this.phase);
    this.performance.end('monitor', monitorStart);
    this.performance.finish();
    this.animation = requestAnimationFrame(this.frame);
  };

  private pollGamepad(now: number) {
    if (this.savingAction) return;
    let pads: (PadSnapshot | null)[] = nativeController() ?? [];
    try { if(!window.EvergrowAndroid) pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { /* API may be denied by the host. */ }
    this.gamepad.poll(pads, document.hasFocus() && !document.hidden);
    if (this.sim.coop) { this.gamepad2.padIndex = 1; this.gamepad2.poll(pads, document.hasFocus() && !document.hidden); }
    if (this.gamepad.disconnected && this.usingGamepad) {
      this.clearInput(); this.usingGamepad = false; this.mouse.present = false;
      if (this.phase === 'playing' || this.phase === 'map') this.pause();
      this.notify('Controller disconnected.'); return;
    }
    const pad = this.gamepad;
    if (pad.pressed.size) void this.audio.unlock().catch(() => {});
    if(this.appearanceEditor){
      if(pad.pressed.has(PAD.dodge)||pad.pressed.has(PAD.pause))this.appearanceEditor.cancel();
      else this.appearanceEditor.updateGamepad(pad,now);
      return;
    }
    if (this.phase === 'ready' && this.titleScreen.updateOverlayGamepad(pad, now)) return;
    if(this.chronicle.updateGamepad(pad,now))return;
    if (pad.active && !this.usingGamepad) {
      this.input.clear(); this.sim.clearInput(); this.usingGamepad = true; this.touch.setActive(false); this.usingGamepad = true;
      this.padAim.set(this.gamepad, { angle: this.sim.player.angle, distance: 200 });
    }
    if (!pad.active) { this.gamepadMenu.clear(); if (this.phase === 'character') this.inventoryPanel.updateGamepad(pad, now); if (this.phase === 'skills') this.skillPanel.updateGamepad(pad, now); return; }
    if (this.shell.shortcutMenu.isOpen) {
      if (pad.pressed.has(PAD.pause) || pad.pressed.has(PAD.dodge)) this.shell.shortcutMenu.close();
      else this.gamepadMenu.update(this.shell.shortcutMenu.element, pad, now);
      return;
    }
    if (pad.pressed.has(PAD.dodge) && this.thor.dismissInspection()) {
      pad.pressed.delete(PAD.dodge); // Closing lower-screen detail must not also dodge.
      return;
    }
    if (pad.pressed.has(PAD.pause) || (!this.panels.simulationActive && pad.pressed.has(PAD.dodge))) {
      if (this.phase === 'character' && this.inventoryPanel.dismissPopup()) return;
      if (this.panels.activePanel) this.resume();
      else if (this.phase === 'playing' && !this.savingAction) { if (this.sim.portal.active) this.sim.portal.cancel(); else this.pause(); }
      else if (this.phase === 'paused' && !this.shell.backInMenu()) this.resume();
      else if (this.phase === 'ready') this.shell.titleMount.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.click();
      return;
    }
    if (this.phase === 'paused') { this.shell.updatePauseGamepad(pad, now); return; }
    if (pad.pressed.has(PAD.map) && (this.panels.canOpen('map') || this.phase === 'map')) {
      this.panels.toggleMap(); return;
    }
    if (this.panels.simulationActive && !this.savingAction) {
      if (pad.pressed.has(PAD.up)) { this.openCharacterPanel('skills'); return; }
      if (pad.pressed.has(PAD.left) || pad.pressed.has(PAD.right)) { this.openCharacterPanel('character'); return; }
      if (pad.pressed.has(PAD.down)) { this.requestPortal(); return; }
      if (pad.pressed.has(PAD.interact)) this.interact();
      // Player 2's pad: route their interact to their own actor so a couch
      // partner can loot, talk to NPCs, gather and resurrect independently.
      const p2pad = this.gamepad2;
      if (this.sim.coop && this.sim.netMode === null && p2pad.active && p2pad.pressed.has(PAD.interact)) {
        const partner = this.sim.players[1];
        if (partner) this.interact(undefined, partner);
      }
    } else {
      if (this.phase === 'character') { this.inventoryPanel.updateGamepad(pad, now); return; }
      if (this.phase === 'skills') { this.skillPanel.updateGamepad(pad, now); return; }
      const root = this.phase === 'ready' ? this.shell.titleMount : this.phase === 'map' ? this.shell.mapMount
        : this.panels.activePanel ? this.shell.panelMount : this.canvas.parentElement!.querySelector<HTMLElement>('#overlay')!;
      if (this.phase === 'ready') this.titleScreen.element.classList.add('is-controller');
      this.gamepadMenu.update(root, pad, now, this.phase === 'ready'
        ? { activate: target => this.titleScreen.activateGamepad(target) } : {});
    }
  }

  private showMenu() {
    this.touch?.update(this.sim.player,this.phase,this.savingAction,performance.now());
    const p = this.sim.player;
    const building = this.world.getBuildingAt(p.x, p.y);
    const town = this.world.getSettlements(p.x - 1, p.y - 1, 2, 2)
      .find(place => Math.hypot(p.x - place.x, p.y - place.y) <= place.radius);
    const location = building?.name ?? town?.name ?? this.world.sampleBiome(p.x, p.y).name;
    this.shell.showMenu(this.phase, this.sim.kills, this.sim.time, location);
  }

  toggleSound() {
    if (this.disposed) return;
    this.muted = !this.muted;
    this.shell.refreshOptions(); this.titleScreen.refreshSound();
    this.audio.setEnabled(!this.muted);
    void this.audio.unlock().catch(() => {});
    this.savePreferences();
  }

  private updateScore(now: number) {
    const p = this.sim.player;
    const town = !this.sim.dungeonFloor && this.world.isSanctuary(p.x, p.y);
    const boss = this.sim.enemies.some(e => e.hp > 0 && isBossKind(e.kind)
      && ['chase', 'windup', 'attack', 'recover'].includes(e.state)
      && Math.hypot(e.x - p.x, e.y - p.y) < 1000);
    const trial = this.sim.eventState.trial;
    const event = trial ? this.sim.eventState.sites[trial.siteId] : undefined;
    this.audio.score(now / 1000, { phase: this.panels.mapHeld ? 'playing' : this.phase, biome: this.world.sampleBiome(p.x, p.y).id,
      town, dungeon: !!this.sim.dungeonFloor,
      encounter: boss ? 'boss' : event?.phase === 'active' && Math.hypot(event.x - p.x, event.y - p.y) < EVENT_RULES.abandonRadius ? 'event' : 'none' });
  }
  private setAudioVolume(channel: AudioChannel, value: number) {
    this.audio.setVolume(channel, value); this.savePreferences();
  }
  private savePreferences() {
    try { localStorage.setItem('evergrow-preferences', JSON.stringify({ muted: this.muted, groundLootNames: this.groundLootNames, lootFilter: this.lootFilter, ...this.audio.getVolumes() })); } catch { /* Storage may be disabled. */ }
  }
  /** Fishing rolls ride a seeded stream (world seed ^ fixed-step tick) so checkpoints replay identically. */
  private fishingRandom(): () => number {
    return randomSource((this.overworld.seed ^ Math.imul(Math.floor(this.sim.time * 120) + 1, 0x9e3779b9)) >>> 0);
  }


  private notify(message: string) {
    if (this.disposed) return;
    this.shell.notifications.info(message);
  }

  dispose() {
    this.appearanceEditor?.dispose();this.appearanceEditor=undefined;
    if (this.disposed) return;
    this.disposed = true;
    this.audio.setForeground(false);
    this.abort.abort(); cancelAnimationFrame(this.animation); this.clearInput();
    void this.actionPending.catch(error => console.error(error)).then(async () => {
      try { await this.saveCharacter(true); await this.session.flush(); }
      finally { this.saveClient.dispose(); this.renderer.reset(); this.lifetime.dispose(); }
    }).catch(error => console.error(error));
  }
}
