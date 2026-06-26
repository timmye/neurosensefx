export type CTraderCommandMapParameters = {
    send: (...parameters: any[]) => void;
    onCommandTimeout?: () => void;
    commandTtlMs?: number;
};
