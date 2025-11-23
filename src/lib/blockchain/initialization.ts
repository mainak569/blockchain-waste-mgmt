/**
 * Blockchain Initialization and Migration Utilities
 * Handles blockchain setup, configuration, and data migration
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BlockchainManager } from './manager';
import { blockchainConfig, BlockchainConfig } from './config';
import { Database } from '../db';

export interface InitializationResult {
  success: boolean;
  message: string;
  details?: {
    configCreated: boolean;
    directoriesCreated: boolean;
    genesisBlockCreated: boolean;
    migrationCompleted: boolean;
    validationPassed: boolean;
  };
  errors?: string[];
  warnings?: string[];
}

export interface MigrationOptions {
  sourceDatabase?: string;
  backupBeforeMigration?: boolean;
  validateAfterMigration?: boolean;
  skipExistingTransactions?: boolean;
  batchSize?: number;
}

export interface BackupResult {
  success: boolean;
  backupPath: string;
  timestamp: string;
  size: number;
  transactionCount: number;
  blockCount: number;
}

export class BlockchainInitializer {
  private blockchainManager: BlockchainManager;
  private config: BlockchainConfig;

  constructor() {
    this.config = blockchainConfig.getConfig();
    this.blockchainManager = new BlockchainManager(this.config.blockchainDataDir);
  }

  /**
   * Initialize blockchain system with configuration
   */
  public async initialize(customConfig?: Partial<BlockchainConfig>): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      message: '',
      details: {
        configCreated: false,
        directoriesCreated: false,
        genesisBlockCreated: false,
        migrationCompleted: false,
        validationPassed: false
      },
      errors: [],
      warnings: []
    };

    try {
      // Step 1: Update configuration if provided
      if (customConfig) {
        blockchainConfig.updateConfig(customConfig);
        this.config = blockchainConfig.getConfig();
        result.details!.configCreated = true;
      }

      // Step 2: Create necessary directories
      await this.createDirectories();
      result.details!.directoriesCreated = true;

      // Step 3: Initialize blockchain manager
      await this.blockchainManager.initialize();

      // Step 4: Create genesis block if needed
      const genesisCreated = await this.ensureGenesisBlock();
      result.details!.genesisBlockCreated = genesisCreated;

      // Step 5: Migrate existing data if needed
      const migrationResult = await this.migrateExistingData();
      result.details!.migrationCompleted = migrationResult.success;
      if (!migrationResult.success && migrationResult.errors) {
        result.warnings!.push(...migrationResult.errors);
      }

      // Step 6: Validate blockchain integrity
      const validation = await this.blockchainManager.validateChain();
      result.details!.validationPassed = validation.isValid;
      if (!validation.isValid) {
        result.warnings!.push(...validation.errors);
      }

      // Step 7: Start monitoring if enabled
      if (this.config.enableMetrics) {
        await blockchainConfig.performHealthCheck();
      }

      result.success = true;
      result.message = 'Blockchain initialization completed successfully';

      // Record initialization metrics
      blockchainConfig.recordTransaction('initialization-complete');

    } catch (error) {
      result.success = false;
      result.message = `Initialization failed: ${(error as Error).message}`;
      result.errors!.push((error as Error).message);
      
      blockchainConfig.recordError(`Initialization failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Migrate existing transaction data to blockchain
   */
  public async migrateTransactions(options: MigrationOptions = {}): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      message: '',
      errors: [],
      warnings: []
    };

    try {
      const {
        sourceDatabase = 'blockchain',
        backupBeforeMigration = true,
        validateAfterMigration = true,
        skipExistingTransactions = true,
        batchSize = 100
      } = options;

      // Step 1: Create backup if requested
      if (backupBeforeMigration) {
        const backupResult = await this.createBackup();
        if (!backupResult.success) {
          result.warnings!.push(`Backup creation failed: ${backupResult.backupPath}`);
        }
      }

      // Step 2: Load existing transactions
      const legacyDb = new Database(sourceDatabase);
      const existingTransactions = await legacyDb.read();
      
      if (existingTransactions.length === 0) {
        result.success = true;
        result.message = 'No transactions to migrate';
        return result;
      }

      // Step 3: Convert and migrate transactions in batches
      let migratedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < existingTransactions.length; i += batchSize) {
        const batch = existingTransactions.slice(i, i + batchSize);
        
        for (const legacyTx of batch) {
          try {
            const txData = legacyTx as any;
            // Check if transaction already exists
            if (skipExistingTransactions) {
              const existing = await this.blockchainManager.getTransaction(txData.id);
              if (existing) {
                skippedCount++;
                continue;
              }
            }

            // Convert legacy transaction to blockchain format
            const blockchainTx = this.convertLegacyTransaction(txData);
            
            // Add to blockchain
            await this.blockchainManager.addTransaction(blockchainTx, { skipExpirationCheck: true });
            migratedCount++;

          } catch (error) {
            errorCount++;
            const txData = legacyTx as any;
            result.warnings!.push(`Failed to migrate transaction ${txData.id}: ${(error as Error).message}`);
          }
        }

        // Create block after each batch
        try {
          await this.blockchainManager.createBlock();
        } catch (error) {
          result.warnings!.push(`Failed to create block after batch: ${(error as Error).message}`);
        }
      }

      // Step 4: Validate migration if requested
      if (validateAfterMigration) {
        const validation = await this.blockchainManager.validateChain();
        if (!validation.isValid) {
          result.errors!.push(...validation.errors);
        }
      }

      result.success = errorCount === 0;
      result.message = `Migration completed: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`;

      // Record migration metrics
      blockchainConfig.recordTransaction(`migration-${migratedCount}-transactions`);

    } catch (error) {
      result.success = false;
      result.message = `Migration failed: ${(error as Error).message}`;
      result.errors!.push((error as Error).message);
      
      blockchainConfig.recordError(`Migration failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Create backup of current blockchain state
   */
  public async createBackup(): Promise<BackupResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = this.config.backupDirectory;
      
      // Ensure backup directory exists
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      const backupPath = join(backupDir, `blockchain-backup-${timestamp}.json`);
      
      // Export blockchain data
      const exportData = await this.blockchainManager.exportChain('json');
      writeFileSync(backupPath, exportData);

      // Get statistics
      const stats = await this.blockchainManager.getBlockchainStats();
      const size = Buffer.byteLength(exportData, 'utf8');

      return {
        success: true,
        backupPath,
        timestamp,
        size,
        transactionCount: stats.totalTransactions,
        blockCount: stats.chainHeight + 1
      };

    } catch (error) {
      return {
        success: false,
        backupPath: '',
        timestamp: new Date().toISOString(),
        size: 0,
        transactionCount: 0,
        blockCount: 0
      };
    }
  }

  /**
   * Restore blockchain from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      message: '',
      errors: [],
      warnings: []
    };

    try {
      // Validate backup file exists
      if (!existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Create current backup before restore
      const currentBackup = await this.createBackup();
      if (currentBackup.success) {
        result.warnings!.push(`Current state backed up to: ${currentBackup.backupPath}`);
      }

      // Load backup data
      const backupData = readFileSync(backupPath, 'utf8');
      const parsedData = JSON.parse(backupData);

      // Validate backup format
      if (!parsedData.blocks || !Array.isArray(parsedData.blocks)) {
        throw new Error('Invalid backup format: missing blocks array');
      }

      // Clear current blockchain data
      await this.clearBlockchainData();

      // Restore blocks
      for (const blockData of parsedData.blocks) {
        // This would require implementing block restoration in BlockchainManager
        // For now, we'll add transactions individually
        for (const tx of blockData.body.transactions) {
          await this.blockchainManager.addTransaction(tx, { skipExpirationCheck: true });
        }
      }

      // Validate restored chain
      const validation = await this.blockchainManager.validateChain();
      if (!validation.isValid) {
        result.errors!.push(...validation.errors);
      }

      result.success = validation.isValid;
      result.message = validation.isValid 
        ? `Blockchain restored successfully from ${backupPath}`
        : `Blockchain restored with validation errors`;

    } catch (error) {
      result.success = false;
      result.message = `Restore failed: ${(error as Error).message}`;
      result.errors!.push((error as Error).message);
      
      blockchainConfig.recordError(`Restore failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Reset blockchain to initial state
   */
  public async reset(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      message: '',
      errors: [],
      warnings: []
    };

    try {
      // Create backup before reset
      const backup = await this.createBackup();
      if (backup.success) {
        result.warnings!.push(`Backup created before reset: ${backup.backupPath}`);
      }

      // Clear blockchain data
      await this.clearBlockchainData();

      // Reset configuration to defaults
      blockchainConfig.resetConfig();

      // Reinitialize
      const initResult = await this.initialize();
      
      result.success = initResult.success;
      result.message = initResult.success 
        ? 'Blockchain reset and reinitialized successfully'
        : `Reset failed: ${initResult.message}`;
      
      if (initResult.errors) {
        result.errors!.push(...initResult.errors);
      }
      if (initResult.warnings) {
        result.warnings!.push(...initResult.warnings);
      }

    } catch (error) {
      result.success = false;
      result.message = `Reset failed: ${(error as Error).message}`;
      result.errors!.push((error as Error).message);
      
      blockchainConfig.recordError(`Reset failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Get initialization status
   */
  public async getStatus(): Promise<any> {
    try {
      const stats = await this.blockchainManager.getBlockchainStats();
      const health = blockchainConfig.getHealthStatus();
      const config = blockchainConfig.getConfig();

      return {
        initialized: true,
        configuration: {
          dataDirectory: config.blockchainDataDir,
          maxTransactionsPerBlock: config.maxTransactionsPerBlock,
          enableMetrics: config.enableMetrics,
          enableAutoBackup: config.enableAutoBackup
        },
        statistics: stats,
        health: health,
        lastInitialized: new Date().toISOString()
      };

    } catch (error) {
      return {
        initialized: false,
        error: (error as Error).message,
        lastAttempted: new Date().toISOString()
      };
    }
  }

  /**
   * Create necessary directories
   */
  private async createDirectories(): Promise<void> {
    const directories = [
      this.config.blockchainDataDir,
      this.config.backupDirectory,
      join(this.config.blockchainDataDir, 'config')
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Ensure genesis block exists
   */
  private async ensureGenesisBlock(): Promise<boolean> {
    try {
      const latestBlock = await this.blockchainManager.getLatestBlock();
      
      if (!latestBlock) {
        // Create genesis block
        await this.blockchainManager.createBlock();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to ensure genesis block:', error);
      return false;
    }
  }

  /**
   * Migrate existing data
   */
  private async migrateExistingData(): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Check if there's existing data to migrate
      const legacyDb = new Database('blockchain');
      const existingTransactions = await legacyDb.read();
      
      if (existingTransactions.length > 0) {
        const migrationResult = await this.migrateTransactions({
          skipExistingTransactions: true,
          batchSize: 50
        });
        
        return {
          success: migrationResult.success,
          errors: migrationResult.errors
        };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        errors: [`Migration failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Convert legacy transaction to blockchain format
   */
  private convertLegacyTransaction(legacyTx: Record<string, any>): any {
    return {
      id: legacyTx.id || `TX-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: this.determinTransactionType(legacyTx),
      binId: legacyTx.binId,
      contractorId: legacyTx.contractorId,
      citizenId: legacyTx.citizenId,
      action: legacyTx.action || 'legacy_migration',
      data: legacyTx.data || legacyTx,
      timestamp: legacyTx.timestamp || new Date().toISOString(),
      signature: legacyTx.signature || 'legacy-signature',
      hash: legacyTx.hash || 'legacy-hash'
    };
  }

  /**
   * Determine transaction type from legacy data
   */
  private determinTransactionType(legacyTx: Record<string, any>): string {
    if (legacyTx.contractorId && legacyTx.action?.includes('pickup')) {
      return 'pickup_confirmation';
    }
    if (legacyTx.citizenId && legacyTx.action?.includes('report')) {
      return 'issue_report';
    }
    if (legacyTx.binId) {
      return 'bin_update';
    }
    return 'system_event';
  }

  /**
   * Clear blockchain data (for reset operations)
   */
  private async clearBlockchainData(): Promise<void> {
    // This would implement clearing blockchain storage
    // For now, we'll just log the operation
    console.log('Clearing blockchain data...');
  }
}

// Global initializer instance
export const blockchainInitializer = new BlockchainInitializer();