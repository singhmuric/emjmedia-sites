# WendeBau Design-DNA — Referenz-Spec für Fabrik v2

**Stand: 24.04.2026**
**Quelle:** `uploads/website.html` (WendeBau GmbH, eigenes Vault-Projekt, Emin+MC Singh)
**Zweck:** Abstrahiertes Design-Pattern für Fabrik-v2-Templates. Direkter Input für Session 1.6 Variant B (KFZ), spätere Wiederverwendung für Bau-Template und andere Branchen.

---

## Kern-Prinzip

Die Wirkung entsteht nicht aus einem einzelnen "Wow"-Element, sondern aus **Dichte von Mikro-Details bei zurückhaltendem Grundrauschen**. Die Seite flüstert, aber an vielen Stellen gleichzeitig. Das ist das Gegenteil von Template-Optik: jede Section hat 3–5 dedizierte Details, die sie als "handgebaut" markieren, während die Gesamtkomposition ruhig bleibt.

Für die Fabrik heißt das: **abstrahieren, nicht kopieren**. Die Farben, die Fonts, der Text sind austauschbar — das Detail-Vokabular bleibt.

---

## 1. Farbsystem — abstrahiert

WendeBau nutzt: tiefes Grün (Emerald) als Autoritäts-Ton, warmes Gold als Akzent, Creme als Light-Sektions-Balance. Das ist Branchen-Code für "seriöser Handwerksbetrieb mit Nachhaltigkeits-Anspruch".

**Abstrahierte Regel für die Fabrik:**

| Rolle | WendeBau | KFZ-Variante (v1.2) | Bau-Variante |
|---|---|---|---|
| Authority (dark-BG) | #0A1A0F Emerald | dunkelgrau/anthrazit oder tiefblau | dunkelbraun/charcoal |
| Accent (warm) | #C9A84C Gold | orange/kupfer ODER messing | kupfer/terra |
| Light-Section | #FAF9F6 Creme | beige/stone | sand/creme |
| Deep-Accent | #2D7A52 Jade | öl-grün ODER petrol | rost/tan |

Wichtig: **genau zwei "warme" Werte** (Accent + Deep-Accent), **genau zwei "neutrale" Werte** (Authority + Light), plus reines Schwarz + Weiß. Mehr Farben = wirkt Template-haft.

---

## 2. Typografie-System

**Pairing-Prinzip:** Ein schwerer Display-Font (Black 900) für H1–H3, ein warmer Sans für Body und Labels. Kontrast muss **stark** sein, nicht subtil.

WendeBau:
- **Display:** Archivo 700/900 — geometrisch, schwer, negative letter-spacing (-0.5 bis -2px)
- **Body:** IBM Plex Sans 400/500/600 — warm, professionell, leicht serifen-anmutend

Für Fabrik v2 bereits gesetzt (Fraunces + Inter + JetBrains Mono laut Plan §7). Empfehlung: **Fraunces Black 900 in Hero und Section-Heads ziehen**, nicht nur Fraunces Variable 700. Der Gewichts-Sprung ist der halbe Wow-Effekt.

**Skalen:**
- Hero H1: clamp(28px mobile, 4.5rem desktop), line-height 1.05, letter-spacing -0.5px
- Section H2: 36–40px desktop, 28px mobile, line-height 1.1–1.2
- Card H3: 20px, bold
- Body: 14px, line-height 1.65–1.75
- Eyebrow: 10px, letter-spacing 3px, uppercase, farbig (Accent)
- Fine-print/Labels: 9–11px, letter-spacing 1.5–2px, muted

---

## 3. Spacing & Layout-Rhythmus

- Section-Padding: **72–96px vertikal, 6% horizontal** (responsive %, nicht fixed px)
- Content-Max-Width: **1060–1200px** (nicht breiter, sonst kippt die Dichte)
- Card-Gap: **24px** horizontal in Grids, **16–20px** vertikal innerhalb
- Grid-Breakpoint: 960px → 1-Spalte, sonst 3-Spalte Standard / 2-Spalte für Content-Blöcke
- Hero: min-height 100vh, Content auf 45% Linke Spalte, 55% Whitespace/Widget rechts (Asymmetrie ist Pflicht)

---

## 4. Section-Rhythmus-Pattern

Die Reihenfolge bei WendeBau ist ein Conversion-Funnel und direkt übertragbar (Sections umbenennen für Branche, Reihenfolge beibehalten):

