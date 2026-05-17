---
name: ui-ux-pro-max
description: Builds polished React and Next.js interfaces with shadcn/ui, 21st.dev registry components, Tailwind CSS, and Framer Motion. Use when creating landing pages, dashboards, product UI, animated sections, forms, onboarding, empty states, or when the user mentions 21st.dev, Framer Motion, UI UX Pro Max, premium UI, or Cursor website design.
---

# UI UX Pro Max

## Workflow

1. Start from the product goal, audience, and primary conversion or task.
2. Use the local stack first: Next.js App Router, Tailwind CSS, shadcn/ui source components, 21st.dev registry components, and Framer Motion.
3. Compose the interface from reusable sections and accessible primitives before adding custom effects.
4. Add motion only where it clarifies hierarchy, sequencing, feedback, or delight.
5. Finish by checking responsiveness, keyboard states, contrast, loading states, empty states, and error states.

## Design Defaults

- Prefer strong hierarchy: one clear hero promise, one primary action, one supporting action.
- Use generous spacing, consistent radius, and a limited color palette based on theme tokens.
- Use shadcn/ui primitives for common controls instead of raw form and dialog elements.
- Use 21st.dev components when they provide a meaningful visual upgrade, then adapt them to the local theme.
- Keep animation subtle: short durations, eased entrances, hover feedback, and no constant distraction.
- Avoid generic template copy, overcrowded gradients, mismatched shadows, and arbitrary one-off colors.

## 21st.dev Components

Install registry components with:

```bash
npx shadcn@latest add https://21st.dev/r/<creator>/<component>
```

After installing a component:

1. Check whether it needs `"use client"`.
2. Verify imports resolve through `@/components`, `@/lib`, and `@/components/ui`.
3. Replace hard-coded colors with theme tokens when practical.
4. Use it in at least one page or component so the integration is build-tested.

## Framer Motion

- Import from `framer-motion` in this project.
- Put motion usage in client components.
- Use `initial`, `animate`, and `transition` for simple entrance motion.
- Keep layout and scroll animations focused on content comprehension.

## Quality Bar

Before calling work done:

- The page works at mobile, tablet, and desktop widths.
- Interactive elements have visible focus states and clear labels.
- Important content is semantic HTML, not decorative-only containers.
- The build and lint commands pass, or any remaining failures are documented.
