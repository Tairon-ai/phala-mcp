#!/usr/bin/env node

// MCP Server Test Suite for Phala Network
const { spawn } = require('child_process');
const readline = require('readline');

// Test configuration
const tests = [
  {
    name: "Service Information",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "getServiceInfo",
        arguments: {}
      },
      id: 1
    }
  },
  {
    name: "Chain Information",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "getChainInfo",
        arguments: {}
      },
      id: 2
    }
  },
  {
    name: "PHA Token Info on Ethereum",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "getPHATokenInfo",
        arguments: {}
      },
      id: 3
    }
  },
  {
    name: "AI Agent Templates",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "getAIAgentTemplates",
        arguments: {}
      },
      id: 4
    }
  },
  {
    name: "Generate VRF (Mock)",
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "generateVRF",
        arguments: {
          seed: "test-seed",
          min: 1,
          max: 100
        }
      },
      id: 5
    }
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// Run MCP server and test
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}🧪 Phala Network MCP Server Test Suite${colors.reset}\n`);
  
  // Start MCP server
  const mcpServer = spawn('node', ['mcp/index.js'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const rl = readline.createInterface({
    input: mcpServer.stdout,
    output: process.stdout,
    terminal: false
  });

  let serverReady = false;
  let testIndex = 0;

  // Handle server output
  rl.on('line', (line) => {
    // Check if server is ready
    if (line.includes('MCP Server is running')) {
      serverReady = true;
      console.log(`${colors.green}✅ Server started successfully${colors.reset}\n`);
      runNextTest();
    }
    
    // Parse JSON responses
    if (line.startsWith('{') && serverReady) {
      try {
        const response = JSON.parse(line);
        handleResponse(response);
      } catch (e) {
        // Not JSON, skip
      }
    }
  });

  // Handle errors
  mcpServer.stderr.on('data', (data) => {
    console.error(`${colors.red}Error: ${data}${colors.reset}`);
  });

  // Run next test
  function runNextTest() {
    if (testIndex < tests.length) {
      const test = tests[testIndex];
      console.log(`${colors.bright}Test ${testIndex + 1}: ${test.name}${colors.reset}`);
      console.log(`Request: ${JSON.stringify(test.request.params.name)}`);
      
      // Send test request
      mcpServer.stdin.write(JSON.stringify(test.request) + '\n');
      testIndex++;
      
      // Run next test after delay
      setTimeout(runNextTest, 2000);
    } else {
      // All tests complete
      setTimeout(() => {
        console.log(`\n${colors.bright}${colors.green}✅ All tests completed!${colors.reset}`);
        mcpServer.kill();
        process.exit(0);
      }, 1000);
    }
  }

  // Handle test responses
  function handleResponse(response) {
    if (response.result) {
      console.log(`${colors.green}✓ Success${colors.reset}`);
      
      // Show summary of response
      if (response.result.content && response.result.content[0]) {
        try {
          const data = JSON.parse(response.result.content[0].text);
          const keys = Object.keys(data).slice(0, 3);
          console.log(`Response keys: ${keys.join(', ')}...`);
        } catch (e) {
          console.log(`Response: ${response.result.content[0].text.substring(0, 100)}...`);
        }
      }
    } else if (response.error) {
      console.log(`${colors.red}✗ Error: ${response.error.message}${colors.reset}`);
    }
    console.log('---\n');
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});