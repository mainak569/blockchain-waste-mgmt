#!/usr/bin/env node

/**
 * Quick Connection Test Script
 * Tests all API endpoints to verify frontend-backend integration
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const tests = [];

function testEndpoint(name, path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const success = res.statusCode >= 200 && res.statusCode < 400;
        tests.push({
          name,
          path,
          method,
          status: res.statusCode,
          success,
        });
        console.log(`${success ? '✅' : '❌'} ${name}: ${res.statusCode}`);
        resolve(success);
      });
    });

    req.on('error', (error) => {
      tests.push({
        name,
        path,
        method,
        status: 'ERROR',
        success: false,
        error: error.message,
      });
      console.log(`❌ ${name}: ERROR - ${error.message}`);
      resolve(false);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Frontend-Backend Connections...\n');
  console.log('📌 Make sure the dev server is running (npm run dev)\n');

  // Test API endpoints
  await testEndpoint('Get Bins', '/api/bins');
  await testEndpoint('Get Activities', '/api/activities');
  await testEndpoint('Get Reports', '/api/reports');
  await testEndpoint('Get Analytics', '/api/analytics');
  await testEndpoint('Get Blockchain Metrics', '/api/blockchain/metrics');
  
  console.log('\n📊 Test Summary:');
  const passed = tests.filter(t => t.success).length;
  const total = tests.length;
  console.log(`${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n✅ All connections working! Frontend is properly connected to backend.');
  } else {
    console.log('\n⚠️  Some endpoints failed. Check if the server is running.');
  }
}

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   Frontend-Backend Connection Test                    ║');
console.log('║   Blockchain Waste Management System                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

runTests().catch(console.error);
