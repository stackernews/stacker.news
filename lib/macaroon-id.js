// GENERATED pbjs -t static-module -w es6 lib/macaroon-id.proto -l eslint-disable -o lib/macaroon-id.js
/*eslint-disable*/
// REPLACED AFTER GENERATION because tsx does not like the * import
// import * as $protobuf from "protobufjs/minimal";
import $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const MacaroonId = $root.MacaroonId = (() => {

    /**
     * Properties of a MacaroonId.
     * @exports IMacaroonId
     * @interface IMacaroonId
     * @property {Uint8Array|null} [nonce] MacaroonId nonce
     * @property {Uint8Array|null} [storageId] MacaroonId storageId
     * @property {Array.<IOp>|null} [ops] MacaroonId ops
     */

    /**
     * Constructs a new MacaroonId.
     * @exports MacaroonId
     * @classdesc Represents a MacaroonId.
     * @implements IMacaroonId
     * @constructor
     * @param {IMacaroonId=} [properties] Properties to set
     */
    function MacaroonId(properties) {
        this.ops = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * MacaroonId nonce.
     * @member {Uint8Array} nonce
     * @memberof MacaroonId
     * @instance
     */
    MacaroonId.prototype.nonce = $util.newBuffer([]);

    /**
     * MacaroonId storageId.
     * @member {Uint8Array} storageId
     * @memberof MacaroonId
     * @instance
     */
    MacaroonId.prototype.storageId = $util.newBuffer([]);

    /**
     * MacaroonId ops.
     * @member {Array.<IOp>} ops
     * @memberof MacaroonId
     * @instance
     */
    MacaroonId.prototype.ops = $util.emptyArray;

    /**
     * Creates a new MacaroonId instance using the specified properties.
     * @function create
     * @memberof MacaroonId
     * @static
     * @param {IMacaroonId=} [properties] Properties to set
     * @returns {MacaroonId} MacaroonId instance
     */
    MacaroonId.create = function create(properties) {
        return new MacaroonId(properties);
    };

    /**
     * Encodes the specified MacaroonId message. Does not implicitly {@link MacaroonId.verify|verify} messages.
     * @function encode
     * @memberof MacaroonId
     * @static
     * @param {IMacaroonId} message MacaroonId message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MacaroonId.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.nonce != null && Object.hasOwnProperty.call(message, "nonce"))
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.nonce);
        if (message.storageId != null && Object.hasOwnProperty.call(message, "storageId"))
            writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.storageId);
        if (message.ops != null && message.ops.length)
            for (let i = 0; i < message.ops.length; ++i)
                $root.Op.encode(message.ops[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified MacaroonId message, length delimited. Does not implicitly {@link MacaroonId.verify|verify} messages.
     * @function encodeDelimited
     * @memberof MacaroonId
     * @static
     * @param {IMacaroonId} message MacaroonId message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    MacaroonId.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a MacaroonId message from the specified reader or buffer.
     * @function decode
     * @memberof MacaroonId
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {MacaroonId} MacaroonId
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MacaroonId.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.MacaroonId();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.nonce = reader.bytes();
                    break;
                }
            case 2: {
                    message.storageId = reader.bytes();
                    break;
                }
            case 3: {
                    if (!(message.ops && message.ops.length))
                        message.ops = [];
                    message.ops.push($root.Op.decode(reader, reader.uint32()));
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a MacaroonId message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof MacaroonId
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {MacaroonId} MacaroonId
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    MacaroonId.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a MacaroonId message.
     * @function verify
     * @memberof MacaroonId
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    MacaroonId.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.nonce != null && message.hasOwnProperty("nonce"))
            if (!(message.nonce && typeof message.nonce.length === "number" || $util.isString(message.nonce)))
                return "nonce: buffer expected";
        if (message.storageId != null && message.hasOwnProperty("storageId"))
            if (!(message.storageId && typeof message.storageId.length === "number" || $util.isString(message.storageId)))
                return "storageId: buffer expected";
        if (message.ops != null && message.hasOwnProperty("ops")) {
            if (!Array.isArray(message.ops))
                return "ops: array expected";
            for (let i = 0; i < message.ops.length; ++i) {
                let error = $root.Op.verify(message.ops[i]);
                if (error)
                    return "ops." + error;
            }
        }
        return null;
    };

    /**
     * Creates a MacaroonId message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof MacaroonId
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {MacaroonId} MacaroonId
     */
    MacaroonId.fromObject = function fromObject(object) {
        if (object instanceof $root.MacaroonId)
            return object;
        let message = new $root.MacaroonId();
        if (object.nonce != null)
            if (typeof object.nonce === "string")
                $util.base64.decode(object.nonce, message.nonce = $util.newBuffer($util.base64.length(object.nonce)), 0);
            else if (object.nonce.length >= 0)
                message.nonce = object.nonce;
        if (object.storageId != null)
            if (typeof object.storageId === "string")
                $util.base64.decode(object.storageId, message.storageId = $util.newBuffer($util.base64.length(object.storageId)), 0);
            else if (object.storageId.length >= 0)
                message.storageId = object.storageId;
        if (object.ops) {
            if (!Array.isArray(object.ops))
                throw TypeError(".MacaroonId.ops: array expected");
            message.ops = [];
            for (let i = 0; i < object.ops.length; ++i) {
                if (typeof object.ops[i] !== "object")
                    throw TypeError(".MacaroonId.ops: object expected");
                message.ops[i] = $root.Op.fromObject(object.ops[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a MacaroonId message. Also converts values to other types if specified.
     * @function toObject
     * @memberof MacaroonId
     * @static
     * @param {MacaroonId} message MacaroonId
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    MacaroonId.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.ops = [];
        if (options.defaults) {
            if (options.bytes === String)
                object.nonce = "";
            else {
                object.nonce = [];
                if (options.bytes !== Array)
                    object.nonce = $util.newBuffer(object.nonce);
            }
            if (options.bytes === String)
                object.storageId = "";
            else {
                object.storageId = [];
                if (options.bytes !== Array)
                    object.storageId = $util.newBuffer(object.storageId);
            }
        }
        if (message.nonce != null && message.hasOwnProperty("nonce"))
            object.nonce = options.bytes === String ? $util.base64.encode(message.nonce, 0, message.nonce.length) : options.bytes === Array ? Array.prototype.slice.call(message.nonce) : message.nonce;
        if (message.storageId != null && message.hasOwnProperty("storageId"))
            object.storageId = options.bytes === String ? $util.base64.encode(message.storageId, 0, message.storageId.length) : options.bytes === Array ? Array.prototype.slice.call(message.storageId) : message.storageId;
        if (message.ops && message.ops.length) {
            object.ops = [];
            for (let j = 0; j < message.ops.length; ++j)
                object.ops[j] = $root.Op.toObject(message.ops[j], options);
        }
        return object;
    };

    /**
     * Converts this MacaroonId to JSON.
     * @function toJSON
     * @memberof MacaroonId
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    MacaroonId.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for MacaroonId
     * @function getTypeUrl
     * @memberof MacaroonId
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    MacaroonId.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/MacaroonId";
    };

    return MacaroonId;
})();

export const Op = $root.Op = (() => {

    /**
     * Properties of an Op.
     * @exports IOp
     * @interface IOp
     * @property {string|null} [entity] Op entity
     * @property {Array.<string>|null} [actions] Op actions
     */

    /**
     * Constructs a new Op.
     * @exports Op
     * @classdesc Represents an Op.
     * @implements IOp
     * @constructor
     * @param {IOp=} [properties] Properties to set
     */
    function Op(properties) {
        this.actions = [];
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Op entity.
     * @member {string} entity
     * @memberof Op
     * @instance
     */
    Op.prototype.entity = "";

    /**
     * Op actions.
     * @member {Array.<string>} actions
     * @memberof Op
     * @instance
     */
    Op.prototype.actions = $util.emptyArray;

    /**
     * Creates a new Op instance using the specified properties.
     * @function create
     * @memberof Op
     * @static
     * @param {IOp=} [properties] Properties to set
     * @returns {Op} Op instance
     */
    Op.create = function create(properties) {
        return new Op(properties);
    };

    /**
     * Encodes the specified Op message. Does not implicitly {@link Op.verify|verify} messages.
     * @function encode
     * @memberof Op
     * @static
     * @param {IOp} message Op message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Op.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.entity != null && Object.hasOwnProperty.call(message, "entity"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.entity);
        if (message.actions != null && message.actions.length)
            for (let i = 0; i < message.actions.length; ++i)
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.actions[i]);
        return writer;
    };

    /**
     * Encodes the specified Op message, length delimited. Does not implicitly {@link Op.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Op
     * @static
     * @param {IOp} message Op message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Op.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Op message from the specified reader or buffer.
     * @function decode
     * @memberof Op
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Op} Op
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Op.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Op();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.entity = reader.string();
                    break;
                }
            case 2: {
                    if (!(message.actions && message.actions.length))
                        message.actions = [];
                    message.actions.push(reader.string());
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Op message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Op
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Op} Op
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Op.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Op message.
     * @function verify
     * @memberof Op
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Op.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.entity != null && message.hasOwnProperty("entity"))
            if (!$util.isString(message.entity))
                return "entity: string expected";
        if (message.actions != null && message.hasOwnProperty("actions")) {
            if (!Array.isArray(message.actions))
                return "actions: array expected";
            for (let i = 0; i < message.actions.length; ++i)
                if (!$util.isString(message.actions[i]))
                    return "actions: string[] expected";
        }
        return null;
    };

    /**
     * Creates an Op message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Op
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Op} Op
     */
    Op.fromObject = function fromObject(object) {
        if (object instanceof $root.Op)
            return object;
        let message = new $root.Op();
        if (object.entity != null)
            message.entity = String(object.entity);
        if (object.actions) {
            if (!Array.isArray(object.actions))
                throw TypeError(".Op.actions: array expected");
            message.actions = [];
            for (let i = 0; i < object.actions.length; ++i)
                message.actions[i] = String(object.actions[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from an Op message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Op
     * @static
     * @param {Op} message Op
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Op.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.arrays || options.defaults)
            object.actions = [];
        if (options.defaults)
            object.entity = "";
        if (message.entity != null && message.hasOwnProperty("entity"))
            object.entity = message.entity;
        if (message.actions && message.actions.length) {
            object.actions = [];
            for (let j = 0; j < message.actions.length; ++j)
                object.actions[j] = message.actions[j];
        }
        return object;
    };

    /**
     * Converts this Op to JSON.
     * @function toJSON
     * @memberof Op
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Op.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Op
     * @function getTypeUrl
     * @memberof Op
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Op.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Op";
    };

    return Op;
})();

export { $root as default };
