/**
 * Core blockchain type definitions for WasteChain
 */

export enum TransactionType {
  BIN_UPDATE = 'bin_update',
  PICKUP_CONFIRMATION = 'pickup_confirmation',
  ISSUE_REPORT = 'issue_report',
  SMART_CONTRACT_EXECUTION = 'smart_contract_execution',
  SYSTEM_EVENT = 'system_event'
}

export interface Transaction {
  id: string;
  type: TransactionType;
  binId?: string;
  contractorId?: string;
  citizenId?: string;
  action: string;
  data: any;
  timestamp: string;
  signature: string;
  hash: string;
}

export interface BlockHeader {
  height: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  nonce: number;
  hash: string;
}

export interface BlockBody {
  transactions: Transaction[];
  transactionCount: number;
}

export interface Block {
  header: BlockHeader;
  body: BlockBody;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  blockNumber?: number;
}

export interface ChainValidationResult {
  isValid: boolean;
  totalBlocks: number;
  errors: ValidationError[];
}

export interface ValidationError {
  blockNumber: number;
  errorType: string;
  message: string;
}

export interface ContractCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface ContractAction {
  type: 'update_bin' | 'award_points' | 'schedule_pickup' | 'notify_contractor';
  parameters: Record<string, any>;
}

export interface SmartContract {
  id: string;
  name: string;
  conditions: ContractCondition[];
  actions: ContractAction[];
  execute(context: ContractContext): Promise<ContractResult>;
}

export interface WasteManagementContract extends SmartContract {
  binCapacityThreshold: number;
  pointsPerReport: number;
  earningsPerPickup: number;
}

export interface ContractContext {
  transaction: Transaction;
  currentState: any;
  blockHeight: number;
}

export interface ContractResult {
  success: boolean;
  actions: ContractAction[];
  newTransactions: Transaction[];
  errors?: string[];
}

// Core blockchain component interfaces
export interface BlockchainManager {
  addTransaction(transaction: Transaction): Promise<string>;
  createBlock(): Promise<Block>;
  validateChain(): Promise<ValidationResult>;
  getTransaction(id: string): Promise<Transaction | null>;
  getBlockByHeight(height: number): Promise<Block | null>;
  getLatestBlock(): Promise<Block | null>;
  exportChain(format: 'json' | 'csv'): Promise<string>;
}

export interface ConsensusEngine {
  addToPool(transaction: Transaction): Promise<void>;
  getPoolSize(): number;
  createBlock(transactions?: Transaction[], height?: number, previousHash?: string): Promise<Block>;
  validateTransaction(transaction: Transaction): Promise<boolean>;
  resolveConflicts(): Promise<void>;
}

export interface SmartContractEngine {
  executeContract(contractType: string, data: any): Promise<ContractResult>;
  registerContract(contract: SmartContract): void;
  getActiveContracts(): SmartContract[];
}

export interface ChainValidator {
  validateBlock(block: Block): Promise<ValidationResult>;
  validateChain(): Promise<ChainValidationResult>;
  verifyHash(block: Block): boolean;
  checkChainContinuity(): Promise<boolean>;
}