/**
 * Chain validator component for blockchain integrity checking
 */

import { Block, Transaction, ValidationResult, ChainValidationResult, ValidationError, ChainValidator as IChainValidator } from './types';
import { BlockImpl } from './block';
import { verifyBlockHash, verifyTransactionSignature, calculateMerkleRoot } from './crypto';
import { validateBlockFormat, validateTransactionFormat } from './utils';
import { BLOCKCHAIN_CONFIG } from './constants';

export class ChainValidator implements IChainValidator {
  /**
   * Validate a single block
   */
  public async validateBlock(block: Block): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // Basic format validation
      const formatValidation = validateBlockFormat(block);
      if (!formatValidation.isValid) {
        errors.push(...formatValidation.errors);
      }

      // Hash verification
      if (!this.verifyHash(block)) {
        errors.push('Block hash verification failed');
      }

      // Merkle root verification
      const transactionHashes = block.body.transactions.map(tx => tx.hash);
      const expectedMerkleRoot = calculateMerkleRoot(transactionHashes);
      if (block.header.merkleRoot !== expectedMerkleRoot) {
        errors.push('Merkle root verification failed');
      }

      // Transaction validation
      for (let i = 0; i < block.body.transactions.length; i++) {
        const transaction = block.body.transactions[i];
        const txValidation = await this.validateTransaction(transaction);
        if (!txValidation.isValid) {
          errors.push(`Transaction ${i} validation failed: ${txValidation.errors.join(', ')}`);
        }
      }

      // Transaction count verification
      if (block.body.transactionCount !== block.body.transactions.length) {
        errors.push('Transaction count mismatch');
      }

      // Block size validation
      const blockSize = JSON.stringify(block).length;
      if (blockSize > BLOCKCHAIN_CONFIG.MAX_BLOCK_SIZE) {
        errors.push('Block size exceeds maximum allowed');
      }

