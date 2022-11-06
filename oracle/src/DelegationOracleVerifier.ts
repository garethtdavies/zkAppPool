/* This smart contract takes in an oracle source */

import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  Signature,
  UInt64,
  UInt32,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

export class DelegationOracle extends SmartContract {
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  // Define contract events

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init() {
    // Initialize contract state
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  }

  // Define contract events
  events = {
    verified: PublicKey,
    producerKey: PublicKey,
    epoch: UInt32
  };

  // This method verifies that the amount received is greater than the amount owed and if so will emit an event
  @method verify(epoch: UInt32, publicKey: PublicKey, producerKey: PublicKey, blocksWon: UInt32, delegatedBalance: UInt64, totalDelegatedBalance: UInt64, amountOwed: UInt64, amountSent: UInt64, signature: Signature) {

    let oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // Hack
    oraclePublicKey = PublicKey.fromBase58("B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1");


    // Evaluate whether the signature is valid for the provided data
    const signedData = epoch.toFields().concat(publicKey.toFields()).concat(producerKey.toFields()).concat(blocksWon.toFields()).concat(delegatedBalance.toFields()).concat(totalDelegatedBalance.toFields()).concat(amountOwed.toFields()).concat(amountSent.toFields());

    const validSignature = signature.verify(oraclePublicKey, signedData);

    // Check that the signature is valid
    validSignature.assertTrue();

    // Check that they have paid enough
    amountSent.assertGte(amountOwed);

    // Emit an event containing the verified users id
    this.emitEvent('verified', publicKey);
    this.emitEvent('producerKey', publicKey);
    this.emitEvent('epoch', epoch);
  }
}