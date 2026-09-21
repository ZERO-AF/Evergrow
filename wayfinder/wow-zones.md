# WoW WotLK Zone + Transport Dataset

Authoritative dataset for the world atlas (ticket T01). Machine-readable form: `wow-zones.json`.

Conventions: `x,y` are normalized 0..1 inside the zone rect (0,0 = NW corner, y grows south). Borders list the primary neighbor per cardinal direction; `+` extras are additional neighbors on that edge. Faction: A=Alliance, H=Horde, C=Contested, N=Neutral, PvP=Wintergrasp. Dungeons marked (R) are raids. Transport durations are seconds; routes are bidirectional unless noted.

## Kalimdor (21 zones)

| Zone | Lvl | Faction | Size km | Borders | Cities / hubs | Dungeons | Docks | Flight paths |
|---|---|---|---|---|---|---|---|---|
| Durotar | 1-10 | Horde | 1.4x1.2 | N:azshara S:— E:— W:barrens-north | Orgrimmar (H), Razor Hill (H), Sen'jin Village (H) | Ragefire Chasm | Orgrimmar Zeppelin Tower [zeppelin] | Orgrimmar (H) |
| Mulgore | 1-10 | Horde | 1.3x1.1 | N:— S:— E:barrens-south W:— | Thunder Bluff (H), Bloodhoof Village (H) | — | — | Thunder Bluff (H) |
| Teldrassil | 1-10 | Alliance | 1.1x1.3 | N:— S:— E:— W:— | Darnassus (A), Dolanaar (A), Rut'theran Village (A), Darnassus Portal | — | Rut'theran Village Dock [ship] | Darnassus (A), Rut'theran Village (A) |
| Darkshore | 10-20 | Alliance | 0.9x1.6 | N:— S:ashenvale E:— W:— | Auberdine (A), Grove of the Ancients (A) | — | Auberdine Docks [ship] | Auberdine (A), Grove of the Ancients (A) |
| The Barrens (North) | 10-20 | Horde | 1.5x1.2 | N:ashenvale S:barrens-south E:durotar W:stonetalon | The Crossroads (H), Ratchet (N) | Wailing Caverns | Ratchet Dock [ship] | The Crossroads (H), Ratchet (N) |
| The Barrens (South) | 20-35 | Horde | 1.5x1.1 | N:barrens-north S:thousand-needles E:dustwallow W:mulgore | Camp Taurajo (H) | Razorfen Kraul, Razorfen Downs | — | Camp Taurajo (H) |
| Stonetalon Mountains | 15-27 | Contested | 1.0x1.1 | N:ashenvale S:desolace E:barrens-north W:— | Stonetalon Peak (A), Sun Rock Retreat (H) | — | — | Stonetalon Peak (A), Sun Rock Retreat (H) |
| Ashenvale | 18-30 | Contested | 1.6x1.0 | N:darkshore+felwood S:barrens-north+stonetalon E:azshara W:— | Astranaar (A), Splintertree Post (H), Zoram'gar Outpost (H), Forest Song (A) | Blackfathom Deeps | — | Astranaar (A), Splintertree Post (H), Zoram'gar Outpost (H), Forest Song (A) |
| Desolace | 30-40 | Contested | 1.2x1.3 | N:stonetalon S:feralas E:— W:— | Nijel's Point (A), Shadowprey Village (H) | Maraudon | — | Nijel's Point (A), Shadowprey Village (H) |
| Feralas | 40-50 | Contested | 1.4x1.3 | N:desolace S:— E:thousand-needles W:— | Feathermoon Stronghold (A), Camp Mojache (H), Thalanaar (A) | Dire Maul | — | Feathermoon Stronghold (A), Camp Mojache (H), Thalanaar (A) |
| Thousand Needles | 25-35 | Contested | 1.2x1.1 | N:barrens-south S:tanaris E:dustwallow W:feralas | Freewind Post (H), Mirage Raceway (N) | — | — | Freewind Post (H) |
| Tanaris | 40-50 | Contested | 1.4x1.2 | N:thousand-needles S:— E:— W:ungoro | Gadgetzan (N), Steamwheedle Port (N) | Zul'Farrak, Caverns of Time | — | Gadgetzan (N) |
| Un'Goro Crater | 48-55 | Contested | 1.0x1.0 | N:— S:— E:tanaris W:silithus | Marshal's Refuge (N) | — | — | Marshal's Refuge (N) |
| Silithus | 55-60 | Contested | 1.3x1.3 | N:— S:— E:ungoro W:— | Cenarion Hold (N) | Ruins of Ahn'Qiraj (R), Temple of Ahn'Qiraj (R) | — | Cenarion Hold (N) |
| Dustwallow Marsh | 35-45 | Contested | 1.2x1.0 | N:barrens-south S:thousand-needles E:— W:barrens-south | Theramore Isle (A), Brackenwall Village (H), Mudsprocket (N) | Onyxia's Lair (R) | Theramore Dock [ship] | Theramore Isle (A), Brackenwall Village (H), Mudsprocket (N) |
| Azshara | 45-55 | Contested | 1.3x1.1 | N:— S:durotar E:— W:ashenvale+felwood | Valormok (H), Talrendis Point (A) | — | — | Valormok (H), Talrendis Point (A) |
| Felwood | 48-55 | Contested | 1.0x1.4 | N:moonglade+winterspring S:ashenvale E:azshara W:— | Bloodvenom Post (H), Talonbranch Glade (A), Emerald Sanctuary (N) | — | — | Bloodvenom Post (H), Talonbranch Glade (A), Emerald Sanctuary (N) |
| Winterspring | 55-60 | Contested | 1.3x1.1 | N:— S:felwood E:— W:moonglade | Everlook (N), Starfall Village (A) | — | — | Everlook (N) |
| Moonglade | 50-60 | Neutral | 0.9x0.9 | N:— S:felwood E:winterspring W:— | Nighthaven (N) | — | — | Nighthaven (N) |
| Bloodmyst Isle | 10-20 | Alliance | 1.0x1.0 | N:— S:azuremyst E:— W:— | Blood Watch (A), Vindicator's Rest (A) | — | — | Blood Watch (A) |
| Azuremyst Isle | 1-10 | Alliance | 1.1x1.0 | N:bloodmyst S:— E:— W:— | The Exodar (A), Azure Watch (A), Exodar Portal to Darnassus | — | Valaar's Berth [ship] | The Exodar (A), Azure Watch (A) |

