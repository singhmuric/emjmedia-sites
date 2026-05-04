#!/usr/bin/env node
// Reply-Classifier Test-Suite — 50+ deutsche Cold-Mail-Reply-Beispiele pro Kategorie.
// Zeigt Confusion-Matrix + Accuracy. Sicherheits-Check für lib/reply-classifier.mjs
// bevor er auf Live-Replies losgelassen wird.
//
// Usage:
//   node test-reply-classifier.mjs
//   node test-reply-classifier.mjs --use-haiku    # auch Haiku-Fallback testen
//   node test-reply-classifier.mjs --verbose      # zeigt Detail pro Mismatch
//
// Akzeptanz-Schwelle: ≥ 90% Accuracy für deterministische Pattern-Erkennung.
// Unter 90%: Pattern-Library erweitern oder Haiku-Fallback verbindlich machen.

import { parseArgs } from 'node:util';
import { classifyReply } from './lib/reply-classifier.mjs';

const TEST_CASES = [
  // ===== POSITIV (Interesse, Termin, Rückruf, Detail-Anfrage) =====
  { text: 'Hallo Herr Muric, klingt interessant. Können Sie mich morgen anrufen?', expected: 'positiv' },
  { text: 'Ja gerne, rufen Sie mich am besten zwischen 14 und 16 Uhr an.', expected: 'positiv' },
  { text: 'Hört sich gut an. Was würde das denn kosten?', expected: 'positiv' },
  { text: 'Lassen Sie uns einen Termin machen — wann hätten Sie Zeit?', expected: 'positiv' },
  { text: 'Grundsätzlich interessiert. Können Sie mir mehr Infos schicken?', expected: 'positiv' },
  { text: 'Schönes Konzept. Können wir uns mal kurz telefonieren?', expected: 'positiv' },
  { text: 'Die Demo gefällt mir. Wie geht es weiter?', expected: 'positiv' },
  { text: 'Sieht gut aus. Termin diese Woche möglich?', expected: 'positiv' },
  { text: 'Schicken Sie mir bitte ein Angebot.', expected: 'positiv' },
  { text: 'Bin am Wochenende erreichbar — gerne ein kurzer Call.', expected: 'positiv' },
  { text: 'Klingt spannend. Welche Optionen gibt es preislich?', expected: 'positiv' },
  { text: 'Rufen Sie mich bitte unter 040 123456 zurück.', expected: 'positiv' },
  { text: 'Ja das interessiert mich. Schicken Sie mir bitte Unterlagen.', expected: 'positiv' },
  { text: 'Ihre Demo gefällt — moderner als unsere aktuelle Seite. Können wir reden?', expected: 'positiv' },
  { text: 'Gerne mehr Details bitte.', expected: 'positiv' },

  // ===== NEGATIV (Absage, Stopp, Spam-Beschwerde, höfliche Absage) =====
  { text: 'Kein Interesse, danke.', expected: 'negativ' },
  { text: 'Wir sind nicht interessiert. Bitte aus dem Verteiler entfernen.', expected: 'negativ' },
  { text: 'Bitte keine weiteren Mails. Aus der Liste streichen.', expected: 'negativ' },
  { text: 'Wir benötigen das nicht. Bitte unterlassen Sie weitere Kontakte.', expected: 'negativ' },
  { text: 'Woher haben Sie meine Adresse? Das ist Spam und wird gemeldet.', expected: 'negativ' },
  { text: 'Wir haben das schon. Brauchen wir nicht.', expected: 'negativ' },
  { text: 'Danke, aber wir machen das selbst inhouse.', expected: 'negativ' },
  { text: 'Nicht interessiert. Bitte nicht weiter anschreiben.', expected: 'negativ' },
  { text: 'Unaufgeforderte Werbung — Datenschutzbeschwerde folgt.', expected: 'negativ' },
  { text: 'Aktuell kein Bedarf. Kein Interesse.', expected: 'negativ' },
  { text: 'Bitte abmelden. Newsletter raus.', expected: 'negativ' },
  { text: 'Passt nicht für uns. Trotzdem danke.', expected: 'negativ' },
  { text: 'Zur Zeit nicht. Wir melden uns von selbst falls Bedarf.', expected: 'negativ' },
  { text: 'DSGVO-Verstoß. Bitte unverzüglich aus allen Listen entfernen.', expected: 'negativ' },
  { text: 'Nein danke, das passt gerade nicht.', expected: 'negativ' },

  // ===== OOF (Out-of-Office Auto-Replies) =====
  { text: 'Ich bin im Urlaub bis 12.05.2026 und nicht erreichbar. Vertretung: kollege@firma.de', expected: 'oof' },
  { text: 'Diese Nachricht wurde automatisch generiert. Ich bin abwesend bis Freitag.', expected: 'oof' },
  { text: 'Out of Office: Bin ab dem 15.05. wieder erreichbar.', expected: 'oof' },
  { text: 'Automatische Antwort: Wir sind im Urlaub vom 01.05. bis 14.05.', expected: 'oof' },
  { text: 'Hallo, ich bin aktuell abwesend. Bitte wenden Sie sich an die Vertretung.', expected: 'oof' },
  { text: 'Ich bin nicht erreichbar bis 20.05. Dringende Anfragen an info@firma.de.', expected: 'oof' },
  { text: 'Abwesenheitsnotiz: Wieder im Büro ab Mo 06.05.', expected: 'oof' },
  { text: 'Abwesend bis nach Pfingsten.', expected: 'oof' },

  // ===== UNKLAR (ambiguous, keine eindeutigen Marker) =====
  { text: 'Können Sie das nochmal erklären?', expected: 'unklar' },
  { text: 'Wer sind Sie eigentlich?', expected: 'unklar' },
  { text: 'Hm, mal sehen.', expected: 'unklar' },
  { text: 'Der Link funktioniert bei mir nicht.', expected: 'unklar' },
  { text: 'Was machen Sie genau?', expected: 'unklar' },
  { text: '', expected: 'unklar' },
  { text: '?', expected: 'unklar' },
  // Gemischte Signale → eigentlich negativ (das "aber" kassiert den positiven Teil)
  { text: 'Klingt interessant aber leider kein Bedarf bei uns.', expected: 'negativ' },
  { text: 'Schönes Konzept. Aktuell aber kein Interesse.', expected: 'negativ' },

  // ===== EDGE-CASES =====
  // Sehr kurzer Reply
  { text: 'Ja gerne.', expected: 'positiv' },
  // Förmlich
  { text: 'Sehr geehrter Herr Muric, herzlichen Dank für Ihre Nachricht. Wir würden uns freuen, mehr zu erfahren.', expected: 'positiv' },
  // Mit Tippfehlern
  { text: 'kien intressee, danke.', expected: 'unklar' }, // tippfehler "kein interesse" → unklar (Regex matcht nicht)
  // Mit Smiley/Umgangssprache
  { text: 'Top, schick mal nen Termin :)', expected: 'positiv' },
];

