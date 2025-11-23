/**
 * Unit tests for SmartContractEngine
 */

import { SmartContractEngine } from '../contracts';
import { createTransaction } from '../utils';
import { TransactionType, SmartContract, ContractContext, ContractResult } from '../types';
import { CONTRACT_TYPES } from '../constants';

describe('SmartContractEngine', () => {
  let contractEngine: SmartContractEngine;

  beforeEach(() => {
    contractEngine = new SmartContractEngine();
  });

  describe('initialization', () => {
    it('should initialize with default contracts', () => {
      const activeContracts = contractEngine.getActiveContracts();
      expect(activeContracts.length).toBeGreaterThan(0);
      
      // Check that default contracts are registered
      const contractIds = activeContracts.map(c => c.id);
      expect(contractIds).toContain(CONTRACT_TYPES.BIN_CAPACITY_MONITOR);
      expect(contractIds).toContain(CONTRACT_TYPES.PICKUP_VALIDATOR);
      expect(contractIds).toContain(CONTRACT_TYPES.REPORT_PROCESSOR);
      expect(contractIds).toContain(CONTRACT_TYPES.EARNINGS_CALCULATOR);
    });
  });

  describe('executeContract', () => {
    it('should execute bin capacity monitor contract', async () => {
      const context = {
        transaction: createTransaction(TransactionType.BIN_UPDATE, 'update_capacity', {}),
        currentState: { binCapacity: 85, binId: 'bin-001' }, // Above threshold
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        CONTRACT_TYPES.BIN_CAPACITY_MONITOR,
        context
      );

      expect(result.success).toBe(true);
      expect(result.newTransactions.length).toBeGreaterThan(0);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should not trigger bin capacity contract when below threshold', async () => {
      const context = {
        transaction: createTransaction(TransactionType.BIN_UPDATE, 'update_capacity', {}),
        currentState: { binCapacity: 50, binId: 'bin-001' }, // Below threshold
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        CONTRACT_TYPES.BIN_CAPACITY_MONITOR,
        context
      );

      expect(result.success).toBe(true);
      expect(result.newTransactions.length).toBe(0);
      expect(result.actions.length).toBe(0);
    });

    it('should execute pickup validator contract', async () => {
      const pickupTransaction = createTransaction(
        TransactionType.PICKUP_CONFIRMATION,
        'confirm_pickup',
        { weight: 50 },
        { binId: 'bin-001', contractorId: 'contractor-001' }
      );

      const context = {
        transaction: pickupTransaction,
        currentState: { binCapacity: 90, binId: 'bin-001' },
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        CONTRACT_TYPES.PICKUP_VALIDATOR,
        context
      );

      expect(result.success).toBe(true);
      expect(result.newTransactions.length).toBe(2); // Bin update + earnings
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should execute report processor contract', async () => {
      const reportTransaction = createTransaction(
        TransactionType.ISSUE_REPORT,
        'report_issue',
        { issue: 'overflow' },
        { binId: 'bin-001', citizenId: 'citizen-001' }
      );

      const context = {
        transaction: reportTransaction,
        currentState: { binId: 'bin-001' },
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        CONTRACT_TYPES.REPORT_PROCESSOR,
        context
      );

      expect(result.success).toBe(true);
      expect(result.newTransactions.length).toBe(1); // Points award
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should execute earnings calculator contract', async () => {
      const earningsTransaction = createTransaction(
        TransactionType.SMART_CONTRACT_EXECUTION,
        'calculate_earnings',
        { contractorId: 'contractor-001', binId: 'bin-001' }
      );

      const context = {
        transaction: earningsTransaction,
        currentState: { binCapacity: 95, binId: 'bin-001' }, // High capacity for bonus
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        CONTRACT_TYPES.EARNINGS_CALCULATOR,
        context
      );

      expect(result.success).toBe(true);
      expect(result.newTransactions.length).toBe(1);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should handle non-existent contract type', async () => {
      const context = {
        transaction: createTransaction(TransactionType.BIN_UPDATE, 'action', {}),
        currentState: {},
        blockHeight: 1
      };

      const result = await contractEngine.executeContract(
        'non-existent-contract',
        context
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Contract type 'non-existent-contract' not found");
    });

    it('should handle contract execution errors gracefully', async () => {
      // Create a mock contract that throws an error
      const errorContract: SmartContract = {
        id: 'error-contract',
        name: 'Error Contract',
        conditions: [],
        actions: [],
        execute: async () => {
          throw new Error('Contract execution error');
        }
      };

      contractEngine.registerContract(errorContract);

      const context = {
        transaction: createTransaction(TransactionType.BIN_UPDATE, 'action', {}),
        currentState: {},
        blockHeight: 1
      };

      const result = await contractEngine.executeContract('error-contract', context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Contract execution failed: Contract execution error');
    });
  });

  describe('registerContract', () => {
    it('should register new contract', () => {
      const customContract: SmartContract = {
        id: 'custom-contract',
        name: 'Custom Contract',
        conditions: [],
        actions: [],
        execute: async () => ({ success: true, actions: [], newTransactions: [] })
      };

      contractEngine.registerContract(customContract);

      const contract = contractEngine.getContract('custom-contract');
      expect(contract).toBeTruthy();
      expect(contract?.name).toBe('Custom Contract');
    });

    it('should replace existing contract with same ID', () => {
      const contract1: SmartContract = {
        id: 'test-contract',
        name: 'Contract 1',
        conditions: [],
        actions: [],
        execute: async () => ({ success: true, actions: [], newTransactions: [] })
      };

      const contract2: SmartContract = {
        id: 'test-contract',
        name: 'Contract 2',
        conditions: [],
        actions: [],
        execute: async () => ({ success: true, actions: [], newTransactions: [] })
      };

      contractEngine.registerContract(contract1);
      contractEngine.registerContract(contract2);

      const contract = contractEngine.getContract('test-contract');
      expect(contract?.name).toBe('Contract 2');
    });
  });

  describe('getActiveContracts', () => {
    it('should return all registered contracts', () => {
      const initialCount = contractEngine.getActiveContracts().length;

      const customContract: SmartContract = {
        id: 'custom-contract',
        name: 'Custom Contract',
        conditions: [],
        actions: [],
        execute: async () => ({ success: true, actions: [], newTransactions: [] })
      };

      contractEngine.registerContract(customContract);

      const contracts = contractEngine.getActiveContracts();
      expect(contracts.length).toBe(initialCount + 1);
    });
  });

  describe('getContract', () => {
    it('should return contract by ID', () => {
      const contract = contractEngine.getContract(CONTRACT_TYPES.BIN_CAPACITY_MONITOR);
      expect(contract).toBeTruthy();
      expect(contract?.id).toBe(CONTRACT_TYPES.BIN_CAPACITY_MONITOR);
    });

    it('should return undefined for non-existent contract', () => {
      const contract = contractEngine.getContract('non-existent');
      expect(contract).toBeUndefined();
    });
  });

  describe('removeContract', () => {
    it('should remove existing contract', () => {
      const customContract: SmartContract = {
        id: 'removable-contract',
        name: 'Removable Contract',
        conditions: [],
        actions: [],
        execute: async () => ({ success: true, actions: [], newTransactions: [] })
      };

      contractEngine.registerContract(customContract);
      expect(contractEngine.getContract('removable-contract')).toBeTruthy();

      const removed = contractEngine.removeContract('removable-contract');
      expect(removed).toBe(true);
      expect(contractEngine.getContract('removable-contract')).toBeUndefined();
    });

    it('should return false for non-existent contract', () => {
      const removed = contractEngine.removeContract('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('contract execution timeout', () => {
    it('should handle contract execution timeout', async () => {
      const slowContract: SmartContract = {
        id: 'slow-contract',
        name: 'Slow Contract',
        conditions: [],
        actions: [],
        execute: async () => {
          // Simulate slow execution
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
          return { success: true, actions: [], newTransactions: [] };
        }
      };

      contractEngine.registerContract(slowContract);

      const context = {
        transaction: createTransaction(TransactionType.BIN_UPDATE, 'action', {}),
        currentState: {},
        blockHeight: 1
      };

      const result = await contractEngine.executeContract('slow-contract', context);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Contract execution failed: Contract execution timeout');
    }, 20000); // Increase test timeout
  });
});