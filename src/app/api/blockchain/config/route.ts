import { NextResponse } from 'next/server';
import { blockchainConfig, BlockchainConfig } from '@/lib/blockchain/config';
// import { blockchainInitializer } from '@/lib/blockchain/initialization';

/**
 * Blockchain Configuration Management Endpoint
 * Handles configuration updates, validation, and management
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const includeDefaults = searchParams.get('defaults') === 'true';

    const config = blockchainConfig.getConfig();

    if (section) {
      // Return specific configuration section
      switch (section) {
        case 'block':
          return NextResponse.json({
            maxTransactionsPerBlock: config.maxTransactionsPerBlock,
            blockTimeTarget: config.blockTimeTarget,
            maxBlockSize: config.maxBlockSize
          });

        case 'transaction':
          return NextResponse.json({
            transactionPoolMaxSize: config.transactionPoolMaxSize,
            transactionTimeout: config.transactionTimeout
          });

        case 'smart-contract':
          return NextResponse.json({
            contractExecutionTimeout: config.contractExecutionTimeout,
            defaultBinCapacityThreshold: config.defaultBinCapacityThreshold,
            defaultPointsPerReport: config.defaultPointsPerReport,
            defaultEarningsPerPickup: config.defaultEarningsPerPickup
          });

        case 'storage':
          return NextResponse.json({
            blockchainDataDir: config.blockchainDataDir,
            blocksFile: config.blocksFile,
            transactionsIndexFile: config.transactionsIndexFile,
            chainStateFile: config.chainStateFile
          });

        case 'performance':
          return NextResponse.json({
            queryCacheSize: config.queryCacheSize,
            indexBatchSize: config.indexBatchSize
          });

        case 'security':
          return NextResponse.json({
            enableSignatureValidation: config.enableSignatureValidation,
            enableHashValidation: config.enableHashValidation,
            enableChainValidation: config.enableChainValidation,
            hashAlgorithm: config.hashAlgorithm
          });

        case 'monitoring':
          return NextResponse.json({
            enableMetrics: config.enableMetrics,
            metricsRetentionDays: config.metricsRetentionDays,
            healthCheckInterval: config.healthCheckInterval
          });

        case 'backup':
          return NextResponse.json({
            enableAutoBackup: config.enableAutoBackup,
            backupInterval: config.backupInterval,
            maxBackupFiles: config.maxBackupFiles,
            backupDirectory: config.backupDirectory
          });

        default:
          return NextResponse.json({ error: 'Invalid configuration section' }, { status: 400 });
      }
    }

    // Return full configuration (excluding sensitive data)
    const safeConfig = {
      // Block configuration
      maxTransactionsPerBlock: config.maxTransactionsPerBlock,
      blockTimeTarget: config.blockTimeTarget,
      maxBlockSize: config.maxBlockSize,
      
      // Transaction configuration
      transactionPoolMaxSize: config.transactionPoolMaxSize,
      transactionTimeout: config.transactionTimeout,
      
      // Smart contract configuration
      contractExecutionTimeout: config.contractExecutionTimeout,
      defaultBinCapacityThreshold: config.defaultBinCapacityThreshold,
      defaultPointsPerReport: config.defaultPointsPerReport,
      defaultEarningsPerPickup: config.defaultEarningsPerPickup,
      
      // Performance configuration
      queryCacheSize: config.queryCacheSize,
      indexBatchSize: config.indexBatchSize,
      
      // Network configuration
      networkId: config.networkId,
      nodeId: config.nodeId,
      
      // Security configuration
      enableSignatureValidation: config.enableSignatureValidation,
      enableHashValidation: config.enableHashValidation,
      enableChainValidation: config.enableChainValidation,
      hashAlgorithm: config.hashAlgorithm,
      
      // Monitoring configuration
      enableMetrics: config.enableMetrics,
      metricsRetentionDays: config.metricsRetentionDays,
      healthCheckInterval: config.healthCheckInterval,
      
      // Backup configuration
      enableAutoBackup: config.enableAutoBackup,
      backupInterval: config.backupInterval,
      maxBackupFiles: config.maxBackupFiles
    };

    const response: Record<string, unknown> = { config: safeConfig };

    if (includeDefaults) {
      // Include information about default values
      response.defaults = {
        maxTransactionsPerBlock: 100,
        blockTimeTarget: 5000,
        transactionPoolMaxSize: 1000,
        enableMetrics: true,
        enableAutoBackup: true,
        healthCheckInterval: 60000
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching blockchain configuration:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch configuration' 
    }, { status: 500 });
  }
}

/**
 * Update blockchain configuration
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { config: configUpdates, validate = true } = body;

    if (!configUpdates || typeof configUpdates !== 'object') {
      return NextResponse.json({ 
        error: 'Configuration updates are required' 
      }, { status: 400 });
    }

    // Validate configuration updates
    if (validate) {
      const validationResult = validateConfigUpdates(configUpdates);
      if (!validationResult.valid) {
        return NextResponse.json({
          error: 'Configuration validation failed',
          issues: validationResult.issues
        }, { status: 400 });
      }
    }

    // Apply configuration updates
    const oldConfig = blockchainConfig.getConfig();
    blockchainConfig.updateConfig(configUpdates);
    // const newConfig = blockchainConfig.getConfig();

    // Log configuration change
    console.log('Blockchain configuration updated:', {
      changes: configUpdates,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      changes: configUpdates,
      previousValues: getChangedValues(oldConfig, configUpdates),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating blockchain configuration:', error);
    blockchainConfig.recordError(`Configuration update failed: ${(error as Error).message}`);
    
    return NextResponse.json({
      error: 'Failed to update configuration',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Reset configuration to defaults
 */
