# Accessibility & Performance Engineering Guide

This reference details the core performance rules, `prefers-reduced-motion` integration, lifecycle cleanup standards, and verification checklists for all interactive motion in DocuMind AI.

---

## 1. The Composite-Only Rendering Rule

Modern rendering engines (Blink, WebKit, Gecko) execute frame generation in three stages:
1. **Layout / Reflow**: Recalculating geometry and positions. (Extremely expensive).
2. **Paint**: Rasterizing vector pixels and background gradients. (Expensive).
3. **Composite**: Assembling GPU layers into final screen output. (Fast, 60–120fps).

### The Golden Rule
**Interactive animations must animate COMPOSITE properties only:**
- `transform` (e.g. `translate3d`, `rotateX`, `rotateY`, `scale3d`)
- `opacity`

### Prohibited Animation Properties During User Gestures
- ❌ `width`, `height` (Forces full layout recalculation of siblings and parents).
- ❌ `top`, `left`, `margin`, `padding` (Forces reflow).
- ❌ `box-shadow` (Forces continuous CPU/GPU rasterization repaint).
- ❌ `filter: blur()` (High GPU fill-rate penalty on lower-end devices).

*Alternative for dynamic shadows:* Render two stacked pseudo-elements with static `box-shadow` values, and cross-fade their `opacity` using GPU compositing.

---

## 2. Prefers-Reduced-Motion Engineering

Users with vestibular disorders, motion sensitivity, or low system power settings enable `prefers-reduced-motion`. We must respect this preference at both CSS and React levels.

### A. CSS Media Query Baseline
Every motion component must include an immediate reduced-motion fallback:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .perspective-card-inner {
    transform: none !important;
    transition: none !important;
  }
}
```

### B. React Custom Hook: `useReducedMotion`
When rendering interactive physics or canvas loops in React, use this lightweight hook:

```typescript
import { useState, useEffect } from "react";

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReduced;
}
```

---

## 3. Strict Lifecycle & Memory Cleanup

Leaking animation frames, event listeners, or observers creates memory leaks and drains user laptop battery life:

```typescript
useEffect(() => {
  let rafId: number | null = null;
  const target = ref.current;
  if (!target) return;

  const onPointerMove = (e: PointerEvent) => {
    // Cancel previous unrendered frame to avoid frame queue buildup
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      updateTransform(e);
      rafId = null;
    });
  };

  target.addEventListener("pointermove", onPointerMove, { passive: true });

  // Mandatory complete cleanup on component unmount
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    target.removeEventListener("pointermove", onPointerMove);
  };
}, []);
```

---

## 4. Browser Verification Checklist

Before certifying any interactive animation in DocuMind:

1. **FPS Meter**: Open Chrome DevTools (`Cmd + Shift + P` -> "Show frames per second (FPS) meter"). Verify steady 60fps/120fps with zero drops below 55fps.
2. **Performance Audit**: Record a 5-second interaction trace in Chrome DevTools Performance tab. Verify zero red triangles ("Forced reflow / Forced synchronous layout").
3. **Reduced Motion Simulation**: In DevTools Rendering tab, toggle `prefers-reduced-motion: reduce`. Confirm animation transitions instantly to accessible static elevation.
4. **Touch Emulation**: In DevTools Device Mode, interact via simulated mobile touch. Verify vertical scrolling is smooth and cards do not get stuck in tilted states.
5. **Keyboard & Focus Ring**: Tab to the component using `Tab` key. Verify visible `:focus-visible` outline in electric blue (`#3478F6`) is never clipped by 3D overflow.
