// Adds the Resistance Systems/Hardpoint option tables (Cruiser / Frigate /
// Dreadnought) to faction-resistance.json under `systemsLists`. Transcribed
// from Resistance_Combined_Fleet_Stats (Cruiser & Frigate p.6, Dreadnought p.40).
// Run from repo root:  node scripts/add-systems-data.js
const fs = require('fs');

const W = (name, arc, attack, lock, damage, type, special) =>
  ({ name, arc, attack, lock, damage, type, special });
const L = (name, launch, special) => ({ name, launch, special });

const systemsLists = {
  'Cruiser Systems': {
    categories: ['Turret Hardpoint', 'Broadside Hardpoint (Weapons)', 'Broadside Hardpoint (Launch)', 'Structures'],
    options: [
      { name: 'XN-31 Mass Driver Turret', category: 'Turret Hardpoint', cost: 6, oncePerShip: false, weapons: [W('XN-31 Mass Driver Turret', 'F/S', '2', '2+', '1', 'K', 'Critical-1')], loads: [], effect: '' },
      { name: 'N-11 Artillery Cannon Turret', category: 'Turret Hardpoint', cost: 5, oncePerShip: false, weapons: [W('N-11 Artillery Cannon Turret', 'F/S', '3', '4+', '1', 'K', 'Fusillade-1, Low Power')], loads: [], effect: '' },
      { name: 'N-109 Bombardment Mortar Turret', category: 'Turret Hardpoint', cost: 13, oncePerShip: false, weapons: [W('N-109 Bombardment Mortar Turret', 'F/S/R', '3', '4+', '1', 'K', 'Bombardment, Scald-1')], loads: [], effect: '' },
      { name: 'Vent Cannon Turret', category: 'Turret Hardpoint', cost: 10, oncePerShip: false, weapons: [W('Vent Cannon Turret', 'F/S', '3', '3+', '1', 'E', 'Overcharge, Reave-1')], loads: [], effect: '' },
      { name: 'N-31 Hybrid Gun Bank', category: 'Broadside Hardpoint (Weapons)', cost: 10, oncePerShip: false, weapons: [W('N-31 Hybrid Gun Bank', 'B', '3', '4+', '1', 'K', 'Volley-2')], loads: [], effect: '' },
      { name: 'N-8 Artillery Cannon Bank', category: 'Broadside Hardpoint (Weapons)', cost: 8, oncePerShip: false, weapons: [W('N-8 Artillery Cannon Bank', 'B', '6', '5+', '1', 'K', 'Fusillade-2, Low Power, Volley-2')], loads: [], effect: '' },
      { name: 'NC-16 Missile Bank', category: 'Broadside Hardpoint (Weapons)', cost: 5, oncePerShip: false, weapons: [W('NC-16 Missile Bank', 'B', '6', '3+', '1', 'K', 'Close Action, Volley-2')], loads: [], effect: '' },
      { name: 'Fighters & Bombers', category: 'Broadside Hardpoint (Launch)', cost: 30, oncePerShip: false, weapons: [], loads: [L('Fighters & Bombers', '2', '')], effect: 'Mines and Fighters & Bombers use the same broadside component.' },
      { name: 'Mines', category: 'Broadside Hardpoint (Launch)', cost: 35, oncePerShip: false, weapons: [], loads: [L('Mines', '2', '')], effect: 'Mines and Fighters & Bombers use the same broadside component.' },
      { name: 'Bulk Landers & Fire Ships', category: 'Broadside Hardpoint (Launch)', cost: 18, oncePerShip: false, weapons: [], loads: [L('Bulk Landers & Fire Ships', '2', '')], effect: '' },
      { name: 'Scanner Array', category: 'Structures', cost: 5, oncePerShip: true, weapons: [], loads: [], effect: 'Scan +4"' },
      { name: 'Ablative Armour', category: 'Structures', cost: 12, oncePerShip: true, weapons: [], loads: [], effect: 'Gain Reinforced Armour; Kinetic & Energy save +1' },
      { name: 'Drive Refit', category: 'Structures', cost: 15, oncePerShip: true, weapons: [], loads: [], effect: 'Thrust +3"' }
    ]
  },
  'Frigate Systems': {
    categories: ['Weapons', 'Structures'],
    options: [
      { name: 'N-31 Hybrid Gun Turret', category: 'Weapons', cost: 5, oncePerShip: false, weapons: [W('N-31 Hybrid Gun Turret', 'F/S', '2', '3+', '1', 'K', 'Fusillade-1')], loads: [], effect: '' },
      { name: 'NC-16 Missile Turret', category: 'Weapons', cost: 5, oncePerShip: false, weapons: [W('NC-16 Missile Turret', 'F/S/R', '6', '3+', '1', 'K', 'Close Action')], loads: [], effect: '' },
      { name: 'Light Vent Cannon Turret', category: 'Weapons', cost: 5, oncePerShip: false, weapons: [W('Light Vent Cannon Turret', 'F/S', '2', '4+', '1', 'E', 'Overcharge, Reave-1')], loads: [], effect: '' },
      { name: 'Sensor Dome', category: 'Structures', cost: 10, oncePerShip: true, weapons: [], loads: [], effect: 'Gain Detector (counts as +1 weapon for Detector)' }
    ]
  },
  'Dreadnought Systems': {
    categories: ['Turret Hardpoint', 'Broadside Hardpoint', 'Launch Hardpoint', 'Structures'],
    options: [
      { name: '10K Mass Driver Turret', category: 'Turret Hardpoint', cost: 25, oncePerShip: false, weapons: [W('10K Mass Driver Turret', 'F/S', '2', '3+', '2', 'K', 'Calibre-H/C, Critical-2, Penetrator, Volley-2')], loads: [], effect: '' },
      { name: 'Heavy Dual Vent Cannon Turret', category: 'Turret Hardpoint', cost: 40, oncePerShip: false, weapons: [W('Heavy Dual Vent Cannon Turret', 'F/S', '4', '3+', '2', 'E', 'Fusillade-2, Overcharge, Reave-1')], loads: [], effect: '' },
      { name: 'N-31 Hybrid Gun Battery', category: 'Broadside Hardpoint', cost: 20, oncePerShip: false, weapons: [W('N-31 Hybrid Gun Battery', 'B', '8', '4+', '1', 'K', 'Volley-2')], loads: [], effect: '' },
      { name: 'NC-16 Missile Battery', category: 'Broadside Hardpoint', cost: 35, oncePerShip: false, weapons: [W('NC-16 Missile Battery', 'B', '6', '3+', '2', 'K', 'Close Action, Volley-2')], loads: [], effect: '' },
      { name: 'Fighters & Bombers', category: 'Launch Hardpoint', cost: 40, oncePerShip: false, weapons: [], loads: [L('Fighters & Bombers', '2', '')], effect: '' },
      { name: 'Bulk Landers & Fire Ships', category: 'Launch Hardpoint', cost: 25, oncePerShip: false, weapons: [], loads: [L('Bulk Landers & Fire Ships', '2', '')], effect: '' },
      { name: 'Torpedo', category: 'Launch Hardpoint', cost: 25, oncePerShip: false, weapons: [], loads: [L('Torpedo', '1', 'Limited-2')], effect: '' },
      { name: 'Scanner Array', category: 'Structures', cost: 10, oncePerShip: true, weapons: [], loads: [], effect: 'Scan +4"' },
      { name: 'Drive Refit', category: 'Structures', cost: 25, oncePerShip: true, weapons: [], loads: [], effect: 'Thrust +3"' }
    ]
  }
};

const path = 'data/faction-resistance.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data.systemsLists = systemsLists;
fs.writeFileSync(path, JSON.stringify(data));
const counts = Object.entries(systemsLists).map(([k, v]) => `${k}: ${v.options.length}`).join(', ');
console.log(`Resistance systemsLists added — ${counts}`);
