# Legend State Azure Functions Persist Plugin

A plugin for persisting [Legend State](https://www.legendapp.com/open-source/state/v3/intro/introduction/) between invocations of [Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview).

## Installation

```shell
npm i @supernaut/legend-state-persist-azure-functions-plugin
```

```shell
pnpm add @supernaut/legend-state-persist-azure-functions-plugin
```

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
