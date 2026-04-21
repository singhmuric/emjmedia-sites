// FNV-1a 32-bit slug hash → variant 'a' | 'b' | 'c'.
// Deterministic, no crypto, no deps. Plan §5.2.

const VARIANTS = ['a', 'b', 'c'];

export function hashSlug(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function variantFromSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error('variantFromSlug: slug must be a non-empty string');
  }
  return VARIANTS[hashSlug(slug) % VARIANTS.length];
}

export function resolveVariant(lead) {
  const override = lead?.designvariante;
  if (override && VARIANTS.includes(override)) return override;
  if (override != null && override !== '') {
    throw new Error(`resolveVariant: invalid designvariante "${override}", expected a|b|c|null`);
  }
  return variantFromSlug(lead.slug);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const samples = [
    'kfz-kaltenkirchen-mueller',
    'kfz-hamburg-schmidt',
    'kfz-muenchen-bauer',
    'kfz-berlin-kraemer',
    'kfz-koeln-weber',
    'kfz-frankfurt-fischer',
    'kfz-stuttgart-becker',
    'kfz-leipzig-hoffmann',
    'kfz-dresden-schulz',
    'kfz-nuernberg-zimmermann',
    'kfz-hannover-meyer',
    'kfz-bremen-koehler',
    'kfz-essen-vogel',
    'kfz-dortmund-keller',
    'kfz-duesseldorf-pohl',
  ];
  const counts = { a: 0, b: 0, c: 0 };
  console.log('FNV-1a variant selftest:');
  for (const slug of samples) {
    const v = variantFromSlug(slug);
    counts[v]++;
    console.log(`  ${slug.padEnd(34)} → ${v}`);
  }
  console.log(`\nDistribution over ${samples.length} slugs: a=${counts.a}, b=${counts.b}, c=${counts.c}`);

  const overrideTest = resolveVariant({ slug: 'foo', designvariante: 'b' });
  console.log(`\nOverride test (designvariante='b'): ${overrideTest === 'b' ? 'OK' : 'FAIL'}`);

  const fallbackTest = resolveVariant({ slug: 'kfz-kaltenkirchen-mueller', designvariante: null });
  console.log(`Null-override fallback to hash: ${fallbackTest}`);
}
