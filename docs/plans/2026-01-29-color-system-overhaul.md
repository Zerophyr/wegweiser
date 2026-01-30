# Color System Overhaul

## Problem

The extension has three color-related issues affecting end-user experience and maintainability:

1. **Dark mode contrast failures** -- muted text (`#71717a` / zinc-500) on secondary backgrounds (`#18181b`) hits only ~2.1:1 contrast, well below WCAG AA minimum of 4.5:1. Affects timestamps, meta text, model status, inactive toggles, and placeholder text. The light theme does not have this problem.

2. **Theme system is bypassed** -- `theme.js` defines 13 CSS variables, but CSS files hardcode the same values 100+ times. Light theme requires a 200+ line override block in `spaces.css`. Adding a new theme would require touching every file.

3. **Missing semantic colors** -- links (`#60a5fa`), purple accents (`#8b5cf6`), topic colors, cyan, and pink are hardcoded and don't adapt between themes.

## Design

### Expanded Variable Set (28 variables)

**Backgrounds:**
- `--color-bg` -- page background
- `--color-bg-secondary` -- cards, inputs
- `--color-bg-tertiary` -- borders, chips
- `--color-bg-elevated` -- source cards, popovers

**Text:**
- `--color-text` -- primary content
- `--color-text-secondary` -- labels, descriptions
- `--color-text-muted` -- timestamps, meta (**contrast fix**)
- `--color-text-on-primary` -- text on colored buttons

**Borders:**
- `--color-border` -- dividers, card edges
- `--color-border-hover` -- interactive hover states

**Semantic:**
- `--color-primary` / `--color-primary-hover` -- buttons, active states
- `--color-primary-subtle` -- blue-tinted backgrounds (active thread, focus rings)
- `--color-success` / `--color-error` / `--color-warning`
- `--color-info` -- cyan for debug/info badges

**Accent:**
- `--color-accent` -- purple gradient endpoint
- `--color-link` / `--color-link-hover` -- in-content links

**Topic palette:**
- `--color-topic-1` through `--color-topic-6`

**Utility:**
- `--color-shadow` -- standardized shadow color
- `--color-scrollbar` / `--color-scrollbar-hover`

### Dark Theme Values

| Variable | Value | Tailwind |
|---|---|---|
| `--color-bg` | `#0f0f0f` | zinc-950 |
| `--color-bg-secondary` | `#18181b` | zinc-900 |
| `--color-bg-tertiary` | `#27272a` | zinc-800 |
| `--color-bg-elevated` | `#111113` | custom |
| `--color-text` | `#e4e4e7` | zinc-200 |
| `--color-text-secondary` | `#d4d4d8` | zinc-300 |
| `--color-text-muted` | `#a1a1aa` | zinc-400 **(was zinc-500)** |
| `--color-text-on-primary` | `#ffffff` | white |
| `--color-border` | `#27272a` | zinc-800 |
| `--color-border-hover` | `#3f3f46` | zinc-700 |
| `--color-primary` | `#3b82f6` | blue-500 |
| `--color-primary-hover` | `#2563eb` | blue-600 |
| `--color-primary-subtle` | `rgba(59, 130, 246, 0.1)` | blue-500/10 |
| `--color-success` | `#10b981` | emerald-500 |
| `--color-error` | `#ef4444` | red-500 |
| `--color-warning` | `#f59e0b` | amber-500 |
| `--color-info` | `#0ea5e9` | sky-500 |
| `--color-accent` | `#8b5cf6` | violet-500 |
| `--color-link` | `#60a5fa` | blue-400 |
| `--color-link-hover` | `#93c5fd` | blue-300 |
| `--color-topic-1` | `#60a5fa` | blue-400 |
| `--color-topic-2` | `#34d399` | emerald-400 |
| `--color-topic-3` | `#fbbf24` | amber-400 |
| `--color-topic-4` | `#f472b6` | pink-400 |
| `--color-topic-5` | `#a78bfa` | violet-400 |
| `--color-topic-6` | `#22d3ee` | cyan-400 |
| `--color-shadow` | `rgba(0, 0, 0, 0.4)` | black/40 |
| `--color-scrollbar` | `#27272a` | zinc-800 |
| `--color-scrollbar-hover` | `#3f3f46` | zinc-700 |

