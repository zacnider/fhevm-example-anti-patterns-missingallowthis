# EntropyMissingAllowThis

Missing FHE.allowThis() permissions with EntropyOracle

## Overview

@title EntropyMissingAllowThis
@notice Missing FHE.allowThis() permissions with EntropyOracle
@dev ANTI-PATTERN: Demonstrates common mistake of missing allowThis with EntropyOracle integration
⚠️ ANTI-PATTERN WARNING:
Common Mistake:
- Forgetting to call FHE.allowThis() before using encrypted values
- Trying to use encrypted values in FHE operations without permission
- Getting "permission denied" errors
- Forgetting to allow entropy values before using them
What Happens:
- FHE operations will fail
- Contract will revert with permission errors
- Encrypted values cannot be used in FHE operations
Solution:
- Always call FHE.allowThis() after FHE.fromExternal()
- Always call FHE.allowThis() after getting entropy from EntropyOracle
- This grants the contract permission to use the encrypted value

@notice Constructor - sets EntropyOracle address
@param _entropyOracle Address of EntropyOracle contract

@notice Request entropy
@param tag Unique tag for this request
@return requestId Request ID from EntropyOracle

❌ ANTI-PATTERN: Missing FHE.allowThis()
@dev This will fail when trying to use value1 in FHE operations

✅ CORRECT: Using FHE.allowThis()
@dev This is the correct way to initialize encrypted values

@notice Add two values (will fail if allowThis was not called)
@return Sum of value1 + value2

❌ ANTI-PATTERN: Missing FHE.allowThis() for entropy
@dev This will fail when trying to use entropy in FHE operations

✅ CORRECT: Using FHE.allowThis() for entropy
@dev This is the correct way to use entropy

@notice Get EntropyOracle address



## Contract Code

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./IEntropyOracle.sol";

/**
 * @title EntropyMissingAllowThis
 * @notice Missing FHE.allowThis() permissions with EntropyOracle
 * @dev ANTI-PATTERN: Demonstrates common mistake of missing allowThis with EntropyOracle integration
 * 
 * ⚠️ ANTI-PATTERN WARNING:
 * 
 * Common Mistake:
 * - Forgetting to call FHE.allowThis() before using encrypted values
 * - Trying to use encrypted values in FHE operations without permission
 * - Getting "permission denied" errors
 * - Forgetting to allow entropy values before using them
 * 
 * What Happens:
 * - FHE operations will fail
 * - Contract will revert with permission errors
 * - Encrypted values cannot be used in FHE operations
 * 
 * Solution:
 * - Always call FHE.allowThis() after FHE.fromExternal()
 * - Always call FHE.allowThis() after getting entropy from EntropyOracle
 * - This grants the contract permission to use the encrypted value
 */
