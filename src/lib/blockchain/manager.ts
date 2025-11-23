/**
 * Blockchain Manager - Central coordinator for all blockchain operations
 * Integrates consensus engine, smart contracts, validation, and storage
 */

import { 
  BlockchainManager as IBlockchainManager,
  Transaction, 
  Block, 
  ValidationResult,
  ChainValidationResult
} from './types';
import { ConsensusEngine } from './consensus';
import { ChainValidator } from './validator';
import { SmartContractEngine } from './contracts';
import { BlockStorage } from './storage';
import { createAuthenticityProof, verifyAuthenticityProof } from './crypto';
import { createTransaction, filterTransactionsByBinId, filterTransactionsByDateRange } from './utils';
import { BLOCKCHAIN_CONFIG } from './constants';

export class BlockchainManager implements IBlockchainManager {
  private consensusEngine: ConsensusEngine;
  private chainValidator: ChainValidator;
  private smartContractEngine: SmartContractEngine;
  private blockStorage: BlockStorage;
  private isInitialized = false;

  constructor(dataDir?: string) {
    this.consensusEngine = new ConsensusEngine();
    this.chainValidator = new ChainValidator();
    this.smartContractEngine = new SmartContractEngine();
    this.blockStorage = new BlockStorage(dataDir);
  }

