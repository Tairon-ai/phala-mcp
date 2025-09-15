<div align="center">

# 🔒 Phala Network MCP Server v0.1

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Phala Network](https://img.shields.io/badge/Network-Phala-purple)](https://phala.network)
[![TEE Support](https://img.shields.io/badge/TEE-SGX%20|%20TDX%20|%20SEV-blue)](https://phala.network)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue)](https://modelcontextprotocol.io)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com)

**Production-ready Model Context Protocol (MCP) server for Phala Network - Confidential AI Computing & TEE Infrastructure**

[Features](#-features) • [Quick Start](#-quick-start) • [Tools](#-available-tools) • [Examples](#-examples) • [Prompts](#-prompts) • [Security](#-security)

</div>

---

## 🚀 Features

### 🔒 **Confidential Computing Infrastructure**
- Full Phala Network blockchain integration (Substrate-based)
- TEE worker management with attestation verification
- Hardware-secured execution environments (Intel SGX/TDX, AMD SEV, NVIDIA H100/H200)
- Encrypted memory protection and secure key management
- Remote attestation for trust verification
- 30,000+ CPU cores across global TEE infrastructure

### 🤖 **AI Agent & Phat Contract Platform**
- Deploy AI agents with TEE protection
- Pre-configured AI agent templates (Oracle, Trader, NFT Manager, Security)
- Phat Contracts with internet access capabilities
- Off-chain smart contract execution
- Secure API key storage in enclaves
- Private model weights protection
- Verifiable AI inference

### 🐳 **DStack Container Orchestration**
- Deploy Docker containers in TEE
- Kubernetes-style orchestration
- Encrypted volume mounts
- Secure networking between containers
- Resource isolation and management
- GPU support for AI workloads

### 🎲 **Phala Cloud Advanced Features**
- **VRF (Verifiable Random Function)** - Generate cryptographically secure random numbers
- **Blockchain Oracles** - Fetch external data (prices, weather, sports, stocks)
- **Workflow Automation** - Create triggered workflows with conditions
- **Sequential Thinking** - Break complex tasks into manageable steps
- **Real-time Data Feeds** - Access blockchain, market, social, IoT data
- **Personal Finance** - Portfolio, budget, DCA, yield tracking

### 🌉 **Cross-chain Compatibility**
- Support for both Substrate and EVM addresses
- PHA token on Ethereum mainnet (0x6c5bA91642F10282b576d91922Ae6448C9d52f4E)
- Cross-chain balance tracking
- Automatic address format conversion
- Cross-chain message passing
- Oracle-free data fetching
- Bridge operations

### 🏛️ **Enterprise-Ready Architecture**
- Built with Polkadot.js API and Phala Cloud SDK
- Comprehensive error handling
- Zod schemas for input validation
- Docker containerization support
- Production-tested components
- MCP protocol implementation
- 31 specialized tools for complete functionality

---

## 📦 Quick Start

### ✅ Prerequisites
```bash
# Required
Node.js >= 18.0.0
npm >= 9.0.0

# Optional for transactions
Substrate seed phrase or EVM private key
```

### 📥 Installation

```bash
# Clone the repository
git clone https://github.com/tairon-ai/phala-mcp.git
cd phala-mcp/mcp-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start

# Development mode
npm run dev

# MCP stdio server for Claude Desktop
npm run mcp
```

### 🤖 Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "phala": {
      "command": "node",
      "args": ["/path/to/phala-mcp/mcp-server/mcp/index.js"],
      "env": {
        "PHALA_RPC_URL": "https://api.phala.network/rpc",
        "PHALA_API_KEY": "your_api_key_here",
        "WALLET_SEED_PHRASE": "your seed phrase here"
      }
    }
  }
}
```

---

## 🛠 Available Tools

### 🔗 **Blockchain Operations**

| Tool | Description | Parameters |
|------|-------------|------------|
| `getServiceInfo` | Get server capabilities and config | - |
| `getChainInfo` | Get chain state and network stats | - |
| `getPHABalance` | Get PHA balance on Phala Network | `address` |
| `getPHABalanceEthereum` | Get PHA balance on Ethereum | `address` |
| `getPHABalanceCrossChain` | Get PHA balance on both chains | `phalaAddress`, `ethereumAddress` |
| `getPHATokenInfo` | Get PHA token info on Ethereum | - |
| `sendPHA` | Send PHA on Phala Network | `to`, `amount` |
| `sendPHAEthereum` | Send PHA on Ethereum | `to`, `amount` |

### 🔒 **TEE Worker Management**

| Tool | Description | Parameters |
|------|-------------|------------|
| `getWorkerList` | List TEE workers | `limit`, `onlineOnly` |
| `getWorkerInfo` | Get worker details | `workerPublicKey` |
| `verifyAttestation` | Verify TEE attestation | `workerPublicKey`, `reportData` |

### 📝 **Phat Contract Operations**

| Tool | Description | Parameters |
|------|-------------|------------|
| `getPhatContractList` | List deployed contracts | `clusterId`, `limit` |
| `deployPhatContract` | Deploy new contract | `codeHash`, `clusterId`, `constructor`, `args` |
| `queryPhatContract` | Query contract (read) | `contractAddress`, `method`, `args` |
| `executePhatContract` | Execute contract (write) | `contractAddress`, `method`, `args`, `value` |

### 🤖 **AI Agent Management**

| Tool | Description | Parameters |
|------|-------------|------------|
| `deployAIAgent` | Deploy AI agent in TEE | `name`, `model`, `systemPrompt`, `clusterId` |
| `queryAIAgent` | Query AI agent | `agentId`, `query`, `context` |

### 🐳 **Container Deployment**

| Tool | Description | Parameters |
|------|-------------|------------|
| `deployContainer` | Deploy Docker container | `image`, `name`, `clusterId`, `resources` |
| `getContainerStatus` | Get container status | `containerId` |

### 🎯 **Cluster & Staking**

| Tool | Description | Parameters |
|------|-------------|------------|
| `getClusterInfo` | Get cluster information | `clusterId` |
| `createCluster` | Create compute cluster | `name`, `permission`, `workers` |
| `getStakingInfo` | Get staking pools | `poolId`, `address` |
| `delegateStake` | Delegate to pool | `poolId`, `amount` |

### 🎲 **Advanced Cloud Features**

| Tool | Description | Parameters |
|------|-------------|------------|
| `generateVRF` | Generate verifiable random number | `seed`, `min`, `max` |
| `fetchOracleData` | Get oracle data (price/weather/sports) | `dataType`, `params` |
| `createWorkflow` | Create automated workflow | `name`, `triggers`, `actions` |
| `sequentialThinking` | Break task into steps | `task`, `requiresAuth` |
| `fetchRealtimeData` | Get real-time data | `source`, `params` |
| `personalFinance` | Finance management | `operation`, `params` |

### 🤖 **AI Agent Templates**

| Tool | Description | Parameters |
|------|-------------|------------|
| `getAIAgentTemplates` | List available templates | - |
| `deployAIAgentTemplate` | Deploy from template | `template`, `clusterId` |

Available templates:
- **oracle** - Fetches and verifies external data
- **trader** - Market analysis and trading
- **nftManager** - NFT collection management
- **dataAnalyst** - Blockchain data analysis
- **governance** - DAO proposal management
- **security** - Threat monitoring and response

---

## 💡 Examples

### 💰 Check PHA Balance

```javascript
{
  "tool": "getPHABalance",
  "params": {
    "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }
}
```

### 🤖 Deploy AI Agent

```javascript
{
  "tool": "deployAIAgent",
  "params": {
    "name": "Assistant",
    "model": "gpt-4",
    "systemPrompt": "You are a helpful assistant",
    "clusterId": "cluster-1",
    "memorySize": 1024
  }
}
```

### 🐳 Deploy Container in TEE

```javascript
{
  "tool": "deployContainer",
  "params": {
    "image": "nginx:latest",
    "name": "secure-nginx",
    "clusterId": "cluster-1",
    "resources": {
      "cpu": 2,
      "memory": 2048,
      "gpu": false
    }
  }
}
```

### 📝 Query Phat Contract

```javascript
{
  "tool": "queryPhatContract",
  "params": {
    "contractAddress": "0x0001",
    "method": "getData",
    "args": []
  }
}
```

### 🎲 Generate Verifiable Random Number

```javascript
{
  "tool": "generateVRF",
  "params": {
    "seed": "my-random-seed",
    "min": 1,
    "max": 100
  }
}
```

### 📊 Fetch Oracle Data

```javascript
{
  "tool": "fetchOracleData",
  "params": {
    "dataType": "price",
    "params": {
      "symbol": "PHA",
      "currency": "USD"
    }
  }
}
```

### 🤖 Deploy AI Agent Template

```javascript
{
  "tool": "deployAIAgentTemplate",
  "params": {
    "template": "oracle",
    "clusterId": "cluster-1"
  }
}
```

### 💰 Check PHA on Ethereum

```javascript
{
  "tool": "getPHABalanceEthereum",
  "params": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7"
  }
}
```

### 🌉 Cross-chain PHA Balance

```javascript
{
  "tool": "getPHABalanceCrossChain",
  "params": {
    "phalaAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "ethereumAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7"
  }
}
```

---

## 🤖 Prompts

### 💬 Example Prompts for AI Assistants

#### 🔗 **Chain Operations**
```
"What's the current block number on Phala?"
"Check my PHA balance on Phala Network"
"Check my PHA balance on Ethereum"
"Show my total PHA across all chains"
"Send 100 PHA to address 5Grw... on Phala"
"Send 50 PHA to 0x742d... on Ethereum"
"Get PHA token info on Ethereum"
"Convert this EVM address to Substrate format"
"Get chain statistics and network health"
```

#### 🔒 **TEE Management**
```
"List online TEE workers"
"Verify attestation for worker 0xabc..."
"Show workers with Intel SGX support"
"Get confidence level for worker"
"Check TEE worker state and features"
```

#### 📝 **Phat Contracts**
```
"Deploy a Phat Contract to cluster-1"
"Query the oracle contract at 0x0001"
"Execute getData method on contract"
"List all contracts in my cluster"
"Deploy contract with custom constructor"
```

#### 🤖 **AI Agents**
```
"Deploy a GPT-4 agent with custom prompt"
"Query my AI agent: 'What is the weather?'"
"Create an AI assistant in TEE"
"Check agent attestation status"
"Deploy Llama-2 model in secure enclave"
```

#### 🐳 **Container Deployment**
```
"Deploy PostgreSQL in TEE with 4GB memory"
"Run Python script in secure container"
"Deploy nginx with GPU support"
"Check status of container abc123"
"Launch Jupyter notebook in TEE"
```

#### 💎 **Staking & Clusters**
```
"Show available staking pools"
"Delegate 1000 PHA to pool-1"
"Create a new compute cluster"
"Check my delegations"
"Get cluster resource utilization"
```

#### 🎲 **VRF & Oracle**
```
"Generate a verifiable random number between 1 and 100"
"Get the current price of PHA in USD"
"Fetch weather data for New York"
"Get gas prices on Ethereum"
"Fetch sports scores for NBA"
```

#### 🔄 **Workflows & Automation**
```
"Create a workflow that triggers on new blocks"
"Set up automated DCA for PHA tokens"
"Break down the task: deploy and test a smart contract"
"Create hourly price feed oracle workflow"
"Set up portfolio rebalancing automation"
```

#### 📊 **Advanced Features**
```
"Get real-time blockchain metrics"
"Fetch social media sentiment for PHA"
"Show my portfolio performance"
"Set up budget tracking"
"Deploy a security monitoring agent from template"
```

---

## 🔒 Security

### 🛡️ Security Features

- **Hardware-level isolation** via TEE
- **Encrypted memory** protection
- **Remote attestation** verification
- **Secure key management** in enclaves
- **Cryptographic proofs** for computation
- **Private model weights** protection
- **API key encryption** in TEE

### 🔐 Best Practices

- **Seed Phrase Management**: Never commit seed phrases
- **Attestation Verification**: Always verify TEE attestation
- **Cluster Permissions**: Set appropriate access controls
- **Resource Limits**: Configure reasonable resource limits
- **Network Security**: Use secure WebSocket connections
- **Monitoring**: Track worker states and attestation

---

## 📊 Supported Infrastructure

### 🌐 Networks
- **Phala Network Mainnet**
  - HTTP RPC: `https://api.phala.network/rpc`
  - Phat Contract API: `https://api.phala.network/phat`
  - Explorer: [Phala Subscan](https://phala.subscan.io)
- **Ethereum Mainnet**
  - RPC: `https://ethereum-rpc.publicnode.com`
  - PHA Token: `0x6c5bA91642F10282b576d91922Ae6448C9d52f4E`
  - Explorer: [Etherscan](https://etherscan.io/token/0x6c5bA91642F10282b576d91922Ae6448C9d52f4E)

### 🔒 TEE Types
- **Intel SGX** - Software Guard Extensions
- **Intel TDX** - Trust Domain Extensions
- **AMD SEV** - Secure Encrypted Virtualization
- **NVIDIA H100** - Confidential Computing GPUs
- **NVIDIA H200** - Latest gen secure GPUs
- **AWS Nitro** - Nitro Enclaves

### 🪙 Native Token
- **PHA**: Phala Network Token
- Decimals: 12
- SS58 Prefix: 30

---

## 🚀 Deployment

### 🏭 Production Deployment

```bash
# Start production server
NODE_ENV=production npm start

# With PM2
pm2 start mcp/index.js --name phala-mcp

# With Docker
docker build -t phala-mcp .
docker run -d -p 8080:8080 --env-file .env phala-mcp
```

### 🔑 Environment Variables

```env
# Phala Network RPC (Mainnet)
PHALA_RPC_URL=https://api.phala.network/rpc
PHALA_PHAT_RPC_URL=https://api.phala.network/phat

# Phala Confidential AI API Key
# Get your API key from: https://dashboard.phala.network
PHALA_API_KEY=your_api_key_here

# Ethereum RPC (for PHA ERC20 token)
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com

# Optional Services (leave empty for mock data)
DSTACK_API_URL=
DSTACK_REGISTRY_URL=

# Wallet Configuration
# For Phala Network (Substrate)
WALLET_SEED_PHRASE=your seed phrase
# For Ethereum (also works for Phala if using EVM-style key)
WALLET_PRIVATE_KEY=0x...

# Contract Addresses (optional)
PHAT_FACTORY_ADDRESS=
AI_AGENT_FACTORY_ADDRESS=

# Server Port
PORT=8080
```

---

## 📈 Performance

- **Response Time**: <200ms for chain queries
- **Transaction Speed**: ~6s block time
- **TEE Operations**: Hardware-speed execution
- **Container Deployment**: <30s typical
- **AI Inference**: Near-native performance
- **Network**: 30,000+ CPU cores available

---

## 🎯 Key Features

### ✨ Confidential AI Computing
- Deploy and run AI models in TEE
- Private inference with attestation
- Secure API key management
- Encrypted model weights

### 🔄 Off-chain Computation
- Phat Contracts with internet access
- Oracle-free data fetching
- Scheduled automation
- Cross-chain messaging

### 🛤️ Multi-Environment Support
- Intel, AMD, NVIDIA hardware
- CPU and GPU workloads
- Container orchestration
- Kubernetes-style management

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone
git fork https://github.com/tairon-ai/phala-mcp
git clone https://github.com/your-username/phala-mcp

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm test

# Commit and push
git commit -m 'feat: add amazing feature'
git push origin feature/amazing-feature

# Open Pull Request
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Phala Network](https://phala.network) - Confidential cloud computing
- [Phat Contract](https://docs.phala.network/developers/phat-contract) - Off-chain smart contracts
- [DStack SDK](https://github.com/Phala-Network/dstack-sdk) - Container orchestration
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [Polkadot.js](https://polkadot.js.org) - Substrate development

---

## 📚 Resources

- [Phala Documentation](https://docs.phala.network)
- [Phat Contract Guide](https://docs.phala.network/developers/phat-contract)
- [AI Agent Framework](https://docs.phala.network/ai-agent)
- [TEE Development](https://docs.phala.network/tee)
- [DStack Documentation](https://docs.phala.network/dstack)

---

<div align="center">

**Built by [Tairon.ai](https://tairon.ai/) team with help from Claude**

</div>
