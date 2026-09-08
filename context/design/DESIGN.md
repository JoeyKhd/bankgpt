# BankGPT design system

Brand design extracted from the live BankGPT site <https://bankgpt.ai/> on
2026-09-08. Extraction method: direct analysis of the site's own CSS
design-token layer — the site is a Vite/React SPA whose stylesheet
(`/assets/index-*.css`, archived at [extract-bankgpt-site.css](extract-bankgpt-site.css))
defines every value below as a `:root` custom property. Nothing here is
eyeballed; token values are the site's own variables.

Machine-readable tokens: [tokens.json](tokens.json). Brand assets:
[assets/](assets/). The site's own OG image is kept at
[assets/bankgpt-og-reference.png](assets/bankgpt-og-reference.png) as the
reference for our generated [og-image.png](og-image.png).

> Note: bankgpt.ai is a dark, single-page hiring/brand site, not a product UI.
> Treat this file as the brand layer for our app (surfaces, color, type, logo,
> tone), not as a component library to copy pixel-for-pixel.

## Brand essence

- **Product:** "Personal Financial Intelligence" — *"An AI that sees all your
  money, understands what it means, and acts on your behalf to make you
  wealthier."*
- **Headline:** "The private **wealth advisor** every American can finally
  afford." (gradient on "wealth advisor")
- **Personality:** quiet, premium, founder-led. Dark room, two glowing
  accents, mono eyebrows, big confident numerals. More "private bank at
  midnight" than "fintech dashboard".
