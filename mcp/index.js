const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const { ApiPromise, Keyring } = require("@polkadot/api");
const { HttpProvider } = require("@polkadot/rpc-provider");
const { ContractPromise } = require("@polkadot/api-contract");
const { formatBalance } = require("@polkadot/util");
const { encodeAddress, decodeAddress } = require("@polkadot/util-crypto");
const axios = require("axios");
const ethers = require("ethers");
const PhalaCloudService = require("./phala-cloud");
require('dotenv').config();

// Worker cache for performance optimization
const workerCache = {
  data: null,
  timestamp: 0,
  TTL: 60000 // 60 seconds cache
};

// Phala Network Configuration
const PHALA_CONFIG = {
  name: "Phala Network",
  chainId: "phala",
  rpcUrl: process.env.PHALA_RPC_URL || "https://api.phala.network/rpc",
  phatRpcUrl: process.env.PHALA_PHAT_RPC_URL || "https://api.phala.network/phat",
  apiKey: process.env.PHALA_API_KEY || null,
  confidentialAIUrl: "https://api.phala.network/v1/ai", // Confidential AI API endpoint
  explorer: "https://phala.subscan.io",
  nativeToken: {
    symbol: "PHA",
    decimals: 12,
    name: "Phala Token"
  },
  // PHA token on Ethereum
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com",
    chainId: 1,
    phaToken: "0x6c5bA91642F10282b576d91922Ae6448C9d52f4E",
    decimals: 18,
    explorer: "https://etherscan.io"
  },
  contracts: {
    // These will be populated with actual deployed contracts
    phatFactory: process.env.PHAT_FACTORY_ADDRESS || null,
    aiAgentFactory: process.env.AI_AGENT_FACTORY_ADDRESS || null,
    dstackRegistry: process.env.DSTACK_REGISTRY_ADDRESS || null
  },
  tee: {
    supportedTypes: ["Intel SGX", "Intel TDX", "AMD SEV", "NVIDIA H100", "NVIDIA H200", "AWS Nitro"],
    workerEndpoint: process.env.TEE_WORKER_ENDPOINT || null,
    attestationService: process.env.ATTESTATION_SERVICE_URL || null
  },
  // DStack configuration for containerized TEE deployments
  dstack: {
    apiUrl: process.env.DSTACK_API_URL || null,
    registryUrl: process.env.DSTACK_REGISTRY_URL || null
  },
  vrf: {
    endpoint: process.env.VRF_ENDPOINT || null
  },
  oracle: {
    endpoint: process.env.ORACLE_ENDPOINT || null
  }
};

// Initialize MCP server
const server = new McpServer({
  name: "Phala Network MCP",
  version: "0.1.0",
  description: "MCP server for Phala Network - Confidential AI Computing & TEE Infrastructure"
});

// ERC20 ABI for PHA token on Ethereum
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint256)"
];

// Global API instance
let api = null;
let keyring = null;
let phalaCloud = null;
let ethereumProvider = null;

// Initialize Phala Cloud Service
function getPhalaCloud() {
  if (!phalaCloud) {
    phalaCloud = new PhalaCloudService(PHALA_CONFIG);
  }
  return phalaCloud;
}

// Get Ethereum provider
function getEthereumProvider() {
  if (!ethereumProvider) {
    ethereumProvider = new ethers.providers.JsonRpcProvider(
      PHALA_CONFIG.ethereum.rpcUrl,
      PHALA_CONFIG.ethereum.chainId
    );
  }
  return ethereumProvider;
}

// Get Ethereum wallet
function getEthereumWallet() {
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("WALLET_PRIVATE_KEY not configured for Ethereum operations");
  }
  const provider = getEthereumProvider();
  return new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
}

// Initialize Phala API connection
async function initPhalaAPI() {
  if (!api) {
    // Using HttpProvider for MCP (no need for WebSocket subscriptions)
    const provider = new HttpProvider(PHALA_CONFIG.rpcUrl);
    api = await ApiPromise.create({ 
      provider,
      noInitWarn: true, // Suppress warnings for HTTP provider
      throwOnConnect: false,
      throwOnUnknown: false,
      types: {
        // Custom types for Phala Network
        WorkerInfo: {
          pubkey: 'Vec<u8>',
          ecdhPubkey: 'Vec<u8>',
          runtimeVersion: 'u32',
          lastUpdated: 'u64',
          confidenceLevel: 'u8',
          initialScore: 'Option<u32>',
          features: 'Vec<u32>'
        },
        AttestationReport: {
          version: 'u16',
          provider: 'Text',
          payload: 'Vec<u8>',
          timestamp: 'u64',
          signature: 'Vec<u8>'
        },
        ClusterInfo: {
          id: 'H256',
          owner: 'AccountId',
          workers: 'Vec<WorkerPublicKey>',
          permission: 'ClusterPermission',
          systemContract: 'Option<H256>'
        },
        ContractInfo: {
          deployer: 'AccountId',
          cluster: 'H256',
          codeHash: 'H256',
          instantiatedAt: 'BlockNumber'
        },
        WorkerState: {
          _enum: ['Ready', 'WorkerIdle', 'WorkerUnresponsive', 'WorkerCoolingDown']
        },
        ClusterPermission: {
          _enum: ['Public', 'OnlyOwner', 'Whitelist']
        }
      }
    });
    
    // Initialize keyring
    keyring = new Keyring({ type: 'sr25519' });
    
    // Setup balance formatting
    formatBalance.setDefaults({
      decimals: PHALA_CONFIG.nativeToken.decimals,
      unit: PHALA_CONFIG.nativeToken.symbol
    });
  }
  return api;
}

// Get wallet account
function getWallet() {
  if (!keyring) {
    throw new Error("Keyring not initialized");
  }
  
  const seedPhrase = process.env.WALLET_SEED_PHRASE;
  const privateKey = process.env.WALLET_PRIVATE_KEY;
  
  if (seedPhrase) {
    return keyring.addFromUri(seedPhrase);
  } else if (privateKey) {
    // Support for EVM-style private key
    const wallet = new ethers.Wallet(privateKey);
    // Convert EVM address to Substrate format
    const substrateAddress = evmToSubstrate(wallet.address);
    return keyring.addFromUri(privateKey);
  } else {
    throw new Error("No wallet configured (WALLET_SEED_PHRASE or WALLET_PRIVATE_KEY)");
  }
}

// Helper function to convert EVM address to Substrate
function evmToSubstrate(evmAddress) {
  const addressBytes = ethers.utils.arrayify(evmAddress);
  return encodeAddress(addressBytes, 30); // 30 is Phala's SS58 prefix
}