## Eastern Kingdoms (24 zones)

| Zone | Lvl | Faction | Size km | Borders | Cities / hubs | Dungeons | Docks | Flight paths |
|---|---|---|---|---|---|---|---|---|
| Eversong Woods | 1-10 | Horde | 1.1x1.2 | N:— S:ghostlands E:— W:— | Silvermoon City (H), Falconwing Square (H), Fairbreeze Village (H), Orb of Translocation | — | — | Silvermoon City (H), Fairbreeze Village (H) |
| Ghostlands | 10-20 | Horde | 1.0x1.4 | N:eversong S:eastern-plaguelands E:— W:— | Tranquillien (H) | Zul'Aman (R) | — | Tranquillien (H), Zul'Aman (N) |
| Tirisfal Glades | 1-10 | Horde | 1.3x1.0 | N:— S:silverpine E:western-plaguelands W:— | Undercity (H), Brill (H), The Bulwark (H), Orb of Translocation | Scarlet Monastery | Undercity Zeppelin Tower [zeppelin] | Undercity (H), The Bulwark (H) |
| Western Plaguelands | 51-58 | Contested | 1.1x1.0 | N:— S:alterac+hinterlands E:eastern-plaguelands W:tirisfal | Chillwind Camp (A), The Bulwark (H) | Scholomance | — | Chillwind Camp (A), The Bulwark (H) |
| Eastern Plaguelands | 53-60 | Contested | 1.3x1.0 | N:ghostlands S:— E:— W:western-plaguelands | Light's Hope Chapel (N) | Stratholme | — | Light's Hope Chapel (N) |
| Alterac Mountains | 30-40 | Contested | 1.0x0.9 | N:western-plaguelands S:hillsbrad E:— W:silverpine | Alterac Ruins (N) | — | — | — |
| Silverpine Forest | 10-20 | Horde | 0.9x1.3 | N:tirisfal S:hillsbrad E:alterac W:— | The Sepulcher (H) | Shadowfang Keep | — | The Sepulcher (H) |
| Hillsbrad Foothills | 20-30 | Contested | 1.3x0.9 | N:alterac S:— E:arathi+hinterlands W:silverpine | Southshore (A), Tarren Mill (H) | — | Southshore Dock [ship] | Southshore (A), Tarren Mill (H) |
| Arathi Highlands | 30-40 | Contested | 1.3x1.0 | N:— S:wetlands E:— W:hillsbrad | Refuge Pointe (A), Hammerfall (H) | — | — | Refuge Pointe (A), Hammerfall (H) |
| The Hinterlands | 40-50 | Contested | 1.2x1.0 | N:western-plaguelands S:hillsbrad E:— W:— | Aerie Peak (A), Revantusk Village (H) | — | — | Aerie Peak (A), Revantusk Village (H) |
| Wetlands | 20-30 | Alliance | 1.2x1.0 | N:arathi S:loch-modan E:— W:— | Menethil Harbor (A) | — | Menethil Harbor [ship] | Menethil Harbor (A) |
| Loch Modan | 10-20 | Alliance | 1.0x1.0 | N:wetlands S:badlands E:— W:dun-morogh | Thelsamar (A) | — | — | Thelsamar (A) |
| Dun Morogh | 1-10 | Alliance | 1.2x1.0 | N:— S:searing-gorge E:loch-modan W:— | Ironforge (A), Kharanos (A) | Gnomeregan | Deeprun Tram (Ironforge) [tram] | Ironforge (A) |
| Badlands | 35-45 | Contested | 1.1x1.0 | N:loch-modan S:searing-gorge E:— W:— | Kargath (H) | Uldaman | — | Kargath (H) |
| Searing Gorge | 43-50 | Contested | 0.9x0.9 | N:dun-morogh S:burning-steppes E:badlands W:— | Thorium Point (N) | — | — | Thorium Point (N) |
| Burning Steppes | 50-58 | Contested | 1.1x1.0 | N:searing-gorge S:redridge E:— W:— | Morgan's Vigil (A), Flame Crest (H) | Blackrock Depths, Lower Blackrock Spire, Upper Blackrock Spire (R), Molten Core (R), Blackwing Lair (R) | — | Morgan's Vigil (A), Flame Crest (H) |
| Elwynn Forest | 1-10 | Alliance | 1.3x1.0 | N:— S:duskwood E:redridge W:westfall | Stormwind City (A), Goldshire (A) | The Stockade | Stormwind Harbor [ship], Deeprun Tram (Stormwind) [tram] | Stormwind City (A) |
| Westfall | 10-20 | Alliance | 1.0x1.1 | N:— S:duskwood E:elwynn W:— | Sentinel Hill (A) | The Deadmines | — | Sentinel Hill (A) |
| Redridge Mountains | 15-25 | Alliance | 1.0x0.9 | N:burning-steppes S:duskwood E:— W:elwynn | Lakeshire (A) | — | — | Lakeshire (A) |
| Duskwood | 18-30 | Alliance | 1.2x0.9 | N:elwynn S:stranglethorn E:deadwind+redridge W:westfall+elwynn | Darkshire (A), Raven Hill (A) | — | — | Darkshire (A), Raven Hill (A) |
| Deadwind Pass | 55-60 | Contested | 0.8x0.9 | N:— S:swamp-of-sorrows E:— W:duskwood | — | Karazhan (R) | — | — |
| Swamp of Sorrows | 35-45 | Contested | 1.1x0.9 | N:deadwind S:blasted-lands E:— W:— | Stonard (H) | Temple of Atal'Hakkar | — | Stonard (H) |
| Blasted Lands | 45-55 | Contested | 1.0x1.0 | N:swamp-of-sorrows S:— E:— W:— | Nethergarde Keep (A), The Dark Portal | — | — | Nethergarde Keep (A) |
| Stranglethorn Vale | 30-45 | Contested | 1.2x1.6 | N:duskwood S:— E:— W:— | Booty Bay (N), Grom'gol Base Camp (H), Rebel Camp (A) | Zul'Gurub (R) | Booty Bay Dock [ship], Grom'gol Zeppelin Tower [zeppelin] | Booty Bay (N), Grom'gol Base Camp (H), Rebel Camp (A) |

