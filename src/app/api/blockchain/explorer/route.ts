import { NextResponse } from 'next/server';
import { BlockchainManager } from '@/lib/blockchain/manager';

const blockchainManager = new BlockchainManager();

export async function GET(request: Request) {
  try {
    await blockchainManager.initialize();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'blocks';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const height = searchParams.get('height');
    const transactionId = searchParams.get('transactionId');

    switch (type) {
      case 'blocks':
        return NextResponse.json(await getBlocks(page, limit, search));
      
      case 'block':
        if (!height) {
          return NextResponse.json({ error: 'Block height required' }, { status: 400 });
        }
        return NextResponse.json(await getBlockDetails(parseInt(height)));
      
      case 'transaction':
        if (!transactionId) {
          return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
        }
        return NextResponse.json(await getTransactionDetails(transactionId));
      
      case 'search':
        if (!search) {
          return NextResponse.json({ error: 'Search query required' }, { status: 400 });
        }
        return NextResponse.json(await searchBlockchain(search));
      
      case 'latest':
        return NextResponse.json(await getLatestActivity());
      
      default:
        return NextResponse.json({ error: 'Invalid explorer type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in blockchain explorer:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch blockchain data',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

async function getBlocks(page: number, limit: number, search?: string | null) {
  const stats = await blockchainManager.getBlockchainStats();
  const totalBlocks = stats.chainHeight + 1;
  
  // Calculate pagination
  const offset = (page - 1) * limit;
  const startHeight = Math.max(0, stats.chainHeight - offset);
  const endHeight = Math.max(0, startHeight - limit + 1);
  
  const blocks = [];
  for (let height = startHeight; height >= endHeight; height--) {
    const block = await blockchainManager.getBlockByHeight(height);
    if (block) {
      // Filter by search if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesHash = block.header.hash.toLowerCase().includes(searchLower);
        const matchesPrevHash = block.header.previousHash.toLowerCase().includes(searchLower);
        const matchesHeight = height.toString().includes(search);
        
        if (!matchesHash && !matchesPrevHash && !matchesHeight) {
          continue;
        }
      }
      
      blocks.push({
        height: block.header.height,
        hash: block.header.hash,
        previousHash: block.header.previousHash,
        timestamp: block.header.timestamp,
        transactionCount: block.body.transactionCount,
        merkleRoot: block.header.merkleRoot,
        nonce: block.header.nonce,
        size: JSON.stringify(block).length
      });
    }
  }
  
  return {
    blocks,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalBlocks / limit),
      totalBlocks,
      limit,
      hasNext: page * limit < totalBlocks,
      hasPrev: page > 1
    }
  };
}

async function getBlockDetails(height: number) {
  const block = await blockchainManager.getBlockByHeight(height);
  if (!block) {
    return { error: 'Block not found' };
  }

  // Get previous and next blocks for navigation
  const prevBlock = height > 0 ? await blockchainManager.getBlockByHeight(height - 1) : null;
  const nextBlock = await blockchainManager.getBlockByHeight(height + 1);

  // Add cryptographic proofs to transactions
  const transactionsWithProofs = await Promise.all(
    block.body.transactions.map(async (tx) => {
      const proof = (tx as any)._proof;
      const isVerified = proof ? 
        await blockchainManager.verifyTransactionProof(tx, proof, block.header.hash, block.header.height) :
        false;
      
      return {
        ...tx,
        verified: isVerified,
        hasProof: !!proof,
        blockHeight: block.header.height,
        blockHash: block.header.hash
      };
    })
  );

  return {
    block: {
      header: block.header,
      body: {
        ...block.body,
        transactions: transactionsWithProofs
      },
      metadata: {
        size: JSON.stringify(block).length,
        age: Date.now() - new Date(block.header.timestamp).getTime(),
        isGenesis: height === 0
      }
    },
    navigation: {
      previous: prevBlock ? {
        height: prevBlock.header.height,
        hash: prevBlock.header.hash
      } : null,
      next: nextBlock ? {
        height: nextBlock.header.height,
        hash: nextBlock.header.hash
      } : null
    }
  };
}

async function getTransactionDetails(transactionId: string) {
  const transaction = await blockchainManager.getTransaction(transactionId);
  if (!transaction) {
    return { error: 'Transaction not found' };
  }

  // Get the block containing this transaction
  const block = await blockchainManager.getBlockByTransactionId(transactionId);
  
  // Verify cryptographic proof if available
  const proof = (transaction as any)._proof;
  const blockHash = (transaction as any)._blockHash;
  const blockHeight = (transaction as any)._blockHeight;
  
  let isVerified = false;
  if (proof && blockHash && blockHeight !== undefined) {
    isVerified = await blockchainManager.verifyTransactionProof(
      transaction, 
      proof, 
      blockHash, 
      blockHeight
    );
  }

  return {
    transaction: {
      ...transaction,
      verified: isVerified,
      hasProof: !!proof,
      isPending: !!(transaction as any)._pending
    },
    block: block ? {
      height: block.header.height,
      hash: block.header.hash,
      timestamp: block.header.timestamp,
      transactionIndex: block.body.transactions.findIndex(tx => tx.id === transactionId)
    } : null,
    metadata: {
      age: Date.now() - new Date(transaction.timestamp).getTime(),
      size: JSON.stringify(transaction).length
    }
  };
}

async function searchBlockchain(query: string) {
  const results = {
    blocks: [] as any[],
    transactions: [] as any[],
    query,
    searchType: 'unknown'
  };

  // Determine search type based on query format
  if (query.match(/^[0-9]+$/)) {
    // Numeric query - could be block height
    results.searchType = 'height';
    const height = parseInt(query);
    const block = await blockchainManager.getBlockByHeight(height);
    if (block) {
      results.blocks.push({
        height: block.header.height,
        hash: block.header.hash,
        timestamp: block.header.timestamp,
        transactionCount: block.body.transactionCount
      });
    }
  } else if (query.match(/^[a-fA-F0-9]{64}$/)) {
    // 64-character hex string - could be hash
    results.searchType = 'hash';
    
    // Search for block by hash
    const stats = await blockchainManager.getBlockchainStats();
    for (let height = 0; height <= stats.chainHeight; height++) {
      const block = await blockchainManager.getBlockByHeight(height);
      if (block && (block.header.hash === query || block.header.previousHash === query)) {
        results.blocks.push({
          height: block.header.height,
          hash: block.header.hash,
          timestamp: block.header.timestamp,
          transactionCount: block.body.transactionCount,
          matchType: block.header.hash === query ? 'current_hash' : 'previous_hash'
        });
      }
    }
  } else if (query.match(/^[a-fA-F0-9-]{36}$/)) {
    // UUID format - could be transaction ID
    results.searchType = 'transaction_id';
    const transaction = await blockchainManager.getTransaction(query);
    if (transaction) {
      const block = await blockchainManager.getBlockByTransactionId(query);
      results.transactions.push({
        id: transaction.id,
        type: transaction.type,
        action: transaction.action,
        timestamp: transaction.timestamp,
        blockHeight: block?.header.height,
        blockHash: block?.header.hash,
        isPending: !!(transaction as any)._pending
      });
    }
  } else {
    // Text search - search in transaction data
    results.searchType = 'text';
    const stats = await blockchainManager.getBlockchainStats();
    
    for (let height = 0; height <= stats.chainHeight; height++) {
      const block = await blockchainManager.getBlockByHeight(height);
      if (block) {
        for (const tx of block.body.transactions) {
          const searchableText = [
            tx.action,
            tx.type,
            tx.binId,
            tx.contractorId,
            tx.citizenId,
            JSON.stringify(tx.data)
          ].join(' ').toLowerCase();
          
          if (searchableText.includes(query.toLowerCase())) {
            results.transactions.push({
              id: tx.id,
              type: tx.type,
              action: tx.action,
              timestamp: tx.timestamp,
              blockHeight: block.header.height,
              blockHash: block.header.hash,
              matchReason: 'content_match'
            });
          }
        }
      }
    }
  }

  return results;
}

async function getLatestActivity() {
  const latestBlock = await blockchainManager.getLatestBlock();
  const stats = await blockchainManager.getBlockchainStats();
  
  // Get recent blocks (last 5)
  const recentBlocks = [];
  const startHeight = Math.max(0, stats.chainHeight - 4);
  
  for (let height = stats.chainHeight; height >= startHeight; height--) {
    const block = await blockchainManager.getBlockByHeight(height);
    if (block) {
      recentBlocks.push({
        height: block.header.height,
        hash: block.header.hash,
        timestamp: block.header.timestamp,
        transactionCount: block.body.transactionCount,
        age: Date.now() - new Date(block.header.timestamp).getTime()
      });
    }
  }

  // Get recent transactions (last 10 across all recent blocks)
  const recentTransactions = [];
  for (const blockInfo of recentBlocks) {
    const block = await blockchainManager.getBlockByHeight(blockInfo.height);
    if (block) {
      for (const tx of block.body.transactions) {
        recentTransactions.push({
          id: tx.id,
          type: tx.type,
          action: tx.action,
          timestamp: tx.timestamp,
          blockHeight: block.header.height,
          age: Date.now() - new Date(tx.timestamp).getTime()
        });
      }
    }
  }

  // Sort transactions by timestamp and take the most recent 10
  recentTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    latestBlock: latestBlock ? {
      height: latestBlock.header.height,
      hash: latestBlock.header.hash,
      timestamp: latestBlock.header.timestamp,
      transactionCount: latestBlock.body.transactionCount
    } : null,
    recentBlocks,
    recentTransactions: recentTransactions.slice(0, 10),
    chainStats: {
      height: stats.chainHeight,
      totalTransactions: stats.totalTransactions,
      pendingTransactions: stats.pendingTransactions
    }
  };
}