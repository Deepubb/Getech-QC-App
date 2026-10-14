/**
 * Splits photos into zip parts so no part goes over the limit (unless a single
 * photo is bigger than the limit, which then gets a part of its own).
 * `overhead` is reserved in part 1 for the manifest.
 */
export function planParts(sizes: number[], limitBytes: number, overhead = 0): number[][] {
  const parts: number[][] = [[]];
  let used = overhead;
  sizes.forEach((size, index) => {
    const current = parts[parts.length - 1];
    if (current.length > 0 && used + size > limitBytes) {
      parts.push([index]);
      used = size;
    } else {
      current.push(index);
      used += size;
    }
  });
  return parts;
}

export function partFileName(prefix: string, index: number, total: number): string {
  return total > 1 ? `${prefix}_part${index + 1}of${total}.zip` : `${prefix}.zip`;
}
