# Akzeptanz-Bericht — N8N Email-Quote-Verbesserung Phase-3

**Auftrag:** N8N_EMAIL_QUOTE_VERBESSERUNG_BRIEFING.md (4 Schichten A/B/C/D)
**Workflow:** `leadhunter_kfz_sh` (id `iZ060qurswViA2qa`)
**Session:** 2026-05-06 14:30–15:10 CEST · Sonnet 4.6 / Claude Code
**Final-Stand:** workflow active, 21 Nodes, alle Phase-3-Patches live, REPLACE_WITH-Survivors = 0

---

## 1. Soll/Ist-Tabelle pro Schicht

| Schicht | Soll | Ist | Status |
|---|---|---|---|
| **A — Cloudflare-Email-Protect-Decode** | XOR-decode `data-cfemail`-Hex-Strings + `/cdn-cgi/l/email-protection#HEX`-URLs; CF-Indicator-Detection | `decodeCfEmail()` + `extractCfEmails()` + `hasCfProtectIndicator()` in `Extract Email from Impressum`. 7 Smoke-Tests aller Edge-Cases (key=0x00–0x7F, multiple Tags, cdn-cgi-Pattern) — alle PASS. | ✅ |
| **B — `mailto:`-Link-Extract** | `href="mailto:..."`-Regex + `decodeURIComponent` + plain-Email-Regex auf decoded HTML | Bereits in Phase-2 implementiert (`extractMailtos`, `extractPlainEmails`). Phase-3 erweitert: source-Tag-Tracking (`mailto-own-domain` vs `mailto`). | ✅ (already shipped + enhanced) |
| **C — Whois/Standard-Prefix-Fallback** | Wenn A+B leer + Domain reachable → `info@{registrable-domain}` mit `email_source='guess'` + Triage-Penalty | Inline in `Extract Email from Impressum` (kein eigener Node). Reachable = `(impressum_status===200 || website_status===200)`. Score-Calc-Penalty -15 + signal-Tag `email-guess`. **Plus Bug-Fix:** Social-Aggregator-Hosts (facebook.com, instagram.com, wix.com, …) blockieren Schicht-C-Trigger (sonst `info@facebook.com` für Facebook-Page-Leads). | ✅ |
| **D — hunter.io optional** | Free-Tier API als zweiter Fallback; nur wenn A+B+C leer; ENV `HUNTER_API_KEY` | Stub-Kommentar im Code. Nicht aktiviert — Briefing markiert "niedrigste Prio" und Test-Yield (95.5%) macht es unnötig. | 🟡 deferred |
| **Sanity-Checks** | GET-Snapshot vor jedem PUT, REPLACE_WITH=0, settings nur executionOrder, post-PUT GET re-verify | 4 PUT-Operations via MCP `n8n_update_partial_workflow` (auto-merging credentials/sheet-IDs). Post-PUT GET: alle Marker (Schicht-A/C/Phase-3-Tags) live, REPLACE_WITH=0, active=true. | ✅ |
| **Re-Run gegen 305 (eff. 246) Rows** | Lokal in JS gegen frische Website+Impressum-Fetches; Akzeptanz `>30%` der Rows haben Email | **235 / 246 = 95.5%** (Faktor 3.2× Akzeptanz-Schwelle) | ✅ +65 pp |

---

## 2. Diff-Summary geänderter Code-Nodes

### 2a. PATCH — `Extract Email from Impressum`

**Vor (Phase-2):** Einfache mailto + plain-Regex + HTML-Entity-Decode + business-prefix-Score. Output-Felder: `_email_extract`, `_email_source_extract`, `_email_extract_candidate_count`.

**Nach (Phase-3):**

- **Schicht A** ergänzt: `decodeCfEmail(hex)` + `extractCfEmails(html)` + `hasCfProtectIndicator(html)`. CF-Decode wird auf raw Impressum-HTML, raw Website-HTML UND HTML-Entity-decoded combined-HTML angewendet (manche Themes encoden CF-Tag erneut via Entities).
- **Schicht C** ergänzt: `registrableHost(websiteUrl)` mit Social-Aggregator-Blocklist. Inline-Fallback nach `pickBest`: wenn `result.email===''` UND `(impressum_status===200 || website_status===200)` UND registrableHost gültig → `info@{root}` mit `source='guess'`.
- **Source-Tagging granularer:** Map(email→sourceTag) trackt woher jeder Kandidat kommt; `pickBest` gibt im Winner-Source mit (`cf-decoded`, `cf-decoded-own-domain`, `mailto`, `mailto-own-domain`, `business-own-domain`, `business-prefix`, `own-domain`, `first-match`, `guess`).
- **Neue Output-Felder:** `_email_cf_indicator`, `_email_cf_count`, `_email_mailto_count`, `_email_plain_count`, `_email_used_guess`.

