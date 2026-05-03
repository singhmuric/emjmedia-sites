# Mini-Generator (Baustein 4 — Phase A Skelett)

Lokales Node-Skript: liest einen Lead-Block aus `LEAD_PROFILES.md`, kopiert ein
KFZ-Template-Folder, ersetzt 12 Tokens (+ 1 abgeleiteten) und schreibt alle
`kfz-demo.emj-media.de`-URLs auf die Lead-Subdomain um.

**Spec:** `EMJmedia/specs/MORNING_FLOW_SPEC.md` §5
**Token-Mapping:** `sites/onepages/kfz-template-v2-placeholder/PLACEHOLDERS.md`
**Status:** Phase-A-Skelett — keine Cron-Anbindung, keine Briefing-MD-Generierung,
keine Halluzinations-Felder-Behandlung (kommt Phase-B).

---

## CLI

```bash
node scripts/mini-generator/generate-demo-site.mjs \
  --lead-profile <path/to/LEAD_PROFILES.md> \
  --lead-id      <kfz-hh-...> \
  --template-source <path/to/template-folder> \
  --output-target   <path/to/output-folder> \
  [--force]
```

`--force` erlaubt Ueberschreiben eines existierenden Output-Folders (sonst Abbruch).

### Akzeptanz-Beispiel — Test-Lead Z&A

```bash
node scripts/mini-generator/generate-demo-site.mjs \
  --lead-profile /Users/eminho/BUSINESS/SinghMuric/EMJmedia/pitch-queue/2026-04-30_LEAD_PROFILES.md \
  --lead-id kfz-hh-f6dbb445 \
  --template-source sites/onepages/kfz-template-v2-placeholder \
  --output-target /tmp/test-za
```

Erwartete Ausgabe:

```
Demo-Site fuer KFZ Technik Z&A unter /tmp/test-za erstellt.
N Tokens ersetzt. URLs gerewritten zu kfz-technik-za.emj-media.de
(M Files beruehrt).
```

### Verifikation

```bash
# 1. Keine Tokens uebrig (v2-Template hat nur 12 aktive — INHABER_NAME / HERO_IMAGE_PATH
#    sind reserviert aber nicht im Markup, daher 0 erwartet).
grep -c "{{" /tmp/test-za/index.html

# 2. Keine kfz-demo-URLs mehr (recursive ueber alle Text-Files).
grep -rc "kfz-demo.emj-media.de" /tmp/test-za/

# 3. Headless-Render + Screenshots @ 1440x900 + 375x812.
node scripts/mini-generator/verify-render.mjs --path /tmp/test-za
# → schreibt /tmp/test-za/_verify/desktop-1440.png + mobile-375.png
# → JSON-Report auf stdout (Title, Nav-Brand, Ribbon, JSON-LD name, leftoverTokens)
```

---

## Architektur

```
scripts/mini-generator/
├── package.json          (type:module, keine eigenen Deps — puppeteer aus root,
│                          fs.readdirSync({recursive:true}) statt glob-Paket)
├── generate-demo-site.mjs (Haupt-Skript — CLI-Entry)
├── verify-render.mjs     (Optionale Puppeteer-Verifikation, separate Aufruf)
├── lib/
│   ├── lead-validator.mjs (parst Markdown, findet Lead-Block, Pflicht-Felder-Check)
│   ├── token-replace.mjs  (12+1 Token-Substitutions, GOOGLE_RATING_DECIMAL vor
│   │                       GOOGLE_RATING gemaess PLACEHOLDERS.md §Reihenfolge)
│   └── url-rewriter.mjs   (recursive Text-File-Walk, Binaries via Extension-Skip)
└── README.md             (diese Datei)
```

### Aufruf-Konvention

Aufruf-Form ist `node scripts/mini-generator/generate-demo-site.mjs ...` —
**kein Shebang, kein `chmod +x`**. Das Skript laeuft als ESM-Modul.

---

## Verhalten — Schritt fuer Schritt

1. **CLI parsen** via `node:util` `parseArgs` (kein commander/yargs noetig).
2. **Lead-Profile lesen** — Markdown mit ` ```json ... ``` `-Bloecken, einer pro Lead.
3. **Lead-Block selektieren** anhand `--lead-id`. Wenn nicht gefunden: Fehler mit
   Liste aller verfuegbaren IDs aus dem File.
4. **Pflicht-Felder-Check** (`lead-validator.mjs`):
   - Pflicht: `business_name, street, postal_code, city, district, phone_display,
     phone_e164, google_rating, review_count, google_maps_url, is_https`
   - Optional: `email` (faellt auf `""` zurueck wenn leer)
   - Fehler bei leerem Pflicht-Feld nennt Feld-Namen.
5. **Template kopieren** via `fs.cpSync(..., {recursive:true})` —
   `PLACEHOLDERS.md` wird ausgefiltert (interne Doku, gehoert nicht in den Output).
