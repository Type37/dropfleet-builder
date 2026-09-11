// Dropfleet Commander scenarios, shared by the references page and the generator.
// Verbatim rules tables, Feature and dropsite icons, the published scenarios,
// and renderScenario(), which lays one out with its map and every term explained.
// Needs scenario-terms.js loaded first. A page that shows a Fauna button defines pubOpen(id).

const SCN_ASSETS=new URL('../../assets/',document.currentScript.src).href;

const G={
  gold:'#B8952F',
  // The fleet builder's stat symbols (js/app.js STAT_ICONS), so a stat looks the same everywhere
  iScan:'<svg class="ico-stat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3,12 A9,9 0 0,1 21,12"/><path d="M7,12 A5,5 0 0,1 17,12"/><circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none"/></svg>',
  iSig:'<svg class="ico-stat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="11"/></svg>',
  iThrust:'<svg class="ico-stat" viewBox="0 0 24 24"><polygon fill="currentColor" points="4,4 20,12 4,20 8,12"/></svg>',
  iHull:'<svg class="ico-stat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>',
  iES:'<svg class="ico-stat" viewBox="0 0 16 22"><rect fill="#FAECC8" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M8,0.5 C8,0.5 0.5,3.5 0.5,3.5L0.5,10.5 C0.5,16 8,21.5 8,21.5 C8,21.5 15.5,16 15.5,10.5L15.5,3.5Z" fill="#1C1A17"/><path d="M8.5,4.5 L5,11 L7.5,11 L6,18.5 L12,9.5 L9,9.5 L11,4.5Z" fill="#FAECC8"/></svg>',
  iKS:'<svg class="ico-stat" viewBox="0 0 16 22"><rect fill="#D0E4FF" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M5.5,0 L10.5,0 L10.5,3 L5.5,3Z" fill="#1C1A17"/><path d="M3,3 C1,5 0,8 0,11L0,15 L3,15 L3,18 C3,20 5.5,21.5 8,21.5 C10.5,21.5 13,20 13,18L13,15 L16,15 L16,11 C16,8 15,5 13,3Z" fill="#1C1A17"/><rect fill="#D0E4FF" height="2" rx="0.5" width="7" x="4.5" y="10"/><rect fill="#D0E4FF" height="7" rx="0.5" width="2" x="7" y="10"/></svg>',
  iBS:'<svg class="ico-stat" viewBox="0 0 16 22"><rect fill="#E8E5DF" height="24" rx="2.5" width="18" x="-1" y="-1"/><path d="M8,1 C8,1 1,4 1,4L1,11 C1,16.5 8,21 8,21 C8,21 15,16.5 15,11L15,4Z" fill="none" stroke="#1C1A17" stroke-width="1.5"/><line stroke="#1C1A17" stroke-linecap="round" stroke-width="1.2" x1="4" x2="12" y1="11" y2="11"/></svg>',
  iG:'<svg class="ico-stat" viewBox="0 0 256 256" fill="currentColor"><path d="M172,76a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,76Zm-44,28a28,28,0,1,1,28-28A28,28,0,0,1,128,104Zm60,24a44,44,0,1,0,44,44A44.05,44.05,0,0,0,188,128Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,188,200ZM68,128a44,44,0,1,0,44,44A44.05,44.05,0,0,0,68,128Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,68,200Z"/></svg>',
};

// DStat line helper
// Stat names as the builder labels them (js/app.js STAT_META)
const STAT_META={
  scan:{label:'Scan',title:'Scan range, detection distance',icon:'iScan'},
  sig:{label:'Sig',title:'Signature, how visible the ship is',icon:'iSig'},
  thrust:{label:'Thrust',title:'Thrust, movement speed',icon:'iThrust'},
  hull:{label:'Hull',title:'Hull points, structural integrity',icon:'iHull'},
  es:{label:'ES',title:'Energy Shield, save vs Energy weapons',icon:'iES'},
  ks:{label:'KS',title:'Kinetic Shield, save vs Kinetic weapons',icon:'iKS'},
  bs:{label:'BS',title:'Backup Save, last-resort save',icon:'iBS'},
  g:{label:'G',title:'Group size, ships per battle group',icon:'iG'},
};
// A symbol you can hover, tap or focus to see what it is
const tipped=(key,inner)=>`<span class="tip-t" tabindex="0" data-tip="${key}">${inner}</span>`;
const statIcon=k=>tipped('stat:'+k,G[STAT_META[k].icon]);
// DStat line helper
function dss(sc,sg,h,es,ks){return `<span class="ds-st">${statIcon('scan')}${sc}&nbsp;${statIcon('sig')}${sg}&nbsp;${statIcon('hull')}${h}&nbsp;${statIcon('es')}<span class="sv-e">${es}</span>&nbsp;${statIcon('ks')}<span class="sv-k">${ks}</span></span>`;}

