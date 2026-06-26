/// <reference types="node" />
import * as EventEmitter from "events";
import { GenericObject } from "./utilities/GenericObject";
import { CTraderConnectionParameters } from "./CTraderConnectionParameters";
export declare class CTraderConnection extends EventEmitter {
    #private;
    constructor({ host, port, commandTtlMs, }: CTraderConnectionParameters);
    getPayloadTypeByName(name: string): number | undefined;
    sendCommand(payloadType: string | number, data?: GenericObject): Promise<GenericObject>;
    trySendCommand(payloadType: string | number, data?: GenericObject): Promise<GenericObject | undefined>;
    sendHeartbeat(): void;
    get pendingCommandCount(): number;
    open(): Promise<unknown>;
    on(type: string | symbol, listener: (...parameters: any) => any): this;
    off(type: string | symbol, listener: (...parameters: any) => any): this;
    removeListener(type: string | symbol, listener: (...parameters: any) => any): this;
    removeAllListeners(type?: string | symbol): this;
    close(): void;
    static getAccessTokenProfile(accessToken: string): Promise<GenericObject>;
    static getAccessTokenAccounts(accessToken: string): Promise<GenericObject[]>;
}
