/**
 * Blockchain storage and persistence layer
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Block, Transaction, ValidationResult } from './types';
import { BlockImpl } from './block';
import { BLOCKCHAIN_CONFIG } from './constants';

interface TransactionIndex {
  [transactionId: string]: {
    blockHeight: number;
    transactionIndex: number;
  };
}

interface ChainState {
  height: number;
  latestBlockHash: string;
  totalTransactions: number;
  lastUpdated: string;
}

export class BlockStorage {
  private dataDir: string;
  private blocksFile: string;
  private transactionIndexFile: string;
  private chainStateFile: string;
  private blocks: Block[] = [];
  private transactionIndex: TransactionIndex = {};
  private chainState: ChainState;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || BLOCKCHAIN_CONFIG.BLOCKCHAIN_DATA_DIR;
    this.blocksFile = join(this.dataDir, BLOCKCHAIN_CONFIG.BLOCKS_FILE);
    this.transactionIndexFile = join(this.dataDir, BLOCKCHAIN_CONFIG.TRANSACTIONS_INDEX_FILE);
    this.chainStateFile = join(this.dataDir, BLOCKCHAIN_CONFIG.CHAIN_STATE_FILE);
    
    this.chainState = {
      height: -1,
      latestBlockHash: '',
      totalTransactions: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Initialize storage and load existing data
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load existing data
      await this.loadBlocks();
      await this.loadTransactionIndex();
      await this.loadChainState();

      // If no blocks exist, create genesis block
      if (this.blocks.length === 0) {
        const genesisBlock = BlockImpl.createGenesis();
        await this.storeBlock(genesisBlock);
      }
    } catch (error) {
      console.error('Failed to initialize blockchain storage:', error);
      throw new Error('Storage initialization failed');
    }
  }

  /**
   * Store a new block
   */
  public async storeBlock(block: Block): Promise<ValidationResult> {
    try {
      // Validate block before storing
      const blockImpl = BlockImpl.fromJSON(block);
      const validation = blockImpl.validate();
      
      if (!validation.isValid) {
        return validation;
      }

      // Add block to memory
      this.blocks.push(block);

      // Update transaction index
      block.body.transactions.forEach((transaction, index) => {
        this.transactionIndex[transaction.id] = {
          blockHeight: block.header.height,
          transactionIndex: index
        };
      });

      // Update chain state
      this.chainState = {
        height: block.header.height,
        latestBlockHash: block.header.hash,
        totalTransactions: this.chainState.totalTransactions + block.body.transactionCount,
        lastUpdated: new Date().toISOString()
      };

      // Persist to disk
      await this.saveBlocks();
      await this.saveTransactionIndex();
      await this.saveChainState();

      return { isValid: true, errors: [] };
    } catch (error) {
      console.error('Failed to store block:', error);
      return {
        isValid: false,
        errors: ['Failed to store block: ' + (error as Error).message]
      };
    }
  }

  /**
   * Get block by height
   */
  public async getBlockByHeight(height: number): Promise<Block | null> {
    return this.blocks.find(block => block.header.height === height) || null;
  }

  /**
   * Get latest block
   */
  public async getLatestBlock(): Promise<Block | null> {
    if (this.blocks.length === 0) return null;
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Get transaction by ID
   */
  public async getTransaction(transactionId: string): Promise<Transaction | null> {
    const indexEntry = this.transactionIndex[transactionId];
    if (!indexEntry) return null;

    const block = await this.getBlockByHeight(indexEntry.blockHeight);
    if (!block) return null;

    return block.body.transactions[indexEntry.transactionIndex] || null;
  }

  /**
   * Get all blocks
   */
  public async getAllBlocks(): Promise<Block[]> {
    return [...this.blocks];
  }

  /**
   * Get transactions by bin ID
   */
  public async getTransactionsByBinId(binId: string): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    
    for (const block of this.blocks) {
      for (const transaction of block.body.transactions) {
        if (transaction.binId === binId) {
          transactions.push(transaction);
        }
      }
    }
    
    return transactions;
  }

  /**
   * Get transactions by date range
   */
  public async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    for (const block of this.blocks) {
      for (const transaction of block.body.transactions) {
        const txTime = new Date(transaction.timestamp).getTime();
        if (txTime >= start && txTime <= end) {
          transactions.push(transaction);
        }
      }
    }
    
    return transactions;
  }

  /**
   * Get transactions by contractor ID
   */
  public async getTransactionsByContractorId(contractorId: string): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    
    for (const block of this.blocks) {
      for (const transaction of block.body.transactions) {
        if (transaction.contractorId === contractorId) {
          transactions.push(transaction);
        }
      }
    }
    
    return transactions;
  }

  /**
   * Get transactions by citizen ID
   */
  public async getTransactionsByCitizenId(citizenId: string): Promise<Transaction[]> {
    const transactions: Transaction[] = [];
    
    for (const block of this.blocks) {
      for (const transaction of block.body.transactions) {
        if (transaction.citizenId === citizenId) {
          transactions.push(transaction);
        }
      }
    }
    
    return transactions;
  }

  /**
   * Get chain state
   */
  public getChainState(): ChainState {
    return { ...this.chainState };
  }

  /**
   * Create backup of blockchain data
   */
  public async createBackup(backupPath: string): Promise<void> {
    try {
      // Check if path contains invalid characters that would cause mkdir to fail
      if (backupPath.includes('<') || backupPath.includes('>') || backupPath.includes('|') || 
          backupPath.includes('*') || backupPath.includes('?') || backupPath.includes(':')) {
        throw new Error('Invalid backup path contains illegal characters');
      }
      
      await fs.mkdir(backupPath, { recursive: true });
      
      const backupData = {
        blocks: this.blocks,
        transactionIndex: this.transactionIndex,
        chainState: this.chainState,
        backupTimestamp: new Date().toISOString()
      };
      
      await fs.writeFile(
        join(backupPath, 'blockchain_backup.json'),
        JSON.stringify(backupData, null, 2)
      );
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error('Backup creation failed');
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      // Check if path contains invalid characters
      if (backupPath.includes('<') || backupPath.includes('>') || backupPath.includes('|') || 
          backupPath.includes('*') || backupPath.includes('?') || backupPath.includes(':')) {
        throw new Error('Invalid backup path contains illegal characters');
      }
      
      const backupFile = join(backupPath, 'blockchain_backup.json');
      const backupData = JSON.parse(await fs.readFile(backupFile, 'utf-8'));
      
      this.blocks = backupData.blocks || [];
      this.transactionIndex = backupData.transactionIndex || {};
      this.chainState = backupData.chainState || this.chainState;
      
      // Save restored data
      await this.saveBlocks();
      await this.saveTransactionIndex();
      await this.saveChainState();
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw new Error('Backup restoration failed');
    }
  }

  /**
   * Load blocks from disk
   */
  private async loadBlocks(): Promise<void> {
    try {
      const data = await fs.readFile(this.blocksFile, 'utf-8');
      this.blocks = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, start with empty array
      this.blocks = [];
    }
  }

  /**
   * Save blocks to disk
   */
  private async saveBlocks(): Promise<void> {
    // Ensure directory exists before writing
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.blocksFile, JSON.stringify(this.blocks, null, 2));
  }

  /**
   * Load transaction index from disk
   */
  private async loadTransactionIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.transactionIndexFile, 'utf-8');
      this.transactionIndex = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, start with empty object
      this.transactionIndex = {};
    }
  }

  /**
   * Save transaction index to disk
   */
  private async saveTransactionIndex(): Promise<void> {
    // Ensure directory exists before writing
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.transactionIndexFile, JSON.stringify(this.transactionIndex, null, 2));
  }

  /**
   * Load chain state from disk
   */
  private async loadChainState(): Promise<void> {
    try {
      const data = await fs.readFile(this.chainStateFile, 'utf-8');
      this.chainState = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is corrupted, use default state
      this.chainState = {
        height: -1,
        latestBlockHash: '',
        totalTransactions: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Save chain state to disk
   */
  private async saveChainState(): Promise<void> {
    // Ensure directory exists before writing
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.chainStateFile, JSON.stringify(this.chainState, null, 2));
  }
}