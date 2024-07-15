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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBuiltEvent = exports.keyringType = void 0;
const events_1 = require("events");
const web3_utils_1 = require("web3-utils");
const ethereumjs_util_1 = require("ethereumjs-util");
const gnosis_sdk_1 = __importDefault(require("@lux-wallet/gnosis-sdk"));
exports.keyringType = "Gnosis";
exports.TransactionBuiltEvent = "TransactionBuilt";
function sanitizeHex(hex) {
    hex = hex.substring(0, 2) === "0x" ? hex.substring(2) : hex;
    if (hex === "") {
        return "";
    }
    hex = hex.length % 2 !== 0 ? "0" + hex : hex;
    return "0x" + hex;
}
class GnosisKeyring extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.accounts = [];
        this.accountToAdd = null;
        this.networkIdMap = {};
        this.currentTransaction = null;
        this.onExecedTransaction = null;
        this.safeInstance = null;
        this.setAccountToAdd = (account) => {
            this.accountToAdd = account;
        };
        this.addAccounts = () => {
            if (!this.accountToAdd)
                throw new Error("There is no address to add");
            if (!(0, web3_utils_1.isAddress)(this.accountToAdd)) {
                throw new Error("The address you're are trying to import is invalid");
            }
            const prefixedAddress = (0, ethereumjs_util_1.addHexPrefix)(this.accountToAdd);
            if (this.accounts.find((acct) => acct.toLowerCase() === prefixedAddress.toLowerCase())) {
                throw new Error("The address you're are trying to import is duplicate");
            }
            this.accounts.push(prefixedAddress);
            return [prefixedAddress];
        };
        this.deserialize(options);
    }
    deserialize(opts) {
        if (opts.accounts) {
            this.accounts = opts.accounts;
        }
        if (opts.networkIdMap) {
            this.networkIdMap = opts.networkIdMap;
        }
        // filter address which dont have networkId in cache
        this.accounts = this.accounts.filter((account) => account.toLowerCase() in this.networkIdMap);
    }
    serialize() {
        return Promise.resolve({
            accounts: this.accounts,
            networkIdMap: this.networkIdMap,
        });
    }
    getAccounts() {
        return this.accounts;
    }
    removeAccount(address) {
        this.accounts = this.accounts.filter((account) => account.toLowerCase() !== address.toLowerCase());
    }
    confirmTransaction({ safeAddress, transaction, networkId, provider, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let isCurrent = false; // Confirming a stash transaction or not
            if (!transaction) {
                transaction = this.currentTransaction;
                isCurrent = true;
            }
            if (!transaction)
                throw new Error("No avaliable transaction");
            let safe = this.safeInstance;
            if (!isCurrent) {
                const safeInfo = yield gnosis_sdk_1.default.getSafeInfo(safeAddress, networkId);
                safe = new gnosis_sdk_1.default(safeAddress, safeInfo.version, provider, networkId);
            }
            yield safe.confirmTransaction(transaction);
            const threshold = yield safe.getThreshold();
            this.emit("", {
                safeAddress,
                data: {
                    signatures: transaction.signatures,
                    threshold,
                },
            });
            return transaction;
        });
    }
    execTransaction({ safeAddress, transaction, networkId, provider, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let isCurrent = false; // Confirming a stash transaction or not
            if (!transaction) {
                transaction = this.currentTransaction;
                isCurrent = true;
            }
            if (!transaction)
                throw new Error("No avaliable transaction");
            let safe = this.safeInstance;
            if (!isCurrent) {
                const safeInfo = yield gnosis_sdk_1.default.getSafeInfo(safeAddress, networkId);
                safe = new gnosis_sdk_1.default(safeAddress, safeInfo.version, provider, networkId);
            }
            const result = yield safe.executeTransaction(transaction);
            this.onExecedTransaction && this.onExecedTransaction(result.hash);
            return result.hash;
        });
    }
    signTransaction(address, transaction, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                if (!this.accounts.find((account) => account.toLowerCase() === address.toLowerCase())) {
                    throw new Error("Can not find this address");
                }
                const tx = {
                    data: this._normalize(transaction.data) || "0x",
                    from: address,
                    gas: this._normalize(transaction.gas),
                    gasPrice: (0, ethereumjs_util_1.bufferToInt)(transaction.gasPrice),
                    nonce: (0, ethereumjs_util_1.bufferToInt)(transaction.nonce),
                    to: this._normalize(transaction.to),
                    value: this._normalize(transaction.value) || "0x0", // prevent 0x
                };
                const networkId = this.networkIdMap[address.toLowerCase()];
                const safeInfo = yield gnosis_sdk_1.default.getSafeInfo(address, networkId);
                const safe = new gnosis_sdk_1.default(address, safeInfo.version, opts.provider, networkId);
                const safeTransaction = yield safe.buildTransaction(tx);
                const transactionHash = yield safe.getTransactionHash(safeTransaction);
                yield safe.postTransaction(safeTransaction, transactionHash);
                this.safeInstance = safe;
                this.currentTransaction = safeTransaction;
                this.emit("TransactionBuilt", {
                    safeAddress: address,
                    data: {
                        hash: transactionHash,
                    },
                });
                this.onExecedTransaction = (hash) => {
                    resolve(hash);
                };
            }));
        });
    }
    signTypedData() {
        throw new Error('Gnosis address not support signTypedData');
    }
    signPersonalMessage() {
        throw new Error('Gnosis address not support signPersonalMessage');
    }
    _normalize(buf) {
        return sanitizeHex((0, ethereumjs_util_1.bufferToHex)(buf).toString());
    }
}
GnosisKeyring.type = exports.keyringType;
exports.default = GnosisKeyring;
