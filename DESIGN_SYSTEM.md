# DESIGN_SYSTEM.md
## Anglemyer Portfolio — Project Design System
*Pair with DESIGN_DNA.md for universal principles.*

---

## FONTS

| Family | Role | Weights |
|--------|------|---------|
| Instrument Serif | Hero (pro mode), project titles, headlines | 400, italic |
| Space Mono | Hero (creative mode), labels, descriptions, all utility text | 400, 700 |

- Serif = personality, editorial energy
- Mono = data, terminal energy
- No other families

---

## HIERARCHY TIERS

| Tier | Value | Elements |
|------|-------|----------|
| LOUD | rgba(255,255,255,0.92) | Hero name |
| NORMAL | rgba(255,255,255,0.55) | PwC subtitle, bio, project titles |
| QUIET | rgba(255,255,255,0.38) | Descriptions, social links, email, stack |
| GHOST | rgba(255,255,255,0.22) | "Projects" header, visitor count, color picker label |

---

## TYPE SCALE

| Size | Use |
|------|-----|
| 80px | Hero name only |
| 24px | Project titles, PwC mention |
| 18px | Bio paragraph |
| 14px | Project descriptions, social links, email |
| 11px | Section headers, labels, visitor count |

---

## SPACING

| Value | Use |
|-------|-----|
| 96px | Between major sections (bio→projects, projects→footer) |
| 48px | Between hero and bio, between project items |
| 24px | Between related items (social links, link to email) |
| 16px | Internal padding, subtitle to bio gap |

---

## COLOR

**Backgrounds:**
- Primary: #060e1e (deep navy-tinted black)
- Fallback: #050505 (off-black)

**Accent by mode:**
- Pro (DAY): Steel blue (#4a90d9)
- Creative (NIGHT): Warm amber (#f97316)

**Grain:** SVG feTurbulence, opacity 0.03-0.045, mix-blend-mode overlay

---

## SIGNATURE INTERACTIONS

- Water displacement: cursor ripples entire page surface
- Magnetic text repulsion: hero characters push away from cursor
- Ink entry: visitor color drops, ripples expand on impact
- SeenEffect: first letter glitch 400ms after load
- Supreme identity cycling: images through hero letterforms on first visit
- DAY/NIGHT toggle: full content crossfade

---

## MODES

| Property | Pro (DAY) | Creative (NIGHT) |
|----------|-----------|-------------------|
| Hero font | Instrument Serif 400 italic | Space Mono 700 uppercase |
| Accent | Steel blue | Warm amber |
| Bio font | Instrument Serif | Space Mono |
| Energy | Editorial, trustworthy | Terminal, underground |