// Inline SVGs for feature icons
const FI={
  out:'<svg class="ico-feat" viewBox="0 0 64 64" role="img" aria-label="Military Outpost"><clipPath id="tk-out"><circle cx="31.69" cy="32.02" r="29.36"/></clipPath><g clip-path="url(#tk-out)"><path fill="#f15a29" d="M61.06 32.02C61.06 48.24 47.91 61.38 31.69 61.38C15.48 61.38 2.33 48.24 2.33 32.02C2.33 15.8 15.48 2.65 31.69 2.65C47.91 2.65 61.06 15.8 61.06 32.02"/><path fill="#030505" stroke="#030405" stroke-width="0.25" d="M27.51 19.09L27.51 22.91L29.24 22.91L29.24 23.77L34.49 23.77L35.26 26.91L39.16 26.91L41.05 35.04L56.28 35.04L61.62 52.6L47.99 62.41L20.2 63.05L7.52 52.6L9.97 32.68L13.74 32.68L14.64 27.81L18.15 27.81L18.81 24.17L24.61 24.17L24.61 22.91L26.25 22.91L26.25 10.88L27.51 10.88L27.51 12.31C27.51 12.31 27.96 11.79 28.88 12.36C29.8 12.92 30.79 13.3 31.75 13.14C32.72 12.98 33.65 12.42 34.67 12.6C35.68 12.78 36.49 12.87 36.92 12.76C37.34 12.65 37.46 12.49 37.46 12.49L37.46 19.05C37.46 19.05 36.51 18.49 35.39 18.85C34.27 19.21 32.6 19.54 31.55 19.21C30.49 18.87 28.97 18.66 28.25 18.76C27.77 18.83 27.51 19.09 27.51 19.09"/><path fill="#f15a29" d="M11.59 35.51L14.68 35.51L14.46 37.26L11.37 37.26L11.59 35.51"/><path fill="none" stroke="#030405" stroke-width="0.25" d="M11.59 35.51L11.37 37.26L14.46 37.26L14.68 35.51Z"/><path fill="#f15a29" d="M44.57 37.8L54.59 37.8L55.12 39.55L44.98 39.55L44.57 37.8"/><path fill="none" stroke="#030405" stroke-width="0.25" d="M44.57 37.8L44.98 39.55L55.12 39.55L54.59 37.8Z"/><path fill="#f15a29" d="M18.97 30.93L36.44 30.93L36.85 32.68L18.75 32.68L18.97 30.93"/><path fill="none" stroke="#030405" stroke-width="0.25" d="M18.97 30.93L18.75 32.68L36.85 32.68L36.44 30.93Z"/><path fill="#f15a29" d="M31.69 58.97L20.9 48.17L31.69 37.38L42.49 48.17L31.69 58.97"/><path fill="none" stroke="#231f20" stroke-width="0.93" d="M31.69 58.97L42.49 48.17L31.69 37.38L20.9 48.17Z"/></g></svg>',
  odg:'<svg class="ico-feat" viewBox="0 0 64 64" role="img" aria-label="Orbital Defence Gun"><clipPath id="tk-odg"><circle cx="31.88" cy="32.02" r="29.36"/></clipPath><g clip-path="url(#tk-odg)"><path fill="#39b878" d="M61.24 32.02C61.24 48.24 48.09 61.38 31.88 61.38C15.66 61.38 2.51 48.24 2.51 32.02C2.51 15.8 15.66 2.65 31.88 2.65C48.09 2.65 61.24 15.8 61.24 32.02"/><path fill="#030505" stroke="#231f20" stroke-width="0.25" d="M7.34 47.99L8.92 47.99L8.92 44.68L11.62 44.68L11.62 47.99L12.85 47.99L15.6 41.41L18.36 41.1L18.36 39.37L23.1 39.37L23.1 40.29L29.17 39.37L29.17 37.58L32.13 37.58L32.13 38.86L33.82 38.55L33.82 35.54L52.85 35.54L52.85 38.09L54.07 38.09L55.5 39.52L57.03 39.52L57.03 41.36L59.63 43.96L53.92 57.33C53.92 57.33 40.19 64.17 39.27 64.27C38.36 64.37 26.77 65.44 26.77 65.44L15.65 61.36C15.65 61.36 6.52 51.41 6.52 51.26C6.52 51.1 7.34 47.99 7.34 47.99"/><path fill="#030505" stroke="#231f20" stroke-width="0.25" d="M35.6 34.27L51.21 34.27L51.21 32.43L49.99 32.43L49.99 27.84L49.8 27.65L49.8 21.54L49.15 21.54L49.15 26.59L47.16 23.78L47.16 12.2L46.7 12.2L46.7 23.5L45.7 22.84L45.7 16.92L44.96 16.92L44.96 22.43L43.99 21.95L35.6 34.27"/><path fill="#030505" stroke="#231f20" stroke-width="0.25" d="M35.09 32.53L41.78 22.33L38.66 20.72L36.29 21.33L35.73 20.93L35.4 20.93L30.01 17.15L29.16 17.3L28.36 17.93L19.5 11.57L16.01 16.23L21.24 19.93L21.14 21.41L27.8 26L27.74 26.77L27.97 26.95L27.95 27.97L35.09 32.53"/><path fill="#39b878" d="M9.49 45.43H11.07V46.31H9.49Z"/><path fill="#39b878" d="M19.04 40.17H22.41V41.11H19.04Z"/><path fill="#39b878" d="M18.5 16.07L19.25 16.64L21.04 14.28L20.29 13.72L18.5 16.07"/><path fill="#39b878" d="M20.17 17.24L20.92 17.79L22.68 15.41L21.92 14.86L20.17 17.24"/><path fill="#39b878" d="M36.81 38.35L50.76 38.32L50.76 39.22L36.81 39.22L36.81 38.35"/><path fill="#39b54a" d="M25.35 42.82H38.4V55.87H25.35Z"/><path fill="none" stroke="#231f20" stroke-width="0.65" d="M25.35 42.82H38.4V55.87H25.35Z"/></g></svg>',
  com:'<svg class="ico-feat" viewBox="0 0 64 64" role="img" aria-label="Comms Station"><clipPath id="tk-com"><circle cx="32.06" cy="32.02" r="29.39"/></clipPath><g clip-path="url(#tk-com)"><path fill="#de2429" d="M61.45 32.02C61.45 48.25 48.29 61.41 32.06 61.41C15.82 61.41 2.66 48.25 2.66 32.02C2.66 15.78 15.82 2.62 32.06 2.62C48.29 2.62 61.45 15.78 61.45 32.02"/><path fill="#231f20" d="M46.71 32.38C51.46 37.26 53.61 40.4 53.98 42.59C49.13 42.74 44.73 40.41 41.81 38.01L41.05 38.5L41.05 38.86L41.76 38.86L40.58 43L40.84 43.67L43.34 43.67L44.1 42.91L47.23 42.91L50.12 45.79L53.17 45.79L55.95 48.58L55.95 60.4L32.06 62.13L5.56 60.4L5.56 47.41L8.36 47.47L8.36 43.78L15.74 37.14L15.74 36.25L15.03 36.25L14.52 35.73L15.87 34.38C15.87 34.38 15.94 33.95 15.87 33.95C15.8 33.95 15.67 34.16 15.67 33.95C15.67 33.74 15.81 32.69 15.81 32.69L16.7 32.77L16.7 32.59L17.04 32.59L17.04 32.35L17.93 32.36L18.62 31.67C16.42 28.49 11.59 21.33 12.47 15.17C16.14 16.03 21.28 20.53 25.42 24.76L31.89 17.98L30.76 16.81L34.29 13.96L36.14 15.61L33.47 19.49L32.26 18.35L25.87 25.2C28.81 28.25 31.28 31.19 32.34 32.58C34.03 35.07 34.91 36.04 35.33 38.35C28.94 39.49 21.29 33.71 21.29 33.71L19.33 32.18L18.51 33L18.42 33.53L19.55 33.54L19.06 35.91L20.27 36.59L21.92 36.59L27.09 41.75L32.48 41.75L34.39 43.67L38.99 43.67L38.99 41.06L37.98 40.39L39.11 39.34L39.05 38.68L41.31 37.41C41.31 37.41 36.18 31.86 36.18 24.72C37.13 24.55 41.61 27.25 45.44 31.1C45.77 31.42 46.08 31.74 46.39 32.05L51.3 26.94L50.4 25.87L53.08 23.8L54.54 25.05L52.33 27.85L51.57 27.19L46.71 32.38"/><path fill="#231f20" d="M33.01 17.76L34.84 36.67L34.71 37.18L35.33 38.35L33.64 17.76L31.55 16.42L12.8 15.26L13.8 15.61L31.14 16.88L33.01 17.76"/><path fill="#231f20" d="M36.83 24.96L50.81 25.99L52.2 26.64L53.56 40.63L53.51 41.42L53.97 42.55L52.67 26.64L51.12 25.65L36.18 24.72L36.83 24.96"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M15.43 37.87C15.43 37.87 13.61 36.18 13.5 35.66C13.38 35.14 13.12 34.2 14.02 33.14C14.92 32.08 15.43 31.24 15.94 31.18C16.44 31.11 16.8 31.38 17.03 31.73C17.25 32.08 17.42 33.12 17.42 33.12"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M19.9 36.92C19.9 36.92 20.51 36.44 20.7 35.71C20.9 34.99 21.07 34.56 21.13 33.93C21.2 33.3 21.13 32.03 21.13 32.03"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M27.7 28.18C27.7 28.18 28.64 27.45 28.8 26.64C28.97 25.83 28.82 24.6 28.52 22.83C28.22 21.07 28.49 20.29 29.01 20.11C29.54 19.93 33.5 19.86 34.72 19.7C35.94 19.53 37 19.39 37.56 18.53C38.12 17.67 38.02 16.95 37.46 16.14C36.9 15.33 34.85 15.76 34.85 15.76"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M39.34 42.55C39.34 42.55 37.59 41.3 37.34 40.79C37.1 40.28 36.85 39.6 37.62 38.58C38.4 37.56 38.99 36.67 39.49 37.08C39.98 37.49 40.51 38.45 40.51 38.45"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M40.82 40.88C40.87 40.88 41.78 41.22 42.16 41.01C42.54 40.79 42.92 40.73 43.02 39.84C43.11 38.95 43.13 37.33 43.13 37.33"/><path fill="none" stroke="#231f20" stroke-width="0.5" d="M48.16 34.74C48.21 34.74 48.99 33.95 48.99 32.6C48.99 31.24 48.29 30.04 48.66 29.17C49.02 28.29 49.65 28.36 51.15 28.34C52.65 28.33 53.9 28.49 54.97 27.75C56.04 27.01 56.03 26.4 55.83 25.87C55.63 25.34 54.38 24.94 53.64 24.89"/><path fill="#be1e2d" d="M32.06 57.05C29.4 57.05 27.25 54.89 27.25 52.24C27.25 49.58 29.4 47.43 32.06 47.43C34.71 47.43 36.87 49.58 36.87 52.24C36.87 54.89 34.71 57.05 32.06 57.05M32.06 45.1C28.12 45.1 24.92 48.3 24.92 52.24C24.92 56.18 28.12 59.38 32.06 59.38C36 59.38 39.2 56.18 39.2 52.24C39.2 48.3 36 45.1 32.06 45.1"/><path fill="none" stroke="#231f20" stroke-width="0.62" d="M39.2 52.24C39.2 56.18 36 59.38 32.06 59.38C28.12 59.38 24.92 56.18 24.92 52.24C24.92 48.3 28.12 45.1 32.06 45.1C36 45.1 39.2 48.3 39.2 52.24"/><path fill="none" stroke="#231f20" stroke-width="0.62" d="M36.87 52.24C36.87 54.89 34.71 57.05 32.06 57.05C29.4 57.05 27.25 54.89 27.25 52.24C27.25 49.58 29.4 47.43 32.06 47.43C34.71 47.43 36.87 49.58 36.87 52.24"/></g></svg>',
  pow:'<svg class="ico-feat" viewBox="0 0 64 64" role="img" aria-label="Power Plant"><clipPath id="tk-pow"><circle cx="32.24" cy="32.06" r="29.33"/></clipPath><g clip-path="url(#tk-pow)"><path fill="#ffde18" d="M61.58 32.06C61.58 48.26 48.44 61.4 32.24 61.4C16.04 61.4 2.91 48.26 2.91 32.06C2.91 15.86 16.04 2.73 32.24 2.73C48.44 2.73 61.58 15.86 61.58 32.06"/><path fill="#030505" stroke="#030505" stroke-width="0.25" d="M6.34 44.17L8.38 44.17L8.38 39.93L10.72 39.93L10.72 34.93L13.15 34.93L13.15 21.2L14.09 21.2L14.09 34.93L14.99 34.93L14.99 40.97C14.99 40.97 19.6 26.55 17.49 11.96L34.18 11.96C32.07 26.55 36.68 40.97 36.68 40.97L37.49 42.67C37.49 42.67 40.08 32.59 38.36 24.61L50.5 24.61C48.78 32.59 51.1 40.63 51.1 40.63L52.23 40.63L52.23 28.32L52.98 28.32L52.98 40.63L53.96 40.63L53.96 32.53L54.8 32.53L54.8 40.62L55.89 40.62L55.89 36.36L57.3 36.36L57.3 30.71L58.33 30.71L58.33 36.34L60.52 36.34L62.49 38.7L59.95 41.84L58.89 52.05L42.06 62.07L27.24 62.87L17.63 60.47L1.6 47.65L6.34 44.17"/><path fill="#ffde18" d="M11.6 36.29H14.1V37.08H11.6Z"/><path fill="none" stroke="#030505" stroke-width="0.25" d="M11.6 36.29H14.1V37.08H11.6Z"/><path fill="#fbb040" stroke="#231f20" stroke-width="0.76" d="M33.25 43.18L26.94 42.55L27.77 37.86C27.91 36.95 26.8 36.39 26.15 37.04L17.04 46.15C16.44 46.75 16.87 47.78 17.72 47.78L24.03 48.41L23.2 53.1C23.06 54.01 24.16 54.57 24.82 53.92L33.92 44.81C34.52 44.21 34.1 43.18 33.25 43.18"/></g></svg>',
  han:'<svg class="ico-feat" viewBox="0 0 64 64" role="img" aria-label="Hangar"><clipPath id="tk-han"><circle cx="32.2" cy="32.02" r="29.36"/></clipPath><g clip-path="url(#tk-han)"><path fill="#808285" d="M61.56 32.02C61.56 48.24 48.42 61.38 32.2 61.38C15.98 61.38 2.84 48.24 2.84 32.02C2.84 15.8 15.98 2.65 32.2 2.65C48.42 2.65 61.56 15.8 61.56 32.02"/><path fill="#231f20" d="M32.2 61.38C42.84 61.38 52.17 55.72 57.32 47.24L7.08 47.24C12.23 55.72 21.55 61.38 32.2 61.38"/><path fill="#231f20" d="M40.54 17.66L38.46 17.98L38.5 18.47C44.67 23.08 50.06 28.06 50.09 33.35C50.05 37.31 43.93 41.52 38.03 42.91L18.42 45.79L38.87 45.79C52.98 45.79 56.87 38.52 56.92 33.02C56.92 27.34 50.85 21.58 40.54 17.66"/><path fill="#231f20" d="M29.75 20.23L27.74 20.53L27.78 21.03C33.97 25.65 39.4 30.65 39.43 35.96C39.41 38.01 37.77 40.11 35.38 41.86L37.77 41.51C40.99 40.74 44.06 39.16 46.11 37.4C46.21 36.8 46.26 36.2 46.26 35.63C46.26 29.93 40.15 24.15 29.75 20.23"/><path fill="#231f20" d="M32.68 16.45L28.66 15.14L29 14.1L33.02 15.4L32.68 16.45M40.61 17.63L40.98 16.44L40.09 16.15L39.93 13.46L33.46 14.51C33.46 14.51 31.07 13.74 29.51 13.23C28.97 13.06 27.77 13.69 27.6 14.17C27.42 14.67 28.01 16.01 28.56 16.19C30.11 16.7 32.5 17.47 32.5 17.47L37.13 22.12L38.83 20.04L39.73 20.32L40.12 19.14L41.18 19.5L41.68 17.96L40.61 17.63"/><path fill="#231f20" d="M21.84 19.01L17.82 17.71L18.16 16.66L22.18 17.97L21.84 19.01M29.77 20.19L30.14 19.01L29.25 18.71L29.09 16.03L22.62 17.08C22.62 17.08 20.23 16.3 18.67 15.8C18.13 15.62 16.93 16.25 16.76 16.73C16.58 17.24 17.17 18.58 17.72 18.76C19.27 19.26 21.66 20.04 21.66 20.04L26.29 24.69L27.99 22.6L28.89 22.89L29.28 21.71L30.34 22.07L30.84 20.53L29.77 20.19"/><path fill="#a7a9ac" stroke="#231f20" stroke-width="1.04" d="M13.18 26.75L7.59 36.43C6.02 39.16 7.99 42.58 11.14 42.58L22.31 42.58C25.47 42.58 27.44 39.16 25.86 36.43L20.27 26.75C18.7 24.02 14.76 24.02 13.18 26.75"/></g></svg>',
};
// DS icons
const DI={
  SS(l){return `<svg class="ico-ds" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#eee" stroke="#888" stroke-width="1"/><text x="7" y="10.5" text-anchor="middle" font-family="sans-serif" font-size="7" font-weight="bold" fill="#555">${l}</text></svg>`},
  SC:'<svg class="ico-ds" viewBox="0 0 14 9"><rect x=".5" y=".5" width="13" height="8" rx="2.5" fill="rgba(150,150,150,.15)" stroke="#999" stroke-width=".8"/><circle cx="4" cy="4.5" r="2.2" fill="#3A80C8"/><circle cx="10" cy="4.5" r="2.2" fill="#3A80C8"/></svg>',
  MC:'<svg class="ico-ds" viewBox="0 0 14 14"><path d="M8.09,2.91 L11.91,9.59 A2.2,2.2 0 0,1 10.80,11.50 L3.20,11.50 A2.2,2.2 0 0,1 2.09,9.59 L5.91,2.91 A2.2,2.2 0 0,1 8.09,2.91 Z" fill="rgba(150,150,150,.15)" stroke="#999" stroke-width=".8"/><circle cx="7" cy="4.5" r="2.2" fill="#3A80C8"/><circle cx="3.8" cy="10.5" r="2.2" fill="#3A80C8"/><circle cx="10.2" cy="10.5" r="2.2" fill="#3A80C8"/></svg>',
  LC:'<svg class="ico-ds" viewBox="0 0 14 14"><rect x=".5" y=".5" width="13" height="13" rx="2.5" fill="rgba(150,150,150,.15)" stroke="#999" stroke-width=".8"/><circle cx="3.5" cy="3.5" r="2.2" fill="#3A80C8"/><circle cx="10.5" cy="3.5" r="2.2" fill="#3A80C8"/><circle cx="3.5" cy="10.5" r="2.2" fill="#3A80C8"/><circle cx="10.5" cy="10.5" r="2.2" fill="#3A80C8"/></svg>',
};

