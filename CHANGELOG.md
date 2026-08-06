# legend-state-persist-azure-functions-plugin

## 2.0.0

### Major Changes

- 69bce4e: Move `@legendapp/state` and `@azure/functions` to peer dependencies

  The plugin operates on observables and `Change[]` objects created by the consumer's copy
  of Legend State, and calls `applyChanges` and `internal.safeStringify` on them. Shipping
  its own copy as a regular dependency meant those could be two different module instances,
  with the version skew and identity mismatches that follow. It is now a required peer,
  `^3.0.0-beta.48`.

  `@azure/functions` is an **optional** peer. It is only referenced as `import type {
InvocationContext }`, so it is erased at build time and does not appear in the emitted
  output at all. Consumers who never pass a context do not need it installed.

  **Upgrading:** add `@legendapp/state` to your own dependencies if you do not already
  declare it. In practice you always do, since you need it to create the observable you are
  persisting, so most consumers will see no change. This is released as a major because a
  strict installer will now report an unmet peer rather than silently providing one.

### Minor Changes

- 69bce4e: Observe persistence writes instead of firing them unobserved

  `set` and `setMetadata` called `save` without awaiting it and without a catch, so a
  rejected `upsertEntity` had no handler attached. On Node's default
  `--unhandled-rejections=throw` that can tear a worker down. Both now return the save
  promise, which `ObservablePersistPlugin` allows (`Promise<any> | void`), so Legend State
  awaits it and reports failures through `onSetError`.

  Also in this release:

  - Table readiness starts on first use rather than in the constructor. An eagerly created
    promise that nobody awaits is the same unobserved-rejection trap.
  - `save` now actually waits for readiness. The previous guard tested a promise for
    truthiness, which is always true.
  - The 409 from `createTable` is detected structurally rather than with `instanceof
RestError`, so a consumer that resolves its own copy of `@azure/data-tables` is not
    misled by a different class identity.
  - Tests are excluded from the published build. `dist` previously shipped
    `plugin.test.js`.
  - `types` is declared in `package.json`, so consumers get the type surface from the
    package root instead of reaching into `dist/plugin`.

### Patch Changes

- 12f3995: Add options validation

## 1.1.0

### Minor Changes

- d11d81c: Remove breaking import

## 1.0.1

### Patch Changes

- 39e6c79: Added readme file

## 1.0.0

### Major Changes

- b49b354: initial release
