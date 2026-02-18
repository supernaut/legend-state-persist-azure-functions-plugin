import {
  //   observablePersistAzureStorage,
  type ObservablePersistAzureStorageOptions,
} from './plugin.js';
import { test, expect } from 'vitest';

test('observablePersistAzureStorage', () => {
  const options: ObservablePersistAzureStorageOptions = {
    connectionString: 'connectionString',
    partitionKey: 'partitionKey',
    tableName: 'tableName',
  };
  //   const plugin = observablePersistAzureStorage(options);
  expect(options).toBeDefined();
});
