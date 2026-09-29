'use strict';
/* Explicit new prerequisites for historical system-only tests. These are authored
 * fixtures, not the fresh-player progression test. Never used by production code. */
const L=require('./simulation.cjs'),G=require('./growth-content.js');
function knowledge(e){e.s.player.level=20;for(const d of G.content.research){e.s.progression.research[d.id]=true;if(d.grants)e.s.progression.features[d.grants.feature]=d.grants.rank;}return e;}
function beds(e){knowledge(e);e.s.progression.slots=6;let home=e.s.buildings.find(b=>b.kind==='cottage');if(!home){for(let x=3;x<17&&!home;x++)for(let y=3;y<17&&!home;y++)if(!e.placementIssue('cottage',x,y)){home={id:'b'+e.s.nextId++,kind:'cottage',level:3,quality:70,x,y,stock:0,regen:0};e.s.buildings.push(home);e.ensureDoors();}}if(home)home.level=3;const old=e.s.buildings.find(b=>b.kind==='shelter');if(old)old.level=3;return e;}
module.exports={knowledge,beds};
