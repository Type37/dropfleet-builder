const fs = require('fs');

const allVariants = {
  ucm: {
    'Osaka Light Cruiser': [{name:'Athens',note:'Athens counts as Osaka',image:'assets/art/athens.webp'}],
    'New Cairo Light Cruiser': [{name:'Saratoga',note:'Saratoga counts as New Cairo',image:'assets/art/saratoga.webp'}],
    'Rio Cruiser': [{name:'New Rio',note:'New Rio counts as Rio',image:'assets/art/new_rio.webp',famousShips:'Soldier of Fortune II, Trajan, Thunderchild',lore:'Due to the huge, ongoing losses of the Battle for Earth and the record military spending authorised by the High Council, it is a time of opportunity for all whose business is killing. The Titania Aerospace Corporation has been the biggest winner, spawning Titania Fleet Systems. Matching the classic Rio class cruiser in performance, the new Titania pattern New Rio requires 30% less crew and 25% less core power, while offering improved crew comforts and endurance. TFS claim their vessels offer 35% longer tours of duty than older classes.'}],
    'Berlin Cruiser': [{name:'New Berlin',note:'New Berlin counts as Berlin',image:'assets/art/new_berlin.webp',famousShips:'Borealis, Schadenfreude, Ardent II',lore:'One issue with the classic Berlin class cruiser has always been the constant refits. Titania Fleet Systems\' new design incorporates the laser into the superstructure, allowing heat to be channelled into the vast mass of the hull. Effectively using the entire ship as a heat-sync allows 150% longer intervals between refits.'}],
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
    'Senator': [{name:'Vicarius',note:'Vicarius counts as Senator',image:'assets/art/vicarius.webp',famousShips:'Vicarius (Independent), Warcrimes, Grim Enforcer, Exterminator (Kalium)',lore:'While the Senator class battlecruiser was an abhorrent and unsanctioned creation of certain paranoid admirals, EAAS Vicarius was downright infamous. She was once the sole example of her class and instrumental in the Cleansing of Wolfrum. In 2495, an unknown vessel of battlecruiser tonnage appeared above the capital and unleashed a spread of VX gas bombardment munitions, slaughtering the entire population.'}],
    'Nelson': [{name:'Trident',note:'Trident counts as Nelson',image:'assets/art/trident.webp'}],
    'Yi Sun-sin': [{name:'Olympus',note:'Olympus counts as Yi Sun-sin',image:'assets/art/olympus.webp'}],
    'Barbarossa': [{name:'Myrmidon',note:'Myrmidon counts as Barbarossa',image:'assets/art/myrmidon.webp'}],
    'Farragut': [{name:'Argonaut',note:'Argonaut counts as Farragut',image:'assets/art/argonaut.webp'}],
    'Drake Grand': [{name:'Amazon',note:'Amazon counts as Drake',image:'assets/art/amazon.webp'}],
    'Light Cruiser': [
      {name:'Kalium KNC-5',note:'KNC-5 counts as Light Cruiser',image:'assets/art/kalium_knc5.webp',famousShips:'Heartbleeder, Souleater, Rend II',lore:'Kalium\'s ruling Kabal prefers to replicate proven pre-war designs. Their latest vessels have a more modern, distinct appearance. A KNC-5 (Kalium Navy Cruiser, Type 5) is one of their most common new line cruisers.'},
      {name:'Kalium KNC-12',note:'KNC-12 counts as Light Cruiser',image:'assets/art/kalium_knc12.webp',famousShips:'Beton Brut, Chaimberlain Powelbon, Du Hast',lore:'The KNC-12 Fleet Carrier offers excellent cost-efficient utility. The increasing percentage of these newest vessels speaks of the extreme speed at which the Kabal can build ships.'}
    ],
    'Centurion': [{name:'Centurion (Exclusive)',note:'May also be used in UCM or PHR fleets (gains Rare)',image:'assets/art/centurion.webp',famousShips:'Pilum, Fontaine\'s Miracle, Myriad, Proudcore, Industry, Fist of Iron',lore:'The Centurion was the most common standardised vessel of cruiser tonnage in the pre-war EAA Terran Grand Fleet. It has truly excellent ceramic armour plating that outclasses all but defence monitors in the modern UCMF.'}]
  },
  bioficer: {
    'Stature': [{name:'Styx',note:'Styx counts as Stature',image:'assets/art/styx.webp',famousShips:'Styx',lore:'The sole record of the fearsome Styx class comes from the mangled tertiary flight recorder of the battleship UCMS Bellaque. She was lost with all hands in the Eden system. The Styx seems to have similar capabilities to the Stature class, but utilises an enlarged, novel hull.'}]
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
