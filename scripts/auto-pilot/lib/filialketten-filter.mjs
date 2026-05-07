import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadFilialkettenConfig(branche = 'kfz') {
  const path = join(__dirname, '..', 'data', `filialketten-${branche}.json`);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

export function buildFilialkettenChecker(config) {
  const flatBlockList = [];
  for (const [category, brands] of Object.entries(config.block_list)) {
    for (const brand of brands) {
      flatBlockList.push({ brand, brand_norm: normalize(brand), category });
    }
  }

  const patterns = (config.filiale_patterns || []).map((p) => ({
    id: p.id,
    regex: new RegExp(p.regex_source, p.flags || ''),
    weight: p.weight,
    match_field: p.match_field || 'name_or_address',
  }));

  return {
    flatBlockList,
    patterns,
    isFilialkette(name, address = '') {
      const lower = (name || '').toLowerCase();
      const lowerNorm = normalize(name);

      for (const entry of flatBlockList) {
        if (lower.includes(entry.brand) || lowerNorm.includes(entry.brand_norm)) {
          return { reason: `block-list:${entry.category}:${entry.brand}`, hard_dq: true };
        }
      }

      const matched = [];
      for (const p of patterns) {
        const fields = p.match_field === 'name' ? [name] : [name, address];
        if (fields.some((f) => f && p.regex.test(f))) {
          matched.push(p.id);
        }
      }
      if (matched.length >= 2) {
        return { reason: `pattern:multi:${matched.join('+')}`, hard_dq: false, penalty: -20 };
      }
      if (matched.length === 1) {
        return { reason: `pattern:${matched[0]}`, hard_dq: false, penalty: -10 };
      }

      return null;
    },
  };
}