1. **Hero + Floating-Widget + Funnel-Einstieg** (Emotion + Sofort-Conversion-Hook)
2. **Trust-Marquee** (Authority-Signal, scrollend)
3. **"Warum jetzt" 3-Card-Grid** (Urgency/Problem)
4. **Story/Urgency-Section** (Content-Tiefe, Single-Column)
5. **Zahlen/Calculator** (Transparenz + Live-Counter)
6. **Über-uns** (menschlicher Anker, Gründer-Porträt)
7. **Testimonials + Stats** (Social Proof, kombiniert 2-spaltig)
8. **Pakete/Angebot** (Transaktion)
9. **Prozess 6-Step** (Demystification, alternierend Layout)
10. **Leistungen** (Feature-Grid, 6 Tiles)
11. **FAQ/Wissen** (Accordion, 3 Karten)
12. **Kontakt** (Form + Info, 2-spaltig)
13. **Footer**

**Background-Alternanz:** Dark → Dark → Light → Dark → Light → Dark → Dark → Light → Dark → Light → Light → Dark. Wechsel hält die Seite wach, nicht monoton.

---

## 5. Mikro-Detail-Katalog — DER wichtigste Abschnitt

Das ist die Essenz. Wenn Variant B eines der folgenden Elemente vergisst, wirkt sie wieder generisch. Jede Section der Fabrik muss **mindestens 3 aus dieser Liste** verbauen.

### 5.1 Eyebrows (Pflicht vor jeder H2)
```
font-size: 10px
letter-spacing: 3px
text-transform: uppercase
font-weight: 600
color: var(--accent-warm)
margin-bottom: 14–20px
```

### 5.2 Trust-Pills (im Hero, als Mini-Badges über/unter Headline)
```
background: rgba(255,255,255,0.06)
border: 1px solid rgba(accent, 0.2)
border-radius: 4px
padding: 5px 10px
font-size: 10px
letter-spacing: 1.5px
checkmark-icon in accent-color
```
Inhalt: "✓ Meisterbetrieb", "✓ 15+ Jahre", "✓ Hersteller-Freigabe"

### 5.3 Zier-Divider (horizontal + vertikal)
```
height: 1px
background: linear-gradient(90deg, var(--accent) 0%, transparent 100%)
opacity: 0.5
margin: 12px 0
```
Einsatz: unter Card-Values, zwischen Spalten in Kontakt-Sektion.

### 5.4 Gradient-Underline auf Cards (scaleX on hover)
```css
.card::before {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--deep-accent), var(--accent));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.5s cubic-bezier(.25,.8,.25,1);
}
.card:hover::before { transform: scaleX(1); }
```
**Das ist der wichtigste Einzel-Effekt der ganzen Seite.**

### 5.5 Card-Hover (Shadow-Lift + Y-Shift)
```
transition: transform 0.4s cubic-bezier(.25,.8,.25,1), box-shadow 0.4s ease;
.card:hover {
  transform: translateY(-10px);  /* nicht -2px oder -4px — muss spürbar sein */
  box-shadow: 0 24px 64px rgba(primary-dark, 0.16);
}
```
**Das war exakt der Bug in Variant A** — Hover zu schwach. Hier ist das Ziel-Pattern.

### 5.6 Icon-Boxes (Square mit abgerundeten Ecken, Background-Tint)
```
width: 56–72px
height: 56–72px
background: rgba(deep-accent, 0.06–0.08)
border-radius: 14px
padding: 12–14px
```
Icon darin: SVG mit stroke in accent-color, stroke-width 1.5.

### 5.7 Floating-Hero-Widget (Asymmetrie-Anker rechts oben im Hero)
```
position: absolute
background: rgba(255,255,255,0.92)
backdrop-filter: blur(16px)
border-radius: 10px
padding: 24px 28px
box-shadow: 0 20px 60px rgba(0,0,0,0.25)
animation: float 3s ease-in-out infinite
```
Inhalt: eine große Zahl (Kunden, Jahre, Garantie-Jahre), Label darüber, Gradient-Divider, Subline.

### 5.8 Ghost-Numbers (hinter Step-Nummern als große Deko-Ziffer)
Step-Nummer "01" in kleiner Variante (20px gold) + halbtransparente "01" groß (120px+, opacity 0.06) als BG.

### 5.9 Quote-Character in Testimonials
Großes „ als 52px Archivo 900 in accent-color mit opacity 0.6. Nicht Bestandteil des Textes, sondern separates Deko-Element.

### 5.10 Scroll-Indicator im Hero
Pfeil-SVG + "SCROLL" Label, bounce-Animation.

### 5.11 Active-Dot-Pagination (Swiper)
Aktiver Dot wird zur **Länglichen Pille** (width: 7px → 20px). Nicht nur Farbwechsel.

### 5.12 Stats mit animierter Underscore-Bar
Jede Zahl hat eine 18px breite, 2px hohe accent-Line darunter, die via scaleX: 0 → 1 beim Scroll animiert.