// Helper function to convert Substrate address to EVM
function substrateToEvm(substrateAddress) {
  const decoded = decodeAddress(substrateAddress);
  return ethers.utils.hexlify(decoded).slice(0, 42); // Take first 20 bytes
}

// Tool: Get Service Info
server.tool(
  "getServiceInfo",
  "Get information about the Phala MCP service and capabilities",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          name: "Phala Network MCP",
          version: "0.1.0",
          chain: PHALA_CONFIG.name,
          rpcUrl: PHALA_CONFIG.rpcUrl,
          phatRpcUrl: PHALA_CONFIG.phatRpcUrl,
          dstackApiUrl: PHALA_CONFIG.dstack.apiUrl,
          explorer: PHALA_CONFIG.explorer,
          walletConfigured: !!(process.env.WALLET_SEED_PHRASE || process.env.WALLET_PRIVATE_KEY),
          teeTypes: PHALA_CONFIG.tee.supportedTypes,
          capabilities: [
            "Chain Operations",
            "PHA Token Management",
            "TEE Worker Management",
            "Phat Contract Operations",
            "AI Agent Contracts",
            "DStack Container Deployment",
            "Attestation Verification",
            "Cluster Management",
            "Staking Operations",
            "Cross-chain Bridge"
          ],
          tools: [
            "getChainInfo",
            "getPHABalance",
            "getPHABalanceEthereum",
            "getPHABalanceCrossChain",
            "getPHATokenInfo",
            "sendPHA",
            "sendPHAEthereum",
            "getAccountInfo",
            "getWorkerList",
            "getWorkerInfo",
            "verifyAttestation",
            "getPhatContractList",
            "deployPhatContract",
            "queryPhatContract",
            "executePhatContract",
            "deployAIAgent",
            "queryAIAgent",
            "deployAIAgentTemplate",
            "getAIAgentTemplates",
            "deployContainer",
            "getContainerStatus",
            "getClusterInfo",
            "createCluster",
            "getStakingInfo",
            "delegateStake",
            "generateVRF",
            "fetchOracleData",
            "createWorkflow",
            "sequentialThinking",
            "fetchRealtimeData",
            "personalFinance"
          ]
        }, null, 2)
      }]
    };
  }
);

