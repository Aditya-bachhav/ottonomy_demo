# StimCardio — scroll story

React + Three.js (R3F) + Lenis.

```bash
npm install
npm run dev      # local dev
npm run build    # type-check + production build
npm run preview  # serve the build
```

Structure
- `src/store.ts` — scroll/pointer store (scroll never triggers React re-renders)
- `src/components/Scene.tsx` — WebGL scene (watch, vienna, camera path)
- `src/components/Overlays.tsx` — scroll-driven copy, wordmark, progress
- `src/components/Sections.tsx` — navbar, about grid, footer
- `src/data/*.json` — camera/keyframe data exported from your editor
- `public/model/*.glb` — models, compressed with meshopt + WebP textures
