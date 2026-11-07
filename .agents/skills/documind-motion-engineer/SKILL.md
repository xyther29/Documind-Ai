---
name: documind-motion-engineer
description: >-
  Specialized engineering skill for DocuMind AI to design, specify, and implement
  high-performance, accessible, zero-dependency interactive animations, CSS 3D transforms,
  perspective tilt, parallax, SVG dynamics, and canvas effects in React and TypeScript.
---

# DocuMind Motion Engineer

A specialized skill for engineering editorial, responsive, and accessible interactive animations directly in the DocuMind AI React + TypeScript frontend.

## Core Identity & Engineering Philosophy

1. **Zero External Dependencies**: Work exclusively with React 19, TypeScript, CSS 3D transforms, SVG math, HTML5 Canvas, and native browser APIs. Do not install external animation packages (`framer-motion`, `gsap`, `three.js`) unless explicitly approved for an advanced WebGL 3D model requirement.
2. **DocuMind Editorial Language**: Align with DocuMind's navy (`#142D4E`), electric blue (`#3478F6`), teal (`#0F9D91`), amber (`#E8A23A`), and crisp slate-white palette. Avoid generic AI dashboard clichés: no purple gradients, neon glow rings, or heavy glassmorphism.
3. **Hardware Acceleration**: Animate composite-only properties (`transform`, `opacity`). Never animate layout geometry (`width`, `height`, `margin`, `top`, `left`) during interaction loops.
4. **Accessibility First**: Respect `prefers-reduced-motion` at both the CSS layer and via React state. Provide elegant static alternatives that preserve semantic clarity.
5. **Pointer Agnostic**: Support mouse, pen, and multi-touch interactions seamlessly with the W3C Pointer Events API.

---

## Technical Guides & References

Detailed architectural guidelines are modularized in the `references/` directory:

- [Motion Design Tokens & Easings](./references/motion-design-tokens.md): Exact color tokens, easing curves, timing constants, and transition scales.
- [CSS 3D & Pointer Math](./references/css-3d-and-pointer-math.md): Equations for perspective, rotation clamping, normalized coordinates, and pointer tracking.
- [Accessibility & Performance Guide](./references/accessibility-and-performance.md): `prefers-reduced-motion` hooks, composite-only render rules, event listener cleanup, and frame-rate audit checklists.

---

## Reference Implementation

A canonical, production-ready reference component demonstrates zero-dependency 3D tilt, specular sheen, touch compatibility, and complete lifecycle cleanup:

- [PerspectiveDocumentCard](./examples/PerspectiveDocumentCard.example.tsx): Standalone React component implementing pointer-driven 3D perspective and dynamic specular reflection with zero re-render overhead.

---

## 5-Step Engineering Workflow

When tasked with implementing or enhancing motion in the DocuMind frontend, execute this sequence:

### 1. Architecture & Component Inspection
- Inspect the target component's DOM hierarchy, parent layout constraints (`overflow-hidden`, flex/grid alignments), and re-render cycles.
- Verify whether continuous animation values (e.g. cursor coordinates) can be passed directly to CSS custom properties via element refs, avoiding wasteful React state re-renders.

### 2. Technical Motion Specification
Before writing code, define:
- **Trigger**: `pointermove`, `scroll`, `hover`, `focus-visible`, or state transition.
- **Transform Equation**: e.g., `rotateX(${-clamp(normY * maxDeg)}) rotateY(${clamp(normX * maxDeg)})`.
- **Duration & Easing**: e.g., `200ms cubic-bezier(0.16, 1, 0.3, 1)` (spring-out) for entry; `400ms` for settling.
- **Reduced Motion State**: Static elevation (e.g., standard `boxShadow.cardHover` + border accent).

### 3. Rendering Technique Selection
- **CSS 3D & Custom Properties**: Best for cards, buttons, badges, modals, and hover depth.
- **Dynamic SVG Math**: Best for graph nodes, chunk connectors, retrieval similarity arcs, and citation links.
- **HTML5 Canvas + `requestAnimationFrame`**: Best for particle backgrounds, document scanning rays, and dense visual benchmarks.

### 4. Implementation with Bulletproof Cleanup
- Always unregister event listeners (`pointermove`, `pointerup`, `pointercancel`, `resize`, `scroll`).
- Always cancel `cancelAnimationFrame(rafId)` in `useEffect` cleanup return functions.
- Disconnect any `ResizeObserver` or `IntersectionObserver` instances.
- Check `pointerType === 'touch'` to prevent unintended scroll lockouts (`touch-action: pan-y`).

### 5. Browser Verification Checklist
- Run `npm run build --prefix frontend` to ensure zero TypeScript errors.
- Test in Chrome with `Emulate CSS media feature prefers-reduced-motion: reduce`.
- Audit Performance panel: ensure frame duration remains under 16.6ms (60fps) with zero red forced-reflow triangles.