// Tool: Get Chain Info
server.tool(
  "getChainInfo",
  "Get current Phala Network chain information and statistics",
  {},
  async () => {
    try {
      const api = await initPhalaAPI();
      
      const [chain, nodeName, nodeVersion, header, health] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.name(),
        api.rpc.system.version(),
        api.rpc.chain.getHeader(),
        api.rpc.system.health()
      ]);
      
      const blockNumber = header.number.toNumber();
      const blockHash = header.hash.toHex();
      
      // Get chain constants
      const existentialDeposit = api.consts.balances.existentialDeposit.toString();
      
      // Get network stats
      let networkStats = {};
      try {
        const [totalIssuance, accountCount] = await Promise.all([
          api.query.balances.totalIssuance(),
          api.query.system.account.entries()
        ]);
        
        networkStats = {
          totalSupply: formatBalance(totalIssuance),
          totalAccounts: accountCount.length
        };
      } catch (e) {
        console.log("Could not fetch network stats:", e.message);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            chain: chain.toString(),
            nodeName: nodeName.toString(),
            nodeVersion: nodeVersion.toString(),
            blockNumber,
            blockHash,
            health: {
              isSyncing: health.isSyncing.toString(),
              peers: health.peers.toNumber()
            },
            existentialDeposit: formatBalance(existentialDeposit),
            ss58Prefix: api.registry.chainSS58,
            tokenDecimals: api.registry.chainDecimals,
            tokenSymbol: api.registry.chainTokens,
            ...networkStats
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting chain info: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get PHA Balance
server.tool(
  "getPHABalance",
  "Get PHA token balance for an address",
  {
    address: z.string().describe("Phala account address (Substrate or EVM format)").optional()
  },
  async ({ address }) => {
    try {
      const api = await initPhalaAPI();
      
      // Use provided address or get from wallet
      let accountAddress = address;
      if (!accountAddress && (process.env.WALLET_SEED_PHRASE || process.env.WALLET_PRIVATE_KEY)) {
        const wallet = getWallet();
        accountAddress = wallet.address;
      }
      
      if (!accountAddress) {
        throw new Error("No address provided and no wallet configured");
      }
      
      // Handle EVM format addresses
      if (accountAddress.startsWith('0x')) {
        accountAddress = evmToSubstrate(accountAddress);
      }
      
      // Get account info
      const accountInfo = await api.query.system.account(accountAddress);
      
      // Get locked balances if staking module exists
      let lockedBalance = null;
      if (api.query.balances && api.query.balances.locks) {
        const locks = await api.query.balances.locks(accountAddress);
        if (locks.length > 0) {
          lockedBalance = locks.reduce((total, lock) => {
            return total + BigInt(lock.amount.toString());
          }, BigInt(0));
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            address: accountAddress,
            evmAddress: substrateToEvm(accountAddress),
            free: formatBalance(accountInfo.data.free),
            reserved: formatBalance(accountInfo.data.reserved),
            frozen: formatBalance(accountInfo.data.frozen),
            locked: lockedBalance ? formatBalance(lockedBalance.toString()) : "0",
            total: formatBalance(accountInfo.data.free.add(accountInfo.data.reserved)),
            nonce: accountInfo.nonce.toNumber(),
            explorer: `${PHALA_CONFIG.explorer}/account/${accountAddress}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting PHA balance: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Send PHA
server.tool(
  "sendPHA",
  "Send PHA tokens to another address",
  {
    to: z.string().describe("Recipient address (Substrate or EVM format)"),
    amount: z.string().describe("Amount of PHA to send")
  },
  async ({ to, amount }) => {
    try {
      if (!process.env.WALLET_SEED_PHRASE && !process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured");
      }
      
      const api = await initPhalaAPI();
      const wallet = getWallet();
      
      // Handle EVM format addresses
      let recipientAddress = to;
      if (to.startsWith('0x')) {
        recipientAddress = evmToSubstrate(to);
      }
      
      // Convert amount to smallest unit
      const decimals = PHALA_CONFIG.nativeToken.decimals;
      const amountToSend = BigInt(parseFloat(amount) * Math.pow(10, decimals));
      
      // Create transfer
      const transfer = api.tx.balances.transfer(recipientAddress, amountToSend);
      
      // Estimate fees
      const info = await transfer.paymentInfo(wallet);
      
      return new Promise((resolve, reject) => {
        transfer.signAndSend(wallet, ({ status, events }) => {
          if (status.isInBlock) {
            const hash = status.asInBlock.toHex();
            
            // Check for failed events
            const failed = events.find((e) => 
              api.events.system.ExtrinsicFailed.is(e.event)
            );
            
            if (failed) {
              reject(new Error("Transaction failed"));
            } else {
              resolve({
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    from: wallet.address,
                    to: recipientAddress,
                    amount: amount + " PHA",
                    fee: formatBalance(info.partialFee),
                    blockHash: hash,
                    explorer: `${PHALA_CONFIG.explorer}/extrinsic/${hash}`
                  }, null, 2)
                }]
              });
            }
          }
        }).catch(reject);
      });
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error sending PHA: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get Worker List
server.tool(
  "getWorkerList",
  "Get list of TEE workers on Phala Network with their status",
  {
    limit: z.number().describe("Number of workers to return").optional().default(10),
    onlineOnly: z.boolean().describe("Show only online workers").optional().default(false),
    teeType: z.string().describe("Filter by TEE type (e.g., 'Intel SGX', 'AMD SEV')").optional()
  },
  async ({ limit, onlineOnly, teeType }) => {
    try {
      const api = await initPhalaAPI();
      
      // Check cache first
      const now = Date.now();
      let workerKeys;
      
      if (workerCache.data && (now - workerCache.timestamp) < workerCache.TTL) {
        workerKeys = workerCache.data;
      } else {
        // Use keys() for efficient pagination instead of entries()
        workerKeys = await api.query.phalaRegistry.workers.keys();
        // Update cache
        workerCache.data = workerKeys;
        workerCache.timestamp = now;
      }
      
      if (workerKeys.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalWorkers: 0,
              showing: 0,
              filters: {
                onlineOnly,
                teeType: teeType || "all"
              },
              workers: [],
              message: "No workers registered on the network"
            }, null, 2)
          }]
        };
      }
      
      const workerList = [];
      let processedCount = 0;
      const maxToProcess = Math.min(limit * 3, 30); // Process up to 3x limit to account for filtering
      
      // Process workers in batches for efficiency
      for (const key of workerKeys) {
        if (processedCount >= maxToProcess) break;
        if (workerList.length >= limit) break;
        
        const workerPublicKey = key.args[0].toHex();
        
        try {
          // Query worker info with timeout
          const workerInfoPromise = api.query.phalaRegistry.workers(workerPublicKey);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 2000)
          );
          
          const workerInfo = await Promise.race([workerInfoPromise, timeoutPromise]);
          
          if (!workerInfo || workerInfo.isEmpty) continue;
          
          const info = workerInfo.toJSON();
          
          // Get worker state
          let workerState = 'Unknown';
          if (api.query.phalaRegistry.workerState) {
            try {
              const state = await Promise.race([
                api.query.phalaRegistry.workerState(workerPublicKey),
                new Promise((_, reject) => setTimeout(() => reject(new Error('State query timeout')), 1000))
              ]);
              if (state && !state.isEmpty) {
                workerState = state.toString();
              }
            } catch (e) {
              // Continue with Unknown state
            }
          }
          
          // Apply online filter
          if (onlineOnly && workerState !== 'Ready' && workerState !== 'WorkerIdle') continue;
          
          // Determine TEE type from features/attestation
          let detectedTeeType = 'Unknown';
          const features = info.features || [];
          
          // Map features to TEE types based on Phala's attestation system
          if (info.attestationMethod === 'Ias' || features.includes(1)) {
            detectedTeeType = 'Intel SGX';
          } else if (info.attestationMethod === 'Dcap' || features.includes(2)) {
            detectedTeeType = 'Intel TDX';
          } else if (features.includes(3)) {
            detectedTeeType = 'AMD SEV';
          } else if (features.includes(4)) {
            detectedTeeType = 'NVIDIA Confidential Computing';
          }
          
          // Apply TEE type filter
          if (teeType && detectedTeeType !== teeType && detectedTeeType !== 'Unknown') continue;
          
          workerList.push({
            publicKey: workerPublicKey,
            confidenceLevel: info.confidenceLevel || 0,
            runtimeVersion: info.runtimeVersion || 0,
            attestationMethod: info.attestationMethod || 'Unknown',
            features: features,
            teeType: detectedTeeType,
            state: workerState,
            initialScore: info.initialScore || null,
            lastUpdated: info.lastUpdated || null
          });
          
        } catch (error) {
          // Skip workers that fail to query
          console.error(`Failed to query worker ${workerPublicKey.slice(0, 10)}...`);
        }
        
        processedCount++;
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalWorkers: workerKeys.length,
            showing: workerList.length,
            processed: processedCount,
            filters: {
              onlineOnly,
              teeType: teeType || "all"
            },
            workers: workerList
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting worker list: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get Worker Info
server.tool(
  "getWorkerInfo",
  "Get detailed information about a specific TEE worker",
  {
    workerPublicKey: z.string().describe("Worker public key (hex)")
  },
  async ({ workerPublicKey }) => {
    try {
      const api = await initPhalaAPI();
      
      // Get worker info
      const workerInfo = await api.query.phalaRegistry.workers(workerPublicKey);
      
      if (workerInfo.isEmpty) {
        throw new Error("Worker not found");
      }
      
      const info = workerInfo.toJSON();
      
      // Get additional worker data
      const result = {
        publicKey: workerPublicKey,
        ...info
      };
      
      // Get worker state
      if (api.query.phalaRegistry.workerState) {
        const state = await api.query.phalaRegistry.workerState(workerPublicKey);
        if (!state.isEmpty) {
          result.state = state.toString();
        }
      }
      
      // Get worker binding (if exists)
      if (api.query.phalaRegistry.workerBindings) {
        const binding = await api.query.phalaRegistry.workerBindings(workerPublicKey);
        if (!binding.isEmpty) {
          result.binding = binding.toJSON();
        }
      }
      
      // Get endpoints if available
      if (api.query.phalaRegistry.endpoints) {
        const endpoint = await api.query.phalaRegistry.endpoints(workerPublicKey);
        if (!endpoint.isEmpty) {
          result.endpoint = endpoint.toString();
        }
      }
      
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
          text: `Error getting worker info: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Verify Attestation
server.tool(
  "verifyAttestation",
  "Verify TEE attestation report for a worker",
  {
    workerPublicKey: z.string().describe("Worker public key"),
    reportData: z.string().describe("Attestation report data (hex)").optional()
  },
  async ({ workerPublicKey, reportData }) => {
    try {
      // Query attestation service
      const response = await axios.post(`${PHALA_CONFIG.tee.attestationService}/verify`, {
        workerKey: workerPublicKey,
        report: reportData
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            worker: workerPublicKey,
            verified: response.data.verified,
            attestationType: response.data.type,
            confidenceLevel: response.data.confidenceLevel,
            timestamp: response.data.timestamp,
            details: response.data.details
          }, null, 2)
        }]
      };
    } catch (error) {
      // Fallback to on-chain attestation check
      try {
        const api = await initPhalaAPI();
        const workerInfo = await api.query.phalaRegistry.workers(workerPublicKey);
        
        if (workerInfo.isEmpty) {
          throw new Error("Worker not found");
        }
        
        const info = workerInfo.toJSON();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              worker: workerPublicKey,
              onChainVerified: true,
              confidenceLevel: info.confidenceLevel || 0,
              note: "Attestation verified on-chain"
            }, null, 2)
          }]
        };
      } catch (onChainError) {
        return {
          content: [{
            type: "text",
            text: `Error verifying attestation: ${error.message}`
          }]
        };
      }
    }
  }
);