const DT=[
  {name:"Line",nc:false,desc:"<b>2 Players:</b> All Ships in base contact with opposite table edges as shown.<br><b>3-4 Players:</b> All Ships in base contact with a single table edge for each player."},
  {name:"Table Corners",nc:false,desc:"<b>2 Players:</b> All Ships in base contact with a table edge up to <b>12\"</b> from opposite corners.<br><b>3-4 Players:</b> All Ships in base contact with a table edge up to 12\" from a single corner for each player."},
  {name:"Midboard",nc:false,desc:"<b>2 Players:</b> <b>8\"</b> from the centre of opposite table edges.<br><b>3-4 Players:</b> 8\" from the centre of separate table edges."},
  {name:"From Corners",nc:false,desc:"<b>2 Players:</b> <b>12\"</b> from opposite table corners.<br><b>3-4 Players:</b> 12\" from separate table corners."},
  {name:"Attacker &amp; Defender",nc:true,desc:"1 Attacking Team in Red with all Ships in base contact with the table edge as shown.<br>1 Defending Team in Blue <b>12\"</b> from the opposite table edge."},
  {name:"Encirclement",nc:true,desc:"1 Attacking Team in Red <b>6\"</b> from all board corners.<br>1 Defending Team in Blue <b>9\"</b> from the board centre.<br><b>Note:</b> Scenario rules and Objectives that measure distance from a Deployment Zone to a Dropsite reduce that distance by half; this matters for any rule like \"within 12\" of your Deployment Zone.\""},
];
const AT=[
  {name:"Standoff",nc:false,r:"Directly Deploy",b:"Directly Deploy"},
  {name:"Close Enough",nc:false,r:"Close",b:"Close"},
  {name:"Column",nc:false,r:"Distant",b:"Distant"},
  {name:"Counterattack",nc:true,r:"Directly Deploy",b:"Close"},
  {name:"Delayed Response",nc:true,r:"Close",b:"Distant"},
  {name:"Home Fleet Disadvantage",nc:true,r:"Close",b:"Directly Deploy"},
];
const DM={
  "Directly Deploy":"At least 50% of your Groups must be entirely within your Deployment Zone before the start of the 1st round. Groups not deployed cannot be activated during the 1st round. From the 2nd round onwards, you may activate Groups not on the table. To do this, choose an off-table Group, then choose one:<ul class=\"rule-bullets\"><li>Activate it, choose to have it remain off the table; it has still activated this round.</li><li>Deploy it on the game table, with all ships in Coherency, with all stems in the Deployment Zone, then continue its activation as normal.</li></ul>",
  "Close":"All your Groups begin play off the table. When you activate a Group that is off-table, choose one:<ul class=\"rule-bullets\"><li>Activate it, choose to have it remain off the table; it has still activated this round.</li><li>Deploy it on the game table, with all ships in Coherency, with all stems in the Deployment Zone, then continue its activation as normal.</li></ul>",
  "Distant":"All your Groups begin play off the table. You may activate and deploy Groups with Light tonnage in the 1st round. From the start of the 2nd round onwards, you may also activate Groups of Medium tonnage. From the start of the 3rd round onwards, you may activate any Group.<br><br>When you activate a Group that is off-table, choose one:<ul class=\"rule-bullets\"><li>Activate it, choose to have it remain off the table; it has still activated this round.</li><li>Deploy it on the game table, with all ships in Coherency, with all stems in the Deployment Zone, then continue its activation as normal.</li></ul>",
};
const LY=[
  {name:"Diagonal",nc:false,sc:["4-6 Micrometeor Clouds","4 Dense Debris Fields"],ty:["Micrometeor Cloud","Dense Debris Field"]},
  {name:"Edge Case",nc:false,sc:["4 Micrometeor Clouds","6 Dense Debris Fields"],ty:["Micrometeor Cloud","Dense Debris Field"]},
  {name:"Eruption",nc:false,sc:["1 Planetary Ring across the centre of the table","4-6 Micrometeor Clouds"],ty:["Planetary Ring","Micrometeor Cloud"]},
  {name:"Gatecrash",nc:true,sc:["2 Planetary Rings as shown","4 Micrometeor Clouds","2 Dense Debris Fields"],ty:["Planetary Ring","Micrometeor Cloud","Dense Debris Field"]},
  {name:"Moonlight",nc:true,sc:['2 × 8" Large Objects',"2 Micrometeor Clouds","2 Dense Debris Fields"],ty:["Large Object","Micrometeor Cloud","Dense Debris Field"]},
  {name:"Moonstruck",nc:true,sc:['1 × 12" Large Object',"6 Micrometeor Clouds"],ty:["Large Object","Micrometeor Cloud"]},
];
const SR={
  "Planetary Ring":{desc:'Planetary rings are ice, dust, and pebbles encircling a planet. They are represented by a line with no thickness that runs across the table.',rules:["Ignore the target's Spikes when attacking through this.","After you move or place Assets into or through this, roll a dice. For each result of a <b>2+,</b> remove one of those Assets (placing any Battalions after rolling).","Assets deploying Battalions to a Dropsite with its centre underneath a Planetary Ring ignore the Planetary Ring."]},
  "Micrometeor Cloud":{desc:'These are usually areas of micrometeors or the remnants of annihilated spacecraft. They typically measure around 6" by 3" but can be much larger.',rules:["Ignore the target's Spikes when attacking through Micrometeor Clouds.","Each Ship moved through this suffers <b>2 Kinetic hits.</b>","After you move or place assets into or through this, roll a dice. For each result of a <b>3+,</b> remove one of those assets."]},
  "Dense Debris Field":{desc:'These are usually chaotic expanses of tumbling chunks, from asteroids to shipwrecks. Occasionally, one might represent the scaffolding matrix of orbital shipyards. These typically measure around 6" by 3".',rules:["Ignore the target's Spikes and Signature when attacking through Dense Debris Fields.","Each Ship moved through this suffers <b>2 Core hits.</b>","After you move or place assets into or through this, roll a dice. For each result of a <b>5+,</b> remove one of those assets."]},
  "Large Object":{desc:'These are moons, massive asteroids, or even orbital plates; vast installations only seen over densely developed worlds. They are usually circular and 6-12" in diameter.',rules:["These block Line of Sight.","If any Ship or Asset is placed or moved onto a Large Object, it is destroyed."]},
};
const VA=[
  {name:"Guarded Sectors",ef:"Each Dropsite gains a <b>Military Outpost</b> and each Large Dropsite also gains an <b>Orbital Defence Gun.</b><br><br>If the Deployment type uses a Defender, the Defender may place an additional Military Outpost in any Dropsite.",ft:["Military Outpost","Orbital Defence Gun"]},
  {name:"Secure Comms Array",ef:"Each Medium City (or Small Cities if the scenario has no Medium Cities) gains a <b>Comms Station.</b><br><br>Replace each Large City with a Large Space Station containing an <b>Orbital Defence Gun</b> and a <b>Power Plant.</b>",ft:["Comms Station","Orbital Defence Gun","Power Plant"]},
  {name:"Battlescarred",ef:"Each player places an additional piece of Micrometeor Cloud and Dense Debris Field. These additional pieces should be placed partially over a piece of the same type to create larger areas.<br><br>Each Medium City and Medium Space Station gain two <b>Power Plants.</b>",ft:["Power Plant"]},
  {name:"Gridlocked",ef:"Each Dropsite gains a <b>Power Plant.</b><br><br>Replace each Medium City with a Medium Space Station. These Stations gain a <b>Military Outpost,</b> an <b>Orbital Defence Gun,</b> and a <b>Hangar.</b>",ft:["Power Plant","Military Outpost","Orbital Defence Gun","Hangar"]},
  {name:"Expansive Atmosphere",ef:"Groups on Course Change and Max Thrust orders suffer 1 hit at the end of their activation and may use their Energy or Kinetic save against it.<br><br>Ships may launch Ground Assets at Dropsites in any Orbital Layer.<br><br>Each Red player may place 2 Features of their choice on a Dropsite. Then each Blue player may place 2 Features of their choice on any other Dropsite.",ft:["Military Outpost","Orbital Defence Gun","Comms Station","Power Plant","Hangar"]},
  {name:"Orbital Complex",ef:"Replace each City with a Space Station of equal size. Each Space Station gains a <b>Military Outpost.</b><br><br>Only Orbit is used. Orbital Decay tokens cause a Ship to take D3 damage at the end of its activation. Colossal Ships take 2D3 damage instead.",ft:["Military Outpost"]},
];
const OB=[
  {name:"Attrition",cls:"sp-att",std:true,b:["Players are awarded <vp>2VP</vp> at the end of the game for every <b>500 points</b> of Ships and Admirals they have destroyed."]},
  {name:"Survey",cls:"sp-surv",std:true,b:["Players are awarded <vp>1VP</vp> whenever they Survey Dropsites. Any Capital Ship within 6\" of the Dropsite and able to fire Weapons may substitute all attacking and launching that round to Survey it. Each Dropsite may be Surveyed once per player per game."]},
  {name:"Extract",cls:"sp-ext",std:false,b:["Place 1 Recon Operative token on Small Dropsites, 2 tokens on Medium Dropsites, and 3 tokens on Large Dropsites. If a Ship may launch Assets to deploy a Battalion token to that Dropsite, they may instead Extract Recon Operatives from that Dropsite equal to the number of Battalions that would be placed. The Extracting Ship gains those Recon Operatives. A Ship cannot Extract more Recon Operatives than the Dropsite has.","Players are awarded <vp>2VP</vp> at the end of the game for each Recon Operative token left aboard their Ships.","Players are awarded <vp>1VP</vp> at the end of the game for each enemy Ship they have destroyed with any number of Recon Operatives.","Once onboard a Ship, Recon Operatives cannot be removed. Recon Operatives on Payload Ships are transferred to a Porter Ship when the Payload Ship attaches to it."]},
  {name:"Protect",cls:"sp-prot",std:true,b:["At the start of the game, after determining Initiative, each player nominates a single different Dropsite in Initiative order. You are awarded additional Standard Scoring for controlling/contesting your nominated Dropsite if it is not Levelled or Ruined. At the end of the game, you are subtracted Standard Scoring if your Dropsite has been levelled."]},
  {name:"Breakthrough",cls:"sp-brk",std:false,b:["Red Players may permanently fly Ships off the board in any opponent's Deployment Zone. For every <b>200pts</b> in Ships Players fly off, they are awarded <vp>1VP</vp> at the end of the game.","Other Players are awarded <vp>2VP</vp> at the end of the game for every <b>500 points</b> of Ships and Admirals they have destroyed."]},
  {name:"Raze",cls:"sp-raze",std:true,b:["At the end of the game, players are awarded <b>double Standard Scoring</b> for each Dropsite that has been Levelled or Ruined that is <b>24\" or more</b> away from their Deployment Zone, regardless of who Levelled or Ruined it. Players are also awarded <vp>2 VP</vp> for every <b>500 points</b> of Ships and Admirals they have destroyed."]},
];
// Rulebook 2.3.1, 11.3 Features (p27), verbatim
const FS={
  "Military Outpost":{ico:FI.out,es:"3+",ks:"5+",weapon:{name:"Missile Halo",scan:'6"',att:"1",lock:"2+",dmg:"2",type:"K",special:"Close Action, Escape Velocity"}},
  "Orbital Defence Gun":{ico:FI.odg,es:"5+",ks:"3+",weapon:{name:"Orbital Gun",scan:'6"',att:"3",lock:"3+",dmg:"1",type:"E",special:"Burnthrough-1, Escape Velocity"}},
  "Comms Station":{ico:FI.com,es:"5+",ks:"4+",special:"<b>Comms Uplink:</b> If you control this Dropsite, increase the amount of Ability Points you generate by 1. You can only be affected by Comms Uplink once each round."},
  "Power Plant":{ico:FI.pow,es:"4+",ks:"5+",special:"<b>Volatile:</b> When this Feature is destroyed, all Groups within 3\" gain a Spike and this Feature's Dropsite takes an additional 2D3 damage."},
  "Hangar":{ico:FI.han,es:"4+",ks:"4+",launch:{type:"Fighters &amp; Bombers*",launch:"2",special:"-"},note:"*This Feature's Fighters &amp; Bombers use the Controlling players' Fighters &amp; Bombers."},
};
const DS=[
  {ico:()=>DI.SS('S'),nm:"Small Space Station", sc:'6"',sg:'4"',h:'10',es:'4+',ks:'4+'},
  {ico:()=>DI.SS('M'),nm:"Medium Space Station",sc:'6"',sg:'6"',h:'15',es:'4+',ks:'4+'},
  {ico:()=>DI.SS('L'),nm:"Large Space Station", sc:'6"',sg:'8"',h:'25',es:'4+',ks:'4+'},
  {ico:()=>DI.SC,     nm:"Small City",          sc:'6"',sg:'0"',h:'10',es:'5+',ks:'5+'},
  {ico:()=>DI.MC,     nm:"Medium City",         sc:'6"',sg:'0"',h:'15',es:'5+',ks:'5+'},
  {ico:()=>DI.LC,     nm:"Large City",          sc:'6"',sg:'0"',h:'25',es:'5+',ks:'5+'},
];

