#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "  BLOCKCHAIN WASTE MANAGEMENT - COMPREHENSIVE TEST SUITE"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start dev server in background
echo "📦 Starting development server..."
npm run dev > /tmp/waste-mgmt-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to be ready..."
sleep 8

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}❌ Server failed to start${NC}"
    cat /tmp/waste-mgmt-server.log
    exit 1
fi

echo -e "${GREEN}✅ Server started (PID: $SERVER_PID)${NC}"
echo ""

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$url" 2>/dev/null)
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_code)"
        ((FAILED++))
    fi
}

# Test POST endpoint
test_post_endpoint() {
    local name=$1
    local url=$2
    local data=$3
    local expected_code=${4:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "http://localhost:3000$url" 2>/dev/null)
    
    if [ "$response" = "$expected_code" ] || [ "$response" = "201" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_code)"
        ((FAILED++))
    fi
}

echo "════════════════════════════════════════════════════════════"
echo "  RUNNING API TESTS"
echo "════════════════════════════════════════════════════════════"
echo ""

# Test GET endpoints
echo "📡 Testing GET Endpoints:"
test_endpoint "Homepage" "/"
test_endpoint "Get Bins" "/api/bins"
test_endpoint "Get Activities" "/api/activities"
test_endpoint "Get Reports" "/api/reports"
test_endpoint "Get Analytics" "/api/analytics"
test_endpoint "Get Blockchain Metrics" "/api/blockchain/metrics"
test_endpoint "Get Blockchain Health" "/api/blockchain/health"
test_endpoint "Get Citizens" "/api/citizens"
test_endpoint "Get Contractors" "/api/contractors"
echo ""

# Test POST endpoints
echo "📤 Testing POST Endpoints:"
test_post_endpoint "Citizen Login" "/api/auth/login" '{"email":"test@example.com","username":"Test User","role":"citizen"}'
test_post_endpoint "Admin Login" "/api/auth/login" '{"username":"sde","password":"123","role":"admin"}'
test_post_endpoint "Contractor Login" "/api/auth/login" '{"username":"sde","password":"123","role":"contractor"}'
test_post_endpoint "Add New Bin" "/api/bins" '{"location":"Test Location","fillLevel":0,"gasLevel":0,"status":"Empty"}' 201
echo ""

# Test page routes
echo "🌐 Testing Page Routes:"
test_endpoint "Citizen Login Page" "/login/citizen"
test_endpoint "Admin Login Page" "/login/admin"
test_endpoint "Contractor Login Page" "/login/contractor"
test_endpoint "Citizen Dashboard" "/dashboard/citizen"
test_endpoint "Admin Dashboard" "/dashboard/admin"
test_endpoint "Contractor Dashboard" "/dashboard/contractor"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  TEST RESULTS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED - SYSTEM FULLY WORKING!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ SOME TESTS FAILED - NEEDS FIXES${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
