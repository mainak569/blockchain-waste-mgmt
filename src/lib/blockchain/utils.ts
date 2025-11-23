/**
 * Blockchain utility functions
 */

import { Transaction, Block, TransactionType } from './types';
import { signTransaction, calculateTransactionHash, generateTransactionId } from './crypto';
import { BLOCKCHAIN_CONFIG } from './constants';

/**
 * Create a new transaction with proper formatting and signature
 */
export function createTransaction(
  type: TransactionType,
  action: string,
  data: any,
  options: {
    binId?: string;
    contractorId?: string;
    citizenId?: string;
    privateKey?: string;
  } = {}
): Transaction {
  const transactionBase = {
    id: generateTransactionId(),
    type,
    binId: options.binId,
    contractorId: options.contractorId,
    citizenId: options.citizenId,
    action,
    data,
    timestamp: new Date().toISOString()
  };

  const signature = signTransaction(transactionBase, options.privateKey);
  const transactionWithSignature = { ...transactionBase, signature };
  const hash = calculateTransactionHash(transactionWithSignature);

  return {
    ...transactionWithSignature,
    hash
  };
}

/**
 * Validate transaction format and required fields
 */
export function validateTransactionFormat(transaction: Transaction): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!transaction.id) errors.push('Transaction ID is required');
  if (!transaction.type) errors.push('Transaction type is required');
  if (!transaction.action) errors.push('Transaction action is required');
  if (!transaction.timestamp) errors.push('Transaction timestamp is required');
  if (!transaction.signature) errors.push('Transaction signature is required');
  if (!transaction.hash) errors.push('Transaction hash is required');

  // Validate timestamp format
  if (transaction.timestamp && isNaN(Date.parse(transaction.timestamp))) {
    errors.push('Invalid timestamp format');
  }

  // Validate transaction type
  if (transaction.type && !Object.values(TransactionType).includes(transaction.type)) {
    errors.push('Invalid transaction type');
  }

  // Check transaction size
  const transactionSize = JSON.stringify(transaction).length;
  if (transactionSize > BLOCKCHAIN_CONFIG.MAX_BLOCK_SIZE / 10) {
    errors.push('Transaction size exceeds maximum allowed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if a transaction is expired
 */
export function isTransactionExpired(transaction: Transaction): boolean {
  const transactionTime = new Date(transaction.timestamp).getTime();
  const currentTime = Date.now();
  
  // Check if transaction is migrated (has migration metadata)
  const isMigratedTransaction = transaction.data && 
    typeof transaction.data === 'object' && 
    'migratedFrom' in transaction.data;
  
  // Migrated transactions are never considered expired to preserve original timestamps
  if (isMigratedTransaction) {
    return false;
  }
  
  return (currentTime - transactionTime) > BLOCKCHAIN_CONFIG.TRANSACTION_TIMEOUT;
}

/**
 * Sort transactions by timestamp (oldest first)
 */
export function sortTransactionsByTimestamp(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    // If timestamps are equal, sort by transaction ID for deterministic ordering
    if (timeDiff === 0) {
      return a.id.localeCompare(b.id);
    }
    return timeDiff;
  });
}

/**
 * Filter transactions by type
 */
export function filterTransactionsByType(transactions: Transaction[], type: TransactionType): Transaction[] {
  return transactions.filter(tx => tx.type === type);
}

/**
 * Filter transactions by bin ID
 */
export function filterTransactionsByBinId(transactions: Transaction[], binId: string): Transaction[] {
  return transactions.filter(tx => tx.binId === binId);
}

/**
 * Filter transactions by date range
 */
export function filterTransactionsByDateRange(
  transactions: Transaction[], 
  startDate: Date, 
  endDate: Date
): Transaction[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  
  return transactions.filter(tx => {
    const txTime = new Date(tx.timestamp).getTime();
    return txTime >= start && txTime <= end;
  });
}

/**
 * Calculate total size of transactions in bytes
 */
export function calculateTransactionsSize(transactions: Transaction[]): number {
  return JSON.stringify(transactions).length;
}

/**
 * Validate block format and structure
 */
export function validateBlockFormat(block: Block): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check block structure
  if (!block.header) errors.push('Block header is required');
  if (!block.body) errors.push('Block body is required');

  if (block.header) {
    if (typeof block.header.height !== 'number') errors.push('Block height must be a number');
    if (!block.header.previousHash) errors.push('Previous hash is required');
    if (!block.header.merkleRoot) errors.push('Merkle root is required');
    if (!block.header.timestamp) errors.push('Block timestamp is required');
    if (typeof block.header.nonce !== 'number') errors.push('Block nonce must be a number');
    if (!block.header.hash) errors.push('Block hash is required');
  }

  if (block.body) {
    if (!Array.isArray(block.body.transactions)) errors.push('Transactions must be an array');
    if (typeof block.body.transactionCount !== 'number') errors.push('Transaction count must be a number');
    
    if (block.body.transactions && block.body.transactionCount !== block.body.transactions.length) {
      errors.push('Transaction count does not match actual number of transactions');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a genesis block
 */
export function createGenesisBlock(): Block {
  const timestamp = new Date().toISOString();
  
  return {
    header: {
      height: BLOCKCHAIN_CONFIG.GENESIS_BLOCK_HEIGHT,
      previousHash: BLOCKCHAIN_CONFIG.GENESIS_PREVIOUS_HASH,
      merkleRoot: '',
      timestamp,
      nonce: 0,
      hash: ''
    },
    body: {
      transactions: [],
      transactionCount: 0
    }
  };
}