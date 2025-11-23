/**
 * Block class implementation with validation and creation methods
 */

import { Block, BlockHeader, BlockBody, Transaction, ValidationResult } from './types';
import { calculateBlockHash, calculateMerkleRoot, generateNonce, verifyBlockHash } from './crypto';
import { validateBlockFormat, sortTransactionsByTimestamp } from './utils';
import { BLOCKCHAIN_CONFIG } from './constants';

export class BlockImpl implements Block {
  public header: BlockHeader;
  public body: BlockBody;

  constructor(
    height: number,
    previousHash: string,
    transactions: Transaction[],
    timestamp?: string
  ) {
    // Sort transactions by timestamp for deterministic ordering
    const sortedTransactions = sortTransactionsByTimestamp(transactions);
    
    // Calculate merkle root from transaction hashes
    const transactionHashes = sortedTransactions.map(tx => tx.hash);
    const merkleRoot = calculateMerkleRoot(transactionHashes);
    
    // Create block header
    this.header = {
      height,
      previousHash,
      merkleRoot,
      timestamp: timestamp || new Date().toISOString(),
      nonce: generateNonce(),
      hash: '' // Will be calculated after header is complete
    };
    
    // Create block body
    this.body = {
      transactions: sortedTransactions,
      transactionCount: sortedTransactions.length
    };
    
    // Calculate and set the block hash
    this.header.hash = calculateBlockHash(this);
  }

  /**
   * Validate the block structure and integrity
   */
  public validate(): ValidationResult {
    const formatValidation = validateBlockFormat(this);
    if (!formatValidation.isValid) {
      return {
        isValid: false,
        errors: formatValidation.errors,
        blockNumber: this.header.height
      };
    }

    const errors: string[] = [];

    // Verify block hash
    if (!verifyBlockHash(this)) {
      errors.push('Block hash verification failed');
    }

    // Verify merkle root
    const transactionHashes = this.body.transactions.map(tx => tx.hash);
    const expectedMerkleRoot = calculateMerkleRoot(transactionHashes);
    if (this.header.merkleRoot !== expectedMerkleRoot) {
      errors.push('Merkle root verification failed');
    }

    // Check transaction count
    if (this.body.transactionCount !== this.body.transactions.length) {
      errors.push('Transaction count mismatch');
    }

    // Check block size
    const blockSize = JSON.stringify(this).length;
    if (blockSize > BLOCKCHAIN_CONFIG.MAX_BLOCK_SIZE) {
      errors.push('Block size exceeds maximum allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      blockNumber: this.header.height
    };
  }

  /**
   * Get block as JSON object
   */
  public toJSON(): Block {
    return {
      header: { ...this.header },
      body: {
        transactions: [...this.body.transactions],
        transactionCount: this.body.transactionCount
      }
    };
  }

  /**
   * Create block from JSON data
   */
  public static fromJSON(data: Block): BlockImpl {
    const block = Object.create(BlockImpl.prototype);
    block.header = { ...data.header };
    block.body = {
      transactions: [...data.body.transactions],
      transactionCount: data.body.transactionCount
    };
    return block;
  }

  /**
   * Create genesis block
   */
  public static createGenesis(): BlockImpl {
    return new BlockImpl(
      BLOCKCHAIN_CONFIG.GENESIS_BLOCK_HEIGHT,
      BLOCKCHAIN_CONFIG.GENESIS_PREVIOUS_HASH,
      [],
      new Date().toISOString()
    );
  }
}

/**
 * Transaction class implementation with validation and signing
 */
export class TransactionImpl implements Transaction {
  public id: string;
  public type: any;
  public binId?: string;
  public contractorId?: string;
  public citizenId?: string;
  public action: string;
  public data: any;
  public timestamp: string;
  public signature: string;
  public hash: string;

  constructor(transaction: Transaction) {
    this.id = transaction.id;
    this.type = transaction.type;
    this.binId = transaction.binId;
    this.contractorId = transaction.contractorId;
    this.citizenId = transaction.citizenId;
    this.action = transaction.action;
    this.data = transaction.data;
    this.timestamp = transaction.timestamp;
    this.signature = transaction.signature;
    this.hash = transaction.hash;
  }

  /**
   * Validate transaction format and signature
   */
  public validate(): ValidationResult {
    const errors: string[] = [];

    // Basic format validation
    if (!this.id) errors.push('Transaction ID is required');
    if (!this.type) errors.push('Transaction type is required');
    if (!this.action) errors.push('Transaction action is required');
    if (!this.timestamp) errors.push('Transaction timestamp is required');
    if (!this.signature) errors.push('Transaction signature is required');
    if (!this.hash) errors.push('Transaction hash is required');

    // Timestamp validation
    if (this.timestamp && isNaN(Date.parse(this.timestamp))) {
      errors.push('Invalid timestamp format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get transaction as JSON object
   */
  public toJSON(): Transaction {
    return {
      id: this.id,
      type: this.type,
      binId: this.binId,
      contractorId: this.contractorId,
      citizenId: this.citizenId,
      action: this.action,
      data: this.data,
      timestamp: this.timestamp,
      signature: this.signature,
      hash: this.hash
    };
  }
}