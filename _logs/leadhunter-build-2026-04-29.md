# Leadhunter KFZ SH v1.2 — Build-Log

**Session:** Sonnet 4.6 in Claude Code (gem. CLAUDE.md §6)
**Datum:** 2026-04-29
**Spec:** `EMJmedia/specs/LEAD_GENERATOR_SPEC_KFZ_V1.md` v1.2
**Workflow-Name (Ziel):** `leadhunter_kfz_sh`
**Status:** 🔴 BLOCKED — Pre-Flight-Check vor Build fehlgeschlagen

---

## Pre-Flight-Check (vor Node-1)

Konsequent nach CLAUDE.md §10 (Eskalationspfad statt raten) und §7 🔴-Hard-Stop-Liste durchgeführt, bevor ein einziger Node angefasst wurde. Alle fünf Findings sind blocker; keiner davon ist durch Sonnet allein lösbar.

### Finding 1 — n8n-MCP nicht verfügbar 🔴

| Check | Ergebnis |
|---|---|
| Globales `~/.claude.json` `mcpServers` | `{}` — leer |
| `~/.claude/mcp-needs-auth-cache.json` | enthält keine n8n-Einträge |
| `npm ls -g \| grep n8n` | leer |
| `.mcp.json` im Repo | nicht vorhanden |
| `.claude/settings.json` im Repo | leer/nicht vorhanden |

**Konsequenz:** Ich habe keinen Tool-Zugriff auf n8n (kein `mcp__n8n__*`). Der Auftrag „bauen mit n8n-MCP" ist mit aktuellem Setup technisch unmöglich.

**Resolution-Optionen:**
- (a) n8n-MCP-Server konfigurieren (z.B. `czlonkowski/n8n-mcp` oder offizieller `n8n-nodes-mcp`) in `~/.claude.json` oder `.mcp.json` und `/mcp`-Reload — danach erst Build möglich
- (b) Alternative: Workflow als reine JSON-Definition (`leadhunter_kfz_sh.json`) im Repo bauen, danach manueller Import via n8n-UI „Import from File". Funktioniert ohne MCP, kostet aber ~30 Min Handarbeit beim Import + Credential-Wiring

### Finding 2 — Secrets fehlen 🔴

Spec referenziert `_Strategie/secrets/`. Tatsächlicher Stand:

| Erwartet | Status |
|---|---|
| `EMJmedia/_Strategie/secrets/` (Verzeichnis) | **existiert nicht** im Vault |
| `google-places-api-key-2026-04-28.txt` | nicht gefunden |
| `anthropic-api-key-*` (seit 21.04. lt. Spec) | nicht gefunden |
| `google-sheet-leads-kfz.txt` (Sheet-ID) | nicht gefunden |

`find` über das gesamte EMJmedia-Verzeichnis (`maxdepth 5`) nach `*places*`, `*anthropic-api*`, `*google-sheet-leads*` liefert null Treffer.

**Konsequenz:** Selbst ein fertiger Workflow hätte keine Credentials.

**Resolution:** Du musst die drei Files in `EMJmedia/_Strategie/secrets/` ablegen (oder mir den korrekten Pfad nennen, falls du sie woanders hingelegt hast). Ich lese die Keys aber nur **transient zum Einbinden in n8n-Credentials**, ich logge oder committe sie nicht (Constitution + Auftrag 🟡).

### Finding 3 — Google-Sheet-OAuth ist kein Sonnet-Schritt 🟡

Die Spec selbst (§7.1) anerkennt das: OAuth2-Flow für Google Sheets braucht **User-Click im n8n-UI im Browser**. Login mit `info@emj-media.de` (nicht `emuric122@gmail.com`).

**Konsequenz:** Ich kann den Workflow strukturell fertig bauen, aber bevor der Initial-Run laufen kann, musst du genau diesen Klick-Flow durchführen. Reihenfolge:
1. Sonnet: Workflow + Nodes + Code-Logik fertig, Sheets-Credential-Slot leer
2. Du: n8n-UI öffnen, Sheets-Node anklicken → „Sign in with Google" → `info@emj-media.de`
3. Sonnet: Test-Read der Header-Zeile (alle 13 Spalten korrekt?), erst dann Initial-Run

