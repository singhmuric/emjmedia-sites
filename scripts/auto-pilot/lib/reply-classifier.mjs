// Reply-Classifier — klassifiziert Cold-Mail-Reply-Texte in:
//   - positiv  (Interesse, Termin-Anfrage, Rückruf-Wunsch)
//   - negativ  (kein Interesse, Stopp-Bitte, Spam-Beschwerde)
//   - oof      (out-of-office Auto-Reply, kein menschlicher Lead-Status)
//   - unklar   (ambiguous, braucht User-Review)
//
// Hybrid-Approach:
//   1. Regex-Patterns gegen deutsche Standard-Cold-Mail-Reply-Phrasen (deterministisch, kostenlos)
//   2. Optional Haiku-API-Fallback für ambiguous Fälle (opts.useHaiku=true)
//
// API:
//   classifyReply(text, opts) → Promise<{ classification, confidence, matched_pattern, used_haiku, raw_haiku_output? }>
//
// Verwendung:
//   - gmail-sync.mjs (Sonnet A) ruft das auf für jede neue Reply (Phase 9b § B)
//   - briefing-generator.mjs nutzt die `reply_classification`-Spalte für Replies-Section
//   - evaluate-welle.mjs gruppiert Reply-Rate per Klassifikation
//
// Memory feedback_cashflow_disziplin: Default = pure Regex (kostenlos).
// Haiku-Fallback nur wenn explizit eingeschaltet — opt-in via opts.useHaiku.

import { readFileSync } from 'node:fs';

// ============================================================================
// Pattern-Library (deutsche Cold-Mail-Reply-Standards + DACH-B2B-Idioms)
// ============================================================================

const POSITIVE_PATTERNS = [
  // Direktes Interesse
  /\b(klingt|hört sich|finde ich|finden wir)\s+(interessant|gut|spannend|gut an)\b/i,
  /\b(ja\s*[,.!]?\s*)?gerne\b/i,
  /\b(grundsätzlich|prinzipiell)\s+interessiert\b/i,
  /\bja\s*[,!.]?\s*(das|gerne|gerne mehr|interessiert)/i,

  // Termin-Anfrage
  /\b(termin|treffen|kennenlern|gespräch|call|telefonat|videocall|videotermin)/i,
  /\b(rufen|ruf|melden) sie (mich|uns)\b/i,
  /\b(rückruf|rückrufbitte|kurz anrufen|kurz telefonieren)/i,
  /\b(wann (haben|hätten|hast))\s+sie\s+zeit\b/i,

  // Mehr-Information-Anfrage
  /\b(mehr\s+info|näheres|details|unterlagen|preisliste|angebot)/i,
  /\b(was\s+würde|was\s+kostet|preis|kosten)/i,
  /\bmehr\s+zu\s+erfahren\b/i,
  /\bwürden\s+uns\s+freuen\b/i,
  /\bfreuen\s+uns\s+(auf|über)\b/i,

  // Demo-Reaktion
  /\b(gefällt|gefallen|klasse|super|stark|nicht schlecht|sieht gut aus)/i,
  /\b(besser als|schöner als|moderner als)/i,
];

