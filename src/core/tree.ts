interface Node {
  name: string;
  children: Map<string, Node>;
}

/** Draws zip paths as a folder tree, keeping the order the paths came in. */
export function treeLines(paths: string[]): string[] {
  const root: Node = { name: '', children: new Map() };
  for (const p of paths) {
    let at = root;
    for (const part of p.split('/')) {
      if (!at.children.has(part)) at.children.set(part, { name: part, children: new Map() });
      at = at.children.get(part)!;
    }
  }
  const out: string[] = [];
  const walk = (n: Node, prefix: string) => {
    const kids = [...n.children.values()];
    kids.forEach((k, i) => {
      const last = i === kids.length - 1;
      out.push(`${prefix}${last ? '└─' : '├─'} ${k.name}${k.children.size ? '/' : ''}`);
      walk(k, prefix + (last ? '   ' : '│  '));
    });
  };
  walk(root, '');
  return out;
}