## Northrend (10 zones)

| Zone | Lvl | Faction | Size km | Borders | Cities / hubs | Dungeons | Docks | Flight paths |
|---|---|---|---|---|---|---|---|---|
| Borean Tundra | 68-72 | Contested | 1.6x1.3 | N:sholazar S:— E:dragonblight+wintergrasp W:— | Valiance Keep (A), Warsong Hold (H), Amber Ledge (N), Transitus Shield (N), Unu'pe (N) | The Nexus, The Oculus, Eye of Eternity (R) | Valiance Keep Dock [ship], Warsong Hold Zeppelin Tower [zeppelin], Unu'pe Turtle Dock [turtle] | Valiance Keep (A), Warsong Hold (H), Amber Ledge (N), Transitus Shield (N), Unu'pe (N) |
| Howling Fjord | 68-72 | Contested | 1.5x1.4 | N:grizzly-hills S:— E:— W:dragonblight | Valgarde (A), Vengeance Landing (H), Westguard Keep (A), New Agamand (H), Kamagua (N), Fort Wildervar (A), Camp Winterhoof (H) | Utgarde Keep, Utgarde Pinnacle | Valgarde Dock [ship], Vengeance Landing Zeppelin Tower [zeppelin], Kamagua Turtle Dock [turtle] | Valgarde (A), Vengeance Landing (H), Westguard Keep (A), New Agamand (H), Kamagua (N), Fort Wildervar (A), Camp Winterhoof (H) |
| Dragonblight | 71-74 | Contested | 1.6x1.2 | N:crystalsong S:— E:grizzly-hills+howling-fjord W:wintergrasp+borean-tundra | Wintergarde Keep (A), Agmar's Hammer (H), Wyrmrest Temple (N), Stars' Rest (A), Venomspite (H), Moa'ki Harbor (N) | Azjol-Nerub, Ahn'kahet: The Old Kingdom, Naxxramas (R), Obsidian Sanctum (R), Ruby Sanctum (R) | Moa'ki Harbor Turtle Dock [turtle] | Wintergarde Keep (A), Agmar's Hammer (H), Wyrmrest Temple (N), Stars' Rest (A), Venomspite (H), Moa'ki Harbor (N) |
| Grizzly Hills | 73-75 | Contested | 1.3x1.1 | N:zuldrak S:howling-fjord E:— W:dragonblight | Amberpine Lodge (A), Conquest Hold (H), Westfall Brigade Encampment (A), Camp Oneqwah (H) | Drak'Tharon Keep | — | Amberpine Lodge (A), Conquest Hold (H), Westfall Brigade Encampment (A), Camp Oneqwah (H) |
| Zul'Drak | 74-77 | Contested | 1.3x1.1 | N:— S:grizzly-hills E:— W:storm-peaks+crystalsong | The Argent Stand (N), Zim'Torga (N), Ebon Watch (N), Light's Breach (N) | Gundrak | — | The Argent Stand (N), Zim'Torga (N), Ebon Watch (N), Light's Breach (N) |
| Sholazar Basin | 75-78 | Contested | 1.2x1.1 | N:storm-peaks S:borean-tundra E:wintergrasp W:— | Nesingwary Base Camp (N), River's Heart (N) | — | — | Nesingwary Base Camp (N), River's Heart (N) |
| The Storm Peaks | 76-80 | Contested | 1.5x1.3 | N:icecrown S:sholazar+crystalsong E:zuldrak W:— | K3 (N), Frosthold (A), Grom'arsh Crash-Site (H), Bouldercrag's Refuge (N), Ulduar (N), Dun Niffelem (N) | Halls of Stone, Halls of Lightning, Ulduar (R) | — | K3 (N), Frosthold (A), Grom'arsh Crash-Site (H), Bouldercrag's Refuge (N), Ulduar (N), Dun Niffelem (N) |
| Icecrown | 77-80 | Contested | 1.5x1.2 | N:— S:crystalsong+wintergrasp+storm-peaks E:— W:— | The Argent Vanguard (N), Crusaders' Pinnacle (N), The Shadow Vault (N), Death's Rise (N) | Trial of the Champion, Trial of the Crusader (R), Forge of Souls, Pit of Saron, Halls of Reflection, Icecrown Citadel (R) | — | The Argent Vanguard (N), Crusaders' Pinnacle (N), The Shadow Vault (N), Death's Rise (N) |
| Crystalsong Forest | 74-80 | Neutral | 1.2x1.0 | N:icecrown+storm-peaks S:dragonblight E:zuldrak W:wintergrasp | Dalaran (N), Windrunner's Overlook (A), Sunreaver's Command (H), Dalaran Portal to Wintergrasp, Dalaran Portal to Caverns of Time | The Violet Hold | — | Dalaran (N), Windrunner's Overlook (A), Sunreaver's Command (H) |
| Wintergrasp | 77-80 | PvP | 1.1x1.0 | N:icecrown S:dragonblight+borean-tundra E:crystalsong W:sholazar | Wintergrasp Fortress (N), Valiance Landing Camp (A), Warsong Camp (H) | Vault of Archavon (R) | — | — |

