# Plan — KFZ-Branchen-Template v1

**Slug:** `kfz-template-v1`
**Spec:** `.specify/specs/kfz-template-v1/spec.md` (Draft, 21.04.2026)
**Stand:** 21.04.2026
**Autor:** Opus 4.7 in Cowork (Session 1.2)
**Status:** Freigegeben (Emin 21.04.2026, alle 7 offenen Punkte aus §15 per Default bestätigt) — nächster Schritt `/speckit.tasks` in Session 1.3
**Constitution-Version:** v1.1 (21.04.2026)

Dieser Plan beschreibt **wie** die Spec umgesetzt wird — Repo-Layout, Template-Engine, CSS-Architektur, Variant-System, Daten-Pipeline, Skill-Reihenfolge. Entscheidungen sind mit Begründung versehen. Wo eine Entscheidung Emin-Freigabe braucht, ist das in §15 „Offene Punkte" zusammengefasst.

Der Plan erweitert die Spec, widerspricht ihr nicht. Bei Widerspruch gewinnt Constitution > Spec > Plan.

---

## 1. Pipeline im Überblick

Vom Lead zur fertig deployten Demo-Seite:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Lead-Datensatz │ ──▶ │  Build-Skript   │ ──▶ │  HTML + CSS +   │ ──▶ │  Vercel         │
│  (JSON, n8n)    │     │  render.mjs     │     │  assets         │     │  {slug}.emj-    │
│                 │     │  (Node + Eta)   │     │  sites/onepages/│     │  media.de       │
│                 │     │                 │     │  {slug}/        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
       ▲                        ▲                        │                        ▲
       │                        │                        ▼                        │
   Phase 2                   Phase 1                ┌─────────────────┐       Phase 0
   (2.1–2.3)                 (1.3/1.4)              │  Git commit     │       (fertig)
                                                    │  auto-Deploy    │
                                                    └─────────────────┘
