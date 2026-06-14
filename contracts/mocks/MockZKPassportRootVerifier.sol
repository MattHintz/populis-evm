// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {ProofVerificationParams} from "../ZkPassportRealVerifierAdapter.sol";

contract MockZKPassportRootVerifier {
    bool public returnValid = true;
    bytes32 public returnUniqueId = bytes32(uint256(1));
    address public returnHelper;

    function setReturnValid(bool v) external { returnValid = v; }
    function setReturnHelper(address h) external { returnHelper = h; }

    function verify(ProofVerificationParams calldata)
        external
        view
        returns (bool valid, bytes32 uniqueIdentifier, address helper)
    {
        return (returnValid, returnUniqueId, returnHelper);
    }
}

contract MockZKPassportVerifierHelper {
    bool public returnScopes = true;
    uint256 public returnTimestamp = 1_700_000_000;
    bytes32 public returnNullifier = bytes32(uint256(42));

    function setReturnScopes(bool v) external { returnScopes = v; }

    function verifyScopes(
        bytes32[] calldata,
        string calldata,
        string calldata
    ) external view returns (bool) {
        return returnScopes;
    }

    function getProofTimestamp(bytes32[] calldata) external view returns (uint256) {
        return returnTimestamp;
    }

    function getScopedNullifier(bytes32[] calldata) external view returns (bytes32) {
        return returnNullifier;
    }
}