### Finding 4 — filewriter-Container nicht verifiziert 🟡

Spec referenziert `wendebau_filewriter`, Port 5679 auf n8n-VPS, Volume-Mount `/opt/vault/_PULSE:/pulse`. Ohne SSH-Zugriff zum n8n-VPS aus dieser Session kann ich nicht verifizieren:
- ob Container läuft (`docker ps`)
- ob Volume korrekt gemountet ist
- ob POST-API-Schema (`{path, content}`) noch identisch zur WendeBau-Implementation ist

**Resolution:** Bitte einen schnellen `docker ps | grep wendebau_filewriter` auf dem VPS und kurz das aktuelle POST-Schema bestätigen. Falls der Container nicht läuft, müssen wir Node 17 auf einen Fallback-Pfad legen (lokales `/tmp/`-File und Syncthing-Sync — kein Vault-Schreiben aus n8n in dem Run).

### Finding 5 — Initial-Run-Kosten ~25 USD = 🟡 nicht 🟢

Spec §5.3: Initial-Run kostet ~$25 (Places `details` × ~500 Calls + Haiku-Tokens). Im Auftrag steht „🟢 für n8n-Workflow-Bau", aber der **Initial-Run** ist eine Geld-ausgebende Action — ich bewerte das als 🟡.

**Konsequenz:** Ich baue den Workflow & verifiziere strukturell, aber den Initial-Run trigger ich erst nach deinem expliziten Go („Run starten, Budget bestätigt"). Das vermeidet, dass ein Bug im Pre-Filter oder Scoring-Code 25 $ verbrennt bevor er entdeckt wird.

---

## Vorgeschlagene Reihenfolge nach Unblock

1. **Du:** Secrets-Files in `_Strategie/secrets/` ablegen + Pfad bestätigen
2. **Du:** Entscheidung Resolution-Option für Finding 1 (MCP-Setup oder JSON-Export-Pfad)
3. **Du:** filewriter-Container-Status auf VPS bestätigen
4. **Sonnet:** Workflow nach Spec bauen (18 Nodes, Constitution §13 modulare Edits)
5. **Du:** Google-Sheets-OAuth im n8n-UI durchklicken
6. **Sonnet:** Test-Read Header-Zeile + Smoke-Test mit 1 Hub × 1 Query (~$0.50)
7. **Du:** Go für vollen Initial-Run (Budget ~25 $)
8. **Sonnet:** Initial-Run, Sheet-Output prüfen, Briefing verifizieren, Top-3 visuell
9. **Sonnet:** PR `feat(leadhunter): kfz-sh v1.2`

---

## Skill-Pflicht-Status

Per CLAUDE.md §2 wären für die Implementation `n8n-skills`-Subskills Pflicht:
- `n8n-workflow-patterns` (Architektur)
- `n8n-node-configuration`
- `n8n-code-javascript` (Pre-Filter, Dedup, Scoring, Briefing-Generator)
- `n8n-expression-syntax`
- `n8n-validation-expert`
- `n8n-mcp-tools-expert`

**Existieren** im Repo unter `.claude/skills/n8n-skills/skills/*` ✓. Werden vor Build-Start geladen, sobald Findings 1+2 unblockt sind. Aktuell **noch nicht** geladen — kein Sinn, die Skill-Inhalte zu zitieren bevor klar ist, ob/wie der Build überhaupt stattfindet.

---

## Status

**Wartend auf Eskalation/Entscheidung von Emin.** Kein Code, kein Workflow, keine API-Calls bis Findings 1+2 (Hard-Blocker) und 3+4 (Soft-Blocker mit Workflow-Konsequenzen) geklärt sind. Finding 5 (Budget-Go) erst nach erfolgreichem Smoke-Test.

---

## Update 13:50 — Unblock-Round 1

- **Sheet-ID-File:** gefunden unter `SinghMuric/_Strategie/secrets/google-sheet-leads-kfz.txt` (45 B, perms 600). Pfad ist eine Ebene höher als in Spec-Text — kein Problem.
- **Places-Key:** gefunden unter gleichem Pfad (137 B, perms 600).
- **Anthropic-Key:** gefunden unter `SinghMuric/_Strategie/secrets/anthropic-api-key-2026-04-29.txt` (109 B, perms 600). Inhalt **nicht gelesen** — Constitution + Auftrag-🟡-Regel.
- **Pfad-Entscheidung:** Emin wählt **Option (b)** — Workflow als JSON-File unter `workflows/n8n/leadhunter_kfz_sh.json`, Manual-Import via n8n-UI „Import from File". Kein MCP-Setup nötig.

## Skill-Invocations (Pflicht nach CLAUDE.md §3)

```
[13:50] skill: n8n-workflow-patterns geladen vor Build
        Quelle: .claude/skills/n8n-skills/skills/n8n-workflow-patterns/SKILL.md
        Regel: "HTTP Request läuft per Input-Item; Korrelation upstream-Daten via 
        $('Node Name').itemMatching($itemIndex)" — ersetzt Nested-SplitInBatches-Pattern
        Anwendung: Hub × Query Matrix → 36 Items → HTTP textSearch (36 Runs) → 
        Flatten-Code-Node mit Hub-Korrelation per Index

[13:50] skill: n8n-workflow-patterns
        Regel: "NEVER append on sheets with formula columns" 
        Anwendung: Spalte I score hat NUR conditional formatting (UI-Regel), 
        keine Formel — append zulässig. Risk-Check passed.

[13:50] skill: n8n-workflow-patterns
        Regel: "Google Sheets per-item execution trap"
        Anwendung: ~500-700 Append-Calls im Initial-Run werden seriell ablaufen 
        (~5-10 Min). Akzeptabel für v1; Bulk-Optimierung später falls nötig.

[13:50] skill: n8n-node-configuration
        Regel: "executionOrder v1 connection-based" + "operation-aware config"
        Anwendung: Workflow-Settings setzt executionOrder=v1; HTTP-Nodes mit 
        method=POST haben sendBody=true + body.contentType=json (Anthropic-Call, 
        Filewriter-Call); GET (Places, Website-Fetch) ohne sendBody.

[13:50] skill: n8n-skills/CLAUDE.md (Repository-Overview)
        Regel: "n8n-mcp toolset bietet validate_workflow / autofix" 
        Anwendung: Da Pfad (b) gewählt wurde, KEIN MCP-Validate verfügbar. 
        Stattdessen manuelle Self-Validation: JSON-Schema-Check (jq), 
        Connection-Map-Check, Code-Node-Smoke-Test (node -e auf reine 
        Logik-Funktionen wo möglich). Validation-Gap dokumentiert.
```

## Build-Plan

**File:** `workflows/n8n/leadhunter_kfz_sh.json`
**Companion:** `workflows/n8n/SETUP_leadhunter_kfz_sh.md` mit Credential-Anweisungen und Import-Reihenfolge.

**Node-Liste (final, 18 nach Spec-Zählung; in JSON sind es 19 inkl. zwei Trigger-Nodes — Spec zählt das als 1 logischen Trigger-Block):**

1. Manual Trigger
2. Schedule Trigger (Cron Mo 06:00)
3. Build Hub Query Matrix (Code) — emit 36 items
4. HTTP Places textSearch (runs 36×)
5. Flatten Places + Inject Hub Context (Code)
6. Pre-Filter (Code) — Bundesland-Check, Filialketten-Blocklist, Distanz, business_status, website
7. Sheets Read existing place_ids (Google Sheets)
8. Dedup vs Sheet (Code)
9. HTTP Places details (per new lead)
10. HTTP Website Fetch (per new lead, continueOnFail=true, timeout 10s)
11. HTML Truncate (Code) — auf ~3000 Tokens
12. HTTP Anthropic Haiku (Signal-Extraction)
13. Score Calc (Code) — Formel aus Spec §4.3 + lead_id-Hash
14. Sheets Append (alle 13 Spalten)
15. Sheets Read All (für Top-10-Selektor)
16. Top-10 Selektor (Code)
17. Briefing Markdown Generator (Code)
18. HTTP Filewriter POST

**Credentials, die Emin nach Import anlegen muss:**
- `Google Sheets OAuth2` (Login `info@emj-media.de`) — gebunden an 3 Sheets-Nodes
- `httpQueryAuth` für Places (Param `key`) — gebunden an 2 HTTP-Places-Nodes
- `httpHeaderAuth` für Anthropic (Header `x-api-key`) — gebunden an 1 HTTP-Anthropic-Node

Vollständige Klick-Anleitung in `workflows/n8n/SETUP_leadhunter_kfz_sh.md`.

---

## Build 14:00 — JSON erstellt + Self-Validation

**File:** `workflows/n8n/leadhunter_kfz_sh.json` (18 Nodes, 17 Connections)
**Companion:** `workflows/n8n/SETUP_leadhunter_kfz_sh.md` (Klick-Anleitung)

### Self-Validation (kein MCP, daher manuell)

| Check | Methode | Result |
|---|---|---|
| JSON syntax valid | `jq '.'` | ✓ OK |
| Node count | `jq '.nodes \| length'` | 18 |
| Connection count | `jq '.connections \| keys \| length'` | 17 (jeder Node außer dem letzten hat 1 Out-Connection; Manual+Cron beide → Build Matrix) |
| Build-Matrix produziert 36 Items | Node-eval mit Mock-Input | ✓ 36 Items, erste="KFZ Werkstatt Hamburg", letzte="Auto Lackiererei Husum" |
| Pre-Filter wirft ATU raus | Mock 5 Places → Code | ✓ Nur 1 valid Place überlebt; Dedup nimmt höhere user_ratings_total |
| Pre-Filter wirft `CLOSED_PERMANENTLY` raus | Mock | ✓ |
| Pre-Filter wirft Niedersachsen-Adresse raus | Mock mit "Lüneburg, Niedersachsen" | ✓ |
| Pre-Filter Distanz-Check (>30km) | Haversine | ✓ Funktion korrekt |
| `lead_id`-Format `kfz-hh-[0-9a-f]{8}` | sha256-Hash, slice(0,8) | ✓ Beispiel: `kfz-hh-fd810472` |
| Score-Formel Spec §4.3 | 3 Lead-Profile getestet | ✓ Werkstatt A (alles bad): 84 (no_ssl 25 + mobile 20 + copyright 15 + cta 8 + load 10 + impressum 6 = 84). Werkstatt B (unreachable + low rating): 5 (30 - 10 - 15 = 5). Werkstatt C (alles gut + 250 reviews): 5 (0 + 5 = 5). Geclampt 0–100. |
| Email-Domain-Match-Filter | Mock | ✓ `info@werkstatt-a.de` ↔ `werkstatt-a.de` akzeptiert |
| Top-10-Selektor | 4 Mock-Rows (3 scored, 1 pitched) | ✓ count=3, max_score=92, total_pitched=1, pipeline_thin=true |
| Briefing-Markdown-Generator | mock-Input von Top-10 | ✓ Path `/pulse/2026-04-29/EMJMEDIA_LEADS_BRIEFING.md`, MD startet mit `# EMJmedia Leads — Briefing 2026-04-29`, Top-Liste sortiert |
| `executionOrder: "v1"` gesetzt | jq | ✓ |
| Timezone Europe/Berlin | jq | ✓ |
| Cron Mo 06:00 | jq | ✓ weeks/weeksInterval=1/triggerAtDay[1]/triggerAtHour=6 |
| Connection-Map vollständig | jq + manuelles Tracing | ✓ Jeder Node außer Filewriter hat genau 1 Output-Connection; Manual+Cron beide → Build Matrix |

### Code-Bodies für isolierten Smoke-Test getestet (8/8)

```
✓ Build Hub Query Matrix
✓ Pre-Filter (Bundesland · Chains · Distanz · Status)
✓ Dedup vs Sheet (lead_id-Hash, Set-Compare)
✓ HTML Truncate + Merge Context (Index-Korrelation)
✓ Score Calc + Build Sheet Row
✓ Top 10 Selector
✓ Briefing Markdown Generator
✓ Flatten Places + Inject Hub (Index-Korrelation, Quota-Error-Throw)
```

(Letzte zwei Code-Nodes sind Index-basierte Korrelations-Patterns — die echte Korrelation ist erst beim n8n-Runtime-Run prüfbar, weil sie auf `$('Node').all()` über vorherige Iterationen zugreifen.)

### Status

🟢 **Strukturell fertig.** Workflow-JSON liegt im Repo. Build-Phase abgeschlossen.

Was als nächstes Emin braucht (nicht durch Sonnet ausführbar):
1. JSON in n8n-UI importieren
2. 3 Credentials anlegen (Sheets-OAuth + Places-Query + Anthropic-Header)
3. Sheet-ID an 3 Sheets-Nodes setzen
4. filewriter-Container-Status auf VPS bestätigen (`docker ps`)
5. Smoke-Test (1 Hub × 1 Query, ~$0.50) → Sheet-Output verifizieren
6. Bei Smoke-Pass: Initial-Run-Go an Sonnet für 🟡-Approval
7. Initial-Run mit voller 6×6 Matrix
8. Akzeptanz-Check (siehe SETUP §7)
9. PR `feat(leadhunter): kfz-sh v1.2`

PR wird erst NACH erfolgreichem Initial-Run aufgemacht (Auftrag-Punkt 5 Reihenfolge: Build → Run → Sheet-Check → Visual → PR).

---

## Update 2026-04-30 — Phase-1 verifiziert (Smoke-Test 1×1 Hamburg)

Nach mehreren Iterationen (UA-Headers, Anthropic-Batching, Field-Verifikation,
Email-/Inhaber-Extraktion mit /impressum-Fetch) ist Phase-1 durch:

| Akzeptanz-Krit | Wert | Status |
|---|---|---|
| Workflow lädt im n8n-UI | 19 Nodes verbunden | ✅ |
| Manual-Run komplett | 16 Leads gescort | ✅ |
| Alle 13 Sheet-Spalten | inkl. notes-Inhaber-Tag | ✅ |
| `lead_id`-Format | `kfz-hh-[0-9a-f]{8}` (FNV-1a) | ✅ |
| Pre-Filter Filialketten | ATU/Pit-Stop nicht im Sheet | ✅ |
| Website-Unreachable-Pfad | Items 4+9 (Variant-B) sauber | ✅ |
| Haiku-Error-Pfad | Debug-Reason im signal_summary | ✅ |
| Email-Hit-Rate | 14/16 (87,5 %) | ✅ |
| Verbund-Detection | Items 1+2 dokumentiert | ✅ |
| Inhaber-Hit-Rate (Bonus) | 3/14 (21 %) | ❌ Phase-2 |

**Pipeline ist Pitch-fähig.** Cowork schreibt Pitch-Plan v2.

**Phase-2-Backlog** (separater Auftrag, nicht jetzt):
- Inhaber-Pattern-V2 (HTML-Tag-Normalisierung + erweiterte TMG-Labels)
- Domain-Filter-Härtung (Score-Penalty statt Fallback bei Fremd-Domain)
- Charset-Phase-2 (arraybuffer + TextDecoder bei content-type ohne charset)
- Signal-Drift bei `no_ssl` (URL-Scheme-Force-HTTPS verfälscht Haiku-Input)

Details in `_logs/email-extraction-fix-2026-04-30.md` §10.
