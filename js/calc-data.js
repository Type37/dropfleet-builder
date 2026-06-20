/* ============================================================================
   DFC Combat Calculator data + rules layer (window.DFCData)
   ----------------------------------------------------------------------------
   Faithful vanilla-JS port of Jafdy's Data_Module (preset tables + the exact
   create_target / create_weapon rules, including the Shields collapse) and
   SaveString_Module (the base-62 config-code codec). Lets the calculator use
   Jafdy's own presets and share codes 1:1.

   Depends on window.DFCCalc (js/calc-engine.js) for Target / Weapon.
   Preset tables are generated from tools/dfc2-source/modules/Data_Module.py.
   ========================================================================== */
(function (global) {
  'use strict';
  const E = global.DFCCalc;
  const TABLES = {"target_coded": {"UCM Corvette": "nJR", "UCM Lighter": "hJR", "UCM Frigate": "wJ", "UCM Strike Carrier": "wJR", "UCM Heavy Frigate": "2J", "UCM Heavy Destroyer": "2J", "UCM Heavy Destroyer (Leaden Triad)": "2AJ", "UCM Monitor": "2AJ", "UCM Cutter": "pJ", "UCM Destroyer": "vJ", "UCM Light Cruiser": "w", "UCM Medium Cruiser": "w", "UCM Heavy Cruiser": "wA", "UCM Supercruiser": "wA", "UCM Battlecruiser": "wAK", "UCM Pocket Battleship": "wBK", "UCM Battleship": "wBK", "UCM Dreadnought": "3BLS", "Scourge Corvette": "hJR", "Scourge Boarding Ship": "hJ", "Scourge Frigate": "oJR", "Scourge Monitor": "2J", "Scourge Cutter": "nJ", "Scourge Destroyer": "uJ", "Scourge Heavy Destroyer (Little Chaos)": "uAJ", "Scourge Light Cruiser": "v", "Scourge Medium Cruiser": "v", "Scourge Heavy Cruiser": "w", "Scourge Battlecruiser": "vAK", "Scourge Battleship": "2BK", "Scourge Dreadnought": "4BL", "PHR Corvette": "tJR", "PHR Lighter": "nJR", "PHR Frigate": "2J", "PHR Strike Carrier": "2JR", "PHR Monitor": "8J", "PHR Cutter": "uJ", "PHR Destroyer": "1J", "PHR Blockade Runner": "uJ", "PHR Light Cruiser": "2", "PHR Medium Cruiser": "2", "PHR Heavy Cruiser": "2A", "PHR Supercruiser": "2A", "PHR Battlecruiser": "2AK", "PHR Pocket Battleship": "2BK", "PHR Battleship": "3BK", "PHR Dreadnought": "9BLS", "Shaltari Voidgate": "oGJR", "Shaltari Corvette": "oGJR", "Shaltari Voidflyer": "hGJR", "Shaltari Frigate": "pGJ", "Shaltari Monitor": "vHJ", "Shaltari Heavy Voidgate": "vHJR", "Shaltari Cutter": "jGJ", "Shaltari Destroyer": "pGJ", "Shaltari Light Cruiser": "pG", "Shaltari Medium Cruiser": "pG", "Shaltari Heavy Cruiser": "pH", "Shaltari Thresher": "1AG", "Shaltari Supercruiser": "pAH", "Shaltari Battlecruiser": "pAHK", "Shaltari Pocket Battleship": "pBHK", "Shaltari Battleship": "wBHK", "Shaltari Dreadnought": "wBIL", "Resistance Corvette": "nJR", "Resistance Detonator": "tJR", "Resistance Strike Carrier": "oJR", "Resistance Frigate": "oJ", "Resistance Heavy Frigate": "uJS", "Resistance Cutter": "tJ", "Resistance Monitor": "tJ", "Resistance Pocket Carrier": "uJ", "Resistance Destroyer": "vAJ", "Resistance Colony Ship": "tAJ", "Resistance Support Carrier": "uAJ", "Resistance Fire Ship (Parliament)": "0AJ", "Resistance Light Cruiser": "o", "Resistance Light Cruiser with Ablative Armour": "vS", "Resistance Medium Cruiser": "uA", "Resistance Heavy Cruiser": "uA", "Resistance Medium Cruiser with Ablative Armour": "2AS", "Resistance Heavy Cruiser with Ablative Armour": "2AS", "Resistance Grand Cruiser": "1BK", "Resistance Battlecruiser": "2BK", "Resistance Old Battleship": "1BK", "Resistance Grand Battleship": "2BK", "Resistance Dreadnought": "vBL", "Bioficer Cell": "vAJ", "Bioficer Corvette": "oJR", "Bioficer Lighter": "oJ", "Bioficer Frigate": "oJ", "Bioficer Monitor": "vBJ", "Bioficer Cutter": "oAJ", "Bioficer Destroyer": "vBJ", "Bioficer Heavy Destroyer (The Melter)": "vBJ", "Bioficer Light Cruiser": "v", "Bioficer Medium Cruiser": "v", "Bioficer Heavy Cruiser": "vB", "Bioficer Supercruiser": "vB", "Bioficer Battlecruiser": "vBK", "Bioficer Pocket Battleship": "vBK", "Bioficer Battleship": "3BK", "Bioficer Dreadnaught": "3BKS", "Pungari Thresher": "1A", "Hyperyacht": "uAJ", "T-Type Tugboat": "oAJR", "M-Type Barge": "uA", "Palatine": "2BK", "SLM-9 Resupply Hauler": "1AJ", "LKS Dredger": "uAJ", "Type-87 Terminus Harvester": "vBKS", "VX-22 Flenser": "pAJ", "OBV-64 Oblivion Barge": "uAS", "PRK-91 Provenance Ark": "vBL", "PHR Corvette (Shield Platform)": "tJRS", "PHR Lighter (Shield Platform)": "nJRS", "PHR Frigate (Shield Platform)": "2JS", "PHR Strike Carrier (Shield Platform)": "2JRS", "PHR Monitor (Shield Platform)": "8JS", "PHR Cutter (Shield Platform)": "uJS", "PHR Destroyer (Shield Platform)": "1JS", "PHR Blockade Runner (Shield Platform)": "uJS", "PHR Light Cruiser (Shield Platform)": "2S", "PHR Medium Cruiser (Shield Platform)": "2S", "PHR Heavy Cruiser (Shield Platform)": "2AS", "PHR Supercruiser (Shield Platform)": "2AS", "PHR Battlecruiser (Shield Platform)": "2AKS", "PHR Pocket Battleship (Shield Platform)": "2BKS", "PHR Battleship (Shield Platform)": "3BKS"}, "target_code_names": {"nJR": ["UCM Corvette", "PHR Lighter", "Resistance Corvette"], "hJR": ["UCM Lighter", "Scourge Corvette"], "wJ": ["UCM Frigate"], "wJR": ["UCM Strike Carrier"], "2J": ["UCM Heavy Frigate", "UCM Heavy Destroyer", "Scourge Monitor", "PHR Frigate"], "2AJ": ["UCM Heavy Destroyer (Leaden Triad)", "UCM Monitor"], "pJ": ["UCM Cutter"], "vJ": ["UCM Destroyer"], "w": ["UCM Light Cruiser", "UCM Medium Cruiser", "Scourge Heavy Cruiser"], "wA": ["UCM Heavy Cruiser", "UCM Supercruiser"], "wAK": ["UCM Battlecruiser"], "wBK": ["UCM Pocket Battleship", "UCM Battleship"], "3BLS": ["UCM Dreadnought"], "hJ": ["Scourge Boarding Ship"], "oJR": ["Scourge Frigate", "Resistance Strike Carrier", "Bioficer Corvette"], "nJ": ["Scourge Cutter"], "uJ": ["Scourge Destroyer", "PHR Cutter", "PHR Blockade Runner", "Resistance Pocket Carrier"], "uAJ": ["Scourge Heavy Destroyer (Little Chaos)", "Resistance Support Carrier", "Hyperyacht", "LKS Dredger"], "v": ["Scourge Light Cruiser", "Scourge Medium Cruiser", "Bioficer Light Cruiser", "Bioficer Medium Cruiser"], "vAK": ["Scourge Battlecruiser"], "2BK": ["Scourge Battleship", "PHR Pocket Battleship", "Resistance Battlecruiser", "Resistance Grand Battleship", "Palatine"], "4BL": ["Scourge Dreadnought"], "tJR": ["PHR Corvette", "Resistance Detonator"], "2JR": ["PHR Strike Carrier"], "8J": ["PHR Monitor"], "1J": ["PHR Destroyer"], "2": ["PHR Light Cruiser", "PHR Medium Cruiser"], "2A": ["PHR Heavy Cruiser", "PHR Supercruiser"], "2AK": ["PHR Battlecruiser"], "3BK": ["PHR Battleship", "Bioficer Battleship"], "9BLS": ["PHR Dreadnought"], "oGJR": ["Shaltari Voidgate", "Shaltari Corvette"], "hGJR": ["Shaltari Voidflyer"], "pGJ": ["Shaltari Frigate", "Shaltari Destroyer"], "vHJ": ["Shaltari Monitor"], "vHJR": ["Shaltari Heavy Voidgate"], "jGJ": ["Shaltari Cutter"], "pG": ["Shaltari Light Cruiser", "Shaltari Medium Cruiser"], "pH": ["Shaltari Heavy Cruiser"], "1AG": ["Shaltari Thresher"], "pAH": ["Shaltari Supercruiser"], "pAHK": ["Shaltari Battlecruiser"], "pBHK": ["Shaltari Pocket Battleship"], "wBHK": ["Shaltari Battleship"], "wBIL": ["Shaltari Dreadnought"], "oJ": ["Resistance Frigate", "Bioficer Lighter", "Bioficer Frigate"], "uJS": ["Resistance Heavy Frigate", "PHR Cutter (Shield Platform)", "PHR Blockade Runner (Shield Platform)"], "tJ": ["Resistance Cutter", "Resistance Monitor"], "vAJ": ["Resistance Destroyer", "Bioficer Cell"], "tAJ": ["Resistance Colony Ship"], "0AJ": ["Resistance Fire Ship (Parliament)"], "o": ["Resistance Light Cruiser"], "vS": ["Resistance Light Cruiser with Ablative Armour"], "uA": ["Resistance Medium Cruiser", "Resistance Heavy Cruiser", "M-Type Barge"], "2AS": ["Resistance Medium Cruiser with Ablative Armour", "Resistance Heavy Cruiser with Ablative Armour", "PHR Heavy Cruiser (Shield Platform)", "PHR Supercruiser (Shield Platform)"], "1BK": ["Resistance Grand Cruiser", "Resistance Old Battleship"], "vBL": ["Resistance Dreadnought", "PRK-91 Provenance Ark"], "vBJ": ["Bioficer Monitor", "Bioficer Destroyer", "Bioficer Heavy Destroyer (The Melter)"], "oAJ": ["Bioficer Cutter"], "vB": ["Bioficer Heavy Cruiser", "Bioficer Supercruiser"], "vBK": ["Bioficer Battlecruiser", "Bioficer Pocket Battleship"], "3BKS": ["Bioficer Dreadnaught", "PHR Battleship (Shield Platform)"], "1A": ["Pungari Thresher"], "oAJR": ["T-Type Tugboat"], "1AJ": ["SLM-9 Resupply Hauler"], "vBKS": ["Type-87 Terminus Harvester"], "pAJ": ["VX-22 Flenser"], "uAS": ["OBV-64 Oblivion Barge"], "tJRS": ["PHR Corvette (Shield Platform)"], "nJRS": ["PHR Lighter (Shield Platform)"], "2JS": ["PHR Frigate (Shield Platform)"], "2JRS": ["PHR Strike Carrier (Shield Platform)"], "8JS": ["PHR Monitor (Shield Platform)"], "1JS": ["PHR Destroyer (Shield Platform)"], "2S": ["PHR Light Cruiser (Shield Platform)", "PHR Medium Cruiser (Shield Platform)"], "2AKS": ["PHR Battlecruiser (Shield Platform)"], "2BKS": ["PHR Pocket Battleship (Shield Platform)"]}, "weapon_coded": {"UCM Mines": "abcea", "UCM Light Torpedo": "adbear", "UCM Medium Torpedo": "adcear", "UCM Heavy Torpedo": "adeear", "UCM Bombers": "abbda0", "UCM Heavy Bombers": "abbdar0CD", "UCM Stingray Missile Bays": "adbca23", "UCM Barracuda Missile Bays": "abbca2", "UCM Shark Missile Bays": "aebca2", "UCM Orca Missile Bays": "agbcga2", "UCM Piranha Missile Turrets": "afbca2", "UCM Arowana Missile Turrets": "afbdal2", "UCM Swordfish Missile Turrets": "ahbca2", "UCM Leviathan Missile Bays": "ahbda2", "UCM Artillery Cannon": "aacfcaCD", "UCM UF-2200 Mass Driver Turret": "aabca", "UCM UF-2200 Mass Driver Turret Triad": "acbgca", "UCM UF-4200 Mass Driver Turrets": "adbgca", "UCM UF-B-9000s (Anti-Ship)": "accda", "UCM UF-B-9000s (Bombardment)": "abcca4", "UCM HB-8800 Bombardment Spikes": "abccal4", "UCM UF-9000-S Twin Mass Driver": "abcda", "UCM UF-9000 Twin Mass Driver": "abcfda6", "UCM UF-6400 Mass Driver Turrets": "adbdfa", "UCM UF-6400 Mass Driver Twin Turret": "adbdfa", "UCM UF-B-8000 Bombardment Turret Pair": "ahbcal4", "UCM UF-6400 Mass Driver Turret Triad": "afbdfa", "UCM UF-B-8000 Bombardment Turrets": "albcal4", "UCM UF-12000 Twin Mass Driver": "abeec1", "UCM UF-4200 Mass Driver Turret Core Battery": "afbhca", "UCM UF-6400 Mass Driver Turret Battery": "ahbdfa", "UCM UF-9000 Mass Driver Turret": "abcefar", "UCM Taipan Laser Turrets": "abbebm", "UCM Elapid Laser Turret": "abcebr", "UCM Elapid Laser Turrets": "adcebr", "UCM Mamba Laser": "acbdbd", "UCM Adder Multi Laser": "acbebm", "UCM Cobra Heavy Laser": "adbdbd", "UCM Cobra Heavy Laser Pair": "afbdbe", "UCM Viper Super Heavy Laser": "ahbdbd", "UCM Python Super Heavy Laser": "aecdbe", "Scourge Mines": "acbca", "Scourge Torpedo": "afbca1", "Scourge Bombers": "abbda10", "Scourge Plasma Squall": "acbcam23", "Scourge Seakers": "adbdbm26", "Scourge Plasma Torch": "acbcbm29", "Scourge Engine Needle": "abbdb1", "Scourge Reverse Grav Cannon": "adbda5", "Scourge Plasma Brand": "abcdam12", "Scourge Plasma Vortex": "afbdam2", "Scourge Plasma Cyclone": "afbdam2", "Scourge Plasma Gale": "acbdam", "Scourge Plasma Storm": "adbdam2", "Scourge Plasma Tempest": "ahbgdam2", "Scourge Plasma Flood": "aibdam2", "Scourge Anharmonic Resonator": "acbdc12", "Scourge Magneton Lash": "adccbr27CD", "Scourge Heavy Plasma Beam": "acbdbr2", "Scourge Heavy Plasma Beam Pair": "accdbr2", "Scourge Heavy Plasma Beam Triad": "acddbr2", "Scourge Plasma Bombs": "adbbam4", "Scourge Oculus Rays (Frigate)": "abbdbl", "Scourge Oculus Rays (Wraith)": "abbdbl", "Scourge Oculus Rays (Destroyer)": "abbdbl", "Scourge Oculus Rays (Barge)": "aabdbl", "Scourge Siphoned Oculus Rays": "abcdbl", "Scourge Siphoned Oculus Rays (Buffed)": "accdbl", "Scourge Siphoned Oculus Rays (Double Buffed)": "adcdbl", "Scourge Oculus Beams (Harpy)": "abcdbl", "Scourge Oculus Beam Crest (Monitor)": "abcdbm", "Scourge Oculus Beams (Destroyer)": "aacdbl", "Scourge Oculus Beams (Cruiser)": "aacdbl", "Scourge Oculus Beam Array (Cruiser)": "adcdbl", "Scourge Oculus Beam Crest (Cruiser)": "accdbm", "Scourge Oculus Beam Array (Battlecruiser)": "abcdbl", "Scourge Oculus Beam Array (Battleship)": "accdbl", "Scourge Oculus Beam Array (Dreadnaught)": "accdbl", "Scourge Oculus Beam Phalanx (Akuma)": "accdbl", "Scourge Oculus Beam Phalanx (Battleship)": "adcdbl", "Scourge Oculus Beam Super Phalanx": "ahcdbm", "Scourge Mega Plasma Lance Battery": "accdbiCD", "Scourge Furnace Blaster": "adbdbd1", "Scourge Furnace Cannons": "afbdbd1", "Scourge Furnace Fangs": "afbebd1", "Scourge Furnace Triad": "aceec1", "PHR Mines": "abcea", "PHR Torpedo": "adcear", "PHR Bombers": "abbea0", "PHR Heavy Calibre Orbital Gun (Mounted)": "abceaCD", "PHR Heavy Calibre Orbital Gun (Deployed)": "abcega5CD", "PHR Vespa Drones": "acbca23", "PHR EM Warfare Suite": "abbdb1", "PHR Wasp Drones": "acbda2", "PHR Point Defence Array": "acbfdb2", "PHR Nano Drones": "afbca2", "PHR Kingfisher Drones": "aebda26", "PHR Black Nano Drones": "ahbcar2", "PHR Hornet Drones": "aebda2", "PHR Hornet Drone Locus": "ahcda2", "PHR Hornet Drone Cluster": "afcda2", "PHR Hornet Drone Hive": "afcda2", "PHR Holographic Drones": "adbca2", "PHR Neutron Missiles": "adcebr12", "PHR Energy Glaive Pair": "abcdb8", "PHR Twin Heavy Calibres": "aadcarCD", "PHR Long Heavy Calibres": "aaddarCD", "PHR Quad Battery": "abcgdfa", "PHR Bombardment Turret": "acbba4", "PHR Bombardment Battery": "ahbba4", "PHR Apocalypse Cannon": "adccc48", "PHR Medium Calibre Turret": "aacca", "PHR Medium Calibre Bank": "abcca", "PHR Light Calibre Broadside": "afbba6A", "PHR Light Calibre Double Broadside": "albba6A", "PHR Medium Calibre Broadside": "accfca", "PHR Medium Calibre Double Broadside": "afcfca", "PHR Heavy Calibre Broadside": "aaddarC", "PHR Heavy Calibre Double Broadside": "abddarC", "PHR Heavy Calibre Triple Broadside": "acddarCD", "PHR Heavy Quad Battery": "adcdfarCD", "PHR Heavy Quad Battery (Flak)": "albiea", "PHR Dark Matter Cannon": "adcefbr1", "PHR Laser Multi-Lance": "agbcbhA", "PHR Glaive Lance": "acceb8", "PHR Energy Glaives": "accdb8", "PHR Energy Glaive Battery": "afcdb8", "PHR Energy Glaive Battery (Gaius Chau)": "afcdbi", "PHR Supernova Laser": "acbdbd", "PHR Twin Supernova Laser": "accdbe", "PHR Meganova Laser": "accdbr", "PHR Hypernova Laser": "acddfc", "Shaltari Electrowave Caster": "acbeb25", "Shaltari Mines": "adbdb", "Shaltari Impel Mines": "acbcb", "Shaltari Torpedo": "acdcc", "Shaltari Bombers": "abbdb0", "Shaltari Fire Ships": "adbba0", "Pungari Fire Ships": "adbba0", "Shaltari Ion Lance": "aebcb23", "Shaltari Pulse Blaster": "aacdbr2", "Shaltari Harpoon Strike": "abbca2", "Shaltari Harpoon Cascade": "acbca2", "Pungari Harpoon Strike": "acbca2", "Shaltari Charged Air": "acbbb23", "Shaltari Force Projectors": "afbda2", "Shaltari Bio Atomiser Array": "acbdc2", "Shaltari Pulse Ioniser Bank": "adbcbe27CD", "Shaltari Harpoon Deluge": "ahbca2", "Shaltari Microwave Array": "adbdbl2", "Shaltari Microwave Array Bank": "adbdbl2", "Shaltari Pulse Ioniser Battery": "albcbe27BCD", "Shaltari Quad Ion Cannon": "abcdb1", "Shaltari Defence Array": "adbcb5", "Shaltari Disintegrator Bank": "acbdbh", "Shaltari Light Distuptor": "acbdbA", "Shaltari Disruption Beamers": "abbfdb", "Shaltari Kinetic Lance": "abcda", "Shaltari Gravity Coil Pair": "acbeb", "Shaltari Distuptor Pair": "ahbcb", "Shaltari Disintegrator Battery": "aebdbh", "Shaltari Ion Aura": "afbdbl2", "Shaltari Ion Storm": "afbcbl4", "Shaltari Thermal Lance Cannon": "abbfebd", "Shaltari Thermal Lance Cannon Pair": "adbgebd", "Shaltari Quad Thermal Lance Cannon": "ahbiebd", "Shaltari Mega Thermal Lance Cannon": "aecebd", "Shaltari Twin Hyperwave Cannon": "adcdb1", "Shaltari Ion Cannonade": "ajbcb1", "Shaltari Electrosurge Projectors": "acbcb", "Shaltari Gravitic Beamer": "aebcb6", "Shaltari Distortion Cannons": "afbdgbr", "Shaltari Particle Lance (Jade)": "aacdc", "Shaltari Particle Lance (Cruiser)": "aacdfc", "Shaltari Particle Lance Pair": "abcdfc", "Shaltari Particle Lance Triad": "accdfc", "Shaltari Obliterator Cannon": "adcdfc", "Shaltari Microwave Array Turret": "aebdc", "Resistance Mines": "aebca", "Resistance Torpedo": "afbear", "Resistance Bombers": "acbca0", "Resistance Fire Ships": "acbeb0", "Resistance NCA-1 Missiles": "adbda23", "Resistance \"Godray\" Orbital Mass Driver": "aaddcCD", "Resistance \"Godray\" Bombardment Mass Driver": "aadcbr4", "Resistance N-12 Artillery Cannon": "adbgca", "Resistance HF-8 Clearance Laser (Focused)": "adccbd7AB", "Resistance N-109 Bombardment Mortar Turret": "acbcal4", "Resistance VX Bomb (vs ships/stations)": "acccb4", "Resistance VX Bomb (vs cities)": "acccbm4", "Resistance Light Vent Cannon Turret": "abbcbh8", "Resistance Vent Cannon Turret": "acbdbh8", "Resistance Heavy Vent Cannon Turret": "abcfdbh8", "Resistance Heavy Vent Cannon Turrets": "adcfdbh8", "Resistance Heavy Vent Cannons": "adcfdbh", "Resistance Heavy Dual Vent Cannon Turret": "adcgdbh8", "Resistance Mega Vent Cannon Half Battery": "abdfdbh8", "Resistance Spinal Vent Lance": "acedbh8", "Resistance NC-16 Missile Turret": "afbda2", "Resistance NC-16 Missile Bank": "afbda2", "Resistance NC-16 Missile Salvo": "ahbda2", "Resistance NC-16 Missile Battery Turret Pair": "afcda2", "Resistance NC-16 Missile Battery (Old Battleship)": "accda2", "Resistance NC-16 Missile Battery (Grand Battleship)": "afcda2", "Resistance NC-16 Missile Battery Turret Quad": "afcda2", "Resistance NC-16 Missile Battery (Dreadnought)": "afcda2", "Resistance N-8 Artillery Cannon Bank": "afbgba", "Resistance N-11 Artillery Cannon Turret": "acbfca", "Resistance N-11 Twin Artillery Cannon Turrets": "afbgca", "Resistance N-12 Artillery Cannon Battery": "aebca", "Resistance N-12 Artillery Cannon Half Battery": "aebca", "Resistance N-31 Hybrid Gun Turret": "abbfda", "Resistance N-31 Hybrid Gun Bank": "acbca", "Resistance N-31 Hybrid Gun Long Battery": "aibhca", "Resistance XN-31 Mass Driver Turret": "abbefa", "Resistance 9k Mass Driver Turret": "abcefar", "Resistance Spinal Mass Annihilator": "abdegc1", "Resistance NC-16 Missiles": "adbda2", "Resistance N-31 Hybrid Gun Battery": "ahbca", "Resistance 10k Mass Driver Turret": "abcdgarCD", "Bioficer Mines": "adbda", "Bioficer Torpedo": "acbea", "Bioficer Bombers": "acbca0", "Bioficer Bombardment": "accbb4", "Bioficer Light Bombardment": "acbbb4", "Bioficer Bombardment Spine": "aicbb4", "Bioficer Prism": "adbdb", "Bioficer Concussion Prism": "afbdb", "Bioficer Decon Slayer": "acbdb3", "Bioficer Winnower": "aebcb2A", "Bioficer Giga Winnower": "aobjdb2A", "Bioficer Gravitic Pulveriser (Anti-Ship)": "afbdc2", "Bioficer Gravitic Pulveriser (Bombardment)": "afbcc4", "Bioficer Gravitic Stave": "acbcc", "Bioficer Gravitic Hyperlance": "afcdc", "Bioficer Graviton Lens": "adbdc2", "Bioficer Decon Burst": "aabcb", "Bioficer Decon Blast": "adbcb", "Bioficer Decon Blaster": "acbdb", "Bioficer Decon Cannon": "agbdb", "Bioficer Decon Annihilator": "albdbh", "Bioficer Decon Devastator": "aibdbi", "Bioficer Bisector": "abddbrCD", "Bioficer Grand Bisector": "aeddbr1CD", "Bioficer Lightvice": "adbea2", "Bioficer Heavy Lightvice": "aecea2", "Bioficer Hyper Lightvice": "aedeal2", "Bioficer Godray Lightvice (Anti-Ship)": "aedeal2", "Bioficer Godray Lightvice (Bombardment)": "aedeal24", "Bioficer Giga Lightvice": "ahdeam2", "Bioficer Thermator": "acccbl8", "Bioficer Thermator Cage (Long Range)": "adccbm8", "Bioficer Thermator Cage (Short Range)": "adcdbn28", "Bioficer Frigate Scythe Nodule": "adbgcbh", "Bioficer Battleship Scythe Nodule": "adbcbh", "Bioficer Scythe Cluster": "agbhcbh", "Bioficer Scythes": "ahbhcbh", "Bioficer Barb Stinger": "aaceah", "Bioficer Barb Spiker": "aaceai", "Bioficer Barb Launcher": "aaeeai", "Bioficer Ghost Orb": "abcda2", "Aurorum 9k Snub Mass Drivers": "adbefa", "Palatine N-12 Artillery Cannons": "ahbca", "Somniferum Party Poppers": "acbcb", "M-Type Deterrence Missiles": "adbda2", "T-Type Deterrence Missiles": "adbda2", "T-Type Drag to Hell": "accdc2", "Dredger Mining Laser": "accee2", "Terminus Colossal Salvage Cutter": "aedec2", "Oblivion Expel Hazards (0-1 damage)": "abbdc", "Oblivion Expel Hazards (2-3 damage)": "acbdc", "Oblivion Expel Hazards (4-5 damage)": "adbdc", "Oblivion Expel Hazards (6-7 damage)": "aebdc", "Oblivion Expel Hazards (8-9 damage)": "afbdc", "Oblivion Expel Hazards (10-11 damage)": "agbdc", "Oblivion Expel Hazards (12 damage)": "ahbdc", "Provenance Heavy Dual Vent Cannon Turret": "accfdbh8", "Provenance NC-16 Missile Bank": "afbda2", "Provenance Genesis Spikes": "accbar4", "UCM UF-2200 Mass Driver Turret (Mass Driver Volley)": "aabda", "UCM UF-2200 Mass Driver Turret Triad (Mass Driver Volley)": "acbgda", "UCM UF-4200 Mass Driver Turrets (Mass Driver Volley)": "adbgda", "UCM UF-9000-S Twin Mass Driver (Mass Driver Volley)": "abcea", "UCM UF-9000 Twin Mass Driver (Mass Driver Volley)": "abcfea6", "UCM UF-6400 Mass Driver Turrets (Mass Driver Volley)": "adbefa", "UCM UF-6400 Mass Driver Twin Turret (Mass Driver Volley)": "adbefa", "UCM UF-6400 Mass Driver Turret Triad (Mass Driver Volley)": "afbefa", "UCM UF-4200 Mass Driver Turret Core Battery (Mass Driver Volley)": "afbhda", "UCM UF-6400 Mass Driver Turret Battery (Mass Driver Volley)": "ahbefa", "UCM Taipan Laser Turrets (Overcharge Lasers)": "abbgebm", "UCM Elapid Laser Turret (Overcharge Lasers)": "abcgebr", "UCM Elapid Laser Turrets (Overcharge Lasers)": "adcgebr", "UCM Mamba Laser (Overcharge Lasers)": "acbgdbd", "UCM Adder Multi Laser (Overcharge Lasers)": "acbgebm", "UCM Cobra Heavy Laser (Overcharge Lasers)": "adbgdbd", "UCM Cobra Heavy Laser Pair (Overcharge Lasers)": "afbgdbe", "UCM Viper Super Heavy Laser (Overcharge Lasers)": "ahbgdbd", "UCM Python Super Heavy Laser (Overcharge Lasers)": "aecgdbe", "Scourge Oculus Rays (Frigate) (Reaving Gaze)": "abbdbh", "Scourge Oculus Rays (Wraith) (Reaving Gaze)": "abbdbh", "Scourge Oculus Rays (Destroyer) (Reaving Gaze)": "abbdbh", "Scourge Oculus Rays (Barge) (Reaving Gaze)": "aabdbh", "Scourge Siphoned Oculus Rays (Reaving Gaze)": "abcdbh", "Scourge Siphoned Oculus Rays (Buffed) (Reaving Gaze)": "accdbh", "Scourge Siphoned Oculus Rays (Double Buffed) (Reaving Gaze)": "adcdbh", "Scourge Oculus Beams (Harpy) (Reaving Gaze)": "abcdbh", "Scourge Oculus Beam Crest (Monitor) (Reaving Gaze)": "abcdbi", "Scourge Oculus Beams (Destroyer) (Reaving Gaze)": "aacdbh", "Scourge Oculus Beams (Cruiser) (Reaving Gaze)": "aacdbh", "Scourge Oculus Beam Array (Cruiser) (Reaving Gaze)": "adcdbh", "Scourge Oculus Beam Crest (Cruiser) (Reaving Gaze)": "accdbi", "Scourge Oculus Beam Array (Battlecruiser) (Reaving Gaze)": "abcdbh", "Scourge Oculus Beam Array (Battleship) (Reaving Gaze)": "accdbh", "Scourge Oculus Beam Array (Dreadnaught) (Reaving Gaze)": "accdbh", "Scourge Oculus Beam Phalanx (Akuma) (Reaving Gaze)": "accdbh", "Scourge Oculus Beam Phalanx (Battleship) (Reaving Gaze)": "adcdbh", "Scourge Oculus Beam Super Phalanx (Reaving Gaze)": "ahcdbi", "PHR Medium Calibre Broadside (Ship of the Line)": "adcfca", "PHR Medium Calibre Double Broadside (Ship of the Line)": "agcfca", "UCM Artillery Cannon (Typhoon Vasquez)": "aacfccCD", "Resistance N-12 Artillery Cannon (Typhoon Vasquez)": "adbgcc", "Resistance N-8 Artillery Cannon Bank (Typhoon Vasquez)": "afbgbc", "Resistance N-11 Artillery Cannon Turret (Typhoon Vasquez)": "acbfcc", "Resistance N-11 Twin Artillery Cannon Turrets (Typhoon Vasquez)": "afbgcc", "Resistance N-12 Artillery Cannon Battery (Typhoon Vasquez)": "aebcc", "Resistance N-12 Artillery Cannon Half Battery (Typhoon Vasquez)": "aebcc", "Palatine N-12 Artillery Cannons (Typhoon Vasquez)": "ahbcc", "Bioficer Decon Slayer (Kenetic Deconstruction)": "acbda3", "Bioficer Decon Burst (Kenetic Deconstruction)": "aabca", "Bioficer Decon Blast (Kenetic Deconstruction)": "adbca", "Bioficer Decon Blaster (Kenetic Deconstruction)": "acbda", "Bioficer Decon Cannon (Kenetic Deconstruction)": "agbda", "Bioficer Decon Annihilator (Kenetic Deconstruction)": "albdah", "Bioficer Decon Devastator (Kenetic Deconstruction)": "aibdai"}, "weapon_code_names": {"abcea": ["UCM Mines", "PHR Mines", "UCM UF-9000-S Twin Mass Driver (Mass Driver Volley)"], "adbear": ["UCM Light Torpedo"], "adcear": ["UCM Medium Torpedo", "PHR Torpedo"], "adeear": ["UCM Heavy Torpedo"], "abbda0": ["UCM Bombers"], "abbdar0CD": ["UCM Heavy Bombers"], "adbca23": ["UCM Stingray Missile Bays"], "abbca2": ["UCM Barracuda Missile Bays", "Shaltari Harpoon Strike"], "aebca2": ["UCM Shark Missile Bays"], "agbcga2": ["UCM Orca Missile Bays"], "afbca2": ["UCM Piranha Missile Turrets", "PHR Nano Drones"], "afbdal2": ["UCM Arowana Missile Turrets"], "ahbca2": ["UCM Swordfish Missile Turrets", "Shaltari Harpoon Deluge"], "ahbda2": ["UCM Leviathan Missile Bays", "Resistance NC-16 Missile Salvo"], "aacfcaCD": ["UCM Artillery Cannon"], "aabca": ["UCM UF-2200 Mass Driver Turret", "Bioficer Decon Burst (Kenetic Deconstruction)"], "acbgca": ["UCM UF-2200 Mass Driver Turret Triad"], "adbgca": ["UCM UF-4200 Mass Driver Turrets", "Resistance N-12 Artillery Cannon"], "accda": ["UCM UF-B-9000s (Anti-Ship)"], "abcca4": ["UCM UF-B-9000s (Bombardment)"], "abccal4": ["UCM HB-8800 Bombardment Spikes"], "abcda": ["UCM UF-9000-S Twin Mass Driver", "Shaltari Kinetic Lance"], "abcfda6": ["UCM UF-9000 Twin Mass Driver"], "adbdfa": ["UCM UF-6400 Mass Driver Turrets", "UCM UF-6400 Mass Driver Twin Turret"], "ahbcal4": ["UCM UF-B-8000 Bombardment Turret Pair"], "afbdfa": ["UCM UF-6400 Mass Driver Turret Triad"], "albcal4": ["UCM UF-B-8000 Bombardment Turrets"], "abeec1": ["UCM UF-12000 Twin Mass Driver"], "afbhca": ["UCM UF-4200 Mass Driver Turret Core Battery"], "ahbdfa": ["UCM UF-6400 Mass Driver Turret Battery"], "abcefar": ["UCM UF-9000 Mass Driver Turret", "Resistance 9k Mass Driver Turret"], "abbebm": ["UCM Taipan Laser Turrets"], "abcebr": ["UCM Elapid Laser Turret"], "adcebr": ["UCM Elapid Laser Turrets"], "acbdbd": ["UCM Mamba Laser", "PHR Supernova Laser"], "acbebm": ["UCM Adder Multi Laser"], "adbdbd": ["UCM Cobra Heavy Laser"], "afbdbe": ["UCM Cobra Heavy Laser Pair"], "ahbdbd": ["UCM Viper Super Heavy Laser"], "aecdbe": ["UCM Python Super Heavy Laser"], "acbca": ["Scourge Mines", "Resistance N-31 Hybrid Gun Bank"], "afbca1": ["Scourge Torpedo"], "abbda10": ["Scourge Bombers"], "acbcam23": ["Scourge Plasma Squall"], "adbdbm26": ["Scourge Seakers"], "acbcbm29": ["Scourge Plasma Torch"], "abbdb1": ["Scourge Engine Needle", "PHR EM Warfare Suite"], "adbda5": ["Scourge Reverse Grav Cannon"], "abcdam12": ["Scourge Plasma Brand"], "afbdam2": ["Scourge Plasma Vortex", "Scourge Plasma Cyclone"], "acbdam": ["Scourge Plasma Gale"], "adbdam2": ["Scourge Plasma Storm"], "ahbgdam2": ["Scourge Plasma Tempest"], "aibdam2": ["Scourge Plasma Flood"], "acbdc12": ["Scourge Anharmonic Resonator"], "adccbr27CD": ["Scourge Magneton Lash"], "acbdbr2": ["Scourge Heavy Plasma Beam"], "accdbr2": ["Scourge Heavy Plasma Beam Pair"], "acddbr2": ["Scourge Heavy Plasma Beam Triad"], "adbbam4": ["Scourge Plasma Bombs"], "abbdbl": ["Scourge Oculus Rays (Frigate)", "Scourge Oculus Rays (Wraith)", "Scourge Oculus Rays (Destroyer)"], "aabdbl": ["Scourge Oculus Rays (Barge)"], "abcdbl": ["Scourge Siphoned Oculus Rays", "Scourge Oculus Beams (Harpy)", "Scourge Oculus Beam Array (Battlecruiser)"], "accdbl": ["Scourge Siphoned Oculus Rays (Buffed)", "Scourge Oculus Beam Array (Battleship)", "Scourge Oculus Beam Array (Dreadnaught)", "Scourge Oculus Beam Phalanx (Akuma)"], "adcdbl": ["Scourge Siphoned Oculus Rays (Double Buffed)", "Scourge Oculus Beam Array (Cruiser)", "Scourge Oculus Beam Phalanx (Battleship)"], "abcdbm": ["Scourge Oculus Beam Crest (Monitor)"], "aacdbl": ["Scourge Oculus Beams (Destroyer)", "Scourge Oculus Beams (Cruiser)"], "accdbm": ["Scourge Oculus Beam Crest (Cruiser)"], "ahcdbm": ["Scourge Oculus Beam Super Phalanx"], "accdbiCD": ["Scourge Mega Plasma Lance Battery"], "adbdbd1": ["Scourge Furnace Blaster"], "afbdbd1": ["Scourge Furnace Cannons"], "afbebd1": ["Scourge Furnace Fangs"], "aceec1": ["Scourge Furnace Triad"], "abbea0": ["PHR Bombers"], "abceaCD": ["PHR Heavy Calibre Orbital Gun (Mounted)"], "abcega5CD": ["PHR Heavy Calibre Orbital Gun (Deployed)"], "acbca23": ["PHR Vespa Drones"], "acbda2": ["PHR Wasp Drones"], "acbfdb2": ["PHR Point Defence Array"], "aebda26": ["PHR Kingfisher Drones"], "ahbcar2": ["PHR Black Nano Drones"], "aebda2": ["PHR Hornet Drones"], "ahcda2": ["PHR Hornet Drone Locus"], "afcda2": ["PHR Hornet Drone Cluster", "PHR Hornet Drone Hive", "Resistance NC-16 Missile Battery Turret Pair", "Resistance NC-16 Missile Battery (Grand Battleship)", "Resistance NC-16 Missile Battery Turret Quad", "Resistance NC-16 Missile Battery (Dreadnought)"], "adbca2": ["PHR Holographic Drones"], "adcebr12": ["PHR Neutron Missiles"], "abcdb8": ["PHR Energy Glaive Pair"], "aadcarCD": ["PHR Twin Heavy Calibres"], "aaddarCD": ["PHR Long Heavy Calibres"], "abcgdfa": ["PHR Quad Battery"], "acbba4": ["PHR Bombardment Turret"], "ahbba4": ["PHR Bombardment Battery"], "adccc48": ["PHR Apocalypse Cannon"], "aacca": ["PHR Medium Calibre Turret"], "abcca": ["PHR Medium Calibre Bank"], "afbba6A": ["PHR Light Calibre Broadside"], "albba6A": ["PHR Light Calibre Double Broadside"], "accfca": ["PHR Medium Calibre Broadside"], "afcfca": ["PHR Medium Calibre Double Broadside"], "aaddarC": ["PHR Heavy Calibre Broadside"], "abddarC": ["PHR Heavy Calibre Double Broadside"], "acddarCD": ["PHR Heavy Calibre Triple Broadside"], "adcdfarCD": ["PHR Heavy Quad Battery"], "albiea": ["PHR Heavy Quad Battery (Flak)"], "adcefbr1": ["PHR Dark Matter Cannon"], "agbcbhA": ["PHR Laser Multi-Lance"], "acceb8": ["PHR Glaive Lance"], "accdb8": ["PHR Energy Glaives"], "afcdb8": ["PHR Energy Glaive Battery"], "afcdbi": ["PHR Energy Glaive Battery (Gaius Chau)"], "accdbe": ["PHR Twin Supernova Laser"], "accdbr": ["PHR Meganova Laser"], "acddfc": ["PHR Hypernova Laser"], "acbeb25": ["Shaltari Electrowave Caster"], "adbdb": ["Shaltari Mines", "Bioficer Prism"], "acbcb": ["Shaltari Impel Mines", "Shaltari Electrosurge Projectors", "Somniferum Party Poppers"], "acdcc": ["Shaltari Torpedo"], "abbdb0": ["Shaltari Bombers"], "adbba0": ["Shaltari Fire Ships", "Pungari Fire Ships"], "aebcb23": ["Shaltari Ion Lance"], "aacdbr2": ["Shaltari Pulse Blaster"], "acbca2": ["Shaltari Harpoon Cascade", "Pungari Harpoon Strike"], "acbbb23": ["Shaltari Charged Air"], "afbda2": ["Shaltari Force Projectors", "Resistance NC-16 Missile Turret", "Resistance NC-16 Missile Bank", "Provenance NC-16 Missile Bank"], "acbdc2": ["Shaltari Bio Atomiser Array"], "adbcbe27CD": ["Shaltari Pulse Ioniser Bank"], "adbdbl2": ["Shaltari Microwave Array", "Shaltari Microwave Array Bank"], "albcbe27BCD": ["Shaltari Pulse Ioniser Battery"], "abcdb1": ["Shaltari Quad Ion Cannon"], "adbcb5": ["Shaltari Defence Array"], "acbdbh": ["Shaltari Disintegrator Bank"], "acbdbA": ["Shaltari Light Distuptor"], "abbfdb": ["Shaltari Disruption Beamers"], "acbeb": ["Shaltari Gravity Coil Pair"], "ahbcb": ["Shaltari Distuptor Pair"], "aebdbh": ["Shaltari Disintegrator Battery"], "afbdbl2": ["Shaltari Ion Aura"], "afbcbl4": ["Shaltari Ion Storm"], "abbfebd": ["Shaltari Thermal Lance Cannon"], "adbgebd": ["Shaltari Thermal Lance Cannon Pair"], "ahbiebd": ["Shaltari Quad Thermal Lance Cannon"], "aecebd": ["Shaltari Mega Thermal Lance Cannon"], "adcdb1": ["Shaltari Twin Hyperwave Cannon"], "ajbcb1": ["Shaltari Ion Cannonade"], "aebcb6": ["Shaltari Gravitic Beamer"], "afbdgbr": ["Shaltari Distortion Cannons"], "aacdc": ["Shaltari Particle Lance (Jade)"], "aacdfc": ["Shaltari Particle Lance (Cruiser)"], "abcdfc": ["Shaltari Particle Lance Pair"], "accdfc": ["Shaltari Particle Lance Triad"], "adcdfc": ["Shaltari Obliterator Cannon"], "aebdc": ["Shaltari Microwave Array Turret", "Oblivion Expel Hazards (6-7 damage)"], "aebca": ["Resistance Mines", "Resistance N-12 Artillery Cannon Battery", "Resistance N-12 Artillery Cannon Half Battery"], "afbear": ["Resistance Torpedo"], "acbca0": ["Resistance Bombers", "Bioficer Bombers"], "acbeb0": ["Resistance Fire Ships"], "adbda23": ["Resistance NCA-1 Missiles"], "aaddcCD": ["Resistance \"Godray\" Orbital Mass Driver"], "aadcbr4": ["Resistance \"Godray\" Bombardment Mass Driver"], "adccbd7AB": ["Resistance HF-8 Clearance Laser (Focused)"], "acbcal4": ["Resistance N-109 Bombardment Mortar Turret"], "acccb4": ["Resistance VX Bomb (vs ships/stations)"], "acccbm4": ["Resistance VX Bomb (vs cities)"], "abbcbh8": ["Resistance Light Vent Cannon Turret"], "acbdbh8": ["Resistance Vent Cannon Turret"], "abcfdbh8": ["Resistance Heavy Vent Cannon Turret"], "adcfdbh8": ["Resistance Heavy Vent Cannon Turrets"], "adcfdbh": ["Resistance Heavy Vent Cannons"], "adcgdbh8": ["Resistance Heavy Dual Vent Cannon Turret"], "abdfdbh8": ["Resistance Mega Vent Cannon Half Battery"], "acedbh8": ["Resistance Spinal Vent Lance"], "accda2": ["Resistance NC-16 Missile Battery (Old Battleship)"], "afbgba": ["Resistance N-8 Artillery Cannon Bank"], "acbfca": ["Resistance N-11 Artillery Cannon Turret"], "afbgca": ["Resistance N-11 Twin Artillery Cannon Turrets"], "abbfda": ["Resistance N-31 Hybrid Gun Turret"], "aibhca": ["Resistance N-31 Hybrid Gun Long Battery"], "abbefa": ["Resistance XN-31 Mass Driver Turret"], "abdegc1": ["Resistance Spinal Mass Annihilator"], "adbda2": ["Resistance NC-16 Missiles", "M-Type Deterrence Missiles", "T-Type Deterrence Missiles"], "ahbca": ["Resistance N-31 Hybrid Gun Battery", "Palatine N-12 Artillery Cannons"], "abcdgarCD": ["Resistance 10k Mass Driver Turret"], "adbda": ["Bioficer Mines"], "acbea": ["Bioficer Torpedo"], "accbb4": ["Bioficer Bombardment"], "acbbb4": ["Bioficer Light Bombardment"], "aicbb4": ["Bioficer Bombardment Spine"], "afbdb": ["Bioficer Concussion Prism"], "acbdb3": ["Bioficer Decon Slayer"], "aebcb2A": ["Bioficer Winnower"], "aobjdb2A": ["Bioficer Giga Winnower"], "afbdc2": ["Bioficer Gravitic Pulveriser (Anti-Ship)"], "afbcc4": ["Bioficer Gravitic Pulveriser (Bombardment)"], "acbcc": ["Bioficer Gravitic Stave"], "afcdc": ["Bioficer Gravitic Hyperlance"], "adbdc2": ["Bioficer Graviton Lens"], "aabcb": ["Bioficer Decon Burst"], "adbcb": ["Bioficer Decon Blast"], "acbdb": ["Bioficer Decon Blaster"], "agbdb": ["Bioficer Decon Cannon"], "albdbh": ["Bioficer Decon Annihilator"], "aibdbi": ["Bioficer Decon Devastator"], "abddbrCD": ["Bioficer Bisector"], "aeddbr1CD": ["Bioficer Grand Bisector"], "adbea2": ["Bioficer Lightvice"], "aecea2": ["Bioficer Heavy Lightvice"], "aedeal2": ["Bioficer Hyper Lightvice", "Bioficer Godray Lightvice (Anti-Ship)"], "aedeal24": ["Bioficer Godray Lightvice (Bombardment)"], "ahdeam2": ["Bioficer Giga Lightvice"], "acccbl8": ["Bioficer Thermator"], "adccbm8": ["Bioficer Thermator Cage (Long Range)"], "adcdbn28": ["Bioficer Thermator Cage (Short Range)"], "adbgcbh": ["Bioficer Frigate Scythe Nodule"], "adbcbh": ["Bioficer Battleship Scythe Nodule"], "agbhcbh": ["Bioficer Scythe Cluster"], "ahbhcbh": ["Bioficer Scythes"], "aaceah": ["Bioficer Barb Stinger"], "aaceai": ["Bioficer Barb Spiker"], "aaeeai": ["Bioficer Barb Launcher"], "abcda2": ["Bioficer Ghost Orb"], "adbefa": ["Aurorum 9k Snub Mass Drivers", "UCM UF-6400 Mass Driver Turrets (Mass Driver Volley)", "UCM UF-6400 Mass Driver Twin Turret (Mass Driver Volley)"], "accdc2": ["T-Type Drag to Hell"], "accee2": ["Dredger Mining Laser"], "aedec2": ["Terminus Colossal Salvage Cutter"], "abbdc": ["Oblivion Expel Hazards (0-1 damage)"], "acbdc": ["Oblivion Expel Hazards (2-3 damage)"], "adbdc": ["Oblivion Expel Hazards (4-5 damage)"], "afbdc": ["Oblivion Expel Hazards (8-9 damage)"], "agbdc": ["Oblivion Expel Hazards (10-11 damage)"], "ahbdc": ["Oblivion Expel Hazards (12 damage)"], "accfdbh8": ["Provenance Heavy Dual Vent Cannon Turret"], "accbar4": ["Provenance Genesis Spikes"], "aabda": ["UCM UF-2200 Mass Driver Turret (Mass Driver Volley)"], "acbgda": ["UCM UF-2200 Mass Driver Turret Triad (Mass Driver Volley)"], "adbgda": ["UCM UF-4200 Mass Driver Turrets (Mass Driver Volley)"], "abcfea6": ["UCM UF-9000 Twin Mass Driver (Mass Driver Volley)"], "afbefa": ["UCM UF-6400 Mass Driver Turret Triad (Mass Driver Volley)"], "afbhda": ["UCM UF-4200 Mass Driver Turret Core Battery (Mass Driver Volley)"], "ahbefa": ["UCM UF-6400 Mass Driver Turret Battery (Mass Driver Volley)"], "abbgebm": ["UCM Taipan Laser Turrets (Overcharge Lasers)"], "abcgebr": ["UCM Elapid Laser Turret (Overcharge Lasers)"], "adcgebr": ["UCM Elapid Laser Turrets (Overcharge Lasers)"], "acbgdbd": ["UCM Mamba Laser (Overcharge Lasers)"], "acbgebm": ["UCM Adder Multi Laser (Overcharge Lasers)"], "adbgdbd": ["UCM Cobra Heavy Laser (Overcharge Lasers)"], "afbgdbe": ["UCM Cobra Heavy Laser Pair (Overcharge Lasers)"], "ahbgdbd": ["UCM Viper Super Heavy Laser (Overcharge Lasers)"], "aecgdbe": ["UCM Python Super Heavy Laser (Overcharge Lasers)"], "abbdbh": ["Scourge Oculus Rays (Frigate) (Reaving Gaze)", "Scourge Oculus Rays (Wraith) (Reaving Gaze)", "Scourge Oculus Rays (Destroyer) (Reaving Gaze)"], "aabdbh": ["Scourge Oculus Rays (Barge) (Reaving Gaze)"], "abcdbh": ["Scourge Siphoned Oculus Rays (Reaving Gaze)", "Scourge Oculus Beams (Harpy) (Reaving Gaze)", "Scourge Oculus Beam Array (Battlecruiser) (Reaving Gaze)"], "accdbh": ["Scourge Siphoned Oculus Rays (Buffed) (Reaving Gaze)", "Scourge Oculus Beam Array (Battleship) (Reaving Gaze)", "Scourge Oculus Beam Array (Dreadnaught) (Reaving Gaze)", "Scourge Oculus Beam Phalanx (Akuma) (Reaving Gaze)"], "adcdbh": ["Scourge Siphoned Oculus Rays (Double Buffed) (Reaving Gaze)", "Scourge Oculus Beam Array (Cruiser) (Reaving Gaze)", "Scourge Oculus Beam Phalanx (Battleship) (Reaving Gaze)"], "abcdbi": ["Scourge Oculus Beam Crest (Monitor) (Reaving Gaze)"], "aacdbh": ["Scourge Oculus Beams (Destroyer) (Reaving Gaze)", "Scourge Oculus Beams (Cruiser) (Reaving Gaze)"], "accdbi": ["Scourge Oculus Beam Crest (Cruiser) (Reaving Gaze)"], "ahcdbi": ["Scourge Oculus Beam Super Phalanx (Reaving Gaze)"], "adcfca": ["PHR Medium Calibre Broadside (Ship of the Line)"], "agcfca": ["PHR Medium Calibre Double Broadside (Ship of the Line)"], "aacfccCD": ["UCM Artillery Cannon (Typhoon Vasquez)"], "adbgcc": ["Resistance N-12 Artillery Cannon (Typhoon Vasquez)"], "afbgbc": ["Resistance N-8 Artillery Cannon Bank (Typhoon Vasquez)"], "acbfcc": ["Resistance N-11 Artillery Cannon Turret (Typhoon Vasquez)"], "afbgcc": ["Resistance N-11 Twin Artillery Cannon Turrets (Typhoon Vasquez)"], "aebcc": ["Resistance N-12 Artillery Cannon Battery (Typhoon Vasquez)", "Resistance N-12 Artillery Cannon Half Battery (Typhoon Vasquez)"], "ahbcc": ["Palatine N-12 Artillery Cannons (Typhoon Vasquez)"], "acbda3": ["Bioficer Decon Slayer (Kenetic Deconstruction)"], "adbca": ["Bioficer Decon Blast (Kenetic Deconstruction)"], "acbda": ["Bioficer Decon Blaster (Kenetic Deconstruction)"], "agbda": ["Bioficer Decon Cannon (Kenetic Deconstruction)"], "albdah": ["Bioficer Decon Annihilator (Kenetic Deconstruction)"], "aibdai": ["Bioficer Decon Devastator (Kenetic Deconstruction)"]}};
  const target_coded = TABLES.target_coded, target_code_names = TABLES.target_code_names;
  const weapon_coded = TABLES.weapon_coded, weapon_code_names = TABLES.weapon_code_names;

  /* ---- preset value objects (mirror Data_Module classes) ------------------- */
  function PresetTarget(weight, energy_save, kinetic_save, backup_save, shield_save, descent, reinforced, city, station) {
    return {
      weight: weight, ES: energy_save, KS: kinetic_save,
      BS: backup_save === undefined ? 7 : backup_save,
      SS: shield_save === undefined ? 7 : shield_save,
      descent: !!descent, reinforced: !!reinforced, city: !!city, station: !!station
    };
  }
  function PresetWeapon(attack, lock, damage, damage_type, o) {
    o = o || {};
    let cal = o.calibre;
    if (cal == null) cal = [];
    else if (cal === 'L' || cal === 'M' || cal === 'H' || cal === 'C') cal = [cal];
    return {
      attack: attack, lock: lock, damage: damage, damage_type: damage_type,
      burnthrough: o.burnthrough || 0, reave: o.reave || 0, critical: o.critical || 0, scald: o.scald || 0,
      penetrator: !!o.penetrator, crippling: !!o.crippling, caw: !!o.caw, a2a: !!o.a2a,
      bombardment: !!o.bombardment, calibre: cal, escape: !!o.escape, fusillade: o.fusillade || 0,
      mauler: !!o.mauler, overcharge: !!o.overcharge, entry: !!o.entry, sustained: !!o.sustained, bomber: !!o.bomber
    };
  }
  function AttackSituation(o) {
    o = o || {};
    return {
      aegis: o.aegis || 0, fighters: o.fighters || 0, opal: !!o.opal, WF: !!o.WF,
      attacker_atmo: !!o.attacker_atmo, target_atmo: !!o.target_atmo, defences_offline: !!o.defences_offline,
      close: !!o.close, grouped: !!o.grouped, impetuous: !!o.impetuous, shielded: !!o.shielded
    };
  }
  function WeaponSituation(o) {
    o = o || {};
    return {
      telescope: !!o.telescope, calypso: o.calypso || 0, overcharging: !!o.overcharging,
      number: o.number == null ? 1 : o.number, sustaining: !!o.sustaining
    };
  }
  function copyPresetWeapon(w) { return JSON.parse(JSON.stringify(w)); }

  /* ---- create_target / create_weapon (faithful to Data_Module) ------------- */
  // NOTE faithful behaviour: shield_save is passed to the engine Target as 7
  // ALWAYS; shields apply only via the `shielded` toggle, which overwrites the
  // armour saves with the (opal/defences-adjusted) shield value.
  function createTarget(pt, sit) {
    sit = sit || AttackSituation();
    const off = sit.defences_offline ? 1 : 0;
    let es = (pt.ES === 7 || pt.ES === 6) ? pt.ES : pt.ES + off;
    let ks = (pt.KS === 7 || pt.KS === 6) ? pt.KS : pt.KS + off;
    let ss;
    if (pt.SS === 7) ss = 7;
    else { ss = pt.SS - (sit.opal ? 1 : 0); if (ss < 3) ss = 3; ss = ss + off; if (ss > 6) ss = 6; }
    let bs;
    if (pt.BS === 7 && sit.grouped) bs = 6;
    else if (pt.BS === 7 || pt.BS === 6) bs = pt.BS;
    else bs = pt.BS + off;
    if (sit.shielded && pt.SS < 7) { es = ss; ks = ss; }
    return new E.Target(es, ks, bs, 7, sit.aegis || 0, sit.fighters || 0, !!pt.reinforced);
  }

  // returns an array of engine Weapon (length = number, except bomber returns 1)
  function createWeapon(pw, target, sit, wsit, enable_crippling) {
    sit = sit || AttackSituation(); wsit = wsit || WeaponSituation();
    if (enable_crippling === undefined) enable_crippling = true;
    const number = Math.max(1, wsit.number || 1);
    let attack = pw.attack * (1 + (wsit.sustaining ? 1 : 0) * (pw.sustained ? 1 : 0)) + (sit.WF ? 1 : 0) * (pw.fusillade || 0);
    if (pw.bomber) attack *= number;
    const damage = pw.damage * (1 + (wsit.overcharging ? 1 : 0) * (pw.overcharge ? 1 : 0));
    const caw = pw.caw || pw.bomber;
    const skipped_save = pw.bomber ? Math.max(number - 6, 0) : 0;
    let lock;
    if (target.city && !pw.bombardment) lock = 6;
    else if (pw.bombardment && !sit.target_atmo && !target.station && !target.city) lock = 6;
    else if (sit.attacker_atmo && !sit.target_atmo && !pw.escape) lock = 6;
    else if (target.descent && sit.target_atmo && !(pw.bombardment || pw.a2a || pw.escape || pw.entry)) lock = 6;
    else {
      lock = pw.lock;
      if (pw.mauler) { if (pw.damage_type === 'K') lock = target.KS; else if (pw.damage_type === 'E') lock = target.ES; }
      if (pw.bombardment && target.city) lock -= 2;
      if (sit.target_atmo && !(pw.bombardment || pw.a2a || pw.entry)) lock += 1;
      if ((pw.calibre || []).indexOf(target.weight) !== -1 && !(target.city || target.station)) lock -= 1;
      lock += (wsit.calypso || 0);
      if (sit.impetuous) lock -= 1;
      if (lock > 6) lock = 6;
      if (lock < 2) lock = 2;
    }
    let burnthrough, reave, scald, penetrator, damage_type;
    if (sit.shielded && target.SS < 7) { burnthrough = 0; reave = 0; scald = 0; penetrator = false; damage_type = 'E'; }
    else { burnthrough = pw.burnthrough; reave = pw.reave; scald = pw.scald * (sit.close ? 1 : 0); penetrator = pw.penetrator; damage_type = pw.damage_type; }
    const w = new E.Weapon(attack, lock, damage, damage_type, burnthrough, reave, pw.critical, scald, penetrator, pw.crippling && enable_crippling, caw, skipped_save, wsit.telescope);
    if (pw.bomber) return [w];
    const out = []; for (let i = 0; i < number; i++) out.push(w.copy());
    return out;
  }

  /* ---- SaveString codec (faithful base-62) --------------------------------- */
  const code_string = ('abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('');
  const CIDX = {}; code_string.forEach((c, i) => { CIDX[c] = i; });
  const INF = Infinity;
  const inRange = (c, a, b) => { const i = CIDX[c]; return i !== undefined && i >= a && i < b; };

  function importTarget(string) {
    for (const ch of string) if (CIDX[ch] === undefined) return false;
    if (string === '') return false;
    let aegis = 0;
    if (inRange(string[0], 36, 62)) { aegis = CIDX[string[0]] - 35; string = string.slice(1); }
    if (string === '') return false;
    const save_code = CIDX[string[0]];
    if (!(save_code >= 0 && save_code < 36)) return false;
    const ES = 7 - Math.floor(save_code / 6);
    const KS = 7 - (save_code % 6);
    string = string.slice(1);
    let weight = 'M', wf = true, close = true;
    const sit = {}, tgt = {};
    for (const char of string) {
      if (inRange(char, 0, 36)) { if ('fighters' in sit) return false; sit.fighters = CIDX[char] + 1; }
      if (char === 'Z') { if ('fighters' in sit) return false; sit.fighters = INF; }
      if (inRange(char, 36, 41)) { if ('backup_save' in sit) return false; tgt.backup_save = 7 - (CIDX[char] - 35); }
      if (inRange(char, 41, 45)) { if ('shield_save' in sit) return false; tgt.shield_save = 7 - (CIDX[char] - 40); }
      if (char === 'J') { if (weight !== 'M') return false; weight = 'L'; }
      if (char === 'K') { if (weight !== 'M') return false; weight = 'H'; }
      if (char === 'L') { if (weight !== 'M') return false; weight = 'C'; }
      if (char === 'M') { if ('city' in sit || 'station' in sit) return false; tgt.city = true; }
      if (char === 'N') { if ('city' in sit || 'station' in sit) return false; tgt.station = true; }
      if (char === 'O') { if ('attacker_atmo' in sit || 'target_atmo' in sit) return false; sit.attacker_atmo = true; sit.target_atmo = true; }
      if (char === 'P') { if ('attacker_atmo' in sit || 'target_atmo' in sit) return false; sit.target_atmo = true; }
      if (char === 'Q') { if ('attacker_atmo' in sit || 'target_atmo' in sit) return false; sit.attacker_atmo = true; }
      if (char === 'R') tgt.descent = true;
      if (char === 'S') tgt.reinforced = true;
      if (char === 'T') sit.opal = true;
      if (char === 'U') wf = false;
      if (char === 'V') sit.defences_offline = true;
      if (char === 'W') close = false;
      if (char === 'X') sit.grouped = true;
      if (char === 'Y') sit.impetuous = true;
    }
    const situation = AttackSituation(Object.assign({ aegis: aegis, WF: wf, close: close }, sit));
    const target = PresetTarget(weight, ES, KS, tgt.backup_save, tgt.shield_save, tgt.descent, tgt.reinforced, tgt.city, tgt.station);
    return [situation, target];
  }

  function exportTarget(situation, target) {
    let s = '';
    if (situation.aegis === 0) {} else if (situation.aegis > 62) return false; else s += code_string[situation.aegis + 35];
    const save_code = (7 - target.ES) * 6 + (7 - target.KS);
    s += code_string[save_code];
    if (situation.fighters === 0) {} else if (situation.fighters === INF) s += 'Z'; else if (situation.fighters > 36) return false; else s += code_string[situation.fighters - 1];
    if (target.BS === 7) {} else s += code_string[(7 - target.BS) + 35];
    if (target.SS === 7) {} else s += code_string[(7 - target.SS) + 40];
    if (target.city) s += 'M';
    else if (target.station) s += 'N';
    else if (target.weight === 'M') {}
    else if (target.weight === 'L') s += 'J';
    else if (target.weight === 'H') s += 'K';
    else if (target.weight === 'C') s += 'L';
    if (!situation.target_atmo && !situation.attacker_atmo) {}
    else if (situation.target_atmo && situation.attacker_atmo) s += 'O';
    else if (situation.target_atmo && !situation.attacker_atmo) s += 'P';
    else if (!situation.target_atmo && situation.attacker_atmo) s += 'Q';
    if (target.descent) s += 'R';
    if (target.reinforced) s += 'S';
    if (situation.opal) s += 'T';
    if (!situation.WF) s += 'U';
    if (situation.defences_offline) s += 'V';
    if (!situation.close) s += 'W';
    if (situation.grouped) s += 'X';
    if (situation.impetuous) s += 'Y';
    return s;
  }

  function importWeapon(string) {
    for (const ch of string) if (CIDX[ch] === undefined) return false;
    if (string.length < 5) return false;
    const number = CIDX[string[0]] + 1;
    const attacks = CIDX[string[1]] + 1;
    const damage = CIDX[string[2]];
    string = string.slice(3);
    let fusillade = 0;
    if (inRange(string[0], 5, 62)) { fusillade = CIDX[string[0]] - 4; string = string.slice(1); }
    const lock = 7 - (CIDX[string[0]] + 1);
    string = string.slice(1);
    if (string === '') return false;
    if (string[0] === 'd' || string[0] === 'e') return false;
    let critical = 0;
    if (inRange(string[0], 5, 62)) { critical = CIDX[string[0]] - 4; string = string.slice(1); }
    if (string === '') return false;
    let damage_type;
    if (string[0] === 'a') damage_type = 'K';
    else if (string[0] === 'b') damage_type = 'E';
    else if (string[0] === 'c') damage_type = 'C';
    else return false;
    string = string.slice(1);
    const sit = {}, wk = {}, calibre = [];
    for (const char of string) {
      if (inRange(char, 3, 7)) { if ('burnthrough' in wk) return false; wk.burnthrough = CIDX[char] - 2; }
      if (inRange(char, 7, 11)) { if ('reave' in wk) return false; wk.reave = CIDX[char] - 6; }
      if (inRange(char, 11, 15)) { if ('scald' in wk) return false; wk.scald = CIDX[char] - 10; }
      if (char === 'r') wk.penetrator = true;
      if (inRange(char, 18, 22)) { if ('calypso' in sit) return false; sit.calypso = CIDX[char] - 22; }
      if (inRange(char, 22, 26)) { if ('calypso' in sit) return false; sit.calypso = CIDX[char] - 21; }
      if (char === '1') wk.crippling = true;
      if (char === '2') wk.caw = true;
      if (char === '3') wk.a2a = true;
      if (char === '4') wk.bombardment = true;
      if (char === '5') wk.escape = true;
      if (char === '6') wk.entry = true;
      if (char === '7') wk.mauler = true;
      if (char === '8') wk.overcharge = true;
      if (char === '9') wk.sustained = true;
      if (char === '0') wk.bomber = true;
      if (char === 'A') calibre.push('L');
      if (char === 'B') calibre.push('M');
      if (char === 'C') calibre.push('H');
      if (char === 'D') calibre.push('C');
      if (char === 'E') sit.telescope = true;
      if (char === 'F') sit.overcharging = true;
      if (char === 'G') sit.sustaining = true;
    }
    const wsit = WeaponSituation(Object.assign({ number: number }, sit));
    const pw = PresetWeapon(attacks, lock, damage, damage_type, Object.assign({ fusillade: fusillade, critical: critical, calibre: calibre }, wk));
    return [wsit, pw];
  }

  function exportWeapon(situation, weapon) {
    let s = '';
    if (situation.number > 62) return false; else s += code_string[situation.number - 1];
    if (weapon.attack > 62) return false; else s += code_string[weapon.attack - 1];
    if (weapon.damage > 61) return false; else s += code_string[weapon.damage];
    if (weapon.fusillade > 57) return false; else if (weapon.fusillade === 0) {} else s += code_string[weapon.fusillade + 4];
    s += code_string[(7 - weapon.lock) - 1];
    if (weapon.critical > 57) return false; else if (weapon.critical === 0) {} else s += code_string[weapon.critical + 4];
    if (weapon.damage_type === 'K') s += 'a';
    else if (weapon.damage_type === 'E') s += 'b';
    else if (weapon.damage_type === 'C') s += 'c';
    if (weapon.burnthrough === 0) {} else s += code_string[weapon.burnthrough + 2];
    if (weapon.reave === 0) {} else s += code_string[weapon.reave + 6];
    if (weapon.scald === 0) {} else s += code_string[weapon.scald + 10];
    if (weapon.penetrator) s += 'r';
    if (situation.calypso === 0) {} else if (situation.calypso < 0) s += code_string[situation.calypso + 22]; else s += code_string[situation.calypso + 21];
    if (weapon.crippling) s += '1';
    if (weapon.caw) s += '2';
    if (weapon.a2a) s += '3';
    if (weapon.bombardment) s += '4';
    if (weapon.escape) s += '5';
    if (weapon.entry) s += '6';
    if (weapon.mauler) s += '7';
    if (weapon.overcharge) s += '8';
    if (weapon.sustained) s += '9';
    if (weapon.bomber) s += '0';
    if (weapon.calibre.indexOf('L') !== -1) s += 'A';
    if (weapon.calibre.indexOf('M') !== -1) s += 'B';
    if (weapon.calibre.indexOf('H') !== -1) s += 'C';
    if (weapon.calibre.indexOf('C') !== -1) s += 'D';
    if (situation.telescope) s += 'E';
    if (situation.overcharging) s += 'F';
    if (situation.sustaining) s += 'G';
    return s;
  }

  function imports(string) {
    const subs = string.split('-');
    const attack = importTarget(subs[0]);
    const weapons = subs.slice(1).map(importWeapon);
    if (attack === false || weapons.some(w => w === false)) return [false, false];
    return [attack, weapons];
  }
  function exports(attack, weapons) {
    const ts = exportTarget(attack[0], attack[1]);
    const wss = weapons.map(w => exportWeapon(w[0], w[1]));
    if (ts === false || wss.some(x => x === false)) return false;
    return ts + wss.map(x => '-' + x).join('');
  }

  const defaults = {
    attack_situation: () => AttackSituation({ WF: true, close: true }),
    weapon_situation: () => WeaponSituation(),
    target: () => PresetTarget('M', 7, 7),
    weapon: () => PresetWeapon(4, 6, 1, 'E')
  };

  global.DFCData = {
    target_coded, target_code_names, weapon_coded, weapon_code_names,
    PresetTarget, PresetWeapon, AttackSituation, WeaponSituation, copyPresetWeapon,
    createTarget, createWeapon,
    code_string, importTarget, exportTarget, importWeapon, exportWeapon, imports, exports,
    defaults
  };
})(typeof window !== 'undefined' ? window : globalThis);