const NEGATIVE_PATTERNS = [
  // Direkter Disqualifier
  /\bkein\s+interesse\b/i,
  /\bnicht\s+interessiert\b/i,
  /\bkein\s+bedarf\b/i,
  /\bbenötigen\s+(wir\s+)?nicht\b/i,
  /\bbrauchen\s+(wir\s+)?nicht\b/i,

  // Stopp / Abmeldung
  /\b(abmelden|austragen|aus(\s+der)?\s+(liste|verteiler))\b/i,
  /\b(verteiler|newsletter)\s+(entfernen|löschen|raus)/i,
  /\bbitte\s+keine\s+(weiteren|mehr)\s+(mails|emails|nachrichten)/i,
  /\bunterlassen\s+sie\b/i,
  /\bnicht\s+(weiter|nochmal|mehr)\s+(anschreiben|mailen|kontaktieren)/i,

  // Vertraulichkeit / DSGVO / Spam-Beschwerde
  /\b(spam|unerwünscht|unaufgefordert(e)?|datenschutz|dsgvo|abmahnung)\b/i,
  /\bdatenschutzbeschwerde\b/i,
  /\bwarum\s+haben\s+sie\s+meine\b/i,
  /\bwoher\s+haben\s+sie\b/i,

  // Höfliche Absage
  /\bdanke\s*[,.!]?\s*aber\b/i,
  /\b(passt|passen)\s+(nicht|gerade nicht)/i,
  /\b(zur\s+zeit|aktuell|momentan)\s+(nicht|kein)/i,
  /\bhaben\s+wir\s+schon\b/i,
  /\bmachen\s+wir\s+selbst\b/i,
];

const OOF_PATTERNS = [
  /\b(abwesenheit|abwesend|out\s*of\s*office|out-of-office|ooo)\b/i,
  /\b(im\s+urlaub|in\s+urlaub|urlaub\s+bis|wir\s+sind\s+im\s+urlaub)\b/i,
  /\bautomatische\s+(antwort|nachricht|email)/i,
  /\b(wieder\s+erreichbar|wieder\s+im\s+büro|zurück\s+ab)/i,
  /\bvertretung\b/i,
  /\bnicht\s+erreichbar\b.*\b(bis|ab)\s+\d/i, // "nicht erreichbar bis 12.05."
  /\bdiese\s+nachricht\s+wurde\s+automatisch/i,
];

const POSITIVE_WEIGHT = 1.0;
const NEGATIVE_WEIGHT = 1.2; // negative ist meist eindeutiger als positiv
const OOF_WEIGHT = 1.5; // OOF-Pattern sind sehr eindeutig

// ============================================================================
// Helpers
// ============================================================================

function n(s) {
  return String(s ?? '');
}

function countMatches(text, patterns) {
  let count = 0;
  const matched = [];
  for (const p of patterns) {
    if (p.test(text)) {
      count++;
      matched.push(p.source);
    }
  }
  return { count, matched };
}

// ============================================================================
// Classify (Regex-Layer)
// ============================================================================

function classifyByRegex(text) {
  const t = n(text);
  if (!t.trim()) {
    return { classification: 'unklar', confidence: 0, matched_pattern: null, reason: 'leerer Text' };
  }

  const oof = countMatches(t, OOF_PATTERNS);
  const pos = countMatches(t, POSITIVE_PATTERNS);
  const neg = countMatches(t, NEGATIVE_PATTERNS);

  // OOF hat Vorrang — wenn klares OOF, dann ist es kein menschlicher Reply
  if (oof.count >= 1) {
    return {
      classification: 'oof',
      confidence: Math.min(1, oof.count * OOF_WEIGHT * 0.7),
      matched_pattern: oof.matched[0],
      reason: `OOF-Pattern (${oof.count} Match)`,
    };
  }

  const posScore = pos.count * POSITIVE_WEIGHT;
  const negScore = neg.count * NEGATIVE_WEIGHT;

  // Kein Match
  if (posScore === 0 && negScore === 0) {
    return {
      classification: 'unklar',
      confidence: 0,
      matched_pattern: null,
      reason: 'keine eindeutige Pattern-Übereinstimmung',
    };
  }

  // Eindeutig negativ
  if (negScore > posScore * 1.5) {
    return {
      classification: 'negativ',
      confidence: Math.min(1, (negScore - posScore) * 0.3 + 0.5),
      matched_pattern: neg.matched[0],
      reason: `${neg.count}× negative, ${pos.count}× positive`,
    };
  }

  // Eindeutig positiv
  if (posScore > negScore * 1.5) {
    return {
      classification: 'positiv',
      confidence: Math.min(1, (posScore - negScore) * 0.3 + 0.5),
      matched_pattern: pos.matched[0],
      reason: `${pos.count}× positive, ${neg.count}× negative`,
    };
  }

  // Mixed Signals → unklar
  return {
    classification: 'unklar',
    confidence: 0.3,
    matched_pattern: pos.matched[0] ?? neg.matched[0],
    reason: `mixed: ${pos.count}× positive, ${neg.count}× negative — User-Review nötig`,
  };
}

