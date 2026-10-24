# Dependency upgrade candidate — 24 October 2026

59 direct dependency declarations and six transitive overrides were updated. The auxiliary service moves MongoDB 6.21.0 to 7.7.0 with its own committed lockfile. Versions were queried from npm; the earlier 123-package NPMScan inventory and final root/service npm audits found no known vulnerabilities. This does not certify absence of application flaws or successful production database connectivity.

## Compatibility exceptions

- `@hookform/resolvers` 5.9.2: npm rejects 6.0.0 because its optional Effect 4 peer conflicts with the TypeSchema/Effect 3 optional peer graph.
- TypeScript 6.0.3: TypeScript 7.0.2 exceeds the `typescript-eslint` 8.72.0 supported peer range (<6.1.0).
- Nitro stays at 3.0.260603-beta: clean resolution rejects the newer beta against Lovable config's prerelease peer range. No `--force` or `--legacy-peer-deps` was used.
- troika-three-text remains 0.53.0; npm's `latest` tag points to 0.52.5. This change does not silently downgrade an already installed newer release.

## Source and harness compatibility

Two removed TanStack `.inputValidator` calls now use `.validator`, and their test adapter uses the same API. All assertions are retained. The paired CodSpeed reference still uses fd65b3d's source/fixtures but explicitly receives the candidate manifest/lockfile and shares its installed dependencies; both file comparisons and the environment verification remain mandatory. This isolates source changes under identical dependencies rather than failing just because dependencies were updated. It does not establish the performance impact of the dependency upgrade in isolation.

## Validation and rollout

`npm ci --ignore-scripts`, TypeScript, zero-warning ESLint, and production build passed locally under Node 24.22.1 (CI pins 24.22.0). The initial full suite exposed 14 failures in the old TanStack test adapter; all 14 pass after the compatibility correction. A new full suite is running on the final candidate. The auxiliary signature/engine tests passed all six cases. Real MongoDB 7 connectivity, real multiplayer sessions and all release gates still require validation. Keep this PR draft; do not merge or deploy while those are missing or failed.

## Direct declarations

| Package                           | Before   | Candidate |
| --------------------------------- | -------- | --------- |
| @hookform/resolvers               | ^5.9.1   | 5.9.2     |
| @lovable.dev/email-js             | ^0.3.1   | 0.5.0     |
| @lovable.dev/mcp-js               | 3.0.5    | 3.3.0     |
| @radix-ui/react-accordion         | ^1.2.21  | 1.3.1     |
| @radix-ui/react-alert-dialog      | ^1.1.24  | 1.2.1     |
| @radix-ui/react-aspect-ratio      | ^1.1.16  | 1.2.0     |
| @radix-ui/react-avatar            | ^1.2.7   | 1.3.1     |
| @radix-ui/react-checkbox          | ^1.3.12  | 1.4.1     |
| @radix-ui/react-collapsible       | ^1.1.21  | 1.2.1     |
| @radix-ui/react-context-menu      | ^2.3.8   | 2.4.1     |
| @radix-ui/react-dialog            | ^1.2.0   | 1.3.1     |
| @radix-ui/react-dropdown-menu     | ^2.1.25  | 2.2.1     |
| @radix-ui/react-hover-card        | ^1.1.24  | 1.2.1     |
| @radix-ui/react-label             | ^2.1.16  | 2.1.17    |
| @radix-ui/react-menubar           | ^1.1.25  | 1.2.1     |
| @radix-ui/react-navigation-menu   | ^1.3.0   | 1.4.1     |
| @radix-ui/react-popover           | ^1.2.0   | 1.3.1     |
| @radix-ui/react-progress          | ^1.1.17  | 1.2.1     |
| @radix-ui/react-radio-group       | ^1.4.8   | 1.5.1     |
| @radix-ui/react-scroll-area       | ^1.3.0   | 1.4.0     |
| @radix-ui/react-select            | ^2.3.8   | 2.4.1     |
| @radix-ui/react-separator         | ^1.1.16  | 1.2.0     |
| @radix-ui/react-slider            | ^1.5.0   | 1.6.1     |
| @radix-ui/react-slot              | ^1.4.0   | 1.5.0     |
| @radix-ui/react-switch            | ^1.3.8   | 1.4.1     |
| @radix-ui/react-tabs              | ^1.1.22  | 1.2.1     |
| @radix-ui/react-toggle            | ^1.1.19  | 1.2.1     |
| @radix-ui/react-toggle-group      | ^1.1.20  | 1.2.1     |
| @radix-ui/react-tooltip           | ^1.3.0   | 1.4.1     |
| @react-email/render               | ^2.1.0   | 2.1.1     |
| @stripe/stripe-js                 | ^10.0.0  | 10.1.0    |
| @supabase/supabase-js             | ^2.117.2 | 2.118.0   |
| @tanstack/react-query             | ^5.104.1 | 5.104.5   |
| @tanstack/react-router            | 1.170.41 | 1.170.46  |
| @tanstack/react-start             | 1.168.60 | 1.169.4   |
| @tanstack/react-table             | ^9.2.6   | 9.3.1     |
| @tanstack/router-plugin           | 1.168.42 | 1.168.48  |
| firebase                          | ^13.0.0  | 13.1.0    |
| lenis                             | ^1.3.26  | 1.3.27    |
| lucide-react                      | ^1.52.0  | 1.61.0    |
| posthog-js                        | ^1.435.8 | 1.438.21  |
| react                             | ~19.3.0  | 19.3.1    |
| react-dom                         | ~19.3.0  | 19.3.1    |
| react-hook-form                   | ^7.89.0  | 7.91.0    |
| react-resizable-panels            | ^4.14.2  | 4.15.0    |
| stripe                            | ^23.0.0  | 23.0.1    |
| troika-three-text                 | ^0.53.0  | 0.53.0    |
| @codspeed/tinybench-plugin        | ^5.7.1   | 6.1.0     |
| @lovable.dev/vite-tanstack-config | 2.26.5   | 2.26.7    |
| @types/node                       | ^26.6.4  | 26.6.5    |
| drizzle-orm                       | ^0.45.3  | 0.45.4    |
| eslint                            | ^10.12.0 | 10.13.0   |
| eslint-plugin-prettier            | ^5.5.6   | 5.5.7     |
| prettier                          | ^3.9.9   | 3.9.10    |
| tinybench                         | ^5.1.0   | 6.2.2     |
| typescript                        | ^5       | 6.0.3     |
| typescript-eslint                 | ^8.71.1  | 8.72.0    |
| vite                              | ^8.3.3   | 8.3.5     |
| vitest                            | ^5.0.3   | 5.0.5     |
