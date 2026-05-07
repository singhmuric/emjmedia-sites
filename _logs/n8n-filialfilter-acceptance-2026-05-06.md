# Akzeptanz-Bericht — N8N Filialketten-Pre-Filter härten

**Auftrag:** EMJmedia/specs/N8N_FILIALKETTEN_FILTER_BRIEFING.md
**Workflow:** `leadhunter_kfz_sh` (id `iZ060qurswViA2qa`)
**Session:** 2026-05-06 ~14:30 CEST · Sonnet 4.6 / Claude Code
**Final-Stand:** workflow active, 21 Nodes, alle Pflicht-Patches live, GET-vor-PUT-Pattern eingehalten

---

## 1. Soll/Ist-Tabelle

| # | Akzeptanz-Kriterium | Soll | Ist | Status |
|---|---|---|---|---|
| 1 | Block-Liste komplett ersetzt | DACH-KFZ-Filialketten als BLOCK_LIST embedded | 85 Brands embedded (von 8 vorher) — Reifen 27 + Autoglas 22 + Schnellservice 2 + Lackiererei 4 + Aufbereitung 5 + Karosserie/Konzern 5 + Reste | ✅ |
| 2 | Pattern-basierte Erkennung | FILIALE_PATTERNS als RegExp-Array | 4 Pattern: gmbh-stadt-suffix, filiale-marker, ehemals-prefix, plz-stadt-suffix — alle nur gegen `name` (nicht `address`) | ✅ |
| 3 | isFilialkette() im Pre-Filter | Hit → drop (Block-Liste hard-DQ; >=2 Pattern hard-DQ; 1 Pattern soft-tag) | implementiert. Block-Match `continue`. Pattern-multi `continue`. Pattern-1 setzt `_filial_pattern` + `_filial_penalty` für späteren Score-Calc | ✅ |
| 4 | Konfigurierbarkeit (Universal-System) | JSON-File `scripts/auto-pilot/data/filialketten-kfz.json` als Source-of-Truth | Datei mit `schema_version: 1`, `block_list` nach Kategorien, `filiale_patterns` mit `match_field` + `weight` + `comment`, `negative_examples` für Test-Suite | ✅ |
| 5 | Test-Suite (10 Filial-Leads) | 10 garantierte Filialketten geblockt | 15/15 Positive (Carglass, Reifen Helm, KS AUTOGLAS, junited, Wintec, Driver Center, ATU, pit-stop, Vergölst, TyreXpert, AUTOGLAS SPEZIALIST, reifencom, Quick Reifendiscount, Reifen Blötz) + 8/8 Negative (Solo-Werkstätten durchgelassen) | ✅ |
| 6 | Re-Run vs. 305 Rows (Ziel ≥60) | Lokal die neue Logik gegen alle scored-Rows anwenden | 88 Hard-DQ-Hits / 337 Rows = 26% (Sheet hat 337 statt 305 Rows aktuell). 60+ Ziel um 47% übertroffen | ✅ |
| 7 | GET-Snapshot-vor-PUT | Memory `feedback_n8n_vps_put_placeholder_merge` | Snapshot vor jedem PUT (`/tmp/leadhunter-snapshots/`), `n8n_update_partial_workflow` mit `validateOnly:true` first, dann atomic apply. `REPLACE_WITH_*`-Survivors im Post-PUT-GET = 0. | ✅ |
| 8 | Race-Condition mit Sonnet 1 | Bei PUT-Conflict 30s warten, GET neu, mergen, PUT | Keine Konflikte aufgetreten — `n8n_update_partial_workflow` ist diff-basiert und touched nur Pre-Filter-Node (Sonnet 1 arbeitet am Email-Extract). Surgical Patch statt Full-PUT minimiert Race-Window. | ✅ |

**Fazit:** Alle Pflicht-Punkte erfüllt.

---

## 2. Re-Run-Diagnose-Tabelle (gegen 337 Sheet-Rows)

```
Block-Liste: 85 Brands · Pattern: 4 (alle match_field='name')
Sheet-Rows: 337

=== HITS (würden retroaktiv geblockt/erkannt) ===
Hard-DQ (Block-Liste oder >=2 Pattern):  88
Soft-Pattern (1 Pattern, nur Score-Penalty):  2
Total Hits: 90 / 337 = 27%

=== Reason-Breakdown ===
   46 × block-list:autoglas
   29 × block-list:reifen
    5 × block-list:aufbereitung
    4 × block-list:lackiererei
    4 × block-list:karosserie_konzern
    1 × pattern:gmbh-stadt-suffix
    1 × pattern:filiale-marker

Acceptance §6.2: Ziel ≥60 retroaktive Erkennung — ✅ ERREICHT (90)
```

**Top-Brands die jetzt geblockt werden** (aus Briefing-§1):
- Carglass (alle Standorte) — block-list:autoglas
- Reifen Helm (alle Standorte) — block-list:reifen
- KS AUTOGLAS ZENTRUM — block-list:autoglas
- junited AUTOGLAS — block-list:autoglas
- Wintec Autoglas — block-list:autoglas
- Driver Center — block-list:reifen
- TyreXpert — block-list:reifen
- Quick Reifendiscount — block-list:reifen
- reifencom — block-list:reifen
- AUTOGLAS SPEZIALIST — block-list:autoglas
- Emil Frey Hans Carstens — block-list:karosserie_konzern

---

## 3. Test-Suite-Result (lokal gegen lib/filialketten-filter.mjs)

