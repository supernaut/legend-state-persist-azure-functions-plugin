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

Choosing the bump:

| bump    | when                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| `patch` | a bug fix that does not change the documented surface                        |
| `minor` | new behaviour, or a visible change consumers should read about before taking |
| `major` | a consumer must change their code to upgrade                                 |

If in doubt between `patch` and `minor`, take `minor`. It costs nothing and it puts the
entry where people will see it.

### 2. Merge your PR to `main`

The **Release** workflow runs on every push to `main`. When unreleased changesets are
present it does not publish. It opens (or updates) a pull request titled **"chore: release
v2.1.0"**, naming the version it proposes, that consumes the changeset files, bumps the
version in `package.json` and writes `CHANGELOG.md`.

The version cannot be known until `changeset version` has run, so the workflow opens the
pull request and then renames it from the bumped `package.json`. That title becomes the
commit message when the pull request is squashed, which is why it is a conventional commit
and not the `Version Packages` default.

Review that PR the way you would any other. The version bump and the changelog wording
are the things worth reading.

### 3. Merge the release pull request

Merging it pushes to `main` again. This time there are no changesets left, so the same
workflow takes the other branch and runs `pnpm release`, which publishes to npm and
pushes the git tag.

That is the whole loop: **merge your PR, then merge the release PR.**

## What the workflow guarantees

`.github/workflows/release.yml`, on push to `main`:

1. Checks that `RELEASE_TOKEN` exists, so an expired token fails by name rather than as a
   403 at checkout.
2. Checks out with `fetch-depth: 0`, because Changesets reads tags and history, using
   `RELEASE_TOKEN` so later pushes are attributed to it.
3. Runs `pnpm run ci`, which is `check-format && lint && test && build`. This is a full
   gate rather than just a build, because this job can publish and it does not wait for
   the separate CI workflow.
4. Runs `changesets/action`, which either opens the release PR or does nothing.
5. Renames that PR to `chore: release v<version>` once the bump is known.
6. Publishes only when `hasChangesets == 'false'`.

`concurrency.cancel-in-progress` is deliberately `false`. `changeset publish` pushes tags
and publishes in sequence, and an interrupted run can leave a tag with no package behind
it. npm will not let you republish that version.

`prepublishOnly` runs `pnpm run ci` again at publish time, so a broken build cannot reach
npm even if the workflow is edited later.

## Authentication

Two separate things authenticate, and they are unrelated.

### Publishing to npm

There is no `NPM_TOKEN`. The job requests `id-token: write` and npm authenticates the
publish through OIDC, which also attaches [provenance](https://docs.npmjs.com/generating-provenance-statements)
via `publishConfig.provenance`. Provenance requires the run to come from this public
repository, which is why the job is guarded by

```yaml
if: github.repository == 'supernaut/legend-state-persist-azure-functions-plugin'
```

so forks cannot attempt to publish.

### Talking to GitHub: `RELEASE_TOKEN`

Git pushes and the release pull request use a personal access token stored as
`RELEASE_TOKEN` on the `release` environment, not the built-in `GITHUB_TOKEN`.

The reason is a deliberate GitHub loop-prevention rule: **anything `GITHUB_TOKEN` creates
does not trigger another workflow.** A release pull request opened by `GITHUB_TOKEN` gets
no CI run, so the one pull request that changes the published version would be the only
one nobody tests. A pull request opened by a PAT triggers workflows normally.

Using a PAT has a second benefit. The repository setting _Allow GitHub Actions to create
and approve pull requests_ only governs `GITHUB_TOKEN`, so it can stay **off**.

**Creating the token.** Use a
[fine-grained PAT](https://github.com/settings/personal-access-tokens/new) scoped to this
repository only, with these repository permissions:

| permission    | access         | why                                                  |
| ------------- | -------------- | ---------------------------------------------------- |
| Contents      | Read and write | push the `changeset-release/main` branch and the tag |
| Pull requests | Read and write | open and update the release pull request             |
| Metadata      | Read           | mandatory, granted automatically                     |

Nothing else. Then add it:

```bash
gh secret set RELEASE_TOKEN --env release --repo supernaut/legend-state-persist-azure-functions-plugin
```

**It expires.** A fine-grained PAT lasts at most a year, and when it lapses every release
fails. The workflow checks for the secret first and fails with a named error rather than
an opaque 403 at checkout, but the calendar reminder is on you. Set one for a week before
expiry.

**If this becomes annoying,** a GitHub App installation token via
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)
does the same job without expiring and without being tied to one person's account. That
is the better long-term answer for anything with more than one maintainer.

### The `release` environment

The job uses the `release` GitHub environment, which is where `RELEASE_TOKEN` lives, so
the token is not readable by workflows on other branches. Add required reviewers there if
you want a human approval gate before anything reaches npm.

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
