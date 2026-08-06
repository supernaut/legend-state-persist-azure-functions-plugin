# Legend State Azure Functions Persist Plugin

A plugin for persisting [Legend State](https://www.legendapp.com/open-source/state/v3/intro/introduction/) between invocations of [Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview).

## Installation

`@legendapp/state` is a peer dependency, so install it alongside the plugin. You almost
certainly have it already, since you need it to create the observable you are persisting.

```shell
npm i @supernaut/legend-state-persist-azure-functions-plugin @legendapp/state
```

```shell
pnpm add @supernaut/legend-state-persist-azure-functions-plugin @legendapp/state
```

`@azure/functions` is an optional peer. It is only used for the `InvocationContext` type
you may pass in for error logging, so it is erased at build time and you do not need it
installed unless you already have it, which you will inside an Azure Functions app.

## Usage

```TypeScript
import { observable, syncState, when } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';

import { observablePersistAzureStorage } from '@supernaut/legend-state-persist-azure-functions-plugin';

// Create your state
const store$ = observable({
  key: 'value',
});

// Set up persistence with the plugin
syncObservable(state$, {
  persist: {
    name: 'store',
    plugin: observablePersistAzureStorage({
      connectionString: myConnectionString,
      partitionKey: 'store',
      tableName: 'persistedstatetable',
    }),
  },
});

// ...

// Wait for the persisted state to load
const status$ = syncState(state$);
await when(status$.isPersistLoaded);
```

## Releasing

Releases are driven by Changesets and published from GitHub Actions with npm OIDC. Add a
changeset with `pnpm exec changeset` in your pull request, then merge the generated
"chore: release" pull request to publish. See [RELEASING.md](./RELEASING.md).
