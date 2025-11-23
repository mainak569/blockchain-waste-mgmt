/**
 * Unit tests for BlockStorage
 */

import { BlockStorage } from '../storage';
import { BlockImpl } from '../block';
import { createTransaction } from '../utils';
import { TransactionType } from '../types';
import { promises as fs } from 'fs';

describe('BlockStorage', () => {
  let storage: BlockStorage;
  const testDataDir = global.testUtils.getTestDataDir('storage-test');

  beforeEach(async () => {
    await global.testUtils.createTestDir('storage-test');
    storage = new BlockStorage(testDataDir);
    await storage.initialize();
  });

  describe('initialization', () => {
    it('should initialize with genesis block', async () => {
      const genesisBlock = await storage.getBlockByHeight(0);
      expect(genesisBlock).toBeTruthy();
      expect(genesisBlock?.header.height).toBe(0);
    });

    it('should create data directory if it does not exist', async () => {
      const newDataDir = global.testUtils.getTestDataDir('new-storage');
      const newStorage = new BlockStorage(newDataDir);
      
      await newStorage.initialize();
      
      // Check that directory was created
      const stats = await fs.stat(newDataDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should load existing data on initialization', async () => {
      // Add a block to the first storage instance
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      await storage.storeBlock(block.toJSON());

      // Create new storage instance with same data directory
      const newStorage = new BlockStorage(testDataDir);
      await newStorage.initialize();

      // Should load the existing block
      const loadedBlock = await newStorage.getBlockByHeight(1);
      expect(loadedBlock).toBeTruthy();
      expect(loadedBlock?.header.height).toBe(1);
    });
  });

  describe('storeBlock', () => {
    it('should store valid block', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      
      const result = await storage.storeBlock(block.toJSON());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid block', async () => {
      const block = new BlockImpl(1, 'prev-hash', []);
      const blockJson = block.toJSON();
      blockJson.header.hash = 'invalid-hash'; // Corrupt the hash
      
      const result = await storage.storeBlock(blockJson);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should update chain state after storing block', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      
      await storage.storeBlock(block.toJSON());
      
      const chainState = storage.getChainState();
      expect(chainState.height).toBe(1);
      expect(chainState.totalTransactions).toBe(1);
      expect(chainState.latestBlockHash).toBe(block.header.hash);
    });

    it('should update transaction index', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      
      await storage.storeBlock(block.toJSON());
      
      const retrievedTx = await storage.getTransaction(transaction.id);
      expect(retrievedTx).toBeTruthy();
      expect(retrievedTx?.id).toBe(transaction.id);
    });
  });

  describe('getBlockByHeight', () => {
    it('should retrieve block by height', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      
      await storage.storeBlock(block.toJSON());
      
      const retrievedBlock = await storage.getBlockByHeight(1);
      expect(retrievedBlock).toBeTruthy();
      expect(retrievedBlock?.header.height).toBe(1);
      expect(retrievedBlock?.header.hash).toBe(block.header.hash);
    });

    it('should return null for non-existent block', async () => {
      const block = await storage.getBlockByHeight(999);
      expect(block).toBeNull();
    });
  });

  describe('getLatestBlock', () => {
    it('should return genesis block initially', async () => {
      const latestBlock = await storage.getLatestBlock();
      expect(latestBlock).toBeTruthy();
      expect(latestBlock?.header.height).toBe(0);
    });

    it('should return latest stored block', async () => {
      const transaction1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      const block1 = new BlockImpl(1, 'prev-hash', [transaction1]);
      await storage.storeBlock(block1.toJSON());

      const transaction2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});
      const block2 = new BlockImpl(2, block1.header.hash, [transaction2]);
      await storage.storeBlock(block2.toJSON());

      const latestBlock = await storage.getLatestBlock();
      expect(latestBlock?.header.height).toBe(2);
    });
  });

  describe('getTransaction', () => {
    it('should retrieve transaction by ID', async () => {
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      
      await storage.storeBlock(block.toJSON());
      
      const retrievedTx = await storage.getTransaction(transaction.id);
      expect(retrievedTx).toBeTruthy();
      expect(retrievedTx?.id).toBe(transaction.id);
      expect(retrievedTx?.action).toBe(transaction.action);
    });

    it('should return null for non-existent transaction', async () => {
      const transaction = await storage.getTransaction('non-existent-id');
      expect(transaction).toBeNull();
    });
  });

  describe('getAllBlocks', () => {
    it('should return all stored blocks', async () => {
      const transaction1 = createTransaction(TransactionType.BIN_UPDATE, 'action1', {});
      const block1 = new BlockImpl(1, 'prev-hash', [transaction1]);
      await storage.storeBlock(block1.toJSON());

      const transaction2 = createTransaction(TransactionType.BIN_UPDATE, 'action2', {});
      const block2 = new BlockImpl(2, block1.header.hash, [transaction2]);
      await storage.storeBlock(block2.toJSON());

      const allBlocks = await storage.getAllBlocks();
      expect(allBlocks.length).toBe(3); // Genesis + 2 added blocks
    });
  });

  describe('getTransactionsByBinId', () => {
    beforeEach(async () => {
      const transactions = [
        createTransaction(TransactionType.BIN_UPDATE, 'action1', {}, { binId: 'bin-001' }),
        createTransaction(TransactionType.BIN_UPDATE, 'action2', {}, { binId: 'bin-002' }),
        createTransaction(TransactionType.BIN_UPDATE, 'action3', {}, { binId: 'bin-001' })
      ];

      const block = new BlockImpl(1, 'prev-hash', transactions);
      await storage.storeBlock(block.toJSON());
    });

    it('should return transactions for specific bin ID', async () => {
      const bin001Transactions = await storage.getTransactionsByBinId('bin-001');
      expect(bin001Transactions.length).toBe(2);
      expect(bin001Transactions.every(tx => tx.binId === 'bin-001')).toBe(true);
    });

    it('should return empty array for non-existent bin ID', async () => {
      const transactions = await storage.getTransactionsByBinId('non-existent-bin');
      expect(transactions).toHaveLength(0);
    });
  });

  describe('getTransactionsByDateRange', () => {
    beforeEach(async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const transactions = [
        {
          ...createTransaction(TransactionType.BIN_UPDATE, 'action1', {}),
          timestamp: twoHoursAgo.toISOString()
        },
        {
          ...createTransaction(TransactionType.BIN_UPDATE, 'action2', {}),
          timestamp: now.toISOString()
        }
      ];

      const block = new BlockImpl(1, 'prev-hash', transactions);
      await storage.storeBlock(block.toJSON());
    });

    it('should return transactions within date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const transactions = await storage.getTransactionsByDateRange(oneHourAgo, oneHourFromNow);
      expect(transactions.length).toBe(1); // Only the recent transaction
    });

    it('should return empty array for date range with no transactions', async () => {
      const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 60 * 60 * 1000);

      const transactions = await storage.getTransactionsByDateRange(futureStart, futureEnd);
      expect(transactions).toHaveLength(0);
    });
  });

  describe('getChainState', () => {
    it('should return current chain state', async () => {
      const chainState = storage.getChainState();
      
      expect(typeof chainState.height).toBe('number');
      expect(typeof chainState.totalTransactions).toBe('number');
      expect(typeof chainState.latestBlockHash).toBe('string');
      expect(typeof chainState.lastUpdated).toBe('string');
    });

    it('should update chain state after storing blocks', async () => {
      const initialState = storage.getChainState();
      
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      await storage.storeBlock(block.toJSON());
      
      const updatedState = storage.getChainState();
      expect(updatedState.height).toBeGreaterThan(initialState.height);
      expect(updatedState.totalTransactions).toBeGreaterThan(initialState.totalTransactions);
    });
  });

  describe('backup and restore', () => {
    const backupDir = global.testUtils.getTestDataDir('backup-test');

    beforeEach(async () => {
      await global.testUtils.createTestDir('backup-test');
      
      // Add some test data
      const transaction = createTransaction(TransactionType.BIN_UPDATE, 'action', {});
      const block = new BlockImpl(1, 'prev-hash', [transaction]);
      await storage.storeBlock(block.toJSON());
    });

    it('should create backup successfully', async () => {
      await storage.createBackup(backupDir);
      
      // Check that backup file exists
      const backupFile = `${backupDir}/blockchain_backup.json`;
      const stats = await fs.stat(backupFile);
      expect(stats.isFile()).toBe(true);
    });

    it('should restore from backup successfully', async () => {
      // Create backup
      await storage.createBackup(backupDir);
      
      // Create new storage instance
      const newDataDir = global.testUtils.getTestDataDir('restored-storage');
      await global.testUtils.createTestDir('restored-storage');
      const newStorage = new BlockStorage(newDataDir);
      await newStorage.initialize();
      
      // Restore from backup
      await newStorage.restoreFromBackup(backupDir);
      
      // Verify data was restored
      const restoredBlock = await newStorage.getBlockByHeight(1);
      expect(restoredBlock).toBeTruthy();
      expect(restoredBlock?.header.height).toBe(1);
    });

    it('should handle backup creation errors gracefully', async () => {
      const invalidBackupDir = 'C:\\invalid<>path|with*invalid?chars';
      
      await expect(storage.createBackup(invalidBackupDir))
        .rejects.toThrow('Backup creation failed');
    });

    it('should handle restore errors gracefully', async () => {
      const invalidBackupDir = 'C:\\invalid<>path|with*invalid?chars';
      
      await expect(storage.restoreFromBackup(invalidBackupDir))
        .rejects.toThrow('Backup restoration failed');
    });
  });
});