import fs from "node:fs";
import path from "node:path";

/** Visit every tool and verification subdirectory, rather than only top-level runtime files. */
export function executableFiles(directory: string): string[] {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const file=path.join(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Executable source tree contains a symlink: ${file}`);
    return entry.isDirectory()?executableFiles(file):/\.(?:js|cjs|mjs|jsx|py)$/i.test(file)?[file]:[];
  });
}
export function assertAuthoredTypescript(directory: string): void {
  const legacy=executableFiles(directory);
  if(legacy.length)throw new Error("Authored executable source must be TypeScript: " + legacy.join(", "));
}
