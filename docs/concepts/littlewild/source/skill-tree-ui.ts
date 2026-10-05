/// <reference path="./skill-tree-contracts.d.ts" />
/* Detached tree projection; the Learning studio owns command routing and feedback. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWSkillTreeUI?:{render(views:LWSkillTrees.View[],name:string):string}};
 const escape=(s:string):string=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 function render(views:LWSkillTrees.View[],name:string):string{
  if(!views.length)return '<p>No skill tree is attached to this companion. A project can attach a tree through the engine or developer toolbox.</p>';
  return views.map(tree=>{
   const byId=new Map(tree.nodes.map(n=>[n.id,n])),depths=new Map<string,number>();
   function depth(node:LWSkillTrees.Node):number{
    const value=depths.get(node.id);if(value!==undefined)return value;
    const next=node.requires.length?1+Math.max(...node.requires.map(r=>depth(byId.get(r.nodeId)!))):0;depths.set(node.id,next);return next;
   }
   for(const node of tree.nodes)depth(node);
   const levels=[...new Set(depths.values())].sort((a,b)=>a-b);
   return `<section class="skill-tree" aria-label="${escape(tree.name)}"><h3>${escape(tree.name)}</h3><p>${escape(tree.description)}</p><p class="skill-tree-summary" role="status"><strong>${escape(name)} · ${tree.points} ${tree.points===1?'point':'points'} available</strong><span>${tree.xp} XP · ${tree.xpPerPoint} XP per point · ${tree.spent} points spent</span></p><p>Complete useful work, lessons and discoveries to earn XP. Branch choices are permanent. Nodes marked “Choose one path” share a branch; choosing one closes the others.</p><div class="skill-tree-branches">${levels.map(level=>`<section class="skill-tree-stage" aria-label="Stage ${level+1}"><h4>${level===0?'Take root':'Stage '+(level+1)}</h4><ol>${tree.nodes.filter(n=>depths.get(n.id)===level).map(node=>{
    const requires=node.requires.map(r=>escape(byId.get(r.nodeId)!.name)+' rank '+r.rank).join(' + ');
    const status=node.rank===node.maxRank?'Fully learned':node.reason?'Locked':'Available';
    const action=node.rank===node.maxRank?'Fully learned':`Learn rank ${node.rank+1} · ${node.cost} ${node.cost===1?'point':'points'}`;
    return `<li tabindex="-1" class="skill-tree-node" data-skill-tree="${escape(tree.id)}" data-skill-node="${escape(node.id)}"><div class="section-heading"><h5>${escape(node.name)}</h5><span>${status} · ${node.rank}/${node.maxRank}</span></div><p>${escape(node.description)}</p><p class="micro">${requires?'Requires '+requires+' · ':''}Level ${node.minimumLevel}${node.exclusiveGroup?' · Choose one path':''}</p><p class="action-reason">${escape(node.reason??'Ready to grow.')}</p><button class="btn small" data-act="skill-tree-unlock" data-tree="${escape(tree.id)}" data-id="${escape(node.id)}" ${node.reason?'disabled':''}>${action}</button></li>`;
   }).join('')}</ol></section>`).join('')}</div></section>`;
  }).join('');
 }
 root.LWSkillTreeUI=Object.freeze({render});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWSkillTreeUI;
})(globalThis);
