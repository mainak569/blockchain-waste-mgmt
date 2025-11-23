import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { Citizen } from '../route';

const citizensDb = new Database('citizens');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const citizen = await citizensDb.findById<Citizen>(id);
    
    if (!citizen) {
      return NextResponse.json({ error: 'Citizen not found' }, { status: 404 });
    }
    
    // Get blockchain transaction history for this citizen
    const transactions = await blockchainIntegration.getTransactionsByCitizenId(id);
    
    return NextResponse.json({
      ...citizen,
      blockchainTransactions: transactions,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    });
  } catch (error) {
    console.error('Error fetching citizen:', error);
    return NextResponse.json({ error: 'Failed to fetch citizen' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json();
    
    const citizen = await citizensDb.findById<Citizen>(id);
    if (!citizen) {
      return NextResponse.json({ error: 'Citizen not found' }, { status: 404 });
    }

    const updated = await citizensDb.update<Citizen>(id, updates);
    
    // Log blockchain transaction for citizen update
    const blockchainTxId = await blockchainIntegration.logSystemEvent(
      'citizen_updated',
      {
        citizenId: id,
        updates,
        previousData: {
          points: citizen.points,
          reportsSubmitted: citizen.reportsSubmitted
        }
      },
      'System'
    );
    
    return NextResponse.json({
      ...updated,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    });
  } catch (error) {
    console.error('Error updating citizen:', error);
    return NextResponse.json({ error: 'Failed to update citizen' }, { status: 500 });
  }
}

