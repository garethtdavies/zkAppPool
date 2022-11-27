// npm run build && node build/src/local.js

import {
  SmartContract,
  Mina,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  UInt64,
  UInt32,
  Struct,
  isReady,
  PrivateKey,
  AccountUpdate,
  shutdown,
  state,
  State,
} from 'snarkyjs';

const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

export class Reward extends Struct({
  index: UInt32,
  publicKey: PublicKey,
  rewards: UInt64
}) { }

export class Rewards extends Struct(
  [Reward, Reward, Reward, Reward, Reward, Reward, Reward, Reward, Reward]) { }

export class PoolPayout extends SmartContract {

  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      incrementNonce: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
    });

    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  }

  @method sendReward(accounts: Rewards) {

    let oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    for (let [_, value] of Object.entries(accounts)) {
      this.send({
        to: value.publicKey,
        amount: value.rewards,
      });
    }
  }
}

(async function main() {

  await isReady;

  console.log('SnarkyJS loaded');

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const deployerAccount = Local.testAccounts[0].privateKey;

  const zkAppPrivateKey = Local.testAccounts[1].privateKey;
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  const zkAppInstance = new PoolPayout(zkAppAddress);

  console.log('Compiling smart contract...');
  let { verificationKey } = await PoolPayout.compile();

  console.log("Deploying");
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey, verificationKey: verificationKey });
    zkAppInstance.requireSignature();
  });
  deploy_txn.sign([zkAppPrivateKey]);
  await deploy_txn.send();

  // Add some test payouts
  let rewardFields: Rewards = [];
  for (let i = 0; i < 9; i++) {
    rewardFields.push({
      index: UInt32.from(i),
      publicKey: PrivateKey.random().toPublicKey(),
      rewards: UInt64.from(5_000_000_000),
    });
  }

  try {
    let transaction = await Mina.transaction(
      { feePayerKey: deployerAccount, fee: 100_000_000 },
      () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        zkAppInstance.sendReward(rewardFields);
      }
    );

    console.log("Proving transaction");
    transaction.prove();

    console.log("Sending transaction");
    console.log(transaction.toPretty());

    await transaction.send();

  } catch (error: any) {
    console.log("There was an issue");
    console.log(error.message);
  }

  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();
