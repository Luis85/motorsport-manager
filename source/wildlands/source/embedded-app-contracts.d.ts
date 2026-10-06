/** Optional application hosts: each template bundle publishes one descriptor global (LWRTSHost, LWPetHost);
 * a shell mounts only the descriptors present, and a play-only page runs one through standalone(). */
declare namespace LWEmbeddedApp {
 /** Shell hooks around a host taking over the page. */
 interface Hooks {beforeOpen():void;afterClose():void;}
 /** The lifecycle every host surface exposes to a shell or standalone runner. */
 interface Surface {open():void;close():void;advance(seconds:number):void;readonly active:boolean;}
 /** Standalone pages own their frame loop and show this launcher after the player exits. */
 interface StandaloneOptions {autoOpen?:boolean;}
 interface Descriptor<S extends Surface=Surface,P extends object=object> {
  /** Stable host id, also reported by the ready signal. */
  readonly id:string;
  /** Full launcher label shown in a shell, for example "RTS demo". */
  readonly label:string;
  /** Launcher data attribute (dataset key) whose value is "open". */
  readonly launcher:string;
  /** Global name of the detached public API, for example "WildlandsRTS". */
  readonly global:string;
  create(hooks:Hooks):S;
  /** Detached public API for a surface, without installing it. */
  api(surface:S):P;
  /** Install the public API under `global`; only the host module writes that global. */
  install(surface:S):P;
  standalone(options?:StandaloneOptions):S;
 }
 /** Detail of the `wildlands:ready` window event; `window.__wildlandsReady` becomes true first. */
 interface ReadyDetail {host:string;}
}
