import { NextResponse } from 'next/server';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { BlockchainManager } from '@/lib/blockchain/manager';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractorId } = await params;
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Get blockchain transaction history for contractor
    const transactions = await getContractorTransactions(contractorId, limit, offset);
    
    // Get blockchain verification status
    const blockchainStatus = blockchainIntegration.getServiceStatus();
    
    return NextResponse.json({
      transactions,
      total: transactions.length,
      limit,
      offset,
      blockchainEnabled: blockchainStatus.mode === 'blockchain',
      blockchainStatus
    });
  } catch (error) {
    console.error('Error fetching contractor transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

async function getContractorTransactions(contractorId: string, limit: number, offset: number) {
  try {
    // Initialize blockchain manager
    const blockchainManager = new BlockchainManager();
    await blockchainManager.initialize();
    
    // Get all transactions for this contractor
    const allTransactions = await blockchainManager.getTransactionsByContractorId(contractorId);
    
    // Sort by timestamp (newest first) and apply pagination
    const sortedTransactions = allTransactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
    
    // Enrich transactions with additional metadata
    const enrichedTransactions = await Promise.all(
      sortedTransactions.map(async (tx) => {
        try {
          // Get block information for this transaction
          const block = await blockchainManager.getBlockByTransactionId(tx.id);
          
          return {
            ...tx,
            blockHeight: block?.header.height,
            blockHash: block?.header.hash,
            blockTimestamp: block?.header.timestamp,
            verified: true,
            type: getTransactionTypeLabel(tx.type),
            description: generateTransactionDescription(tx)
          };
        } catch (error) {
          console.error(`Error enriching transaction ${tx.id}:`, error);
          return {
            ...tx,
            verified: false,
            type: getTransactionTypeLabel(tx.type),
            description: generateTransactionDescription(tx)
          };
        }
      })
    );
    
    return enrichedTransactions;
  } catch (error) {
    console.error('Error getting contractor transactions from blockchain:', error);
    
    // Fallback to legacy transactions if blockchain fails
    try {
      const legacyTransactions = await getLegacyContractorTransactions(contractorId, limit, offset);
      return legacyTransactions.map(tx => {
        const txData = tx as any;
        return {
          ...txData,
          verified: false,
          type: 'Legacy Transaction',
          description: `${txData.action} - ${txData.binId || 'System Event'}`,
          blockHeight: null,
          blockHash: null,
          blockTimestamp: null
        };
      });
    } catch (legacyError) {
      console.error('Error getting legacy transactions:', legacyError);
      return [];
    }
  }
}

async function getLegacyContractorTransactions(contractorId: string, limit: number, offset: number) {
  // This would get legacy transactions from the old system
  // For now, return empty array as we're focusing on blockchain integration
  return [];
}

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'pickup_confirmation':
      return 'Pickup Confirmation';
    case 'bin_update':
      return 'Bin Update';
    case 'smart_contract_execution':
      return 'Smart Contract';
    case 'system_event':
      return 'System Event';
    default:
      return 'Unknown';
  }
}

function generateTransactionDescription(tx: any): string {
  switch (tx.type) {
    case 'pickup_confirmation':
      return `Pickup confirmed for ${tx.binId} - Earned $${tx.data?.earnings || 0}`;
    case 'smart_contract_execution':
      if (tx.action === 'calculate_earnings') {
        return `Earnings calculated: $${tx.data?.totalEarnings || 0} (Base: $${tx.data?.baseEarnings || 0}, Bonus: $${tx.data?.bonusEarnings || 0})`;
      }
      return `Smart contract executed: ${tx.action}`;
    case 'system_event':
      if (tx.action === 'contractor_registered') {
        return 'Contractor account created';
      } else if (tx.action === 'contractor_updated') {
        return 'Contractor profile updated';
      }
      return `System event: ${tx.action}`;
    default:
      return `${tx.action} - ${tx.binId || 'System'}`;
  }
}