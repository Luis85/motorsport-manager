/** Deterministic resource IDs keep repeated builds stable, including Three.js JSON. */
export function uuid(key: string) {
  let a = 2166136261;
  const words = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < key.length; i++) {
      a ^= key.charCodeAt(i) + j;
      a = Math.imul(a, 16777619);
    }
    words.push((a >>> 0).toString(16).padStart(8, '0'));
  }
  const hex = words.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
