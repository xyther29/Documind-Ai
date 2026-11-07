# DocuMind Motion Design Tokens & Easing Guide

This reference establishes the standardized timing, easing, depth scales, and color tokens for interactive animations across the DocuMind AI application.

---

## 1. Timing Constants

Motion in DocuMind is crisp, fast, and purposeful. Avoid sluggish, lingering animations that make the document learning workspace feel unresponsive.

| Token | Duration | Usage |
| :--- | :--- | :--- |
| `DURATION_INSTANT` | `100ms` | Micro-interactions, checkbox clicks, badge toggles. |
| `DURATION_FAST` | `180ms` | Button hover states, tooltip fades, pill selections. |
| `DURATION_STANDARD` | `280ms` | Card elevation, modal enter/exit, dropdown expansions. |
| `DURATION_EMPHASIS` | `400ms` | 3D perspective spring recovery, citation card highlight pulse. |
| `DURATION_SCANNING` | `1400ms` | Indeterminate upload scanning, skeleton shimmer cycles. |

---

## 2. Easing Curves (Cubic Bézier)

All transitions must use non-linear, natural acceleration and deceleration curves:

```css
:root {
  /* DocuMind Spring Out: Snappy start with smooth damped deceleration */
  --ease-spring-out: cubic-bezier(0.16, 1, 0.3, 1);

  /* DocuMind Standard: Balanced enter/exit for UI cards */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  /* DocuMind Accelerate: Quick exit for dismissed items */
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

  /* DocuMind Smooth Settle: Damped return for 3D card tilt release */
  --ease-settle: cubic-bezier(0.25, 0.8, 0.25, 1);
}
```

---

## 3. Depth & Perspective Tokens

```css
:root {
  /* Standard 3D perspective wrapper */
  --perspective-default: 1000px;
  --perspective-deep: 1400px;

  /* Rotation bounds */
  --tilt-max-deg: 7deg;
  --tilt-subtle-deg: 3.5deg;

  /* Specular Sheen Opacity */
  --sheen-max-opacity: 0.14;
}
```

---

## 4. DocuMind Color Tokens for Dynamic Lighting

When rendering specular highlights, radial gradients, or dynamic particle effects, use these exact hex and rgba values to harmonize with Tailwind configuration:

| Semantic Token | Hex Value | RGBA Equivalent (Lighting / Sheen) |
| :--- | :--- | :--- |
| **Navy Primary** | `#142D4E` | `rgba(20, 45, 78, 1.0)` |
| **Navy Subtle Shadow** | `#0B1A2D` | `rgba(11, 26, 45, 0.08)` |
| **Electric Blue Accent** | `#3478F6` | `rgba(52, 120, 246, 0.22)` (Focus / active glow) |
| **Teal Citation Accent** | `#0F9D91` | `rgba(15, 157, 145, 0.18)` (Passage highlight) |
| **Amber Warning / Notice**| `#E8A23A` | `rgba(232, 162, 58, 0.20)` (Fallback indicator) |
| **Canvas Background** | `#F3F6FA` | Soft neutral workspace background |
| **Specular Sheen** | `#FFFFFF` | `rgba(255, 255, 255, 0.35)` |
