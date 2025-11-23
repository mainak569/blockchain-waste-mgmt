import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { blockchainIntegration } from '@/lib/blockchain-integration';

const blockchainDb = new Database('blockchain');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const binId = searchParams.get('binId');
    const format = searchParams.get('format') as 'json' | 'csv' | null;
    const action = searchParams.get('action');

    // Handle export requests
    if (action === 'export' && format) {
      const exportData = await blockchainIntegration.exportChain(format);
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `blockchain-export-${new Date().toISOString().split('T')[0]}.${format}`;
      
      return new Response(exportData, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Handle stats requests
    if (action === 'stats') {
      const stats = await blockchainIntegration.getBlockchainStats();
      return NextResponse.json(stats);
    }

    // Handle validation requests
    if (action === 'validate') {
      const validation = await blockchainIntegration.validateChain();
      return NextResponse.json(validation);
    }

    // Handle migration requests
    if (action === 'migrate') {
      const migrationResult = await blockchainIntegration.migrateExistingTransactions();
      return NextResponse.json(migrationResult);
    }

    // Handle service status requests
    if (action === 'status') {
      const status = blockchainIntegration.getServiceStatus();
      return NextResponse.json(status);
    }

    // Handle bin-specific transaction queries
    if (binId) {
      const transactions = await blockchainIntegration.getTransactionsByBinId(binId);
      return NextResponse.json(transactions.slice(0, limit));
    }

    // Default: get recent transactions (legacy + blockchain)
    let transactions = await blockchainDb.read();
    
    // Sort by timestamp (newest first) and limit
    transactions = transactions
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // Add service status to response
    const serviceStatus = blockchainIntegration.getServiceStatus();
    
    return NextResponse.json({
      transactions,
      serviceStatus,
      total: transactions.length
    });
  } catch (error) {
    console.error('Error fetching blockchain data:', error);
    return NextResponse.json({ error: 'Failed to fetch blockchain data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { binId, action, contractorId, citizenId, data } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    // Log transaction through blockchain integration service
    let blockchainTxId: string | null = null;
    
    if (contractorId) {
      blockchainTxId = await blockchainIntegration.logPickupConfirmation(
        binId || 'unknown',
        contractorId,
        action,
        data || {}
      );
    } else if (citizenId) {
      blockchainTxId = await blockchainIntegration.logIssueReport(
        binId || 'unknown',
        citizenId,
        action,
        data || {}
      );
    } else if (binId) {
      blockchainTxId = await blockchainIntegration.logBinUpdate(
        binId,
        action,
        data || {},
        'API'
      );
    } else {
      blockchainTxId = await blockchainIntegration.logSystemEvent(
        action,
        data || {},
        'API'
      );
    }

    // Keep legacy transaction for backward compatibility
    const tx = {
      id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      binId,
      action,
      contractorId: contractorId || 'system',
      citizenId,
      timestamp: new Date().toISOString(),
    };

    const created = await blockchainDb.create(tx);
    
    return NextResponse.json({
      ...created,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
