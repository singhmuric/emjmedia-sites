# KFZ-Template v2 — Placeholder-System

**Stand:** 2026-04-30
**Quelle der Werte:** `pitch-queue/2026-04-30_LEAD_PROFILES.md` `demo_site`-Block pro Lead.
**Zweck:** Auto-Fill durch Mini-Generator (Baustein 4) — vorher manuelles `sed`/`find-replace`.

---

## Aktive Platzhalter (in `index.html` substituiert)

| Platzhalter | Lead-Profile-Feld | Vorkommen | Kontext / Format |
|---|---|---|---|
| `{{BUSINESS_NAME}}` | `demo_site.business_name` | 11× | Title, Meta-Desc, OG/Twitter, Nav-Logo, JSON-LD `name`, Footer-Mark, Footer-Address, Copyright, Hidden-Form-Input, Testimonial, Map-Card-SVG |
| `{{STREET}}` | `demo_site.street` | 4× | JSON-LD `streetAddress`, Kontakt-Button-Text, Footer-Address, Map-Card-SVG |
| `{{POSTAL_CODE}}` | `demo_site.postal_code` | 3× | JSON-LD `postalCode`, Kontakt-Button-Text, Footer-Address |
| `{{CITY}}` | `demo_site.city` | 10× | Title, Meta-Desc, OG/Twitter, JSON-LD `addressLocality`, Service-Ribbon "Im Umkreis…", Kontakt-Button-Text, Footer-Address |
| `{{DISTRICT}}` | `demo_site.district` | 2× | Hero-Eyebrow (Local-SEO-Marker), JSON-LD `areaServed` (`"{{DISTRICT}} und Umgebung"`) |
| `{{PHONE_DISPLAY}}` | `demo_site.phone_display` | 8× | Nav-CTA, Hero-CTA, Service-Ribbon-Notruf, Kontakt-Button, Footer-Link, Aria-Labels |
| `{{PHONE_E164}}` | `demo_site.phone_e164` | 9× | `tel:`-Hrefs (alle Telefon-Links), JSON-LD `telephone` |
| `{{EMAIL}}` | `demo_site.email` | 5× | `mailto:`-Hrefs, Kontakt-Button-Text, Footer-Link, JSON-LD `email` |
| `{{GOOGLE_RATING}}` | `demo_site.google_rating` | 3× | **Display mit Komma** (z.B. `4,9`): Trust-Ribbon, Hero-Widget-Number, Kunden-Karte |
| `{{GOOGLE_RATING_DECIMAL}}` | *(abgeleitet, siehe unten)* | 2× | **Punkt-Decimal** (z.B. `4.9`): JSON-LD `ratingValue`, `data-counter-to`-Attribut (parseFloat) |
| `{{REVIEW_COUNT}}` | `demo_site.review_count` | 4× | Trust-Ribbon, Hero-Widget-Label, Kunden-Karte, JSON-LD `reviewCount` |
| `{{GOOGLE_MAPS_URL}}` | `demo_site.google_maps_url` | 1× | Kontakt-Button "Auf Google Maps öffnen" — komplette URL inkl. CID |

**Total: 12 aktive Platzhalter mit insgesamt 62 Vorkommen.**

---

## Abgeleitete Felder

`{{GOOGLE_RATING_DECIMAL}}` ist kein eigenes Sheet-Feld — Mini-Generator berechnet es aus `google_rating`:

```
google_rating = "4,9"   →  google_rating_decimal = "4.9"
```

Begründung: `parseFloat("4,9")` in `scripts.js` Counter-Animation gibt `4` (bricht beim Komma ab). JSON-LD-Validatoren bevorzugen ebenfalls den Punkt-Decimal-Form. Beide Kontexte brauchen Punkt; Display-Kontexte brauchen Komma. Daher zwei Platzhalter, eine Quelle.

Substitution-Logik (Mini-Generator):
```bash
GOOGLE_RATING_DECIMAL=$(echo "$GOOGLE_RATING" | tr ',' '.')
```

---

## Reservierte Platzhalter (in v2 nicht aktiv substituiert)

Diese Felder waren im Auftrag definiert, das aktuelle KFZ-Template hat aber keinen passenden Slot. Mini-Generator kann sie später nachrüsten, sobald Bedarf entsteht.

