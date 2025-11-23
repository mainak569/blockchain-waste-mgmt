/**
 * Citizen API Integration Tests
 * Tests the integration between citizen APIs and blockchain
 */

import { blockchainIntegration } from '../blockchain-integration';

// Mock the blockchain integration for testing
jest.mock('../blockchain-integration', () => ({
  blockchainIntegration: {
    initialize: jest.fn(),
    logIssueReport: jest.fn(),
    logSystemEvent: jest.fn(),
    getServiceStatus: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionsByCitizenId: jest.fn(),
    getBlockchainStats: jest.fn(),
    exportChain: jest.fn(),
    validateChain: jest.fn()
  }
}));

const mockBlockchainIntegration = blockchainIntegration as jest.Mocked<typeof blockchainIntegration>;

describe('Citizen API Integration with Blockchain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBlockchainIntegration.getServiceStatus.mockReturnValue({
      initialized: true,
      blockchainEnabled: true,
      gracefulDegradation: true,
      fallbackToLegacy: false,
      mode: 'blockchain'
    });
  });

  describe('Issue Report API Integration', () => {
    it('should log blockchain transaction for citizen issue reports', async () => {
      const mockTxId = 'TX-citizen-report-123';
      mockBlockchainIntegration.logIssueReport.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logIssueReport(
        'BIN001',
        'citizen-456',
        'issue_reported',
        {
          issueType: 'Hazard',
          description: 'Bin overflowing',
          pointsAwarded: 50,
          binStatus: 'Full',
          isFirstReport: true,
          reportType: 'Hazard'
        }
      );

      expect(mockBlockchainIntegration.logIssueReport).toHaveBeenCalledWith(
        'BIN001',
        'citizen-456',
        'issue_reported',
        expect.objectContaining({
          issueType: 'Hazard',
          pointsAwarded: 50,
          reportType: 'Hazard'
        })
      );
      expect(txId).toBe(mockTxId);
    });

    it('should handle duplicate reports with blockchain logging', async () => {
      const mockTxId = 'TX-citizen-duplicate-123';
      mockBlockchainIntegration.logIssueReport.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logIssueReport(
        'BIN001',
        'citizen-456',
        'duplicate_report',
        {
          issueType: 'Hazard',
          description: 'Bin overflowing',
          pointsAwarded: 0,
          binStatus: 'Full',
          isFirstReport: false,
          duplicateOf: 'report-123',
          reportType: 'Hazard'
        }
      );

      expect(mockBlockchainIntegration.logIssueReport).toHaveBeenCalledWith(
        'BIN001',
        'citizen-456',
        'duplicate_report',
        expect.objectContaining({
          pointsAwarded: 0,
          isFirstReport: false,
          duplicateOf: 'report-123'
        })
      );
      expect(txId).toBe(mockTxId);
    });
  });

  describe('Citizen Registration API Integration', () => {
    it('should log blockchain transaction for citizen registration', async () => {
      const mockTxId = 'TX-citizen-reg-123';
      mockBlockchainIntegration.logSystemEvent.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logSystemEvent(
        'citizen_registered',
        {
          citizenId: 'citizen-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        'System'
      );

      expect(mockBlockchainIntegration.logSystemEvent).toHaveBeenCalledWith(
        'citizen_registered',
        expect.objectContaining({
          citizenId: 'citizen-123',
          name: 'John Doe',
          email: 'john@example.com'
        }),
        'System'
      );
      expect(txId).toBe(mockTxId);
    });

    it('should log blockchain transaction for citizen updates', async () => {
      const mockTxId = 'TX-citizen-update-123';
      mockBlockchainIntegration.logSystemEvent.mockResolvedValue(mockTxId);

      const txId = await blockchainIntegration.logSystemEvent(
        'citizen_updated',
        {
          citizenId: 'citizen-123',
          updates: { points: 150 },
          previousData: { points: 100, reportsSubmitted: 2 }
        },
        'System'
      );

      expect(mockBlockchainIntegration.logSystemEvent).toHaveBeenCalledWith(
        'citizen_updated',
        expect.objectContaining({
          citizenId: 'citizen-123',
          updates: { points: 150 }
        }),
        'System'
      );
      expect(txId).toBe(mockTxId);
    });
  });

  describe('Citizen Transaction History', () => {
    it('should retrieve citizen transaction history', async () => {
      const mockTransactions = [
        {
          id: 'TX-1',
          type: 'issue_report',
          citizenId: 'citizen-123',
          binId: 'BIN001',
          action: 'issue_reported',
          data: { pointsAwarded: 50, issueType: 'Hazard' },
          timestamp: '2024-01-01T10:00:00Z',
          hash: 'hash1'
        },
        {
          id: 'TX-2',
          type: 'system_event',
          citizenId: 'citizen-123',
          action: 'citizen_registered',
          data: { name: 'John Doe' },
          timestamp: '2024-01-01T09:00:00Z',
          hash: 'hash2'
        }
      ];

      mockBlockchainIntegration.getTransactionsByCitizenId.mockResolvedValue(mockTransactions);

      const transactions = await blockchainIntegration.getTransactionsByCitizenId('citizen-123');

      expect(mockBlockchainIntegration.getTransactionsByCitizenId).toHaveBeenCalledWith('citizen-123');
      expect(transactions).toEqual(mockTransactions);
      expect(transactions.length).toBe(2);
      expect(transactions[0].citizenId).toBe('citizen-123');
      expect(transactions[1].citizenId).toBe('citizen-123');
    });

    it('should handle empty transaction history', async () => {
      mockBlockchainIntegration.getTransactionsByCitizenId.mockResolvedValue([]);

      const transactions = await blockchainIntegration.getTransactionsByCitizenId('citizen-new');

      expect(mockBlockchainIntegration.getTransactionsByCitizenId).toHaveBeenCalledWith('citizen-new');
      expect(transactions).toEqual([]);
    });
  });

  describe('Smart Contract Integration', () => {
    it('should include smart contract data in issue reports', async () => {
      const mockTxId = 'TX-smart-contract-123';
      mockBlockchainIntegration.logIssueReport.mockResolvedValue(mockTxId);

      // Simulate smart contract execution for points awarding
      const txId = await blockchainIntegration.logIssueReport(
        'BIN001',
        'citizen-456',
        'issue_reported',
        {
          issueType: 'Hazard',
          description: 'Bin overflowing',
          pointsAwarded: 50,
          binStatus: 'Full',
          isFirstReport: true,
          reportType: 'Hazard', // This triggers smart contract
          smartContractExecution: {
            contractType: 'points_awarding',
            executed: true,
            pointsAwarded: 50
          }
        }
      );

      expect(mockBlockchainIntegration.logIssueReport).toHaveBeenCalledWith(
        'BIN001',
        'citizen-456',
        'issue_reported',
        expect.objectContaining({
          reportType: 'Hazard',
          smartContractExecution: expect.objectContaining({
            contractType: 'points_awarding',
            executed: true,
            pointsAwarded: 50
          })
        })
      );
      expect(txId).toBe(mockTxId);
    });
  });

  describe('Blockchain Verification', () => {
    it('should provide blockchain verification status in citizen data', async () => {
      const mockTransaction = {
        id: 'TX-123',
        type: 'issue_report',
        citizenId: 'citizen-123',
        action: 'issue_reported',
        timestamp: '2024-01-01T10:00:00Z',
        hash: 'hash123',
        _proof: {
          blockHash: 'block-hash-123',
          blockHeight: 5,
          verified: true
        }
      };

      mockBlockchainIntegration.getTransaction.mockResolvedValue(mockTransaction);

      const transaction = await blockchainIntegration.getTransaction('TX-123');

      expect(mockBlockchainIntegration.getTransaction).toHaveBeenCalledWith('TX-123');
      expect(transaction).toEqual(mockTransaction);
      expect((transaction as any)?._proof?.verified).toBe(true);
    });
  });
});