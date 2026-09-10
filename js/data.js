// Static concept/simulation data and shared SVG icon markup.
// NOTE: All values here are synthetic sample data for demonstration only.

export const hurricaneSvg = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M48 17C37 6 17 10 12 27c-3 11 3 21 13 25 9 4 21 0 25-10 3-8-1-17-9-20-8-4-18 1-20 10-2 8 4 14 12 14"/><circle cx="32" cy="32" r="5" fill="white"/></svg>`;
export const tornadoSvg = `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M10 12h44M15 22h34M20 32h24M25 42h14M30 52h4"/><path fill="currentColor" opacity=".25" d="M12 12h40L36 56h-8z"/></svg>`;

export const storms = [
  {id:'H1',type:'Hurricane',cat:'CAT 3',ef:'3',lat:29.1,lng:-90.1,wind:125,pressure:949,speed:18,heading:'NNW',pulse:64,intensity:.78,color:'#20bfff',track:[[22,-95],[25,-94],[27.2,-92],[29.1,-90.1]],proj:[[31.2,-87.8],[34.8,-82.3],[38,-78]]},
  {id:'H2',type:'Hurricane',cat:'CAT 2',ef:'2',lat:24.6,lng:-82.5,wind:105,pressure:955,speed:16,heading:'NW',pulse:42,intensity:.66,color:'#38e0ff',track:[[18,-86],[21,-85],[24.6,-82.5]],proj:[[27.6,-81.2],[31,-79.4]]},
  {id:'H3',type:'Hurricane',cat:'CAT 1',ef:'1',lat:15.8,lng:-66.5,wind:85,pressure:972,speed:20,heading:'WNW',pulse:28,intensity:.52,color:'#0e8cff',track:[[11,-60],[13,-63],[15.8,-66.5]],proj:[[18,-71],[21,-76],[25,-80]]},
  {id:'T1',type:'Tornado',cat:'EF2',ef:'EF2',lat:40.8,lng:-98.1,wind:130,pressure:null,speed:32,heading:'NE',pulse:71,intensity:.71,color:'#a66cff',track:[[39.2,-99.8],[40,-98.9],[40.8,-98.1]],proj:[[41.8,-97.1],[42.5,-95.9]]},
  {id:'T2',type:'Tornado',cat:'EF3',ef:'EF3',lat:45.0,lng:-99.0,wind:150,pressure:null,speed:28,heading:'E',pulse:58,intensity:.58,color:'#bb7cff',track:[[44.3,-101.2],[44.8,-100.1],[45,-99]],proj:[[45.2,-97.3],[45,-95.6]]},
  {id:'T3',type:'Tornado',cat:'EF1',ef:'EF1',lat:37.8,lng:-97.3,wind:105,pressure:null,speed:24,heading:'NE',pulse:49,intensity:.49,color:'#9f62ff',track:[[36.8,-98.4],[37.2,-97.9],[37.8,-97.3]],proj:[[38.8,-96.5],[39.6,-95.2]]},
  {id:'T4',type:'Tornado',cat:'EF2',ef:'EF2',lat:35.5,lng:-97.5,wind:115,pressure:null,speed:22,heading:'NE',pulse:53,intensity:.53,color:'#b15cff',track:[[34.6,-98.3],[35,-98],[35.5,-97.5]],proj:[[36.6,-96.8],[37.3,-95.7]]},
  {id:'T5',type:'Tornado',cat:'EF1',ef:'EF1',lat:32.9,lng:-98.9,wind:95,pressure:null,speed:20,heading:'E',pulse:36,intensity:.45,color:'#c070ff',track:[[32.1,-100.3],[32.5,-99.6],[32.9,-98.9]],proj:[[33.5,-97.5],[34.1,-96.3]]}
];

export const pulses = [
  {id:'P1',lat:34,lng:-113,impact:63,power:'Medium'},
  {id:'P2',lat:39,lng:-106,impact:68,power:'Medium'},
  {id:'P3',lat:40,lng:-93,impact:89,power:'High'},
  {id:'P4',lat:45,lng:-84,impact:72,power:'Medium'},
  {id:'P5',lat:29,lng:-86,impact:56,power:'Medium'},
  {id:'P6',lat:17,lng:-66,impact:58,power:'Low'}
];
