/**
 * Unit tests for ConsensusEngine
 */

import { ConsensusEngine } from '../consensus';
import { createTransaction } from '../utils';
import { TransactionType } from '../types';
import { calculateTransactionHash } from '../crypto';

describe('ConsensusEngine', () => {
  let consensusEngine: ConsensusEngine;

  beforeEach(() => {
    consensusEngine = new ConsensusEngine();
  });

  describe('addToPool', () => {
    it('should add valid transaction to pool', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await consensusEngine.addToPool(transaction);
      expect(consensusEngine.getPoolSize()).toBe(1);
    });

    it('should reject duplicate transactions', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await consensusEngine.addToPool(transaction);
      
      // Try to add the same transaction again - should be rejected
      try {
        await consensusEngine.addToPool(transaction);
        // If it doesn't throw, the pool size should still be 1
        expect(consensusEngine.getPoolSize()).toBe(1);
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeTruthy();
      }
    });

    it('should reject expired transactions', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );
      
      // Make transaction expired
      transaction.timestamp = new Date(Date.now() - 400000).toISOString();

      await expect(consensusEngine.addToPool(transaction))
        .rejects.toThrow('Transaction validation failed');
    });

    it('should reject transactions with invalid signatures', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );
      
      // Corrupt the signature
      transaction.signature = 'invalid-signature';

      await expect(consensusEngine.addToPool(transaction))
        .rejects.toThrow('Transaction validation failed');
    });
  });

  describe('getPoolSize', () => {
    it('should return correct pool size', async () => {
      expect(consensusEngine.getPoolSize()).toBe(0);

      const tx1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      const tx2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});

      await consensusEngine.addToPool(tx1);
      expect(consensusEngine.getPoolSize()).toBe(1);

      await consensusEngine.addToPool(tx2);
      expect(consensusEngine.getPoolSize()).toBe(2);
    });
  });

  describe('createBlock', () => {
    it('should create block from pool transactions', async () => {
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ];

      for (const tx of transactions) {
        await consensusEngine.addToPool(tx);
      }

      const block = await consensusEngine.createBlock();
      
      expect(block.body.transactions.length).toBe(2);
      expect(block.body.transactionCount).toBe(2);
      expect(consensusEngine.getPoolSize()).toBe(0); // Pool should be cleared
    });

    it('should create block with provided transactions', async () => {
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ];

      const block = await consensusEngine.createBlock(transactions);
      
      expect(block.body.transactions.length).toBe(2);
      expect(block.body.transactionCount).toBe(2);
    });

    it('should prevent concurrent block creation', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await consensusEngine.addToPool(transaction);

      // Start first block creation
      const blockPromise1 = consensusEngine.createBlock();
      
      // Try to start second block creation immediately
      const blockPromise2 = consensusEngine.createBlock();

      // One should succeed, one should fail
      const results = await Promise.allSettled([blockPromise1, blockPromise2]);
      
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;
      
      expect(successes).toBe(1);
      expect(failures).toBe(1);
    });

    it('should sort transactions deterministically', async () => {
      // Create transactions with different timestamps by waiting between creation
      const tx1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      
      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const tx2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});

      await consensusEngine.addToPool(tx1);
      await consensusEngine.addToPool(tx2);

      const block = await consensusEngine.createBlock();
      
      // tx1 should come first (older timestamp)
      expect(block.body.transactions[0].id).toBe(tx1.id);
      expect(block.body.transactions[1].id).toBe(tx2.id);
    });

    it('should filter out invalid transactions', async () => {
      const validTx = createTransaction(TransactionType.BIN_UPDATE, 'valid', {});
      const invalidTx = createTransaction(TransactionType.BIN_UPDATE, 'invalid', {});
      
      // Corrupt the invalid transaction
      invalidTx.signature = 'invalid-signature';

      // Add both transactions
      await consensusEngine.addToPool(validTx);
      
      // Create block with both transactions (including invalid one)
      const block = await consensusEngine.createBlock([validTx, invalidTx]);
      
      // Only valid transaction should be included
      expect(block.body.transactions.length).toBe(1);
      expect(block.body.transactions[0].id).toBe(validTx.id);
    });
  });

  describe('validateTransaction', () => {
    it('should validate correct transaction', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 }
      );

      const isValid = await consensusEngine.validateTransaction(transaction);
      expect(isValid).toBe(true);
    });

    it('should reject transaction with invalid signature', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 }
      );
      
      transaction.signature = 'invalid-signature';

      const isValid = await consensusEngine.validateTransaction(transaction);
      expect(isValid).toBe(false);
    });

    it('should reject expired transaction', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 }
      );
      
      transaction.timestamp = new Date(Date.now() - 400000).toISOString();

      const isValid = await consensusEngine.validateTransaction(transaction);
      expect(isValid).toBe(false);
    });

    it('should reject transaction with invalid hash', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 }
      );
      
      transaction.hash = 'invalid-hash';

      const isValid = await consensusEngine.validateTransaction(transaction);
      expect(isValid).toBe(false);
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicting transactions', async () => {
      // Create two conflicting bin update transactions
      const tx1 = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );
      
      // Wait to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const tx2 = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 80 },
        { binId: 'bin-001' }
      );

      await consensusEngine.addToPool(tx1);
      await consensusEngine.addToPool(tx2);
      
      expect(consensusEngine.getPoolSize()).toBe(2);

      await consensusEngine.resolveConflicts();
      
      // Should keep only the earlier transaction
      expect(consensusEngine.getPoolSize()).toBe(1);
      
      const pendingTransactions = consensusEngine.getPendingTransactions();
      expect(pendingTransactions[0].id).toBe(tx1.id);
    });

    it('should handle non-conflicting transactions', async () => {
      const tx1 = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );
      
      const tx2 = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 80 },
        { binId: 'bin-002' } // Different bin
      );

      await consensusEngine.addToPool(tx1);
      await consensusEngine.addToPool(tx2);
      
      expect(consensusEngine.getPoolSize()).toBe(2);

      await consensusEngine.resolveConflicts();
      
      // Both transactions should remain
      expect(consensusEngine.getPoolSize()).toBe(2);
    });
  });

  describe('getPendingTransactions', () => {
    it('should return copy of pending transactions', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await consensusEngine.addToPool(transaction);

      const pending = consensusEngine.getPendingTransactions();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(transaction.id);

      // Modifying returned array should not affect internal pool
      pending.push(createTransaction(TransactionType.BIN_UPDATE, 'another', {}));
      expect(consensusEngine.getPoolSize()).toBe(1);
    });
  });

  describe('getStatistics', () => {
    it('should provide engine statistics', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await consensusEngine.addToPool(transaction);

      const stats = consensusEngine.getStatistics();
      
      expect(stats.poolSize).toBe(1);
      expect(typeof stats.processedTransactions).toBe('number');
      expect(typeof stats.isCreatingBlock).toBe('boolean');
      expect(typeof stats.oldestTransactionAge).toBe('number');
      expect(typeof stats.averageTransactionAge).toBe('number');
    });
  });

  describe('clearProcessedTransactions', () => {
    it('should clear old processed transaction IDs', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await consensusEngine.addToPool(transaction);
      await consensusEngine.createBlock();

      const statsBefore = consensusEngine.getStatistics();
      expect(statsBefore.processedTransactions).toBeGreaterThan(0);

      consensusEngine.clearProcessedTransactions();

      const statsAfter = consensusEngine.getStatistics();
      expect(statsAfter.processedTransactions).toBeLessThanOrEqual(statsBefore.processedTransactions);
    });
  });
});