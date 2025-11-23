/**
 * Unit tests for Block implementation
 */

import { BlockImpl, TransactionImpl } from '../block';
import { createTransaction } from '../utils';
import { TransactionType, Transaction } from '../types';

describe('BlockImpl', () => {
  describe('constructor', () => {
    it('should create block with empty transactions', () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      
      expect(block.header.height).toBe(1);
      expect(block.header.previousHash).toBe('prev-hash');
      expect(block.body.transactions).toHaveLength(0);
      expect(block.body.transactionCount).toBe(0);
      expect(block.header.hash).toBeTruthy();
    });

    it('should create block with transactions', () => {
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ];

      const block = new BlockImpl(1, 'prev-hash', transactions);
      
      expect(block.body.transactions).toHaveLength(2);
      expect(block.body.transactionCount).toBe(2);
      expect(block.header.merkleRoot).toBeTruthy();
    });

    it('should sort transactions by timestamp', () => {
      const now = Date.now();
      const tx1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      const tx2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});
      
      // Manually set timestamps to ensure order
      tx1.timestamp = new Date(now + 1000).toISOString();
      tx2.timestamp = new Date(now).toISOString();

      const block = new BlockImpl(1, 'prev-hash', [tx1, tx2]);
      
      // tx2 should come first (older timestamp)
      expect(block.body.transactions[0].id).toBe(tx2.id);
      expect(block.body.transactions[1].id).toBe(tx1.id);
    });

    it('should use provided timestamp', () => {
      const customTimestamp = '2023-01-01T00:00:00.000Z';
      const block = new BlockImpl(1, 'prev-hash', [], customTimestamp);
      
      expect(block.header.timestamp).toBe(customTimestamp);
    });
  });

  describe('validate', () => {
    it('should validate correct block', () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      
      const validation = block.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect hash verification failure', () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      // Corrupt the hash
      block.header.hash = 'corrupted-hash';
      
      const validation = block.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Block hash verification failed');
    });

    it('should detect merkle root mismatch', () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      // Corrupt the merkle root
      block.header.merkleRoot = 'corrupted-merkle-root';
      
      const validation = block.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Merkle root verification failed');
    });

    it('should detect transaction count mismatch', () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      // Corrupt the transaction count
      block.body.transactionCount = 999;
      
      const validation = block.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction count does not match actual number of transactions');
    });
  });

  describe('toJSON', () => {
    it('should convert block to JSON format', () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      
      const json = block.toJSON();
      
      expect(json).toBeValidBlock();
      expect(json.header.height).toBe(1);
      expect(json.body.transactions).toHaveLength(1);
    });

    it('should create independent copy', () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      const json = block.toJSON();
      
      // Modify original
      block.header.height = 999;
      
      // JSON should be unchanged
      expect(json.header.height).toBe(1);
    });
  });

  describe('fromJSON', () => {
    it('should create BlockImpl from JSON data', () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const originalBlock = new BlockImpl(1, 'prev-hash', transactions);
      const json = originalBlock.toJSON();
      
      const restoredBlock = BlockImpl.fromJSON(json);
      
      expect(restoredBlock.header.height).toBe(json.header.height);
      expect(restoredBlock.header.hash).toBe(json.header.hash);
      expect(restoredBlock.body.transactions).toHaveLength(json.body.transactions.length);
    });
  });

  describe('createGenesis', () => {
    it('should create genesis block', () => {
      const genesisBlock = BlockImpl.createGenesis();
      
      expect(genesisBlock.header.height).toBe(0);
      expect(genesisBlock.header.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      expect(genesisBlock.body.transactions).toHaveLength(0);
      expect(genesisBlock.body.transactionCount).toBe(0);
    });
  });
});

describe('TransactionImpl', () => {
  const sampleTransaction: Transaction = {
    id: 'tx-001',
    type: TransactionType.BIN_UPDATE,
    action: 'update_capacity',
    data: { capacity: 75 },
    timestamp: new Date().toISOString(),
    signature: 'test-signature',
    hash: 'test-hash',
    binId: 'bin-001'
  };

  describe('constructor', () => {
    it('should create transaction with all properties', () => {
      const tx = new TransactionImpl(sampleTransaction);
      
      expect(tx.id).toBe(sampleTransaction.id);
      expect(tx.type).toBe(sampleTransaction.type);
      expect(tx.action).toBe(sampleTransaction.action);
      expect(tx.binId).toBe(sampleTransaction.binId);
    });
  });

  describe('validate', () => {
    it('should validate correct transaction', () => {
      const tx = new TransactionImpl(sampleTransaction);
      const validation = tx.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject transaction without required fields', () => {
      const invalidTx = { ...sampleTransaction };
      delete (invalidTx as any).id;
      
      const tx = new TransactionImpl(invalidTx);
      const validation = tx.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction ID is required');
    });

    it('should reject transaction with invalid timestamp', () => {
      const invalidTx = { ...sampleTransaction, timestamp: 'invalid-date' };
      const tx = new TransactionImpl(invalidTx);
      const validation = tx.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid timestamp format');
    });
  });

  describe('toJSON', () => {
    it('should convert transaction to JSON format', () => {
      const tx = new TransactionImpl(sampleTransaction);
      const json = tx.toJSON();
      
      expect(json).toBeValidTransaction();
      expect(json.id).toBe(sampleTransaction.id);
      expect(json.type).toBe(sampleTransaction.type);
    });

    it('should create independent copy', () => {
      const tx = new TransactionImpl(sampleTransaction);
      const json = tx.toJSON();
      
      // Modify original
      tx.id = 'modified-id';
      
      // JSON should be unchanged
      expect(json.id).toBe(sampleTransaction.id);
    });
  });
});