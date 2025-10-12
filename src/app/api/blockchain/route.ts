import { NextResponse } from 'next/server';
import { logToBlockchain, getBlockchainLog } from '@/lib/blockchain';

export async function GET() {
  return NextResponse.json(getBlockchainLog());
}

export async function POST(req: Request) {
  const { binId, action } = await req.json();
  const tx = logToBlockchain(binId, action);
  return NextResponse.json(tx);
}