**Kein neuer Node — Schicht C ist inline ergänzt** (vermeidet zusätzlichen DAG-Hop, Score-Calc-Patch ist die einzige downstream-Konsequenz).

### 2b. PATCH — `HTML Truncate + Merge Context`

| Patch | Was | Warum |
|---|---|---|
| Email-Quelle | Priorität geflippt: zuerst `_email_extract` (4-Schichten-Pipeline) lesen, lokales `extractEmails`+`pickBestEmail` nur als Fallback | Vorher konnte HTML-Truncate's redundante Logik einen Datenschutz-Email als Winner produzieren obwohl Schicht-A-CF-decode den richtigen `info@`-Hit hatte |
| Source-Pass-Through | Neue Felder im Output: `_email_source`, `_email_used_guess`, `_email_cf_indicator` | Score-Calc downstream braucht diese für Penalty + Tag |
| Domain-Mismatch | Berechnung jetzt im neuen Code-Pfad: registrable-Host-Vergleich gegen Email-Domain | Mismatch-Flag bleibt erhalten für `email-domain-mismatch`-Penalty |

### 2c. PATCH — `Score Calc + Build Sheet Row`

| Patch | Was | Warum |
|---|---|---|
| Guess-Penalty | `if (ctx._email_used_guess \|\| emailSource==='guess') score -= 15; summary += ',email-guess'` | Triage soll echte Treffer (CF-decoded, mailto-own-domain, plain) priorisieren — guess-Adressen haben höheres Bounce-Risiko |
| Source-Tags | `email-cf` (Schicht-A wins), `email-mailto` (Schicht-B-mailto wins) als signal-Tag | Triage-Layer kann Vertrauenslevel ablesen ohne separate Spalte |
| Notes-Field | `notes = inhaber:NAME · email_source:SOURCE` | Sheet-Schema bleibt fix; Source wird in `notes` mitgeschickt |

### 2d. Workflow-Aktivität & Sanity

- 4 PUTs total (Extract Email Phase-3, HTML Truncate, Score Calc, Schicht-C-Social-Bug-Fix) — alle 200, `success:true`
- post-PUT GET: alle Phase-3-Marker live (`decodeCfEmail`, `STANDARD_GUESS_PREFIX`, `Phase-3 Email-Quote-Fix`, `email-guess`, `SOCIAL_AGGREGATOR_HOSTS`)
- `REPLACE_WITH`-Count = 0 (alle credential-IDs + Sheet-ID via Snapshot-Merge preserved)
- `settings.executionOrder = 'v1'` (kein binaryMode-Reject)
- `active = true`

---

## 3. Re-Run-Bilanz (lokaler Force-Full-Run gegen Sheet-Rows ohne Email)

**Quelle:** Sheet `1ZXkM4BVnqYQjVV406-y1QzAnz4hM7111-MRrdx2Tqqk` Tab `Leads` via temp-Read-Workflow `_tmp_read_leads_for_email_quote` (nach Re-Run gelöscht).

**Sheet-State 2026-05-06 14:30:**

| Metrik | Vor Phase-3 |
|---|---|
| Total Rows | 337 |
| Mit Email (vor Phase-3) | 37 (11.0 %) |
| Ohne Email | 300 (89.0 %) |
| Davon mit `website_url` (re-runnable) | **246** |
| Ohne Email + ohne Website (unfixable) | 54 |

**Lokaler Re-Run gegen die 246 Re-Runnable:**

| Kategorie | Count | % |
|---|---|---|
| **Mit Email gewonnen (gesamt)** | **235** | **95.5 %** |
| Schicht A — CF-decoded | 4 | 1.6 % |
| Schicht B — mailto / plain-Regex | 201 | 81.7 % |
| Schicht C — Standard-Prefix-Guess | 30 | 12.2 % |
| Website-Fetch failed | 9 | 3.7 % |
| Website ok aber kein Treffer | 2 | 0.8 % (beide Facebook-Pages — Schicht-C korrekt unterdrückt) |

**Source-Breakdown (winning source):**

