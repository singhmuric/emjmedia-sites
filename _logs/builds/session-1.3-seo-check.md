# Session 1.3 / T-092 — SEO-Checkliste (Pre-Deploy)

**Datum:** 2026-04-21
**Geprüfte Demo:** `sites/onepages/kfz-demo/` (variant c, slug=kfz-demo, archetype fixture)
**Skills konsultiert:** `claude-seo` (vendored, agent-basiert) + `local-seo-skills` (vendored, reporting-fokussiert)

Beide Skills sind primär für **Post-Deploy**-Audits ausgelegt (PSI/CrUX/GSC/GA4 brauchen Live-URL + API-Keys). Der Pre-Deploy-SEO-Check fährt deshalb gegen Spec §10.4 als programmatische Checkliste — Lighthouse-/CrUX-Daten kommen in Phase X (T-110) gegen die Vercel-URL.

## Ergebnis: 26 / 26 ✓

### Spec §10.1 — Content
- ✓ Exactly one `<h1>` per page
- ✓ `<title>` ≤ 60 Zeichen (60)
- ✓ `<meta description>` ≤ 155 Zeichen (137)
- ✓ Title enthält Branche („KFZ-Werkstatt")
- ✓ Title enthält Ort („Bad Bramstedt")
- ✓ Meta-Description enthält Ort
- ✓ `<h1>` enthält Ort

### Spec §10.4 — SEO
- ✓ `<link rel="canonical">` gesetzt
- ✓ OpenGraph: `og:title`, `og:description`, `og:image` vorhanden
- ✓ `twitter:card` gesetzt
- ✓ JSON-LD AutoRepair eingebunden + parsed (T-083 bestätigt)
- ✓ JSON-LD FAQPage eingebunden + parsed
- ✓ Semantic `<main id="main">`
- ✓ Semantic `<header>` und `<footer>`
- ✓ Skip-Link auf `<main>`
- ✓ Demo-Phase: `<meta name="robots" content="noindex,nofollow">` gesetzt
- ✓ `robots.txt` hat `Disallow: /` (Demo-Phase, plan §7.4)
- ✓ `sitemap.xml` valid `<urlset>`-Root
- ✓ `sitemap.xml` listet `/`, `/impressum.html`, `/datenschutz.html`

### NAP-Konsistenz (FR-204, Constitution §3.3)
- ✓ Anzeige-Telefon erscheint ≥ 4× im HTML (Header, Hero, CTA-Band, Öffnungszeiten, Kontakt-Side, Footer = 7 Treffer)
- ✓ E.164-Telefon in `tel:`-Links ≥ 4× (8 Treffer)

## Was Phase X (T-110) noch hinzufügt

- **Lighthouse Mobile**: Performance / Accessibility / Best Practices / SEO ≥ 90 (alle 4 Pillars)
- **CrUX field data**: LCP/INP/CLS gegen Spec §10.3 Schwellen (LCP ≤ 2,5s, INP ≤ 200ms, CLS ≤ 0,1) — braucht Live-URL
- **Google Rich Results Test**: validiert AutoRepair + FAQPage JSON-LD gegen Google's eigene Guidelines (im Browser oder via API)

## Anmerkungen für 1.4-Review

Title-Länge ist bei genau 60 Zeichen — das obere Limit. Längerer Firmenname triggert Ellipse mitten im Wort („Kfz-Meisterbetrieb Bergman… | KFZ-Werkstatt in Bad Bramstedt"). Vorschlag: Title-Patterns weniger restriktiv (Branche kürzen oder weglassen wenn Firmenname schon ≥ 30 Zeichen).
