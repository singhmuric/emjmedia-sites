# Email-Extraction-Fix + Inhaber-Bonus — Patch-Log

**Session:** Sonnet 4.6 in Claude Code (gem. CLAUDE.md §6)
**Datum:** 2026-04-30
**Workflow:** `leadhunter_kfz_sh`
**Patch-File:** `workflows/n8n/leadhunter_kfz_sh.json`
**Status:** 🟢 Patch fertig, wartet auf User-Re-Import + Re-Run

---

## 0. Sheet-Reset — PRE-STEP (KRITISCH, vor Re-Import)

> **Vor dem Re-Run das Sheet `EMJmedia Leads KFZ` Tab `Leads` leeren** —
> Zeile 2 abwärts löschen, Header in Zeile 1 bleibt.
>
> **Begründung:** Der `Dedup vs Sheet`-Node am Pipeline-Anfang liest existierende `lead_id`s
> und überspringt alle bekannten Place-IDs. Ohne Reset würden die 16 alten Leads
> (gescort vor diesem Patch, mit kaputter Email-Extraktion) durchgereicht und der Email/Inhaber-Fix
> bekäme **null** neue Leads zum Verarbeiten. Akzeptanz-Kriterium 1 (≥10/16 Email-Befüllungen)
> ist sonst strukturell unerreichbar.

---

## 1. Field-Verifikation (Memory-Pflicht `feedback_n8n_field_verification` erfüllt)

Quelle: `HTTP_Website_Fetch.json` Dump vom letzten Smoke-Test (16 Items, 2 MB).
Verifiziert via `jq` direkt aus dem Dump-File.

### HTTP Website Fetch — Output-Schema

```
$json = {
  data: string | null,        // HTML-Body bei 200, null bei ENOTFOUND
  statusCode: 200 | null,     // null bei DNS-Failure / Connection-Failure
  statusMessage: "OK" | …,    // fehlt bei null-statusCode
  headers: { "content-type": …, "server": …, … }
}
```

**Bug-Identifikation alter Code:** Mein bisheriger Truncate-Code nutzte `web.body` —
existiert in diesem Schema **nicht**. Konsequenz: jeder Lead landete in `!web.body` →
`website_unreachable = true` → Haiku bekam leeres HTML → `summary: "website-unreachable"`
für alle 16. Daher das durchgehende Score-30/35-Plateau im letzten Smoke-Test.
**Memory-Pflicht hat exakt diese Klasse Bug verhindert** — ohne Field-Dump hätte ich
jetzt wieder gegen `body` geschrieben.

### HTTP Places details — Output-Schema (von Cowork verifiziert)

```
$json = {
  result: {
    name: string,
    formatted_address: string,
    formatted_phone_number?: string,
    international_phone_number?: string,
    website?: string,                  // OPTIONAL — kann komplett fehlen (Variant-B)
    url: string,                       // ⚠️ Maps-Permalink, NICHT Website
    rating?: number,
    user_ratings_total?: number,
    business_status: "OPERATIONAL",
    address_components: […]
  },
  status: "OK"
}
```

**Variant-B-Detection** für Leads ohne `result.website`:

```js
typeof result.website === "string" && result.website.length > 0
```

Items 4 + 9 im Smoke-Test (AS KFZ Werkstatt + KFZ Service Hamburg) treffen diese
Bedingung → `_website_unreachable = true`, Impressum-Fetch wird übersprungen via
URL-Fallback `https://example.invalid` (provoziert ENOTFOUND, von `isReachable()` gefangen).

---

## 2. Charset-Realität (Phase-1-Strategie)

Verteilung der 14 erreichbaren Items:

| content-type | count | umlauts | mojibake-marker | replacement-chars (`�`) | verdict |
|---|---|---|---|---|---|
| `text/html; charset=utf-8` | 7 | 80–494 | 0 | 0 | OK |
| `text/html; charset=UTF-8` | 3 | 13–62 | 0 | 0 | OK |
| `text/html` (no charset) | 4 | 0–186 | 0 | 0–92 | **2 corrupt, 2 OK** |