function parseCli() {
  const { values } = parseArgs({
    options: {
      'use-haiku': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
    },
    strict: true,
  });
  return values;
}

function pad(s, n) {
  return String(s).padEnd(n);
}

async function main() {
  const args = parseCli();

  console.log(`Reply-Classifier Test-Suite (${TEST_CASES.length} Cases)`);
  console.log(`Modus: ${args['use-haiku'] ? 'Regex + Haiku-Fallback' : 'Regex only (Default)'}`);
  console.log('='.repeat(60));
  console.log();

  // 4×4 Confusion-Matrix: actual × predicted
  const labels = ['positiv', 'negativ', 'oof', 'unklar'];
  const matrix = {};
  for (const a of labels) {
    matrix[a] = {};
    for (const p of labels) matrix[a][p] = 0;
  }

  const mismatches = [];

  for (const c of TEST_CASES) {
    const result = await classifyReply(c.text, { useHaiku: args['use-haiku'] });
    const predicted = result.classification;
    matrix[c.expected][predicted] = (matrix[c.expected][predicted] ?? 0) + 1;
    if (predicted !== c.expected) {
      mismatches.push({ ...c, predicted, confidence: result.confidence, reason: result.reason });
    }
  }

  // Confusion-Matrix
  console.log('Confusion-Matrix (Zeilen = Soll, Spalten = Ist):');
  console.log();
  const colWidth = 9;
  console.log(pad('', 12) + labels.map((l) => pad(l, colWidth)).join(''));
  for (const a of labels) {
    const row = pad(a + ':', 12) + labels.map((p) => pad(matrix[a][p], colWidth)).join('');
    console.log(row);
  }
  console.log();

  // Per-Kategorie-Accuracy
  console.log('Accuracy pro Kategorie:');
  let totalCorrect = 0;
  let totalCount = 0;
  for (const a of labels) {
    const total = labels.reduce((sum, p) => sum + (matrix[a][p] ?? 0), 0);
    const correct = matrix[a][a] ?? 0;
    totalCorrect += correct;
    totalCount += total;
    const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : '–';
    console.log(`  ${pad(a, 10)} ${correct}/${total} (${pct}%)`);
  }
  console.log();
  const overallAcc = totalCount > 0 ? ((totalCorrect / totalCount) * 100).toFixed(1) : '–';
  console.log(`Overall Accuracy: ${totalCorrect}/${totalCount} (${overallAcc}%)`);
  console.log();

  // Mismatches
  if (mismatches.length > 0) {
    console.log(`Mismatches (${mismatches.length}):`);
    console.log();
    for (const m of mismatches) {
      console.log(`  ✗ Expected ${m.expected}, got ${m.predicted} (${(m.confidence * 100).toFixed(0)}%)`);
      console.log(`     Text: "${m.text.slice(0, 80)}${m.text.length > 80 ? '…' : ''}"`);
      if (args.verbose) {
        console.log(`     Reason: ${m.reason}`);
      }
      console.log();
    }
  }

  // Akzeptanz-Schwelle
  const threshold = 90;
  console.log('='.repeat(60));
  if (parseFloat(overallAcc) >= threshold) {
    console.log(`✅ Accuracy ${overallAcc}% ≥ ${threshold}% — Classifier production-ready.`);
    process.exit(0);
  } else {
    console.log(`⚠️  Accuracy ${overallAcc}% < ${threshold}% — Pattern-Library erweitern oder Haiku-Fallback verbindlich.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`test-reply-classifier FEHLER: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(2);
});
