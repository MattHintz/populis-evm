// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IZkPassportVerifierAdapter {
    struct VaultAttestation {
        bytes32 vaultLauncherId;
        bytes32 scopedNullifier;
        uint16 nullifierType;
        bytes32 serviceScopeHash;
        bytes32 serviceSubscopeHash;
        uint64 proofTimestamp;
        bytes32 attestationLeafHash;
        bytes32 attestationRoot;
        bytes32 bridgeMessage;
    }

    function verifyVaultAttestation(
        bytes calldata proof,
        VaultAttestation calldata attestation,
        bytes32 bridgePolicyHash
    ) external returns (bool);
}

contract PopulisZkPassportAttestationEmitter {
    uint16 public constant POLICY_VERSION = 1;

    IZkPassportVerifierAdapter public immutable verifier;
    bytes32 public immutable bridgePolicyHash;

    event VaultAttestationVerified(
        address indexed sender,
        bytes32 indexed vaultLauncherId,
        bytes32 indexed scopedNullifier,
        uint16 nullifierType,
        bytes32 serviceScopeHash,
        bytes32 serviceSubscopeHash,
        uint64 proofTimestamp,
        bytes32 attestationLeafHash,
        bytes32 attestationRoot,
        bytes32 bridgeMessage,
        bytes32 bridgePolicyHash,
        uint16 policyVersion
    );

    error ZeroAddress(string field);
    error ZeroBytes32(string field);
    error ZeroTimestamp();
    error InvalidZkPassportProof();

    constructor(address verifier_, bytes32 bridgePolicyHash_) {
        if (verifier_ == address(0)) revert ZeroAddress("verifier");
        if (bridgePolicyHash_ == bytes32(0)) revert ZeroBytes32("bridgePolicyHash");
        verifier = IZkPassportVerifierAdapter(verifier_);
        bridgePolicyHash = bridgePolicyHash_;
    }

    function verifyAndEmit(
        IZkPassportVerifierAdapter.VaultAttestation calldata attestation,
        bytes calldata proof
    ) external {
        _validateAttestation(attestation);
        bool ok = verifier.verifyVaultAttestation(proof, attestation, bridgePolicyHash);
        if (!ok) revert InvalidZkPassportProof();

        emit VaultAttestationVerified(
            msg.sender,
            attestation.vaultLauncherId,
            attestation.scopedNullifier,
            attestation.nullifierType,
            attestation.serviceScopeHash,
            attestation.serviceSubscopeHash,
            attestation.proofTimestamp,
            attestation.attestationLeafHash,
            attestation.attestationRoot,
            attestation.bridgeMessage,
            bridgePolicyHash,
            POLICY_VERSION
        );
    }

    function validatorMessageFields(
        IZkPassportVerifierAdapter.VaultAttestation calldata attestation
    ) external view returns (bytes32[] memory) {
        _validateAttestation(attestation);
        return _validatorMessageFields(attestation);
    }

    function _validatorMessageFields(
        IZkPassportVerifierAdapter.VaultAttestation calldata attestation
    ) private view returns (bytes32[] memory fields) {
        fields = new bytes32[](11);
        fields[0] = bytes32(uint256(POLICY_VERSION));
        fields[1] = attestation.vaultLauncherId;
        fields[2] = attestation.attestationRoot;
        fields[3] = bridgePolicyHash;
        fields[4] = attestation.bridgeMessage;
        fields[5] = attestation.attestationLeafHash;
        fields[6] = attestation.scopedNullifier;
        fields[7] = bytes32(uint256(attestation.nullifierType));
        fields[8] = attestation.serviceScopeHash;
        fields[9] = attestation.serviceSubscopeHash;
        fields[10] = bytes32(uint256(attestation.proofTimestamp));
    }

    function _validateAttestation(
        IZkPassportVerifierAdapter.VaultAttestation calldata attestation
    ) private pure {
        if (attestation.vaultLauncherId == bytes32(0)) revert ZeroBytes32("vaultLauncherId");
        if (attestation.scopedNullifier == bytes32(0)) revert ZeroBytes32("scopedNullifier");
        if (attestation.serviceScopeHash == bytes32(0)) revert ZeroBytes32("serviceScopeHash");
        if (attestation.serviceSubscopeHash == bytes32(0)) revert ZeroBytes32("serviceSubscopeHash");
        if (attestation.proofTimestamp == 0) revert ZeroTimestamp();
        if (attestation.attestationLeafHash == bytes32(0)) revert ZeroBytes32("attestationLeafHash");
        if (attestation.attestationRoot == bytes32(0)) revert ZeroBytes32("attestationRoot");
        if (attestation.bridgeMessage == bytes32(0)) revert ZeroBytes32("bridgeMessage");
    }
}