6. **Token-Replace** auf alle `*.html` im Output. Reihenfolge der Substitution
   ist wichtig (siehe PLACEHOLDERS.md §Pflicht-Reihenfolge): `GOOGLE_RATING_DECIMAL`
   muss **vor** `GOOGLE_RATING` ersetzt werden, sonst matcht `GOOGLE_RATING_DECIMAL`
   das `GOOGLE_RATING`-Praefix und produziert `4,9_DECIMAL`. Map preserves
   insertion order in JS — daher Map statt Object.
7. **HTML-Escape** wird pragmatisch uniform angewendet (PLACEHOLDERS.md §HTML-Escaping
   Variante 2): `&` → `&amp;` ueberall, JSON-LD-Parser tolerieren das.
   Fuer `KFZ Technik Z&A` wird der Name also als `KFZ Technik Z&amp;A` eingesetzt.
8. **URL-Rewrite** recursive ueber das gesamte Output-Folder
   (`fs.readdirSync({recursive:true,withFileTypes:true})`). Binaer-Files werden
   per Extension geskippt (`.avif|.webp|.woff|.woff2|.png|.jpg|.jpeg|.ico`).
   Damit landen zukuenftige URL-Insertions in CSS/Manifest/Sitemap automatisch
   im Rewrite-Scope, nicht nur die heute bekannten 6 Vorkommen in `index.html`.
9. **Konsole-Log** mit Business-Name, Output-Pfad, Token-Count, Target-Host,
   File-Count.

---

## Edge-Cases

| Fall | Verhalten |
|---|---|
| Lead-ID nicht gefunden | Fehler mit Liste der verfuegbaren IDs aus dem File |
| Pflicht-Feld leer | Fehler nennt Feld-Namen (z.B. `Lead "..." hat leere Pflicht-Felder: phone_e164`) |
| `email` leer | Default `""` — keine Fehlermeldung, mailto: bleibt leer |
| Output-Target existiert | Abbruch mit Hinweis auf `--force` |
| `--force` gesetzt | `rmSync({recursive:true})` vor Copy |
| `lead.build_meta.slug` fehlt | Fehler — slug ist Pflicht fuer URL-Rewrite |
| Slug-Kollision (zwei Leads gleicher Slug) | **Out-of-Scope Phase A** — Sheet-Lookup
muss vorher unique slug garantieren (Sonnet-Pre-Qual-Node). Mini-Generator wuerde
einfach den Output-Folder ueberschreiben (mit `--force`) bzw. abbrechen (ohne). |

---

## Was Phase A NICHT macht (aus MORNING_FLOW_SPEC §5.6 + §5.7)

- **Halluzinations-Felder** (Customer-Testimonials, Stats-Counter `3200/27/98%`,
  Trust-Ribbon `seit 1998`, Schliesszeiten, `addressRegion`, geo-Koordinaten,
  `foundingDate`) bleiben unangetastet. Phase-B (KW 19) raeumt auf.
- **`{{INHABER_NAME}}`** ist im v2-Template **nicht im Markup** vorhanden
  (PLACEHOLDERS.md §Reservierte Platzhalter). Phase-A faehrt ohne Conditional-
  Footer-Block. Phase-B ergaenzt den Block und triggert ihn an `owner_name`.
- **`{{HERO_IMAGE_PATH}}`** wird nicht ersetzt — Hero-Bildwechsel laeuft per
  Datei-Replacement in `assets/hero-{480,960,1600}.{avif,webp}`, nicht per Token.
- **Mailto-Link-Generierung** (Sonnet-4 in Briefing-MD-Generator).
- **Briefing-MD-Card-Output** (Sonnet-6 in der Cron-Integration).
- **Vercel-Subdomain-Routing** (separater Patch, manuelles Vercel-Config).
- **Cron-/n8n-Trigger** (Sonnet-6 So fuer VPS-Cron + Filewriter-Anbindung).

---

## Abweichungen vom Briefing

- **`glob`-Paket nicht verwendet.** Briefing nannte `glob` als devDep fuer
  recursive File-Walks. Node 20.12+ liefert `fs.readdirSync({recursive:true,
  withFileTypes:true})` mit identischer Funktionalitaet — keine Extra-Dep noetig.
  Briefing-Intent (recursive walk ueber alle Text-Files) bleibt erfuellt.
- **`puppeteer` nicht in dieser package.json.** Bereits in Repo-Root als devDep
  vorhanden, Node-Modul-Resolution findet es upward. Spart duplicate install im
  Non-Workspace-Monorepo.
- **`grep -c "{{" index.html` Erwartung.** Briefing nannte `2 oder 3` (INHABER_NAME
  + HERO_IMAGE_PATH duerften drin bleiben). Tatsaechlich enthaelt das v2-Template
  **keine** dieser beiden Tokens im Markup (PLACEHOLDERS.md bestaetigt:
  „Reservierte Platzhalter — Template hat keinen passenden Slot"). Erwarteter
  Wert nach Substitution: **0**. Build-Log dokumentiert die Abweichung.