### 5.13 Recommended-Badge auf empfohlener Paket-Card
Kleine Pille oben auf der mittleren Card: dunkelfarbig, weiß, "EMPFOHLEN" oder "BELIEBT". Bricht die Symmetrie, führt das Auge.

### 5.14 Nav-Scroll-Glass-Effect
```css
nav.scrolled {
  background: rgba(primary-dark, 0.96);
  backdrop-filter: blur(14px);
  border-color: rgba(deep-accent, 0.18);
}
```
Toggle via JS-Scroll-Listener bei scrollY > 10.

---

## 6. Animations-Choreografie

**Stack:** GSAP 3.12+ (CDN oder bundled) + ScrollTrigger. Kein Framer-Motion, kein Lottie, kein Three.js für Standard-Seiten.

**Die 6 Animations-Typen die wiederkehren:**

1. **Hero-Char-Stagger** (Headline Character-by-Character)
   - `.char { opacity: 0; transform: translateY(115%) rotate(3.5deg); }`
   - GSAP: stagger 0.015s, duration 0.9s, ease: power3.out
   - Nur auf H1 im Hero, nicht auf H2 der Sections

2. **Fade-Up-Stagger** (Cards in Grids)
   - Initial: opacity 0, y: 20–40px
   - Trigger: ScrollTrigger start "top 82%", once: true
   - Stagger zwischen Cards: 0.12–0.15s

3. **Scale-In mit Back-Ease** (Icon-Boxes, Avatar)
   - Initial: scale 0.7–0.96
   - Final: scale 1.0, ease: back.out(1.4)

4. **Stroke-Dash-Draw** (SVG-Connector-Lines zwischen Steps)
   - `strokeDasharray = pathLength`
   - `strokeDashoffset: len → 0`
   - scrub: 0.8 (scroll-linked, smooth)

5. **Counter-Animation** (große Zahlen wie 380.000)
   - GSAP tween von 0 → target
   - Duration 2s, ease: power1.out
   - Trigger: in Viewport

6. **Marquee-Infinite** (Trust-Logos, Text-Badges)
   - CSS `@keyframes marquee { to { transform: translateX(-50%); } }`
   - Content doppelt im DOM für seamless loop
   - Hover → `animation-play-state: paused`

**Timing-Faustregeln:**
- Hover-Transitions: 0.22s (schnell, responsive)
- Scroll-Reveal: 0.8–0.9s (ruhig, lesbar)
- Stagger zwischen Elementen: 0.12–0.15s
- Hero-Timeline total: ~2.5s von Page-Load bis alle Elemente sichtbar

---

## 7. Copy- und Content-Muster

### Headline-Architektur
Zwei-Zeilen, eine emotionale Kernaussage + ein nüchterner Zusatz, **ein Wort farblich hervorgehoben**:
- WendeBau: "BIS 2040 PFLICHT. JETZT **GEFÖRDERT**."
- KFZ-Analogon: "SEIT 1987 IN HAMBURG. IMMER **ZUVERLÄSSIG**." oder "IHR AUTO. UNSER **HANDWERK**."

