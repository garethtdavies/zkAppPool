"use strict";
// This API returns data for the Foundation delegation program
// Using this API in a zkApp you can prove (using MinaExplorer data) that a delegating key
// received the rewards for the stated epoch
// Takes as input the delegating key and the epoch in question
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var snarkyjs_1 = require("snarkyjs");
var graphql_request_1 = require("graphql-request");
// This query gets the delegation balance of the key in question
var query = (0, graphql_request_1.gql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\nquery foundationDelegation($pk: String!, $epoch: Int!) {\n  stake(query: {public_key: $pk, epoch: $epoch}) {\n    delegate\n    balance\n  }\n}\n"], ["\nquery foundationDelegation($pk: String!, $epoch: Int!) {\n  stake(query: {public_key: $pk, epoch: $epoch}) {\n    delegate\n    balance\n  }\n}\n"
    // This query gets the total staked in the pool
])));
// This query gets the total staked in the pool
var query2 = (0, graphql_request_1.gql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\nquery totalStaked($pk: String!, $epoch: Int!) {\n  stake(query: {public_key: $pk, epoch: $epoch}) {\n    delegationTotals {\n      totalDelegated\n    }\n  }\n}\n"], ["\nquery totalStaked($pk: String!, $epoch: Int!) {\n  stake(query: {public_key: $pk, epoch: $epoch}) {\n    delegationTotals {\n      totalDelegated\n    }\n  }\n}\n"
    // This query gets the number of blocks won by the producer
])));
// This query gets the number of blocks won by the producer
var query3 = (0, graphql_request_1.gql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\nquery blocksWon($pk: String!, $epoch: Int!) {\n  blocks(query: {transactions: {coinbase_ne: \"0\"}, protocolState: {consensusState: {epoch: $epoch}}, canonical: true, creator: $pk}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {\n    blockHeight\n  }\n}\n"], ["\nquery blocksWon($pk: String!, $epoch: Int!) {\n  blocks(query: {transactions: {coinbase_ne: \"0\"}, protocolState: {consensusState: {epoch: $epoch}}, canonical: true, creator: $pk}, sortBy: BLOCKHEIGHT_DESC, limit: 1000) {\n    blockHeight\n  }\n}\n"
    // This query gets the total amount received to an address between slot numbers
    // Slot numbers are slow so we get the block heights
])));
// This query gets the total amount received to an address between slot numbers
// Slot numbers are slow so we get the block heights
var query4 = (0, graphql_request_1.gql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\nquery minBlockHeight($slotMin: Int!, $slotMax: Int!) {\n  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_ASC) {\n    blockHeight\n  }\n}\n"], ["\nquery minBlockHeight($slotMin: Int!, $slotMax: Int!) {\n  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_ASC) {\n    blockHeight\n  }\n}\n"])));
var query5 = (0, graphql_request_1.gql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\nquery minBlockHeight($slotMin: Int!, $slotMax: Int!) {\n  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_DESC) {\n    blockHeight\n  }\n}\n"], ["\nquery minBlockHeight($slotMin: Int!, $slotMax: Int!) {\n  blocks(query: {canonical: true, protocolState: {consensusState: {slotSinceGenesis_gte: $slotMin, slotSinceGenesis_lte: $slotMax}}}, limit: 1, sortBy: BLOCKHEIGHT_DESC) {\n    blockHeight\n  }\n}\n"])));
var query6 = (0, graphql_request_1.gql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\nquery receivedAmounts($pk: String!, $blockMin: Int!, $blockMax: Int!) {\n  transactions(query: {to: $pk, canonical: true, blockHeight_gte: $blockMin, blockHeight_lte: $blockMax}) {\n    amount\n  }\n}\n"], ["\nquery receivedAmounts($pk: String!, $blockMin: Int!, $blockMax: Int!) {\n  transactions(query: {to: $pk, canonical: true, blockHeight_gte: $blockMin, blockHeight_lte: $blockMax}) {\n    amount\n  }\n}\n"])));
exports.handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var eventKey, epochEvent, minSlotNumber, maxSlotNumber, privateKey, signingKey, balanceData, epochBalanceData, delegatingKeyData, delegatedBalanceData, blocksWonData, payout, minBlockHeight, maxBlockHeight, receivedAmounts, sum, epoch, totalDelegatedBalance, publicKey, producerKey, blocksWon, delegatedBalance, amountOwed, amountSent, data1, signature, data, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: 
            // Eventually we will process the event and use it to generate the correct response for the key and epoch 
            // but for now, we'll just mock  this data
            return [4 /*yield*/, snarkyjs_1.isReady];
            case 1:
                // Eventually we will process the event and use it to generate the correct response for the key and epoch 
                // but for now, we'll just mock  this data
                _a.sent();
                eventKey = "B62qjWrka3sHmyX9E3LLk7DYwTkD3xpVxJVWeC1jWesvUCw98jzwLEb";
                epochEvent = 38;
                minSlotNumber = (epochEvent * 7140) + 3501;
                maxSlotNumber = ((epochEvent + 1) * 7140) + 3500;
                console.log(minSlotNumber);
                console.log(maxSlotNumber);
                privateKey = snarkyjs_1.PrivateKey.fromBase58("EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53");
                signingKey = privateKey.toPublicKey();
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query, { pk: eventKey, epoch: epochEvent }).then(function (data) {
                        return data.stake;
                    })];
            case 2:
                balanceData = _a.sent();
                epochBalanceData = balanceData.balance;
                delegatingKeyData = balanceData.delegate;
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query2, { pk: delegatingKeyData, epoch: epochEvent }).then(function (data) {
                        return data.stake.delegationTotals.totalDelegated;
                    })];
            case 3:
                delegatedBalanceData = _a.sent();
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query3, { pk: delegatingKeyData, epoch: epochEvent }).then(function (data) {
                        return data.blocks.length;
                    })];
            case 4:
                blocksWonData = _a.sent();
                payout = Math.floor(0.95 * 720 * (epochBalanceData / delegatedBalanceData) * blocksWonData * 100000) / 100000;
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query4, { slotMin: minSlotNumber, slotMax: maxSlotNumber }).then(function (data) {
                        return data.blocks[0].blockHeight;
                    })];
            case 5:
                minBlockHeight = _a.sent();
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query5, { slotMin: minSlotNumber, slotMax: maxSlotNumber }).then(function (data) {
                        return data.blocks[0].blockHeight;
                    })];
            case 6:
                maxBlockHeight = _a.sent();
                return [4 /*yield*/, (0, graphql_request_1.request)('https://graphql.minaexplorer.com', query6, { pk: eventKey, blockMin: minBlockHeight, blockMax: maxBlockHeight }).then(function (data) {
                        return data.transactions;
                    })];
            case 7:
                receivedAmounts = _a.sent();
                sum = receivedAmounts.reduce(function (sum, current) { return sum + current.amount; }, 0);
                console.log(sum);
                console.log(payout);
                console.log(epochBalanceData);
                console.log(delegatedBalanceData);
                console.log(blocksWonData);
                epoch = snarkyjs_1.UInt32.fromNumber(epochEvent);
                totalDelegatedBalance = snarkyjs_1.UInt64.fromNumber(delegatedBalanceData * 1000000000);
                publicKey = snarkyjs_1.PublicKey.fromBase58(eventKey);
                producerKey = snarkyjs_1.PublicKey.fromBase58(delegatingKeyData);
                blocksWon = snarkyjs_1.UInt32.fromNumber(blocksWonData);
                delegatedBalance = snarkyjs_1.UInt64.fromNumber(epochBalanceData * 1000000000);
                amountOwed = snarkyjs_1.UInt64.fromNumber(payout * 1000000000);
                amountSent = snarkyjs_1.UInt64.fromNumber(sum);
                data1 = epoch.toFields().concat(publicKey.toFields()).concat(producerKey.toFields()).concat(blocksWon.toFields()).concat(delegatedBalance.toFields()).concat(totalDelegatedBalance.toFields()).concat(amountOwed.toFields()).concat(amountSent.toFields());
                signature = snarkyjs_1.Signature.create(privateKey, data1);
                data = {
                    data: {
                        "epoch": epoch,
                        "publicKey": publicKey,
                        "producerKey": producerKey,
                        "blocksWon": blocksWon,
                        "delegatedBalance": delegatedBalance,
                        "totalDelegatedBalance": totalDelegatedBalance,
                        "amountOwed": amountOwed,
                        "amountSent": amountSent
                    },
                    signature: signature,
                    publicKey: signingKey
                };
                response = {
                    statusCode: 200,
                    body: JSON.stringify(data)
                };
                console.log(response);
                return [2 /*return*/, response];
        }
    });
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
