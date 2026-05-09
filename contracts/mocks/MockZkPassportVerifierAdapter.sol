// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IZkPassportVerifierAdapter} from "../PopulisZkPassportAttestationEmitter.sol";

contract MockZkPassportVerifierAdapter is IZkPassportVerifierAdapter {
    bool public result = true;
    bytes public lastProof;
    bytes32 public lastBridgePolicyHash;
    VaultAttestation public lastAttestation;

    function setResult(bool result_) external {
        result = result_;
    }

    function verifyVaultAttestation(
        bytes calldata proof,
        VaultAttestation calldata attestation,
        bytes32 bridgePolicyHash
    ) external override returns (bool) {
        lastProof = proof;
        lastBridgePolicyHash = bridgePolicyHash;
        lastAttestation = attestation;
        return result;
    }
}
