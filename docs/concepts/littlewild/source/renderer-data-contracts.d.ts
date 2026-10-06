/** Pure renderer descriptors: authored data references IDs, never executable factories. */
declare namespace LittlewildRenderer {
 type Capability='camera'|'hit-test'|'terrain-preview'|'construction-preview'|'resource-lens'|'interiors';
 type Dimension='2d'|'3d';
 interface Metadata {readonly id:string;readonly name:string;readonly description:string;readonly capabilities:readonly Capability[];readonly dimensions?:readonly Dimension[];}
 interface Catalog {list():readonly Metadata[];}
}
declare var LWRendererCatalog:LittlewildRenderer.Catalog;
