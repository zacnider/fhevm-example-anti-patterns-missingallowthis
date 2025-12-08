import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { EntropyMissingAllowThis } from "../types";

/**
 * @title EntropyMissingAllowThis Tests
 * @notice Comprehensive tests for EntropyMissingAllowThis contract (anti-pattern example)
 * @chapter anti-patterns
 */
describe("EntropyMissingAllowThis", function () {
  async function deployContractFixture() {
    const [owner] = await hre.ethers.getSigners();
    
    // Check if we're on Sepolia and have real oracle address
    const network = await hre.ethers.provider.getNetwork();
    const isSepolia = network.chainId === BigInt(11155111);
    const realOracleAddress = process.env.ENTROPY_ORACLE_ADDRESS || "0x75b923d7940E1BD6689EbFdbBDCD74C1f6695361";
    
    let oracleAddress: string;
    let oracle: any;
    let chaosEngine: any;
    
    if (isSepolia && realOracleAddress && realOracleAddress !== "0x0000000000000000000000000000000000000000") {
      // Use real deployed EntropyOracle on Sepolia
      console.log(`Using real EntropyOracle on Sepolia: ${realOracleAddress}`);
      oracleAddress = realOracleAddress;
      const OracleFactory = await hre.ethers.getContractFactory("EntropyOracle");
      oracle = OracleFactory.attach(oracleAddress);
    } else {
      // Deploy locally for testing
      console.log("Deploying EntropyOracle locally for testing...");
      
      // Deploy FHEChaosEngine
      const ChaosEngineFactory = await hre.ethers.getContractFactory("FHEChaosEngine");
      chaosEngine = await ChaosEngineFactory.deploy(owner.address);
      await chaosEngine.waitForDeployment();
      const chaosEngineAddress = await chaosEngine.getAddress();
      
      // Initialize master seed for FHEChaosEngine
      const masterSeedInput = hre.fhevm.createEncryptedInput(chaosEngineAddress, owner.address);
      masterSeedInput.add64(12345); // Use a test seed value
      const encryptedMasterSeed = await masterSeedInput.encrypt();
      await chaosEngine.initializeMasterSeed(encryptedMasterSeed.handles[0], encryptedMasterSeed.inputProof);
      
      // Deploy EntropyOracle
      const OracleFactory = await hre.ethers.getContractFactory("EntropyOracle");
      oracle = await OracleFactory.deploy(chaosEngineAddress, owner.address, owner.address);
      await oracle.waitForDeployment();
      oracleAddress = await oracle.getAddress();
    }
    
    // Deploy EntropyMissingAllowThis
    const ContractFactory = await hre.ethers.getContractFactory("EntropyMissingAllowThis");
    const contract = await ContractFactory.deploy(oracleAddress) as any;
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    await hre.fhevm.assertCoprocessorInitialized(contract, "EntropyMissingAllowThis");
    
    return { contract, owner, contractAddress, oracleAddress, oracle, chaosEngine: chaosEngine || null };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployContractFixture);
      expect(await contract.getAddress()).to.be.properAddress;
    });

    it("Should have EntropyOracle address set", async function () {
      const { contract, oracleAddress } = await loadFixture(deployContractFixture);
      expect(await contract.getEntropyOracle()).to.equal(oracleAddress);
    });
  });

  describe("Anti-Pattern: Missing allowThis", function () {
    it("Should demonstrate wrong pattern (will fail)", async function () {
      const { contract, contractAddress, owner } = await loadFixture(deployContractFixture);
      
      const input1 = hre.fhevm.createEncryptedInput(contractAddress, owner.address);
      input1.add64(5);
      const encryptedInput1 = await input1.encrypt();
      
      const input2 = hre.fhevm.createEncryptedInput(contractAddress, owner.address);
      input2.add64(3);
      const encryptedInput2 = await input2.encrypt();
      
      // This will initialize but add() will fail
      await contract.initializeWrong(
        encryptedInput1.handles[0],
        encryptedInput2.handles[0],
        encryptedInput1.inputProof,
        encryptedInput2.inputProof
      );
      
      // This should fail because allowThis was not called
      await expect(contract.add()).to.be.reverted;
    });

    it("Should demonstrate correct pattern", async function () {
      const { contract, contractAddress, owner } = await loadFixture(deployContractFixture);
      
      const input1 = hre.fhevm.createEncryptedInput(contractAddress, owner.address);
      input1.add64(5);
      const encryptedInput1 = await input1.encrypt();
      
      const input2 = hre.fhevm.createEncryptedInput(contractAddress, owner.address);
      input2.add64(3);
      const encryptedInput2 = await input2.encrypt();
      
      await contract.initializeCorrect(
        encryptedInput1.handles[0],
        encryptedInput2.handles[0],
        encryptedInput1.inputProof,
        encryptedInput2.inputProof
      );
      
      // This should work because allowThis was called
      const result = await contract.add();
      expect(result).to.not.be.undefined;
    });
  });
});


