#!/usr/bin/env node
import { loadFilialkettenConfig, buildFilialkettenChecker } from './lib/filialketten-filter.mjs';

const POSITIVE_LEADS = [
  { name: 'Carglass GmbH', address: 'Stresemannstraße 374, 22761 Hamburg' },
  { name: 'Carglass GmbH Lübeck-Mitte', address: 'Mecklenburger Str. 5, 23568 Lübeck' },
  { name: 'Reifen Helm GmbH', address: 'Hauptstr. 10, 24103 Kiel' },
  { name: 'KS AUTOGLAS ZENTRUM Hamburg', address: 'Wandsbeker Allee 1, 22041 Hamburg' },
  { name: 'junited AUTOGLAS Lübeck', address: 'Travemünder Allee 9, 23568 Lübeck' },
  { name: 'Wintec Autoglas Flensburg', address: 'Schiffbrücke 1, 24937 Flensburg' },
  { name: 'Driver Center Husum', address: 'Norderstr. 5, 25813 Husum' },
  { name: 'A.T.U Auto-Teile-Unger Hamburg-Wandsbek', address: 'Wandsbeker Marktstr. 7, 22041 Hamburg' },
  { name: 'pit-stop Hamburg-Eidelstedt', address: 'Kieler Str. 99, 22529 Hamburg' },
  { name: 'Vergölst Reifen + Autoservice Neumünster', address: 'Plöner Str. 100, 24536 Neumünster' },
  { name: 'TyreXpert Reifen + Autoservice', address: 'Bad Bramstedt' },
  { name: 'AUTOGLAS SPEZIALIST Kiel', address: 'Kiel' },
  { name: 'reifencom GmbH', address: 'Hannover' },
  { name: 'Quick Reifendiscount Lübeck', address: 'Lübeck' },
  { name: 'Reifen Blötz GmbH (ehemals Gummi Grassau)', address: 'Lübeck' },
];

const NEGATIVE_LEADS = [
  { name: 'AutoPro Service Thomas', address: 'Hamburg' },
  { name: 'Werkstatt Müller GmbH', address: 'Kiel' },
  { name: 'KFZ-Meisterbetrieb Hansen', address: 'Lübeck' },
  { name: 'Autohaus am Bahnhof', address: 'Pinneberg' },
  { name: 'Karosseriebau Petersen', address: 'Husum' },
  { name: 'Lackiererei Jensen', address: 'Flensburg' },
  { name: 'KFZ Werkstatt Schmidt', address: 'Norderstedt' },
  { name: 'Auto Service GmbH Behrens', address: 'Itzehoe' },
];

async function main() {
  const config = await loadFilialkettenConfig('kfz');
  const checker = buildFilialkettenChecker(config);

  console.log(`Block-Liste: ${checker.flatBlockList.length} Brands, ${checker.patterns.length} Pattern\n`);

  let posPass = 0;
  let posFail = 0;
  console.log('=== POSITIVE TESTS (sollen geblockt werden) ===');
  for (const lead of POSITIVE_LEADS) {
    const result = checker.isFilialkette(lead.name, lead.address);
    if (result) {
      posPass++;
      console.log(`  ✅ ${lead.name} → ${result.reason}`);
    } else {
      posFail++;
      console.log(`  ❌ ${lead.name} → DURCHGELASSEN!`);
    }
  }

  let negPass = 0;
  let negFail = 0;
  console.log('\n=== NEGATIVE TESTS (sollen durchkommen) ===');
  for (const lead of NEGATIVE_LEADS) {
    const result = checker.isFilialkette(lead.name, lead.address);
    if (!result) {
      negPass++;
      console.log(`  ✅ ${lead.name} → durchgelassen`);
    } else {
      negFail++;
      console.log(`  ❌ ${lead.name} → fälschlich geblockt: ${result.reason}`);
    }
  }

  const total = POSITIVE_LEADS.length + NEGATIVE_LEADS.length;
  const passed = posPass + negPass;
  console.log(`\n=== ERGEBNIS ===`);
  console.log(`Positive: ${posPass}/${POSITIVE_LEADS.length} korrekt geblockt`);
  console.log(`Negative: ${negPass}/${NEGATIVE_LEADS.length} korrekt durchgelassen`);
  console.log(`Total: ${passed}/${total} = ${Math.round((passed / total) * 100)}%`);

  if (posFail > 0 || negFail > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