| Platzhalter | Status | Begründung |
|---|---|---|
| `{{INHABER_NAME}}` | nicht gerendert | Template hat keine "Über-uns / Inhaber"-Sektion. Wenn ergänzt: Default-Fallback `"Das Team"` wenn leer. |
| `{{HERO_IMAGE_PATH}}` | nicht gerendert | Hero ist responsive `<picture>` mit AVIF/WebP × 480/960/1600. Per-Lead-Bildaustausch erfolgt durch Datei-Replacement in `assets/hero-{480,960,1600}.{avif,webp}` — kein Placeholder nötig. |

---

## Bekannte Limitierungen (Out-of-Scope dieser PR)

Diese Werte sind weiterhin hartkodiert und werden vom Mini-Generator (Baustein 4) per `sed`/`find-replace` nachgezogen oder durch zusätzliche Platzhalter ersetzt:

| Hartkodiert | Vorkommen | Behandlung in Baustein 4 |
|---|---|---|
| `https://kfz-demo.emj-media.de/` | canonical, og:url, og:image, JSON-LD `@id` + `url` + `image` (insg. 6×) | sed-Replace mit `https://{slug}.emj-media.de/` |
| `"addressRegion": "SH"` | JSON-LD (1×) | Lookup PLZ → Bundesland (z.B. 20097 → "HH") oder neuer Platzhalter |
| `"latitude": 53.9118, "longitude": 9.8875` | JSON-LD geo (1×) | Geocoding via Maps-API oder neue Platzhalter |
| `"foundingDate": "1998"` | JSON-LD (1×) | Optional-Feld, falls Sheet-Spalte ergänzt wird |
| `"Meisterbetrieb seit 1998"` (Trust-Ribbon) | 1× | Identisch wie foundingDate |
| `"Seit über 27 Jahren"` (Hero-Widget) | 1× | Aus founding_year berechenbar |
| Schließzeiten Mo–Fr 08:00–17:30 / 17:30 / 15:00 | JSON-LD `openingHoursSpecification` | Aus Places-API holen, separate Story |
| Stats-Section: `3200 Fahrzeuge`, `27 Jahre`, `98%` | 3× `data-counter-to` | Bleibt als Template-Demo-Werte; kann später optional placeholdert werden |
| Customer-Testimonials (alle Texte) | mehrere | Bleiben als Template-Demo (Constitution §5.4: keine erfundenen Echt-Testimonials, generische Demo-Texte sind aber zulässig) |

---

## Substitutions-Regeln für den Mini-Generator (Baustein 4)

### HTML-Escaping (Pflicht)

Wenn ein Lead-Wert HTML-Sonderzeichen enthält (z.B. `&` in `"KFZ Technik Z&A"`), muss er **vor** dem Einsetzen in HTML-Body/-Attribute escaped werden:

```
&  →  &amp;
<  →  &lt;
>  →  &gt;
"  →  &quot;   (nur in Attribut-Werten)
```