      // Timestamp validation
      if (block.header.timestamp && isNaN(Date.parse(block.header.timestamp))) {
        errors.push('Invalid block timestamp');
      }

    } catch (error) {
      errors.push(`Block validation error: ${(error as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      blockNumber: block.header.height
    };
  }

  /**
   * Validate the entire blockchain
   */
  public async validateChain(blocks?: Block[]): Promise<ChainValidationResult> {
    const validationErrors: ValidationError[] = [];
    let totalBlocks = 0;

    try {
      if (!blocks || blocks.length === 0) {
        return {
          isValid: true,
          totalBlocks: 0,
          errors: []
        };
      }

      totalBlocks = blocks.length;

      // Sort blocks by height to ensure proper order
      const sortedBlocks = [...blocks].sort((a, b) => a.header.height - b.header.height);

      // Validate genesis block
      const genesisBlock = sortedBlocks[0];
      if (genesisBlock.header.height !== BLOCKCHAIN_CONFIG.GENESIS_BLOCK_HEIGHT) {
        validationErrors.push({
          blockNumber: genesisBlock.header.height,
          errorType: 'GENESIS_BLOCK_ERROR',
          message: 'Genesis block height is incorrect'
        });
      }

      if (genesisBlock.header.previousHash !== BLOCKCHAIN_CONFIG.GENESIS_PREVIOUS_HASH) {
        validationErrors.push({
          blockNumber: genesisBlock.header.height,
          errorType: 'GENESIS_BLOCK_ERROR',
          message: 'Genesis block previous hash is incorrect'
        });
      }

      // Validate each block individually
      for (const block of sortedBlocks) {
        const blockValidation = await this.validateBlock(block);
        if (!blockValidation.isValid) {
          validationErrors.push({
            blockNumber: block.header.height,
            errorType: 'BLOCK_VALIDATION_ERROR',
            message: blockValidation.errors.join('; ')
          });
        }
      }

      // Validate chain continuity
      const continuityErrors = await this.validateChainContinuity(sortedBlocks);
      validationErrors.push(...continuityErrors);

    } catch (error) {
      validationErrors.push({
        blockNumber: -1,
        errorType: 'CHAIN_VALIDATION_ERROR',
        message: `Chain validation failed: ${(error as Error).message}`
      });
    }

    return {
      isValid: validationErrors.length === 0,
      totalBlocks,
      errors: validationErrors
    };
  }

  /**
   * Verify block hash integrity
   */
  public verifyHash(block: Block): boolean {
    try {
      return verifyBlockHash(block);
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }

  /**
   * Check chain continuity (each block references correct previous block)
   */
  public async checkChainContinuity(blocks?: Block[]): Promise<boolean> {
    try {
      if (!blocks || blocks.length <= 1) {
        return true;
      }

      const sortedBlocks = [...blocks].sort((a, b) => a.header.height - b.header.height);
      
      for (let i = 1; i < sortedBlocks.length; i++) {
        const currentBlock = sortedBlocks[i];
        const previousBlock = sortedBlocks[i - 1];
        
        // Check if current block references previous block's hash
        if (currentBlock.header.previousHash !== previousBlock.header.hash) {
          return false;
        }
        
        // Check if heights are consecutive
        if (currentBlock.header.height !== previousBlock.header.height + 1) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Chain continuity check error:', error);
      return false;
    }
  }

  /**
   * Validate a single transaction
   */
  private async validateTransaction(transaction: Transaction): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // Basic format validation
      const formatValidation = validateTransactionFormat(transaction);
      if (!formatValidation.isValid) {
        errors.push(...formatValidation.errors);
      }

      // Signature verification (simplified for MVP)
      if (!verifyTransactionSignature(transaction)) {
        errors.push('Transaction signature verification failed');
      }

      // Timestamp validation
      const transactionTime = new Date(transaction.timestamp).getTime();
      const currentTime = Date.now();
      
      // Check if transaction is not too far in the future (allow 5 minutes)
      if (transactionTime > currentTime + 300000) {
        errors.push('Transaction timestamp is too far in the future');
      }

      // Check if transaction is migrated (has migration metadata)
      const isMigratedTransaction = transaction.data && 
        typeof transaction.data === 'object' && 
        'migratedFrom' in transaction.data;

      // Skip expiration check for migrated transactions to preserve original timestamps
      if (!isMigratedTransaction && currentTime - transactionTime > BLOCKCHAIN_CONFIG.TRANSACTION_TIMEOUT) {
        errors.push('Transaction has expired');
      }

    } catch (error) {
      errors.push(`Transaction validation error: ${(error as Error).message}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate chain continuity and return detailed errors
   */
  private async validateChainContinuity(blocks: Block[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      if (blocks.length <= 1) {
        return errors;
      }

      for (let i = 1; i < blocks.length; i++) {
        const currentBlock = blocks[i];
        const previousBlock = blocks[i - 1];
        
        // Check previous hash reference
        if (currentBlock.header.previousHash !== previousBlock.header.hash) {
          errors.push({
            blockNumber: currentBlock.header.height,
            errorType: 'CHAIN_CONTINUITY_ERROR',
            message: `Block ${currentBlock.header.height} does not reference correct previous block hash`
          });
        }
        
        // Check height sequence
        if (currentBlock.header.height !== previousBlock.header.height + 1) {
          errors.push({
            blockNumber: currentBlock.header.height,
            errorType: 'BLOCK_HEIGHT_ERROR',
            message: `Block height sequence broken at block ${currentBlock.header.height}`
          });
        }
        
        // Check timestamp order (blocks should be in chronological order)
        const currentTime = new Date(currentBlock.header.timestamp).getTime();
        const previousTime = new Date(previousBlock.header.timestamp).getTime();
        
        if (currentTime < previousTime) {
          errors.push({
            blockNumber: currentBlock.header.height,
            errorType: 'TIMESTAMP_ORDER_ERROR',
            message: `Block ${currentBlock.header.height} timestamp is earlier than previous block`
          });
        }
      }
    } catch (error) {
      errors.push({
        blockNumber: -1,
        errorType: 'CONTINUITY_VALIDATION_ERROR',
        message: `Chain continuity validation failed: ${(error as Error).message}`
      });
    }

    return errors;
  }

  /**
   * Generate detailed validation report
   */
  public async generateValidationReport(blocks: Block[]): Promise<string> {
    const chainValidation = await this.validateChain(blocks);
    
    const report = {
      timestamp: new Date().toISOString(),
      totalBlocks: chainValidation.totalBlocks,
      isValid: chainValidation.isValid,
      errorCount: chainValidation.errors.length,
      errors: chainValidation.errors,
      summary: {
        blockValidationErrors: chainValidation.errors.filter(e => e.errorType.includes('BLOCK')).length,
        chainContinuityErrors: chainValidation.errors.filter(e => e.errorType.includes('CONTINUITY')).length,
        timestampErrors: chainValidation.errors.filter(e => e.errorType.includes('TIMESTAMP')).length,
        genesisBlockErrors: chainValidation.errors.filter(e => e.errorType.includes('GENESIS')).length
      }
    };
    
    return JSON.stringify(report, null, 2);
  }
}