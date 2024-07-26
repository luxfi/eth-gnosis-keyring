/// <reference types="node" />
import { EventEmitter } from "events";
import Safe from "@luxwallet/gnosis-sdk";
import { SafeTransaction } from "@gnosis.pm/safe-core-sdk-types";
export declare const keyringType = "Gnosis";
export declare const TransactionBuiltEvent = "TransactionBuilt";
interface SignTransactionOptions {
    signatures: string[];
    provider: any;
}
interface DeserializeOption {
    accounts?: string[];
    networkIdMap?: Record<string, string>;
}
declare class GnosisKeyring extends EventEmitter {
    static type: string;
    accounts: string[];
    accountToAdd: string | null;
    networkIdMap: Record<string, string>;
    currentTransaction: SafeTransaction | null;
    onExecedTransaction: ((hash: string) => void) | null;
    safeInstance: Safe | null;
    constructor(options: DeserializeOption);
    deserialize(opts: DeserializeOption): void;
    serialize(): Promise<{
        accounts: string[];
        networkIdMap: Record<string, string>;
    }>;
    setAccountToAdd: (account: string) => void;
    getAccounts(): string[];
    addAccounts: () => string[];
    removeAccount(address: string): void;
    confirmTransaction({ safeAddress, transaction, networkId, provider, }: {
        safeAddress: string;
        transaction: SafeTransaction | null;
        networkId: string;
        provider: any;
    }): Promise<SafeTransaction>;
    execTransaction({ safeAddress, transaction, networkId, provider, }: {
        safeAddress: string;
        transaction: SafeTransaction | null;
        networkId: string;
        provider: any;
    }): Promise<string>;
    signTransaction(address: string, transaction: any, opts: SignTransactionOptions): Promise<unknown>;
    signTypedData(): void;
    signPersonalMessage(): void;
    _normalize(buf: any): string;
}
export default GnosisKeyring;
