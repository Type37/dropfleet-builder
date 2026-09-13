/* 1st edition Dropfleet scenarios converted to the current edition by WarLore on Jet's call (2026-09-13),
   from TTCombat's "Scenarios (Unsupported)" downloads: Automated_Dreadnought.pdf, Advent_Scenarios.pdf and
   Dropfleet_Core_Scenarios.pdf. The 1st edition rules are Desktop_Dropfleet_Rulebook_1.2.pdf; the current
   ones the 2.3.1 rulebook (section numbers below), Scenario Expansion 1 and Fleet_Space_Stations_250828.pdf.

   Every change maps a 1st edition term to the current rule that does the same job:
   - Cluster of 2/3/4 Sectors -> Small/Medium/Large City. Hold 2/3/4 VP, Contest 0/1/2 VP on turns 4 and 6
     is exactly Standard Scoring's table and rounds (12.1.5). Hold/Contest -> Control/Contest (11.1).
   - Sectors -> Features (11.3): Military -> Military Outpost, Orbital Defence -> Orbital Defence Gun,
     Power Plant -> Power Plant, Comms Station -> Comms Station. Commercial and Industrial have no Feature.
     "1VP per Sector destroyed" -> Demolish Scoring (Medium Levelled = 3VP = its 3 Sectors).
   - Space Station -> Space Station Dropsite. "Score as Medium Clusters" -> Medium Space Station; where a page
     gives no size, Medium. Mass Driver / "Burnthrough" (1st ed. Laser) / "Close Action" (1st ed. Missile)
     armaments -> Mass Driver / Laser / Missile Armament (Fleet Space Stations p2). Who fires them follows
     Dragonslayer.
   - Critical Location -> Focal Point with a range of 6" (Scenario Expansion 1), TTCombat's own conversion
     of the 1st edition Moonshot.
   - Battleline -> Close, Distant -> Distant, Directly Deployed -> Directly Deploy, Column and Rapid
     Response/Reaction -> Staggered (Scenario Expansion 1). "Opposing edges" -> Line; "12" along opposing
     board corners" -> Table Corners.
   - Fine / Dense Debris Field -> Micrometeor Cloud / Dense Debris Field, LSO -> Large Object.
   - Turns -> rounds (6 is standard), Roundup Phase -> End Phase, Battlegroup -> Group, Infantry/Armour
     tokens -> Battalions, "activated second" -> 2nd initiative, Super Heavy -> Colossal.
   Maps are redrawn by scripts/draw-rulebook-maps.js. Loaded after scenario-lib.js on the references page. */
