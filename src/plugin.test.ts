import { expect, test } from 'vitest';

import { type ObservablePersistAzureStorageOptions } from './plugin.js';

test('observablePersistAzureStorage', () => {
  const options: ObservablePersistAzureStorageOptions = {
    connectionString: 'connectionString',
    partitionKey: 'partitionKey',
    tableName: 'tableName',
  };
  expect(options).toBeDefined();
});