### Light Theme Values

| Variable | Value | Tailwind | Notes |
|---|---|---|---|
| `--color-bg` | `#ffffff` | white | |
| `--color-bg-secondary` | `#f9fafb` | gray-50 | |
| `--color-bg-tertiary` | `#f3f4f6` | gray-100 | |
| `--color-bg-elevated` | `#ffffff` | white | relies on shadow |
| `--color-text` | `#1f2937` | gray-800 | |
| `--color-text-secondary` | `#374151` | gray-700 | |
| `--color-text-muted` | `#6b7280` | gray-500 | already good contrast |
| `--color-text-on-primary` | `#ffffff` | white | |
| `--color-border` | `#e5e7eb` | gray-200 | |
| `--color-border-hover` | `#d1d5db` | gray-300 | |
| `--color-primary` | `#3b82f6` | blue-500 | |
| `--color-primary-hover` | `#2563eb` | blue-600 | |
| `--color-primary-subtle` | `rgba(59, 130, 246, 0.08)` | blue-500/8 | less opacity on white |
| `--color-success` | `#059669` | emerald-600 | darker for contrast |
| `--color-error` | `#dc2626` | red-600 | darker for contrast |
| `--color-warning` | `#d97706` | amber-600 | darker for contrast |
| `--color-info` | `#0284c7` | sky-600 | |
| `--color-accent` | `#7c3aed` | violet-600 | |
| `--color-link` | `#2563eb` | blue-600 | darker for readability |
| `--color-link-hover` | `#1d4ed8` | blue-700 | |
| `--color-topic-1` | `#2563eb` | blue-600 | |
| `--color-topic-2` | `#059669` | emerald-600 | |
| `--color-topic-3` | `#d97706` | amber-600 | |
| `--color-topic-4` | `#db2777` | pink-600 | |
| `--color-topic-5` | `#7c3aed` | violet-600 | |
| `--color-topic-6` | `#0891b2` | cyan-600 | |
| `--color-shadow` | `rgba(0, 0, 0, 0.1)` | black/10 | lighter shadows |
| `--color-scrollbar` | `#e5e7eb` | gray-200 | |
| `--color-scrollbar-hover` | `#d1d5db` | gray-300 | |

Design principle: semantic colors shift one Tailwind shade darker for light theme (500 -> 600) to maintain contrast on white backgrounds. Topic colors shift from 400-series to 600-series.

## Migration Plan

### Step 1: Update `theme.js`

Add the 15 new variables to both dark and light theme objects. Bump `--color-text-muted` from `#71717a` to `#a1a1aa` in the dark theme.

### Step 2: Replace hardcoded colors in CSS

Three files to migrate:
- `src/sidepanel/sidepanel.css` (~800 lines) -- fully hardcoded today
- `src/spaces/spaces.css` (~1800 lines) -- hardcoded dark section + light override block
- `src/options/options.html` inline CSS (~500 lines) -- hardcoded

Systematic replacement: every `#0f0f0f` -> `var(--color-bg)`, every `#18181b` -> `var(--color-bg-secondary)`, etc.

### Step 3: Remove light theme override blocks

Once CSS uses variables, the `.light-theme` override section in `spaces.css` can be deleted. Theme switching in `theme.js` changes variables at the root and everything follows.

### Step 4: Handle gradients and special cases

- Button gradients: `var(--color-primary)` to `var(--color-primary-hover)`
- Focus rings: replace `rgba(59, 130, 246, 0.1)` with `var(--color-primary-subtle)`
- Shadows: replace `rgba(0, 0, 0, 0.4)` with `var(--color-shadow)`
- Active toggle dark blue (`#1e3a5f`): use `var(--color-primary-subtle)` or a new variable if needed

### Testing

- Visual spot-check both themes across all three surfaces (sidebar, spaces, options)
- Verify muted text is now readable on dark backgrounds
- Confirm no regressions in button states, hover effects, gradients
- Check topic heading colors render correctly in both themes

## Risks

- **Low risk**: Migration is mechanical find/replace with one visible change (muted text brightness)
- **No layout or behavior changes**
- **Edge cases**: Some `rgba()` values with unusual opacity levels may need manual mapping rather than a simple variable substitution