## Outland (7 zones)

| Zone | Lvl | Faction | Size km | Borders | Cities / hubs | Dungeons | Docks | Flight paths |
|---|---|---|---|---|---|---|---|---|
| Hellfire Peninsula | 58-63 | Contested | 1.4x1.1 | N:— S:terokkar E:— W:zangarmarsh | Honor Hold (A), Thrallmar (H), Temple of Telhamat (A), Falcon Watch (H), Shatter Point (N), The Dark Portal | Hellfire Ramparts, Blood Furnace, Shattered Halls, Magtheridon's Lair (R) | — | Honor Hold (A), Thrallmar (H), Temple of Telhamat (A), Falcon Watch (H), Shatter Point (N) |
| Zangarmarsh | 60-64 | Contested | 1.4x1.1 | N:blades-edge S:terokkar E:hellfire W:nagrand | Telredor (A), Zabra'jin (H), Cenarion Refuge (N), Orebor Harborage (A), Swamprat Post (H) | The Slave Pens, The Underbog, The Steamvault, Serpentshrine Cavern (R) | — | Telredor (A), Zabra'jin (H), Cenarion Refuge (N), Orebor Harborage (A), Swamprat Post (H) |
| Terokkar Forest | 62-65 | Contested | 1.3x1.1 | N:hellfire+zangarmarsh S:shadowmoon E:— W:nagrand | Shattrath City (N), Allerian Stronghold (A), Stonebreaker Hold (H), Shattrath Portal to Orgrimmar, Shattrath Portal to Stormwind, Shattrath Portal to Ironforge, Shattrath Portal to Darnassus, Shattrath Portal to Exodar, Shattrath Portal to Undercity, Shattrath Portal to Thunder Bluff, Shattrath Portal to Silvermoon | Mana-Tombs, Auchenai Crypts, Sethekk Halls, Shadow Labyrinth | — | Shattrath City (N), Allerian Stronghold (A), Stonebreaker Hold (H) |
| Nagrand | 64-67 | Contested | 1.4x1.1 | N:zangarmarsh S:— E:terokkar W:— | Telaar (A), Garadar (H), Halaa (N), Aeris Landing (N) | — | — | Telaar (A), Garadar (H) |
| Blade's Edge Mountains | 65-68 | Contested | 1.2x1.3 | N:netherstorm S:zangarmarsh E:— W:— | Sylvanaar (A), Thunderlord Stronghold (H), Evergrove (N), Toshley's Station (A) | Gruul's Lair (R) | — | Sylvanaar (A), Thunderlord Stronghold (H), Evergrove (N), Toshley's Station (A) |
| Netherstorm | 67-70 | Contested | 1.4x1.0 | N:— S:blades-edge E:— W:— | Area 52 (N), The Stormspire (N), Cosmowrench (N) | The Mechanar, The Botanica, The Arcatraz, The Eye (R) | — | Area 52 (N), The Stormspire (N), Cosmowrench (N) |
| Shadowmoon Valley | 67-70 | Contested | 1.4x1.1 | N:terokkar S:— E:— W:— | Wildhammer Stronghold (A), Shadowmoon Village (H), Sanctum of the Stars (N), Altar of Sha'tar (N) | Black Temple (R) | — | Wildhammer Stronghold (A), Shadowmoon Village (H), Sanctum of the Stars (N), Altar of Sha'tar (N) |

