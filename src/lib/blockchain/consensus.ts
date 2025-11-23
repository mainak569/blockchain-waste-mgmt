/**
 * Consensus engine for transaction processing and block creation
 */

import { Transaction, Block, ValidationResult, ConsensusEngine as IConsensusEngine, TransactionType } from './types';
import { BlockImpl } from './block';
import { ChainValidator } from './validator';
import { verifyTransactionSignature, calculateTransactionHash } from './crypto';
import { validateTransactionFormat, sortTransactionsByTimestamp, isTransactionExpired } from './utils';
import { BLOCKCHAIN_CONFIG } from './constants';

export class ConsensusEngine implements IConsensusEngine {
  private transactionPool: Transaction[] = [];
  private validator: ChainValidator;
  private isCreatingBlock = false;
  private processedTransactions = new Set<string>();

  constructor() {
    this.validator = new ChainValidator();
  }

  /**
   * Add transaction to the pool
   */
  public async addToPool(transaction: Transaction, options: { skipExpirationCheck?: boolean } = {}): Promise<void> {
    try {
      // Prevent duplicate transactions
      if (this.processedTransactions.has(transaction.id)) {
        throw new Error('Transaction already processed');
      }

      // Validate transaction
      const isValid = await this.validateTransaction(transaction, options);
      if (!isValid) {
        throw new Error('Transaction validation failed');
      }

      // Check if transaction pool is full
      if (this.transactionPool.length >= BLOCKCHAIN_CONFIG.TRANSACTION_POOL_MAX_SIZE) {
        // Remove oldest expired transactions to make room
        this.cleanupExpiredTransactions();
        
        if (this.transactionPool.length >= BLOCKCHAIN_CONFIG.TRANSACTION_POOL_MAX_SIZE) {
          throw new Error('Transaction pool is full');
        }
      }

      // Add to pool with deterministic ordering
      this.transactionPool.push(transaction);
      this.sortTransactionPool();

    } catch (error) {
      console.error('Failed to add transaction to pool:', error);
      throw error;
    }
  }

  /**
   * Get current pool size
   */
  public getPoolSize(): number {
    return this.transactionPool.length;
  }

  /**
   * Create a new block from transactions
   */
  public async createBlock(transactions?: Transaction[], height?: number, previousHash?: string): Promise<Block> {
    // Prevent concurrent block creation
    if (this.isCreatingBlock) {
      throw new Error('Block creation already in progress');
    }

    this.isCreatingBlock = true;

    try {
      // Use provided transactions or get from pool
      const txsToInclude = transactions || this.getTransactionsForBlock();
      
      // Validate all transactions before including in block
      const validTransactions: Transaction[] = [];
      for (const tx of txsToInclude) {
        if (await this.validateTransaction(tx)) {
          validTransactions.push(tx);
        }
      }

      // Sort transactions deterministically
      const sortedTransactions = sortTransactionsByTimestamp(validTransactions);

      // Create block with correct height and previousHash
      const blockHeight = height !== undefined ? height : 0;
      const blockPreviousHash = previousHash !== undefined ? previousHash : '';
      const block = new BlockImpl(blockHeight, blockPreviousHash, sortedTransactions);

      // Mark transactions as processed
      sortedTransactions.forEach(tx => {
        this.processedTransactions.add(tx.id);
        // Remove from pool
        const poolIndex = this.transactionPool.findIndex(poolTx => poolTx.id === tx.id);
        if (poolIndex !== -1) {
          this.transactionPool.splice(poolIndex, 1);
        }
      });

      return block.toJSON();

    } finally {
      this.isCreatingBlock = false;
    }
  }

  /**
   * Validate a transaction
   */
  public async validateTransaction(transaction: Transaction, options: { skipExpirationCheck?: boolean } = {}): Promise<boolean> {
    try {
      // Basic format validation
      const formatValidation = validateTransactionFormat(transaction);
      if (!formatValidation.isValid) {
        return false;
      }

      // Check if transaction is expired (skip for migration scenarios)
      if (!options.skipExpirationCheck && isTransactionExpired(transaction)) {
        return false;
      }

      // Verify signature (using default key for MVP)
      if (!verifyTransactionSignature(transaction)) {
        return false;
      }

      // Verify hash
      const expectedHash = calculateTransactionHash({
        id: transaction.id,
        type: transaction.type,
        binId: transaction.binId,
        contractorId: transaction.contractorId,
        citizenId: transaction.citizenId,
        action: transaction.action,
        data: transaction.data,
        timestamp: transaction.timestamp,
        signature: transaction.signature
      });

      if (transaction.hash !== expectedHash) {
        return false;
      }

      // Note: Conflict checking is handled by resolveConflicts() method
      // Allow conflicting transactions to be added and resolved later

      return true;

    } catch (error) {
      console.error('Transaction validation error:', error);
      return false;
    }
  }

  /**
   * Resolve conflicts in the transaction pool
   */
  public async resolveConflicts(): Promise<void> {
    try {
      const conflictingTransactions: string[] = [];

      // Check for conflicts between transactions in the pool
      for (let i = 0; i < this.transactionPool.length; i++) {
        for (let j = i + 1; j < this.transactionPool.length; j++) {
          const tx1 = this.transactionPool[i];
          const tx2 = this.transactionPool[j];

          if (this.areTransactionsConflicting(tx1, tx2)) {
            // Keep the earlier transaction (by timestamp)
            const tx1Time = new Date(tx1.timestamp).getTime();
            const tx2Time = new Date(tx2.timestamp).getTime();
            
            if (tx1Time <= tx2Time) {
              conflictingTransactions.push(tx2.id);
            } else {
              conflictingTransactions.push(tx1.id);
            }
          }
        }
      }

      // Remove conflicting transactions
      this.transactionPool = this.transactionPool.filter(
        tx => !conflictingTransactions.includes(tx.id)
      );

      // Re-sort the pool
      this.sortTransactionPool();

    } catch (error) {
      console.error('Conflict resolution error:', error);
      throw error;
    }
  }

