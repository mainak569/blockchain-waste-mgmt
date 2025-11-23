import { NextResponse } from 'next/server';
import { Database, initializeDefaultData } from '@/lib/db';
import { Bin } from '@/lib/bins';
import { blockchainIntegration } from '@/lib/blockchain-integration';
import { initializeBlockchain } from '@/lib/blockchain-init';

const binsDb = new Database('bins');

// Ensure initialization happens
let initPromise: Promise<void> | null = null;
let iotStarted = false;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeDefaultData();
  }
  await initPromise;
  
  // Initialize blockchain integration
  await initializeBlockchain();
  
  // Start IoT simulation after initialization (only once)
  if (!iotStarted && typeof window === 'undefined') {
    iotStarted = true;
    try {
      const { startIoTSimulation } = await import('@/lib/iot-simulator');
      startIoTSimulation(30000); // Update every 30 seconds
    } catch (error) {
      console.error('Failed to start IoT simulation:', error);
    }
  }
}

export async function GET() {
  try {
    await ensureInitialized();
    const bins = await binsDb.read<Bin>();
    
    // Include blockchain data for each bin
    const binsWithBlockchainData = await Promise.all(
      bins.map(async (bin) => {
        try {
          const transactions = await blockchainIntegration.getTransactionsByBinId(bin.id);
          return {
            ...bin,
            blockchainTransactions: transactions.length,
            lastBlockchainUpdate: transactions.length > 0 
              ? transactions[transactions.length - 1].timestamp 
              : null,
            blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
          };
        } catch (error) {
          console.error(`Error fetching blockchain data for bin ${bin.id}:`, error);
          return {
            ...bin,
            blockchainTransactions: 0,
            lastBlockchainUpdate: null,
            blockchainEnabled: false
          };
        }
      })
    );
    
    return NextResponse.json(binsWithBlockchainData);
  } catch (error) {
    console.error('Error fetching bins:', error);
    return NextResponse.json({ error: 'Failed to fetch bins' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = await req.json();
    const { location, fillLevel = 0, gasLevel = 0, status = 'Empty' } = body;
    
    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    // Generate new bin ID
    const existingBins = await binsDb.read<Bin>();
    const binNumber = existingBins.length + 1;
    const binId = `BIN${binNumber.toString().padStart(3, '0')}`;

    const newBin: Bin = {
      id: binId,
      location,
      fillLevel,
      gasLevel,
      status,
      lastUpdated: new Date().toISOString(),
    };

    const created = await binsDb.create(newBin);
    
    // Log blockchain transaction
    const blockchainTxId = await blockchainIntegration.logBinUpdate(
      binId,
      'bin_created',
      {
        location,
        fillLevel,
        gasLevel,
        status,
        initialCreation: true
      },
      'Admin'
    );
    
    // Log activity
    const activitiesDb = new Database('activities');
    await activitiesDb.create({
      id: `activity-${Date.now()}`,
      type: 'info',
      message: `New bin ${binId} added at ${location}`,
      user: 'Admin',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ...created,
      blockchainTransactionId: blockchainTxId,
      blockchainEnabled: blockchainIntegration.getServiceStatus().mode === 'blockchain'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating bin:', error);
    return NextResponse.json({ error: 'Failed to create bin' }, { status: 500 });
  }
}
