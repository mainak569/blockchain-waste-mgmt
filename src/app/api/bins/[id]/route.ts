import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { Bin } from '@/lib/bins';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { SmartContractEngine } from '@/lib/blockchain/contracts';
import { CONTRACT_TYPES } from '@/lib/blockchain/constants';

interface Report {
  id: string;
  citizenId: string;
  binId: string;
  issueType: string;
  description: string;
  status: 'pending' | 'resolved' | 'investigating';
  pointsAwarded: number;
  createdAt: string;
  resolvedAt?: string;
}

const binsDb = new Database('bins');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bin = await binsDb.findById<Bin>(id);
    
    if (!bin) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }
    
    // Include blockchain data
    try {
      const transactions = await blockchainIntegration.getTransactionsByBinId(id);
      const binWithBlockchainData = {
        ...bin,
        blockchainTransactions: transactions,
        totalTransactions: transactions.length,
        lastBlockchainUpdate: transactions.length > 0 
          ? transactions[transactions.length - 1].timestamp 
          : null,
        blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
      };
      
      return NextResponse.json(binWithBlockchainData);
    } catch (error) {
      console.error(`Error fetching blockchain data for bin ${id}:`, error);
      return NextResponse.json({
        ...bin,
        blockchainTransactions: [],
        totalTransactions: 0,
        lastBlockchainUpdate: null,
        blockchainEnabled: false
      });
    }
  } catch (error) {
    console.error('Error fetching bin:', error);
    return NextResponse.json({ error: 'Failed to fetch bin' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json();
    
    const bin = await binsDb.findById<Bin>(id);
    if (!bin) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }

    const updatedBin = await binsDb.update<Bin>(id, {
      ...updates,
      lastUpdated: new Date().toISOString(),
    });

    // Log blockchain transaction for bin update
    const blockchainTxId = await blockchainIntegration.logBinUpdate(
      id,
      'bin_updated',
      {
        previousState: bin,
        newState: updatedBin,
        changes: updates,
        updateType: 'manual'
      },
      'System'
    );

    // Execute smart contracts for capacity monitoring
    const smartContractEngine = new SmartContractEngine();
    
    // Check if capacity monitoring contract should be triggered
    if (updates.fillLevel !== undefined) {
      try {
        const contractResult = await smartContractEngine.executeContract(
          CONTRACT_TYPES.BIN_CAPACITY_MONITOR,
          {
            currentState: {
              binId: id,
              binCapacity: updates.fillLevel,
              previousCapacity: bin.fillLevel
            },
            blockHeight: 0 // This would be actual block height in production
          }
        );

        // Process any new transactions from smart contract execution
        if (contractResult.success && contractResult.newTransactions.length > 0) {
          for (const transaction of contractResult.newTransactions) {
            await blockchainIntegration.logSystemEvent(
              transaction.action,
              transaction.data,
              'SmartContract'
            );
          }
        }
      } catch (contractError) {
        console.error('Smart contract execution failed:', contractError);
        // Continue with graceful degradation
      }
    }

    // Auto-resolve reports if bin status is fixed (Empty or Normal)
    if (updates.status === 'Empty' || updates.status === 'Normal') {
      const reportsDb = new Database('reports');
      const reports = await reportsDb.read<Report>();
      const pendingReports = reports.filter((r) => 
        r.binId === id && 
        (r.status === 'pending' || r.status === 'investigating')
      );
      
      for (const report of pendingReports) {
        await reportsDb.update<Report>(report.id, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });

        // Log blockchain transaction for report resolution
        await blockchainIntegration.logSystemEvent(
          'report_auto_resolved',
          {
            reportId: report.id,
            binId: id,
            resolvedBy: 'bin_status_change',
            newBinStatus: updates.status
          },
          'System'
        );
      }
    }

    // Log activity
    const activitiesDb = new Database('activities');
    await activitiesDb.create({
      id: `activity-${Date.now()}`,
      type: 'info',
      message: `Bin ${id} updated: ${JSON.stringify(updates)}`,
      user: 'System',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ...updatedBin,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    });
  } catch (error) {
    console.error('Error updating bin:', error);
    return NextResponse.json({ error: 'Failed to update bin' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get bin data before deletion for blockchain logging
    const bin = await binsDb.findById<Bin>(id);
    if (!bin) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }

    const deleted = await binsDb.delete(id);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete bin' }, { status: 500 });
    }

    // Log blockchain transaction for bin deletion
    const blockchainTxId = await blockchainIntegration.logBinUpdate(
      id,
      'bin_deleted',
      {
        deletedBin: bin,
        deletionTime: new Date().toISOString(),
        deletionReason: 'administrative_action'
      },
      'Admin'
    );

    // Log activity
    const activitiesDb = new Database('activities');
    await activitiesDb.create({
      id: `activity-${Date.now()}`,
      type: 'warning',
      message: `Bin ${id} deleted from system`,
      user: 'Admin',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    });
  } catch (error) {
    console.error('Error deleting bin:', error);
    return NextResponse.json({ error: 'Failed to delete bin' }, { status: 500 });
  }
}

