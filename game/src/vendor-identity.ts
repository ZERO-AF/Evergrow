/** One emblem and color identity across canvas buildings, clothes and service panels. */
const IDENTITIES={
 blacksmith:{color:'#f0af56',cloth:'#98502e',dark:'#563323',paths:['M-5 -7 L7 -7 L7 -1 L-5 -1 Z','M-1 -1 L-1 8 L2 8 L2 -1']},
 jeweler:{color:'#71e2c5',cloth:'#287c72',dark:'#254b49',paths:['M-8 -3 L-4 -8 L4 -8 L8 -3 L0 8 Z','M-8 -3 L8 -3 M-4 -8 L-3 -3 L0 8 L3 -3 L4 -8']},
 enchanter:{color:'#cca4ff',cloth:'#71549f',dark:'#433451',paths:['M0 -9 L3 -3 L9 0 L3 3 L0 9 L-3 3 L-9 0 L-3 -3 Z','M-7 -7 L-5 -7 M6 6 L8 6']},
 gambler:{color:'#efc466',cloth:'#9b3949',dark:'#592d38',paths:['M-7 -7 L7 -7 L7 7 L-7 7 Z','M-4 -4 L-3 -4 M3 4 L4 4 M-4 4 L-3 4 M3 -4 L4 -4 M0 0 L1 0']},
 stash:{color:'#c7cbba',cloth:'#5b6b66',dark:'#354743',paths:['M-8 -4 L8 -4 L8 7 L-8 7 Z','M-8 -4 L-5 -8 L5 -8 L8 -4 M-5 -7 L-5 7 M5 -7 L5 7 M-1 0 L1 0 L1 3 L-1 3 Z']},
 stable:{color:'#a8d8a0',cloth:'#4a6b42',dark:'#2d4228',paths:['M-8 -2 L-3 -8 L3 -8 L8 -2 L8 7 L-8 7 Z','M-4 7 L-4 2 L4 2 L4 7 M-6 -2 L6 -2']},
 battlemaster:{color:'#e8c15a',cloth:'#7a3b3b',dark:'#4a2626',paths:['M-7 8 L5 -8 M-7 -8 L7 8 M-9 3 L-4 5 M4 -5 L9 -3']},
 pvpVendor:{color:'#d8a04a',cloth:'#6b4a2e',dark:'#3f2c1c',paths:['M-6 -8 L6 -8 L6 2 L0 8 L-6 2 Z','M-6 -4 L6 -4 M0 -8 L0 8']},
 badgeVendor:{color:'#7ec8e3',cloth:'#2e4a6b',dark:'#1c2f3f',paths:['M0 -8 L7 -4 L7 4 L0 8 L-7 4 L-7 -4 Z','M0 -8 L0 8 M-7 -4 L7 4 M7 -4 L-7 4']},
 darkmoonVendor:{color:'#d6a8e0',cloth:'#5a3b78',dark:'#33204a',paths:['M-8 6 L-4 -6 L0 2 L4 -6 L8 6 Z','M-8 6 L8 6 M0 -9 L0 -5']},
};
export function vendorIdentity(kind:string){return IDENTITIES[(kind==='merchant'?'jeweler':kind==='chapel'?'enchanter':kind) as keyof typeof IDENTITIES]??null;}
export function vendorEmblem(kind:string):string{const identity=vendorIdentity(kind);return identity?`<svg viewBox="-12 -12 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${identity.paths.map(d=>`<path d="${d}"/>`).join('')}</svg>`:'';}
