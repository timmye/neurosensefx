import { CTraderCommand } from "./CTraderCommand";
import { CTraderCommandMapParameters } from "./CTraderCommandMapParameters";
import { GenericObject } from "../utilities/GenericObject";
export declare class CTraderCommandMap {
    #private;
    constructor({ send, onCommandTimeout, commandTtlMs, }: CTraderCommandMapParameters);
    get openCommands(): CTraderCommand[];
    get pendingCommandCount(): number;
    create({ clientMsgId, message, }: {
        clientMsgId: string;
        message: GenericObject;
    }): Promise<GenericObject>;
    extractById(clientMsgId: string): CTraderCommand | undefined;
    rejectAll(error: Error): void;
}
