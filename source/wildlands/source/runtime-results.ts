/// <reference path="./runtime-contracts.d.ts" />
/* Failure metadata is additive: rule authorities continue to own decisions and text. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRuntimeResults?:LWRuntime.ResultsApi};
 const codes:readonly LWRuntime.FailureCode[]=Object.freeze(['rule-rejected','invalid-command','unknown-command','unavailable-command','invalid-target','invalid-data','busy','insufficient-resources','settlement-rejected']);
 function failure(reason:string,code:LWRuntime.FailureCode='rule-rejected'):LWRuntime.Failure{return {ok:false,reason,code};}
 function success():{ok:true};
 function success<T extends object>(data:T):{ok:true}&T;
 function success(data:object={}):{ok:true}{return {ok:true,...data};}
 function annotate<T>(value:T,code:LWRuntime.FailureCode='rule-rejected'):T{
  if(value&&typeof value==='object'&&'ok'in value&&value.ok===false&&!('code'in value))return {...value,code};
  return value;
 }
 root.LWRuntimeResults=Object.freeze({codes,failure,success,annotate});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRuntimeResults;
})(globalThis);
