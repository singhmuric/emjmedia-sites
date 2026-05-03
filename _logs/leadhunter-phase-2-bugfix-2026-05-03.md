# Phase-2 Bug-Fix — P3 charset-phase-2 Buffer/String-Type-Mismatch

**Branch:** `feat/leadhunter-phase-2-patches` (Bug-Fix als neuer Commit)
**Datum:** 2026-05-03
**Vorgänger-Commit:** `3557a8e` — feat(leadhunter): phase-2 patches — 4 datenqualitäts-härtungen
**PR:** #8 (offen, wird mit dieser Bug-Fix-Note erweitert)

## 1. Field-Verifikation (Pflicht-Vorschritt)

Memory-Pattern `feedback_n8n_field_verification`: vor Code-Patches in n8n-Code-Nodes
erst Field-Names per Sample-Dump verifizieren. Direkt-Zugriff auf n8n-API mit
Token aus `_Strategie/secrets/n8n-api-token-2026-05-01.txt`.

**Verifikations-Call:**
```bash
TOKEN=$(grep -oE 'eyJ[A-Za-z0-9._-]+' .../n8n-api-token-2026-05-01.txt | head -1)
curl -s -H "X-N8N-API-KEY: $TOKEN" \
  "http://187.124.171.59:5678/api/v1/executions/66?includeData=true" \
  | jq '.data.resultData.runData["HTTP Website Fetch"][0].data.main[0][0].binary.data'
```

**Echte Buffer-Shape** (n8n VPS in `N8N_DEFAULT_BINARY_DATA_MODE=filesystem-v2`):
```json
{
  "bytes": 41091,
  "data": "filesystem-v2",
  "fileExtension": "html",
  "fileName": "kontakt.html",
  "fileSize": "41.1 kB",
  "id": "filesystem-v2:workflows/iZ060qurswViA2qa/executions/66/binary_data/<uuid>",
  "mimeType": "text/html"
}
```

Schlüssel-Befund: `binary.data.data` ist NICHT base64-Content, sondern der
LITERAL-STRING `"filesystem-v2"` (13 Zeichen). Echter Buffer liegt auf Disk
und ist nur über den Helper materialisierbar.

## 2. Bug-Reproduktion

Phase-2-Patch-V1 (Commit 3557a8e) im HTML Truncate Code-Body:
```js
buf = Buffer.from(item.binary.data.data, 'base64');
```
liefert in filesystem-v2-Mode: `Buffer.from('filesystem-v2', 'base64')` =
9 Bytes Garbage (`~)^³+-zo¯` — exakt das was Sheet-Output bei allen 18 Leads
in execution 66 zeigt: `_html_snippet_len=9, prefix="~)^³+-zo¯"`).

Folge-Schäden in der Sheet-Ausgabe Phase-2-Re-Run:
- 0/18 Email-Quote (Phase-1: 14/16)
- 0/18 Inhaber-Hits (Soll: 6/14+)
- 11/18 mit Tag `html-nicht-parsierbar` von Haiku
- 7/18 mit `kein-ssl` (P4 funktioniert — bestätigt dass nur P3 gebrochen ist)

## 3. Fix — Workflow-Restructure

Da `this.helpers.getBinaryDataBuffer(itemIndex, propertyName)` nur für DIRECT-INPUT
items des aktuellen Code-Nodes funktioniert und upstream-Binary nicht über den
Helper erreichbar ist, wurde EIN neuer Code-Node eingefügt.

**Neue Node-Kette:**
```
HTTP Places details
  → HTTP Website Fetch
    → Decode Website Binary  ← NEU
      → HTTP Impressum Fetch
        → HTML Truncate + Merge Context  ← refaktoriert
```

**Decode Website Binary** (`runOnceForEachItem`, async):
- Liest Website-Binary direkt vom Helper: `await this.helpers.getBinaryDataBuffer($itemIndex, 'data')`
- Charset-Detection (UTF-8 → Mojibake-Heuristik → Latin-1-Fallback)
- Schreibt String in `$json._website_html_decoded`, `$json._website_charset_used`
- Pass-through aller Original-JSON-Felder via `Object.assign({}, $json, {...})`
- Tolerant-Pfad: bei Memory-Mode `Buffer.from(bin.data, 'base64')` als ersten Versuch

