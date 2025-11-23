import { NextResponse } from 'next/server';
import { blockchainConfig } from '@/lib/blockchain/config';
import { blockchainIntegration } from '@/lib/blockchain-integration';

/**
 * Blockchain Metrics and Monitoring Endpoint
 * Provides detailed performance metrics and monitoring data
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('range') || '1h'; // 1h, 24h, 7d, 30d
    const format = searchParams.get('format') || 'json'; // json, csv, prometheus
    const includeHistory = searchParams.get('history') === 'true';

    // Get current metrics
    const metrics = blockchainConfig.getMetrics();
    
    // Get blockchain statistics
    let blockchainStats;
    try {
      blockchainStats = await blockchainIntegration.getBlockchainStats();
    } catch {
      blockchainStats = { error: 'Failed to fetch blockchain stats' };
    }

    // Get service status
    const serviceStatus = blockchainIntegration.getServiceStatus();

    // Combine all metrics
    const combinedMetrics = {
      timestamp: new Date().toISOString(),
      timeRange,
      runtime: {
        startTime: metrics.startTime,
        uptime: metrics.uptime,
        uptimeFormatted: formatUptime(metrics.uptime)
      },
      blockchain: {
        totalTransactions: metrics.totalTransactions,
        totalBlocks: metrics.totalBlocks,
        averageBlockTime: metrics.averageBlockTime,
        averageTransactionTime: metrics.averageTransactionTime,
        lastBlockCreated: metrics.lastBlockCreated,
        lastTransactionProcessed: metrics.lastTransactionProcessed,
        chainHeight: blockchainStats.chainHeight || 0,
        mode: serviceStatus.mode
      },
      performance: {
        transactionsPerSecond: calculateTPS(metrics as unknown as Record<string, unknown>),
        blocksPerHour: calculateBPH(metrics as unknown as Record<string, unknown>),
        averageBlockSize: (blockchainStats as any).averageBlockSize || 0,
        processingEfficiency: calculateEfficiency(metrics as unknown as Record<string, unknown>)
      },
      system: {
        memoryUsage: metrics.memoryUsage,
        diskUsage: metrics.diskUsage,
        errorCount: metrics.errorCount,
        warningCount: metrics.warningCount,
        errorRate: calculateErrorRate(metrics as unknown as Record<string, unknown>),
        healthStatus: blockchainConfig.getHealthStatus().status
      },
      service: {
        status: (serviceStatus as any).status || 'unknown',
        mode: serviceStatus.mode,
        initialized: serviceStatus.initialized,
        lastError: (serviceStatus as any).lastError || null
      }
    };

    // Add historical data if requested
    if (includeHistory) {
      (combinedMetrics as any).history = await getHistoricalMetrics(timeRange);
    }

    // Format response based on requested format
    switch (format) {
      case 'csv':
        const csvData = convertToCSV(combinedMetrics);
        return new Response(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="blockchain-metrics-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });

      case 'prometheus':
        const prometheusData = convertToPrometheus(combinedMetrics);
        return new Response(prometheusData, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4'
          }
        });

      default:
        return NextResponse.json(combinedMetrics);
    }

  } catch (error) {
    console.error('Error fetching blockchain metrics:', error);
    blockchainConfig.recordError(`Metrics fetch failed: ${(error as Error).message}`);
    
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Record custom metrics or events
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case 'record-transaction':
        const { transactionId } = data;
        blockchainConfig.recordTransaction(transactionId);
        return NextResponse.json({
          success: true,
          message: 'Transaction recorded in metrics'
        });

      case 'record-block':
        const { blockHeight, processingTime } = data;
        blockchainConfig.recordBlock(blockHeight, processingTime);
        return NextResponse.json({
          success: true,
          message: 'Block recorded in metrics'
        });

      case 'record-error':
        const { error } = data;
        blockchainConfig.recordError(error);
        return NextResponse.json({
          success: true,
          message: 'Error recorded in metrics'
        });

      case 'record-warning':
        const { warning } = data;
        blockchainConfig.recordWarning(warning);
        return NextResponse.json({
          success: true,
          message: 'Warning recorded in metrics'
        });

      case 'reset-metrics':
        // This would reset metrics counters
        return NextResponse.json({
          success: true,
          message: 'Metrics reset (not implemented in this version)'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error recording metrics:', error);
    return NextResponse.json({
      error: 'Failed to record metrics',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Helper functions for metrics calculations
 */

