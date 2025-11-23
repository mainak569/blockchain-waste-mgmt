import { NextResponse } from 'next/server';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { migrationUtility } from '@/lib/migration-utility';
import { blockchainConfig } from '@/lib/blockchain/config';
import { blockchainInitializer } from '@/lib/blockchain/initialization';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const status = blockchainIntegration.getServiceStatus();
        return NextResponse.json(status);

      case 'stats':
        const stats = await blockchainIntegration.getBlockchainStats();
        return NextResponse.json(stats);

      case 'validate':
        const validation = await blockchainIntegration.validateChain();
        return NextResponse.json(validation);

      case 'migration-status':
        const migrationValidation = await migrationUtility.validateMigration();
        return NextResponse.json(migrationValidation);

      case 'health':
        const healthStatus = await blockchainConfig.performHealthCheck();
        return NextResponse.json(healthStatus);

      case 'metrics':
        const metrics = blockchainConfig.getMetrics();
        return NextResponse.json(metrics);

      case 'config':
        const config = blockchainConfig.getConfig();
        // Remove sensitive information before sending
        const safeConfig = {
          ...config,
          // Keep only non-sensitive configuration
          maxTransactionsPerBlock: config.maxTransactionsPerBlock,
          blockTimeTarget: config.blockTimeTarget,
          enableMetrics: config.enableMetrics,
          enableAutoBackup: config.enableAutoBackup,
          healthCheckInterval: config.healthCheckInterval,
          networkId: config.networkId
        };
        return NextResponse.json(safeConfig);

      case 'initialization-status':
        const initStatus = await blockchainInitializer.getStatus();
        return NextResponse.json(initStatus);

      case 'diagnostics':
        const diagnostics = blockchainConfig.exportDiagnostics();
        return NextResponse.json(diagnostics);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in blockchain management:', error);
    return NextResponse.json({ error: 'Management operation failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'initialize':
        const initResult = await blockchainInitializer.initialize(body.config);
        return NextResponse.json(initResult);

      case 'migrate':
        const migrationResult = await migrationUtility.migrateAllTransactions();
        return NextResponse.json(migrationResult);

      case 'migrate-transactions':
        const txMigrationResult = await blockchainInitializer.migrateTransactions(body.options);
        return NextResponse.json(txMigrationResult);

      case 'backup':
        const backupResult = await blockchainInitializer.createBackup();
        if (backupResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Backup created successfully',
            backupPath: backupResult.backupPath,
            size: backupResult.size,
            transactionCount: backupResult.transactionCount,
            blockCount: backupResult.blockCount
          });
        } else {
          return NextResponse.json({ 
            success: false, 
            message: 'Backup creation failed' 
          }, { status: 500 });
        }

      case 'restore':
        const { backupPath } = body;
        if (!backupPath) {
          return NextResponse.json({ error: 'backupPath is required' }, { status: 400 });
        }
        const restoreResult = await blockchainInitializer.restoreFromBackup(backupPath);
        return NextResponse.json(restoreResult);

      case 'reset':
        const resetResult = await blockchainInitializer.reset();
        return NextResponse.json(resetResult);

      case 'update-config':
        const { config } = body;
        if (!config) {
          return NextResponse.json({ error: 'config is required' }, { status: 400 });
        }
        blockchainConfig.updateConfig(config);
        return NextResponse.json({ 
          success: true, 
          message: 'Configuration updated successfully',
          config: blockchainConfig.getConfig()
        });

      case 'reset-config':
        blockchainConfig.resetConfig();
        return NextResponse.json({ 
          success: true, 
          message: 'Configuration reset to defaults',
          config: blockchainConfig.getConfig()
        });

      case 'health-check':
        const healthResult = await blockchainConfig.performHealthCheck();
        return NextResponse.json(healthResult);

      case 'export':
        const { format = 'json' } = body;
        const exportData = await blockchainIntegration.exportChain(format as 'json' | 'csv');
        const contentType = format === 'csv' ? 'text/csv' : 'application/json';
        const filename = `blockchain-export-${new Date().toISOString().split('T')[0]}.${format}`;
        
        return new Response(exportData, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });

      case 'legacy-backup':
        const legacyBackupData = await migrationUtility.createLegacyBackup();
        const timestamp = new Date().toISOString().split('T')[0];
        return new Response(legacyBackupData, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="legacy-backup-${timestamp}.json"`
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in blockchain management operation:', error);
    blockchainConfig.recordError(`Management operation failed: ${(error as Error).message}`);
    return NextResponse.json({ 
      error: 'Management operation failed',
      details: (error as Error).message 
    }, { status: 500 });
  }
}