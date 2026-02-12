# 10xCapesDeck

> A high-performance capabilities deck and portfolio for **Times10**, a creative agency. Built to showcase brand partnerships (Adidas, C4 Energy, Derrick Rose, Nike, Jordan, MGM Resorts, and more) through a media-rich, full-screen presentation experience optimized for recruiters and potential clients.

---

## Purpose

This application serves as a **digital pitch deck** and **portfolio showcase** for Times10. It presents the agency's services, case studies, and brand work in a cinematic, full-page scroll format—designed to make a strong first impression during client meetings, pitches, and recruitment conversations.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Astro](https://astro.build) v5 — Static-first, islands architecture |
| **UI** | [React](https://react.dev) 19 — Interactive components only where needed |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) v4 — Utility-first, design tokens |
| **Language** | TypeScript (strict mode) |
| **Media Delivery** | [Bunny CDN](https://bunny.net) — Images via Optimizer, videos via direct CDN + Bunny Stream |
| **Content Sources** | WordPress (pull zone) + Bunny Storage (new assets) |
| **Deployment** | Vercel — Static export, edge caching |

### Rationale

- **Astro** — Zero JS by default; React islands only for video players, lazy-load logic, and interactive UI. Keeps bundle size small and initial load fast.
- **Bunny CDN** — On-the-fly image transforms (width, quality, WebP), no manual optimization. Videos served from edge for low latency.
- **Tailwind** — Rapid iteration, consistent spacing/colors, no CSS-in-JS runtime overhead.

---

## Architecture

### Page Structure

```
/                    → Home: logo, brand grid, reel, nav
/services            → Services: photography, design, activations, influencer, etc.
/case-studies        → Case studies: C4, Adidas, Derrick Rose, Harden Vol 9
/case-study/[slug]   → Individual case study deep-dives
```

### Component Organization

Components are **feature-organized** (not by type):

```
src/
├── components/
│   ├── sections/           # Full-page section blocks
│   │   ├── TwoBlockGrid/   # Title + media layouts (Adidas, C4, etc.)
│   │   ├── C4CaseStudy/    # C4 Energy campaign sections
│   │   ├── Services/       # Service cards, title slides
│   │   ├── ReelSection/    # Hero video sections
│   │   └── ...
│   ├── LazyImage.tsx       # Progressive image loading
│   ├── LazyVideo.tsx       # Poster → video transition
│   ├── HashScrollInit.astro
│   └── Navigation.astro
├── lib/
│   ├── bunny-cdn.ts        # CDN URL generation (images, video, thumbnails)
│   ├── intersection-observer.ts  # Singleton lazy-load manager
│   └── hash-scroll.ts      # URL hash ↔ scroll position sync
└── pages/
```

### Key Patterns

1. **Hash-based section navigation** — Full-page snap scroll with URL hashes (`#home`, `#brands`, `#reel`). Shareable links, browser back/forward, and `prefers-reduced-motion` support.
2. **Progressive asset loading** — Single Intersection Observer instance; images/videos load as sections enter viewport. Blurred placeholder → full asset transition.
3. **Hybrid CDN strategy** — WordPress pull zone for legacy content; Bunny Storage for new assets. All images routed through Bunny Optimizer for transforms.
4. **Astro + React islands** — Most UI is static HTML; React used only for `LazyImage`, `LazyVideo`, and video controls (Plyr).

---

## Problems Solved

### 1. Media-heavy portfolio performance

- **Challenge:** Dozens of high-res images and videos; slow load would kill first impressions.
- **Solution:** Bunny CDN on-the-fly transforms (no manual resizing), lazy loading below fold, preload for above-fold assets, `content-visibility` for off-screen sections.

### 2. Smooth scroll UX at scale

- **Challenge:** Full-page sections with snap scroll; URL must reflect visible section for sharing and back/forward.
- **Solution:** `hash-scroll.ts` — Intersection Observer + throttled scroll handler syncs URL hash with visible section. Mobile-optimized (DOMContentLoaded vs load, single RAF).

### 3. WordPress content without WordPress runtime

- **Challenge:** Existing assets live in WordPress; need CDN delivery without running WordPress for this site.
- **Solution:** Bunny pull zone from WordPress origin; `bunnyImage()` accepts WordPress paths (`/wp-content/uploads/...`) and returns CDN URLs with transform params.

### 4. Mobile performance and accessibility

- **Challenge:** Large viewports, many assets; must stay responsive and respectful of user preferences.
- **Solution:** CSS scroll-snap (no JS snap), `prefers-reduced-motion` respected in animations and scroll behavior, keyboard navigation, semantic HTML.

### 5. Consistency and maintainability

- **Challenge:** Many similar section layouts; avoid duplication and drift.
- **Solution:** Shared section conventions (RULE-022, RULE-024), reusable `TwoBlockGrid`, `LazyImage`, `LazyVideo`, and a typed `.cursorrules` rule set for patterns.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and set:

- `PUBLIC_BUNNY_CDN_URL_WORDPRESS` — WordPress pull zone
- `PUBLIC_BUNNY_CDN_URL_STORAGE` — Storage pull zone for new assets
- `PUBLIC_BUNNY_CDN_URL` — Default fallback
- `PUBLIC_BUNNY_STREAM_URL` — (Optional) Bunny Stream for adaptive video

See [BUNNY_CDN_SETUP.md](./BUNNY_CDN_SETUP.md) for details.

### Run

```bash
npm run dev     # Local dev at localhost:4321
npm run build   # Production build to ./dist
npm run preview # Preview production build
```

---

## Project Conventions

The project follows a documented rule set (`.cursorrules`) covering:

- **TypeScript** — Strict mode, no `any`, explicit return types
- **Tailwind** — Utility-first, no inline `style`, design tokens
- **Performance** — Lazy load, Bunny CDN, reduced motion, 60fps scroll
- **Accessibility** — Semantic HTML, keyboard support, ARIA when needed
- **Bunny CDN** — Centralized `bunny-cdn.ts` helpers; no hardcoded CDN URLs

---

## License

Proprietary — Times10.
