# Setup — leadhunter_kfz_sh

Companion zu `leadhunter_kfz_sh.json`. Eine durchgängige Klick-Anleitung für den Erst-Import in n8n.

---

## 0. Voraussetzungen-Check

Bevor du das JSON importierst, prüfe:

```bash
# Secrets vorhanden? (nur Größe lesen, keinen Inhalt)
ls -la /Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/ \
  | grep -E "google-places|anthropic-api|google-sheet-leads"
# Erwartet: 3 Files mit perms 600
```

VPS-seitig (nicht von Mac aus prüfbar):

```bash
# auf n8n-VPS ausführen
docker ps | grep wendebau_filewriter
# Erwartet: Container läuft, Port 5679 exposed, Mount /opt/vault/_PULSE:/pulse
```

Falls filewriter nicht läuft → Container starten oder Node 18 vorübergehend deaktivieren (im n8n-UI Rechtsklick → Disable). Workflow läuft dann ohne Vault-Briefing-Schreiben durch; das Briefing-Markdown bleibt im letzten Node-Output sichtbar.

---

## 1. Workflow importieren

1. n8n-UI öffnen → **Workflows → Import from File** → `workflows/n8n/leadhunter_kfz_sh.json`
2. Nach Import: Workflow heißt `leadhunter_kfz_sh`, Status **Inactive**, 18 Nodes sichtbar
3. Du wirst beim Öffnen der Nodes Warnungen sehen — die Credentials zeigen `REPLACE_WITH_*`. Das ist erwartet, wir wiren sie im nächsten Schritt.

---

## 2. Drei Credentials anlegen

Reihenfolge spielt keine Rolle — jede Credential wird einmal angelegt und dann an alle Nodes gebunden, die sie nutzen.

### 2.1 Google Sheets OAuth2 (`info@emj-media.de`)

> Dieser Schritt ist nicht durch Sonnet/Claude Code automatisierbar (Spec §7.1). Browser-Flow erforderlich.

1. Bei einem der drei Sheets-Nodes (z.B. **Sheets Read existing place_ids**) auf das Credential-Dropdown klicken → **Create New Credential** → **Google Sheets OAuth2 API**
2. Bei der Google-Login-Maske: **`info@emj-media.de`** verwenden — NICHT `emuric122@gmail.com`. Letzterer hat keinen Zugriff auf das Sheet.
3. Berechtigungen bestätigen (Read/Write Spreadsheets)
4. Credential speichern unter Name: `Google Sheets (info@emj-media.de)`
5. Diese Credential dann auch an die anderen zwei Sheets-Nodes binden:
   - **Sheets Append Lead**
   - **Sheets Read All (post-append)**

### 2.2 Google Places (Query Auth)

1. **HTTP Places textSearch** öffnen → **Credentials** → **Create New Credential** → **Custom Auth** (oder **Query Auth**, je nach n8n-Version)
2. Wenn n8n eine **Query Auth**-Option anbietet:
   - Name: `key`
   - Value: Inhalt aus `/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/google-places-api-key-2026-04-28.txt` (per `cat` lesen, kopieren)
3. Falls deine n8n-Version **Query Auth** nicht direkt anbietet: Custom Auth mit `qs: { key: "..." }` in der JSON-Definition
4. Credential speichern als: `Google Places (Query Auth: key)`
5. Auch an **HTTP Places details** binden

### 2.3 Anthropic (Header Auth)

1. **HTTP Anthropic Haiku (Signal Extract)** öffnen → **Credentials** → **Create New Credential** → **Header Auth**
2. Name: `x-api-key`
3. Value: Inhalt aus `/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/anthropic-api-key-2026-04-29.txt`
4. Credential speichern als: `Anthropic (Header: x-api-key)`

---

## 3. Sheet-ID an drei Stellen einsetzen

Die Datei `/Users/eminho/BUSINESS/SinghMuric/_Strategie/secrets/google-sheet-leads-kfz.txt` enthält die Sheet-ID (Format: `1AbCd...`). Per `cat` lesen, dann in jedem der drei Sheets-Nodes:

- **Sheets Read existing place_ids** → Document-Field auf die ID setzen
- **Sheets Append Lead** → dito
- **Sheets Read All (post-append)** → dito

Tab-Name ist überall `Leads` — das ist im JSON schon eingetragen.

> Hinweis: Die Sheet-ID ist nicht öffentlich — bitte nicht mitcommitten oder in den Workflow-JSON eintragen, falls der Workflow später ins Repo zurückexportiert wird.

---

## 4. Sheet-Header verifizieren

Bevor der erste Run startet:

1. Sheet öffnen, prüfen dass Tab `Leads` existiert
2. Zeile 1 enthält genau diese 13 Header in dieser Reihenfolge:
   ```
   lead_id | business_name | address | phone | email | website_url | google_rating | review_count | score | signal_summary | status | pitch_date | notes
   ```
3. Daten-Validierung Spalte `status` (Dropdown mit 7 Werten) und Spalte `pitch_date` (Datums-Format `YYYY-MM-DD`) eingerichtet (Spec §2)
4. Conditional Formatting Spalte `score` (≥70 grün, 40–69 gelb, <40 grau)

Wenn etwas fehlt → erst Sheet-Schema fixen, dann weiter.

---

## 5. Smoke-Test (1 Hub × 1 Query, ~$0.50 Kosten)

Vor dem vollen Initial-Run (~$25) machen wir einen kleinen Trockenlauf.

