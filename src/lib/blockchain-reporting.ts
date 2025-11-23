/**
 * Blockchain Reporting Utilities
 * Provides comprehensive analytics and reporting functionality for blockchain data
 */

import { BlockchainManager } from './blockchain/manager';
import { Transaction, Block } from './blockchain/types';

export interface ReportOptions {
  startDate?: Date;
  endDate?: Date;
  binId?: string;
  contractorId?: string;
  citizenId?: string;
  includeProofs?: boolean;
  format?: 'json' | 'csv';
}

export interface AnalyticsMetrics {
  totalTransactions: number;
  transactionsByType: Record<string, number>;
  transactionsByAction: Record<string, number>;
  timeDistribution: {
    byHour: Record<number, number>;
    byDay: Record<string, number>;
    byWeek: Record<string, number>;
  };
  entityMetrics: {
    activeBins: number;
    activeContractors: number;
    activeCitizens: number;
  };
  performanceMetrics: {
    averageTransactionAge: number;
    transactionThroughput: number;
    blockCreationRate: number;
  };
}

export interface BlockchainReport {
  metadata: {
    reportId: string;
    generatedAt: string;
    reportType: string;
    scope: ReportOptions;
  };
  summary: {
    totalBlocks: number;
    totalTransactions: number;
    chainHeight: number;
    chainValid: boolean;
  };
  analytics: AnalyticsMetrics;
  blocks: BlockSummary[];
  transactions?: TransactionSummary[];
  verification?: VerificationSummary;
}

export interface BlockSummary {
  height: number;
  hash: string;
  timestamp: string;
  transactionCount: number;
  size: number;
  age: number;
}

export interface TransactionSummary {
  id: string;
  type: string;
  action: string;
  timestamp: string;
  blockHeight?: number;
  binId?: string;
  contractorId?: string;
  citizenId?: string;
  verified?: boolean;
  age: number;
}

export interface VerificationSummary {
  totalTransactions: number;
  verifiedTransactions: number;
  verificationRate: number;
  unverifiedTransactions: TransactionSummary[];
}

export class BlockchainReporter {
  private blockchainManager: BlockchainManager;

  constructor(blockchainManager?: BlockchainManager) {
    this.blockchainManager = blockchainManager || new BlockchainManager();
  }

  /**
   * Initialize the reporter
   */
  async initialize(): Promise<void> {
    await this.blockchainManager.initialize();
  }

  /**
   * Generate comprehensive blockchain analytics report
   */
  async generateAnalyticsReport(options: ReportOptions = {}): Promise<BlockchainReport> {
    await this.initialize();

    const reportId = `analytics-${Date.now()}`;
    const transactions = await this.getFilteredTransactions(options);
    const blocks = await this.getFilteredBlocks(options);
    
    const analytics = await this.calculateAnalytics(transactions, blocks);
    const verification = options.includeProofs ? 
      await this.performVerification(transactions) : undefined;

    return {
      metadata: {
        reportId,
        generatedAt: new Date().toISOString(),
        reportType: 'analytics',
        scope: options
      },
      summary: {
        totalBlocks: blocks.length,
        totalTransactions: transactions.length,
        chainHeight: (await this.blockchainManager.getBlockchainStats()).chainHeight,
        chainValid: (await this.blockchainManager.validateChain()).isValid
      },
      analytics,
      blocks: blocks.map(block => this.createBlockSummary(block)),
      transactions: transactions.map(tx => this.createTransactionSummary(tx)),
      verification
    };
  }

