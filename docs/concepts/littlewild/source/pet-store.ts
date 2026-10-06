/// <reference path="./pet-contracts.d.ts" />
/**
 * Store port for premium Pocket Pet offers. A real storefront adapter would run its own purchase
 * or restore flow and report a verified result; the session then records an entitlement for the SKU.
 * The bundled adapter is an explicitly simulated demo store: it takes no payment and says so.
 */
declare namespace LWPetStore {
 interface Result {ok:boolean;sku:string;source:string;message:string;}
 interface Adapter {readonly id:string;readonly name:string;readonly simulated:boolean;readonly notice:string;purchase(sku:string):Promise<Result>;}
 interface Api {demo():Adapter;validate(adapter:unknown):Adapter;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWPetStore?:LWPetStore.Api};
 const SKU=/^[a-z][a-z0-9_.-]{2,63}$/,SOURCE=/^[a-z][a-z0-9-]{0,31}$/;
 function demo():LWPetStore.Adapter{
  return Object.freeze({id:'demo-store',name:'Demo store',simulated:true,
   notice:'This demo store is simulated. No payment is taken and nothing leaves this browser.',
   purchase:async(sku:string):Promise<LWPetStore.Result>=>SKU.test(sku)?{ok:true,sku,source:'demo-store',message:'Unlocked in the demo store.'}:{ok:false,sku,source:'demo-store',message:'Unknown store product.'}});
 }
 /** Adapters are host-provided code; only their declared shape and reported results are trusted. */
 function validate(input:unknown):LWPetStore.Adapter{
  const adapter=input as Partial<LWPetStore.Adapter>|null;
  if(!adapter||typeof adapter!=='object'||typeof adapter.purchase!=='function'||typeof adapter.id!=='string'||!SOURCE.test(adapter.id)||typeof adapter.name!=='string'||!adapter.name.trim()||typeof adapter.simulated!=='boolean'||typeof adapter.notice!=='string')
   throw Error('A store adapter needs id, name, simulated, notice and purchase(sku).');
  return adapter as LWPetStore.Adapter;
 }
 root.LWPetStore={demo,validate};
})(globalThis);