contract EntropyMissingAllowThis is ZamaEthereumConfig {
    // Entropy Oracle interface
    IEntropyOracle public entropyOracle;
    euint64 private value1;
    euint64 private value2;
    bool private initialized;
    
    // Track entropy requests
    mapping(uint256 => bool) public entropyRequests;
    
    event EntropyRequested(uint256 indexed requestId, address indexed caller);
    
    /**
     * @notice Constructor - sets EntropyOracle address
     * @param _entropyOracle Address of EntropyOracle contract
     */
    constructor(address _entropyOracle) {
        require(_entropyOracle != address(0), "Invalid oracle address");
        entropyOracle = IEntropyOracle(_entropyOracle);
    }
    
    /**
     * @notice Request entropy
     * @param tag Unique tag for this request
     * @return requestId Request ID from EntropyOracle
     */
    function requestEntropy(bytes32 tag) external payable returns (uint256 requestId) {
        require(msg.value >= entropyOracle.getFee(), "Insufficient fee");
        requestId = entropyOracle.requestEntropy{value: msg.value}(tag);
        entropyRequests[requestId] = true;
        emit EntropyRequested(requestId, msg.sender);
        return requestId;
    }
    
    /**
     * ❌ ANTI-PATTERN: Missing FHE.allowThis()
     * @dev This will fail when trying to use value1 in FHE operations
     */
    function initializeWrong(
        externalEuint64 encryptedInput1,
        externalEuint64 encryptedInput2,
        bytes calldata inputProof1,
        bytes calldata inputProof2
    ) external {
        require(!initialized, "Already initialized");
        
        // Convert external to internal
        euint64 internalValue1 = FHE.fromExternal(encryptedInput1, inputProof1);
        euint64 internalValue2 = FHE.fromExternal(encryptedInput2, inputProof2);
        
        // ❌ MISSING: FHE.allowThis(internalValue1);
        // ❌ MISSING: FHE.allowThis(internalValue2);
        
        value1 = internalValue1;
        value2 = internalValue2;
        initialized = true;
        
        // This will FAIL when trying to use value1 or value2 in FHE operations!
    }
    
    /**
     * ✅ CORRECT: Using FHE.allowThis()
     * @dev This is the correct way to initialize encrypted values
     */
    function initializeCorrect(
        externalEuint64 encryptedInput1,
        externalEuint64 encryptedInput2,
        bytes calldata inputProof1,
        bytes calldata inputProof2
    ) external {
        require(!initialized, "Already initialized");
        
        // Convert external to internal
        euint64 internalValue1 = FHE.fromExternal(encryptedInput1, inputProof1);
        euint64 internalValue2 = FHE.fromExternal(encryptedInput2, inputProof2);
        
        // ✅ CORRECT: Allow contract to use encrypted values
        FHE.allowThis(internalValue1);
        FHE.allowThis(internalValue2);
        
        value1 = internalValue1;
        value2 = internalValue2;
        initialized = true;
    }
    
    /**
     * @notice Add two values (will fail if allowThis was not called)
     * @return Sum of value1 + value2
     */
    function add() external returns (euint64) {
        require(initialized, "Not initialized");
        
        // This will fail if FHE.allowThis() was not called during initialization
        return FHE.add(value1, value2);
    }
    
    /**
     * ❌ ANTI-PATTERN: Missing FHE.allowThis() for entropy
     * @dev This will fail when trying to use entropy in FHE operations
     */
    function addWithEntropyWrong(uint256 requestId) external returns (euint64) {
        require(initialized, "Not initialized");
        require(entropyRequests[requestId], "Invalid request ID");
        require(entropyOracle.isRequestFulfilled(requestId), "Entropy not ready");
        
        // Get entropy
        euint64 entropy = entropyOracle.getEncryptedEntropy(requestId);
        // ❌ MISSING: FHE.allowThis(entropy);
        
        // This will FAIL because entropy doesn't have allowThis permission!
        return FHE.add(value1, entropy);
    }
    
    /**
     * ✅ CORRECT: Using FHE.allowThis() for entropy
     * @dev This is the correct way to use entropy
     */
    function addWithEntropyCorrect(uint256 requestId) external returns (euint64) {
        require(initialized, "Not initialized");
        require(entropyRequests[requestId], "Invalid request ID");
        require(entropyOracle.isRequestFulfilled(requestId), "Entropy not ready");
        
        // Get entropy
        euint64 entropy = entropyOracle.getEncryptedEntropy(requestId);
        // ✅ CORRECT: Allow contract to use entropy
        FHE.allowThis(entropy);
        
        // Now this will work!
        euint64 result = FHE.add(value1, entropy);
        FHE.allowThis(result);
        
        entropyRequests[requestId] = false;
        return result;
    }
    
    /**
     * @notice Get EntropyOracle address
     */
    function getEntropyOracle() external view returns (address) {
        return address(entropyOracle);
    }
}

```

## Tests

See [test file](../examples/anti-patterns-missingallowthis/test/EntropyMissingAllowThis.test.ts) for comprehensive test coverage.

```bash
npm test
```


## Category

**anti**



## Related Examples

- [All anti examples](../examples/anti/)
