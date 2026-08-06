import { expect, test, vi } from 'vitest';

import {
  type ObservablePersistAzureStorageOptions,
  ObservablePersistAzureStorage,
} from './plugin.js';

const upsertEntity = vi.hoisted(() => vi.fn());
const createTable = vi.hoisted(() => vi.fn());
const deleteEntity = vi.hoisted(() => vi.fn());

vi.mock('@azure/data-tables', async (importActual) => ({
  // Spread the real module so `RestError` stays a real class; the 409 check
  // narrows on it and a bare factory mock leaves it undefined.
  ...(await importActual<object>()),
  TableClient: {
    fromConnectionString: () => ({ createTable, deleteEntity, upsertEntity }),
  },
}));

const options: ObservablePersistAzureStorageOptions = {
  connectionString: 'connectionString',
  partitionKey: 'partitionKey',
  tableName: 'tableName',
};

test('observablePersistAzureStorage', () => {
  expect(options).toBeDefined();
});

/**
 * The production fault this guards against. `set` used to call `save` without
 * awaiting it and without a catch, so a throttled `upsertEntity` rejected with
 * no handler attached. On Node's default `--unhandled-rejections=throw` that
 * can tear the worker down, and it filled Application Insights with
 * `RestError at handleErrorResponse` records carrying no operation name.
 */
test('set surfaces a failed write instead of leaving it unhandled', async () => {
  createTable.mockResolvedValue(undefined);
  upsertEntity.mockRejectedValue(new Error('ServerBusy'));

  const plugin = new ObservablePersistAzureStorage(options);
  const result = plugin.set('store', []);

  expect(result).toBeInstanceOf(Promise);
  await expect(result).rejects.toThrow('ServerBusy');
});

test('setMetadata surfaces a failed write too', async () => {
  createTable.mockResolvedValue(undefined);
  upsertEntity.mockRejectedValue(new Error('ServerBusy'));

  const plugin = new ObservablePersistAzureStorage(options);
  // Seed the table so the write takes the upsert path; with no data `save`
  // deletes the row instead.
  await plugin.set('store', []).catch(() => undefined);

  await expect(plugin.setMetadata('store', { lastSync: 1 })).rejects.toThrow(
    'ServerBusy',
  );
});

/**
 * The table was previously ensured from the constructor, which created a
 * promise nobody observed until a write happened.
 */
test('does not touch storage until something is persisted', () => {
  createTable.mockClear();
  createTable.mockResolvedValue(undefined);

  const plugin = new ObservablePersistAzureStorage(options);

  expect(plugin).toBeInstanceOf(ObservablePersistAzureStorage);
  expect(createTable).not.toHaveBeenCalled();
});

test('waits for the table before writing', async () => {
  const calls: string[] = [];
  createTable.mockImplementation(async () => {
    calls.push('createTable');
  });
  upsertEntity.mockImplementation(async () => {
    calls.push('upsertEntity');
  });

  const plugin = new ObservablePersistAzureStorage(options);
  await plugin.set('store', []);

  expect(calls).toEqual(['createTable', 'upsertEntity']);
});
