/** Pure animation IDs, provenance and bounded authored descriptors; no drawing or DOM ports. */
declare namespace LWAnimations {
 interface Descriptor {readonly id:string;readonly presetId:string;readonly start:number;readonly duration:number;readonly x:number;readonly y:number;readonly radius:number;readonly color:string;readonly count:number;readonly seed?:number;}
 interface Metadata {readonly id:string;readonly name:string;readonly description:string;readonly source?:string;}
}
declare var LWAnimationCatalog:{list():readonly (LWAnimations.Metadata&{readonly parameters:readonly {readonly key:string;readonly min?:number;readonly max?:number}[]})[]};
