type Transaction = {
  id: string;
  binId: string;
  action: string;
  timestamp: string;
};

const blockchainLog: Transaction[] = [];

export function logToBlockchain(binId: string, action: string) {
  const tx = {
    id: `TX-${Date.now()}`,
    binId,
    action,
    timestamp: new Date().toISOString(),
  };
  blockchainLog.push(tx);
  return tx;
}

export function getBlockchainLog() {
  return blockchainLog;
}
