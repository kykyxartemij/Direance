# Layout Guide — Tailwind CSS Reference

## Table of Contents
1. [Width & Height](#1-width--height)
2. [Centering](#2-centering)
3. [Flexbox](#3-flexbox)
4. [Grid](#4-grid)
5. [Positioning](#5-positioning)
6. [Overflow](#6-overflow)
7. [Responsive Breakpoints](#7-responsive-breakpoints)
8. [Z-index & Stacking](#8-z-index--stacking)
9. [Common Patterns](#9-common-patterns)

---

## 1. Width & Height

### Width
```
w-full        → width: 100%           (fills parent)
w-screen      → width: 100vw          (fills viewport, ignores parent)
w-auto        → width: auto           (shrinks to content)
w-fit         → width: fit-content    (shrinks to content, respects min/max)
w-1/2         → width: 50%
w-1/3         → width: 33.333%
w-64          → width: 256px          (w-{n} = n × 4px)
```

### Max / Min width
```
max-w-sm      → 384px
max-w-md      → 448px
max-w-lg      → 512px
max-w-xl      → 576px
max-w-2xl     → 672px   ← good for forms
max-w-3xl     → 768px
max-w-4xl     → 896px
max-w-5xl     → 1024px
max-w-6xl     → 1152px
max-w-7xl     → 1280px  ← good for content pages
max-w-screen-xl  → 1280px
max-w-screen-2xl → 1536px
min-w-0       → min-width: 0          (fixes flex overflow — very common bug fix)
min-w-full    → min-width: 100%
```

### Height
```
h-full        → height: 100%          (only works if parent has a defined height)
h-screen      → height: 100vh
h-auto        → height: auto
h-10          → height: 40px
min-h-screen  → min-height: 100vh     (page takes full viewport minimum)
max-h-96      → max-height: 384px
```

---

## 2. Centering

### Center a block horizontally (most common)
```tsx
// Fixed-width block in the center of the page
<div className="max-w-2xl mx-auto">...</div>

// mx-auto ONLY works when the element has a width smaller than its parent.
// On w-full elements, mx-auto does nothing.
```

### Center content inside a container
```tsx
// Flexbox centering (most versatile)
<div className="flex items-center justify-center">...</div>
//              ↑ vertical    ↑ horizontal

// Both axes
<div className="flex items-center justify-center h-screen">...</div>

// Just horizontal text
<div className="text-center">...</div>
```

### Center absolutely positioned element
```tsx
<div className="relative">
  <div className="absolute inset-0 flex items-center justify-center">
    {/* centered over parent */}
  </div>
</div>

// Or with translate trick (doesn't need parent to be relative)
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
  {/* centered */}
</div>
```

---

## 3. Flexbox

### Direction
```
flex          → display: flex (row by default)
flex-col      → column direction
flex-row      → row direction (default)
flex-wrap     → wraps to next line when out of space
flex-nowrap   → never wraps (default)
```

### Alignment
```
// Cross axis (perpendicular to direction)
items-start   → align-items: flex-start
items-center  → align-items: center
items-end     → align-items: flex-end
items-stretch → align-items: stretch  (default — children fill cross-axis height)
items-baseline→ align on text baseline

// Main axis (same as direction)
justify-start    → justify-content: flex-start  (default)
justify-center   → justify-content: center
justify-end      → justify-content: flex-end
justify-between  → space between items (first flush left, last flush right)
justify-around   → equal space around each item
justify-evenly   → equal space between and around
```

### Sizing children
```
flex-1        → flex: 1 1 0%    (grows AND shrinks, ignores content size)
flex-auto     → flex: 1 1 auto  (grows AND shrinks, based on content size)
flex-none     → flex: none      (doesn't grow or shrink — fixed size)
flex-initial  → flex: 0 1 auto  (default — doesn't grow, can shrink)
grow          → flex-grow: 1    (just grows, doesn't shrink)
shrink-0      → flex-shrink: 0  (never shrinks — useful for fixed-width sidebars)
```

### Gap
```
gap-2         → gap: 8px   (both row and column)
gap-x-4       → column-gap: 16px
gap-y-6       → row-gap: 24px
```

### Common bug: overflow with flex
```tsx
// Text overflows out of flex child → add min-w-0
<div className="flex">
  <div className="min-w-0 flex-1">     ← min-w-0 fixes truncation in flex
    <p className="truncate">Long text...</p>
  </div>
</div>
```

---

## 4. Grid

### Defining columns
```
grid              → display: grid
grid-cols-1       → 1 column
grid-cols-2       → 2 equal columns
grid-cols-3       → 3 equal columns
grid-cols-4       → 4 equal columns
grid-cols-12      → 12-column grid (like Bootstrap)
grid-cols-none    → no column template
```

### Custom column widths (arbitrary)
```tsx
<div className="grid grid-cols-[1fr_2fr]">     // 1/3 + 2/3
<div className="grid grid-cols-[250px_1fr]">   // fixed sidebar + fill
<div className="grid grid-cols-[auto_1fr_auto]"> // shrink-center-shrink
```

### Spanning
```
col-span-2    → spans 2 columns
col-span-full → spans all columns
row-span-2    → spans 2 rows
row-span-full → spans all rows

// Example: thumbnail tall on left, two stacked items on right
<div className="grid grid-cols-2 gap-3">
  <div className="row-span-2">Tall left</div>   // occupies rows 1 AND 2
  <div>Top right</div>                           // row 1, col 2
  <div>Bottom right</div>                        // row 2, col 2
</div>
```

### Placement (manual)
```
col-start-1   → starts at column line 1
col-start-2   → starts at column line 2
col-end-4     → ends at column line 4
row-start-2   → starts at row line 2
```

### Auto rows / columns
```
auto-rows-fr      → all rows equal height
auto-cols-fr      → all auto columns equal
grid-flow-col     → fill columns first (instead of rows)
grid-flow-dense   → fill gaps with smaller items
```

### Gap
```
gap-4         → gap: 16px (rows and columns)
gap-x-6       → column gap only
gap-y-4       → row gap only
```

---

## 5. Positioning

### The 4 types
```
static    → default, normal flow, top/left/etc have NO effect
relative  → normal flow, but top/left/etc shift it AND creates a positioning context for children
absolute  → removed from flow, positioned relative to nearest non-static ancestor
fixed     → removed from flow, positioned relative to the VIEWPORT (stays on scroll)
sticky    → normal flow until it hits a scroll threshold, then acts like fixed
```

### Inset (top/right/bottom/left)
```
inset-0       → top:0 right:0 bottom:0 left:0   (fills parent — use with absolute)
inset-x-0     → left:0 right:0
inset-y-0     → top:0 bottom:0
top-0         → top: 0
top-4         → top: 16px
-top-2        → top: -8px   (negative values shift outward)
top-1/2       → top: 50%
```

### Sticky header pattern
```tsx
<header className="sticky top-0 z-50 bg-surface border-b border-(--border)">
  <Navbar />
</header>
<main>...</main>
// sticky keeps it in flow (no layout shift) but pins it when scrolled past
```

### Fixed overlay / modal backdrop
```tsx
<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
  <div className="bg-surface rounded-xl p-6">
    {/* modal content */}
  </div>
</div>
// fixed inset-0 = full-screen overlay that stays on scroll
```

### Absolute inside relative
```tsx
<div className="relative">          {/* positioning context */}
  <img ... />
  <div className="absolute top-2 right-2">   {/* floats over the image */}
    <Badge />
  </div>
</div>
```

---

## 6. Overflow

```
overflow-hidden   → clips content, no scrollbar (use for rounded corners, masks)
overflow-auto     → scrollbar appears only when content overflows
overflow-scroll   → scrollbar always visible (even when not needed)
overflow-visible  → content escapes container (default)
overflow-clip     → like hidden but no scrolling context created

overflow-x-auto   → horizontal scroll only
overflow-y-auto   → vertical scroll only
overflow-x-hidden → clips horizontal (fixes horizontal scroll on mobile)
```

### Text overflow
```
truncate          → overflow:hidden + text-overflow:ellipsis + whitespace:nowrap
text-ellipsis     → text-overflow:ellipsis (needs overflow-hidden + whitespace-nowrap)
text-nowrap       → whitespace: nowrap (prevents line breaks)
break-words       → breaks long words to fit
break-all         → breaks at any character
```

### Scrollable container pattern
```tsx
// Fixed height container with scroll
<div className="h-96 overflow-y-auto">
  {/* tall content */}
</div>

// Full height remaining (parent must be flex-col + h-screen or h-full)
<div className="flex flex-col h-screen">
  <header className="flex-none">Navbar</header>
  <main className="flex-1 overflow-y-auto">Content</main>
</div>
```

---

## 7. Responsive Breakpoints

Tailwind is **mobile-first** — unprefixed classes apply at all sizes, prefixed classes apply from that breakpoint up.

```
(no prefix)   → 0px+     (all screens)
sm:           → 640px+
md:           → 768px+
lg:           → 1024px+
xl:           → 1280px+
2xl:          → 1536px+
```

### Examples
```tsx
// 1 col mobile → 2 tablet → 4 desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row">

// Hidden on mobile, visible on desktop
<div className="hidden lg:block">

// Full width on mobile, fixed width on desktop
<div className="w-full lg:w-64">

// Different padding per screen size
<div className="px-4 sm:px-6 lg:px-8">
```

### Max-width breakpoints for containers
```tsx
// Typical page layout — wider on larger screens but not infinite
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

---

## 8. Z-index & Stacking

```
z-0        → z-index: 0
z-10       → z-index: 10
z-20       → z-index: 20
z-30       → z-index: 30
z-40       → z-index: 40
z-50       → z-index: 50   ← modals, dropdowns
z-auto     → z-index: auto (default)
-z-10      → z-index: -10  (behind everything)
```

### Stacking context rules
- Z-index only works on positioned elements (`relative`, `absolute`, `fixed`, `sticky`)
- A child can NEVER appear above a stacking context sibling with a higher z-index
- `transform`, `opacity < 1`, `filter`, `will-change` all create new stacking contexts

### MePipe z-index layers
```
10    → dropdowns, tooltips, popovers
50    → sticky navbar
10000 → ArtDialog backdrop
10100 → ArtSnackbar stack (above dialog)
```

---

## 9. Common Patterns

### Full-page layout with sticky nav
```tsx
<html className="h-full">
  <body className="h-full flex flex-col">
    <nav className="sticky top-0 z-50 flex-none">...</nav>
    <main className="flex-1 overflow-y-auto px-6 py-4">...</main>
  </body>
</html>
```

### Sidebar + content
```tsx
<div className="flex h-screen">
  <aside className="w-64 flex-none overflow-y-auto">Sidebar</aside>
  <main className="flex-1 overflow-y-auto px-6">Content</main>
</div>
```

### Card grid (responsive)
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### Centered narrow form
```tsx
<div className="max-w-2xl mx-auto px-4 py-8">
  <form>...</form>
</div>
```

### Overlay badge on image
```tsx
<div className="relative">
  <img className="w-full rounded-lg" />
  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
    4:32
  </span>
</div>
```

### 2×2 grid with tall left item (used in UploadForm)
```tsx
<div className="grid grid-cols-2 gap-3">
  <div className="row-span-2">Tall left (fills both rows)</div>
  <div>Top right</div>
  <div>Bottom right</div>
</div>
```

### Push element to the right in flex
```tsx
<div className="flex items-center">
  <span>Left content</span>
  <span className="ml-auto">Right content</span>  {/* ml-auto pushes to right */}
</div>
```

### Aspect ratio
```tsx
<div className="aspect-video">   {/* 16:9 */}
<div className="aspect-square">  {/* 1:1  */}
<div className="aspect-[4/3]">   {/* 4:3  */}
```
