# Build-Log — Pre-Qualifizierung + Briefing-MD (Bausteine 1+5)
**Stand:** 2026-05-03
**Branch:** feat/leadhunter-prequal-node-and-briefing
**Forked von:** feat/leadhunter-phase-2-patches @ b8fe257 (Sonnet-3 charset-Fix drin)
**Spec:** MORNING_FLOW_SPEC.md v1.2 §3 + §4 + §6
**Mail-Template:** MAIL_TEMPLATE_KFZ_V1.md (v1.1)

---

## Was geliefert wurde

1. **Neuer Code-Node `Pre-Qualifizierung`** zwischen `Score Calc + Build Sheet Row` und `Sheets Append Lead`. Füllt 11 logische v2-Felder aus Spec §3:
   - `slug` — ASCII/Kebab, Umlaut-Map vor NFD, 30-Zeichen-Truncate, Sheet-Lookup-Kollisions-Append `-2`/`-3`
   - `district` — Regex auf `\b\d{5}\s+(Stadt[-Stadtteil])` aus address; Fallback `_hub_name`
   - `phone_e164` — `+49` prefix, leading-0-strip
   - `google_rating` — Komma-Format `4,9` (DACH-Display) — überschreibt Phase-1-Float
   - `review_count` — als String `"786"` — überschreibt Phase-1-Number
   - `google_maps_url` — `https://www.google.com/maps/place/?q=place_id:{place_id}`
   - `is_https` — `true|false|''` (leer wenn website_url leer)
   - `mail_variant` — `A|B` aus §4.1
   - `subject_variant` — `A|B` aus §4.2 (≤20-Zeichen + keine Sonderzeichen + keine Rechtsform)
   - `anrede` — `Herr {Nachname}` (Default Herr, Frau-Heuristik nicht Phase-2) oder `Hallo zusammen,`
   - `observation` — Decision-Tree §4.4 mit 6 Buckets

2. **`Sheets Append Lead`-Mapping erweitert** um 9 neue Spalten N–V (slug, district, phone_e164, google_maps_url, is_https, mail_variant, subject_variant, anrede, observation). google_rating + review_count waren bereits Phase-1-Mapping (Position G+H statt Spec-Position Q+R) und werden vom Pre-Qual-Output mit Komma-/String-Format überschrieben.

3. **`Briefing Markdown Generator` ersetzt** durch v2 gemäß §6:
   - Header mit Datum + Cron-Run-Timestamp + Top-N-Counter
   - Pro Lead: H2 mit Score+District, Demo-URL klickbar, Telefon/Owner/Bewertungen/Hook, Mailto-Klick-Button mit `encodeURIComponent` für Subject + Body, UTM-Parameter (`utm_source=cold-email&utm_campaign=kfz-{KW}`) im Body-Demo-URL, `<details>`-Block mit Mail-Vorschau für Copy-Paste-Fallback
   - Footer: Bulk-Mark-Sheet-Link auf Range `K2:K{N+1}`, Reply-Tracker-Gmail-Filter

---

## Vorher / Nachher Sheet-Spalten

| Position | Vorher (Phase-1, 13) | Nachher (v2, 22) |
|----------|----------------------|------------------|
| A | lead_id | lead_id |
| B | business_name | business_name |
| C | address | address |
| D | phone | phone |
| E | email | email |
| F | website_url | website_url |
| G | google_rating (Float) | google_rating (Komma-String) |
| H | review_count (Int) | review_count (String) |
| I | score | score |
| J | signal_summary | signal_summary |
| K | status | status |
| L | pitch_date | pitch_date |
| M | notes | notes |
| N | — | **slug** |
| O | — | **district** |
| P | — | **phone_e164** |
| Q | — | **google_maps_url** |
| R | — | **is_https** |
| S | — | **mail_variant** |
| T | — | **subject_variant** |
| U | — | **anrede** |
| V | — | **observation** |

**Hinweis zur Spec-Abweichung:** Spec §3 sieht google_rating als Q und review_count als R vor; im Sheet sind sie historisch G+H (Phase-1-Erbe). Re-Order wäre brechend für Phase-1-gepitchte Leads. Stattdessen liegen die 9 wirklich neuen Spalten unter N–V, die 2 reformatierten Felder bleiben an G+H. Logisch sind alle 11 v2-Felder gemäß Spec im Sheet.

