const fs = require('fs');

const allVariants = {
  ucm: {
    'Osaka Light Cruiser': [{name:'Athens',note:'Athens counts as Osaka',image:'assets/art/athens.webp'}],
    'New Cairo Light Cruiser': [{name:'Saratoga',note:'Saratoga counts as New Cairo',image:'assets/art/saratoga.webp'}],
    'Rio Cruiser': [{name:'New Rio',note:'New Rio counts as Rio',image:'assets/art/new_rio.webp',
      famousShips:'Soldier of Fortune II, Trajan, Thunderchild',
      lore:'Due to the huge, ongoing losses of the Battle for Earth and the record military spending authorised by the High Council, it is a time of opportunity for all whose business is killing. The Titania Aerospace Corporation has been the biggest winner, to the point where they have spawned a new subsidiary: Titania Fleet Systems. While the company’s home colony is justly famous for its cavernous, subterranean armour works, its orbital yards are tiny compared to Niccolum’s. TFS is aiming to change that, starting with an entirely re-designed line of cruisers.\n\nMatching the classic Rio class cruiser in performance, the new Titania pattern New Rio (named after New Rio on Titania) requires 30% less crew and 25% less core power, while offering improved crew comforts and endurance. As a result, TFS claim that their vessels offer 35% longer tours of duty than older classes. Only into its first year of production, the Admiralty has been slow to adopt these superior ships due to lack of spares and minimal standardisation with older classes – TFS’s only concession to backwards-compatibility was the turrets. As the war grinds on and losses mount, TFS may see more desperate orders and eventually win over top-brass conservatives through combat.'}],
    'Berlin Cruiser': [{name:'New Berlin',note:'New Berlin counts as Berlin',image:'assets/art/new_berlin.webp',
      famousShips:'Borealis, Schadenfreude, Ardent II',
      lore:'One issue with the classic Berlin class cruiser has always been the constant refits. The interchangeable, modular nature of traditional colonial shipbuilding left the classes’ primary laser weapon exposed, protruding from the hull. This makes heat dissipation challenging, leading to extreme local operating temperatures and frequent failures. Titania Fleet System’s new design (named after the city of New Berlin) incorporates the laser into the superstructure, allowing heat to be channelled into the vast mass of the hull for eventual radiation into space. Effectively using the entire ship as a heat-sync allows 150% longer intervals between refits.\n\nIn combat performance, the Titania New Berlin matches the older pattern while requiring less crew, less energy and less maintenance. Despite this, TFS’s yards are small, incomplete and incomparable to the vast conurbations orbiting the gas giant Niccolum. Also, the corporation has to compete with over a century’s entrenched shipbuilding ethos, and Titania Berlin will likely remain a rare but welcome sight on the frontlines for some time…'}],
    'Johannesburg': [{name:'Atlantis',note:'Atlantis counts as Johannesburg',image:'assets/art/atlantis.webp'}],
    'Perth': [{name:'Avalon',note:'Avalon counts as Perth',image:'assets/art/avalon.webp'}]
  },
  scourge: {
    'Akuma': [{name:'Basilisk',note:'Basilisk counts as Akuma',image:'assets/art/basilisk.webp'}],
    'Banshee': [{name:'Manticore',note:'Manticore counts as Banshee',image:'assets/art/manticore.webp'}]
  },
  phr: {
    'Agamemnon': [{name:'Leonidas',note:'Leonidas counts as Agamemnon',image:'assets/art/leonidas.webp'}],
    'Priam': [{name:'Scipio',note:'Scipio counts as Priam',image:'assets/art/scipio.webp'}],
    'Bellerophon': [{name:'Prototype Bellerophon',note:'Resin model, counts as Bellerophon',image:'assets/art/prototype_bellerophon.webp'}],
    'Orpheus': [{name:'Prototype Orpheus',note:'Resin model, counts as Orpheus',image:'assets/art/prototype_orpheus.webp'}]
  },
  shaltari: {
    'Ruby': [{name:'Adamant',note:'Adamant counts as Ruby',image:'assets/art/adamant.webp'}],
    'Sapphire Battlecruiser': [{name:'Palladium',note:'Palladium counts as Sapphire',image:'assets/art/palladium.webp'}],
    'Basalt': [{name:'Aaru Basalt',note:'Aaru Basalt counts as Basalt',image:'assets/art/aaru_basalt.webp'}],
    'Emerald': [{name:'Aaru Emerald',note:'Aaru Emerald counts as Emerald',image:'assets/art/aaru_emerald.webp'}]
  },
  resistance: {
    'Senator': [{name:'Vicarius',note:'Vicarius counts as Senator',image:'assets/art/vicarius.webp',
      famousShips:'Vicarius (Independent), Warcrimes, Grim Enforcer, Exterminator (Kalium)',
      lore:'While the Senator class battlecruiser was an abhorrent and unsanctioned creation of certain paranoid admirals, EAAS Vicarius was downright infamous. She was once the sole example of her class and, it is now understood, instrumental in the Cleansing of Wolfrum. In 2495, twelve years before the Scourge invasion, the mining colony of Wolfrum rebelled, violently. Soon, an unknown vessel of battlecruiser tonnage appeared above the capital and unleashed a spread of VX gas bombardment munitions, slaughtering the entire population.\n\nNo comment was made by the military and the government vehemently denied involvement. Senior individuals were executed in the following years, and often for crimes that should have warranted prison sentences. EAAS Vicarius next appeared as a loner in 2674, her decks cold with a sparse skeleton crew. Her senior officers had apparently boarded another human vessel and had not returned. Now, in 2679, new examples of her class have been spotted among Kalium’s sinister vanguard fleets.'}],
    'Nelson': [{name:'Trident',note:'Trident counts as Nelson',image:'assets/art/trident.webp'}],
    'Yi Sun-sin': [{name:'Olympus',note:'Olympus counts as Yi Sun-sin',image:'assets/art/olympus.webp'}],
    'Barbarossa': [{name:'Myrmidon',note:'Myrmidon counts as Barbarossa',image:'assets/art/myrmidon.webp'}],
    'Farragut': [{name:'Argonaut',note:'Argonaut counts as Farragut',image:'assets/art/argonaut.webp'}],
    'Drake Grand': [{name:'Amazon',note:'Amazon counts as Drake',image:'assets/art/amazon.webp'}],
    'Light Cruiser': [
      {name:'Kalium KNC-5',note:'KNC-5 counts as Light Cruiser (with NC-16 Missile Bank + 2 Vent Cannon Turrets)',image:'assets/art/kalium_knc5.webp',
        famousShips:'Heartbleeder, Souleater, Rend II',
        lore:'Generally, Kalium’s ruling Kabal prefers to replicate proven pre-war designs than to innovate, with a focus on numbers. However, after Kalium’s first major blooding in the opening stages of the Battle for Earth, deficiencies became apparent. Visitors to UCM vessels brought back memories (and hushed whispers) that their ships might not be as advanced as their Kabal proclaimed. While combat performance was solid, helped by the iron discipline of their career-sailors, the lack of modern “dressings” in crew areas verged on embarrassing. Clunky 2D viewscreens, general lack of lighting and spartan comforts were more visible than inefficient drives and un-optimised construction.\n\nKalium’s latest vessels, while essentially the same underneath, have a more modern, distinct appearance as well as countless internal refinements. Kalium still does not favour colourful class names, though. A “KNC-5” (Kalium Navy Cruiser, Type 5) is one of their most common, new line cruisers, armed with a pair of vent cannon turrets and a potent close action missile array.'},
      {name:'Kalium KNC-12',note:'KNC-12 counts as Light Cruiser (with Vent Cannon Turret + 2 Fighters & Bombers)',image:'assets/art/kalium_knc12.webp',
        famousShips:'Beton Brut, Chaimberlain Powelbon, Du Hast',
        lore:'Kalium’s newest vessels’ unique aesthetic suggests a deliberate attempt by the Kabal to “brand” their forces, or at least to make them distinct from the old, tired ships of Resistance fleets. Certainly, the brutalist design speaks of utility, strength and a total disdain for beauty – not that the UCM cares much for those either, but at least they don’t seem to revel in them. The KNC-12 Fleet Carrier is one of the more common, offering excellent, cost-efficient utility to any admiral by way of a potent (if unsafe) vent cannon turret and a double set of launch bays. Unlike the Shaltari, Kalium has no shortage of pilots.\n\nThe increasing percentage of these newest vessels in recent engagements speaks of the extreme speed at which the Kabal can build ships – helped, no doubt, by the multitudes under the whip of penal servitude. Their manufacturing capacity is also fearsome, as scattered reports of the class operating under the flag of several Resistance fleets now exist, suggesting that Kalium’s resupply arrangements, as the only manufacturer of old military hardware, have expanded greatly in recent months.'}
    ],
    'Centurion': [{name:'Centurion (Exclusive)',note:'May also be used in UCM or PHR fleets (gains Rare)',image:'assets/art/centurion.webp',
      famousShips:'Pilum, Fontaine’s Miracle, Myriad (Independents), Proudcore, Industry, Fist of Iron (Kalium)',
      lore:'The Centurion was the most common standardised vessel of cruiser tonnage in the pre-war EAA Terran Grand Fleet. In those days the definition of Cruiser was somewhat broader; today, such a bulky vessel is designated as a Grand Cruiser, a classification not really in use with the UCMF. In bulk (though not in firepower), it is more akin to a modern Heavy Cruiser. It has truly excellent ceramic armour plating that outclasses all but defence monitors in the modern UCMF. The Centurion also features many of the typical advantages and disadvantages of vintage naval architecture. Originally manufactured by Trident Industrial over Olympus Prime, the design was soon licensed to Earth-based Equatorial Yards Inc. Only the licensed Earth pattern is still built today, by Kalium, though it also operates legacy Olympus Centurions.\n\nIts simple but effective all-gun primary armament provides an excellent blend of destructive power and reliability. The class requires low weapon maintenance – a welcome factor that certainly isn’t the case with some of the more esoteric and experimental armaments in mankind’s pre-war arsenal.\n\nIts primary armament is broadsides of transition mass drivers, alongside an oversized twin pure mass driver turret, more in keeping with modern UCMF gunnery, albeit with much heavier projectiles.'}]
  },
  bioficer: {
    'Stature': [{name:'Styx',note:'Styx counts as Stature',image:'assets/art/styx.webp',
      famousShips:'Styx',
      lore:'Although all Bioficer sightings are rare, if increasing, certain ship classes have only been observed once. The sole record of the fearsome Styx class comes from the mangled tertiary flight recorder of the battleship UCMS Bellaque. She was lost with all hands in the Eden system, and only an atomic cloud and cored-out hull fragments remained – the work of the fearsome Decon Annihilator, the Styx’s colossal primary weapon.\n\nThe Styx seems to have similar capabilities to the Stature class, but utilises an enlarged, novel hull more closely related to Bioficer cruisers. Some believe this vessel was unique, casting further doubt on the old notion that the Bioficers lack individuality. This ship may have been commissioned by a characteristic intelligence. Behaviour suggests individual pleasures, whims, and particular cruelties – a worrying confirmation of this race’s apparent personal delight in violence and other’s suffering.'}]
  }
};

let totalUpdated = 0;
Object.entries(allVariants).forEach(([faction, shipMap]) => {
  const path = 'data/faction-' + faction + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));

  Object.entries(shipMap).forEach(([nameMatch, variantList]) => {
    const group = (data.groups || []).find(g => g.ship.name.includes(nameMatch));
    if (group) {
      group.ship.variants = variantList;
      totalUpdated++;
      console.log(faction + ': ' + group.ship.name + ' -> ' + variantList.map(v => v.name).join(', '));
    } else {
      console.log('MISS: ' + faction + '/' + nameMatch);
    }
  });

  fs.writeFileSync(path, JSON.stringify(data));
});

console.log('\nTotal ships updated: ' + totalUpdated);
