// PHENYX ESLint flat config.
//
// PHE-17 (.hidden CSS-collision guard — acceptance criterion):
// The Onairos SDK leaks a GLOBAL `.hidden` class into the page. If any PHENYX
// component relies on a bare `hidden` / `className="hidden"` utility, the SDK's
// rule can clobber it and silently hide our UI. This rule BANS the bare `hidden`
// className in PHENYX source; use Tailwind responsive/scoped variants instead
// (e.g. `max-lg:hidden`, `sr-only`, or a namespaced class).
//
// NOTE: the lint toolchain (eslint + @typescript-eslint/parser) is not yet
// installed in this worktree, so `pnpm lint` is currently a no-op/absent. This
// config encodes the rule so it activates the moment the toolchain is wired into
// CI. The parser is imported defensively so a missing dep never hard-crashes a
// run; the convention is also documented in components/phenyx/CONVENTIONS.md.

let tsParser;
try {
  tsParser = (await import("@typescript-eslint/parser")).default;
} catch {
  tsParser = undefined;
}

const banBareHidden = [
  "error",
  {
    selector: 'JSXAttribute[name.name="className"][value.value="hidden"]',
    message:
      'Do not use a bare `className="hidden"`: the Onairos SDK leaks a global `.hidden` class that can clobber it. Use a Tailwind responsive/scoped variant (e.g. `max-lg:hidden`) or `sr-only` instead.',
  },
  {
    selector: 'JSXAttribute[name.name="class"][value.value="hidden"]',
    message:
      'Do not use a bare `class="hidden"`: the Onairos SDK leaks a global `.hidden` class that can clobber it. Use a Tailwind responsive/scoped variant (e.g. `max-lg:hidden`) or `sr-only` instead.',
  },
];

export default [
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    ignores: ["node_modules/**", ".next/**", "vendor/**"],
    ...(tsParser
      ? {
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              sourceType: "module",
              ecmaFeatures: { jsx: true },
            },
          },
        }
      : {}),
    rules: {
      "no-restricted-syntax": banBareHidden,
    },
  },
];
