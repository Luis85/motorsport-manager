/* Bounded, deterministic grid navigation. The cache is derived, never saved.
 * Every returned route is an independent array: consuming one cannot edit another.
 * Domain tests cover route ownership, blocked targets and large-grid indexing. */
(function(inputRoot: unknown){
 'use strict';

 type Direction=readonly [number,number];
 interface Point { x:number; y:number; }
 interface ResourceNode extends Point { kind:string; }
 interface NavigationState {
  estate?:unknown;
  nodes:ResourceNode[];
  buildings:Point[];
  creature:Point;
 }
 interface GridLike {
  readonly cells:Uint8Array|Set<string>;
  pass(x:number,y:number):boolean;
  approach(target:Point):boolean;
  path(start:Point,target:Point,adjacent?:boolean):Point[]|null;
 }
 interface GeographyApi { grid(state:NavigationState):GridLike; }
 interface LittlewildFacade { SIZE:number; terrain(x:number,y:number):string; }
 interface NavigationApi {
  Grid:typeof Grid;
  grid(state:NavigationState):GridLike;
  path(state:NavigationState,target:Point,adjacent?:boolean):Point[]|null;
 }
 interface LittlewildRoot {
  LW?:LittlewildFacade;
  LWGeography?:GeographyApi;
  LWNavigation?:NavigationApi;
 }
 const root=inputRoot as LittlewildRoot;

 const DIRECTIONS:readonly Direction[]=Object.freeze([[1,0],[0,1],[-1,0],[0,-1]] as const);
 const cache=new WeakMap<NavigationState,{signature:string;grid:GridLike}>();
 class Grid implements GridLike {
  readonly size:number;
  readonly cells:Uint8Array;
  readonly routes=new Map<string,Point[]|null>();
  constructor(size:number,terrain:(x:number,y:number)=>string,blockers:readonly Point[]=[]){
   if(!Number.isInteger(size)||size<=0)throw Error('Navigation grid needs a positive integer size.');
   this.size=size;this.cells=new Uint8Array(size*size);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++)this.cells[y*size+x]=terrain(x,y)==='grass'?1:0;
   for(const point of blockers)if(this.inside(point.x,point.y))this.cells[point.y*size+point.x]=0;
  }
  inside(x:number,y:number):boolean{return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<this.size&&y<this.size;}
  pass(x:number,y:number):boolean{return this.inside(x,y)&&this.cells[y*this.size+x]===1;}
  approach(target:Point):boolean{return DIRECTIONS.some(([dx,dy])=>this.pass(target.x+dx,target.y+dy));}
  path(start:Point,target:Point,adjacent=false):Point[]|null{
   if(!target||!this.inside(target.x,target.y)||!this.inside(start.x,start.y))return null;
   const key=`${start.x},${start.y}:${target.x},${target.y}:${adjacent?1:0}`;
   if(this.routes.has(key))return this.clonePath(this.routes.get(key)??null);
   const size=this.size,goals=new Set<number>();
   if(!adjacent&&this.pass(target.x,target.y))goals.add(target.y*size+target.x);
   for(const [dx,dy] of DIRECTIONS)if(this.pass(target.x+dx,target.y+dy))goals.add((target.y+dy)*size+target.x+dx);
   const prev=new Int32Array(size*size).fill(-2),queue=new Int32Array(size*size);
   const origin=start.y*size+start.x;
   let head=0,tail=1,end=-1;
   queue[0]=origin;prev[origin]=-1;
   while(head<tail){
    const i=queue[head++]!;
    if(goals.has(i)){end=i;break;}
    const x=i%size,y=Math.floor(i/size);
    for(const [dx,dy] of DIRECTIONS){
     const nx=x+dx,ny=y+dy,next=ny*size+nx;
     if(this.pass(nx,ny)&&prev[next]===-2){prev[next]=i;queue[tail++]=next;}
    }
   }
   let route:Point[]|null=null;
   if(end!==-1){
    route=[];
    for(let i=end;prev[i]!==-1;i=prev[i]!)route.push({x:i%size,y:Math.floor(i/size)});
    route.reverse();
   }
   if(this.routes.size>=128){const oldest=this.routes.keys().next().value as string|undefined;if(oldest!==undefined)this.routes.delete(oldest);}
   this.routes.set(key,route);
   return this.clonePath(route);
  }
  clonePath(path:readonly Point[]|null):Point[]|null{return path===null?null:path.map(point=>({...point}));}
 }
 function grid(state:NavigationState):GridLike{
  if(state.estate&&root.LWGeography)return root.LWGeography.grid(state);
  const L=root.LW;if(!L)throw Error('Littlewild facade missing.');
  const blockers:Point[]=[...state.nodes.filter(node=>node.kind==='wood'||node.kind==='stone'),...state.buildings];
  const signature=blockers.map(point=>point.x+','+point.y).join(';');
  let entry=cache.get(state);
  if(!entry||entry.signature!==signature){entry={signature,grid:new Grid(L.SIZE,L.terrain,blockers)};cache.set(state,entry);}
  return entry.grid;
 }
 function path(state:NavigationState,target:Point,adjacent=false):Point[]|null{
  const creature=state.creature;
  return grid(state).path({x:Math.round(creature.x),y:Math.round(creature.y)},target,adjacent);
 }
 const api:NavigationApi=Object.freeze({Grid,grid,path});
 root.LWNavigation=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