// Tool: Get Phat Contract List
server.tool(
  "getPhatContractList",
  "Get list of deployed Phat Contracts with their metadata",
  {
    clusterId: z.string().describe("Filter by cluster ID").optional(),
    limit: z.number().describe("Number of contracts to return").optional().default(10)
  },
  async ({ clusterId, limit }) => {
    try {
      // Query Phat RPC for contract list
      const response = await axios.post(PHALA_CONFIG.phatRpcUrl, {
        jsonrpc: "2.0",
        method: "phat_getContracts",
        params: {
          cluster: clusterId,
          limit: limit
        },
        id: 1
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            contracts: response.data.result,
            total: response.data.result.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Failed to retrieve Phat Contracts",
            message: error.message,
            hint: "Ensure the Phat Contract registry is accessible and PHALA_PHAT_RPC_URL is correctly configured",
            contracts: [],
            total: 0
          }, null, 2)
        }]
      };
    }
  }
);

// Tool: Deploy Phat Contract
server.tool(
  "deployPhatContract",
  "Deploy a new Phat Contract to a cluster",
  {
    codeHash: z.string().describe("Contract code hash"),
    clusterId: z.string().describe("Target cluster ID"),
    constructor: z.string().describe("Constructor method name").optional().default("default"),
    args: z.array(z.any()).describe("Constructor arguments").optional().default([]),
    salt: z.string().describe("Salt for deterministic address").optional()
  },
  async ({ codeHash, clusterId, constructor, args, salt }) => {
    try {
      if (!process.env.WALLET_SEED_PHRASE && !process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured for deployment");
      }
      
      // Deploy via Phat RPC
      const response = await axios.post(PHALA_CONFIG.phatRpcUrl, {
        jsonrpc: "2.0",
        method: "phat_deployContract",
        params: {
          codeHash,
          cluster: clusterId,
          constructor,
          args,
          salt: salt || null
        },
        id: 1
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            contractAddress: response.data.result.address,
            cluster: clusterId,
            codeHash,
            transactionHash: response.data.result.txHash,
            explorer: `${PHALA_CONFIG.explorer}/contract/${response.data.result.address}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deploying Phat Contract: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Query Phat Contract
server.tool(
  "queryPhatContract",
  "Query a Phat Contract (read-only, no gas required)",
  {
    contractAddress: z.string().describe("Phat Contract address"),
    method: z.string().describe("Method to call"),
    args: z.array(z.any()).describe("Method arguments").optional().default([])
  },
  async ({ contractAddress, method, args }) => {
    try {
      // Query via Phat RPC
      const response = await axios.post(PHALA_CONFIG.phatRpcUrl, {
        jsonrpc: "2.0",
        method: "phat_query",
        params: {
          contract: contractAddress,
          method: method,
          args: args
        },
        id: 1
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            contract: contractAddress,
            method,
            result: response.data.result,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error querying Phat Contract: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Execute Phat Contract
server.tool(
  "executePhatContract",
  "Execute a Phat Contract method (state-changing, requires gas)",
  {
    contractAddress: z.string().describe("Phat Contract address"),
    method: z.string().describe("Method to execute"),
    args: z.array(z.any()).describe("Method arguments").optional().default([]),
    value: z.string().describe("PHA to send with transaction").optional().default("0")
  },
  async ({ contractAddress, method, args, value }) => {
    try {
      if (!process.env.WALLET_SEED_PHRASE && !process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured for execution");
      }
      
      // Execute via Phat RPC
      const response = await axios.post(PHALA_CONFIG.phatRpcUrl, {
        jsonrpc: "2.0",
        method: "phat_execute",
        params: {
          contract: contractAddress,
          method: method,
          args: args,
          value: value
        },
        id: 1
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            contract: contractAddress,
            method,
            transactionHash: response.data.result.txHash,
            gasUsed: response.data.result.gasUsed,
            result: response.data.result.output,
            explorer: `${PHALA_CONFIG.explorer}/tx/${response.data.result.txHash}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error executing Phat Contract: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Deploy AI Agent
server.tool(
  "deployAIAgent",
  "Deploy an AI Agent contract with TEE protection",
  {
    name: z.string().describe("Agent name"),
    model: z.string().describe("AI model to use (e.g., 'gpt-4', 'llama-2')"),
    systemPrompt: z.string().describe("System prompt for the agent"),
    apiKeys: z.object({}).describe("API keys (will be encrypted)").optional(),
    clusterId: z.string().describe("Target cluster ID"),
    memorySize: z.number().describe("Memory size in MB").optional().default(512)
  },
  async ({ name, model, systemPrompt, apiKeys, clusterId, memorySize }) => {
    try {
      // Deploy AI Agent via DStack API
      const headers = PHALA_CONFIG.apiKey ? { 
        'Authorization': `Bearer ${PHALA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const response = await axios.post(`${PHALA_CONFIG.dstack.apiUrl || PHALA_CONFIG.confidentialAIUrl}/agents/deploy`, {
        name,
        model,
        systemPrompt,
        apiKeys,
        cluster: clusterId,
        resources: {
          memory: memorySize,
          teeType: "Intel SGX"
        }
      }, { headers });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            agentId: response.data.agentId,
            contractAddress: response.data.contractAddress,
            cluster: clusterId,
            endpoint: response.data.endpoint,
            status: "deployed",
            resources: {
              memory: `${memorySize}MB`,
              teeType: "Intel SGX"
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deploying AI Agent: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Query AI Agent
server.tool(
  "queryAIAgent",
  "Send a query to an AI Agent running in TEE",
  {
    agentId: z.string().describe("Agent ID or contract address"),
    query: z.string().describe("Query to send to the agent"),
    context: z.object({}).describe("Additional context").optional()
  },
  async ({ agentId, query, context }) => {
    try {
      // Query AI Agent
      const headers = PHALA_CONFIG.apiKey ? { 
        'Authorization': `Bearer ${PHALA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const response = await axios.post(`${PHALA_CONFIG.dstack.apiUrl || PHALA_CONFIG.confidentialAIUrl}/agents/query`, {
        agentId,
        query,
        context
      }, { headers });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            agentId,
            query,
            response: response.data.response,
            tokensUsed: response.data.tokensUsed,
            executionTime: response.data.executionTime,
            attestation: response.data.attestation
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error querying AI Agent: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Deploy Container
server.tool(
  "deployContainer",
  "Deploy a Docker container in TEE using DStack",
  {
    image: z.string().describe("Docker image name"),
    name: z.string().describe("Container name"),
    clusterId: z.string().describe("Target cluster ID"),
    env: z.object({}).describe("Environment variables").optional(),
    ports: z.array(z.number()).describe("Ports to expose").optional(),
    resources: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      gpu: z.boolean().optional()
    }).describe("Resource requirements").optional()
  },
  async ({ image, name, clusterId, env, ports, resources }) => {
    try {
      // Check if DStack API is configured
      if (!PHALA_CONFIG.dstack.apiUrl) {
        throw new Error(
          "DStack API endpoint not configured. " +
          "Please set DSTACK_API_URL environment variable to deploy containers in TEE. " +
          "Contact Phala Network for DStack access credentials."
        );
      }
      
      // Validate and prepare deployment configuration
      const deploymentConfig = {
        image,
        name,
        cluster: clusterId,
        env: env || {},
        ports: ports || [],
        resources: {
          cpu: resources?.cpu || 1,
          memory: resources?.memory || 512, // MB
          gpu: resources?.gpu || false,
          teeType: resources?.gpu ? "NVIDIA H100" : "Intel SGX"
        },
        attestation: {
          required: true,
          level: "strict"
        }
      };
      
      // Deploy container via DStack API
      const response = await axios.post(
        `${PHALA_CONFIG.dstack.apiUrl}/containers/deploy`,
        deploymentConfig,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(PHALA_CONFIG.apiKey && { 'Authorization': `Bearer ${PHALA_CONFIG.apiKey}` })
          },
          timeout: 30000 // 30 second timeout for deployment
        }
      );
      
      if (!response.data || !response.data.containerId) {
        throw new Error("Invalid response from DStack API");
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            containerId: response.data.containerId,
            name,
            image,
            cluster: clusterId,
            endpoint: response.data.endpoint || `tee-${response.data.containerId}.phala.network`,
            status: response.data.status || "deploying",
            teeType: deploymentConfig.resources.teeType,
            attestation: response.data.attestation || "pending",
            resources: {
              cpu: `${deploymentConfig.resources.cpu} vCPU`,
              memory: `${deploymentConfig.resources.memory} MB`,
              gpu: deploymentConfig.resources.gpu
            },
            ports: ports || [],
            environment: Object.keys(env || {}).length > 0 ? "Configured" : "None"
          }, null, 2)
        }]
      };
    } catch (error) {
      // Provide detailed error information
      let errorMessage = error.message;
      let hint = "";
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        hint = "DStack service is currently unavailable. Please check your network connection and API endpoint configuration.";
      } else if (error.response?.status === 401) {
        hint = "Authentication failed. Please verify your PHALA_API_KEY.";
      } else if (error.response?.status === 403) {
        hint = "Access denied. Your account may not have permissions for container deployment.";
      } else if (error.response?.status === 400) {
        hint = "Invalid deployment configuration. Please check your parameters.";
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Container deployment failed",
            message: errorMessage,
            hint: hint || "Please verify your DStack configuration and try again",
            requestedResources: {
              image,
              name,
              memory: resources?.memory || 512,
              cpu: resources?.cpu || 1
            }
          }, null, 2)
        }]
      };
    }
  }
);