(function(){
  const NOTE=`NB: I converted this from 1st edition's rules. Let me know what you think via <a href="mailto:warlore1@outlook.com">email</a> if you want.`;
  const ARM={
    mass:{name:'Mass Driver Armament',arc:'F/S/R',attack:'3',lock:'3+',damage:'1',type:'K',special:'-'},
    laser:{name:'Laser Armament',arc:'F/S/R',attack:'2',lock:'3+',damage:'1',type:'E',special:'Burnthrough-1, Flash-1'},
    missile:{name:'Missile Armament',arc:'F/S/R',attack:'4',lock:'3+',damage:'1',type:'K',special:'Close Action'},
  };
  const FIRE=`Space Stations activate at the end of the Activation Phase, and the player who Controls a Space Station attacks with its Armaments.`;
  const DEBRIS=`2-5 Micrometeor Clouds, 4-6 Dense Debris Fields.`;
  const FOCAL=`Each Dropsite is a Focal Point with a range of 6".`;
  const LIST=[];
  // features: the Features drawn on the map, so their stats show beside it
  const add=s=>LIST.push({converted:true, note:NOTE, ...s});

  /* ── Automated_Dreadnought.pdf, page 2 ── */
  add({id:'the-ancient-relic', name:'The Ancient Relic', src:'Automated Dreadnought', leviathan:'Automated Dreadnought',
   intro:`A mysterious Automated Dreadnought wandered into an area of conflict. All attempts to contact it have failed, and its withering firepower has left a trail of destruction in its wake. You have the order to capture this vessel and use it to turn the tide of battle to your favour - a prize like this does not often present itself.`,
   players:`2`,
   scenery:`2-5 Micrometeor Clouds, 4-6 Dense Debris Fields, placed away from the centre line of the table.`,
   deployment:`All players Distant, from opposite table edges as shown.`,
   scoring:[`Standard Scoring. Each Space Station is a Medium Space Station.`,
            `A player that Levels a Space Station on their opponent's half of the table gains 4VP, in addition to Standard Scoring.`,
            `The player that takes control of the Automated Dreadnought gains 4VP.`],
   leviathanRulesLabel:'Controlling the Dreadnought',
   // 1st ed. "goes up one orbital layer (if possible)": it starts in Orbit, the current edition's top layer (3.1), so nothing is left to do
   leviathanRules:[`The Automated Dreadnought is deployed on the centre line of the table in Orbit, touching a table edge and facing the opposite edge (shown in orange).`,
     `The Automated Dreadnought does not follow the normal activation order. It activates during the Cleanup step of the End Phase, and the player with 2nd initiative that round activates it.`,
     `When the Automated Dreadnought activates, it moves its Thrust along the centre line, then attacks the closest Group or Space Station as if it were on the Weapons Free order.`,
     `Once the Automated Dreadnought has less than half its Hull Points remaining, players may deploy Battalions onto it as if it were a Medium Space Station.`,
     `At the end of each round, if only one player has Battalions on the Automated Dreadnought, that player takes control of it. Remove all Battalions from it; it becomes a Ship in that player's Fleet in a Group of its own, and activates after all other Groups have activated.`]});

  /* ── Advent_Scenarios.pdf, pages 2-4 ── */
  add({id:'resistance-spearhead', sizes:true, features:['Military Outpost'], name:'Resistance Spearhead', src:'Advent Scenarios',
   intro:`The forces of the Resistance have rallied against the enemy. They’ve jumped into system with barely a moment’s notice, and are on the way to make planetfall. The gung-ho approach is shocking, but their limited resources will be their downfall.`,
   players:`1 attacker in red, 1 defender in blue. The Resistance player is the attacker.`,
   scenery:DEBRIS,
   deployment:`All players Close, from opposite table edges as shown.`,
   scoring:[`Attacker: Standard Scoring, with every Dropsite scoring as a Medium Dropsite.`,
            `Defender: can only Contest Dropsites, even when they Control them, and every Dropsite scores as a Medium Dropsite. The defender gains 1VP for every enemy Group destroyed, and loses 1VP when a Dropsite is Ruined and a further 3VP when it is Levelled.`],
   variant:[`Turf War: both players play as Resistance, and every City is replaced with a Space Station of the same size.`]});

  add({id:'heavy-convoy', name:'Heavy Convoy', src:'Advent Scenarios',
   intro:`There’s little that can attract an enemy fleet to an empty area of space quite like the prize of a planet’s worth of resources. The enemy are trying to move a massive convoy, spearheaded by 2 Dreadnoughts. Destroying them will cripple the fleet, and leave plenty of supplies for the victors.`,
   players:`1 attacker in red, 1 defender in blue. The defender must take 2 Dreadnoughts; the attacker cannot take any. Recommended 1300 points.`,
   scenery:DEBRIS,
   deployment:`All players Staggered, from opposite table edges as shown. Both of the defender's Dreadnought Groups must be among the Groups they deploy in the 1st round.`,
   scoring:[`Each Dreadnought that touches the red table edge is removed from the game and gains the defender 3VP.`,
            `Each Dreadnought still on the table at the end of the game gains the defender 1VP.`,
            `Each Dreadnought destroyed gains the attacker 3VP.`,
            `Each other Group destroyed gains the destroying player 1VP.`],
   variant:[`David & Goliath: the attacker cannot take any Ships of H or C Tonnage.`]});

  add({id:'monitoring-the-situation', sizes:true, features:['Orbital Defence Gun', 'Military Outpost'], name:'Monitoring the Situation', src:'Advent Scenarios',
   intro:`A well defended country is the best place to make planetfall. Although the opposition is proving to be strong, this critical point on the map will make an excellent beach head for the incoming assault. Break through the defences and secure the location. If the entrenched orbital batteries can be turned on the defenders, all the better for a swift victory.`,
   players:`1 attacker in blue, 1 defender in red. The defender must take 3 Groups of Monitors in a Skirmish or Clash, and 5 in a Battle.`,
   scenery:`1 Planetary Ring as shown, 4 Micrometeor Clouds, 4 Dense Debris Fields.`,
   deployment:`All players Close, from their table edges as shown. The defender's Monitor Groups are Directly Deployed within 6" of a City.`,
   scoring:[`Attacker: Standard Scoring, and 1VP for every Group of Monitors destroyed.`,
            `Defender: in rounds 4 and 6, the Control VP from the Standard Scoring table for every Dropsite the attacker does not Control, and 1VP for every Group of Monitors that survives until the end of the game.`],
   special:[`Each round, one of the defender's Groups of Monitors may be given one additional Order at the start of the End Phase.`],
   variant:[`Defensive Station: place 2 Medium Space Stations 18" from the defender's table edge. Each is armed with a Laser Armament and scores in the same way as the Cities. ${FIRE}`],
   weapons:[ARM.laser]});

  /* ── Dropfleet_Core_Scenarios.pdf, pages 2-9 ── */
  add({id:'core-take-and-hold', sizes:true, features:['Military Outpost'], name:'Take & Hold (1st edition)', src:'Core Scenarios',
   intro:`Your forces advance, ready to take the fight to the enemy on the surface and in the space above. But they are just as determined to hold the key strategic areas on this war-torn planet. Take the important landing sites and destroy their ships before they do the same to you!`,
   players:`2`, scenery:DEBRIS,
   deployment:`All players Staggered, from opposite table edges as shown.`,
   scoring:[`Standard Scoring.`, FOCAL],
   variant:[`Double Down: the two Cities either side of the centre City along the centre line, and their Focal Points, are worth double VP.`]});

  add({id:'core-mixed-engagement', sizes:true, features:['Military Outpost'], name:'Mixed Engagement', src:'Core Scenarios',
   intro:`Hostilities over this world are centred around militarily significant space stations and their ground based supply clusters. Capture these stations and their support clusters before the enemy can, and turn the stations’ guns on the enemy fleet.`,
   players:`2`, scenery:DEBRIS,
   deployment:`All players Distant, from opposite table edges as shown.`,
   scoring:[`Standard Scoring from the Cities only.`, FOCAL],
   special:[`Each Space Station is a Medium Space Station armed with a Laser Armament and a Missile Armament. ${FIRE}`],
   weapons:[ARM.laser, ARM.missile],
   variant:[`Valuable Supplies: the Focal Points on the two Cities are worth double VP.`]});

  add({id:'core-erupting-battlefront', sizes:true, features:['Military Outpost'], name:'Erupting Battlefront (1st edition)', src:'Core Scenarios',
   intro:`What seemed like a Recon skirmish was in reality the prelude to a fleet sized engagement, with the foe making a play for key sectors on the surface. Capture and hold them quickly; your reinforcements are en-route, but so are the enemy’s...`,
   players:`2`,
   scenery:`1 Planetary Ring across the centre of the table as shown.`,
   deployment:`All players Staggered, from opposite table edges as shown.`,
   scoring:[`Red player: Demolish Scoring from the B Cities, and only the red player scores their Focal Points (range 6"). Standard Scoring from the A Cities.`,
            `Blue player: Demolish Scoring from the A Cities, and only the blue player scores their Focal Points (range 6"). Standard Scoring from the B Cities.`,
            `Both players: Standard Scoring from the C City and the Space Stations, which are also Focal Points with a range of 6".`],
   special:[`Each Space Station is a Medium Space Station.`],
   variant:[`Punching Up: the C City gains 2 Orbital Defence Guns, and keeps its Military Outposts.`]});

  add({id:'core-station-assault', name:'Station Assault', src:'Core Scenarios',
   intro:`This planet sports a highly complex and deadly set of orbital defences that are ready to be turned against the enemy. Seize them and put their fearsome weaponry to good use against the oncoming foe before they can return the favour!`,
   players:`2`, scenery:DEBRIS,
   deployment:`All players Close, from opposite table corners as shown.`,
   scoring:[`Standard Scoring. Each Space Station is a Medium Space Station.`,
            `Each B Space Station is also a Focal Point with a range of 6".`],
   variant:[`Armed Space Stations!: each A Space Station is armed with a Mass Driver Armament and a Missile Armament, and each B Space Station with a Laser Armament and a Missile Armament. ${FIRE}`],
   weapons:[ARM.mass, ARM.laser, ARM.missile]});

  add({id:'core-grid-control', sizes:true, features:['Military Outpost', 'Orbital Defence Gun'], name:'Grid Control', src:'Core Scenarios',
   intro:`Central to command’s plan for the region and holding onto this planet is a complex grid of defence weapons, manufacturing areas and military complexes. Approach these important clusters and either control them or pound them to dust to deny them to the enemy.`,
   players:`2`, scenery:DEBRIS,
   deployment:`All players Staggered, from opposite table edges as shown.`,
   scoring:[`Standard Scoring.`, FOCAL,
            `The two Medium Cities award double Standard Scoring, and their Focal Points double VP.`],
   variant:[`Orbital Installation: replace the centre City with a Large Space Station armed with 4 Laser Armaments, and the two Medium Cities with Medium Space Stations armed with 2 Mass Driver Armaments each. ${FIRE}`],
   weapons:[ARM.laser, ARM.mass]});

  add({id:'core-power-grab', features:['Power Plant', 'Military Outpost'], name:'Power Grab (1st edition)', src:'Core Scenarios',
   intro:`This region’s main weakness is intermittent and shifting power supply, often generated by unstable power sources. Holding these generators could deliver the whole region, but denying them to the opposing forces is the long term aim, one way or another.`,
   players:`2`,
   scenery:`2-8 Micrometeor Clouds, 6-10 Dense Debris Fields.`,
   deployment:`All players Staggered, from opposite table corners as shown.`,
   scoring:[`Standard Scoring.`, FOCAL,
            `Cities with a Power Plant award double Standard Scoring, and no Standard Scoring once their Power Plant is destroyed.`],
   variant:[`Bifurcate: use no Micrometeor Clouds or Dense Debris Fields. Place a Planetary Ring through the centre of the table, from the centre of the north table edge to the centre of the south table edge.`]});

  add({id:'core-defence-relay', sizes:true, features:['Comms Station', 'Military Outpost'], name:'Defence Relay', src:'Core Scenarios',
   intro:`The heavily defended Defence Relay in the area grants a huge advantage to opposing fleets, not least because of the highly advanced comms sectors interlinked with its systems. Capture them and the associated space stations to gain the upper hand in this region of space over the planet.`,
   players:`2`, scenery:DEBRIS,
   deployment:`All players Staggered, from opposite table edges as shown.`,
   scoring:[`Standard Scoring. Each Space Station is a Medium Space Station.`, FOCAL,
            `A player that destroys a Comms Station, or the Dropsite holding one, loses 4VP.`,
            `A player gains 5VP at the end of the game for each Dropsite with a Comms Station they Control.`],
   special:[`Each Space Station is armed with a Laser Armament, a Mass Driver Armament and a Missile Armament. ${FIRE}`],
   weapons:[ARM.laser, ARM.mass, ARM.missile],
   variant:[`Surface to Space: replace each Space Station with a Medium City that has an Orbital Defence Gun and 2 Military Outposts.`]});

  SCENARIOS.push(...LIST);
  LIST.forEach(s=>{ SCENARIO_MAPS.add(s.id); SCENARIO_MAP_SVG.add(s.id); });
  // Dragonslayer (scenario-lib.js) is converted from 1st edition too
  SCENARIOS.forEach(s=>{ if(s.id==='dragonslayer') s.converted=true; });

  // Automated_Dreadnought.pdf, page 1, put into current terms the way the Ether Drake was. Saves: Jet's call (2026-09-13),
  // taken from current Heavy Ships with Hull 15. PD 8 has no current stat. Weapons: Scald -> Scald-1 (14.2.26) on
  // Energy plasma; Particle ("always inflict Critical Hits ... passive saves may not be taken") -> Core (C), the
  // current type only Shield and Backup saves stop (7.3.4); Close Action stays. Regenerate (2) -> Regenerate-2 (14.1.15).
  SCN_LEVIATHANS['Automated Dreadnought']={
    title:'Automated Dreadnought', kind:'Leviathan, H Tonnage', art:'automated_dreadnought.webp',
    current:{thrust:'8"',scan:'12"',sig:'10"/20"',hull:15,es:'3+',ks:'4+',bs:'5+',g:'1'},
    special:'Regenerate-2, Reinforced Armour',
    weapons:{head:['Type','Lock','Attack','Damage','Arc','Special','Dmg Type'],
             rows:[['Small Plasma Cannons','3+','3','2','F/S(L)','Scald-1','E'],
                   ['Small Plasma Cannons','3+','3','2','F/S(R)','Scald-1','E'],
                   ['Large Plasma Cannons','2+','3','3','F/S','Scald-1','E'],
                   ['Disruptor','2+','6','1','F','-','C'],
                   ['Guardian Point Defence','4+','3','1','F/S/R','Close Action','K']]},
    rules:[['Regenerate-2','This Ship recovers 2 lost Hull Points at the end of its activation.'],
           ['Reinforced Armour','Weapons rolling to hit this Ship or its Group can only score criticals against it on a result of a 3 higher than its Lock value.']],
    famousLabel:'Recognised Automated Dreadnoughts:', famous:'Stalwart, Gloria, Topmaniac',
    lore:['A sad story. Its masters have been dead for millions of yars, but this massive warship continues to stand vigil over the broken rubble of their empire. Smaller than modern Dreadnoughts, it is still a formidable foe.',
          'It was one of several flagships belonging to an unusually powerful interstellar empire that flourished in a small region of our galaxy some seven million years ago. As is so often the case, that empire was brought to a sudden and violent end at the hands of its neighbours in a series of very destructive wars.',
          'The Automated Dreadnoughts encountered are the last of their kind, as they continue to dutifully patrol their assigned systems despite the death of their crew. Many attempts have been made throughout the ages to put the old warship to its final rest - none successful.'],
  };
})();