---

## Self-Smoke-Test

- **Tests:** 65/65 grün (Akzeptanz war 41/41 — übertroffen)
- **Skript:** `_logs/sonnet-4-build/smoke-test.cjs`
- **Logik:** `_logs/sonnet-4-build/prequal-logic.cjs`
- **Demo-Render:** `_logs/sonnet-4-build/demo-briefing.md`

Test-Coverage:
- Slug: 6 Tests (Basic/Umlaut/Ampersand/ß/Truncate/Kollision)
- Phone E.164: 4 Tests (DE-0-Prefix, +49, ohne 0, leer)
- District: 4 Tests (Hamburg/Hammerbrook/Kiel/Fallback)
- Anrede: 4 Tests (mit Nachname, ohne, Doppel-Nachname, null)
- Mail Variant: 3 Tests (A/B/unreachable)
- Subject Variant: 4 Tests (kurz/lang/GmbH/Ampersand)
- Observation: 6 Tests (VARIANT_B/SSL/Impressum/Telefon/Meta/Default)
- Google Maps URL: 2 Tests
- Rating Display: 2 Tests
- E2E Lead 1 (mit Website + Inhaber): 6 Tests
- E2E Lead 2 (ohne Website): 8 Tests
- Briefing-MD-Render: 13 Tests (H1, H2, Demo-URL, Mailto, encoded subject, encoded umlaut, %0A, UTM, Bulk-Mark, Reply-Tracker, kein roher Newline)
- Greeting-Bugfix-Regression: 3 Tests

---

## Bug während Build entdeckt + gefixt

1. **Slug-Bug:** Reihenfolge `NFD → strip combining marks → ü→ue` zerlegte Umlaute zu Bare-Vokal weil NFD vor dem ü→ue-Replace lief. Fix: Umlaute zuerst ersetzen, dann NFD.
2. **Greeting-Bug:** Mail-Body begann mit `Herr Zurapi,` statt `Hallo Herr Zurapi,`. Fix: `greetingLine()`-Helper baut die Begrüßung konsistent.

---

## VPS-Update

- **Workflow-ID:** `iZ060qurswViA2qa` (`leadhunter_kfz_sh`)
- **API:** `PUT http://187.124.171.59:5678/api/v1/workflows/{id}` mit X-N8N-API-KEY
- **Payload-Skript:** `_logs/sonnet-4-build/patch-live-workflow.cjs` (nimmt Live-JSON, applied 3 Patches, sanitized settings für PUT-Whitelist)
- **HTTP:** 200
- **Verifikation post-PUT:**
  - Active: True
  - Nodes: 21 (vorher 20)
  - Pre-Qualifizierung exists: True
  - Append cols: 22 (vorher 13)
  - Credentials erhalten: alle 6 (Places-Query-Auth, Sheets-OAuth, Anthropic-Header-Auth)
  - Sheet-ID in Briefing-JS: `1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk` (live-Wert eingesetzt)

---

## Was NICHT in diesem PR ist

- Mini-Generator-Skript für Demo-Sites (Sonnet-5)
- VPS-Cron-Setup für Claude-Code-Headless (Sonnet-6)
- Tracking-Layer UTM/Gmail-Filter (Cowork)
- Vercel-Subdomain-Routing (Mini-Generator-Patch)

---

## Akzeptanz-Status

- [x] Branch `feat/leadhunter-prequal-node-and-briefing` von `feat/leadhunter-phase-2-patches` (Sonnet-3-Fix mit drin)
- [x] Self-Smoke-Test 65/65 grün (Akzeptanz 41/41 übertroffen)
- [x] Briefing-MD-Render gegen 2 Test-Leads sauber (Mailto URL-encoded korrekt, kein HTML-Escape-Bug, kein roher Newline)
- [x] Sheet-Schema v2 mit allen 11 logischen Pre-Qual-Spalten plausibel gefüllt
- [x] VPS-Workflow via API aktualisiert, Credentials nach Update gleich gebunden
- [ ] User-Triggered Re-Run + Briefing-MD-Sichtprüfung (offen — n8n public API hat keinen Manual-Trigger-Endpoint, User triggert via UI)
- [ ] PR-Merge (offen bis User Re-Run-Erfolg bestätigt)
