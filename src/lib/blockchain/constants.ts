/**
 * Blockchain configuration constants
 */

export const BLOCKCHAIN_CONFIG = {
  // Block configuration
  MAX_TRANSACTIONS_PER_BLOCK: 100,
  BLOCK_TIME_TARGET: 5000, // 5 seconds in milliseconds
  
  // Genesis block configuration
  GENESIS_BLOCK_HEIGHT: 0,
  GENESIS_PREVIOUS_HASH: '0000000000000000000000000000000000000000000000000000000000000000',
  
  // Transaction configuration
  TRANSACTION_POOL_MAX_SIZE: 1000,
  TRANSACTION_TIMEOUT: 300000, // 5 minutes in milliseconds
  
  // Smart contract configuration
  CONTRACT_EXECUTION_TIMEOUT: 10000, // 10 seconds
  DEFAULT_BIN_CAPACITY_THRESHOLD: 80, // 80% full
  DEFAULT_POINTS_PER_REPORT: 10,
  DEFAULT_EARNINGS_PER_PICKUP: 25,
  
  // Validation configuration
  MAX_BLOCK_SIZE: 1024 * 1024, // 1MB
  HASH_ALGORITHM: 'sha256',
  
  // Storage configuration
  BLOCKCHAIN_DATA_DIR: 'data/blockchain',
  BLOCKS_FILE: 'blocks.json',
  TRANSACTIONS_INDEX_FILE: 'transactions_index.json',
  CHAIN_STATE_FILE: 'chain_state.json',
  
  // Performance configuration
  QUERY_CACHE_SIZE: 1000,
  INDEX_BATCH_SIZE: 100,
  
  // Error messages
  ERRORS: {
    INVALID_TRANSACTION: 'Invalid transaction format or signature',
    INVALID_BLOCK: 'Invalid block structure or hash',
    CHAIN_INTEGRITY_FAILED: 'Blockchain integrity validation failed',
    TRANSACTION_NOT_FOUND: 'Transaction not found',
    BLOCK_NOT_FOUND: 'Block not found',
    CONSENSUS_CONFLICT: 'Consensus conflict detected',
    SMART_CONTRACT_FAILED: 'Smart contract execution failed',
    STORAGE_ERROR: 'Blockchain storage operation failed'
  }
} as const;

export const TRANSACTION_TYPES = {
  BIN_UPDATE: 'bin_update',
  PICKUP_CONFIRMATION: 'pickup_confirmation',
  ISSUE_REPORT: 'issue_report',
  SMART_CONTRACT_EXECUTION: 'smart_contract_execution',
  SYSTEM_EVENT: 'system_event'
} as const;

export const CONTRACT_TYPES = {
  BIN_CAPACITY_MONITOR: 'bin_capacity_monitor',
  PICKUP_VALIDATOR: 'pickup_validator',
  REPORT_PROCESSOR: 'report_processor',
  EARNINGS_CALCULATOR: 'earnings_calculator'
} as const;