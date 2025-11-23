import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { blockchainIntegration } from '@/lib/blockchain-integration';

const citizensDb = new Database('citizens');

export interface Citizen {
  id: string;
  name: string;
  email: string;
  points: number;
  reportsSubmitted: number;
  environmentalImpact: {
    co2Saved: number;
    wasteDisposed: number;
    recyclingRate: number;
  };
  createdAt: string;
}

export async function GET() {
  try {
    const citizens = await citizensDb.read<Citizen>();
    return NextResponse.json(citizens);
  } catch (error) {
    console.error('Error fetching citizens:', error);
    return NextResponse.json({ error: 'Failed to fetch citizens' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const citizen: Citizen = {
      id: `citizen-${Date.now()}`,
      name,
      email,
      points: 0,
      reportsSubmitted: 0,
      environmentalImpact: {
        co2Saved: 0,
        wasteDisposed: 0,
        recyclingRate: 0,
      },
      createdAt: new Date().toISOString(),
    };

    const created = await citizensDb.create(citizen);
    
    // Log blockchain transaction
    const blockchainTxId = await blockchainIntegration.logSystemEvent(
      'citizen_registered',
      {
        citizenId: citizen.id,
        name: citizen.name,
        email: citizen.email
      },
      'System'
    );
    
    return NextResponse.json({
      ...created,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating citizen:', error);
    return NextResponse.json({ error: 'Failed to create citizen' }, { status: 500 });
  }
}

