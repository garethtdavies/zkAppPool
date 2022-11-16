// This script will read events for the zkApp publickey via the MinaExplorer GraphQL API
// npm run build && node ./build/src/output.js

import {
  isReady,
  shutdown,
  PublicKey,
  Field,
  Bool,
} from 'snarkyjs';
import { request, gql } from 'graphql-request';

// The zkApp public key is B62qoDSzH2npmB1jC434dYdmw2gbHvhez2rfmzrj9a58RHe1DQLTgps so we'll just hardcode this
// We are checking that the tx didn't fail and is in the canonical chain.
// The blockHeight in the query is just to remove some of my testing and is not required.
const query = gql`
query getEvents {
  zkapps(query: {zkappCommand: {accountUpdates: {body: {publicKey: "B62qoDSzH2npmB1jC434dYdmw2gbHvhez2rfmzrj9a58RHe1DQLTgps"}}}, canonical: true, failureReason_exists: false}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {
    hash
    blockHeight
    zkappCommand {
      accountUpdates {
        body {
          events
          publicKey
        }
      }
    }
  }
}
`;

(async function main() {

  await isReady;

  // Set some headers for the output
  console.log("Epoch", "ProducerKey", "DelegatingKey", "TransactionHash");

  // This returns an array that includes the zkApp hash and the stored events
  const eventData = await request('https://berkeley.graphql.minaexplorer.com', query).then((data) => {
    return data.zkapps;
  });


  for (var event of eventData) {
    let blockHeight = event.blockHeight;
    let txhash = event.hash;
    let events = event.zkappCommand.accountUpdates[0].body.events;

    // Skip if empty events
    if (events.length !== 0) {
      // We now have an array of strings storing the epoch, delegating key and producer key which we need to parse
      /*
      [
        '0,39',
        '1,26150952379243507871607825967736271252178805445177618043717111529308046598186,1',
        '2,2842267390317630846193264213920930721830097341008791000054477767930260033567,1'
      ]
      */

      // This is stored as a comma seperated string.
      // We need to break apart based on comma, but keeping all fields as strings as else large ints cause issues
      let epoch = events[0].split(",");
      let producerKey = events[1].split(",");
      let delegatingKey = events[2].split(",");

      //console.log(epoch);
      //console.log(producerKey);
      //console.log(delegatingKey);

      // Convert the keys
      let producerKeyDecoded = PublicKey.from({
        x: Field(producerKey[1]),
        isOdd: Bool(Boolean(Number(producerKey[2]))),
      });

      let delegatingKeyDecoded = PublicKey.from({
        x: Field(delegatingKey[1]),
        isOdd: Bool(Boolean(Number(delegatingKey[2]))),
      });

      // if you are in this list you are good...
      console.log(epoch[1], producerKeyDecoded.toBase58(), delegatingKeyDecoded.toBase58(), txhash);

    }
  }

  await shutdown();

})();
