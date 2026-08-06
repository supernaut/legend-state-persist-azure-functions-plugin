# Releasing

This package is released with [Changesets](https://github.com/changesets/changesets) and
published to npm from GitHub Actions. Publishing uses npm's OIDC trusted publishing, so
there is no npm token to hold or rotate.

You never run `npm publish` by hand. The normal path is two merges.

## The normal path

### 1. Describe the change

On your feature branch, once the code is ready:

```bash
pnpm exec changeset
```

Pick the bump type and write a summary. That creates a Markdown file in `.changeset/`.
Commit it with your work. A pull request with no changeset releases nothing, which is
correct for changes that do not affect consumers (CI config, tests, docs).

Choosing the bump, for a `1.x` package:

| bump    | when                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| `patch` | a bug fix that does not change the documented surface                        |
| `minor` | new behaviour, or a visible change consumers should read about before taking |
| `major` | a consumer must change their code to upgrade                                 |

If in doubt between `patch` and `minor`, take `minor`. It costs nothing and it puts the
entry where people will see it.

### 2. Merge your PR to `main`

The **Release** workflow runs on every push to `main`. When unreleased changesets are
present it does not publish. It opens (or updates) a pull request titled **"chore:
release"** that consumes the changeset files, bumps the version in `package.json` and
writes `CHANGELOG.md`.

Review that PR the way you would any other. The version bump and the changelog wording
are the things worth reading.

### 3. Merge the release pull request

Merging it pushes to `main` again. This time there are no changesets left, so the same
workflow takes the other branch and runs `pnpm release`, which publishes to npm and
pushes the git tag.

That is the whole loop: **merge your PR, then merge the release PR.**

## What the workflow guarantees

`.github/workflows/release.yml`, on push to `main`:

1. Checks out with `fetch-depth: 0`, because Changesets reads tags and history.
2. Runs `pnpm run ci`, which is `check-format && lint && test && build`. This is a full
   gate rather than just a build, because this job can publish and it does not wait for
   the separate CI workflow.
3. Runs `changesets/action`, which either opens the release PR or does nothing.
4. Publishes only when `hasChangesets == 'false'`.

`concurrency.cancel-in-progress` is deliberately `false`. `changeset publish` pushes tags
and publishes in sequence, and an interrupted run can leave a tag with no package behind
it. npm will not let you republish that version.

`prepublishOnly` runs `pnpm run ci` again at publish time, so a broken build cannot reach
npm even if the workflow is edited later.

## Authentication

There is no `NPM_TOKEN`. The job requests `id-token: write` and npm authenticates the
publish through OIDC, which also attaches [provenance](https://docs.npmjs.com/generating-provenance-statements)
via `publishConfig.provenance`. Provenance requires the run to come from this public
repository, which is why the job is guarded by

```yaml
if: github.repository == 'supernaut/legend-state-persist-azure-functions-plugin'
```

so forks cannot attempt to publish.

The job also uses the `release` GitHub environment. Add required reviewers there if you
want a human approval gate before anything reaches npm.

## Releasing by hand

Only if Actions is unavailable. You need npm publish rights on the `@supernaut` scope,
and the publish will have no provenance attached.

```bash
pnpm install --frozen-lockfile
pnpm run ci
pnpm exec changeset version   # bumps package.json and CHANGELOG.md
git commit -am "chore: release"
pnpm exec changeset publish   # publishes and creates the tag
git push --follow-tags
```

`pnpm run local-release` does the `version` and `publish` halves in one step, but it does
not commit or push, so prefer the explicit sequence above.

## Checks before you release

- `pnpm run ci` passes locally.
- `dist/` contains only `index.*` and `plugin.*`. Test files are excluded by the
  `src/**/*.test.ts` entry in `tsconfig.json`'s `exclude`; they used to ship.
- The consuming app can resolve types from the package root. `package.json` declares
  `types`, so importing from `@supernaut/legend-state-persist-azure-functions-plugin`
  is enough and reaching into `dist/plugin` is not needed.

## Known snag

`typescript` is pinned to `^6`. `typescript-eslint` does not support the TypeScript 7 API
yet, and on TS 7 `eslint .` aborts with `ERR_INTERNAL_ASSERTION` instead of reporting
findings, which also blocks the lefthook pre-commit hook. Revisit when
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
closes.
