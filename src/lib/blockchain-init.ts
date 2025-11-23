/**
 * Blockchain Initialization Utility
 * Ensures blockchain integration is initialized when the application starts
 */

import { blockchainIntegration } from './blockchain-integration';

let initializationPromise: Promise<void> | null = null;

/**
 * Initialize blockchain integration service
 * This function is idempotent and can be called multiple times safely
 */
export async function initializeBlockchain(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = performInitialization();
  }
  return initializationPromise;
}

async function performInitialization(): Promise<void> {
  try {
    console.log('Initializing blockchain integration service...');
    await blockchainIntegration.initialize();
    
    const status = blockchainIntegration.getServiceStatus();
    console.log('Blockchain integration status:', status);
    
    if (status.mode === 'blockchain') {
      console.log('✅ Blockchain integration active');
    } else if (status.mode === 'legacy') {
      console.log('⚠️ Running in legacy mode - blockchain features disabled');
    } else {
      console.log('❌ Blockchain integration failed');
    }
  } catch (error) {
    console.error('Failed to initialize blockchain integration:', error);
    // Don't throw - let graceful degradation handle this
  }
}

/**
 * Get blockchain service status
 */
export function getBlockchainStatus() {
  return blockchainIntegration.getServiceStatus();
}

/**
 * Check if blockchain is ready
 */
export function isBlockchainReady(): boolean {
  const status = blockchainIntegration.getServiceStatus();
  return status.initialized && !status.initializationError;
}

// Auto-initialize when this module is imported (for server-side)
if (typeof window === 'undefined') {
  // Only initialize on server-side
  initializeBlockchain().catch(error => {
    console.error('Auto-initialization failed:', error);
  });
}