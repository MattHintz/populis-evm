const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const BRIDGE_POLICY_HASH = '0x' + '55'.repeat(32);
const BRIDGE_PARENT_ID = '0x' + '66'.repeat(32);
const BRIDGE_AMOUNT = 1;
const PROOF = '0x123456';

function b32(byteHex) {
  return '0x' + byteHex.repeat(32);
}

function attestation(overrides = {}) {
  const bridgeParentId = overrides.bridgeParentId ?? BRIDGE_PARENT_ID;
  const bridgeAmount = overrides.bridgeAmount ?? BRIDGE_AMOUNT;
  return {
    vaultLauncherId: b32('11'),
    scopedNullifier: b32('22'),
    nullifierType: 1,
    serviceScopeHash: b32('33'),
    serviceSubscopeHash: b32('44'),
    proofTimestamp: 1_779_120_000,
    attestationLeafHash: '0x41950d187f655ae494bcdea426d643d3a21734ae9d3311c34477eb836867fcf7',
    attestationRoot: '0x41950d187f655ae494bcdea426d643d3a21734ae9d3311c34477eb836867fcf7',
    bridgeParentId,
    bridgeAmount,
    bridgeCoinId: chiaCoinId(bridgeParentId, BRIDGE_POLICY_HASH, bridgeAmount),
    bridgeMessage: '0x8de348f6526b3bcc752ca1b524f3288c91ddbeb0f9d3451390ffbb0609565a71',
    ...overrides,
  };
}

function chiaCoinId(parentCoinInfo, puzzleHash, amount) {
  return ethers.sha256(ethers.concat([parentCoinInfo, puzzleHash, clvmUint(amount)]));
}

function clvmUint(amount) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('amount must be non-negative');
  if (amount === 0) return '0x';
  let hex = amount.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  if (parseInt(hex.slice(0, 2), 16) & 0x80) hex = `00${hex}`;
  return `0x${hex}`;
}

function expectedSubscope(vaultLauncherId) {
  return `vault:${vaultLauncherId.toLowerCase()}`;
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
        a.bridgeParentId,
        a.bridgeAmount,
        a.bridgeCoinId,
        a.bridgeMessage,
        BRIDGE_POLICY_HASH,
        1,
      );

    expect(await verifier.lastBridgePolicyHash()).to.equal(BRIDGE_POLICY_HASH);
    expect(await verifier.lastProof()).to.equal(PROOF);
    expect(await verifier.lastExpectedServiceSubscope()).to.equal(expectedSubscope(a.vaultLauncherId));
  });

  it('does not emit when the verifier adapter rejects the proof', async () => {
    const { verifier, emitter } = await deployFixture();
    await verifier.setResult(false);
    await expect(emitter.verifyAndEmit(attestation(), PROOF))
      .to.be.revertedWithCustomError(emitter, 'InvalidZkPassportProof');
  });

  it('rejects malformed vault binding when the verifier adapter reports wrong custom data', async () => {
    const { verifier, emitter } = await deployFixture();
    await verifier.setRequiredServiceSubscope(`vault:${b32('99')}`);
    await expect(emitter.verifyAndEmit(attestation(), PROOF))
      .to.be.revertedWithCustomError(emitter, 'InvalidZkPassportProof');
  });

  it('exposes the canonical vault subscope string for proof custom_data binding', async () => {
    const { emitter } = await deployFixture();
    const a = attestation();
    expect(await emitter.expectedVaultSubscope(a.vaultLauncherId)).to.equal(expectedSubscope(a.vaultLauncherId));
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

  it('rejects stale proof timestamps before calling the verifier', async () => {
    const { verifier, emitter } = await deployFixture();
    const maxProofAge = 7 * 24 * 60 * 60;
    const currentTimestamp = await time.latest();
    const a = attestation({ proofTimestamp: currentTimestamp - maxProofAge });
    await time.setNextBlockTimestamp(currentTimestamp + 1);
    await expect(emitter.verifyAndEmit(a, PROOF))
      .to.be.revertedWithCustomError(emitter, 'StaleProofTimestamp')
      .withArgs(a.proofTimestamp, currentTimestamp + 1);
    expect(await verifier.lastBridgePolicyHash()).to.equal(ethers.ZeroHash);
  });

  it('rejects bridge coin ids that do not match the attested parent, policy, and amount', async () => {
    const { verifier, emitter } = await deployFixture();
    const a = attestation({ bridgeCoinId: b32('99') });
    await expect(emitter.verifyAndEmit(a, PROOF))
      .to.be.revertedWithCustomError(emitter, 'InvalidBridgeCoinId')
      .withArgs(chiaCoinId(a.bridgeParentId, BRIDGE_POLICY_HASH, a.bridgeAmount), a.bridgeCoinId);
    expect(await verifier.lastBridgePolicyHash()).to.equal(ethers.ZeroHash);
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
      a.bridgeCoinId,
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