function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function calculateTPS(metrics: Record<string, unknown>): number {
  const uptime = typeof metrics.uptime === 'number' ? metrics.uptime : 0;
  const totalTransactions = typeof metrics.totalTransactions === 'number' ? metrics.totalTransactions : 0;
  if (uptime === 0) return 0;
  const uptimeSeconds = uptime / 1000;
  return totalTransactions / uptimeSeconds;
}

function calculateBPH(metrics: Record<string, unknown>): number {
  const uptime = typeof metrics.uptime === 'number' ? metrics.uptime : 0;
  const totalBlocks = typeof metrics.totalBlocks === 'number' ? metrics.totalBlocks : 0;
  if (uptime === 0) return 0;
  const uptimeHours = uptime / (1000 * 60 * 60);
  return totalBlocks / uptimeHours;
}

function calculateEfficiency(metrics: Record<string, unknown>): number {
  const totalTransactions = typeof metrics.totalTransactions === 'number' ? metrics.totalTransactions : 0;
  const errorCount = typeof metrics.errorCount === 'number' ? metrics.errorCount : 0;
  if (totalTransactions === 0) return 100;
  const errorRate = (errorCount / totalTransactions) * 100;
  return Math.max(0, 100 - errorRate);
}

function calculateErrorRate(metrics: Record<string, unknown>): number {
  const totalTransactions = typeof metrics.totalTransactions === 'number' ? metrics.totalTransactions : 0;
  const errorCount = typeof metrics.errorCount === 'number' ? metrics.errorCount : 0;
  if (totalTransactions === 0) return 0;
  return (errorCount / totalTransactions) * 100;
}

async function getHistoricalMetrics(timeRange: string): Promise<Record<string, unknown>> {
  // This would implement historical metrics retrieval
  // For now, return placeholder data
  return {
    timeRange,
    dataPoints: [],
    note: 'Historical metrics not implemented in this version'
  };
}

function convertToCSV(metrics: Record<string, unknown>): string {
  const headers = [
    'timestamp',
    'uptime',
    'totalTransactions',
    'totalBlocks',
    'averageBlockTime',
    'memoryUsagePercent',
    'errorCount',
    'warningCount',
    'healthStatus'
  ];

  const m = metrics as any;
  const values = [
    m.timestamp || '',
    m.runtime?.uptime || 0,
    m.blockchain?.totalTransactions || 0,
    m.blockchain?.totalBlocks || 0,
    m.blockchain?.averageBlockTime || 0,
    m.system?.memoryUsage?.percentage || 0,
    m.system?.errorCount || 0,
    m.system?.warningCount || 0,
    m.system?.healthStatus || 'unknown'
  ];

  return headers.join(',') + '\n' + values.join(',');
}

function convertToPrometheus(metrics: Record<string, unknown>): string {
  const m = metrics as any;
  const lines = [
    `# HELP blockchain_uptime_seconds Total uptime in seconds`,
    `# TYPE blockchain_uptime_seconds counter`,
    `blockchain_uptime_seconds ${(m.runtime?.uptime || 0) / 1000}`,
    '',
    `# HELP blockchain_transactions_total Total number of transactions processed`,
    `# TYPE blockchain_transactions_total counter`,
    `blockchain_transactions_total ${m.blockchain?.totalTransactions || 0}`,
    '',
    `# HELP blockchain_blocks_total Total number of blocks created`,
    `# TYPE blockchain_blocks_total counter`,
    `blockchain_blocks_total ${m.blockchain?.totalBlocks || 0}`,
    '',
    `# HELP blockchain_memory_usage_percent Memory usage percentage`,
    `# TYPE blockchain_memory_usage_percent gauge`,
    `blockchain_memory_usage_percent ${m.system?.memoryUsage?.percentage || 0}`,
    '',
    `# HELP blockchain_errors_total Total number of errors`,
    `# TYPE blockchain_errors_total counter`,
    `blockchain_errors_total ${m.system?.errorCount || 0}`,
    '',
    `# HELP blockchain_warnings_total Total number of warnings`,
    `# TYPE blockchain_warnings_total counter`,
    `blockchain_warnings_total ${m.system?.warningCount || 0}`,
    ''
  ];

  return lines.join('\n');
}