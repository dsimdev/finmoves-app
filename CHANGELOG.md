# Changelog

All notable changes to FinMoves are documented here.

---

## [2.104.2] — 2026-07-24

### Fixed — renaming a category left old movements behind and invented an icon
Two bugs in the rename shipped in v2.104.0:

- **Migration was skipped when the movements cache was cold.** `renombrarCategoria` received the
  movements/recurrentes from the component's `useData` snapshot. If that snapshot hadn't loaded
  yet (cold cache, or landing straight on Settings), it arrived empty → `ids.length === 0` → the
  movement migration was skipped while config was still renamed. Result: config showed the new
  name but every historical movement stayed under the old one. Now the service **queries
  Firestore directly** (`where("categoria","==",old)` for movements, a full read for recurrentes),
  so the migration no longer depends on client UI state.
- **The icon changed on rename.** A category with no saved icon/colour was rendered from one
  *deduced from its name*. Renaming kept the name field but not the visual, so the deduction ran
  against the new name and produced a different icon. The rename now **freezes** the icon/colour
  (via `visualDeCategoria`) into config before saving.

The confirm dialog no longer promises a movement count it can't know from a cold cache. After a
successful rename the movements cache is invalidated so the list reflects the new name.

**Note:** this fixes renames from here on. A category renamed under v2.104.0 already has its old
movements stranded — renaming it again (now) migrates them correctly.

---

## [2.104.1] — 2026-07-24

### Security — dependency updates (0 vulnerabilities)
`npm audit` reported 14 vulnerabilities in production dependencies (5 high). All cleared.

- **Next.js 16.2.7 → 16.2.12** (patch, no breaking changes): fixes SSRF in Server Actions,
  middleware/proxy bypass in App Router, cache confusion, and DoS via the image optimizer. Stayed
  within 16.2.x on purpose — `npm audit fix --force` wanted to *downgrade* Next to 9.3.3, which is
  destructive; the safe fix was the patch bump. `eslint-config-next` aligned to 16.2.12.
- **Transitive deps pinned via `overrides`**: `postcss` 8.5.23 (XSS / path traversal),
  `brace-expansion` 5.0.8 (DoS), `uuid` 11.1.1, `sharp` 0.35.3. `overrides` rather than a forced
  fix so the direct deps and Next are untouched.
- No application code changed — only `package.json` and the lockfile. Build, 331 tests and
  typecheck all green.

---

## [2.104.0] — 2026-07-24

### Added — rename a category (with full migration)
Categories could have their icon, colour, budget and active state edited, but not their name.
That gap is closed: the icon/colour sheet (Settings → Movements → Categories, tap a category's
icon) now leads with an editable **Name** field.

A category name is not just a config label — every movement stores `m.categoria` as a string, and
the budget template key and each recurrente's doc id derive from it too. So a rename **migrates
all of it** rather than leaving history stranded under a category that no longer exists:

- `utils/rename-categoria.ts` (pure, 13 tests) decides what to touch: it validates the new name
  (non-empty, changed, and not colliding with another category case-insensitively — merging two
  categories is a different operation and is blocked) and computes the affected movement ids and
  the renamed budget key.
- `services/firebase/rename-categoria.ts` performs it: movements via the existing
  `recategorizarMovimientos` batch (bumps the sync revision once), the `categorias` array and
  `presupuestoTemplate` key in config, and the recurrentes — whose doc id comes from the name, so
  each is re-created under its new id and the old doc deleted.
- The rename is confirmed first (it is a migration): the dialog states the new name and how many
  movements will be updated.

---

## [2.103.1] — 2026-07-23

### Changed — calendar marks are dots again, not a filled cell
v2.103.0 tinted the whole cell (background + border + number) for any day with something on it.
In practice that painted the day solid and swallowed the grid — too much ink for the signal.

Cells are no longer filled. A marked day now shows its **number in colour plus a dot underneath**,
and background/border are reserved for the *selected* day, which is an interaction state rather
than a mark. Each source gets its own dot — green for today, the reminder's (violet repeating /
teal one-off), and the recurrente's urgency colour — so a day holding all three shows three dots
without the cell changing size.

The recurrente's dot is no longer conditional on a reminder being present: with the tint gone, the
dot is the signal rather than a supplement to it.

---

## [2.103.0] — 2026-07-23

### Added — recurrentes projected onto the home calendar
The reminder calendar now also shows **when each recurring movement is expected**, so an
upcoming subscription is visible before the push arrives instead of only through it.

- New `utils/recurrent-forecast.ts`: `proyectarRecurrentes()` resolves each active template's
  reference date exactly the way the cron does (latest movement matching `recurrentKey`, or
  `createdAt` in AR time when it was never loaded) and projects it to `ref + DUE_DAYS`. The
  thresholds are imported from `recurrent-reminder`, not re-declared, so the calendar and the
  notification can never disagree. 15 unit tests cover matching, homonyms, and the AR-time edge
  where a UTC-midnight `createdAt` belongs to the previous day.
- Colour follows the cron's own cycle: **orange** while far, yellow from `PRE_DAYS` (approaching,
  when the pre-notice fires), red past `DUE_DAYS`. When several land on one day, the most urgent
  wins. Orange rather than teal because teal is already the one-off reminder's colour.
- **Overdue ones anchor to today** rather than their elapsed expected date, which would have
  scrolled them out of view precisely when they matter. The day popover lists them with their
  amount, without a delete button (they are managed from Movements).
- Notification behaviour is untouched: this only mirrors a calculation that already existed.

### Changed — today is marked with a green dot
Today used to be a grey cell background plus a faint border, which any other mark painted over —
so the current day stopped being recognisable exactly when it had a reminder or a recurrente on
it. It now carries a **green dot** under the number, independent of everything else, and its
number stays at full weight.

### Changed — a marked day colours its number
A day with something now shows its **number in the corresponding colour** rather than a neutral
one, which makes the mark readable without filling the cell. Reminders keep their colours (violet
repeating, teal one-off) and recurrentes use the urgency scale above; when a day holds both, the
number takes the reminder's colour — it is an agenda entry, not an estimate.

*(v2.103.0 shipped this as a full-cell tint, walked back in v2.103.1 — see above.)*

### Fixed — day popover survived a month change
Navigating months with a day open left the popover floating over a month it did not belong to:
the outside-click handler ignores everything inside the calendar, and the arrows live there. The
arrows now close the open day, stale `celdaRefs` are dropped on navigation, and the positioning
effect clears `pos` when the anchor cell is not on screen instead of keeping the previous spot.

### Changed — category detail groups identical expenses
Tapping a category in Reports → Gastos listed one row per movement, which in repetitive
categories (tolls, coffee) was an endless scroll of the same description. Rows are now **grouped
by description** with their total and a `×N` count, sorted by total. Date and payment method are
dropped on purpose — Movements' in-place filter covers that. New `utils/agrupar-gastos.ts`,
6 unit tests (case/whitespace folding, first-seen label, blank descriptions).

### Changed — short modals are floating cards, not bottom sheets
A bottom sheet is a big gesture for a two-button confirmation. Modals whose content is short and
bounded now open as centred `CenterCard`s — they appear in place with a pop instead of sliding a
full-width panel up from the bottom.

Converted: period navigation (a confirm), salary history, direct-to-savings, payment-method
breakdown, `/analisis` range picker and day detail, the invite code, the sync log, and both
category details — the current period's and its previous-period twin. Grouping by description
(above) is what made those two short enough to qualify; `CenterCard` caps at `88vh` with its own
scroll, so a category with many distinct descriptions still fits.

`BottomSheet` stays only where the list is deliberately long: "top 20 expenses" / "all
categories", the budget editor (a form with one row per category) and the changelog (five full
releases). Those are what a draggable, near-full-height sheet is for.

### Added — "vs previous period" rows open their detail
Each category row in the comparison is now tappable and opens what was spent on it **during the
previous period**, grouped the same way, so both sides of the comparison read alike. Rows with
nothing on the previous side stay inert rather than opening an empty sheet.

### Changed — a collapsed day shows what was spent, not how many movements
The collapsed day header showed one count per type — five coloured digits where "3" told you
nothing. It now shows the **day's spending as the hero number**, with anything outside that total
(income, moves, remaining FX operations) reduced to a **coloured dot** beside it: "something else
happened here" without adding text.

- The total uses the same `Gasto + CompraUSD` rule as `utils/periodo`, so it matches Reports.
  `CompraUSD` therefore gets no yellow dot — it is already inside the number.
- A day with no spending shows `—` instead of `$0`, which reads as a value rather than an absence.

### Removed — "By day" chart in Reports → Gastos
Redundant now that the per-day total lives in Movements, and the same reasoning that retired
"Top 5 descriptions" in v2.85.2. The day-detail `BottomSheet` goes with it (the chart was its
only entry point), along with `porFecha`/`splitPorFecha`, the `diaModal` state, the now-unused
`gastosPorFecha`/`esGasto` imports and the orphaned `byDay`/`buyUsd` strings in both locales.

---

## [2.102.0] — 2026-07-23

### Removed — hardware vibration (haptics)
`navigator.vibrate` never fired on iOS: Apple never shipped the Vibration API and closed the
only workaround (the ringer switch) in iOS 26.5. Shipping a "Vibration" toggle in Settings
promised something that silently did nothing on half the devices, so the hardware side is gone.
There is no web alternative — this is settled, not pending.

- `lib/haptics.ts` → **`lib/feedback.ts`**, exporting `feedback(tipo, el)`. The vibration
  patterns, the `setHapticsEnabled` mirror and the `try/catch` around `navigator.vibrate` are
  all removed.
- The `haptics` pref is dropped from `useAppPrefs` (interface, `set` union and defaults), along
  with its toggle in Settings → Preferences and the `hapticsTitle`/`hapticsSub` strings in both
  locales.

### Changed — the visual pulse carries the feedback now
Being the only feedback left, the pulse hits harder: `fbPunch` compresses to .88 and **overshoots
to 1.04** before settling (it used to bottom out at .94 with no bounce), which is what makes it
read as a hit rather than a fade.

- Three distinct animations replace the previous two: `fb-punch` (weighty confirmations),
  `fb-tap` (light touches — navigation, selection) and `fb-shake` (delete, now a 3-step
  sway). All keep their `prefers-reduced-motion` no-op.
- `ConfirmModal` now fires the pulse from its own confirm button, picking `delete` for red
  (destructive) actions and `success` otherwise — so every confirm inherits it instead of each
  caller wiring its own.
- Fixed call sites that passed no element and were therefore silent no-ops once the vibration
  was gone: saving in `MovementModal` (now targets the submit button), and `useLongPress` (which
  captures `currentTarget` at pointerdown, since the event is recycled by the time the 450 ms
  timer fires).
- `SwipeAway` drops its pulse: the row already animates itself off-screen and a shake competed.

### Changed — category palette reworked: 18 colors, ordered by hue
The palette is now **one color per icon** (18 and 18) and is declared **in hue order** (red →
yellow → green → cyan → blue → violet → pink), so the picker reads as a color wheel instead of
a bag of swatches.

- Added, on a **luminosity axis**: `olivaProfundo`, `mentaProfunda`, `turquesaClaro`,
  `petroleo`, `grafito`. With six semantic tones off-limits, nearly every new *hue* landed under
  the 60-distance threshold — so the extra variety comes from light/deep variants of existing
  families, where brightness provides the separation.
- Removed to hit 18 without crowding: `lavanda`, `cieloProfundo`, `rosaProfundo`, `ciruela`,
  `salmon`. Categories saved with a removed color fall back to the name-derived default —
  `visualDeCategoria` already validates against `COLORES_LISTA`.
- Closest pair is now **66.8** (dorado/lima), against the > 60 threshold. Full suite: 297 tests.

### Added — three category icons
`gimnasio` (dumbbell), `regalo` (gift box) and `cafe` (cup), bringing the selectable set to 18.
Name-based rules updated: gym/deporte/club → `gimnasio`, regalo/gift/cumple → `regalo`, and
cafe/bar/coffee → `cafe` (`bar` moved off `ocio`, which matched it first before).

---

## [2.101.1] — 2026-07-22

### Changed — swipe highlight uses the category color
The swipe-to-reveal highlight in the movements list now tints with the **category's own color**
(the one the user configured) instead of the movement type's semantic color, so the list feels
like the user's own setup. The amount keeps the type color, so the meaning (red spend, green
income…) is unchanged.

### Added — five more category colors
`COLORES_CATEGORIA` gains `coral`, `turquesa`, `lavanda`, `dorado` and `violeta` — high-contrast
tones filling gaps in the wheel (no repeats), all passing the RGB-distance > 60 legibility test.

### Fixed
- `SwipeToDelete`: the settle-animation `setTimeout` was not cleared on unmount, so a row removed
  within 320 ms (delete/filter) could fire a `setState` on an unmounted component. Now tracked in
  a ref and cleared in a cleanup effect.

---

## [2.101.0] — 2026-07-22

### Added — haptic feedback
Key actions now give feedback, through `lib/haptics`: a hardware buzz where it works (Android)
plus a visual punch that always runs. `navigator.vibrate` is fired **synchronously inside the
gesture** — the old bug was calling it after an `await`, which drops the user activation.

- Wired on: saving a movement (`success`), deleting (`delete`), tab navigation (`light`) and
  long-press selection (`select`). Each has its own vibration pattern and visual pulse.
- **Toggle in Settings → Preferences** (default on) controls **only** the hardware vibration —
  the visual pulse is always on, so iOS (where the Vibration API doesn't exist and Apple closed
  the switch hack in 26.5) still gets a response.
- The pulse reuses the shared motion system (`--ease-settle`).

### Fixed — multi-select
- **Deselecting the last item now exits selection mode** instead of sitting on "0 selected".
- **Swipe is disabled while selecting**: with selection active the row's swipe (edit/delete) no
  longer fires — actions belong to the selection bar. An open row closes when selection starts.
- **Bulk delete now confirms first**, then deletes (with the existing undo toast). It no longer
  wiped the selection straight from the trash button.

### Internal
- `lib/haptics`, `haptics` device pref. 297 tests.

---

## [2.100.0] — 2026-07-22

### Added — goal simulator
Each goal card in Investments now has a collapsible **"What if…?"** that turns the passive
"you'll reach it in X periods" into something you can play with: drag a knob and watch the
number drop. It touches no data — only re-projects with an extra.

- Each goal simulates in **its own unit**: the ARS savings goal in pesos (knob: save more per
  period), the FX goal in currency (knob: buy more per period). The FX projection runs on net
  currency purchases, not converted pesos — buying dollars is what moves an FX reserve, not
  saving pesos.
- `utils/simulador-meta` re-uses the same `ceil(remaining / pace)` the cards already use, so
  the simulated and real numbers can't diverge. 9 tests.

### Added — a shared motion system
Openings across the app spoke different dialects: modals, sheets and popovers each had their
own easing curve. There's now one motion language in `globals.css` (`--ease-settle`, plus
`appearPop` / `appearPopover` with a real overshoot), and every overlay uses it — CenterCard
(and everything built on it), ConfirmModal, KpiInfoModal, BottomSheet, the notification /
filter / calendar-day popovers, and the recap sheet. One value tunes the feel everywhere.

### Changed — swipe-to-delete feels right
The movements swipe was janky and could get stuck half-open on a light touch. Now it has drag
friction so it follows the finger smoothly, opens only past the halfway point (a graze closes
clean), highlights the row **in the movement type's colour** (red expense, green income, etc.)
while sliding, and gives a small settle-nudge on open.

### Changed — Move icon
Moves (between available and savings) had the generic "…" icon. They now show **two crossing
arrows** painted with a teal→purple gradient — the two sides a Move connects.

### Internal
- **297 tests** (up from 288).

---

## [2.99.1] — 2026-07-22

### Changed — KPI shuffle across Home and Reports
- **Home** drops "Spent" (the period total is already the available hero plus its bar) for
  **"Today"** — what you've spent so far today. Its colour compares against the "spend per day"
  recommendation: green under it, amber close (≥85%), red once you've matched or passed it. So
  the top row now tells one story of the day — how much, and how it's going.
- **Reports → Movements** drops "Today" and "Daily average" for two figures it didn't surface
  before: **busiest day** (the day with the most movements) and **biggest expense** (the single
  priciest purchase, with its description in the detail).
- The "highest-spend day" KPI now shows **how many movements that day had** in its detail.
- `kpisPeriodo` gained `gastoMasGrande` and a movement count on `diaMayorGasto`; both covered by
  new tests. **288 tests** (up from 284).

---

## [2.99.0] — 2026-07-22

### Added — period recap
Closing a period (logging the salary that opens the next one) now produces a recap of the one
that ended. The Wrapped carousel is a once-a-year, full-screen thing; this is a single panel
with an extended summary, because it happens every pay cycle and has to read at a glance.

- **Where**: the icon button in the Reports header — the same slot as the year Wrapped. The
  recap takes priority when there's a recently closed period; the Wrapped shows in its
  end-of-year window otherwise.
- **Until seen once**: like a notification. Open it and the button goes away; it returns only
  when the next period closes. An in-app bell notification points you to it when the period
  closes, without a push (`?recap=1` reopens it any time for a look).
- **What it shows**: spent and saved, each with its ± vs the previous period; the category that
  rose the most (in pesos, with a rounded % — a tiny prior base was producing "48.500516908%");
  plus carried-over available, movement count, average per expense and the biggest-spend day.

The logic in `utils/recap-periodo` composes the existing `kpisPeriodo` and
`comparativaCategorias` rather than recomputing, so the recap can't drift from the rest of
Reports. Header buttons dropped their gradient pill for a plain accent icon, matching the rest
of the header.

### Internal
- **284 tests** (up from 268): `recap-periodo` and the recap branch of the in-app catch-up.

---

## [2.98.1] — 2026-07-22

### Changed — the category palette, cleaned up
The first pass shipped tones that were too close to tell apart: three oranges (coral, rust,
sand) and two violets (lavender, indigo), plus a slate grey that gave no identity and competed
with muted text. The palette now spreads ten tones around the colour wheel — rose, magenta,
orange, olive, lime, mint, sky, indigo, sand — and a test measures the RGB distance between
every pair, failing if two ever land too close again.

**`contraste` replaces the grey**: it resolves to `var(--text)`, so it's black in the light
theme and white in the dark one. Storing a flat "black" would have left the icon invisible the
moment you switched themes.

### Changed — icon set
Dropped four that read poorly at 34px (gift, the sport ball, the filing cabinet, and the
"beauty" glyph that looked like a syringe) and added a **piggy bank** for savings. Categories
that defaulted to a removed icon were reassigned, and a test now asserts every name-based rule
points at an icon that actually exists in the catalogue.

### Fixed — currency operations aren't categories
`CompraUSD`, `VentaUSD` and their EUR counterparts were falling through to the generic
name-based default. They now have a **fixed visual — the $ sign in amber**, the same amber that
marks them everywhere else in the app, and stored preferences can't override it: the colour is
what tells you it's a currency operation, not a taste. RESTO is likewise pinned to blue, like
its amount.

The detail view also stopped printing "COMPRAUSD · COMPRAUSD" — the de-duplication that already
ran in Reserve now applies in Movements too.

### Internal
- **268 tests** (up from 261).

---

## [2.98.0] — 2026-07-22

### Added — every category has its own icon and colour
Categories were plain text. They now carry visual identity, which is what the project's design
brief asks for: icons, colour and shape as the protagonists rather than more labels.

- **In the movements list** the category icon replaces the type dot. The dot was redundant —
  the amount's colour already says expense, income or move — so that slot now carries
  information it didn't before.
- **The category name is gone from the row subtitle**: the icon says it. The subtitle is left
  for the note. A movement with no description still shows the category as its title, so
  nothing loses its name.
- **The detail view** leads with the category icon instead of the generic type arrow, which
  repeated what the sign and colour of the amount already convey.
- Same icon in the desktop table.

### The colour palette avoids the semantic tones
Six colours already mean something in the app: green (income), red (expense), purple (move to
savings), teal (move to available), amber (currency operations) and blue (RESTO). None of them
is offered as a category colour — an expense with a green icon next to a red amount reads
wrong. Categories draw from a **separate ten-tone palette** (rose, lime, coral, indigo, mint,
lavender, rust, sand, slate, sky), and a test asserts the two sets never overlap.

Report bars stay red on purpose: there the colour is what marks the entry as spending, and
there's no icon alongside to carry that meaning.

### Nothing to set up
`icono` and `color` are optional fields. Existing categories get a sensible default deduced
from their name — matching ignores case and accents and works on partial names, so "Games"
lands on the controller, "Car" on the vehicle, "Loki" on the paw, "Daily" on the house. To
change one, tap its icon in Settings → Movements: 18 icons and 10 colours, picked by tapping,
with a live preview of the row.

### Internal
- `utils/categoria-visual` (palette, icon catalogue, name-based defaults) with 16 tests;
  `components/ui/CategoriaIcono` is the single component every view renders.
- **261 tests** (up from 245).

---

## [2.97.1] — 2026-07-21

### Changed — swipe to delete, in one gesture
Notifications and the FX history now delete with a **continuous swipe** instead of revealing
buttons: the row follows your finger over a red background, the bin fades in as you drag, and
the colour saturates once you're past the threshold — release there and it's gone. Short of the
threshold the row springs back, and there's resistance past the stop so the limit is felt.

- `components/ui/SwipeAway` is a separate component: `SwipeToDelete` (reveal-and-hold buttons)
  stays in Movements, where a row also offers edit and deleting deserves more deliberation.
- The FX history keeps its confirmation dialog — removing a currency operation moves net worth —
  so there the row returns to place and the dialog decides (`confirma` prop).
- The "delete all" bin added earlier in v2.97.0 is gone: with the swipe this fluid, clearing
  one by one is quick and a bulk wipe was risk without payoff.

---

## [2.97.0] — 2026-07-21