function sh(label){return `<div class="sh"><svg class="dm" viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="#B8952F" stroke-width="1.5"/><polygon points="8,5 11,8 8,11 5,8" fill="#B8952F" opacity="0.28"/></svg><span class="sl">${label}</span></div>`;}
function pill(label,cls){return `<div class="spill-row"><span class="spill ${cls}">${label}</span></div>`;}
function stdScoring(){
  return `${pill("Standard Scoring<span style=\"font-weight:400;font-size:7pt;margin-left:3mm;opacity:.75;letter-spacing:0;\">Rounds 4 &amp; 6</span>","sp-std")}<table class="stbl"><thead><tr><th>Dropsite</th><th>Control</th><th>Contested / Ruined</th></tr></thead><tbody><tr><td>Small</td><td><vp>2 VP</vp></td><td><vp>0 VP</vp></td></tr><tr><td>Medium</td><td><vp>3 VP</vp></td><td><vp>1 VP</vp></td></tr><tr><td>Large</td><td><vp>4 VP</vp></td><td><vp>2 VP</vp></td></tr></tbody></table><div class="terms"><div class="term"><b>Control:</b> Only you have Battalions and/or deployed Features on the Dropsite.</div><div class="term"><b>Contest:</b> You and an opponent both have Battalions and/or deployed Features on it.</div><div class="term"><b>Kill Points:</b> the total points in Admirals and Ships you have destroyed. In the event of a tie in VP, the victor is determined by who has the most Kill Points.</div></div>`;
}
function modePill(m){
  const cls=m==="Close"?"sp-close":m==="Distant"?"sp-dist":"sp-dir";
  return cls;
}

