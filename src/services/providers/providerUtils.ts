export function extractLogReferences(response: string): number[] {
  const references: number[] = [];
  const patterns = [/\[Log\s*#(\d+)\]/gi, /log\s*#?(\d+)/gi, /log\s*ID\s*(\d+)/gi];

  for (const pattern of patterns) {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      const id = parseInt(match[1], 10);
      if (!isNaN(id) && !references.includes(id)) {
        references.push(id);
      }
    }
  }

  return references;
}
