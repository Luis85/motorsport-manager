/**
 * A small TypeScript lexer for the architecture check: removes comments and, separately, string contents, keeping every
 * line break so line numbers stay valid. Template literals (with nested `${…}` holes) count as code, like the repository's
 * advisory quality gate (scripts/quality_loc.py), which remains the authoritative line count. Regular-expression literals
 * are not recognised; this project's rules avoid comment markers inside them.
 */
export interface Scanned {
 /** Source without comments (string and template text kept): what the code-line budget counts. */
 readonly code: string;
 /** Source without comments and with string and template text blanked: what identifier rules inspect. */
 readonly bare: string;
}

export function scan(text: string): Scanned {
 let code = '', bare = '', i = 0;
 const holes: number[] = [];
 const keep = (char: string, inString: boolean) => { code += char; bare += inString && char !== '\n' ? ' ' : char; };
 const quoted = (quote: string) => {
  keep(quote, false); i++;
  while (i < text.length && text[i] !== quote && text[i] !== '\n') {
   if (text[i] === '\\') { keep(text[i]!, true); i++; }
   if (i < text.length) { keep(text[i]!, true); i++; }
  }
  if (i < text.length) { keep(text[i]!, text[i] === '\n'); i++; }
 };
 const template = () => {
  // Called at a backtick or at the `}` closing a hole; scans template text up to its end or the next `${`.
  keep(text[i]!, false); i++;
  while (i < text.length) {
   const char = text[i]!;
   if (char === '\\') { keep(char, true); keep(text[i + 1] ?? '', true); i += 2; continue; }
   if (char === '`') { keep(char, false); i++; return; }
   if (char === '$' && text[i + 1] === '{') { keep('$', false); keep('{', false); i += 2; holes.push(0); return; }
   keep(char, true); i++;
  }
 };
 while (i < text.length) {
  const char = text[i]!, next = text[i + 1];
  if (char === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
  if (char === '/' && next === '*') {
   const end = text.indexOf('*/', i + 2), stop = end < 0 ? text.length : end + 2;
   for (const skipped of text.slice(i, stop)) if (skipped === '\n') keep('\n', false);
   i = stop; continue;
  }
  if (char === '"' || char === "'") { quoted(char); continue; }
  if (char === '`') { template(); continue; }
  if (holes.length && char === '{') holes[holes.length - 1]!++;
  if (holes.length && char === '}') {
   if (holes[holes.length - 1] === 0) { holes.pop(); template(); continue; }
   holes[holes.length - 1]!--;
  }
  keep(char, false); i++;
 }
 return {code, bare};
}

/** Physical lines holding code (comments and blank lines excluded). */
export function codeLines(text: string): number {
 return scan(text).code.split('\n').filter(line => line.trim() !== '').length;
}
