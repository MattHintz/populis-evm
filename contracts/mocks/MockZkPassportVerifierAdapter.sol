// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IZkPassportVerifierAdapter} from "../PopulisZkPassportAttestationEmitter.sol";

contract MockZkPassportVerifierAdapter is IZkPassportVerifierAdapter {
    bool public result = true;
    bytes public lastProof;
    bytes32 public lastBridgePolicyHash;
    string public lastExpectedServiceSubscope;
    string public requiredServiceSubscope;
    VaultAttestation public lastAttestation;

    function setResult(bool result_) external {
        result = result_;
    }

    function setRequiredServiceSubscope(string calldata requiredServiceSubscope_) external {
        requiredServiceSubscope = requiredServiceSubscope_;
    }

    function verifyVaultAttestation(
        bytes calldata proof,
        VaultAttestation calldata attestation,
        bytes32 bridgePolicyHash,
        string calldata expectedServiceSubscope
    ) external override returns (bool) {
        lastProof = proof;
        lastBridgePolicyHash = bridgePolicyHash;
        lastExpectedServiceSubscope = expectedServiceSubscope;
        lastAttestation = attestation;
        if (bytes(requiredServiceSubscope).length != 0) {
            return (
                result
                    && keccak256(bytes(requiredServiceSubscope)) == keccak256(bytes(expectedServiceSubscope))
            );
        }
        return result;
    }
}
