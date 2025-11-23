import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { Contractor } from '../route';
import { blockchainIntegration } from '@/lib/blockchain-integration';

const contractorsDb = new Database('contractors');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractor = await contractorsDb.findById<Contractor>(id);
    
    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }
    
    return NextResponse.json(contractor);
  } catch (error) {
    console.error('Error fetching contractor:', error);
    return NextResponse.json({ error: 'Failed to fetch contractor' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json();
    
    const contractor = await contractorsDb.findById<Contractor>(id);
    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const updated = await contractorsDb.update<Contractor>(id, updates);
    
    // Log blockchain transaction for contractor update
    const blockchainTxId = await blockchainIntegration.logSystemEvent(
      'contractor_updated',
      {
        contractorId: id,
        updates,
        previousData: {
          name: contractor.name,
          email: contractor.email,
          todaysEarnings: contractor.todaysEarnings,
          completedPickups: contractor.completedPickups
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
    console.error('Error updating contractor:', error);
    return NextResponse.json({ error: 'Failed to update contractor' }, { status: 500 });
  }
}

