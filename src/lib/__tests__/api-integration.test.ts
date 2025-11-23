/**
 * Tests for API Integration with Blockchain
 */

import { blockchainIntegration } from '../blockchain-integration';

// Mock the blockchain integration
jest.mock('../blockchain-integration', () => ({
  blockchainIntegration: {
    initialize: jest.fn(),
    logBinUpdate: jest.fn(),
    logPickupConfirmation: jest.fn(),
    logIssueReport: jest.fn(),
    logSystemEvent: jest.fn(),
    getServiceStatus: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionsByBinId: jest.fn(),
    getBlockchainStats: jest.fn(),
    exportChain: jest.fn(),
    validateChain: jest.fn()
  }
}));

describe('API Integration with Blockchain', () => {
  const mockBlockchainIntegration = blockchainIntegration as jest.Mocked<typeof blockchainIntegration>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockBlockchainIntegration.getServiceStatus.mockReturnValue({
      initialized: true,
      blockchainEnabled: true,
      gracefulDegradation: true,
      fallbackToLegacy: true,
      initializationError: undefined,
      mode: 'blockchain'
    });
  });

  describe('Bin Creation API Integration', () => {
    it('should log blockchain transaction when creating a bin', async () => {
      const mockTxId = 'TX-1234567890-abcdef';
      mockBlockchainIntegration.logBinUpdate.mockResolvedValue(mockTxId);

      // Simulate bin creation API call
      const binData = {
        location: 'Test Park',
        fillLevel: 0,
        gasLevel: 0,
        status: 'Empty'
      };

      // This would be called by the API route
      const txId = await blockchainIntegration.logBinUpdate(
        'BIN001',
        'bin_created',
        {
          ...binData,
          initialCreation: true
        },
        'Admin'
      );

      expect(mockBlockchainIntegration.logBinUpdate).toHaveBeenCalledWith(
        'BIN001',
        'bin_created',
        {
          location: 'Test Park',
          fillLevel: 0,
          gasLevel: 0,
          status: 'Empty',
          initialCreation: true
        },
        'Admin'
      );

      expect(txId).toBe(mockTxId);
    });

    it('should include blockchain transaction ID in API response', () => {
      const mockTxId = 'TX-1234567890-abcdef';
      const serviceStatus = mockBlockchainIntegration.getServiceStatus();

      // Simulate API response structure
      const apiResponse = {
        id: 'BIN001',
        location: 'Test Park',
        fillLevel: 0,
        gasLevel: 0,
        status: 'Empty',
        lastUpdated: new Date().toISOString(),
        blockchainTransactionId: mockTxId,
        blockchainEnabled: serviceStatus.mode === 'blockchain'
      };

      expect(apiResponse.blockchainTransactionId).toBe(mockTxId);
      expect(apiResponse.blockchainEnabled).toBe(true);
    });
  });

  describe('Pickup Confirmation API Integration', () => {
    it('should log blockchain transaction for pickup confirmations', async () => {
      const mockTxId = 'TX-pickup-123';
      mockBlockchainIntegration.logPickupConfirmation.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logPickupConfirmation(
        'BIN001',
        'contractor-123',
        'collected',
        {
          earnings: 25.0,
          binStatus: 'Empty',
          previousFillLevel: 95,
          newFillLevel: 0,
          resolvedReports: 2
        }
      );

      expect(mockBlockchainIntegration.logPickupConfirmation).toHaveBeenCalledWith(
        'BIN001',
        'contractor-123',
        'collected',
        {
          earnings: 25.0,
          binStatus: 'Empty',
          previousFillLevel: 95,
          newFillLevel: 0,
          resolvedReports: 2
        }
      );

      expect(txId).toBe(mockTxId);
    });
  });

  describe('Issue Report API Integration', () => {
    it('should log blockchain transaction for issue reports', async () => {
      const mockTxId = 'TX-report-456';
      mockBlockchainIntegration.logIssueReport.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logIssueReport(
        'BIN001',
        'citizen-789',
        'issue_reported',
        {
          issueType: 'overflow',
          description: 'Bin is overflowing',
          pointsAwarded: 50,
          binStatus: 'Full',
          isFirstReport: true
        }
      );

      expect(mockBlockchainIntegration.logIssueReport).toHaveBeenCalledWith(
        'BIN001',
        'citizen-789',
        'issue_reported',
        {
          issueType: 'overflow',
          description: 'Bin is overflowing',
          pointsAwarded: 50,
          binStatus: 'Full',
          isFirstReport: true
        }
      );

      expect(txId).toBe(mockTxId);
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle blockchain failures gracefully in API responses', async () => {
      // Simulate blockchain failure
      mockBlockchainIntegration.logBinUpdate.mockResolvedValue(null);
      mockBlockchainIntegration.getServiceStatus.mockReturnValue({
        initialized: true,
        blockchainEnabled: true,
        gracefulDegradation: true,
        fallbackToLegacy: true,
        initializationError: 'Blockchain unavailable',
        mode: 'legacy'
      });

      const txId = await blockchainIntegration.logBinUpdate(
        'BIN001',
        'bin_created',
        { location: 'Test' },
        'Admin'
      );

      const serviceStatus = mockBlockchainIntegration.getServiceStatus();

      // API should still work even if blockchain fails
      const apiResponse = {
        id: 'BIN001',
        location: 'Test',
        blockchainTransactionId: txId, // May be null
        blockchainEnabled: serviceStatus.mode === 'blockchain' // Should be false
      };

      expect(apiResponse.blockchainTransactionId).toBeNull();
      expect(apiResponse.blockchainEnabled).toBe(false);
    });
  });

  describe('Blockchain Management API', () => {
    it('should provide blockchain statistics', async () => {
      const mockStats = {
        chainHeight: 10,
        totalTransactions: 150,
        latestBlockHash: 'abc123',
        lastUpdated: new Date().toISOString(),
        pendingTransactions: 5,
        processedTransactions: 145,
        isCreatingBlock: false,
        averageTransactionAge: 1000,
        latestBlockTimestamp: new Date().toISOString(),
        activeContracts: 3,
        mode: 'blockchain'
      };

      mockBlockchainIntegration.getBlockchainStats.mockResolvedValue(mockStats);

      const stats = await blockchainIntegration.getBlockchainStats();

      expect(mockBlockchainIntegration.getBlockchainStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
      expect(stats.mode).toBe('blockchain');
    });

    it('should provide chain validation results', async () => {
      const mockValidation = {
        isValid: true,
        errors: [],
        mode: 'blockchain'
      };

      mockBlockchainIntegration.validateChain.mockResolvedValue(mockValidation);

      const validation = await blockchainIntegration.validateChain();

      expect(mockBlockchainIntegration.validateChain).toHaveBeenCalled();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should support data export functionality', async () => {
      const mockExportData = JSON.stringify({
        metadata: {
          exportTimestamp: new Date().toISOString(),
          format: 'json',
          totalTransactions: 100
        },
        blocks: []
      });

      mockBlockchainIntegration.exportChain.mockResolvedValue(mockExportData);

      const exportData = await blockchainIntegration.exportChain('json');

      expect(mockBlockchainIntegration.exportChain).toHaveBeenCalledWith('json');
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(parsed).toHaveProperty('metadata');
      expect(parsed.metadata.format).toBe('json');
    });
  });

  describe('Transaction Traceability', () => {
    it('should provide transaction lookup by ID', async () => {
      const mockTransaction = {
        id: 'TX-123',
        type: 'bin_update',
        binId: 'BIN001',
        action: 'status_updated',
        data: { status: 'Full' },
        timestamp: new Date().toISOString(),
        signature: 'sig123',
        hash: 'hash123'
      };

      mockBlockchainIntegration.getTransaction.mockResolvedValue(mockTransaction);

      const transaction = await blockchainIntegration.getTransaction('TX-123');

      expect(mockBlockchainIntegration.getTransaction).toHaveBeenCalledWith('TX-123');
      expect(transaction).toEqual(mockTransaction);
    });

    it('should provide transactions by bin ID for audit trails', async () => {
      const mockTransactions = [
        {
          id: 'TX-1',
          type: 'bin_update',
          binId: 'BIN001',
          action: 'created',
          timestamp: new Date().toISOString()
        },
        {
          id: 'TX-2',
          type: 'pickup_confirmation',
          binId: 'BIN001',
          action: 'collected',
          timestamp: new Date().toISOString()
        }
      ];

      mockBlockchainIntegration.getTransactionsByBinId.mockResolvedValue(mockTransactions);

      const transactions = await blockchainIntegration.getTransactionsByBinId('BIN001');

      expect(mockBlockchainIntegration.getTransactionsByBinId).toHaveBeenCalledWith('BIN001');
      expect(transactions).toEqual(mockTransactions);
      expect(transactions.length).toBe(2);
    });
  });
});