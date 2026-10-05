// Heuristics complement explicit isMock flags and human approval; neither alone proves release readiness.
export function containsReleaseMarker(value: unknown): boolean {
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 20000 || item.depth > 40) return true;
    if (typeof item.value === 'string') {
      if (item.value.length > 100000) return true;
      const text = item.value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (
        /\b(?:fictici[oa]s?|fictitious|placeholder|lorem ipsum|mock|dummy|development-v\d|local-f\d|example\.(?:com|org|net)|localhost)\b|(?:\.[a-z0-9-]+)*\.(?:test|invalid|local)\b|\b(?:127\.0\.0\.1|0\.0\.0\.0)\b|\[(?:inserir|preencher|pendente)\]|(?:ilustracao|retrato) de demonstracao|retrato em preparacao/u.test(
          text,
        ) ||
        /^\+?0{7,}$/u.test(text)
      )
        return true;
    } else if (item.value !== null && typeof item.value === 'object') {
      if (seen.has(item.value)) return true;
      seen.add(item.value);
      for (const child of Object.values(item.value))
        pending.push({ value: child, depth: item.depth + 1 });
    }
  }
  return false;
}
