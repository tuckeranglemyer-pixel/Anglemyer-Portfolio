# DESIGN_DNA.md
## Tucker Anglemyer — Personal Design Constitution
*Last updated: April 2, 2026*

> This file is WHO I AM as a designer. It never changes between projects.
> Project-specific values (fonts, colors, sizes) go in each project's DESIGN_SYSTEM.md.
> Every repo's CLAUDE.md and .cursorrules should reference both files.

---

## CORE IDENTITY

I'm not one thing. I'm a D1 athlete, an accounting/finance double major, a startup founder, a PwC intern, a house music nerd, and a builder. My design should reflect that range — serious enough for investors, raw enough for the underground.

**Design philosophy:** Sparse content, rich interaction. The site should feel alive — like it's breathing, watching, reacting. Nothing should be static. Nothing should be decorative without being functional.

**The test:** Would a senior designer at Linear pause on this? Would a DJ in Berlin think this is hard? Would a recruiter at PwC take me seriously? All three need to say yes.

---

## HIERARCHY PRINCIPLES

Every project uses exactly 4 tiers of visual importance. The specific opacity/color values change per project, but the structure never does.

| Tier | Role | Typical treatment |
|------|------|-------------------|
| LOUD | The one thing you see first | Largest size, highest contrast |
| NORMAL | Supporting info you read second | Medium contrast, comfortable reading size |
| QUIET | Details you find when you look | Lower contrast, smaller size |
| GHOST | Labels, metadata, decoration | Near-invisible, smallest size |

**Rules:**
- Every element must belong to exactly one tier
- If you can't decide between two tiers, it belongs in the lower one
- Size is not the only hierarchy tool — use weight, color, and spacing too

---

## TYPE PRINCIPLES

- Hand-craft a type scale per project — 5 sizes max, no modular math
- Negative tracking on large headers
- Positive tracking on all-caps mono/small text (0.12em+)
- Never center-align body text
- Line height: tighter on large text (~1.05), looser on body (~1.72)
- Baseline-align mixed font sizes, don't center-align
- Line length: 45-75 characters for readability
- Not every link needs a color — subtle treatments for ancillary links
- Avoid em units for font sizes — use px or rem for consistency
- Choose fonts with 5+ weights for versatility
- Popular fonts are generally good fonts — trust what's battle-tested

---

## SPACING PRINCIPLES

- Define exactly 4 spacing values per project before designing
- Start with too much white space, remove until it feels right
- Dense UIs have their place — but make density intentional, not default
- Don't be a slave to grid systems — give components the space they need
- Spacing between groups > spacing within groups
- Size elements independently — don't scale everything proportionally
- On mobile, reduce spacing but don't just divide by 2 — fine-tune independently

---

## COLOR SYSTEM (how to build a palette)

Every new project gets a full palette BEFORE any design work.

**Use HSL over hex.** Hue, saturation, lightness maps to how I actually think about color. Never use CSS `lighten()` or `darken()`.

**Three categories, always:**

1. **Greys (8-10 shades):** Start with darkest (body text) and lightest (off-white background). Fill between. Never pure black.

2. **Primary colors (1-2, 5-10 shades each):** Pick a base that works as a button background. Find darkest (for text on colored backgrounds) and lightest (tinted alert backgrounds). Fill using 100-900 scale.

3. **Accent colors (as needed, 5-10 shades each):** Red/destructive, yellow/warning, green/positive. Each needs multiple shades even if used sparingly.

**The process:**
1. Pick base (500) — should work as a button background
2. Pick darkest (900) and lightest (100) using real use-case context
3. Pick 700 and 300 — midpoints
4. Fill 800, 600, 400, 200
5. Trust eyes over math. Tweak per shade.
6. Lock the palette. No new shades on the fly.

**Nine shades per color is the sweet spot.**

**General rules:**
- Never pure #000 for backgrounds — off-black or tinted darks
- Accents used sparingly — CTAs, hover states, one highlight
- Desaturate accents at small sizes (saturation below 80%)
- Tint greys consistently warm or cool — never mix
- Don't rely on color alone — pair with icons, weight, or contrast
- Greys can have subtle hue tinting for warmth/coolness
- Flip contrast for accessibility: dark text on light colored backgrounds works better than light text on dark colored backgrounds

---

## LABELS & DATA DISPLAY

**Labels are a last resort.**

