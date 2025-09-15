<div align="center">

# Contributing to Phala Network MCP Server

**Thank you for your interest in contributing to the Phala Network MCP Server!**

This document provides guidelines and instructions for contributing to this project.

</div>

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community for all developers in the Phala ecosystem.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any relevant logs or screenshots
- Your environment (OS, Node.js version, npm version)
- Transaction hashes on Phala network if applicable

### Suggesting Enhancements

If you have an idea for an enhancement, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the enhancement
- Any relevant examples or mockups
- Why this enhancement would be useful for the Phala ecosystem
- Potential implementation approach

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bugfix (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) as your PR's title

## Development Setup

1. Clone your fork of the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your credentials (see README.md)
4. Test the server: `npm start`
5. Test the MCP server: `npm run mcp`

## Coding Standards

- Follow the existing code style (JavaScript/Node.js conventions)
- Write clear, descriptive commit messages
- Add JSDoc comments to your code where necessary
- Write tests for new features when applicable
- Update documentation when necessary
- Use meaningful variable and function names
- Keep functions small and focused on a single responsibility

## Adding New MCP Tools

If you want to add a new tool to the Phala Network MCP server, follow these steps:

### 1. Create the Tool Handler

Add your tool handler in the `mcp/index.js` file:

```javascript
// Define your tool using server.tool
server.tool(
  "yourToolName",
  "Clear description of what your tool does",
  {
    parameterOne: z.string().describe("Description of parameter"),
    parameterTwo: z.number().optional().describe("Optional parameter"),
  },
  async ({ parameterOne, parameterTwo }) => {
    try {
      // Implement your tool logic here
      const result = await performOperation({ parameterOne, parameterTwo });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }]
      };
    }
  }
);
```

### 2. Handle Phala-Specific Features

When adding tools that interact with Phala blockchain:

```javascript
// Initialize Phala API
const api = await initPhalaAPI();

// Use the configured wallet for transactions
const wallet = getWallet();

// Handle both Substrate and EVM addresses
if (address.startsWith('0x')) {
  address = evmToSubstrate(address);
}

// Work with TEE workers
const workers = await api.query.phalaRegistry.workers.entries();

// Verify attestation
const attestation = await verifyTEEAttestation(workerKey);
```

### 3. Add Tests

Create test cases for your new tool:

```javascript
// test-your-tool.js
const testYourTool = async () => {
  const response = await fetch('http://localhost:8080/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'yourToolName',
      params: {
        parameterOne: 'value',
        parameterTwo: 123
      }
    })
  });
  
  const result = await response.json();
  console.log('Tool result:', result);
};
```

### 4. Update Documentation

- Add your tool to the README.md tools section
- Include example usage in the Examples section
- Document any Phala-specific behavior

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Test specific functionality
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "yourToolName", "params": {...}}'
```

### Writing Tests

- Test both success and failure cases
- Include edge cases
- Test with various parameter combinations
- Verify error messages are helpful
- Test TEE worker interactions
- Test attestation verification

## Smart Contract Integration

When adding features that interact with Phat Contracts on Phala:

1. Add contract metadata to appropriate section
2. Implement proper error handling for contract calls
3. Test on Phala testnet before mainnet integration
4. Document gas estimation considerations
5. Handle both query (read) and execute (write) operations

## TEE Integration

When adding TEE-related features:

1. Verify worker attestation
2. Handle different TEE types (SGX, TDX, SEV, etc.)
3. Implement secure key management
4. Test with mock TEE in development
5. Document hardware requirements

## AI Agent Features

When adding AI agent functionality:

1. Use templates from `phala-cloud.js`
2. Configure appropriate resource limits
3. Implement secure API key storage
4. Test in sandbox environment first
5. Document system prompts and features

## Phala Cloud SDK Integration

When using Phala Cloud features:

```javascript
// Import the Phala Cloud service
const PhalaCloudService = require('./phala-cloud');

// Initialize the service
const cloud = getPhalaCloud();

// Use VRF for randomness
const vrf = await cloud.generateVRF(seed, range);

// Fetch oracle data
const data = await cloud.fetchOracleData('price', { symbol: 'PHA' });

// Create workflows
const workflow = await cloud.createWorkflow({
  name: 'Price Monitor',
  triggers: ['time'],
  actions: ['fetchPrice', 'notify']
});
```

## Environment Variables

When adding new environment variables:

1. Update the `.env.example` file
2. Document in README.md
3. Add validation in the code
4. Provide sensible defaults where appropriate

Example:
```javascript
const PHALA_RPC_URL = process.env.PHALA_RPC_URL || 'wss://api.phala.network/ws';
const WALLET_SEED_PHRASE = process.env.WALLET_SEED_PHRASE;

if (!WALLET_SEED_PHRASE && needsWallet) {
  throw new Error("WALLET_SEED_PHRASE is required for transactions");
}
```

## Documentation

- Keep README.md up to date
- Use clear, concise language
- Include code examples
- Update API documentation for new endpoints
- Add JSDoc comments for new functions
- Document TEE requirements

## Security Considerations

- **Never commit private keys or seed phrases**
- Validate all user inputs with Zod schemas
- Verify TEE attestation for sensitive operations
- Implement proper key management in enclaves
- Follow security best practices for confidential computing
- Review dependencies for vulnerabilities
- Use appropriate resource limits

## Performance Guidelines

- Optimize for Substrate block time (~6s)
- Implement caching where appropriate
- Use batch operations when possible
- Monitor RPC rate limits
- Profile code for bottlenecks
- Consider TEE resource constraints

## Phala-Specific Considerations

### Address Formats
- Support both Substrate (5G...) and EVM (0x...) addresses
- Implement proper address conversion when needed
- Use SS58 prefix 30 for Phala

### TEE Management
- Verify worker attestation
- Handle different confidence levels
- Monitor worker state changes
- Implement fallback for offline workers

### Phat Contracts
- Support off-chain computation
- Handle HTTP requests from contracts
- Implement proper gas metering
- Test with sandbox first

### AI Agents
- Configure appropriate memory limits
- Secure API key storage
- Monitor token usage
- Implement rate limiting

## Submitting Your Contribution

Before submitting:

1. Ensure all tests pass
2. Update documentation
3. Check for linting issues
4. Verify no sensitive data is included
5. Write a clear PR description
6. Test on Phala testnet if applicable

## Getting Help

If you need help with your contribution:

- Check existing issues and PRs
- Ask questions in the issue tracker
- Review Phala documentation at [docs.phala.network](https://docs.phala.network)
- Join [Phala Discord](https://discord.gg/phala)
- Check [Phala GitHub](https://github.com/Phala-Network)

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- Our website (if applicable)

Thank you for helping improve the Phala Network MCP Server!

---

<div align="center">

**Built by [Tairon.ai](https://tairon.ai/) team with help from Claude**

</div>