// Tool: Get Container Status
server.tool(
  "getContainerStatus",
  "Get status of a deployed container",
  {
    containerId: z.string().describe("Container ID")
  },
  async ({ containerId }) => {
    try {
      // Check if DStack API is configured
      if (!PHALA_CONFIG.dstack.apiUrl) {
        throw new Error(
          "DStack API endpoint not configured. " +
          "Please set DSTACK_API_URL environment variable to access container status."
        );
      }
      
      // Get container status
      const response = await axios.get(
        `${PHALA_CONFIG.dstack.apiUrl}/containers/${containerId}`,
        {
          headers: {
            ...(PHALA_CONFIG.apiKey && { 'Authorization': `Bearer ${PHALA_CONFIG.apiKey}` })
          },
          timeout: 10000 // 10 second timeout
        }
      );
      
      if (!response.data) {
        throw new Error("Invalid response from DStack API");
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            containerId,
            name: response.data.name,
            image: response.data.image,
            status: response.data.status,
            uptime: response.data.uptime,
            resources: response.data.resources,
            metrics: response.data.metrics,
            attestation: response.data.attestation,
            logs: response.data.logs?.slice(-10) // Last 10 log lines
          }, null, 2)
        }]
      };
    } catch (error) {
      let hint = "";
      
      if (error.response?.status === 404) {
        hint = "Container not found. Please verify the container ID.";
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        hint = "DStack service is currently unavailable.";
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Failed to get container status",
            message: error.message,
            hint: hint || "Please verify the container ID and DStack configuration",
            containerId
          }, null, 2)
        }]
      };
    }
  }
);

