// Wendet Phase-2-Patches auf workflows/n8n/leadhunter_kfz_sh.json an.
// Idempotent: kann mehrfach laufen, ersetzt jedes Mal den vollen Body.
//
// Aufruf: node _logs/phase2-smoke/apply-patches.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const wfPath = join(repoRoot, 'workflows', 'n8n', 'leadhunter_kfz_sh.json');

const wf = JSON.parse(readFileSync(wfPath, 'utf8'));

function getNode(name) {
  const n = wf.nodes.find(x => x.name === name);
  if (!n) throw new Error('Node not found: ' + name);
  return n;
}

// === Patch 3: HTTP Website Fetch + HTTP Impressum Fetch — responseFormat: 'file'
for (const nodeName of ['HTTP Website Fetch', 'HTTP Impressum Fetch']) {
  const node = getNode(nodeName);
  const opts = node.parameters.options || {};
  opts.response = opts.response || { response: {} };
  opts.response.response = opts.response.response || {};
  opts.response.response.responseFormat = 'file';
  // outputPropertyName bleibt default = 'data', daher item.binary.data
  opts.response.response.fullResponse = true;
  opts.response.response.neverError = true;
  node.parameters.options = opts;
  console.log('  ✓ ' + nodeName + ' — responseFormat=file gesetzt');
}

// === Patches 1, 2, 3, 4: HTML Truncate + Merge Context — neuer Code-Body
const truncateBody = readFileSync(join(__dirname, 'truncate-v2.code.js'), 'utf8');
const truncate = getNode('HTML Truncate + Merge Context');
truncate.parameters.jsCode = truncateBody;
console.log('  ✓ HTML Truncate + Merge Context — neuer Body (' + truncateBody.length + ' chars)');

// === Patches 2, 4: Score Calc + Build Sheet Row — neuer Code-Body
const scoreBody = readFileSync(join(__dirname, 'score-calc-v2.code.js'), 'utf8');
const score = getNode('Score Calc + Build Sheet Row');
score.parameters.jsCode = scoreBody;
console.log('  ✓ Score Calc + Build Sheet Row — neuer Body (' + scoreBody.length + ' chars)');

// Version-Bump
wf.versionId = '2';

writeFileSync(wfPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log('\n  Geschrieben: ' + wfPath);
console.log('  Lines: ' + readFileSync(wfPath, 'utf8').split('\n').length);
