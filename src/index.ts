import { EventEmitter } from "events";
import { isAddress } from "web3-utils";
import { addHexPrefix, bufferToHex, bufferToInt } from "ethereumjs-util";
import Safe from "@lux-wallet/gnosis-sdk";
import { SafeTransaction, SafeSignature } from "@gnosis.pm/safe-core-sdk-types";

export const keyringType = "Gnosis";
export const TransactionBuiltEvent = "TransactionBuilt";

interface SignTransactionOptions {
  signatures: string[];
  provider: any;
}

interface DeserializeOption {
  accounts?: string[];
  networkIdMap?: Record<string, string>;
}

function sanitizeHex(hex: string): string {
  hex = hex.substring(0, 2) === "0x" ? hex.substring(2) : hex;
  if (hex === "") {
    return "";
  }
  hex = hex.length % 2 !== 0 ? "0" + hex : hex;
  return "0x" + hex;
}

class GnosisKeyring extends EventEmitter {
  static type = keyringType;
  accounts: string[] = [];
  accountToAdd: string | null = null;
  networkIdMap: Record<string, string> = {};
  currentTransaction: SafeTransaction | null = null;
  onExecedTransaction: ((hash: string) => void) | null = null;
  safeInstance: Safe | null = null;

  constructor(options: DeserializeOption) {
    super();
    this.deserialize(options);
  }

  deserialize(opts: DeserializeOption) {
    if (opts.accounts) {
      this.accounts = opts.accounts;
    }
    if (opts.networkIdMap) {
      this.networkIdMap = opts.networkIdMap;
    }
    // filter address which dont have networkId in cache
    this.accounts = this.accounts.filter(
      (account) => account.toLowerCase() in this.networkIdMap
    );
  }

  serialize() {
    return Promise.resolve({
      accounts: this.accounts,
      networkIdMap: this.networkIdMap,
    });
  }

  setAccountToAdd = (account: string) => {
    this.accountToAdd = account;
  };

  getAccounts() {
    return this.accounts;
  }

  addAccounts = () => {
    if (!this.accountToAdd) throw new Error("There is no address to add");
    if (!isAddress(this.accountToAdd)) {
      throw new Error("The address you're are trying to import is invalid");
    }
    const prefixedAddress = addHexPrefix(this.accountToAdd);

    if (
      this.accounts.find(
        (acct) => acct.toLowerCase() === prefixedAddress.toLowerCase()
      )
    ) {
      throw new Error("The address you're are trying to import is duplicate");
    }

    this.accounts.push(prefixedAddress);

    return [prefixedAddress];
  };

  removeAccount(address: string): void {
    this.accounts = this.accounts.filter(
      (account) => account.toLowerCase() !== address.toLowerCase()
    );
  }

  async confirmTransaction({
    safeAddress,
    transaction,
    networkId,
    provider,
  }: {
    safeAddress: string;
    transaction: SafeTransaction | null;
    networkId: string;
    provider: any;
  }) {
    let isCurrent = false; // Confirming a stash transaction or not
    if (!transaction) {
      transaction = this.currentTransaction!;
      isCurrent = true;
    }
    if (!transaction) throw new Error("No avaliable transaction");
    let safe = this.safeInstance;
    if (!isCurrent) {
      const safeInfo = await Safe.getSafeInfo(safeAddress, networkId);
      safe = new Safe(safeAddress, safeInfo.version, provider, networkId);
    }
    await safe!.confirmTransaction(transaction);
    const threshold = await safe!.getThreshold();
    this.emit("", {
      safeAddress,
      data: {
        signatures: transaction.signatures,
        threshold,
      },
    });
    return transaction;
  }

  async execTransaction({
    safeAddress,
    transaction,
    networkId,
    provider,
  }: {
    safeAddress: string;
    transaction: SafeTransaction | null;
    networkId: string;
    provider: any;
  }) {
    let isCurrent = false; // Confirming a stash transaction or not
    if (!transaction) {
      transaction = this.currentTransaction!;
      isCurrent = true;
    }
    if (!transaction) throw new Error("No avaliable transaction");
    let safe = this.safeInstance;
    if (!isCurrent) {
      const safeInfo = await Safe.getSafeInfo(safeAddress, networkId);
      safe = new Safe(safeAddress, safeInfo.version, provider, networkId);
    }
    const result = await safe!.executeTransaction(transaction);
    this.onExecedTransaction && this.onExecedTransaction(result.hash);
    return result.hash;
  }

  async signTransaction(
    address: string,
    transaction,
    opts: SignTransactionOptions
  ) {
    return new Promise(async (resolve) => {
      if (
        !this.accounts.find(
          (account) => account.toLowerCase() === address.toLowerCase()
        )
      ) {
        throw new Error("Can not find this address");
      }
      const tx = {
        data: this._normalize(transaction.data) || "0x",
        from: address,
        gas: this._normalize(transaction.gas),
        gasPrice: bufferToInt(transaction.gasPrice),
        nonce: bufferToInt(transaction.nonce),
        to: this._normalize(transaction.to),
        value: this._normalize(transaction.value) || "0x0", // prevent 0x
      };
      const networkId = this.networkIdMap[address.toLowerCase()];
      const safeInfo = await Safe.getSafeInfo(address, networkId);
      const safe = new Safe(
        address,
        safeInfo.version,
        opts.provider,
        networkId
      );
      const safeTransaction = await safe.buildTransaction(tx);
      const transactionHash = await safe.getTransactionHash(safeTransaction);
      await safe.postTransaction(safeTransaction, transactionHash);
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
    });
  }

  signTypedData() {
    throw new Error('Gnosis address not support signTypedData')
  }

  signPersonalMessage() {
    throw new Error('Gnosis address not support signPersonalMessage')
  }

  _normalize(buf) {
    return sanitizeHex(bufferToHex(buf).toString());
  }
}

export default GnosisKeyring;
