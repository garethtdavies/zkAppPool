import { isReady, UInt32, UInt64, Bool, Int64, Character, PublicKey, PrivateKey, Field, Signature, shutdown, CircuitString } from "snarkyjs";

(async function main() {

  await isReady;

  const num1 = UInt32.fromNumber(40);
  const num2 = UInt64.fromNumber(40);

  const num1EqualsNum2: Bool = num1.toUInt64().equals(num2);

  console.log(`num1 == num2: ${num1EqualsNum2.toString()}`);
  console.log(`Fields in num1: ${num1.toFields().length}`);

  // --------------------------------------

  const signedNum1 = Int64.fromNumber(-3);
  const signedNum2 = Int64.fromNumber(45);

  const signedNumSum = signedNum1.add(signedNum2);

  console.log(`signedNum1 + signedNum2: ${signedNumSum.toString()}`);
  console.log(`Fields in signedNum1: ${signedNum1.toFields().length}`);

  // --------------------------------------

  const char1 = Character.fromString('c');
  const char2 = Character.fromString('d');

  console.log(`char1: ${char1.toString()}`);
  console.log(`char1 == char2:: ${char1.equals(char2).toString()}`);
  console.log(`Fields in char1: ${char1.toFields().length}`);

  const str1 = CircuitString.fromString('abc..xyz');
  console.log(`str1: ${str1.toString()}`);
  console.log(`Fields in str1: ${str1.toFields().length}`);

  // --------------------------------------

  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();

  const data1 = char2.toFields().concat(signedNumSum.toFields())
  const data2 = char1.toFields().concat(str1.toFields());

  const signature = Signature.create(privateKey, [publicKey.toFields()[0], publicKey.toFields()[1]]);

  const verifiedData1 = signature.verify(publicKey, data1);
  const verifiedData2 = signature.verify(publicKey, [publicKey.toFields()[1]]);

  console.log(`private key: ${privateKey.toBase58()}`);
  console.log(`public key: ${publicKey.toBase58()}`);
  console.log(`Fields in private key: ${privateKey.toFields().length}`);
  console.log(`Fields in public key: ${publicKey.toFields().length}`);

  console.log(`signature verified for data1: ${verifiedData1.toString()}`);
  console.log(`signature verified for data2: ${verifiedData2.toString()}`);

  console.log(`Fields in signature: ${signature.toFields().length}`);

  await shutdown();

})();