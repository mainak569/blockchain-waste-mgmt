/**
 * Blockchain Configuration System
 * Manages blockchain parameters, initialization, and runtime configuration
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface BlockchainConfig {
  // Block configuration
  maxTransactionsPerBlock: number;
  blockTimeTarget: number; // milliseconds
  
  // Genesis block configuration
  genesisBlockHeight: number;
  genesisPreviousHash: string;
  
  // Transaction configuration
  transactionPoolMaxSize: number;
  transactionTimeout: number; // milliseconds
  
  // Smart contract configuration
  contractExecutionTimeout: number; // milliseconds
  defaultBinCapacityThreshold: number; // percentage
  defaultPointsPerReport: number;
  defaultEarningsPerPickup: number;
  
  // Validation configuration
  maxBlockSize: number; // bytes
  hashAlgorithm: string;
  
  // Storage configuration
  blockchainDataDir: string;
  blocksFile: string;
  transactionsIndexFile: string;
  chainStateFile: string;
  
  // Performance configuration
  queryCacheSize: number;
  indexBatchSize: number;
  
  // Network configuration (for future use)
  networkId: string;
  nodeId: string;
  
  // Security configuration
  enableSignatureValidation: boolean;
  enableHashValidation: boolean;
  enableChainValidation: boolean;
  
  // Monitoring configuration
  enableMetrics: boolean;
  metricsRetentionDays: number;
  healthCheckInterval: number; // milliseconds
  
  // Backup configuration
  enableAutoBackup: boolean;
  backupInterval: number; // milliseconds
  maxBackupFiles: number;
  backupDirectory: string;
}

export interface RuntimeMetrics {
  startTime: string;
  uptime: number;
  totalTransactions: number;
  totalBlocks: number;
  averageBlockTime: number;
  averageTransactionTime: number;
  lastBlockCreated: string | null;
  lastTransactionProcessed: string | null;
  errorCount: number;
  warningCount: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    used: number;
    available: number;
    percentage: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  checks: {
    chainIntegrity: boolean;
    storageAccess: boolean;
    consensusEngine: boolean;
    smartContracts: boolean;
    memoryUsage: boolean;
    diskSpace: boolean;
  };
  lastChecked: string;
  issues: string[];
  recommendations: string[];
}

const DEFAULT_CONFIG: BlockchainConfig = {
  // Block configuration
  maxTransactionsPerBlock: 100,
  blockTimeTarget: 5000,
  
  // Genesis block configuration
  genesisBlockHeight: 0,
  genesisPreviousHash: '0000000000000000000000000000000000000000000000000000000000000000',
  
  // Transaction configuration
  transactionPoolMaxSize: 1000,
  transactionTimeout: 300000,
  
  // Smart contract configuration
  contractExecutionTimeout: 10000,
  defaultBinCapacityThreshold: 80,
  defaultPointsPerReport: 10,
  defaultEarningsPerPickup: 25,
  
  // Validation configuration
  maxBlockSize: 1024 * 1024,
  hashAlgorithm: 'sha256',
  
  // Storage configuration
  blockchainDataDir: 'data/blockchain',
  blocksFile: 'blocks.json',
  transactionsIndexFile: 'transactions_index.json',
  chainStateFile: 'chain_state.json',
  
  // Performance configuration
  queryCacheSize: 1000,
  indexBatchSize: 100,
  
  // Network configuration
  networkId: 'wastechain-private',
  nodeId: 'node-' + Math.random().toString(36).substring(2, 11),
  
  // Security configuration
  enableSignatureValidation: true,
  enableHashValidation: true,
  enableChainValidation: true,
  
  // Monitoring configuration
  enableMetrics: true,
  metricsRetentionDays: 30,
  healthCheckInterval: 60000, // 1 minute
  
  // Backup configuration
  enableAutoBackup: true,
  backupInterval: 3600000, // 1 hour
  maxBackupFiles: 24, // Keep 24 hours of backups
  backupDirectory: 'data/blockchain/backups'
};

export class BlockchainConfigManager {
  private config: BlockchainConfig;
  private configPath: string;
  private metricsPath: string;
  private healthPath: string;
  private startTime: Date;
  private metrics: RuntimeMetrics;
  private healthStatus: HealthStatus;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(configDir: string = 'data/blockchain/config') {
    this.configPath = join(configDir, 'blockchain.config.json');
    this.metricsPath = join(configDir, 'metrics.json');
    this.healthPath = join(configDir, 'health.json');
    this.startTime = new Date();
    
    // Ensure config directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    // Load or create configuration
    this.config = this.loadConfig();
    
    // Initialize metrics and health status
    this.metrics = this.initializeMetrics();
    this.healthStatus = this.initializeHealthStatus();
    
    // Start health monitoring if enabled
    if (this.config.enableMetrics) {
      this.startHealthMonitoring();
    }
  }

  /**
   * Get current blockchain configuration
   */
  public getConfig(): BlockchainConfig {
    return { ...this.config };
  }

  /**
   * Update blockchain configuration
   */
  public updateConfig(updates: Partial<BlockchainConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    
    // Restart health monitoring if interval changed
    if (updates.healthCheckInterval && this.config.enableMetrics) {
      this.stopHealthMonitoring();
      this.startHealthMonitoring();
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }

  /**
   * Get runtime metrics
   */
  public getMetrics(): RuntimeMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  public getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Perform health check
   */
  public async performHealthCheck(): Promise<HealthStatus> {
    const checks = {
      chainIntegrity: await this.checkChainIntegrity(),
      storageAccess: await this.checkStorageAccess(),
      consensusEngine: await this.checkConsensusEngine(),
      smartContracts: await this.checkSmartContracts(),
      memoryUsage: this.checkMemoryUsage(),
      diskSpace: await this.checkDiskSpace()
    };

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Analyze check results
    if (!checks.chainIntegrity) {
      issues.push('Blockchain integrity validation failed');
      recommendations.push('Run chain validation and repair if necessary');
    }

    if (!checks.storageAccess) {
      issues.push('Storage access issues detected');
      recommendations.push('Check file system permissions and disk space');
    }

    if (!checks.consensusEngine) {
      issues.push('Consensus engine not responding properly');
      recommendations.push('Restart blockchain service');
    }

    if (!checks.smartContracts) {
      issues.push('Smart contract execution issues');
      recommendations.push('Check contract configurations and dependencies');
    }

    if (!checks.memoryUsage) {
      issues.push('High memory usage detected');
      recommendations.push('Consider increasing available memory or optimizing queries');
    }

    if (!checks.diskSpace) {
      issues.push('Low disk space available');
      recommendations.push('Free up disk space or configure automatic cleanup');
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    this.healthStatus = {
      status,
      checks,
      lastChecked: new Date().toISOString(),
      issues,
      recommendations
    };

    // Save health status
    this.saveHealthStatus();

    return this.healthStatus;
  }

  /**
   * Update runtime metrics
   */
  public updateMetrics(): void {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    
    this.metrics = {
      ...this.metrics,
      uptime,
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      }
    };

    // Save metrics periodically
    if (this.config.enableMetrics) {
      this.saveMetrics();
    }
  }

  /**
   * Record transaction processed
   */
  public recordTransaction(transactionId: string): void {
    this.metrics.totalTransactions++;
    this.metrics.lastTransactionProcessed = new Date().toISOString();
    
    // Calculate average transaction time if we have timing data
    // For now, we'll use a placeholder calculation
    const currentTime = Date.now();
    if (this.metrics.averageTransactionTime === 0) {
      this.metrics.averageTransactionTime = 50; // Default 50ms
    }
    
    this.updateMetrics();
  }

  /**
   * Record block created
   */
  public recordBlock(blockHeight: number, processingTime: number): void {
    this.metrics.totalBlocks++;
    this.metrics.lastBlockCreated = new Date().toISOString();
    
    // Update average block time
    if (this.metrics.averageBlockTime === 0) {
      this.metrics.averageBlockTime = processingTime;
    } else {
      this.metrics.averageBlockTime = (this.metrics.averageBlockTime + processingTime) / 2;
    }
    
    this.updateMetrics();
  }

  /**
   * Record error
   */
  public recordError(error: string): void {
    this.metrics.errorCount++;
    console.error('Blockchain error recorded:', error);
    this.updateMetrics();
  }

  /**
   * Record warning
   */
  public recordWarning(warning: string): void {
    this.metrics.warningCount++;
    console.warn('Blockchain warning recorded:', warning);
    this.updateMetrics();
  }

  /**
   * Export configuration and metrics
   */
  public exportDiagnostics(): any {
    return {
      config: this.config,
      metrics: this.metrics,
      health: this.healthStatus,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopHealthMonitoring();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): BlockchainConfig {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge with defaults to ensure all properties exist
        return { ...DEFAULT_CONFIG, ...loadedConfig };
      }
    } catch (error) {
      console.warn('Failed to load blockchain config, using defaults:', error);
    }
    
    // Save default config
    const config = { ...DEFAULT_CONFIG };
    this.saveConfigToFile(config);
    return config;
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    this.saveConfigToFile(this.config);
  }

  private saveConfigToFile(config: BlockchainConfig): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save blockchain config:', error);
    }
  }

  /**
   * Initialize runtime metrics
   */
  private initializeMetrics(): RuntimeMetrics {
    const defaultMetrics: RuntimeMetrics = {
      startTime: this.startTime.toISOString(),
      uptime: 0,
      totalTransactions: 0,
      totalBlocks: 0,
      averageBlockTime: 0,
      averageTransactionTime: 0,
      lastBlockCreated: null,
      lastTransactionProcessed: null,
      errorCount: 0,
      warningCount: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      diskUsage: {
        used: 0,
        available: 0,
        percentage: 0
      }
    };

    // Try to load existing metrics
    try {
      if (existsSync(this.metricsPath)) {
        const metricsData = readFileSync(this.metricsPath, 'utf8');
        const loadedMetrics = JSON.parse(metricsData);
        return { ...defaultMetrics, ...loadedMetrics };
      }
    } catch (error) {
      console.warn('Failed to load metrics, using defaults:', error);
    }

    return defaultMetrics;
  }

  /**
   * Initialize health status
   */
  private initializeHealthStatus(): HealthStatus {
    const defaultHealth: HealthStatus = {
      status: 'unknown',
      checks: {
        chainIntegrity: false,
        storageAccess: false,
        consensusEngine: false,
        smartContracts: false,
        memoryUsage: false,
        diskSpace: false
      },
      lastChecked: new Date().toISOString(),
      issues: [],
      recommendations: []
    };

    // Try to load existing health status
    try {
      if (existsSync(this.healthPath)) {
        const healthData = readFileSync(this.healthPath, 'utf8');
        const loadedHealth = JSON.parse(healthData);
        return { ...defaultHealth, ...loadedHealth };
      }
    } catch (error) {
      console.warn('Failed to load health status, using defaults:', error);
    }

    return defaultHealth;
  }

  /**
   * Save metrics to file
   */
  private saveMetrics(): void {
    try {
      writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  /**
   * Save health status to file
   */
  private saveHealthStatus(): void {
    try {
      writeFileSync(this.healthPath, JSON.stringify(this.healthStatus, null, 2));
    } catch (error) {
      console.error('Failed to save health status:', error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Health check implementations
   */
  private async checkChainIntegrity(): Promise<boolean> {
    try {
      // This would integrate with the actual blockchain validator
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkStorageAccess(): Promise<boolean> {
    try {
      const dataDir = this.config.blockchainDataDir;
      return existsSync(dataDir);
    } catch (error) {
      return false;
    }
  }

  private async checkConsensusEngine(): Promise<boolean> {
    try {
      // This would check if consensus engine is responsive
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkSmartContracts(): Promise<boolean> {
    try {
      // This would check smart contract engine status
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      return false;
    }
  }

  private checkMemoryUsage(): boolean {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external;
      const usedMemory = memUsage.heapUsed;
      const percentage = (usedMemory / totalMemory) * 100;
      
      // Consider healthy if memory usage is below 80%
      return percentage < 80;
    } catch (error) {
      return false;
    }
  }

  private async checkDiskSpace(): Promise<boolean> {
    try {
      // This would check available disk space
      // For now, return true as a placeholder
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Global configuration manager instance
export const blockchainConfig = new BlockchainConfigManager();