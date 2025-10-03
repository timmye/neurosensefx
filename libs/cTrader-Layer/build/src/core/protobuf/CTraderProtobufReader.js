"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CTraderProtobufReader_instances, _CTraderProtobufReader_params, _CTraderProtobufReader_builder, _CTraderProtobufReader_payloadTypes, _CTraderProtobufReader_names, _CTraderProtobufReader_messages, _CTraderProtobufReader_enums, _CTraderProtobufReader_wrap, _CTraderProtobufReader_buildWrapper;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderProtobufReader = void 0;
const protobuf = require("protobufjs");
class CTraderProtobufReader {
    constructor(options) {
        _CTraderProtobufReader_instances.add(this);
        _CTraderProtobufReader_params.set(this, void 0);
        _CTraderProtobufReader_builder.set(this, void 0);
        _CTraderProtobufReader_payloadTypes.set(this, void 0);
        _CTraderProtobufReader_names.set(this, void 0);
        _CTraderProtobufReader_messages.set(this, void 0);
        _CTraderProtobufReader_enums.set(this, void 0);
        __classPrivateFieldSet(this, _CTraderProtobufReader_params, options, "f");
        __classPrivateFieldSet(this, _CTraderProtobufReader_builder, undefined, "f");
        __classPrivateFieldSet(this, _CTraderProtobufReader_payloadTypes, {}, "f");
        __classPrivateFieldSet(this, _CTraderProtobufReader_names, {}, "f");
        __classPrivateFieldSet(this, _CTraderProtobufReader_messages, {}, "f");
        __classPrivateFieldSet(this, _CTraderProtobufReader_enums, {}, "f");
    }
    encode(payloadType, params, clientMsgId) {
        const Message = this.getMessageByPayloadType(payloadType);
        if (!Message) {
            throw new Error(`No message definition found for payloadType: ${payloadType}`);
        }
        const message = new Message(params);
        return __classPrivateFieldGet(this, _CTraderProtobufReader_instances, "m", _CTraderProtobufReader_wrap).call(this, payloadType, message, clientMsgId).encode();
    }
    decode(buffer) {
        const protoMessage = this.getMessageByName("ProtoMessage").decode(buffer);
        const payloadType = protoMessage.payloadType;
        const messageDecoder = this.getMessageByPayloadType(payloadType);
        if (!messageDecoder) {
            return {
                payload: null,
                payloadType: payloadType,
                clientMsgId: protoMessage.clientMsgId,
            };
        }
        return {
            payload: messageDecoder.decode(protoMessage.payload),
            payloadType: payloadType,
            clientMsgId: protoMessage.clientMsgId,
        };
    }
    load() {
        __classPrivateFieldGet(this, _CTraderProtobufReader_params, "f").forEach((param) => {
            __classPrivateFieldSet(this, _CTraderProtobufReader_builder, protobuf.loadProtoFile(param.file, __classPrivateFieldGet(this, _CTraderProtobufReader_builder, "f")), "f");
        });
    }
    build() {
        const builder = __classPrivateFieldGet(this, _CTraderProtobufReader_builder, "f");
        builder.build();
        builder.ns.children.forEach((reflect) => {
            if (reflect.className === "Enum") {
                __classPrivateFieldGet(this, _CTraderProtobufReader_enums, "f")[reflect.name] = builder.build(reflect.name);
            }
        });
        builder.ns.children.forEach((reflect) => {
            if (reflect.className === "Message") {
                const messageName = reflect.name;
                const messageBuilded = builder.build(messageName);
                __classPrivateFieldGet(this, _CTraderProtobufReader_messages, "f")[messageName] = messageBuilded;
                const payloadType = this.findPayloadType(reflect);
                if (payloadType !== undefined) {
                    __classPrivateFieldGet(this, _CTraderProtobufReader_names, "f")[messageName] = {
                        messageBuilded: messageBuilded,
                        payloadType: payloadType,
                    };
                    __classPrivateFieldGet(this, _CTraderProtobufReader_payloadTypes, "f")[payloadType] = {
                        messageBuilded: messageBuilded,
                        name: messageName,
                    };
                }
            }
        });
        __classPrivateFieldGet(this, _CTraderProtobufReader_instances, "m", _CTraderProtobufReader_buildWrapper).call(this);
    }
    findPayloadType(message) {
        const field = message.children.find((field) => field.name === "payloadType");
        if (!field) {
            return undefined;
        }
        const defaultValue = field.defaultValue;
        if (typeof defaultValue === "number") {
            return defaultValue;
        }
        if (typeof defaultValue === "string") {
            return this.getPayloadTypeByEnumName(defaultValue);
        }
        return undefined;
    }
    getMessageByPayloadType(payloadType) {
        const payloadInfo = __classPrivateFieldGet(this, _CTraderProtobufReader_payloadTypes, "f")[payloadType];
        return payloadInfo ? payloadInfo.messageBuilded : undefined;
    }
    getMessageByName(name) {
        const nameInfo = __classPrivateFieldGet(this, _CTraderProtobufReader_names, "f")[name];
        return nameInfo ? nameInfo.messageBuilded : undefined;
    }
    getPayloadTypeByName(name) {
        const nameInfo = __classPrivateFieldGet(this, _CTraderProtobufReader_names, "f")[name];
        return nameInfo ? nameInfo.payloadType : undefined;
    }
    getPayloadTypeByEnumName(enumName) {
        const protoOAPayloadType = __classPrivateFieldGet(this, _CTraderProtobufReader_enums, "f")["ProtoOAPayloadType"];
        if (protoOAPayloadType && typeof protoOAPayloadType[enumName] === "number") {
            return protoOAPayloadType[enumName];
        }
        const protoPayloadType = __classPrivateFieldGet(this, _CTraderProtobufReader_enums, "f")["ProtoPayloadType"];
        if (protoPayloadType && typeof protoPayloadType[enumName] === "number") {
            return protoPayloadType[enumName];
        }
        return undefined;
    }
    resolveIdentifierToPayloadType(identifier) {
        if (typeof identifier === "number") {
            return identifier;
        }
        const enumValue = this.getPayloadTypeByEnumName(identifier);
        if (enumValue !== undefined) {
            return enumValue;
        }
        const nameInfo = __classPrivateFieldGet(this, _CTraderProtobufReader_names, "f")[identifier];
        if (nameInfo && typeof nameInfo.payloadType === "number") {
            return nameInfo.payloadType;
        }
        return undefined;
    }
}
exports.CTraderProtobufReader = CTraderProtobufReader;
_CTraderProtobufReader_params = new WeakMap(), _CTraderProtobufReader_builder = new WeakMap(), _CTraderProtobufReader_payloadTypes = new WeakMap(), _CTraderProtobufReader_names = new WeakMap(), _CTraderProtobufReader_messages = new WeakMap(), _CTraderProtobufReader_enums = new WeakMap(), _CTraderProtobufReader_instances = new WeakSet(), _CTraderProtobufReader_wrap = function _CTraderProtobufReader_wrap(payloadType, message, clientMsgId) {
    const ProtoMessage = this.getMessageByName("ProtoMessage");
    return new ProtoMessage({
        payloadType: payloadType,
        payload: message.toBuffer(),
        clientMsgId: clientMsgId,
    });
}, _CTraderProtobufReader_buildWrapper = function _CTraderProtobufReader_buildWrapper() {
    const name = "ProtoMessage";
    const messageBuilded = __classPrivateFieldGet(this, _CTraderProtobufReader_builder, "f").build(name);
    __classPrivateFieldGet(this, _CTraderProtobufReader_messages, "f")[name] = messageBuilded;
    __classPrivateFieldGet(this, _CTraderProtobufReader_names, "f")[name] = {
        messageBuilded: messageBuilded,
        payloadType: undefined,
    };
};
//# sourceMappingURL=CTraderProtobufReader.js.map