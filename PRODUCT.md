# Product

## Register

product

## Users

A small, private circle: the maker plus a few friends, invited via a shareable link. German-language. Primary context is a phone on the gym floor (quick mid-workout logging) and a larger screen at home for reviewing progress. Everyone is a returning user who already knows the app — there are no strangers to onboard, so the design optimizes for fluency and speed over hand-holding.

## Product Purpose

PRSONAL is a personal training tracker (PWA, Supabase-backed) for logging workouts, tracking body weight and energy balance, and watching strength/consistency trends over time. Success is all-around balance across three jobs that matter roughly equally: (1) fast session logging, (2) progress insight via charts, (3) habit/streak consistency. No single job dominates — the app must do all three well without making any of them feel secondary.

## Brand Personality

Calm, precise, focused. The tool is quiet and data-honest; it gets out of the way of the workout. Voice is plain and unsentimental (German UI), never hype. The current shipped identity — cool blue-grey surfaces, a single navy accent, Helvetica Neue, restrained 8px geometry — is the reference, not a starting point. Warmth comes from clarity and responsiveness, not decoration.

## Anti-references

- **Gamified fitness apps** (MyFitnessPal/Strava-style hype): no badges, confetti, cartoon mascots, or loud reward animations. Progress is shown honestly, not celebrated theatrically.
- **Bro / hardcore gym aesthetic**: no black-and-neon, aggressive all-caps "beast mode" energy, flames, or shouting typography.
- By extension: no gamified streak theater. The streak is a quiet fact, not a slot-machine.

## Design Principles

1. **The tool disappears into the task.** Earned familiarity over novelty — standard affordances, consistent component vocabulary screen to screen. A friend should never pause at a subtly-off control.
2. **Three jobs, no orphans.** Logging, insight, and consistency each deserve a first-class home. Don't let charts crowd out fast entry, or the streak crowd out the data.
3. **Data-honest, never hype.** Numbers and trends speak plainly. Motion conveys state, not celebration. No reward animations dressed up as feedback.
4. **Quiet by default, navy for intent.** The cool-neutral surface carries the structure; the single navy accent is reserved for primary actions, current selection, and state — never decoration.
5. **Phone-first, desktop-capable.** The same app shell must work thumb-first on the gym floor and expand sensibly on a wide screen. Responsiveness is structural, not just fluid type.

## Accessibility & Inclusion

Not a strict compliance target (small private tool), but keep the baseline the code already establishes: visible keyboard focus (`:focus-visible` rings are in place), honor `prefers-reduced-motion`, and keep body text legible against the tinted neutral background. The category colors (push/pull/cardio/up/down) should stay distinguishable by more than hue alone where feasible, but formal colorblind-safe certification is out of scope.
