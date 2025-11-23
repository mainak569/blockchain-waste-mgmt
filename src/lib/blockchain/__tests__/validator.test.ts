/**
 * Unit tests for ChainValidator
 */

import { ChainValidator } from '../validator';
import { BlockImpl } from '../block';
import { createTransaction } from '../utils';
import { TransactionType, Block } from '../types';

describe('ChainValidator', () => {
  let validator: ChainValidator;

  beforeEach(() => {
    validator = new ChainValidator();
  });

  describe('validateBlock', () => {
    it('should validate correct block', async () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      
      const result = await validator.validateBlock(block.toJSON());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject block with invalid hash', async () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      const blockJson = block.toJSON();
      blockJson.header.hash = 'invalid-hash';
      
      const result = await validator.validateBlock(blockJson);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Block hash verification failed');
    });

    it('should reject block with invalid merkle root', async () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      const blockJson = block.toJSON();
      blockJson.header.merkleRoot = 'invalid-merkle-root';
      
      const result = await validator.validateBlock(blockJson);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Merkle root verification failed');
    });

    it('should reject block with transaction count mismatch', async () => {
      const transactions = [createTransaction(TransactionType.BIN_UPDATE, 'action', {})];
      const block = new BlockImpl(1, 'prev-hash', transactions);
      const blockJson = block.toJSON();
      blockJson.body.transactionCount = 999;
      
      const result = await validator.validateBlock(blockJson);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction count mismatch');
    });

    it('should reject block with invalid transaction signature', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      transaction.signature = 'invalid-signature';
      
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      const result = await validator.validateBlock(block.toJSON());
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Transaction 0 validation failed'))).toBe(true);
    });

    it('should reject block with expired transaction', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      // Set transaction to be expired (6+ minutes old)
      transaction.timestamp = new Date(Date.now() - 400000).toISOString();
      
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      const result = await validator.validateBlock(block.toJSON());
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Transaction 0 validation failed'))).toBe(true);
    });
  });

  describe('validateChain', () => {
    it('should validate empty chain', async () => {
      const result = await validator.validateChain([]);
      expect(result.isValid).toBe(true);
      expect(result.totalBlocks).toBe(0);
    });

    it('should validate single genesis block', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const result = await validator.validateChain([genesisBlock.toJSON()]);
      
      expect(result.isValid).toBe(true);
      expect(result.totalBlocks).toBe(1);
    });

    it('should validate chain with multiple blocks', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, genesisBlock.header.hash, [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {})
      ]);
      const block2 = new BlockImpl(2, block1.header.hash, [
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {})
      ]);

      const blocks = [genesisBlock.toJSON(), block1.toJSON(), block2.toJSON()];
      const result = await validator.validateChain(blocks);
      
      expect(result.isValid).toBe(true);
      expect(result.totalBlocks).toBe(3);
    });

    it('should reject chain with broken continuity', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, 'wrong-previous-hash', []);

      const blocks = [genesisBlock.toJSON(), block1.toJSON()];
      const result = await validator.validateChain(blocks);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.errorType === 'CHAIN_CONTINUITY_ERROR'
      )).toBe(true);
    });

    it('should reject chain with incorrect genesis block', async () => {
      const invalidGenesis = new BlockImpl(1, 'wrong-genesis-hash', []); // Wrong height
      const result = await validator.validateChain([invalidGenesis.toJSON()]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.errorType === 'GENESIS_BLOCK_ERROR'
      )).toBe(true);
    });

    it('should reject chain with non-sequential heights', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(3, genesisBlock.header.hash, []); // Skip height 1, 2

      const blocks = [genesisBlock.toJSON(), block1.toJSON()];
      const result = await validator.validateChain(blocks);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.errorType === 'BLOCK_HEIGHT_ERROR'
      )).toBe(true);
    });
  });

  describe('verifyHash', () => {
    it('should verify correct block hash', () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      const isValid = validator.verifyHash(block.toJSON());
      expect(isValid).toBe(true);
    });

    it('should reject incorrect block hash', () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      const blockJson = block.toJSON();
      blockJson.header.hash = 'wrong-hash';
      
      const isValid = validator.verifyHash(blockJson);
      expect(isValid).toBe(false);
    });
  });

  describe('checkChainContinuity', () => {
    it('should validate empty chain', async () => {
      const result = await validator.checkChainContinuity([]);
      expect(result).toBe(true);
    });

    it('should validate single block', async () => {
      const block = new BlockImpl(0, 'genesis-hash', []);
      const result = await validator.checkChainContinuity([block.toJSON()]);
      expect(result).toBe(true);
    });

    it('should validate continuous chain', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, genesisBlock.header.hash, []);
      const block2 = new BlockImpl(2, block1.header.hash, []);

      const blocks = [genesisBlock.toJSON(), block1.toJSON(), block2.toJSON()];
      const result = await validator.checkChainContinuity(blocks);
      expect(result).toBe(true);
    });

    it('should reject discontinuous chain', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, 'wrong-hash', []);

      const blocks = [genesisBlock.toJSON(), block1.toJSON()];
      const result = await validator.checkChainContinuity(blocks);
      expect(result).toBe(false);
    });

    it('should handle unsorted blocks', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, genesisBlock.header.hash, []);
      const block2 = new BlockImpl(2, block1.header.hash, []);

      // Pass blocks in wrong order
      const blocks = [block2.toJSON(), genesisBlock.toJSON(), block1.toJSON()];
      const result = await validator.checkChainContinuity(blocks);
      expect(result).toBe(true); // Should sort internally
    });
  });

  describe('generateValidationReport', () => {
    it('should generate report for valid chain', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const block1 = new BlockImpl(1, genesisBlock.header.hash, [
        createTransaction(TransactionType.BIN_UPDATE, 'action', {})
      ]);

      const blocks = [genesisBlock.toJSON(), block1.toJSON()];
      const report = await validator.generateValidationReport(blocks);
      
      expect(report).toBeTruthy();
      const parsed = JSON.parse(report);
      expect(parsed.isValid).toBe(true);
      expect(parsed.totalBlocks).toBe(2);
      expect(parsed.errorCount).toBe(0);
    });

    it('should generate report for invalid chain', async () => {
      const genesisBlock = BlockImpl.createGenesis();
      const invalidBlock = new BlockImpl(1, 'wrong-hash', []);

      const blocks = [genesisBlock.toJSON(), invalidBlock.toJSON()];
      const report = await validator.generateValidationReport(blocks);
      
      const parsed = JSON.parse(report);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errorCount).toBeGreaterThan(0);
      expect(parsed.summary).toBeTruthy();
    });
  });
});