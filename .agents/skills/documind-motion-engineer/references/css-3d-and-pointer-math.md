# CSS 3D Transforms & Pointer Mathematics

This reference provides the mathematical foundations for mouse, touch, and pen-driven 3D perspective animations in DocuMind AI.

---

## 1. Normalized Relative Coordinates

To create natural, perspective-aware tilt and lighting, always normalize pointer positions relative to the bounding box of the target element:

```typescript
function getNormalizedPointerCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { normX: number; normY: number } {
  // Compute coordinates relative to element center: -1.0 (top/left) to +1.0 (bottom/right)
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const normX = (x / rect.width) * 2 - 1;
  const normY = (y / rect.height) * 2 - 1;

  // Clamp strictly between -1.0 and +1.0
  const clampedX = Math.max(-1, Math.min(1, normX));
  const clampedY = Math.max(-1, Math.min(1, normY));

  return { normX: clampedX, normY: clampedY };
}
```

---

## 2. 3D Rotation Calculation

In CSS 3D:
- Tilting upwards around the horizontal axis requires **negative `rotateX`**.
- Tilting downwards requires **positive `rotateX`**.
- Tilting rightwards around the vertical axis requires **positive `rotateY`**.
- Tilting leftwards requires **negative `rotateY`**.

```typescript
// For a maximum tilt angle of 7 degrees:
const MAX_TILT_DEG = 7.0;

const rotateX = -normY * MAX_TILT_DEG; // Negative invert for natural elevation
const rotateY = normX * MAX_TILT_DEG;
```

---

## 3. High-Performance CSS Variable Propagation

Never store continuous pointer coordinates in React state (`useState`), as this triggers 60+ full component re-renders per second, re-evaluating child JSX nodes. Instead, set CSS custom properties directly on the element style property:

```typescript
function applyPerspectiveTransform(
  element: HTMLElement,
  normX: number,
  normY: number,
  maxTiltDeg: number = 7.0
) {
  const rotateX = (-normY * maxTiltDeg).toFixed(2);
  const rotateY = (normX * maxTiltDeg).toFixed(2);
  const sheenX = (((normX + 1) / 2) * 100).toFixed(1);
  const sheenY = (((normY + 1) / 2) * 100).toFixed(1);

  // Direct CSS custom property injection — ZERO React re-renders
  element.style.setProperty("--tilt-x", `${rotateX}deg`);
  element.style.setProperty("--tilt-y", `${rotateY}deg`);
  element.style.setProperty("--sheen-x", `${sheenX}%`);
  element.style.setProperty("--sheen-y", `${sheenY}%`);
}
```

Corresponding CSS:
```css
.perspective-card-inner {
  transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateZ(0);
  will-change: transform;
}

.perspective-sheen {
  background: radial-gradient(
    circle at var(--sheen-x, 50%) var(--sheen-y, 50%),
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0) 60%
  );
}
```

---

## 4. Touch & Pen Event Compatibility

When pointer events originate from touch or pen inputs:
1. Touch devices do not produce hover states; applying sticky 3D tilt can look broken.
2. If `e.pointerType === 'touch'`, skip active 3D rotation and rely on standard tactile feedback (`active:scale-[0.98]`).
3. Set `touch-action: pan-y` on container elements so vertical page scrolling is never blocked by horizontal pointer movement.
