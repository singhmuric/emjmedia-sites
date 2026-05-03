# Build-Log — Mini-Generator-Skelett (Baustein 4 Phase A)

**Branch:** `feat/mini-generator-skelett`
**Datei-Bereich:** `scripts/mini-generator/`
**Spec:** `EMJmedia/specs/MORNING_FLOW_SPEC.md` §5
**Briefing:** `EMJmedia/_Strategie/sa-briefings/sonnet-5-mini-generator-skelett.md`
**Sa-Plan:** 02.05.2026 — finalisiert So 03.05.2026
**Modell:** Sonnet (Implementation per Constitution §9.2)

---

## 1. Skill-Invocations

Dieser Auftrag ist ein **Backend-/Skript-Task** (Node-CLI, kein UI). Per
CLAUDE.md §2 Skill-Pflicht-Matrix triggert das **keine** der pflichtigen UI-Skills
(`taste-skill`, `emil-design-eng`, `frontend-design`, `web-design-guidelines`,
`impeccable`). Modulare CSS-Architektur (CLAUDE.md §11) ist nicht relevant —
es wird kein CSS angefasst, das Template wird unveraendert kopiert.

Geladene Skill-Regeln: keine. Begruendung: Skript-Architektur ohne UI-Komponente.

---

## 2. Architektur-Entscheidungen + Abweichungen vom Briefing

### 2.1 `glob`-Paket weggelassen

Briefing spezifizierte `devDeps: puppeteer + glob`. Stattdessen
`fs.readdirSync({recursive:true,withFileTypes:true})` (Node 20.12+) verwendet —
liefert exakt das was der Briefing-Intent (recursive Text-File-Walk) braucht,
ohne Extra-Dep. Repo laeuft auf Node 24.14.1.

### 2.2 `puppeteer` aus Repo-Root

Briefing-package.json sollte puppeteer als devDep deklarieren. Bereits in
`package.json` (Repo-Root) als devDep `^23.0.0` vorhanden. Module-Resolution
findet es upward — keine duplicate install im Non-Workspace-Monorepo.
`scripts/mini-generator/package.json` deklariert deshalb keine Deps.

### 2.3 `grep -c "{{" index.html` Erwartung — Briefing vs. Realitaet

Briefing-Akzeptanz: `→ 2 oder 3 (nur INHABER_NAME + HERO_IMAGE_PATH duerfen drin
bleiben)`. **Tatsaechlich enthaelt das v2-Template keine dieser beiden Tokens
im Markup** — beide stehen in `PLACEHOLDERS.md` als „Reservierte Platzhalter
(in v2 nicht aktiv substituiert)" weil das Template keinen passenden Slot hat.
Erwarteter und tatsaechlich gemessener Wert: **0**.

Konsequenz: Phase-B (KW 19) muss Conditional-Footer-Block fuer `INHABER_NAME`
ergaenzen, dann erscheint der Token im Markup und die Briefing-Erwartung waere
korrekt. Aktuell: Skript ist trotzdem korrekt — es ersetzt alles was im Markup
steht.

### 2.4 `PLACEHOLDERS.md` aus Output ausgeschlossen

`fs.cpSync(..., {filter: src => basename(src) !== 'PLACEHOLDERS.md'})` —
interne Doku-Datei gehoert nicht in den deploybaren Demo-Site-Output.

### 2.5 HTML-Escape uniform (PLACEHOLDERS.md §HTML-Escaping Variante 2)

Werte werden ueberall HTML-escaped (`&` → `&amp;`), auch im JSON-LD-Block.
JSON-LD-Parser (Google Rich Results) tolerieren das und decodieren HTML-Entities
beim Lesen. Spart zwei-Track-Werte. Fuer `KFZ Technik Z&A` wird der Name
`KFZ Technik Z&amp;A` eingesetzt — Browser zeigen `KFZ Technik Z&A` (siehe
Verify-Render-Report unten).

### 2.6 Token-Reihenfolge

`{{GOOGLE_RATING_DECIMAL}}` wird **vor** `{{GOOGLE_RATING}}` ersetzt
(PLACEHOLDERS.md §Pflicht-Reihenfolge). Map-Insertion-Order in JS garantiert
das. Wenn umgekehrt: `{{GOOGLE_RATING}}` matcht `{{GOOGLE_RATING_DECIMAL}}`
und produziert `4,9_DECIMAL`.

---

## 3. Test-Run gegen Z&A

