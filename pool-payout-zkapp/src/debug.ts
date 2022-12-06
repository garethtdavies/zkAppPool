import {
  Field,
  Circuit,
  isReady,
  shutdown
} from 'snarkyjs';

(async function main() {

  await isReady;

  const input1 = Field(8)
  const input2 = Field(60)

  const checkBigger = Circuit.if(
    input1.gte(input2),
    (() => {
      // TRUE
      return input1;
    })(),
    (() => {
      // FALSE
      return input2;
    })(),
  );

  console.log(checkBigger.toString());

  await shutdown();
})();