```

**Zentrale Bauteile:**
- **Template-Quelle** — `_templates/kfz-werkstatt/` (HTML-Partials + Eta-Syntax, CSS-Tokens, Manifest, Icons)
- **Generator** — `scripts/render.mjs` (Node-ESM, lädt Lead-JSON + Template, rendert in `sites/onepages/{slug}/`)
- **Instance-Ordner** — `sites/onepages/{slug}/` pro generierter Demo (eine self-contained Seite, kein Shared-Asset-Server)
- **Deploy** — Git push → Vercel picked up den neuen Ordner → Subdomain live

**Trennung Template ↔ Instanz** (Constitution §8.1):
- Das Template ist **nicht** selbst eine Seite. Keine `index.html` im Template-Ordner.
- Eine Instanz ist **statisch** — nach dem Rendern sind keine Platzhalter oder Partial-Includes mehr drin. Vercel serviert pure HTML/CSS/JS.

---

## 2. Repo-Layout

### 2.1 Neue Ordner, die in Session 1.3 angelegt werden

```
emjmedia-sites/
├── _templates/
│   ├── kfz-werkstatt/                  ← NEU — die Template-Quelle
│   │   ├── layout.eta                   ← Hülle (html, head, body, script-loader)
│   │   ├── partials/
│   │   │   ├── header.eta
│   │   │   ├── hero.eta
│   │   │   ├── leistungen.eta
│   │   │   ├── trust-block.eta
│   │   │   ├── cta-band.eta
│   │   │   ├── ueber-uns.eta
│   │   │   ├── ablauf.eta
│   │   │   ├── kundenstimmen.eta
│   │   │   ├── oeffnungszeiten.eta
│   │   │   ├── kontakt.eta
│   │   │   ├── faq.eta
│   │   │   └── footer.eta
│   │   ├── schema/
│   │   │   ├── autorepair.eta           ← AutoRepair-JSON-LD
│   │   │   └── faqpage.eta              ← FAQPage-JSON-LD
│   │   ├── legal/
│   │   │   ├── impressum.eta
│   │   │   └── datenschutz.eta
│   │   ├── styles/
│   │   │   ├── tokens.css               ← CSS-Custom-Props je Variante
│   │   │   ├── base.css                 ← Reset + gemeinsame Basis
│   │   │   └── components.css           ← Section-spezifische Regeln
│   │   ├── tailwind.config.cjs          ← Tailwind-Config für dieses Template
│   │   ├── icons/
│   │   │   ├── inspektion.svg
│   │   │   ├── tuev.svg
│   │   │   ├── bremsen.svg
│   │   │   ├── oelwechsel.svg
│   │   │   ├── reifen.svg
│   │   │   ├── klima.svg
│   │   │   ├── unfall.svg
│   │   │   ├── achse.svg
│   │   │   ├── e-auto.svg
│   │   │   ├── hol-bring.svg
│   │   │   ├── ersatzwagen.svg
│   │   │   └── meister-wappen.svg
│   │   ├── faq-base.json                ← 7 Standard-Q&A aus Spec FR-111
│   │   ├── copy-pool.json               ← Hero-Versprechen-Pool, CTA-Varianten etc.
│   │   └── MANIFEST.md                  ← Version, Abhängigkeiten, Changelog
│   │
│   ├── images/
│   │   └── kfz/                         ← NEU — Branchen-Bild-Pool (Session 1.3)
│   │       ├── hero-a-*.webp            (A-Variante-Kandidaten)
│   │       ├── hero-b-*.webp            (B-Kandidaten)
│   │       ├── hero-c-*.webp            (C-Kandidaten)
│   │       ├── werkstatt-innen-*.webp
│   │       ├── werkstatt-aussen-*.webp
│   │       ├── detail-*.webp
│   │       ├── werkzeug-*.webp
│   │       ├── atmosphaere-*.webp
│   │       ├── stock-*.webp             (Stock-Fotos)
│   │       └── MANIFEST.md              (Quelle, Lizenz, alt-Text pro Datei)
│   │
│   └── legal/                           ← Shared Legal-Templates (Constitution §6)
│       ├── impressum-emjmedia.md        (Demo-Phase-Impressum)
│       └── datenschutz-basis.md         (DSGVO-Basistext)
│
├── scripts/                             ← NEU
│   ├── render.mjs                       ← Haupt-Generator
│   ├── lib/
│   │   ├── eta.mjs                      (Eta-Config + Helpers)
│   │   ├── variant.mjs                  (Slug-Hash → A/B/C)
│   │   ├── image-pool.mjs               (Pool-Selection + Responsive-Sizes)
│   │   ├── schema.mjs                   (JSON-LD-Generator mit Fallbacks)
│   │   └── validate-lead.mjs            (Lead-Datensatz-Validierung)
│   └── dev-preview.mjs                  ← Lokaler Preview-Server
│
├── sites/
│   ├── onepages/                        (bestehend, wird von render.mjs beschrieben)
│   │   ├── test/                        (aus Session 0.4)
│   │   ├── kfz-demo/                    ← NEU in 1.4: Showcase-Demo aus Archetyp-Daten
│   │   └── {slug}/                      ← später: eine pro Lead
│   └── clients/                         (bestehend, aktive Kunden)
│
├── _logs/
│   ├── lighthouse/                      (bestehend, Reports landen hier)
│   └── builds/                          ← NEU — Build-Logs je Render
│
├── package.json                         ← NEU (npm-Abhängigkeiten)
├── package-lock.json                    ← NEU
└── vercel.json                          (bestehend, muss nicht angefasst werden)
```

### 2.2 Warum dieses Layout

- **Template unter `_templates/`** — nicht unter `sites/`, weil `sites/` pro Constitution §8.1 **deploybare** Ordner enthält. Das Template selbst wird nicht deployt, nur seine Renderings.
- **Partials neben dem Layout** — kein Shared-Partials-Ordner auf Repo-Ebene. Wenn ein späteres Branchen-Template (z. B. `friseure/`) ähnliche Sections hat, wird **kopiert + angepasst**. Wiederverwendung per Vererbung erzeugt Kopplung, die wir nicht wollen (eine Änderung am Friseur-Header darf nie aus Versehen KFZ-Leads brechen).
- **`scripts/` im Repo-Root** — Build-Tools gehören zur Fabrik, nicht zu einem Template. Wird in Phase 2 um n8n-Trigger erweitert.
- **Pro Instanz ein eigener Ordner mit `styles.css`** — trotz Duplikation pro Demo. Rationale: jede Seite muss self-contained sein (Vercel-Edge-Caching, keine Cross-Site-Requests, Constitution §6.5). Speicherkosten vernachlässigbar.

---

## 3. Template-Engine

### 3.1 Entscheidung: **Eta** (Node-Templating)

**Begründung:** Eta ist ~2 kB, pure Node, JS-Syntax in Templates (keine neue Sprache), hat Partials und Loops, keine Runtime-Abhängigkeit auf dem Client. Das passt exakt zum statischen Output-Ziel.

**Alternativen evaluiert:**
- **String-Replace:** zu fragil bei Loops (Leistungen, FAQ, Reviews, Öffnungszeiten). Verworfen.
- **Nunjucks:** auch gut, aber ~40 kB Dependency und Jinja-Syntax-Overhead. Verworfen.
- **Sonnet rendert jedes Mal frisches HTML:** zu teuer und nicht deterministisch — verletzt §1 Reproduzierbarkeit. Verworfen.
- **Claude Code mit Skills als Renderer:** Overkill für Tausende Leads, jeder Render würde API-Calls kosten. Claude wird beim **Template-Bau** eingesetzt (Session 1.3), **nicht** beim Rendern pro Lead.

### 3.2 Eta-Konvention

- Syntax: `<%= variable %>` für Values, `<% if (…) { %>` für Logik, `<%~ include('./partials/xyz') %>` für Partials.
- Alle Partials sind idempotent — bekommen `data` als Parameter, kein globaler State.
- Jedes Partial behandelt den Fall „Daten fehlen" lokal (zeigt nichts, statt NULL/undefined ins HTML zu schreiben). §5.4 Constitution.

### 3.3 Render-Ablauf (`scripts/render.mjs`)

1. CLI-Aufruf: `node scripts/render.mjs --lead path/to/lead.json` oder `--slug kfz-kaltenkirchen-mueller`
2. `validate-lead.mjs` prüft Pflichtfelder (§11 Spec). Fehlt eins → Fehlerabbruch.
3. `variant.mjs` bestimmt Variante aus `data.designvariante` oder aus Slug-Hash (§5.2).
4. `image-pool.mjs` wählt Hero + Werkstatt-Bilder aus Pool-Manifest (oder aus `data.hero_image_id`).
5. `schema.mjs` baut `autorepair.eta` + `faqpage.eta` mit Pflicht- und Fallback-Logik (§7).
6. Eta rendert `layout.eta` mit den zusammengesetzten Daten.
7. Output: `sites/onepages/{slug}/index.html`, `impressum.html`, `datenschutz.html`, `styles.css`, `sitemap.xml`, `robots.txt`, `assets/` (Bilder, Fonts, Icons).
8. Build-Log nach `_logs/builds/{slug}-{timestamp}.json` (Variante, Bild-IDs, Fehlende optionale Felder).
9. Exit 0 → Erfolg; Exit 1 → Fehlschlag mit klarem Grund.

---

## 4. CSS-Architektur

### 4.1 Entscheidung: **Tailwind im Build-Schritt + CSS-Custom-Props für Varianten**

**Struktur in drei Lagen:**

1. **Tailwind (gepurged)** — Utility-Klassen für Layout, Responsive, Flex/Grid, Abstände, Typografie-Skala. Läuft lokal als Build-Step (`npx tailwindcss -c _templates/kfz-werkstatt/tailwind.config.cjs -i ... -o sites/onepages/{slug}/styles.css --minify`).
2. **Base + Components** (`base.css`, `components.css`) — Reset, Formular-Styles, Accordion-Styles, Focus-Rings. Importiert via `@layer components`.
3. **Tokens** (`tokens.css`) — CSS-Custom-Properties definiert auf `:root` + `[data-variant="a|b|c"]`. Alle Varianten-spezifischen Werte (Farben, Fonts, Radien, Shadows) kommen aus Tokens, nicht aus Tailwind-Klassen.

**Beispiel Token-Schema:**

```css
:root {
  --color-bg: #FFFFFF;
  --color-fg: #1A1A1A;
  --color-accent: #1E3A5F;
  --color-accent-fg: #FFFFFF;
  --font-heading: 'Fraunces', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --radius-card: 0.5rem;
  --shadow-card: 0 1px 3px rgb(0 0 0 / 0.08);
}

[data-variant="a"] { /* Meister klassisch */
  --color-bg: #FAF8F3;
  --color-fg: #1A1A1A;
  --color-accent: #1E3A5F;
  --font-heading: 'Fraunces', Georgia, serif;
  --shadow-card: none;
}

[data-variant="b"] { /* Moderne Werkstatt */
  --color-bg: #FFFFFF;
  --color-accent: #DC2626;
  --font-heading: 'Inter', system-ui, sans-serif;
  --radius-card: 0.75rem;
  --shadow-card: 0 4px 12px rgb(0 0 0 / 0.08);
}

[data-variant="c"] { /* Handwerk pur */
  --color-bg: #1A1A1A;
  --color-fg: #F5F5F4;
  --color-accent: #FACC15;
  --font-heading: 'JetBrains Mono', ui-monospace, monospace;
  --radius-card: 0;
  --shadow-card: none;
}
```

**Warum dieser Hybrid:**
- Tailwind liefert die **Struktur** (Layout, Responsive, Utility-Speed).
- Tokens liefern das **Thema** (Farben, Fonts, Radien).
- Ein Variant-Wechsel ändert **nur Tokens**, kein HTML. Das macht A/B/C-Generierung trivial: `<html data-variant="a">` auf der Seite, alles andere kommt aus `tokens.css`.
- Wird eine neue Variante benötigt, wird nur `tokens.css` erweitert.

### 4.2 Responsive-Breakpoints

Tailwind-Default-Breakpoints reichen aus, wir mappen auf die Spec-Pflicht-Viewports (375 / 768 / 1024 / 1440):

| Name | Breite | Tailwind-Prefix | Spec-Ziel |
|---|---|---|---|
| (base) | 0–639 px | — | 375 px Mobile-Baseline |
| `sm` | ≥ 640 px | `sm:` | — |
| `md` | ≥ 768 px | `md:` | 768 px Tablet |
| `lg` | ≥ 1024 px | `lg:` | 1024 px Tablet-Landscape |
| `xl` | ≥ 1280 px | `xl:` | — |
| `2xl` | ≥ 1440 px | `2xl:` | 1440 px Desktop-Primary |

Tests laufen auf 375 / 768 / 1024 / 1440 px (Spec §6.4 + Constitution §1.8).

### 4.3 Fonts

Self-hosted WOFF2 unter `sites/onepages/{slug}/fonts/` (Constitution §1.4). Pro Variante max. 2 Fonts:

| Variante | Heading | Body |
|---|---|---|
| A | Fraunces Variable (latin, weights 400/700) | Inter Variable (latin, weights 400/600) |
| B | Inter Variable (weights 400/700/800) | Inter Variable (400/600) |
| C | JetBrains Mono (400/700) | Inter Variable (400/600) |

**Lizenz-Check:** alle drei sind SIL Open Font License 1.1 — OK. Download-URLs in `scripts/lib/fonts.mjs`. Preload-Hint `<link rel="preload" href="…" as="font" type="font/woff2" crossorigin>` im Head für Hero-Font.

### 4.4 Output-Payload-Ziele (Constitution §4.3)

| Datei | Ziel-Größe (gzipped) |
|---|---|
| `index.html` | ≤ 50 kB |
| `styles.css` | ≤ 30 kB |
| `scripts.js` | ≤ 10 kB (Ziel — Budget erlaubt 30 kB, wir zielen niedriger) |
| Hero-Bild | ≤ 180 kB |
| Gesamt initial | ≤ 400 kB |

Tailwind-Purge + Minify + Brotli (Vercel-seitig automatisch) sollten CSS deutlich unter 30 kB drücken. Wenn nicht, Content-Regeln verschärfen.

---

## 5. Variant-System (Taste-Tokens + Slug-Hash)

### 5.1 Wie eine Variante auf die Seite kommt

1. `scripts/lib/variant.mjs` berechnet die Variante aus:
   - Wenn `data.designvariante ∈ {A, B, C}` gesetzt: nimm die.
   - Sonst: `variant = hash(slug) mod 3` → Index 0/1/2 → 'a'/'b'/'c'.
2. `layout.eta` schreibt `<html lang="de" data-variant="<%= variant %>">`.
3. `tokens.css` greift via Attribute-Selector.
4. `scripts/lib/image-pool.mjs` wählt Hero-Kandidaten aus der Varianten-Unterliste.

### 5.2 Hash-Algorithmus

FNV-1a 32-bit — deterministisch, kurz, keine Crypto nötig.

```js
function variantFromSlug(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ['a', 'b', 'c'][Math.abs(h) % 3];
}
```

Verteilung über 10k zufällige Slugs: in der Erwartung gleichmäßig (±2 %). Wenn eine Variante in echten Leads überrepräsentiert ist (z. B. B über 45 %), wird später per Heuristik übersteuert (alte + Tradition-Keywords → A, „GmbH mit E-Auto-Ladepark" → B, „Tuning/Performance" → C).

### 5.3 Testbarkeit

Pro Variant wird in Session 1.4 eine Demo-Seite mit Archetyp-Daten gerendert und als `kfz-demo-a.emj-media.de`, `-b`, `-c` gepusht. Grundlage für den manuellen Taste-Vergleich.

---

## 6. Daten-Modell (Lead-JSON-Schema)

Kanonischer Vertrag zwischen Phase 2 (n8n) und Phase 1 (Renderer). Verhindert spätere Migrations-Schmerzen.

### 6.1 Schema (JSON, pflicht/optional)

```jsonc
{
  // PFLICHT (§11 Spec)
  "slug": "kfz-kaltenkirchen-mueller",               // string, ^[a-z0-9-]+$
  "firmenname": "Kfz-Werkstatt Müller GmbH",
  "ort": "Kaltenkirchen",
  "strasse": "Hamburger Str. 12",                    // kein ß im Feldnamen
  "plz": "24568",
  "telefon_e164": "+4941918765432",
  "telefon_anzeige": "04191 87 65 432",
  "oeffnungszeiten": {
    "mo": { "von": "08:00", "bis": "17:00" },        // oder null für geschlossen
    "di": { "von": "08:00", "bis": "17:00" },
    "mi": { "von": "08:00", "bis": "17:00" },
    "do": { "von": "08:00", "bis": "17:00" },
    "fr": { "von": "08:00", "bis": "15:00" },
    "sa": null,
    "so": null
  },

  // STARK EMPFOHLEN
  "gruendungsjahr": 1987,                            // int oder null
  "meister_name": "Stefan Müller",                   // string oder null
  "mitarbeiter_anzahl": 5,                           // int oder null
  "kernleistung": "kfz-werkstatt",                   // enum: kfz-werkstatt | meisterwerkstatt | karosserie-lack
  "leistungs_liste": [                               // array aus enum (6 Pflicht + 0-3 Optional)
    "inspektion", "tuev", "bremsen", "oelwechsel", "reifen", "klima",
    "unfall", "ersatzwagen"
  ],
  "email": "info@mueller-kfz.de",
  "google_rating": 4.7,                              // float 0-5 oder null
  "google_reviews_count": 84,                        // int oder null
  "google_review_zitate": [                          // 3-5 oder null
    {
      "text": "Ehrliche Beratung, fairer Preis, Termin kam schnell.",
      "vorname": "Sandra",
      "nachname_initial": "K",
      "monat_jahr": "03/2026",
      "sterne": 5
    }
  ],
  "geo_lat": 53.8292,                                // float oder null
  "geo_lng": 9.9741,
  "bundesland_kuerzel": "SH",                        // enum DE-16 oder null

  // OPTIONAL
  "whatsapp_nummer": "+4915123456789",               // string oder null
  "hero_image_id": null,                             // string oder null → auto
  "designvariante": null,                            // 'a'|'b'|'c'|null → auto
  "faq_overrides": null,                             // object oder null (key = FAQ-ID)
  "trust_signale": {                                 // bool oder null je Signal
    "meisterbetrieb": true,
    "innung": true,
    "tuev_partner": true
  }
}
```

### 6.2 Fallback-Logik pro Feld

| Feld fehlt | Verhalten |
|---|---|
| Pflicht-Feld | Build bricht ab, Fehler in `_logs/builds/` |
| `gruendungsjahr` | Hero „seit {Jahr}"-Zeile und „Über … Jahre"-Trust-Badge werden weggelassen |
| `meister_name` | Über-uns-Abschnitt wird um Meister-Satz gekürzt, generischer „Wir arbeiten…"-Text |
| `mitarbeiter_anzahl` | Keine „{N}-köpfiges Team"-Aussage |
| `google_rating` / `..._count` | Trust-Block-Badge weggelassen, Hero-Vertrauens-Zeile ohne Sterne |
| `google_review_zitate` leer | Kundenstimmen-Section entfällt komplett (FR-081) |
| `geo_lat/lng` | JSON-LD ohne `geo`-Objekt, Maps-Link nur mit Adresse |
| `whatsapp_nummer` | WhatsApp-Fallback-Button weggelassen |
| `trust_signale.*` = false/null | jeweiliges Badge weggelassen |

**Regel:** kein „TBD", kein „" (leer), keine erfundenen Defaults. Nur konditionales Weglassen. Constitution §5.4 + Spec FR-202.

### 6.3 Validator-Pflichten

`validate-lead.mjs` prüft:
- Pflichtfelder vorhanden und nicht leer
- `slug` matcht Regex + ≤ 60 Zeichen
- `telefon_e164` beginnt mit `+49` und ist 10–15 Zeichen lang
- `plz` ist 5 Ziffern
- `google_rating` falls gesetzt ∈ [0, 5]
- `leistungs_liste` enthält mindestens die 6 Pflicht-Leistungen aus FR-030
- `designvariante` ∈ {'a','b','c',null}

Bei Verstoß: Exit 1 mit lesbarem Fehler. Keine Warnungen-ignorieren-Logik.

---

## 7. SEO-Pipeline

### 7.1 JSON-LD — `AutoRepair` (aus `schema/autorepair.eta`)

Baut das Objekt aus Spec §8.2, aber **konditional** pro Feld: fehlt `geo_lat`, wird der ganze `geo`-Block weggelassen, nicht mit `null` gefüllt. Fehlt `openingHoursSpecification`, wird das Feld weggelassen. `sameAs` nur wenn Google-Business-Profile-URL bekannt.

Implementierung in `scripts/lib/schema.mjs` als Builder-Funktion, die ein JS-Objekt baut, `JSON.stringify(obj, null, 2)` macht, dann in `<script type="application/ld+json">` einbettet.

### 7.2 JSON-LD — `FAQPage` (aus `schema/faqpage.eta`)

Pro rendernder Seite aus `faq-base.json` + `faq_overrides` zusammengeführt. Jedes Q&A wird zu einem `Question`-Node mit `acceptedAnswer`. Validierung: Jede Frage muss beantwortet sein; leere Antworten → Q wird übersprungen.

### 7.3 `<title>`, `<meta>`, OpenGraph

In `layout.eta` aus Template-Patterns:

- `<title>` = `${firmenname} | KFZ-Werkstatt in ${ort}` — max 60 Zeichen, abgeschnitten bei Überlauf mit Ellipse am Firmennamen.
- `<meta name="description">` = generiert aus Copy-Pool + Stadt + 2 Kernleistungen, max 155 Zeichen. Pool liegt in `copy-pool.json` unter `meta_descriptions[]`, Varianz-Auswahl deterministisch per Hash.
- `og:title` = Title, `og:description` = Meta-Desc, `og:image` = Hero-Bild-URL (1200×630 Variante generiert bei Render), `og:locale=de_DE`, `og:type=website`, `twitter:card=summary_large_image`.
- `<link rel="canonical">` = `https://{slug}.emj-media.de/`

### 7.4 Sitemap + Robots

**Demo-Phase (default):**
```
robots.txt:
  User-agent: *
  Disallow: /

<meta name="robots" content="noindex,nofollow"> in <head>
```

**Kunden-Phase (Flag `"published": true` im Lead-JSON):**
```
robots.txt:
  User-agent: *
  Allow: /
  Sitemap: https://{slug}.emj-media.de/sitemap.xml

Meta-Robots-Tag entfernt
```

`sitemap.xml` listet immer `/`, `/impressum`, `/datenschutz` — auch in Demo-Phase harmlos.

---

## 8. Bild-Pipeline

### 8.1 Pool-Aufbau (einmalig in Session 1.3 vorgezogen)

**Wichtig:** Pool muss **vor** dem ersten Render existieren. Wird ausgelagert in einen Setup-Task innerhalb Session 1.3, nicht in eine eigene Session. Aufwand ~60 min.

- 25 KI-Bilder: erzeugt via Claude-Design / Midjourney / Stable Diffusion. Sujets laut Spec §9.1. Motive ohne Personen oder nur Hände/Rücken.
- 10 Stock-Fotos: Unsplash/Pexels (CC0) oder Pixabay. Menschen-Sujets mit Gesicht nur wenn beim Kunden später echtes Foto nachkommt.
- Alle Bilder werden durch ein Convert-Skript geschickt (`scripts/convert-images.mjs`): Output in 4 Breiten (320/768/1200/1920 px) als WebP + AVIF, `srcset`-ready. Originale in `_templates/images/kfz/src/`, derivate direkt im Template-Ordner.
- `MANIFEST.md` pro Bild: Quelle, Lizenz, Motiv-Tag (hero-a / werkstatt-innen / detail / etc), alt-Text-Vorschlag, Aufnahme-Datum.

### 8.2 Auswahl pro Render

`image-pool.mjs` liest MANIFEST, filtert nach Variant + Motive-Tag (z. B. Hero-A-Kandidaten), wählt deterministisch per Slug-Hash (anderer Salt als Variant-Hash). Output: `hero.webp`, `werkstatt.webp`, ggf. 2 weitere Detail-Bilder — werden **in den Instance-Ordner kopiert** (nicht symlinked), damit `sites/onepages/{slug}/` self-contained bleibt.

### 8.3 `<img>`-Pflicht-Attribute

```html
<img
  src="hero.webp"
  srcset="hero-320.webp 320w, hero-768.webp 768w, hero-1200.webp 1200w, hero-1920.webp 1920w"
  sizes="(min-width: 768px) 50vw, 100vw"
  alt="{alt_text aus MANIFEST}"
  width="1200" height="630"
  fetchpriority="high"
  decoding="async"
/>
```

Für alle anderen Bilder: `loading="lazy"` + `fetchpriority="low"`.

---

## 9. Formular-Submit-Flow

### 9.1 Entscheidung: **n8n-Webhook** (sowohl Demo als auch Kunde)

**Begründung:** Wir haben bereits einen produktiv laufenden n8n-Stack auf dem VPS (SYSTEM_CONTEXT). Ein Webhook-Node ist in 2 min erstellt, routet Daten weiter (E-Mail an Kunden, Slack-Ping an uns, Log in Sheet). Vercel-Functions würden einen zweiten Backend-Ort einführen.

### 9.2 Flow

1. HTML-Formular `POST` auf `https://n8n.emj-media.de/webhook/kfz-kontakt` (eine gemeinsame URL für alle KFZ-Demos; `slug` und `firmenname` werden als hidden fields mitgeschickt).
2. n8n-Webhook-Node nimmt entgegen → validiert → sendet:
   - **Demo-Phase:** Nur an EMJmedia-Inbox `info@emj-media.de` mit Betreff `[DEMO-Reaktion] {firmenname} ({slug})`. Kein Forward zum Kunden — das sind primär Reply-Signale aus Phase 3.
   - **Kunden-Phase:** Forward an Kunden-Mail mit unserem Branding-Footer, Cc an EMJmedia.
3. Nach Submit → Redirect auf `/danke.html` (eigene statische Seite mit Telefonnummer + Hinweis „Wir melden uns binnen 24 h").
4. Fallback ohne JS: Form-Action zeigt auf n8n-Webhook, Webhook antwortet mit 302 → `/danke.html`.

### 9.3 Sicherheit / Spam

- Honeypot-Feld (`<input name="company_website" tabindex="-1" class="sr-only">`) — gefüllt = Bot, n8n verwirft.
- Rate-Limit 3 Submits / IP / min auf n8n-Seite.
- Kein CAPTCHA in v1 (UX-Kosten > Spam-Nutzen bei niedrigen Lead-Volumina). Falls Spam aufkommt: hCaptcha in v2 nachrüsten.
- Keine Gespeicherten PII im Repo / in Logs — n8n nur als Transportweg.

---

## 10. Skill-Reihenfolge für Session 1.3

Session 1.3 wird in Claude Code Terminal (Sonnet 4.6) ausgeführt. Skills-First (Constitution §9.4). Dies ist der vorgesehene Loop für Sonnet:

| # | Skill | Wann | Zweck |
|---|---|---|---|
| 1 | `impeccable` | Vor HTML-Layout | Design-Exzellenz-Grundprinzipien laden |
| 2 | `taste-skill` | Beim Design-Token-Setup | Die drei Varianten präzisieren (Farben, Typografie, Whitespace-Rhythmus) |
| 3 | `emil-kowalski` | Nach funktionalem HTML | Micro-Interaction-Polish (Focus-States, Transitions, Hover) |
| 4 | `landing-page-copywriter` | Pro Text-Komponente | Copy-Pool-Texte schreiben (Hero, CTA-Band, FAQ-Antworten, Meta-Descriptions) |
| 5 | `claude-seo` | Beim SEO-Setup | Title/Meta/OG/Canonical-Patterns prüfen |
| 6 | `local-seo-skills` | Beim JSON-LD-Setup | AutoRepair-Schema-Details + Local-SEO-Hygiene |
| 7 | `web-quality-skills` | Nach Build, iterativ | Lighthouse + Performance-Review, Iteration bis ≥ 90 |
| 8 | `GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK` | Parallel zu #4 | Psychologie-Anker in Copy-Entscheidungen |

**`browser-use`** und **`cold-email`** sind in 1.3 nicht aktiv — gehören zu Phase 2/3. **`n8n-skills`** ebenfalls erst Phase 2 (außer für den Webhook-Setup-Hinweis).

---

## 11. Build-Commands + Dev-Workflow

### 11.1 `package.json` (Auszug)

```json
{
  "name": "emjmedia-sites",
  "type": "module",
  "scripts": {
    "render": "node scripts/render.mjs",
    "render:demo": "node scripts/render.mjs --fixture _templates/kfz-werkstatt/fixtures/archetyp.json",
    "dev": "node scripts/dev-preview.mjs",
    "tw:build": "tailwindcss -c _templates/kfz-werkstatt/tailwind.config.cjs -i _templates/kfz-werkstatt/styles/entry.css -o {dynamic}/styles.css --minify",
    "images:convert": "node scripts/convert-images.mjs",
    "lighthouse": "node scripts/lighthouse.mjs",
    "validate": "node scripts/render.mjs --validate-only"
  },
  "dependencies": {
    "eta": "^3.4.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "sharp": "^0.33.0",
    "lighthouse": "^12.0.0",
    "puppeteer": "^23.0.0"
  }
}
```

### 11.2 Lokaler Dev-Flow

1. `npm run render:demo` → rendert Archetyp-Fixture nach `sites/onepages/kfz-demo/`
2. `npm run dev` → startet kleinen Express/file-server auf `localhost:4000`, serviert `sites/` mit Wildcard-Subdomain-Emulation
3. Änderungen am Template → erneut `render:demo`
4. Wenn zufriedenstellend → `git commit && git push`, Vercel deployt

### 11.3 VPS-Headless-Flow (Phase 2)

- n8n-Workflow empfängt Lead → schreibt `leads/{slug}.json` → triggert `claude -p "/speckit.implement render --slug={slug}"` oder direkter Node-Call zu `scripts/render.mjs`
- Build-Ergebnis wird vom VPS gepusht → Vercel deployt
- Details dieser Integration in Session 2.2/2.3, nicht hier

---

## 12. Quality-Gates + Lighthouse-CI

### 12.1 Per-Render Quality-Gate

Nach jedem Render läuft `scripts/lighthouse.mjs` (Puppeteer + Lighthouse) gegen die gebaute Instance (lokal oder auf Vercel-Preview-URL):

| Metrik | Schwelle (Constitution §4.1/§4.2) | Verhalten bei Fail |
|---|---|---|
| Performance | ≥ 90 | Exit 2 (Warnung, Log) |
| Accessibility | ≥ 90 | Exit 2 |
| Best Practices | ≥ 90 | Exit 2 |
| SEO | ≥ 90 | Exit 2 |
| LCP | ≤ 2,5 s | Info-Log |
| INP | ≤ 200 ms | Info-Log |
| CLS | ≤ 0,1 | Info-Log |

Reports landen unter `_logs/lighthouse/{slug}-{timestamp}.json`. Ein Fail markiert die Seite **nicht** auto-offline — Review-Gate (Constitution §9.3) entscheidet.

### 12.2 Session-1.4-Review-Gate

Die drei Demo-Varianten A/B/C werden in 1.4 manuell + durch web-quality-skills reviewt. Acceptance-Criteria aus Spec §10 als Checkliste durchgegangen. Erst wenn alle grün: `git tag kfz-v1.0`.

---

## 13. Impressum + Datenschutz (Legal-Flow)

- **Demo-Phase:** `impressum.eta` wird mit EMJmedia-Daten (Singh/Muric GbR, Kaltenkirchen) gerendert. Datenschutz-Basistext aus `_templates/legal/datenschutz-basis.md`, ohne Cookie-Banner (wir setzen keine).
- **Kunden-Phase:** Kunden-Daten ersetzen EMJmedia-Impressum. Wird Teil des Kunden-Fragebogens in Session 4.1.
- Beide Seiten sind **ihre eigenen HTML-Dateien** innerhalb des Instance-Ordners (`impressum.html`, `datenschutz.html`), keine Modal-/JS-gestützte Anzeige.

---

## 14. Verhältnis zum Rest der Fabrik

### 14.1 Was dieser Plan **nicht** tut

- Keine Lead-Acquisition (Phase 2, Session 2.1 — Google Places)
- Kein Cold-Email-Outreach (Phase 3)
- Kein Kunden-Fragebogen (Session 4.1)
- Kein automatisches Re-Rendering bei Daten-Update (Phase 4)

### 14.2 Was dieser Plan für die nächsten Phasen bereitstellt

- **Phase 2** bekommt mit dem JSON-Schema aus §6.1 die exakte Schnittstelle, die n8n befüllen muss.
- **Phase 4** bekommt mit dem `published`-Flag (§7.4) den Switch von Demo zu Kunden-Seite.
- **Phase 5** (weitere Branchen) bekommt mit der Template-Engine (§3), Token-Logik (§4) und Variant-Hash (§5) ein wiederverwendbares Fabrik-Muster — nur Template-Ordner + Image-Pool müssen neu entstehen.

---

## 15. Offene Punkte — Freigabe durch Emin

Punkte, bei denen ich einen Default gesetzt habe, aber Emins Bestätigung hilfreich ist:

1. **Eta als Template-Engine** (§3.1) — Alternativ Nunjucks. **Empfehlung: Eta.**
2. **n8n-Webhook als Form-Endpoint** (§9.1) — Alternativ Vercel-Function. **Empfehlung: n8n.**
3. **Self-contained Instance-Ordner mit Bild-Kopien** (§2.2, §8.2) — Alternativ Shared-CDN-Ordner. **Empfehlung: self-contained** (einfacher, Vercel-Edge-freundlich, kein Cross-Origin).
4. **Fonts A/B/C-Auswahl** (§4.3) — Fraunces / Inter / JetBrains Mono. Alternative A: Source Serif statt Fraunces. **Empfehlung: Fraunces** (moderner, freundlicher Serif).
5. **Demo-Phase = `noindex` per Default** (§7.4) — bestätigt durch Spec, aber nochmal expliziter Check: einverstanden, dass Cold-Mail-Demos **nie** in Google-Index landen, bis Kunde zahlt? **Empfehlung: ja** (verhindert Duplicate-Content-Schäden für echte Kunden-Domain später).
6. **Pool-Bild-Aufbau in Session 1.3** (§8.1) — Bild-Generierung kostet ~60 min extra in 1.3. Alternativ: eigener Session-Block 1.2.5. **Empfehlung: in 1.3 integrieren** (sonst blockt es die Implementation).
7. **Kein CAPTCHA in v1** (§9.3) — Risiko bewusst tragen? **Empfehlung: ja**, erst nachrüsten wenn Spam-Rate > 10 %.

Wenn alle 7 per Default laufen: kein weiteres Meeting nötig, `/speckit.tasks` kann direkt in Session 1.3 starten.

---

## 16. Referenzen

- `.specify/specs/kfz-template-v1/spec.md` — die Spec, deren Architektur dieser Plan liefert
- `.specify/CONSTITUTION.md` v1.1 — übergeordnete Grundordnung
- `_Strategie/SYSTEM_CONTEXT.md` — Architektur der Fabrik insgesamt
- `EMJmedia/WEBSITE_FABRIK_PLAN_v2.md` — 18-Sessions-Overall-Plan
- Eta Docs: https://eta.js.org
- Tailwind Config: https://tailwindcss.com/docs/configuration
- Schema.org AutoRepair: https://schema.org/AutoRepair
- FNV-1a Hash: http://www.isthe.com/chongo/tech/comp/fnv/

---

## Änderungshistorie

- **21.04.2026 (Session 1.2, nach Freigabe):** Status auf „Freigegeben" gesetzt. Alle 7 offenen Punkte aus §15 per Default durch Emin bestätigt (Eta / n8n-Webhook / self-contained Instance / Fraunces-Inter-Mono / Demo `noindex` / Pool-Aufbau in 1.3 / kein CAPTCHA in v1). Ready für `/speckit.tasks`.
- **21.04.2026 (Session 1.2):** Initial. Opus in Cowork. Eta + Tailwind + CSS-Custom-Props, FNV-Slug-Hash für Variante, n8n-Webhook als Form-Endpoint, Lead-JSON-Schema als Phase-2-Schnittstelle, Skill-Reihenfolge für Session 1.3. 7 offene Punkte zur Freigabe gestellt.
