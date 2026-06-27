# PHENYX component conventions

## Never use a bare `hidden` / `className="hidden"` class

The Onairos SDK (mounted on the onboarding s6 connect screen via
`OnairosButtonWrapper`) leaks a **global `.hidden` CSS rule** into the page. Any
PHENYX element that relies on a bare `hidden` utility class can be silently
clobbered by the SDK's rule, hiding UI we intended to show (or vice-versa).

**Do not** write:

```tsx
<div className="hidden">…</div>
```

**Do** use a Tailwind responsive/scoped variant, `sr-only`, or a namespaced
class so PHENYX visibility logic never collides with the leaked global:

```tsx
<div className="max-lg:hidden">…</div>   // responsive hide
<div className="sr-only">…</div>          // screen-reader only
<div style={{ display: "none" }}>…</div>  // inline, scoped to the element
```

### Enforcement

This is enforced as a lint rule, not just a convention: see
`frontend/eslint.config.mjs` — a `no-restricted-syntax` rule flags
`className="hidden"` / `class="hidden"` in `app/`, `components/`, and `hooks/`.

(The eslint toolchain is not yet installed in this worktree, so the rule is
dormant until eslint + `@typescript-eslint/parser` are wired into CI; the config
is already in place so it activates automatically once they are.)