1. **Build Hub Query Matrix** öffnen → vorübergehend den Code so ändern, dass nur 1 Hub × 1 Query erzeugt wird:
   ```javascript
   // SMOKE-TEST-MODUS:
   const hubs = [{ name: 'Hamburg', lat: 53.5528, lng: 10.0067 }];
   const queryTemplates = ['KFZ Werkstatt'];
   ```
   (Restlicher Code bleibt — schreibt 1 Item statt 36 raus.)
2. **Manual Trigger** → **Execute Workflow**
3. Erwartete Resultate:
   - Places textSearch liefert ~50–80 raw places
   - Pre-Filter behält ~30–50
   - Sheets Read liefert (beim allerersten Run) leere existing-Liste
   - Dedup behält ~30–50 als „neu"
   - Places-details + Website-Fetch + Haiku laufen für alle (~30 × 3 HTTP-Calls × ~2 Sek = ~3 Min)
   - Sheets Append schreibt ~30 Zeilen
   - Briefing-Markdown landet im Vault unter `_PULSE/2026-04-29/EMJMEDIA_LEADS_BRIEFING.md` (oder im letzten Node-Output, falls filewriter-Node disabled)
4. Sheet öffnen → prüfen:
   - Alle 13 Spalten gefüllt (auch leere Felder schreiben leer)
   - `lead_id` matched Pattern `kfz-hh-[0-9a-f]{8}`
   - `score` numerisch, 0–100
   - `signal_summary` ≤ 80 Zeichen
   - `status` ist `scored` (oder `new` falls Haiku-Error gehandlet wurde)

Wenn Smoke-Test passt → Build-Matrix-Code zurück auf vollständige 6×6 Liste setzen.

---

## 6. Initial-Run (voller Scope, ~$25)

Achtung — dies ist der teuere Lauf. Bestätige Budget bevor Execute.

1. Sicherstellen: Build-Matrix wieder auf 6 Hubs × 6 Queries gesetzt
2. **Manual Trigger** → **Execute Workflow**
3. Lauf dauert ~30–60 Min (500–700 Leads × ~3 Sek HTTP-Stack)
4. Während des Laufs: bei n8n-UI auf Executions-Tab — wenn ein Node konsistent failed (z.B. 401 von Anthropic), Stop und prüfen
5. Nach Run-Ende:
   - Sheet hat ~400–600 Leads
   - Score-Verteilung roughly: 30 % ≥ 60, 40 % 40–59, 30 % < 40
   - Briefing-MD im Vault unter `_PULSE/{datum}/EMJMEDIA_LEADS_BRIEFING.md`

---

## 7. Akzeptanz-Check (Spec §7)

Mit dem User abhaken nach Initial-Run:

- [ ] Workflow lädt sauber im n8n-UI, alle Nodes verbunden
- [ ] Manual-Trigger-Run läuft komplett durch
- [ ] Alle 13 Sheet-Spalten werden geschrieben
- [ ] `lead_id`-Format `kfz-hh-{8char-hash}` ✓
- [ ] `score` numerisch 0–100, geclampt
- [ ] `signal_summary` kommasepariert, max 80 Zeichen
- [ ] Pre-Filter wirft Filialketten + nicht-OPERATIONAL raus (Stichprobe: keine ATU-/Pit-Stop-Lead in Sheet)
- [ ] Website-Unreachable-Pfad funktioniert (Lead mit kaputter URL bekommt `website_unreachable` Signal + Score-Bonus +30)
- [ ] Haiku-Error-Pfad: Lead mit `status=new` und `signal_summary=HAIKU_ERROR` erscheint, Workflow läuft weiter
- [ ] Briefing landet unter `_PULSE/{datum}/EMJMEDIA_LEADS_BRIEFING.md`
- [ ] Briefing enthält Top 10 sortiert nach Score, Status-Tabelle
- [ ] Dedup: zweiter Run schreibt KEINE bereits existierenden place_ids
- [ ] Cron-Schedule (wöchentlich Mo 06:00) im UI sichtbar; Manual-Trigger parallel

---

## 8. Aktivieren

Erst nach grünem Akzeptanz-Check:

1. n8n-UI → Workflow **leadhunter_kfz_sh** → Toggle **Active** auf
2. Nächster Cron-Trigger: kommender Montag 06:00 Europe/Berlin

---

## Fehlerbilder, die zu erwarten sind

| Fehler | Ursache | Fix |
|---|---|---|
| `OVER_QUERY_LIMIT` aus Places | Free-Tier $200 Mo-Cap erschöpft | Initial-Run dieses Monats verschieben oder Quota erhöhen |
| `401` aus Anthropic | x-api-key falsch oder Header-Name nicht `x-api-key` | Credential prüfen — Header-Name muss exakt `x-api-key` sein |
| `403`/`PERMISSION_DENIED` aus Sheets | OAuth-Account hat kein Zugriff | Mit `info@emj-media.de` neu authentifizieren |
| Leere Briefing-MD | Pipeline leer (alle Leads gepitcht) | Erwartetes Verhalten — Empfehlungs-Text wird ausgegeben |
| Filewriter-Connection-Refused | Container nicht oben | `docker ps` auf VPS, `docker start wendebau_filewriter`, Workflow nochmal triggern |

---

## Was NICHT in diesem Setup steht

- **Status-Update-Helper** (`mark_pitched`-Webhook) ist Phase-2-Arbeit (Spec §5.5)
- **Threshold-Kalibrierung** (20-Lead-Augen-Test, Spec §6) machen wir nach erstem erfolgreichen Initial-Run
- **Multi-Branchen-Cron** (Wo 1 KFZ, Wo 2 Heizung) ist Phase 4 (Spec §5.4 v2)

Diese Erweiterungen kommen später als separate PRs.
