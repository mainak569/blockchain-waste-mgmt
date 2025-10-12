import { NextResponse } from 'next/server';
import { bins } from '@/lib/bins';

export async function GET() {
  return NextResponse.json(bins);
}