- **Voice:** first-person plural, direct, high-agency ("We need extraordinary
  builders. Now hiring for the founding team — On-site, equity-heavy.").

## Color

Dark-first palette. The site ships **dark only**; our app derives a light
theme from the same hues (see `apps/frontend/app/globals.css`).

### Surfaces (dark)

| Token | Value | Usage |
| --- | --- | --- |
| `surface.bg` | `#09090B` | Page background (near-black zinc). |
| `surface.bg-elevated` | `#0F0F12` | Raised surfaces. |
| `surface.bg-card` | `#131316` | Cards. |
| `surface.border` | `#FFFFFF0F` | Hairline borders (white 6%). |
| `surface.border-hover` | `#FFFFFF1F` | Hover borders (white 12%). |

### Text (dark)

| Token | Value | Usage |
| --- | --- | --- |
| `text` | `#FAFAFA` | Primary text. |
| `text-dim` | `#A1A1AA` | Secondary text, hero sub. |
| `text-muted` | `#71717A` | Labels, captions. |

### Brand accents

| Token | Hex | oklch | Usage |
| --- | --- | --- | --- |
| `indigo` | `#6366F1` | `oklch(0.585 0.204 277.1)` | Gradient start; ghost-button hover. |
| `indigo-bright` | `#818CF8` | `oklch(0.680 0.158 276.9)` | Hover text on dark. |
| `violet` | `#8B5CF6` | `oklch(0.606 0.219 292.7)` | Logo left circle (opacity .85); gradient midpoint. |
| `emerald` | `#059669` | `oklch(0.596 0.127 163.2)` | Primary button gradient end. |
| `emerald-bright` | `#10B981` | `oklch(0.696 0.149 162.5)` | **`--accent`.** Logo right circle, primary actions, links. |
| `emerald-soft` | `#34D399` | `oklch(0.773 0.153 163.2)` | Mono eyebrow/tag text. |
| `teal` | `#2DD4BF` | `oklch(0.785 0.133 181.9)` | Secondary accent. |
| `on-accent` | `#042F23` | `oklch(0.273 0.051 169.5)` | Text on emerald buttons — deep green, **not white**. |

Glows: emerald at 12% (`#10B9811F`) / 35% (`#10B98159`), indigo at 18%
(`#6366F12E`) — used for button shadows, card hovers, section washes.

### Signature gradient

```css
--gradient: linear-gradient(105deg, #6366F1 0%, #8B5CF6 42%, #10B981 100%);
```

Applied to headline `<em>` words and stat numerals via
`background-clip: text`. A soft variant
(`linear-gradient(135deg, #6366F11F, #8B5CF60F, #10B98114)`) washes sections.

## Typography

- **Sans: Inter** for everything. Body enables
  `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` (Inter's
  disambiguation alternates).
- **Mono: IBM Plex Mono** for eyebrows/tags/labels — uppercase, 10–12px,
  weight 500, letter-spacing `.14em`, colored `emerald-soft`.
- **Hero H1:** `clamp(32px, 7vw, 96px)`, weight 600, line-height 1.14,
  letter-spacing `−0.035em`.
- **Section titles / stat numerals:** `clamp(34px, 4.5vw, 56px)`, weight 600,
  letter-spacing `−0.03em`.
- **Hero sub:** `clamp(17px, 1.85vw, 20px)`, weight 400, line-height 1.72,
  `text-dim`.
- **Stat labels:** 12px, weight 500, letter-spacing `.04em`, `text-muted`.

## Shape, elevation, motion

- **Radius:** buttons and badges are **fully rounded pills**
  (`border-radius: 100px`) — the signature shape. Cards 14–20px.
- **Elevation:** an inset top highlight (`0 1px 0 #FFFFFF0A inset`) on
  buttons; cards `0 18px 50px -24px #000000A6`; hovers add an emerald glow
  (`0 24px 60px -20px #10B9811F`).
- **Primary button:** emerald gradient (`#10B981 → #059669`), pill radius,
  deep-green text `#042F23`, glow shadow `0 6px 24px #10B98147`; hover lifts
  `translateY(-2px)` and brightens.
- **Ghost button:** transparent white-3% fill, 1px `--border`, pill; hover
  turns indigo (`#818CF8` text, `#6366F114` fill, `#6366F173` border).
- **Motion:** `ease-out cubic-bezier(0.33, 1, 0.68, 1)`, spring
  `cubic-bezier(0.34, 1.56, 0.64, 1)`; hero entrance is a 0.95s `fade-up`
  staggered at 0.35s / 0.55s.

## Logo and icon

- **Mark** ([assets/bankgpt-mark.svg](assets/bankgpt-mark.svg)): two
  overlapping circles (venn) — left violet `#8B5CF6` at opacity `.85`, right
  emerald `#10B981`. `viewBox 0 0 100 60`, circles `cx 34/62, cy 30, r 24`.
  On dark backgrounds the mark floats without a container.
- **Lockup** ([assets/bankgpt-logo-lockup.svg](assets/bankgpt-logo-lockup.svg)):
  mark + "BankGPT" in Inter 600, `#FAFAFA`, slight negative tracking — exactly
  as rendered in the site's nav and OG image.
- **Favicon** ([assets/bankgpt-favicon.svg](assets/bankgpt-favicon.svg), the
  site's own): the same two circles inside a `#09090B` rounded square
  (`rx 40` on a 180 viewBox).
- Do not recolor, rotate, or add a container on dark; on light backgrounds use
  the favicon-style dark rounded square.

## Voice and content patterns

- Mono uppercase eyebrows with a leading emerald dot ("● NOW HIRING —
  FOUNDING TEAM").
- One big sentence per section; gradient emphasis on the two or three words
  that carry the value ("wealth advisor").
- Stats as oversized gradient numerals with small muted labels.
- CTAs are short imperatives; primary CTA is always emerald, never violet.

## Applying this brand in our app

- The shadcn theme in `apps/frontend/app/globals.css` implements these tokens:
  dark mode is the brand-native mode (`--background` = `#09090B`,
  `--primary` = emerald-bright, `--accent` = violet/indigo family, pill
  radius), and a derived light mode keeps the same hues on light surfaces.
- Fonts load through `next/font/google`: Inter (`--font-sans`) and IBM Plex
  Mono (`--font-mono`); both are in the installed Next.js font catalog, so no
  network fetch is needed at build time.
- Logo and favicon for the app live in `apps/frontend/public/` (only those
  files go there); everything else design-related stays here in
  `context/design/`.
- The OG image ([og-image.png](og-image.png)) is generated from
  [og-image.html](og-image.html) with headless Chromium and follows this
  file's palette, type, gradient, and voice (modeled on the site's own OG,
  [assets/bankgpt-og-reference.png](assets/bankgpt-og-reference.png)).