export async function DELETE() {
  try {
    const oldConfig = blockchainConfig.getConfig();
    blockchainConfig.resetConfig();
    const newConfig = blockchainConfig.getConfig();

    console.log('Blockchain configuration reset to defaults:', {
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration reset to defaults',
      previousConfig: oldConfig,
      newConfig: newConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting blockchain configuration:', error);
    return NextResponse.json({
      error: 'Failed to reset configuration',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Configuration validation and management operations
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'validate':
        const { config: configToValidate } = body;
        const validationResult = validateConfigUpdates(configToValidate);
        return NextResponse.json(validationResult);

      case 'export':
        const config = blockchainConfig.getConfig();
        const timestamp = new Date().toISOString().split('T')[0];
        
        return new Response(JSON.stringify(config, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="blockchain-config-${timestamp}.json"`
          }
        });

      case 'import':
        const { configData } = body;
        if (!configData) {
          return NextResponse.json({ 
            error: 'Configuration data is required' 
          }, { status: 400 });
        }

        const importValidation = validateConfigUpdates(configData);
        if (!importValidation.valid) {
          return NextResponse.json({
            error: 'Invalid configuration data',
            issues: importValidation.issues
          }, { status: 400 });
        }

        blockchainConfig.updateConfig(configData);
        return NextResponse.json({
          success: true,
          message: 'Configuration imported successfully',
          timestamp: new Date().toISOString()
        });

      case 'backup':
        const backupData = {
          config: blockchainConfig.getConfig(),
          metrics: blockchainConfig.getMetrics(),
          health: blockchainConfig.getHealthStatus(),
          timestamp: new Date().toISOString()
        };

        const backupTimestamp = new Date().toISOString().split('T')[0];
        return new Response(JSON.stringify(backupData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="blockchain-config-backup-${backupTimestamp}.json"`
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in configuration management operation:', error);
    return NextResponse.json({
      error: 'Configuration management operation failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * Validate configuration updates
 */
function validateConfigUpdates(updates: Partial<BlockchainConfig>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Validate numeric values
  if (updates.maxTransactionsPerBlock !== undefined) {
    if (updates.maxTransactionsPerBlock < 1 || updates.maxTransactionsPerBlock > 10000) {
      issues.push('maxTransactionsPerBlock must be between 1 and 10000');
    }
  }

  if (updates.blockTimeTarget !== undefined) {
    if (updates.blockTimeTarget < 1000 || updates.blockTimeTarget > 300000) {
      issues.push('blockTimeTarget must be between 1000ms and 300000ms (5 minutes)');
    }
  }

  if (updates.transactionPoolMaxSize !== undefined) {
    if (updates.transactionPoolMaxSize < 10 || updates.transactionPoolMaxSize > 100000) {
      issues.push('transactionPoolMaxSize must be between 10 and 100000');
    }
  }

  if (updates.transactionTimeout !== undefined) {
    if (updates.transactionTimeout < 10000 || updates.transactionTimeout > 3600000) {
      issues.push('transactionTimeout must be between 10000ms and 3600000ms (1 hour)');
    }
  }

  if (updates.contractExecutionTimeout !== undefined) {
    if (updates.contractExecutionTimeout < 1000 || updates.contractExecutionTimeout > 60000) {
      issues.push('contractExecutionTimeout must be between 1000ms and 60000ms');
    }
  }

  if (updates.healthCheckInterval !== undefined) {
    if (updates.healthCheckInterval < 10000 || updates.healthCheckInterval > 3600000) {
      issues.push('healthCheckInterval must be between 10000ms and 3600000ms (1 hour)');
    }
  }

  // Validate percentage values
  if (updates.defaultBinCapacityThreshold !== undefined) {
    if (updates.defaultBinCapacityThreshold < 1 || updates.defaultBinCapacityThreshold > 100) {
      issues.push('defaultBinCapacityThreshold must be between 1 and 100 percent');
    }
  }

  // Validate string values
  if (updates.hashAlgorithm !== undefined) {
    const validAlgorithms = ['sha256', 'sha512'];
    if (!validAlgorithms.includes(updates.hashAlgorithm)) {
      issues.push(`hashAlgorithm must be one of: ${validAlgorithms.join(', ')}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Get changed values from configuration update
 */
function getChangedValues(oldConfig: BlockchainConfig, updates: Partial<BlockchainConfig>): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = (oldConfig as unknown as Record<string, unknown>)[key];
    if (oldValue !== newValue) {
      changed[key] = oldValue;
    }
  }
  
  return changed;
}