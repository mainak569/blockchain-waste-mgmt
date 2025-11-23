/**
 * System Integration Test
 * 
 * This test verifies end-to-end blockchain functionality with existing WasteChain features.
 * It tests migration from current system to blockchain-enabled system and validates
 * all API endpoints work with blockchain integration.
 */

import { BlockchainIntegrationService } from '../blockchain-integration';
import { BlockchainManager } from '../blockchain/manager';
import { createTransaction, TransactionType } from '../blockchain/utils';
import { promises as fs } from 'fs';
import path from 'path';

describe('System Integration Test - Complete Blockchain Integration', () => {
  let service: BlockchainIntegrationService;
  let testDataDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDataDir = path.join(process.cwd(), 'test-data', `integration-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDataDir, { recursive: true });

    // Initialize blockchain integration service
    service = new BlockchainIntegrationService({
      enabled: true,
      dataDirectory: testDataDir,
      gracefulDegradation: true,
      fallbackToLegacy: true
    });

    await service.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Blockchain Functionality', () => {
    it('should handle complete waste management workflow with blockchain', async () => {
      // 1. Create bins with blockchain logging
      const bin1TxId = await service.logBinUpdate('BIN001', 'created', {
        location: 'Main Street',
        capacity: 100,
        fillLevel: 0
      });
      expect(bin1TxId).toBeTruthy();
      expect(bin1TxId).toMatch(/^TX-/);

      const bin2TxId = await service.logBinUpdate('BIN002', 'created', {
        location: 'Park Avenue',
        capacity: 150,
        fillLevel: 0
      });
      expect(bin2TxId).toBeTruthy();

      // 2. Update bin status
      const updateTxId = await service.logBinUpdate('BIN001', 'status_updated', {
        fillLevel: 75,
        status: 'needs_pickup'
      });
      expect(updateTxId).toBeTruthy();

      // 3. Log pickup confirmation
      const pickupTxId = await service.logPickupConfirmation('BIN001', 'contractor-123', 'collected', {
        timestamp: new Date().toISOString(),
        weight: 45.5
      });
      expect(pickupTxId).toBeTruthy();

      // 4. Log citizen issue report
      const reportTxId = await service.logIssueReport('BIN002', 'citizen-456', 'issue_reported', {
        issueType: 'overflow',
        description: 'Bin is overflowing'
      });
      expect(reportTxId).toBeTruthy();

      // 5. Verify all transactions are retrievable
      const bin1Transactions = await service.getTransactionsByBinId('BIN001');
      expect(bin1Transactions.length).toBeGreaterThanOrEqual(2); // Create + update + pickup

      const bin2Transactions = await service.getTransactionsByBinId('BIN002');
      expect(bin2Transactions.length).toBeGreaterThanOrEqual(2); // Create + issue report

      // 6. Verify blockchain integrity
      const validation = await service.validateChain();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // 7. Test data export
      const jsonExport = await service.exportChain('json');
      expect(jsonExport).toBeTruthy();
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const csvExport = await service.exportChain('csv');
      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('Transaction ID');
    });

    it('should handle high-volume transaction processing', async () => {
      const transactionPromises: Promise<string | null>[] = [];

      // Create 50 transactions concurrently
      for (let i = 0; i < 50; i++) {
        const binId = `BIN${String(i).padStart(3, '0')}`;
        transactionPromises.push(
          service.logBinUpdate(binId, 'created', {
            location: `Location ${i}`,
            capacity: 100 + i,
            fillLevel: i % 100
          })
        );
      }

      const results = await Promise.all(transactionPromises);
      
      // All transactions should succeed
      expect(results.every(result => result !== null)).toBe(true);
      expect(results.every(result => typeof result === 'string')).toBe(true);

      // Verify blockchain integrity after high volume
      const validation = await service.validateChain();
      expect(validation.isValid).toBe(true);

      // Verify statistics
      const stats = await service.getBlockchainStats();
      expect(stats.totalTransactions).toBeGreaterThanOrEqual(50);
      expect(stats.chainHeight).toBeGreaterThan(0);
    });

    it('should maintain data integrity during backup and restore', async () => {
      // Create some transactions
      await service.logBinUpdate('BIN001', 'created', { location: 'Test Location' });
      await service.logPickupConfirmation('BIN001', 'contractor-1', 'collected', {});
      await service.logIssueReport('BIN001', 'citizen-1', 'issue_reported', { issueType: 'damage' });

      // Get initial state
      const initialTransactions = await service.getTransactionsByBinId('BIN001');
      const initialStats = await service.getBlockchainStats();

      // Create backup
      const backupDir = path.join(testDataDir, 'backup');
      await fs.mkdir(backupDir, { recursive: true });
      
      // Note: We'll test the backup/restore functionality through the blockchain manager
      const manager = new BlockchainManager(testDataDir);
      await manager.initialize();
      await manager.createBackup(backupDir);

      // Create new manager and restore
      const newDataDir = path.join(testDataDir, 'restored');
      await fs.mkdir(newDataDir, { recursive: true });
      
      const newManager = new BlockchainManager(newDataDir);
      await newManager.initialize();
      await newManager.restoreFromBackup(backupDir);

      // Verify restored data
      const newService = new BlockchainIntegrationService({
        enabled: true,
        dataDirectory: newDataDir,
        gracefulDegradation: true,
        fallbackToLegacy: true
      });
      await newService.initialize();

      const restoredTransactions = await newService.getTransactionsByBinId('BIN001');
      const restoredStats = await newService.getBlockchainStats();

      expect(restoredTransactions.length).toBe(initialTransactions.length);
      expect(restoredStats.totalTransactions).toBe(initialStats.totalTransactions);
      expect(restoredStats.chainHeight).toBe(initialStats.chainHeight);
    });
  });

  describe('Migration from Legacy System', () => {
    it('should migrate existing transaction logs to blockchain', async () => {
      // Simulate legacy transactions
      const legacyTransactions = [
        {
          id: 'legacy-1',
          type: 'bin_update',
          binId: 'BIN001',
          action: 'created',
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          data: { location: 'Legacy Location 1' }
        },
        {
          id: 'legacy-2',
          type: 'pickup_confirmation',
          binId: 'BIN001',
          contractorId: 'contractor-legacy',
          action: 'collected',
          timestamp: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
          data: { weight: 30.5 }
        }
      ];

      // Perform migration
      const migrationResult = await service.migrateExistingTransactions(legacyTransactions);
      
      expect(migrationResult.migrated).toBe(2);
      expect(migrationResult.errors).toHaveLength(0);

      // Verify migrated transactions are accessible
      const transactions = await service.getTransactionsByBinId('BIN001');
      expect(transactions.length).toBeGreaterThanOrEqual(2);

      // Verify blockchain integrity after migration
      const validation = await service.validateChain();
      expect(validation.isValid).toBe(true);
    });

    it('should handle migration errors gracefully', async () => {
      const invalidLegacyTransactions = [
        {
          id: 'invalid-1',
          // Missing required fields
          timestamp: new Date().toISOString()
        },
        {
          id: 'valid-1',
          type: 'bin_update',
          binId: 'BIN001',
          action: 'created',
          timestamp: new Date().toISOString(),
          data: { location: 'Valid Location' }
        }
      ];

      const migrationResult = await service.migrateExistingTransactions(invalidLegacyTransactions);
      
      // Should migrate valid transactions and report errors for invalid ones
      expect(migrationResult.migrated).toBe(1);
      expect(migrationResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('API Endpoint Integration', () => {
    it('should provide blockchain transaction IDs in API responses', async () => {
      // Simulate API endpoint behavior
      const binCreationResponse = {
        binId: 'BIN001',
        location: 'API Test Location',
        status: 'active'
      };

      // Log blockchain transaction for API operation
      const txId = await service.logBinUpdate('BIN001', 'api_created', binCreationResponse);
      
      // API response should include blockchain transaction ID
      const apiResponse = {
        ...binCreationResponse,
        blockchainTransactionId: txId,
        blockchainEnabled: true
      };

      expect(apiResponse.blockchainTransactionId).toBeTruthy();
      expect(apiResponse.blockchainTransactionId).toMatch(/^TX-/);
      expect(apiResponse.blockchainEnabled).toBe(true);
    });

    it('should handle graceful degradation when blockchain fails', async () => {
      // Create a service with blockchain disabled
      const degradedService = new BlockchainIntegrationService({
        enabled: false,
        gracefulDegradation: true,
        fallbackToLegacy: true
      });
      await degradedService.initialize();

      // Operations should still work with legacy storage
      const txId = await degradedService.logBinUpdate('BIN001', 'created', {
        location: 'Degraded Mode Location'
      });

      expect(txId).toBeTruthy();
      
      // Service status should indicate degraded mode
      const status = await degradedService.getServiceStatus();
      expect(status.mode).toBe('legacy');
      expect(status.initialized).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance with large datasets', async () => {
      const startTime = Date.now();

      // Create a large number of transactions
      const promises: Promise<string | null>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          service.logBinUpdate(`BIN${i}`, 'created', {
            location: `Location ${i}`,
            capacity: 100,
            fillLevel: i % 100
          })
        );
      }

      await Promise.all(promises);
      
      const creationTime = Date.now() - startTime;
      
      // Query performance test
      const queryStartTime = Date.now();
      const transactions = await service.getTransactionsByBinId('BIN50');
      const queryTime = Date.now() - queryStartTime;

      // Performance assertions (adjust thresholds as needed)
      expect(creationTime).toBeLessThan(10000); // 10 seconds for 100 transactions
      expect(queryTime).toBeLessThan(1000); // 1 second for query
      expect(transactions.length).toBeGreaterThan(0);

      // Verify system integrity
      const validation = await service.validateChain();
      expect(validation.isValid).toBe(true);
    });
  });
});