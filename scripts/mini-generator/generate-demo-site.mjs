import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';

import { loadLeadProfile, validateDemoSite } from './lib/lead-validator.mjs';
import { buildTokenMap, replaceTokensInFile } from './lib/token-replace.mjs';
import { rewriteUrlsInFolder } from './lib/url-rewriter.mjs';

const USAGE = `Usage:
  node scripts/mini-generator/generate-demo-site.mjs \\
    --lead-profile <path/to/LEAD_PROFILES.md> \\
    --lead-id <kfz-hh-...> \\
    --template-source <path/to/template-folder> \\
    --output-target <path/to/output-folder> \\
    [--force]
`;

function parseCli() {
  const { values } = parseArgs({
    options: {
      'lead-profile': { type: 'string' },
      'lead-id': { type: 'string' },
      'template-source': { type: 'string' },
      'output-target': { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const required = ['lead-profile', 'lead-id', 'template-source', 'output-target'];
  const missing = required.filter((k) => !values[k]);
  if (missing.length) {
    console.error(`Fehlende Argumente: ${missing.map((m) => '--' + m).join(', ')}\n`);
    console.error(USAGE);
    process.exit(2);
  }

  return values;
}

function main() {
  const args = parseCli();

  const lead = loadLeadProfile(args['lead-profile'], args['lead-id']);
  const demoSite = validateDemoSite(lead.demo_site, lead.lead_id);
  const slug = lead.build_meta?.slug;
  if (!slug) {
    throw new Error(`Lead "${lead.lead_id}" hat kein build_meta.slug.`);
  }

  if (existsSync(args['output-target'])) {
    if (!args.force) {
      console.error(
        `Output-Target existiert bereits: ${args['output-target']}\n` +
        `Mit --force ueberschreiben oder Folder vorher loeschen.`
      );
      process.exit(2);
    }
    rmSync(args['output-target'], { recursive: true, force: true });
  }

  // Template kopieren — interne Doku-Files (PLACEHOLDERS.md) ausschliessen.
  cpSync(args['template-source'], args['output-target'], {
    recursive: true,
    filter: (src) => basename(src) !== 'PLACEHOLDERS.md',
  });

  // Token-Replace auf alle *.html im Output (in v2 nur index.html, aber zukunftssicher).
  const htmlFiles = readdirSync(args['output-target'], { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.html'));

  const tokenMap = buildTokenMap(demoSite);
  let totalReplacements = 0;
  for (const rel of htmlFiles) {
    totalReplacements += replaceTokensInFile(join(args['output-target'], rel), tokenMap);
  }

  // URL-Rewrite recursive — alle Text-Files, nicht nur index.html.
  const { targetHost, filesTouched } = rewriteUrlsInFolder(args['output-target'], slug);

  console.log(
    `Demo-Site fuer ${demoSite.business_name} unter ${args['output-target']} erstellt. ` +
    `${totalReplacements} Tokens ersetzt. ` +
    `URLs gerewritten zu ${targetHost} (${filesTouched.length} Files beruehrt).`
  );
}

main();
