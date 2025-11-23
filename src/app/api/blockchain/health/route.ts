import { NextResponse } from 'next/server';
import { blockchainConfig } from '@/lib/blockchain/config';
import { blockchainIntegration } from '@/lib/blockchain-integration';

/**
 * Blockchain Health Monitoring Endpoint
 * Provides comprehensive health status and monitoring data
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const detailed = searchParams.get('detailed') === 'true';
    const includeMetrics = searchParams.get('metrics') === 'true';

    // Perform health check
    const healthStatus = await blockchainConfig.performHealthCheck();
    
    const response: Record<string, unknown> = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      checks: healthStatus.checks,
      lastChecked: healthStatus.lastChecked
    };

    if (detailed) {
      response.issues = healthStatus.issues;
      response.recommendations = healthStatus.recommendations;
      
      // Add service status
      response.serviceStatus = blockchainIntegration.getServiceStatus();
      
      // Add blockchain statistics
      try {
        response.blockchainStats = await blockchainIntegration.getBlockchainStats();
      } catch {
        response.blockchainStats = { error: 'Failed to fetch blockchain stats' };
      }
    }

    if (includeMetrics) {
      response.metrics = blockchainConfig.getMetrics();
    }

    // Set appropriate HTTP status based on health
    let httpStatus = 200;
    if (healthStatus.status === 'warning') {
      httpStatus = 200; // Still OK, but with warnings
    } else if (healthStatus.status === 'critical') {
      httpStatus = 503; // Service unavailable
    } else if (healthStatus.status === 'unknown') {
      httpStatus = 500; // Internal server error
    }

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    console.error('Health check failed:', error);
    blockchainConfig.recordError(`Health check failed: ${(error as Error).message}`);
    
    return NextResponse.json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Update health check configuration
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'force-check':
        const healthResult = await blockchainConfig.performHealthCheck();
        return NextResponse.json({
          success: true,
          message: 'Health check completed',
          result: healthResult
        });

      case 'update-interval':
        const { interval } = body;
        if (!interval || interval < 10000) { // Minimum 10 seconds
          return NextResponse.json({ 
            error: 'Invalid interval. Minimum is 10000ms (10 seconds)' 
          }, { status: 400 });
        }
        
        blockchainConfig.updateConfig({ healthCheckInterval: interval });
        return NextResponse.json({
          success: true,
          message: 'Health check interval updated',
          newInterval: interval
        });

      case 'toggle-monitoring':
        const { enabled } = body;
        blockchainConfig.updateConfig({ enableMetrics: enabled });
        return NextResponse.json({
          success: true,
          message: `Health monitoring ${enabled ? 'enabled' : 'disabled'}`,
          enabled
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Health configuration update failed:', error);
    return NextResponse.json({
      error: 'Health configuration update failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}