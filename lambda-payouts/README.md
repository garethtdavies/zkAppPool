# zkApp Pool Oracle

This oracle gets the process data from MinaExplorer GraphQL API and calculates the payouts. The data is signed, so we know in the zkApp that this source is being used, so while anyone can run the oracle and check the data produced, the zkApp proof will only be valid if using the source signed by the MinaExplorer Oracle key.

The calculations for the payouts are currently done in the oracle and are assigned a deterministic index (based on sorting on delegated amount). This is so we can use a sequencer to process these payouts in order. 

Anyone can run the zkApp to send the payouts - the order is enforced by the zkApp. Most likely the pool operator will do so, as there would be transaction fees to be spent. The limitation is that you are trusting the oracle, run by MinaExplorer to be correct and available.

Pool operators may wish to run their own oracles (can deploy this code), which would allow them to ensure that only data they publish is used in their zkApp and also would allow them to customize the payout algorithm if they wish. There is no dependence on the specific data source, and that could be replaced, perhaps using an archive node or alternitavely adding multiple, and then checking both sources match in the zkApp.

* The zkApp needs to ensure no double payouts
* Need to have a check that it isn't run too early before the end of the epoch (this could be done, but needs a slightly different implementation)
* Need to have a precondition on the payout index, which can be stored on-chain
* How would we manage multiple epochs - you would have to complete the prior one first

State variables:
* Oracle key (2 slots)
* Payout Index
* Epoch
* Validator key (2 slots)

You can't run this before 15 blocks (or whatever is set in `confirmations`) have passed in the next epoch.

The advantage of this, is that the oracle runs independently and anyone can then enforce the payout. It can also handles the payout to the validator in the zkApp (so is configurable) as the last payout of the epoch. Permissions could be added to the zkApp that only allows payouts via proofs, so a validator couldn't steal the funds (unless they hacked the oracle).

The key part is here we can enforce order on the output so possible to process a zkApp using preconditions on the order.

How to handle the validator payout? Have a different method that checks all have been completed then let them take the fixed percentage.

We enforce the percentage to take on the zkApp. So these amounts are rewards before fees.