1. **Format speaks for itself?** Email, phone, price — no label needed.
2. **Context makes it obvious?** Department under a name — no label needed.
3. **Combine label and value?** "12 left in stock" not "In stock: 12".
4. **Must have a label?** De-emphasize it — GHOST tier. Data is the star.
5. **Exception — scannable spec pages:** Labels can be slightly bolder when users scan for them.

---

## MOTION & INTERACTION PHILOSOPHY

**Physical, not decorative.** Spring physics over linear easing. Cause-and-effect the user can feel.

**Preferred interactions:**
- Water/ripple displacement on cursor
- Magnetic repulsion/attraction to cursor proximity
- Staggered reveals — sequential, not simultaneous
- Tactile feedback — hover lifts, active presses, spring-back

**Micro-interaction defaults:**
- Hover: scale + fill inversion
- Links: underline reveals left to right
- Buttons: translateY(-1px) hover, scale(0.98) active
- Transitions: 0.3s ease hover, 0.6s ease mode changes

**Never:**
- Bounce animations
- Slide-in-from-right on scroll
- Parallax for parallax's sake
- Loading spinners (use skeletons or staggered reveals)

---

## REFERENCES & INSPIRATIONS

### Sites

**ANTLII.WORK** — Typography IS the design. Letters collide, overlap, break the grid.

**bau.artspace** — Negative leading, type-as-architecture. Outlined letterforms. Controlled collision.

**Hyper Dreams (NaughtyDuk)** — Cursor-distorted photos, bold white on black. Club flyer alive. *This is the energy.*

**poch.studio** — Cursor movement has weight. Hover states surprise you.

**fradesign.it** — Tactile hover states. You can feel the texture.

**KODE.IMMERSIVE** — Type fills 70%+ of viewport. Nothing competes.

**Locomotive** — Scroll-driven motion. Smooth, intentional, never gimmicky.

**Wild Memory Radio (WeTransfer)** — Personal artifacts as beautiful data.

### Tools

**Pretext** — Text physics without DOM reflow. 500x faster layout.

**ShaderGradient** — Living gradients. 3D simplex noise, not flat CSS.

**Unicorn Studio** — No-code WebGL shader design. 29kb production output.

**Aceternity UI** — Animated component patterns to skin with my aesthetic.

**taste-skill** — 7 agent skills for design taste. Tunable variance/motion/density dials.

**Vercel web-design-guidelines** — 100+ rules. Auto-audits code.

### Philosophy

**DONDA** — Sparse content, rich experience. Tension between nothing and everything.

**Supreme** — Same text, different worlds inside the letterforms.

**Refactoring UI** — Hierarchy first. Grayscale first. Systems before choices. Labels last.

---

## INSPIRATION LOG

*Every time I see something that stops me: WHAT I saw, WHY it hit, WHAT principle it demonstrates.*

- *(April 2, 2026)* — First entry. Start adding here.

---

## ANTI-PATTERNS

- Rounded corners on everything
- Blue buttons on white backgrounds
- shadcn defaults without customization
- Centered text columns with even spacing
- Generic hero with stock photo + overlaid text
- Hamburger menus on desktop
- "Get Started" as a CTA
- Gradient backgrounds that don't move
- Loading spinners
- Cookie banners that dominate viewport
- Naive "label: value" data display

---

## QUALITY CHECKLIST

- [ ] Every element in one of 4 hierarchy tiers?
- [ ] Only 5 font sizes?
- [ ] Only 4 spacing values?
- [ ] Color palette built with 9-shade process?
- [ ] Page feels alive without cursor?
- [ ] Cursor interaction feels physical?
- [ ] Would I screenshot this?
- [ ] Works on mobile?
- [ ] WCAG AA contrast on functional text?
- [ ] One "how did they do that?" moment?
- [ ] Labels eliminated or de-emphasized?

---

## HOW TO USE

**New project:**
1. Copy DESIGN_DNA.md to repo root
2. Create DESIGN_SYSTEM.md with project-specific fonts, colors, sizes, spacing
3. CLAUDE.md: `Follow DESIGN_DNA.md for principles and DESIGN_SYSTEM.md for project values`
4. .cursorrules: same

**New inspiration:**
1. Open INSPIRATION LOG
2. Add 2-3 lines: what, why, what principle
3. Use Dispatch from phone if not at laptop

**Project kickoff:**
1. Build palette (9-shade process)
2. Define 4 hierarchy tiers with specific values
3. Pick 5 type sizes, 4 spacing values
4. Write it all in DESIGN_SYSTEM.md
5. Anti-patterns ALWAYS apply
