#!/bin/bash

# AI SEO Blog Automation - Test Script
# This script helps you test the queue system

BASE_URL="http://localhost:8787"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   AI SEO Blog Automation - Test Script                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Function to print section header
section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Check if server is running
section "1. Health Check"
echo "GET $BASE_URL/healthz"
curl -s $BASE_URL/healthz
echo ""

# Get queue status
section "2. Queue Status"
echo "GET $BASE_URL/queue-status"
curl -s $BASE_URL/queue-status | jq '.' 2>/dev/null || curl -s $BASE_URL/queue-status