## Transport routes

| Kind | From | To | Sec | Notes |
|---|---|---|---|---|
| ship | Rut'theran Village (teldrassil) | Auberdine (darkshore) | 60 | — |
| ship | Auberdine (darkshore) | Valaar's Berth (azuremyst) | 90 | — |
| ship | Auberdine (darkshore) | Stormwind Harbor (elwynn) | 120 | — |
| ship | Menethil Harbor (wetlands) | Theramore Isle (dustwallow) | 180 | — |
| ship | Menethil Harbor (wetlands) | Valiance Keep (borean-tundra) | 300 | — |
| ship | Stormwind Harbor (elwynn) | Valiance Keep (borean-tundra) | 300 | — |
| ship | Booty Bay (stranglethorn) | Ratchet (barrens-north) | 240 | — |
| ship | Menethil Harbor (wetlands) | Valgarde (howling-fjord) | 300 | — |
| turtle | Unu'pe (borean-tundra) | Moa'ki Harbor (dragonblight) | 180 | — |
| turtle | Moa'ki Harbor (dragonblight) | Kamagua (howling-fjord) | 180 | — |
| zeppelin | Orgrimmar Zeppelin Tower (durotar) | Undercity Zeppelin Tower (tirisfal) | 120 | — |
| zeppelin | Orgrimmar Zeppelin Tower (durotar) | Warsong Hold Zeppelin Tower (borean-tundra) | 300 | — |
| zeppelin | Undercity Zeppelin Tower (tirisfal) | Grom'gol Zeppelin Tower (stranglethorn) | 180 | — |
| zeppelin | Undercity Zeppelin Tower (tirisfal) | Vengeance Landing Zeppelin Tower (howling-fjord) | 300 | — |
| tram | Deeprun Tram (Ironforge) (dun-morogh) | Deeprun Tram (Stormwind) (elwynn) | 60 | — |
| portal | Rut'theran Village (teldrassil) | Darnassus (teldrassil) | 5 | — |
| portal | The Exodar (azuremyst) | Darnassus (teldrassil) | 5 | — |
| portal | Silvermoon City (eversong) | Undercity (tirisfal) | 5 | Orb of Translocation |
| portal | Undercity (tirisfal) | Silvermoon City (eversong) | 5 | Orb of Translocation |
| portal | The Dark Portal (blasted-lands) | The Dark Portal (hellfire) | 10 | One-way into Outland in WotLK; one-way |
| portal | Shattrath City (terokkar) | Orgrimmar (durotar) | 5 | one-way |
| portal | Shattrath City (terokkar) | Thunder Bluff (mulgore) | 5 | one-way |
| portal | Shattrath City (terokkar) | Undercity (tirisfal) | 5 | one-way |
| portal | Shattrath City (terokkar) | Silvermoon City (eversong) | 5 | one-way |
| portal | Shattrath City (terokkar) | Stormwind City (elwynn) | 5 | one-way |
| portal | Shattrath City (terokkar) | Ironforge (dun-morogh) | 5 | one-way |
| portal | Shattrath City (terokkar) | Darnassus (teldrassil) | 5 | one-way |
| portal | Shattrath City (terokkar) | The Exodar (azuremyst) | 5 | one-way |
| portal | Dalaran (crystalsong) | Wintergrasp Fortress (wintergrasp) | 5 | — |
| portal | Dalaran (crystalsong) | Caverns of Time (tanaris) | 5 | one-way |
| portal | Dalaran (crystalsong) | Orgrimmar (durotar) | 5 | Horde quarter portal; one-way |
| portal | Dalaran (crystalsong) | Silvermoon City (eversong) | 5 | Horde quarter portal; one-way |
| portal | Dalaran (crystalsong) | Undercity (tirisfal) | 5 | Horde quarter portal; one-way |
| portal | Dalaran (crystalsong) | Thunder Bluff (mulgore) | 5 | Horde quarter portal; one-way |
| portal | Dalaran (crystalsong) | Stormwind City (elwynn) | 5 | Alliance quarter portal; one-way |
| portal | Dalaran (crystalsong) | Ironforge (dun-morogh) | 5 | Alliance quarter portal; one-way |
| portal | Dalaran (crystalsong) | Darnassus (teldrassil) | 5 | Alliance quarter portal; one-way |
| portal | Dalaran (crystalsong) | The Exodar (azuremyst) | 5 | Alliance quarter portal; one-way |

