import path from 'node:path';
import ts from 'typescript';
export interface ContractOwner {path:string;owner:string;}
export interface Context {id:string;layer:string;files:string[];}
const rank:Readonly<Record<string,number>>={domain:0,application:1,infrastructure:2,presentation:3};
/** Include erased imports/references and semantic type edges; ignore compiler/dependency libraries. */
export function contractErrors(sourceRoot:string,contexts:readonly Context[],entries:readonly ContractOwner[],files:readonly string[]):string[]{
 const errors:string[]=[],owners=new Map<string,string>(),layers=new Map(contexts.map(context=>[context.id,context.layer]));
 for(const context of contexts)for(const file of context.files)owners.set(file,context.layer);
 for(const entry of entries){
  if(owners.has(entry.path))errors.push('Duplicate contract owner: '+entry.path);
  const layer=layers.get(entry.owner);if(!layer)errors.push('Unknown contract owner: '+entry.owner);else owners.set(entry.path,layer);
 }
 for(const file of files.filter(file=>file.endsWith('.d.ts')))if(!entries.some(entry=>entry.path===file))errors.push('Unowned project contract: '+file);
 for(const entry of entries)if(!files.includes(entry.path)||!entry.path.endsWith('.d.ts'))errors.push('Missing or invalid project contract: '+entry.path);
 const program=ts.createProgram([...owners.keys()].map(file=>path.join(sourceRoot,file)),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,types:['node'],skipLibCheck:false});
 const checker=program.getTypeChecker(),reported=new Set<string>();
 function report(message:string):void{if(!reported.has(message)){reported.add(message);errors.push(message);}}
 for(const [file,layer]of owners){
  const ast=program.getSourceFile(path.join(sourceRoot,file));if(!ast)continue;
  function edge(target:string):void{
   const targetLayer=owners.get(target);if(!targetLayer)return;
   if((rank[targetLayer]??99)>(rank[layer]??99))report(file+' ('+layer+') -> type contract '+target+' ('+targetLayer+')');
  }
  for(const reference of ast.referencedFiles)edge(path.posix.normalize(path.posix.join(path.posix.dirname(file),reference.fileName)));
  function visit(node:ts.Node):void{
   if(ts.isImportDeclaration(node)&&ts.isStringLiteralLike(node.moduleSpecifier)){
    const result=ts.resolveModuleName(node.moduleSpecifier.text,ast!.fileName,program.getCompilerOptions(),ts.sys).resolvedModule;
    if(result)edge(path.relative(sourceRoot,result.resolvedFileName).replace(/\\/g,'/'));
   }
   if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteralLike(node.argument.literal)){
    const result=ts.resolveModuleName(node.argument.literal.text,ast!.fileName,program.getCompilerOptions(),ts.sys).resolvedModule;
    if(result)edge(path.relative(sourceRoot,result.resolvedFileName).replace(/\\/g,'/'));
   }
   if(ts.isIdentifier(node)){
    const symbol=checker.getSymbolAtLocation(node);
    if(symbol&&(symbol.flags&ts.SymbolFlags.Namespace))return;
    let typeLocation=ast!.isDeclarationFile;
    for(let parent:ts.Node|undefined=node;parent&&!typeLocation;parent=parent.parent)typeLocation=ts.isTypeNode(parent);
    for(const declaration of symbol?.getDeclarations()??[]){
     const targetFile=declaration.getSourceFile();
     if(program.isSourceFileDefaultLibrary(targetFile)){
      if(typeLocation&&layer!=='presentation'&&/^lib\.dom(?:\.iterable)?\.d\.ts$/.test(path.basename(targetFile.fileName)))report(file+' ('+layer+') uses DOM type '+node.text);
     }else if(!targetFile.fileName.includes('/node_modules/'))edge(path.relative(sourceRoot,targetFile.fileName).replace(/\\/g,'/'));
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(ast);
 }
 return errors;
}