### Added — the bell catches up when you open the app
The cron runs every few hours. Between runs the dollar moves and new expenses change the budget
outlook, so the inbox was always behind what had already happened. Opening the app now evaluates
the same checks against current state and records whatever is missing — **without sending push**
(interrupting is still the cron's job) and **without touching the cron's baseline**.

- Five checks run on open: dollar, budget, pending recurring items, new version, and the
  three-day heads-up for reminders. The final reminder alert stays with the cron, which also
  deletes the reminder — the client stays out of that.
- The client keeps its own dedup marker (`notifyMeta.inApp`), so the cron's push behaviour is
  unchanged. Budget is the exception: that dedup is now **shared** with the cron, so a category
  is only announced once per period no matter which side spotted it first.
- `utils/notif-inapp` holds the logic, reusing the same pure functions the cron uses
  (`categoriasEnRiesgo`, `shouldRemind`) so the two paths can't drift. 14 tests.

### Budget alerts now separate "already over" from "heading there"
One message covered both cases and said "heading over budget" about categories that had
**already** blown past it. They are now two different alerts: `4 categorías ya se pasaron`
(a done deal) and `3 van camino a pasarse` (still correctable). A category that exceeds its
budget is also caught even when its pace has flattened out and the projection no longer trips
the threshold.

### Notifications: one-line body, tap to expand
Bodies are a single line; the first tap expands the full breakdown inside the bell (every
category, not just the top three) and a second tap navigates. Added **delete all** — a bin next
to the close button, behind a confirmation since it can't be undone.

### Fixed
- **The notification popover sat flush against the bell on Home.** Both popovers used a fixed
  `top` offset, but Home's header is taller (it carries a subtitle), so the panel landed on top
  of the icon. Both now measure the trigger's actual position instead of assuming a header
  height.
- **Reserve detail** showed "COMPRAUSD · COMPRAUSD" and led with the peso amount. It now shows
  the label once, leads with the **currency amount** (what the operation is actually about) and
  puts pesos underneath. Quantity and description cards are gone (they repeated the hero and the
  title); rate and notes share a row. Movements' detail is untouched.

### Internal
- **245 tests** (up from 225). New `hooks/useNotifCatchUp`, `utils/notif-inapp`.

---

## [2.96.0] — 2026-07-21

### Added — multi-select in Movements
Movements could only be handled one at a time: swipe, modal, confirm. Clearing five duplicates
took fifteen interactions. You can now select several and act on all of them at once.

- **Mobile**: long-press a row to enter selection mode with that one already picked; tap to
  add or remove. The press cancels if the finger moves (that's a scroll) and swallows the
  click the browser fires afterwards, so it doesn't also open the movement.
- **Desktop**: a "Select" button in the search bar reveals checkboxes, with a header checkbox
  that marks every visible row (indeterminate when partial).
- Two actions: **delete** the selection, or **reassign its category** in one go.

### Business rules the selection respects
- **The anchor salary can't be deleted** — it defines the period's date. Selecting only that
  leaves the delete action disabled. If a period holds more than one salary, only the first
  is the anchor.
- **Moves, FX operations and RESTO can't be recategorised**: their category is structural and
  reassigning it would break how the period is computed.
- `utils/seleccion` holds both rules, covered by 12 tests.

### Batched writes
`eliminarMovimientos`, `recategorizarMovimientos` and `restaurarMovimientos` use `writeBatch`
and mark the full-sync flag plus the revision bump **once** per operation instead of per
document. Deleting ten movements went from 30 writes to 12. Batches split at Firestore's
500-operation limit.

### Undo
Bulk delete is optimistic and raises a "Deleted 5 · Undo" toast with a progress bar showing how
long the action stays reversible. Undo restores the documents under **their original ids**, so
attached receipts and recurring-template matches keep working.

### Internal
- **225 tests** (up from 213). New `hooks/useLongPress`, `components/ui/UndoToast` and
  `components/movements/SelectionBar`.

---

## [2.95.0] — 2026-07-21

### Added — repeating reminders
Reminders were one-shot: the cron fired the push and deleted the doc. A reminder can now
**repeat on the same day every month** — load it for the 23rd and it comes back on the 23rd of
August, September, and so on, pre-warning included each cycle.

- The cron advances the date instead of deleting, and `avisadoPre` resets so every cycle gets
  its own heads-up. If the cron was down for months it catches up in one jump rather than
  firing daily until it recovers.
- **The 31st does not decay.** A reminder on the 31st shows as the 28th in February but returns
  to the 31st in March — the chosen day is stored separately from the current date, so a short
  month can't pin it down permanently. `utils/recordatorio-repeat` holds the date logic (9 tests
  covering leap years, year rollover and the catch-up).
- Existing reminders can be switched to repeating from Settings → Notifications.

### Added — the reminder card is now a calendar
The card used to show only the next reminder plus a date input. It now carries a **month
calendar you navigate and tap**: tapping a day opens the form for that date, and the day's
existing reminders appear above it with an × to delete. A dot marks days that have something —
purple when it repeats, teal when it's one-off. The date input is gone.

### Added — "spend per day" replaces the deviation KPI
Home's fourth KPI was a coefficient of variation: it described the past and suggested nothing.
It now shows **how much you can spend per day to reach the end of the period** — what's left
split across the days remaining.

- Period length is **measured, not assumed**: the median gap between your actual periods, since
  periods are pay cycles and not necessarily monthly. Falls back to 30 days only without
  history. Median rather than mean so one odd cycle doesn't skew it.
- The pace uses everything that actually draws down the available balance (`gastado +
  moveAhorros`), not just pure expenses — measuring with `gastadoPuro` overstated how long the
  balance lasts.
- Red when your current pace doesn't reach the close, green when it does. Tapping it explains
  how long the balance lasts at your current pace, marked as approximate because period length
  is an estimate.
- KPI order regrouped: current-period figures on top (spent / spend per day), cumulative ones
  below (inflation / accumulated savings).

### Fixed
- `MiniStat` capitalised every word of its label, so "Por período" rendered as "Por Período".
  Affects Home, Reports and Investments.
- The Reserve card title used inline styles instead of the shared `.label` class, so it had
  tighter letter-spacing than every other card title on the screen.

### Internal
- **213 tests** (up from 185): `recordatorio-repeat` (9) and `duracion-disponible` (19,
  including a regression case built from real period figures).

---

## [2.94.0] — 2026-07-21

### Added — search across all periods
The magnifier filter only ever looked at the selected period, so "when did I buy the fridge?"
could not be answered from Movements — you had to leave for Analysis, a screen built to
compare, not to find. A **"search across all periods"** toggle now widens the scope.

- With it on, the year and period pills **shrink to the ones that actually have matches**, and
  each period pill carries its match count. The selector you already use becomes the map of
  where the thing you are looking for lives — no separate results view.
- If the year or period you were standing on has no matches, it falls to the most recent one
  that does, so you always land on results.
- The typing preview reports both numbers ("12 matches · in 3 periods") before you pin a term.
- Available in both interfaces: the filter popover on mobile and the always-visible search bar
  on desktop.
- Costs nothing extra: `useAllMovimientos` already holds every movement in memory, so the wider
  scope adds no Firestore reads.

### Internal
- **185 tests** (up from 178) — 7 cover the selector narrowing: year disappearing, period
  falling back, and no matches anywhere.

---

## [2.93.0] — 2026-07-21

### Added — budget deviation alerts
A new daily push warns you **before** you overshoot a category's budget, not after. Each day
the cron projects, at the current period's pace, how each budgeted category will close; if the
projection lands over budget, it sends one heads-up ("At this pace, Food closes at 180% of its
budget").

- Projection-based, not a flat threshold: it estimates the close from spend-so-far ÷
  days-elapsed × 30, so it catches a runaway pace early instead of waiting until you've nearly
  spent the budget.
- Guarded against noise: no alert before ~9 days into the period (too few data points to
  project), and a 1.05× threshold so trivial overshoots stay quiet.
- One alert per category per period; the dedup resets on its own when a new period opens.
- Effective budget resolves the period override (`presupuestos/{periodoId}`) first, then falls
  back to `meta.presupuestoTemplate` — same source the Reports budget bars use.
- `utils/budget-alert.ts` holds the pure logic (projection + guards), covered by 8 tests;
  `checkPresupuesto` in `lib/notifications.ts` wires it into the existing daily cron with the
  same per-check catch and confirm-before-dedup discipline as the other reminders.

### Internal
- New `presupuesto` notification type (icon + deep-link to Reports in the in-app panel).
- **178 tests** (up from 170).

---

## [2.92.2] — 2026-07-21

### Fixed
- **The in-app guide still documented auto-savings**, a feature removed in v2.92.1. The
  "Auto-ahorro" / "Auto-save" item is gone from both locales, so the guide no longer explains
  something that no longer exists.

### Internal
- Removed the now-orphaned `autoSavings` and `autoSavingsAmountPerExpense` locale keys (es + en);
  nothing referenced them after the feature was dropped.

---

## [2.92.1] — 2026-07-20

### Removed
- **Auto-savings feature dropped entirely.** The rule that fired a fixed Move to savings on
  every qualifying expense is gone: no config toggle (Settings → Movements), no generation in
  the movement modal or in the desktop quick-add, and `utils/auto-ahorro` + its tests are
  deleted. Historical Move entries labelled "Auto-ahorro" are left untouched (they are real
  savings). `meta.autoAhorro` stays in the type as optional so existing config docs that carry
  it are simply ignored.

### Fixed
- **Desktop quick-add skipped the new-row flash.** `QuickAdd` passed `onCreated` straight to
  `prependMovimiento`, bypassing `handleCreated` (which sets the brief highlight). It now goes
  through `handleCreated`, matching the mobile/modal feedback.
- **Period comparison inverted the delta on a negative base.** `PeriodCompare` computed
  `(v - prev) / prev`, so going from −1,000 to −500 in the `available` row (an improvement)
  read as a negative delta painted red. The denominator is now `Math.abs(prev)`, so the sign
  reflects the real direction of change.

### Internal
- **170 tests** (down from 177 — the 7 auto-savings tests were removed with the feature).

---

## [2.92.0] — 2026-07-18

### Added — desktop
FinMoves now has a real desktop interface (≥1200px, gated by `useIsDesktop()`), not a
responsive version of the mobile one. The lesson from the first attempt: rearranging mobile
components with CSS does not produce a desktop app — they carry mobile assumptions inside
(abbreviated amounts, pills two-per-row, heroes that assume they own the screen). What works
is writing the desktop view as a new component over the same data and the same tested logic.

- **Landing**: two-column hero (copy + screenshot) and a feature grid; the carousel stays on
  mobile. Copy moved from a hardcoded `T` object to `locales/landing.ts`.
- **Home**: two-column board — the period on the left (hero + KPIs in a row + shortcuts +
  per-category breakdown) and latest movements in a panel that follows the scroll.
- **Movements**: `MovementsTable`, a dense table sortable by column with full amounts;
  `SearchBar` always visible (on mobile the filter is a popover that would cover the rows);
  `QuickAdd` to log expenses from the keyboard (Tab across fields, Enter saves and returns
  focus to the amount).
- **Reports**: `PeriodCompare`, periods side by side — one column per period, one row per
  metric, each cell carrying its delta against the previous period. On mobile selected
  periods still merge into a single virtual one.
- **Investments**: `InvestmentsBoard` groups the figures by theme (net worth / FX position /
  savings pace), each with the color that section has on mobile; `FxHistoryTable` shows the
  full reserve history instead of hiding it behind the clock icon.
- **Settings**: section column + content beside it, via a `layout.tsx` that mounts the
  sub-pages as children without modifying them.
- **Admin**: `UsersTable` with permissions as toggle columns instead of a per-user accordion.
- `BottomSheet` renders as a centered card on desktop (pinned to the bottom edge at full
  width is not a dialog); the FAB, the header magnifier and the drag handle — all touch
  patterns — are not offered there.
- **Analysis is now mobile-only**: it is touch-driven end to end (swipe between modes, term
  pills, tap to break out a group) and the period comparison covers that need. Reaching it by
  URL on desktop redirects to Reports.
- Per-screen widths via `--page-max` instead of the global `max-width: 600px`: `page-fluid`
  for tables, `page-wide`/`page-mid`/`page-narrow` for the rest. Mobile is untouched: the
  classes only set `--page-max-desktop`, read inside the media query.
- The sidenav appeared at 768px while the desktop layout started at 1200: in between you got
  a sidebar next to the touch list. Unified at 1200.

### Fixed
- **The savings pace contradicted the accumulated total.** When a withdrawal exceeds what was
  ever recorded, `ahorrosAcum` clamps to 0 but the pace averaged the nominal movement: with
  50k saved, a 500k withdrawal and 30k after, the card read "−140,000 per period" while net
  worth above read 30,000. `PuntoTendencia.deltaAcum` exposes how much the accumulated total
  actually moved and `ritmoAhorro` averages that. "Worst period" had the same bias.
  (Closes finding 2 of the v2.75→v2.90 audit.)
- Goal target amounts were painted with the progress color, so a barely-started goal looked
  "in the red". Color now belongs to the bar and the percentage only.

### Internal
- `utils/movement-sort` (canonical + per-column ordering, 12 tests; they caught an inverted
  direction bug in text sorting), `utils/auto-ahorro` (the rule was written twice inside the
  modal; now a single definition, 7 tests, shared with quick add), `hooks/useMediaQuery`
  (`useIsDesktop` via `useSyncExternalStore`, no hydration flash).
- **177 tests** (up from 155).

## [2.91.0] — 2026-07-18

### Changed
- **Goal milestones (50/75/100%) are celebrated in-app instead of pushed.** Both `metaPropia`
  (accumulated savings) and `metaFX` (currency reserve) only move when the user loads a
  movement — meaning they are looking at the app at that exact moment. The cron ran afterwards
  and repeated something already seen, or announced it the next day. `checkMeta`,
  `checkMetaPropia` and `checkMetaFX` are gone from `lib/notifications.ts`; the celebration now
  lives in `MetaCelebration` + `utils/meta-hitos`, fired from `DataProvider` the instant the
  accumulated total crosses a milestone. Milestones persist in `config/meta`
  (`metaPropiaHitos`/`metaFXHitos`) so they don't repeat after a reinstall, and reset when the
  goal amount (or FX currency) changes. **`checkDolar` stays on push**: the exchange rate moves
  without the user doing anything, which is what a notification is for.
- Dropping `checkMetaFX` also removes its per-user daily `count()` query over reserve movements
  and the `metaMovCount`/`metaMovSum`/`metaCacheMoneda` cache from `notifyMeta`.

- The Income hero in Reports is now **"Total available"** (it shows everything that came in for
  the period, not what is left). Its subtitle carries the period-over-period comparison plus the
  currently-available figure from Home, so both numbers read together without switching screens.

### Fixed
- **The Movements breakdown (Reports) counted `IngresoUSD`/`GastoUSD`.** Those types never touch
  available balance — they only move the reserve — so they inflated the movement total, the type
  donut and the per-category/per-payment-method breakdowns. Now filtered via `afectaDisponible()`.
  `CompraUSD`/`VentaUSD` still count: they do move pesos, consistent with `esGasto()`.
- **An `IngresoEUR` detail showed "USD".** The FX label only listed `Compra`/`Gasto`/`Venta` EUR;
  it now derives from the type suffix (`monedaMovFX`).
- `num()` guards every branch of the FX calculation against `NaN`; a 0 exchange rate in ARS mode
  used to yield `Infinity`.
- The description field (and "repeat each period") no longer appear under Income before a category
  is chosen: both options resolve the description themselves, so the field only showed up to
  vanish on the next tap.

### Internal
- **`MovementModal` split: 1284 → 1132 lines.** `movement-shared.tsx` holds the detail pieces that
  were written twice (Movements detail and Investment reserve detail): `DetalleHero`, `DetalleFX`,
  `DetalleTextos`, `ComprobanteButton`, `detalleTipo` and the chip icons. `utils/movement-fx.ts`
  holds the ~15 inline FX booleans as pure functions. `useAddForm.ts` holds the 15 add-form
  `useState`s, with pure, tested state transitions (`estadoInicial`/`estadoReseteado`/
  `estadoParcheado`).
- Fewer renders: `aplicarPlantilla` fired 6 sequential setters (6 form renders) and the open effect
  up to 6 more; each is now a single patch.
- The reserve detail card used 13px/9px where the movement detail used 14px/10px for the same
  information. Unified.
- Removed the dead `detailReadOnly` prop: Home passed it and the modal never read it (the detail
  has been read-only for everyone since v2.78).
- **Test coverage 93 → 155.** New suites for `utils/search` (exact-word rule of the in-place filter
  and /analisis), `lib/sheet-format` (`sanitizeCell` is a security defense against spreadsheet
  formula injection), `lib/changelog-versions` (update-banner edges), `utils/movement-fx` and the
  add-form transitions — all gaps flagged by the v2.75 audit.

## [2.90.1] — 2026-07-18

### Fixed
- Removed the red rail behind the swipe-to-delete action in the FX history. `railBg` exists to
  separate the trash icon from the red expense amounts in Movements; the FX history uses green,
  yellow and blue amounts, so the red background read as an alert with nothing to warn about.

## [2.90.0] — 2026-07-18

### Changed
- **All projections now derive from a single `ritmoAhorro()` helper.** Four different windows
  coexisted (last 2, last 3, since-seed, full history) and three of them averaged GROSS savings,
  so the same question ("how much do you save per period?") got different answers per screen and
  the rate could exceed the accumulated total. Unified rules:
  - **Net savings** (`ahorroNeto`, new field on `PuntoTendencia`): gross minus what was moved
    back to available — consistent with `ahorrosAcum`, the headline figure.
  - **Everything since the seed** (`ahorrosAcumSeedPeriodoId`), current period included: the
    accumulated total counts it, so excluding it reported "zero pace" to someone who had in fact
    saved that period.
  - **CPI deflation only for ARS**: `deflatar` and the projection factor were being applied to
    USD/EUR users, inflating their projections with Argentine inflation.
- **Single seed for every average.** `inversionSeedPeriodoId` is obsolete; the FX reserve pace now
  uses `ahorrosAcumSeedPeriodoId` like savings do. Auto-anchoring points at the FIRST period with
  movements (it used to pick the current or second-to-last one, discarding prior history).
- **Spending projection blends history with the current pace.** It averaged only closed periods,
  which never change, so the figure was effectively static. It now mixes the deflated historical
  average with the in-progress period's daily rate, weighted by elapsed days (capped at 50%,
  history-only below 3 days).
- FX reserve history rows for currency income/spending are swipe-to-delete: those movements don't
  appear under Movements, so this is their only entry point. Purchases and sales are unaffected.
- Opening a history row's detail no longer closes the history panel underneath it.
- KPI explanations rewritten: shorter, and no longer claiming a fixed 3-period window.

### Fixed
- The inflation factor no longer amplifies negative rates (inflation doesn't make you dis-save
  faster), and a negative pace renders in red with the projection actually declining instead of
  freezing at zero — previously the FX pace was discarded when negative and the projection and
  goal cards silently disappeared.

## [2.89.1] — 2026-07-18

### Removed
- **Manual initial reserve (`saldoUSD`/`saldoEUR`) no longer feeds any calculation.** v2.89.0
  removed the config input but left the stored value being added to the reserve in five places
  (Investments, Reports, MovementModal, `checkMetaFX`), so the balance included an amount the user
  could no longer see or edit. The FX reserve is now purely what was loaded as movements,
  consistent with "savings are computed, not entered". The type fields are kept and marked
  `@deprecated` for the legacy documents in Firestore; nothing reads them.

## [2.89.0] — 2026-07-17

### Added
- **Per-currency savings goals — reserve ungated for everyone.** The Investments tab is no
  longer ARS-only. Two goal concepts now coexist:
  - `metaPropia` (all users): a savings goal measured against the already-computed accumulated
    savings (`serieTendencia.ahorrosAcum`), in the user's own currency. No name, no manual balance.
  - `metaFX` (ARS only): the currency-reserve goal, measured against the FX reserve (formerly the
    single `metaMonto`). ARS users keep both goals.
- **Investments tab for EUR/USD users.** Users whose primary currency is EUR/USD (no FX reserve)
  now get real content: net worth in their currency (disponible + ahorros), the savings goal
  (second), savings rate (per-period, projection, periods-to-goal) and best/weakest period. All
  derived from data already computed — no new reads.
- **Config split into two sections** (`settings/investment`): "savings goal" (all users) and
  "currency reserve" (ARS + permission). The manual "initial reserve" field was removed — savings
  are computed, not entered. Investment currency locks while an FX goal is active.
- Notifications: `checkMetaPropia` (milestones over accumulated savings, from the cron's recent-
  movements read) and `checkMetaFX` (milestones over the reserve, with count()-cache), replacing
  the single `checkMeta`.

### Changed
- **Navbar reorder**: Investments moved to 4th position (after Reports).
- `showAhorros` is again a user toggle gating the whole Investments tab (off ⇒ tab hidden from
  the navbar; goals are preserved, only hidden). The FX reserve (net worth, saldo, FX goal,
  history) is gated separately by ARS + investment permission.
- FX history (USD/EUR) moved out of the main list into a bottom-sheet panel opened from a header
  icon; the reserve "+" now lives inside that panel (elsewhere the reserve is loaded from Home
  shortcuts). The always-on floating FAB was removed.
- `changeMoneda` no longer forces `showAhorros=false` for non-ARS currencies — EUR/USD users can
  keep the tab.
- Config migration: legacy `metaMonto`/`metaMoneda`/`metaFecha` are read into `metaFX` in-memory.

### Fixed
- **Savings rate no longer exceeds accumulated savings.** The per-period rate summed gross savings
  without subtracting what was moved back to disponible, so it could read higher than the total.
  It now averages the net delta of `ahorrosAcum` between periods (best/weakest period use the same
  delta), consistent with the hero figure.

## [2.88.0] — 2026-07-16

### Changed
- **Google Sheets sync is now manual, not automatic**: the cron no longer syncs on its own — it only pushes a reminder when the last backup is over 30 days old (deduped monthly). In Settings → Data, a **"Sync now"** button appears when the backup is stale (over 30 days, or never). The app trusts Firestore; the sheet is an occasional backup you trigger yourself.

### Added
- **Self-healing sheet**: if the spreadsheet no longer exists (404 — deleted, or a stale ID), the sync **creates a new one**, stores its ID in Firestore (`syncMeta.spreadsheetId`), shares it with the owner's email, and does a full sync into it. The active ID now comes from Firestore (env as fallback), and the data tab is resolved by title ("Movimientos") instead of a fixed GID — robust to a recreated sheet.

---

## [2.87.0] — 2026-07-16

### Added
- **Reminders card on Home**: the Reminder shortcut now opens a card that shows the **next reminder due** as a hero (calendar icon, urgency colour — red overdue, yellow today/tomorrow, teal later) plus a compact form to add a new one. To see all reminders, Settings → Notifications.
- **Year Wrapped notification**: on Dec 31 the cron sends one push announcing the annual recap is available (deduped per year, only if the user has movements that year). New `wrapped` notification type with its own icon in the tray.

### Fixed
- **"Forgotten entry" reminder went silent for good**: its dedup keyed off the last movement's timestamp — which doesn't change while you're not logging — so it warned once at 3 days and never again, exactly when it mattered most. Now it re-warns every ~3 days while you keep not logging (cadence keyed off the last notified day, resets when you log).
- **Year Wrapped couldn't show in January**: `wrappedYears` had a "December only" gate inside, which made the Jan 1–5 half of the year-end window (added in 2.86.0) dead code. The gate now lives only in the caller.
- **Recurring items and reminders no longer depend on `config/meta`**: they were inside an `if (config)` block, so a missing config doc silently skipped them; they live in their own collections.

### Changed
- **Home's KPI is the same inflation metric as the Periods card** (average change across periods), reverting 2.86.1's per-period delta at the user's request — both cards now genuinely show the same thing, with matching copy.

---

## [2.86.1] — 2026-07-16

### Fixed
- **Home and Reports were showing the same number with contradictory labels**: both called `inflacionPersonal` (the average change across *all* periods), but Home's copy claimed it was "vs the previous period" — which was false, hence the two cards always matching. Home now uses a new `variacionGastoVsAnterior`: the **current period vs. the whole previous one** (the immediate read), while Reports keeps the historical average. Home's KPI is relabelled **"Gasto vs anterior"** (calling a single-period delta "inflation" was misleading) and its explanation warns the value starts negative early in a period. Five tests cover the new function.

---

## [2.86.0] — 2026-07-16

### Fixed
- **Inflation (CPI) restored — it was CORS**: argly's API returns 200 but without an `Access-Control-Allow-Origin` header, so the browser blocked the direct fetch (silently). Now it goes through our own `/api/ipc` route (server-side, no CORS, cached 6h) and the client hits same-origin. Bumped the localStorage cache key to invalidate stale/broken caches. Added a `console.warn` in the catch so a future breakage isn't silent.

### Changed
- **Home shortcuts are now real quick-adds**: New movement · **Currency** (opens the reserve/FX modal, shown only for ARS users with investing on) · **Reminder** (opens a quick reminder card right there — text + date — instead of going to Settings; calendar icon, teal, to not clash with notifications).
- **/analisis renamed to "Análisis"** (was "Filter & compare") and its back button returns to **Reports** (it's advanced reports now).
- **Reports header**: Wrapped moved to the left and only shows in the year-end window (Dec 26 – Jan 5). Removed the "Top 5 descriptions" block (the in-place filter in Movements covers it, saving screen space).
- **Filtered day total**: when a filter is active and a day is open, the day's total shows on the right in the type's color (red expense, green income, etc.).

---

## [2.85.1] — 2026-07-15

### Changed
- **Recurring reminders now follow a 25 / 28 / weekly schedule**, wired into the cron. Reference date = last matching entry, or the recurring item's `createdAt` if it was never logged (so a brand-new recurring item reminds ~25 days after you created it). Day 25 = heads-up, day 28 = due, then weekly until you log it; logging resets the cycle. Dedup moved to `notifyMeta.recReminders[id] = {ref, lastNotified, stage}` (replaces the old last-date dedup and the "muted once a month" branch). Logic is the tested pure `shouldRemind` (utils/recurrent-reminder). Lookback window raised to 40 days.

---

## [2.85.0] — 2026-07-15

### Added
- **Templates for Income too, and without an amount**: templates now work for Income (not just expenses) and can be saved with no amount (category is enough — the amount is filled in when applied). Each type shows its own templates. `Plantilla` gained `tipo` and made `monto` optional.

### Changed
- **Owner salary entry is streamlined**: for the owner, logging a Salary hides the description and payment-method fields (fixed to "Sueldo" / "Débito"), keeps notes free, and drops the recurring option — a salary is always a salary.
- **Savings origin is a single scrollable row** ordered by most used (was a wrapping two-row block in alphabetical/creation order).
- **Unified recurring-item key** (`utils/recurrent-key.ts`): the doc id, the client clock icon and the cron now derive the identity from the *same* normalization (type + category + description + note), so a recurring item never matches too much or too little at the edges (empty note, special chars). The "repeat each period" checkbox is replaced by a **"Movimiento recurrente"** badge when the entry already matches one. Tests cover the ESO+/ESO Pass case.

### Internal
- Added `utils/recurrent-reminder.ts` (pure, tested 25 / 28 / weekly reminder logic) — not wired to the cron yet.

---

## [2.84.0] — 2026-07-15

### Changed
- **/analisis is now reached from Reports** (advanced reports): a sliders icon in the Reports header (next to Wrapped) opens it. The magnifier in Movements no longer navigates there.
- **Movements magnifier is now an in-place filter**: it opens an anchored popover (same mold as the notifications panel) with OR keyword pills + a live match preview. It filters the **selected period** in the same screen — the list narrows to the matches (e.g. "tolls"), all days expanded, with a summary card on top (terms + total / count / average, and a clear button). The header icon shows a badge with the number of active terms. Shared matching extracted to `utils/search.ts`.
- **Settings row icons unified to grey** (`var(--muted)`), matching the Guide row, instead of one color each.

---

## [2.83.2] — 2026-07-15

### Fixed
- **Dismissed gesture hints reappeared forever when switching tabs**: `useHint` tracked the dismiss in component-local state, which resets when the screen remounts, and the in-memory config never reflected the Firestore write — so the hint came back on every tab change. Added `patchConfigMeta` to `DataProvider` (which persists across tabs) and `useHint` now optimistically patches `hintsVistos` in memory on dismiss, so it stays gone.

---

## [2.83.1] — 2026-07-15

### Changed
- **Swipe between /analisis modes**: Compare / Trend / Share now swipe like the Reports subtabs (shared `SwipeTabs`), with the mode-selector indicator following the finger. Also gave the mode selector a sliding indicator instead of a hard background swap.

---

## [2.83.0] — 2026-07-15

### Changed
- **Gesture hints now persist in Firestore** (`config/meta.hintsVistos`) instead of localStorage, so they don't reappear after a reinstall. New `useHint(key)` hook (reads from the already-loaded config → no extra reads; optimistic dismiss + one small write). Retired `useFirstVisit`.
- **Hint copy reoriented to the discoverable gestures** (was describing "what the screen is"): Movements → "swipe a row to edit or delete", Reports → "swipe between tabs", Investments & Home → "tap the numbers" (shared `tapKpis` key, dismissed once for both). Added a hint on Home (non-classic dashboard, where the KPIs are tappable).

---

## [2.82.1] — 2026-07-15

### Fixed
- **Receipt upload "Failed to fetch" on edit**: the cold-start retry (Cloud Run scales to 0) only existed in the add flow, so editing a movement to attach an image could fail outright when the API was cold. Moved the network-error backoff into `uploadComprobante` so both add and edit retry; only network `TypeError`s retry, HTTP errors (403/413/415) fail fast. Removed the now-redundant double backoff in the add path.

---

## [2.82.0] — 2026-07-15

### Changed
- **Onboarding rebuilt as 6 interleaved steps** (setup + teaching, not just setup): Welcome+name → Currency/investing → **Salary + the *period* lesson** (the salary opens the period — taught right next to the input) → **Gestures** (swipe to edit, tap the numbers, swipe between Reports tabs — one idea each) → Security → **All set** (points to the full Guide). Removed the replay-tutorial flow (`?replay=1` and its button) — the full Guide covers everything now.

---

## [2.81.0] — 2026-07-14

### Changed
- **Guide rewritten as a full in-app help section** (Settings → Guide). Replaces the old 3-bullet stub with 6 accordion sections — How it works (the *period* model, available balance, salary anchor), Logging movements (types, templates, recurring, receipts), Savings & investment (Move, RESTO carry-over, auto-save, FX reserve), **Gestures** (swipe to edit/delete, swipe between Reports tabs, tap KPIs, tap charts, collapsible days, re-tap tab), Analyze & compare, and Handy settings. Content lives in `locales/guide.ts` (es/en); keeps the replay-tutorial button, changelog and version.

---

## [2.80.1] — 2026-07-14

### Fixed
- **Receipt picker showing behind the edit card**: since the edit view moved from a bottom sheet to a `CenterCard` (z-index 9999), the `ComprobanteChooser` (z-index 260) opened underneath it, breaking image/PDF attachment while editing. Raised the chooser to z-index 10001 (above the card and the media viewer).

---

## [2.80.0] — 2026-07-13

### Changed
- **/analisis rewritten around 3 comparison modes** (the old "2-periods → Δ%" comparison wasn't usable). Same keyword search (OR pills), now with a mode switch:
  - **Compare** (head-to-head): each group with total, average, count, a proportional bar and Δ vs the largest. Tap to select (color + chart). A **"Selected (N)"** stat shows the sum + share of the chosen groups.
  - **Trend**: one search over time with a real **grain** — by salary period, calendar month, or week (re-groups matches by date), plus period-by-period Δ.
  - **Share**: what you searched as a % of the period's **spending** (denominator = expenses only), with a per-period breakdown.
- **Group-by axis** (Compare): Auto / Description / Category / Note. In Auto with ≥2 pills, each searched term is its own group (e.g. AUSA vs AUBASA stay separate even under the same category); Note lets you compare observations within/across categories.
- **Free date range** (`📅 Range` sheet, from/to) alongside the period chips, applied across all modes.
- **Only pinned pills filter** now (the in-progress input no longer filters live, which caused residual results). The input shows a live preview — "N movements match · Enter to pin" — to confirm a term before pinning.

### Fixed
- **Charts always put the most recent point on the left** in Trend (was reversed) — matches the rest of the app.
- **Duplicate React keys / duplicated group rows**: groups are keyed by a normalized label (lowercase, trimmed, collapsed spaces, no accents), so text variants merge into one group.
- **Selection no longer resets to $0**: changing the group-by axis or removing a pill clears the stale selection.
- Removed leftover `text-transform: capitalize` on `Stat` labels (only used by /analisis).

---

## [2.79.2] — 2026-07-13

### Fixed
- **Open swipe row now closes on any outside interaction**: a movement row left open by the edit/delete swipe stayed open until another row was swiped. It now closes on any tap elsewhere or on scroll (global `pointerdown`/`scroll` listener while open), so it doesn't linger. Applies to Movements, Notifications and Home.

---

## [2.79.1] — 2026-07-13

### Fixed
- **Reports subtab width**: the active tab was narrowed by per-slide horizontal padding. The 16px gap now lives as flexbox `gap` *between* slides (compensated in the track's translateX), so the active screen uses the full width again — the separation only shows while swiping.

---

## [2.79.0] — 2026-07-13

### Added
- **Swipe between Reports subtabs** (`SwipeTabs`): the four subtabs (Expenses / Income / Movements / Periods) can now be switched by swiping horizontally, not only by tapping the pills up top. All four screens are mounted side-by-side in a track so navigation just slides — content is preloaded, no re-mount, fluid. Details:
  - Drag follows the finger with edge resistance on the first/last tab; snaps on release past a 22% threshold.
  - Anti-carousel guard: a swipe that starts on a real horizontal scroller (the category/period pill strips) with room to scroll that way yields to that scroll instead of changing tab — checked via `overflow-x`, so the track itself never counts.
  - The active-pill indicator is a sliding highlight that tracks the finger in real time (`onProgress`).
  - Inactive slides collapse (`max-height: 0`) so the track takes the active tab's height — no empty gap under shorter tabs; the neighbour expands while dragging so it peeks in with a 16px gap.

---

## [2.78.0] — 2026-07-13

### Changed
- **Movement edit is now a card (not a bottom sheet)**: editing opens a `CenterCard` matching the detail card's look, with a "‹ Detalle" back button to return to the read-only detail in the same visual style. The add flow stays a bottom sheet (too much content for a card).
- **Detail card is read-only**: tapping a row shows the movement with no edit/delete actions. Edit and delete moved entirely to swipe gestures.
- **Swipe reveals two actions**: swiping a movement row left now reveals a pencil (edit → straight to the form, no detail step) and a trash (delete), on a neutral rail with neutral icons and slightly narrower buttons (46px). `SwipeToDelete` gained an optional `onEdit`; Notifications/Home keep the single-action (delete-only) behavior.
- **Reserve detail (from Investments) matches the movement detail card**: same hero (type icon on a color halo, big amount in the type color, date chip, FX quantity/rate fields), read-only.
- **Receipt in the detail card is a compact button** (like reserve) instead of an embedded image/PDF that stretched the card; tapping opens the full-screen viewer.

### Fixed
- **Cancelling a delete no longer kicks you to the list**: it returns to the detail card. Also fixed a flash where the edit form could momentarily show on open (default view is now `detail`, not `form`).

---

## [2.77.0] — 2026-07-13

### Added
- **Multi-device push**: `config/push` now stores a `subscriptions[]` array keyed by endpoint instead of a single `subscription`. `enablePush` merges the current device in (replacing only its own endpoint), `disablePush` removes only the current device (others stay active), and `sendPushToUser` fans out to all of them, returning `true` if at least one delivered. Dead subscriptions (404/410) are pruned in place; the legacy `subscription` field is read for backward-compat and cleared on the first write. New `readSubs` helper (unit-tested) unifies both shapes; `notifyAllUsers`' active-user filter accepts either.
- **Push subscription self-repair**: on app open (`DataProvider`), `syncPushSubscription` re-registers this device if it has permission + a local subscription whose endpoint isn't in Firestore (cleared doc, browser-recreated sub, device that lost its record). Replaces reliance on `pushsubscriptionchange`, which browsers fire unreliably. Costs 1 read; writes only when missing.

### Fixed
- **Silent recurring reminders that never fired**: a recurring template with no matching charge inside the ~35d lookback window had no "last charge" to dedupe against, so it stayed mute forever. It now notifies **once per calendar month** (`recRemindedMonth`) even when muted. Reminder body reworded to be valid whether or not there's a last charge.

### Changed
- **`recReminded` / `recRemindedMonth` are pruned** to currently-active templates, so the dedup maps don't grow unbounded in Firestore as templates are deleted.
- **In-app notification tray pruning uses `count()`** (1 aggregation read) instead of `.offset(30)` (~30 doc reads), and only reads the docs to delete when there's actually an overflow.

---

## [2.76.0] — 2026-07-13

### Fixed
- **Inflation/CPI feed restored**: the IPC source host changed — the app was hitting `www.argly.com.ar` (which now serves HTML, silently failing `.json()`), while the JSON API lives at `api.argly.com.ar`. Payload shape is unchanged (`{ data: [{ anio, mes, valor }] }`), so only the host was updated in `useInflacionIPC`.
- **Cross-device edits now refresh**: `useAllMovimientos` synced by document `count`, so a pure edit on another device (same count) stayed stale until the count changed. Added a `config/meta.movsRevision` counter bumped on every create/edit/delete (`bumpRevision` in `services/firebase/movimientos.ts`); the client compares it against its cached value — config is already read once per session, so the check costs no extra reads. On `revision > cached.revision` it forces a full re-fetch.

### Changed
- **"Inflation" KPI labels itself honestly when it's nominal**: on Home the KPI showed "Inflación" with a "adjusted by CPI" explanation even when the value was nominal (non-ARS user, or ARS with the CPI feed down — `deflatar` returns the raw amount). Now it reads **"Infl. nominal"** with the nominal explanation whenever `!(esARS && ipcDisponible)`. New i18n keys `inflation` / `inflationNominal`.

### Internal
- **Centralized API-route auth**: `verifyIdToken` + "Bearer" parsing was copy-pasted across 8 routes (`requireOwner` duplicated verbatim in 3). Extracted to `lib/auth-route.ts` (`requireUser`, `requireUserWithEmail`, `requireOwner`, each returning `uid | NextResponse`); all 8 routes migrated. No behavior change.

---

## [2.75.0] — 2026-07-13

### Added
- **Movement detail as a centered card** (`CenterCard`, portal + dim overlay): tapping a row now opens a floating card (not a bottom sheet) with a hero — type icon on a color halo + the amount as the protagonist in the type's color — meta chips (date / payment method / recurrent), and the receipt embedded (image thumbnail or PDF tile). Actions are centered: **edit (pencil only)** + a **borderless trash**. Edit switches to the form (with a "‹ Detalle" back button); the period-anchor salary shows no trash.
- **`SwipeToDelete` rewritten to shrink instead of push**: opening the row now reserves right-padding so the **content shrinks** and the trash appears in the gap — the text no longer slides off the card's edge, it reflows with its ellipsis. Trash is always on the right, only one row open at a time (opening one closes the other), and in Movements the observation is hidden while open so it doesn't collide with the trash. New optional `railBg` gives the trash its own tinted lane (`var(--red-dim)` in Movements) so a red trash doesn't clash with a red expense amount; Notifications omits it (each row is already a separate card).

### Changed
- **Home is now read-only**: tapping a movement in the latest-movements list opens the detail **without edit/delete actions** (new `detailReadOnly` prop) and the list has no swipe. To operate on a movement you go to Movements. Home rows keep their original two-line layout.
- **Notifications panel is now a popover anchored to the bell** (top-right), unfolding from it instead of rising from the bottom; width-capped, doesn't cover the whole screen. Closes on overlay tap / Escape / back.

---

## [2.74.1] — 2026-07-12

### Changed
- **Swipe-to-delete now works in both directions** and no longer stretches: the row follows the finger either way (clamped to the trash width, ~56px), and a compact trash icon sits fixed on the side you swipe toward (swipe left → trash on the right; swipe right → trash on the left). A second swipe or a tap on the open row snaps it closed. Replaces the previous left-only gesture whose reveal area grew with the drag. Applies to Notifications, Movements and Home's latest-movements list.

---

## [2.74.0] — 2026-07-12

### Added
- **Swipe-to-delete rows** (`SwipeToDelete`, shared component): sliding a row left reveals a fixed red trash button; tapping it triggers the action, tapping the open row (or sliding back) closes it. Gesture intent (horizontal vs vertical) is decided once per touch so it doesn't fight vertical scroll; `touchcancel` snaps closed; the ghost click after a drag is swallowed via `onClickCapture`.
  - **Notifications panel**: swipe no longer marks as read (that stays on tap and "mark all") — it now **deletes** the notification (`eliminarNotificacion`, which existed unused). Hint copy updated.
  - **Movements list and Home's latest movements**: swipe opens the existing delete confirmation (no direct delete — balances are involved). Tap keeps opening edit. Row background is applied only while displaced, preserving the card gradient at rest.

### Removed
- **Horizontal swipe between tabs** (`useSwipeNav` deleted, dead `data-no-swipe` attributes cleaned from modals): it conflicted with per-row gestures and was blocking native-feel improvements (user decision). `SwipeNav` keeps per-tab scroll restoration and the fade transition.
- **Delete via long-press** on movement rows (Movements and Home), replaced by swipe-to-delete; `useLongPress` deleted (no remaining users). The anchor-salary guard is unaffected (it lives in the modal, which forces the edit view).

---

## [2.73.1] — 2026-07-12

### Fixed
- **Overdue one-off reminders were unrecoverable**: `checkRecordatorios` queried `fecha >= today` but the final-notice branch requires `fecha <= today`, so only `fecha == today` ever matched — if the push failed that day (or the cron didn't run), the doc was kept for retry but the next day's query excluded it forever. The query now reads the whole collection (it only holds pending reminders; the final notice deletes the doc), so overdue reminders retry until confirmed.
- **Dollar check violated the 2.71.0 dedup rule**: the baseline (`lastDolarOficial`) re-anchored even when the push send failed, silencing that price move forever. It now re-anchors only on a confirmed send (extracted to `checkDolar`). Same for the version push: `lastVersionNotified` advances on failed minor/major sends only after a confirmed send (patches still advance silently by design).
- **A throwing check could drop the dedup flags of pushes already sent** (the inverse of the 2.71.0 bug: duplicates instead of silence): `notifyUser` accumulated all flags in memory and wrote them once at the end, so an exception in a later check lost earlier flags and the next cron run re-sent. Each check now runs under its own catch, flags persist in a `finally`, and `lastDailyRun` closes the day only when no daily check failed (a failed check retries on the next run; confirmed ones don't repeat).
- **The "Cargar" action button on the recurrent push opened a blank add modal**: the shared `CARGAR_ACCION` pointed to `/movements?nuevo=1`, overriding the prefill deep-link that the notification body used. The action now targets the same destination as the body (prefilled when a single recurrent is pending).
- **Case-sensitive recurrent template ids**: matching was lowercase everywhere but the doc slug wasn't, so loading "Steam" one month and "steam" the next created two templates that both matched the same movements (duplicate list entries, "2 pending" pushes, lost prefill deep-link). The slug now trims + lowercases description and observation, aligning with the matching key.
- **Stale recurrent notification could cause a duplicate load**: tapping an old notification from the in-app tray (kept up to 30, no expiry) opened the prefilled add modal with no signal that the cycle was already loaded. The modal now shows a warning banner ("Ya lo cargaste hace N días") when a matching movement exists within the last 28 days.
- **Deep-link to a deleted recurrent did nothing** and left `?recurrente=` in the URL; it now falls back to a blank add modal and cleans the URL.
- **Recurrent push tag was per-month** (`rec-YYYY-MM`), so a second recurrent alerting later the same month replaced the first in the OS tray; the tag is now per-day.
- **`?m=` deep-link cleanup wiped the App Router history state** (`replaceState(null, …)`); it now preserves `window.history.state` like the sibling effects.

### Added
- `recurrentesLoaded` flag in the data context, distinguishing "not fetched yet" from "user has none" (needed by the deleted-recurrent fallback).

---

## [2.73.0] — 2026-07-11

### Added
- **Unified page headers**: new `PageHeader` (3-column grid) with the title centered in **Fredoka** (rounded Google Font, self-hosted via next/font, in line with the logo's Arial Rounded), uppercase with wide tracking and the brand gradient. Side slots hold per-screen actions: Home (bell right, period days as a centered subtitle under the title), Movements (analysis lens right), Reports (Year Wrapped right), Investments/Settings (title only). Replaces `PageTitle` (deleted). New `DiasPeriodo` component (days elapsed in the current period, no label).
- **Auto-repeat on add**: if the type+category+description+observation being entered matches an **active recurrent**, the "repeat each period" toggle turns on by itself (it only turns on — never off, so a deliberate unmark for a one-off isn't fought) and shows an "already set" chip. No more re-ticking the toggle every month.
- **Recurrent indicator in edit/detail**: editing or viewing a movement that matches an active recurrent shows a "Recurring movement" banner/chip, beyond the clock badge in the list.

### Changed
- **Investments**: single eye toggle (Patrimonio card); the redundant ones on the USD/EUR reserve cards were removed (the toggle is global anyway).

### Removed
- **Share backup** button and its `navigator.share` logic (it never worked reliably across devices). Backup remains as the JSON download.

---

## [2.72.0] — 2026-07-11

### Added
- **In-app notifications panel**: a bell in the Home header (with an unread badge) opens a BottomSheet listing the notifications the app has sent. Every confirmed push is now also persisted to `users/{uid}/notificaciones` with its deep-link (`lib/notif-store.ts` wraps `sendPushToUser`, so the dedup-only-on-success behaviour from 2.71.0 is preserved). The tray is capped at 30 (oldest pruned on write). Badge count is read once on mount (getDocs, battery-friendly) and refreshed when the panel opens.
  - **Per-type deep-links**: dollar → investments, version → in-app changelog (`/settings/help?changelog=1`), recurrent → prefilled add modal, salary/forgotten-load → add modal, savings goal → investments, reminder → movements, permission → settings, sheet sync → data, account-deletion → admin.
  - **Interactions**: tap a notification to navigate to its destination and mark it read; **slide** it horizontally to mark read without navigating; "mark all" clears the unread badge.
- **Recurrent → prefilled add**: the recurrent notification deep-links to `/movements?recurrente=<id>`, which opens the add modal pre-filled with the recurrent's type/category/description/observation (**amount left blank**, since recurring prices change). New optional `prefill` prop on `MovementModal`.

### Fixed
- **Recurrent clock badge ignored the observation**: the movements list marked any movement matching a recurrent by type+category+description, so a different movement sharing a description (e.g. "Steam·eso pass" vs the recurrent "Steam·eso+") showed the recurrent clock even though it was never saved as recurrent. The badge key now includes the observation, matching the recurrent identity introduced in 2.71.0.

---

## [2.71.0] — 2026-07-11

### Fixed
- **Push reminders could silence themselves forever after a single transient send failure** (root cause of a missed salary reminder while dollar/version pushes kept working). `sendPushToUser` swallowed every error, so a failed send still fell through to the dedup write (`sueldoRemindedFor`, `recReminded`, `cargaRemindedFor`, `metaHitos`) — marking the user as "already notified" for a notification they never received. Now `sendPushToUser` **returns whether the send was confirmed**, and every check persists its dedup **only on success**, so a transient failure retries the next day instead of being lost. It also **retries twice with backoff** (0/1.5s/4s) on non-404/410 errors, reusing the already-read subscription so there's **no extra Firestore cost**.
- **One-off reminders were deleted even when their push failed**, losing them silently; now the reminder doc is deleted only after a confirmed send (pre-reminder `avisadoPre` likewise flagged only on success).
- **Ingresos detail (Reports) wasn't sorted by date** — `movIngresos` sorted by amount, so dates appeared out of order (30/6, 9/7, 30/6). All three income lists now sort by date descending (newest first) via string compare on `YYYY-MM-DD`.

### Changed
- **Recurring movements now key on observation too** (`tipo+categoría+descripción+observaciones`). Two movements with the same description but different observation (e.g. `Steam·eso+` vs `Steam·eso pass`) are now independent recurrents — one no longer resets the other's reminder clock. Backend match, doc slug, the movement modal, and the Notifications list are all aligned; recurrents saved without an observation still match observation-less entries.
- **Datos moved out of the main Settings menu into Account** as a sub-item (Google Sheets · Backup · Invitations), reachable from within Cuenta.
- **`/analisis` day detail no longer inlines observations** (they were unreadable, truncated). Tapping a day (chat icon) opens a floating sheet with observations grouped by text (each with `×N` and its subtotal, plus the day total).

---

## [2.70.0] — 2026-07-11

### Added
- **`/analisis` v2 — Filter & compare**: the magnifying-glass in the Movements header opens a client-side screen to filter movements by loose keywords and compare their evolution across periods.
  - **Keyword pills**: type a word and confirm with the `+` button (or Enter) to pin it as a pill; multiple pills match with **OR**, so unrelated things (e.g. tolls + fuel) can be compared side by side. Matching is **exact-word** over category + description + observations, so `car` matches the category *Car* but not `recarga`/`carga`.
  - **Grouping**: results are grouped by description; each row shows count and distinct days, with a per-day detail (same date summed as `×N`) that includes the year and any observación.
  - **Multi-line chart**: shows the **total** by default; tapping a group breaks it out as its own colored line to see which one grows more. Unselected rows are neutral grey; selected rows light up with a distinct color assigned by selection order — the first six are brand colors, then generated via the **golden-angle** so colors never repeat, however many groups you select.
  - **Manual period selector**: tap period chips to narrow the window. Selecting exactly **2 periods** turns each group row into a direct comparison (`older → newer` with the Δ%, red when spending rose, green when it fell) — no separate table, no extra scroll.

### Changed
- Charts gained a reusable `MultiLineChart` (recent-left, y-scale from 0) in `components/reports/charts.tsx`.

---

## [2.69.2] — 2026-07-09

### Changed
- **LockScreen polish**: shows the app `Loader` while the biometric check runs (previously the button only dimmed) and renders the logo from the 1024px master for a crisp 84px downscale. The OS fingerprint prompt itself is drawn by Android/Chrome via WebAuthn and cannot be styled or intercepted from the web — that's a deliberate security boundary, unlike the receipt chooser, where we bypass the OS "pick a source" dialog rather than capture it.
- `Loader` gained an optional `color` prop (overrides the brand blades via `--fm-ring-c1/2/3`), needed where the brand gradient has no contrast — e.g. the unlock button, which *is* that gradient.

---

## [2.69.1] — 2026-07-09

### Fixed
- **`/analisis` evolution chart had the most recent period on the right**: the app convention is most-recent-on-the-**left** (Reports uses `serieDesc`). The evolution series was chronological (reversed); dropped the reverse so it renders newest→oldest, left to right, matching the rest of the app.

---

## [2.69.0] — 2026-07-09

### Added
- **Advanced filter & compare (`/analisis`)**: a new on-demand screen (search icon in the Movements header, not a bottom-nav tab) to slice movements and see their evolution across periods. 100% client-side over the in-memory movements.
  - **Text search** over observación + descripción + categoría, matched **by words** (all words must be present, any order) so "aubasa dock sud" finds a note with those words apart.
  - **Category filter as a search combobox** (type to filter; picked ones show as removable tags) instead of a long always-visible list.
  - Results **grouped by description** (e.g. "Peajes" as one row: total + count); tapping a group opens the **per-day detail**, where same-date entries are **summed** ("×N") to avoid an endless list, inside a capped-height scroll.
  - **Total + count + evolution area chart** by period.
  - Dates shown **with year** (d/m/yy) since this view has no period selector and history is nearing a full year (dates would otherwise repeat/ambiguate).

---

## [2.68.0] — 2026-07-08

### Removed
- **All haptics (`navigator.vibrate`)**: never fired reliably on the target device, so removed from save/edit/delete (`buzz` + the `saveFeedback` pref and its Preferences toggle), tab tap (`BottomNav`), long-press (`useLongPress`) and the double-back toast (`BackExitToast`). The **new-item highlight** (`flash-row`) stays and is now always on (no longer gated by the removed pref).
- **Share-target ("share to FinMoves")**: it never registered in Android's share sheet and won't be used. Removed the `share_target` from the manifest, the best-effort parser (`utils/share.ts` + tests) and the `prefill` prop/plumbing in `MovementModal` / movements page. The `?nuevo=1` launcher shortcut and push "Cargar" deep-link are unchanged. (The "Compartir backup" Web Share in Settings › Datos — a separate, working feature — stays.)

---

## [2.67.1] — 2026-07-08

### Fixed
- **Receipt upload failing with "Failed to fetch" on the first try (cold start)**: the API's Cloud Run scales to zero (`minInstances: 0`), so the first `POST /api/comprobantes/upload` after an idle period hits a cold instance and the connection is dropped mid-cold-start. `subirComprobante`'s retry was a single immediate attempt, which usually hit the still-cold instance too. Now it retries with backoff (0 / 1.5s / 4s), giving the instance time to wake — the upload recovers on its own without surfacing an error. The "Reintentar" sticky toast remains as the last-resort fallback.

---

## [2.67.0] — 2026-07-07

### Changed
- **New app loader** (`components/ui/Loader.tsx` + `.fm-ring` in globals): two counter-rotating brand-gradient "blades" (blue / cyan / green via `border-*-color`) used everywhere a spinner appears — `LoadingSpinner` (blades around the FM logo), `SyncIndicator`, and the save buttons (movement / investment / auto-savings). Replaces the previous single spinning ring + the small `stroke-dasharray` SVGs.
- **Reduce-motion safe**: the loader rides the `.spin` class, which is the one animation explicitly exempted from `prefers-reduced-motion` in globals — so it keeps spinning on devices with reduced-motion / battery-saver enabled (where the earlier custom keyframes and SMIL froze). Added `.fm-ring` to that exemption too.
- `LoadingSpinner` gained an opaque `var(--bg)` backdrop (no white flash before the theme paints) and renders the logo from the 1024px master (`/logo-fm-1024.png`) for crisp downscaling.

---

## [2.66.1] — 2026-07-07

### Fixed
- **Floating "+" button and modals mis-positioned after the v2.66.0 tab swipe**: the ViewPager finger-follow put a persistent `transform` + `will-change: transform` on the `SwipeNav` container, which turns it into the containing block for its `position: fixed` descendants — so the FAB anchored to the page bottom/top instead of the viewport, and non-portaled fixed overlays shifted. Reverted the finger-follow (and the directional slide-in): tab swipe again commits on `touchend` with no container transform. **Kept** the two safe wins: **scroll position restored per tab** and the neutral `tabFade`.
- **Battery drain from a permanent Firestore realtime listener**: `useSyncError` used `onSnapshot` on `config/syncMeta`, and since `BottomNav`/`SideNav` are mounted the whole session it kept a live Firestore connection open continuously (the rest of the app uses one-shot `getDoc`). Replaced with a `getDoc` on mount + on `visibilitychange`, and gated to the owner (the only user with Sheets sync) — non-owners no longer read it at all. Removing the only live listener lets Firestore go idle when not actively reading. (`will-change` removal above also drops a permanently-promoted full-page GPU layer.)
- **Save vibration too short to feel**: bumped the success tick from 10ms to 30ms (10ms is below the perceptible threshold on many phones). Timing was already fixed in v2.65.0 (fires synchronously within the gesture); depends on the device having system haptics enabled.

### Notes
- **Share target not appearing in Android's share sheet** is an OS-registration issue, not code: `share_target` only registers for an **installed** PWA, and an install that predates it keeps the old manifest. Reinstalling the PWA registers it. The manifest is correct and the in-app parsing (v2.66.0) is ready.

---

## [2.66.0] — 2026-07-07

360-audit Level 3 (projects #2, #3, #6): share-target prefill, ViewPager-style tabs, sync indicator + Web Share.

### Added
- **Share-target prefill (Mercado Pago & co.)**: sharing text to FinMoves now best-effort parses an amount and a description and pre-fills the add modal (`utils/share.ts` + `parseShareMovimiento`, 7 tests). Handles AR number formats (`$1.234,56`, `50.000`), a payee after "a/para", and ignores URLs. `MovementModal` gained an optional `prefill` prop applied on open. The format from MP isn't documented/stable, so it fills what it can and the user confirms.
- **ViewPager-style tab swipe**: the current tab now **follows the finger** during a horizontal drag and, past ~28% width, slides out while the destination tab slides in **from the correct side** (`slideInLeft`/`slideInRight`). Rewrote `useSwipeNav` to drive an inline transform on the `SwipeNav` container with a horizontal-lock (non-passive `touchmove` + `preventDefault`) that still lets vertical scroll through; preserved all guards (hidden tabs, `[data-no-swipe]`, horizontal-scroll ancestors, iOS edge gesture, open modals). Note: because each tab is its own route (only the active one is mounted), the destination isn't visible until commit — a true dual-pane pager would need the single-route rewrite we deliberately avoided.
- **Scroll position restored per tab**: `SwipeNav` saves `window.scrollY` per pathname on leave and restores it on return (covers both swipe and bottom-nav), like a native bottom-nav app.
- **"Sincronizando…" indicator**: a lightweight, **read-cost-free** chip shown while there are movement writes in flight and the device is online (`lib/sync-status.ts` counts in-flight writes — with local persistence a write's promise doesn't resolve until the server acks; `useSyncStatus` + `SyncIndicator`). The offline case stays covered by `OfflineBanner` (the chip requires online, so they never overlap).
- **Web Share for the backup**: Settings › Datos now offers "Compartir backup" (`navigator.share` with the JSON `File`) where supported, falling back to download.

### Changed
- `crearMovimiento` (client) replaced by `crearMovimientoConId`/`nuevoMovimientoId` in the modal path (from v2.65 optimistic add); movement writes are now wrapped in `trackWrite` for the sync indicator.

---

## [2.65.0] — 2026-07-12

360-audit Level 3 (first two projects): optimistic add + onboarding that opens the first period.

### Added
- **Optimistic movement creation**: `handleAdd` now pre-generates ids (`nuevoMovimientoId`), prepends the item and closes the sheet **synchronously**, then persists in the background (`crearMovimientoConId` in parallel via `Promise.all`) — no more 1–3s spinner waiting on the server ack. On a write failure the optimistic items are rolled back (`onDeleted`) and a transient error toast is shown. The receipt is **uploaded in the background and patched in** (`onUpdated`) once done; if the upload fails it retries once and then surfaces a **sticky toast with "Reintentar"** that keeps the `File` in memory, so the photo is never silently lost.
- **Onboarding step 4 — optional salary**: a skippable "what's your salary?" step; if filled, `finish()` creates the `Ingreso/Sueldo` for today via `crearMovimiento`, opening the first period so the dashboard has data on day 1 instead of the empty state. Failure to create it doesn't block finishing onboarding.

### Fixed
- **Haptics never fired (all three events)**: `navigator.vibrate` requires a live user activation, but the `buzz()` calls sat *after* an `await` (server round-trip), so the activation was already gone. The vibration is now issued **synchronously** within the gesture — before any await — on add (already synchronous after the optimistic rewrite), edit (right after amount validation) and delete (at handler entry).

### Changed
- **`fechaAPeriodoId` extracted to `utils/periodo.ts`** (was a local helper inside `MovementModal`) so onboarding and the modal share one implementation.
- Removed the add-button loading spinner state (`addLoading`) — the optimistic flow closes instantly, so there's nothing to wait on.

---

## [2.64.0] — 2026-07-12

360-audit Level 2: the polish package (feedback, native feel, accessibility, correctness) in one batch.

### Added
- **Save feedback ("tick"), toggleable**: `navigator.vibrate(10)` on successful add/edit/delete of a movement (and an error buzz on failed add), plus a `flash-row` background pulse on the just-created row in the movements list (`handleCreated` tracks the new ids for ~1.4s). Closes the previously silent save loop. Gated by a new device-level pref `saveFeedback` (default on) with a toggle in Settings › Preferences — controls both the vibration and the flash.
- **Tests (39 → 46)**: `serieTendencia` (seed anchoring, no-seed window, withdrawal clamp to 0), `calcularReserva` (sale bigger than reserve → negative total, cost clamped to 0), and `inflacionPersonal` (nominal average, deflation applied, <2 periods → null).

### Changed
- **Personal inflation unified across Dashboard and Reports**: extracted `inflacionPersonal(periodos, deflate?)` into `utils/reportes.ts` and both screens now call it — same formula (average of period-over-period *real* variations of pure spending, deflated by IPC in ARS). Previously the dashboard showed the last deflated variation while Reports showed the average nominal one, which could even disagree in sign.
- **Fonts self-hosted via `next/font`** (Inter + IBM Plex Mono) instead of a render-blocking Google Fonts `@import` — no external request, no FOUT on cold start. Exposed as `--font-inter`/`--font-plex-mono` CSS vars.
- **`--muted` darkened for contrast** (`#5a7090` → `#6e84a6`): the 9–11px metadata everywhere now clears WCAG AA on `--bg`.
- **Update banner logic implemented as documented**: the previously-dead `esMinorOMajor` gate now works — the banner shows only on MINOR/MAJOR version differences, or when the server marks the release required (`REQUIRE_UPDATE`, which was being ignored). Patch-only diffs update silently on next cold start.
- **Receipt attach/PDF icons are now SVG** (paperclip + document) instead of 📎/📄 emoji, matching the app's stroke-icon language.
- Payment-method chips in the edit form already fixed in 2.63.2; this release adds `:active`/`:pill` press feedback (`.pill:active` scale, `.row-tap` opacity) and 32px hit-areas for the receipt × badge and the hide-values eye.
- **Install banner localized** (`installTitle`/`installBody`/`installAction`, es/en) and its broken `var(--accent)44` border replaced with `color-mix`.

### Fixed
- **Safe-area bottom on `UpdateBanner` and `InstallBanner`**: `env(safe-area-inset-bottom)` added so they don't sit under the gesture nav bar (matching `BackExitToast`).

---

## [2.63.2] — 2026-07-12

360-audit round 1: the six Level-1 findings (3 high-severity calculation bugs + security + SW + UX) fixed in one pass.

### Fixed
- **Editing a movement now validates the amount** (`MovementModal.handleEdit`): clearing the field persisted `parseFloat("") = NaN` to Firestore, breaking every KPI of the period ("Disponible $NaN"); negative amounts were also accepted. Now rejects with `errInvalidAmount`, same as the add flow.
- **FX gain no longer counts the base balance as pure profit** (`investments/page.tsx`): `saldoUSD`/`saldoEUR` entered the valued amount but not the cost basis, inflating the gain (e.g. base 1,000 USD + one 100 USD purchase showed ~+1000%). Gain is now `boughtAmount × (rate − avgCost)` — only what was purchased through the app, both USD and EUR.
- **VentaEUR/GastoEUR showed the USD rate while computing with the EUR rate** (`MovementModal.tsx` exchange-rate input): the default now keys off `fxLabel === "EUR"`, matching `cotizActual` exactly — displayed and applied rate can no longer diverge.
- **Receipt-upload permission read the wrong doc** (`api/comprobantes/upload`): it checked user-writable `config/meta` instead of the Admin-SDK-only `config/permisos` — a self-escalation hole AND a functional bug (users granted via the admin panel couldn't upload). Also replaced the `image/*` filter with an explicit whitelist (jpeg/png/webp/pdf) — SVG (active content) no longer accepted.
- **Service worker no longer caches error responses**: all three `cache.put` sites now check `res.ok` first — a 500/404 during a deploy could previously be cached and served as the offline fallback forever.
- **Edit form payment methods were hardcoded** (`["Mercado Pago","Débito","Efectivo"]`): now uses the user's configured `mediosPago` like the add form, keeping the movement's current method visible even if deactivated.
- **Move submit button enabled without an amount** (`canSubmit`): Move now requires `monto > 0` like every other type, instead of inviting a tap that errored.
- **Move pill gradient hardcoded `#0e1524`** — broke in light theme; now `var(--surface)`.

---

## [2.63.1] — 2026-07-12

### Changed
- **Receipt chooser redesigned as an anchored floating card** (user feedback on v2.63.0): instead of a full `BottomSheet`, tapping 📎 now opens a compact popover anchored to the clip's `getBoundingClientRect()` (portal to body, transparent backdrop for outside-tap dismiss, positioned above the button or below when near the top). Icons only — no per-row labels — all in the same color (`--blue`), with the "Adjuntar comprobante" caption in its original capitalization (no more `toLowerCase()`). Back button still closes it first (`useModalBack`).
- **Removed amount autofocus in the add-movement modal**: opening the modal (and switching movement type) no longer focuses the amount input, so the keyboard doesn't pop up on its own. Dropped `montoRef`/`reserveRef`/`focusMonto` and the 420ms focus timer.

---

## [2.63.0] — 2026-07-12

### Added
- **Custom receipt attachment chooser (iOS-style action sheet)**: tapping 📎 in the movement modal now opens an app-styled `BottomSheet` (`components/movements/ComprobanteChooser.tsx`) with three grouped rows — **Cámara** (direct camera via `capture="environment"`), **Galería** (`image/*`) and **Archivo** (`application/pdf`) — replacing the unstylable OS picker. Three dedicated hidden inputs live outside the sheet so they stay mounted while the system dialog returns; input value is reset after selection so the same file can be re-picked. Rows use the settings icon-box pattern (`--blue`/`--green`/`--accent` dims). New locale keys `chooserCamera`/`chooserGallery`/`chooserFile` (es/en). Back button closes the chooser first (it registers with the back dispatcher via `useModalBack` like any sheet).

---

## [2.62.0] — 2026-07-12

### Changed
- **Double-back-to-exit enabled for everyone; flag, owner toggle and debug HUD removed.** Confirmed working on-device (all 4 cases, including the cold `cancelable=false` back on Home). The gate is now **Navigation API availability** instead of the `fmDoubleBack` localStorage flag: on Chromium/Android the dispatcher owns the back button (modal → close, subpage → parent, non-Home tab → Home, Home → toast + double-back exit) and modals register with it; on iOS Safari/Firefox everything stays as before (classic `useModalBack` history entries + native back). Removed `components/nav/BackDebugHud.tsx`, all `dbgLog` instrumentation and the owner-only Preferences toggle. Toast copy localized (`pressBackAgainToExit` in es/en).

---

## [2.61.1] — 2026-07-12

### Fixed
- **Double-back (flag-gated): handle non-cancelable back traversals — the missing Home toast.** On-device logs showed modal-close, subpage→parent and tab→Home all working under the Navigation API engine, but the back on Home exited silently. Cause: Chrome only makes `traverse` navigate events **cancelable with recent user activation**; a "cold" back (no touch since landing) arrives with `cancelable=false` and the handler's early `if (!e.cancelable) return;` — placed *before* any logging or the toast — swallowed the event. The Home branch never needed to cancel (the traversal is deliberately allowed to fall into the backroom), so the guard was pure loss. `hooks/useBackDispatcher.ts` now logs first (with `canc=` in the HUD line), cancels only when possible, and compensates when it can't: modal → close + re-arm backroom after the traversal lands; non-Home tab → `replace(HOME)` runs anyway after the uncancelable traversal; Home → toast always fires.

---

## [2.61.0] — 2026-07-12

### Changed
- **Double-back rebuilt on the Navigation API (flag-gated).** Abandoned the `popstate`/history-trap engine after ~7 failed attempts — it fought Next's non-removable internal popstate listener and fired *after* the traversal already committed (on-device HUD proved the trap armed but the Home back exited without ever firing `popstate`). `hooks/useBackDispatcher.ts` now uses `window.navigation` (Chromium/Android Chrome): the `navigate` event for a back `traverse` fires **before** the traversal and is cancelable, so `preventDefault()` reliably stops it — no blind history padding. Decisions by current path: modal → cancel + close; subpage → allow (natural back to parent); non-Home tab → cancel + `replace(HOME)`; Home → toast + let the traversal fall to a maintained "backroom" entry so the next back exits (double-back). A `backroom` entry is kept below root tabs (skipped during the 2s exit window) so the Home back is interceptable rather than closing the PWA outright. Falls back to native back where the Navigation API is absent (iOS Safari/Firefox). Still behind `fmDoubleBack` + the debug HUD.

---

## [2.60.2] — 2026-07-12

### Fixed
- **Double-back (flag-gated): defer all history mutations out of the `popstate` handler.** On-device HUD logs proved the trap marker survives (`nowArmed=true`), `replace(HOME)` from a non-Home tab works, but the back on **Home exited the app without ever firing `popstate`** (no log between arming the Home trap and the relaunch). Root cause: mutating history **synchronously inside** the `popstate` handler (`router.replace`, `armTrap`, `history.back`) is unreliable — the browser is mid-traversal and Next's own popstate listener (not removable) races ours. All three are now deferred via `setTimeout(0)` so they run after the pop settles. Added `pagehide`/`pageshow` logging to `hooks/useBackDispatcher.ts` to capture the exact `history` state at app-close if it still misbehaves. Still behind `fmDoubleBack` + HUD.

---

## [2.60.1] — 2026-07-12

### Added
- **Double-back diagnostics HUD (flag-gated, owner-only)**: on-device debug overlay to find why the double-back exits Home without the toast. `lib/back-dispatcher.ts` gained a `dbgLog`/`getDbgLog`/`clearDbgLog` ring buffer **persisted to localStorage** (`fmDBLog`) so it survives the PWA closing — reopening shows what happened on the last back. `hooks/useBackDispatcher.ts` now logs every arm, every `popstate` (with `history.length`, `armed`, `modal`, `path`) and the branch it took (`arm push … nowArmed=`, `-> toast`, `-> replace(HOME)`, `-> SALIR`, etc.). New `components/nav/BackDebugHud.tsx` renders the log + live `history` state; visible only when `fmDoubleBack === "1"`. Temporary — removed once the flow is confirmed on Android.

---

## [2.60.0] — 2026-07-12

### Added
- **Double-back-to-exit (Option A), behind an off-by-default flag (`fmDoubleBack`)**: full rebuild of the native-Android back pattern — modal → close; subpage → back to parent; non-Home tab → go Home; Home → toast then exit on a second back within 2s. Deploy is inert (flag OFF); an owner-only toggle in Settings › Preferences turns it on per-device and reloads.
  - `lib/back-dispatcher.ts`: singleton with `doubleBackEnabled()` (reads localStorage), a LIFO modal-closer registry (`pushModalHandler`/`anyModalOpen`/`closeTopModal`) and `HOME`. Modals **register** here instead of pushing history — the fix that ends the multi-listener fights that broke prod in v2.59.x.
  - `hooks/useModalBack.ts`: flag-gated. OFF = classic behavior byte-for-byte; ON = registers a closer in the dispatcher and does **not** touch history. `isModalOpen()` now also reflects `anyModalOpen()`.
  - `hooks/useBackDispatcher.ts`: the single `popstate` listener + the history "trap". After each pop it reads `history.state.__fmTrap`: landed on a trap → in-app back (subpage→parent), no-op; consumed the trap → exit-intent (close modal / `replace(HOME)` / double-back). A `pathname` effect re-arms the trap on every root tab (tabs navigate with `replace`, which eats the trap). Trap pushed as `{ ...history.state, __fmTrap: true }` so Next's router still fires `popstate`.
  - `components/nav/BackExitToast.tsx`: mounts the dispatcher (inert if flag OFF) and shows the "tocá atrás de nuevo para salir" toast; mounted once in `app/(tabs)/layout.tsx`.
  - Owner-only toggle added to `app/(tabs)/settings/preferences/page.tsx`.
- **Known limitation (iteration 2)**: tab navigation uses `replace`, which eats the trap, so hopping across many tabs accretes one history entry per switch — the final exit from Home may need an extra back. Not a blocker for the flagged v1; fix is trap-aware tab nav in `BottomNav`.

---

## [2.59.4] — 2026-07-11

### Fixed
- **Budget input (and every BottomSheet input) closed the keyboard on each keystroke**: `BottomSheet`'s focus-management effect depended on `onClose`, which is passed inline (new identity every render), so each keystroke re-ran the effect and its `requestAnimationFrame(() => panel.focus())` stole focus from the input. `onClose` is now kept in a ref (`onCloseRef`) and the focus/Escape effect only runs on open/close (`[open]`). Pre-existing bug, unrelated to the removed double-back.

---

## [2.59.3] — 2026-07-11

### Fixed
- **Hotfix — removed the double-back-to-exit feature**: its `popstate` interception was hijacking navigation in production. Opening/closing a KPI modal (and others) sent the user to Home, and typing in the budget input closed the keyboard, because the history "trap" + `useModalBack` interplay fired spurious `router.replace(HOME)`. The feature was unreliable across several attempts. Removed `hooks/useBackButton.ts`, `components/pwa/BackExitToast.tsx`, `components/pwa/BackDebug.tsx`, the layout mount and the `pressBackAgainToExit` locale key. Back now behaves natively again (single back exits).

---

## [2.59.2] — 2026-07-11

### Changed
- **Reports decomposition — steps 2-5 (Phase 3)**: extracted the 4 sub-tab views out of `app/(tabs)/reports/page.tsx` into dedicated components in `components/reports/` — `GastosTab`, `IngresosTab`, `MovimientosTab`, `PeriodosTab`. The page dropped from ~1450 to 872 lines and now acts as an orchestrator (period selector + shared modals + state); the sub-tabs own their JSX (823 lines total across the 4 files). Behavior-preserving move (also dropped a few dead locals like `totalDias`/`pctDias`); orphaned imports cleaned up. Build + 39 unit tests green.

---

## [2.59.1] — 2026-07-04

### Changed
- **Reports decomposition — step 1 (Phase 3)**: moved the shared pure helpers `colorZ` (relative z-score color threshold) and `TIPO_COLOR` (movement-type color map) out of `app/(tabs)/reports/page.tsx` into `components/reports/format.ts`. Behavior-preserving; the page drops ~22 lines of inline logic and both are now unit-testable/reusable. Added 5 `colorZ` tests (39 total).

---

## [2.59.0] — 2026-07-04

### Added
- **Quick entry points to load a movement** — all deep-link to `/movements?nuevo=1`, which opens the add modal and cleans the URL:
  - **Launcher shortcut**: "Nuevo movimiento" now points to the deep-link (opens the modal directly).
  - **Share target**: `share_target` in the manifest (GET `title`/`text`/`url`); sharing to FinMoves opens the add flow. (Android; v1 does not prefill the shared text yet.)
  - **Push action**: recurrentes and forgotten-load notifications carry a **"Cargar"** action button. The SW forwards `actions` to `showNotification` and resolves per-action URLs from `data.actionUrls` in `notificationclick`. `PushPayload` extended with `actions` + `actionUrls`.

### Fixed
- **Double-back-to-exit (attempt): trap now preserves Next's router state** (`{ ...history.state, __fmTrap: true }`). Without it, the back on Home did not fire `popstate` (Next router bailout) so the app exited without the toast — matching the reverted v1 (which spread state and did show the toast). Pending on-device confirmation.

---

## [2.58.2] — 2026-07-04

### Fixed
- **Double-back-to-exit on Home**: the history "trap" is now pushed unconditionally on each root tab, so the first back on Home is captured and shows the exit toast. The previous `history.state.__fmTrap` guard was fooled by state persisted on the current entry when the PWA reopens (`launch_handler: navigate-existing`), so no trap was above and a single back exited without warning. Known residual: navigating across several tabs can leave history residue, so exiting may need an extra back — to be refined with trap-aware tab navigation.

### Added
- **Unit tests (Vitest)**: 34 tests over the pure logic — `components/reports/format` (`abbr`, `colorPct`/`colorPctDim`, `deltaMag`/`deltaColor`, date helpers), `utils/reserva` (`reservaFX`, `calcularReserva`, `tiposReserva`), `utils/periodo` (`agruparPorPeriodo`, `gastosPorCategoria`, `formatARS`), `utils/reportes` (`parsePeriodoId`, `estadisticasPeriodos`, `ritmoGasto`). `npm test` / `npm run test:watch`. Dev-only, no runtime or bundle impact.

---

## [2.58.1] — 2026-07-04

### Changed
- **Double-back-to-exit reworked (native Android pattern)**: the 2.58.0 version misfired under mixed navigation (tabs `replace`, subpages `push`, modals). Rebuilt in `hooks/useBackButton.ts` (replaces `useBackExit`) with a home-routing model: back on a non-home root tab → Home; back on Home → exit toast, and a second back within ~2s exits; subpages and modals keep their natural back; a history "trap" is re-armed on each root tab to capture the back. Never traps the user (back always advances). Needs on-device iteration for the residual mixed-nav edge cases.

---

## [2.58.0] — 2026-07-03

### Added
- **Native-feel pass** (shipped via hotfix): disabled pinch-zoom and double-tap-zoom (viewport `maximumScale: 1`, `userScalable: false` + `touch-action: manipulation`; this also removes iOS input-focus zoom for free, so no font-size bump needed); `env(safe-area-inset-top)` on `.page` (iOS notch); `user-select: none` + `-webkit-touch-callout: none` on the chrome with inputs/textarea re-enabled; scroll-to-top on active-tab re-tap + subtle `navigator.vibrate` haptics on tab nav.
- Double-back-to-exit (Android) — **reverted in 2.58.1**, see above.

---

## [2.57.1] — 2026-07-03

### Changed
- **Audit quick-wins (Phase 0)**:
  - `marcarFullSync` (movement edit/delete) now retries once and logs on failure instead of swallowing it silently — a failed `needsFullSync` flag would otherwise leave the Sheets mirror stale until the next manual sync, undetected.
  - Notifications: `RECURRENTE_LOOKBACK_DIAS` trimmed 45 → 35 days (fewer per-user reads/day; still safe — the daily cron + dedup fire the reminder on day 28, well inside the window).
  - `getCotizacion` now dedupes in-flight requests: concurrent cold-cache mounts await a single fetch instead of firing parallel calls.
  - Cold-start decision: `minInstances` stays at 0 (PWA cache masks the cold start; not worth the always-on cost).

---

## [2.57.0] — 2026-07-03

### Changed
- **Incremental Firestore reads (client + Sheets sync)** — kills the recurring ~1.4K-read full-collection scans:
  - **App load** (`useAllMovimientos`): when the server count exceeds the cached count (adds from another device/session), fetch only movements newer than the newest cached `timestampCarga` and merge, instead of re-reading the whole collection. Falls back to a full fetch when the numbers don't reconcile (cross-device deletes/edits). Count-match still short-circuits to cache.
  - **Sheets sync** (`syncUserMovimientosToSheet`): now incremental by default. Reads only movements after `syncMeta.lastSyncedTs` and appends them to the sheet (the sheet is written exclusively by the app, so its state equals the last sync). A full mirror (backup + overwrite) runs only when the app edited/deleted a movement (`syncMeta.needsFullSync`, set by `marcarFullSync` in `services/firebase/movimientos.ts` for the owner), when there's no prior sync, or when forced. Manual sync from Settings forces a full mirror.
  - **Cron back to daily** (was weekly in 2.56.2): daily is cheap now that the sync is incremental. Success push only fires when something was actually synced; the log distinguishes full vs incremental runs.

---

## [2.56.2] — 2026-07-03

### Changed
- **Sheets auto-sync throttled to weekly** (was ~daily): the sync is a full-collection mirror (~1.4K document reads per run), the single biggest recurring Firestore cost. `SYNC_MIN_INTERVAL_MS` is now 7 days minus a 4h buffer so it always lands on the same 06:00 cron slot. The cron itself still runs every 6h (notifications need it); manual sync from Settings is unchanged for on-demand flushes.

---

## [2.56.1] — 2026-07-02

### Changed
- **Dashboard "disponible" bar color follows the income-anchored scale**: was `<10% red, <50% yellow` (so green rarely showed); now uses the shared `colorPct` on spent/income (green ≤90, yellow 90–105, red >105). Side effect: moving money to savings no longer turns the bar red. `colorPct`/`colorPctDim` extracted to `components/reports/format.ts` as the single source of truth (Reports + Dashboard).
- **"Gastos totales" per-period chart is now neutral**: bar height = pesos (magnitude), single muted color. The green/amber/red semaphore only lives in the "gasto sobre sueldo" chart, where height and color describe the same thing. Best/worst months are still marked by the date-label color.

### Fixed
- **In-progress period excluded from best/worst**: the current (incomplete) period was flagged "best" just because it had spent little so far. Now `validPeriodos` drops `periodos[0]`, matching the inflation/trend criterion.
- **Budget template auto-applies to the current period**: the template only pre-filled categories that already had spending, so a fresh period showed nothing and had to be typed by hand. Now, for the in-progress period with no saved budget, the template is used as the effective budget (not persisted until edited/saved); the budget editor lists the full category union (spent + template + saved); and budgeted-but-unspent categories render as empty bars. Historical periods are untouched.

---

## [2.56.0] — 2026-07-02

### Changed
- **Color & percentage logic unified across Dashboard/Reports/Movements**:
  - **CompraUSD color**: was red on the Dashboard (grouped with Gasto) but yellow in Reports/Movements. Now yellow everywhere.
  - **`var(--teal)` token**: replaced the hardcoded `#26c6da` (and `#26c6da20` → `var(--teal-dim)`) in Dashboard, Movements, Reports and MovementModal for the "move disponible" color. No visual change; palette edits now propagate.
  - **Trend uses a relative threshold (z-score)**: the Gastos and Movements "Tendencia" stats no longer use a fixed ±10% band. Color is now based on how many standard deviations the current period sits from the user's own historical mean (±1σ = normal/yellow, beyond = red/green), so it adapts to each user's volatility. New `colorZ(actual, hist)` helper.
  - **Zero handling in deltas**: real zero (no change) now renders in text color instead of green/yellow/gray; a near-zero value that would round to "0%" now shows a decimal and keeps its sign color. Applied to category comparison, income delta, personal inflation (Reports + Dashboard) and the salary-vs-inflation gap. Backing computations (`deltaPct`, `tendenciaGasto`, `tendenciaMovs`, `deltaIngresos`, `inflacionPersonal`, `gap`) now keep the raw unrounded value; rounding happens at display via new `deltaMag`/`deltaColor` helpers in `components/reports/format.ts`.

### Fixed
- **`colorPct` scale rebased to income limit (100%)**: spent-color was green only ≤50%, red >90% — so normal spending (~100% of income) always read red. Now green ≤90%, yellow 90–105%, red >105%, and the duplicated inline thresholds (period gasto/sueldo chart) call `colorPct` instead of re-hardcoding.

---

## [2.55.7] — 2026-07-02

### Changed
- **Reports KPI reorg (Gastos/Ingresos)**: in Gastos, the "A ahorros" mini-stat next to Trend was replaced with a **Gasto real** stat (pure spend excluding FX purchases, shown only when FX purchases exist). The Trend info modal dropped the now-redundant "Período actual" line, keeping only the historical average. In Ingresos, the two move metrics (move disponible + move a ahorros) were merged into a single **Moves** card holding both amounts, distinguished by color (cyan = disponible, purple = a ahorros); each amount stays tappable for its detail modal. Removed the redundant `+%` sub-label from the Salary mini-stat (kept the "leave" indicator). Added `moves`, `realSpent`, `kpiRealSpentInfo` locale keys (es/en).

---

## [2.55.6] — 2026-07-01

### Fixed
- **Recurring-expense reminders on high-volume periods**: `checkRecurrentes` was scanning the shared 150-most-recent movements (introduced in 2.55.0). For users loading ~200 movements per period, a recurring expense's reference movement falls out of the top-150 (~day 22) before the 28-day reminder threshold, so the reminder never fired. It now reads its own date-windowed slice (`fecha >= today − 45 days`, index-free single-field range), which is robust to period volume. Salary and forgotten-load checks keep using the shared read (they only need the newest entry).

---

## [2.55.5] — 2026-07-01

### Changed
- **`useComprobante` hook**: extracted the receipt-attachment state (file, preview, removed flag, media viewer) and its handlers (`reset`, `onSelect`, `clear`) out of `MovementModal.tsx` into `components/movements/useComprobante.ts`. Centralizes the preview object-URL lifecycle; behavior-preserving (destructured with the same identifiers).

---

## [2.55.4] — 2026-07-01

### Changed
- **Reports chart components extracted**: moved the 7 presentational chart components (`Bar`, `Stat`, `DonutChart`, `VBars`, `DotChart`, `AreaChart`, `TwoLineChart`) and the format helpers (`abbr`, `shortPer`, `sinAño`, `periodoAnio`) out of `app/(tabs)/reports/page.tsx` into `components/reports/charts.tsx` and `components/reports/format.ts`. Reports page dropped ~260 lines (1680 → 1420); no behavior change.

---

## [2.55.3] — 2026-07-01

### Changed
- **`useHideOnScroll` hook**: extracted the floating-button fade-on-scroll logic (duplicated in Movements and Investments) into `hooks/useHideOnScroll.ts`.

---

## [2.55.2] — 2026-07-01

### Changed
- **Shared UI primitives**: extracted `<PageTitle>` (the gradient page heading used across Dashboard, Movements, Reports, Investments, Settings) and a `components/ui/gradients.ts` module (`APP_GRAD`, `APP_GRAD_DIM`, `TITLE_GRAD`, `clipText`, `appGradText`, `titleGradText`). Removes the duplicated gradient constants that lived in Movements and Reports and the repeated inline title styles.

---

## [2.55.1] — 2026-07-01

### Removed
- **Unused locale keys**: 141 dead keys removed from `locales/es.ts` and `locales/en.ts` (~140 lines each), including the leftover home/management/analysis families. The in-use `budget`/`budgetPeriod`/`budgetTemplate` keys were verified and kept.
- **Dead code in `utils/reportes.ts`**: removed 9 unused functions (`topGastos`, `medioPagoMasUsadoCount`, `promedioAhorroPeriodo`, `evolucionSueldo`, `gastoPromedioHistorico`, `ritmoAhorroActual`, `consistenciaAhorro`, `ahorrosVsProyectados`, `generarInsights`) plus the `Insight` and `AhorroVsProyectado` types (~140 lines).

### Changed
- **FX reserve calculation unified** into `utils/reserva.ts` (`reservaFX`, `calcularReserva`, `tiposReserva`). The five previously duplicated copies (Investments page, Reports, MovementModal, investment settings, notifications cron) now share one implementation.

---

## [2.55.0] — 2026-07-01

### Performance / cost (Firestore reads)
- **Notifications cron — daily gate**: movement-based checks (meta, salary, forgotten-entry, recurrents) now run at most once per day per user via a `lastDailyRun` marker, instead of on every cron run. Dollar-rate and version checks still run every run (they don't read movements). Cuts those reads ~4×→1×.
- **Recurrents check**: a single read of the ~150 most recent movements, filtered in memory, replaces one Firestore query per active recurrent.
- **Shared recent-movements read**: `checkSueldo` and `checkCargaOlvidada` now reuse that same snapshot instead of each issuing its own query.
- **`checkMeta` guarded**: returns early once the 100% milestone was notified, and uses a `count()` aggregation to reuse a cached investment-sum (stored in `notifyMeta`) when the number of investment movements and currency are unchanged; the base balance is always added separately so base edits still reflect.
- **Admin users API**: 60s in-module cache on `GET /api/admin/users` (owner-only, low churn), invalidated on permission change.
- **Client caching**: `recurrentes` and `plantillas` are now loaded once per session via `DataProvider` (movements list marker, add-movement modal, notifications settings) instead of re-fetching on each tab visit / modal open.

### Changed
- **Manual Sheets-sync button** now only appears when the last sync errored; the routine mirror is automatic (self-limited to ~1×/day), so the always-visible manual trigger was redundant.

---

## [2.54.1] — 2026-06-30

### Changed
- **Compare toggle resized**: the multi-period compare button in Reports now matches the smaller pill size (was left oversized after the pill resize).

---

## [2.54.0] — 2026-06-30

### Changed
- **Card labels capitalized**: stat/label text across cards (MiniStat, Stat, Patrimonio rows) now uses `capitalize`.
- **Section headers cleaned up**: removed the small kicker label above every section title. Dashboard renamed "Resumen" → "Inicio"; Settings title renamed "Cuenta" → "Configuración".
- **Reserve card**: header shown as "RESERVA" (uppercase) and the redundant "USD"/"EUR" suffix removed (currency is already in the big figure). Removed the redundant "Objetivo USD" label in the savings-goal card.
- **Reports year/period pills** resized to match the Movements pills (padding 4×12, 10px).

---

## [2.53.2] — 2026-06-30

### Changed
- **Chart metric selector** (Reports → Periods) now uses the unified brand gradient (soft tint fill + gradient text, no border), matching the sub-tabs and pills, instead of the previous solid blue accent.

---

## [2.53.1] — 2026-06-30

### Changed
- **Unified selector styling**: the Reports sub-tabs (Spending/Income/Movements/Periods) and every year/period pill — in both Reports and Movements — now share one brand gradient (blue → cyan → teal → green). Active state is a soft opaque tint fill with gradient text and no border, replacing the previous per-section colors and mixed border/fill treatments.

---

## [2.53.0] — 2026-06-29

### Added
- **FX income movement** (`IngresoUSD`/`IngresoEUR`): receiving money in foreign currency (e.g. a USD payment) adds to the reserve without touching the available balance — the opposite of FX spending. Counted at zero cost (ii): it raises the reserve and the gain. Wired into every reserve calculation (investment, settings, goal notifications, reports), shown in the reserve history, and hidden from the main movements/dashboard lists.

### Changed
- **Reserve modal redesigned**: the four type pills sit in one row (Buy/Income green, Sell/Spend red). Income works like Spend — amount only, no rate or currency selector — it just adds to the reserve. For Buy/Sell the oficial/blue rate pills were removed (defaults to the official rate, shown with its label) and the date moved into that slot.
- **"Leftover" reclassified**: the previous period's leftover (`RESTO`) is already-earned money, so it's now stored as a `Move` to savings instead of a fresh income. Existing leftover movements were migrated (`scripts/migrate-resto.js`). Period math is unchanged (still counts as savings carryover, never subtracts from available); it just no longer shows as green income — it's now a blue carryover entry.

### Fixed
- **Salary always anchors the period**: deterministic ordering so the salary movement sorts first even when it shares a creation timestamp with the leftover entry (was device-dependent).
- **Personal inflation** no longer includes the in-progress period, which produced absurd values (nominal −1%, cumulative −93%, dashboard −95%) right after opening a new period. Applies to the dashboard KPI, the reports average, and the cumulative CPI chart.

---

## [2.52.0] — 2026-06-29

### Changed
- **Settings consolidated** from 9 groups to 6: Account (profile + security merged), Preferences (now with language + **main currency selector, restored**), Notifications, Movements (now includes **budget template**), Investment, Data (now includes **owner invites**), Help. Removed standalone Profile/Security/Budgets/Admin routes.
- **Dashboard "Spent"** now shows real spending (excludes FX purchases).
- **Reports → Gastos hero**: added a breakdown legend ("real spending X + FX Y") when the total includes USD/EUR purchases.

### Fixed
- Account deletion entry relabeled "request deletion" (it sends a request to the admin, doesn't delete) and shown only to non-owner users.

---

## [2.51.0] — 2026-06-29

### Added
- **Salary over time** (Reports → Períodos): chart of your salary per period in USD (official historical rate from bluelytics) or CPI-adjusted (today's pesos), with a USD/IPC toggle. ARS only.

### Changed
- **Period chart selector** redesigned: the pill row is now a single centered button that opens a bottom-sheet picker (label + check). Options renamed/reordered: Total spending · Spending vs salary · Length in days · Personal inflation · Total income · Salary over time.
- **"Your year" recap is now seasonal**: the button only shows in December.

---

## [2.50.0] — 2026-06-29

### Added
- **"Your year" recap (annual Wrapped)**: full-screen story (tap to advance) in Reports recapping a closed year — total spent, top category, total saved, best savings month, personal vs country inflation (ARS only), salary raise, movement count. Reveal rule: closed years always available; the current year only from December 1. Button hidden when no year is available. All client-side ($0).

---

## [2.49.0] — 2026-06-29

### Added
- **Recurring flag in the movements list**: movements matching an active recurrente (same type+category+description) show a small clock icon.

### Changed
- **Server-mediated comprobante uploads (F3)**: uploads and deletes now go through API routes (`/api/comprobantes/upload`, `/api/comprobantes/delete`) that verify the ID token, check the `comprobantes` permission (owner bypass), validate type/size, and write via the Admin SDK with a non-expiring download token. Client still compresses images before upload. Storage rules tightened: clients can no longer write/delete comprobantes directly (server-only). **Requires deploying storage rules** (`firebase deploy --only storage`).

---

## [2.48.1] — 2026-06-29

### Changed
- **Movements settings redesigned**: categories/methods/origins are now full-width rows (name + active toggle + delete with confirm) instead of cramped chips with hidden long-press. Adding is behind a "+ Add" button that reveals an inline input (with Gasto/Ingreso selector for categories). Auto-savings unchanged.

---

## [2.48.0] — 2026-06-29

### Changed
- **Settings restructured into an account/profile hub with drill-in sub-pages.** The single-accordion `/settings` is now a landing with a profile header + grouped rows, each navigating to its own route (native back works): `/settings/profile`, `/preferences`, `/notifications`, `/security`, `/movements`, `/budgets`, `/investment`, `/data`, `/admin`, `/help`. Shared components in `settings/_shared.tsx` (SubHeader, NavRow, Toggle, Chip, flags). Behavior of each group preserved; movements UI unchanged (redesign pending). Investment gated by permission, admin/sheets gated to owner.

---

## [2.47.0] — 2026-06-28

### Added
- **Recurring movements (P3, reminder mode)**: a "Repeat each period" toggle when adding a Gasto/Ingreso saves a template (`users/{uid}/recurrentes`). A daily cron (`checkRecurrentes`) finds the last matching load and, ~28 days later, sends a push reminder ("¿Cargás X?") — date-based, never auto-posts. Dedup by last-load date (re-arms after you load it again). Management section in Settings (Generales → Movimientos recurrentes): list with pause toggle + delete.

### Changed
- Savings-projection KPI modal copy clarified (it's the next-period inflow, not the total balance).
- "Repeat each period" toggle placed at the bottom of the add form.

### Fixed
- **Bottom-sheet long-press no longer selects text** (`user-select: none` on the sheet).

### Added
- **Back button closes the open modal** instead of leaving the app (`useModalBack`, history-based). Lateral section swipe is disabled while a modal is open.
- **Bottom sheets draggable from the whole header** and via **long-press anywhere in the body** (native non-passive touch listeners so it doesn't fight scroll).

### Changed
- **G/Sueldo chart**: shows the surplus over 100% (+86% = spent 186% of salary; -14% = spent 86%); the baseline (0) marks 100%.
- **Savings projection**: deflated to today's pesos and projected to next month (CPI), like the spending projection — no longer falls below the current level.
- **Día pico / daily average** (Movimientos): exclude FX purchases (pure spending only).
- Purchasing-power modal: dropped the redundant trailing sentence.

### Fixed
- **IP chart order**: accumulated inflation chart now renders most-recent-first (left), matching the other period charts.
- **Chart click targets**: días (area), G/Sueldo and IP (dots/lines) now navigate to the period when tapping anywhere in the column, not only exactly on the point.

---

## [2.46.0] — 2026-06-28

### Added
- **"Purchasing power" card** (Reports → Períodos, above the charts): verdict + gap in points between accumulated salary growth (first→last salary level, excluding vacation periods) and accumulated country inflation. Replaces the "Most frequent expense" and "Highest expense" cards.

### Changed
- **CPI month mapping fix**: periods starting after the 15th now map to the following month (the one they mostly span), since salaries anchor near month-end. Affects `deflatar` and `ipcVar`.
- **IP chart → two accumulated lines**: your accumulated inflation vs the country's (compounded), from the oldest period. Headline shows "Vos acum / País acum". Replaces the per-period dot chart.
- **Período cards reorganized**: removed "Typical income"; rows are now Typical spending | Spending projection, and Typical savings | Savings projection. The next-period spending projection moved here from the Gastos tab.
- **Gastos tab**: shows "Avg per movement" where the projection used to be.
- **Improved projection**: historical periods are deflated to today's pesos (CPI) and projected to next period by the latest monthly CPI, instead of a plain nominal average.
- **Días chart → area**, **G/Sueldo chart → dots** (uses real spending without FX), per chart-type variety.
- `useInflacionIPC` exposes `ipcVar` (country inflation between two periods) and `ipcMensualUltimo`.

---

## [2.45.2] — 2026-06-28

### Changed
- **Personal inflation chart redesigned** as a connected dot/point chart (SVG): each period is a dot above/below the dashed zero baseline (red above, green below), joined by a trend line, with the % above each dot. Replaces the diverging bars for a cleaner, more modern look.

---

## [2.45.1] — 2026-06-28

### Fixed
- **Personal inflation chart period mapping**: `serieDesc` runs newest→oldest, so the previous period is `serieDesc[i+1]`, not `[i-1]`. The chart was excluding the current (open) period instead of the oldest, and computing the change with reversed sign. Now the current period is included (its prior is the second-newest) and the oldest is excluded (no prior to compare).

### Added
- **Average personal inflation** shown above the "IP" diverging-bar chart — the mean of the real per-period inflation bars.

### Changed
- **Argentine CPI gating**: the "IP" pill (Reports) and the CPI-adjusted dashboard "Inflación" now apply only when `monedaPrincipal === "ARS"`. Non-ARS users get nominal dashboard inflation (Argentine CPI doesn't apply to their currency) and don't see the IP pill. Dashboard modal text varies by case.
- **Reports period card** renamed "Inflación personal" → "Inflación nominal" to contrast with the CPI-adjusted (real) IP chart.

---

## [2.45.0] — 2026-06-28

### Added
- **Nonce-based CSP** (F8): `proxy.ts` (Next.js 16 convention, replaces `middleware.ts`) generates a per-request cryptographic nonce and emits `script-src 'self' 'nonce-{n}' 'strict-dynamic'`. Modern browsers ignore `'unsafe-inline'` for scripts, mitigating inline-script XSS. The root layout reads `x-nonce` and applies it to the theme-init inline script. CSP moved out of `next.config.ts` into the proxy; other static security headers unchanged. `'unsafe-inline'` retained on `style-src` (inline `style={{}}` used app-wide).
- **Personal inflation chart** (Reports → Períodos): new "IP" pill renders a diverging bar chart of real per-period inflation — pure spending (tipo "Gasto") deflated by CPI vs the previous period. Zero baseline: positive up (red, spent more in real terms), negative down (green). Oldest period excluded (no prior to compare).

### Changed
- **CPI source switched to Argly** (`useInflacionIPC`): `https://www.argly.com.ar/v1/ipc?historico=true` (coverage Dec 2022 → present), replacing the INDEC series that didn't cover 2025–2026. Monthly variations compounded into a cumulative index; cached 24h in localStorage.
- **Dashboard "Inflación"**: now CPI-adjusted (real) vs the previous period instead of nominal. Positive = spending above inflation. Modal text updated (ES/EN).
- Reports → Períodos "Inflación personal" modal text corrected: it's the nominal historical average across periods (was wrongly claiming CPI adjustment / "vs previous period").

### Removed
- **"Real" metric pill** (added in 2.44.0): replaced by the diverging-bar "IP" chart. The absolute deflated-spending bars were dominated by single large periods and conveyed no useful trend.

---

## [2.44.1] — 2026-06-28

### Changed
- **Dashboard "Inflación"**: now shows change vs the immediately previous period (not the historical average). Label shortened to "Inflación"; modal text updated accordingly.
- Reports → Períodos retains "Inflación personal" (historical average across all periods) — the two metrics are intentionally different.

---

## [2.44.0] — 2026-06-28

### Added
- **Personal inflation on dashboard**: replaced "Avg. per expense" KPI with "Personal inflation" — average % change in pure spending (tipo "Gasto" only, FX purchases excluded) between consecutive periods. Green when decreasing, red when increasing; tappable for explanation modal. Same computation already present in Reports → Períodos.
- **"Real" metric pill in Reports**: new fifth pill in the period chart selector (ARS users only). Shows `gastadoPuro` (spending without FX purchases) in nominal ARS, with eye-mask and best/worst period markers — isolates spending trend from FX noise.

---

## [2.43.2] — 2026-06-28

### Fixed
- **Firebase re-initialization on Fast Refresh**: guard `initializeApp` with `getApps()` and `initializeFirestore` with try/catch so HMR module re-evaluation doesn't throw `initializeFirestore() has already been called with different options`.

---

## [2.43.1] — 2026-06-28

### Fixed
- **Period duration chart**: current period bar now uses `floor + 1` (inclusive) to match the home-page counter — no more 30d vs 31d discrepancy.
- **App Check in dev**: `initializeAppCheck` is now guarded by `NODE_ENV === "production"`, eliminating the `appCheck/recaptcha-error` console noise in local dev.
- **Push notification icon**: changed from `/favicon.png` to `/icon-192.png` (correct Android notification icon size, already precached by the SW).
- **Inactivity logout timeout**: increased from 8 hours to 3 days — push notifications are only useful if the user doesn't have to re-login every time they open the app.

---

## [2.43.0] — 2026-06-28

### Accessibility
- **BottomSheet** (the app's primary modal, used by the movement form + ~10 Reports sheets) now has `role="dialog"`/`aria-modal`, **Escape to close**, a **focus trap** (Tab cycles within the sheet), focus moved into the sheet on open and **restored to the trigger on close**, plus an `aria-label` on the close button.
- **Settings toggles** are now real `<button role="switch" aria-checked>` (keyboard-operable, announced as switches) instead of `div onClick`; added an optional `label` for `aria-label`.
- **Period bar chart** (`VBars`): clickable bars are now `<button>`s with an `aria-label` (period + value) instead of `div onClick`.
- **Type donut** (`DonutChart`): wrapper exposes `role="img"` + a percentage summary `aria-label`, the SVG is `aria-hidden`, and the tappable legend buttons gained `aria-pressed` + `aria-label` (the legend is the keyboard/SR-accessible control).

### Security
- **Durable rate limiting for `/api/register`** (F4): moved the per-IP limiter from per-instance memory to a Firestore counter (`rateLimits/{ip}`), so it survives cold starts and works across instances; now keys on the first `x-forwarded-for` hop. Expired counters are swept by the daily cron. The collection is client-denied by the default Firestore rules (Admin SDK only).
- **CSP fix for App Check / reCAPTCHA**: added `https://www.google.com` to `script-src` and `frame-src` so reCAPTCHA v3 (`recaptcha/api.js` + challenge iframe) can load. Without it App Check couldn't obtain a token and, under enforcement, all Firestore calls were rejected (production hung on load). Unblocks enabling App Check enforcement safely.

---

## [2.42.1] — 2026-06-27

### Security
- **Firebase App Check activated in monitor mode**: wired the public reCAPTCHA v3 site key via `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` (plain `value` in `apphosting.yaml` — the site key is public by design; the secret key lives only in the Firebase App Check console). Clients now attach App Check tokens to Firestore/Storage/Auth calls. Enforcement stays OFF until the console metrics confirm legitimate traffic is passing.

---

## [2.42.0] — 2026-06-27

### Changed
- **Dark is now the default theme** (the designed palette); light is opt-in. Flipped the default in `useTheme` and the pre-paint `themeInitScript` (light applies only when `finmoves-theme === "light"`). New users no longer land on the under-contrasted light theme.
- **Tap targets**: `.pill` now has `min-height: 32px` + flex centering, raising the many sub-32px period/metric pills in Movements & Reports above the mis-tap threshold.

### Added
- **`prefers-reduced-motion` support**: global CSS that collapses animations/transitions for users who request reduced motion (spinner keeps spinning so it doesn't look hung). (A11y)
- **Firebase App Check scaffolding** (anti-abuse): client initializes App Check with reCAPTCHA v3 when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set; no-op otherwise (dev stays unaffected). Added `adminBucket` earlier; this is the F2 item from the security review.

### Fixed
- **i18n leaks**: routed remaining hardcoded Spanish through the dictionary (es/en) — Reports "A ahorros"/"Move a ahorros"/"Hoy"/"Compra U$D"/"Reserva" and their KPI explainers, Dashboard "spent" explainer, Settings currency toasts + "Auto-ahorro", and the login footer Privacy/Terms links.

> Enablement note: App Check is dormant until you (1) register a reCAPTCHA v3 provider in Firebase App Check, (2) add `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` (Secret Manager + `apphosting.yaml` BUILD var), then redeploy, and (3) flip enforcement to ON in the console (after a monitor period). The code ships safe-by-default (off) so nothing breaks before those steps.

---

## [2.41.1] — 2026-06-27

### Security
- **Account deletion now also wipes Cloud Storage** (receipts + avatar under `users/{uid}/`), which previously survived a hard delete as orphaned PII. Added `adminBucket()` helper and a best-effort `deleteFiles({ prefix })` in the delete route. (ISO A.8.10 / A.5.34)
- **Sheets sync errors no longer leak internals to clients**: the manual sync route returns a generic message and the cron failure push says "check Settings" — full detail stays in server logs and the owner-only sync log. (ISO A.8.15)
- **Storage rule added for `users/{uid}/avatar.jpg`** (owner read/write/delete, image-only, <5 MB) — the avatar write path was previously denied by the catch-all rule, silently breaking profile-photo copy. (ISO A.8.3)

> Deploy note: storage rule changes require `firebase deploy --only storage` (not applied by the App Hosting push).

---

## [2.41.0] — 2026-06-27

### Added
- **Tap a bar in the Periods chart to jump to that period**: opens a confirm card and, on confirm, selects the period and switches to the matching sub-tab — the Spent chart goes to **Expenses**, the Income chart to **Income** (Days / spend-salary go to Expenses). `VBars` now carries `periodoId` per bar and exposes it via `onBarClick`.

### Fixed
- **Salary KPI now reflects the selected period** instead of always showing the most recent period's salary. Replaced the global `evolucionSueldo` read with a per-active-period computation (`evolSueldoActivo`) that also derives the variation vs the previous distinct, non-leave salary level.
- **Trend and next-period projection only render on the current (most recent) period** — they're meaningless when browsing an older period. Gated behind a new `esPeriodoVigente` flag.

### Changed
- **Period spend chart counts FX buys again** (bars, best/worst markers and the spend/salary ratio): reverted to `gastado` so the chart stays aligned with the income-side totals without touching income logic. Numeric KPIs (trend, average, median, projection, pace, deviation) keep using pure spend.
- **Spend-dispersion (CV) color thresholds recalibrated** on the home dashboard: green ≤100%, yellow ≤200%, red >200% (was 25/50, which flagged nearly everything red since per-movement amounts vary widely).
- **Top-category cards** (most frequent / highest) now show only the data in the expanded modal (count / amount), since the minimized card already shows the category.
- **Shortened the median explanation** (typical income/spent/savings KPIs) — the previous copy was overly long.

---

## [2.40.0] — 2026-06-27

### Changed
- **Statistical calculations now exclude FX buys** (`CompraUSD`/`CompraEUR`), which were inflating averages, variation and projections. Introduced `gastadoPuro` (sum of `Gasto` only) on `PeriodoResumen` and `PuntoTendencia`, plus an `esGastoPuro` helper. Routed through it: personal inflation, median/average spend per period, spend trend, next-period projection, spending pace (`ritmoGasto`), avg-per-day-with-expense (`kpisPeriodo.promedioDiario`), spend dispersion/CV (`estadisticasPeriodos`), best/worst-period markers, the per-period spend bar chart and the spend/salary ratio chart, and the home dashboard's avg-per-movement + deviation (CV).
- **Totals and breakdowns keep FX**: period total `gastado`, `% spent`, by-category / by-payment-method / by-description / by-date distributions and top expenses still include `CompraUSD`, so FX buys remain visible where they're a real outflow.

---

## [2.39.0] — 2026-06-27

### Reports · Periods
- **Top categories split into two cards**: "most frequent expense" (by movement count) and a new **"highest expense"** (by total amount). Amounts are no longer shown inline — content is centered and the detail opens on tap (`KpiInfoModal`): the frequent card reveals the movement count, the highest-spend card reveals the full (non-abbreviated) amount.
- **New savings metrics**: **typical savings** (median of what goes to savings per period — `moveAhorros + ahorros`) and a **savings forecast** for the next period (historical average, excluding the in-progress period). KPI rows reorganized into a 2-2-2 grid; removed the spend forecast from this overview. Savings metrics use `--blue` (purple stays reserved for move-to-savings).

### Reports · Income
- Removed the standalone savings projection widget (3p/6p/12p selector).

### Reports · Movements
- Pie-chart legend simplified: move types now read **"Ahorros"/"Disponible"** (the color already conveys it's a move) and **CompraUSD** reads **"USD"**.

### i18n
- Added `highestExpense`, `avgSavings`, `projSavings`, `kpiTypicalSavingsInfo`, `kpiProjInfo`, `kpiMostFrequentInfo`, `kpiHighestInfo` (es/en); updated `tipoDisplay` labels for `MoveAhorro`/`MoveDisponible`/`CompraUSD`.

---

## [2.38.1] — 2026-06-27

### Fixed
- **Onboarding infinite loop for new users**: after completing onboarding the local config cache was not updated, so the home-page guard read the stale `onboardingCompleto: false` value and redirected back to `/onboarding`. Fix: `saveConfigCache` is now called with the updated config immediately after the Firestore write, before the redirect.

---

## [2.38.0] — 2026-06-27

### Changed
- **Reports / Periods section reworked into a general overview**. The four separate per-period charts (spent, spent-vs-salary, income, days) are now a single chart with a metric selector (Spent · Income · Days · Spend/Salary); `VBars` gained an optional reference line for the Spend/Salary ratio (100% marker). A subtitle under the chart explains the active metric.
- **New period summary** above the chart: hero is now **personal inflation** (average period-over-period spending growth, excluding FX buys so it isn't skewed), plus **most frequent expense** (category · times · total) and **typical income/spent** per period using the **median** (robust to atypical periods), each with a tap-to-explain `KpiInfoModal`. Removed the previous net-average hero, the average/median + best/worst stacks.

### Added
- i18n keys for the period overview (`inflationTitle`, `kpiInflationInfo`, `mostFrequentExpense`, `timesCount`, `avgSpent`/`avgIncome`, `kpiTypicalInfo`, `subMetric*`, `mPeriod*`, `byPeriod`) in es/en.

---

## [2.37.0] — 2026-06-27

### Changed
- **Reports / budget bars (Por categoría)**: the over/under-budget color now lives on the bar and the delta percentage only; the delta amount and the budget target render neutral, so the status color reads at a glance without tinting the whole figure.
- **Reports / category & description bars (non-budget)**: bar color now encodes the row type — red for gasto, yellow for FX buys (`CompraUSD`/`CompraEUR`) — in both Por categoría and Top descripciones. Amounts stay white/gray.
- **Reports / detail sheets**: amounts in the description and category modals now render neutral (white) instead of yellow/red.
- **Reports / Por medio de pago**: the preview row drops the aggregate amount and keeps only the per-type count badges; tapping a method opens a sheet detailing totals per movement type (count `×` + amount).

### Added
- **New movement / category pills**: now a single horizontally-scrollable row sorted by usage (most-used first, counted from the user's `Gasto` movements) instead of a wrapping multi-row block.
- **Reserva / FX spend**: the helper under the amount now shows the current FX reserve and, once an amount is entered, the remaining reserve (`Reserva: USD X · Restante: USD Y`), colored green/yellow/red by how much of the reserve the spend consumes — replacing the line that merely echoed the amount as "Total".

### Fixed
- **Settings opened the keyboard on load**: the Auto-ahorro amount input kept its `autoFocus`, but since modals now use the always-mounted `BottomSheet` (children stay mounted for the drag-peek), the attribute fired on page mount and popped the on-screen keyboard when entering Settings. Removed the `autoFocus`.

---

## [2.36.0] — 2026-06-27

### Changed
- **Modals unified to a single bottom-sheet**: the shared `BottomSheet` component now matches the sync-history look (muted ×, divider under the header, `--surface` panel) while keeping the draggable handle. Settings modals that were centered cards or bespoke sheets (Auto-ahorro, Historial de sync, Changelog, Recordatorios, Invitaciones) were migrated to the shared component, so reports, add/edit and settings all render the same sheet. Removed the now-unused `createPortal`/`mounted` plumbing in Settings.
- **Movement detail (read-only, from Investments history)**: redesigned and moved to the unified sheet. The amount is now a hero figure (large mono, centered) with `tipo · categoría` above and date below; quantity/rate and description/notes sit in roomy cells — the cramped 30%-width amount column is gone.

### Added
- **Bottom-sheets follow the on-screen keyboard**: `BottomSheet` tracks `window.visualViewport` and pins the container height/offset to the visible viewport, so the sheet rises above the keyboard instead of being covered. Applies to every modal via the shared component.
- **New movement / Reserva — auto focus on amount**: opening the add sheet focuses the amount input (after the open animation); switching tipo (Gasto/Ingreso/Move) re-focuses it. Reserve mode focuses its primary amount input (USD/ARS or FX spend).
- **Reports / Gastos trend**: the trend KPI modal now spells out the actual figures — current period spend vs. historical average — like the movements trend.

### Fixed
- **Dashboard / Move color**: a Move "a disponible" on the home screen now renders teal instead of purple; only "a ahorro" stays purple (matching the movements list).
- **Investments / Por período KPI**: no longer truncates ("1.044 / …"). The card shows the average; the average-vs-goal pair is shown in the KPI detail on tap.

---

## [2.35.0] — 2026-06-26

### Changed
- **Investments / period stats (Por período, Proyección, Para la meta)**: now computed from actual net FX bought per period (`CompraUSD/EUR − GastoUSD/EUR − VentaUSD/EUR` by `cantidadUSD`), not from ARS leftover savings converted at the current rate. The averaging window is anchored to a seed period (`config/meta.inversionSeedPeriodoId`, auto-set to the current period on first load) and grows period by period. If no FX was bought in the window, the three stats show "—".
- **Dashboard investment shortcut**: hidden when the user lacks the `showAhorros` pref (was always visible).

### Added
- **Reports / Por día**: bars are now stacked — red segment for gastos, yellow for `CompraUSD` — so FX purchases no longer visually inflate a day's spend without context. A legend appears when the period has FX buys, and the day modal lists the `CompraUSD` movements (yellow, with `cantidadUSD`) alongside gastos; the modal total now matches the bar.
- **Reports / Movimientos donut**: card is now a 3-column grid (total · donut · legend). The legend is a tappable list of rows (color + type + count) that selects/highlights a slice — much easier to hit on mobile than thin arcs. Removed the redundant selected-type row under "días activos" and the label under the center percentage.

---

## [2.34.0] — 2026-06-26

### Added
- **Settings > General / Dashboard clásico**: toggle that switches the four dashboard KPIs between the new set (gastado, ahorros acum., prom. por mov., desvío CV%) and the classic set (salary, spent, savings, withdrawals). Persisted per-device in `finmoves_app_prefs` (localStorage via Zustand).

---

## [2.33.0] — 2026-06-25

### Changed
- **Dashboard KPIs**: replaced the four period-level stats (salary, spent, savings, withdrawals) with four cross-cutting metrics — Gastado, Ahorros acum., Prom. por mov., and Desvío (coefficient of variation as `±X%`). All four are centered and open a `KpiInfoModal` on tap with a brief explanation.
- Added `spendSpread` and `kpiSpendSpreadInfo` translation keys (es/en).

---

## [2.32.2] — 2026-06-24

### Fixed
- **Reports / Por medio de pago**: `medioPago` placeholder dashes now cover all variants (`-`, `–`, `—`) and are attributed to "Mercado Pago" regardless of movement type, so the stray "—" row no longer appears and its movements merge into Mercado Pago. Genuinely empty `medioPago` (e.g. income) is excluded from the chart.

---

## [2.32.1] — 2026-06-24

### Changed
- **Reports / Categorías budget mode**: when the budget toggle is on, the per-category amount and percentage now show the delta vs. budget (over with `+`, under with `−`) colored by budget status, instead of the absolute spend and its share of total.

---

## [2.32.0] — 2026-06-24

### Added
- **App icon badge for push notifications**: the service worker now keeps an unread counter in IndexedDB (`finmoves-badge`); each `push` increments it and calls `setAppBadge(n)`. The badge clears only when the app is opened/focused (via a `CLEAR_BADGE` message + `clearAppBadge()` in `ServiceWorkerRegister`), not when the notification is swiped away. Requires an installed PWA with notifications granted (iOS 16.4+).
- **New-version push**: `notifyUser` sends a one-time push on MINOR/MAJOR releases (patches excluded), deduped via `notifyMeta.lastVersionNotified` with a silent baseline for existing/new users. Complements the in-app update banner (which performs the actual hard refresh).
- **Sheets sync push on success (owner)**: the cron now pushes the owner on successful auto-sync with the same detail as the log (`Sync automática · N movimientos`), in addition to failures.

### Changed
- **Sheets sync failure push (owner)**: now includes the real error message instead of a generic string.
- Removed the movement-count app badge from the dashboard (`useAppBadge`) — it only ran while the dashboard was open and never reliably rendered on mobile. Hook `hooks/useAppBadge.ts` deleted.

---

## [2.31.1] — 2026-06-24

### Fixed
- **Reports / Medios de pago**: `medioPago` values are now trimmed before comparison; both hyphen (`-`) and en-dash (`–`) variants are treated as "no payment method" and attributed to "Mercado Pago" for Gastos.

---

## [2.31.0] — 2026-06-23

### Added
- **Reports / Movimientos hero**: interactive SVG donut chart showing movement distribution by type. Tap a segment to highlight it and display its percentage in the center; tap again to deselect.
- **Reports / Períodos**: new "Días por período" bar chart with color coding — green ≤29 days, yellow 30–31, red ≥32.

### Changed
- **Reports / Movimientos KPIs — Tendencia**: now computes trend based on movement count (not expense amount) vs. historical average. Explanation modal shows current count and historical average for direct comparison.
- **Reports / Movimientos hero**: removed "período" subtitle; restored "días activos" subtitle. Legend row (`visibility: hidden` when empty) prevents layout shift on segment selection.
- **Reports / Períodos KPIs**: removed "Mejor período" / "Peor período" MiniStats; best and worst periods are now highlighted directly in the "Gastado por período" bar chart (green/red labels).
- **Reports / Medios de pago**: gastos without `medioPago` or with `medioPago === "-"` are attributed to "Mercado Pago" in the chart visualization only.
- **Dashboard**: active period display now shows elapsed days ("X días") instead of the period start date.
- **VBars**: added optional `valueLabel` per-bar prop to override the default currency-formatted label.

---

## [2.30.0] — 2026-06-23

### Changed
- **Reports / Movimientos KPIs**: replaced "avg per movement" stat with "peak spending day" (`kpis.diaMayorGasto`) in red.
- **Reports / Gastos KPIs**: replaced "peak spending day" with "moved to savings" (`periodo.moveAhorros`) in purple; shown only when > 0.
- **Reports / Tendencia**: changed comparison from last-3 vs previous-3 periods to current period vs historical average of all previous periods (`periodos.slice(1)` mean). Requires ≥ 2 periods instead of ≥ 4. Updated locale strings for `kpiTrendInfo`.
- **Reports / Colors**: Movimientos tab, year pills, period pills, and hero card now use a teal→purple gradient (matching the Move pill in the entry modal). Períodos tab and hero use a red→green gradient. Gastos hero now has a red-dim background. Ingresos hero background and number color softened.

---

## [2.29.2] — 2026-06-23

### Fixed
- **Movements day-group badge**: Auto-ahorro moves (tipo=Move, descripcion=Auto-ahorro) were excluded from `nMoveAhorro` counter and falling into `nUsd` (yellow). Now all `tipo === "Move"` entries are counted by `direccionMove` — Auto-ahorro (aAhorro) shows purple, disponible shows teal.

---

## [2.29.1] — 2026-06-23

### Fixed
- **Movements day-group badge**: Move a disponible (aDisponible) now shows in teal (`#26c6da`) instead of purple. Split `nMove` counter into `nMoveDisp` (teal) and `nMoveAhorro` (purple) so each direction renders with its correct color in the collapsed day header.

---

## [2.29.0] — 2026-06-22

### Added
- **InstallBanner**: persistent floating PWA install prompt (same style as UpdateBanner) — replaces the settings card; shows until app is installed, no close button. Added `components/pwa/InstallBanner.tsx`, wired into `app/(tabs)/layout.tsx`.
- **Account deletion request flow**: new `POST /api/account/request-deletion` endpoint — marks `pendingDeletion: true` + `pendingDeletionAt` on user's Firestore doc and sends push notification to owner. No actual deletion, no reauth required.

### Changed
- **Invite code modal**: changed from bottom-sheet to centered floating card (matching ConfirmModal/Backup style); accent-dim background, icon-only copy button.
- **Delete account**: moved from inside Cuenta card to bottom of settings page (subtle underline link, non-owner only); action now triggers deactivation request instead of immediate deletion.
- **Settings**: removed `useInstallPrompt` import and `canInstall`/`promptInstall` usage (install prompt now lives in `InstallBanner`). Removed `deletePass`, `deleteError` state; replaced `handleDeleteAccount` with `handleRequestDeletion`.

---

## [2.28.1] — 2026-06-22

### Changed
- **Move ahorros color**: changed from orange (`--orange`) to purple (`--purple`, `#b06ddb`) across all surfaces — movement list dot, amount text, day-group badge, modal direction pills and info box, dashboard list, reports `TIPO_COLOR` map.
- Added `--purple` and `--purple-dim` CSS variables to `:root`.

---

## [2.28.0] — 2026-06-22

### Changed
- **Reports > Movimientos subtab — KPIs redesigned**: replaced 6 mixed KPIs with 4 focused ones: Hoy (today's spend, active period only), Prom. ARS/mov (ticket average), Prom. ARS/día (daily average), Días activos % (days with ≥1 expense / total period days). Fixed date comparison to handle both YYYY-MM-DD and D/M/YYYY formats. Fixed total-days calculation (off-by-one removed).
- **Reports > Movimientos subtab — Por categoría**: now shows ARS total alongside frequency count. Bar width still reflects frequency. Modal "Todas las categorías" updated to match (count × + ARS).
- **Reports > Movimientos subtab — Por medio de pago**: moved from Gastos tab; now shows total ARS + per-type count breakdown (colored by Gasto/Ingreso/Move/FX) + frequency bar.
- **Reports > Gastos subtab**: removed "Categoría que más creció" card and "Por medio de pago" card.
- **Reports > Movimientos subtab**: removed "Top 5 descripciones" and "Por día de semana" chart. Added Prom. ARS/día and Prom. ARS/mov KPIs (moved from Gastos).
- **`TIPO_COLOR`**: extracted to component level to avoid duplication between movCounts useMemo and render scope.

---

## [2.27.0] — 2026-06-22

### Added
- **Per-period budgets**: new Firestore subcollection `users/{uid}/presupuestos/{periodoId}` stores per-category budget amounts per period. CRUD in `services/firebase/presupuestos.ts`.
- **Budget edit sheet**: pencil button in "Por categoría" card opens a BottomSheet with per-category number inputs, pre-filled from the saved period budget or the default template. Guardar is gated by `isDirty` comparison against Firestore state.
- **Budget toggle**: "Presupuesto" pill button appears next to the pencil when a budget is saved. Off by default; activating it colors category bars red/yellow/green based on usage percentage and shows the budget cap to the right of each bar track. Resets on period change.
- **Category drill-down modal**: tapping any category row in "Por categoría" opens a BottomSheet listing all expenses for that category in the selected period, sorted by date desc. Shows budget status in the header when a budget is set.
- **Budget template in Settings**: new "Presupuestos" collapsible section in Settings for defining a default per-category budget that pre-fills each new period's edit sheet. Save gated by `isDirty`.
- **`Presupuesto` interface** and `presupuestoTemplate?: Record<string, number>` added to `ConfigUsuario.meta` in `types/index.ts`.
- **i18n**: budget translation keys added to `locales/es.ts` and `locales/en.ts`.
- **No number input spinners**: global CSS removes webkit/moz number input arrows.

### Changed
- **Move badge color in Movements**: daily summary badges now split Move transactions — `aDisponible` shows teal, `aAhorro` shows orange (was always orange).
- **Removed KPIs**: "Promedio diario" and "Prom. por mov." removed from Gastos KPI row in Reports (will reappear in a restructured Movements tab).

---

## [2.26.0] — 2026-06-19

### Changed
- **Onboarding redesigned**: 11-step tutorial replaced by a 3-screen quick setup. Step 0: welcome + optional name input. Step 1: day-to-day currency selector + "manage USD/EUR reserve?" toggle + conditional investment currency selector (USD/EUR). Step 2: biometric + push notification toggles. On finish: writes `nombre`, `monedaPrincipal`, `showAhorros`, `monedaInversiones`, and sets `showReportes: true`.

### Added
- **`hooks/useFirstVisit`**: localStorage-based hook that returns `[show, dismiss]` for a given key — persists dismissal across sessions.
- **`components/ui/SectionHint`**: dismissible info card (left accent border) shown once per section.
- **Contextual first-visit hints**: displayed at the top of Movements (only when movements exist), Reports, and Investments tabs on first visit. Dismissed individually with an ×.

### Removed
- Educational slide screens from onboarding (`obHowBody`, `obTypesTitle/Body`, `obTypeGasto/Ingreso/Move/Fx`, `obCurrencyTitle/Body`, `obPeriodTitle/Body`, `obSavingsVsInvestTitle/Body`, `obGainCalculationTitle/Body`, `obReportsTitle/Body`, `obInvestTitle/Body`, `obDoneTitle/Body`, `obSecurityBody` locale keys). The settings Guide section now uses `hintMovBody` for the how-it-works blurb.

---

## [2.25.9] — 2026-06-19

### Added
- **`/api/account/delete`**: new DELETE endpoint — verifies ID token, calls `adminDb().recursiveDelete(userDoc)` to wipe all Firestore subcollections (movimientos, config/*, recordatorios, plantillas), then `adminAuth().deleteUser(uid)`.
- **Export JSON**: replaced CSV export with a full JSON export (`movimientos[]` + `config.{categorias, mediosPago, origenesAhorro}`). Timestamps serialized as ISO strings. File named `finmoves_YYYY-MM-DD.json`.
- **Delete account UI** (Settings → Datos): button opens a ConfirmModal that requires re-authentication (email/password credential) before calling the delete API. On success: clears localStorage caches (`moves_uid`, `config_uid`), resets Zustand prefs, signs out, redirects to `/login`.
- **Permisos log (user-facing)**: non-owner users see their permission change history (key, activated/deactivated, motivo, date) under "Accesos" in the Datos card. Loaded via `getDoc(config/permisosLog)` on settings mount.

### Removed
- CSV export (`exportCSV`) and all `csvDate/csvType/csvCategory/…` locale keys — replaced by JSON export.

---

## [2.25.8] — 2026-06-19

### Performance
- **Firestore reads ~99% reduction**: eliminated blind full-fetch after every movement creation. `useAllMovimientos` now exposes `prependLocal(movs[])` — on create, `MovementModal` captures the Firestore-generated IDs from `addDoc` responses and inserts the new documents directly into local state + localStorage cache. No round-trip to Firestore needed.
- **`useAllMovimientos` simplified**: removed `isExplicitRefresh` fast path that bypassed the count check; all refreshes now go through `getCountFromServer` — only fetches the full collection when count actually differs (e.g., changes from another device).
- **`useConfig` cache**: config (meta + permisos docs) is now cached in localStorage with a 5-minute TTL. Subsequent page loads within the TTL window skip the 2-doc Firestore read entirely.
- **`data-context`**: `prependMovimiento` added to context and exposed to all pages.
- Multi-movement creates (main + RESTO + auto-ahorro) all handled optimistically in a single `prependLocal` call.

---

## [2.25.7] — 2026-06-18

### Fixed
- Include missing logo assets: updated `logo5-cropped.png`, added `logo-fm-1024.png`.

---

## [2.25.6] — 2026-06-18

### Changed
- **Reports / Movimientos**: Move split into `MoveAhorro` (orange) and `MoveDisponible` (teal) in bar chart, legend, por categoría, and por descripción — no longer grouped as a single "Move" bucket.
- **Movement modal**: Move type chip shows teal→orange gradient border when selected. "A Disponible" button uses teal; "A Ahorros" uses orange. Info box adapts color to active direction.
- **Colors**: replaced all `var(--teal)` references with hardcoded `#26c6da` in JS (CSS variable remains in globals.css).

---

## [2.25.5] — 2026-06-18

### Fixed
- **Move bolsas independientes**: `moveDisponible` and `moveAhorros` are now tracked as separate fields in `PeriodoResumen` instead of a single net `moveTotal`. This fixes auto-ahorro (Move/aAhorro) being mixed into the retiros KPI and move count.
- **Color distinction**: Move/aAhorro → orange dot/amount; Move/aDisponible → teal (`--teal: #26c6da`). New CSS variable added.
- **Label**: "Retiros" KPI renamed to "Move disponible" and colored teal.
- **ahorrosAcum**: `PuntoTendencia.ahorros` now includes `moveAhorros` so projections and `ritmoAhorroActual` correctly account for moves to savings.
- **Sub-label**: removed "desde ahorros" from Move disponible KPI.

---

## [2.25.4] — 2026-06-18

### Added
- **iOS install banner**: bottom sheet that appears in Safari (iPhone, not installed) after 1.8s. Shows two-step guide with icons — share button + add to home screen. Animated arrow pointing to Safari toolbar. Dismissible; persists via localStorage.

---

## [2.25.3] — 2026-06-18

### Added
- **PWA splash screens (iOS)**: added `apple-touch-startup-image` for 6 modern iPhone sizes (SE/8, X/XS/11 Pro, 12/13/14, 14 Pro/15/16, Pro Max variants). Dark background with centered FM mark.
- **Maskable icon 192px**: added `icon-maskable-192.png` to manifest alongside the existing 512px maskable. `build-logo.js` updated accordingly.

---

## [2.25.2] — 2026-06-18

### Fixed
- **Auto-ahorro**: was creating `Ingreso/Ahorros` (no deduction from disponible) instead of `Move/aAhorro` (correct transfer from disponible to savings). Historical movements migrated via one-off script.

---

## [2.25.1] — 2026-06-18

### Performance
- **Cron notifications**: replaced single unbounded `movimientos` collection read (all docs) with three targeted queries — `checkCargaOlvidada` reads 1 doc, `checkSueldo` reads 50, `checkMeta` filters by investment tipo only. Eliminated duplicate `config/push` read per user per run.
- **Client movimientos cache**: `useAllMovimientos` now stores movements in `localStorage`. On load, shows cached data instantly and runs a single Firestore aggregation count query; only fetches all documents when the count differs (add/delete from another session). Edit and delete mutations update the cache in-place (0 Firestore reads).

---

## [2.25.0] — 2026-06-17

### Added
- **Movement quantity trend KPI**: Reports now show trend of movement count vs. previous 3 periods (like spending trend). Green if fewer movements, red if more.

### Changed
- **Movement KPIs layout**: Reorganized 2x2 grid — day/biggest on top row, trend/average on bottom. Improved visual hierarchy.
- **Expense KPIs**: Removed "Free Days" KPI from expenses section.

---

## [2.24.1] — 2026-06-17

### Changed
- **Currency selector styling**: Primary currency now displays with green $ icon badge (matching investment currency style). Selected currency button highlights with green background + border. Button disabled when currency matches current selection.
- **Settings account section reordering**: Rearranged section order: Profile → Google Linked → Google Sheets → Currency → Backup → Admin (improved UX flow).

---

## [2.24.0] — 2026-06-17

### Added
- **Permission change audit log**: Admin panel now tracks every permission activation/deactivation with reason (Fix / Bug / Error), timestamp, and who made the change. Stored in `users/{uid}/config/permisosLog` for full audit trail.
- **Reason selection modal**: When changing user permissions, admin selects reason before confirming. Reason included in user notification.
- **Permission history view**: Admin panel shows last 3 permission changes per user with date/time.

### Changed
- **Push notification format**: Now includes timestamp of permission change (e.g., "Se activó Imágenes por: Fix (16-jun, 20:52)").
- **Admin user status UI**: Single "Última conexión" row shows green dot + "online" if currently online, or date/time of last sign-in if offline.

---

## [2.23.7] — 2026-06-17

### Fixed
- **Firestore query optimization in cron**: Added date filtering to reminders cron (`.where("fecha", ">=", today)`) to skip expired reminders. Reduces read ops during notification cron runs.

---

## [2.23.6] — 2026-06-16

### Fixed
- **Rate limiting on `/api/register`**: Added in-memory rate limiter (10 requests per minute per IP) to prevent brute-force registration attempts and bot spam on the public endpoint. Returns 429 with `Retry-After` header when limit exceeded.
- **Authorization on `/api/sync-sheets` POST**: Only the owner can trigger manual Google Sheets sync (was allowing any authenticated user). Closes authorization bypass.

---

## [2.23.5] — 2026-06-16

### Fixed
- **Notification cron efficiency**: `notifyAllUsers` now batch-reads all `config/push` docs in parallel and filters to active subscribers before processing, reducing Firestore read ops by ~50%. Pairs with Cloud Scheduler frequency change to every 6 hours (not hourly).

---

## [2.23.4] — 2026-06-16

### Fixed
- **Service Worker: RSC hardening**: Next.js Server Component Responses (`_next/data/*` or `next-router-state-tree` header) now use network-first strategy (not cached), preventing stale component responses during internal navigations. Falls back to cache only if network fails.
- **Service Worker: safer caching**: use `req.url` instead of `req` object in `caches.put()` to avoid Cache Storage rejection edge cases.

---

## [2.23.3] — 2026-06-16

### Fixed
- **Movements list**: GastoUSD/GastoEUR (internal reserve reductions) are no longer shown in the movements historial, dashboard "Latest movements", or the `/movements` list. They only affect the investment reserve, not the main account balance.

---

## [2.23.2] — 2026-06-16

### Fixed
- **Investment average cost / profit**: `calcularReserva` now uses a moving weighted-average cost processed chronologically. Selling/spending reduces the cost basis at the average price (not only the quantity), so "Precio prom." and "Ganancia" reflect the remaining holdings. Previously every sell inflated the average and pushed profit deeply negative.
- **Back button to /home**: the landing "Ingresar" CTA navigates with `replace`, so a logged-in user pressing back no longer lands on the marketing `/home`.

### Changed
- **Projection tooltip**: states the 3-period horizon.

---

## [2.23.1] — 2026-06-16

### Fixed
- **User document on sign-in**: `ensureUserDoc` creates `users/{uid}` with `createdAt` on email/Google login. The parent user doc was never written (all data lives in subcollections), so it showed as a phantom doc in the Firestore console — no data was ever lost. Firestore rules now grant the user read/write on their own `users/{uid}` document; this does not cascade to subcollections, and `config/permisos` stays write-protected.

---

## [2.23.0] — 2026-06-15

### Added
- **Theme toggle on the landing**: sun/moon button next to the language toggle that switches the app theme via `useTheme` (shared `finmoves-theme` key, applies app-wide). The Settings theme toggle is untouched.

### Fixed
- **Landing in light mode**: carousel arrows now use theme variables instead of a hardcoded dark background.
- **Hero**: now shows the name-less app icon plus "FinMoves" as visible text (the previous wordmark logo + added text was redundant), keeping the app name as crawlable text for OAuth verification.

---

## [2.22.1] — 2026-06-15

### Changed
- **Legal routes renamed to English**: `/privacidad` → `/privacy` and `/terminos` → `/terms` (folders + `PrivacyContent`/`TermsContent` components), with permanent redirects from the old paths in `next.config`.

### Fixed
- **OAuth homepage requirements**: the landing now renders the app name "FinMoves" as visible text and names the product + purpose in the hero description. Google OAuth verification had flagged that the homepage didn't describe the purpose and the name didn't match the consent screen.

---

## [2.22.0] — 2026-06-15

### Added
- **Landing redesign**: the feature grid is now a single-row auto-advancing carousel (one large phone screenshot at a time, info above, swipe on mobile, arrows on desktop, dots) using the real `/screenshots/*` assets.
- **Bilingual landing (es/en)**: language toggle on the landing; copy switches via `useAppPrefs.lang` (persisted). SSR renders es.
- **SEO**: enriched root metadata (`metadataBase`, title template, rich description, keywords, canonical, robots, Open Graph + Twitter with `alternateLocale: en_US`), dynamic Open Graph image (`app/opengraph-image.tsx`, branded 1200x630), `app/robots.ts`, `app/sitemap.ts`, and `WebApplication` JSON-LD on the landing.

### Fixed
- **Navigation / history**: unauthenticated `/` now redirects to the landing `/home` (front door) instead of `/login`, via `router.replace`. The landing route was renamed `/inicio` → `/home` (folder `app/home`, `HomeClient`), with a permanent redirect `/inicio` → `/home` in `next.config`. Logout also lands on `/home`. Login and logout switched from `router.push` to `router.replace`, so the back button no longer returns a logged-in user to `/login`.

### Changed
- **manifest.json**: trimmed `categories` to the standard vocabulary (`finance`, `productivity`); added `launch_handler: navigate-existing` and `handle_links: preferred`.

---

## [2.21.0] — 2026-06-15

### Security
- **Server-side permission enforcement**: user entitlements (`comprobantes`, `inversion`) moved out of the client-writable `config/meta` into a dedicated read-only `config/permisos` document. Firestore rules now deny client writes to `config/permisos` and the new `permisosLog` subcollection — only the Admin SDK writes them. Previously any authenticated user could self-grant permissions by writing `meta.permisos` from the client. `obtenerConfig` reads the separate doc and injects it into `meta.permisos`, overriding any local value, so the three consumer sites are unchanged. `/api/admin/users` reads/writes the new location. One-off migration `scripts/migrate-permisos.js` backfills existing users. **Requires a separate `firebase deploy --only firestore:rules`.**

### Changed
- **PWA screenshots**: manifest points to `public/screenshots/*` (previous `/pwa-*.jpeg` paths were removed and broke the install preview). Six labeled narrow screenshots for the mobile rich install UI. Desktop rich install still needs `wide` screenshots (pending assets).

---

## [2.20.1] — 2026-06-15

### Fixed
- **Build break (hotfix)**: a duplicate `borderBottom` key in the admin user-list button's inline `style` (introduced in 2.20.0) failed TypeScript type-checking ("object literal cannot have multiple properties with the same name") and blocked the App Hosting framework build, leaving the 2.20.0 deploy stuck. Removed the redundant key — no visual change. Production kept serving the previous good revision throughout.

---

## [2.20.0] — 2026-06-15

### Added
- **Landing `/inicio`**: redesigned with gradient title, 4 feature cards using app screenshots (`pwa-*.jpeg`) as backgrounds with dark overlay and hover lift effect, staggered fade-in animations, PWA install button (via `useInstallPrompt`) alongside the CTA.
- **Landing — legal modals**: footer links for Política de Privacidad and Condiciones del Servicio now open inline modals; standalone pages at `/privacidad` and `/terminos` remain for Google OAuth verification. Legal content extracted to shared components (`PrivacidadContent`, `TerminosContent`).
- **Admin — user detail card**: users list shows only email + push dot; tapping a user opens a floating BottomSheet with last sign-in timestamp, push status, and permission toggles (comprobantes, inversion).

### Fixed
- **Plantillas**: sorted by `usageCount` descending (most used first); amount hidden from chip — visible only after selecting. `usarPlantilla` increments counter in Firestore on each apply.
- **Investments — goal badge**: `reachedBadge` ("ALCANZADA") now renders in the savings goal card header when the target is met; the translation key existed but was never wired to the UI.
- **PWA `start_url`**: reverted to `/` — dashboard lives at root via `(tabs)` route group; `/movements` was incorrect.
- **globals.css**: added `.screen-card` hover class (`translateY(-6px)` + blue glow box-shadow).

---

## [2.19.0] — 2026-06-15

### Added
- **Admin — permission toggles**: clicking a toggle now shows a confirmation modal before applying. On success the affected user receives a push notification (e.g. "Se activó Inversión en tu cuenta") that navigates them to Settings, effectively triggering a config reload.
- **Admin — re-copy invite codes**: clicking an available code in the Administración panel opens the copy card again so you can share it without generating a new one.

### Fixed
- **COOP blocking Google popup**: added `Cross-Origin-Opener-Policy: same-origin-allow-popups` header so Firebase Auth popups (`linkWithPopup`, `signInWithPopup`) can communicate `window.closed` correctly.
- **Google profile sync**: `syncGoogleProfile` now reads name/photo from the popup result (`providerData` + `getAdditionalUserInfo`) instead of `auth.currentUser.displayName` which is empty after linking.

### Changed
- **Profile card**: "Perfil" section replaces "Cuenta → Usuario". The edit card is now a draggable bottom-sheet with a photo/name header at the top and language flags inline next to the change-password button.

---

## [2.18.4] — 2026-06-15

### Changed
- Public contact email switched to **info@finmoves.app** (Privacy, Terms, landing, VAPID subject fallback). Owner/login email unchanged.

---

## [2.18.3] — 2026-06-15

### Fixed
- **CSP was blocking Google sign-in and web fonts** (and could break login): the production Content-Security-Policy didn't allow `apis.google.com`/`gstatic.com` (Firebase Auth / Google sign-in), `fonts.googleapis.com`/`fonts.gstatic.com` (fonts), nor the Google auth frames. Added those to `script-src`/`style-src`/`font-src`/`frame-src`.

---

## [2.18.2] — 2026-06-15

### Added
- **Public landing page** at `/inicio`: describes the app's purpose (movements, reports, investment, reminders), notes invite-only access, links Privacy/Terms and a sign-in CTA. Meant as the OAuth consent screen "home page" (public, no login wall).

---

## [2.18.1] — 2026-06-15

### Added
- **Public legal pages**: `/privacidad` (Privacy Policy) and `/terminos` (Terms of Service), unauthenticated, linked from the login footer — for the Google OAuth consent screen. Both note the closed, invite-code-only access.

---

## [2.18.0] — 2026-06-15

### Added
- **Sign in with Google**: button on login (registration stays closed by invite code — a brand-new Google account is rejected) and **Link Google** in Settings → Account. On link/sign-in, the Google **name overwrites** the stored name and the **profile photo is copied to Storage** (stable URL) and shown as avatar.

### Fixed
- **Admin permissions were written/read at the wrong doc level** (top-level instead of under `meta`), so per-user permissions (images/investment) and the name weren't applied/read. Now uses `meta.permisos` / `meta.nombre`. Permissions toggled before this fix need to be re-toggled.

---

## [2.17.1] — 2026-06-15

### Changed
- **Smarter reminders**: a pre-notice fires when ≤3 days remain ("in N days: …" / "tomorrow: …"), once (deduped via `avisadoPre`); the on-date notice then deletes the reminder (single final ping). Removed the obsolete `notified` state from the model/UI.

---

## [2.17.0] — 2026-06-15

### Added
- **Sell (Venta) reserve action**: new `VentaUSD`/`VentaEUR` movement type. A sale lowers the FX reserve (like Spend) **and** adds the ARS to the period's available (income). Stores the exchange rate. Cost-basis is left as-is (model A; realized-gain accounting deferred). Reserve recomputed correctly in Investment, Reports, goals and the cron meta check. Reserve type selector: Buy (green) · Sell (red) · Spend (blue).

### Changed
- **Add form — Type row is now 80/20**: types take the width; "Save as template" is an icon-only button (20%).
- **Movements — FX color**: Buy/Sell USD/EUR show in the yellow FX color (dot + amount, with their sign); plain expenses red, transfers orange, income green.

---

## [2.16.0] — 2026-06-15

### Changed
- **Reminders modal** is now a centered floating card (was a bottom sheet).
- **General section reorder**: Dark mode → Notifications → Reminders → Fingerprint unlock → Reports → Auto-savings. Fingerprint unlock moved here from Account.
- **Reminders access turns green** when there's at least one reminder loaded (orange otherwise).
- **Background scroll is locked** while any modal/sheet is open (new `useScrollLock` hook, used by BottomSheet, ConfirmModal, KpiInfoModal, MediaViewer, movement detail and the settings modals).
- **Back gesture/button no longer cycles through tabs**: tab navigation uses `replace` (BottomNav + swipe), so Back exits the app instead of walking the in-app history.

---

## [2.15.2] — 2026-06-15

### Fixed
- **Swipe nav broke scrolling inside modals**: all modals/sheets (BottomSheet, ConfirmModal, KpiInfoModal, MediaViewer, auto-savings, changelog, users, invite, sync log, movement detail) now carry `data-no-swipe`, so gestures starting inside them no longer trigger tab navigation. Since sheets are portaled to `body` and the swipe listens on `window`, this is what stops the conflict.

---

## [2.15.1] — 2026-06-15

### Changed
- **Auto-savings modal** is now a centered floating card (was a bottom sheet).
- **Notifications + Reminders** moved to the top of the General section (above Dark mode).
- Removed the non-actionable **"Main currency"** row from General (it couldn't be changed there).

---

## [2.15.0] — 2026-06-14

### Added
- **Admin panel (owner-only)** in Settings → "Administración": invite codes (lists only available ones, manual delete, **24h auto-expiry** for unused codes — enforced on registration + cron cleanup + on open) and a **registered users** list (email as primary, name + the invite code they used as secondary, push status dot).
- **Per-user permissions** managed by the owner, both **default OFF**: **Images** (receipt upload) and **Investment**. Enforced: no Images permission → no receipt option in the add sheet; no Investment permission → the user loses the Investment tab/section entirely and can't re-enable it (forced in `data-context`).
- APIs: `/api/admin/users` (GET list, POST set permission, owner-gated), `invite-codes` GET (available) / DELETE + 24h expiry.

### Changed
- **Settings reorg**: Notifications + Reminders moved into **General**; the Investment toggle + currency moved into the **Investment** section (above goal config), shown only when the user has the Investment permission.

---

## [2.14.2] — 2026-06-14

### Fixed
- **Bottom sheets mispositioned/translucent**: `BottomSheet` now renders via `createPortal` to `document.body`, so it's no longer captured by a transformed ancestor (the page's `.fade-up` animation uses `both` fill, which keeps a `translateY(0)` transform and creates a containing block). Fixes the Reminders sheet appearing mid-page and washed out; also hardens the reports modals and add/edit sheet.

---

## [2.14.1] — 2026-06-14

### Fixed
- **Swipe nav too sensitive**: gestures that start inside a horizontally-scrollable element (charts, carousels, year/period chips) no longer switch tabs. Raised the swipe threshold (80px and 2× horizontal-over-vertical).

### Changed
- **Update banner now shows on every new version** (was minor/major only). Removed the semver gate in `useUpdateBanner`.

---

## [2.14.0] — 2026-06-14

### Added
- **Push reminders**: two new cron-based notifications. **Forgot-to-log** ("it's been N days since your last movement", ≥3 days, deduped per gap, re-armed when you log again) and **custom reminders** (free text + date) created/managed from a new "Recordatorios" sheet in Settings (shown when notifications are on). Stored in `users/{uid}/recordatorios`; the cron sends on/after the date and marks them sent. New `services/firebase/recordatorios.ts`.

### Changed
- Salary reminder threshold 33 → **30 days**.
- **"Save as template"** moved to the top of the add form, next to Type (50/50 grid).

### Removed
- **New-version push notification** (the semver-based update banner already covers updates; removed the changelog-count push to avoid redundant pings).

---

## [2.13.0] — 2026-06-14

### Added
- **Expense templates (1-tap)**: save a frequent expense as a template ("Save as template" from the add form), then reload it with one tap from a chip row (prefills category, amount —editable—, description, payment method, notes). Each chip has an × to delete (with confirm). Stored in `users/{uid}/plantillas`. Templates show only for the Gasto type in add mode. New service `services/firebase/plantillas.ts`.

### Fixed
- **Move color on the Dashboard**: the Move type now uses `--orange` on the home screen too (was still `--yellow`; the edit was missed in 2.12.1).

---

## [2.12.1] — 2026-06-14

### Changed
- **Movements collapsed days**: each day is wrapped in its own card; collapsed days show a per-type count summary, colored (green income · yellow USD/dollars · orange Move · red expenses, expenses rightmost). The most recent day is always open.
- **New `--orange` color for the Move type** (`#ff6e40`), applied everywhere Move was shown (dot, amount, type button, onboarding legend, reports type maps, collapsed counts). Yellow now means only USD/dollars.
- **Update banner trigger is semver-based**: shows on MINOR/MAJOR bumps (compared client vs `/api/app-version`), silent on PATCH (auto-updates on cold start). `REQUIRE_UPDATE` kept as a manual override to force the banner on a critical patch.
- **CHANGELOG_USER curated by user-relevance** (benefit over mechanism); removed purely technical entries (2.10.3 install screenshots, 2.5.1 biometric reload, 2.3.1 analytics, 2.1.1 internal perf).

---

## [2.12.0] — 2026-06-14

### Added
- **Collapsible days in Movements**: only the most recent day starts expanded; older days collapse to a summary row (date · count · total spent) and expand on tap. Kills the infinite scroll over ~15 days. Switching period/year resets to the latest day open; editing doesn't collapse what you opened.
- **Shared `BottomSheet`**: extracted the canonical draggable sheet (peek/close drag) from MovementModal into `components/ui/BottomSheet`. The four Reports modals (salary history, direct-to-savings, top lists, day detail) now use it — salary/savings were old centered cards, the others had ad-hoc drag state.

### Changed
- **Update banner is now required-only**: the app auto-updates on the next cold start (no nagging). The banner only appears when the server reports a required update (`REQUIRE_UPDATE` in `lib/app-version`, exposed via `/api/app-version`) and the running version differs. The button is now "Update" (was "See changes"), has no dismiss X (persistent), and forces `SKIP_WAITING` + reload.

---

## [2.11.0] — 2026-06-14

### Added
- **Swipe navigation between tabs**: horizontal swipe moves to the adjacent tab, respecting the nav order and hidden tabs. Gestures starting within `[data-no-swipe]` (carousels, scrollable chips, media viewer, entry sheet) or within 24px of either edge are ignored, so the iOS back-gesture and horizontal scrollers keep working. Smooth `tabFade` transition on change.
- **Period stats — median & variation**: the Periods tab now shows the **median** spend per period (resistant to outliers, unlike the average) and a **variation** KPI (coefficient of variation, `±X%`) colored by regularity (green ≤25%, yellow ≤50%, red >50%). Best/worst period KPIs moved up next to them.

### Fixed
- **Next-period projection KPI** no longer repeats "average of last 3" twice in its explanation.

---

## [2.10.3] — 2026-06-14

### Added
- **PWA install screenshots**: the manifest now ships three `narrow` (mobile) screenshots (login, reports, settings), so the browser's install prompt and richer install UI show a preview of the app before installing.

---

## [2.10.2] — 2026-06-14

### Performance
- **Editing or deleting a movement no longer re-reads the whole collection**: the change is applied optimistically in memory (the Firestore write is awaited first, so the DB stays the source of truth). Eliminates N extra reads per edit/delete and makes the UI instant. New movements still do a full refresh (they can spawn carry-over/auto-savings docs).

### Fixed
- Edit/delete now show a visible error message if the write fails (previously only logged to console).

---

## [2.10.1] — 2026-06-14

### Changed
- **Modernized bottom sheet**: blurred backdrop, smoother decelerated entrance, larger radius and top shadow. The **grab handle is now functional** — drag down to shrink the sheet to a peek (without losing what you typed), drag up to restore, drag far down to close.

### Performance
- **Receipt images are compressed/resized on upload** (max 1600px, JPEG ~0.8) so they go from several MB to a few hundred KB and load much faster; uploads now set a long `Cache-Control` so re-viewing is instant.

---

## [2.10.0] — 2026-06-14

### Added
- **KPI detail card**: report KPIs (Expenses, Income, Movements, Periods) and the Investment goal mini-stats are now tappable — a centered floating card shows the **exact number** (un-abbreviated) plus a short explanation. Cards were stripped of secondary text for a cleaner look.
- **Unified floating confirm/detail modals**: deleting a movement, deleting categories/methods/origins (long-press), all Settings warnings (leave-to-GitHub, export, sign-out, language), the Investment history detail (read-only) and the salary raise history now open as centered floating cards instead of bottom sheets.

### Changed
- **Reports**: "vs previous period" now shows the **difference in $** (what the % represents) instead of the previous total; "fastest-growing category" shows the previous-period amount. Trend explanation clarified (red = spending more, green = less). The period **"Compare" button renamed to "Multiple"** (it selects several periods).
- **Investment**: average price + gain/loss merged into the reserve hero as a compact line (removed the two large cards), for USD and EUR.
- **Receipt viewer**: image framed (rounded corners + shadow) and the backdrop is more transparent so the app stays visible behind.

---

## [2.9.1] — 2026-06-14

### Added
- **In-app media viewer for receipts**: tapping a receipt opens a full-screen viewer inside the app instead of the raw Storage URL. Images support **pinch-zoom**, double-tap zoom and drag-to-pan; PDFs open in an embedded iframe. Close with ×, tap-outside or Escape. New `MediaViewer` component (no external deps).

### Fixed
- CSP `frame-src` now allows `firebasestorage.googleapis.com` so the PDF iframe isn't blocked in production.

---

## [2.9.0] — 2026-06-14

### Added
- **Reserve loading from the Investment screen**: a green floating "+" opens a dedicated **Reserve** modal (+Reserve / −Reserve) in the active investment currency. Reuses the FX logic (USD/ARS entry, official/blue rate). Compact ~3-tap layout: Type + Date on one row, "Enter in" + "Rate" in a single grid, rate pills without value (value shows in the editable input below).
- **Available / Remaining preview** in a +Reserve: subtle line under "Total ARS" showing the period's available balance and what remains after the purchase, live. Color by how much the purchase consumes: <30% green, 30–70% yellow, >70% (or negative) red.
- **Reserve history shows withdrawals too** (−Reserve), in red with a "−" sign, alongside purchases. Title is now "USD/EUR history".
- **History detail (read-only)**: tapping a history row opens a read-only detail (Type · Category · Date, Quantity + Rate, Amount, Description, Notes, receipt link). Editing remains only from Movements.

### Changed
- **Reserve loads removed from the regular movement modal** (the +/− USD/EUR pills); they now live only in the Investment screen. Editing existing reserve movements still works from Movements.
- Investment history limited to the **last 5** with a "see more / see less" toggle.

---

## [2.8.1] — 2026-06-14

### Fixed
- **UI prefs leaking between users on the same device**: `monedaInversiones`, `showAhorros` and `showReportes` were stored only in `localStorage` (device-global) and never cleared on logout, so a different account's currency/section choices bled into yours. They are now persisted **per-user in `config.meta`** (Firestore is the source of truth), **hydrated from config on load** (in `DataProvider`), and the prefs store is **reset on every sign-out** (manual logout, password change, 8h inactivity, biometric "use password"). Settings/onboarding toggles now write these prefs to config.

---

## [2.8.0] — 2026-06-14

### Added
- **Manual exchange rate** (Settings → Investment): a switch toggles between automatic (bluelytics) and a manual value. When manual is on, the entered rate replaces the official rate **in the investment valuation** for the active investment currency. Stored per-user in config. The Investment section header shows `manual` instead of `oficial` when active.
- **Delete via long-press**: long-pressing a movement (Movements list or Home) opens the delete confirmation directly (short haptic). The trash icon was removed from the edit modal. A salary that anchors a period still can't be deleted (long-press opens edit instead). New `useLongPress` hook.

### Changed
- **The user's exchange rate is now always the official one** (blue is only selectable when loading an FX purchase/expense). Default config `tipoCambioRef` changed `blue → oficial`; the dead blue/oficial selector in the Investment page was removed.
- **Investment header**: big gradient title is now the section name (**Inversión** / Portfolio) with the currency moved to the small eyebrow.
- **Reports are no longer configurable**: the per-section KPI/Other-data toggles were removed (along with `useReportConfig`); the Reports screen always shows everything. Only the on/off toggle in General remains.
- **Settings → Account opens by default** when entering Settings.
- **Edit movement** layout: read-only chips (Type · Category · Date) on one row, then an editable **Amount 30% / Description 70%** row; receipt is a compact 📎 next to **Notes 70% / Receipt 30%**. "Notes" dropped the "(optional)" suffix.
- **Changelog modal**: the header "+" was replaced by a **"see more"** link at the bottom (italic, same pattern as Home/Reports) that opens the full web changelog with the leave-site warning.

### Removed
- **Vercel** fully removed: `@vercel/analytics` + `@vercel/speed-insights` packages and their components in `layout.tsx`, plus the `.vercel` gitignore entry. Firebase Analytics (GA4) stays.

---

## [2.7.0] — 2026-06-14

### Added
- **Smart description suggestions**: the description field autocompletes from your own past expense descriptions, filtered by the selected category (top 8 by frequency, native datalist).
- **Changelog "+"**: a button in the changelog modal opens the full `CHANGELOG_USER.md` on the web (GitHub), with a "you're leaving the site" confirmation first.

### Changed (new-movement form)
- Receipt attach moved to the bottom row — grid is now **Notes 50% / Receipt 25% / Submit 25%** — and works for all types (incl. Move/FX). The attach is just a larger 📎 icon (no dashed box).
- **Reserve loads (+USD/-USD/+EUR/-EUR) are hidden when the Investment section is off** (`showAhorros`).

### Repo
- GitHub repository renamed to `dsimdev/finmoves.app`; local remote updated.

---

## [2.6.2] — 2026-06-14

### Changed (new-movement form)
- **Receipt attach is now a single icon** at the right of the payment-method row (same grid), instead of a full dashed box. Shows a small thumbnail/📄 with remove when attached.
- **Notes + submit share one row** (70% notes / 30% submit checkmark).
- The auto-savings hint now only appears **once a description is entered** (and still hidden for skip-list descriptions).

---

## [2.6.1] — 2026-06-14

### Changed (new-movement form)
- **Amount is now the first field**, on a compact row next to the date (which is pre-filled), so the most common entry is faster. The standalone amount/date fields below were removed.
- Home shortcut relabeled **"Movimiento"** / "Movement" (kept "Movement" in EN since "Move" is already the transfer type).

---

## [2.6.0] — 2026-06-14

### Added
- **Receipts now accept PDFs** (not just images): file picker accepts `image/*,application/pdf`, non-image attachments show a 📄 PDF tile (click to open). `storage.rules` updated to allow `application/pdf` (≤10 MB) — **re-publish the rules in the console**.

### Changed
- Home "New movement" shortcut label shortened to just **"Nuevo"** (the modal title stays "Nuevo movimiento").

---

## [2.5.1] — 2026-06-14

### Fixed
- Removed the `controllerchange` → `window.location.reload()` in the service worker registration. It was a leftover from the old skip-waiting update flow and could reload the page right when unlocking with biometrics, so the update/changelog notice never had a chance to appear. SW updates still apply silently on the next cold start.

---

## [2.5.0] — 2026-06-14

### Added
- **Receipt attachments**: attach **one image per movement** (add & edit) stored in **Cloud Storage** under `users/{uid}/comprobantes/`. Thumbnail with open/replace/remove; the file is deleted when the movement is deleted. New `comprobanteUrl`/`comprobantePath` fields. Feature-gated to the owner for now (`canComprobante`), trivially extendable to a premium tier later.
- `storage.rules` added (per-user isolation, images only, ≤10 MB). Firebase Storage must be enabled and the rules published in the console.

---

## [2.4.2] — 2026-06-14

### Fixed
- The auto-savings hint ("+$X to savings") in the new-expense form now respects the **skip-descriptions** list: if the typed description is one that auto-savings ignores, the hint no longer shows (matches the actual behavior, cleaner form).

---

## [2.4.1] — 2026-06-14

### Performance (service worker)
- Immutable `/_next/static/` assets are now served **cache-first** (they're content-hashed, so they never change) instead of stale-while-revalidate — removes redundant background re-fetches on every load, cutting non-cached CDN requests.

---

## [2.4.0] — 2026-06-14

### Added
- **Bidirectional Move**: the Move form now has a direction toggle — **To Available** (classic: Savings → Available) and **To Savings** (new: Available → Savings). Both net into the same `moveTotal` (signed) and the same accumulated-savings pool, with opposite signs: "To Savings" lowers the period's available and raises accumulated savings. New `direccionMove` field; legacy Moves default to "To Available". Shown with a "−" sign where it leaves the available balance.

---

## [2.3.2] — 2026-06-13

### Changed (cron / notifications)
- The cron can now run frequently (e.g. hourly) for timely notifications: the **Sheets sync self-throttles to ~once a day** (`lastAutoSync` guard) while notifications are evaluated on every run.
- **Dollar-change alert is now frequency-independent**: the baseline re-anchors only when an alert fires, so it measures the *cumulative* move since the last alert instead of run-to-run (a gradual 3% daily move now triggers even when the cron runs hourly).

---

## [2.3.1] — 2026-06-13

### Added
- **Firebase Analytics** (GA4) initialized client-side only, guarded by `isSupported()` (`lib/analytics.ts` + `FirebaseAnalytics` component). `measurementId` added to the Firebase config (public, with literal fallback so it works without a new secret).
- CSP `script-src` now allows `https://www.googletagmanager.com` (gtag loader).

---

## [2.3.0] — 2026-06-13

### Changed (onboarding)
- Refreshed the onboarding wizard: updated the "how it works" step for the new salary flow (add to current / new period, leftover → Savings), added a **"Movement types"** step (Expense / Salary / Move / USD-EUR) and expanded the savings/reserve explanation.
- New **"Security & alerts"** step lets users enable **fingerprint unlock** and **notifications** right from onboarding (with availability checks), instead of only later in Settings.

---

## [2.2.0] — 2026-06-13

### Added
- **Update notice every 5 versions**: a banner (logo + spinner, like the loading screen) appears once ≥5 releases have shipped since the user last saw it. "See changes" opens Settings with the changelog modal (`/settings?changelog=1`). Dismiss/open marks the current version as seen; the count accumulates across patches instead of nagging on every one.
- The **new-version push** is aligned to the same 5-version cadence and deep-links to the changelog. Version distance is computed from `CHANGELOG_USER.md` (`lib/changelog-versions.ts`, shared client/server).

---

## [2.1.4] — 2026-06-13

### Fixed
- **Euro rate for new users**: exchange rate now comes from a server-cached `/api/cotizacion` route (shared across users + survives cold starts) with a `localStorage` fallback, and keeps the last good euro value if the upstream omits it. Fixes empty/wrong euro for fresh sessions.
- **Initial reserve follows the investment currency**: new `saldoEUR` config field. In EUR mode the "Initial reserve" field reads/writes/labels as EUR (was always USD, so an EUR user's seed was ignored). USD data untouched. Applied across Investments, Reports and savings-goal notifications.

---

## [2.1.3] — 2026-06-13

### Changed
- **Salary deletion rule**: a salary that **opens a period** (its date defines the `periodoId`) is the anchor and **cannot be deleted**; a salary **added to the current period** is now deletable. Detected via `fechaAPeriodoId(fecha) === periodoId`.
- Delete confirmation now shows an **"can't be undone"** warning (irreversible-action notice).

### Fixed
- Reverted EN dashboard title back to "Dashboard" (the "Resumen" rename is Spanish-only).

---

## [2.1.2] — 2026-06-13

### Changed
- **Home renamed "Tablero" → "Resumen"** (ES) / "Summary" (EN).
- Home shortcuts reordered: New movement · Investment · Reports.
- Offline banner moved from bottom to **top**.
- Loading spinner ring tightened around the logo (260→180px).

### Docs
- README fully updated (was stale at v1.14.5 / Vercel): Firebase App Hosting, custom domain, current routes, security, and the **mandatory deploy checklist** (incl. updating README every release).

---

## [2.1.1] — 2026-06-13

### Performance
- `MovementModal` no longer fetches `config/meta` on its own — it receives `config` as a prop from the shared `DataProvider`. Removes a duplicate Firestore read on every visit to Home and Movements.

### Security
- **Content-Security-Policy** header added (production only): locks down `object-src`, `base-uri`, `form-action`, `frame-ancestors`, restricts `frame-src`/`connect-src`. `script-src`/`style-src` keep `'unsafe-inline'` (required by Next/React inline scripts and `style={{}}`).
- **Invite-code registration is now atomic**: the code is reserved inside a Firestore transaction before creating the account, preventing a parallel-request race that could reuse one code twice. The code is released if account creation fails.

---

## [2.1.0] — 2026-06-13

### Added
- **Salary period control**: when adding a salary income, non-owner users get a **"Add to current / New period"** toggle. The owner and the first-ever salary always open a period (no choice). Lets daily/variable earners (e.g. a photographer) log income throughout a cycle and decide when a new period starts.
- **Period close + carryover**: opening a new period now moves the previous period's **leftover available** into the new one as a `RESTO` movement (counts as Savings) — implements the close/carryover that was previously only done by the obsolete Google Form.
- **Editable description on salary movements** (add + edit). Delete stays locked for salaries (they anchor the period).

### Changed
- **Password change** now **reauthenticates** with the current password (new "current password" field), fixing `auth/requires-recent-login`. On success it signs the user out and redirects to login to sign in with the new password.
- Movements floating **+** button visibility **inverted**: hides while scrolling, reappears when idle (no longer covers the list).

### Removed
- **Test notification** button and the `/api/push-test` endpoint.

---

## [2.0.0] — 2026-06-13

Milestone release marking the move to **Firebase** as the single home for the app
(frontend on App Hosting + Firestore + Google Cloud). No breaking changes for users;
the major bump marks the platform/infra shift and the body of work shipped in the 1.2x–1.30 line.

### Highlights since 1.2x
- **Platform**: migrated hosting from Vercel to **Firebase App Hosting** (`apphosting.yaml`, secrets via Secret Manager, scale-to-zero); daily cron moved to **Cloud Scheduler**.
- **PWA standard**: adaptive theme-color via `viewport` export, real `/offline` page, SW precache + navigation preload, install button, manifest shortcuts.
- **UX**: New/Edit movement modals open from Home; app icon badge; reusable `MiniStat`; touch-friendly Reports period selector; investments & dashboard redesign.
- **Performance**: single shared `DataProvider` (movimientos + config fetched once per session).
- **Notifications**: all-users push with savings-goal milestones and salary reminders (idempotent).
- **i18n**: full ES/EN sweep including page titles.

---

## [1.30.0] — 2026-06-13

### Added (notifications)
- Cron now notifies **all users** with a push subscription (was owner-only): new version + dollar change, plus two new triggers — **savings-goal milestones** (50/75/100%) and a **salary reminder** when a period is overdue (>33 days).
- Sheets sync + sync-failure alert remain **owner-only**.
- All notification triggers are **idempotent** (deduped via `config/notifyMeta`), so the Cloud Scheduler job can run more than once a day without spamming. New `lib/notifications.ts`.

---

## [1.29.2] — 2026-06-13

### Removed
- Update banner ("new version available"). The service worker now applies updates silently on the next cold start; removed `UpdateBanner` + `useSwUpdate`.

---

## [1.29.1] — 2026-06-13

### Fixed
- Push notifications: `enablePush` now always unsubscribes any stale subscription and re-subscribes with the current VAPID key (fixes activation breaking after the VAPID pair was regenerated). Toggle surfaces the real error if it still fails.

---

## [1.29.0] — 2026-06-13

### Added
- Reusable `components/movements/MovementModal` (add/edit/delete) extracted from the Movements page.
- Dashboard now opens the New movement and Edit modals **in place** (no navigation): the "New movement" shortcut and tapping a recent movement open the modal on Home.
- App icon **badge** (Badging API) showing the current period's movement count on the installed app.

### Performance
- Single shared `DataProvider` (movimientos + config) at the tabs layout: data is fetched **once per session** and reused across tabs instead of re-fetching the whole collection on every tab switch — large cut in Firestore reads.

### Infra
- Added `apphosting.yaml` for Firebase App Hosting (scale-to-zero, env via Secret Manager). Cron must move to Cloud Scheduler (vercel.json is inert on Firebase).

---

## [1.28.0] — 2026-06-13

### PWA standard
- Unified, theme-aware `theme-color` (dark `#07090f` / light `#c8c8c8`) kept in sync by `applyTheme`; migrated `<head>` `theme-color`/`viewport` to Next's `viewport` export.
- Added a real cached `/offline` fallback page (shown by the SW when offline and the route isn't cached).
- Service worker: precache the offline page + core icons (best-effort `cache.add`), enabled **navigation preload**, navigation fallback now `req → / → /offline`.

### Refactor / cleanup
- Extracted the duplicated Sheets-sync core into `lib/sync-sheets.ts` (`syncUserMovimientosToSheet`); manual and cron routes now share it.
- Single reusable `components/ui/MiniStat` (was duplicated in Reports, Investments and Dashboard); Movements now uses the shared `EyeIcon`.
- Extracted the inline theme bootstrap to `lib/theme-init.ts` (single source for light vars + theme colors, used by `useTheme` too).
- Removed the unused `/api/version` route.
- Reorganized `components/` into `ui/`, `pwa/`, `nav/`.
- `.gitignore`: ignore local `/scripts/`.

---

## [1.27.1] — 2026-06-13

### Changed
- Regenerated/optimized app icons and logo (smaller files). Version bump refreshes the service-worker cache so devices pick up the new icons.
- `.gitignore`: ignore local `/scripts/` (asset generators, not part of the app).

---

## [1.27.0] — 2026-06-13

### Changed (Dashboard redesign)
- KPIs (Salary/Spent/Savings/Withdrawals) restyled as consistent `MiniStat` cards.
- Added a quick-actions row: New movement · Reports · Investments.
- Latest-movements rows are now tappable; tapping deep-links to Movements and opens that movement in the edit modal (`/movements?m=<id>`).

### Changed (Movements / Investments)
- Movements list: removed the per-row pencil button; tapping anywhere on a movement opens the edit modal (larger tap target).
- Investments mini-stats: restored the standard border (matches Reports) now that the Goal card is neutral.

---

## [1.26.0] — 2026-06-13

### Changed (Investments redesign)
- Applied the Reports "Hero + mini-stats" pattern: reserve hero (USD/EUR) kept the yellow gradient; Goal and history cards now use the neutral surface gradient with standard borders.
- Reserve avg-price/profit and Goal stats moved into borderless `MiniStat` cards; profit shows signed % as sub.
- Cleaner hero rate line ("≈ $… · oficial $…", dropped "cotiz.").
- Unified metric window to the **last 3 periods** for the Goal mini-stats (Per period, Projection, To goal); "Per period" now uses avg saved (was lifetime/accumulated). Numbers formatted with thousands separators.
- Labels to sentence case (Precio prom., Ganancia).

---

## [1.25.1] — 2026-06-13

### Changed
- Settings: Backup icon now uses the accent color (matches the invite-code row).
- Removed redundant right-pointing chevrons on action rows (profile, invite code, change-password) — the icon/row itself performs the action.
- Sync (Google Sheets): removed the separate clock button; the whole row now opens the sync history (consistent with other config rows). Retry-on-error button kept.
- Reports/Expenses: "fastest-growing category" card now uses the standard border (gradient kept); removed the multi-period "Días" mini-stat.
- Reports period selector reworked for touch: replaced long-press multi-select with an explicit "Comparar" toggle (single tap selects one; in compare mode taps add/remove periods, year tap toggles the whole year); larger tap targets.

---

## [1.25.0] — 2026-06-13

### Added (i18n — Bloque 2)
- Full i18n sweep of remaining hardcoded UI strings; no database values were altered.
- Page gradient titles now translate (Dashboard/Movements/Reports/Settings + Dollars/Euros).
- New common keys: `edit`, `copy`, `clear`, `show`, `hide`, `of`, `movementsShort`, `unexpectedError`, `byPaymentMethod`, `rateOfficial`/`rateBlue`, `pageTitle*`, `currencyDollars`/`currencyEuros`.

### Changed
- Dashboard "de … · N mov.", Movements editor labels (Type/Category/Date), "Notes (optional)", delete "Cancel", aria-labels (Edit/Clear/Copy/Show/Hide), Reports "Por medio de pago", Investments rate name (oficial/blue) — all now go through the translation layer.

### Notes
- Brand/technical terms left as-is by design: Google Sheets, GitHub, Backup, Changelog.

---

## [1.24.2] — 2026-06-13

### Added
- Profile modal: **change-password** is now a collapsible row (lock icon → reveals field with show/hide eye + 6-char hint); no empty input dangling.
- Active-state colors: **biometric** and **notifications** icons turn green when enabled.

### Changed
- Invite code: removed the "Generate" button; the whole row is the action and the icon shows a spinner while generating (owner only).
- Profile "Save" button is disabled until there are actual changes (name edited or new password typed).
- Reports/Income: "Evolución ingresos" chart now uses the standard card border (removed the green tint) for visual consistency.
- Reports savings projection now defaults to **3 periods** (was 6).

### Fixed
- Biometric lock no longer hides the update prompt: `UpdateBanner` is now mounted on the lock screen, so a new version can be applied without unlocking first.

---

## [1.24.1] — 2026-06-13

### Added
- **Install app** button in Settings (uses `beforeinstallprompt`; shown only when installable and not already installed).
- Manifest **shortcuts** (New movement · Reports · Investments), `display_override` and `prefer_related_applications`.

### Notes
- Manifest screenshots pending real captures.

---

## [1.24.0] — 2026-06-13

### Added
- **User profile modal** — tapping the User row opens a modal to edit name and change password. Once a name is set, the user icon turns green and the name replaces "User".
- Language flags moved into the profile modal.
- **Guide section** in Settings (below Reports): explains how the app works + what each section does, with a "Replay the tutorial" button that reopens the onboarding in replay mode (without touching config).

---

## [1.23.3] — 2026-06-13

### Changed
- Reports → Periods: hide the period selector (year + period pills) since it's a historical view of all periods, not a single one.

---

## [1.23.2] — 2026-06-13

### Changed
- Reports → Periods fully redesigned: removed the 6 per-period KPIs that duplicated other sections (Salary, Withdrawals, Spent, Available, Projection, Remainder). Now it's a clean historical/comparative view — hero "Avg. spent / period", Best/Worst mini-stats, and the three period charts (spent per period, expenses vs salary, income evolution).

---

## [1.23.1] — 2026-06-13

### Changed
- Reports → Movements redesigned: hero with total + per-type distribution bar/legend, plus mini-stats (most active day, avg per day, biggest movement — excluding salary/remainder).

---

## [1.23.0] — 2026-06-13

### Changed
- Reports → Income redesigned to hero + mini-stats (Salary still opens raise history; Savings projection keeps its 3/6/12p toggle).
- Income: removed "By category", kept "By description" — now counting Salary and previous-period remainder (previously filtered).
- Income "Direct to savings": shows last 5 with a "see more" modal.
- Reports cards use a consistent subtle border (heros included).

---

## [1.22.5] — 2026-06-12

### Changed
- Reports → Expenses mini-stats polished: top row in 3 columns (centered), second row in 2 columns (centered), reordered, and labels shortened to remove the repeated "expense/gasto" (Daily pace, Daily average, Peak day, Avg. per item, Free days).

---

## [1.22.4] — 2026-06-12

### Fixed
- Reports → Expenses: mini-stats now use a flex-wrap layout so the last incomplete row stretches to fill the width (no more empty black gap).

---

## [1.22.3] — 2026-06-12

### Fixed
- Reports → Expenses: mini-stat values were getting cut off; amounts now use a compact format ($1,6M / $109k) so they fit.

---

## [1.22.2] — 2026-06-12

### Changed
- **Guided new-user start** — with no period yet, the New movement form only offers Income → Salary (other types hidden, category forced) to steer the user into opening their first period.
- Dashboard "see more" is hidden when there are 5 or fewer movements.
- The Google Sheets sync row is now shown only to the owner.

---

## [1.22.1] — 2026-06-12

### Fixed
- **New users couldn't add their first movement** — there was no active period, and the form required one. Now the first Salary opens the period using its own date.
- Salary description box no longer shows the Move text (it was hardcoded in English); now correctly says "The salary opens a new period" / first-period variant, translated.

### Changed
- **USD initial reserve is now per-user config** (`saldoUSD`) instead of a hardcoded 5.77 — new users start at 0. Added an "Initial reserve (USD)" field in Settings → Investments to set it.
- New movement modal fully translated (labels, texts, aria-labels) via i18n.
- Reports → Expenses redesigned: Hero (Spent) + compact neutral mini-stats.
- Reverted the "Code" row back to its full title + subtitle.

---

## [1.22.0] — 2026-06-12

### Added
- **Invite-code access** — new accounts are created via a single-use code. The login has a "Create account" form (email + password + code); `/api/register` validates the code with the Admin SDK and seeds a generic starter config. Firebase public signup stays closed.
- **Invite-code generator** (owner only) — Settings → Account → "Code" → Generate; opens a modal with the code and a copy button.
- **Password recovery** — "Forgot your password?" on the login (Firebase reset email).
- **Onboarding wizard** (bilingual) for new users: Welcome → How it works → Main currency → Investing? → Done. Redirects there automatically until completed (`onboardingCompleto` flag).
- **PWA manifest completed** — added 192/512 icons, a separate maskable icon with safe zone, apple-touch-icon, plus `id`, `scope`, `orientation`, `lang`, `categories`.

### Changed
- New users get a **generic default config** (neutral categories/methods) instead of the owner's personal data.
- Movements "+" FAB raised a bit so it no longer overlaps the bottom nav.

### Fixed
- LCP warning: the loading spinner image now uses `priority`.

### Notes
- Requires `NEXT_PUBLIC_OWNER_EMAIL` in Vercel for the invite-code generator to appear in production.

---

## [1.21.1] — 2026-06-12

### Added
- **Test notification** — `/api/push-test` endpoint (auth-protected) and a "Test" button next to the Notifications toggle to fire a sample push on demand

---

## [1.21.0] — 2026-06-12

### Added
- **Push notifications** — opt-in toggle in Settings → Account (shown only on supported devices). Subscribes via Web Push (VAPID), stores the subscription in Firestore (`users/{uid}/config/push`), and the service worker renders the notification + handles clicks
- Three server-side triggers wired into the existing daily cron (no extra cron needed):
  1. **Sync failure** — notifies when the daily Google Sheets sync fails
  2. **New version** — notifies once when the deployed build version changes
  3. **Dollar move** — notifies when the official USD rate moves ≥3% vs. the previous day
- `lib/web-push.ts` (server send helper; auto-removes expired subscriptions on 404/410) and `lib/push-client.ts` (permission + subscribe/unsubscribe)

### Notes
- Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars in Vercel
- Works on the installed PWA (Android; iOS 16.4+ installed to home screen)
- Triggers evaluate once per day with the cron; version/dollar checks compare against the previous run, so the first run only seeds the baseline

---

## [1.20.0] — 2026-06-11

### Changed
- **Investments page redesigned** — from 6 stacked cards down to 3 blocks: Reserve (hero) · Goal (consolidated) · History
- The four goal-related cards (savings goal, goal per period, projection, periods-to-goal) merged into a single **Goal** card: objective + progress bar on top, a row of inline mini-stats (Per period · Projection · To goal) below
- Currency symbol no longer repeated on every number — kept only on the Reserve headline and the goal objective; remaining figures are clean (remaining, per period, projection, history)
- Purchase history rows no longer append "USD"/"EUR" to each amount

---

## [1.19.0] — 2026-06-11

### Changed
- **Settings fully restructured into a single screen** — tabs removed; everything is now an accordion (one section open at a time). Order: Account (with Sync inside) → General → Movements → Investments → Reports → App row → logout
- **Categories / Methods / Origins → color chips**: tap to toggle (dimmed = off), long-press to delete (chip turns into a trash-confirm, auto-cancels after ~3s); categories grouped by type so new ones land at the end of their group
- **Reports toggles → chips** as well
- Language switch now opens a **confirmation modal** (flag + "Change language?") and reloads to Home on confirm
- Logout now opens a **bottom-sheet confirmation** (red button) instead of inline confirm
- Investments savings-goal: date + target side by side, tighter spacing, label shortened to "Target (currency)"; the destructive trash was replaced by a **broom that only clears the inputs** (user saves with the check)
- App block: removed the logo; GitHub + version/changelog + logout sit in one row
- Changelog modal now shows only the **last 5 versions**

### Added
- **User-facing changelog** (`CHANGELOG_USER.md`) — the in-app changelog reads this curated, plain-language file (highlights new features); the full technical `CHANGELOG.md` stays on GitHub

### Fixed
- **Update banner rebuilt around the service worker (proper PWA pattern)** — the SW is now served from `/sw.js` with the build version injected, so each deploy is detected; the new SW waits instead of activating silently, the banner offers to update, and confirming sends `SKIP_WAITING` → `controllerchange` → reload. Replaces the version-polling approach that the service worker had silently superseded

### Notes
- The update-banner change only validates in production; the first deploy with it is a transition (replaces the old SW). Reliable banner behavior starts from the second deploy that includes this system

---

## [1.18.1] — 2026-06-11

### Fixed
- **Sync history** now records automatic daily syncs too — previously the cron only stored "last sync / last error", so the history modal looked almost empty. Each cron run (success or failure) is now logged (last 30 entries)

### Added
- **Sync failure indicator** — a red dot appears on the Settings icon in the bottom nav when the latest sync failed, visible from any screen, so you know to take action

---

## [1.18.0] — 2026-06-11

### Added
- **Fingerprint unlock (opt-in)** — enable it in Settings → Account. When on, the app opens to a lock screen that asks for your fingerprint before revealing your data:
  - Uses the device platform authenticator via WebAuthn (`userVerification: required`)
  - Acts as a local UI gate over your active Firebase session — if the fingerprint fails or is cancelled, you can fall back to password (sign out → login)
  - The toggle only appears on devices that have a biometric sensor

### Notes
- Fully opt-in and backward-compatible: if you don't enable it, nothing changes
- Only works over HTTPS (production); test it on your phone after deploy
- The device decides which biometric method it presents (fingerprint on Android); the API can't force a specific one

---

## [1.17.0] — 2026-06-11

### Added
- **Offline support** — the app now works without a connection:
  - Firestore persistent cache (IndexedDB): your movements stay available offline and writes are queued until you reconnect
  - Service worker caches the app shell so FinMoves opens with no network (network-first when online, cache when offline)
- Redesigned **update banner**: glassmorphism card, blue glow, properly proportioned spinner (no longer overlaps the logo), gradient action button

### Changed
- App icon (`favicon.png`) regenerated from the source logo — sharper, square, text-free

### Notes
- Offline behavior only activates in production (requires HTTPS + a real build); the service worker takes effect after the first deploy that includes it

---

## [1.16.0] — 2026-06-11

### Added
- **Redesigned login** — modern minimalist look: icon + placeholder fields (no labels), taller inputs, blue/green background glows, glassmorphism card, show/hide password toggle, gradient sign-in button. Submits on Enter. Fully bilingual (ES/EN)
- **Human-readable auth errors** — Firebase error codes are mapped to clear messages ("Incorrect email or password", "Too many attempts…", "No connection…") instead of raw `Firebase: Error (auth/...)` strings; technical detail still logged to console
- **Session auto-logout** — the session now closes after 8 hours of inactivity (resets on any interaction), persisted across reloads and PWA restarts via localStorage
- **Error & 404 safety net** — added `error.tsx` (in-app error boundary with retry + visible technical detail), `global-error.tsx` (root-layout fallback), `not-found.tsx` (branded 404), and an **offline banner** that appears when the network drops
- Settings save errors now use the same human-readable mapping

### Notes
- True offline support (app opening without network via a service worker) is not included yet — the offline banner only signals the disconnection
- Passkey / biometric unlock is planned as a follow-up

---

## [1.15.2] — 2026-06-11

### Security
- **Formula/CSV injection hardening** — movement text fields starting with `= + - @` are now neutralized (prefixed with `'`) before being written to Google Sheets and to the CSV backup, so they can't execute as formulas
- **Versioned Firestore security rules** — `firestore.rules` is now tracked in the repo (per-user isolation: `request.auth.uid == userId`)
- **Server-only owner UID** — the daily cron now reads `OWNER_UID` instead of exposing it as a `NEXT_PUBLIC_` client variable
- **HTTP security headers** — added `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS across all routes

---

## [1.15.1] — 2026-06-11

### Changed
- Investments → "Periods to reach goal" card: trimmed the redundant "periods" word from the subtitle (now "at the pace of the last 3")

---

## [1.15.0] — 2026-06-11

### Added
- **Multilingual support (Spanish / English)** — the entire UI can now be switched between Spanish and English
  - New language selector in Settings → Account: tap the Argentine 🇦🇷 or British 🇬🇧 flag to switch instantly; the active flag is highlighted and the choice persists across sessions (localStorage)
  - Flags are rendered as crisp inline SVG icons (no emoji), so they display consistently on every OS including Windows
- New i18n architecture: `locales/es.ts` + `locales/en.ts` hold every UI string, surfaced through a lightweight `useT()` hook — no extra dependencies

### Changed
- Every screen (Dashboard, Movements, Investments, Reports, Settings) and the update banner now pull their labels, headings, buttons, placeholders and error messages from the active locale
- Movement type labels are translated for display (Gasto → Expense, Ingreso → Income, Move → Transfer, etc.) while the values stored in Firestore stay unchanged
- Report day-of-week names and CSV export headers follow the selected language

### Fixed
- Update banner now actually triggers: the version check runs immediately on mount (instead of waiting 60s) and re-runs whenever the app returns to the foreground — essential for the installed PWA
- `/api/version` now sends `no-store` cache headers so neither Vercel's edge nor the browser serve a stale version

### Notes
- User-created data (categories, payment methods, savings origins) and stored values are never translated — only the app's own UI text
- Number and date formatting remain in Argentine locale (`es-AR`) regardless of language

---

## [1.14.6] — 2026-06-10

### Added
- Update banner: when Vercel deploys a new version, a full-screen overlay appears with the app logo, spinner, and an "Actualizar" button — prompts the user to reload
- Version polling: `/api/version` endpoint checked every 60s; banner shows when build version differs from server version

### Changed
- Dashboard: last 5 movements shown (was 6); "+" button replaced with italic "ver más" link to /movements
- Movements: header shows "Resto" instead of "Disponible" for closed (past) periods
- Investments: projection and meta-period cards are now center-aligned; "p" suffix removed from periods count
- Auto-ahorro: generated movement now has observation "por gasto"
- LoadingSpinner: ring colors updated to blue/green gradient; container enlarged to 260×260

---

## [1.14.5] — 2026-06-10

### Added
- Auto-savings: "Descripciones a omitir" — add descriptions that skip the auto-savings rule (case-insensitive match); shown in the row subtitle when configured
- Auto-savings confirm button now only enables when there are actual changes vs. saved config

### Changed
- Settings: Sync card moved above Personalization card
- Settings > General tab renamed to "General" (pill)
- Reports > Gastos > Por día bars are now tappable — opens a bottom-sheet with all expenses for that day (swipe up to expand)
- Reports > Movimientos: Por categoría shows top 5 and opens full modal on tap; Por medio de pago removed
- Reports > Ingresos: Sueldo + Retiros cards now appear above Total ingresado card
- Page titles changed to English: Movements, Dollars/Euros, Reports, Settings
- App routes renamed: /movimientos → /movements, /inversion → /investments, /reportes → /reports, /config → /settings
- favicon updated

---

## [1.14.4] — 2026-06-10

### Changed
- Settings > App: CSV export button label changed to "Backup"; confirm button uses blue (consistent with GitHub modal)
- Settings > App card restructured: logo → versión + changelog → GitHub → Backup, all with icon + label
- Investment > Meta de ahorro: "Ahorrado" row removed; "Faltan" moved next to "Objetivo" header; progress bar color is red <40% / yellow <80% / green ≥80%; percentage shown inline with the bar
- Investment > Períodos para alcanzar meta: subtitle "al ritmo de los últimos 3 períodos" added
- Reports > Gastos: "Promedio / día" renamed to "Promedio / día con gasto"; subtitle corrected to show days with actual expenses (not calendar days)
- Reports > Gastos: "Días sin gastos" now visible when multiple periods are selected (aggregates across all selected periods)
- Reports > Ingresos: Proyección ahorros subtitle removed; period selector (3p/6p/12p) restored to pill style

---

## [1.14.3] — 2026-06-10

### Changed
- Settings > App: CSV export button moved from Account card to App card (next to changelog button); click shows confirmation modal before downloading
- Settings > App: GitHub icon now shows "GitHub" label below; click shows confirmation modal before opening the link in a new tab

---

## [1.14.2] — 2026-06-10

### Fixed
- Settings: category, payment method and savings origin toggles debounced (1.5s) — multiple rapid taps produce a single Firestore write; eliminates app-wide lag while toggling
- Settings > General: auto-savings configuration moved to a bottom-sheet modal — activating the toggle opens it; editing taps the row when active; removes layout shift from inline expand
- Settings > General: auto-savings subtitle shows amount and payment methods (e.g. `$500 por gasto · Mercado Pago + Débito`)

---

## [1.14.1] — 2026-06-10

### Changed
- Settings > General: Modo oscuro moved to top of card
- Settings > General: Reportes now listed above Inversión
- Settings > General: Auto-savings icon uses green (active) / red (inactive), consistent with Inversión and Reportes

---

## [1.14.0] — 2026-06-10

### Added
- Settings > General: **Auto-savings** toggle — when enabled, every qualifying Gasto automatically creates an `Ingreso / Ahorros` movement for a fixed amount configured by the user (respects main currency)
- Settings > General: payment method filter for auto-savings — select one, several, or all methods that trigger the rule (defaults to all active methods on first enable)
- Settings > Sync: clock icon opens a **sync history modal** — each entry shows status color (green/red), date and time, message, and badge (Manual/Auto)
- Movements: when auto-savings applies to the current payment method, the add-movement form shows a preview label with the amount going to savings

---

## [1.13.1] — 2026-06-10

### Changed
- Movements: observation shown in the subtitle of each movement row — lowercase and italic

---

## [1.13.0] — 2026-06-10

### Added
- Movements: list grouped by date with a day header between groups (standard finance app pattern)

### Changed
- Movements: date removed from each movement row subtitle (already shown in the group header)
- Movements: sorted by `fecha` desc → `timestampCarga` desc within the same day
- Movements / Reports: all pill rows use `touchAction: pan-x` for reliable horizontal scroll on mobile
- Reports: period and year pills unified to the same size (`10px`, `700`, `4px 12px`)
- Movements: period pills unified to match year pill size

### Fixed
- Reports: multi-select ring (`box-shadow 0 0 0 2px`) no longer clipped — padding added to period and year pill containers

---

## [1.12.3] — 2026-06-09

### Fixed
- Config > App: GitHub link now points directly to README.md instead of the repo root

---

## [1.12.2] — 2026-06-09

### Fixed
- Dashboard: KPI cards reordered — Sueldo | Gastado / Ahorros | Retiros (was Gastado | Ahorros / Sueldo | Retiros)

---

## [1.12.1] — 2026-06-09

### Fixed
- Inversión: **Meta de ahorro** card now appears above **Meta por período** (was reversed)
- Inversión: **Meta de ahorro** card now includes a progress bar (yellow → green when goal reached)
- Reports URL renamed `/resumen` → `/reportes`; folder and navbar link updated
- LoadingSpinner: removed double `borderRadius` on favicon image (PNG already has built-in rounded corners)

---

## [1.12.0] — 2026-06-09

### Added
- Reports > **Movimientos** (new section, replaces Tendencias): KPI cards per movement type (Gasto / Ingreso / Move / CompraUSD) in a 4-column grid with matching color gradients; Top 5 descriptions by frequency with tap-to-expand modal (50dvh → 90dvh swipe); movements by category with frequency bars; movements by day of week (vertical bar chart Mon–Sun); movements by payment method — all bar colors follow the dominant movement type (red = expense, green = income, yellow = transfer/investment)
- Reports > Períodos: **Mejor/Peor período** KPI cards (best and worst % spent vs income) in the 2fr 1fr 1fr grid alongside Prom. período; **Prom. período** stat added below the "Gastado por período" chart; **Proyección próx. período** replaces "Ahorros acum." in the KPI grid; **Evolución ingresos** chart moved here from Ingresos
- Reports > Ingresos: **Proyección ahorros** (60%) card alongside Ahorros acum. (40%) in 1fr 1fr grid, with 3p/6p/12p toggle; **Total ingresado** card repositioned directly below the hero card
- Inversión page: **Proyección · 3 períodos** and **Períodos para alcanzar meta** added as a 50%/50% grid card (Proyección first)

### Changed
- Reports tab **"Tendencias" renamed to "Movimientos"**, repositioned before "Períodos" — new tab order: Gastos | Ingresos | Movimientos | Períodos
- Reports > Ingresos: **Evolución sueldo** replaces the "Sueldo" KPI card (renamed "Sueldo") — shows current salary, % raise vs previous level, and previous salary; tap opens raise history modal
- Reports > Ingresos: "Directo a ahorros" list sorted by date descending (was by amount); "Por descripción" excludes Sueldo entries
- Reports > Gastos: Tendencia KPI moved from Tendencias into the Gastos KPI grid (order: Días sin gastos | Tendencia); "Mayor gasto" renamed "Día con mayor gasto"; Observaciones (word cloud) removed
- Reports > Gastos/Ingresos modals: max 50dvh, swipe-up handle expands to 90dvh
- **Inversión page URL renamed `/dolares` → `/inversion`** — folder, route, and navbar link updated; "Ritmo / período" card removed from Inversión
- Investment trend cards (Progreso meta USD, Períodos para meta, Ahorros USD, Ritmo/período, Proyección USD) moved out of Tendencias into the Inversión page
- Config > Reportes: section labels updated to reflect new tab names (Movimientos replaces Tendencias with new toggle keys `movimientos_kpis` / `movimientos_otros`)

---

## [1.11.0] — 2026-06-09

### Added
- Salary raise history modal in Reports > Trends: tap "Salary evolution" card to see each raise (date, from → to, %)

### Changed
- Dashboard: "Extras" renamed to "Retiros" (yellow, subtitle "desde ahorros"); available % now calculated over total income (salary + extras); last movement shows time only (no date); period label shows date without year
- Movements: Move amounts shown in yellow in the list
- Investment: "Goal per period" value in yellow
- Reports > Periods: "Extras" renamed to "Retiros" with yellow color and "desde ahorros" subtitle
- Reports > Trends: Salary evolution compares against the previous salary level (before last raise), not the historical average

---

## [1.10.4] — 2026-06-09

### Fixed
- Reports > Trends: savings in USD now reads from real CompraUSD/GastoUSD movements instead of ARS savings series — fixes 0% progress and wrong values

---

## [1.10.3] — 2026-06-08

### Changed
- Word cloud in Reports: limited to top 25 words

---

## [1.10.2] — 2026-06-08

### Fixed
- Reports: restored spacing between section tabs and period pills

---

## [1.10.1] — 2026-06-08

### Fixed
- Reports and Dollars: header and content hidden during load, only spinner visible

---

## [1.10.0] — 2026-06-08

### Added
- Word cloud in Reports > Expenses: words from movement observations sized by frequency, blue→green gradient

### Changed
- Exchange rate in new +USD movement: official selected by default
- Toggle: white knob with shadow, glow on active, spring animation
- USD/EUR exchange rate in Dollars: softer contrast between official and blue

---

## [1.9.1] — 2026-06-08

### Changed
- Edit button (pencil) in movement list: no background box
- Hide values button (eye) in Dashboard: no background box

---

## [1.9.0] — 2026-06-08

### Changed
- Toggle redesigned: white knob with shadow, glow on active, spring animation
- USD/EUR exchange rate: softer contrast between official/blue (same background, differentiated by border and color)
- Exchange rate order in new +USD movement: official first, blue second
- "Goal per period" progress bar: yellow color

---

## [1.8.0] — 2026-06-08

### Added
- Disabling all Reports pills automatically hides the section (navbar + config)
- Re-enabling Reports from General settings resets all pills to enabled
- Redirects to Account tab if user was in Reports when disabling all pills

### Changed
- Save button in Savings Goal: circular checkmark (same as new movement), trash icon on the right
- Save button in Edit movement: circular checkmark instead of floppy disk
- "Goal per period" progress bar: yellow color (consistent with Investment section)
- Dashboard and Movements: header and content hidden during load, only spinner visible

---

## [1.7.0] — 2026-06-08

### Fixed
- Savings movement bug: description showed "Ahorros" instead of origin name (e.g. "Osansi")
- Edit modal for Savings movements: description appeared empty
- New movement form date used UTC instead of local time, causing day rollover at 21:00
- All timestamps across the app converted to 24h format (no AM/PM)

### Changed
- "Last movement" timestamp moved to Dashboard, below "Latest movements"
- Background gradients applied to: Dashboard KPI cards, Latest movements, movements list card, Available card (dynamic color by percentage)

---

## [1.6.0] — 2026-06-08

### Added
- Two-step logout confirmation
- Delete savings goal button (red trash) in Config > Investment
- Dirty state in movement editing: save only enabled when there are changes

### Changed
- Config sections reordered: General → Sync → Account → App
- General section reordered: Main currency → Investment → Investment currency → Reports → Dark mode
- "General preferences" renamed to "General"; "Investment currencies" to "Investment currency"
- + buttons in Config: green symbol only, no background
- ✕ buttons in Config: red X only, no background
- Confirm button in new movement: centered checkmark, green when required fields are filled
- Save/delete buttons in movement editing: minimalist icons (green floppy, red trash)
- Trash on the right, floppy centered in movement editing
- Modal close button: red X only, no background
- Numbers in "All descriptions" modal: blue→green gradient
- LoadingSpinner: colored ring orbits around logo, centered on screen
- GitHub link updated to finmoves-app

---

## [1.5.0] — 2026-06-07

### Added
- Changelog modal in Config > App — without leaving the app
- GitHub logo (left of FinMoves logo) with link to repository

### Changed
- The "changelog" link opens an inline modal instead of redirecting to GitHub

---

## [1.4.0] — 2026-06-07

### Added
- Export movements to CSV from Config > Account (same format as Google Sheets)
- GitHub logo with link to CHANGELOG in the App card of Settings

### Changed
- Config > General preferences reordered: Dark mode → Main currency → Investment → Investment currency → Reports
- Main currency moved from Account card to General preferences
- Available bar and badge in Dashboard change color dynamically (green ≥50%, yellow <50%, red <10%)

---

## [1.3.0] — 2026-06-07

### Added
- Main currency per account: ARS / USD / EUR (stored in Firestore, default ARS)
- `formatMoney(n, currency)` — correct symbol based on currency (`$`, `U$D`, `€`)
- Entire app adapts currency symbol automatically without additional changes
- Config > Account shows badge with selected main currency
- Investment: if main currency is USD, can only invest in EUR (and vice versa)
- Movements: +/- FX automatically excludes the main currency

### Changed
- `investmentCurrency` only visible for users with ARS as main currency
- For USD/EUR primary, investment currency is fixed and requires no selector

---

## [1.2.0] — 2026-06-07

### Added
- Dual USD/EUR support in Investment: new types `CompraEUR` / `GastoEUR`
- Two independent hero cards (USD Reserve + EUR Reserve) with separate exchange rates
- USD and EUR exchange rates with independent selector (can have official on one and blue on the other)
- Dynamic title "Dollars | Euros" when data for both currencies is visible
- Delete categories, payment methods and savings origins with inline confirmation
- Expense/Income pills instead of native select when adding categories
- Input fields moved to top of each list (Categories, Methods, Origins)
- Inline "Save" button in Investment tab of Config, visible only with pending changes

### Changed
- Reports and Movements toggles save instantly (auto-save, no floating button)
- Save FAB removed — replaced by auto-save + inline button in Investment
- Bug fix: Reports toggle state was lost when navigating between pages
- Bug fix: "Total income" in Reports/Income now hides correctly with KPIs
- Bug fix: Current reserve and goal amount in Config show the correct currency (USD or EUR)
- New movement FAB repositioned closer to navbar
- Dashboard "see more" button with same SVG style as Movements FAB (in blue)
- Save confirmation message removed (only appears on error)

---

## [1.1.0] — 2026-06-07

### Added
- Icons in each row of General preferences: User, Sync, Reports, Investment and Currency
- Reports and Investment icon with green border (active) or red (inactive)
- Currency icon shows `$` or `€` based on selected currency
- Sync icon reflects status: green if synced, red if error, grey if never synced
- Navbar: active icons with blue→green gradient based on position (home = blue, gear = green)
- Navbar: background adapts to theme — light in light mode, dark in dark mode

### Changed
- "Inversiones" renamed to "Investment" throughout the app (navbar, config, reports, dollars section)
- Dollars section title changes dynamically: "Dollars" or "Euros" based on configured currency
- All cards in the Investment page with yellow gradient (Exchange rate, Goal per period, Savings goal, History)
- Selected exchange rate highlighted with yellow gradient and yellow text
- Exchange rate order: Official first, Blue second
- Accent color changed from cyan (`#00b4ff`) to blue (`#3f52e8`) — better contrast in light mode
- Settings pills in outlined style (border + dim), consistent with the rest of the app

---

## [1.0.0] — 2026-06-06

### Added
- Firebase authentication (email/password)
- Dashboard with active period summary: available, expense bar and latest movements
- Movement tracking: Expense, Income, Move, BuyUSD, SpendUSD
- Investment section: USD/EUR reserve, blue/official exchange rate, savings goal, purchase history
- Reports section with toggles per section: expense, income, period and trend KPIs
- Settings: categories, payment methods, savings origins, general preferences
- Light mode by default with dark mode toggle (no flash on load)
- Google Sheets sync (full mirror + rotation of up to 5 backups)
- Preferences persisted in localStorage via Zustand: mode, Reports section, Investment section, currency
- PWA: installable from the browser
- Version visible in the App section of Settings, auto-generated from `package.json`
