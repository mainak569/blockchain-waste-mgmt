/**
 * Tests for blockchain analytics and reporting functionality
 */

import { BlockchainReporter } from '../blockchain-reporting';
import { BlockchainManager } from '../blockchain/manager';
import { BlockchainIntegrationService } from '../blockchain-integration';
import fs from 'fs/promises';
import path from 'path';

describe('Blockchain Analytics and Reporting', () => {
  let reporter: BlockchainReporter;
  let blockchainManager: BlockchainManager;
  let integrationService: BlockchainIntegrationService;
  let testDataDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDataDir = path.join('test-data', `analytics-test-${Date.now()}-${Math.random()}`);
    
    // Create a single blockchain manager instance to be shared
    blockchainManager = new BlockchainManager(testDataDir);
    await blockchainManager.initialize();
    
    // Create integration service that uses the same blockchain manager
    integrationService = new BlockchainIntegrationService({ 
      enabled: true, 
      gracefulDegradation: true,
      fallbackToLegacy: true,
      dataDir: testDataDir
    });
    
    // Replace the integration service's blockchain manager with our shared instance
    (integrationService as any).blockchainManager = blockchainManager;
    (integrationService as any).isInitialized = true;
    
    reporter = new BlockchainReporter(blockchainManager);
    await reporter.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Analytics Report Generation', () => {
    it('should generate basic analytics report', async () => {
      // Add some test transactions using the integration service
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 75 });
      await integrationService.logPickupConfirmation('bin-1', 'contractor-1', 'Collected', { weight: 50 });

      // Create a block
      await blockchainManager.createBlock();

      // Generate analytics report
      const report = await reporter.generateAnalyticsReport();

      expect(report).toBeDefined();
      expect(report.metadata.reportType).toBe('analytics');
      expect(report.summary.totalTransactions).toBeGreaterThan(0);
      expect(report.analytics.transactionsByType).toBeDefined();
      expect(report.analytics.transactionsByAction).toBeDefined();
    });

    it('should generate filtered analytics report', async () => {
      // Add test transactions
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 75 });
      await integrationService.logBinUpdate('bin-2', 'Updated', { fillLevel: 50 });
      await blockchainManager.createBlock();

      // Generate filtered report for specific bin
      const report = await reporter.generateAnalyticsReport({
        binId: 'bin-1'
      });

      expect(report.summary.totalTransactions).toBe(1);
      expect(report.transactions?.[0].binId).toBe('bin-1');
    });

    it('should generate audit report with verification', async () => {
      // Add test transaction
      await integrationService.logIssueReport('bin-1', 'citizen-1', 'Reported', { issue: 'Overflow' });
      await blockchainManager.createBlock();

      // Generate audit report
      const report = await reporter.generateAuditReport();

      expect(report.metadata.reportType).toBe('audit');
      expect(report.verification).toBeDefined();
      expect(report.verification?.totalTransactions).toBeGreaterThan(0);
    });

    it('should generate performance report', async () => {
      // Add multiple transactions
      for (let i = 0; i < 5; i++) {
        await integrationService.logBinUpdate(`bin-${i}`, 'Updated', { fillLevel: i * 20 });
      }

      await blockchainManager.createBlock();

      // Generate performance report
      const report = await reporter.generatePerformanceReport();

      expect(report.metadata.reportType).toBe('performance');
      expect(report.analytics.performanceMetrics).toBeDefined();
      expect(report.analytics.performanceMetrics.transactionThroughput).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-time Metrics', () => {
    it('should get real-time blockchain metrics', async () => {
      // Add test data
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 80 });
      await blockchainManager.createBlock();

      // Get real-time metrics
      const metrics = await reporter.getRealTimeMetrics();

      expect(metrics.chainStats).toBeDefined();
      expect(metrics.recentActivity).toBeDefined();
      expect(metrics.healthMetrics).toBeDefined();
      expect(metrics.recentActivity.recentTransactions).toBeInstanceOf(Array);
    });
  });

  describe('Export Functionality', () => {
    it('should export report as JSON', async () => {
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 60 });
      await blockchainManager.createBlock();

      const report = await reporter.generateAnalyticsReport();
      const jsonExport = await reporter.exportReport(report, 'json');

      expect(jsonExport).toBeDefined();
      expect(() => JSON.parse(jsonExport)).not.toThrow();
      
      const parsedReport = JSON.parse(jsonExport);
      expect(parsedReport.metadata.reportType).toBe('analytics');
    });

    it('should export report as CSV', async () => {
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 60 });
      await blockchainManager.createBlock();

      const report = await reporter.generateAnalyticsReport();
      const csvExport = await reporter.exportReport(report, 'csv');

      expect(csvExport).toBeDefined();
      expect(csvExport).toContain('# Blockchain Report');
      expect(csvExport).toContain('Section,Metric,Value');
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter transactions by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Add transaction
      await integrationService.logBinUpdate('bin-1', 'Updated', { fillLevel: 70 });
      await blockchainManager.createBlock();

      // Test date range filtering
      const report = await reporter.generateAnalyticsReport({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(report.summary.totalTransactions).toBeGreaterThan(0);

      // Test excluding date range
      const futureReport = await reporter.generateAnalyticsReport({
        startDate: tomorrow,
        endDate: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
      });

      expect(futureReport.summary.totalTransactions).toBe(0);
    });
  });

  describe('Entity-specific Analytics', () => {
    it('should generate analytics for specific contractor', async () => {
      // Create a fresh blockchain manager for this test to avoid state leakage
      const freshTestDir = path.join('test-data', `contractor-test-${Date.now()}-${Math.random()}`);
      const freshBlockchainManager = new BlockchainManager(freshTestDir);
      await freshBlockchainManager.initialize();
      
      const freshIntegrationService = new BlockchainIntegrationService({ 
        enabled: true, 
        gracefulDegradation: true,
        fallbackToLegacy: true,
        dataDir: freshTestDir
      });
      (freshIntegrationService as any).blockchainManager = freshBlockchainManager;
      (freshIntegrationService as any).isInitialized = true;
      
      const freshReporter = new BlockchainReporter(freshBlockchainManager);
      await freshReporter.initialize();

      await freshIntegrationService.logPickupConfirmation('bin-1', 'contractor-1', 'Collected', { weight: 45 });
      await freshBlockchainManager.createBlock();

      const report = await freshReporter.generateAnalyticsReport({
        contractorId: 'contractor-1'
      });

      expect(report.summary.totalTransactions).toBe(1);
      expect(report.transactions?.[0].contractorId).toBe('contractor-1');
      
      // Cleanup
      try {
        await fs.rm(freshTestDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should generate analytics for specific citizen', async () => {
      // Create a fresh blockchain manager for this test to avoid state leakage
      const freshTestDir = path.join('test-data', `citizen-test-${Date.now()}-${Math.random()}`);
      const freshBlockchainManager = new BlockchainManager(freshTestDir);
      await freshBlockchainManager.initialize();
      
      const freshIntegrationService = new BlockchainIntegrationService({ 
        enabled: true, 
        gracefulDegradation: true,
        fallbackToLegacy: true,
        dataDir: freshTestDir
      });
      (freshIntegrationService as any).blockchainManager = freshBlockchainManager;
      (freshIntegrationService as any).isInitialized = true;
      
      const freshReporter = new BlockchainReporter(freshBlockchainManager);
      await freshReporter.initialize();

      await freshIntegrationService.logIssueReport('bin-1', 'citizen-1', 'Reported', { issue: 'Damage' });
      await freshBlockchainManager.createBlock();

      const report = await freshReporter.generateAnalyticsReport({
        citizenId: 'citizen-1'
      });

      expect(report.summary.totalTransactions).toBe(1);
      expect(report.transactions?.[0].citizenId).toBe('citizen-1');
      
      // Cleanup
      try {
        await fs.rm(freshTestDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });
});