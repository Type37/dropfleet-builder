/* Older-edition Dropfleet scenarios, verbatim from TTCombat's "Scenarios (Unsupported)" downloads:
   Automated_Dreadnought.pdf, Princess_Liner_Scenarios.pdf, Advent_Scenarios.pdf,
   Dropfleet_Core_Scenarios.pdf and Dropfleet_TOURNAMENT_PACK_2017.pdf.
   Like Dragonslayer (scenario-lib.js), each keeps its page's own headings and typos in `sections`,
   so none of the current rulebook's explanations are attached. Maps and art:
   scripts/extract-legacy-scenario-maps.py. Loaded after scenario-lib.js on the references page only. */
(function(){
  const LIST=[], P={paras:true};
  // The index columns read players, deployment and scoring; take them from the page's own sections
  const add=(s,players,deployment,scoring)=>{ const pick=h=>{ const x=s.sections.find(x=>x[0]===h); return x?x[1]:undefined; };
    Object.assign(s,{players:pick(players),deployment:pick(deployment),scoring:pick(scoring)}); LIST.push(s); };
  const std=(s)=>add(s,'Players','Suggested Approach','Victory Conditions');

  /* ── Automated_Dreadnought.pdf, page 2 ── */
  std({id:'the-ancient-relic', name:'The Ancient Relic', src:'Automated Dreadnought', leviathan:'Automated Dreadnought',
   intro:`A mysterious Automated Dreadnought wandered into an area of conflict. All attempts to contact it have failed, and its withering firepower has left a trail of destruction in its wake. You have the order to capture this vessel and use it to turn the tide of battle to your favour - a prize like this does not often present itself.`,
   sections:[
     ['Players',[`2.`]],
     ['Fleet List',[`Standard.`]],
     ['Suggested Approach',[`Distant (opposing edges shown in blue).`]],
     ['Duration',[`6 turns.`]],
     ['Orbital Debris',[`Debris Fields (2-5 Fine, 4-6 Dense), avoiding the centre line of the board.`]],
     ['Victory Conditions',[`Space Stations score as Medium Clusters.`,
       `Destroying a Space Station on your opponent’s board side scores 4VP.`,
       `The player that gains control of the Automated Dreadnought scores 4VP.`]],
     ['Controlling the Dreadnought',[`The Automated Dreadnought is deployed along the centre line of the board in low orbit, touching a board edge and facing the opposite edge (shown in orange).`,
       `The Automated Dreadnought activates at the end of the roundup phase and is controlled by the player that activated second this round.`,
       `When activated the Automated Dreadnought moves its Thrust along the centre line and goes up one orbital layer (if possible) then attacks the closest target as if it was on a Weapons Free order.`,
       `When the Automated Dreadnought becomes crippled, players may board it as if it were a Medium Space Station.`,
       `At the end of each round, if a player has uncontested control of the Automated Dreadnought they gain control of it. Remove all Ground Asset tokens from it and treat it as a normal ship of that player’s fleet in a Battlegroup of its own. The Automated Dreadnought now activates after all other Battlegroups have activated.`]]]});

  /* ── Princess_Liner_Scenarios.pdf, pages 3-5 (the map key and Civilian Transport rule are page 2) ── */
  const KEY={key:'princess-liner-key.webp', keyAlt:'Key: Commercial, Industrial, Military, Orbital Defence, Power Plant and Comms Station Sectors; Cluster (of Sectors); Clusters for Clash and Battle sized games; Space Station; Space Station for Clash and Battle sized games; Moon (LSO); Dense Debris Field'};
  std({id:'princess-retrieving-intelligence', name:'Retrieving Intelligence', src:'Princess Cruise Liner', leviathan:'Princess Cruise Liner', ...KEY,
   intro:`A long abandoned Diplomatic ship has been detected in an area of particularly dense orbital debris. Despite the risks, both sides have deemed it worthwhile to go after this potential treasure trove of intelligence. Capture the ship and uncover its secrets; in the dire circumstance that enemy will do so instead, then – and only then – you are authorised to destroy the ship rather than let it fall into the wrong hands.`,
   sections:[
     ['Players',[`2`],P],
     ['Fleet List',[`Standard`],P],
     ['Suggested Approach',[`Column`],P],
     ['Duration',[`6 Turns`],P],
     ['Orbital Debris',[`Debris Fields (2-4 Fine, 4 Dense. Place the Fine fields as shown on the map. Place the Dense fields as usual).`],P],
     ['Victory Conditions',[`Space stations score as Medium Clusters. The Princess Cruise liner scores as follows:`,
       `Hold: 4VP`,
       `Hold within 12” of your board edge: additional 2VP (for a total of 6VP)`,
       `Contest: 2VP`,
       `Destroyed within 12” of the enemy board edge: 2VP`,
       `Destroyed at any other time: -2VP`],P]]});

  add({id:'princess-make-the-rendezvous', name:'Make the Rendezvous', src:'Princess Cruise Liner', leviathan:'Princess Cruise Liner', ...KEY,
   intro:`It is critically important that the VIPs and their escorts get to the listening stations in orbit around this large moon. Once they make sense of the data stored there, it can be used to cripple enemy movements and give use the tactical advantage. But we have received word that the enemy has not been idle. Get the transport to the listening stations and deliver those VIPs before the enemy can stop you!`,
   sections:[
     ['Players',[`2-3`],P],
     ['Fleet list',[`Standard. In three player games, one player is the attacker, one the Station Defender and another the Cruiser Liner Defender. The Attacker’s fleet should include 500 more points than the Defender(s).`],P],
     ['Attacker',[`Distant`],P],
     ['Defender',[`Station Defender: .`],P],
     ['Cruiser Liner Defender',[`Column`],P],
     ['Orbital Debris',[`Debris fields (2-4 Fine, 4-6 Dense).`],P],
     ['Victory Conditions',[`Space Stations Count as Large, with 1 laser armament and 1 missile armament each. They score as below:`,
       `The defenders gain 2VP each time they deploy an infantry token from the Cruise Liner into a space station. They also gain 1VP for each Space station controlled at the end of the game. The Cruise Liner may only deploy one infantry token per space station. The Defender(s) also gain 2VP at the end of the game if the Cruise Liner is not destroyed.`,
       `The Attacker gains 2VP for each Space station destroyed at the end of the game. They gain 3VP for any Space station they control at the end of the game. If the Cruise Liner is destroyed, The Attacker gains 2VP.`],P],
     ['Additional rules',[`The Defender splits their battlegroups into thirds. Two thirds count as Cruise Liner Defenders. The remaining third counts as the Station Defenders. They must direct deploy in the area shown. round up the number of battlegroups in the station defender force if the battlegroups do not easily form thirds. The Cruise liner joins the first battlegroup that the Cruise Liner Defence force deploys. It starts the game with three friendly infantry tokens on board. The Cruise Liner may not be boarded in this scenario.Each space station starts with one of the Station Defender’s infantry tokens on board each station.`],P]]},
   'Players','Attacker','Victory Conditions');

  add({id:'princess-mass-exodus', name:'Mass Exodus', src:'Princess Cruise Liner', leviathan:'Princess Cruise Liner', ...KEY,
   sections:[
     ['Players',[`2`],P],
     ['Fleet list',[`Attacker – Standard`,
       `Defender – Standard`,
       `– each Battlegroup the defender has includes one Civilian transport (Cruise Liner). Each Cruise liner starts with the following defender tokens in them: 2 Infantry and 2 Armour token from the Defender.`],P],
     ['Suggested Approach',[`Attacker – Distant. Battlegroups may deploy from either table edge.`,
       `Defender – All Battlegroups Direct Deploy in the entry area (up to 8” from the defender’s entry area).`],P],
     ['Orbital Debris',[`Debris fields (2-4 Fine, 4-6 Dense).`],P],
     ['Victory conditions',[`The Attacker scores 2 VPs for each Cruiser Liner that is destroyed. Cruise liners may be boarded; The Attacker scores 3 VPs for each Cruise Liner that they control at the end of the game, and 1 VP for each cruise liner that is contested. The Defender scores 3VPs for each Cruise Liner that is either controlled or contested that is in the exfiltration zone (8” from the board edge – see map) at the end of the game. At the end of the game, The Defender instead scores 2VPs for each controlled Cruise liner that is not in the exfiltration zone, and 1VP for each Contested Cruise liner that is not in the exfiltration zone.`],P]]},
   'Players','Suggested Approach','Victory conditions');

  /* ── Advent_Scenarios.pdf, pages 2-4 ── */
  std({id:'resistance-spearhead', name:'Resistance Spearhead', src:'Advent Scenarios',
   intro:`The forces of the Resistance have rallied against the enemy. They’ve jumped into system with barely a moment’s notice, and are on the way to make planetfall. The gung-ho approach is shocking, but their limited resources will be their downfall.`,
   sections:[
     ['Players',[`2.`,`Resistance player is Attacker.`,`Other player is Defender.`]],
     ['Fleet List',[`Standard.`]],
     ['Suggested Approach',[`Battleline (opposing edges shown in blue).`]],
     ['Duration',[`6 turns.`]],
     ['Orbital Debris',[`Debris Fields (2-5 Fine, 4-6 Dense).`]],
     ['Victory Conditions',[`Attacker: each Medium Cluster scored as Standard Scoring.`,
       `Defender: can only contest Clusters, even when holding them, counting all as Medium. Scores 1VP for every enemy group destroyed. Loses 1VP for every Sector destroyed.`]],
     ['Variant: “Turf War”',[`In this alternate scenario, both players play as Resistance, and all Clusters are swapped for Space Stations. Someone will own this little patch of space at the end of the fight!`],P]]});

  std({id:'heavy-convoy', name:'Heavy Convoy', src:'Advent Scenarios',
   intro:`There’s little that can attract an enemy fleet to an empty area of space quite like the prize of a planet’s worth of resources. The enemy are trying to move a massive convoy, spearheaded by 2 Dreadnoughts. Destroying them will cripple the fleet, and leave plenty of supplies for the victors.`,
   sections:[
     ['Players',[`2.`]],
     ['Fleet List',[`Standard.`,`Defender must take 2 Dreadnoughts, Attacker cannot take any.`,`Recommended 1300 points.`]],
     ['Suggested Approach',[`Column (opposing edges shown in blue). Both Dreadnought’s Battlegroups must deploy first turn.`]],
     ['Duration',[`6 turns.`]],
     ['Orbital Debris',[`Debris Fields (2-5 Fine, 4-6 Dense).`]],
     ['Victory Conditions',[`Each Dreadnought that touches the opposing table edge is removed from the game and scores 3VP to the Defender.`,
       `Each Dreadnought still on the board at the end of the game scores 1VP to the Defender.`,
       `Each Dreadnought destroyed scores 3VP to the Attacker.`,
       `Each other Battlegroup destroyed by either side scores 1VP.`]],
     ['Variant: “David & Goliath”',[`To have a really strange game, the Attacker cannot take any ships with a Tonnage of Heavy or Super Heavy.`],P]]});

  std({id:'monitoring-the-situation', name:'Monitoring the Situation', src:'Advent Scenarios',
   intro:`A well defended country is the best place to make planetfall. Although the opposition is proving to be strong, this critical point on the map will make an excellent beach head for the incoming assault. Break through the defences and secure the location. If the entrenched orbital batteries can be turned on the defenders, all the better for a swift victory.`,
   sections:[
     ['Players',[`2.`]],
     ['Fleet List',[`Standard.`,`Defender must take 3 groups of Monitors in a Skirmish or Clash, and 5 in a Battle.`]],
     ['Suggested Approach',[`Battleline (Attacker shown in blue, Defender shown in orange).`,`All Defending Monitors are Directly Deployed within 6” of a Cluster.`]],
     ['Duration',[`6 turns.`]],
     ['Orbital Debris',[`Debris Fields (4 Fine, 4 Dense), Planetary Ring in Low Orbit (shown in green).`]],
     ['Victory Conditions',[`Blue marked Clusters are only used in Battles.`,
       `Attacker: Standard Scoring, plus 1VP for every group of Monitors destroyed.`,
       `Defender: 1VP for every Sector not Held by the Attacker, plus 1VP for every group of Monitors that survives until the end of the game.`]],
     ['Special Rules',[`Every turn, one single group of Defending Monitors may make one additional order at the start of the Roundup Phase before resolving Ground Combat.`]],
     ['Variant: “Defensive Station”',[`In this alternate scenario, place 2 Space Stations 18” away from the Defender’s board edge. Both are armed with Laser Armaments and score in the same way as the Clusters.`],P]]});

  /* ── Dropfleet_Core_Scenarios.pdf, pages 2-9 ── */
  const core=(id,name,intro,approach,debris,victory,variant,variantText,vcOpts)=>std({id:'core-'+id, name, src:'Core Scenarios', intro,
   sections:[
     ['Players',[`2 players.`]],
     ['Fleet List',[`Standard.`]],
     ['Suggested Approach',[approach]],
     ['Duration',[`6 turns.`]],
     ['Orbital Debris',[debris]],
     ['Victory Conditions',victory,vcOpts],
     [`Variant: “${variant}”`,[variantText],P]]});
  core('take-and-hold','Take & Hold',
   `Your forces advance, ready to take the fight to the enemy on the surface and in the space above. But they are just as determined to hold the key strategic areas on this war-torn planet. Take the important landing sites and destroy their ships before they do the same to you!`,
   `Column (opposing edges shown in blue).`, `Debris Fields (2-5 Fine, 4-6 Dense).`,
   [`Clusters (Standard Scoring, Critical Locations).`],
   'Double Down', `The two clusters (and their Critical Locations) either side of the centre cluster are worth double victory points.`);
  core('mixed-engagement','Mixed Engagement',
   `Hostilities over this world are centred around militarily significant space stations and their ground based supply clusters. Capture these stations and their support clusters before the enemy can, and turn the stations’ guns on the enemy fleet.`,
   `Distant (opposing edges shown in blue).`, `Debris Fields (2-5 Fine, 4-6 Dense).`,
   [`Clusters (Standard Scoring, Critical Locations), Space Stations (Critical Locations). The Space Stations are all armed with 1 x Burnthrough armament and 1 x Close Action armament.`],
   'Valuable Supplies', `The two Critical Locations in the clusters are worth double Victory Points.`);
  core('erupting-battlefront','Erupting Battlefront',
   `What seemed like a Recon skirmish was in reality the prelude to a fleet sized engagement, with the foe making a play for key sectors on the surface. Capture and hold them quickly; your reinforcements are en-route, but so are the enemy’s...`,
   `Rapid Reaction (opposing edges shown in blue).`, `Planetary Ring.`,
   [`Player 1: Gains 1vp for each Sector in B Clusters destroyed, B Clusters are Critical Locations and A Clusters follow standard scoring.`,
    `Player 2: Gains 1vp for each Sector in A Clusters destroyed, A Clusters are also Critical Locations and B Clusters follow standard scoring.`,
    `Both Players: C Clusters and Space Stations (Standard Scoring, Critical Locations).`],
   'Punching Up', `Replace 2 of the Sectors in the central Cluster with Orbital Guns.`);
  core('station-assault','Station Assault',
   `This planet sports a highly complex and deadly set of orbital defences that are ready to be turned against the enemy. Seize them and put their fearsome weaponry to good use against the oncoming foe before they can return the favour!`,
   `Battle Line (12” along opposing board corners shown in blue).`, `Debris Fields (2-5 Fine, 4-6 Dense).`,
   [`Space Stations score as Medium Clusters, B Space Stations Score as Medium Clusters and Critical Locations.`],
   'Armed Space Stations!', `All A Space Stations are armed with 1 Mass Driver armament and 1 Close Action armament. All B Space Stations are armed with 1 Burnthrough armament and 1 Close Action armament.`);
  core('moonshot','Moonshot',
   `Operations in strategically useful cities on the ground have be hampered by the presence of a large solid object in orbit, allowing light enemy fleets to engage in hit and run attacks and use piratical tactics. Such a physical impediment to orbital combat must not be used by the enemy to delay conquest of the surface. Hold the space stations and ground support clusters close to it to deny the adversary this advantage.`,
   `Battle Line (12” along opposing board corners shown in blue).`, `Debris Fields (0-2 Fine, 2-4 Dense), LSO (12” Diameter).`,
   [`Clusters (Standard Scoring, Critical Locations), Space Stations (Score as Medium Clusters and Critical Locations). In addition, players are awarded Victory Points for the following Kill Points.`],
   'Extra Large Solid Object', `Make the LSO 18” in diameter.`,
   {table:{head:['Kill Points','Victory Points'], rows:[['600+','2'],['760+','3'],['1000+','5']]}});
  core('grid-control','Grid Control',
   `Central to command’s plan for the region and holding onto this planet is a complex grid of defence weapons, manufacturing areas and military complexes. Approach these important clusters and either control them or pound them to dust to deny them to the enemy.`,
   `Column (opposing edges shown in blue).`, `Debris Fields (2-5 Fine, 4-6 Dense).`,
   [`Clusters (Standard Scoring, Critical Locations), Clash and Battle Clusters (Score double as Clusters and Critical Locations).`],
   'Orbital Installation', `Replace Central Cluster with a Large Space Station with 4 Burnthrough Armaments. Additionally, replace Clash and Battle Clusters with Medium Space Stations with 2 Mass Driver armaments.`);
  core('power-grab','Power Grab',
   `This region’s main weakness is intermittent and shifting power supply, often generated by unstable power sources. Holding these generators could deliver the whole region, but denying them to the opposing forces is the long term aim, one way or another.`,
   `Column (12” along opposing board corners shown in blue).`, `Debris Fields (2-8 Fine, 6-10 Dense).`,
   [`Clusters (Standard Scoring, Critical Locations). Clusters Containing Power Plants are worth double Victory Points but nothing if the Power Plant is Destroyed.`],
   'Bifuricate', `Remove the Debris Fields and place a Planetary Ring Vertically through the centre of the table.`);
  core('defence-relay','Defence Relay',
   `The heavily defended Defence Relay in the area grants a huge advantage to opposing fleets, not least because of the highly advanced comms sectors interlinked with its systems. Capture them and the associated space stations to gain the upper hand in this region of space over the planet.`,
   `Column (opposing edges shown in blue).`, `Debris Fields (2-5 Fine, 4-6 Dense).`,
   [`Clusters (Standard Scoring, Critical Locations), Space Stations (Score as Medium Clusters, Critical Locations). You lose 4 Victory Points for destroying a Comms Station Sector, however if you control a Comms Station Sector on turn 6 then you gain an additional 5 Victory Points for each one you control. The Space Stations are each armed with 1 Burnthough armament, 1 Mass Driver armament and 1 Close Action Armament.`],
   'Surface to Space', `Replace the Space Stations with Medium Clusters, each containing 1 Orbital Defence Sector and 2 Military Sectors.`);

  /* ── Dropfleet_TOURNAMENT_PACK_2017.pdf. The five scenarios (pages 13-17) are printed as pictures, transcribed by eye ── */
  const tp=(id,name,intro,approach,debris,victory,variant,vcOpts)=>std({id:'tp-'+id, name, src:'Tournament Pack 2017', intro,
   sections:[
     ['Players',[`2`],P],
     ['Fleet List',[`Standard`],P],
     ['Suggested Approach',[approach],P],
     ['Duration',[`6 Turns`],P],
     ['Orbital Debris',[debris],P],
     ['Victory Conditions',[victory],{...P,...vcOpts}],
     ['Variant',[variant],P]]});
  tp('take-and-hold','Take and Hold',
   `Your forces advance, ready to take the fight to the enemy on the surface and in the space above. But they are just as determined to hold the key strategic areas on this war-torn planet. Take the important landing sites and destroy their ships before they do the same to you!`,
   `Column`, `Debris Fields (2-5 Fine, 4-6 Dense)`,
   `Clusters (Standard Scoring, Critical Locations).`,
   `The two clusters (and their Critical Locations) either side of the centre cluster are worth double victory points.`);
  tp('station-assault','Station Assault',
   `This planet sports a highly complex and deadly set of orbital defences that are ready to be turned against the enemy. Seize them and put their fearsome weaponry to good use against the oncoming foe before they can return the favour!`,
   `Battle Line`, `Debris Fields (2-5 Fine, 4-6 Dense)`,
   `Space Stations score as Medium Clusters, B Space Stations Score as Medium Clusters and Critical Locations`,
   `Armed Space Stations! All A Space Stations are armed with 1 Mass Driver armament and 1 Close Action armament. All B Space Stations are armed with 1 Burnthrough armament and 1 Close Action armament.`);
  tp('mixed-engagement','Mixed Engagement',
   `Hostilities over this world are centred around militarily significant space stations and their ground based supply clusters. Capture these stations and their support clusters before the enemy can, and turn the stations’ guns on the enemy fleet.`,
   `Distant`, `Debris Fields (2-5 Fine, 4-6 Dense)`,
   `Clusters (Standard Scoring, Critical Locations), Space Stations (Critical Locations). The Space Stations are all armed with 1 x Burnthrough armament and 1 x Close Action armament.`,
   `The two Critical Locations in the clusters are worth double Victory Points`);
  tp('moonshot','Moonshot',
   `Operations in strategically useful cities on the ground have be hampered by the presence of a large solid object in orbit, allowing light enemy fleets to engage in hit and run attacks and use piratical tactics. Such a physical impediment to orbital combat must not be used by the enemy to delay conquest of the surface. Hold the space stations and ground support clusters close to it to deny the adversary this advantage.`,
   `Battle Line`, `Debris Fields (0-2 Fine, 2-4 Dense), LSO (12” Diameter)`,
   `Clusters (Standard Scoring, Critical Locations), Space Stations (Score as Medium Clusters and Critical Locations). In addition, players are awarded Victory Points for the following Kill Points`,
   `Make the LSO 18” in diameter`,
   {table:{head:['Kill Points','Victory Points'], rows:[['500+','2'],['750+','3'],['1000+','5']]}});
  tp('grid-control','Grid Control',
   `Central to command’s plan for the region and holding onto this planet is a complex grid of defence weapons, manufacturing areas and military complexes. Approach these important clusters and either control them or pound them to dust to deny them to the enemy.`,
   `Column`, `Debris Fields (2-5 Fine, 4-6 Dense)`,
   `Clusters (Standard Scoring, Critical Locations), Clash and Battle Clusters (Score double as Clusters and Critical Locations)`,
   `Replace Central Cluster with a Large Space Station with 4 Burnthrough Armaments. Additionally, replace Clash and Battle Clusters with Medium Space Stations with 2 Mass Driver armaments.`);

  // Pages 4-6: the pack's rules for scenario setup and scoring (venues, prizes and logistics left out)
  LIST.push({id:'tournament-scoring', name:'Tournament Setup and Scoring', src:'Tournament Pack 2017',
   sections:[
     ['Space Stations',[`Several missions suggested in this tournament pack require Space Stations. While it is a good idea to use the official models, in larger tournaments this can be hard to achieve logistically. For this reason there are printable cut-outs of Space Stations available on the Hawk Wargames website.`,
       `It is recommended that all Space Stations in tournament games are the Large type (as detailed on page 54 of the core rulebook) and are unarmed unless the scenario states otherwise. However, if a TO wants to put an interesting spin on any mission involving Space Stations then arming them is a good and simple option.`],P],
     ['Debris Fields',[`Rules: Hawk Wargames recommends keeping to the standard rules for size and deployment for Debris Fields in tournament games. Ensure that both players are happy that the distribution of Debris Fields is fair and balanced before the game begins.`],P],
     ['Clusters and Sectors',[`Rules: Hawk Wargames recommends keeping to the standard rules for size and deployment for Clusters and Sectors in tournament games with one exception. When scoring Sectors, it is suggested that TOs set the Value for all Sectors as 1 rather than the Value shown in the rulebook (see page 74). This greatly simplifies scoring and speeds up games considerably in a tournament setting.`],P],
     ['Scenario and Scoring',[`Two Day Tournaments use Scenarios from the Dropfleet Commander Rulebook. While TOs can choose any of these scenarios, or create their own, Hawk Wargames suggest the following five:`],
       {...P, list:['Take and Hold','Station Assault','Mixed Engagement','Moonshot','Grid Control']}],
     ['Setup and Approach Type',[`With each scenario, it is important that the TO creates a fair and balanced board for the players, positioning debris fields in an even-handed way. It is also suggested that the TO decides on an Approach type for each game and have all players use this rather than deciding when playing – using the ‘Suggested Approach’ for each scenario is the best way forward.`],P],
     ['Game Length',[`For a 1250pt game, we would recommend a maximum allowed game length of 3 hours. This is sufficient for most players familiar with the rules to complete a full 6 turn game. Bear in mind, if playing 3 games you will need a venue with evening access. For a 2 day tournament, we would recommend 2/3 games on day 1 and 2 games on day 2.`],P],
     ['Scoring',[`For a scoring system, Tournaments are best organised on a 20-0 system, whereby player’s victory points in games are converted to a score out of a combined total of 20 for the game. This creates a balanced system for scoring the players overall.`,
       `When the games are over, players on each table should total their victory points and work out the difference between them. The difference between the two totals is then compared to the chart below, and those are the victory points each player receives.`],
       {...P, table:{head:['Victory Point Difference','Tournament points scored (Winner/loser)'],
         rows:[['0-2','10-10'],['3-5','11-9'],['6-8','12-8'],['9-11','13-7'],['12-14','14-6'],['15-17','15-5'],['18-21','16-4'],['22-24','17-3'],['25-27','18-2'],['28-30','19-1'],['31+','20-0']]},
        after:[`For example, two players finish their game. Player One has scored 18 Victory points, and Player Two has scored 29 Victory points. This is a difference of 11 Victory points, meaning Player One will gain 7 Tournament points, and Player Two will gain 13 Tournament points.`,
          `NB: When determining player rankings, if players tie on tournament points, use victory points as a tie breaker.`]}],
     ['Optional Scoring and System Changes',[`The following modifiers to the Standard Scoring as described in the core rulebook are recommended for tournament use (at the TO’s discretion). Hawk Wargames will be using these modifiers in all official tournaments this year:`,
       `1) Kill Points contribution to Victory Points.`,
       `At the end of each game, count up the total number of KP inflicted on your opponent. Add the following VP to your total if appropriate (both players do this):`],
       {...P, table:{head:['Kill Points','Victory Points'], rows:[['0-299 KP','+0VP'],['300-599 KP','+2VP'],['600-899 KP','+5VP'],['900+ KP','+8VP']]},
        after:[`Some scenarios such as Moonshot have a KP chart already listed in its entry. Where this is the case, it is down to the TO’s Discretion as to which chart is used for these missions.`,
          `2) Destroyed Sectors VP modifier: Clusters drop by one scoring level (i.e. Large down to Medium - see pg 74) for each destroyed Sector in that Cluster down to a minimum of Small.`,
          `3) Sectors Value: All Sectors in all scenarios in this tournament will have a Value of 1. This greatly simplifies scoring and speeds up games considerably in a tournament setting.`,
          `4) Very small ships and scoring: Ships of 3 Hull Points or less do not contribute their Tonnage when scoring for Critical Locations.`]}]]});

  SCENARIOS.push(...LIST);
  LIST.forEach(s=>{ if(s.id!=='tournament-scoring') SCENARIO_MAPS.add(s.id); });

  /* Ship pages, in their own columns (A and PD, not the current saves) */
  // Automated_Dreadnought.pdf, page 1
  SCN_LEVIATHANS['Automated Dreadnought']={
    title:'Automated Dreadnought', kind:'Leviathan', art:'automated_dreadnought.webp',
    stats:{head:['Name','Scan','Sig','Thrust','Hull','A','PD','G','T','Special'],
           rows:[['Automated Dreadnought','12"','10"/20"','8"','15','3+/4+','8','1','H','Regenerate (2), Reinforced Armour']]},
    weapons:{head:['Type','Lock','Attack','Damage','Arc','Special'],
             rows:[['Small Plasma Cannons','3+','3','2','F/S(L)','Scald'],
                   ['Small Plasma Cannons','3+','3','2','F/S(R)','Scald'],
                   ['Large Plasma Cannons','2+','3','3','F/S','Scald'],
                   ['Disruptor','2+','6','1','F','Particle'],
                   ['Guardian Point Defence','4+','3','1','F/S/R','Close Action']]},
    rules:[],
    famousLabel:'Recognised Automated Dreadnoughts:', famous:'Stalwart, Gloria, Topmaniac',
    lore:['A sad story. Its masters have been dead for millions of yars, but this massive warship continues to stand vigil over the broken rubble of their empire. Smaller than modern Dreadnoughts, it is still a formidable foe.',
          'It was one of several flagships belonging to an unusually powerful interstellar empire that flourished in a small region of our galaxy some seven million years ago. As is so often the case, that empire was brought to a sudden and violent end at the hands of its neighbours in a series of very destructive wars.',
          'The Automated Dreadnoughts encountered are the last of their kind, as they continue to dutifully patrol their assigned systems despite the death of their crew. Many attempts have been made throughout the ages to put the old warship to its final rest - none successful.'],
  };
  // Princess_Liner_Scenarios.pdf, pages 1-2
  SCN_LEVIATHANS['Princess Cruise Liner']={
    title:'Princess Cruise Liner', kind:'', art:'princess_cruise_liner.webp',
    stats:{head:['Name','Scan','Sig','Thrust','Hull','A','PD','G','T','Special'],
           rows:[['Princess Cruise Liner','4"','3"','10"','12','4+','2','1 - 4','M','Atmospheric, Full cloak, Civilian Transport*']]},
    weapons:{head:['Type','Lock','Attack','Damage','Arc','Special'],
             rows:[['Asteroid Clearance lasers','4+','2','1','F/S/R','Close action']]},
    rules:[['Special: Civilian Transport',[
      'Transports may never receive special orders, and unless otherwise stated in a scenario they always start in low orbit, and never suffer from orbital decay.',
      'The transport may not be fired upon unless it is controlled by a player. Players may not fire upon a friendly transport. Civilian transports may not use the ramming rule.',
      'Civilian Transports may be boarded in the same way that space stations may be boarded. If you begin the turn with either Armour or Infantry in a civilian transport and no enemy units in the transport, you control the transport, and may more and fire with it as if it were a part of your fleet (command cards may not be played on the transport, or on units inside it).',
      'It becomes a part of first friendly battlegroup that activates this turn, and stays as a part of that battlegroup as long as it is under your control. If you lose and then regain control of the transport, it becomes a part of first friendly battlegroup that activates the turn after it is re-captured.',
      'If there are enemy forces and friendly forces on the transport, it is not controlled by either side, and may not be moved or fire its weapons.',
      'Due to their lack of military design and relatively low speed, Civilian Transports may be boarded during the launch assets phase, even if controlled by an enemy player, in the same way as a space station or sector.']]],
    lore:['The Princess Class cruise liner was once a common site in the space around the Cradle World and close to the more picturesque spatial anomalies available to humanity at the time. They were the hallmark of class and distinction among many at the time, and while most were used by the pleasure seeking masses, some were personal transports for those able to afford such luxury and even as covers for covert diplomatic and espionage missions.',
          'As with so many things, this ended quickly with the Scourge invasion. Ill-equipped to face up to even the lowliest Scourge frigate, Princess Class liners breaking orbit made for tempting and easy targets for the aliens. Most of those seconded to the evacuation effort were easy prey for the Scourge; packed to the seams with refugees, they were a cornucopia of pre-packaged hosts for the insidious race.',
          'Those few liners that did escape only managed to do so due to their relatively low power output and small signature for a ship of their size – lacking high powered weapons, shields or point defences, they create very little return ping on most sensors.',
          'Today there is little call for sight-seeing pleasure cruises while the fate of the galaxy hangs in the balance. The vast majority of Princess Class cruise liners still in service are have been retro-fitted for VIP transportation, as mobile prison hulks, or interplanetary logistics vehicles.',
          'There are many more still hanging in the void – deserted, dormant, or endlessly orbiting the cradle worlds; the breath taking views they offer seen by none but the dead.'],
  };
})();
