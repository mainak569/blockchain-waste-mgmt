/**
 * Test setup for blockchain tests
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// Global test configuration
const TEST_DATA_DIR = 'test-data';

// Clean up test data before and after tests
beforeEach(async () => {
  await cleanupTestData();
});

afterEach(async () => {
  await cleanupTestData();
});

async function cleanupTestData() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, ignore
  }
}

// Global test utilities
global.testUtils = {
  getTestDataDir: (subDir?: string) => {
    return subDir ? join(TEST_DATA_DIR, subDir) : TEST_DATA_DIR;
  },
  
  createTestDir: async (subDir: string) => {
    const dir = join(TEST_DATA_DIR, subDir);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  },
  
  cleanupTestData
};

// Extend Jest matchers for blockchain-specific assertions
expect.extend({
  toBeValidTransaction(received) {
    const pass = received && 
                 received.id && 
                 received.type && 
                 received.action && 
                 received.timestamp && 
                 received.signature && 
                 received.hash;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid transaction`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid transaction`,
        pass: false,
      };
    }
  },
  
  toBeValidBlock(received) {
    const pass = received && 
                 received.header && 
                 received.body && 
                 typeof received.header.height === 'number' &&
                 received.header.hash &&
                 received.header.previousHash !== undefined &&
                 Array.isArray(received.body.transactions);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid block`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid block`,
        pass: false,
      };
    }
  }
});

// Type declarations for global test utilities
declare global {
  var testUtils: {
    getTestDataDir: (subDir?: string) => string;
    createTestDir: (subDir: string) => Promise<string>;
    cleanupTestData: () => Promise<void>;
  };
  
  namespace jest {
    interface Matchers<R> {
      toBeValidTransaction(): R;
      toBeValidBlock(): R;
    }
  }
}