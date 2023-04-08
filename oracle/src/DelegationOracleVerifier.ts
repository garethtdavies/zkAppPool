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
  Circuit,
} from 'snarkyjs';

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY = 'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

export class DelegationOracle extends SmartContract {
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  init() {
    super.init();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    //Circuit.log('key', ORACLE_PUBLIC_KEY);
    //Circuit.log('key', PublicKey.fromBase58(ORACLE_PUBLIC_KEY).toBase58());
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  }

  // Define contract events
  events = {
    verified: PublicKey,
    producerKey: PublicKey,
    epoch: UInt32
  };

  // This method verifies that the amount received by the delegating key is greater than the amount owed and if so will emit an event that can be read on-chain
  @method verify(epoch: UInt32, publicKey: PublicKey, producerKey: PublicKey, blocksWon: UInt32, delegatedBalance: UInt64, totalDelegatedBalance: UInt64, amountOwed: UInt64, amountSent: UInt64, signature: Signature) {

    let oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // Hack - need to understand why this doesn't work as is but works like this. Otherwise error is https://gist.github.com/garethtdavies/b5deadda86f1fd4a3b5b9efb13a0284e
    oraclePublicKey = PublicKey.fromBase58("B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1");

    // Evaluate whether the signature is valid for the provided data
    const signedData = epoch.toFields().concat(publicKey.toFields()).concat(producerKey.toFields()).concat(blocksWon.toFields()).concat(delegatedBalance.toFields()).concat(totalDelegatedBalance.toFields()).concat(amountOwed.toFields()).concat(amountSent.toFields());

    const validSignature = signature.verify(oraclePublicKey, signedData);

    // Check that the signature is valid
    validSignature.assertTrue();

    // Check that they have paid enough
    amountSent.assertGreaterThanOrEqual(amountOwed);

    // Emit an event containing the verified users id
    this.emitEvent('verified', publicKey);
    this.emitEvent('producerKey', producerKey);
    this.emitEvent('epoch', epoch);
  }
}