```
mailto-own-domain:        87  ← stärkster Pfad, Email auf Site explizit verlinkt
business-own-domain:      50  ← business-prefix + own-domain via plain-Regex
guess:                    30  ← Schicht C
mailto:                   26  ← mailto auf Fremd-Domain (gmx, premio-RDH, …)
first-match:              20  ← plain-Regex Fallback (kein business-prefix)
business-prefix:          12  ← business-prefix aber Fremd-Domain
none:                     11  ← Website-fetch failed oder zero candidates
own-domain:                6  ← own-domain ohne business-prefix
cf-decoded-own-domain:     3  ← Schicht A + own-domain
cf-decoded:                1  ← Schicht A + Fremd-Domain
```

### 3a. Schicht-A — CF-decoded Wins (4 Stück, alle eigentlich Eigen-Domain)

| Business | Domain | Email |
|---|---|---|
| Auto Technik Wandsbek | autotechnikwandsbek.de | info@autotechnik-wandsbek.de |
| Lackdocs Hamburg | lackdocs-hamburg.de | info@lackdocs-hamburg.de |
| Autoservice Klopp | kfz-werkstatt-neumuenster.de | info@kfz-werkstatt-neumuenster.de |
| M&C Autoglas Nord | mc-autoglas-nord.de | info@mc-autoglas-nord.de |

### 3b. Schicht-C — Guess Wins (30 Stück, Auswahl)

Alle haben `email_source:guess` im notes-Feld + `email-guess`-Tag im signal_summary + Score -15 → Triage sortiert sie nachrangig:

| Business | Email |
|---|---|
| KFZ-Werkstatt Olaf Eitner | info@eitner-kfz.com |
| Reifen Hagemann | info@reifen-hagemann.de |
| Peters GmbH Karosserie- Lackierfachbetriebe | info@peters-gruppe.de |
| Lackiererei Thielemann | info@lackiererei-thielemann.de |
| Speedy Auto-Service GmbH | info@speedyautoservice.de |
| Reifenservice Looft | info@reifen-looft.info |
| Stehning GmbH Karosserie- + Lackierzentrum | info@stehning.com |
| Menke KFZ-Technik | info@menke-kfz.de |
| Carglass-Filialen (×8) | info@carglass.de |
| Wintec-Autoglas-Filialen (×4) | info@wintec-autoglas.de |
| Emil Frey-Filialen (×2) | info@emilfrey.de |

> ⚠️ Carglass / Wintec / Emil Frey-Cluster sind eigentlich Filialketten — die Filialketten-Block-Liste in `data/filialketten-kfz.json` sollte sie schon im Pre-Filter aussortieren. Wenn sie hier auftauchen, ist die Block-Liste lückenhaft. Separates Track. Schicht-C-Logik selbst ist korrekt: domain → registrable-host → info@. Der Score-Penalty (-15) gibt Triage die Kontrolle.

### 3c. Failed-Cases (11 Stück, irreparabel auf diesem Pfad)

| Business | Grund |
|---|---|
| EuroPlus Reifenservice | facebook.com-Page (Schicht C korrekt unterdrückt) |
| M.V Performance | facebook.com-Page (Schicht C korrekt unterdrückt) |
| 9 weitere | Website-fetch fail (DNS NXDOMAIN, ECONNRESET, ETIMEDOUT, 5xx) — Domain effektiv tot |

> 💡 Für die 9 Fetch-Fails gibt's nichts zu retten — die Sites sind offline oder Aggregator-Subdomains (`autorepair.paraharita.com`, `autoservice.com/...`). Triage-Layer kann diese als `website_unreachable` taggen und manuell-only-Pitch oder gar nicht angehen.

---

## 4. Production-vs-Lab-Yield-Caveat

**Wichtig:** Die 95.5%-Quote ist im **lokalen Re-Run** mit fresh fetches gegen Website + bis-zu-3 Impressum-Kandidaten erreicht worden. Die n8n-Production-Workflow `HTTP Impressum Fetch`-Node trifft heute aber nur **eine einzige URL** (`{websiteUrl}/impressum`) — wenn diese 404 ist (z.B. Site hat `/Impressum/` mit Großschreibung oder externe Datenschutz-Seite), kommt kein Impressum-HTML beim Code-Node an.

**Wirkung in Production beim nächsten Mo-06:00-Schedule-Run:**

- Die ~28 rows die Email aus pure Website-HTML kriegen (mailto/plain im Header/Footer): n8n trifft sie ✓
- Die ~30 Schicht-C-guess wins (Domain reachable + kein Email gefunden): n8n trifft sie ✓
- Die ~177 mailto/plain Wins **die ein Impressum brauchten** (Email war NICHT auf Homepage, nur in der Impressum-Subpage): n8n trifft sie nur, wenn `{website}/impressum` tatsächlich existiert.