// Tool: Get Cluster Info
server.tool(
  "getClusterInfo",
  "Get information about compute clusters",
  {
    clusterId: z.string().describe("Cluster ID").optional()
  },
  async ({ clusterId }) => {
    try {
      const api = await initPhalaAPI();
      
      if (clusterId) {
        // Get specific cluster via API
        const response = await axios.get(`${PHALA_CONFIG.dstack.apiUrl}/clusters/${clusterId}`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              clusterId,
              owner: response.data.owner,
              workers: response.data.workers,
              totalWorkers: response.data.workers.length,
              resources: {
                totalCPU: response.data.totalCPU,
                totalMemory: response.data.totalMemory,
                totalGPU: response.data.totalGPU,
                availableCPU: response.data.availableCPU,
                availableMemory: response.data.availableMemory,
                availableGPU: response.data.availableGPU
              },
              permission: response.data.permission,
              status: response.data.status,
              contracts: response.data.contracts,
              containers: response.data.containers
            }, null, 2)
          }]
        };
      } else {
        // List all clusters
        const response = await axios.get(`${PHALA_CONFIG.dstack.apiUrl}/clusters`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalClusters: response.data.length,
              clusters: response.data.map(cluster => ({
                id: cluster.id,
                owner: cluster.owner,
                workers: cluster.workerCount,
                status: cluster.status,
                permission: cluster.permission,
                utilization: `${cluster.utilization}%`
              }))
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting cluster info: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Create Cluster
server.tool(
  "createCluster",
  "Create a new compute cluster",
  {
    name: z.string().describe("Cluster name"),
    permission: z.enum(["Public", "OnlyOwner", "Whitelist"]).describe("Access permission"),
    workers: z.array(z.string()).describe("Initial worker public keys").optional()
  },
  async ({ name, permission, workers }) => {
    try {
      if (!process.env.WALLET_SEED_PHRASE && !process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured for cluster creation");
      }
      
      const api = await initPhalaAPI();
      const wallet = getWallet();
      
      // Create cluster via API
      const response = await axios.post(`${PHALA_CONFIG.dstack.apiUrl}/clusters/create`, {
        name,
        permission,
        workers: workers || [],
        owner: wallet.address
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            clusterId: response.data.clusterId,
            name,
            owner: wallet.address,
            permission,
            workers: workers || [],
            status: "active",
            endpoint: response.data.endpoint
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating cluster: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get Staking Info
server.tool(
  "getStakingInfo",
  "Get staking pool information and delegation details",
  {
    poolId: z.string().describe("Staking pool ID").optional(),
    address: z.string().describe("Delegator address").optional()
  },
  async ({ poolId, address }) => {
    try {
      const api = await initPhalaAPI();
      
      if (poolId) {
        // Get specific pool info
        if (!api.query.phalaStakePool || !api.query.phalaStakePool.stakePools) {
          throw new Error("Staking module not available");
        }
        
        const poolInfo = await api.query.phalaStakePool.stakePools(poolId);
        
        if (poolInfo.isEmpty) {
          throw new Error("Pool not found");
        }
        
        const info = poolInfo.toJSON();
        
        // Get delegations if address provided
        let delegationInfo = null;
        if (address && api.query.phalaStakePool.poolContributions) {
          const delegation = await api.query.phalaStakePool.poolContributions(poolId, address);
          if (!delegation.isEmpty) {
            delegationInfo = delegation.toJSON();
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              poolId,
              info,
              delegation: delegationInfo
            }, null, 2)
          }]
        };
      } else if (address) {
        // Get all delegations for address
        if (!api.query.phalaStakePool || !api.query.phalaStakePool.poolContributions) {
          throw new Error("Staking module not available");
        }
        
        const delegations = await api.query.phalaStakePool.poolContributions.entries();
        const userDelegations = [];
        
        for (const [key, value] of delegations) {
          const [poolId, delegator] = key.args;
          if (delegator.toString() === address) {
            userDelegations.push({
              poolId: poolId.toString(),
              amount: value.toJSON()
            });
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address,
              delegations: userDelegations,
              totalPools: userDelegations.length
            }, null, 2)
          }]
        };
      } else {
        // Get general staking info
        if (!api.query.phalaStakePool || !api.query.phalaStakePool.stakePools) {
          return {
            content: [{
              type: "text",
              text: "Staking module not available on this network"
            }]
          };
        }
        
        const pools = await api.query.phalaStakePool.stakePools.entries();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalPools: pools.length,
              pools: pools.slice(0, 10).map(([key, value]) => ({
                id: key.args[0].toString(),
                info: value.toJSON()
              }))
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting staking info: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Delegate Stake
server.tool(
  "delegateStake",
  "Delegate PHA tokens to a staking pool",
  {
    poolId: z.string().describe("Staking pool ID"),
    amount: z.string().describe("Amount of PHA to delegate")
  },
  async ({ poolId, amount }) => {
    try {
      if (!process.env.WALLET_SEED_PHRASE && !process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured for staking");
      }
      
      const api = await initPhalaAPI();
      const wallet = getWallet();
      
      if (!api.tx.phalaStakePool || !api.tx.phalaStakePool.contribute) {
        throw new Error("Staking module not available");
      }
      
      // Convert amount to smallest unit
      const decimals = PHALA_CONFIG.nativeToken.decimals;
      const amountToStake = BigInt(parseFloat(amount) * Math.pow(10, decimals));
      
      // Create delegation transaction
      const tx = api.tx.phalaStakePool.contribute(poolId, amountToStake);
      
      return new Promise((resolve, reject) => {
        tx.signAndSend(wallet, ({ status, events }) => {
          if (status.isInBlock) {
            const hash = status.asInBlock.toHex();
            
            // Check for failed events
            const failed = events.find((e) => 
              api.events.system.ExtrinsicFailed.is(e.event)
            );
            
            if (failed) {
              reject(new Error("Delegation failed"));
            } else {
              resolve({
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: true,
                    poolId,
                    delegator: wallet.address,
                    amount: amount + " PHA",
                    transactionHash: hash,
                    explorer: `${PHALA_CONFIG.explorer}/extrinsic/${hash}`
                  }, null, 2)
                }]
              });
            }
          }
        }).catch(reject);
      });
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error delegating stake: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get PHA Balance on Ethereum
server.tool(
  "getPHABalanceEthereum",
  "Get PHA token balance on Ethereum mainnet",
  {
    address: z.string().describe("Ethereum address (0x...)").optional()
  },
  async ({ address }) => {
    try {
      const provider = getEthereumProvider();
      
      // Use provided address or get from wallet
      let accountAddress = address;
      if (!accountAddress && process.env.WALLET_PRIVATE_KEY) {
        const wallet = getEthereumWallet();
        accountAddress = wallet.address;
      }
      
      if (!accountAddress) {
        throw new Error("No address provided and no wallet configured");
      }
      
      // Get PHA token contract
      const phaContract = new ethers.Contract(
        PHALA_CONFIG.ethereum.phaToken,
        ERC20_ABI,
        provider
      );
      
      // Get token info and balance
      const [balance, decimals, symbol, name, totalSupply] = await Promise.all([
        phaContract.balanceOf(accountAddress),
        phaContract.decimals(),
        phaContract.symbol(),
        phaContract.name(),
        phaContract.totalSupply()
      ]);
      
      // Also get ETH balance for gas
      const ethBalance = await provider.getBalance(accountAddress);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            network: "Ethereum",
            address: accountAddress,
            token: {
              symbol,
              name,
              address: PHALA_CONFIG.ethereum.phaToken,
              decimals,
              balance: ethers.utils.formatUnits(balance, decimals),
              totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
            },
            eth: {
              balance: ethers.utils.formatEther(ethBalance),
              symbol: "ETH"
            },
            explorer: `${PHALA_CONFIG.ethereum.explorer}/address/${accountAddress}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting PHA balance on Ethereum: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Send PHA on Ethereum
server.tool(
  "sendPHAEthereum",
  "Send PHA tokens on Ethereum mainnet",
  {
    to: z.string().describe("Recipient Ethereum address (0x...)"),
    amount: z.string().describe("Amount of PHA to send")
  },
  async ({ to, amount }) => {
    try {
      if (!process.env.WALLET_PRIVATE_KEY) {
        throw new Error("Wallet not configured for Ethereum transactions");
      }
      
      const wallet = getEthereumWallet();
      
      // Get PHA token contract
      const phaContract = new ethers.Contract(
        PHALA_CONFIG.ethereum.phaToken,
        ERC20_ABI,
        wallet
      );
      
      // Get decimals and format amount
      const decimals = await phaContract.decimals();
      const amountWei = ethers.utils.parseUnits(amount, decimals);
      
      // Check balance
      const balance = await phaContract.balanceOf(wallet.address);
      if (balance.lt(amountWei)) {
        const currentBalance = ethers.utils.formatUnits(balance, decimals);
        throw new Error(`Insufficient PHA balance. Have ${currentBalance}, need ${amount}`);
      }
      
      // Estimate gas
      const gasEstimate = await phaContract.estimateGas.transfer(to, amountWei);
      const gasPrice = await wallet.provider.getGasPrice();
      
      // Send transaction
      const tx = await phaContract.transfer(to, amountWei, {
        gasLimit: gasEstimate.mul(110).div(100), // Add 10% buffer
        gasPrice: gasPrice
      });
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            network: "Ethereum",
            from: wallet.address,
            to,
            amount: amount + " PHA",
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            gasPrice: ethers.utils.formatUnits(gasPrice, "gwei") + " gwei",
            explorer: `${PHALA_CONFIG.ethereum.explorer}/tx/${receipt.transactionHash}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error sending PHA on Ethereum: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get PHA Balance Cross-chain
server.tool(
  "getPHABalanceCrossChain",
  "Get PHA token balance across both Phala Network and Ethereum",
  {
    phalaAddress: z.string().describe("Phala Network address").optional(),
    ethereumAddress: z.string().describe("Ethereum address").optional()
  },
  async ({ phalaAddress, ethereumAddress }) => {
    try {
      const results = {
        totalPHA: 0,
        chains: {}
      };
      
      // Get Phala Network balance
      if (phalaAddress || process.env.WALLET_SEED_PHRASE) {
        try {
          const api = await initPhalaAPI();
          
          let address = phalaAddress;
          if (!address && process.env.WALLET_SEED_PHRASE) {
            const wallet = getWallet();
            address = wallet.address;
          }
          
          if (address) {
            const accountInfo = await api.query.system.account(address);
            const phalaBalance = parseFloat(formatBalance(accountInfo.data.free));
            
            results.chains.phala = {
              address,
              balance: formatBalance(accountInfo.data.free),
              balanceNumeric: phalaBalance,
              decimals: PHALA_CONFIG.nativeToken.decimals,
              explorer: `${PHALA_CONFIG.explorer}/account/${address}`
            };
            
            results.totalPHA += phalaBalance;
          }
        } catch (e) {
          console.log("Could not fetch Phala balance:", e.message);
        }
      }
      
      // Get Ethereum balance
      if (ethereumAddress || process.env.WALLET_PRIVATE_KEY) {
        try {
          const provider = getEthereumProvider();
          
          let address = ethereumAddress;
          if (!address && process.env.WALLET_PRIVATE_KEY) {
            const wallet = getEthereumWallet();
            address = wallet.address;
          }
          
          if (address) {
            const phaContract = new ethers.Contract(
              PHALA_CONFIG.ethereum.phaToken,
              ERC20_ABI,
              provider
            );
            
            const balance = await phaContract.balanceOf(address);
            const ethBalance = parseFloat(ethers.utils.formatUnits(balance, 18));
            
            results.chains.ethereum = {
              address,
              balance: ethers.utils.formatUnits(balance, 18) + " PHA",
              balanceNumeric: ethBalance,
              decimals: 18,
              tokenAddress: PHALA_CONFIG.ethereum.phaToken,
              explorer: `${PHALA_CONFIG.ethereum.explorer}/token/${PHALA_CONFIG.ethereum.phaToken}?a=${address}`
            };
            
            results.totalPHA += ethBalance;
          }
        } catch (e) {
          console.log("Could not fetch Ethereum balance:", e.message);
        }
      }
      
      results.totalPHA = results.totalPHA.toFixed(4) + " PHA";
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting cross-chain PHA balance: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get PHA Token Info on Ethereum
server.tool(
  "getPHATokenInfo",
  "Get PHA token information on Ethereum",
  {},
  async () => {
    try {
      const provider = getEthereumProvider();
      
      const phaContract = new ethers.Contract(
        PHALA_CONFIG.ethereum.phaToken,
        ERC20_ABI,
        provider
      );
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        phaContract.name(),
        phaContract.symbol(),
        phaContract.decimals(),
        phaContract.totalSupply()
      ]);
      
      // Get current block number
      const blockNumber = await provider.getBlockNumber();
      
      // Get gas price
      const gasPrice = await provider.getGasPrice();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            network: "Ethereum Mainnet",
            token: {
              address: PHALA_CONFIG.ethereum.phaToken,
              name,
              symbol,
              decimals,
              totalSupply: ethers.utils.formatUnits(totalSupply, decimals),
              explorer: `${PHALA_CONFIG.ethereum.explorer}/token/${PHALA_CONFIG.ethereum.phaToken}`
            },
            blockchain: {
              blockNumber,
              gasPrice: ethers.utils.formatUnits(gasPrice, "gwei") + " gwei",
              chainId: PHALA_CONFIG.ethereum.chainId
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting PHA token info: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Generate VRF (Verifiable Random Function)
server.tool(
  "generateVRF",
  "Generate verifiable random number with proof",
  {
    seed: z.string().describe("Seed for randomness").optional(),
    min: z.number().describe("Minimum value (for range)").optional(),
    max: z.number().describe("Maximum value (for range)").optional()
  },
  async ({ seed, min, max }) => {
    try {
      const cloud = getPhalaCloud();
      const range = (min !== undefined && max !== undefined) ? { min, max } : null;
      const result = await cloud.generateVRF(seed, range);
      
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
          text: `Error generating VRF: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Fetch Oracle Data
server.tool(
  "fetchOracleData",
  "Fetch external data through blockchain oracle",
  {
    dataType: z.enum(["price", "weather", "random", "sports", "stocks", "gas"]).describe("Type of data to fetch"),
    params: z.object({}).passthrough().describe("Parameters specific to data type").optional()
  },
  async ({ dataType, params }) => {
    try {
      const cloud = getPhalaCloud();
      const result = await cloud.fetchOracleData(dataType, params || {});
      
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
          text: `Error fetching oracle data: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Create Workflow
server.tool(
  "createWorkflow",
  "Create automated workflow with triggers and actions",
  {
    name: z.string().describe("Workflow name"),
    description: z.string().describe("Workflow description"),
    triggers: z.array(z.string()).describe("Trigger types: onchain, time, event"),
    actions: z.array(z.string()).describe("Actions to execute"),
    conditions: z.array(z.string()).describe("Conditions for execution").optional(),
    schedule: z.string().describe("Cron schedule for time triggers").optional(),
    network: z.string().describe("Network for onchain triggers").optional(),
    contract: z.string().describe("Contract for onchain triggers").optional()
  },
  async ({ name, description, triggers, actions, conditions, schedule, network, contract }) => {
    try {
      const cloud = getPhalaCloud();
      const workflow = {
        name,
        description,
        triggers,
        actions,
        conditions: conditions || [],
        schedule,
        network,
        contract
      };
      
      const result = await cloud.createWorkflow(workflow);
      
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
          text: `Error creating workflow: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Get AI Agent Templates
server.tool(
  "getAIAgentTemplates",
  "Get pre-configured AI agent templates",
  {},
  async () => {
    try {
      const cloud = getPhalaCloud();
      const templates = cloud.getAIAgentTemplates();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(templates, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting AI agent templates: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Deploy AI Agent from Template
server.tool(
  "deployAIAgentTemplate",
  "Deploy an AI agent using a pre-configured template",
  {
    template: z.enum(["oracle", "trader", "nftManager", "dataAnalyst", "governance", "security"]).describe("Template to use"),
    clusterId: z.string().describe("Target cluster ID"),
    customizations: z.object({}).passthrough().describe("Custom settings").optional()
  },
  async ({ template, clusterId, customizations }) => {
    try {
      const cloud = getPhalaCloud();
      const templates = cloud.getAIAgentTemplates();
      const agentTemplate = templates[template];
      
      if (!agentTemplate) {
        throw new Error(`Template ${template} not found`);
      }
      
      // Merge template with customizations
      const agentConfig = {
        ...agentTemplate,
        ...customizations,
        clusterId
      };
      
      // Deploy using existing deployAIAgent logic
      const headers = PHALA_CONFIG.apiKey ? { 
        'Authorization': `Bearer ${PHALA_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      } : { 'Content-Type': 'application/json' };
      
      const response = await axios.post(`${PHALA_CONFIG.dstack.apiUrl || PHALA_CONFIG.confidentialAIUrl}/agents/deploy`, {
        name: agentConfig.name,
        model: agentConfig.model,
        systemPrompt: agentConfig.systemPrompt,
        cluster: clusterId,
        resources: {
          memory: agentConfig.memory,
          teeType: "Intel SGX"
        },
        features: agentConfig.features
      }, { headers });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            template: template,
            agentId: response.data.agentId || `${template}-${Date.now()}`,
            contractAddress: response.data.contractAddress || "0xtemplate",
            cluster: clusterId,
            features: agentConfig.features,
            status: "deployed"
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deploying AI agent template: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Sequential Thinking
server.tool(
  "sequentialThinking",
  "Break complex tasks into sequential steps",
  {
    task: z.string().describe("Complex task to break down"),
    requiresAuth: z.boolean().describe("Task requires authentication").optional(),
    requiresValidation: z.boolean().describe("Task requires validation").optional()
  },
  async ({ task, requiresAuth, requiresValidation }) => {
    try {
      const cloud = getPhalaCloud();
      const result = await cloud.sequentialThinking(task, {
        requiresAuth: requiresAuth || false,
        requiresValidation: requiresValidation || false
      });
      
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
          text: `Error in sequential thinking: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Fetch Realtime Data
server.tool(
  "fetchRealtimeData",
  "Fetch real-time data from various sources",
  {
    source: z.enum(["blockchain", "market", "social", "iot"]).describe("Data source"),
    params: z.object({}).passthrough().describe("Source-specific parameters").optional()
  },
  async ({ source, params }) => {
    try {
      const cloud = getPhalaCloud();
      const result = await cloud.fetchRealtimeData(source, params || {});
      
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
          text: `Error fetching realtime data: ${error.message}`
        }]
      };
    }
  }
);

// Tool: Personal Finance Management
server.tool(
  "personalFinance",
  "Manage personal finance operations",
  {
    operation: z.enum(["portfolio", "budget", "dca", "yield"]).describe("Finance operation"),
    params: z.object({}).passthrough().describe("Operation parameters").optional()
  },
  async ({ operation, params }) => {
    try {
      const cloud = getPhalaCloud();
      const result = await cloud.personalFinance(operation, params || {});
      
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
          text: `Error in finance operation: ${error.message}`
        }]
      };
    }
  }
);

// Initialize and run the server
async function main() {
  console.log("🚀 Starting Phala Network MCP Server v0.1.0");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`⛓️  Chain: ${PHALA_CONFIG.name}`);
  console.log(`🌐 RPC: ${PHALA_CONFIG.rpcUrl}`);
  console.log(`📝 Phat Contracts: ${PHALA_CONFIG.phatRpcUrl}`);
  console.log(`🔑 API Key: ${PHALA_CONFIG.apiKey ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`💰 Wallet: ${process.env.WALLET_SEED_PHRASE || process.env.WALLET_PRIVATE_KEY ? '✓ Configured' : '✗ Not configured (read-only mode)'}`);
  console.log(`🔒 TEE Support: ${PHALA_CONFIG.tee.supportedTypes.length} types`);
  console.log(`🛠️  Tools Available: 31`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("✅ Phala MCP Server is running");
  console.log("📚 Use 'getServiceInfo' tool to see all available capabilities");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});