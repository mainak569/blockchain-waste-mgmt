import { NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { Bin } from '@/lib/bins';
import { BlockchainManager } from '@/lib/blockchain/manager';

const binsDb = new Database('bins');
const activitiesDb = new Database('activities');
const blockchainDb = new Database('blockchain');
const citizensDb = new Database('citizens');
const contractorsDb = new Database('contractors');
const blockchainManager = new BlockchainManager();

export async function GET() {
  try {
    const bins = await binsDb.read<Bin>();
    const activities = await activitiesDb.read();
    const transactions = await blockchainDb.read();
    const citizens = await citizensDb.read();
    const contractors = await contractorsDb.read();

    // Get blockchain-specific metrics
    let blockchainStats = null;
    let chainValidation = null;
    try {
      await blockchainManager.initialize();
      blockchainStats = await blockchainManager.getBlockchainStats();
      chainValidation = await blockchainManager.validateChain();
    } catch (blockchainError) {
      console.warn('Blockchain analytics unavailable:', blockchainError);
    }

    // Calculate traditional stats
    const stats = {
      totalBins: bins.length,
      fullBins: bins.filter(b => b.status === 'Full').length,
      normalBins: bins.filter(b => b.status === 'Normal').length,
      emptyBins: bins.filter(b => b.status === 'Empty').length,
      hazardBins: bins.filter(b => b.status === 'Hazard').length,
      avgFillLevel: bins.length > 0 
        ? Math.round(bins.reduce((sum, bin) => sum + bin.fillLevel, 0) / bins.length) 
        : 0,
      totalTransactions: transactions.length,
      totalCitizens: citizens.length,
      totalContractors: contractors.length,
      totalActivities: activities.length,
      todayCollections: transactions.filter((t: any) => {
        const txDate = new Date(t.timestamp);
        const today = new Date();
        return txDate.toDateString() === today.toDateString() && t.action === 'Collected';
      }).length,
      weeklyCollections: transactions.filter((t: any) => {
        const txDate = new Date(t.timestamp);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return txDate >= weekAgo && t.action === 'Collected';
      }).length,
      monthlyCollections: transactions.filter((t: any) => {
        const txDate = new Date(t.timestamp);
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return txDate >= monthAgo && t.action === 'Collected';
      }).length,
      
      // Enhanced blockchain metrics
      blockchain: blockchainStats ? {
        chainHeight: blockchainStats.chainHeight,
        totalBlockchainTransactions: blockchainStats.totalTransactions,
        pendingTransactions: blockchainStats.pendingTransactions,
        latestBlockHash: blockchainStats.latestBlockHash,
        lastUpdated: blockchainStats.lastUpdated,
        chainIntegrity: chainValidation ? {
          isValid: chainValidation.isValid,
          errorCount: chainValidation.errors.length
        } : null,
        activeContracts: blockchainStats.activeContracts,
        averageTransactionAge: blockchainStats.averageTransactionAge
      } : {
        status: 'unavailable',
        message: 'Blockchain analytics not available'
      }
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

