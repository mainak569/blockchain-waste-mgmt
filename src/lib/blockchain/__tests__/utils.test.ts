/**
 * Unit tests for blockchain utilities
 */

import {
  createTransaction,
  validateTransactionFormat,
  isTransactionExpired,
  sortTransactionsByTimestamp,
  filterTransactionsByType,
  filterTransactionsByBinId,
  filterTransactionsByDateRange,
  calculateTransactionsSize,
  validateBlockFormat
} from '../utils';
import { TransactionType, Transaction, Block } from '../types';

describe('Blockchain Utilities', () => {
  describe('createTransaction', () => {
    it('should create valid transaction with required fields', () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      expect(transaction).toBeValidTransaction();
      expect(transaction.type).toBe(TransactionType.BIN_UPDATE);
      expect(transaction.action).toBe('update_capacity');
      expect(transaction.binId).toBe('bin-001');
      expect(transaction.data).toEqual({ capacity: 75 });
    });

    it('should create transaction with all optional fields', () => {
      const transaction = createTransaction(
        TransactionType.PICKUP_CONFIRMATION,
        'confirm_pickup',
        { weight: 50 },
        {
          binId: 'bin-001',
          contractorId: 'contractor-001',
          citizenId: 'citizen-001'
        }
      );

      expect(transaction.binId).toBe('bin-001');
      expect(transaction.contractorId).toBe('contractor-001');
      expect(transaction.citizenId).toBe('citizen-001');
    });

    it('should generate unique transaction IDs', () => {
      const tx1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      const tx2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});
      
      expect(tx1.id).not.toBe(tx2.id);
    });
  });

  describe('validateTransactionFormat', () => {
    const validTransaction: Transaction = {
      id: 'tx-001',
      type: TransactionType.BIN_UPDATE,
      action: 'update_capacity',
      data: { capacity: 75 },
      timestamp: new Date().toISOString(),
      signature: 'valid-signature',
      hash: 'valid-hash'
    };

    it('should validate correct transaction format', () => {
      const result = validateTransactionFormat(validTransaction);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject transaction without required fields', () => {
      const invalidTransaction = { ...validTransaction };
      delete (invalidTransaction as any).id;
      
      const result = validateTransactionFormat(invalidTransaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction ID is required');
    });

    it('should reject transaction with invalid timestamp', () => {
      const invalidTransaction = { ...validTransaction, timestamp: 'invalid-date' };
      
      const result = validateTransactionFormat(invalidTransaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid timestamp format');
    });

    it('should reject transaction with invalid type', () => {
      const invalidTransaction = { ...validTransaction, type: 'invalid-type' as any };
      
      const result = validateTransactionFormat(invalidTransaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid transaction type');
    });
  });

  describe('isTransactionExpired', () => {
    it('should identify expired transactions', () => {
      const expiredTransaction: Transaction = {
        id: 'tx-001',
        type: TransactionType.BIN_UPDATE,
        action: 'update_capacity',
        data: {},
        timestamp: new Date(Date.now() - 400000).toISOString(), // 6+ minutes ago
        signature: 'signature',
        hash: 'hash'
      };

      expect(isTransactionExpired(expiredTransaction)).toBe(true);
    });

    it('should identify non-expired transactions', () => {
      const recentTransaction: Transaction = {
        id: 'tx-001',
        type: TransactionType.BIN_UPDATE,
        action: 'update_capacity',
        data: {},
        timestamp: new Date().toISOString(),
        signature: 'signature',
        hash: 'hash'
      };

      expect(isTransactionExpired(recentTransaction)).toBe(false);
    });
  });

  describe('sortTransactionsByTimestamp', () => {
    it('should sort transactions by timestamp (oldest first)', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        {
          id: 'tx-3',
          type: TransactionType.BIN_UPDATE,
          action: 'action',
          data: {},
          timestamp: new Date(now + 2000).toISOString(),
          signature: 'sig',
          hash: 'hash'
        },
        {
          id: 'tx-1',
          type: TransactionType.BIN_UPDATE,
          action: 'action',
          data: {},
          timestamp: new Date(now).toISOString(),
          signature: 'sig',
          hash: 'hash'
        },
        {
          id: 'tx-2',
          type: TransactionType.BIN_UPDATE,
          action: 'action',
          data: {},
          timestamp: new Date(now + 1000).toISOString(),
          signature: 'sig',
          hash: 'hash'
        }
      ];

      const sorted = sortTransactionsByTimestamp(transactions);
      expect(sorted[0].id).toBe('tx-1');
      expect(sorted[1].id).toBe('tx-2');
      expect(sorted[2].id).toBe('tx-3');
    });

    it('should not modify original array', () => {
      const transactions: Transaction[] = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ];
      
      const originalLength = transactions.length;
      const sorted = sortTransactionsByTimestamp(transactions);
      
      expect(transactions.length).toBe(originalLength);
      expect(sorted).not.toBe(transactions);
    });
  });

  describe('filterTransactionsByType', () => {
    const transactions: Transaction[] = [
      createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
      createTransaction(TransactionType.PICKUP_CONFIRMATION, 'action2', {}),
      createTransaction(TransactionType.BIN_UPDATE, 'action3', {}),
      createTransaction(TransactionType.ISSUE_REPORT, 'action4', {})
    ];

    it('should filter transactions by type', () => {
      const binUpdates = filterTransactionsByType(transactions, TransactionType.BIN_UPDATE);
      expect(binUpdates).toHaveLength(2);
      expect(binUpdates.every(tx => tx.type === TransactionType.BIN_UPDATE)).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const systemEvents = filterTransactionsByType(transactions, TransactionType.SYSTEM_EVENT);
      expect(systemEvents).toHaveLength(0);
    });
  });

  describe('filterTransactionsByBinId', () => {
    const transactions: Transaction[] = [
      createTransaction(TransactionType.BIN_UPDATE, 'action1', {}, { binId: 'bin-001' }),
      createTransaction(TransactionType.BIN_UPDATE, 'action2', {}, { binId: 'bin-002' }),
      createTransaction(TransactionType.BIN_UPDATE, 'action3', {}, { binId: 'bin-001' })
    ];

    it('should filter transactions by bin ID', () => {
      const bin001Transactions = filterTransactionsByBinId(transactions, 'bin-001');
      expect(bin001Transactions).toHaveLength(2);
      expect(bin001Transactions.every(tx => tx.binId === 'bin-001')).toBe(true);
    });
  });

  describe('filterTransactionsByDateRange', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const transactions: Transaction[] = [
      {
        ...createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        timestamp: twoHoursAgo.toISOString()
      },
      {
        ...createTransaction(TransactionType.BIN_UPDATE, 'action2', {}),
        timestamp: now.toISOString()
      },
      {
        ...createTransaction(TransactionType.BIN_UPDATE, 'action3', {}),
        timestamp: oneHourFromNow.toISOString()
      }
    ];

    it('should filter transactions by date range', () => {
      const filtered = filterTransactionsByDateRange(transactions, oneHourAgo, oneHourFromNow);
      expect(filtered).toHaveLength(2); // now and oneHourFromNow
    });
  });

  describe('calculateTransactionsSize', () => {
    it('should calculate size of transaction array', () => {
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ];

      const size = calculateTransactionsSize(transactions);
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });

    it('should return 0 for empty array', () => {
      const size = calculateTransactionsSize([]);
      expect(size).toBe(2); // JSON.stringify([]) = "[]"
    });
  });

  describe('validateBlockFormat', () => {
    const validBlock: Block = {
      header: {
        height: 1,
        previousHash: 'prev-hash',
        merkleRoot: 'merkle-root',
        timestamp: new Date().toISOString(),
        nonce: 12345,
        hash: 'block-hash'
      },
      body: {
        transactions: [],
        transactionCount: 0
      }
    };

    it('should validate correct block format', () => {
      const result = validateBlockFormat(validBlock);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject block without header', () => {
      const invalidBlock = { ...validBlock };
      delete (invalidBlock as any).header;
      
      const result = validateBlockFormat(invalidBlock);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Block header is required');
    });

    it('should reject block with invalid height', () => {
      const invalidBlock = {
        ...validBlock,
        header: { ...validBlock.header, height: 'invalid' as any }
      };
      
      const result = validateBlockFormat(invalidBlock);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Block height must be a number');
    });

    it('should reject block with transaction count mismatch', () => {
      const invalidBlock = {
        ...validBlock,
        body: {
          transactions: [createTransaction(TransactionType.BIN_UPDATE, 'action', {})],
          transactionCount: 5 // Mismatch
        }
      };
      
      const result = validateBlockFormat(invalidBlock);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction count does not match actual number of transactions');
    });
  });
});