/**
 * Smart Contract Engine for WasteChain blockchain
 * Implements automated waste management business rules
 */

import { 
  SmartContract, 
  WasteManagementContract, 
  ContractContext, 
  ContractResult, 
  ContractCondition, 
  ContractAction,
  Transaction,
  TransactionType
} from './types';
import { createTransaction } from './utils';
import { BLOCKCHAIN_CONFIG, CONTRACT_TYPES } from './constants';

/**
 * Smart Contract Engine implementation
 */
export class SmartContractEngine {
  private contracts: Map<string, SmartContract> = new Map();
  private contractExecutionHistory: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultContracts();
  }

  /**
   * Execute a smart contract based on type and data
   */
  async executeContract(contractType: string, data: any): Promise<ContractResult> {
    const contract = this.contracts.get(contractType);
    
    if (!contract) {
      return {
        success: false,
        actions: [],
        newTransactions: [],
        errors: [`Contract type '${contractType}' not found`]
      };
    }

    try {
      // Create execution context
      const context: ContractContext = {
        transaction: data.transaction || null,
        currentState: data.currentState || {},
        blockHeight: data.blockHeight || 0
      };

      // Execute contract with timeout
      const result = await Promise.race([
        contract.execute(context),
        this.createTimeoutPromise()
      ]);

      // Record execution
      this.contractExecutionHistory.set(contract.id, new Date());

      return result;
    } catch (error) {
      return {
        success: false,
        actions: [],
        newTransactions: [],
        errors: [`Contract execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Register a new smart contract
   */
  registerContract(contract: SmartContract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Get all active contracts
   */
  getActiveContracts(): SmartContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Get contract by ID
   */
  getContract(contractId: string): SmartContract | undefined {
    return this.contracts.get(contractId);
  }

  /**
   * Remove a contract
   */
  removeContract(contractId: string): boolean {
    return this.contracts.delete(contractId);
  }

  /**
   * Check if conditions are met for a given context
   */
  private evaluateConditions(conditions: ContractCondition[], context: ContractContext): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, context));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: ContractCondition, context: ContractContext): boolean {
    const value = this.getFieldValue(condition.field, context);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Get field value from context
   */
  private getFieldValue(field: string, context: ContractContext): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Create timeout promise for contract execution
   */
  private createTimeoutPromise(): Promise<ContractResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Contract execution timeout'));
      }, BLOCKCHAIN_CONFIG.CONTRACT_EXECUTION_TIMEOUT);
    });
  }

  /**
   * Initialize default waste management contracts
   */
  private initializeDefaultContracts(): void {
    // Bin Capacity Monitor Contract
    this.registerContract(new BinCapacityContract());
    
    // Pickup Validator Contract
    this.registerContract(new PickupValidatorContract());
    
    // Report Processor Contract
    this.registerContract(new ReportProcessorContract());
    
    // Earnings Calculator Contract
    this.registerContract(new EarningsCalculatorContract());
  }
}

/**
 * Bin Capacity Monitoring Contract
 */
class BinCapacityContract implements WasteManagementContract {
  id = CONTRACT_TYPES.BIN_CAPACITY_MONITOR;
  name = 'Bin Capacity Monitor';
  binCapacityThreshold = BLOCKCHAIN_CONFIG.DEFAULT_BIN_CAPACITY_THRESHOLD;
  pointsPerReport = BLOCKCHAIN_CONFIG.DEFAULT_POINTS_PER_REPORT;
  earningsPerPickup = BLOCKCHAIN_CONFIG.DEFAULT_EARNINGS_PER_PICKUP;

  conditions: ContractCondition[] = [
    {
      field: 'currentState.binCapacity',
      operator: 'greater_than',
      value: this.binCapacityThreshold
    }
  ];

  actions: ContractAction[] = [
    {
      type: 'schedule_pickup',
      parameters: { priority: 'high' }
    },
    {
      type: 'notify_contractor',
      parameters: { message: 'Bin requires immediate pickup' }
    }
  ];

  async execute(context: ContractContext): Promise<ContractResult> {
    const newTransactions: Transaction[] = [];
    const actions: ContractAction[] = [];

    // Check if bin capacity exceeds threshold
    if (this.evaluateConditions(context)) {
      // Create pickup scheduling transaction
      const pickupTransaction = createTransaction(
        TransactionType.SMART_CONTRACT_EXECUTION,
        'schedule_pickup',
        {
          binId: context.currentState.binId,
          priority: 'high',
          reason: 'capacity_exceeded',
          threshold: this.binCapacityThreshold,
          currentCapacity: context.currentState.binCapacity
        },
        { binId: context.currentState.binId }
      );

      newTransactions.push(pickupTransaction);
      actions.push(...this.actions);
    }

    return {
      success: true,
      actions,
      newTransactions
    };
  }

  private evaluateConditions(context: ContractContext): boolean {
    return this.conditions.every(condition => {
      const binCapacity = context.currentState?.binCapacity || 0;
      return binCapacity > this.binCapacityThreshold;
    });
  }
}

/**
 * Pickup Validation Contract
 */
class PickupValidatorContract implements WasteManagementContract {
  id = CONTRACT_TYPES.PICKUP_VALIDATOR;
  name = 'Pickup Validator';
  binCapacityThreshold = BLOCKCHAIN_CONFIG.DEFAULT_BIN_CAPACITY_THRESHOLD;
  pointsPerReport = BLOCKCHAIN_CONFIG.DEFAULT_POINTS_PER_REPORT;
  earningsPerPickup = BLOCKCHAIN_CONFIG.DEFAULT_EARNINGS_PER_PICKUP;

  conditions: ContractCondition[] = [
    {
      field: 'transaction.type',
      operator: 'equals',
      value: TransactionType.PICKUP_CONFIRMATION
    }
  ];

  actions: ContractAction[] = [
    {
      type: 'update_bin',
      parameters: { capacity: 0, status: 'empty' }
    }
  ];

  async execute(context: ContractContext): Promise<ContractResult> {
    const newTransactions: Transaction[] = [];
    const actions: ContractAction[] = [];

    if (context.transaction?.type === TransactionType.PICKUP_CONFIRMATION) {
      // Validate pickup and update bin status
      const binUpdateTransaction = createTransaction(
        TransactionType.BIN_UPDATE,
        'pickup_completed',
        {
          binId: context.transaction.binId,
          previousCapacity: context.currentState.binCapacity || 0,
          newCapacity: 0,
          contractorId: context.transaction.contractorId,
          pickupTime: new Date().toISOString()
        },
        { 
          binId: context.transaction.binId,
          contractorId: context.transaction.contractorId 
        }
      );

      // Calculate contractor earnings
      const earningsTransaction = createTransaction(
        TransactionType.SMART_CONTRACT_EXECUTION,
        'calculate_earnings',
        {
          contractorId: context.transaction.contractorId,
          binId: context.transaction.binId,
          earnings: this.earningsPerPickup,
          pickupType: 'regular'
        },
        { contractorId: context.transaction.contractorId }
      );

      newTransactions.push(binUpdateTransaction, earningsTransaction);
      actions.push(...this.actions);
    }

    return {
      success: true,
      actions,
      newTransactions
    };
  }
}

/**
 * Report Processing Contract
 */
class ReportProcessorContract implements WasteManagementContract {
  id = CONTRACT_TYPES.REPORT_PROCESSOR;
  name = 'Report Processor';
  binCapacityThreshold = BLOCKCHAIN_CONFIG.DEFAULT_BIN_CAPACITY_THRESHOLD;
  pointsPerReport = BLOCKCHAIN_CONFIG.DEFAULT_POINTS_PER_REPORT;
  earningsPerPickup = BLOCKCHAIN_CONFIG.DEFAULT_EARNINGS_PER_PICKUP;

  conditions: ContractCondition[] = [
    {
      field: 'transaction.type',
      operator: 'equals',
      value: TransactionType.ISSUE_REPORT
    }
  ];

  actions: ContractAction[] = [
    {
      type: 'award_points',
      parameters: { points: this.pointsPerReport }
    }
  ];

  async execute(context: ContractContext): Promise<ContractResult> {
    const newTransactions: Transaction[] = [];
    const actions: ContractAction[] = [];

    if (context.transaction?.type === TransactionType.ISSUE_REPORT) {
      // Validate report and award points
      const pointsTransaction = createTransaction(
        TransactionType.SMART_CONTRACT_EXECUTION,
        'award_points',
        {
          citizenId: context.transaction.citizenId,
          binId: context.transaction.binId,
          points: this.pointsPerReport,
          reportType: context.transaction.data?.reportType || 'general',
          reportTime: new Date().toISOString()
        },
        { citizenId: context.transaction.citizenId }
      );

      newTransactions.push(pointsTransaction);
      actions.push(...this.actions);
    }

    return {
      success: true,
      actions,
      newTransactions
    };
  }
}

/**
 * Earnings Calculator Contract
 */
class EarningsCalculatorContract implements WasteManagementContract {
  id = CONTRACT_TYPES.EARNINGS_CALCULATOR;
  name = 'Earnings Calculator';
  binCapacityThreshold = BLOCKCHAIN_CONFIG.DEFAULT_BIN_CAPACITY_THRESHOLD;
  pointsPerReport = BLOCKCHAIN_CONFIG.DEFAULT_POINTS_PER_REPORT;
  earningsPerPickup = BLOCKCHAIN_CONFIG.DEFAULT_EARNINGS_PER_PICKUP;

  conditions: ContractCondition[] = [
    {
      field: 'transaction.action',
      operator: 'equals',
      value: 'calculate_earnings'
    }
  ];

  actions: ContractAction[] = [
    {
      type: 'update_bin',
      parameters: { earnings: 'calculated' }
    }
  ];

  async execute(context: ContractContext): Promise<ContractResult> {
    const newTransactions: Transaction[] = [];
    const actions: ContractAction[] = [];

    if (context.transaction?.action === 'calculate_earnings') {
      // Calculate additional bonuses based on bin capacity and timing
      let totalEarnings = this.earningsPerPickup;
      
      // Bonus for high-capacity pickups
      const binCapacity = context.currentState?.binCapacity || 0;
      if (binCapacity > 90) {
        totalEarnings += 5; // Bonus for very full bins
      }

      // Create earnings update transaction
      const earningsUpdateTransaction = createTransaction(
        TransactionType.SYSTEM_EVENT,
        'earnings_calculated',
        {
          contractorId: context.transaction.contractorId,
          binId: context.transaction.binId,
          baseEarnings: this.earningsPerPickup,
          bonusEarnings: totalEarnings - this.earningsPerPickup,
          totalEarnings,
          calculationTime: new Date().toISOString()
        },
        { contractorId: context.transaction.contractorId }
      );

      newTransactions.push(earningsUpdateTransaction);
      actions.push(...this.actions);
    }

    return {
      success: true,
      actions,
      newTransactions
    };
  }
}