  /**
   * Generate audit report with verification
   */
  async generateAuditReport(options: ReportOptions = {}): Promise<BlockchainReport> {
    const auditOptions = { ...options, includeProofs: true };
    const report = await this.generateAnalyticsReport(auditOptions);
    
    return {
      ...report,
      metadata: {
        ...report.metadata,
        reportType: 'audit'
      }
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(options: ReportOptions = {}): Promise<BlockchainReport> {
    const report = await this.generateAnalyticsReport(options);
    
    // Enhanced performance metrics
    const enhancedAnalytics = {
      ...report.analytics,
      performanceMetrics: {
        ...report.analytics.performanceMetrics,
        blockSizeDistribution: this.calculateBlockSizeDistribution(report.blocks),
        transactionLatency: this.calculateTransactionLatency(report.transactions || []),
        systemEfficiency: this.calculateSystemEfficiency(report.blocks, report.transactions || [])
      }
    };

    return {
      ...report,
      metadata: {
        ...report.metadata,
        reportType: 'performance'
      },
      analytics: enhancedAnalytics
    };
  }

  /**
   * Export report in specified format
   */
  async exportReport(report: BlockchainReport, format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else {
      return this.convertToCSV(report);
    }
  }

  /**
   * Get real-time blockchain metrics
   */
  async getRealTimeMetrics(): Promise<{
    chainStats: any;
    recentActivity: {
      lastBlock: BlockSummary | null;
      recentTransactions: TransactionSummary[];
      pendingTransactions: number;
    };
    healthMetrics: {
      chainValid: boolean;
      averageBlockTime: number;
      transactionBacklog: number;
    };
  }> {
    await this.initialize();

    const stats = await this.blockchainManager.getBlockchainStats();
    const latestBlock = await this.blockchainManager.getLatestBlock();
    const chainValidation = await this.blockchainManager.validateChain();

    // Get recent transactions from latest blocks
    const recentTransactions: TransactionSummary[] = [];
    const recentBlockCount = Math.min(5, stats.chainHeight + 1);
    
    for (let i = 0; i < recentBlockCount; i++) {
      const height = stats.chainHeight - i;
      if (height >= 0) {
        const block = await this.blockchainManager.getBlockByHeight(height);
        if (block) {
          block.body.transactions.forEach(tx => {
            recentTransactions.push(this.createTransactionSummary(tx));
          });
        }
      }
    }

    // Sort by timestamp and take most recent
    recentTransactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      chainStats: stats,
      recentActivity: {
        lastBlock: latestBlock ? this.createBlockSummary(latestBlock) : null,
        recentTransactions: recentTransactions.slice(0, 10),
        pendingTransactions: stats.pendingTransactions
      },
      healthMetrics: {
        chainValid: chainValidation.isValid,
        averageBlockTime: stats.averageTransactionAge || 0,
        transactionBacklog: stats.pendingTransactions
      }
    };
  }

  /**
   * Get filtered transactions based on options
   */
  private async getFilteredTransactions(options: ReportOptions): Promise<Transaction[]> {
    let transactions: Transaction[] = [];

    if (options.binId) {
      transactions = await this.blockchainManager.getTransactionsByBinId(options.binId);
    } else if (options.contractorId) {
      transactions = await this.blockchainManager.getTransactionsByContractorId(options.contractorId);
    } else if (options.citizenId) {
      transactions = await this.blockchainManager.getTransactionsByCitizenId(options.citizenId);
    } else if (options.startDate && options.endDate) {
      transactions = await this.blockchainManager.getTransactionsByDateRange(
        options.startDate, 
        options.endDate
      );
    } else {
      // Get all transactions including pending ones
      transactions = await this.blockchainManager.getAllTransactions();
    }

    // Apply date filter if not already applied
    if (options.startDate && options.endDate && !options.binId && !options.contractorId && !options.citizenId) {
      transactions = transactions.filter(tx => {
        const txDate = new Date(tx.timestamp);
        return txDate >= options.startDate! && txDate <= options.endDate!;
      });
    }

    return transactions;
  }

  /**
   * Get filtered blocks based on options
   */
  private async getFilteredBlocks(options: ReportOptions): Promise<Block[]> {
    const stats = await this.blockchainManager.getBlockchainStats();
    const blocks: Block[] = [];

    for (let height = 0; height <= stats.chainHeight; height++) {
      const block = await this.blockchainManager.getBlockByHeight(height);
      if (block) {
        // Apply date filter
        if (options.startDate || options.endDate) {
          const blockDate = new Date(block.header.timestamp);
          if (options.startDate && blockDate < options.startDate) continue;
          if (options.endDate && blockDate > options.endDate) continue;
        }
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Calculate comprehensive analytics
   */
  private async calculateAnalytics(transactions: Transaction[], blocks: Block[]): Promise<AnalyticsMetrics> {
    const now = Date.now();

    // Transaction type distribution
    const transactionsByType = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Transaction action distribution
    const transactionsByAction = transactions.reduce((acc, tx) => {
      acc[tx.action] = (acc[tx.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Time distribution
    const byHour = transactions.reduce((acc, tx) => {
      const hour = new Date(tx.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byDay = transactions.reduce((acc, tx) => {
      const day = new Date(tx.timestamp).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byWeek = transactions.reduce((acc, tx) => {
      const date = new Date(tx.timestamp);
      const week = this.getWeekString(date);
      acc[week] = (acc[week] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Entity metrics
    const uniqueBins = new Set(transactions.filter(tx => tx.binId).map(tx => tx.binId));
    const uniqueContractors = new Set(transactions.filter(tx => tx.contractorId).map(tx => tx.contractorId));
    const uniqueCitizens = new Set(transactions.filter(tx => tx.citizenId).map(tx => tx.citizenId));

    // Performance metrics
    const averageTransactionAge = transactions.length > 0 
      ? transactions.reduce((sum, tx) => sum + (now - new Date(tx.timestamp).getTime()), 0) / transactions.length
      : 0;

    const timeSpan = blocks.length > 1 
      ? new Date(blocks[blocks.length - 1].header.timestamp).getTime() - 
        new Date(blocks[0].header.timestamp).getTime()
      : 0;

    const transactionThroughput = timeSpan > 0 ? (transactions.length / (timeSpan / 1000)) : 0;
    const blockCreationRate = timeSpan > 0 ? (blocks.length / (timeSpan / 1000)) : 0;

    return {
      totalTransactions: transactions.length,
      transactionsByType,
      transactionsByAction,
      timeDistribution: {
        byHour,
        byDay,
        byWeek
      },
      entityMetrics: {
        activeBins: uniqueBins.size,
        activeContractors: uniqueContractors.size,
        activeCitizens: uniqueCitizens.size
      },
      performanceMetrics: {
        averageTransactionAge: Math.round(averageTransactionAge / 1000), // Convert to seconds
        transactionThroughput: Math.round(transactionThroughput * 1000) / 1000,
        blockCreationRate: Math.round(blockCreationRate * 1000) / 1000
      }
    };
  }

  /**
   * Perform cryptographic verification
   */
  private async performVerification(transactions: Transaction[]): Promise<VerificationSummary> {
    const verificationResults = await Promise.all(
      transactions.map(async (tx) => {
        const proof = (tx as any)._proof;
        const blockHash = (tx as any)._blockHash;
        const blockHeight = (tx as any)._blockHeight;
        
        if (!proof || !blockHash || blockHeight === undefined) {
          return { transaction: tx, verified: false };
        }

        const isVerified = await this.blockchainManager.verifyTransactionProof(
          tx, proof, blockHash, blockHeight
        );
        
        return { transaction: tx, verified: isVerified };
      })
    );

    const verifiedCount = verificationResults.filter(r => r.verified).length;
    const unverifiedTransactions = verificationResults
      .filter(r => !r.verified)
      .map(r => this.createTransactionSummary(r.transaction));

    return {
      totalTransactions: transactions.length,
      verifiedTransactions: verifiedCount,
      verificationRate: transactions.length > 0 ? (verifiedCount / transactions.length) * 100 : 0,
      unverifiedTransactions
    };
  }

  /**
   * Create block summary
   */
  private createBlockSummary(block: Block): BlockSummary {
    return {
      height: block.header.height,
      hash: block.header.hash,
      timestamp: block.header.timestamp,
      transactionCount: block.body.transactionCount,
      size: JSON.stringify(block).length,
      age: Date.now() - new Date(block.header.timestamp).getTime()
    };
  }

  /**
   * Create transaction summary
   */
  private createTransactionSummary(tx: Transaction): TransactionSummary {
    return {
      id: tx.id,
      type: tx.type,
      action: tx.action,
      timestamp: tx.timestamp,
      blockHeight: (tx as any)._blockHeight,
      binId: tx.binId,
      contractorId: tx.contractorId,
      citizenId: tx.citizenId,
      verified: (tx as any)._proof ? true : undefined,
      age: Date.now() - new Date(tx.timestamp).getTime()
    };
  }

  /**
   * Calculate block size distribution
   */
  private calculateBlockSizeDistribution(blocks: BlockSummary[]) {
    return blocks.reduce((acc, block) => {
      const category = block.transactionCount === 0 ? 'empty' :
                      block.transactionCount <= 5 ? 'small' :
                      block.transactionCount <= 15 ? 'medium' : 'large';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate transaction latency metrics
   */
  private calculateTransactionLatency(transactions: TransactionSummary[]) {
    const latencies = transactions.map(tx => tx.age);
    return {
      average: latencies.length > 0 ? latencies.reduce((sum, age) => sum + age, 0) / latencies.length : 0,
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0
    };
  }

  /**
   * Calculate system efficiency metrics
   */
  private calculateSystemEfficiency(blocks: BlockSummary[], transactions: TransactionSummary[]) {
    const nonEmptyBlocks = blocks.filter(block => block.transactionCount > 0);
    const blockUtilization = blocks.length > 0 ? (nonEmptyBlocks.length / blocks.length) * 100 : 0;
    
    const averageBlockSize = blocks.length > 0 
      ? blocks.reduce((sum, block) => sum + block.transactionCount, 0) / blocks.length 
      : 0;

    return {
      blockUtilization: Math.round(blockUtilization * 100) / 100,
      averageBlockSize: Math.round(averageBlockSize * 100) / 100,
      transactionDensity: transactions.length / Math.max(blocks.length, 1)
    };
  }

  /**
   * Get week string for grouping
   */
  private getWeekString(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Convert report to CSV format
   */
  private convertToCSV(report: BlockchainReport): string {
    const lines = [];
    
    // Header
    lines.push('# Blockchain Report');
    lines.push(`# Report ID: ${report.metadata.reportId}`);
    lines.push(`# Generated: ${report.metadata.generatedAt}`);
    lines.push(`# Type: ${report.metadata.reportType}`);
    lines.push('');
    
    // Summary
    lines.push('Section,Metric,Value');
    lines.push(`Summary,Total Blocks,${report.summary.totalBlocks}`);
    lines.push(`Summary,Total Transactions,${report.summary.totalTransactions}`);
    lines.push(`Summary,Chain Height,${report.summary.chainHeight}`);
    lines.push(`Summary,Chain Valid,${report.summary.chainValid}`);
    lines.push('');
    
    // Analytics
    lines.push('Analytics,Transaction Types,');
    Object.entries(report.analytics.transactionsByType).forEach(([type, count]) => {
      lines.push(`Analytics,${type},${count}`);
    });
    lines.push('');
    
    // Blocks
    if (report.blocks.length > 0) {
      lines.push('Block Height,Hash,Timestamp,Transaction Count,Size,Age (ms)');
      report.blocks.forEach(block => {
        lines.push(`${block.height},"${block.hash}","${block.timestamp}",${block.transactionCount},${block.size},${block.age}`);
      });
    }
    
    return lines.join('\n');
  }
}