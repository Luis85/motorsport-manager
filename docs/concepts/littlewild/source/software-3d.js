/* Offline triangle renderer for the SAME 3D scene. No substitute screenshot.
 * Static geometry is projected once and spatially indexed. A bounded, overscanned
 * color/depth surface survives panning; only moving parts are rasterized each frame.
 * Simulation data/RNG are read-only. All counters below are presentation diagnostics. */
(function(root){'use strict';const T=root.THREE,SQ=Math.SQRT1_2,EL=1/Math.sqrt(6),UP=Math.sqrt(2/3);
 class Software3D{
  constructor(canvas,owner){this.domElement=canvas;this.owner=owner;this.ctx=canvas.getContext('2d',{alpha:false});this.info={render:{calls:0,triangles:0},memory:{geometries:0}};this.shadowMap={};this.last=0;this.tmp=new T.Matrix4();this.surface=document.createElement('canvas');this.surfaceCtx=this.surface.getContext('2d');this.frameCount=0;this.cacheHits=0;this.cacheBuilds=0;this.geometryBuilds=0;this.quality='balanced';this.lastMs=0;this.staticIndex=new Map();this.staticTriangles=[];this.staticVersion=null;this.meshCache=new WeakMap();this.dynamicCacheHits=0;this.translationCacheHits=0;this.triangleBuilds=0;}
  setPixelRatio(){} setSize(w,h){if(this.domElement.width!==w)this.domElement.width=w;if(this.domElement.height!==h)this.domElement.height=h;}
  setQuality(q){if(this.quality!==q){this.quality=q;this.staticSurface=null;}}
  dispose(){this.staticIndex.clear();this.staticTriangles=[];this.image=null;this.depth=null;this.staticSurface=null;}
  color(material,normal){const color=material.color.clone(),sun=Math.max(0,normal.x*-.38+normal.y*.87+normal.z*.30);color.multiplyScalar(.49+Math.max(0,normal.y)*.17+sun*.44);if(material.emissive)color.add(material.emissive.clone().multiplyScalar(material.emissiveIntensity||0));color.convertLinearToSRGB();return [Math.min(255,Math.round(color.r*255)),Math.min(255,Math.round(color.g*255)),Math.min(255,Math.round(color.b*255))];}
  triangles(mesh,matrix){this.triangleBuilds++;const geom=mesh.geometry,pos=geom.attributes.position,idx=geom.index?.array,mat=mesh.material;if(!pos||!mat||Array.isArray(mat))return[];
   const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),count=idx?idx.length:pos.count,out=[];
   for(let j=0;j<count;j+=3){a.fromBufferAttribute(pos,idx?idx[j]:j).applyMatrix4(matrix);b.fromBufferAttribute(pos,idx?idx[j+1]:j+1).applyMatrix4(matrix);c.fromBufferAttribute(pos,idx?idx[j+2]:j+2).applyMatrix4(matrix);normal.crossVectors(u.subVectors(b,a),v.subVectors(c,a)).normalize();if(mat.side!==T.DoubleSide&&normal.x+normal.y+normal.z<-.001)continue;
    const p=[(a.x-a.z)*SQ,(a.x+a.z)*EL-a.y*UP,a.x+a.y+a.z,(b.x-b.z)*SQ,(b.x+b.z)*EL-b.y*UP,b.x+b.y+b.z,(c.x-c.z)*SQ,(c.x+c.z)*EL-c.y*UP,c.x+c.y+c.z];
    out.push({p,color:this.color(mat,normal),alpha:mat.transparent?mat.opacity:1,depthWrite:mat.depthWrite!==false,overlay:mat.depthTest===false,minX:Math.min(p[0],p[3],p[6]),maxX:Math.max(p[0],p[3],p[6]),minY:Math.min(p[1],p[4],p[7]),maxY:Math.max(p[1],p[4],p[7]),z:p[2]+p[5]+p[8]});}
   return out;
  }
  raster(t,k,cx,cy,w,h){const p=t.p,x0=p[0]*k+cx,y0=p[1]*k+cy,z0=p[2],x1=p[3]*k+cx,y1=p[4]*k+cy,z1=p[5],x2=p[6]*k+cx,y2=p[7]*k+cy,z2=p[8];
   const minx=Math.max(0,Math.floor(t.minX*k+cx)),maxx=Math.min(w-1,Math.ceil(t.maxX*k+cx)),miny=Math.max(0,Math.floor(t.minY*k+cy)),maxy=Math.min(h-1,Math.ceil(t.maxY*k+cy));if(minx>maxx||miny>maxy)return false;
   const area=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2);if(Math.abs(area)<.0001)return false;
   const ax=(y1-y2)/area,ay=(x2-x1)/area,bx=(y2-y0)/area,by=(x0-x2)/area,za=z0-z2,zb=z1-z2,depth=this.depth,data=this.image.data,col=t.color,alpha=t.alpha;
   let ar=ax*(minx+.5-x2)+ay*(miny+.5-y2),br=bx*(minx+.5-x2)+by*(miny+.5-y2);
   for(let y=miny;y<=maxy;y++,ar+=ay,br+=by){let a=ar,b=br,index=y*w+minx;for(let x=minx;x<=maxx;x++,index++,a+=ax,b+=bx){if(a<-.00005||b<-.00005||a+b>1.00005)continue;const z=z2+a*za+b*zb;if(!t.overlay&&z<depth[index])continue;const i=index*4;if(alpha>=.98){if(t.depthWrite&&!t.overlay)depth[index]=z;data[i]=col[0];data[i+1]=col[1];data[i+2]=col[2];}else{data[i]=data[i]*(1-alpha)+col[0]*alpha;data[i+1]=data[i+1]*(1-alpha)+col[1]*alpha;data[i+2]=data[i+2]*(1-alpha)+col[2]*alpha;}}}return true;
  }
  meshTriangles(mesh){
   if(mesh.isInstancedMesh){const out=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,this.tmp);this.tmp.premultiply(mesh.matrixWorld);out.push(...this.triangles(mesh,this.tmp));}return out;}
   const e=mesh.matrixWorld.elements,m=mesh.material,stamp=mesh.geometry.uuid+':'+mesh.geometry.attributes.position.version+':'+(mesh.geometry.index?.version||0)+':'+m.uuid+':'+m.color.getHex()+':'+m.opacity+':'+m.emissiveIntensity+':'+m.emissive?.getHex()+':'+m.side+':'+m.depthTest+':'+m.depthWrite+':'+m.transparent,cache=this.meshCache.get(mesh);
   if(cache&&cache.stamp===stamp){
    if(cache.matrix.every((v,i)=>v===e[i])){this.dynamicCacheHits++;return cache.tris;}
    // Translation changes screen position, not face normals or lit colors. Reuse
    // the original projected basis without accumulating floating-point deltas.
    if([0,1,2,3,4,5,6,7,8,9,10,11,15].every(i=>cache.basis[i]===e[i])){
     const dx=e[12]-cache.basis[12],dy=e[13]-cache.basis[13],dz=e[14]-cache.basis[14],px=(dx-dz)*SQ,py=(dx+dz)*EL-dy*UP,pz=dx+dy+dz;
     cache.original??=cache.tris.map(t=>({p:t.p.slice(),minX:t.minX,maxX:t.maxX,minY:t.minY,maxY:t.maxY,z:t.z}));
     for(let i=0;i<cache.tris.length;i++){const t=cache.tris[i],b=cache.original[i];for(let j=0;j<9;j+=3){t.p[j]=b.p[j]+px;t.p[j+1]=b.p[j+1]+py;t.p[j+2]=b.p[j+2]+pz;}t.minX=b.minX+px;t.maxX=b.maxX+px;t.minY=b.minY+py;t.maxY=b.maxY+py;t.z=b.z+pz*3;}
     cache.matrix=e.slice();this.translationCacheHits++;return cache.tris;
    }
   }
   const tris=this.triangles(mesh,mesh.matrixWorld);this.meshCache.set(mesh,{stamp,matrix:e.slice(),basis:e.slice(),tris});return tris;
  }
  rebuildStatic(sceneRoot,version){this.staticTriangles=[];this.staticIndex.clear();this.staticSurface=null;this.staticVersion=version;this.geometryBuilds++;this.staticCalls=0;
   sceneRoot.traverseVisible(mesh=>{if(!mesh.isMesh)return;this.staticCalls++;this.staticTriangles.push(...this.meshTriangles(mesh));});
   this.staticTriangles.forEach((t,id)=>{t.id=id;for(let x=Math.floor(t.minX/4);x<=Math.floor(t.maxX/4);x++)for(let y=Math.floor(t.minY/4);y<=Math.floor(t.maxY/4);y++){const key=x+','+y;if(!this.staticIndex.has(key))this.staticIndex.set(key,[]);this.staticIndex.get(key).push(id);}});
  }
  staticRegion(k,cx,cy,w,h){const ids=new Set();for(let x=Math.floor(-cx/k/4);x<=Math.floor((w-cx)/k/4);x++)for(let y=Math.floor(-cy/k/4);y<=Math.floor((h-cy)/k/4);y++)for(const id of this.staticIndex.get(x+','+y)||[])ids.add(id);return [...ids].map(id=>this.staticTriangles[id]);}
  background(w,h){this.depth.fill(-Infinity);const packed=new Uint32Array(this.image.data.buffer);packed.fill(0xffc8c6a1);}
  base(k,cx,cy,w,h){let c=this.staticSurface,dx=c?cx-c.cx:0,dy=c?cy-c.cy:0;
   if(!c||c.k!==k||c.w!==w||c.h!==h||Math.abs(dx)>c.pad||Math.abs(dy)>c.pad){
    // Zoom needs the visible rectangle, not off-screen padding. Preserve allocations
    // while scale changes; expand only when an actual pan needs an overscan margin.
    const pad=c&&c.k!==k?0:128,width=w+pad*2,height=h+pad*2,oldImage=this.image,oldDepth=this.depth;
    const image=c?.width===width&&c?.height===height?c.image:this.surfaceCtx.createImageData(width,height),depth=c?.width===width&&c?.height===height?c.depth:new Float32Array(width*height);this.image=image;this.depth=depth;this.background(width,height);
    const tris=this.staticRegion(k,cx+pad,cy+pad,width,height),transparent=[];for(const t of tris){if(t.alpha<.98)transparent.push(t);else this.raster(t,k,cx+pad,cy+pad,width,height);}transparent.sort((a,b)=>a.z-b.z);for(const t of transparent)this.raster(t,k,cx+pad,cy+pad,width,height);
    this.image=oldImage;this.depth=oldDepth;this.staticSurface=c={k,cx,cy,w,h,pad,width,height,image,depth,visibleTriangles:tris.length};this.cacheBuilds++;dx=dy=0;
   }else this.cacheHits++;
   const left=c.pad-dx,top=c.pad-dy;
   for(let y=0;y<h;y++){let start=(y+top)*c.width+left;this.image.data.set(c.image.data.subarray(start*4,(start+w)*4),y*w*4);this.depth.set(c.depth.subarray(start,start+w),y*w);}
  }
  render(scene){const started=performance.now(),o=this.owner;scene.updateMatrixWorld();const limits=this.quality==='high'?[1500,950]:this.quality==='eco'?[800,520]:[1100,720];const scale=Math.min(1,limits[0]/this.domElement.width,limits[1]/this.domElement.height),w=Math.max(1,Math.floor(this.domElement.width*scale)),h=Math.max(1,Math.floor(this.domElement.height*scale));
   if(!this.image||this.surface.width!==w||this.surface.height!==h){this.surface.width=w;this.surface.height=h;this.image=this.surfaceCtx.createImageData(w,h);this.depth=new Float32Array(w*h);}
   const k=42*o.camera.z*scale,cx=Math.round(w/2+o.camera.x*scale),cy=Math.round(h/2-18*k/Math.sqrt(6)+o.camera.y*scale),staticRoot=o.staticRoot;
   if(staticRoot){const version=staticRoot.uuid+':'+(o.staticRevision||0);if(this.staticVersion!==version)this.rebuildStatic(staticRoot,version);this.base(k,cx,cy,w,h);}else this.background(w,h);
   const transparent=[],overlay=[],geoms=new Set();let count=0,draws=0;
   function visit(object){if(!object.visible||object===staticRoot)return;const radius=object.userData?.radius;if(radius){const p=object.matrixWorld.elements,x=(p[12]-p[14])*SQ*k+cx,y=((p[12]+p[14])*EL-p[13]*UP)*k+cy,span=radius*k;if(x+span<0||x-span>w||y+span<0||y-span>h)return;}if(object.isMesh&&!(object.geometry.type==='PlaneGeometry'&&object.geometry.parameters.width>100)){geoms.add(object.geometry.uuid);draws++;for(const t of this.meshTriangles(object)){if(t.overlay)overlay.push(t);else if(t.alpha<.98)transparent.push(t);else if(this.raster(t,k,cx,cy,w,h))count++;}}for(const child of object.children)visit.call(this,child);}
   visit.call(this,scene);transparent.sort((a,b)=>a.z-b.z);for(const t of [...transparent,...overlay])if(this.raster(t,k,cx,cy,w,h))count++;
   this.surfaceCtx.putImageData(this.image,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.drawImage(this.surface,0,0,this.domElement.width,this.domElement.height);this.info.render={calls:draws+(this.staticCalls||0),triangles:count+(this.staticSurface?.visibleTriangles||0)};this.info.memory.geometries=geoms.size;this.frameCount++;this.lastMs=performance.now()-started;
  }
  diagnostics(){const c=this.staticSurface;return{frames:this.frameCount,staticGeometryBuilds:this.geometryBuilds,staticRasterBuilds:this.cacheBuilds,staticCacheHits:this.cacheHits,dynamicCacheHits:this.dynamicCacheHits,translationCacheHits:this.translationCacheHits,triangleBuilds:this.triangleBuilds,cacheBytes:c?c.image.data.byteLength+c.depth.byteLength:0,rasterWidth:this.surface.width,rasterHeight:this.surface.height,lastFrameMs:+this.lastMs.toFixed(2)};}
 }
 root.LWSoftware3D=Software3D;
})(typeof globalThis!=='undefined'?globalThis:this);