### Section-Intro
Unter H2: ein Satz, max 120 Zeichen, muted color (rgba 0.55 oder #666).

### CTA-Wortwahl
- Primary: Action + Benefit + Arrow → "Kostenvoranschlag anfordern →"
- Secondary: neutral, ohne Arrow → "Termine ansehen"
- Telefon: klar markiert mit Icon → "☎ Direkt anrufen"

### Eyebrow-Formulierung
Alles uppercase, 1–3 Wörter: "WARUM JETZT", "UNSERE ARBEIT", "SO FUNKTIONIERT'S", "KUNDEN ÜBER UNS".

### Testimonial-Format
Quote (1–2 Sätze, nicht mehr) → Sterne → Name + Stadt (kein Firmenname, keine Position). Kein Foto im v1 (datenschutz-sicher).

### Stats-Format
Zahl (Archivo 900, 44px) + optionaler Suffix ("+" / "%") + Label (13px, muted). Underscore-Bar darunter.

### FAQ/Accordion-Format
Category-Badge (klein, farbig) → Question als H4 → 1-Satz Preview → "Mehr erfahren ↓"-Link → Expanded Content mit H4-Subheads.

---

## 8. Was NICHT direkt übernehmen — Branchen-Filter Bau

Diese Elemente sind WendeBau-spezifisch und haben bei KFZ kein Äquivalent:

1. **Förder-Calculator** (KfW/BAFA 70%-Hebel) — bei KFZ keine staatliche Förderung. Ersetzen durch **Kostentransparenz-Calculator** oder **Festpreis-Vergleich**.
2. **Energieklassen-Story** (A–G Skala) — ersetzen durch **TÜV-Historie-Visualisierung** oder **Wartungsplan-Timeline**.
3. **"BIS 2040 PFLICHT" Urgency** — keine gesetzliche Sanierungspflicht bei KFZ. Ersetzen durch weichere Urgency: **TÜV-Frist**, **Saison-Reifenwechsel**, **Garantie-Ablauf**.
4. **Sanierungsfahrplan-Hinweis (iSFP)** — streichen ersatzlos.
5. **Behörden-Marquee** (KfW, BAFA, dena, BMWK) — ersetzen durch **Marken-Marquee** (VW, Audi, BMW, Mercedes, ...) ODER **Zertifikations-Marquee** (Meisterbetrieb, Bosch Service, ZDK, Innung).

---

## 9. Anwendung auf KFZ-Template Variant B (Session 1.6)

Konkrete Deltas gegenüber Variant A, die direkt in den Handover müssen:

**Hover-Delta** (Constitution §12-Logik):
- Card-Hover **muss** translateY(-10px) + box-shadow 0 24px 64px + scaleX-Underline kombinieren. Nur Border-Darken ist ein Anti-Pattern.
- Implementation in einem Block, PE-fail-safe: transform-Default ist `translateY(0)`, Hover überschreibt.

**Mikro-Detail-Pflicht pro Section** (§12-Check):
- Hero: Trust-Pills + Floating-Widget + Scroll-Indicator + Char-Stagger
- Authority: Marquee (Marken oder Zertifikate) + Eyebrow + Headline mit Akzent-Wort
- Leistungen: Icon-Box + Gradient-Underline-Hover + Eyebrow
- Prozess: Ghost-Numbers + SVG-Connector-Draw
- Testimonials: Quote-Character + Active-Pill-Pagination
- Stats: Counter-Animation + Underscore-Bar
- FAQ: Category-Badges + Max-Height-Accordion
- Kontakt: Form-Styling mit rgba-BG, Submit-Button in Accent

**Bild-Slot-Policy** (Fix für 6. Card in v1.1):
- **Alle** 6 Leistungs-Cards müssen Bild-Slot ODER Icon-Box haben, nie leer.
- Fallback-Kette: echtes Foto → KI-Bild → Icon-Box mit Accent-Tint.
- Keine "white-Card-only"-Leistungen im Grid.

**Animation-Amplitude** (Fix für "zu zurückhaltend"):
- Initial-Y-Offset bei Scroll-Reveal: 20–40px, nicht 10px.
- Stagger zwischen Cards: 0.12s, nicht 0.05s.
- Ease: power3.out oder cubic-bezier(.25,.8,.25,1), nicht linear.

---

## 10. KFZ-Content-Patterns — eigene Konzeption

**Grundproblem, das Variant A hatte und jetzt gelöst werden muss:** Das Leistungs-Grid (Screenshot 24.04.) zeigt 3×2 identisch große weiße Rechtecke mit Foto-oben-Text-unten-Struktur. Gleicher Padding, gleiche Höhe, gleiche Hierarchie. Das liest sich wie Stock-Template. Die Content-Inhalte (Inspektion, TÜV, Bremsen, Motor, Reifen, Klima) sind richtig — das Layout-Gerüst ist das Problem.

Die Lösung ist nicht ein anderes Grid. Die Lösung ist: **jede Section bekommt einen eigenen Layout-Typ, keine zwei Sections sehen formal gleich aus.** Das ist die Anti-Template-DNA.

### 10.1 Hero — Über-Typo + Foto + Floating-Trust

Weg vom klassischen "Bild rechts, Text links"-Split. Stattdessen:

- **Fullscreen-Foto oder 8s-Video-Loop** (Werkstatt in Aktion, leicht gedimmt via Gradient-Overlay bottom-left dark)
- **Über-große Deko-Typo** am unteren Drittel: z.B. Gründungsjahr "1987" in 180–240px Fraunces Black, opacity 0.08, halb abgeschnitten durch Section-Rand
- **Headline-Block** darüber in normaler Größe, 2-zeilig mit ein-Wort-Akzent
- **Floating-Trust-Card** rechts oben (NICHT rechts mitte wie bei WendeBau): klein, zeigt 3 Micro-Stats (Google ★ 4,8 / seit 1987 / 3.200 Fahrzeuge/Jahr), mit Gradient-Divider-Lines zwischen Stats
- **CTA-Paar** unten: Primary "Kostenvoranschlag →" + Phone-Button "☎ 040 xxxx"
- **Scroll-Indicator** zentriert unten

Warum lebendig: Die Deko-Typo bricht das Raster. Das Floating-Widget sitzt nicht zentriert. Video-BG hat ständig Mikro-Motion.

### 10.2 Sticky-Trust-Ribbon — direkt unter der Nav

Das ist eine **neue** Element-Klasse, die WendeBau nicht hat. 44px hoher Streifen, volle Breite, Farbe leicht getönt (z.B. #0A1A0F 95%), zeigt inline:

`★ 4,8 (187 Google-Bewertungen)  ·  Meisterbetrieb seit 1987  ·  Nächster freier Termin: Mo 14:00  ·  ☎ 040 xxxx`

Der "Nächster freier Termin"-Teil ist das **Killer-Feature**: auch als statischer Fake-Live-Indikator (in Template-Demos hardcoded) erzeugt er sofort Vertrauen und ist ein Dopamin-Detail, das kein Template-Bauer einbaut. Auf Mobile wird die Zeile horizontal scrollbar oder klappt zu "★ 4,8 · nächster Termin: Mo ·  ☎".

### 10.3 Authority — Zwei-Zeilen-Marquee + Side-Text

Gleiches Prinzip wie WendeBau, aber mit **zwei funktional verschiedenen Zeilen**:

- **Obere Zeile:** Hersteller-Logos (VW, Audi, Seat, Skoda, BMW, Mini, Mercedes, Ford, Opel, Hyundai, Kia, Toyota) — weiße Pills, scrollen nach links
- **Untere Zeile:** Zertifikat-Textbadges (✓ Meisterbetrieb · ✓ Bosch Car Service · ✓ ZDK-Mitglied · ✓ AU-berechtigt · ✓ Hersteller-freigegeben · ✓ 35+ Jahre) — transparente Badges, scrollen nach **rechts** (Gegenrichtung erzeugt optische Spannung)
- Links davon 38%-Spalte mit Eyebrow "UNSERE KOMPETENZ" + Headline "Alle Fabrikate. **Meister-Qualität.**" + kurze Unterzeile

### 10.4 Leistungen — Bento-Grid statt 3×2-Raster (Kern-Fix fürs Screenshot-Problem)

**Das ist die wichtigste Layout-Korrektur der ganzen Seite.** Weg vom gleichförmigen Grid, hin zu einer **12-Column-Bento-Komposition**:

```
┌──────────────────────────────┬──────────────┐
│                              │              │
│  CARD 1 — INSPEKTION         │  CARD 2      │
│  (Feature, 7 Col × 2 Rows)   │  TÜV & AU    │
│  Großes Foto als fullbleed-  │  (5 Col ×    │
│  BG, Text-Overlay unten      │  1 Row)      │
│  links mit Accent-Eyebrow    │              │
│                              ├──────────────┤
│                              │  CARD 3      │
│                              │  BREMSEN     │
│                              │  (5 Col ×    │
│                              │  1 Row)      │
├──────────┬──────────┬────────┴──────────────┤
│ CARD 4   │ CARD 5   │  CARD 6 KLIMASERVICE  │
│ MOTOR    │ REIFEN   │  (4 Col × 1 Row)      │
│ (4 Col)  │ (4 Col)  │  mit Icon+Pattern-BG  │
└──────────┴──────────┴───────────────────────┘
```

Pro Card **unterschiedliches Treatment**:

- **Card 1 (Feature):** Fullbleed-Foto, kein Padding, Text-Overlay mit Gradient-Schatten bottom, Eyebrow "MEISTEN BUCHUNGEN" + Titel in weiß auf Foto. Hover: Foto zoomt sanft (scale 1.04 über 0.6s).
- **Card 2 + 3 (Standard hoch):** Klassisch Foto oben + Text unten, aber **Foto nur 40% der Card-Höhe**, Text dominanter. Hover: Lift + Gradient-Underline (wie §5.4).
- **Card 4 + 5 (Standard breit):** Text-Dominant mit kleinem Icon links im Header, kein Foto. Stattdessen: **subtiles Pattern im BG** (dünne diagonale Linien, accent-getönt, opacity 0.04). Hover: Pattern wird dichter.
- **Card 6 (Klimaservice, das Problem-Card):** Icon-Box groß und farbig (nicht nur ein Schneeflocke-Icon auf weißem Rechteck), BG in leichtem Accent-Tint (z.B. rgba 5%), Icon selbst 48px in Deep-Accent. Fühlt sich **anders** an als die Foto-Cards und das ist OK, weil das Layout Asymmetrie vorsieht.

Ergebnis: Kein zwei Cards sehen gleich aus. Das Auge bekommt Hierarchie (Card 1 ist Haupt, 2+3 sind sekundär, 4-6 sind Standard). Die Seite atmet.

**Pflicht in Constitution §12 für Variant B:** "Leistungs-Section verwendet Bento-Grid mit mindestens 3 verschiedenen Card-Typen. Uniform Grids aus identischen Cards sind verboten."

### 10.5 Prozess — Sticky-Scroll-Timeline

Weg vom 6-Steps-nebeneinander-Layout. Stattdessen **vertikale Sticky-Scroll-Sektion**:

- **Linke Spalte (sticky, 30% Breite):** Eyebrow "SO LÄUFT'S AB" + H2 "Vom Anruf bis zur Übergabe" + Progress-Indicator mit 6 Dots (aktueller Dot ausgefüllt, Verbindungslinie dazwischen animiert mit scrollen)
- **Rechte Spalte (scrollt, 65%):** 6 Step-Blöcke untereinander, jeder Block min-height 80vh damit er Sticky-Zeit bekommt
  - Pro Block: **Ghost-Nummer** (01, 02, ... in 400px Fraunces Black, opacity 0.04, hinter dem Content)
  - Davor: kleiner Label "Schritt 02 von 06"
  - H3 des Steps, 2-3 Sätze, evtl. Mini-Foto (Drehmomentschlüssel, Diagnosegerät)
- **SVG-Connector** zwischen den Steps: kurvige Linie, die sich beim Scrollen zeichnet (scrub: 0.8), stroke in Accent-Color

Bei Mobile wird aus Sticky eine normale vertikale Liste mit großen Nummern-Badges.

### 10.6 Feature-Testimonial + Quote-Stack (asymmetrisch)

Drei identische Testimonial-Cards sind das Standard-Template-Signal. Stattdessen:

- **Links (60%):** eine **Feature-Testimonial** — sehr groß, mit riesigem Anführungszeichen „ als Deko-Typo (140px Fraunces Black, Accent, opacity 0.3), darunter Quote (20px, bis zu 4 Zeilen), dann Name + Fahrzeug-Modell + Jahr ("Sabine K., VW Golf VII, Kundin seit 2019"). Kein Foto (Datenschutz), aber Stern-Rating in gold darunter.
- **Rechts (35%):** Stack aus **3 kleineren Quotes** (je 2 Zeilen Quote + Name, ohne Deko) mit dünnen Trennlinien. Darunter direkt die **4-Zahlen-Stats-Grid** (z.B. 3.200 Fahrzeuge/Jahr · 4,8 ★ · 35 Jahre · 98% Empfehlung).

Drunter horizontale **Review-Marquee** mit 8–10 weiteren Einzeilern ("Schnell und korrekt. — Thomas L." etc.), scrollend, Hover-pausiert.

### 10.7 Marken-Kompetenz-Sektion (eigenständig, nicht nur Marquee)

Unter dem Prozess ein eigenständiger Block:

- Eyebrow "MARKEN-EXPERTISE" + H2
- **Horizontal scrollbares Tile-Band** (nicht auto-scrollend, sondern user-driven via Drag/Scroll-Wheel): je Tile eine Marke, 280px breit, 200px hoch
  - Oben Marken-Logo, darunter: "Über 1.400 VW repariert" + "Dedizierte VAG-Diagnosetools" als 2 kurze Fakten
  - Hover: Tile hebt sich + Akzent-Border + zweite Info wird sichtbar
- Unter dem Band Text "**Ihre Marke nicht dabei?** Wir arbeiten an allen gängigen Fabrikaten — fragen Sie einfach."

### 10.8 Service-Ribbon — KFZ-spezifische Mini-Features

Zwischen Prozess und Pakete ein **120px hoher Service-Streifen** in Accent-Tint (leicht warm), 3-spaltig mit Icon + Mini-Text:

`🚚 Hol- und Bringservice (Hamburg 20 km)  |  🚗 Ersatzwagen ab 29€/Tag  |  📞 Pannenhilfe werktags bis 18:00`

Dünner Streifen, bewusst nicht als große Cards — das sind Service-Versprechen die man **beiläufig wahrnimmt**, nicht als Hauptangebot. Bei zu großer Darstellung wirken sie wie Standardforderungen. Als Mini-Band bekommen sie die richtige Gewichtung.

### 10.9 Pakete — Drei-Plus-Eins-Layout

Statt drei gleich großer Paket-Cards:

- **Oben drei Standard-Pakete** (Basis / Komfort / Premium) als 3-Col Cards — aber die mittlere ist **10% größer in allen Dimensionen** und hat das "EMPFOHLEN"-Badge + Accent-Border. Die beiden seitlichen sind leicht desaturiert.
- **Darunter eine breite Wide-Card** "Wartungsvertrag ab 19€/Monat" — voll-breit, mit anderem Treatment (dunkel statt weiß, Icon links, 2-Col-Text rechts). Das bricht die 3-Col-Symmetrie und leitet zum Upsell.

### 10.10 FAQ — Filter-Liste statt Accordion-Cards

Weg von 3 großen FAQ-Cards. Stattdessen:

- **Linke Spalte (sticky, 30%):** H2 "Häufige Fragen" + **Kategorie-Filter als Badge-Reihe** (Alle · Wartung · TÜV · Elektro · Klima · Abrechnung). Badge-Click filtert die Liste rechts.
- **Rechte Spalte (65%):** vertikale Fragen-Liste, jede Frage eine Zeile mit `+` rechts zum Aufklappen. Kein Card-Wrapper, nur dünne Trennlinien. Beim Öffnen rutscht der Antwort-Text auf (max-height-transition), das `+` wird zu `×`.
- Bei Filter-Click: Fragen der falschen Kategorie faden weg (opacity 0.1) + schrumpfen (max-height), passende bleiben voll.

Warum besser: wirkt wie ein Dokument, nicht wie Cards. Zeigt mehr Inhalte in weniger Platz. Filter macht es interaktiv.

### 10.11 Kontakt — Form + Live-Info + Map-Teaser

Zweispaltig aber reicher als bei WendeBau:

- **Linke Spalte (50%):** Form (klassisch, aber Feld-Fokus-State in Accent-Border-Glow)
- **Rechte Spalte (45%):**
  - **Oben: Live-Öffnungszeiten-Widget** — "Jetzt geöffnet" mit pulsierendem grünem Dot (oder "Geschlossen, öffnet Mo 08:00" mit rotem Dot). Darunter die ganze Woche als Mini-Liste, heute fett.
  - **Mitte: Adresse + Telefon + WhatsApp** als große klickbare Buttons (nicht nur Text)
  - **Unten: statische Map-Preview** (als PNG-Asset, nicht Google Maps Iframe — Performance) mit dem Werkstatt-Marker, clickable zu Google Maps
  - **Ganz unten: Google-Rating-Footer** mit echtem Stars-Count

### 10.12 Notfall/Mobile-Sticky-CTA

Eine Sache die bei KFZ oft fehlt: ein **nie verschwindender Telefon-Button auf Mobile** (Bottom-Right Sticky, rund, 56px, Accent-Color, Telefon-Icon weiß). Desktop nicht nötig. Auf Mobile zählt der Anruf — wenn das Auto gerade nicht anspringt, ist das der Conversion.

### 10.13 Footer — Big-Type-Signature

Statt 4-Col-Link-Grid:

- Oben: Firmenname in 140px Fraunces Black, voll-breit, als Deko-Statement. Evtl. mit leichtem Hover-Gradient-Fill-Effect.
- Darunter schmale 4-Col-Reihe mit: Kontakt / Leistungen / Rechtliches / Social
- Unter-Footer: Copyright + Impressum-Link + sehr klein "Gemacht mit ♥ von EMJmedia" (unser Signature-Link, nur auf Demo-Seiten sichtbar)

---

## 11. Meta-Layout-Prinzipien gegen "fette Vierecke"

Das ist die zentrale Constitution-Erweiterung für §12. Jede Seite die die Fabrik baut, muss diese Checkliste erfüllen.

### Regel 1: Asymmetrie ist Pflicht
Keine Section darf 2 oder mehr strukturell identische Elemente nebeneinander zeigen. Wenn 3 Cards, dann mindestens eine anders groß, anders getreatmentet oder anders positioniert.

### Regel 2: Mindestens 3 verschiedene Card-Formate auf der Seite
Erlaubte Formate: (a) Foto-fullbleed-Card, (b) Foto-oben-Text-unten-Card, (c) Icon-oben-Text-unten-Card, (d) Text-only-Card mit Pattern-BG, (e) Icon-links-Text-rechts-Card, (f) Large-Number-Card. Auf einer Seite müssen mindestens 3 davon vorkommen.

### Regel 3: Elemente dürfen Section-Grenzen überschreiten
In mindestens 2 Sektionen pro Seite muss ein visuelles Element aus seinem Container herausragen — Foto ragt in nächste Section, Deko-Typo wird angeschnitten, Badge sitzt halb auf der Section-Border.

### Regel 4: Sticky-Elemente an 2–3 Stellen
- Nav mit Scroll-Glass (Pflicht)
- Prozess-Progress (empfohlen)
- Kontakt-CTA oder Phone-Button auf Mobile (Pflicht)

### Regel 5: Mindestens eine Scroll-Driven-Section
Eine Sektion pro Seite muss vom Scroll gesteuert werden (Sticky-Scroll-Timeline, Horizontal-Scroll-Band, Reveal-Choreografie mit Stagger). Das ist der Lebendigkeits-Anker.

### Regel 6: Mindestens eine horizontale Scroll-Zone
Entweder Marken-Marquee, Testimonial-Band oder Marken-Tile-Scroll. Bricht den vertikalen Fluss der Seite auf.

### Regel 7: Off-Grid-Typografie verwenden
Mindestens 2-mal pro Seite eine sehr große Deko-Typo (Ghost-Nummer, Jahreszahl, einzelnes Wort in 180px+), halbtransparent, bewusst aus dem Grid-Fluss ausbrechend.

### Regel 8: Bild-Rahmung variiert
Nicht alle Bilder in Cards mit gleichem Border-Radius. Mix aus: fullbleed (kein Radius), 20px-Radius-Card, angeschnitten durch Section-Border, mit Frame (dünner Border + Padding), parallax-skaliert.

### Regel 9: Tinted-Background als dritter BG-Typ
Nicht nur Dark/Light im Wechsel. Mindestens eine Section mit leichtem Accent-Tint-BG (z.B. rgba(accent, 0.04)) als **weicher Highlight**, meist für Service-Ribbon oder CTA-Section.

### Regel 10: Hover-Variation
Nicht jede Card reagiert gleich. Feature-Card: Image-Zoom. Standard-Card: Lift + Shadow + Underline. Icon-Card: Icon-Scale + BG-Tint. Mindestens 3 verschiedene Hover-Reaktionen pro Seite.

### Regel 11: Kein Element ohne mindestens einen Mikro-Detail
Jeder H2-Block braucht einen Eyebrow. Jede Card braucht entweder Hover-Mechanik ODER Border-Accent ODER Mikro-Icon. Jede Zahl braucht Underscore-Bar oder Ghost-BG. Wenn ein Element "nackt" ist, wirkt es Template.

### Regel 12: Spacing-Rhythmus variiert
Section-Padding-Top darf nicht immer 80px sein. Mix aus 64/80/96/120px je nach Section-Gewicht. Feature-Sections bekommen 120px, Zwischen-Sections wie Service-Ribbon nur 40px.

---

## 12. Anwendung — Variant-B-Handover-Snippet

Der folgende Block ist **direkt** in `SESSION_1.6_HANDOVER.md` als Pflicht-Input zu verwenden:

> **Layout-Regime Variant B (aus WENDEBAU_DESIGN_DNA.md §10–11):**
>
> - Section-Sequenz: Nav-Glass → Sticky-Trust-Ribbon → Hero(Über-Typo+Video+Float-Card) → Authority(2-Zeilen-Marquee gegenläufig) → **Leistungen im Bento-Grid §10.4** → Prozess(Sticky-Scroll-Timeline §10.5) → Feature-Testimonial+Quote-Stack §10.6 → Marken-Tile-Scroll §10.7 → **Service-Ribbon** §10.8 → Pakete(3+1) → FAQ(Filter-Liste §10.10) → Kontakt(Live-Öffnung+Map §10.11) → Footer(Big-Type §10.13) + Mobile-Sticky-Phone §10.12
> - Meta-Regeln §11.1–12 sind Acceptance-Criteria in Constitution §12 zu spiegeln
> - **Anti-Pattern (Variant A):** 3×2-Uniform-Grid in Leistungen → explizit verboten
> - **Anti-Pattern (Variant A):** Card-Hover ohne Y-Shift+Shadow+Underline → explizit verboten
> - **Anti-Pattern (Variant A):** "Nackte" Cards ohne Mikro-Detail → explizit verboten

---

## Änderungshistorie
- **24.04.2026 (Abend):** §10 ersetzt durch eigenständig konzipierte KFZ-Content-Patterns (10.1–10.13), §11 mit 12 Meta-Layout-Prinzipien gegen "fette Vierecke" hinzugefügt, §12 als Handover-Snippet für Session 1.6. Auslöser: Emin hat Variant-A-Screenshot des Leistungs-Grids geschickt (6 identische weiße Rechtecke) und festgestellt dass gute KFZ-Referenzen nicht existieren → Aufbau aus Prinzipien heraus, nicht aus Referenz-Kuration.
- **24.04.2026:** Initial-Version nach Emin-Upload von website.html. Extrahiert aus WendeBau-HTML (~2000 Zeilen), abstrahiert als Fabrik-Input für Variant B + künftige Branchen-Templates.
