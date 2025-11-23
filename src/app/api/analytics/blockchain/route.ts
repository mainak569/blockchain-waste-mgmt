import { NextResponse } from 'next/server';
import { BlockchainManager } from '@/lib/blockchain/manager';
import { Transaction, Block } from '@/lib/blockchain/types';

const blockchainManager = new BlockchainManager();

export async function GET(request: Request) {
  try {
    await blockchainManager.initialize();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const binId = searchParams.get('binId');
    const contractorId = searchParams.get('contractorId');
    const citizenId = searchParams.get('citizenId');

    switch (type) {
      case 'overview':
        return NextResponse.json(await getBlockchainOverview());
      
      case 'transactions':
        return NextResponse.json(await getTransactionAnalytics(startDate, endDate, binId, contractorId, citizenId));
      
      case 'blocks':
        return NextResponse.json(await getBlockAnalytics(startDate, endDate));
      
      case 'performance':
        return NextResponse.json(await getPerformanceMetrics());
      
      case 'audit':
        return NextResponse.json(await getAuditReport(startDate, endDate));
      
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching blockchain analytics:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch blockchain analytics',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

async function getBlockchainOverview() {
  const stats = await blockchainManager.getBlockchainStats();
  const latestBlock = await blockchainManager.getLatestBlock();
  
  // Get transaction type distribution
  const allBlocks = await getAllBlocks();
  const allTransactions = allBlocks.flatMap(block => block.body.transactions);
  
  const transactionTypes = allTransactions.reduce((acc, tx) => {
    acc[tx.type] = (acc[tx.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate chain health metrics
  const chainValidation = await blockchainManager.validateChain();
  
  return {
    chainStats: stats,
    latestBlock: latestBlock ? {
      height: latestBlock.header.height,
      hash: latestBlock.header.hash,
      timestamp: latestBlock.header.timestamp,
      transactionCount: latestBlock.body.transactionCount
    } : null,
    transactionTypes,
    chainHealth: {
      isValid: chainValidation.isValid,
      errorCount: chainValidation.errors.length,
      lastValidated: new Date().toISOString()
    },
    summary: {
      totalBlocks: stats.chainHeight + 1,
      totalTransactions: stats.totalTransactions,
      pendingTransactions: stats.pendingTransactions,
      averageBlockSize: allBlocks.length > 0 
        ? Math.round(allTransactions.length / allBlocks.length * 100) / 100 
        : 0
    }
  };
}

async function getTransactionAnalytics(
  startDate?: string | null, 
  endDate?: string | null,
  binId?: string | null,
  contractorId?: string | null,
  citizenId?: string | null
) {
  let transactions: Transaction[] = [];

  // Apply filters based on provided parameters
  if (binId) {
    transactions = await blockchainManager.getTransactionsByBinId(binId);
  } else if (contractorId) {
    transactions = await blockchainManager.getTransactionsByContractorId(contractorId);
  } else if (citizenId) {
    transactions = await blockchainManager.getTransactionsByCitizenId(citizenId);
  } else if (startDate && endDate) {
    transactions = await blockchainManager.getTransactionsByDateRange(
      new Date(startDate), 
      new Date(endDate)
    );
  } else {
    // Get all transactions from all blocks
    const allBlocks = await getAllBlocks();
    transactions = allBlocks.flatMap(block => block.body.transactions);
  }

  // Apply date filter if specified and not already filtered by date range
  if (startDate && endDate && !binId && !contractorId && !citizenId) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    transactions = transactions.filter(tx => {
      const txDate = new Date(tx.timestamp);
      return txDate >= start && txDate <= end;
    });
  }

  // Calculate analytics
  const transactionsByType = transactions.reduce((acc, tx) => {
    acc[tx.type] = (acc[tx.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const transactionsByAction = transactions.reduce((acc, tx) => {
    acc[tx.action] = (acc[tx.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Time-based analytics
  const transactionsByHour = transactions.reduce((acc, tx) => {
    const hour = new Date(tx.timestamp).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const transactionsByDay = transactions.reduce((acc, tx) => {
    const day = new Date(tx.timestamp).toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalTransactions: transactions.length,
    transactionsByType,
    transactionsByAction,
    timeAnalytics: {
      byHour: transactionsByHour,
      byDay: transactionsByDay
    },
    recentTransactions: transactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(tx => ({
        id: tx.id,
        type: tx.type,
        action: tx.action,
        timestamp: tx.timestamp,
        binId: tx.binId,
        contractorId: tx.contractorId,
        citizenId: tx.citizenId,
        blockHeight: (tx as any)._blockHeight,
        verified: !!(tx as any)._proof
      }))
  };
}

async function getBlockAnalytics(startDate?: string | null, endDate?: string | null) {
  const allBlocks = await getAllBlocks();
  
  let filteredBlocks = allBlocks;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    filteredBlocks = allBlocks.filter(block => {
      const blockDate = new Date(block.header.timestamp);
      return blockDate >= start && blockDate <= end;
    });
  }

  // Calculate block metrics
  const blockSizes = filteredBlocks.map(block => block.body.transactionCount);
  const averageBlockSize = blockSizes.length > 0 
    ? blockSizes.reduce((sum, size) => sum + size, 0) / blockSizes.length 
    : 0;

  const blocksBySize = filteredBlocks.reduce((acc, block) => {
    const sizeCategory = block.body.transactionCount === 0 ? 'empty' :
                        block.body.transactionCount <= 5 ? 'small' :
                        block.body.transactionCount <= 15 ? 'medium' : 'large';
    acc[sizeCategory] = (acc[sizeCategory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Block creation time analysis
  const blockIntervals: number[] = [];
  for (let i = 1; i < filteredBlocks.length; i++) {
    const prevTime = new Date(filteredBlocks[i-1].header.timestamp).getTime();
    const currTime = new Date(filteredBlocks[i].header.timestamp).getTime();
    blockIntervals.push(currTime - prevTime);
  }

  const averageBlockInterval = blockIntervals.length > 0 
    ? blockIntervals.reduce((sum, interval) => sum + interval, 0) / blockIntervals.length 
    : 0;

  return {
    totalBlocks: filteredBlocks.length,
    averageBlockSize: Math.round(averageBlockSize * 100) / 100,
    averageBlockInterval: Math.round(averageBlockInterval / 1000), // Convert to seconds
    blocksBySize,
    recentBlocks: filteredBlocks
      .sort((a, b) => b.header.height - a.header.height)
      .slice(0, 10)
      .map(block => ({
        height: block.header.height,
        hash: block.header.hash,
        timestamp: block.header.timestamp,
        transactionCount: block.body.transactionCount,
        previousHash: block.header.previousHash
      }))
  };
}

async function getPerformanceMetrics() {
  const stats = await blockchainManager.getBlockchainStats();
  const allBlocks = await getAllBlocks();
  
  // Calculate performance metrics
  const now = Date.now();
  const recentBlocks = allBlocks.filter(block => 
    now - new Date(block.header.timestamp).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
  );

  const transactionsPerSecond = recentBlocks.length > 0 
    ? recentBlocks.reduce((sum, block) => sum + block.body.transactionCount, 0) / (24 * 60 * 60)
    : 0;

  return {
    currentStats: stats,
    performance: {
      transactionsPerSecond: Math.round(transactionsPerSecond * 1000) / 1000,
      blocksLast24Hours: recentBlocks.length,
      averageTransactionAge: stats.averageTransactionAge,
      pendingTransactionRatio: stats.totalTransactions > 0 
        ? stats.pendingTransactions / stats.totalTransactions 
        : 0
    },
    systemHealth: {
      chainHeight: stats.chainHeight,
      lastBlockTime: stats.latestBlockTimestamp,
      isCreatingBlock: stats.isCreatingBlock,
      activeContracts: stats.activeContracts
    }
  };
}

async function getAuditReport(startDate?: string | null, endDate?: string | null) {
  const chainValidation = await blockchainManager.validateChain();
  const allBlocks = await getAllBlocks();
  
  let auditBlocks = allBlocks;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    auditBlocks = allBlocks.filter(block => {
      const blockDate = new Date(block.header.timestamp);
      return blockDate >= start && blockDate <= end;
    });
  }

  // Verify cryptographic proofs for transactions
  const verificationResults = await Promise.all(
    auditBlocks.flatMap(block => 
      block.body.transactions.map(async (tx) => {
        const proof = (tx as any)._proof;
        const isVerified = proof ? 
          await blockchainManager.verifyTransactionProof(tx, proof, block.header.hash, block.header.height) :
          false;
        
        return {
          transactionId: tx.id,
          blockHeight: block.header.height,
          blockHash: block.header.hash,
          isVerified,
          hasProof: !!proof,
          timestamp: tx.timestamp,
          type: tx.type,
          action: tx.action
        };
      })
    )
  );

  const verifiedCount = verificationResults.filter(r => r.isVerified).length;
  const unverifiedCount = verificationResults.filter(r => !r.isVerified).length;

  return {
    auditMetadata: {
      reportGenerated: new Date().toISOString(),
      auditPeriod: {
        startDate: startDate || 'genesis',
        endDate: endDate || 'latest'
      },
      blocksAudited: auditBlocks.length,
      transactionsAudited: verificationResults.length
    },
    chainIntegrity: {
      isValid: chainValidation.isValid,
      errors: chainValidation.errors,
      validationTimestamp: new Date().toISOString()
    },
    cryptographicVerification: {
      totalTransactions: verificationResults.length,
      verifiedTransactions: verifiedCount,
      unverifiedTransactions: unverifiedCount,
      verificationRate: verificationResults.length > 0 
        ? Math.round((verifiedCount / verificationResults.length) * 10000) / 100 
        : 0
    },
    blockSummary: auditBlocks.map(block => ({
      height: block.header.height,
      hash: block.header.hash,
      timestamp: block.header.timestamp,
      transactionCount: block.body.transactionCount,
      previousHash: block.header.previousHash,
      merkleRoot: block.header.merkleRoot
    })),
    transactionVerification: verificationResults.filter(r => !r.isVerified) // Only include unverified for investigation
  };
}

async function getAllBlocks(): Promise<Block[]> {
  // Get all blocks from blockchain manager
  const stats = await blockchainManager.getBlockchainStats();
  const blocks: Block[] = [];
  
  for (let height = 0; height <= stats.chainHeight; height++) {
    const block = await blockchainManager.getBlockByHeight(height);
    if (block) {
      blocks.push(block);
    }
  }
  
  return blocks;
}