**Ausnahme JSON-LD:** Innerhalb `<script type="application/ld+json">` ist der Inhalt JSON, nicht HTML. Hier gelten JSON-Escape-Regeln (`"` → `\"`, `\` → `\\`), `&` bleibt unescaped.

Pragmatisch: Mini-Generator hält **zwei** vorbereitete Werte je String-Feld vor — `BUSINESS_NAME_HTML` (HTML-escaped) und `BUSINESS_NAME_JSON` (JSON-escaped). Im Template könnte auf zwei Varianten gewechselt werden, oder das Template macht einheitlich HTML-Escape und der JSON-LD-Block wird beim Rendern ein zusätzliches `&amp;` toleriert (Browser parsen JSON-LD lax) — letzteres ist die simplere Variante und für die meisten Lead-Namen ausreichend.

### Pflicht-Reihenfolge der Substitutionen

Wenn `sed` zeilenweise läuft, **muss** spezifisches vor allgemeinem ersetzt werden, sonst entstehen Doppel-Replacements:

1. `{{GOOGLE_RATING_DECIMAL}}` **vor** `{{GOOGLE_RATING}}` (sonst matcht `4,9_DECIMAL`)
2. `{{POSTAL_CODE}}` **vor** `{{CITY}}` (kein Konflikt aktuell, aber defensiv)
3. Alle Platzhalter mit `{{…}}`-Klammern sind disjoint von Lead-Werten — Substitution kann in beliebiger Reihenfolge laufen, solange Punkt 1 berücksichtigt wird.

Der oben verlinkte Test-Build mit Z&A (Lead `kfz-hh-f6dbb445`) wurde nach Punkt-1-Reihenfolge erfolgreich validiert (`grep -c "{{" → 0`).

### Default-Fallbacks

| Feld | Fallback wenn leer | Wo es greift |
|---|---|---|
| `{{INHABER_NAME}}` | `"Das Team"` | (reserviert, aktuell nicht aktiv) |
| `{{HERO_IMAGE_PATH}}` | Branchen-Pool-Default `assets/hero-{480,960,1600}.{avif,webp}` | (reserviert, Datei-Replacement) |
| Alle anderen | Pflicht-Felder — Lead ohne diese Werte = "disqualified" im Bucket-D-Sinn | Pre-Qualifizierungs-Node Baustein 1 |

---

## Test-Build Verifikation

**Lead:** `kfz-hh-f6dbb445` "KFZ Technik Z&A" (LEAD_PROFILES.md Bucket A #3)

**Substitutions-Befehl** (manuell, sed-basiert):

```bash
cp -r sites/onepages/kfz-template-v2-placeholder /tmp/za-test-build
cd /tmp/za-test-build
sed -i.bak \
  -e 's|{{BUSINESS_NAME}}|KFZ Technik Z\&A|g' \
  -e 's|{{STREET}}|Gotenstraße 3|g' \
  -e 's|{{POSTAL_CODE}}|20097|g' \
  -e 's|{{DISTRICT}}|Hamburg-Hammerbrook|g' \
  -e 's|{{CITY}}|Hamburg|g' \
  -e 's|{{PHONE_DISPLAY}}|040 88306030|g' \
  -e 's|{{PHONE_E164}}|+49 40 88306030|g' \
  -e 's|{{EMAIL}}|info@za-werkstatt-hamburg.de|g' \
  -e 's|{{GOOGLE_RATING_DECIMAL}}|4.9|g' \
  -e 's|{{GOOGLE_RATING}}|4,9|g' \
  -e 's|{{REVIEW_COUNT}}|109|g' \
  -e 's|{{GOOGLE_MAPS_URL}}|https://maps.google.com/?cid=460535966647337214|g' \
  index.html
rm index.html.bak
grep -c "{{" index.html  # → 0
```

**Verifikation (Headless-Chrome 1440×900 + 375×812):**

| Selektor | Erwartet | Gerendert |
|---|---|---|
| `<title>` | `KFZ Technik Z&A \| KFZ-Werkstatt in Hamburg` | ✓ |
| `.nav__logo-text strong` | `KFZ Technik Z&A` | ✓ |
| `.ribbon` Trust-Streifen | `★ 4,9 (109 Google-Bewertungen)` | ✓ |
| `.hero__widget` Kennzahlen | `4,9 ★ · 109 Google-Bewertungen` | ✓ |
| `footer address` | Komplette Z&A-Adresse | ✓ |
| Layout 375 / 1440 px | keine horizontale Scrollbar, Sections gefüllt | ✓ |

---

## Anhang — Lead-Profile-Block-Schema (zur Erinnerung)

Aus `pitch-queue/2026-04-30_LEAD_PROFILES.md`:

```json
"demo_site": {
  "business_name": "KFZ Technik Z&A",
  "street": "Gotenstraße 3",
  "postal_code": "20097",
  "city": "Hamburg",
  "district": "Hamburg-Hammerbrook",
  "phone_display": "040 88306030",
  "phone_e164": "+49 40 88306030",
  "email": "info@za-werkstatt-hamburg.de",
  "google_rating": "4,9",
  "review_count": "109",
  "google_maps_url": "https://maps.google.com/?cid=460535966647337214",
  "is_https": true
}
```

`is_https` wird **nicht** ins Template substituiert — wird nur in der Custom-Mail als Pitch-Hook verwendet (`personalisierungs_observation`), siehe MAIL_TEMPLATE_KFZ_V1.

---

**Ende.** Mini-Generator (Baustein 4) liest dieses Dokument als Spec.