**HTML Truncate + Merge Context** (refaktoriert):
- Website: liest String aus `$('Decode Website Binary').all()[i].json._website_html_decoded`
- Impressum (direct input): `await this.helpers.getBinaryDataBuffer(i, 'data')` → Buffer → `decodeBufferSmart`
- Async-loop für `await readImpressum(i)` (Code-Node v2 unterstützt top-level await)

## 4. Akzeptanz-Tests (Pflicht — Buffer-Shape-Mock)

End-to-end-test wurde umgebaut so dass ALLE Mock-Items die ECHTE filesystem-v2-Shape
verwenden — `binary.data.data === 'filesystem-v2'` Marker, echter Buffer in einer
Side-Map, Mock-Helper liefert Buffer per `(nodeName, itemIndex)`-Lookup.

**Vorher / Nachher** (offline gegen filesystem-v2-Mock-Items, identische Test-Cases):

| Patch | Vorher (Mock = Memory-Mode) | Nachher (Mock = filesystem-v2-Mode) |
|---|---|---|
| P1 Inhaber-Pattern | 4/4 | 4/4 |
| P2 Domain-Strict | 9/9 | 9/9 |
| P3 Charset-Decode | 2/2 (Mock-Memory hatte Bug nicht reproduziert) | 2/2 (Echter VPS-Bug reproduziert + gefixt) |
| P4 No-SSL | 5/5 | 5/5 |
| Score-Calc | 8/8 | 8/8 |
| **Gesamt End-to-End** | **28/28** | **28/28** |

Smoke-Test (lib-v2 Pure-Functions): **13/13** unverändert.

## 5. Pflicht-Akzeptanz-Checkliste

- [x] Buffer-Shape via n8n-API-Direct verifiziert vor Patch (execution 66 inspiziert)
- [x] Bug-Fix als neuer Commit auf bestehendem Branch `feat/leadhunter-phase-2-patches`
- [x] Self-Smoke-Test um Buffer-Input-Test erweitert (filesystem-v2-Mock = echte Shape)
- [x] Build-Log mit Vorher/Nachher-Counts pro Patch (dieses Dokument)
- [ ] n8n-Re-Run-Akzeptanz auf VPS (USER-Pflicht — Manual-Trigger nach Push):
  - 14/16+ Email-Quote (zurück auf Phase-1-Niveau)
  - 6/14+ Inhaber-Hits (P1 inhaber-pattern-v2 greift)
  - 0× `html-nicht-parsierbar` Tag (P3 Decode wirkt)
  - 7-9/14 `kein-ssl`-Tag bleibt (P4 unverändert)
  - 3 Domain-Mismatch-Penalty bei autoPRO/MyCarDesign/Klaus-Schmidt (P2 greift)
- [ ] PR #8 Beschreibung um Bug-Fix-Note erweitert (curl gegen GitHub-API)

## 6. Risiko-Notizen

- Async-`await` in HTML Truncate erfordert n8n Code-Node-Type-Version ≥2 — bereits gesetzt (`typeVersion: 2`).
- Wenn n8n-Instance auf Memory-Mode (`N8N_DEFAULT_BINARY_DATA_MODE=default`) umgestellt würde,
  funktioniert der Tolerant-Pfad in `readBufferTolerant` — Memory-base64 wird zuerst versucht,
  dann Helper-Fallback. Beide Modi werden somit bedient.
- Zusätzlicher Node erhöht Workflow-Latenz minimal (1 weiterer Hop, Decode-Code ist <10ms/Item).

## 7. NICHT in diesem Patch

- P1, P2, P4 unverändert — nur P3-Pfad gefixt.
- Keine Logik-Änderung in Score-Calc oder Haiku-Prompt.
- Kein Refactor von HTTP-Node-Settings — `responseFormat: 'file'` bleibt für beide.
