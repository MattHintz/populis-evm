# Populis EVM

Solidity contracts for the Populis zkPassport attestation event path.

## Scope

This workspace starts the backend-free enrollment path:

1. A user verifies a zkPassport proof on EVM.
2. `PopulisZkPassportAttestationEmitter` asks a verifier adapter to validate the proof and commitment bundle.
3. The contract emits a canonical commitment-only event.
4. The Angular portal polls the EVM event, asks enough bridge validators or members to sign the canonical message, builds the Chia bridge/message coin spend in WASM, and then builds the vault enrollment spend.
5. The user explicitly signs the vault spend with EVM, Chia BLS, or passkey auth.
6. No Populis backend signs or approves normal enrollment.

## Current brick

`contracts/PopulisZkPassportAttestationEmitter.sol` is intentionally an adapter scaffold. It defines the commitment-only event and validator-message field ordering while keeping the exact zkPassport verifier ABI behind `IZkPassportVerifierAdapter`. The real adapter can be swapped in once the production verifier call shape is pinned.

Warp Green is not required in the normal target path. A Warp-backed bridge can remain a future compatibility adapter, but the primary architecture is frontend-relayed and Chia-verified by a validator/member quorum puzzle.

## Validator message fields

The fixed-width message fields that validators sign and the Chia bridge puzzle verifies are:

| Index | Value |
| --- | --- |
| 0 | policy version |
| 1 | vault launcher id |
| 2 | new identity attestation root |
| 3 | bridge policy hash |
| 4 | Chia bridge message |
| 5 | attestation leaf hash |
| 6 | scoped nullifier |
| 7 | nullifier type |
| 8 | service scope hash |
| 9 | service subscope hash |
| 10 | proof timestamp |

No passport plaintext or disclosed PII should be included.

## Security gates from audit feedback

- Vault identity enrollment must require current-owner authorization before it ships.
- Passkey vault launches must reject compressed secp256r1 owner keys before passkey vaults ship.
- The frontend may build and relay bridge spends, but the Chia bridge puzzle must enforce validator/member quorum signatures cryptographically.

## Commands

```bash
npm install
npm test
```

## References

- `../research/solslot-samuel`: Chia CLVM loading, currying, coin-spend assembly, and signature aggregation pattern.
- `../research/solslot-omnichain`: Useful Warp/omnichain reference only; not required by the primary frontend-relayed validator bridge.
- `../populis_protocol/populis_puzzles/vault_singleton_inner.clsp`: Chia vault `'z'` enrollment spend that consumes the bridge coin announcement.