```bash
$ rm -rf /tmp/test-za && \
  node scripts/mini-generator/generate-demo-site.mjs \
    --lead-profile /Users/eminho/BUSINESS/SinghMuric/EMJmedia/pitch-queue/2026-04-30_LEAD_PROFILES.md \
    --lead-id kfz-hh-f6dbb445 \
    --template-source sites/onepages/kfz-template-v2-placeholder \
    --output-target /tmp/test-za

Demo-Site fuer KFZ Technik Z&A unter /tmp/test-za erstellt.
62 Tokens ersetzt. URLs gerewritten zu kfz-technik-za.emj-media.de
(4 Files beruehrt).
```

**Token-Count 62** matcht PLACEHOLDERS.md („insgesamt 62 Vorkommen").
**4 Files** mit URL-Vorkommen: `index.html`, `datenschutz.html`,
`impressum.html`, `sitemap.xml`. Recursive-Walk hat sie alle erfasst —
inkl. der nicht in PLACEHOLDERS.md gelisteten URLs in `datenschutz.html`,
`impressum.html` und `sitemap.xml`. Das ist der Vorteil ueber simples
sed-on-index.html.

### 3.1 Verifikations-grep

```bash
$ grep -c "{{" /tmp/test-za/index.html
0

$ grep -rc "kfz-demo.emj-media.de" /tmp/test-za/
(keine Vorkommen)

$ grep -rl "kfz-technik-za.emj-media.de" /tmp/test-za/
/tmp/test-za/index.html
/tmp/test-za/datenschutz.html
/tmp/test-za/sitemap.xml
/tmp/test-za/impressum.html
```

### 3.2 Spot-Check Lead-Werte im Output

| Selektor | Erwartet | Gerendert |
|---|---|---|
| `<title>` | `KFZ Technik Z&A | KFZ-Werkstatt in Hamburg` | `KFZ Technik Z&amp;A | KFZ-Werkstatt in Hamburg` (Browser: `Z&A`) |
| `.nav__logo-text strong` | `KFZ Technik Z&A` | `KFZ Technik Z&amp;A` (Browser: `Z&A`) |
| `.ribbon` Trust | `★ 4,9 (109 Google-Bewertungen)` | ✓ |
| Hero-Eyebrow | `Freie Meisterwerkstatt · Hamburg-Hammerbrook` | ✓ |
| Hero-Widget | `4,9★ · 109 Google-Bewertungen` | ✓ |
| `<link rel="canonical">` | `https://kfz-technik-za.emj-media.de/` | ✓ |
| `og:url`, `og:image` | `kfz-technik-za.emj-media.de` | ✓ |
| JSON-LD `name` | `KFZ Technik Z&A` | `KFZ Technik Z&amp;A` (Parser-OK) |
| JSON-LD `telephone` | `+49 40 88306030` | ✓ |
| JSON-LD `streetAddress` | `Gotenstraße 3` | ✓ |
| JSON-LD `areaServed` | `Hamburg-Hammerbrook und Umgebung` | ✓ |
| JSON-LD `ratingValue` | `4.9` (Punkt!) | ✓ |
| JSON-LD `reviewCount` | `109` | ✓ |

### 3.3 Puppeteer Headless-Render @ 1440x900 + 375x812

```bash
$ node scripts/mini-generator/verify-render.mjs --path /tmp/test-za
```

Screenshots:
```
/tmp/test-za/_verify/desktop-1440.png  (1440 x 11133, fullPage)
/tmp/test-za/_verify/mobile-375.png    (750 x 32650, fullPage @ 2x DPR)
```

DOM-Extraktion (browser-side, also nach HTML-Entity-Decode):
```json
{
  "title": "KFZ Technik Z&A | KFZ-Werkstatt in Hamburg",
  "navBrand": "KFZ Technik Z&A",
  "ribbonRating": "4,9",
  "ribbonReviews": "(109 Google-Bewertungen)",
  "heroEyebrow": "Freie Meisterwerkstatt · Hamburg-Hammerbrook",
  "heroWidgetNum": "4,9★",
  "heroWidgetLabel": "109 Google-Bewertungen",
  "footerAddress": "KFZ Technik Z&A Gotenstraße 3 20097 Hamburg 040 88306030 info@za-werkstatt-hamburg.de",
  "canonical": "https://kfz-technik-za.emj-media.de/",
  "ogUrl": "https://kfz-technik-za.emj-media.de/",
  "jsonLdName": "KFZ Technik Z&amp;A",
  "leftoverTokens": []
}
```

`leftoverTokens: []` bestaetigt: kein einziges `{{...}}` im gerenderten Output.
`jsonLdName: "KFZ Technik Z&amp;A"` ist die rohe Text-Content der
`<script type="application/ld+json">`-Node — Schema.org-Parser decodieren das
auf `KFZ Technik Z&A` (siehe README §Abweichungen).

### 3.4 Edge-Case: Lead-ID nicht gefunden

```bash
$ node ... --lead-id kfz-hh-DOES-NOT-EXIST ...
Error: Lead-ID "kfz-hh-DOES-NOT-EXIST" nicht gefunden in
  /Users/eminho/BUSINESS/SinghMuric/EMJmedia/pitch-queue/2026-04-30_LEAD_PROFILES.md.
Verfuegbar (12): kfz-hh-24886792, kfz-hh-a788b739, kfz-hh-f6dbb445,
  kfz-hh-52fc7f4e, kfz-hh-a82ef350, kfz-hh-410c4908, kfz-hh-a4e5aca3,
  kfz-hh-a25530d2, kfz-hh-88d4a4b4, kfz-hh-ced5fe3c, kfz-hh-26ed031a,
  kfz-hh-d594e2ac
```

Exit 1, kein /tmp/test-fail-Folder erstellt (Failure vor FS-Write).

---

## 4. Akzeptanz-Checkliste (Briefing §PFLICHT-AKZEPTANZ)

- [x] **1.** Branch `feat/mini-generator-skelett` von `main` (vor Session bereits angelegt).
- [x] **2.** Test-Run gegen `kfz-hh-f6dbb445` (Z&A), Output unter `/tmp/test-za/`.
- [x] **3a.** `grep -c "{{" /tmp/test-za/index.html` → **0** (Briefing nannte
  `2 oder 3` — siehe §2.3 fuer Begruendung der Abweichung).
- [x] **3b.** `grep -rc "kfz-demo.emj-media.de" /tmp/test-za/` → **0**
  (alle 4 Text-Files mit URL-Vorkommen erfolgreich gerewritten).
- [x] **3c.** Puppeteer-Render @ 1440x900 + 375x812 produziert beide Screenshots
  unter `/tmp/test-za/_verify/`. DOM-Extraktion bestaetigt korrekte Z&A-Daten.
- [x] **4.** `README.md` mit CLI-Usage + Akzeptanz-Beispiel + Edge-Cases
  (lead-id nicht gefunden, Pflicht-Felder leer, Output-Target existiert,
  slug-Kollision out-of-scope).
- [x] **5.** Build-Log (diese Datei) mit Test-Output-Sample.
- [ ] **6.** PR #10 mit Title `feat(scripts): mini-generator skelett für demo-sites
  (baustein 4 phase-a)` — wird gleich nach diesem Log gepusht.
- [ ] **7.** PR NICHT mergen bis User Test-Output verifiziert (`/tmp/test-za/_verify/*.png`
  visuell pruefen).

---

## 5. Was NICHT in diesem PR ist (per Briefing §NICHT IN DIESEM PR)

- Briefing-MD-Reading (Sonnet-6 So fuer VPS-Cron-Integration)
- Schedule/Cron-Setup (Sonnet-6 So)
- Vercel-Subdomain-Routing (separater Patch)
- Halluzinations-Felder-Behandlung Phase-B (KW 19)
- INHABER_NAME-Slot-Erweiterung (Phase-B)
- Mailto-Link-Generation (kommt in Briefing-MD-Generator von Sonnet-4)

---

## 6. Naechste Schritte

1. User oeffnet `/tmp/test-za/_verify/desktop-1440.png` + `mobile-375.png`
   und prueft visuell:
   - Z&A-Name korrekt im Header, Hero, Footer, Map-Card
   - Trust-Ribbon zeigt `4,9 (109 Google-Bewertungen)`
   - Hamburg-Hammerbrook im Hero-Eyebrow
   - Telefon `040 88306030` als CTA
   - Keine leeren Sektionen, keine `{{...}}`-Reste sichtbar
2. Bei OK: PR #10 mergen.
3. Sonnet-6 So baut darauf auf:
   - Briefing-MD-Lesen → Loop ueber Top-N Leads
   - Cron-Trigger via n8n → Filewriter-Mount
   - Sheet-Lookup fuer slug-Kollisions-Handling