const SCENARIOS=[
  // ── Civilian Ships & Scenarios (260901), pages 23-26. Verbatim from the PDF.
  {id:'retrieving-intelligence', name:'Retrieving Intelligence', src:'Civilian Ships & Scenarios',
   players:`2`,
   scenery:`2-4 Micrometeor Clouds, placed as shown on the map. 4 Debris Fields, placed as normal.`,
   deployment:`Column`,
   scoring:[`Standard Scoring.`,
            `A Player that Controls the Civilian Ship at the end of the game gains 4VP. That player gains an additional 2VP if the Civilian Ship is within 12" of their Deployment Zone.`,
            `A Player that Contests the Civilian Ship at the end of the game gains 2VP.`,
            `If a player destroys the Civilian Ship while it is within 12" of an opponents Deployment Zone, that player gains 2VP.`,
            `If the Civilian Ship is destroyed at any other time, each player loses 2VP.`]},

  {id:'make-the-rendezvous', name:'Make the Rendezvous', src:'Civilian Ships & Scenarios',
   players:`1 attacker in red, 1 defender in blue. The attacker's fleet should include 500 more points than the defender.`,
   scenery:`2-4 Micrometeor Cloud, 4-6 Debris Fields.`,
   deployment:`All players Distant. The Defender may directly deploy any number of their H and C tonnage Groups in the yellow deployment zone. These Groups may activate from the 1st round as normal.`,
   scoring:[`The Defender gains 2VP each time they place a Crew Token on a Space Station. The defender gains 1VP at the end of the game for each Space Station they Control. The Defender gains 2VP at the end of the game if their Civilian Ship is not destroyed.`,
            `The Attacker gains 2VP for each Space Station destroyed at the end of the game and 3VP for each Space Station they control at the end of the game. The attacker gains 2VP If they destroy the Civilian Ship`],
   special:[`The defender gains 1 Civilian Ship of their choice to add to their fleet. This Civilian Ship may substitute all attacking and launch when it activates to place 1 Crew Token on a Space Station within 3". Each Space Station can only have a single Crew Token.`]},

  {id:'mass-exodus', name:'Mass Exodus', src:'Civilian Ships & Scenarios',
   players:`1 attacker, 1 defender. For each Group of non-civilian ships in the defender's list, the defender must take 1 Civilian Ship (either alone or adding to an existing Group of that Civilian Ship). These Civilian Ships start the game with 4 friendly Battalions on them.`,
   scenery:`2-4 Micrometeor Cloud, 4-6 Debris Fields.`,
   deployment:[`Attacker-Distant, deploying from either board edge.`,
            `Defender-Directly Deploy in the Entry Area.`],
   scoring:[`The attacker gains 2VP for each Civilian Ship they destroy. The attacker gains 3VP for each Civilian Ship they Control at the end of the game and 1VP for each Civilian Ship they Contest at the end of the game.`,
            `The defender gains 3VP for each Civilian Ship that they Control or Contest in their Exfiltration Zone at the end of the game. The defender gains 2VP for each Controlled Civilian Ship and 1VP for each Contested Ship outside the Exfiltration Zone at the end of the game.`]},

  {id:'shipyard-raid', name:'Shipyard Raid', src:'Civilian Ships & Scenarios',
   players:`2`,
   scenery:`2-4 Micrometeor Cloud, 4-6 Debris Fields.`,
   deployment:`Close Enough.`,
   scoring:[`Standard Scoring`,
            `Each Controlled Civilian Ship that ends a round within 4" of the controlling players' deployment zone is removed from the game and the controlling player gains 2VP.`,
            `Players that destroy a Civilian Ship gain 1VP.`]},

  {id:'tug-of-war', name:'Tug of War', src:'Civilian Ships & Scenarios',
   players:`2`,
   scenery:`4 Micrometeor Clouds, 2 Debris Fields. Place these at least 3" away from the green line.`,
   deployment:`Close Enough`,
   scoring:[`Standard Scoring.`,
            `At the end of the game, measure the distance from the Space Station to each City. Players gain 1VP for each inch the Space Station is away from their opponent's City.`],
   special:[`Each player starts the game with 2 T-Type Tugboats, split into 2 Groups. Each Tugboat starts the game with 3 friendly Battalions on it. These Groups are able to use their Tugging Along special rule on the Small Space Station. When the Space Station is moved this way, it moves directly along the green line towards the controlling player's marked City instead of the direction of the Tugboat.`]},

  {id:'mandatory-festivities', name:'Mandatory Festivities', src:'Civilian Ships & Scenarios',
   players:`2.`,
   scenery:`2 Micrometeor Clouds, 4 Debris Fields.`,
   deployment:`Close Enough.`,
   scoring:[`Raise.`,
            `At the end of the game, players gain 2VP for each of the listed Space Stations in their opponent's board half with a Party Feature.`],
   special:[`Each player starts the game with a Hyperyacht Somniferum, as if it were part of their Fleet. When attacking a Space Station, if the attack successfully inflicts damage, place a Party Feature on that Space Station. Party Features confer no special rules and do not modify saves, but can be removed as normal for Features.`]},

  {id:'supply-run', name:'Supply Run', src:'Civilian Ships & Scenarios',
   players:`1 Attacking player in red, 1 Defending player in blue.`,
   scenery:`4 Debris Field, 4 Micrometeor Clouds 2 small space stations and 2 medium space stations.`,
   deployment:`Red Directly Deploys, Blue Deploys Close.`,
   scoring:[`Standard Scoring.`,
            `The Defender scores 3VP for each medium space station that has been affected by the Rearm and Resupply rule and 2VP for every Small space station that has been affected by the rule.`,
            `The attacker scores 3VP if the Supply Hauler has been removed from the game.`],
   special:[`The Defender deploys a single SLM-9 Resupply Hauler during either the 1st or 2nd round with 6 friendly Battalions on it.`,
            `Each Space Station has the following Launch Assets:`],
   tables:[{head:['Load','Launch','Special'],rows:[['Light Torpedo','1','Limited-2']]},
           {head:['Load','Thrust','Att','Lock','DMG','Type','Special'],rows:[['Light Torpedo','6"','4','3+','1','K','Penetrator']]}]},

  {id:'on-the-clock', name:'On the Clock', src:'Civilian Ships & Scenarios',
   players:`2.`,
   scenery:`2 8" Large Objects (as shown – one for each player), 4 Debris Fields, 4 Micrometeor Clouds.`,
   deployment:`Standoff`,
   scoring:[`Players are awarded 1VP at the end of the game for every 500 points of Ships and Admirals they have destroyed.`,
            `Players score 1VP at the end of the game for each point of damage their opponent's Large Object has suffered this game. A player automatically wins the game if they destroy their opponent's Large Object and 1000 points of Ships and Admirals.`],
   special:[`Each Large Object starts the game with 18 Hull. Large Objects can only be damaged by the LKS Dredger.`,
            `At the start of each round players must determine who controls the Dredger. A player controls the dredger if there is a friendly group within 6", if there is friendly and enemy groups within 6" the player with the closest group takes control of the Dredger. If both groups are the same distance from the Dredger then players roll off, the player who rolls highest controls the Dredger that round. The player that controls the Dredger may activate it as if it was a ship that was part of their fleet.`,
            `If the Dredger is not controlled by either player it may not be targeted by attacks nor does it activate this round.`]},

  // ── Scenario Expansion 1 (250818). Transcribed verbatim from the PDF.
  {id:'ready-salted-earth', name:'Ready Salted Earth', src:'Scenario Expansion 1',
   intro:`Command has identified a pair of space stations of vital importance. These must be kept away from the enemy at all costs as they harbour valuable tactical information critical to the war effort. Ground targets are of no consequence, only the orbital structures are to be captured or destroyed in the case of enemy superiority. Collateral damage is expected.`,
   players:`2.`,
   scenery:`4 Micrometeor Clouds, 2 Debris Fields.`,
   deployment:`All players Imminent.`,
   scoring:[`Demolish Scoring.`,
            `Scenario Space Stations are Focal Points with a range of 8". Ships with less than half their starting Hull remaining use their Low Value when calculating value. When a scenario Space Station is destroyed, replace it with a 4" Diameter Debris Field centred over the removed Space Station. Each Ship and Asset in this Debris Field when it is placed is treated as having moved through it. This Debris Field becomes a Focal Point to Ships in it.`],
   special:[`Each Space Station is paired with the specified Small City. Space stations have a 5+ BS while its corresponding City has 1 or more Power plants.`]},

  {id:'erupting-quarters', name:'Erupting Quarters', src:'Scenario Expansion 1',
   intro:`You have been tasked with achieving space superiority over a section of disabled orbital defence installations. While currently unpowered, you believe these defenses can be quickly brought online with enough manpower. Make use of the ground installations to defend your orbital territory and strike outwards to the heart of your enemy. Defence is a secondary concern here, only the destruction of your enemy and capture of vital territory matters.`,
   players:`2.`,
   scenery:`4 Micrometeor Cloud, 4 Debris Fields.`,
   deployment:`All players Imminent.`,
   scoring:[`Kill Points.`,
            `Each board quarter is a Focal Point. Friendly Ships with less than half their starting Hull remaining and friendly ships in board quarters containing your deployment zone use their Low Value when calculating value.`]},

  {id:'latitudinal-lanes', name:'Latitudinal Lanes', src:'Scenario Expansion 1',
   intro:`You are aware of enemy forces closing in and are able to muster forces to combat them, though both forces are disparate and will take time to fully gather at the AO. Secure the focal points and assess the threat posed by your enemy.`,
   players:`2`,
   scenery:`6 Micrometeor Cloud, 2 Debris Fields.`,
   deployment:`All players Staggered.`,
   scoring:[`Players can Assess the three scenario Dropsites closest to their opponent's deployment zone.`,
            `Each scenario Dropsite is a Focal Point with a range of 6" centred on the Dropsite. Friendly Ships in range of the three scenario Dropsites closest to your deployment zone use their Low Value when calculating value.`]},

  {id:'lagrange-points', name:'Lagrange Points', src:'Scenario Expansion 1',
   intro:`Stuck between two command and control installations are a pair of orbital defence stations. These sites are the lynchpins of the local orbital defence grid and only a fleet based cordon can keep them at bay until the rest of the fleet can arrive to fully secure the area.`,
   players:`2`,
   scenery:`6 Micrometeor Cloud, 2 Debris Fields.`,
   deployment:`All players Close.`,
   scoring:[`Kill Points.`,
            `Each Large Station is a Focal Point with a range of 8". Crippled Ships use their Low Value when calculating value.`]},

  {id:'when-backfields-meet', name:'When Backfields Meet', src:'Scenario Expansion 1',
   intro:`Somehow both you and your enemy have managed to sneak up on each other during a recon mission. Unfortunately both of you have had the misfortune of your heaviest elements meeting first while your vanguard plays catchup. Regardless of the circumstances you need to complete your mission before the enemy completes theirs, assess the oppositions ground strength and destroy it if necessary while keeping a foothold of your own safe.`,
   players:`2`,
   scenery:`2 Micrometeor Clouds, 6 Debris Fields.`,
   deployment:`All players Backline.`,
   scoring:[`Red players gain Normal Scoring from Blue and unmarked Cities. Blue players gain Normal Scoring from red and unmarked Cities.`,
            `All players Assess. Red players score double from red Dropsites. Blue players score double from blue Dropsites.`,
            `Red players may Demolish red Dropsites. Blue players may Demolish blue Dropsites.`]},

  {id:'very-important-moon', name:'Very Important Moon', src:'Scenario Expansion 1',
   intro:`The capture and control of a fortified moon is imperative to gaining greater control of the system. Maintaining a foothold on the ground will support your fleet elements with covering fire. You have repair and recovery ships in system and are instructed to fall back if ships can be preserved, while also moving combat capable ships to within touching distance of the moon.`,
   players:`2.`,
   scenery:`2 Micrometeor Clouds, 2 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`All players Imminent.`,
   scoring:[`Normal Scoring.`,
            `The Large Object is a Focal Point, with a range of 6" from its edge.`,
            `At the end of the game, players score 1VP for each of their Groups on the table containing a Crippled Ship outside of the Focal Point's range.`]},

  {id:'moonshot', name:'Moonshot', src:'Scenario Expansion 1',
   intro:`Operations in strategically useful cities on the ground have be hampered by the presence of a large solid object in orbit, allowing light enemy fleets to engage in hit and run attacks and use piratical tactics. Such a physical impediment to orbital combat must not be used by the enemy to delay conquest of the surface. Hold the space stations and ground support clusters close to it to deny the adversary this advantage.`,
   players:`2`,
   scenery:`0-2 Micrometeor Clouds, 2-4 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`All players Close.`,
   scoring:[`Kill Points.`,
            `Players score Normal Scoring from Scenario Dropsites.`,
            `Each Scenario Dropsite is a Focal Point with a range of 6".`]},

  {id:'moonwreck', name:'Moonwreck', src:'Scenario Expansion 1',
   intro:`In the aftermath of a large fleet engagement over a moon, debris circles the region. Your fleet is to traverse its orbit and reclaim the heavily armed space stations which were abandoned during the engagement. As valuable assets, the enemy will surely want to do the same.`,
   players:`2.`,
   scenery:`4-7 Micrometeor Clouds, 7-9 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`All players Distant.`,
   scoring:[`Players may Demolish the highlighted Dropsites in their opponent's board half.`,
            `Players score Normal Scoring from Scenario Dropsites.`,
            `Each Dropsite is a Focal Point with a range of 6".`]},

  {id:'moonbreaker', name:'Moonbreaker', src:'Scenario Expansion 1',
   intro:`Several mining installations have been converted into military complexes on an unstable moon over an uninhabited planet. Your task is to capture or destroy the moon. The moon's current owners are unlikely to let it fall easily and are already entrenched and waiting for anyone that seeks to capture the moon.`,
   players:`1 Attacker in red, 1 Defender in blue.`,
   scenery:`0-2 Micrometeor Clouds, 2-4 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`Red player Staggered. Blue player Directly Deployed.`,
   scoring:[`Normal Scoring.`,
            `Each yellow location on the Large Object is a separate Small City that cannot have any features for any reason (including deploying to it). Players may deploy Battalions to these as if they were not overlapping scenery.`,
            `A player scores Normal Scoring at the end of the game if they control the majority of Dropsites on the Large Object.`,
            `Red players can Demolish the yellow Dropsites. When all Dropsites on the Large Object become Levelled, the Large Object breaks apart. The following round, the middle 12" of the table is treated as a Micrometeor Cloud. Ships moving through this Micrometeor Cloud suffer 1 Kinetic and 1 Energy hit instead.`,
            `This distance increases by 6" at the start of each round.`]},

  {id:'moonguard', name:'Moonguard', src:'Scenario Expansion 1',
   intro:`Your fleet has been tasked with securing a pair of militarised clusters. With careful planning and an approach from behind the planets moon you catch the enemy off guard and position your fleet before the enemy can react.`,
   players:[`1 Attacker in red, 1 Defender in blue.`,
            `The Defender should have 25% more points than the Attacker (this does not change the game size).`],
   scenery:`0-2 Micrometeor Clouds, 2-4 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`Red player Directly Deployed, blue player Imminent.`,
   scoring:[`Normal Scoring.`,
            `Each player may choose from either: Annihilate, Take Prizes, or Decapitate. They have that secondary objective in addition to their normal Secondary Objectives.`,
            `Players may score an additional Secondary Objective at the end of the game, though identical Secondary Objectives must be completed separately (i.e. 2 Admirals must be killed to score Decapitate twice).`]},

  {id:'moonswipe', name:'Moonswipe', src:'Scenario Expansion 1',
   intro:`Several moons loom over a crucial location. Their orbital patterns have long been lost to time and pose no small hazard to your fleet. This location must be claimed at all costs, while the moons provide you with a modicum of cover, they will surely do the same for the enemy.`,
   players:`2-4`,
   scenery:`0-2 Micrometeor Clouds, 2-4 Debris Fields, 4 Large Objects (6" diameter).`,
   deployment:`2 players 12" along opposite corners (shown in blue). 3-4 players 12" along board corners (shown in red and blue).`,
   scoring:[`Players score Normal Scoring from Cities.`,
            `Each Dropsite is a Focal Point with a range of 6".`],
   special:[`Before deployment, each player alternates moving a Large Object up to 6" in any direction until all Large Objects have been moved. The Large Objects cannot be placed over any part of a City or any part of a Space Station's base.`]},

  {id:'moonskipper', name:'Moonskipper', src:'Scenario Expansion 1',
   intro:`A fast moving moon is no excuse to falter. Secure assets on your side of its orbit and cross its path to strike at the enemy. Careful application of ships will be key, you only have a small vanguard to gain a foothold on these key assets. Fortunately by the time the bulk of your fleet arrives, the danger from the moon will be mostly passed.`,
   players:`2.`,
   scenery:`2-4 Micrometeor Clouds, 2-4 Debris Fields, 1 Large Object (12" diameter).`,
   deployment:`All players Staggered.`,
   scoring:[`Normal Scoring.`,
            `The marked Space Station closest to your opponent's deployment zone is a Focal Point with a range of 6".`],
   special:[`The Large Object begins the 1st round in the bottom left corner as shown. Before the Cleanup step of the End Phase, move the Large Object in a straight line to the next position (shown 1-4). Any Ships in Orbit in the 12" wide path of the Large Object is destroyed.`]},

  {id:'one-with-almost-nothing', name:'One With (Almost) Nothing', src:'Scenario Expansion 1',
   intro:`I don't know who you are. I don't know why I'm here. All I know is that I must kill.`,
   players:`2.`,
   scenery:`D3 Micrometeor Clouds per player and D3 Debris Fields per player (roll once per type).`,
   deployment:`All players Staggered.`,
   scoring:[`Kill Points.`,
            `Players are awarded 1 additional VP at the end of the game for each Admiral they have destroyed.`],
   special:[`Only Orbit is used. Orbital Decay tokens cause a Ship to take D3 damage at the end of its activation. Colossal Ships take 2D3 damage instead.`]},

  {id:'almost-nothing-at-all', name:'(Almost) Nothing At All', src:'Scenario Expansion 1',
   intro:`Two fleets face off over absolutely nothing of import. Both fleets really, really want what's not theirs.`,
   players:`2.`,
   scenery:`4 Micrometeor Clouds, 4 Debris Fields, 2 8" Large Objects. Scenery cannot be placed within 8" of any Deployment Zone.`,
   deployment:`All players Staggered.`,
   scoring:[`Your opponent's board quarter is a Focal Point. Friendly Crippled Ships use their Low Value when calculating value.`],
   special:[`Only Orbit is used. Orbital Decay tokens cause a Ship to take D3 damage at the end of its activation. Colossal Ships take 2D3 damage instead.`]},

  // ── Rulebook 2.3.1, section 12.2. Transcribed verbatim from the PDF.
  {id:'take-and-hold', name:'Take and Hold', src:'Rulebook',
   players:`2 players.`,
   scenery:`4 Micrometeor Clouds, 4 Dense Fields.`,
   deployment:`All players Close.`,
   scoring:`Survey.`},

  {id:'erupting-battlefront', name:'Erupting Battlefront', src:'Rulebook',
   players:`2 players.`,
   scenery:`1 Planetary Ring, 4 Micrometeor Clouds.`,
   deployment:`All players Distant.`,
   scoring:`Raze.`},

  {id:'power-grab', name:'Power Grab', src:'Rulebook',
   players:`2 players.`,
   scenery:`6 Micrometeor Clouds, 4 Dense Fields.`,
   deployment:`All players Distant.`,
   scoring:`Attrition.`},

  {id:'shock-and-yaw', name:'Shock And Yaw', src:'Rulebook',
   players:`2 players.`,
   scenery:`2-5 Micrometeor Clouds, 4-6 Dense Fields.`,
   deployment:`All players Distant.`,
   scoring:`Protect.`,
   special:`Instead of its normal effect, destroying a Power Plant Feature does not deal additional damage to the Medium Space Station but causes all Groups within 6&quot; to gain two Spikes and all Ships within 6&quot; to gain a Scanners Offline token.`},

  {id:'orbital-support', name:'Orbital Support', src:'Rulebook',
   players:`2 players.`,
   scenery:`2-5 Micrometeor Clouds, 4-6 Dense Fields.`,
   deployment:`All players Distant.`,
   scoring:`Raze.`,
   variant:`The Medium Space Station replaces its two Military Outposts with two Hangars.`},

  {id:'entrapmoont', name:'Entrapmoont', src:'Rulebook',
   players:`2-4 players, 1 attacking team in red, 1 defending team in blue.`,
   scenery:`1 12&quot; Heavy Large Object (as shown), 6 Micrometeor Clouds.`,
   deployment:`Blue Directly Deploys, Red Deploys Close.`,
   scoring:`Attackers-Raze, Defenders-Protect.`,
   special:`At the start of the first Planning Phase of the game, the team in blue may place one additional Military Outpost in any Dropsite.`},

  {id:'scrap-collection', name:'Scrap Collection', src:'Civilian Ships & Scenarios',
   players:`1 Attacker in Red, 1 Defender in Blue.`,
   scenery:`6 Debris Fields placed as shown in the map.`,
   deployment:`Defender Directly Deploys. Attacker Deploys Close.`,
   scoring:[`The defender scores 1 victory points equal to number of Scrap tokens on any friendly Harvester or Flenser ship they control and that is still alive at the end of the game.`,
            `The attacker scores 3 Victory Points for every VX-22 Flenser destroyed and 6 Victory Points if they destroy the Type-87 Terminus Harvester.`],
   special:[`The Defender begins the game with a Terminus Harvester with 6 friendly battalions on it and 2 attached Flensers.`,
            `The Harvester activates like any other friendly Group and is treated as such for all rules purposes.`,
            `Whenever a Group of ships is destroyed, place a Debris field within 3" of the final destroyed Ships location. Whenever a group of ships is destroyed in this mission, place one Debris field in the position the ships were in before they were removed from the board.`]},

  {id:'grind-to-dust', name:'Grind to Dust', src:'Civilian Ships & Scenarios',
   players:`2.`,
   scenery:`7 Debris Fields, 7 Micrometeor Clouds spread out as evenly as possible.`,
   deployment:`Both Players Close.`,
   scoring:[`Whenever one or more of a player's Groups gain a scrap token from a Debris Field, remove that Debris Field from the game and that player gains 1VP.`],
   special:[`Each player starts the game with a Terminus Harvester with 2 attached Flenser's.`,
            `Each player's fleet should be a maximum of 500 points, though each player may treat the game size as Clash for their Admiral and Ship/Group limits.`]},

  {id:'down-with-the-cities', name:'Down With The Cities', src:'Civilian Ships & Scenarios',
   players:`2.`,
   scenery:`6 Debris Fields 2-4 Micrometeor Clouds.`,
   deployment:`Staggered (Scenario Expansion 1). The Provenance Ark is deployed as per the diagram at the start of the game.`,
   scoring:[`Normal Scoring (Scenario Expansion 1).`],
   special:[`The Provenance Ark loses its Boardable and Civilian Transport special rules. Players alternate controlling the Provenance Ark. Red players control it during each odd round and Blue players control it during each even round.`,
            `At the end of the Provenance Ark's activation, place a Small City within 8" of it. That City contains 2 Terraforming Zone Features with no special rules (use a blank or upside down feature token for this). Cities placed this way cannot be placed within 8" of another Dropsite.`,
            `The Provenance Ark cannot be moved out of the area marked in green.`]},

  {id:'stop-the-terraformer', name:'Stop The Terraformer', src:'Civilian Ships & Scenarios',
   players:`1 Attacker in Red, 1 Defender in Blue.`,
   scenery:`6 Debris Fields 2-4 Micrometeor Clouds.`,
   deployment:`Attacker deploys Staggered (Scenario Expansion 1). Defender deploys Backline (Scenario Expansion 1). The Provenance Ark is deployed as per the diagram at the start of the game.`,
   scoring:[`Normal Scoring (Scenario Expansion 1), Kill Points Scoring (Scenario Expansion 1). The Provenance Ark is worth double Kill Points.`],
   special:[`The defender starts the game with 2 Battalions on the Provenance Ark.`,
            `At the end of the Provenance Ark's activation, place a Small City within 8" of it. That City contains 2 Terraforming Zone Features with no special rules (use a blank or upside down feature token for this). Cities placed this way cannot be placed within 8" of another Dropsite.`]},

  {id:'sacred-moon', name:'Sacred Moon', src:'Civilian Ships & Scenarios',
   intro:`A mining survey team has located rich metal deposits in a previously overlooked moon. Unfortunately a hostile creature has taken up residence on these deposits and is fiercely guarding its territory. Evict this monster and secure the moon so that mining teams can move in and properly exploit these resources.`,
   players:`2.`,
   scenery:`1 12" Large Object.`,
   deployment:`Both players Imminent. The Fauna starts the game in coherency within one of the two 4" diameter yellow areas, chosen at random.`,
   scoring:[`Normal Scoring (Scenario Expansion 1) Each Scenario Space Station is a Focal Point with a range of 6" (Scenario Expansion 1).`],
   special:[`This scenario uses Fauna Rules.`]},

  {id:'hatching-grounds', name:'Hatching Grounds', src:'Civilian Ships & Scenarios',
   intro:`Several creatures have made a nest out of a constellation of orbiting asteroids. Those asteroids have valuable materials that are a necessity for fleet construction and must be kept out of enemy hands at all costs. Deal with the fauna and defend the asteroids from interlopers.`,
   players:`2.`,
   scenery:`2 8" Large Objects, 2 Debris Fields, 2 Micrometeor Clouds.`,
   deployment:`Both players Staggered. The Fauna starts the game in coherency within 3" of the centre of the table.`,
   scoring:[`Kill Points. Enemy Ships destroyed by Fauna are worth double their Kill Points.`,
            `Each Large Object is a focal point with a range of 6", measured from the edge of the Large Object.`],
   special:[`This scenario uses Fauna Rules.`,
            `Each Large Object is a Dropsite. Treat the edge of the Large Object as if it was the centre of a Dropsite.`]},

  {id:'a-rocky-runaround', name:'A Rocky Runaround', src:'Civilian Ships & Scenarios',
   intro:`Fauna have been affecting shipping through an area rife with asteroids. While there is little of import here, the suspected lair of the culprit lies amongst the rocks and dust. Confirm its identity and neutralise the threat. Once it has been laid low, maintain control of the corpse until science teams arrive to examine it further.`,
   players:`2`,
   scenery:`4 6" Large Objects, 6 Micrometeor Fields.`,
   deployment:`Both Players Close. At the start of the game, randomly determine a Large Object to deploy the Fauna in coherency within 3" of.`,
   scoring:[`Assess. Each Fauna can be Assessed as if it was a Dropsite. When a Fauna is destroyed, do not remove it, instead, it becomes a Focal Point with a range of 6" that can no longer be Assessed. Kill Points.`],
   special:[`This scenario uses the Fauna Rules.`,
            `When Neutral, Fauna move towards the nearest Large Object. When Panicked, Fauna move towards the furthest of either the closest Group or second closest Large Object.`,
            `Variant: Use one Fauna per Large Object, placing each within 3" of its own Large Object.`]},

  {id:'fauna-rules', name:'Fauna Rules', src:'Civilian Ships & Scenarios',
   intro:`Used by the Fauna scenarios (Sacred Moon, Hatching Grounds, A Rocky Runaround).`,
   body:[`This scenario uses a single Group of Living Vessel or Astrofauna, referred to as the Fauna. Players should agree on the Fauna Group size before the game where applicable. The Fauna has multiple States it can be in, shown below. When the Fauna activates, check the table below and follow the first applicable State (from top to bottom).`,
         `The Fauna does not follow the normal activation order and ignores any order-related parts of its Mind of its Own rule. At the start of the game, roll a D6, the Fauna activates after that many activations.`,
         `The Fauna can move over Large Objects as if they were not there but cannot end its movement on a Large Object.`,
         `If the Fauna has optional effects in its rules (e.g. you may...), the Fauna chooses to use those effects. The Fauna uses the maximum number of weapons possible against the target of its attacks.`],
   table:{head:['State','Condition','Directions'], rows:[
     ['Aggressive',`If the Fauna is in base contact with one or more other Groups.`,`For each Group the Fauna is in base contact with, the Fauna attacks that Group. The Fauna activates again after D3 activations.`],
     ['Chasing',`If the Fauna has been attacked this round and is within 6" of a Ship that attacked it.`,`The Fauna faces, then moves up to its Thrust towards the closest Ship that attacked it. The Fauna then attacks that Ship's Group. The Fauna activates again after D3+2 activations.`],
     ['Defending',`If the Fauna has been attacked this round and is within 6" of a Large Object.`,`The Fauna faces, then moves up to half its Thrust towards the closest Ship that attacked it. The Fauna then attacks that Ship's Group. The Fauna activates again after the next 3 activations.`],
     ['Panicked',`If the Fauna has been attacked this round and is not within 6" of a Large Object or a Ship that attacked it.`,`The Fauna faces, then moves up to half its Thrust towards the nearest Group, or nearest Large Object, whichever is closer. It then attacks the closest Group. The Fauna activates again after the next D6 activations`],
     ['Neutral',`If the Fauna has not been attacked this round.`,`The Fauna faces, then moves up to half its Thrust towards the nearest Group. The Fauna activates again after 2D3 activations. Each time it is attacked, it activates 1 activation sooner.`]]}},
];

