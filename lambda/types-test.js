"use strict";
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
(function main() {
    return __awaiter(this, void 0, void 0, function () {
        var num1, num2, num1EqualsNum2, signedNum1, signedNum2, signedNumSum, char1, char2, str1, privateKey, publicKey, data1, data2, signature, verifiedData1, verifiedData2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, snarkyjs_1.isReady];
                case 1:
                    _a.sent();
                    num1 = snarkyjs_1.UInt32.fromNumber(40);
                    num2 = snarkyjs_1.UInt64.fromNumber(40);
                    num1EqualsNum2 = num1.toUInt64().equals(num2);
                    console.log("num1 == num2: ".concat(num1EqualsNum2.toString()));
                    console.log("Fields in num1: ".concat(num1.toFields().length));
                    signedNum1 = snarkyjs_1.Int64.fromNumber(-3);
                    signedNum2 = snarkyjs_1.Int64.fromNumber(45);
                    signedNumSum = signedNum1.add(signedNum2);
                    console.log("signedNum1 + signedNum2: ".concat(signedNumSum.toString()));
                    console.log("Fields in signedNum1: ".concat(signedNum1.toFields().length));
                    char1 = snarkyjs_1.Character.fromString('c');
                    char2 = snarkyjs_1.Character.fromString('d');
                    console.log("char1: ".concat(char1.toString()));
                    console.log("char1 == char2:: ".concat(char1.equals(char2).toString()));
                    console.log("Fields in char1: ".concat(char1.toFields().length));
                    str1 = snarkyjs_1.CircuitString.fromString('abc..xyz');
                    console.log("str1: ".concat(str1.toString()));
                    console.log("Fields in str1: ".concat(str1.toFields().length));
                    privateKey = snarkyjs_1.PrivateKey.random();
                    publicKey = privateKey.toPublicKey();
                    data1 = char2.toFields().concat(signedNumSum.toFields());
                    data2 = char1.toFields().concat(str1.toFields());
                    signature = snarkyjs_1.Signature.create(privateKey, [publicKey.toFields()[0], publicKey.toFields()[1]]);
                    verifiedData1 = signature.verify(publicKey, data1);
                    verifiedData2 = signature.verify(publicKey, [publicKey.toFields()[1]]);
                    console.log("private key: ".concat(privateKey.toBase58()));
                    console.log("public key: ".concat(publicKey.toBase58()));
                    console.log("Fields in private key: ".concat(privateKey.toFields().length));
                    console.log("Fields in public key: ".concat(publicKey.toFields().length));
                    console.log("signature verified for data1: ".concat(verifiedData1.toString()));
                    console.log("signature verified for data2: ".concat(verifiedData2.toString()));
                    console.log("Fields in signature: ".concat(signature.toFields().length));
                    return [4 /*yield*/, (0, snarkyjs_1.shutdown)()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
})();