### Flight-path links

| From | To | Sec |
|---|---|---|
| Orgrimmar (durotar) | The Crossroads (barrens-north) | 90 |
| Orgrimmar (durotar) | Valormok (azshara) | 120 |
| Orgrimmar (durotar) | Thunder Bluff (mulgore) | 150 |
| Orgrimmar (durotar) | Ratchet (barrens-north) | 100 |
| The Crossroads (barrens-north) | Thunder Bluff (mulgore) | 120 |
| The Crossroads (barrens-north) | Sun Rock Retreat (stonetalon) | 90 |
| The Crossroads (barrens-north) | Splintertree Post (ashenvale) | 90 |
| The Crossroads (barrens-north) | Camp Taurajo (barrens-south) | 80 |
| Ratchet (barrens-north) | Theramore Isle (dustwallow) | 120 |
| Camp Taurajo (barrens-south) | Brackenwall Village (dustwallow) | 80 |
| Camp Taurajo (barrens-south) | Freewind Post (thousand-needles) | 80 |
| Camp Taurajo (barrens-south) | Thunder Bluff (mulgore) | 100 |
| Sun Rock Retreat (stonetalon) | Splintertree Post (ashenvale) | 80 |
| Sun Rock Retreat (stonetalon) | Shadowprey Village (desolace) | 100 |
| Stonetalon Peak (stonetalon) | Nijel's Point (desolace) | 90 |
| Astranaar (ashenvale) | Auberdine (darkshore) | 100 |
| Astranaar (ashenvale) | Grove of the Ancients (darkshore) | 70 |
| Splintertree Post (ashenvale) | Valormok (azshara) | 80 |
| Forest Song (ashenvale) | Valormok (azshara) | 70 |
| Zoram'gar Outpost (ashenvale) | Auberdine (darkshore) | 110 |
| Astranaar (ashenvale) | Emerald Sanctuary (felwood) | 100 |
| Nijel's Point (desolace) | Feathermoon Stronghold (feralas) | 150 |
| Shadowprey Village (desolace) | Camp Mojache (feralas) | 120 |
| Camp Mojache (feralas) | Freewind Post (thousand-needles) | 100 |
| Thalanaar (feralas) | Freewind Post (thousand-needles) | 80 |
| Feathermoon Stronghold (feralas) | Freewind Post (thousand-needles) | 140 |
| Freewind Post (thousand-needles) | Gadgetzan (tanaris) | 120 |
| Gadgetzan (tanaris) | Marshal's Refuge (ungoro) | 100 |
| Marshal's Refuge (ungoro) | Cenarion Hold (silithus) | 110 |
| Theramore Isle (dustwallow) | Mudsprocket (dustwallow) | 60 |
| Brackenwall Village (dustwallow) | Mudsprocket (dustwallow) | 60 |
| Mudsprocket (dustwallow) | Gadgetzan (tanaris) | 90 |
| Emerald Sanctuary (felwood) | Bloodvenom Post (felwood) | 60 |
| Bloodvenom Post (felwood) | Talonbranch Glade (felwood) | 60 |
| Talonbranch Glade (felwood) | Everlook (winterspring) | 90 |
| Emerald Sanctuary (felwood) | Nighthaven (moonglade) | 70 |
| Nighthaven (moonglade) | Everlook (winterspring) | 80 |
| Nighthaven (moonglade) | Darnassus (teldrassil) | 150 |
| Nighthaven (moonglade) | Thunder Bluff (mulgore) | 160 |
| Auberdine (darkshore) | Rut'theran Village (teldrassil) | 60 |
| Auberdine (darkshore) | Darnassus (teldrassil) | 80 |
| The Exodar (azuremyst) | Azure Watch (azuremyst) | 40 |
| The Exodar (azuremyst) | Blood Watch (bloodmyst) | 60 |
| Talrendis Point (azshara) | Forest Song (ashenvale) | 70 |
| Stormwind City (elwynn) | Ironforge (dun-morogh) | 150 |
| Stormwind City (elwynn) | Goldshire (elwynn) | 30 |
| Stormwind City (elwynn) | Sentinel Hill (westfall) | 80 |
| Stormwind City (elwynn) | Lakeshire (redridge) | 80 |
| Stormwind City (elwynn) | Darkshire (duskwood) | 100 |
| Sentinel Hill (westfall) | Raven Hill (duskwood) | 80 |
| Raven Hill (duskwood) | Darkshire (duskwood) | 60 |
| Darkshire (duskwood) | Rebel Camp (stranglethorn) | 70 |
| Rebel Camp (stranglethorn) | Booty Bay (stranglethorn) | 120 |
| Grom'gol Base Camp (stranglethorn) | Booty Bay (stranglethorn) | 90 |
| Darkshire (duskwood) | Karazhan (deadwind) | 60 |
| Lakeshire (redridge) | Morgan's Vigil (burning-steppes) | 90 |
| Morgan's Vigil (burning-steppes) | Flame Crest (burning-steppes) | 60 |
| Flame Crest (burning-steppes) | Thorium Point (searing-gorge) | 60 |
| Thorium Point (searing-gorge) | Kargath (badlands) | 80 |
| Kargath (badlands) | Thelsamar (loch-modan) | 90 |
| Thelsamar (loch-modan) | Ironforge (dun-morogh) | 80 |
| Thelsamar (loch-modan) | Menethil Harbor (wetlands) | 90 |
| Menethil Harbor (wetlands) | Refuge Pointe (arathi) | 80 |
| Refuge Pointe (arathi) | Southshore (hillsbrad) | 80 |
| Hammerfall (arathi) | Tarren Mill (hillsbrad) | 80 |
| Southshore (hillsbrad) | Aerie Peak (hinterlands) | 100 |
| Tarren Mill (hillsbrad) | Revantusk Village (hinterlands) | 110 |
| Tarren Mill (hillsbrad) | The Sepulcher (silverpine) | 80 |
| The Sepulcher (silverpine) | Undercity (tirisfal) | 80 |
| Undercity (tirisfal) | The Bulwark (tirisfal) | 60 |
| The Bulwark (tirisfal) | Chillwind Camp (western-plaguelands) | 60 |
| Chillwind Camp (western-plaguelands) | Light's Hope Chapel (eastern-plaguelands) | 100 |
| Aerie Peak (hinterlands) | Light's Hope Chapel (eastern-plaguelands) | 120 |
| Light's Hope Chapel (eastern-plaguelands) | Zul'Aman (ghostlands) | 80 |
| Zul'Aman (ghostlands) | Tranquillien (ghostlands) | 50 |
| Tranquillien (ghostlands) | Silvermoon City (eversong) | 80 |
| Silvermoon City (eversong) | Fairbreeze Village (eversong) | 40 |
| Stonard (swamp-of-sorrows) | Nethergarde Keep (blasted-lands) | 90 |
| Stonard (swamp-of-sorrows) | Grom'gol Base Camp (stranglethorn) | 120 |
| Ironforge (dun-morogh) | Thorium Point (searing-gorge) | 90 |
| Ironforge (dun-morogh) | Menethil Harbor (wetlands) | 100 |
| Valiance Keep (borean-tundra) | Amber Ledge (borean-tundra) | 80 |
| Warsong Hold (borean-tundra) | Amber Ledge (borean-tundra) | 80 |
| Amber Ledge (borean-tundra) | Transitus Shield (borean-tundra) | 40 |
| Valiance Keep (borean-tundra) | Unu'pe (borean-tundra) | 70 |
| Unu'pe (borean-tundra) | Moa'ki Harbor (dragonblight) | 80 |
| Amber Ledge (borean-tundra) | Nesingwary Base Camp (sholazar) | 90 |
| Nesingwary Base Camp (sholazar) | River's Heart (sholazar) | 50 |
| River's Heart (sholazar) | Valiance Landing Camp (wintergrasp) | 70 |
| Moa'ki Harbor (dragonblight) | Wyrmrest Temple (dragonblight) | 60 |
| Wyrmrest Temple (dragonblight) | Agmar's Hammer (dragonblight) | 50 |
| Wyrmrest Temple (dragonblight) | Wintergarde Keep (dragonblight) | 60 |
| Wyrmrest Temple (dragonblight) | Stars' Rest (dragonblight) | 50 |
| Wyrmrest Temple (dragonblight) | Venomspite (dragonblight) | 50 |
| Wintergarde Keep (dragonblight) | Amberpine Lodge (grizzly-hills) | 70 |
| Venomspite (dragonblight) | Conquest Hold (grizzly-hills) | 70 |
| Wyrmrest Temple (dragonblight) | Dalaran (crystalsong) | 80 |
| Amberpine Lodge (grizzly-hills) | Westfall Brigade Encampment (grizzly-hills) | 60 |
| Conquest Hold (grizzly-hills) | Camp Oneqwah (grizzly-hills) | 60 |
| Westfall Brigade Encampment (grizzly-hills) | The Argent Stand (zuldrak) | 80 |
| Camp Oneqwah (grizzly-hills) | The Argent Stand (zuldrak) | 80 |
| Amberpine Lodge (grizzly-hills) | Fort Wildervar (howling-fjord) | 80 |
| Conquest Hold (grizzly-hills) | Camp Winterhoof (howling-fjord) | 80 |
| Valgarde (howling-fjord) | Westguard Keep (howling-fjord) | 70 |
| Valgarde (howling-fjord) | Fort Wildervar (howling-fjord) | 80 |
| Vengeance Landing (howling-fjord) | New Agamand (howling-fjord) | 60 |
| Vengeance Landing (howling-fjord) | Camp Winterhoof (howling-fjord) | 70 |
| Kamagua (howling-fjord) | Westguard Keep (howling-fjord) | 50 |
| The Argent Stand (zuldrak) | Zim'Torga (zuldrak) | 50 |
| The Argent Stand (zuldrak) | Light's Breach (zuldrak) | 40 |
| Light's Breach (zuldrak) | Ebon Watch (zuldrak) | 40 |
| Zim'Torga (zuldrak) | K3 (storm-peaks) | 90 |
| The Argent Stand (zuldrak) | Dalaran (crystalsong) | 90 |
| K3 (storm-peaks) | Frosthold (storm-peaks) | 60 |
| K3 (storm-peaks) | Grom'arsh Crash-Site (storm-peaks) | 60 |
| Frosthold (storm-peaks) | Bouldercrag's Refuge (storm-peaks) | 60 |
| Grom'arsh Crash-Site (storm-peaks) | Dun Niffelem (storm-peaks) | 60 |
| Bouldercrag's Refuge (storm-peaks) | Ulduar (storm-peaks) | 50 |
| Ulduar (storm-peaks) | The Argent Vanguard (icecrown) | 90 |
| Dalaran (crystalsong) | The Argent Vanguard (icecrown) | 90 |
| Dalaran (crystalsong) | Windrunner's Overlook (crystalsong) | 50 |
| Dalaran (crystalsong) | Sunreaver's Command (crystalsong) | 50 |
| The Argent Vanguard (icecrown) | Crusaders' Pinnacle (icecrown) | 40 |
| Crusaders' Pinnacle (icecrown) | The Shadow Vault (icecrown) | 70 |
| The Shadow Vault (icecrown) | Death's Rise (icecrown) | 60 |
| Honor Hold (hellfire) | Temple of Telhamat (hellfire) | 70 |
| Thrallmar (hellfire) | Falcon Watch (hellfire) | 60 |
| Honor Hold (hellfire) | Shatter Point (hellfire) | 60 |
| Thrallmar (hellfire) | Shatter Point (hellfire) | 60 |
| Temple of Telhamat (hellfire) | Telredor (zangarmarsh) | 70 |
| Falcon Watch (hellfire) | Zabra'jin (zangarmarsh) | 80 |
| Falcon Watch (hellfire) | Swamprat Post (zangarmarsh) | 50 |
| Telredor (zangarmarsh) | Orebor Harborage (zangarmarsh) | 60 |
| Telredor (zangarmarsh) | Cenarion Refuge (zangarmarsh) | 50 |
| Zabra'jin (zangarmarsh) | Cenarion Refuge (zangarmarsh) | 60 |
| Orebor Harborage (zangarmarsh) | Sylvanaar (blades-edge) | 70 |
| Zabra'jin (zangarmarsh) | Thunderlord Stronghold (blades-edge) | 80 |
| Cenarion Refuge (zangarmarsh) | Shattrath City (terokkar) | 80 |
| Shattrath City (terokkar) | Allerian Stronghold (terokkar) | 50 |
| Shattrath City (terokkar) | Stonebreaker Hold (terokkar) | 50 |
| Shattrath City (terokkar) | Telaar (nagrand) | 80 |
| Shattrath City (terokkar) | Garadar (nagrand) | 80 |
| Allerian Stronghold (terokkar) | Wildhammer Stronghold (shadowmoon) | 90 |
| Stonebreaker Hold (terokkar) | Shadowmoon Village (shadowmoon) | 90 |
| Telaar (nagrand) | Telredor (zangarmarsh) | 90 |
| Garadar (nagrand) | Zabra'jin (zangarmarsh) | 90 |
| Sylvanaar (blades-edge) | Toshley's Station (blades-edge) | 50 |
| Sylvanaar (blades-edge) | Evergrove (blades-edge) | 50 |
| Thunderlord Stronghold (blades-edge) | Evergrove (blades-edge) | 50 |
| Evergrove (blades-edge) | Area 52 (netherstorm) | 80 |
| Area 52 (netherstorm) | The Stormspire (netherstorm) | 50 |
| Area 52 (netherstorm) | Cosmowrench (netherstorm) | 60 |
| Wildhammer Stronghold (shadowmoon) | Sanctum of the Stars (shadowmoon) | 60 |
| Shadowmoon Village (shadowmoon) | Altar of Sha'tar (shadowmoon) | 60 |
| Sanctum of the Stars (shadowmoon) | Altar of Sha'tar (shadowmoon) | 50 |