  /**
   * Get pending transactions from pool
   */
  public getPendingTransactions(): Transaction[] {
    return [...this.transactionPool];
  }

  /**
   * Clear processed transactions from memory
   */
  public clearProcessedTransactions(): void {
    // Keep only recent processed transaction IDs to prevent memory bloat
    const cutoffTime = Date.now() - BLOCKCHAIN_CONFIG.TRANSACTION_TIMEOUT;
    const recentTransactions = new Set<string>();

    this.transactionPool.forEach(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      if (txTime > cutoffTime) {
        recentTransactions.add(tx.id);
      }
    });

    this.processedTransactions = recentTransactions;
  }

  /**
   * Get statistics about the consensus engine
   */
  public getStatistics() {
    return {
      poolSize: this.transactionPool.length,
      processedTransactions: this.processedTransactions.size,
      isCreatingBlock: this.isCreatingBlock,
      oldestTransactionAge: this.getOldestTransactionAge(),
      averageTransactionAge: this.getAverageTransactionAge()
    };
  }

  /**
   * Sort transaction pool deterministically
   */
  private sortTransactionPool(): void {
    this.transactionPool.sort((a, b) => {
      // Primary sort: timestamp (oldest first)
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      // Secondary sort: transaction ID (for deterministic ordering)
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Get transactions for next block
   */
  private getTransactionsForBlock(): Transaction[] {
    // Clean up expired transactions first
    this.cleanupExpiredTransactions();
    
    // Take up to MAX_TRANSACTIONS_PER_BLOCK transactions
    const maxTransactions = Math.min(
      this.transactionPool.length,
      BLOCKCHAIN_CONFIG.MAX_TRANSACTIONS_PER_BLOCK
    );
    
    return this.transactionPool.slice(0, maxTransactions);
  }

  /**
   * Remove expired transactions from pool
   */
  private cleanupExpiredTransactions(): void {
    const currentTime = Date.now();
    this.transactionPool = this.transactionPool.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      
      // Check if transaction is migrated (has migration metadata)
      const isMigratedTransaction = tx.data && 
        typeof tx.data === 'object' && 
        'migratedFrom' in tx.data;
      
      // Keep migrated transactions regardless of age to preserve original timestamps
      if (isMigratedTransaction) {
        return true;
      }
      
      return (currentTime - txTime) <= BLOCKCHAIN_CONFIG.TRANSACTION_TIMEOUT;
    });
  }

  /**
   * Check if transaction conflicts with existing transactions
   */
  private async hasConflictingTransaction(transaction: Transaction): Promise<boolean> {
    // Check against transactions in the pool (excluding the transaction itself)
    for (const poolTx of this.transactionPool) {
      // Skip checking against the same transaction
      if (poolTx.id === transaction.id) {
        continue;
      }
      
      if (this.areTransactionsConflicting(transaction, poolTx)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if two transactions are conflicting
   */
  private areTransactionsConflicting(tx1: Transaction, tx2: Transaction): boolean {
    // Same transaction ID
    if (tx1.id === tx2.id) {
      return true;
    }

    // Same bin operations that could conflict
    if (tx1.binId && tx2.binId && tx1.binId === tx2.binId) {
      // Both are bin updates
      if (tx1.type === TransactionType.BIN_UPDATE && tx2.type === TransactionType.BIN_UPDATE) {
        return true;
      }
      
      // Both are pickup confirmations for the same bin
      if (tx1.type === TransactionType.PICKUP_CONFIRMATION && tx2.type === TransactionType.PICKUP_CONFIRMATION) {
        return true;
      }
    }

    // Same contractor operations that could conflict
    if (tx1.contractorId && tx2.contractorId && tx1.contractorId === tx2.contractorId) {
      // Multiple pickups by same contractor at same time could be suspicious
      if (tx1.type === TransactionType.PICKUP_CONFIRMATION && tx2.type === TransactionType.PICKUP_CONFIRMATION) {
        const timeDiff = Math.abs(
          new Date(tx1.timestamp).getTime() - new Date(tx2.timestamp).getTime()
        );
        // If within 1 minute, consider conflicting
        if (timeDiff < 60000) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get age of oldest transaction in pool
   */
  private getOldestTransactionAge(): number {
    if (this.transactionPool.length === 0) return 0;
    
    const oldestTx = this.transactionPool.reduce((oldest, tx) => {
      const txTime = new Date(tx.timestamp).getTime();
      const oldestTime = new Date(oldest.timestamp).getTime();
      return txTime < oldestTime ? tx : oldest;
    });
    
    return Date.now() - new Date(oldestTx.timestamp).getTime();
  }

  /**
   * Get average age of transactions in pool
   */
  private getAverageTransactionAge(): number {
    if (this.transactionPool.length === 0) return 0;
    
    const currentTime = Date.now();
    const totalAge = this.transactionPool.reduce((sum, tx) => {
      return sum + (currentTime - new Date(tx.timestamp).getTime());
    }, 0);
    
    return totalAge / this.transactionPool.length;
  }
}