/* Score sheets written out by hand for the scenarios whose scoring the automatic reading of the rules text
   (pubScoreRows / vpRows in scenario-lib.js) gets wrong: sides, doubled Standard Scoring, several things of a
   kind, losses. Checked against each scenario's rules on 2026-09-13 (drafts/score-audit). A scenario listed here
   uses exactly these rows; every other scenario is read from its text.

   Rows: {heading, sub} starts a group ("Rounds 4 & 6" marks those rounds on the sheet);
   {text, parts:[{kind:'count'|'check', vp, label}]} is a line with a counter (per thing) or a tick box (once). */
(function(){
  const H=(heading,sub)=>({heading,sub});
  const c=(vp,label)=>({kind:'count',vp,label});
  const k=(vp,label)=>({kind:'check',vp,label});
  const R=(text,...parts)=>({text,parts});
  const R4='Rounds 4 & 6', END='End of game';
  const SIZE={Small:[2,0],Medium:[3,1],Large:[4,2]};
  // Standard (or Normal) Scoring rows for the sizes a scenario actually has, times mult
  const table=(heading,sub,rows,cols=['Control','Contest'],mult=1)=>[H(heading,sub),...rows.map(([text,size])=>{
    const [hi,lo]=SIZE[size]; return R(text,c(hi*mult,cols[0]),...(lo?[c(lo*mult,cols[1])]:[]));
  })];
  const focal=(text,mult=1)=>R(text,c(3*mult,'Highest value'),c(1*mult,'Half that value'));
  const KP=note=>[H('Kill Points',END),R(`For every 500 points of Ships and Admirals destroyed${note?` (${note})`:''}`,c(2))];
  const NORMAL=[['Small Dropsite','Small'],['Medium Dropsite','Medium'],['Large Dropsite','Large']];

  window.SCN_SHEETS={
    /* ── Converted 1e ── */
    'the-ancient-relic':[
      ...table('Standard Scoring',R4,[['Space Station (Medium)','Medium']]),
      H('Scenario'),
      R('Space Station Levelled on your opponent\'s half',c(4)),
      R('Take control of the Automated Dreadnought',k(4))],
    'resistance-spearhead':[
      ...table('Attacker - Red Player',R4,[['Dropsite (every Dropsite scores as Medium)','Medium']]),
      H('Defender - Blue Player',R4),
      R('Dropsite Contested or Controlled (scores as Contest, Medium)',c(1,'Contest')),
      H('Defender - Blue Player'),
      R('Enemy Group destroyed',c(1)),
      R('Dropsite Ruined',c(-1)),
      R('Dropsite Levelled (a further loss after Ruined)',c(-3))],
    'heavy-convoy':[
      H('Defender - Blue Player'),
      R('Dreadnought touches the red table edge',c(3)),
      R('Dreadnought still on the table at the end of the game',c(1)),
      H('Attacker - Red Player'),
      R('Dreadnought destroyed',c(3)),
      H('Both players'),
      R('Other Group destroyed',c(1))],
    'monitoring-the-situation':[
      ...table('Attacker - Blue Player',R4,[['Dropsite (Medium)','Medium']]),
      H('Attacker - Blue Player'),
      R('Group of Monitors destroyed',c(1)),
      H('Defender - Red Player',R4),
      R('Dropsite the attacker does not Control',c(3)),
      H('Defender - Red Player',END),
      R('Group of Monitors that survives the game',c(1))],
    'core-take-and-hold':[
      ...table('Standard Scoring',R4,[['Medium City','Medium'],['Large City','Large']]),
      H('Focal Points',R4), focal('Dropsite, within 6"'),
      ...table('Variant: Double Down',R4,[['Large City either side of the centre City','Large']],['Control','Contest'],2),
      focal('Focal Point on one of those Large Cities',2)],
    'core-mixed-engagement':[
      ...table('Standard Scoring (Cities only)',R4,[['Large City','Large']]),
      H('Focal Points',R4), focal('City or Space Station, within 6"'),
      H('Variant: Valuable Supplies',R4), focal('Focal Point on a City',2)],
    'core-erupting-battlefront':[
      ...table('Red Player',R4,[['A City (Medium)','Medium'],['C City (Large)','Large'],['Space Station (Medium)','Medium']]),
      focal('Focal Point: a B City, the C City or a Space Station'),
      ...table('Red Player: Demolish',END,[['B City (Medium)','Medium']],['Levelled','Ruined']),
      ...table('Blue Player',R4,[['B City (Medium)','Medium'],['C City (Large)','Large'],['Space Station (Medium)','Medium']]),
      focal('Focal Point: an A City, the C City or a Space Station'),
      ...table('Blue Player: Demolish',END,[['A City (Medium)','Medium']],['Levelled','Ruined'])],
    'core-grid-control':[
      ...table('Standard Scoring',R4,[['Small City','Small'],['Large City, or Large Space Station in the Variant','Large']]),
      ...table('Medium Cities: double',R4,[['Medium City, or Medium Space Station in the Variant','Medium']],['Control','Contest'],2),
      H('Focal Points',R4),
      focal('Small or Large Dropsite, within 6"'),
      focal('Medium Dropsite, within 6" (double)',2)],
    'core-power-grab':[
      ...table('Standard Scoring',R4,[['Medium City','Medium']]),
      ...table('Large Cities: double',R4,[['Large City, only while none of its Power Plants is destroyed','Large']],['Control','Contest'],2),
      H('Focal Points',R4), focal('Dropsite, within 6"')],
    'core-defence-relay':[
      ...table('Standard Scoring',R4,[['Small City','Small'],['Space Station (Medium)','Medium'],['Large City','Large']]),
      H('Focal Points',R4), focal('Dropsite, within 6"'),
      H('Scenario'),
      R('Comms Station destroyed, or the Dropsite holding one',c(-4)),
      H('Scenario',END),
      R('Dropsite with a Comms Station you Control',c(5))],

    /* ── Civilian Ship Scenarios ── */
    'make-the-rendezvous':[
      H('Defender - Blue Player'),
      R('Crew Token placed on a Space Station',c(2)),
      H('Defender - Blue Player',END),
      R('Space Station you Control',c(1)),
      R('Civilian Ship not destroyed',k(2)),
      H('Attacker - Red Player',END),
      R('Space Station destroyed',c(2)),
      R('Space Station you Control',c(3)),
      H('Attacker - Red Player'),
      R('Civilian Ship destroyed',k(2))],
    'mass-exodus':[
      H('Attacker - Red Player'),
      R('Civilian Ship destroyed',c(2)),
      H('Attacker - Red Player',END),
      R('Civilian Ship',c(3,'Control'),c(1,'Contest')),
      H('Defender - Blue Player',END),
      R('Civilian Ship Controlled or Contested in the Exfiltration Zone',c(3)),
      R('Civilian Ship outside the Exfiltration Zone',c(2,'Control'),c(1,'Contest'))],
    'shipyard-raid':[
      ...table('Standard Scoring',R4,NORMAL),
      H('Scenario'),
      R('Controlled Civilian Ship removed within 4" of your deployment zone',c(2)),
      R('Civilian Ship destroyed',c(1))],
    'supply-run':[
      ...table('Standard Scoring',R4,NORMAL),
      H('Defender - Blue Player',END),
      R('Space Station affected by Rearm and Resupply',c(3,'Medium'),c(2,'Small')),
      H('Attacker - Red Player'),
      R('Supply Hauler removed from the game',k(3))],
    'scrap-collection':[
      H('Defender - Blue Player',END),
      R('Scrap token on a friendly Harvester or Flenser still alive',c(1)),
      H('Attacker - Red Player'),
      R('VX-22 Flenser destroyed',c(3)),
      R('Type-87 Terminus Harvester destroyed',k(6))],
    'stop-the-terraformer':[
      ...table('Normal Scoring',R4,NORMAL),
      ...KP('the Provenance Ark counts double')],
    'hatching-grounds':[
      ...KP('enemy Ships destroyed by Fauna count double'),
      H('Focal Points',R4), focal('Large Object, within 6" of its edge')],
    'a-rocky-runaround':[
      H('Assess'), R('Fauna Assessed (once per player per Fauna)',c(1)),
      H('Focal Points',R4), focal('Destroyed Fauna, within 6"'),
      ...KP()],

    /* ── Scenario Expansion 1 ── */
    'moonbreaker':[
      ...table('Normal Scoring',R4,NORMAL),
      H('Scenario',END),
      // "scores Normal Scoring ... if they control the majority": once, a Small City's High Scoring (2VP)
      R('Control the majority of the Large Object Dropsites',k(2)),
      H('Red Player: Demolish'),
      R('Large Object Dropsite (Small City)',c(2,'Levelled'))],
    'when-backfields-meet':[
      ...table('Normal Scoring',R4,NORMAL),
      H('Assess'),
      R('Dropsite Assessed',c(2,'Your colour'),c(1,'Other')),
      ...table('Demolish (your colour\'s Dropsites)','',NORMAL,['Levelled','Ruined'])],
    'moonguard':[
      ...table('Normal Scoring',R4,NORMAL),
      H('Extra Secondary Objective',END),
      R('Annihilate: every 500 points of Ships and Admirals destroyed (max 3VP)',c(1)),
      R('Take Prizes: every 100 points of Ships captured (max 3VP)',c(1)),
      R('Decapitate: an enemy highest-Level Admiral killed',c(2))],
    'ready-salted-earth':[
      ...table('Demolish Scoring','',NORMAL,['Levelled','Ruined']),
      H('Focal Points',R4),
      focal('Space Station, within 8"'),
      focal('Debris Field from a destroyed Space Station, Ships in it')],
    'latitudinal-lanes':[
      H('Assess'), R('Dropsite Assessed (the three closest to your opponent\'s deployment zone)',c(1)),
      H('Focal Points',R4), focal('Dropsite, within 6"')],
  };
})();
