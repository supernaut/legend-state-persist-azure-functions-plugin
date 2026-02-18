import {
  type TableEntity,
  odata,
  RestError,
  TableClient,
} from '@azure/data-tables';
import type { InvocationContext } from '@azure/functions';

import { applyChanges, internal } from '@legendapp/state';
import type { Change } from '@legendapp/state';
import type {
  ObservablePersistPlugin,
  PersistMetadata,
} from '@legendapp/state/sync';

const { safeParse, safeStringify } = internal;

type EntityData = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
};

const METADATA_SUFFIX = '__m';

export type ObservablePersistAzureStorageOptions = {
  connectionString: string;
  partitionKey: string;
  tableName: string;
};

export class ObservablePersistAzureStorage implements ObservablePersistPlugin {
  private readonly client: TableClient;
  private context: InvocationContext | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private data: Record<string, any> = {};
  private readonly partitionKey: string;
  private readonly tablesReady: Promise<void>;

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
    this.tablesReady = this.ensureTablesExist();
  }

  public deleteMetadata(table: string) {
    this.deleteTable(table + METADATA_SUFFIX);
  }

  public async deleteTable(table: string) {
    if (!this.tablesReady) {
      return undefined;
    }
    delete this.data[table];
    const rowKey = this.getRowKey(table);
    await this.client.deleteEntity(this.partitionKey, rowKey);
  }

  public getMetadata(table: string): PersistMetadata {
    return this.getTable(table + METADATA_SUFFIX, {});
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

  public set(table: string, changes: Change[]): void {
    if (!this.data[table]) {
      this.data[table] = {};
    }
    this.data[table] = applyChanges(this.data[table], changes);
    this.save(table);
  }
  public setMetadata(table: string, metadata: PersistMetadata) {
    table = table + METADATA_SUFFIX;
    this.data[table] = metadata;
    this.save(table);
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

  private isTableAlreadyExists(error: unknown): boolean {
    return error instanceof RestError && error.statusCode === 409;
  }

  // Private
  private async save(table: string) {
    if (!this.tablesReady) {
      throw new Error('Azure data tables not ready!');
    }

    const dataToSave = this.data[table];
    const rowKey = this.getRowKey(table);

    if (dataToSave !== undefined && dataToSave !== null) {
      const entity: TableEntity = {
        content: safeStringify(dataToSave),
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
