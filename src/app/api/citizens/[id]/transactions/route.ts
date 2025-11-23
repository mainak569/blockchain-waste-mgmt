import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { Citizen } from '../../route';

const citizensDb = new Database('citizens');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify citizen exists
    const citizen = await citizensDb.findById<Citizen>(id);
    if (!citizen) {
      return NextResponse.json({ error: 'Citizen not found' }, { status: 404 });
    }

    // Get blockchain transaction history for this citizen
    const transactions = await blockchainIntegration.getTransactionsByCitizenId(id);
    
    // Sort transactions by timestamp (newest first)
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      citizenId: id,
      citizenName: citizen.name,
      transactions: sortedTransactions,
      totalTransactions: sortedTransactions.length,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    });
  } catch (error) {
    console.error('Error fetching citizen transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch citizen transactions' }, { status: 500 });
  }
}