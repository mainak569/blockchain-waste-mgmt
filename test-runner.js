#!/usr/bin/env node

/**
 * Test runner script for blockchain testing framework
 */

const { execSync } = require('child_process');
const path = require('path');

const commands = {
  'unit': 'jest src/lib/blockchain --testPathIgnorePatterns=properties.test.ts,integration.test.ts --verbose',
  'properties': 'jest src/lib/blockchain/__tests__/properties.test.ts --verbose',
  'integration': 'jest src/lib/blockchain/__tests__/integration.test.ts --verbose',
  'all': 'jest src/lib/blockchain --verbose',
  'coverage': 'jest src/lib/blockchain --coverage --verbose',
  'crypto': 'jest src/lib/blockchain/__tests__/crypto.test.ts --verbose',
  'utils': 'jest src/lib/blockchain/__tests__/utils.test.ts --verbose',
  'block': 'jest src/lib/blockchain/__tests__/block.test.ts --verbose',
  'validator': 'jest src/lib/blockchain/__tests__/validator.test.ts --verbose',
  'consensus': 'jest src/lib/blockchain/__tests__/consensus.test.ts --verbose',
  'contracts': 'jest src/lib/blockchain/__tests__/contracts.test.ts --verbose',
  'storage': 'jest src/lib/blockchain/__tests__/storage.test.ts --verbose',
  'manager': 'jest src/lib/blockchain/__tests__/manager.test.ts --verbose'
};

const testType = process.argv[2] || 'unit';

if (!commands[testType]) {
  console.log('Available test types:');
  Object.keys(commands).forEach(key => {
    console.log(`  ${key}`);
  });
  process.exit(1);
}

console.log(`Running ${testType} tests...`);
console.log(`Command: ${commands[testType]}`);

try {
  execSync(commands[testType], { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
  console.error(`Tests failed with exit code: ${error.status}`);
  process.exit(error.status);
}