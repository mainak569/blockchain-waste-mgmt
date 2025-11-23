/**
 * Cryptographic utilities for blockchain operations
 */

import { createHash, createSign, createVerify, randomBytes } from 'crypto';
import { Transaction, Block } from './types';

/**
 * Calculate SHA-256 hash of input data
 */
export function calculateHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate hash for a transaction
 */
export function calculateTransactionHash(transaction: Omit<Transaction, 'hash'>): string {
  const transactionData = {
    id: transaction.id,
    type: transaction.type,
    binId: transaction.binId,
    contractorId: transaction.contractorId,
    citizenId: transaction.citizenId,
    action: transaction.action,
    data: transaction.data,
    timestamp: transaction.timestamp,
    signature: transaction.signature
  };
  
  const dataString = JSON.stringify(transactionData, Object.keys(transactionData).sort());
  return calculateHash(dataString);
}

/**
 * Calculate hash for a block
 */
export function calculateBlockHash(block: Block): string {
  const headerData = {
    height: block.header.height,
    previousHash: block.header.previousHash,
    merkleRoot: block.header.merkleRoot,
    timestamp: block.header.timestamp,
    nonce: block.header.nonce
  };
  
  const dataString = JSON.stringify(headerData, Object.keys(headerData).sort());
  return calculateHash(dataString);
}

/**
 * Calculate Merkle root from array of transaction hashes
 */
export function calculateMerkleRoot(transactionHashes: string[]): string {
  if (transactionHashes.length === 0) {
    return calculateHash('');
  }
  
  if (transactionHashes.length === 1) {
    return transactionHashes[0];
  }
  
  // Build Merkle tree bottom-up
  let currentLevel = [...transactionHashes];
  
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = calculateHash(left + right);
      nextLevel.push(combined);
    }
    
    currentLevel = nextLevel;
  }
  
  return currentLevel[0];
}

/**
 * Generate a simple signature for a transaction (simplified for MVP)
 * In production, this would use proper public/private key cryptography
 */
export function signTransaction(transaction: Omit<Transaction, 'signature' | 'hash'>, privateKey?: string): string {
  const transactionData = JSON.stringify({
    id: transaction.id,
    type: transaction.type,
    action: transaction.action,
    data: transaction.data,
    timestamp: transaction.timestamp
  });
  
  // For MVP, use a simple HMAC-like signature
  // In production, use proper digital signatures with public/private keys
  const key = privateKey || 'wastechain-default-key';
  return calculateHash(transactionData + key);
}

/**
 * Verify a transaction signature (simplified for MVP)
 */
export function verifyTransactionSignature(transaction: Transaction, publicKey?: string): boolean {
  const expectedSignature = signTransaction({
    id: transaction.id,
    type: transaction.type,
    binId: transaction.binId,
    contractorId: transaction.contractorId,
    citizenId: transaction.citizenId,
    action: transaction.action,
    data: transaction.data,
    timestamp: transaction.timestamp
  }, publicKey);
  
  return transaction.signature === expectedSignature;
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  return `TX-${timestamp}-${random}`;
}

/**
 * Generate a nonce for block mining (simplified proof of work)
 */
export function generateNonce(): number {
  return Math.floor(Math.random() * 1000000);
}

/**
 * Verify block hash integrity
 */
export function verifyBlockHash(block: Block): boolean {
  const calculatedHash = calculateBlockHash(block);
  return calculatedHash === block.header.hash;
}

/**
 * Create cryptographic proof for data authenticity
 */
export function createAuthenticityProof(data: any, blockHash: string, blockHeight: number): string {
  const proofData = {
    data: JSON.stringify(data),
    blockHash,
    blockHeight
  };
  
  return calculateHash(JSON.stringify(proofData));
}

/**
 * Verify authenticity proof
 */
export function verifyAuthenticityProof(data: any, proof: string, blockHash: string, blockHeight: number): boolean {
  const expectedProof = createAuthenticityProof(data, blockHash, blockHeight);
  return proof === expectedProof;
}