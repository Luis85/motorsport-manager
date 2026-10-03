/// <reference path="./external-editor-contracts.d.ts" />
/* LDtk levels, entity definitions/instances and IntGrid terrain. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWExternalLdtk?:LWExternalEditors.Codec};
 const node=typeof module!=='undefined'&&module.exports,C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 const r=C.record,a=C.array,n=C.number;
 function fields(input:unknown):Record<string,unknown>{const out:Record<string,unknown>={};for(const value of a(input??[],'fieldInstances')){const f=r(value);if(typeof f.__identifier!=='string'||['__proto__','prototype','constructor'].includes(f.__identifier)||Object.hasOwn(out,f.__identifier))throw Error('Invalid or duplicate LDtk field.');out[f.__identifier]=f.__value;}return out;}
 const instance=(name:string,value:unknown,uid:number)=>({__identifier:name,__type:typeof value==='number'?'Int':'String',__value:value,defUid:uid,realEditorValues:[{id:typeof value==='number'?'V_Int':'V_String',params:[value]}]});
 function read(doc:Record<string,unknown>,options?:LWExternalEditors.Options):LWExternalEditors.Exchange{
  if(doc.externalLevels===true)throw Error('External LDtk level files are unsupported. Embed levels in the project.');
  const out:LWExternalEditors.Exchange={placements:[],tiles:[],warnings:[]},defs=r(doc.defs);
  if(a(defs.tilesets??[],'tileset definitions').length||a(defs.externalEnums??[],'external enums').length)out.warnings.push('LDtk tileset and external enum references are not loaded; native catalogs remain canonical.');
  const entities=new Map(a(defs.entities??[],'entity definitions').map(v=>{const e=r(v);return [n(e.uid,'entity uid'),String(e.identifier)] as const;}));
  const layerDefs=new Map(a(defs.layers??[],'layer definitions').map(v=>{const e=r(v);return [n(e.uid,'layer uid'),e] as const;}));
  for(const value of a(doc.levels,'levels')){const level=r(value),f=fields(level.fieldInstances);
   const metadata=C.decodeMetadata(f);if(metadata){if(out.metadata)throw Error('Only one selected canonical scene may be exchanged.');out.metadata=metadata;}
   const originals=metadata?C.prepare(metadata.pack,metadata.sceneId).placements:[];
   if(level.externalRelPath||level.bgRelPath)throw Error('External LDtk level/background references are unsupported.');
   for(const value of a(level.layerInstances,'layerInstances')){const layer=r(value),def=layerDefs.get(n(layer.layerDefUid,'layerDefUid'));if(!def)throw Error('Dangling LDtk layer definition.');
    const grid=n(layer.__gridSize,'grid size');if(grid<=0)throw Error('Invalid LDtk grid.');
    if(layer.__pxTotalOffsetX||layer.__pxTotalOffsetY)throw Error('Offset LDtk layers are unsupported.');
    if(layer.__type==='Entities')for(const value of a(layer.entityInstances,'entityInstances')){const e=r(value),type=entities.get(n(e.defUid,'entity defUid'));if(!type||type!==e.__identifier)throw Error('Dangling LDtk entity definition.');
     const px=a(e.px,'entity px'),field=fields(e.fieldInstances);for(const key of Object.keys(field))if(!['EntityId','Category','Inventory','Stock'].includes(key))out.warnings.push('Ignored LDtk entity field '+key+'. Canonical gameplay fields require the native editor.');const placement:LWExternalEditors.Placement={id:String(e.iid??''),type,x:(n(px[0],'entity x')+Number(level.worldX??0))/grid,y:(n(px[1],'entity y')+Number(level.worldY??0))/grid};
     if(field.EntityId!==undefined)placement.id=String(field.EntityId);if(field.Category!==undefined)placement.category=field.Category as LWSceneEditor.Category;
     if(field.Inventory!==undefined)placement.inventory=r(C.parse(field.Inventory)) as Record<string,number>;if(field.Stock!==undefined)placement.stock=n(field.Stock,'stock');
     const original=originals.find(p=>p.id===placement.id&&p.category===placement.category);if(original&&Math.round((original.x-Number(level.worldX??0)/grid)*grid)===px[0]&&Math.round((original.y-Number(level.worldY??0)/grid)*grid)===px[1]){placement.x=original.x;placement.y=original.y;}out.placements.push(placement);
    }else if(layer.__type==='IntGrid'){
     const width=n(layer.__cWid,'grid width'),height=n(layer.__cHei,'grid height'),data=a(layer.intGridCsv,'IntGrid values');
     if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height)throw Error('Invalid LDtk grid dimensions.');
     const values=new Map(a(def.intGridValues??[],'intGridValues').map(value=>{const v=r(value);return [n(v.value,'IntGrid value'),String(v.identifier)] as const;}));
     const heights=fields(level.fieldInstances).Heights;const hs=heights===undefined?[]:a(C.parseValue(heights),'heights');if(hs.length&&hs.length!==data.length)throw Error('LDtk terrain heights must match layer dimensions.');
     data.forEach((v,i)=>{const code=n(v,'IntGrid code');if(!Number.isInteger(code)||code<0)throw Error('Invalid IntGrid code.');if(!code)return;
      const name=values.get(code),ground=name==='Grass'?'grass':name==='Water'?'water':options?.terrain?.[String(code)];if(!ground)throw Error('Unmapped LDtk terrain '+code);
      out.tiles.push({x:Number(level.worldX??0)/grid+i%width,y:Number(level.worldY??0)/grid+Math.floor(i/width),ground,height:hs.length?n(hs[i],'height'):0});
     });
    }else throw Error('Unsupported LDtk layer type: '+String(layer.__type));
   }
  }
  out.warnings.push('LDtk exchanges Entities and IntGrid terrain; AutoLayers, tile images, external levels and entity deletion are unsupported.');return out;
 }
 function write(exchange:LWExternalEditors.Exchange):Record<string,unknown>{
  const minX=Math.min(exchange.bounds?.x??0,...exchange.tiles.map(t=>t.x),...exchange.placements.map(p=>p.x)),minY=Math.min(exchange.bounds?.y??0,...exchange.tiles.map(t=>t.y),...exchange.placements.map(p=>p.y));
  const width=Math.max(exchange.bounds?.width??19,...exchange.tiles.map(t=>t.x-minX+1),...exchange.placements.map(p=>p.x-minX+1)),height=Math.max(exchange.bounds?.height??19,...exchange.tiles.map(t=>t.y-minY+1),...exchange.placements.map(p=>p.y-minY+1));
  if(width*height>20000)throw Error('LDtk rectangular projection exceeds 20,000 cells. Use a selected island scene.');
  const data=new Array<number>(width*height).fill(0),heights=new Array<number>(width*height).fill(0);for(const t of exchange.tiles){const i=(t.y-minY)*width+t.x-minX;data[i]=t.ground==='grass'?1:2;heights[i]=t.height;}
  const fieldDefs=[['EntityId','String'],['Category','String'],['Inventory','String'],['Stock','Int']].map(([identifier,type],i)=>({identifier,__type:type,type,uid:10+i,isArray:false,canBeNull:true,defaultOverride:null,doc:null,min:null,max:null,regex:null,acceptFileTypes:null,allowedRefs:'Any',allowedRefsEntityUid:null,allowedRefTags:[],arrayMaxLength:null,arrayMinLength:null,editorAlwaysShow:false,editorCutLongValues:false,editorDisplayColor:null,editorDisplayMode:'Hidden',editorDisplayPos:'Above',editorLinkStyle:'ZigZag',editorShowInWorld:true,editorTextPrefix:null,editorTextSuffix:null,exportToToc:false,symmetricalRef:false,textLanguageMode:null,tilesetUid:null,allowOutOfLevelRef:false,autoChainRef:false,editorDisplayScale:1,searchable:false,useForSmartColor:false}));
  const categories=['creatures','buildings','nodes','props'];
  const entities=categories.map((category,i)=>({identifier:category,uid:100+i,width:32,height:32,resizableX:false,resizableY:false,keepAspectRatio:false,tileOpacity:1,fillOpacity:0.3,lineOpacity:1,color:['#b6d687','#c8a77c','#e3b963','#d59bb5'][i],renderMode:'Rectangle',showName:true,pivotX:0,pivotY:0,tags:[],fieldDefs,limitBehavior:'DiscardOldOnes',limitScope:'PerLevel',maxCount:0,tileId:null,tileRect:null,tilesetId:null,allowOutOfBounds:false,hollow:false,nineSliceBorders:[],doc:null,uiTileRect:null,exportToToc:false,tileRenderMode:'FitInside',minWidth:null,maxWidth:null,minHeight:null,maxHeight:null}));
  const instances=exchange.placements.map((p,i)=>({__grid:[Math.floor(p.x-minX),Math.floor(p.y-minY)],__identifier:p.category,__pivot:[0,0],__smartColor:'#b6d687',__tags:[],__tile:null,defUid:100+categories.indexOf(p.category!),height:32,width:32,iid:'entity-'+i,px:[Math.round((p.x-minX)*32),Math.round((p.y-minY)*32)],fieldInstances:[instance('EntityId',p.id,10),instance('Category',p.category,11),...(p.inventory?[instance('Inventory',JSON.stringify(p.inventory),12)]:[]),...(p.stock!==undefined?[instance('Stock',p.stock,13)]:[])]}));
  const layerBase={__cHei:height,__cWid:width,__gridSize:32,__opacity:1,__pxTotalOffsetX:0,__pxTotalOffsetY:0,autoLayerTiles:[],gridTiles:[],levelId:1,pxOffsetX:0,pxOffsetY:0,visible:true,optionalRules:[],seed:0};
  const layers=[{...layerBase,__identifier:'Entities',__type:'Entities',iid:'layer-entities',layerDefUid:2,intGridCsv:[],entityInstances:instances},{...layerBase,__identifier:'Terrain',__type:'IntGrid',iid:'layer-terrain',layerDefUid:3,intGridCsv:data,entityInstances:[]}];
  const layerDefs=['Entities','IntGrid'].map((type,i)=>({__type:type,type,identifier:i?'Terrain':'Entities',uid:2+i,gridSize:32,displayOpacity:1,pxOffsetX:0,pxOffsetY:0,intGridValues:i?[{value:1,groupUid:0,identifier:'Grass',color:'#83b86c',tile:null},{value:2,groupUid:0,identifier:'Water',color:'#6fa4bc',tile:null}]:[],autoRuleGroups:[],autoSourceLayerDefUid:null,autoTilesetDefUid:null,autoTilesKilledByOtherLayerUid:null,canSelectWhenInactive:true,doc:null,excludedTags:[],hideInList:false,intGridValuesGroups:[],parallaxFactorX:0,parallaxFactorY:0,parallaxScaling:true,requiredTags:[],tilePivotX:0,tilePivotY:0,tilesetDefUid:null,uiFilterTags:[],useAsyncRender:false,guideGridHei:0,guideGridWid:0,hideFieldsWhenInactive:true,inactiveOpacity:1,renderInWorldView:true,biomeFieldUid:null}));
  const metadataFields=Object.entries(C.encodeMetadata(exchange.metadata!));const levelFields=[{...fieldDefs[0],identifier:'Heights',uid:21},...metadataFields.map(([identifier],i)=>({...fieldDefs[0],identifier,uid:200+i}))];
  return {jsonVersion:'1.5.3',appBuildId:470000,bgColor:'#202a24',defs:{entities,layers:layerDefs,levelFields,enums:[],externalEnums:[],tilesets:[]},externalLevels:false,iid:'littlewild-project',levels:[{__bgColor:'#202a24',__smartColor:'#83b86c',__neighbours:[],identifier:'LittlewildScene',iid:'littlewild-level',uid:1,pxWid:width*32,pxHei:height*32,worldX:minX*32,worldY:minY*32,worldDepth:0,bgPivotX:0.5,bgPivotY:0.5,useAutoIdentifier:false,fieldInstances:[instance('Heights',JSON.stringify(heights),21),...metadataFields.map(([name,value],i)=>instance(name,value,200+i))],layerInstances:layers}],worlds:[],toc:[],backupLimit:10,backupOnSave:false,customCommands:[],defaultEntityHeight:32,defaultEntityWidth:32,defaultGridSize:32,defaultLevelBgColor:'#202a24',defaultPivotX:0,defaultPivotY:0,dummyWorldIid:'littlewild-world',exportLevelBg:false,exportTiled:false,flags:[],identifierStyle:'Capitalize',imageExportMode:'None',levelNamePattern:'Level_%idx',minifyJson:false,nextUid:1000,simplifiedExport:false,worldLayout:'Free'};
 }
 const api:LWExternalEditors.Codec={read,write};root.LWExternalLdtk=api;if(node)module.exports=api;
})(globalThis);