function scnParas(v){ return (Array.isArray(v)?v:[v]).map(p=>`<p>${p}</p>`).join(''); }
// Maps pulled from the PDFs at native size by scripts/extract-scenario-maps.py.
const SCENARIO_MAPS=new Set(['a-rocky-runaround','almost-nothing-at-all','down-with-the-cities','entrapmoont','erupting-battlefront','erupting-quarters','grind-to-dust','hatching-grounds','lagrange-points','latitudinal-lanes','make-the-rendezvous','mandatory-festivities','mass-exodus','moonbreaker','moonguard','moonshot','moonskipper','moonswipe','moonwreck','on-the-clock','one-with-almost-nothing','orbital-support','power-grab','ready-salted-earth','retrieving-intelligence','sacred-moon','scrap-collection','shipyard-raid','shock-and-yaw','stop-the-terraformer','supply-run','take-and-hold','tug-of-war','very-important-moon','when-backfields-meet']);
function pubHead(label){return `<div class="sh"><svg class="dm" viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="none" stroke="#B8952F" stroke-width="1.5"/><polygon points="8,5 11,8 8,11 5,8" fill="#B8952F" opacity="0.28"/></svg><span class="sl">${label}</span></div>`;}

/* A published scenario names rules without explaining them. Every explanation
   here is verbatim: arrival modes, objectives, scenery, Features and dropsites
   from this page's own tables, the rest from scenario-terms.js. */