// ============================================================================
// Haiku-Fallback (optional, opt-in)
// ============================================================================

function loadAnthropicKey() {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  const path = process.env.ANTHROPIC_API_KEY_FILE;
  if (path) {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      return null;
    }
  }
  return null;
}

async function classifyByHaiku(text, opts = {}) {
  const apiKey = opts.apiKey ?? loadAnthropicKey();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY nicht gesetzt — Haiku-Fallback nicht möglich.');
  }

  const systemPrompt = `Du klassifizierst Cold-Mail-Reply-Texte aus dem deutschen B2B-Kontext (KFZ, Friseure, Handwerk).
Kategorien:
- positiv: Empfänger zeigt Interesse, will Termin/Rückruf, fragt nach Details
- negativ: Empfänger lehnt ab, will Abmeldung, beschwert sich
- oof: automatische Abwesenheits-Notiz (kein menschlicher Reply)
- unklar: weder klar positiv noch klar negativ, braucht User-Review

Antworte AUSSCHLIESSLICH in genau diesem JSON-Format (kein Markdown, kein Erklärtext):
{"classification":"positiv|negativ|oof|unklar","confidence":0.0-1.0,"reason":"kurze Begründung in einem Satz"}`;

  const body = {
    model: opts.model ?? 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Reply-Text:\n\n${text}` }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic-API-Fehler ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const textOut = json.content?.[0]?.text ?? '';
  let parsed;
  try {
    parsed = JSON.parse(textOut);
  } catch {
    return {
      classification: 'unklar',
      confidence: 0.2,
      reason: `Haiku-JSON-Parse-Fehler: ${textOut.slice(0, 100)}`,
      raw_haiku_output: textOut,
    };
  }
  return {
    classification: parsed.classification ?? 'unklar',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    reason: parsed.reason ?? '(keine Begründung)',
    raw_haiku_output: textOut,
  };
}

// ============================================================================
// Public API — Hybrid
// ============================================================================

export async function classifyReply(text, opts = {}) {
  const useHaiku = opts.useHaiku ?? false;
  const ambiguousThreshold = opts.ambiguousThreshold ?? 0.4;

  const regexResult = classifyByRegex(text);

  // Wenn Regex eindeutig + nicht ambiguous → fertig
  if (!useHaiku || (regexResult.classification !== 'unklar' && regexResult.confidence >= ambiguousThreshold)) {
    return {
      classification: regexResult.classification,
      confidence: regexResult.confidence,
      matched_pattern: regexResult.matched_pattern,
      reason: regexResult.reason,
      used_haiku: false,
    };
  }

  // Ambiguous + Haiku eingeschaltet → API-Call
  try {
    const haikuResult = await classifyByHaiku(text, opts);
    return {
      classification: haikuResult.classification,
      confidence: haikuResult.confidence,
      matched_pattern: regexResult.matched_pattern,
      reason: `regex=${regexResult.reason}; haiku=${haikuResult.reason}`,
      used_haiku: true,
      raw_haiku_output: haikuResult.raw_haiku_output,
    };
  } catch (e) {
    // Haiku-Fail → fallback auf Regex-Ergebnis
    return {
      classification: regexResult.classification,
      confidence: regexResult.confidence,
      matched_pattern: regexResult.matched_pattern,
      reason: `regex=${regexResult.reason}; haiku-fail=${e.message}`,
      used_haiku: false,
      haiku_error: e.message,
    };
  }
}

export const _internals = {
  classifyByRegex,
  classifyByHaiku,
  POSITIVE_PATTERNS,
  NEGATIVE_PATTERNS,
  OOF_PATTERNS,
};
