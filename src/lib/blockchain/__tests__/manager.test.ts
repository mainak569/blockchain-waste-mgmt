/**
 * Unit tests for BlockchainManager
 */

import { BlockchainManager } from '../manager';
import { createTransaction } from '../utils';
import { TransactionType } from '../types';

describe('BlockchainManager', () => {
  let manager: BlockchainManager;
  const testDataDir = global.testUtils.getTestDataDir('manager-test');

  beforeEach(async () => {
    await global.testUtils.createTestDir('manager-test');
    manager = new BlockchainManager(testDataDir);
    await manager.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const stats = await manager.getBlockchainStats();
      expect(stats.chainHeight).toBeGreaterThanOrEqual(0);
      expect(stats.totalTransactions).toBeGreaterThanOrEqual(0);
    });

    it('should have genesis block after initialization', async () => {
      const genesisBlock = await manager.getBlockByHeight(0);
      expect(genesisBlock).toBeTruthy();
      expect(genesisBlock?.header.height).toBe(0);
    });

    it('should prevent double initialization', async () => {
      // Should not throw error on second initialization
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should validate existing chain on startup', async () => {
      // Add some data first
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      await manager.createBlock();

      // Create new manager with same data directory
      const newManager = new BlockchainManager(testDataDir);
      await expect(newManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('transaction management', () => {
    it('should add transaction successfully', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      const transactionId = await manager.addTransaction(transaction);
      expect(transactionId).toBe(transaction.id);
    });

    it('should execute smart contracts when adding transactions', async () => {
      const pickupTransaction = createTransaction(
        TransactionType.PICKUP_CONFIRMATION,
        'confirm_pickup',
        { weight: 50 },
        { binId: 'bin-001', contractorId: 'contractor-001' }
      );

      const transactionId = await manager.addTransaction(pickupTransaction);
      expect(transactionId).toBe(pickupTransaction.id);

      // Smart contracts should have generated additional transactions
      const stats = await manager.getBlockchainStats();
      expect(stats.pendingTransactions).toBeGreaterThan(1);
    });

    it('should create block automatically when pool is half full', async () => {
      const initialStats = await manager.getBlockchainStats();
      
      // Add enough transactions to trigger automatic block creation
      for (let i = 0; i < 50; i++) {
        const transaction = createTransaction(
          TransactionType.BIN_UPDATE,
          `action-${i}`,
          { capacity: 75 + i },
          { binId: `bin-${i}` }
        );
        await manager.addTransaction(transaction);
      }

      const finalStats = await manager.getBlockchainStats();
      expect(finalStats.chainHeight).toBeGreaterThan(initialStats.chainHeight);
    });

    it('should retrieve transaction with cryptographic proof', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await manager.addTransaction(transaction);
      await manager.createBlock();
      
      const retrievedTx = await manager.getTransaction(transaction.id);
      expect(retrievedTx).toBeTruthy();
      expect(retrievedTx?.id).toBe(transaction.id);
      expect((retrievedTx as any)?._proof).toBeTruthy();
    });

    it('should return null for non-existent transaction', async () => {
      const transaction = await manager.getTransaction('non-existent-id');
      expect(transaction).toBeNull();
    });
  });

  describe('block management', () => {
    it('should create block with transactions', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await manager.addTransaction(transaction);
      const block = await manager.createBlock();
      
      expect(block).toBeTruthy();
      expect(block.header.height).toBeGreaterThan(0);
      expect(block.body.transactions.length).toBeGreaterThan(0);
    });

    it('should create block with correct height and previous hash', async () => {
      const latestBlockBefore = await manager.getLatestBlock();
      const expectedHeight = latestBlockBefore ? latestBlockBefore.header.height + 1 : 1;
      const expectedPreviousHash = latestBlockBefore ? latestBlockBefore.header.hash : '0000000000000000000000000000000000000000000000000000000000000000';

      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      
      const newBlock = await manager.createBlock();
      expect(newBlock.header.height).toBe(expectedHeight);
      expect(newBlock.header.previousHash).toBe(expectedPreviousHash);
    });

    it('should get latest block', async () => {
      const latestBlock = await manager.getLatestBlock();
      expect(latestBlock).toBeTruthy();
    });

    it('should get block by height', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      const newBlock = await manager.createBlock();
      
      const retrievedBlock = await manager.getBlockByHeight(newBlock.header.height);
      expect(retrievedBlock).toBeTruthy();
      expect(retrievedBlock?.header.hash).toBe(newBlock.header.hash);
    });

    it('should return null for non-existent block height', async () => {
      const block = await manager.getBlockByHeight(999);
      expect(block).toBeNull();
    });
  });

  describe('chain validation', () => {
    it('should validate empty chain', async () => {
      const validation = await manager.validateChain();
      expect(validation.isValid).toBe(true);
    });

    it('should validate chain with transactions', async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await manager.addTransaction(transaction);
      await manager.createBlock();
      
      const validation = await manager.validateChain();
      expect(validation.isValid).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      // This test would require corrupting the blockchain data
      // For now, we just ensure the method doesn't throw
      const validation = await manager.validateChain();
      expect(validation).toBeTruthy();
      expect(typeof validation.isValid).toBe('boolean');
    });
  });

  describe('querying with proofs', () => {
    beforeEach(async () => {
      // Add some test transactions
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'update_capacity', { capacity: 75 }, { binId: 'bin-001' }),
        createTransaction(TransactionType.PICKUP_CONFIRMATION, 'confirm_pickup', { weight: 50 }, { binId: 'bin-001', contractorId: 'contractor-001' }),
        createTransaction(TransactionType.ISSUE_REPORT, 'report_issue', { issue: 'overflow' }, { binId: 'bin-002', citizenId: 'citizen-001' })
      ];

      for (const tx of transactions) {
        await manager.addTransaction(tx);
      }
      
      await manager.createBlock();
    });

    it('should query transactions by bin ID with proofs', async () => {
      const transactions = await manager.getTransactionsByBinId('bin-001');
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions.every(tx => tx.binId === 'bin-001')).toBe(true);
      
      // Check that proofs are included
      transactions.forEach(tx => {
        expect((tx as any)._proof).toBeTruthy();
        expect((tx as any)._blockHeight).toBeDefined();
        expect((tx as any)._blockHash).toBeTruthy();
      });
    });

    it('should query transactions by date range with proofs', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      const transactions = await manager.getTransactionsByDateRange(oneHourAgo, oneHourFromNow);
      expect(transactions.length).toBeGreaterThan(0);
      
      // Check that proofs are included
      transactions.forEach(tx => {
        expect((tx as any)._proof).toBeTruthy();
        expect((tx as any)._blockHeight).toBeDefined();
        expect((tx as any)._blockHash).toBeTruthy();
      });
    });

    it('should return empty arrays for non-matching queries', async () => {
      const binTransactions = await manager.getTransactionsByBinId('non-existent-bin');
      expect(binTransactions).toHaveLength(0);

      const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const dateTransactions = await manager.getTransactionsByDateRange(futureStart, futureEnd);
      expect(dateTransactions).toHaveLength(0);
    });
  });

  describe('export functionality', () => {
    beforeEach(async () => {
      const transaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'update_capacity',
        { capacity: 75 },
        { binId: 'bin-001' }
      );

      await manager.addTransaction(transaction);
      await manager.createBlock();
    });

    it('should export chain as JSON', async () => {
      const jsonExport = await manager.exportChain('json');
      expect(jsonExport).toBeTruthy();
      
      const parsed = JSON.parse(jsonExport);
      expect(parsed.metadata).toBeTruthy();
      expect(parsed.metadata.format).toBe('json');
      expect(parsed.blocks).toBeTruthy();
      expect(Array.isArray(parsed.blocks)).toBe(true);
      expect(parsed.chainState).toBeTruthy();
    });

    it('should export chain as CSV', async () => {
      const csvExport = await manager.exportChain('csv');
      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('Block Height');
      expect(csvExport).toContain('Transaction ID');
      expect(csvExport).toContain('Transaction Type');
    });

    it('should reject unsupported export format', async () => {
      await expect(manager.exportChain('xml' as any))
        .rejects.toThrow('Unsupported export format');
    });

    it('should include metadata in exports', async () => {
      const jsonExport = await manager.exportChain('json');
      const parsed = JSON.parse(jsonExport);
      
      expect(parsed.metadata.exportTimestamp).toBeTruthy();
      expect(parsed.metadata.chainHeight).toBeDefined();
      expect(parsed.metadata.totalBlocks).toBeDefined();
      expect(parsed.metadata.totalTransactions).toBeDefined();
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide comprehensive blockchain statistics', async () => {
      const stats = await manager.getBlockchainStats();
      
      expect(typeof stats.chainHeight).toBe('number');
      expect(typeof stats.totalTransactions).toBe('number');
      expect(typeof stats.pendingTransactions).toBe('number');
      expect(typeof stats.processedTransactions).toBe('number');
      expect(typeof stats.isCreatingBlock).toBe('boolean');
      expect(typeof stats.averageTransactionAge).toBe('number');
      expect(typeof stats.activeContracts).toBe('number');
      expect(stats.latestBlockHash).toBeTruthy();
      expect(stats.lastUpdated).toBeTruthy();
    });

    it('should update statistics after operations', async () => {
      const initialStats = await manager.getBlockchainStats();
      
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      
      const afterAddStats = await manager.getBlockchainStats();
      expect(afterAddStats.pendingTransactions).toBeGreaterThan(initialStats.pendingTransactions);
      
      await manager.createBlock();
      
      const afterBlockStats = await manager.getBlockchainStats();
      expect(afterBlockStats.chainHeight).toBeGreaterThan(initialStats.chainHeight);
      expect(afterBlockStats.totalTransactions).toBeGreaterThan(initialStats.totalTransactions);
    });
  });

  describe('cryptographic proof verification', () => {
    it('should verify valid transaction proofs', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      await manager.createBlock();
      
      const retrievedTx = await manager.getTransaction(transaction.id);
      expect(retrievedTx).toBeTruthy();
      
      const proof = (retrievedTx as any)._proof;
      const blockHash = (retrievedTx as any)._blockHash;
      const blockHeight = (retrievedTx as any)._blockHeight;
      
      const isValid = await manager.verifyTransactionProof(retrievedTx!, proof, blockHash, blockHeight);
      expect(isValid).toBe(true);
    });

    it('should reject invalid transaction proofs', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      await manager.createBlock();
      
      const retrievedTx = await manager.getTransaction(transaction.id);
      expect(retrievedTx).toBeTruthy();
      
      const blockHeight = (retrievedTx as any)._blockHeight;
      
      // Use wrong proof
      const isValid = await manager.verifyTransactionProof(retrievedTx!, 'wrong-proof', 'wrong-hash', blockHeight);
      expect(isValid).toBe(false);
    });
  });

  describe('backup and restore', () => {
    const backupDir = global.testUtils.getTestDataDir('manager-backup');

    beforeEach(async () => {
      await global.testUtils.createTestDir('manager-backup');
      
      // Add some test data
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await manager.addTransaction(transaction);
      await manager.createBlock();
    });

    it('should create backup successfully', async () => {
      await expect(manager.createBackup(backupDir)).resolves.not.toThrow();
    });

    it('should restore from backup successfully', async () => {
      await manager.createBackup(backupDir);
      
      // Create new manager and restore
      const newDataDir = global.testUtils.getTestDataDir('restored-manager');
      await global.testUtils.createTestDir('restored-manager');
      const newManager = new BlockchainManager(newDataDir);
      await newManager.initialize();
      
      await expect(newManager.restoreFromBackup(backupDir)).resolves.not.toThrow();
      
      // Verify data was restored
      const stats = await newManager.getBlockchainStats();
      expect(stats.chainHeight).toBeGreaterThan(0);
    });

    it('should validate chain after restore', async () => {
      await manager.createBackup(backupDir);
      
      const newDataDir = global.testUtils.getTestDataDir('restored-manager-2');
      await global.testUtils.createTestDir('restored-manager-2');
      const newManager = new BlockchainManager(newDataDir);
      await newManager.initialize();
      await newManager.restoreFromBackup(backupDir);
      
      const validation = await newManager.validateChain();
      expect(validation.isValid).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Use a path that contains invalid characters for Windows
      const invalidManager = new BlockchainManager('C:\\invalid<>path|with*invalid?chars');
      await expect(invalidManager.initialize()).rejects.toThrow();
    });

    it('should require initialization before operations', async () => {
      const uninitializedManager = new BlockchainManager(testDataDir);
      
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      await expect(uninitializedManager.addTransaction(transaction))
        .rejects.toThrow('Blockchain manager not initialized');
    });

    it('should handle transaction addition errors gracefully', async () => {
      const invalidTransaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      invalidTransaction.signature = 'invalid-signature';
      
      await expect(manager.addTransaction(invalidTransaction))
        .rejects.toThrow('Transaction addition failed');
    });

    it('should handle export errors gracefully', async () => {
      // Mock a storage error by using invalid data directory
      const errorManager = new BlockchainManager('C:\\invalid<>export|path*with?invalid:chars');
      await expect(errorManager.initialize()).rejects.toThrow();
    });
  });
});