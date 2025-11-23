import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { Bin } from '@/lib/bins';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { BlockchainManager } from '@/lib/blockchain/manager';
import { CONTRACT_TYPES } from '@/lib/blockchain/constants';
import { Report } from '@/app/api/reports/route';
import { Contractor } from '@/app/api/contractors/route';

const contractorsDb = new Database('contractors');
const binsDb = new Database('bins');
const activitiesDb = new Database('activities');
const blockchainDb = new Database('blockchain');

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractorId } = await params;
    const body = await req.json();
    const { binId, action = 'Collected' } = body;

    if (!binId) {
      return NextResponse.json(
        { error: 'binId is required' },
        { status: 400 }
      );
    }

    const contractor = await contractorsDb.findById<any>(contractorId);
    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const bin = await binsDb.findById<Bin>(binId);
    if (!bin) {
      return NextResponse.json({ error: 'Bin not found' }, { status: 404 });
    }

    // Update bin status
    const newStatus = action === 'Collected' ? 'Empty' : 
                     action === 'Hazard_Resolved' ? 'Normal' : bin.status;
    
    await binsDb.update<Bin>(binId, {
      status: newStatus,
      fillLevel: action === 'Collected' ? 0 : bin.fillLevel,
      lastUpdated: new Date().toISOString(),
    });

    // Auto-resolve reports when bin is fixed
    let resolvedReportsCount = 0;
    if (newStatus === 'Empty' || newStatus === 'Normal') {
      const reportsDb = new Database('reports');
      const reports = await reportsDb.read();
      const pendingReports = reports.filter((r: any) => 
        r.binId === binId && 
        (r.status === 'pending' || r.status === 'investigating')
      ) as Report[];
      
      resolvedReportsCount = pendingReports.length;
      
      for (const report of pendingReports) {
        await reportsDb.update<Report>(report.id, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>);
      }
    }

    // Execute smart contract for earnings calculation
    let calculatedEarnings = 25.00; // Base earnings
    let smartContractResults = null;
    
    try {
      // Initialize blockchain manager for smart contract execution
      const blockchainManager = new BlockchainManager();
      await blockchainManager.initialize();
      
      // Execute pickup validator contract
      smartContractResults = await blockchainManager.executeSmartContract(
        CONTRACT_TYPES.PICKUP_VALIDATOR,
        {
          transaction: {
            type: 'pickup_confirmation',
            binId,
            contractorId,
            action,
            data: {
              previousFillLevel: bin.fillLevel,
              newFillLevel: action === 'Collected' ? 0 : bin.fillLevel,
              binStatus: newStatus
            }
          },
          currentState: {
            binCapacity: bin.fillLevel,
            binId,
            contractorId
          },
          blockHeight: await blockchainManager.getLatestBlock().then(b => b?.header.height || 0)
        }
      );

      // Execute earnings calculator contract for bonus calculations
      const earningsResults = await blockchainManager.executeSmartContract(
        CONTRACT_TYPES.EARNINGS_CALCULATOR,
        {
          transaction: {
            action: 'calculate_earnings',
            contractorId,
            binId,
            data: { baseEarnings: calculatedEarnings }
          },
          currentState: {
            binCapacity: bin.fillLevel,
            binId,
            contractorId
          }
        }
      );

      // Extract calculated earnings from smart contract results
      if (earningsResults.success && earningsResults.newTransactions.length > 0) {
        const earningsTransaction = earningsResults.newTransactions.find(tx => 
          tx.action === 'earnings_calculated'
        );
        if (earningsTransaction?.data?.totalEarnings) {
          calculatedEarnings = earningsTransaction.data.totalEarnings;
        }
      }
    } catch (error) {
      console.error('Smart contract execution failed, using base earnings:', error);
      // Graceful degradation - continue with base earnings
    }

    // Update contractor earnings and stats with calculated earnings
    const newEarnings = (contractor.todaysEarnings || 0) + calculatedEarnings;
    const newPickups = (contractor.completedPickups || 0) + 1;
    const newWeeklyPickups = (contractor.weeklyStats?.pickupsCompleted || 0) + 1;
    const newWeeklyEarnings = (contractor.weeklyStats?.totalEarnings || 0) + calculatedEarnings;

    await contractorsDb.update<Contractor>(contractorId, {
      todaysEarnings: newEarnings,
      completedPickups: newPickups,
      weeklyStats: {
        ...contractor.weeklyStats,
        pickupsCompleted: newWeeklyPickups,
        totalEarnings: newWeeklyEarnings,
      },
    } as unknown as Record<string, unknown>);

    // Log blockchain transaction with smart contract results
    const blockchainTxId = await blockchainIntegration.logPickupConfirmation(
      binId,
      contractorId,
      action,
      {
        earnings: calculatedEarnings,
        baseEarnings: 25.00,
        bonusEarnings: calculatedEarnings - 25.00,
        binStatus: newStatus,
        previousFillLevel: bin.fillLevel,
        newFillLevel: action === 'Collected' ? 0 : bin.fillLevel,
        resolvedReports: resolvedReportsCount,
        smartContractExecuted: smartContractResults?.success || false,
        smartContractActions: smartContractResults?.actions || []
      }
    );

    // Keep legacy transaction for backward compatibility
    const tx = {
      id: `TX-${Date.now()}`,
      binId,
      action,
      contractorId,
      timestamp: new Date().toISOString(),
      earnings: calculatedEarnings,
    };
    await blockchainDb.create(tx);

    // Log activity
    await activitiesDb.create({
      id: `activity-${Date.now()}`,
      type: 'success',
      message: `Contractor ${contractor.name} ${action.toLowerCase()} ${binId}. Earned $${calculatedEarnings.toFixed(2)}`,
      user: contractor.name,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      bin: await binsDb.findById<Bin>(binId),
      earnings: calculatedEarnings,
      baseEarnings: 25.00,
      bonusEarnings: calculatedEarnings - 25.00,
      totalEarnings: newEarnings,
      transaction: tx,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain',
      smartContractExecuted: smartContractResults?.success || false,
      smartContractActions: smartContractResults?.actions || []
    });
  } catch (error) {
    console.error('Error processing pickup:', error);
    return NextResponse.json({ error: 'Failed to process pickup' }, { status: 500 });
  }
}

