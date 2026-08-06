---
'@supernaut/legend-state-persist-azure-functions-plugin': minor
---

Observe persistence writes instead of firing them unobserved

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
