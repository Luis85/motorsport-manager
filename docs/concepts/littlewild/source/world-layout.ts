/* World-space UI geometry. Pure, bounded CSS-pixel calculations; no game state. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function placePopover(anchor,size,safe,preferred='right',gap=24) {
    const w=Math.min(size.width,Math.max(1,safe.right-safe.left));
    const h=Math.min(size.height,Math.max(1,safe.bottom-safe.top));
    const point={x:anchor.x,y:anchor.y};
    const candidates={right:{x:point.x+gap,y:point.y-h*.40},left:{x:point.x-gap-w,y:point.y-h*.40},bottom:{x:point.x-w/2,y:point.y+gap},top:{x:point.x-w/2,y:point.y-gap-h}};
    const order=[preferred,...['right','left','bottom','top'].filter(k=>k!==preferred)];
    let best;
    for(const side of order){const r=candidates[side];const x=clamp(r.x,safe.left,safe.right-w),y=clamp(r.y,safe.top,safe.bottom-h);const covers=point.x>x-12&&point.x<x+w+12&&point.y>y-12&&point.y<y+h+12;
      const score=Math.abs(x-r.x)+Math.abs(y-r.y)+(covers?10000:0);
      if(!best||score<best.score)best={x,y,width:w,height:h,side,score};
    }
    return {...best,tip:{x:clamp(point.x,best.x+14,best.x+w-14),y:clamp(point.y,best.y+14,best.y+h-14)}};
  }
  function isPointVisible(point,safe,pad=0){return point.x>=safe.left+pad&&point.x<=safe.right-pad&&point.y>=safe.top+pad&&point.y<=safe.bottom-pad;}
  const api={placePopover,isPointVisible};root.LWWorldLayout=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
