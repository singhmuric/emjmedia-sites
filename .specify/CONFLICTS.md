# Spec-Kit Conflicts Log

Constitution §10.3 verlangt, dass Skill-/Spec-/Plan-Konflikte hier protokolliert und im jeweils nächsten Session-Review behandelt werden. Constitution > Spec > Plan; bei Skill-Widerspruch gewinnt die Constitution.

---

## C-01 — `impeccable`-Skill rejected Plan-§4.3-Fonts

**Datum:** 2026-04-21 (Session 1.3)
**Quellen:**
- Plan `.specify/specs/kfz-template-v1/plan.md` §4.3 — wählt Fraunces (a), Inter (b), JetBrains Mono (c). Freigegeben in Session 1.2 (Punkt §15.4).
- Skill `.claude/skills/impeccable/source/skills/impeccable/SKILL.md` `<reflex_fonts_to_reject>` — listet **alle drei** explizit als „training-data defaults" und fordert Reject.

**Status:** Plan gilt für Session 1.3 (freigegebene Entscheidung). Skill als Heuristik für andere Aspekte (OKLCH-Farben, Type-Skala, Spacing-Scale, no-border-left-accent) angewendet.

**Auflösungsvorschlag für Session 1.4-Review:**
1. **Beibehalten** — Plan-Entscheidung gilt; KFZ-Mittelstand profitiert nicht von hipper Font-Auswahl, Lesbarkeit + Lizenz (SIL OFL) sind das primäre Kriterium.
2. **Wechsel** — pro Variant ein weniger generischer Font (z. B. Variant a → „Source Serif 4" oder „Lora" — wobei Lora ebenfalls auf der Reject-Liste steht). Sonnet listet 2–3 Alternativen pro Variant in 1.4 mit Lizenz-Status.

**Empfehlung Sonnet:** Option 1 — Plan-Konsistenz ist wichtiger als Skill-Mode. Mittelstand-User erkennen Inter ohnehin nicht.

---
