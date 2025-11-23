# Blockchain Testing Framework

This directory contains a comprehensive testing framework for the blockchain integration tasks. The tests are organized into multiple categories to ensure thorough coverage of all blockchain functionality.

## Test Structure

### Unit Tests
- **crypto.test.ts** - Tests for cryptographic utilities (hashing, signing, verification)
- **utils.test.ts** - Tests for blockchain utility functions
- **block.test.ts** - Tests for Block and Transaction implementations
- **validator.test.ts** - Tests for ChainValidator component
- **consensus.test.ts** - Tests for ConsensusEngine component
- **contracts.test.ts** - Tests for SmartContractEngine component
- **storage.test.ts** - Tests for BlockStorage component
- **manager.test.ts** - Tests for BlockchainManager (central coordinator)

### Property-Based Tests
- **properties.test.ts** - Property-based tests using fast-check library
  - Tests universal properties that should hold across all inputs
  - Validates correctness properties from the design document
  - Uses random input generation to find edge cases

### Integration Tests
- **integration.test.ts** - End-to-end workflow tests
  - Complete waste management workflows
  - Smart contract integration scenarios
  - Data integrity and audit trails
  - Performance and scalability tests

### Test Setup
- **setup.ts** - Global test configuration and utilities
  - Test data cleanup
  - Custom Jest matchers
  - Test utility functions

## Running Tests

### All Tests
```bash
npm test
```

### Blockchain Tests Only
```bash
npm run test:blockchain
```

### Unit Tests Only
```bash
npm run test:blockchain:unit
```

### Property-Based Tests Only
```bash
npm run test:blockchain:properties
```

### Integration Tests Only
```bash
npm run test:blockchain:integration
```

### With Coverage Report
```bash
npm run test:blockchain:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Categories

### 1. Unit Tests
Focus on individual components and functions:
- **Cryptographic Functions**: Hash calculation, signature verification, Merkle trees
- **Utility Functions**: Transaction creation, validation, filtering
- **Block Operations**: Block creation, validation, serialization
- **Chain Validation**: Block validation, chain continuity, error reporting
- **Consensus Logic**: Transaction pooling, block creation, conflict resolution
- **Smart Contracts**: Contract execution, condition evaluation, action processing
- **Storage Operations**: Block persistence, indexing, backup/restore
- **Manager Coordination**: Transaction management, querying, export functionality

### 2. Property-Based Tests
Verify universal properties using random inputs:

#### **Property 1: Transaction Cryptographic Integrity**
- **Validates**: Requirements 1.1
- **Tests**: Every transaction has valid cryptographic signature

#### **Property 2: Block Structure Consistency**
- **Validates**: Requirements 1.2
- **Tests**: Blocks have proper structure with correct header information

#### **Property 3: Hash Chain Continuity**
- **Validates**: Requirements 1.3, 2.1, 2.2
- **Tests**: Block hashes are calculated correctly and maintain chain continuity

#### **Property 4: Block Validation Before Storage**
- **Validates**: Requirements 1.4
- **Tests**: Only valid blocks are accepted for storage

#### **Property 5: Chain Integrity Verification**
- **Validates**: Requirements 1.5, 2.1, 2.2
- **Tests**: Chain validation verifies all blocks and links

#### **Property 9: Transaction Deterministic Ordering**
- **Validates**: Requirements 4.1
- **Tests**: Transactions are processed in deterministic order

#### **Property 10: Concurrent Block Creation Prevention**
- **Validates**: Requirements 4.2
- **Tests**: Only one block creation succeeds when attempted concurrently

#### **Property 12: Query Result Correctness**
- **Validates**: Requirements 6.1, 6.2
- **Tests**: Query results contain exactly matching transactions

#### **Property 13: Data Export Format Equivalence**
- **Validates**: Requirements 6.4
- **Tests**: Different export formats contain equivalent data

### 3. Integration Tests
Test complete workflows and system interactions:

#### **Waste Management Workflows**
- Complete bin lifecycle (update → report → pickup)
- Multiple bins and contractors
- High transaction volume handling

#### **Smart Contract Integration**
- Bin capacity monitoring contract execution
- Pickup validation contract execution
- Report processing contract execution

#### **Data Integrity and Audit**
- Audit trail completeness
- Backup and restore functionality
- Cryptographic proof verification

#### **Performance and Scalability**
- Concurrent transaction handling
- Large date range queries
- System performance under load

## Test Configuration

### Jest Configuration
- **Preset**: ts-jest for TypeScript support
- **Environment**: Node.js
- **Test Match**: `**/__tests__/**/*.ts` and `**/?(*.)+(spec|test).ts`
- **Coverage**: Collects from `src/lib/blockchain/**/*.ts`
- **Timeout**: 30 seconds for integration tests
- **Max Workers**: 1 (sequential execution to avoid file system conflicts)

### Custom Matchers
- `toBeValidTransaction()` - Validates transaction structure
- `toBeValidBlock()` - Validates block structure

### Test Utilities
- `testUtils.getTestDataDir()` - Get test data directory path
- `testUtils.createTestDir()` - Create test directory
- `testUtils.cleanupTestData()` - Clean up test data

## Coverage Goals

The testing framework aims for:
- **Line Coverage**: >95%
- **Branch Coverage**: >90%
- **Function Coverage**: 100%
- **Statement Coverage**: >95%

## Property-Based Testing

Uses fast-check library for property-based testing:
- **Generators**: Create random but valid blockchain data
- **Properties**: Universal rules that should always hold
- **Shrinking**: Automatically finds minimal failing cases
- **Iterations**: Each property runs 100+ times with different inputs

## Test Data Management

- Each test gets isolated data directory
- Automatic cleanup before and after tests
- No shared state between tests
- Deterministic test execution

## Continuous Integration

Tests are designed to:
- Run reliably in CI environments
- Complete within reasonable time limits
- Provide clear failure messages
- Generate coverage reports
- Support parallel execution where safe

## Adding New Tests

When adding new blockchain functionality:

1. **Add Unit Tests**: Test individual functions and components
2. **Add Property Tests**: If the functionality has universal properties
3. **Add Integration Tests**: If it affects complete workflows
4. **Update Coverage**: Ensure new code is covered
5. **Document Properties**: Reference design document requirements

## Debugging Tests

For debugging failing tests:
- Use `--verbose` flag for detailed output
- Use `--no-coverage` to speed up debugging
- Use `--testNamePattern` to run specific tests
- Check test data directories for artifacts
- Use `console.log` in tests (will be captured)

## Performance Considerations

- Integration tests use smaller datasets for speed
- Property tests limit iteration count for CI
- File system operations are minimized
- Concurrent tests are avoided where they could conflict
- Test timeouts prevent hanging tests