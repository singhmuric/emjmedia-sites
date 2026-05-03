// Live-Workflow-Patcher: nimmt /tmp/live-workflow.json (mit echten Credential- + Sheet-IDs)
// und appliziert dieselben 3 Patches wie patch-workflow.cjs auf die LOKALE Datei,
// damit Sheet-ID + Credentials beim PUT erhalten bleiben.

const fs = require('fs');
const path = require('path');

const LIVE_PATH = '/tmp/live-workflow.json';
const REPO_PATH = path.resolve(__dirname, '../../workflows/n8n/leadhunter_kfz_sh.json');
const OUT_PATH = '/tmp/live-workflow-patched.json';

const liveWf = JSON.parse(fs.readFileSync(LIVE_PATH, 'utf8'));
const repoWf = JSON.parse(fs.readFileSync(REPO_PATH, 'utf8'));

// Extract patched nodes from repo
const repoPreQual = repoWf.nodes.find(n => n.name === 'Pre-Qualifizierung');
const repoBriefing = repoWf.nodes.find(n => n.name === 'Briefing Markdown Generator');
const repoSheetsAppend = repoWf.nodes.find(n => n.name === 'Sheets Append Lead');

// Get live nodes by name
const liveScoreCalcIdx = liveWf.nodes.findIndex(n => n.name === 'Score Calc + Build Sheet Row');
const liveSheetsAppend = liveWf.nodes.find(n => n.name === 'Sheets Append Lead');
const liveBriefing = liveWf.nodes.find(n => n.name === 'Briefing Markdown Generator');
const liveSheetsRead = liveWf.nodes.find(n => n.name === 'Sheets Read existing place_ids');

if (liveScoreCalcIdx === -1) throw new Error('Score Calc not found in live');
if (!liveSheetsAppend) throw new Error('Sheets Append not found in live');
if (!liveBriefing) throw new Error('Briefing not found in live');

// 1. Pre-Qualifizierungs-Node — nutze repo-version, gib eine FRESH UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
const preQualNode = JSON.parse(JSON.stringify(repoPreQual));
preQualNode.id = uuid();

// Insert after Score Calc
liveWf.nodes.splice(liveScoreCalcIdx + 1, 0, preQualNode);

// Re-position downstream
const SHIFT_NAMES = ['Sheets Append Lead', 'Sheets Read All (post-append)', 'Top 10 Selector', 'Briefing Markdown Generator', 'HTTP Filewriter (Vault Briefing)'];
for (const n of liveWf.nodes) {
  if (SHIFT_NAMES.includes(n.name)) {
    n.position = [n.position[0] + 100, n.position[1]];
  }
}

// 2. Update Sheets Append Lead mappings + schema
// Behalte credentials + documentId — replace nur columns
liveSheetsAppend.parameters.columns = JSON.parse(JSON.stringify(repoSheetsAppend.parameters.columns));

// 3. Replace Briefing JS-Code — Sheet-ID aus live einsetzen
const liveSheetId = liveSheetsRead.parameters.documentId.value;
let briefingJs = repoBriefing.parameters.jsCode;
briefingJs = briefingJs.replace(/var SHEET_ID = '[^']*';/, `var SHEET_ID = '${liveSheetId}';`);
liveBriefing.parameters.jsCode = briefingJs;

// 4. Update connections
liveWf.connections['Score Calc + Build Sheet Row'] = {
  main: [[{ node: 'Pre-Qualifizierung', type: 'main', index: 0 }]]
};
liveWf.connections['Pre-Qualifizierung'] = {
  main: [[{ node: 'Sheets Append Lead', type: 'main', index: 0 }]]
};

// 5. Strip read-only fields that PUT rejects (n8n public API)
// settings darf nur eine bestimmte Property-Whitelist enthalten —
// availableInMCP, binaryMode, callerPolicy etc. werfen 400.
const SETTINGS_ALLOWED = ['executionOrder', 'saveExecutionProgress', 'saveManualExecutions',
  'saveDataErrorExecution', 'saveDataSuccessExecution', 'errorWorkflow', 'timezone',
  'executionTimeout'];
const sanitizedSettings = {};
for (const k of SETTINGS_ALLOWED) {
  if (liveWf.settings && liveWf.settings[k] !== undefined) sanitizedSettings[k] = liveWf.settings[k];
}
const PUT_ALLOWED = ['name', 'nodes', 'connections', 'settings', 'staticData'];
const putBody = {};
for (const k of PUT_ALLOWED) {
  if (k === 'settings') putBody[k] = sanitizedSettings;
  else if (liveWf[k] !== undefined) putBody[k] = liveWf[k];
}

fs.writeFileSync(OUT_PATH, JSON.stringify(putBody, null, 2));
console.log('OK — patched live workflow written to', OUT_PATH);
console.log('Sheet-ID injected:', liveSheetId);
console.log('Pre-Qual node UUID:', preQualNode.id);
console.log('Total nodes:', putBody.nodes.length);
console.log('Append cols:', Object.keys(liveSheetsAppend.parameters.columns.value).length);
