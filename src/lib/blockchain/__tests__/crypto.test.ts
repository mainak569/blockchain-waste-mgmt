/**
 * Unit tests for cryptographic utilities
 */

import {
  calculateHash,
  calculateTransactionHash,
  calculateBlockHash,
  calculateMerkleRoot,
  signTransaction,
  verifyTransactionSignature,
  generateTransactionId,
  generateNonce,
  verifyBlockHash,
  createAuthenticityProof,
  verifyAuthenticityProof
} from '../crypto';
import { Transaction, Block, TransactionType } from '../types';

describe('Crypto Utilities', () => {
  describe('calculateHash', () => {
    it('should produce consistent SHA-256 hashes', () => {
      const data = 'test data';
      const hash1 = calculateHash(data);
      const hash2 = calculateHash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 character hex string
    });

    it('should produce different hashes for different data', () => {
      const hash1 = calculateHash('data1');
      const hash2 = calculateHash('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateTransactionHash', () => {
    it('should calculate consistent transaction hashes', () => {
      const transaction = {
        id: 'tx-001',
        type: TransactionType.BIN_UPDATE,
        action: 'update_capacity',
        data: { capacity: 75 },
        timestamp: '2023-01-01T00:00:00.000Z',
        signature: 'test-signature',
        binId: 'bin-001'
      };

      const hash1 = calculateTransactionHash(transaction);
      const hash2 = calculateTransactionHash(transaction);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different hashes for different transactions', () => {
      const tx1 = {
        id: 'tx-001',
        type: TransactionType.BIN_UPDATE,
        action: 'update_capacity',
        data: { capacity: 75 },
        timestamp: '2023-01-01T00:00:00.000Z',
        signature: 'test-signature'
      };

      const tx2 = { ...tx1, id: 'tx-002' };
      
      const hash1 = calculateTransactionHash(tx1);
      const hash2 = calculateTransactionHash(tx2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateMerkleRoot', () => {
    it('should handle empty transaction list', () => {
      const merkleRoot = calculateMerkleRoot([]);
      expect(merkleRoot).toBeTruthy();
      expect(merkleRoot).toHaveLength(64);
    });

    it('should handle single transaction', () => {
      const hashes = ['abc123'];
      const merkleRoot = calculateMerkleRoot(hashes);
      expect(merkleRoot).toBe('abc123');
    });

    it('should calculate merkle root for multiple transactions', () => {
      const hashes = ['hash1', 'hash2', 'hash3', 'hash4'];
      const merkleRoot = calculateMerkleRoot(hashes);
      
      expect(merkleRoot).toBeTruthy();
      expect(merkleRoot).toHaveLength(64);
    });

    it('should produce consistent results', () => {
      const hashes = ['hash1', 'hash2', 'hash3'];
      const root1 = calculateMerkleRoot(hashes);
      const root2 = calculateMerkleRoot(hashes);
      
      expect(root1).toBe(root2);
    });
  });

  describe('transaction signing and verification', () => {
    const sampleTransaction = {
      id: 'tx-001',
      type: TransactionType.BIN_UPDATE,
      action: 'update_capacity',
      data: { capacity: 75 },
      timestamp: '2023-01-01T00:00:00.000Z',
      binId: 'bin-001'
    };

    it('should sign transactions consistently', () => {
      const signature1 = signTransaction(sampleTransaction);
      const signature2 = signTransaction(sampleTransaction);
      
      expect(signature1).toBe(signature2);
      expect(signature1).toBeTruthy();
    });

    it('should verify valid signatures', () => {
      const signature = signTransaction(sampleTransaction);
      const fullTransaction: Transaction = {
        ...sampleTransaction,
        signature,
        hash: 'test-hash'
      };
      
      const isValid = verifyTransactionSignature(fullTransaction);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const fullTransaction: Transaction = {
        ...sampleTransaction,
        signature: 'invalid-signature',
        hash: 'test-hash'
      };
      
      const isValid = verifyTransactionSignature(fullTransaction);
      expect(isValid).toBe(false);
    });
  });

  describe('generateTransactionId', () => {
    it('should generate unique transaction IDs', () => {
      const id1 = generateTransactionId();
      const id2 = generateTransactionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^TX-\d+-[a-f0-9]+$/);
    });
  });

  describe('generateNonce', () => {
    it('should generate numeric nonces', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('number');
      expect(nonce).toBeGreaterThanOrEqual(0);
    });
  });

  describe('block hash verification', () => {
    const sampleBlock: Block = {
      header: {
        height: 1,
        previousHash: 'prev-hash',
        merkleRoot: 'merkle-root',
        timestamp: '2023-01-01T00:00:00.000Z',
        nonce: 12345,
        hash: ''
      },
      body: {
        transactions: [],
        transactionCount: 0
      }
    };

    it('should verify correct block hashes', () => {
      const correctHash = calculateBlockHash(sampleBlock);
      const blockWithHash = { ...sampleBlock };
      blockWithHash.header.hash = correctHash;
      
      const isValid = verifyBlockHash(blockWithHash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect block hashes', () => {
      const blockWithWrongHash = { ...sampleBlock };
      blockWithWrongHash.header.hash = 'wrong-hash';
      
      const isValid = verifyBlockHash(blockWithWrongHash);
      expect(isValid).toBe(false);
    });
  });

  describe('authenticity proofs', () => {
    const testData = { message: 'test data' };
    const blockHash = 'block-hash-123';
    const blockHeight = 5;

    it('should create and verify authenticity proofs', () => {
      const proof = createAuthenticityProof(testData, blockHash, blockHeight);
      expect(proof).toBeTruthy();
      expect(proof).toHaveLength(64);
      
      const isValid = verifyAuthenticityProof(testData, proof, blockHash, blockHeight);
      expect(isValid).toBe(true);
    });

    it('should reject proofs with wrong data', () => {
      const proof = createAuthenticityProof(testData, blockHash, blockHeight);
      const wrongData = { message: 'wrong data' };
      
      const isValid = verifyAuthenticityProof(wrongData, proof, blockHash, blockHeight);
      expect(isValid).toBe(false);
    });

    it('should reject proofs with wrong block info', () => {
      const proof = createAuthenticityProof(testData, blockHash, blockHeight);
      
      const isValid = verifyAuthenticityProof(testData, proof, 'wrong-hash', blockHeight);
      expect(isValid).toBe(false);
    });
  });
});