```
=== POSITIVE TESTS (15 — sollen geblockt werden) ===
✅ Carglass GmbH                              → block-list:autoglas:carglass
✅ Carglass GmbH Lübeck-Mitte                 → block-list:autoglas:carglass
✅ Reifen Helm GmbH                           → block-list:reifen:reifen helm
✅ KS AUTOGLAS ZENTRUM Hamburg                → block-list:autoglas:ks autoglas
✅ junited AUTOGLAS Lübeck                    → block-list:autoglas:junited autoglas
✅ Wintec Autoglas Flensburg                  → block-list:autoglas:wintec autoglas
✅ Driver Center Husum                        → block-list:reifen:driver center
✅ A.T.U Hamburg-Wandsbek                     → block-list:reifen:a.t.u
✅ pit-stop Hamburg-Eidelstedt                → block-list:reifen:pit-stop
✅ Vergölst Reifen + Autoservice Neumünster   → block-list:reifen:vergölst
✅ TyreXpert Reifen + Autoservice             → block-list:reifen:tyrexpert
✅ AUTOGLAS SPEZIALIST Kiel                   → block-list:autoglas:autoglas spezialist
✅ reifencom GmbH                             → block-list:reifen:reifencom
✅ Quick Reifendiscount Lübeck                → block-list:reifen:quick reifendiscount
✅ Reifen Blötz GmbH (ehemals Gummi Grassau)  → block-list:reifen:reifen blötz

=== NEGATIVE TESTS (8 — sollen durchkommen) ===
✅ AutoPro Service Thomas
✅ Werkstatt Müller GmbH
✅ KFZ-Meisterbetrieb Hansen
✅ Autohaus am Bahnhof
✅ Karosseriebau Petersen
✅ Lackiererei Jensen
✅ KFZ Werkstatt Schmidt
✅ Auto Service GmbH Behrens

Total: 23/23 = 100%
```

---

## 4. Diff-Summary geänderter/neuer Files

### 4a. NEU — `scripts/auto-pilot/data/filialketten-kfz.json`
- Source-of-Truth Block-Liste, kategorisiert (reifen/autoglas/schnellservice/lackiererei/aufbereitung/karosserie_konzern)
- 85 Brands (vs. 8 vorher in CHAIN_BLOCKLIST embedded)
- 4 Pattern mit `match_field`, `weight`, `comment`
- `negative_examples` für Test-Suite
- Universal-System-Vorbereitung: `schema_version: 1`, `branche: "kfz"` — ermöglicht künftig `filialketten-handwerk.json`, `filialketten-friseure.json` etc.

### 4b. NEU — `scripts/auto-pilot/lib/filialketten-filter.mjs`
- `loadFilialkettenConfig(branche)` lädt das JSON je nach Branche
- `buildFilialkettenChecker(config)` baut typed Block-List + RegExp-Patterns + `isFilialkette(name, address)`
- `match_field`-aware: Pattern matchen entweder nur gegen `name` oder gegen `name_or_address`
- Umlaut-Normalisierung (ä→a, ö→o, ü→u, ß→ss) für robustes Matching

### 4c. NEU — `scripts/auto-pilot/test-filialketten-filter.mjs`
- 15 Positive + 8 Negative Test-Cases
- Exit 1 bei Fehlern — Cron-tauglich

### 4d. NEU — `scripts/auto-pilot/rerun-filialketten-filter.mjs`
- Diagnose-Skript: liest scored-Rows aus Sheet, wendet checker lokal an
- Reason-Breakdown nach Kategorie
- Acceptance-Check ≥60 mit Exit-Status

### 4e. PATCH — n8n-Workflow `leadhunter_kfz_sh` Node `Pre-Filter (Bundesland · Chains · Distanz · Status)`
- Vorher: 8 Brands (atu, pit-stop, vergölst, euromaster, bosch service, 1a autoservice, autocrew, premio)
- Nachher: 85 Brands embedded + 4 Patterns + isFilialkette() + Telemetry-Log (`console.log` der filtered-Counts)
- Pattern-Test only gegen `name` (nicht `address`) — verhindert False-Positives wenn Adresse PLZ+SH-Stadt enthält
- 2 PUTs (1× Hauptcode via `updateNode`, 1× Pattern-Fix via `patchNodeField`)

---

## 5. Skill-Invocations (Pflicht laut CLAUDE.md §3)

Nicht zutreffend — diese Session ist reiner Backend-Code-Patch (n8n-Code-Node + JSON-File + Test-Suite + lokale Lib). Keine UI-Arbeit, keine Section/Template, keine Motion. Skill-Pflicht-Matrix triggert nicht.

Konsultierte Memories (Pflicht-Vorgehen):
- `feedback_n8n_field_verification` (6d) — Pre-Filter-jsCode vor Patch komplett gelesen, Field-Pfad `parameters.jsCode` verifiziert
- `feedback_n8n_vps_put_placeholder_merge` (3d) — `n8n_update_partial_workflow` statt Full-PUT, `REPLACE_WITH_*`-Survivors-Check (=0)

---

## 6. Out-of-Scope (laut Briefing §8)

- Email-Quote-Verbesserung (parallel laufender Sonnet 1) — nicht angefasst
- Bundesland-Erweiterung — nicht angefasst
- Branche 2 (Universal-System Aktivierung) — nur vorbereitet (JSON-Schema-Stub `filialketten-{branche}.json`), nicht aktiviert

---

## 7. Nächster Smoke-Test

Beim nächsten Manual-Trigger oder Schedule (Mo 06:00) muss der Pre-Filter-Node:
1. Im Execution-Log `Pre-Filter: kept=X dropped={"status":N,"filiale":N,...}` ausgeben
2. `filiale`-Counter > 0 zeigen wenn die Hub-Query Filialketten findet
3. Keine `business_name` mit "Carglass", "Reifen Helm", "KS AUTOGLAS", "junited" etc. in `Sheets Append Lead` durchlassen

Verifikation per `n8n_executions` nach Manual-Trigger.
