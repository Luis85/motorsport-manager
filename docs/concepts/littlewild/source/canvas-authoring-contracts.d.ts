/** Portable, bounded graph presentation data; pixels never describe physical space. */
declare namespace LWCanvasAuthoring {
 interface Authoring {version:1;nodes:Record<string,Record<string,unknown>>;edges:Record<string,Record<string,unknown>>;metadata?:Record<string,unknown>;}
 interface Api {validate(pack:LWContentPorts.ScenarioPack):void;reconcile(previous:LWContentPorts.ScenarioPack,next:LWContentPorts.ScenarioPack):void;}
}
