---
'@supernaut/legend-state-persist-azure-functions-plugin': major
---

Move `@legendapp/state` and `@azure/functions` to peer dependencies

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
