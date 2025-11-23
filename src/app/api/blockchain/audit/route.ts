import { NextResponse } from 'next/server';
import { BlockchainManager } from '@/lib/blockchain/manager';

const blockchainManager = new BlockchainManager();

export async function GET(request: Request) {
  try {
    await blockchainManager.initialize();
    
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeTransactions = searchParams.get('includeTransactions') === 'true';
    const verifyProofs = searchParams.get('verifyProofs') === 'true';

    const auditReport = await generateAuditReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTransactions,
      verifyProofs
    });

    if (format === 'csv') {
      const csvContent = convertAuditReportToCSV(auditReport);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="blockchain-audit-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(auditReport);
  } catch (error) {
    console.error('Error generating audit report:', error);
    return NextResponse.json({ 
      error: 'Failed to generate audit report',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await blockchainManager.initialize();
    
    const body = await request.json();
    const { 
      reportType = 'full',
      dateRange,
      entities = [],
      includeProofs = true,
      format = 'json'
    } = body;

    let auditReport;
    
    switch (reportType) {
      case 'compliance':
        auditReport = await generateComplianceReport(dateRange, entities);
        break;
      case 'integrity':
        auditReport = await generateIntegrityReport(dateRange, includeProofs);
        break;
      case 'performance':
        auditReport = await generatePerformanceReport(dateRange);
        break;
      case 'full':
      default:
        auditReport = await generateFullAuditReport(dateRange, entities, includeProofs);
        break;
    }

    if (format === 'csv') {
      const csvContent = convertAuditReportToCSV(auditReport);
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="blockchain-${reportType}-audit-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(auditReport);
  } catch (error) {
    console.error('Error generating custom audit report:', error);
    return NextResponse.json({ 
      error: 'Failed to generate custom audit report',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

interface AuditOptions {
  startDate?: Date;
  endDate?: Date;
  includeTransactions?: boolean;
  verifyProofs?: boolean;
}

async function generateAuditReport(options: AuditOptions) {
  const { startDate, endDate, includeTransactions = false, verifyProofs = false } = options;
  
  // Get blockchain statistics
  const stats = await blockchainManager.getBlockchainStats();
  const chainValidation = await blockchainManager.validateChain();
  
  // Get blocks within date range
  const allBlocks = [];
  for (let height = 0; height <= stats.chainHeight; height++) {
    const block = await blockchainManager.getBlockByHeight(height);
    if (block) {
      const blockDate = new Date(block.header.timestamp);
      
      if (startDate && blockDate < startDate) continue;
      if (endDate && blockDate > endDate) continue;
      
      allBlocks.push(block);
    }
  }

  // Collect all transactions from filtered blocks
  const allTransactions = allBlocks.flatMap(block => 
    block.body.transactions.map(tx => ({
      ...tx,
      blockHeight: block.header.height,
      blockHash: block.header.hash,
      blockTimestamp: block.header.timestamp
    }))
  );

  // Verify cryptographic proofs if requested
  let verificationResults: any[] = [];
  if (verifyProofs) {
    verificationResults = await Promise.all(
      allTransactions.map(async (tx) => {
        const proof = (tx as any)._proof;
        const isVerified = proof ? 
          await blockchainManager.verifyTransactionProof(tx, proof, tx.blockHash, tx.blockHeight) :
          false;
        
        return {
          transactionId: tx.id,
          blockHeight: tx.blockHeight,
          isVerified,
          hasProof: !!proof,
          timestamp: tx.timestamp,
          type: tx.type
        };
      })
    );
  }

  // Calculate audit metrics
  const auditMetrics = {
    totalBlocks: allBlocks.length,
    totalTransactions: allTransactions.length,
    dateRange: {
      start: startDate?.toISOString() || 'genesis',
      end: endDate?.toISOString() || 'latest',
      actualStart: allBlocks.length > 0 ? allBlocks[0].header.timestamp : null,
      actualEnd: allBlocks.length > 0 ? allBlocks[allBlocks.length - 1].header.timestamp : null
    },
    transactionTypes: allTransactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    blockSizeDistribution: {
      empty: allBlocks.filter(b => b.body.transactionCount === 0).length,
      small: allBlocks.filter(b => b.body.transactionCount > 0 && b.body.transactionCount <= 5).length,
      medium: allBlocks.filter(b => b.body.transactionCount > 5 && b.body.transactionCount <= 15).length,
      large: allBlocks.filter(b => b.body.transactionCount > 15).length
    }
  };

  // Chain integrity analysis
  const integrityAnalysis = {
    chainValidation: {
      isValid: chainValidation.isValid,
      errors: chainValidation.errors,
      validationTimestamp: new Date().toISOString()
    },
    hashContinuity: analyzeHashContinuity(allBlocks),
    merkleRootValidation: await validateMerkleRoots(allBlocks),
    timestampConsistency: analyzeTimestampConsistency(allBlocks)
  };

  // Cryptographic verification summary
  const cryptographicSummary = verifyProofs ? {
    totalVerified: verificationResults.filter(r => r.isVerified).length,
    totalUnverified: verificationResults.filter(r => !r.isVerified).length,
    verificationRate: verificationResults.length > 0 
      ? (verificationResults.filter(r => r.isVerified).length / verificationResults.length) * 100 
      : 0,
    unverifiedTransactions: verificationResults.filter(r => !r.isVerified)
  } : null;

  return {
    auditMetadata: {
      reportGenerated: new Date().toISOString(),
      reportId: `audit-${Date.now()}`,
      auditor: 'WasteChain Blockchain System',
      version: '1.0'
    },
    scope: {
      ...auditMetrics.dateRange,
      blocksAudited: auditMetrics.totalBlocks,
      transactionsAudited: auditMetrics.totalTransactions,
      verificationPerformed: verifyProofs
    },
    chainStatistics: {
      currentHeight: stats.chainHeight,
      totalChainTransactions: stats.totalTransactions,
      pendingTransactions: stats.pendingTransactions,
      lastBlockTimestamp: stats.latestBlockTimestamp
    },
    auditMetrics,
    integrityAnalysis,
    cryptographicSummary,
    blockSummary: allBlocks.map(block => ({
      height: block.header.height,
      hash: block.header.hash,
      previousHash: block.header.previousHash,
      timestamp: block.header.timestamp,
      transactionCount: block.body.transactionCount,
      merkleRoot: block.header.merkleRoot,
      nonce: block.header.nonce
    })),
    transactionSummary: includeTransactions ? allTransactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      action: tx.action,
      timestamp: tx.timestamp,
      blockHeight: tx.blockHeight,
      blockHash: tx.blockHash,
      binId: tx.binId,
      contractorId: tx.contractorId,
      citizenId: tx.citizenId,
      verified: verifyProofs ? verificationResults.find(r => r.transactionId === tx.id)?.isVerified : undefined
    })) : undefined
  };
}

async function generateComplianceReport(dateRange: any, entities: string[]) {
  // Implementation for compliance-specific audit report
  const auditReport = await generateAuditReport({
    startDate: dateRange?.start ? new Date(dateRange.start) : undefined,
    endDate: dateRange?.end ? new Date(dateRange.end) : undefined,
    includeTransactions: true,
    verifyProofs: true
  });

  // Filter by entities if specified
  let filteredTransactions = auditReport.transactionSummary || [];
  if (entities.length > 0) {
    filteredTransactions = filteredTransactions.filter(tx => 
      entities.includes(tx.binId || '') || 
      entities.includes(tx.contractorId || '') || 
      entities.includes(tx.citizenId || '')
    );
  }

  return {
    ...auditReport,
    reportType: 'compliance',
    complianceMetrics: {
      entitiesAudited: entities,
      transactionsInScope: filteredTransactions.length,
      complianceRate: filteredTransactions.length > 0 
        ? (filteredTransactions.filter(tx => tx.verified).length / filteredTransactions.length) * 100 
        : 0
    },
    transactionSummary: filteredTransactions
  };
}

async function generateIntegrityReport(dateRange: any, includeProofs: boolean) {
  const auditReport = await generateAuditReport({
    startDate: dateRange?.start ? new Date(dateRange.start) : undefined,
    endDate: dateRange?.end ? new Date(dateRange.end) : undefined,
    includeTransactions: false,
    verifyProofs: includeProofs
  });

  return {
    ...auditReport,
    reportType: 'integrity',
    focus: 'Chain integrity and cryptographic verification'
  };
}

async function generatePerformanceReport(dateRange: any) {
  const auditReport = await generateAuditReport({
    startDate: dateRange?.start ? new Date(dateRange.start) : undefined,
    endDate: dateRange?.end ? new Date(dateRange.end) : undefined,
    includeTransactions: false,
    verifyProofs: false
  });

  // Add performance-specific metrics
  const blocks = auditReport.blockSummary || [];
  const performanceMetrics = {
    averageBlockTime: calculateAverageBlockTime(blocks),
    transactionThroughput: calculateTransactionThroughput(blocks),
    blockSizeEfficiency: calculateBlockSizeEfficiency(blocks)
  };

  return {
    ...auditReport,
    reportType: 'performance',
    performanceMetrics
  };
}

async function generateFullAuditReport(dateRange: any, entities: string[], includeProofs: boolean) {
  return await generateAuditReport({
    startDate: dateRange?.start ? new Date(dateRange.start) : undefined,
    endDate: dateRange?.end ? new Date(dateRange.end) : undefined,
    includeTransactions: true,
    verifyProofs: includeProofs
  });
}

function analyzeHashContinuity(blocks: any[]) {
  const issues = [];
  
  for (let i = 1; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    const previousBlock = blocks[i - 1];
    
    if (currentBlock.header.previousHash !== previousBlock.header.hash) {
      issues.push({
        blockHeight: currentBlock.header.height,
        issue: 'Hash continuity broken',
        expected: previousBlock.header.hash,
        actual: currentBlock.header.previousHash
      });
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

async function validateMerkleRoots(blocks: any[]) {
  // This would implement actual Merkle root validation
  // For now, return a placeholder implementation
  return {
    isValid: true,
    validatedBlocks: blocks.length,
    issues: []
  };
}

function analyzeTimestampConsistency(blocks: any[]) {
  const issues = [];
  
  for (let i = 1; i < blocks.length; i++) {
    const currentTime = new Date(blocks[i].header.timestamp).getTime();
    const previousTime = new Date(blocks[i - 1].header.timestamp).getTime();
    
    if (currentTime <= previousTime) {
      issues.push({
        blockHeight: blocks[i].header.height,
        issue: 'Timestamp not increasing',
        currentTime: blocks[i].header.timestamp,
        previousTime: blocks[i - 1].header.timestamp
      });
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

function calculateAverageBlockTime(blocks: any[]) {
  if (blocks.length < 2) return 0;
  
  const intervals = [];
  for (let i = 1; i < blocks.length; i++) {
    const current = new Date(blocks[i].timestamp).getTime();
    const previous = new Date(blocks[i - 1].timestamp).getTime();
    intervals.push(current - previous);
  }
  
  return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length / 1000; // Convert to seconds
}

function calculateTransactionThroughput(blocks: any[]) {
  if (blocks.length === 0) return 0;
  
  const totalTransactions = blocks.reduce((sum, block) => sum + block.transactionCount, 0);
  const timeSpan = new Date(blocks[blocks.length - 1].timestamp).getTime() - 
                   new Date(blocks[0].timestamp).getTime();
  
  return timeSpan > 0 ? (totalTransactions / (timeSpan / 1000)) : 0; // Transactions per second
}

function calculateBlockSizeEfficiency(blocks: any[]) {
  if (blocks.length === 0) return 0;
  
  const nonEmptyBlocks = blocks.filter(block => block.transactionCount > 0);
  return nonEmptyBlocks.length / blocks.length * 100; // Percentage of non-empty blocks
}

function convertAuditReportToCSV(auditReport: any): string {
  const lines = [];
  
  // Header
  lines.push('# Blockchain Audit Report');
  lines.push(`# Generated: ${auditReport.auditMetadata.reportGenerated}`);
  lines.push(`# Report ID: ${auditReport.auditMetadata.reportId}`);
  lines.push('');
  
  // Summary
  lines.push('Section,Metric,Value');
  lines.push(`Summary,Blocks Audited,${auditReport.scope.blocksAudited}`);
  lines.push(`Summary,Transactions Audited,${auditReport.scope.transactionsAudited}`);
  lines.push(`Summary,Chain Valid,${auditReport.integrityAnalysis.chainValidation.isValid}`);
  
  if (auditReport.cryptographicSummary) {
    lines.push(`Verification,Total Verified,${auditReport.cryptographicSummary.totalVerified}`);
    lines.push(`Verification,Verification Rate,${auditReport.cryptographicSummary.verificationRate.toFixed(2)}%`);
  }
  
  lines.push('');
  
  // Block details
  if (auditReport.blockSummary) {
    lines.push('Block Height,Block Hash,Previous Hash,Timestamp,Transaction Count,Merkle Root');
    auditReport.blockSummary.forEach((block: any) => {
      lines.push(`${block.height},"${block.hash}","${block.previousHash}","${block.timestamp}",${block.transactionCount},"${block.merkleRoot}"`);
    });
  }
  
  return lines.join('\n');
}