const { expect } = require('chai');
const { ethers } = require('hardhat');

const BRIDGE_POLICY_HASH = '0x' + '55'.repeat(32);
const PROOF = '0x123456';

function b32(byteHex) {
  return '0x' + byteHex.repeat(32);
}

function attestation(overrides = {}) {
  return {
    vaultLauncherId: b32('11'),
    scopedNullifier: b32('22'),
    nullifierType: 1,
    serviceScopeHash: b32('33'),
    serviceSubscopeHash: b32('44'),
    proofTimestamp: 1_779_120_000,
    attestationLeafHash: '0x41950d187f655ae494bcdea426d643d3a21734ae9d3311c34477eb836867fcf7',
    attestationRoot: '0x41950d187f655ae494bcdea426d643d3a21734ae9d3311c34477eb836867fcf7',
    bridgeMessage: '0x8de348f6526b3bcc752ca1b524f3288c91ddbeb0f9d3451390ffbb0609565a71',
    ...overrides,
  };
}

describe('PopulisZkPassportAttestationEmitter', () => {
  async function deployFixture() {
    const [sender] = await ethers.getSigners();
    const MockVerifier = await ethers.getContractFactory('MockZkPassportVerifierAdapter');
    const verifier = await MockVerifier.deploy();
    const Emitter = await ethers.getContractFactory('PopulisZkPassportAttestationEmitter');
    const emitter = await Emitter.deploy(await verifier.getAddress(), BRIDGE_POLICY_HASH);
    return { sender, verifier, emitter };
  }

  it('emits verifier-approved zkPassport commitments for frontend validator bridging', async () => {
    const { sender, verifier, emitter } = await deployFixture();
    const a = attestation();
    await expect(emitter.verifyAndEmit(a, PROOF))
      .to.emit(emitter, 'VaultAttestationVerified')
      .withArgs(
        sender.address,
        a.vaultLauncherId,
        a.scopedNullifier,
        a.nullifierType,
        a.serviceScopeHash,
        a.serviceSubscopeHash,
        a.proofTimestamp,
        a.attestationLeafHash,
        a.attestationRoot,
        a.bridgeMessage,
        BRIDGE_POLICY_HASH,
        1,
      );

    expect(await verifier.lastBridgePolicyHash()).to.equal(BRIDGE_POLICY_HASH);
    expect(await verifier.lastProof()).to.equal(PROOF);
  });

  it('does not emit when the verifier adapter rejects the proof', async () => {
    const { verifier, emitter } = await deployFixture();
    await verifier.setResult(false);
    await expect(emitter.verifyAndEmit(attestation(), PROOF))
      .to.be.revertedWithCustomError(emitter, 'InvalidZkPassportProof');
  });

  it('rejects empty commitment fields before calling the verifier', async () => {
    const { verifier, emitter } = await deployFixture();
    await expect(
      emitter.verifyAndEmit(attestation({ vaultLauncherId: ethers.ZeroHash }), PROOF),
    )
      .to.be.revertedWithCustomError(emitter, 'ZeroBytes32')
      .withArgs('vaultLauncherId');
    const last = await verifier.lastBridgePolicyHash();
    expect(last).to.equal(ethers.ZeroHash);
  });

  it('exposes canonical fixed-width fields for validator signatures and portal polling', async () => {
    const { emitter } = await deployFixture();
    const a = attestation();
    const fields = await emitter.validatorMessageFields(a);
    expect(fields).to.deep.equal([
      ethers.zeroPadValue(ethers.toBeHex(1), 32),
      a.vaultLauncherId,
      a.attestationRoot,
      BRIDGE_POLICY_HASH,
      a.bridgeMessage,
      a.attestationLeafHash,
      a.scopedNullifier,
      ethers.zeroPadValue(ethers.toBeHex(a.nullifierType), 32),
      a.serviceScopeHash,
      a.serviceSubscopeHash,
      ethers.zeroPadValue(ethers.toBeHex(a.proofTimestamp), 32),
    ]);
  });
});