const PUB_MODE={'Close':'sp-close','Distant':'sp-dist','Directly Deploy':'sp-dir','Imminent':'sp-imm','Backline':'sp-back','Staggered':'sp-stag'};
const pubJoin=v=>v?(Array.isArray(v)?v.join(' '):String(v)):'';
const pubVP=h=>String(h).replace(/(?<!<vp>)\b(\d+)\s?VP\b/g,'<vp>$1VP</vp>');
const pubParas=v=>(Array.isArray(v)?v:[v]).map(p=>`<p class="rule-text">${pubVP(p)}</p>`).join('');
const pubBullets=v=>`<ul class="rule-bullets">${(Array.isArray(v)?v:[v]).map(p=>`<li>${pubVP(p)}</li>`).join('')}</ul>`;
const pubTable=t=>`<div class="pub-tbl-wrap"><table class="pub-tbl"><thead><tr>${t.head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${pubVP(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const pubSE1=name=>{const d=SCN_SE1[name]; return pubParas(d.body)+(d.table?pubTable(d.table):'')+(d.after?pubParas(d.after):'');};

/* Explanations follow the order the terms appear in the scenario's own text. */
function pubFind(text,detectors){
  return detectors.map(d=>({d,m:text.match(d.re)})).filter(x=>x.m).sort((a,b)=>a.m.index-b.m.index).map(x=>x.d);
}

function pubModes(dep){
  const out=[], shown=new Set();
  const mode=(m,label)=>{ if(shown.has(m)) return; shown.add(m); out.push(pill(label||m,PUB_MODE[m])+`<p class="rule-text">${DM[m]}</p>`); };
  const at=name=>{ const a=AT.find(x=>x.name===name); mode(a.r,`${name}: All Players ${a.r}`); };
  const se1=name=>{ if(shown.has(name)) return; shown.add(name); out.push(pill(name,PUB_MODE[name])+pubSE1(name)); };
  pubFind(dep,[
    {re:/\bClose Enough\b/,run:()=>at('Close Enough')},
    {re:/\bColumn\b/,run:()=>at('Column')},
    {re:/\bStandoff\b/,run:()=>at('Standoff')},
    {re:/\bImminent\b/,run:()=>se1('Imminent')},
    {re:/\bStaggered\b/,run:()=>se1('Staggered')},
    {re:/\bBackline\b/,run:()=>se1('Backline')},
    {re:/\bDirectly Deploy/,run:()=>mode('Directly Deploy')},
    {re:/\bClose\b(?! Enough)/,run:()=>mode('Close')},
    {re:/\bDistant\b/,run:()=>mode('Distant')},
  ]).forEach(d=>d.run());
  return out.join('');
}

function pubScoring(text){
  const out=[]; let std=false;
  const stdOnce=()=>{ if(!std){ std=true; out.push(stdScoring()); } };
  const se1=(name,cls)=>()=>out.push(pill(name,cls)+pubSE1(name));
  pubFind(text,[
    {re:/\bStandard Scoring\b/,run:stdOnce},
    {re:/\bNormal Scoring\b/,run:se1('Normal Scoring','sp-std')},
    {re:/\bDemolish/,run:se1('Demolish Scoring','sp-raze')},
    {re:/\bFocal [Pp]oint/,run:se1('Focal Points Scoring','sp-surv')},
    {re:/\bKill Points\b/,run:se1('Kill Points Scoring','sp-att')},
    {re:/\bAssess/,run:se1('Assess Scoring','sp-surv')},
    ...OB.map(o=>({re:new RegExp('\\b'+o.name+'\\b'),run:()=>{ if(o.std) stdOnce(); out.push(pill(o.name,o.cls)+pubBullets(o.b)); }})),
  ]).forEach(d=>d.run());
  return out.join('');
}

function pubTerms(text){
  const rb=SCN_RULEBOOK, out=[];
  const line=(name,html)=>out.push(`<p class="rule-text pub-term"><b>${name}:</b> ${html}</p>`);
  pubFind(text,[
    {re:/\bcontrol/i,run:()=>line('Control',rb['11.1'].body[0])},
    {re:/\bcontest/i,run:()=>line('Contest',rb['11.1'].body[1])},
    {re:/\bLevelled\b|\bDemolish/,run:()=>line('Levelled',rb['11.1'].body[2])},
    {re:/\bRuined\b|\bDemolish/,run:()=>line('Ruined',rb['11.1'].body[3])},
    {re:/\bSecondary Objective/,run:()=>line('Secondary Objectives',rb['12.3'].body.join(' '))},
    {re:/\bAnnihilate\b/,run:()=>line('Annihilate',rb['12.3.4'].body.join(' '))},
    {re:/\bTake Prizes\b/,run:()=>line('Take Prizes',rb['12.3.5'].body.join(' '))},
    {re:/\bDecapitate\b/,run:()=>line('Decapitate',rb['12.3.7'].body.join(' '))},
  ]).forEach(d=>d.run());
  return out.join('');
}

function pubScenery(text){
  const out=[];
  const sr=n=>{ const x=SR[n]; out.push(`<div class="sc-def"><b>${n}:</b> ${x.rules.join(' ')}</div><div class="sc-flavor">${x.desc}</div>`); };
  pubFind(text,[
    {re:/Micrometeor/,run:()=>sr('Micrometeor Cloud')},
    {re:/Debris Field|Dense Field/,run:()=>sr('Dense Debris Field')},
    {re:/Large Object/,run:()=>sr('Large Object')},
    {re:/Planetary Ring/,run:()=>sr('Planetary Ring')},
  ]).forEach(d=>d.run());
  return out.join('');
}

// Weapon damage types, as the builder names them (js/app.js WEAPON_TYPE_LABELS)
const WTYPE={K:'Kinetic',E:'Energy',C:'Core'};
const hidden=t=>`<span class="vh">${t}</span>`;
const statHead=k=>`<th scope="col" class="c">${statIcon(k)}${hidden(STAT_META[k].label)}</th>`;
// What a Feature does beyond its saves: its weapon, launch, or special rule
function featDetail(f){
  if(f.weapon){ const w=f.weapon; return `<table class="st st-sub"><thead><tr><th scope="col">Weapon</th>${statHead('scan')}<th scope="col" class="c">Att</th><th scope="col" class="c">Lock</th><th scope="col" class="c">Dmg</th><th scope="col" class="c">Type</th></tr></thead><tbody><tr><td><b>${w.name}</b></td><td class="c">${w.scan}</td><td class="c">${w.att}</td><td class="c">${w.lock}</td><td class="c">${w.dmg}</td><td class="c"><span class="tip-t" tabindex="0" data-tip="wtype:${w.type}">${w.type}</span></td></tr><tr><td colspan="6" class="st-spec"><span class="st-spec-l">Special</span> ${w.special}</td></tr></tbody></table>`; }
  if(f.launch){ const l=f.launch; return `<table class="st st-sub"><thead><tr><th scope="col">Type</th><th scope="col" class="c">Launch</th><th scope="col">Special</th></tr></thead><tbody><tr><td>${l.type}</td><td class="c">${l.launch}</td><td>${l.special}</td></tr></tbody></table><p class="st-note">${f.note}</p>`; }
  return f.special?`<p class="st-rule">${f.special}</p>`:'';
}
function featTable(names){
  const list=names.filter(n=>FS[n]);
  if(!list.length) return '';
  return `<table class="st st-feat"><thead><tr><th scope="col">Feature</th>${statHead('es')}${statHead('ks')}</tr></thead><tbody>${list.map(n=>{const f=FS[n]; return `<tr class="st-main"><th scope="row"><span class="st-name">${tipped('feat:'+n,f.ico)}${n}</span></th><td class="c sv-e">${f.es}</td><td class="c sv-k">${f.ks}</td></tr><tr class="st-more"><td colspan="3">${featDetail(f)}</td></tr>`;}).join('')}</tbody></table>`;
}
function dsTable(){
  return `<table class="st st-ds"><thead><tr><th scope="col">Dropsite</th>${statHead('scan')}${statHead('sig')}${statHead('hull')}${statHead('es')}${statHead('ks')}</tr></thead><tbody>${DS.map((d,i)=>`<tr><th scope="row"><span class="st-name">${tipped('ds:'+i,d.ico())}${d.nm}</span></th><td class="c">${d.sc}</td><td class="c">${d.sg}</td><td class="c">${d.h}</td><td class="c sv-e">${d.es}</td><td class="c sv-k">${d.ks}</td></tr>`).join('')}</tbody></table>`;
}
function pubFeatures(text){
  const html=featTable(Object.keys(FS).filter(n=>text.includes(n)));
  return html?`<div class="lhdr">Features</div>${html}`:'';
}
const pubDropsites=()=>`<div class="lhdr">Dropsite Reference</div>${dsTable()}`;

function pubShips(text){
  return Object.keys(SCN_SHIPS).filter(k=>text.includes(k)).map(k=>{
    const x=SCN_SHIPS[k], st=x.stats;
    const w=x.weapons.length?`<div class="pub-tbl-wrap"><table class="pub-tbl"><thead><tr><th>Weapon</th><th>Arc</th><th>Att</th><th>Lock</th><th>Dmg</th><th>Type</th><th>Special</th></tr></thead><tbody>${x.weapons.map(v=>`<tr><td>${v.name}</td><td>${v.arc}</td><td>${v.attack}</td><td>${v.lock}</td><td>${v.damage}</td><td>${v.type}</td><td>${v.special||''}</td></tr>`).join('')}</tbody></table></div>`:'';
    return `<div class="pub-ship">
      <img class="pub-ship-art" src="${SCN_ASSETS}art/thumb/${x.art}" alt="${x.name}">
      <div class="pub-ship-body">
        <div class="pub-ship-h"><b>${x.name}</b><span>${x.tonnage}, ${x.cost} pts</span></div>
        <div class="pub-ship-stats"><span>${statIcon('thrust')} ${st.thrust}</span><span>${statIcon('scan')} ${st.scan}</span><span>${statIcon('sig')} ${st.sig}</span><span>${statIcon('hull')} ${st.hull}</span><span>${statIcon('es')}<span class="sv-e">${st.es}</span></span><span>${statIcon('ks')}<span class="sv-k">${st.ks}</span></span><span>${statIcon('bs')} ${st.bs}</span><span>${statIcon('g')} ${st.g}</span></div>
        ${w}
        ${x.rules.map(r=>`<p class="rule-text"><b>${r.name}:</b> ${r.text}</p>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderScenario(s){
  const J=pubJoin;
  const rulesText=[s.players,s.deployment,s.scoring,s.variant,s.special].map(J).join(' ');
  const allText=[s.intro,s.body,s.scenery,rulesText].map(J).join(' ');
  const sec=(label,html)=>html?`<div class="sec">${pubHead(label)}<div class="sec-body">${html}</div></div>`:'';
  const deploy=s.deployment?pubParas(s.deployment)+pubModes(J(s.deployment)):'';
  const score=s.scoring?pubBullets(s.scoring)+pubScoring([s.scoring,s.special,s.variant].map(J).join(' ')):'';
  const tbls=(s.tables||(s.table?[s.table]:[])).map(pubTable).join('');
  const special=(s.special?pubBullets(s.special):'')+tbls;
  const scenery=s.scenery?pubParas(s.scenery)+pubScenery([s.scenery,s.special,s.scoring].map(J).join(' ')):'';
  const ships=pubShips(allText);
  const hasMap=SCENARIO_MAPS.has(s.id);
  const fauna=s.id!=='fauna-rules'&&/\bFauna\b/.test(allText)?`<button class="abtn pub-fauna" onclick="pubOpen('fauna-rules')">Fauna Rules</button>`:'';
  const right=hasMap?`<div class="map-col">
      <div class="map-frame"><img src="${SCN_ASSETS}scenarios/dropfleet/${s.id}.webp" alt="${s.name} map"></div>
      ${sec('Scenery',scenery)}
      <div class="leg">${pubFeatures(allText)}${pubDropsites()}</div>
    </div>`:'';
  return `<div class="scenario pub${hasMap?'':' no-map'}">
    <div class="rules-col">
      <div class="sc-header"><h2 class="sc-name">${s.name}</h2><div class="pub-src">${s.src}</div></div>
      ${s.intro?`<p class="sc-flavor pub-intro">${s.intro}</p>`:''}
      ${s.body?pubParas(s.body):''}
      ${sec('Players',s.players?pubParas(s.players):'')}
      ${sec('Deployment',deploy)}
      ${sec('Scoring',score)}
      ${sec('Variant',s.variant?pubParas(s.variant):'')}
      ${sec('Special Rules',special)}
      ${hasMap?'':sec('Scenery',scenery)}
      ${sec('Terms',pubTerms(rulesText))}
      ${fauna}
    </div>
    ${right}
  </div>
  ${ships?`<div class="pub-ships">${pubHead('Ships')}<div class="pub-ship-grid">${ships}</div></div>`:''}`;
}

/* ── Hover, tap or focus a symbol to see its stats ─────────────────────────
   Any element with data-tip="stat:scan", "feat:Power Plant" or "ds:3" opens one
   shared tooltip: on hover with a mouse, on tap on touch, on keyboard focus. */
function tipHTML(key){
  const [kind,id]=[key.slice(0,key.indexOf(':')),key.slice(key.indexOf(':')+1)];
  if(kind==='stat'){ const m=STAT_META[id]; return m?`<div class="scn-tip-h">${G[m.icon]}<b>${m.label}</b></div><div>${m.title}</div>`:''; }
  if(kind==='feat'){ const f=FS[id]; if(!f) return ''; const w=f.weapon;
    const more=w?`<b>${w.name}</b> ${G.iScan}${w.scan}, Att ${w.att}, Lock ${w.lock}, Dmg ${w.dmg}${w.type}, ${w.special}`:f.launch?`Launch ${f.launch.launch}: ${f.launch.type}<br>${f.note}`:f.special;
    return `<div class="scn-tip-h">${f.ico}<b>${id}</b></div><div class="scn-tip-st">${G.iES}<span class="sv-e">${f.es}</span>${G.iKS}<span class="sv-k">${f.ks}</span></div><div>${more}</div>`; }
  if(kind==='wtype'){ return WTYPE[id]?`<b>${id}</b> ${WTYPE[id]}`:''; }
  if(kind==='ds'){ const d=DS[+id]; return d?`<div class="scn-tip-h">${d.ico()}<b>${d.nm}</b></div><div class="scn-tip-st">${G.iScan}${d.sc} ${G.iSig}${d.sg} ${G.iHull}${d.h} ${G.iES}<span class="sv-e">${d.es}</span>${G.iKS}<span class="sv-k">${d.ks}</span></div>`:''; }
  return '';
}
(function(){
  let tip=null, owner=null, pinned=false;
  const el=()=>tip||(tip=Object.assign(document.body.appendChild(document.createElement('div')),{id:'scn-tip',role:'tooltip',hidden:true}));
  function show(t){
    const html=tipHTML(t.dataset.tip); if(!html) return;
    const box=el(); box.innerHTML=html; box.hidden=false; owner=t;
    const r=t.getBoundingClientRect(), w=box.offsetWidth, h=box.offsetHeight, m=8;
    let x=Math.min(Math.max(m,r.left+r.width/2-w/2),innerWidth-w-m);
    let y=r.top-h-10; if(y<m) y=r.bottom+10;
    box.style.left=x+'px'; box.style.top=Math.min(y,innerHeight-h-m)+'px';
  }
  function hide(){ if(tip) tip.hidden=true; owner=null; pinned=false; }
  const target=e=>e.target.closest&&e.target.closest('[data-tip]');
  document.addEventListener('pointerover',e=>{ if(e.pointerType!=='mouse'||pinned) return; const t=target(e); if(t&&t!==owner) show(t); });
  document.addEventListener('pointerout',e=>{ if(e.pointerType!=='mouse'||pinned) return; const t=target(e); if(t&&!t.contains(e.relatedTarget)) hide(); });
  document.addEventListener('click',e=>{ const t=target(e); if(t){ if(owner===t&&pinned) hide(); else { show(t); pinned=true; } } else if(!(tip&&tip.contains(e.target))) hide(); });
  document.addEventListener('focusin',e=>{ const t=target(e); if(t) show(t); });
  document.addEventListener('focusout',e=>{ if(target(e)&&!pinned) hide(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') hide(); });
  addEventListener('scroll',()=>{ if(owner) hide(); },true);
  addEventListener('resize',hide);
})();
