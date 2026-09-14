// Where a rolled scenario is fought: named places from TTCombat's Commander Universe lore.
// Dropfleet is a space game, so every place is orbital: a planet's orbit, a moon, a station, an outer
// marker or a void battle. No ground-only sites (cities, swamps, tunnels).
// Every fact comes from the lore books in D:\wargaming\Dropzone\Lore Books, cited in src. The text is a
// short summary in our own words, not a copy. Add a place only with a page to cite; never invent one.
// Sources: CU = Commander Universe Lore Primer, R1 = Reconquest Primer 1, R2 = Reconquest Primer 2, Zone = Zone Primer.
const SCN_LOCATIONS = [
  // ── Solar System ──
  { id:'earth-orbit', group:'Solar System', name:'Earth Orbit', src:'R1 p27; CU p23, p33',
    text:'When the Colonies first scouted home in 2670, thousands of Scourge ships ringed Earth, two super dreadnoughts among them. The Triumvirate won the bloodiest naval battle in history here in 2672, yet the Scourge kept much of the planet\'s defence grid.' },
  { id:'the-hole', group:'Solar System', name:'The Hole, above North America', src:'CU p16, p19, p21',
    text:'In 2672 the Resistance destroyed the Scourge missile halo control nexus, tearing a gap in Earth\'s defence grid. On D-Day the Triumvirate fleets made orbit over the hole and used it as a refuge to knock out the grid\'s guns one by one.' },
  { id:'asia-grid', group:'Solar System', name:'Asia\'s Defence Grid, Earth Orbit', src:'CU p25, p31; R1 p27',
    text:'Asia\'s long history of orbital construction left it with the strongest defence grid coverage on Earth, which kept mass landings away for years. Below it lies the largest Scourge breeding hive on record, covering most of what was Japan.' },
  { id:'the-moon', group:'Solar System', name:'The Moon', src:'CU p24',
    text:'The Moon\'s defence grid control nexus, its Helium-3 mines and Tranquillity, its only city, fell to the Triumvirate in 2673, a rare quick win in the Solar system.' },
  { id:'mars', group:'Solar System', name:'Mars', src:'CU p24, p32',
    text:'The Scourge finished terraforming the old penal colony, and wild herds of their most vicious host species now overrun it. The UCMF bombarded its missile halo stations, meaning to glass the planet from orbit.' },
  { id:'foundry-prime', group:'Solar System', name:'Foundry Prime, Titan', src:'CU p24',
    text:'The largest space station built before the war orbits Titan, whose Scourge industries were bombarded to rubble in 2673. The fight to retake the station became a favourite of Colonial recruitment reels, though it mattered little to the war.' },
  { id:'europa', group:'Solar System', name:'Europa', src:'R2 p24-25; CU p15',
    text:'Jupiter\'s frozen moon holds vast reserves of sterile water, which \'pure\' Scourge need. A fast strike, Taskforce Europa, jumped in and destroyed all six extraction plants in 2671, losing 80% of its strength.' },
  { id:'ganymede', group:'Solar System', name:'Ganymede', src:'CU p24',
    text:'The system\'s largest moon became the Scourge\'s last big source of sterile water. A blockade cut it off and destroyed its sizeable fleet garrison.' },
  { id:'callisto', group:'Solar System', name:'Callisto', src:'R1 p28; CU p24',
    text:'In 2671 an unknown cruiser, likely Shaltari, saw through the stealth of the lighter Azure Night and destroyed her here. The PHR later took the moon as their base around Jupiter.' },
  { id:'saturn', group:'Solar System', name:'Saturn\'s Moons', src:'R1 p28',
    text:'Scouted in 2671, even these barely habitable moons were crawling with Scourge on the surface and in the void, with Titan mined for liquid hydrocarbons. The scout Eternal Darkness got clear and jumped out past Saturn\'s outer marker.' },

  // ── Eden System ──
  { id:'eden-orbit', group:'Eden System', name:'Eden Prime Orbit', src:'R1 p9-10',
    text:'On D-Day in 2670 the UCMF annihilated the Scourge garrison fleet within minutes. Scourge atmospheric corvettes then broke through the cruiser screen and destroyed forty-nine strike carriers before they were stopped.' },
  { id:'eden-ii', group:'Eden System', name:'Eden II', src:'R1 p25',
    text:'A small boarding action over Eden II let a UCM operative slip aboard the PHR cruiser Mind of Asimov with a miniature node. She was killed, but the node led a stealth team to the hidden Tlalocan Moons.' },
  { id:'eden-vii', group:'Eden System', name:'Eden VII', src:'R1 p13; R2 p6',
    text:'A frozen, poisonous world of titanium mines in city-sized caverns. Shaltari sorties strike above it, and a PHR surprise attack crippled the battleship General Sherman over Eden VII.' },
  { id:'eden-marker', group:'Eden System', name:'Eden Prime Jump Point', src:'R2 p6; CU p38',
    text:'Battlefleet Eden patrols against Shaltari raiders, PHR extraction runs and ambushes on supply convoys. In 2679 Bioficers wiped out a taskforce of nine capital ships near the main jump point in four hours.' },

  // ── Elysium System ──
  { id:'elysium-orbit', group:'Elysium System', name:'Elysium Prime Orbit', src:'CU p15',
    text:'In 2671 Battlefleet Elysium\'s combat bombardment held back the Scourge breaking out of Triticum, the capital below, until the largest Shaltari fleet yet to engage the UCMF broke it.' },
  { id:'elysium-iii-iv', group:'Elysium System', name:'Elysium III and IV', src:'R1 p15',
    text:'Two inhospitable rocks whose gem mines once supplied most of humanity\'s rubies, sapphires and emeralds, until the invading Scourge flattened them from orbit.' },
  { id:'elysium-marker', group:'Elysium System', name:'Elysium Outer Marker', src:'R1 p15; R2 p9; CU p19, p21',
    text:'No Scourge ships remain, but Shaltari raiders hit Battlefleet Elysium and its supply ships and never stand to fight. On the Battle for Earth\'s D-Day, Shaltari gravitic waves held the Elysium muster in place.' },

  // ── Shangri-La System ──
  { id:'shangri-la-void', group:'Shangri-La System', name:'Shangri-La Void', src:'R2 p11; CU p16',
    text:'In 2671 the largest PHR fleet yet seen broke in while Battlefleet Shangri-La was spread thin, then evaded it for weeks. High Admiral Stern finally forced battle and won, at a cost of 35 capital ships.' },
  { id:'helen-persephone', group:'Shangri-La System', name:'Helen and Persephone', src:'R1 p17-18',
    text:'Two small, low-gravity worlds of giant flora and lethal predators, where the Scourge breed new hosts. Their outer markers stayed enemy territory, and their anti-orbital batteries are so numerous that bombarding the hives was judged not worth the ships.' },

  // ── Olympus System ──
  { id:'olympus-orbit', group:'Olympus System', name:'Olympus Prime Orbit', src:'R2 p14; CU p9',
    text:'The largest graveyard of warships mankind has seen: over a thousand vessels of frigate size or larger died here. The first battle lasted nine days and cost the UCMF 124 capital ships.' },
  { id:'olympus-yards', group:'Olympus System', name:'Olympus Prime Fleet Yards', src:'R1 p19-20; R2 p16',
    text:'Humanity\'s greatest shipyards, spared by the Scourge and turned into their largest fleet base outside the Solar system. Troops land inside the vast docks by dropship to take the defence grid from within.' },
  { id:'styx', group:'Olympus System', name:'Styx', src:'R1 p20; R2 p16',
    text:'Olympus Prime\'s only moon has no atmosphere. Its defence grid control station lies half a mile under the rock, reached by air through a canyon half the length of the moon.' },
  { id:'olympus-outer', group:'Olympus System', name:'Olympus II, V and IX', src:'R1 p19; R2 p15',
    text:'Three more worlds in the system with objectives worth taking. Their Scourge garrison fleets are broken and their defence grids are nothing like Olympus Prime\'s, so the fleet bombards them with relative impunity.' },

  // ── Aaru, Asgard, Tlalocan ──
  { id:'aaru', group:'Aaru System', name:'Aaru Orbit', src:'R1 p21-22; CU p16, p39',
    text:'A lone planet under a lone sun, desert above and vast caverns below. The UCM kept its presence here to a few stealth lighters, and in 2672, with Scourge ships drawn off elsewhere, a Shaltari coalition won void supremacy over their birthplace.' },
  { id:'asgard', group:'Asgard System', name:'Asgard System', src:'R1 p23-24',
    text:'Once home to mankind\'s largest tank factories. The small UCM taskforce covering an expeditionary drop was annihilated, likely by the PHR, and only the battered lighter Leprechaun escaped before every node went dark.' },
  { id:'valhalla', group:'Asgard System', name:'Valhalla and Sessrumnir', src:'R1 p23-24',
    text:'Asgard Prime\'s two moons hold pre-war installations, probably weapons research labs, with an unusually strong Scourge presence. Recon teams landed there were stranded when the fleet was lost.' },
  { id:'tlalocan', group:'Tlalocan System', name:'Tlalocan Moons', src:'R1 p25-26; R2 p21; CU p10',
    text:'Four habitable moons around a gas giant, the one Cradle World system without working nodes. The PHR conquered it with over 200 capital ships and raised fortresses and orbitals at astonishing speed.' },

  // ── The Colonies ──
  { id:'aurum', group:'The Colonies', name:'Aurum Outer Marker', src:'CU p7, p17; Zone p11',
    text:'Above the UCM capital, an unknown PHR vessel appeared at the outer marker during the Reconquest\'s Departure Ceremony in 2670. In 2672 a Kalium flotilla translated in near Aurum to propose the invasion of Earth.' },
  { id:'niccolum', group:'The Colonies', name:'Niccolum', src:'Zone p12',
    text:'A blue gas giant whose mineral-rich rings host UCM Fleet Command, the home docks and most of the fleet\'s shipyards. Many of its people spend their whole lives in space.' },
  { id:'stannum', group:'The Colonies', name:'Stannum', src:'Zone p12',
    text:'An icy moon of Niccolum, nicknamed The Fridge, where nights fall below -200°C. It supplies fresh water to Niccolum\'s dockyards and taps an ocean of liquid oxygen 25km down.' },
  { id:'ferrum', group:'The Colonies', name:'Ferrum', src:'Zone p11; CU p14',
    text:'When a Scourge armada burned in from the outer marker in 2671, Ferrum\'s outer patrols died in high-velocity void actions and Battlefleet Ferrum sacrificed itself to slow the onslaught. The planet held, at the cost of a billion civilians.' },
  { id:'maganum', group:'The Colonies', name:'Maganum Asteroid Field', src:'CU p33',
    text:'Eight light hours out from Maganum, the UCM\'s breadbasket, the asteroid mining ship Dimitrov was approached by a frigate of unknown design in 2674, then boarded and lost.' },
  { id:'aluminia', group:'The Colonies', name:'Aluminia', src:'Zone p12; CU p15',
    text:'An ocean world that feeds the UCM 60% of its protein. Its naval picket fell in hopeless defiance in 2671, and the relief fleet battered the retreating Scourge only after the seas were poisoned.' },
  { id:'wolfrum', group:'The Colonies', name:'Wolfrum', src:'Zone p12; CU p15',
    text:'A volcanic penal colony. When the Scourge struck in 2672, the relief fleet was cleared to destroy enemy ships freely, since wrecks falling on this world were an acceptable loss.' },
  { id:'kalium', group:'The Colonies', name:'Kalium', src:'CU p6, p17-18',
    text:'The colony that refused to join the UCM and hid itself for 165 years. Its fleet of pre-war classes, aligned in parade-ground ranks, returned in 2672 with 180 capital ships.' },

  // ── Elsewhere ──
  { id:'vega', group:'Elsewhere', name:'Vega IV', src:'CU p4, p22-23',
    text:'Above Vega IV in 2507 the Abandonist armada shot first at Battlefleet Earth, crippling humanity\'s premier battlefleet as most of them jumped away. Their descendants became the PHR, and the hulks left behind became the Vega Scrapfleet.' },
  { id:'caeruleum', group:'Elsewhere', name:'Caeruleum Prime', src:'CU p40',
    text:'A Post Human Republic world of glossy towers. In 2679 a substantial Scourge fleet arrived at its outer marker.' },
];