  /**
   * Initialize the blockchain manager and all components
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize storage first
      await this.blockStorage.initialize();
      
      // Validate existing chain on startup (skip validation during initialization to avoid circular dependency)
      // const chainValidation = await this.validateChain();
      // if (!chainValidation.isValid) {
      //   console.warn('Blockchain validation failed on startup:', chainValidation.errors);
      //   // Continue with warnings but don't fail initialization
      // }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize blockchain manager:', error);
      throw new Error('Blockchain manager initialization failed');
    }
  }

  /**
   * Add a new transaction to the blockchain
   */
  public async addTransaction(transaction: Transaction, options: { skipExpirationCheck?: boolean } = {}): Promise<string> {
    this.ensureInitialized();

    try {
      // Execute smart contracts if applicable (non-critical)
      try {
        await this.executeSmartContracts(transaction);
      } catch (contractError) {
        console.warn('Smart contract execution failed, continuing with transaction:', contractError);
      }

      // Add transaction to consensus engine pool (critical)
      await this.consensusEngine.addToPool(transaction, options);

      // Check if we should create a new block (non-critical)
      try {
        if (this.shouldCreateBlock()) {
          await this.createBlock();
        }
      } catch (blockError) {
        console.warn('Block creation failed, but transaction was added to pool:', blockError);
      }

      return transaction.id;
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw new Error(`Transaction addition failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new block from pending transactions
   */
  public async createBlock(): Promise<Block> {
    this.ensureInitialized();

    try {
      // Get latest block for height and previous hash
      const latestBlock = await this.blockStorage.getLatestBlock();
      const height = latestBlock ? latestBlock.header.height + 1 : 0;
      const previousHash = latestBlock ? latestBlock.header.hash : BLOCKCHAIN_CONFIG.GENESIS_PREVIOUS_HASH;

      // Create block through consensus engine with correct height and previous hash
      const newBlock = await this.consensusEngine.createBlock(undefined, height, previousHash);

      // Validate the new block
      const validation = await this.chainValidator.validateBlock(newBlock);
      if (!validation.isValid) {
        throw new Error(`Block validation failed: ${validation.errors.join(', ')}`);
      }

      // Store the validated block
      const storageResult = await this.blockStorage.storeBlock(newBlock);
      if (!storageResult.isValid) {
        throw new Error(`Block storage failed: ${storageResult.errors.join(', ')}`);
      }

      return newBlock;
    } catch (error) {
      console.error('Failed to create block:', error);
      throw new Error(`Block creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate the entire blockchain
   */
  public async validateChain(): Promise<ValidationResult> {
    this.ensureInitialized();

    try {
      const allBlocks = await this.blockStorage.getAllBlocks();
      const chainValidation = await this.chainValidator.validateChain(allBlocks);
      
      return {
        isValid: chainValidation.isValid,
        errors: chainValidation.errors.map(e => `Block ${e.blockNumber}: ${e.message}`)
      };
    } catch (error) {
      console.error('Chain validation error:', error);
      return {
        isValid: false,
        errors: [`Chain validation failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Get transaction by ID with cryptographic proof
   */
  public async getTransaction(id: string): Promise<Transaction | null> {
    this.ensureInitialized();

    try {
      // First check stored blocks
      const transaction = await this.blockStorage.getTransaction(id);
      if (transaction) {
        // Add cryptographic proof for authenticity
        const block = await this.getBlockContainingTransaction(id);
        if (block) {
          const proof = createAuthenticityProof(transaction, block.header.hash, block.header.height);
          // Store proof as metadata (in a real implementation, this would be handled differently)
          (transaction as any)._proof = proof;
          (transaction as any)._blockHeight = block.header.height;
          (transaction as any)._blockHash = block.header.hash;
        }
        return transaction;
      }

      // If not found in blocks, check pending transactions
      const pendingTransactions = this.consensusEngine.getPendingTransactions();
      const pendingTransaction = pendingTransactions.find(tx => tx.id === id);
      if (pendingTransaction) {
        // Pending transactions don't have cryptographic proofs yet
        (pendingTransaction as any)._pending = true;
        return pendingTransaction;
      }

      return null;
    } catch (error) {
      console.error('Failed to get transaction:', error);
      return null;
    }
  }

  /**
   * Get block by height
   */
  public async getBlockByHeight(height: number): Promise<Block | null> {
    this.ensureInitialized();

    try {
      return await this.blockStorage.getBlockByHeight(height);
    } catch (error) {
      console.error('Failed to get block by height:', error);
      return null;
    }
  }

  /**
   * Get the latest block
   */
  public async getLatestBlock(): Promise<Block | null> {
    this.ensureInitialized();

    try {
      return await this.blockStorage.getLatestBlock();
    } catch (error) {
      console.error('Failed to get latest block:', error);
      return null;
    }
  }

  /**
   * Export blockchain data for audit reports
   */
  public async exportChain(format: 'json' | 'csv'): Promise<string> {
    this.ensureInitialized();

    try {
      const allBlocks = await this.blockStorage.getAllBlocks();
      const chainState = this.blockStorage.getChainState();
      
      if (format === 'json') {
        return this.exportAsJSON(allBlocks, chainState);
      } else if (format === 'csv') {
        return this.exportAsCSV(allBlocks, chainState);
      } else {
        throw new Error('Unsupported export format');
      }
    } catch (error) {
      console.error('Failed to export chain:', error);
      throw new Error(`Chain export failed: ${(error as Error).message}`);
    }
  }

  /**
   * Query transactions by bin ID with cryptographic proofs
   */
  public async getTransactionsByBinId(binId: string): Promise<Transaction[]> {
    this.ensureInitialized();

    try {
      // Get transactions from stored blocks
      const storedTransactions = await this.blockStorage.getTransactionsByBinId(binId);
      
      // Add cryptographic proofs to stored transactions
      const transactionsWithProofs = await Promise.all(
        storedTransactions.map(async (tx) => {
          const block = await this.getBlockContainingTransaction(tx.id);
          if (block) {
            const proof = createAuthenticityProof(tx, block.header.hash, block.header.height);
            (tx as any)._proof = proof;
            (tx as any)._blockHeight = block.header.height;
            (tx as any)._blockHash = block.header.hash;
          }
          return tx;
        })
      );

      // Get pending transactions for this bin
      const pendingTransactions = this.consensusEngine.getPendingTransactions();
      const pendingBinTxs = pendingTransactions.filter(tx => tx.binId === binId);
      
      // Mark pending transactions
      pendingBinTxs.forEach(tx => {
        (tx as any)._pending = true;
      });

      // Combine stored and pending transactions
      return [...transactionsWithProofs, ...pendingBinTxs];
    } catch (error) {
      console.error('Failed to get transactions by bin ID:', error);
      return [];
    }
  }

  /**
   * Query transactions by date range with cryptographic proofs
   */
  public async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    this.ensureInitialized();

    try {
      const transactions = await this.blockStorage.getTransactionsByDateRange(startDate, endDate);
      
      // Add cryptographic proofs to each transaction
      const transactionsWithProofs = await Promise.all(
        transactions.map(async (tx) => {
          const block = await this.getBlockContainingTransaction(tx.id);
          if (block) {
            const proof = createAuthenticityProof(tx, block.header.hash, block.header.height);
            (tx as any)._proof = proof;
            (tx as any)._blockHeight = block.header.height;
            (tx as any)._blockHash = block.header.hash;
          }
          return tx;
        })
      );

      return transactionsWithProofs;
    } catch (error) {
      console.error('Failed to get transactions by date range:', error);
      return [];
    }
  }

  /**
   * Query transactions by contractor ID with cryptographic proofs
   */
  public async getTransactionsByContractorId(contractorId: string): Promise<Transaction[]> {
    this.ensureInitialized();

    try {
      // Get transactions from stored blocks
      const storedTransactions = await this.blockStorage.getTransactionsByContractorId(contractorId);
      
      // Add cryptographic proofs to stored transactions
      const transactionsWithProofs = await Promise.all(
        storedTransactions.map(async (tx) => {
          const block = await this.getBlockContainingTransaction(tx.id);
          if (block) {
            const proof = createAuthenticityProof(tx, block.header.hash, block.header.height);
            (tx as any)._proof = proof;
            (tx as any)._blockHeight = block.header.height;
            (tx as any)._blockHash = block.header.hash;
          }
          return tx;
        })
      );

      // Get pending transactions for this contractor
      const pendingTransactions = this.consensusEngine.getPendingTransactions();
      const pendingContractorTxs = pendingTransactions.filter(tx => tx.contractorId === contractorId);
      
      // Mark pending transactions
      pendingContractorTxs.forEach(tx => {
        (tx as any)._pending = true;
      });

      // Combine stored and pending transactions
      return [...transactionsWithProofs, ...pendingContractorTxs];
    } catch (error) {
      console.error('Failed to get transactions by contractor ID:', error);
      return [];
    }
  }

  /**
   * Query transactions by citizen ID with cryptographic proofs
   */
  public async getTransactionsByCitizenId(citizenId: string): Promise<Transaction[]> {
    this.ensureInitialized();

    try {
      // Get transactions from stored blocks
      const storedTransactions = await this.blockStorage.getTransactionsByCitizenId(citizenId);
      
      // Add cryptographic proofs to stored transactions
      const transactionsWithProofs = await Promise.all(
        storedTransactions.map(async (tx) => {
          const block = await this.getBlockContainingTransaction(tx.id);
          if (block) {
            const proof = createAuthenticityProof(tx, block.header.hash, block.header.height);
            (tx as any)._proof = proof;
            (tx as any)._blockHeight = block.header.height;
            (tx as any)._blockHash = block.header.hash;
          }
          return tx;
        })
      );

      // Get pending transactions for this citizen
      const pendingTransactions = this.consensusEngine.getPendingTransactions();
      const pendingCitizenTxs = pendingTransactions.filter(tx => tx.citizenId === citizenId);
      
      // Mark pending transactions
      pendingCitizenTxs.forEach(tx => {
        (tx as any)._pending = true;
      });

      // Combine stored and pending transactions
      return [...transactionsWithProofs, ...pendingCitizenTxs];
    } catch (error) {
      console.error('Failed to get transactions by citizen ID:', error);
      return [];
    }
  }

  /**
   * Get block containing a specific transaction ID
   */
  public async getBlockByTransactionId(transactionId: string): Promise<Block | null> {
    return this.getBlockContainingTransaction(transactionId);
  }

  /**
   * Get all transactions including pending ones
   */
  public async getAllTransactions(): Promise<Transaction[]> {
    this.ensureInitialized();

    try {
      const allTransactions: Transaction[] = [];
      
      // Get all transactions from stored blocks
      const stats = await this.getBlockchainStats();
      
      for (let height = 0; height <= stats.chainHeight; height++) {
        const block = await this.getBlockByHeight(height);
        if (block) {
          // Add cryptographic proofs to stored transactions
          const transactionsWithProofs = await Promise.all(
            block.body.transactions.map(async (tx) => {
              const proof = createAuthenticityProof(tx, block.header.hash, block.header.height);
              (tx as any)._proof = proof;
              (tx as any)._blockHeight = block.header.height;
              (tx as any)._blockHash = block.header.hash;
              return tx;
            })
          );
          allTransactions.push(...transactionsWithProofs);
        }
      }

      // Get pending transactions
      const pendingTransactions = this.consensusEngine.getPendingTransactions();
      
      // Mark pending transactions
      pendingTransactions.forEach(tx => {
        (tx as any)._pending = true;
      });

      // Combine stored and pending transactions
      return [...allTransactions, ...pendingTransactions];
    } catch (error) {
      console.error('Failed to get all transactions:', error);
      return [];
    }
  }

  /**
   * Execute smart contract by type
   */
  public async executeSmartContract(contractType: string, data: any) {
    this.ensureInitialized();
    
    try {
      return await this.smartContractEngine.executeContract(contractType, data);
    } catch (error) {
      console.error('Failed to execute smart contract:', error);
      return {
        success: false,
        actions: [],
        newTransactions: [],
        errors: [`Smart contract execution failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Get blockchain statistics and health information
   */
  public async getBlockchainStats() {
    this.ensureInitialized();

    try {
      const chainState = this.blockStorage.getChainState();
      const consensusStats = this.consensusEngine.getStatistics();
      const latestBlock = await this.blockStorage.getLatestBlock();
      
      return {
        chainHeight: chainState.height,
        totalTransactions: chainState.totalTransactions,
        latestBlockHash: chainState.latestBlockHash,
        lastUpdated: chainState.lastUpdated,
        pendingTransactions: consensusStats.poolSize,
        processedTransactions: consensusStats.processedTransactions,
        isCreatingBlock: consensusStats.isCreatingBlock,
        averageTransactionAge: consensusStats.averageTransactionAge,
        latestBlockTimestamp: latestBlock?.header.timestamp,
        activeContracts: this.smartContractEngine.getActiveContracts().length
      };
    } catch (error) {
      console.error('Failed to get blockchain stats:', error);
      throw new Error(`Stats retrieval failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify cryptographic proof for a transaction
   */
  public async verifyTransactionProof(transaction: Transaction, proof: string, blockHash: string, blockHeight: number): Promise<boolean> {
    try {
      // Create a clean copy of the transaction without metadata for verification
      const cleanTransaction: Transaction = {
        id: transaction.id,
        type: transaction.type,
        binId: transaction.binId,
        contractorId: transaction.contractorId,
        citizenId: transaction.citizenId,
        action: transaction.action,
        data: transaction.data,
        timestamp: transaction.timestamp,
        signature: transaction.signature,
        hash: transaction.hash
      };
      
      return verifyAuthenticityProof(cleanTransaction, proof, blockHash, blockHeight);
    } catch (error) {
      console.error('Failed to verify transaction proof:', error);
      return false;
    }
  }

  /**
   * Create backup of blockchain data
   */
  public async createBackup(backupPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.blockStorage.createBackup(backupPath);
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Backup creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restore blockchain from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.blockStorage.restoreFromBackup(backupPath);
      
      // Re-validate chain after restore
      const validation = await this.validateChain();
      if (!validation.isValid) {
        throw new Error(`Restored chain validation failed: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw new Error(`Backup restoration failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute smart contracts for a transaction
   */
  private async executeSmartContracts(transaction: Transaction): Promise<void> {
    try {
      // Determine which contracts to execute based on transaction type
      const contractsToExecute = this.getApplicableContracts(transaction);
      
      for (const contractType of contractsToExecute) {
        const result = await this.smartContractEngine.executeContract(contractType, {
          transaction,
          currentState: await this.getCurrentState(transaction),
          blockHeight: (await this.blockStorage.getLatestBlock())?.header.height || 0
        });

        // Add any new transactions generated by smart contracts
        if (result.success && result.newTransactions.length > 0) {
          for (const newTx of result.newTransactions) {
            await this.consensusEngine.addToPool(newTx);
          }
        }
      }
    } catch (error) {
      console.error('Smart contract execution error:', error);
      // Don't fail the transaction if smart contracts fail
    }
  }

  /**
   * Get applicable smart contracts for a transaction
   */
  private getApplicableContracts(transaction: Transaction): string[] {
    const contracts: string[] = [];
    
    switch (transaction.type) {
      case 'bin_update':
        contracts.push('bin_capacity_monitor');
        break;
      case 'pickup_confirmation':
        contracts.push('pickup_validator', 'earnings_calculator');
        break;
      case 'issue_report':
        contracts.push('report_processor');
        break;
    }
    
    return contracts;
  }

  /**
   * Get current state for smart contract execution
   */
  private async getCurrentState(transaction: Transaction): Promise<any> {
    // This would typically query the current state from the database
    // For now, return a simplified state object based on transaction data
    return {
      binId: transaction.binId,
      binCapacity: transaction.data?.capacity || 0, // Use capacity from transaction data
      contractorId: transaction.contractorId,
      citizenId: transaction.citizenId,
      transactionData: transaction.data
    };
  }

  /**
   * Check if a new block should be created
   */
  private shouldCreateBlock(): boolean {
    const poolSize = this.consensusEngine.getPoolSize();
    return poolSize >= BLOCKCHAIN_CONFIG.MAX_TRANSACTIONS_PER_BLOCK / 2; // Create block when half full
  }

  /**
   * Find the block containing a specific transaction
   */
  private async getBlockContainingTransaction(transactionId: string): Promise<Block | null> {
    try {
      const allBlocks = await this.blockStorage.getAllBlocks();
      
      for (const block of allBlocks) {
        if (block.body.transactions.some(tx => tx.id === transactionId)) {
          return block;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to find block containing transaction:', error);
      return null;
    }
  }

  /**
   * Export blockchain as JSON format
   */
  private exportAsJSON(blocks: Block[], chainState: any): string {
    const exportData = {
      metadata: {
        exportTimestamp: new Date().toISOString(),
        chainHeight: chainState.height,
        totalBlocks: blocks.length,
        totalTransactions: chainState.totalTransactions,
        format: 'json',
        version: '1.0'
      },
      chainState,
      blocks: blocks.map(block => ({
        ...block,
        _metadata: {
          blockSize: JSON.stringify(block).length,
          transactionHashes: block.body.transactions.map(tx => tx.hash)
        }
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export blockchain as CSV format
   */
  private exportAsCSV(blocks: Block[], chainState: any): string {
    const headers = [
      'Block Height',
      'Block Hash',
      'Previous Hash',
      'Timestamp',
      'Transaction Count',
      'Transaction ID',
      'Transaction Type',
      'Action',
      'Bin ID',
      'Contractor ID',
      'Citizen ID',
      'Transaction Timestamp',
      'Transaction Hash'
    ];
    
    let csv = headers.join(',') + '\n';
    
    // Add metadata row
    csv += `# Exported on ${new Date().toISOString()}, Chain Height: ${chainState.height}, Total Transactions: ${chainState.totalTransactions}\n`;
    
    for (const block of blocks) {
      if (block.body.transactions.length === 0) {
        // Empty block row
        csv += [
          block.header.height,
          block.header.hash,
          block.header.previousHash,
          block.header.timestamp,
          0,
          '', '', '', '', '', '',
          '', ''
        ].join(',') + '\n';
      } else {
        for (const tx of block.body.transactions) {
          csv += [
            block.header.height,
            block.header.hash,
            block.header.previousHash,
            block.header.timestamp,
            block.body.transactionCount,
            tx.id,
            tx.type,
            tx.action,
            tx.binId || '',
            tx.contractorId || '',
            tx.citizenId || '',
            tx.timestamp,
            tx.hash
          ].map(field => `"${field}"`).join(',') + '\n';
        }
      }
    }
    
    return csv;
  }

  /**
   * Ensure the blockchain manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Blockchain manager not initialized. Call initialize() first.');
    }
  }
}