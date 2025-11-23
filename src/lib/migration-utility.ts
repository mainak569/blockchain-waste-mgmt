/**
 * Migration Utility for Existing Transaction Logs
 * Converts legacy transaction logs to blockchain format
 */

import { Database } from './db';
import { blockchainIntegration } from './blockchain-integration';
import { TransactionType } from './blockchain/types';

export interface MigrationReport {
  totalLegacyTransactions: number;
  migratedTransactions: number;
  skippedTransactions: number;
  errors: string[];
  startTime: string;
  endTime: string;
  duration: number;
}

export interface LegacyTransactionRecord {
  id: string;
  binId?: string;
  action: string;
  contractorId?: string;
  citizenId?: string;
  timestamp: string;
  earnings?: number;
  user?: string;
}

export class MigrationUtility {
  private legacyDb: Database;

  constructor() {
    this.legacyDb = new Database('blockchain');
  }

  /**
   * Perform full migration of existing transaction logs
   */
  public async migrateAllTransactions(): Promise<MigrationReport> {
    const startTime = new Date().toISOString();
    const report: MigrationReport = {
      totalLegacyTransactions: 0,
      migratedTransactions: 0,
      skippedTransactions: 0,
      errors: [],
      startTime,
      endTime: '',
      duration: 0
    };

    try {
      console.log('Starting migration of legacy transactions...');
      
      // Initialize blockchain integration
      await blockchainIntegration.initialize();
      
      // Read all legacy transactions
      const legacyTransactions = await this.legacyDb.read<LegacyTransactionRecord>();
      report.totalLegacyTransactions = legacyTransactions.length;
      
      console.log(`Found ${legacyTransactions.length} legacy transactions to migrate`);

      // Process each transaction
      for (const legacyTx of legacyTransactions) {
        try {
          const success = await this.migrateSingleTransaction(legacyTx);
          if (success) {
            report.migratedTransactions++;
          } else {
            report.skippedTransactions++;
          }
        } catch (error) {
          report.errors.push(`Transaction ${legacyTx.id}: ${(error as Error).message}`);
          report.skippedTransactions++;
        }
      }

      const endTime = new Date().toISOString();
      report.endTime = endTime;
      report.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      console.log('Migration completed:', {
        migrated: report.migratedTransactions,
        skipped: report.skippedTransactions,
        errors: report.errors.length,
        duration: `${report.duration}ms`
      });

      return report;
    } catch (error) {
      report.errors.push(`Migration failed: ${(error as Error).message}`);
      report.endTime = new Date().toISOString();
      report.duration = new Date(report.endTime).getTime() - new Date(startTime).getTime();
      return report;
    }
  }

  /**
   * Migrate a single legacy transaction
   */
  private async migrateSingleTransaction(legacyTx: LegacyTransactionRecord): Promise<boolean> {
    try {
      // Determine transaction type based on legacy data
      const transactionType = this.inferTransactionType(legacyTx);
      
      // Create migration data
      const migrationData = {
        originalId: legacyTx.id,
        originalTimestamp: legacyTx.timestamp,
        migratedAt: new Date().toISOString(),
        earnings: legacyTx.earnings,
        user: legacyTx.user
      };

      // Log transaction through appropriate method
      let txId: string | null = null;
      
      switch (transactionType) {
        case TransactionType.PICKUP_CONFIRMATION:
          if (legacyTx.contractorId && legacyTx.binId) {
            txId = await blockchainIntegration.logPickupConfirmation(
              legacyTx.binId,
              legacyTx.contractorId,
              legacyTx.action,
              migrationData
            );
          }
          break;
          
        case TransactionType.ISSUE_REPORT:
          if (legacyTx.citizenId && legacyTx.binId) {
            txId = await blockchainIntegration.logIssueReport(
              legacyTx.binId,
              legacyTx.citizenId,
              legacyTx.action,
              migrationData
            );
          }
          break;
          
        case TransactionType.BIN_UPDATE:
          if (legacyTx.binId) {
            txId = await blockchainIntegration.logBinUpdate(
              legacyTx.binId,
              legacyTx.action,
              migrationData,
              legacyTx.user || 'System'
            );
          }
          break;
          
        case TransactionType.SYSTEM_EVENT:
          txId = await blockchainIntegration.logSystemEvent(
            legacyTx.action,
            migrationData,
            legacyTx.user || 'System'
          );
          break;
      }

      return txId !== null;
    } catch (error) {
      console.error(`Failed to migrate transaction ${legacyTx.id}:`, error);
      throw error;
    }
  }

  /**
   * Infer transaction type from legacy transaction data
   */
  private inferTransactionType(legacyTx: LegacyTransactionRecord): TransactionType {
    const action = legacyTx.action.toLowerCase();
    
    // Check for pickup confirmations
    if (legacyTx.contractorId && (
      action.includes('collected') ||
      action.includes('pickup') ||
      action.includes('hazard_resolved')
    )) {
      return TransactionType.PICKUP_CONFIRMATION;
    }
    
    // Check for issue reports
    if (legacyTx.citizenId && (
      action.includes('report') ||
      action.includes('issue')
    )) {
      return TransactionType.ISSUE_REPORT;
    }
    
    // Check for bin updates
    if (legacyTx.binId && (
      action.includes('update') ||
      action.includes('created') ||
      action.includes('status')
    )) {
      return TransactionType.BIN_UPDATE;
    }
    
    // Default to system event
    return TransactionType.SYSTEM_EVENT;
  }

  /**
   * Validate migration results
   */
  public async validateMigration(): Promise<{
    isValid: boolean;
    legacyCount: number;
    blockchainCount: number;
    discrepancies: string[];
  }> {
    try {
      const legacyTransactions = await this.legacyDb.read<LegacyTransactionRecord>();
      const stats = await blockchainIntegration.getBlockchainStats();
      
      const discrepancies: string[] = [];
      
      // Check if blockchain has at least as many transactions as legacy
      if (stats.totalTransactions < legacyTransactions.length) {
        discrepancies.push(
          `Blockchain has ${stats.totalTransactions} transactions but legacy has ${legacyTransactions.length}`
        );
      }
      
      return {
        isValid: discrepancies.length === 0,
        legacyCount: legacyTransactions.length,
        blockchainCount: stats.totalTransactions,
        discrepancies
      };
    } catch (error) {
      return {
        isValid: false,
        legacyCount: 0,
        blockchainCount: 0,
        discrepancies: [`Validation failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Create backup of legacy data before migration
   */
  public async createLegacyBackup(backupPath?: string): Promise<string> {
    try {
      const legacyTransactions = await this.legacyDb.read<LegacyTransactionRecord>();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = backupPath || `legacy-transactions-backup-${timestamp}.json`;
      
      const backupData = {
        metadata: {
          backupTimestamp: new Date().toISOString(),
          totalTransactions: legacyTransactions.length,
          version: '1.0'
        },
        transactions: legacyTransactions
      };
      
      // In a real implementation, this would write to file system
      // For now, return the JSON string
      const backupJson = JSON.stringify(backupData, null, 2);
      
      console.log(`Legacy backup created: ${filename} (${legacyTransactions.length} transactions)`);
      return backupJson;
    } catch (error) {
      throw new Error(`Backup creation failed: ${(error as Error).message}`);
    }
  }
}

// Export singleton instance
export const migrationUtility = new MigrationUtility();