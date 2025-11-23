/**
 * Example usage of BlockchainManager
 * This demonstrates the core functionality implemented in task 7
 */

import { BlockchainManager } from './manager';
import { createTransaction } from './utils';
import { TransactionType } from './types';

/**
 * Example demonstrating BlockchainManager functionality
 */
export async function demonstrateBlockchainManager() {
  console.log('=== Blockchain Manager Demo ===');
  
  // Initialize blockchain manager
  const manager = new BlockchainManager('demo-data/blockchain');
  await manager.initialize();
  console.log('✓ Blockchain manager initialized');

  // Get initial stats
  const initialStats = await manager.getBlockchainStats();
  console.log('Initial stats:', {
    chainHeight: initialStats.chainHeight,
    totalTransactions: initialStats.totalTransactions,
    pendingTransactions: initialStats.pendingTransactions
  });

  // Create and add some transactions
  console.log('\n--- Adding Transactions ---');
  
  const binUpdateTx = createTransaction(
    TransactionType.BIN_UPDATE,
    'update_capacity',
    { capacity: 85, location: 'Main Street' },
    { binId: 'bin-001' }
  );
  
  const pickupTx = createTransaction(
    TransactionType.PICKUP_CONFIRMATION,
    'confirm_pickup',
    { weight: 45, completedAt: new Date().toISOString() },
    { binId: 'bin-001', contractorId: 'contractor-001' }
  );
  
  const reportTx = createTransaction(
    TransactionType.ISSUE_REPORT,
    'report_overflow',
    { severity: 'high', description: 'Bin overflowing' },
    { binId: 'bin-002', citizenId: 'citizen-001' }
  );

  // Add transactions
  const tx1Id = await manager.addTransaction(binUpdateTx);
  console.log('✓ Added bin update transaction:', tx1Id);
  
  const tx2Id = await manager.addTransaction(pickupTx);
  console.log('✓ Added pickup confirmation transaction:', tx2Id);
  
  const tx3Id = await manager.addTransaction(reportTx);
  console.log('✓ Added issue report transaction:', tx3Id);

  // Create a block
  console.log('\n--- Creating Block ---');
  const newBlock = await manager.createBlock();
  console.log('✓ Created block:', {
    height: newBlock.header.height,
    hash: newBlock.header.hash.substring(0, 16) + '...',
    transactionCount: newBlock.body.transactionCount
  });

  // Validate the chain
  console.log('\n--- Chain Validation ---');
  const validation = await manager.validateChain();
  console.log('✓ Chain validation:', validation.isValid ? 'PASSED' : 'FAILED');
  if (!validation.isValid) {
    console.log('Validation errors:', validation.errors);
  }

  // Query transactions
  console.log('\n--- Querying Transactions ---');
  
  // Get transaction with proof
  const retrievedTx = await manager.getTransaction(tx1Id);
  if (retrievedTx) {
    console.log('✓ Retrieved transaction with proof:', {
      id: retrievedTx.id,
      hasProof: !!(retrievedTx as any)._proof,
      blockHeight: (retrievedTx as any)._blockHeight
    });
  }

  // Query by bin ID
  const binTransactions = await manager.getTransactionsByBinId('bin-001');
  console.log('✓ Transactions for bin-001:', binTransactions.length);

  // Query by date range
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentTransactions = await manager.getTransactionsByDateRange(oneHourAgo, now);
  console.log('✓ Recent transactions:', recentTransactions.length);

  // Export functionality
  console.log('\n--- Export Functionality ---');
  
  const jsonExport = await manager.exportChain('json');
  console.log('✓ JSON export size:', jsonExport.length, 'characters');
  
  const csvExport = await manager.exportChain('csv');
  console.log('✓ CSV export size:', csvExport.length, 'characters');

  // Final stats
  console.log('\n--- Final Statistics ---');
  const finalStats = await manager.getBlockchainStats();
  console.log('Final stats:', {
    chainHeight: finalStats.chainHeight,
    totalTransactions: finalStats.totalTransactions,
    pendingTransactions: finalStats.pendingTransactions,
    latestBlockHash: finalStats.latestBlockHash?.substring(0, 16) + '...'
  });

  console.log('\n=== Demo Complete ===');
  
  return {
    manager,
    stats: finalStats,
    validation,
    exportSizes: {
      json: jsonExport.length,
      csv: csvExport.length
    }
  };
}

// Export for potential use in other parts of the application
export { BlockchainManager };