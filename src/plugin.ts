import { type TableEntity, odata, TableClient } from '@azure/data-tables';
import type { InvocationContext } from '@azure/functions';

import { applyChanges, internal } from '@legendapp/state';
import type { Change } from '@legendapp/state';
import type {
  ObservablePersistPlugin,
  PersistMetadata,
} from '@legendapp/state/sync';

const { safeParse, safeStringify } = internal;

export type ObservablePersistAzureStorageOptions = {
  connectionString: string;
  partitionKey: string;
  tableName: string;
};

type EntityData = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  metadata: PersistMetadata;
};

export class ObservablePersistAzureStorage implements ObservablePersistPlugin {
  private readonly client: TableClient;
  private context: InvocationContext | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private data: Record<string, any> = {};
  private metadata: Record<string, PersistMetadata> = {};
  private readonly partitionKey: string;
  private tablesReadyPromise?: Promise<void>;

  /**
   * Started on first use rather than in the constructor. An eagerly created
   * promise that nobody awaits becomes an `unhandledRejection` the moment
   * storage answers `ServerBusy`, which on Node's default
   * `--unhandled-rejections=throw` can take the worker down.
   */
  private get tablesReady(): Promise<void> {
    this.tablesReadyPromise ??= this.ensureTablesExist();
    return this.tablesReadyPromise;
  }

  constructor(
    options: ObservablePersistAzureStorageOptions,
    context?: InvocationContext,
  ) {
    if (context) {
      this.context = context;
    }
    if (!options.connectionString) {
      throw new Error('No valid connection string provided');
    }
    if (!options.tableName) {
      throw new Error('No valid table name provided');
    }
    if (!options.partitionKey) {
      throw new Error('No valid partition key provided');
    }
    this.client = TableClient.fromConnectionString(
      options.connectionString,
      options.tableName,
    );
    this.partitionKey = options.partitionKey;
  }

  public async deleteMetadata(table: string) {
    delete this.metadata[table];
    await this.save(table);
  }

  public async deleteTable(table: string) {
    await this.tablesReady;
    delete this.data[table];
    const rowKey = this.getRowKey(table);
    await this.client.deleteEntity(this.partitionKey, rowKey);
  }

  public getMetadata(table: string): PersistMetadata {
    return this.metadata[table] ?? {};
  }

  public getTable(table: string, init: object) {
    return this.data[table] ?? init ?? {};
  }

  public async loadTable(table: string): Promise<void> {
    if (this.data[table] === undefined)
      try {
        const listResults = await this.client.listEntities<EntityData>({
          queryOptions: {
            filter: odata`PartitionKey eq '${this.partitionKey}'`,
          },
        });
        for await (const row of listResults) {
          const { content } = row;
          this.data[table] = content ? safeParse(content) : undefined;
        }
      } catch (error) {
        this.context?.error(
          '[legend-state] Azure TableClient.listEntities failed',
          table,
          error,
        );
      }
  }

  /**
   * Returns the write rather than firing it off unobserved.
   *
   * `ObservablePersistPlugin.set` is typed `Promise<any> | void`, so returning
   * the promise lets Legend State await it and report a failure through
   * `onSetError`. Previously the call was made and dropped, so a throttled
   * `upsertEntity` rejected with nobody listening: in production a burst of
   * these arrived as `RestError at handleErrorResponse` with no operation name,
   * roughly 180,000 of them a day.
   */
  public set(table: string, changes: Change[]): Promise<void> {
    if (!this.data[table]) {
      this.data[table] = {};
    }
    this.data[table] = applyChanges(this.data[table], changes);
    return this.save(table);
  }
  public setMetadata(table: string, metadata: PersistMetadata): Promise<void> {
    this.metadata[table] = metadata;
    return this.save(table);
  }
  private async createTableIfNotExists(client: TableClient): Promise<void> {
    try {
      await client.createTable();
    } catch (error) {
      if (this.isTableAlreadyExists(error)) {
        return;
      }

      throw error;
    }
  }
  private async ensureTablesExist(): Promise<void> {
    await Promise.all([this.createTableIfNotExists(this.client)]);
  }

  private getRowKey(table: string): string {
    return [this.partitionKey, table].join('-');
  }

  /**
   * Read `statusCode` structurally rather than narrowing on `instanceof
   * RestError`. A consumer that resolves its own copy of `@azure/data-tables`
   * gets a different `RestError` class, and `instanceof` is then false for a
   * genuine 409: the conflict is rethrown, `ensureTablesExist` rejects, and now
   * that `save` awaits readiness every write behind it fails, even though the
   * table was there all along. A 409 from `createTable` only ever means the
   * table already exists.
   */
  private isTableAlreadyExists(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode?: unknown }).statusCode === 409
    );
  }

  // Private
  private async save(table: string) {
    // `this.tablesReady` is a promise, so the previous `if (!this.tablesReady)`
    // was always false and readiness was never actually waited for.
    await this.tablesReady;

    const dataToSave = this.data[table];
    const metadataToSave = this.metadata[table] || '';
    const rowKey = this.getRowKey(table);

    if (dataToSave !== undefined && dataToSave !== null) {
      const entity: TableEntity = {
        content: safeStringify(dataToSave),
        metadata: safeStringify(metadataToSave),
        partitionKey: this.partitionKey,
        rowKey,
      };
      await this.client.upsertEntity(entity);
    } else {
      await this.client.deleteEntity(this.partitionKey, rowKey);
    }
  }
}
export function observablePersistAzureStorage(
  options: ObservablePersistAzureStorageOptions,
  context?: InvocationContext,
) {
  return new ObservablePersistAzureStorage(options, context);
}