Erwarteter Production-Yield-Korridor: **65–85%** (statt 95.5% lab). Immer noch ≥ 2× Faktor über Akzeptanz-Schwelle 30%.

**Phase-3.1-Empfehlung (out-of-scope diese Session):** Erweitere `HTTP Impressum Fetch` um Multi-Candidate-Discovery — entweder als neues Code-Node `Build Impressum Candidates` (parsed `/impressum`-Links aus Decode-Website-Binary-HTML, sortiert nach Likelihood, max 3 candidates) oder direkt in `Extract Email from Impressum` (lass den Code-Node selbst HTTP fetchen wenn nötig). Das schließt den Lab-Production-Gap.

---

## 5. Run-Historie (diese Session)

| Aktion | Status |
|---|---|
| GET workflow snapshot (vor Phase-3) | ✅ 138k bytes, 21 nodes, active |
| Smoke-Test CF-Decoder lokal | ✅ 7/7 PASS (CF-classic, CF-key=0x7F, /cdn-cgi-URL, multiple, HTML-hex-entity, mailto-only, no-email) |
| PUT 1 — Extract Email Phase-3 (full replace) | ✅ |
| PUT 2 — HTML Truncate (priority flip + propagate) | ✅ |
| PUT 3 — Score Calc (guess penalty + tags + source notes) | ✅ |
| Temp workflow Sheet-Read | ✅ created/activated/triggered/deleted |
| Local Re-Run v1 (246 rows, 8 parallel) | 96.7 % yield, 2 social-bugs erkannt |
| PUT 4 — Schicht-C Social-Aggregator-Blocklist | ✅ |
| Local Re-Run v2 (clean) | **95.5 % yield, 235/246, 0 social-bugs** |
| Snapshot post-PUT verify | ✅ alle Phase-3-Marker live, REPLACE_WITH=0 |
| Temp workflow delete | ✅ |

---

## 6. Production-Run-Empfehlung

1. **Schedule-Trigger Mo 06:00** läuft regulär — keine Aktion nötig. Workflow ist active, alle Patches landen automatisch im nächsten Run.
2. **Backfill der existierenden 246 no-email rows:** Out-of-Scope dieses Briefings. Optional: bei nächstem manual-Trigger `isSmoke=false` setzen + 6×6-Matrix laufen lassen — die meisten Rows werden re-discovered und gefüllt.
3. **Phase-3.1 Multi-Candidate-Impressum-Fetch:** separates Spec-Track wenn Production-Yield unter 50% landet (gemessen nach erstem Mo-Run).

---

## 7. Memory-Update-Vorschläge

- `feedback_email_extract_4_schichten`: Phase-3-Pattern — 4 Schichten (CF-decode, mailto, plain, standard-prefix-guess) im n8n-Code-Node, source-Tagging via Map(email→tag), Triage-Penalty -15 für guess. Gilt für alle Branchen-Pipelines, nicht nur KFZ-SH.
- `feedback_schicht_c_social_blocklist`: Standard-Prefix-Fallback DARF NIE auf social/aggregator-Domains feuern (facebook, instagram, wix, jimdofree, etc.) — sonst landen `info@facebook.com`-Garbage-Rows im Sheet. Blocklist-Set neben registrableHost-Helper.
- `feedback_n8n_partial_update_patch_field`: Surgical Code-Node-Patches via `n8n_update_partial_workflow` operation `patchNodeField` mit `fieldPath: "parameters.jsCode"` + `patches: [{find, replace}]`. Strict-Mode: Errored wenn find nicht eindeutig — saubere Alternative zu Full-Node-Replace bei kleinen Diffs.

---

## 8. Smoke-Test-Source

Reproducible in `/tmp/email-quote/`:

- `new_extract_email.js` — final Phase-3 Code (12.5 kB) wie deployed
- `smoke-test.mjs` — 7 Edge-Case-Tests Schicht A
- `rerun-extract.mjs` — Local 4-Schichten-Re-Run gegen no_email_rows.json
- `rerun_results.json` — final 246-row Output (235 wins, 11 losses dokumentiert)
- `snapshot.json` / `snapshot_after.json` — pre/post-PUT workflow JSON

**Akzeptanz erfüllt:** 95.5 % > 30 % Schwelle. Workflow active, ready für Mo-06:00-Schedule-Run.