**Befund:** **2/14 (14 %) data-loss**, exakt die Verbund-Sites (Items 1 + 2,
beide auf demselben Apache 2.4.66 mit „KFZ-Meisterbetriebe"-Backend). Sites senden
vermutlich Latin-1 ohne Header → n8n's UTF-8-Decoder ersetzt invalid Bytes durch `�`.

**Phase-1-Mitigation (in diesem PR):**
- `detectCharsetCorruption(data)` setzt `_website_corrupt: true` wenn >5 `�`-Chars
- `extractEmails()` filtert Mails mit `�` raus (ASCII-only-Domains nicht betroffen)
- `extractInhaber()` verwirft Namen die `�` enthalten (sonst „M�ller Stefan")
- Konsequenz für Items 1+2: Email-Extraktion funktioniert (`info@freiewerkstatthamburg.de`
  ist ASCII), Inhaber-Name wird leer bleiben falls er Umlaute enthält

**Phase-2-Trigger (separater PR):** sobald ein Hub außerhalb Hamburg mit älterer Site
ankommt UND Inhaber-Hit-Rate <50 % wird. Lösung: HTTP-Nodes auf
`responseFormat: arraybuffer` umstellen, `TextDecoder('iso-8859-1')`-Fallback im Truncate-Code
basierend auf `headers['content-type']`-Header und Heuristik. Architektur-Eingriff,
braucht eigene Spec.

---

## 3. Smoke-Test (Self-Validate gegen Dump, Pre-Re-Run)

Reine JS-Logik (ohne Impressum-Fetch — der existiert beim Dump-Zeitpunkt noch nicht)
gegen die 14 erreichbaren Items aus dem Website-Fetch-Dump:

```
Item  0: emails=0  best=""                                 inhaber=""
Item  1: emails=1  best="info@freiewerkstatthamburg.de"    inhaber=""  [CHARSET-CORRUPT]
Item  2: emails=1  best="info@freiewerkstatthamburg.de"    inhaber=""  [CHARSET-CORRUPT]
Item  3: emails=1  best="info@meisterwerkstatt-oemer.de"   inhaber=""
Item  4: UNREACHABLE (no result.website — Variant-B)
Item  5: emails=0  best=""                                 inhaber="Olaf Eitner"
Item  6: emails=0  best=""                                 inhaber=""
Item  7: emails=0  best=""                                 inhaber=""
Item  8: emails=1  best="info@aszhh.de"                    inhaber=""
Item  9: UNREACHABLE (no result.website — Variant-B)
Item 10: emails=0  best=""                                 inhaber=""
Item 11: emails=0  best=""                                 inhaber=""
Item 12: emails=2  best="info@kfz-service-kai-hansen.de"   inhaber=""
Item 13: emails=0  best=""                                 inhaber=""
Item 14: emails=1  best="info@kfz-meister-betrieb.de"      inhaber=""
Item 15: emails=19 best="service@kfz-hartung.de"           inhaber=""
```

**Baseline ohne Impressum-Fetch:**
- **Email: 7/14 reachable = 7/16 total** (vs vorher 4/16, schon +3 nur durch korrekte
  Field-Names + besseren Filter)
- **Inhaber: 1/14** (Olaf Eitner, prominent auf Startseite — Eitner-KFZ Last-Modified 2018)
- **Charset-corrupt: 2 items** (Items 1+2 wie analysiert)
- **Unreachable: 2 items** (Variant-B-Detection greift)

**Prognose mit Impressum-Fetch (im Re-Run):**
- Email: 12–14/16 (Impressum hat in 80 %+ der DE-KMU eine Geschäftsmail wegen TMG-Pflicht)
- Inhaber: 8–11/16 (TMG-Pflicht: Vertretungsberechtigt-Zeile fast immer im Impressum)

Beide Akzeptanz-Schwellen (≥10 / ≥6) komfortabel im Korridor.

### Verbund-Detection (Akzeptanz-Kriterium 5)

Items 1 + 2 teilen sich `info@freiewerkstatthamburg.de` — bestätigt Cowork-Befund.
Beim Pitch-Versand:

> ⚠️ **Achtung:** Mehrere Leads können sich Email + Phone teilen, weil Werkstätten
> in Verbund-Backends operieren. Vor Mail-Versand das Sheet nach gleichen Email-Werten
> gruppieren (`signal_summary` ähnlich + gleiche Tel) und nur eine Mail pro Adresse senden.

Im aktuellen Workflow läuft kein Auto-Versand (Spec §1: out-of-scope), daher reine
Sheet-Annotation ausreichend.

---

## 4. Patch-Inhalt (was sich geändert hat)

### Neuer Node: `HTTP Impressum Fetch`

Position `[2000, 300]`, zwischen `HTTP Website Fetch` und `HTML Truncate + Merge Context`.
Folge-Nodes ab Position-X 2000+ um +200 verschoben (kosmetische Layout-Korrektur,
funktional egal).

**URL-Construction:**

```js
={{
  ($('HTTP Places details').item.json.result &&
   typeof $('HTTP Places details').item.json.result.website === 'string' &&
   $('HTTP Places details').item.json.result.website.length > 0)
    ? $('HTTP Places details').item.json.result.website.replace(/\/+$/, '') + '/impressum'
    : 'https://example.invalid'
}}
```

Variant-B-Detection: leerer/fehlender `result.website` → Fallback auf `example.invalid` →
ENOTFOUND → `isReachable()` gibt false → `_impressum_reachable: false`.

**Headers/Options:** identisch zu `HTTP Website Fetch` (gleicher UA, 4 Header,
`fullResponse: true`, `responseFormat: text`, `neverError: true`,
`followRedirects: true`, `timeout: 20000`, `continueOnFail: true`).

### Erweitert: `HTML Truncate + Merge Context`

Komplett-Rewrite (1.7k → 8.0k chars). Wesentliche Änderungen:

1. **Field-Names korrigiert:** `web.body` → `web.data` (Bug-Fix, siehe Abschnitt 1)
2. **Multi-Source-Merge:** liest aus 4 Upstream-Nodes (`Website Fetch`, `Impressum Fetch`,
   `Places details`, `Dedup vs Sheet`), korreliert per Index
3. **`isReachable()`:** zentrale Reachability-Logik (`statusCode === 200 && data: string && data.length > 0`)
4. **Email-Extraktion:** Patterns A (mailto) + B (plain), Domain-Match, Blocklist
   (`webmaster@`, `postmaster@`, `no-reply@`, `noreply@`, `admin@`, `hostmaster@`,
   `abuse@`, `spam@`), Kanzlei-Last-Resort, Ranking (`info@` 100 → `kontakt@` 90 →
   `service@` 80 → `werkstatt@` 75 → `office@` 70 → rest 50 → kanzlei 5)
5. **Inhaber-Extraktion:** Two-Pattern-Approach (Label CI, Name CS), Anrede-Skip,
   Titel-Skip (`Dr.`, `Prof.`, `Dipl.-Ing.`, `RA`, `LL.M.`, …), 2-Wort-Limit
   (verhindert Stop-Token-Müll wie „Markus Bauer\nMeister-KFZ-Innung")
6. **Charset-Annotation:** `_website_corrupt` / `_impressum_corrupt` boolean flags
7. **Mojibake-Schutz:** `�`-haltige Emails/Namen werden verworfen
8. **Output-Felder neu:** `_email`, `_inhaber`, `_email_candidate_count`,
   `_website_corrupt`, `_impressum_corrupt`, `_impressum_reachable`

### Angepasst: `HTTP Anthropic Haiku (Signal Extract)`

- `extracted_email` aus dem JSON-Schema entfernt (Haiku braucht's nicht mehr,
  Email kommt jetzt aus lokalem Code)
- `max_tokens: 600 → 500` (kompakteres Schema)
- System-Prompt unverändert (gleiche „beginnt mit `{`, endet mit `}`"-Regel)

### Angepasst: `Score Calc + Build Sheet Row`

- Email-Sourcing: `signals.extracted_email` → `ctx._email` (kommt aus Truncate)
- Domain-Sanity-Check entfernt (im Truncate schon erledigt)
- Neu: `notes`-Feld bekommt `inhaber:Vorname Nachname` wenn `ctx._inhaber` befüllt,
  sonst leer (Spec-konform — Sheet-Spalte M `notes` bleibt unverändert; eigene
  Inhaber-Spalte ist Phase-2)

### Connections

```
HTTP Website Fetch  →  HTTP Impressum Fetch  →  HTML Truncate + Merge Context
```

(Vorher: Website Fetch → HTML Truncate direkt.)

---

## 5. Akzeptanz-Kriterien (Erweiterung)

| # | Kriterium | Schwelle | Prognose nach Re-Run |
|---|---|---|---|
| 1 | Re-Run der 16 Hamburg-Leads liefert Email-Befüllungen | ≥ 10/16 | 12–14/16 |
| 2 | Kein Anstieg an „website-unreachable"-Markern (UA-Fix bleibt wirksam) | unverändert ≤ 2 | 2 (Variant-B Items 4+9) |
| 3 | Score-Verteilung der 16 Leads bleibt stabil (Email beeinflusst Score nicht) | unverändert | OK by design |
| 4 | Smoke-Test-Output als JSON-Dump dokumentiert | ja | dieses Markdown |
| 5 | Verbund-Mehrfach-Email dokumentiert | ja | siehe Abschnitt 3 |
| 6 | **Bonus** Inhaber-Namen extrahiert | ≥ 6/16 | 8–11/16 |

---

## 6. Re-Import-Anleitung

### Step 0 — Sheet leeren (siehe Abschnitt 0 oben)

KRITISCH, sonst Akzeptanz-Kriterium 1 unerreichbar.

### Step 1 — Workflow-Backup

Aktuellen Workflow `leadhunter_kfz_sh` umbenennen → `leadhunter_kfz_sh_v0_pre_email_fix`.

### Step 2 — Re-Import

n8n-UI → Workflows → `+ Add workflow` → Import from File →
`/Users/eminho/BUSINESS/SinghMuric/EMJmedia/repo/emjmedia-sites/workflows/n8n/leadhunter_kfz_sh.json`

Neuer Workflow heißt `leadhunter_kfz_sh`, 19 Nodes.

### Step 3 — Credentials wiren (~5 Min)

Bekannte Credentials aus dem n8n-Credential-Store auswählen für 7 Nodes:

| Node | Credential |
|---|---|
| Sheets Read existing place_ids | Google Sheets (info@emj-media.de) |
| Sheets Append Lead | Google Sheets (info@emj-media.de) |
| Sheets Read All (post-append) | Google Sheets (info@emj-media.de) |
| HTTP Places textSearch | Google Places (Query Auth: key) |
| HTTP Places details | Google Places (Query Auth: key) |
| **HTTP Impressum Fetch** | *keine — none-Authentication* |
| HTTP Anthropic Haiku (Signal Extract) | Anthropic (Header: x-api-key) |

### Step 4 — Sheet-ID setzen

In den 3 Sheets-Nodes: Document → By ID → Wert aus
`/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/google-sheet-leads-kfz.txt`.

### Step 5 — Smoke-Test-Setup

`Build Hub Query Matrix` Code-Body am Anfang trimmen:

```js
const hubs = [{ name: 'Hamburg', lat: 53.5528, lng: 10.0067 }];
const queryTemplates = ['KFZ Werkstatt'];
```

`HTTP Filewriter (Vault Briefing)` Rechtsklick → Deactivate (für jetzt).

Workflow speichern.

### Step 6 — Run

`Manual Trigger` → `Execute Workflow`. Erwartete Dauer ~4 Min:
- Pipeline-Front (textSearch + Pre-Filter + Dedup): ~10 s
- Per-Lead-Block (Places details + Website Fetch + Impressum Fetch + Anthropic):
  ~16 Leads × 3 HTTP-Calls × 1.5–2 s + Anthropic-Batching (1.5 s pro Call) ≈ 90 s
- Sheets Append: ~16 × 1 s = ~16 s
- Top-10 + Briefing: <5 s

### Step 7 — Verifikation im Sheet

Spaltenweise prüfen für 3 Stichproben:
- `email`: gefüllt mit `info@…` oder `kontakt@…`-Adresse aus eigener Domain
- `notes`: leer ODER `inhaber:Vorname Nachname`
- `signal_summary`: keine Mehrfach-`website-unreachable` (außer Items 4+9)
- `score`: Spread, nicht alle bei 30

### Step 8 — Mir Feedback geben

- Email-Befüllung: wie viele von 16?
- Inhaber-Hits: wie viele?
- Falls einer der zwei Charset-Corrupt-Items (1+2) Inhaber-Namen liefert:
  Wert nennen — wenn `�` drin, Phase-2-Trigger
- Falls eine der zwei Variant-B-Items (4+9) ein Email/Inhaber zeigt:
  → Bug, melden

Wenn Akzeptanz erfüllt: weiter zu Filewriter-Container-Check + voller Initial-Run.

---

## 7. Future-Issues (NICHT in diesem PR)

Während der Field-Verifikation aufgefallen, separater Auftrag:

- **`/kontakt`-Fallback für Impressum-Miss:** wenn `/impressum` 404 liefert,
  zweiter Versuch auf `/kontakt`. Trigger: wenn Impressum-Reach-Rate <70 %.
- **Charset-Phase-2:** `responseFormat: arraybuffer` + manueller `TextDecoder` mit
  Header-Charset-Detection. Trigger: Inhaber-Hit-Rate <50 % wegen Mojibake.
- **`no-ssl`-Pre-Filter-Signal:** 8/14 Sites im Dump sind HTTP-only — Pitch-relevantes
  Signal, gehört in Score-Formel als statisches Boolean (parallel zu Haiku-Signal).
  Spec §4.3 erweitern.
- **Auto-Demo-Build-Felder:** `result.address_components`, `result.url` (Maps-Permalink),
  `result.formatted_phone_number` für Phase-3-Demo-Site-Generator. Eigene Spec.
- **Inhaber-Spalte im Sheet:** wenn Hit-Rate >70 %, eigene Spalte N statt `notes`-Tag.
  Schema-Change → eigene Spec, eigener PR.

---

## 8. Skill-Invocations (CLAUDE.md §3 Pflicht)

```
[Heute] skill: feedback_n8n_field_verification (memory)
        Quelle: ~/.claude/projects/.../memory/feedback_n8n_field_verification.md
        Regel: "Sample-Dump vor Code-Patch in n8n-Code-Nodes"
        Anwendung: HTTP Website Fetch Output verifiziert (data, nicht body) →
        Bug-Fix der eigentlichen Ursache für 16/16 unreachable im letzten Smoke-Test

[Heute] skill: n8n-workflow-patterns
        Regel: "Index-Korrelation per $('Node').all() für Multi-Source-Merge"
        Anwendung: HTML Truncate korreliert 4 Upstream-Nodes per i-Index

[Heute] skill: n8n-node-configuration
        Regel: "operation-aware config — POST braucht sendBody+specifyBody"
        Anwendung: Anthropic-Body als jsonBody-Expression mit JSON.stringify

[Heute] memory: persisted feedback_n8n_field_verification + MEMORY.md index
        (Pflicht-Regel für künftige Sessions: vor Code-Bau Field-Dump anfordern)
```

---

## 9. Re-Run-Output (Phase-1 verifiziert)

User hat Re-Import + Re-Run gefahren. Reale Werte gegen die Akzeptanz-Tabelle aus
Abschnitt 5:

| # | Kriterium | Schwelle | Prognose | **Real** | Status |
|---|---|---|---|---|---|
| 1 | Email-Befüllung | ≥ 10/16 | 12–14/16 | **14/16 (87,5 %)** | ✅ |
| 2 | Keine `unreachable`-Drift | ≤ 2 | 2 (Items 4+9) | 2 (Items 4+9) | ✅ |
| 3 | Score-Verteilung stabil | unverändert | OK by design | Spread 5–30 (vs. Plateau-30) | ✅ |
| 4 | Smoke-Test-Dump dokumentiert | ja | dieses MD | dieses MD | ✅ |
| 5 | Verbund-Mehrfach-Email | dokumentiert | siehe §3 | `info@freiewerkstatthamburg.de` Items 1+2 ✓ | ✅ |
| 6 | **Bonus Inhaber** | ≥ 6/16 | 8–11/16 | **3/14 (21 %)** | ❌ |

**Verifizierte Inhaber-Hits:**
- `kfz-hh-f6dbb445` (Z&A) → Reshadin Zurapi
- `kfz-hh-5367754c` (Eitner) → Olaf Eitner
- `kfz-hh-87ca6aee` (Klaus Schmidt) → Torsten Schmidt

**Charset-corrupt-Items (1+2):** kein Inhaber extrahiert — wahrscheinlich `�`
im Match-Bereich, Pattern hat korrekt verworfen. **Phase-2-Trigger confirmed**
(2/16 Items).

**Pipeline-Status:** Pitch-fähig (Email-Hit-Rate 87,5 % deckt den primären Use-Case ab).
Inhaber-Bonus blieb hinter Erwartung — drei strukturelle Ursachen identifiziert,
gehen in den Phase-2-PR (siehe §10).

---

## 10. Future-Issues (präzisiert nach Re-Run)

### 10.1 Domain-Filter-Härtung — Pitch-blocking Bug

Drei verifizierte Fälle aus dem Re-Run, wo `pickBestEmail()` falsch fällt:

| Lead | Eigene Domain | Geliefert | Problem |
|---|---|---|---|
| autoPRO | autowerkstatt-eimsbüttel.de | `service@kfz-hartung.de` | **Fremd-Domain** (Konkurrenz!) |
| MyCarDesign | mycardesign-kfzwerkstatt.de | `kfz-meisterbetrieb@online.de` | Generischer Mail-Provider |
| Klaus Schmidt | kfz-reparatur-schmidt.de | `kfz-schmidt64@gmx.de` | GMX statt Domain-Mail |

Vermutung: `pool = nonKanzlei.length ? nonKanzlei : candidates` greift bei autoPRO zu
früh — wenn keine eigene Domain matched, wird die nächstbeste genommen ohne weiteren
Filter (Konkurrenz-Domain wird durch nichts blockiert).

**Phase-2-Fix:**
1. **Score-Penalty statt schweigender Fallback:** Email-Field bleibt leer, aber neues
   `signal_summary`-Tag `email-domain-mismatch` wird gesetzt — sichtbar im Sheet,
   blockiert keinen Auto-Versand (gibt's eh nicht), gibt aber dem manuellen Pitch ein
   Warnsignal
2. **Akzeptanz-Härtung:** „Mail-Domain == Website-Root" als hartes Kriterium —
   wenn nicht erfüllt, Email NIE in Spalte E, sondern in `notes` als
   `email-extern:service@kfz-hartung.de` dokumentiert
3. **Konkurrenz-Erkennung:** wenn Email-Domain != Website-Hostname **und** Email-Domain
   matched eine ANDERE Lead-Site im Sheet → Verbund-Verdacht (zur Diskussion)

### 10.2 Inhaber-Pattern-V2

3/14 Hit-Rate ist deutlich unter Erwartung (8–11). Drei vermutete Ursachen:

1. **HTML-Tag-Wrapped Labels:** `<strong>Geschäftsführer:</strong> Tobias Klein` —
   mein `htmlText()` ersetzt Tags durch Space, aber dazwischen kann mehrfach Whitespace
   entstehen. Pattern erwartet `[^:]*:` direkt — wenn Tag einen Space davor lässt,
   matcht der Doppelpunkt-Boundary anders.
2. **Non-Standard TMG-Labels:** „Verantwortlich für den Inhalt:", „Inhaltlich
   verantwortlich:", „Verantwortlich i.S.d. §55 RStV:", „Geschäftsleitung:",
   „Betriebsinhaber:" — alle TMG-konform, aber nicht im aktuellen Label-Pattern.
3. **Doppelnamen + Titel-Kombinationen:** `Dipl.-Ing. Hans-Peter Müller-Schäfer` mit
   2-Wort-Limit könnte truncieren auf `Hans-Peter Müller-Schäfer` korrekt — aber wenn
   Titel-Skip versagt, scheitert komplett.

**Phase-2-Pattern-V2:**
- Label-Pattern erweitern um `Verantwortlich(?:e[rn]?)?\s+(?:für\s+)?(?:den\s+Inhalt|nach|i\.S\.d\.)?`
   und `(?:Betriebs-)?Inhaber(?:in)?` und `Geschäftsleitung`
- HTML-Tag-Wrapping: vor Label-Match das HTML aggressiver normalisieren
   (mehrfache Whitespaces auf einen reduzieren, auch zwischen `<strong>` und `:`)
- Debug-Pfad: bei No-Match `_inhaber_debug` Field setzen mit ersten 100 chars nach
   einem TMG-Marker — Sheet-sichtbar zur Diagnose

**Empfehlung User:** pick 3 fehlgeschlagene Impressums (Hatipoglu, Stellingen, Parsa)
aus dem Re-Run-Dump und debugge offline. Eigener Auftrag, separater PR.

### 10.3 Signal-Drift bei Gollnick

`signal_summary: "https-ok"` für `http://www.kfz-meister-betrieb.de/` — der `no_ssl`
sollte `true` sein (HTTP, kein HTTPS). Mögliche Ursachen:

1. Mein `websiteUrlNorm = websiteUrl.replace(/^http:/, 'https:')` normalisiert die URL
   in `_places_json` zu HTTPS — Haiku sieht dann fälschlicherweise HTTPS-URL
2. Haiku-Halluzination: HTML zeigt HTTPS-Links nach extern, Haiku schließt fälschlich
   auf SSL-Status der Site selbst

**Phase-2-Fix:**
- `websiteUrlNorm` nicht zu HTTPS forcen, sondern Original-Scheme behalten
- `_places_json.url_scheme` als explizites Feld an Haiku liefern
- Haiku-Prompt: „`no_ssl` strikt aus URL-Scheme, nicht aus HTML-Inhalt ableiten"

Future-Issue, nicht Pitch-blocking.

### 10.4 Charset-Phase-2 (bereits dokumentiert in §2)

Trigger confirmed (2/16 corrupt). Lösung wie skizziert: `responseFormat: arraybuffer`
+ manueller `TextDecoder('iso-8859-1')` mit Header-Charset-Detection.

---

## Status

🟢 **Phase-1 durch.** Pipeline ist Pitch-fähig (Email-Hit-Rate 87,5 %, alle
strukturellen Akzeptanz-Kriterien erfüllt, Verbund-Detection verifiziert).

Inhaber-Bonus blieb mit 21 % unter Erwartung — drei Phase-2-Punkte (Inhaber-Pattern-V2,
Domain-Filter-Härtung, Charset-Phase-2) für separaten PR identifiziert und
oben dokumentiert.

Cowork schreibt Pitch-Plan v2 mit Bucket-Logik (Bucket A: Domain-Match-Mail direkt
versenden, Bucket B: Pre-Versand-Impressum-Check).

---

## 11. Closing — Phase-1-Build closed, Phase-2-Bug-Fixes pending before scale

Initial-Run SH-weit (6×6, ~$25, ~400–600 Leads) wird bewusst aufgeschoben bis die
drei Phase-2-Bug-Fixes umgesetzt sind:

- **Domain-Filter-Härtung** (§10.1): autoPRO-Fall liefert Konkurrenz-Mail — beim
  Skalieren auf SH-weit würde dieser Bug 30–50 Leads mit Fremd-Domain-Mails ins
  Sheet schreiben, deren Pitch-Versand aktiv schadet.
- **Inhaber-Pattern-V2** (§10.2): 21 % Hit-Rate auf 16 Leads würde sich auf SH-Maßstab
  multiplizieren — pro Run ~120 Leads ohne Inhaber-Tag, manueller Pitch-Aufwand
  erhöht sich proportional.
- **Charset-Phase-2** (§10.4): aktuell 14 % data-loss; bei größerer geographischer
  Streuung (Husum, Flensburg, Westküste) ist mit höherem Latin-1-Anteil zu rechnen
  weil ältere CMS dort verbreiteter sind.

**Phase-1-Validation läuft anders ab:** Emin pitcht ab morgen früh die 16 verifizierten
Hamburg-Leads manuell aus Bucket A des Pitch-Plans v2. Reply-Quote ist das eigentliche
Akzeptanz-Signal — wenn Bucket-A-Pitches Reply-Rate >5 % erreichen, ist die Pipeline-
Output-Qualität als ausreichend bestätigt und Phase-2-Patches + Initial-Run werden
priorisiert. Wenn Reply-Rate niedrig, geht der Fokus auf Pitch-Mail-Qualität, nicht
auf weiteren Lead-Volumen-Ausbau.

**Repo-State nach diesem PR:**
- `workflows/n8n/leadhunter_kfz_sh.json` — Phase-1-Workflow, importbar
- `workflows/n8n/SETUP_leadhunter_kfz_sh.md` — Klick-Anleitung
- `_logs/leadhunter-build-2026-04-29.md` — Build-Verlauf
- `_logs/email-extraction-fix-2026-04-30.md` — dieses Log

**Phase-2-PR-Backlog** (eigene Auftragsketten, nicht in diesem PR):
- `feat(leadhunter): inhaber-pattern-v2` — HTML-Tag-Normalisierung + erweiterte TMG-Labels
- `feat(leadhunter): domain-filter-strict` — Score-Penalty bei email-domain-mismatch
- `feat(leadhunter): charset-phase-2` — arraybuffer + TextDecoder mit Header-Detection
- `fix(leadhunter): no-ssl-signal-drift` — URL-Scheme nicht zu HTTPS forcen vor Haiku
