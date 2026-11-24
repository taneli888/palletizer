// node_modules/@bufbuild/protobuf/dist/esm/is-message.js
function isMessage(arg, schema) {
  return arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string" ? schema === void 0 ? !0 : schema.typeName === arg.$typeName : !1;
}

// node_modules/@bufbuild/protobuf/dist/esm/descriptors.js
var ScalarType;
(function(ScalarType2) {
  ScalarType2[ScalarType2.DOUBLE = 1] = "DOUBLE", ScalarType2[ScalarType2.FLOAT = 2] = "FLOAT", ScalarType2[ScalarType2.INT64 = 3] = "INT64", ScalarType2[ScalarType2.UINT64 = 4] = "UINT64", ScalarType2[ScalarType2.INT32 = 5] = "INT32", ScalarType2[ScalarType2.FIXED64 = 6] = "FIXED64", ScalarType2[ScalarType2.FIXED32 = 7] = "FIXED32", ScalarType2[ScalarType2.BOOL = 8] = "BOOL", ScalarType2[ScalarType2.STRING = 9] = "STRING", ScalarType2[ScalarType2.BYTES = 12] = "BYTES", ScalarType2[ScalarType2.UINT32 = 13] = "UINT32", ScalarType2[ScalarType2.SFIXED32 = 15] = "SFIXED32", ScalarType2[ScalarType2.SFIXED64 = 16] = "SFIXED64", ScalarType2[ScalarType2.SINT32 = 17] = "SINT32", ScalarType2[ScalarType2.SINT64 = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));

// node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  let buf = this.buf, pos = this.pos, lo = 0, hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    let b = buf[pos++];
    if (lo |= (b & 127) << shift, (b & 128) == 0) {
      this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
      return;
    }
  }
  let middleByte = buf[pos++];
  if (lo |= (middleByte & 15) << 28, hi = (middleByte & 112) >> 4, (middleByte & 128) == 0) {
    this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    let b = buf[pos++];
    if (hi |= (b & 127) << shift, (b & 128) == 0) {
      this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  let minus = dec[0] === "-";
  minus && (dec = dec.slice(1));
  let base = 1e6, lowBits = 0, highBits = 0;
  function add1e6digit(begin, end) {
    let digit1e6 = Number(dec.slice(begin, end));
    highBits *= base, lowBits = lowBits * base + digit1e6, lowBits >= TWO_PWR_32_DBL && (highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0), lowBits = lowBits % TWO_PWR_32_DBL);
  }
  return add1e6digit(-24, -18), add1e6digit(-18, -12), add1e6digit(-12, -6), add1e6digit(-6), minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi), negative = bits.hi & 2147483648;
  negative && (bits = negate(bits.lo, bits.hi));
  let result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  if ({ lo, hi } = toUnsigned(lo, hi), hi <= 2097151)
    return String(TWO_PWR_32_DBL * hi + lo);
  let low = lo & 16777215, mid = (lo >>> 24 | hi << 8) & 16777215, high = hi >> 16 & 65535, digitA = low + mid * 6777216 + high * 6710656, digitB = mid + high * 8147497, digitC = high * 2, base = 1e7;
  return digitA >= base && (digitB += Math.floor(digitA / base), digitA %= base), digitB >= base && (digitC += Math.floor(digitB / base), digitB %= base), digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  return highBits = ~highBits, lowBits ? lowBits = ~lowBits + 1 : highBits += 1, newBits(lowBits, highBits);
}
var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
  let partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
};
function varint32write(value, bytes) {
  if (value >>> 0 < 128) {
    bytes.push(value);
    return;
  }
  if (value >= 0) {
    for (; value > 127; )
      bytes.push(value & 127 | 128), value = value >>> 7;
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++)
      bytes.push(value & 127 | 128), value = value >> 7;
    bytes.push(1);
  }
}
function varint32read() {
  let b = this.buf[this.pos++];
  if ((b & 128) === 0)
    return this.assertBounds(), b;
  let result = b & 127;
  if (b = this.buf[this.pos++], result |= (b & 127) << 7, (b & 128) === 0)
    return this.assertBounds(), result;
  if (b = this.buf[this.pos++], result |= (b & 127) << 14, (b & 128) === 0)
    return this.assertBounds(), result;
  if (b = this.buf[this.pos++], result |= (b & 127) << 21, (b & 128) === 0)
    return this.assertBounds(), result;
  b = this.buf[this.pos++], result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) !== 0)
    throw new Error("invalid varint");
  return this.assertBounds(), result >>> 0;
}

// node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  let dv = new DataView(new ArrayBuffer(8));
  if (typeof BigInt == "function" && typeof dv.getBigInt64 == "function" && typeof dv.getBigUint64 == "function" && typeof dv.setBigInt64 == "function" && typeof dv.setBigUint64 == "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1")) {
    let MIN = BigInt("-9223372036854775808"), MAX = BigInt("9223372036854775807"), UMIN = BigInt("0"), UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: !0,
      parse(value) {
        let bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN)
          throw new Error(`invalid int64: ${value}`);
        return bi;
      },
      uParse(value) {
        let bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN)
          throw new Error(`invalid uint64: ${value}`);
        return bi;
      },
      enc(value) {
        return dv.setBigInt64(0, this.parse(value), !0), {
          lo: dv.getInt32(0, !0),
          hi: dv.getInt32(4, !0)
        };
      },
      uEnc(value) {
        return dv.setBigInt64(0, this.uParse(value), !0), {
          lo: dv.getInt32(0, !0),
          hi: dv.getInt32(4, !0)
        };
      },
      dec(lo, hi) {
        return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigInt64(0, !0);
      },
      uDec(lo, hi) {
        return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigUint64(0, !0);
      }
    };
  }
  return {
    zero: "0",
    supported: !1,
    parse(value) {
      return typeof value != "string" && (value = value.toString()), assertInt64String(value), value;
    },
    uParse(value) {
      return typeof value != "string" && (value = value.toString()), assertUInt64String(value), value;
    },
    enc(value) {
      return typeof value != "string" && (value = value.toString()), assertInt64String(value), int64FromString(value);
    },
    uEnc(value) {
      return typeof value != "string" && (value = value.toString()), assertUInt64String(value), int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value))
    throw new Error("invalid int64: " + value);
}
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value))
    throw new Error("invalid uint64: " + value);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js
function scalarZeroValue(type, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return "";
    case ScalarType.BOOL:
      return !1;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return 0;
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.SFIXED64:
    case ScalarType.FIXED64:
    case ScalarType.SINT64:
      return longAsString ? "0" : protoInt64.zero;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    default:
      return 0;
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js
function unsafeIsSetExplicit(target, localName) {
  return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== void 0;
}
function setOwn(obj, key2, value) {
  key2 === "__proto__" ? Object.defineProperty(obj, "__proto__", {
    value,
    writable: !0,
    enumerable: !0,
    configurable: !0
  }) : obj[key2] = value;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js
function isObject(arg) {
  return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}

// node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js
function isWrapperDesc(messageDesc2) {
  let f = messageDesc2.fields[0];
  return isWrapperTypeName(messageDesc2.typeName) && f !== void 0 && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
}
var wrapperTypeNames = /* @__PURE__ */ new Set([
  "google.protobuf.DoubleValue",
  "google.protobuf.FloatValue",
  "google.protobuf.Int64Value",
  "google.protobuf.UInt64Value",
  "google.protobuf.Int32Value",
  "google.protobuf.UInt32Value",
  "google.protobuf.BoolValue",
  "google.protobuf.StringValue",
  "google.protobuf.BytesValue"
]);
function isWrapperTypeName(name) {
  return wrapperTypeNames.has(name);
}

// node_modules/@bufbuild/protobuf/dist/esm/create.js
var EDITION_PROTO3 = 999, EDITION_PROTO2 = 998, IMPLICIT = 2;
function create(schema, init) {
  return isMessage(init, schema) ? init : compiledCreate(schema)(init);
}
var compiledCreates = /* @__PURE__ */ new WeakMap();
function compiledCreate(desc) {
  let compiled = compiledCreates.get(desc);
  return compiled === void 0 && (compiled = compileCreate(desc), compiledCreates.set(desc, compiled)), compiled;
}
var INIT_SINGULAR = 0, INIT_LIST = 1, INIT_MAP = 2, INIT_ONEOF = 3;
function compileCreate(desc) {
  let typeName = desc.typeName, { properties, prototype } = compileInitMessage(desc);
  return (init) => {
    let message;
    prototype !== void 0 ? (message = Object.create(prototype), message.$typeName = typeName) : message = { $typeName: typeName };
    for (let i = 0; i < properties.length; i++) {
      let property = properties[i], name = property.name, initValue = init?.[name];
      switch (property.kind) {
        case INIT_SINGULAR:
          initValue != null ? message[name] = property.convert !== void 0 ? property.convert(initValue) : initValue : property.constant !== void 0 && (message[name] = property.constant);
          break;
        case INIT_LIST:
          message[name] = property.convert !== void 0 && Array.isArray(initValue) ? initValue.map(property.convert) : initValue ?? [];
          break;
        case INIT_MAP:
          if (property.convert === void 0 || !isObject(initValue))
            message[name] = initValue ?? {};
          else {
            let converted = {}, keys = Object.keys(initValue);
            for (let k = 0; k < keys.length; k++)
              setOwn(converted, keys[k], property.convert(initValue[keys[k]]));
            message[name] = converted;
          }
          break;
        case INIT_ONEOF: {
          let oneofValue = initValue;
          if (oneofValue?.case != null) {
            let convert = property.convert.get(oneofValue.case);
            if (convert !== void 0) {
              message[name] = {
                case: oneofValue.case,
                value: convert(oneofValue.value)
              };
              break;
            }
          }
          message[name] = { case: void 0 };
          break;
        }
      }
    }
    return message;
  };
}
function compileInitMessage(desc) {
  var _a, _b;
  let properties = [], prototype = {}, usePrototype = needsPrototypeChain(desc);
  for (let member of desc.members) {
    let name = member.localName;
    if (member.kind == "oneof") {
      properties.push({
        name,
        kind: INIT_ONEOF,
        constant: void 0,
        convert: compileConvertOneof(member)
      });
      continue;
    }
    switch (member.fieldKind) {
      case "message": {
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: void 0,
          convert: compileConvertMessage(member)
        });
        break;
      }
      case "list": {
        properties.push({
          name,
          kind: INIT_LIST,
          constant: void 0,
          convert: member.listKind == "message" ? (_a = compileConvertMessage(member)) !== null && _a !== void 0 ? _a : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      case "map": {
        properties.push({
          name,
          kind: INIT_MAP,
          constant: void 0,
          convert: member.mapKind == "message" ? (_b = compileConvertMessage(member)) !== null && _b !== void 0 ? _b : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      default: {
        let zeroValue = createZeroValue(member);
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: member.presence == IMPLICIT ? zeroValue : void 0,
          convert: member.fieldKind == "scalar" && member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        }), usePrototype && (prototype[name] = zeroValue);
        break;
      }
    }
  }
  return {
    properties,
    prototype: usePrototype ? prototype : void 0
  };
}
function compileConvertOneof(oneof) {
  let converters = /* @__PURE__ */ new Map();
  for (let field of oneof.fields) {
    let convert;
    field.fieldKind == "message" ? convert = compileConvertMessage(field) : field.fieldKind == "scalar" && field.scalar == ScalarType.BYTES && (convert = toU8Arr), converters.set(field.localName, convert ?? ((value) => value));
  }
  return converters;
}
function compileConvertMessage(field) {
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message))
    return field.message.fields[0].scalar == ScalarType.BYTES ? toU8Arr : void 0;
  if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value")
    return;
  let messageDesc2 = field.message, compiled;
  return (value) => !isObject(value) || isMessage(value, messageDesc2) ? value : (compiled ?? (compiled = compiledCreate(messageDesc2)), compiled(value));
}
function toU8Arr(value) {
  return Array.isArray(value) ? new Uint8Array(value) : value;
}
function needsPrototypeChain(desc) {
  switch (desc.file.edition) {
    case EDITION_PROTO3:
      return !1;
    case EDITION_PROTO2:
      return !0;
    default:
      return desc.fields.some((f) => f.presence != IMPLICIT && f.fieldKind != "message" && !f.oneof);
  }
}
function createZeroValue(field) {
  let defaultValue = field.getDefaultValue();
  return defaultValue !== void 0 ? field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue : field.fieldKind == "scalar" ? scalarZeroValue(field.scalar, field.longAsString) : field.enum.values[0].number;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js
var FieldError = class extends Error {
  constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
    super(message), this.name = name, this.field = () => fieldOrOneof;
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var te;
function configureTextEncoding(textEncoding) {
  var _a;
  te = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
function getTextEncoding() {
  if (!te) {
    let globals = globalThis;
    if (!globals.TextEncoder || !globals.TextDecoder)
      throw new Error("encoding API missing: install TextEncoder and TextDecoder on globalThis");
    let textEncoder = new globals.TextEncoder(), textDecoder = new globals.TextDecoder("utf-8", {
      ignoreBOM: !0
    }), textDecoderStrict, config = {
      encodeUtf8(text) {
        return textEncoder.encode(text);
      },
      decodeUtf8(bytes, strict) {
        return strict ? (textDecoderStrict || (textDecoderStrict = new globals.TextDecoder("utf-8", {
          fatal: !0,
          ignoreBOM: !0
        })), textDecoderStrict.decode(bytes)) : textDecoder.decode(bytes);
      },
      checkUtf8(text) {
        try {
          return encodeURIComponent(text), !0;
        } catch {
          return !1;
        }
      }
    };
    textEncoder.encodeInto && (config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder));
    let nativeStringIsWellFormed = String.prototype.isWellFormed;
    nativeStringIsWellFormed && (config.checkUtf8 = (text) => nativeStringIsWellFormed.call(text)), configureTextEncoding(config);
  }
  return te;
}
function emulateEncodeInto(encodeUtf8) {
  return (text, dest) => {
    let bytes = encodeUtf8(text);
    return dest.set(bytes), { written: bytes.byteLength };
  };
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2.Varint = 0] = "Varint", WireType2[WireType2.Bit64 = 1] = "Bit64", WireType2[WireType2.LengthDelimited = 2] = "LengthDelimited", WireType2[WireType2.StartGroup = 3] = "StartGroup", WireType2[WireType2.EndGroup = 4] = "EndGroup", WireType2[WireType2.Bit32 = 5] = "Bit32";
})(WireType || (WireType = {}));
var UINT32_MAX = 4294967295, INT32_MAX = 2147483647, INT32_MIN = -2147483648, BinaryWriter = class {
  constructor(encodeUtf8) {
    this.stackPos = [], this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into, this.buffer = EMPTY_BUFFER, this.viewCache = EMPTY_VIEW, this.pos = 0;
  }
  ensureCapacity(size) {
    let required = this.pos + size;
    if (required > this.buffer.length) {
      let newLen = this.buffer.length || INITIAL_SIZE;
      for (; newLen < required; )
        newLen *= 2;
      let newBuf = new Uint8Array(newLen);
      this.pos > 0 && newBuf.set(this.buffer), this.buffer = newBuf;
    }
  }
  /**
   * The DataView over `buffer`, rebuilt only if the buffer has grown since it
   * was last used.
   */
  view() {
    let bytes = this.buffer, view = this.viewCache;
    if (view.byteLength === bytes.byteLength)
      return view;
    let newView = new DataView(bytes.buffer);
    return this.viewCache = newView, newView;
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    let result = this.buffer.slice(0, this.pos);
    return this.pos = 0, this.stackPos = [], result;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    return this.stackPos.push(this.pos), this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE), this.buffer[this.pos++] = 0, this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let forkPos = this.stackPos.pop();
    if (forkPos === void 0)
      throw new Error("invalid state, fork stack empty");
    let len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE, lenPrefixSize = varint32Size(len);
    return lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE && (this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE), this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos)), this.pos = forkPos, this.uint32(len), this.pos += len, this;
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    return this.ensureCapacity(chunk.length), this.buffer.set(chunk, this.pos), this.pos += chunk.length, this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    if (assertUInt32(value), this.ensureCapacity(5), value < 128)
      return this.buffer[this.pos++] = value, this;
    for (; value > 127; )
      this.buffer[this.pos++] = value & 127 | 128, value >>>= 7;
    return this.buffer[this.pos++] = value, this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    if (assertInt32(value), value >= 0)
      return this.uint32(value);
    this.ensureCapacity(10);
    for (let i = 0; i < 9; i++)
      this.buffer[this.pos++] = value & 127 | 128, value >>= 7;
    return this.buffer[this.pos++] = 1, this;
  }
  /**
   * Write a `bool` value, a varint.
   */
  bool(value) {
    return this.ensureCapacity(1), this.buffer[this.pos++] = value ? 1 : 0, this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    return this.uint32(value.byteLength), this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    typeof value != "string" && (value = String(value));
    let len = value.length;
    if (len <= ASCII_MAX_LENGTH) {
      this.ensureCapacity(len + 1);
      let ascii = this.buffer, pos = this.pos;
      ascii[pos++] = len;
      let i = 0;
      for (; i < len; i++) {
        let code = value.charCodeAt(i);
        if (code > 127)
          break;
        ascii[pos++] = code;
      }
      if (i == len)
        return this.pos = pos, this;
    }
    this.ensureCapacity(len * 3 + 5);
    let lenPrefixSizeGuess = varint32Size(len), buf = this.buffer, start = this.pos, { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess)), lenPrefixSize = varint32Size(written);
    return lenPrefixSize != lenPrefixSizeGuess && buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written), this.uint32(written), this.pos += written, this;
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    return assertFloat32(value), this.ensureCapacity(4), this.view().setFloat32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    return this.ensureCapacity(8), this.view().setFloat64(this.pos, value, !0), this.pos += 8, this;
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    return assertUInt32(value), this.ensureCapacity(4), this.view().setUint32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    return assertInt32(value), this.ensureCapacity(4), this.view().setInt32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    return assertInt32(value), this.uint32((value << 1 ^ value >> 31) >>> 0);
  }
  /**
   * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    let tc = protoInt64.enc(value);
    this.ensureCapacity(8);
    let view = this.view();
    return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    let tc = protoInt64.uEnc(value);
    this.ensureCapacity(8);
    let view = this.view();
    return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    let tc = protoInt64.enc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    let tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    return this.writeVarint64(lo, hi);
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    let tc = protoInt64.uEnc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a 64-bit varint directly into the buffer. Accepts the value as
   * split low/high 32-bit words.
   *
   * Ported from varint64write() to avoid the intermediate number[] buffer.
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
   */
  writeVarint64(lo, hi) {
    this.ensureCapacity(10);
    let buf = this.buffer, pos = this.pos;
    for (let i = 0; i < 28; i = i + 7) {
      let shift = lo >>> i, hasNext = !(!(shift >>> 7) && hi == 0);
      if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
        return this.pos = pos, this;
    }
    let splitBits = lo >>> 28 & 15 | (hi & 7) << 4, hasMoreBits = hi >> 3 != 0;
    if (buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255, !hasMoreBits)
      return this.pos = pos, this;
    for (let i = 3; i < 31; i = i + 7) {
      let shift = hi >>> i, hasNext = !!(shift >>> 7);
      if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
        return this.pos = pos, this;
    }
    return buf[pos++] = hi >>> 31 & 1, this.pos = pos, this;
  }
}, INITIAL_SIZE = 128, DEFAULT_LEN_PREFIX_SIZE = 1, EMPTY_BUFFER = new Uint8Array(0), EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer), ASCII_MAX_LENGTH = 32;
function varint32Size(value) {
  return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5;
}
var BinaryReader = class {
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8, this.varint64Lo = 0, this.varint64Hi = 0, this.varint64 = varint64read, this.uint32 = varint32read, this.buf = buf, this.len = buf.length, this.pos = 0, this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type. Tags are uint32 varints; values
   * that do not fit in uint32 are rejected.
   */
  tag() {
    let start = this.pos, tag = this.uint32(), bytesRead = this.pos - start;
    if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15)
      throw new Error("illegal tag: varint overflows uint32");
    let fieldNo = tag >>> 3, wireType = tag & 7;
    if (fieldNo <= 0 || wireType > 5)
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag. Recursion into nested groups
   * is guarded by the `recursionLimit` argument: When the limit is reached,
   * this method throws.
   */
  skip(wireType, fieldNo, recursionLimit = 100) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        for (; this.buf[this.pos++] & 128; )
          ;
        break;
      // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        if (recursionLimit <= 0)
          throw new Error("maximum recursion depth reached");
        for (; ; ) {
          let [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo)
              throw new Error("invalid end group tag");
            break;
          }
          this.skip(wt, fn, recursionLimit - 1);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    return this.assertBounds(), this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return this.varint64(), protoInt64.dec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return this.varint64(), protoInt64.uDec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    this.varint64();
    let lo = this.varint64Lo, hi = this.varint64Hi, s = -(lo & 1);
    return lo = (lo >>> 1 | (hi & 1) << 31) ^ s, hi = hi >>> 1 ^ s, protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let b = this.buf[this.pos];
    return b < 128 ? (this.pos++, b !== 0) : (this.varint64(), this.varint64Lo !== 0 || this.varint64Hi !== 0);
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, !0);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    return this.pos += len, this.assertBounds(), this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text. If
   * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
   */
  string(strict) {
    let len = this.uint32(), start = this.pos;
    this.pos += len, this.assertBounds();
    let buf = this.buf;
    if (len <= ASCII_MAX_LENGTH) {
      let codes = new Array(len);
      for (let i = 0; i < len; i++) {
        let byte = buf[start + i];
        if (byte > 127)
          return this.decodeUtf8(buf.subarray(start, this.pos), strict);
        codes[i] = byte;
      }
      return String.fromCharCode.apply(String, codes);
    }
    return this.decodeUtf8(buf.subarray(start, this.pos), strict);
  }
};
function assertInt32(arg) {
  if (typeof arg == "string")
    arg = Number(arg);
  else if (typeof arg != "number")
    throw new Error("invalid int32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg == "string")
    arg = Number(arg);
  else if (typeof arg != "number")
    throw new Error("invalid uint32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg == "string") {
    let o = arg;
    if (arg = Number(arg), Number.isNaN(arg) && o !== "NaN")
      throw new Error("invalid float32: " + o);
  } else if (typeof arg != "number")
    throw new Error("invalid float32: " + typeof arg);
  if (!Number.isFinite(Math.fround(arg)) && Number.isFinite(arg))
    throw new Error("invalid float32: " + arg);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/message.js
var NULL_VALUE = 0;
function localMessageMapper(field) {
  if (usesJsonRepresentation(field))
    return {
      toMessage: (local) => wktStructToReflect(local),
      toLocal: (message) => wktStructToLocal(message)
    };
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    let wrapperDesc = field.message, valueLocalName = wrapperDesc.fields[0].localName;
    return {
      toMessage: (local) => {
        let message = create(wrapperDesc);
        return local !== void 0 && (message[valueLocalName] = local), message;
      },
      toLocal: (message) => message[valueLocalName]
    };
  }
  let childDesc = field.message;
  return {
    toMessage: (local) => local === void 0 ? create(childDesc) : local,
    toLocal: (message) => message
  };
}
function usesJsonRepresentation(field) {
  return field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value";
}
function wktStructToReflect(json) {
  let struct = {
    $typeName: "google.protobuf.Struct",
    fields: {}
  };
  if (isObject(json))
    for (let k of Object.keys(json))
      setOwn(struct.fields, k, wktValueToReflect(json[k]));
  return struct;
}
function wktStructToLocal(val) {
  let json = {};
  for (let k of Object.keys(val.fields))
    setOwn(json, k, wktValueToLocal(val.fields[k]));
  return json;
}
function wktValueToLocal(val) {
  switch (val.kind.case) {
    case "structValue":
      return wktStructToLocal(val.kind.value);
    case "listValue":
      return val.kind.value.values.map(wktValueToLocal);
    case "nullValue":
    case void 0:
      return null;
    default:
      return val.kind.value;
  }
}
function wktValueToReflect(json) {
  let value = {
    $typeName: "google.protobuf.Value",
    kind: { case: void 0 }
  };
  switch (typeof json) {
    case "number":
      value.kind = { case: "numberValue", value: json };
      break;
    case "string":
      value.kind = { case: "stringValue", value: json };
      break;
    case "boolean":
      value.kind = { case: "boolValue", value: json };
      break;
    case "object":
      if (json === null)
        value.kind = { case: "nullValue", value: NULL_VALUE };
      else if (Array.isArray(json)) {
        let listValue = {
          $typeName: "google.protobuf.ListValue",
          values: []
        };
        if (Array.isArray(json))
          for (let e of json)
            listValue.values.push(wktValueToReflect(e));
        value.kind = {
          case: "listValue",
          value: listValue
        };
      } else
        value.kind = {
          case: "structValue",
          value: wktStructToReflect(json)
        };
      break;
  }
  return value;
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js
var nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
function base64Decode(base64Str) {
  let len = base64Str.length, size = len - (len + 3 >> 2);
  (len & 3) == 0 && base64Str[len - 1] == "=" && (size -= base64Str[len - 2] == "=" ? 2 : 1);
  let bytes = new Uint8Array(size), written = -1;
  if (nativeSetFromBase64)
    try {
      let result = nativeSetFromBase64.call(bytes, base64Str);
      result.read == len && (written = result.written);
    } catch {
    }
  return written < 0 && (written = setFromBase64(bytes, base64Str)), written == size ? bytes : bytes.subarray(0, written);
}
function setFromBase64(bytes, base64Str) {
  let table = getDecodeTable(), bytePos = 0, groupPos = 0, b, p = 0;
  for (let i = 0; i < base64Str.length; i++) {
    if (b = table[base64Str.charCodeAt(i)], b === void 0)
      switch (base64Str[i]) {
        // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
        case "=":
          groupPos = 0;
        // reset state when padding found
        case `
`:
        case "\r":
        case "	":
        case " ":
          continue;
        // skip white-space, and padding
        default:
          throw Error("invalid base64 string");
      }
    switch (groupPos) {
      case 0:
        p = b, groupPos = 1;
        break;
      case 1:
        bytes[bytePos++] = p << 2 | (b & 48) >> 4, p = b, groupPos = 2;
        break;
      case 2:
        bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2, p = b, groupPos = 3;
        break;
      case 3:
        bytes[bytePos++] = (p & 3) << 6 | b, groupPos = 0;
        break;
    }
  }
  if (groupPos == 1)
    throw Error("invalid base64 string");
  return bytePos;
}
var nativeToBase64 = Uint8Array.prototype.toBase64;
var encodeTableStd, encodeTableUrl, decodeTable;
function getEncodeTable(encoding) {
  return encodeTableStd || (encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""), encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_")), encoding == "url" ? (
    // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
    encodeTableUrl
  ) : encodeTableStd;
}
function getDecodeTable() {
  if (!decodeTable) {
    decodeTable = [];
    let encodeTable = getEncodeTable("std");
    for (let i = 0; i < encodeTable.length; i++)
      decodeTable[encodeTable[i].charCodeAt(0)] = i;
    decodeTable[45] = encodeTable.indexOf("+"), decodeTable[95] = encodeTable.indexOf("/");
  }
  return decodeTable;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js
function protoCamelCase(snakeCase) {
  let capNext = !1, b = [];
  for (let i = 0; i < snakeCase.length; i++) {
    let c = snakeCase.charAt(i);
    switch (c) {
      case "_":
        capNext = !0;
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        b.push(c), capNext = !1;
        break;
      default:
        capNext && (capNext = !1, c = c.toUpperCase()), b.push(c);
        break;
    }
  }
  return b.join("");
}
var reservedObjectProperties = /* @__PURE__ */ new Set([
  // names reserved by JavaScript
  "constructor",
  "toString",
  "toJSON",
  "valueOf"
]);
function safeObjectProperty(name) {
  return reservedObjectProperties.has(name) ? name + "$" : name;
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js
function restoreJsonNames(message) {
  for (let f of message.field)
    unsafeIsSetExplicit(f, "jsonName") || (f.jsonName = protoCamelCase(f.name));
  message.nestedType.forEach(restoreJsonNames);
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js
function parseTextFormatEnumValue(descEnum, value) {
  let enumValue = descEnum.values.find((v) => v.name === value);
  if (!enumValue)
    throw new Error(`cannot parse ${descEnum} default value: ${value}`);
  return enumValue.number;
}
function parseTextFormatScalarValue(type, value) {
  switch (type) {
    case ScalarType.STRING:
      return value;
    case ScalarType.BYTES: {
      let u = unescapeBytesDefaultValue(value);
      if (u === !1)
        throw new Error(`cannot parse ${ScalarType[type]} default value: ${value}`);
      return u;
    }
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return protoInt64.parse(value);
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return protoInt64.uParse(value);
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      switch (value) {
        case "inf":
          return Number.POSITIVE_INFINITY;
        case "-inf":
          return Number.NEGATIVE_INFINITY;
        case "nan":
          return Number.NaN;
        default:
          return parseFloat(value);
      }
    case ScalarType.BOOL:
      return value === "true";
    case ScalarType.INT32:
    case ScalarType.UINT32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
      return parseInt(value, 10);
  }
}
function unescapeBytesDefaultValue(str) {
  let b = [], input = {
    tail: str,
    c: "",
    next() {
      return this.tail.length == 0 ? !1 : (this.c = this.tail[0], this.tail = this.tail.substring(1), !0);
    },
    take(n) {
      if (this.tail.length >= n) {
        let r = this.tail.substring(0, n);
        return this.tail = this.tail.substring(n), r;
      }
      return !1;
    }
  };
  for (; input.next(); )
    switch (input.c) {
      case "\\":
        if (input.next())
          switch (input.c) {
            case "\\":
              b.push(input.c.charCodeAt(0));
              break;
            case "b":
              b.push(8);
              break;
            case "f":
              b.push(12);
              break;
            case "n":
              b.push(10);
              break;
            case "r":
              b.push(13);
              break;
            case "t":
              b.push(9);
              break;
            case "v":
              b.push(11);
              break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7": {
              let s = input.c, t = input.take(2);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 8);
              if (Number.isNaN(n))
                return !1;
              b.push(n);
              break;
            }
            case "x": {
              let s = input.c, t = input.take(2);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 16);
              if (Number.isNaN(n))
                return !1;
              b.push(n);
              break;
            }
            case "u": {
              let s = input.c, t = input.take(4);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 16);
              if (Number.isNaN(n))
                return !1;
              let chunk = new Uint8Array(4);
              new DataView(chunk.buffer).setInt32(0, n, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
              break;
            }
            case "U": {
              let s = input.c, t = input.take(8);
              if (t === !1)
                return !1;
              let tc = protoInt64.uEnc(s + t), chunk = new Uint8Array(8), view = new DataView(chunk.buffer);
              view.setInt32(0, tc.lo, !0), view.setInt32(4, tc.hi, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
              break;
            }
          }
        break;
      default:
        b.push(input.c.charCodeAt(0));
    }
  return new Uint8Array(b);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js
function* nestedTypes(desc) {
  switch (desc.kind) {
    case "file":
      for (let message of desc.messages)
        yield message, yield* nestedTypes(message);
      yield* desc.enums, yield* desc.services, yield* desc.extensions;
      break;
    case "message":
      for (let message of desc.nestedMessages)
        yield message, yield* nestedTypes(message);
      yield* desc.nestedEnums, yield* desc.nestedExtensions;
      break;
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/registry.js
function createEmbeddedFileRegistry(fileDescriptorProto, resolve) {
  return buildFileRegistry([fileDescriptorProto, resolve]);
}
function buildFileRegistry(args, check) {
  let registry = createBaseRegistry();
  if (!args.length)
    return registry;
  if ("$typeName" in args[0] && args[0].$typeName == "google.protobuf.FileDescriptorSet") {
    for (let file of args[0].file)
      check?.(file), addFile(file, registry);
    return registry;
  }
  if ("$typeName" in args[0]) {
    let recurseDeps = function(file) {
      let deps = [];
      for (let protoFileName of file.dependency) {
        if (registry.getFile(protoFileName) != null || seen.has(protoFileName))
          continue;
        let dep = resolve(protoFileName);
        if (!dep)
          throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
        "kind" in dep ? registry.addFile(dep, !1, !0) : (seen.add(dep.name), deps.push(dep));
      }
      return deps.concat(...deps.map(recurseDeps));
    }, input = args[0], resolve = args[1], seen = /* @__PURE__ */ new Set();
    for (let file of [input, ...recurseDeps(input)].reverse())
      check?.(file), addFile(file, registry);
  } else
    for (let fileReg of args)
      for (let file of fileReg.files)
        registry.addFile(file);
  return registry;
}
function createBaseRegistry() {
  let types = /* @__PURE__ */ new Map(), extendees = /* @__PURE__ */ new Map(), files = /* @__PURE__ */ new Map();
  return {
    kind: "registry",
    types,
    extendees,
    [Symbol.iterator]() {
      return types.values();
    },
    get files() {
      return files.values();
    },
    addFile(file, skipTypes, withDeps) {
      if (files.set(file.proto.name, file), !skipTypes)
        for (let type of nestedTypes(file))
          this.add(type);
      if (withDeps)
        for (let f of file.dependencies)
          this.addFile(f, skipTypes, withDeps);
    },
    add(desc) {
      if (desc.kind == "extension") {
        let numberToExt = extendees.get(desc.extendee.typeName);
        numberToExt || extendees.set(
          desc.extendee.typeName,
          // biome-ignore lint/suspicious/noAssignInExpressions: no
          numberToExt = /* @__PURE__ */ new Map()
        ), numberToExt.set(desc.number, desc);
      }
      types.set(desc.typeName, desc);
    },
    get(typeName) {
      return types.get(typeName);
    },
    getFile(fileName) {
      return files.get(fileName);
    },
    getMessage(typeName) {
      let t = types.get(typeName);
      return t?.kind == "message" ? t : void 0;
    },
    getEnum(typeName) {
      let t = types.get(typeName);
      return t?.kind == "enum" ? t : void 0;
    },
    getExtension(typeName) {
      let t = types.get(typeName);
      return t?.kind == "extension" ? t : void 0;
    },
    getExtensionFor(extendee, no) {
      var _a;
      return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
    },
    getService(typeName) {
      let t = types.get(typeName);
      return t?.kind == "service" ? t : void 0;
    }
  };
}
var EDITION_PROTO22 = 998, EDITION_PROTO32 = 999, EDITION_UNSTABLE = 9999, TYPE_STRING = 9, TYPE_GROUP = 10, TYPE_MESSAGE = 11, TYPE_BYTES = 12, TYPE_ENUM = 14, LABEL_REPEATED = 3, LABEL_REQUIRED = 2, JS_STRING = 1, IDEMPOTENCY_UNKNOWN = 0, EXPLICIT = 1, IMPLICIT2 = 2, LEGACY_REQUIRED = 3, PACKED = 1, DELIMITED = 2, OPEN = 1, VERIFY = 2;
var maximumEdition = 1002, featureDefaults = {
  // EDITION_PROTO2
  998: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 2,
    // CLOSED,
    repeatedFieldEncoding: 2,
    // EXPANDED,
    utf8Validation: 3,
    // NONE,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 2,
    // LEGACY_BEST_EFFORT,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_PROTO3
  999: {
    fieldPresence: 2,
    // IMPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2023
  1e3: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2024
  1001: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 1,
    // STYLE2024,
    defaultSymbolVisibility: 2,
    // EXPORT_TOP_LEVEL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2026
  1002: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 3,
    // STYLE2026,
    defaultSymbolVisibility: 4,
    // STRICT,
    enforceProtoLimits: 2
    // PROTO_LIMITS2026,
  }
};
function addFile(proto, reg) {
  var _a, _b;
  let file = {
    kind: "file",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    edition: getFileEdition(proto),
    name: proto.name.replace(/\.proto$/, ""),
    dependencies: findFileDependencies(proto, reg),
    enums: [],
    messages: [],
    extensions: [],
    services: [],
    toString() {
      return `file ${proto.name}`;
    }
  }, mapEntriesStore = /* @__PURE__ */ new Map(), mapEntries = {
    get(typeName) {
      return mapEntriesStore.get(typeName);
    },
    add(desc) {
      var _a2;
      assert(((_a2 = desc.proto.options) === null || _a2 === void 0 ? void 0 : _a2.mapEntry) === !0), mapEntriesStore.set(desc.typeName, desc);
    }
  };
  for (let enumProto of proto.enumType)
    addEnum(enumProto, file, void 0, reg);
  for (let messageProto of proto.messageType)
    addMessage(messageProto, file, void 0, reg, mapEntries);
  for (let serviceProto of proto.service)
    addService(serviceProto, file, reg);
  addExtensions(file, reg);
  for (let mapEntry of mapEntriesStore.values())
    addFields(mapEntry, reg, mapEntries);
  for (let message of file.messages)
    addFields(message, reg, mapEntries), addExtensions(message, reg);
  reg.addFile(file, !0);
}
function addExtensions(desc, reg) {
  switch (desc.kind) {
    case "file":
      for (let proto of desc.proto.extension) {
        let ext = newField(proto, desc, reg);
        desc.extensions.push(ext), reg.add(ext);
      }
      break;
    case "message":
      for (let proto of desc.proto.extension) {
        let ext = newField(proto, desc, reg);
        desc.nestedExtensions.push(ext), reg.add(ext);
      }
      for (let message of desc.nestedMessages)
        addExtensions(message, reg);
      break;
  }
}
function addFields(message, reg, mapEntries) {
  let allOneofs = message.proto.oneofDecl.map((proto) => newOneof(proto, message)), oneofsSeen = /* @__PURE__ */ new Set();
  for (let proto of message.proto.field) {
    let oneof = findOneof(proto, allOneofs), field = newField(proto, message, reg, oneof, mapEntries);
    message.fields.push(field), message.field[field.localName] = field, oneof === void 0 ? message.members.push(field) : (oneof.fields.push(field), oneofsSeen.has(oneof) || (oneofsSeen.add(oneof), message.members.push(oneof)));
  }
  for (let oneof of allOneofs.filter((o) => oneofsSeen.has(o)))
    message.oneofs.push(oneof);
  for (let child of message.nestedMessages)
    addFields(child, reg, mapEntries);
}
function addEnum(proto, file, parent, reg) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j;
  let sharedPrefix = findEnumSharedPrefix(proto.name, proto.value), desc = {
    kind: "enum",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    parent,
    open: !0,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    value: {},
    values: [],
    sharedPrefix,
    toString() {
      return `enum ${this.typeName}`;
    }
  };
  desc.open = isEnumOpen(desc), reg.add(desc);
  for (let p of proto.value) {
    let name = p.name, value = {
      kind: "enum_value",
      proto: p,
      deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : !1,
      parent: desc,
      name,
      localName: safeObjectProperty(sharedPrefix == null ? name : name.substring(sharedPrefix.length)),
      number: p.number,
      jsonName: (_e = findEnumValueJsonName(p)) !== null && _e !== void 0 ? _e : name,
      toString() {
        return `enum value ${desc.typeName}.${name}`;
      }
    };
    desc.values.push(value), (_f = (_h = desc.value)[_j = p.number]) !== null && _f !== void 0 || (_h[_j] = value);
  }
  ((_g = parent?.nestedEnums) !== null && _g !== void 0 ? _g : file.enums).push(desc);
}
function addMessage(proto, file, parent, reg, mapEntries) {
  var _a, _b, _c, _d;
  let desc = {
    kind: "message",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    parent,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    fields: [],
    field: {},
    oneofs: [],
    members: [],
    nestedEnums: [],
    nestedMessages: [],
    nestedExtensions: [],
    toString() {
      return `message ${this.typeName}`;
    }
  };
  ((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === !0 ? mapEntries.add(desc) : (((_d = parent?.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc), reg.add(desc));
  for (let enumProto of proto.enumType)
    addEnum(enumProto, file, desc, reg);
  for (let messageProto of proto.nestedType)
    addMessage(messageProto, file, desc, reg, mapEntries);
}
function addService(proto, file, reg) {
  var _a, _b;
  let desc = {
    kind: "service",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    name: proto.name,
    typeName: makeTypeName(proto, void 0, file),
    methods: [],
    method: {},
    toString() {
      return `service ${this.typeName}`;
    }
  };
  file.services.push(desc), reg.add(desc);
  for (let methodProto of proto.method) {
    let method = newMethod(methodProto, desc, reg);
    desc.methods.push(method), desc.method[method.localName] = method;
  }
}
function newMethod(proto, parent, reg) {
  var _a, _b, _c, _d;
  let methodKind;
  proto.clientStreaming && proto.serverStreaming ? methodKind = "bidi_streaming" : proto.clientStreaming ? methodKind = "client_streaming" : proto.serverStreaming ? methodKind = "server_streaming" : methodKind = "unary";
  let input = reg.getMessage(trimLeadingDot(proto.inputType)), output = reg.getMessage(trimLeadingDot(proto.outputType));
  assert(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`), assert(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
  let name = proto.name;
  return {
    kind: "rpc",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    parent,
    name,
    localName: safeObjectProperty(name.length ? safeObjectProperty(name[0].toLowerCase() + name.substring(1)) : name),
    methodKind,
    input,
    output,
    idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
    toString() {
      return `rpc ${parent.typeName}.${name}`;
    }
  };
}
function newOneof(proto, parent) {
  return {
    kind: "oneof",
    proto,
    deprecated: !1,
    parent,
    fields: [],
    name: proto.name,
    localName: safeObjectProperty(protoCamelCase(proto.name)),
    toString() {
      return `oneof ${parent.typeName}.${this.name}`;
    }
  };
}
function newField(proto, parentOrFile, reg, oneof, mapEntries) {
  var _a, _b, _c;
  let isExtension = mapEntries === void 0, field = {
    kind: "field",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    name: proto.name,
    number: proto.number,
    scalar: void 0,
    message: void 0,
    enum: void 0,
    presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
    utf8Validation: isUtf8Validated(proto, parentOrFile),
    listKind: void 0,
    mapKind: void 0,
    mapKey: void 0,
    delimitedEncoding: void 0,
    packed: void 0,
    longAsString: !1,
    getDefaultValue: void 0
  }, toStr;
  if (isExtension) {
    let file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file, parent = parentOrFile.kind == "file" ? void 0 : parentOrFile, typeName = makeTypeName(proto, parent, file);
    field.kind = "extension", field.file = file, field.parent = parent, field.oneof = void 0, field.typeName = typeName, field.jsonName = `[${typeName}]`, toStr = () => `extension ${typeName}`;
    let extendee = reg.getMessage(trimLeadingDot(proto.extendee));
    assert(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`), field.extendee = extendee;
  } else {
    let parent = parentOrFile;
    assert(parent.kind == "message"), field.parent = parent, field.oneof = oneof, field.localName = oneof ? protoCamelCase(proto.name) : safeObjectProperty(protoCamelCase(proto.name)), field.jsonName = proto.jsonName, toStr = () => `field ${parent.typeName}.${proto.name}`;
  }
  Object.defineProperty(field, "toString", {
    value: toStr,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
  let label = proto.label, type = proto.type, jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
  if (label === LABEL_REPEATED) {
    let mapEntry = type == TYPE_MESSAGE ? mapEntries?.get(trimLeadingDot(proto.typeName)) : void 0;
    if (mapEntry) {
      field.fieldKind = "map";
      let { key: key2, value } = findMapEntryFields(mapEntry);
      return field.mapKey = key2.scalar, field.mapKind = value.fieldKind, field.message = value.message, field.delimitedEncoding = !1, field.enum = value.enum, field.scalar = value.scalar, field;
    }
    switch (field.fieldKind = "list", type) {
      case TYPE_MESSAGE:
      case TYPE_GROUP:
        field.listKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert(field.message), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
        break;
      case TYPE_ENUM:
        field.listKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), assert(field.enum);
        break;
      default:
        field.listKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING;
        break;
    }
    return field.packed = isPackedField(proto, parentOrFile), field;
  }
  switch (type) {
    case TYPE_MESSAGE:
    case TYPE_GROUP:
      field.fieldKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile), field.getDefaultValue = () => {
      };
      break;
    case TYPE_ENUM: {
      let enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
      assert(enumeration !== void 0, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.fieldKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), field.getDefaultValue = () => unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatEnumValue(enumeration, proto.defaultValue) : void 0;
      break;
    }
    default: {
      field.fieldKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING, field.getDefaultValue = () => unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatScalarValue(type, proto.defaultValue) : void 0;
      break;
    }
  }
  return field;
}
function getFileEdition(proto) {
  switch (proto.syntax) {
    case "":
    case "proto2":
      return EDITION_PROTO22;
    case "proto3":
      return EDITION_PROTO32;
    case "editions":
      if (proto.edition === EDITION_UNSTABLE)
        return maximumEdition;
      if (proto.edition in featureDefaults)
        return proto.edition;
      throw new Error(`${proto.name}: unsupported edition`);
    default:
      throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
  }
}
function findFileDependencies(proto, reg) {
  return proto.dependency.map((wantName) => {
    let dep = reg.getFile(wantName);
    if (!dep)
      throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
    return dep;
  });
}
function findEnumSharedPrefix(enumName, values) {
  let prefix = camelToSnakeCase(enumName) + "_";
  for (let value of values) {
    if (!value.name.toLowerCase().startsWith(prefix))
      return;
    let shortName = value.name.substring(prefix.length);
    if (shortName.length == 0 || /^\d/.test(shortName))
      return;
  }
  return prefix;
}
function findEnumValueJsonName(proto) {
  var _a, _b;
  let jsonName;
  for (let uf of (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.$unknown) !== null && _b !== void 0 ? _b : []) {
    if (uf.no !== 998 || uf.wireType !== WireType.LengthDelimited)
      continue;
    let reader = new BinaryReader(new BinaryReader(uf.data).bytes());
    for (; reader.pos < reader.len; ) {
      let [no, wireType] = reader.tag();
      no === 1 && wireType === WireType.LengthDelimited ? jsonName = reader.string() : reader.skip(wireType, no);
    }
  }
  return jsonName;
}
function camelToSnakeCase(camel) {
  return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c) => "_" + c)).toLowerCase();
}
function makeTypeName(proto, parent, file) {
  let typeName;
  return parent ? typeName = `${parent.typeName}.${proto.name}` : file.proto.package.length > 0 ? typeName = `${file.proto.package}.${proto.name}` : typeName = `${proto.name}`, typeName;
}
function trimLeadingDot(typeName) {
  return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}
function findOneof(proto, allOneofs) {
  if (!unsafeIsSetExplicit(proto, "oneofIndex") || proto.proto3Optional)
    return;
  let oneof = allOneofs[proto.oneofIndex];
  return assert(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`), oneof;
}
function getFieldPresence(proto, oneof, isExtension, parent) {
  if (proto.label == LABEL_REQUIRED)
    return LEGACY_REQUIRED;
  if (proto.label == LABEL_REPEATED)
    return IMPLICIT2;
  if (oneof || proto.proto3Optional || isExtension)
    return EXPLICIT;
  let resolved = resolveFeature("fieldPresence", { proto, parent });
  return resolved == IMPLICIT2 && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP) ? EXPLICIT : resolved;
}
function isPackedField(proto, parent) {
  if (proto.label != LABEL_REPEATED)
    return !1;
  switch (proto.type) {
    case TYPE_STRING:
    case TYPE_BYTES:
    case TYPE_GROUP:
    case TYPE_MESSAGE:
      return !1;
  }
  let o = proto.options;
  return o && unsafeIsSetExplicit(o, "packed") ? o.packed : PACKED == resolveFeature("repeatedFieldEncoding", {
    proto,
    parent
  });
}
function findMapEntryFields(mapEntry) {
  let key2 = mapEntry.fields.find((f) => f.number === 1), value = mapEntry.fields.find((f) => f.number === 2);
  return assert(key2 && key2.fieldKind == "scalar" && key2.scalar != ScalarType.BYTES && key2.scalar != ScalarType.FLOAT && key2.scalar != ScalarType.DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map"), { key: key2, value };
}
function isEnumOpen(desc) {
  var _a;
  return OPEN == resolveFeature("enumType", {
    proto: desc.proto,
    parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
  });
}
function isDelimitedEncoding(proto, parent) {
  return proto.type == TYPE_GROUP ? !0 : DELIMITED == resolveFeature("messageEncoding", {
    proto,
    parent
  });
}
function isUtf8Validated(proto, parent) {
  return VERIFY == resolveFeature("utf8Validation", {
    proto,
    parent
  });
}
function resolveFeature(name, ref) {
  var _a, _b;
  let featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
  if (featureSet) {
    let val = featureSet[name];
    if (val != 0)
      return val;
  }
  if ("kind" in ref) {
    if (ref.kind == "message")
      return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
    let editionDefaults = featureDefaults[ref.edition];
    if (!editionDefaults)
      throw new Error(`feature default for edition ${ref.edition} not found`);
    return editionDefaults[name];
  }
  return resolveFeature(name, ref.parent);
}
function assert(condition, msg) {
  if (!condition)
    throw new Error(msg);
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js
function boot(boot2) {
  let root = bootFileDescriptorProto(boot2);
  return root.messageType.forEach(restoreJsonNames), createEmbeddedFileRegistry(root, () => {
  }).getFile(root.name);
}
function bootFileDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    syntax: "",
    edition: 0
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
}
function bootDescriptorProto(init) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  return Object.assign(/* @__PURE__ */ Object.create({
    visibility: 0
  }), {
    $typeName: "google.protobuf.DescriptorProto",
    name: init.name,
    field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
    extension: [],
    nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
    enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
    extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e))) !== null && _h !== void 0 ? _h : [],
    oneofDecl: [],
    reservedRange: [],
    reservedName: []
  });
}
function bootFieldDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    label: 1,
    typeName: "",
    extendee: "",
    defaultValue: "",
    oneofIndex: 0,
    jsonName: "",
    proto3Optional: !1
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : void 0 }));
}
function bootFieldOptions(init) {
  var _a, _b, _c;
  return Object.assign(/* @__PURE__ */ Object.create({
    ctype: 0,
    packed: !1,
    jstype: 0,
    lazy: !1,
    unverifiedLazy: !1,
    deprecated: !1,
    weak: !1,
    debugRedact: !1,
    retention: 0
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
}
function bootEnumDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    visibility: 0
  }), {
    $typeName: "google.protobuf.EnumDescriptorProto",
    name: init.name,
    reservedName: [],
    reservedRange: [],
    value: init.value.map((e) => Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))
  });
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js
function messageDesc(file, path, ...paths) {
  return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]);
}

// node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/descriptor_pb.js
var file_google_protobuf_descriptor = /* @__PURE__ */ boot({ name: "google/protobuf/descriptor.proto", package: "google.protobuf", messageType: [{ name: "FileDescriptorSet", field: [{ name: "file", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FileDescriptorProto" }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "FileDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "package", number: 2, type: 9, label: 1 }, { name: "dependency", number: 3, type: 9, label: 3 }, { name: "public_dependency", number: 10, type: 5, label: 3 }, { name: "weak_dependency", number: 11, type: 5, label: 3 }, { name: "option_dependency", number: 15, type: 9, label: 3 }, { name: "message_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 5, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "service", number: 6, type: 11, label: 3, typeName: ".google.protobuf.ServiceDescriptorProto" }, { name: "extension", number: 7, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FileOptions" }, { name: "source_code_info", number: 9, type: 11, label: 1, typeName: ".google.protobuf.SourceCodeInfo" }, { name: "syntax", number: 12, type: 9, label: 1 }, { name: "edition", number: 14, type: 14, label: 1, typeName: ".google.protobuf.Edition" }] }, { name: "DescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "field", number: 2, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "extension", number: 6, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "nested_type", number: 3, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "extension_range", number: 5, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ExtensionRange" }, { name: "oneof_decl", number: 8, type: 11, label: 3, typeName: ".google.protobuf.OneofDescriptorProto" }, { name: "options", number: 7, type: 11, label: 1, typeName: ".google.protobuf.MessageOptions" }, { name: "reserved_range", number: 9, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ReservedRange" }, { name: "reserved_name", number: 10, type: 9, label: 3 }, { name: "visibility", number: 11, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "ExtensionRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions" }] }, { name: "ReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "ExtensionRangeOptions", field: [{ name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }, { name: "declaration", number: 2, type: 11, label: 3, typeName: ".google.protobuf.ExtensionRangeOptions.Declaration", options: { retention: 2 } }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "verification", number: 3, type: 14, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions.VerificationState", defaultValue: "UNVERIFIED", options: { retention: 2 } }], nestedType: [{ name: "Declaration", field: [{ name: "number", number: 1, type: 5, label: 1 }, { name: "full_name", number: 2, type: 9, label: 1 }, { name: "type", number: 3, type: 9, label: 1 }, { name: "reserved", number: 5, type: 8, label: 1 }, { name: "repeated", number: 6, type: 8, label: 1 }] }], enumType: [{ name: "VerificationState", value: [{ name: "DECLARATION", number: 0 }, { name: "UNVERIFIED", number: 1 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "FieldDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 3, type: 5, label: 1 }, { name: "label", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Label" }, { name: "type", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Type" }, { name: "type_name", number: 6, type: 9, label: 1 }, { name: "extendee", number: 2, type: 9, label: 1 }, { name: "default_value", number: 7, type: 9, label: 1 }, { name: "oneof_index", number: 9, type: 5, label: 1 }, { name: "json_name", number: 10, type: 9, label: 1 }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions" }, { name: "proto3_optional", number: 17, type: 8, label: 1 }], enumType: [{ name: "Type", value: [{ name: "TYPE_DOUBLE", number: 1 }, { name: "TYPE_FLOAT", number: 2 }, { name: "TYPE_INT64", number: 3 }, { name: "TYPE_UINT64", number: 4 }, { name: "TYPE_INT32", number: 5 }, { name: "TYPE_FIXED64", number: 6 }, { name: "TYPE_FIXED32", number: 7 }, { name: "TYPE_BOOL", number: 8 }, { name: "TYPE_STRING", number: 9 }, { name: "TYPE_GROUP", number: 10 }, { name: "TYPE_MESSAGE", number: 11 }, { name: "TYPE_BYTES", number: 12 }, { name: "TYPE_UINT32", number: 13 }, { name: "TYPE_ENUM", number: 14 }, { name: "TYPE_SFIXED32", number: 15 }, { name: "TYPE_SFIXED64", number: 16 }, { name: "TYPE_SINT32", number: 17 }, { name: "TYPE_SINT64", number: 18 }] }, { name: "Label", value: [{ name: "LABEL_OPTIONAL", number: 1 }, { name: "LABEL_REPEATED", number: 3 }, { name: "LABEL_REQUIRED", number: 2 }] }] }, { name: "OneofDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "options", number: 2, type: 11, label: 1, typeName: ".google.protobuf.OneofOptions" }] }, { name: "EnumDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "value", number: 2, type: 11, label: 3, typeName: ".google.protobuf.EnumValueDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumOptions" }, { name: "reserved_range", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto.EnumReservedRange" }, { name: "reserved_name", number: 5, type: 9, label: 3 }, { name: "visibility", number: 6, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "EnumReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "EnumValueDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumValueOptions" }] }, { name: "ServiceDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "method", number: 2, type: 11, label: 3, typeName: ".google.protobuf.MethodDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ServiceOptions" }] }, { name: "MethodDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "input_type", number: 2, type: 9, label: 1 }, { name: "output_type", number: 3, type: 9, label: 1 }, { name: "options", number: 4, type: 11, label: 1, typeName: ".google.protobuf.MethodOptions" }, { name: "client_streaming", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "server_streaming", number: 6, type: 8, label: 1, defaultValue: "false" }] }, { name: "FileOptions", field: [{ name: "java_package", number: 1, type: 9, label: 1 }, { name: "java_outer_classname", number: 8, type: 9, label: 1 }, { name: "java_multiple_files", number: 10, type: 8, label: 1, defaultValue: "false", options: {} }, { name: "java_generate_equals_and_hash", number: 20, type: 8, label: 1, options: { deprecated: !0 } }, { name: "java_string_check_utf8", number: 27, type: 8, label: 1, defaultValue: "false" }, { name: "optimize_for", number: 9, type: 14, label: 1, typeName: ".google.protobuf.FileOptions.OptimizeMode", defaultValue: "SPEED" }, { name: "go_package", number: 11, type: 9, label: 1 }, { name: "cc_generic_services", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "java_generic_services", number: 17, type: 8, label: 1, defaultValue: "false" }, { name: "py_generic_services", number: 18, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 23, type: 8, label: 1, defaultValue: "false" }, { name: "cc_enable_arenas", number: 31, type: 8, label: 1, defaultValue: "true", options: {} }, { name: "objc_class_prefix", number: 36, type: 9, label: 1 }, { name: "csharp_namespace", number: 37, type: 9, label: 1 }, { name: "swift_prefix", number: 39, type: 9, label: 1 }, { name: "php_class_prefix", number: 40, type: 9, label: 1 }, { name: "php_namespace", number: 41, type: 9, label: 1 }, { name: "php_metadata_namespace", number: 44, type: 9, label: 1 }, { name: "ruby_package", number: 45, type: 9, label: 1 }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "OptimizeMode", value: [{ name: "SPEED", number: 1 }, { name: "CODE_SIZE", number: 2 }, { name: "LITE_RUNTIME", number: 3 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "MessageOptions", field: [{ name: "message_set_wire_format", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "no_standard_descriptor_accessor", number: 2, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "map_entry", number: 7, type: 8, label: 1 }, { name: "deprecated_legacy_json_field_conflicts", number: 11, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 12, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "FieldOptions", field: [{ name: "ctype", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.CType", defaultValue: "STRING" }, { name: "packed", number: 2, type: 8, label: 1 }, { name: "jstype", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.JSType", defaultValue: "JS_NORMAL" }, { name: "lazy", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "unverified_lazy", number: 15, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "weak", number: 10, type: 8, label: 1, defaultValue: "false", options: { deprecated: !0 } }, { name: "debug_redact", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "retention", number: 17, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.OptionRetention" }, { name: "targets", number: 19, type: 14, label: 3, typeName: ".google.protobuf.FieldOptions.OptionTargetType" }, { name: "edition_defaults", number: 20, type: 11, label: 3, typeName: ".google.protobuf.FieldOptions.EditionDefault" }, { name: "features", number: 21, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "feature_support", number: 22, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], nestedType: [{ name: "EditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "value", number: 2, type: 9, label: 1 }] }, { name: "FeatureSupport", field: [{ name: "edition_introduced", number: 1, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "edition_deprecated", number: 2, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "deprecation_warning", number: 3, type: 9, label: 1 }, { name: "edition_removed", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "removal_error", number: 5, type: 9, label: 1 }] }], enumType: [{ name: "CType", value: [{ name: "STRING", number: 0 }, { name: "CORD", number: 1 }, { name: "STRING_PIECE", number: 2 }] }, { name: "JSType", value: [{ name: "JS_NORMAL", number: 0 }, { name: "JS_STRING", number: 1 }, { name: "JS_NUMBER", number: 2 }] }, { name: "OptionRetention", value: [{ name: "RETENTION_UNKNOWN", number: 0 }, { name: "RETENTION_RUNTIME", number: 1 }, { name: "RETENTION_SOURCE", number: 2 }] }, { name: "OptionTargetType", value: [{ name: "TARGET_TYPE_UNKNOWN", number: 0 }, { name: "TARGET_TYPE_FILE", number: 1 }, { name: "TARGET_TYPE_EXTENSION_RANGE", number: 2 }, { name: "TARGET_TYPE_MESSAGE", number: 3 }, { name: "TARGET_TYPE_FIELD", number: 4 }, { name: "TARGET_TYPE_ONEOF", number: 5 }, { name: "TARGET_TYPE_ENUM", number: 6 }, { name: "TARGET_TYPE_ENUM_ENTRY", number: 7 }, { name: "TARGET_TYPE_SERVICE", number: 8 }, { name: "TARGET_TYPE_METHOD", number: 9 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "OneofOptions", field: [{ name: "features", number: 1, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "EnumOptions", field: [{ name: "allow_alias", number: 2, type: 8, label: 1 }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated_legacy_json_field_conflicts", number: 6, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 7, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "EnumValueOptions", field: [{ name: "deprecated", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "features", number: 2, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "debug_redact", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "feature_support", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "ServiceOptions", field: [{ name: "features", number: 34, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "MethodOptions", field: [{ name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "idempotency_level", number: 34, type: 14, label: 1, typeName: ".google.protobuf.MethodOptions.IdempotencyLevel", defaultValue: "IDEMPOTENCY_UNKNOWN" }, { name: "features", number: 35, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "IdempotencyLevel", value: [{ name: "IDEMPOTENCY_UNKNOWN", number: 0 }, { name: "NO_SIDE_EFFECTS", number: 1 }, { name: "IDEMPOTENT", number: 2 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "UninterpretedOption", field: [{ name: "name", number: 2, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption.NamePart" }, { name: "identifier_value", number: 3, type: 9, label: 1 }, { name: "positive_int_value", number: 4, type: 4, label: 1 }, { name: "negative_int_value", number: 5, type: 3, label: 1 }, { name: "double_value", number: 6, type: 1, label: 1 }, { name: "string_value", number: 7, type: 12, label: 1 }, { name: "aggregate_value", number: 8, type: 9, label: 1 }], nestedType: [{ name: "NamePart", field: [{ name: "name_part", number: 1, type: 9, label: 2 }, { name: "is_extension", number: 2, type: 8, label: 2 }] }] }, { name: "FeatureSet", field: [{ name: "field_presence", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.FieldPresence", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPLICIT", edition: 900 }, { value: "IMPLICIT", edition: 999 }, { value: "EXPLICIT", edition: 1e3 }] } }, { name: "enum_type", number: 2, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnumType", options: { retention: 1, targets: [6, 1], editionDefaults: [{ value: "CLOSED", edition: 900 }, { value: "OPEN", edition: 999 }] } }, { name: "repeated_field_encoding", number: 3, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.RepeatedFieldEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPANDED", edition: 900 }, { value: "PACKED", edition: 999 }] } }, { name: "utf8_validation", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.Utf8Validation", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "NONE", edition: 900 }, { value: "VERIFY", edition: 999 }] } }, { name: "message_encoding", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.MessageEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "LENGTH_PREFIXED", edition: 900 }] } }, { name: "json_format", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.JsonFormat", options: { retention: 1, targets: [3, 6, 1], editionDefaults: [{ value: "LEGACY_BEST_EFFORT", edition: 900 }, { value: "ALLOW", edition: 999 }] } }, { name: "enforce_naming_style", number: 7, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnforceNamingStyle", options: { retention: 2, targets: [1, 2, 3, 4, 5, 6, 7, 8, 9], editionDefaults: [{ value: "STYLE_LEGACY", edition: 900 }, { value: "STYLE2024", edition: 1001 }, { value: "STYLE2026", edition: 1002 }] } }, { name: "default_symbol_visibility", number: 8, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility", options: { retention: 2, targets: [1], editionDefaults: [{ value: "EXPORT_ALL", edition: 900 }, { value: "EXPORT_TOP_LEVEL", edition: 1001 }, { value: "STRICT", edition: 1002 }] } }, { name: "enforce_proto_limits", number: 9, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.ProtoLimitsFeature.EnforceProtoLimits", options: { retention: 2, targets: [6, 3, 4, 5], editionDefaults: [{ value: "LEGACY_NO_EXPLICIT_LIMITS", edition: 900 }, { value: "PROTO_LIMITS2026", edition: 1002 }] } }], nestedType: [{ name: "VisibilityFeature", enumType: [{ name: "DefaultSymbolVisibility", value: [{ name: "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", number: 0 }, { name: "EXPORT_ALL", number: 1 }, { name: "EXPORT_TOP_LEVEL", number: 2 }, { name: "LOCAL_ALL", number: 3 }, { name: "STRICT", number: 4 }] }] }, { name: "ProtoLimitsFeature", enumType: [{ name: "EnforceProtoLimits", value: [{ name: "PROTO_LIMITS_UNKNOWN", number: 0 }, { name: "LEGACY_NO_EXPLICIT_LIMITS", number: 1 }, { name: "PROTO_LIMITS2026", number: 2 }] }] }], enumType: [{ name: "FieldPresence", value: [{ name: "FIELD_PRESENCE_UNKNOWN", number: 0 }, { name: "EXPLICIT", number: 1 }, { name: "IMPLICIT", number: 2 }, { name: "LEGACY_REQUIRED", number: 3 }] }, { name: "EnumType", value: [{ name: "ENUM_TYPE_UNKNOWN", number: 0 }, { name: "OPEN", number: 1 }, { name: "CLOSED", number: 2 }] }, { name: "RepeatedFieldEncoding", value: [{ name: "REPEATED_FIELD_ENCODING_UNKNOWN", number: 0 }, { name: "PACKED", number: 1 }, { name: "EXPANDED", number: 2 }] }, { name: "Utf8Validation", value: [{ name: "UTF8_VALIDATION_UNKNOWN", number: 0 }, { name: "VERIFY", number: 2 }, { name: "NONE", number: 3 }] }, { name: "MessageEncoding", value: [{ name: "MESSAGE_ENCODING_UNKNOWN", number: 0 }, { name: "LENGTH_PREFIXED", number: 1 }, { name: "DELIMITED", number: 2 }] }, { name: "JsonFormat", value: [{ name: "JSON_FORMAT_UNKNOWN", number: 0 }, { name: "ALLOW", number: 1 }, { name: "LEGACY_BEST_EFFORT", number: 2 }] }, { name: "EnforceNamingStyle", value: [{ name: "ENFORCE_NAMING_STYLE_UNKNOWN", number: 0 }, { name: "STYLE2024", number: 1 }, { name: "STYLE_LEGACY", number: 2 }, { name: "STYLE2026", number: 3 }] }], extensionRange: [{ start: 1e3, end: 9995 }, { start: 9995, end: 1e4 }, { start: 1e4, end: 10001 }] }, { name: "FeatureSetDefaults", field: [{ name: "defaults", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault" }, { name: "minimum_edition", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "maximum_edition", number: 5, type: 14, label: 1, typeName: ".google.protobuf.Edition" }], nestedType: [{ name: "FeatureSetEditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "overridable_features", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "fixed_features", number: 5, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }] }] }, { name: "SourceCodeInfo", field: [{ name: "location", number: 1, type: 11, label: 3, typeName: ".google.protobuf.SourceCodeInfo.Location" }], nestedType: [{ name: "Location", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "span", number: 2, type: 5, label: 3, options: { packed: !0 } }, { name: "leading_comments", number: 3, type: 9, label: 1 }, { name: "trailing_comments", number: 4, type: 9, label: 1 }, { name: "leading_detached_comments", number: 6, type: 9, label: 3 }] }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "GeneratedCodeInfo", field: [{ name: "annotation", number: 1, type: 11, label: 3, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation" }], nestedType: [{ name: "Annotation", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "source_file", number: 2, type: 9, label: 1 }, { name: "begin", number: 3, type: 5, label: 1 }, { name: "end", number: 4, type: 5, label: 1 }, { name: "semantic", number: 5, type: 14, label: 1, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic" }], enumType: [{ name: "Semantic", value: [{ name: "NONE", number: 0 }, { name: "SET", number: 1 }, { name: "ALIAS", number: 2 }] }] }] }], enumType: [{ name: "Edition", value: [{ name: "EDITION_UNKNOWN", number: 0 }, { name: "EDITION_LEGACY", number: 900 }, { name: "EDITION_PROTO2", number: 998 }, { name: "EDITION_PROTO3", number: 999 }, { name: "EDITION_2023", number: 1e3 }, { name: "EDITION_2024", number: 1001 }, { name: "EDITION_2026", number: 1002 }, { name: "EDITION_UNSTABLE", number: 9999 }, { name: "EDITION_1_TEST_ONLY", number: 1 }, { name: "EDITION_2_TEST_ONLY", number: 2 }, { name: "EDITION_99997_TEST_ONLY", number: 99997 }, { name: "EDITION_99998_TEST_ONLY", number: 99998 }, { name: "EDITION_99999_TEST_ONLY", number: 99999 }, { name: "EDITION_MAX", number: 2147483647 }] }, { name: "SymbolVisibility", value: [{ name: "VISIBILITY_UNSET", number: 0 }, { name: "VISIBILITY_LOCAL", number: 1 }, { name: "VISIBILITY_EXPORT", number: 2 }] }] });
var FileDescriptorProtoSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_descriptor, 1);
var ExtensionRangeOptions_VerificationState;
(function(ExtensionRangeOptions_VerificationState2) {
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.DECLARATION = 0] = "DECLARATION", ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.UNVERIFIED = 1] = "UNVERIFIED";
})(ExtensionRangeOptions_VerificationState || (ExtensionRangeOptions_VerificationState = {}));
var FieldDescriptorProto_Type;
(function(FieldDescriptorProto_Type2) {
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.DOUBLE = 1] = "DOUBLE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FLOAT = 2] = "FLOAT", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT64 = 3] = "INT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT64 = 4] = "UINT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT32 = 5] = "INT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED64 = 6] = "FIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED32 = 7] = "FIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BOOL = 8] = "BOOL", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.STRING = 9] = "STRING", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.GROUP = 10] = "GROUP", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.MESSAGE = 11] = "MESSAGE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BYTES = 12] = "BYTES", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT32 = 13] = "UINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.ENUM = 14] = "ENUM", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED32 = 15] = "SFIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED64 = 16] = "SFIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT32 = 17] = "SINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT64 = 18] = "SINT64";
})(FieldDescriptorProto_Type || (FieldDescriptorProto_Type = {}));
var FieldDescriptorProto_Label;
(function(FieldDescriptorProto_Label2) {
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.OPTIONAL = 1] = "OPTIONAL", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REPEATED = 3] = "REPEATED", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REQUIRED = 2] = "REQUIRED";
})(FieldDescriptorProto_Label || (FieldDescriptorProto_Label = {}));
var FileOptions_OptimizeMode;
(function(FileOptions_OptimizeMode2) {
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.SPEED = 1] = "SPEED", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.CODE_SIZE = 2] = "CODE_SIZE", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.LITE_RUNTIME = 3] = "LITE_RUNTIME";
})(FileOptions_OptimizeMode || (FileOptions_OptimizeMode = {}));
var FieldOptions_CType;
(function(FieldOptions_CType2) {
  FieldOptions_CType2[FieldOptions_CType2.STRING = 0] = "STRING", FieldOptions_CType2[FieldOptions_CType2.CORD = 1] = "CORD", FieldOptions_CType2[FieldOptions_CType2.STRING_PIECE = 2] = "STRING_PIECE";
})(FieldOptions_CType || (FieldOptions_CType = {}));
var FieldOptions_JSType;
(function(FieldOptions_JSType2) {
  FieldOptions_JSType2[FieldOptions_JSType2.JS_NORMAL = 0] = "JS_NORMAL", FieldOptions_JSType2[FieldOptions_JSType2.JS_STRING = 1] = "JS_STRING", FieldOptions_JSType2[FieldOptions_JSType2.JS_NUMBER = 2] = "JS_NUMBER";
})(FieldOptions_JSType || (FieldOptions_JSType = {}));
var FieldOptions_OptionRetention;
(function(FieldOptions_OptionRetention2) {
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_UNKNOWN = 0] = "RETENTION_UNKNOWN", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_RUNTIME = 1] = "RETENTION_RUNTIME", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_SOURCE = 2] = "RETENTION_SOURCE";
})(FieldOptions_OptionRetention || (FieldOptions_OptionRetention = {}));
var FieldOptions_OptionTargetType;
(function(FieldOptions_OptionTargetType2) {
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_UNKNOWN = 0] = "TARGET_TYPE_UNKNOWN", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FILE = 1] = "TARGET_TYPE_FILE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_EXTENSION_RANGE = 2] = "TARGET_TYPE_EXTENSION_RANGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_MESSAGE = 3] = "TARGET_TYPE_MESSAGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FIELD = 4] = "TARGET_TYPE_FIELD", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ONEOF = 5] = "TARGET_TYPE_ONEOF", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM = 6] = "TARGET_TYPE_ENUM", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM_ENTRY = 7] = "TARGET_TYPE_ENUM_ENTRY", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_SERVICE = 8] = "TARGET_TYPE_SERVICE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_METHOD = 9] = "TARGET_TYPE_METHOD";
})(FieldOptions_OptionTargetType || (FieldOptions_OptionTargetType = {}));
var MethodOptions_IdempotencyLevel;
(function(MethodOptions_IdempotencyLevel2) {
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENCY_UNKNOWN = 0] = "IDEMPOTENCY_UNKNOWN", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.NO_SIDE_EFFECTS = 1] = "NO_SIDE_EFFECTS", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENT = 2] = "IDEMPOTENT";
})(MethodOptions_IdempotencyLevel || (MethodOptions_IdempotencyLevel = {}));
var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
(function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility2) {
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_ALL = 1] = "EXPORT_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_TOP_LEVEL = 2] = "EXPORT_TOP_LEVEL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.LOCAL_ALL = 3] = "LOCAL_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.STRICT = 4] = "STRICT";
})(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
var FeatureSet_ProtoLimitsFeature_EnforceProtoLimits;
(function(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2) {
  FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.PROTO_LIMITS_UNKNOWN = 0] = "PROTO_LIMITS_UNKNOWN", FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.LEGACY_NO_EXPLICIT_LIMITS = 1] = "LEGACY_NO_EXPLICIT_LIMITS", FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.PROTO_LIMITS2026 = 2] = "PROTO_LIMITS2026";
})(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits || (FeatureSet_ProtoLimitsFeature_EnforceProtoLimits = {}));
var FeatureSet_FieldPresence;
(function(FeatureSet_FieldPresence2) {
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.FIELD_PRESENCE_UNKNOWN = 0] = "FIELD_PRESENCE_UNKNOWN", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.EXPLICIT = 1] = "EXPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.IMPLICIT = 2] = "IMPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.LEGACY_REQUIRED = 3] = "LEGACY_REQUIRED";
})(FeatureSet_FieldPresence || (FeatureSet_FieldPresence = {}));
var FeatureSet_EnumType;
(function(FeatureSet_EnumType2) {
  FeatureSet_EnumType2[FeatureSet_EnumType2.ENUM_TYPE_UNKNOWN = 0] = "ENUM_TYPE_UNKNOWN", FeatureSet_EnumType2[FeatureSet_EnumType2.OPEN = 1] = "OPEN", FeatureSet_EnumType2[FeatureSet_EnumType2.CLOSED = 2] = "CLOSED";
})(FeatureSet_EnumType || (FeatureSet_EnumType = {}));
var FeatureSet_RepeatedFieldEncoding;
(function(FeatureSet_RepeatedFieldEncoding2) {
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.REPEATED_FIELD_ENCODING_UNKNOWN = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.PACKED = 1] = "PACKED", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.EXPANDED = 2] = "EXPANDED";
})(FeatureSet_RepeatedFieldEncoding || (FeatureSet_RepeatedFieldEncoding = {}));
var FeatureSet_Utf8Validation;
(function(FeatureSet_Utf8Validation2) {
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.UTF8_VALIDATION_UNKNOWN = 0] = "UTF8_VALIDATION_UNKNOWN", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.VERIFY = 2] = "VERIFY", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.NONE = 3] = "NONE";
})(FeatureSet_Utf8Validation || (FeatureSet_Utf8Validation = {}));
var FeatureSet_MessageEncoding;
(function(FeatureSet_MessageEncoding2) {
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.MESSAGE_ENCODING_UNKNOWN = 0] = "MESSAGE_ENCODING_UNKNOWN", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.LENGTH_PREFIXED = 1] = "LENGTH_PREFIXED", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.DELIMITED = 2] = "DELIMITED";
})(FeatureSet_MessageEncoding || (FeatureSet_MessageEncoding = {}));
var FeatureSet_JsonFormat;
(function(FeatureSet_JsonFormat2) {
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.JSON_FORMAT_UNKNOWN = 0] = "JSON_FORMAT_UNKNOWN", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.ALLOW = 1] = "ALLOW", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.LEGACY_BEST_EFFORT = 2] = "LEGACY_BEST_EFFORT";
})(FeatureSet_JsonFormat || (FeatureSet_JsonFormat = {}));
var FeatureSet_EnforceNamingStyle;
(function(FeatureSet_EnforceNamingStyle2) {
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.ENFORCE_NAMING_STYLE_UNKNOWN = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE2024 = 1] = "STYLE2024", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE_LEGACY = 2] = "STYLE_LEGACY", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE2026 = 3] = "STYLE2026";
})(FeatureSet_EnforceNamingStyle || (FeatureSet_EnforceNamingStyle = {}));
var GeneratedCodeInfo_Annotation_Semantic;
(function(GeneratedCodeInfo_Annotation_Semantic2) {
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.NONE = 0] = "NONE", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.SET = 1] = "SET", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.ALIAS = 2] = "ALIAS";
})(GeneratedCodeInfo_Annotation_Semantic || (GeneratedCodeInfo_Annotation_Semantic = {}));
var Edition;
(function(Edition2) {
  Edition2[Edition2.EDITION_UNKNOWN = 0] = "EDITION_UNKNOWN", Edition2[Edition2.EDITION_LEGACY = 900] = "EDITION_LEGACY", Edition2[Edition2.EDITION_PROTO2 = 998] = "EDITION_PROTO2", Edition2[Edition2.EDITION_PROTO3 = 999] = "EDITION_PROTO3", Edition2[Edition2.EDITION_2023 = 1e3] = "EDITION_2023", Edition2[Edition2.EDITION_2024 = 1001] = "EDITION_2024", Edition2[Edition2.EDITION_2026 = 1002] = "EDITION_2026", Edition2[Edition2.EDITION_UNSTABLE = 9999] = "EDITION_UNSTABLE", Edition2[Edition2.EDITION_1_TEST_ONLY = 1] = "EDITION_1_TEST_ONLY", Edition2[Edition2.EDITION_2_TEST_ONLY = 2] = "EDITION_2_TEST_ONLY", Edition2[Edition2.EDITION_99997_TEST_ONLY = 99997] = "EDITION_99997_TEST_ONLY", Edition2[Edition2.EDITION_99998_TEST_ONLY = 99998] = "EDITION_99998_TEST_ONLY", Edition2[Edition2.EDITION_99999_TEST_ONLY = 99999] = "EDITION_99999_TEST_ONLY", Edition2[Edition2.EDITION_MAX = 2147483647] = "EDITION_MAX";
})(Edition || (Edition = {}));
var SymbolVisibility;
(function(SymbolVisibility2) {
  SymbolVisibility2[SymbolVisibility2.VISIBILITY_UNSET = 0] = "VISIBILITY_UNSET", SymbolVisibility2[SymbolVisibility2.VISIBILITY_LOCAL = 1] = "VISIBILITY_LOCAL", SymbolVisibility2[SymbolVisibility2.VISIBILITY_EXPORT = 2] = "VISIBILITY_EXPORT";
})(SymbolVisibility || (SymbolVisibility = {}));

// node_modules/@bufbuild/protobuf/dist/esm/from-binary.js
function makeReadContext(options) {
  return Object.assign(Object.assign({ readUnknownFields: !0, recursionLimit: 100 }, options), { depth: 0 });
}
function fromBinary(schema, bytes, options) {
  let message = create(schema);
  return compiledReader(schema).read(message, new BinaryReader(bytes), makeReadContext(options), bytes.byteLength), message;
}
var compiledReaders = /* @__PURE__ */ new WeakMap();
function compiledReader(desc) {
  let compiled = compiledReaders.get(desc);
  return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
}
function compileMessage(desc) {
  let descString = String(desc), fieldReaders = /* @__PURE__ */ new Map(), compiled = {
    read: compileMessageReader(descString, fieldReaders),
    readGroup: compileGroupReader(descString, fieldReaders)
  };
  compiledReaders.set(desc, compiled);
  for (let field of desc.fields)
    fieldReaders.set(field.number, compileFieldReader(field));
  return compiled;
}
function compileMessageReader(descString, fieldReaders) {
  return (message, reader, ctx, length) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit)
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    let end = reader.pos + length, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    for (; reader.pos < end; ) {
      let [fieldNo, wireType] = reader.tag(), fieldReader = fieldReaders.get(fieldNo);
      if (fieldReader === void 0) {
        let data = reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
        ctx.readUnknownFields && unknownFields.push({ no: fieldNo, wireType, data });
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
  };
}
function compileGroupReader(descString, fieldReaders) {
  return (message, reader, ctx, fieldNo) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit)
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    let recordFieldNo, wireType, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    for (; reader.pos < reader.len && ([recordFieldNo, wireType] = reader.tag(), wireType != WireType.EndGroup); ) {
      let fieldReader = fieldReaders.get(recordFieldNo);
      if (fieldReader === void 0) {
        let data = reader.skip(wireType, recordFieldNo, ctx.recursionLimit - ctx.depth);
        ctx.readUnknownFields && unknownFields.push({ no: recordFieldNo, wireType, data });
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (wireType != WireType.EndGroup || recordFieldNo !== fieldNo)
      throw new Error("invalid end group tag");
    unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
  };
}
function compileFieldReader(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarFieldReader(field);
    case "enum":
      return compileEnumFieldReader(field);
    case "message":
      return compileMessageFieldReader(field);
    case "list":
      return compileListFieldReader(field);
    case "map":
      return compileMapFieldReader(field);
  }
}
function compileScalarFieldReader(field) {
  let readScalar = compileScalarReader(field.scalar, field.utf8Validation, field.longAsString), localName = field.localName;
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (message, reader) => {
      message[oneofLocalName] = {
        case: localName,
        value: readScalar(reader)
      };
    };
  }
  return (message, reader) => {
    message[localName] = readScalar(reader);
  };
}
function compileEnumFieldReader(field) {
  var _a;
  let localName = field.localName, oneofLocalName = (_a = field.oneof) === null || _a === void 0 ? void 0 : _a.localName;
  if (field.enum.open)
    return oneofLocalName !== void 0 ? (message, reader) => {
      message[oneofLocalName] = { case: localName, value: reader.int32() };
    } : (message, reader) => {
      message[localName] = reader.int32();
    };
  let values = field.enum.values, fieldNo = field.number;
  return (message, reader, ctx, wireType) => {
    var _a2;
    let val = reader.int32();
    if (values.some((v) => v.number === val))
      oneofLocalName !== void 0 ? message[oneofLocalName] = { case: localName, value: val } : message[localName] = val;
    else if (ctx.readUnknownFields) {
      let bytes = [];
      varint32write(val, bytes);
      let unknownFields = (_a2 = message.$unknown) !== null && _a2 !== void 0 ? _a2 : [];
      unknownFields.push({
        no: fieldNo,
        wireType,
        data: new Uint8Array(bytes)
      }), message.$unknown = unknownFields;
    }
  };
}
function compileMessageFieldReader(field) {
  let localName = field.localName, { toMessage, toLocal } = localMessageMapper(field), readChild = compileChildReader(field);
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (message, reader, ctx) => {
      let oneof = message[oneofLocalName], child = toMessage(oneof.case === localName ? oneof.value : void 0);
      readChild(child, reader, ctx), message[oneofLocalName] = { case: localName, value: toLocal(child) };
    };
  }
  return (message, reader, ctx) => {
    let child = toMessage(message[localName]);
    readChild(child, reader, ctx), message[localName] = toLocal(child);
  };
}
function compileChildReader(field) {
  let compiledChild = compiledReader(field.message);
  if (field.delimitedEncoding) {
    let fieldNo = field.number;
    return (child, reader, ctx) => compiledChild.readGroup(child, reader, ctx, fieldNo);
  }
  return (child, reader, ctx) => compiledChild.read(child, reader, ctx, reader.uint32());
}
function compileListFieldReader(field) {
  let localName = field.localName;
  if (field.listKind == "message") {
    let { toMessage, toLocal } = localMessageMapper(field), readChild = compileChildReader(field);
    return (message, reader, ctx) => {
      let child = toMessage(void 0);
      readChild(child, reader, ctx), message[localName].push(toLocal(child));
    };
  }
  let scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar, longAsString = field.listKind == "scalar" ? field.longAsString : !1, readScalar = compileScalarReader(scalarType, field.utf8Validation, longAsString), packedPossible = scalarType != ScalarType.STRING && scalarType != ScalarType.BYTES;
  return (message, reader, ctx, wireType) => {
    let items = message[localName];
    if (wireType == WireType.LengthDelimited && packedPossible) {
      let end = reader.uint32() + reader.pos;
      for (; reader.pos < end; )
        items.push(readScalar(reader));
    } else
      items.push(readScalar(reader));
  };
}
function compileMapFieldReader(field) {
  let localName = field.localName, readKey = compileScalarReader(field.mapKey, field.utf8Validation, !1), keyZero = scalarZeroValue(field.mapKey, !1), readValue, valueDefault;
  switch (field.mapKind) {
    case "scalar": {
      let scalar = field.scalar, readScalar = compileScalarReader(scalar, field.utf8Validation, !1);
      if (readValue = (reader) => readScalar(reader), scalar == ScalarType.BYTES)
        valueDefault = () => new Uint8Array(0);
      else {
        let zero = scalarZeroValue(scalar, !1);
        valueDefault = () => zero;
      }
      break;
    }
    case "enum": {
      let zero = field.enum.values[0].number;
      readValue = (reader) => reader.int32(), valueDefault = () => zero;
      break;
    }
    case "message": {
      let { toMessage, toLocal } = localMessageMapper(field), readChild = compiledReader(field.message).read;
      readValue = (reader, ctx, existing) => {
        let child = toMessage(existing);
        return readChild(child, reader, ctx, reader.uint32()), toLocal(child);
      }, valueDefault = () => toLocal(toMessage(void 0));
      break;
    }
  }
  return (message, reader, ctx) => {
    let record = message[localName], key2, val, len = reader.uint32(), end = reader.pos + len;
    for (; reader.pos < end; ) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case 1:
          key2 = readKey(reader);
          break;
        case 2:
          val = readValue(reader, ctx, val);
          break;
        default:
          reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
      }
    }
    key2 === void 0 && (key2 = keyZero), val === void 0 && (val = valueDefault()), setOwn(record, key2, val);
  };
}
function compileScalarReader(type, utf8Validation, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return (reader) => reader.string(utf8Validation);
    case ScalarType.BOOL:
      return (reader) => reader.bool();
    case ScalarType.DOUBLE:
      return (reader) => reader.double();
    case ScalarType.FLOAT:
      return (reader) => reader.float();
    case ScalarType.INT32:
      return (reader) => reader.int32();
    case ScalarType.INT64:
      return longAsString ? (reader) => String(reader.int64()) : (reader) => reader.int64();
    case ScalarType.UINT64:
      return longAsString ? (reader) => String(reader.uint64()) : (reader) => reader.uint64();
    case ScalarType.FIXED64:
      return longAsString ? (reader) => String(reader.fixed64()) : (reader) => reader.fixed64();
    case ScalarType.BYTES:
      return (reader) => reader.bytes();
    case ScalarType.FIXED32:
      return (reader) => reader.fixed32();
    case ScalarType.SFIXED32:
      return (reader) => reader.sfixed32();
    case ScalarType.SFIXED64:
      return longAsString ? (reader) => String(reader.sfixed64()) : (reader) => reader.sfixed64();
    case ScalarType.SINT64:
      return longAsString ? (reader) => String(reader.sint64()) : (reader) => reader.sint64();
    case ScalarType.UINT32:
      return (reader) => reader.uint32();
    case ScalarType.SINT32:
      return (reader) => reader.sint32();
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js
function fileDesc(b64, imports) {
  var _a;
  let root = fromBinary(FileDescriptorProtoSchema, base64Decode(b64));
  return root.messageType.forEach(restoreJsonNames), root.dependency = (_a = imports?.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [], createEmbeddedFileRegistry(root, (protoFileName) => imports?.find((f) => f.proto.name === protoFileName)).getFile(root.name);
}

// node_modules/@bufbuild/protobuf/dist/esm/to-binary.js
var IMPLICIT3 = 2, LEGACY_REQUIRED2 = 3, writeDefaults = {
  writeUnknownFields: !0
};
function makeWriteOptions(options) {
  return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function toBinary(schema, message, options) {
  let writer = new BinaryWriter();
  return compiledWriter(schema)(writer, makeWriteOptions(options), message), writer.finish();
}
var compiledWriters = /* @__PURE__ */ new WeakMap();
function compiledWriter(desc) {
  let compiled = compiledWriters.get(desc);
  return compiled === void 0 && (compiled = compileMessage2(desc)), compiled;
}
function compileMessage2(desc) {
  let typeName = desc.typeName, sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number), foreignField = sortedFields[0], fieldWriters = [], compiled = (writer, opts, message) => {
    if (message.$typeName !== typeName && foreignField !== void 0)
      throw new FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
    for (let i = 0; i < fieldWriters.length; i++)
      fieldWriters[i](writer, opts, message);
    let unknown = message.$unknown;
    if (unknown !== void 0 && opts.writeUnknownFields)
      for (let i = 0; i < unknown.length; i++) {
        let { no, wireType, data } = unknown[i];
        writer.tag(no, wireType).raw(data);
      }
  };
  compiledWriters.set(desc, compiled);
  for (let field of sortedFields)
    fieldWriters.push(compileField(field));
  return compiled;
}
function compileField(field) {
  switch (field.fieldKind) {
    case "message":
    case "scalar":
    case "enum":
      return compileSingularField(field);
    case "list":
      return compileListField(field);
    case "map":
      return compileMapField(field);
  }
}
function compileSingularField(field) {
  let writeValue = compileSingularValue(field), localName = field.localName;
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (writer, opts, message) => {
      let oneof = message[oneofLocalName];
      oneof.case === localName && writeValue(writer, opts, oneof.value);
    };
  }
  if (field.presence != IMPLICIT3) {
    let requiredError = field.presence == LEGACY_REQUIRED2 ? `cannot encode ${field} to binary: required field not set` : void 0;
    return (writer, opts, message) => {
      let value = message[localName];
      if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName))
        writeValue(writer, opts, value);
      else if (requiredError !== void 0)
        throw new Error(requiredError);
    };
  }
  if (field.fieldKind == "enum") {
    let zero = field.enum.values[0].number;
    return (writer, opts, message) => {
      let value = message[localName];
      value !== zero && writeValue(writer, opts, value);
    };
  }
  switch (field.scalar) {
    case ScalarType.BOOL:
      return (writer, opts, message) => {
        let value = message[localName];
        value !== !1 && writeValue(writer, opts, value);
      };
    case ScalarType.STRING:
      return (writer, opts, message) => {
        let value = message[localName];
        value !== "" && writeValue(writer, opts, value);
      };
    case ScalarType.BYTES:
      return (writer, opts, message) => {
        let value = message[localName];
        (!(value instanceof Uint8Array) || value.byteLength > 0) && writeValue(writer, opts, value);
      };
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (writer, opts, message) => {
        let value = message[localName];
        Object.is(value, 0) || writeValue(writer, opts, value);
      };
    default:
      return (writer, opts, message) => {
        let value = message[localName];
        value != 0 && writeValue(writer, opts, value);
      };
  }
}
function compileSingularValue(field) {
  switch (field.fieldKind) {
    case "message": {
      let { toMessage } = localMessageMapper(field), writeChild = compileChildWriter(field);
      return (writer, opts, value) => {
        writeChild(writer, opts, toMessage(value));
      };
    }
    case "scalar":
    case "enum": {
      let scalarType = field.fieldKind == "enum" ? ScalarType.INT32 : field.scalar, fieldNo = field.number, wireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      return (writer, opts, value) => {
        writer.tag(fieldNo, wireType), writeScalar(writer, value);
      };
    }
  }
}
function compileListField(field) {
  let localName = field.localName, fieldNo = field.number;
  switch (field.listKind) {
    case "message": {
      let { toMessage } = localMessageMapper(field), writeChild = compileChildWriter(field);
      return (writer, opts, message) => {
        let items = message[localName];
        for (let i = 0; i < items.length; i++)
          writeChild(writer, opts, toMessage(items[i]));
      };
    }
    case "scalar":
    case "enum": {
      let scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar, writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      if (field.packed)
        return (writer, opts, message) => {
          let items = message[localName];
          if (items.length != 0) {
            writer.tag(fieldNo, WireType.LengthDelimited).fork();
            for (let i = 0; i < items.length; i++)
              writeScalar(writer, items[i]);
            writer.join();
          }
        };
      let wireType = writeTypeOfScalar(scalarType);
      return (writer, opts, message) => {
        let items = message[localName];
        for (let i = 0; i < items.length; i++)
          writer.tag(fieldNo, wireType), writeScalar(writer, items[i]);
      };
    }
  }
}
function compileMapField(field) {
  let localName = field.localName, fieldNo = field.number, writeKey = compileMapKey(field);
  if (field.mapKind == "message") {
    let { toMessage } = localMessageMapper(field), writeMessage = compiledWriter(field.message);
    return (writer, opts, message) => {
      let record = message[localName], keys = Object.keys(record);
      for (let i = 0; i < keys.length; i++) {
        let key2 = keys[i];
        writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeKey(writer, key2), writer.tag(2, WireType.LengthDelimited).fork(), writeMessage(writer, opts, toMessage(record[key2])), writer.join(), writer.join();
      }
    };
  }
  let scalarType = field.mapKind == "enum" ? ScalarType.INT32 : field.scalar, valueWireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
  return (writer, opts, message) => {
    let record = message[localName], keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      let key2 = keys[i];
      writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeKey(writer, key2), writer.tag(2, valueWireType), writeScalar(writer, record[key2]), writer.join();
    }
  };
}
function compileMapKey(field) {
  let wireType = writeTypeOfScalar(field.mapKey), writeScalar = compileScalarValue(field.mapKey, field.parent.typeName, field.name), convertKey = compileMapKeyConverter(field.mapKey);
  return (writer, key2) => {
    writer.tag(1, wireType), writeScalar(writer, convertKey(key2));
  };
}
function compileMapKeyConverter(type) {
  switch (type) {
    case ScalarType.STRING:
      return (key2) => key2;
    case ScalarType.BOOL:
      return (key2) => key2 === "true" ? !0 : key2 === "false" ? !1 : key2;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return (key2) => {
        try {
          return protoInt64.uParse(key2);
        } catch {
          return key2;
        }
      };
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (key2) => {
        try {
          return protoInt64.parse(key2);
        } catch {
          return key2;
        }
      };
    default:
      return (key2) => {
        let n = Number.parseInt(key2);
        return Number.isFinite(n) ? n : key2;
      };
  }
}
function compileScalarValue(type, messageName, fieldName) {
  let writeScalar = compileScalarWrite(type);
  return (writer, value) => {
    try {
      writeScalar(writer, value);
    } catch (e) {
      throw e instanceof Error ? new Error(`cannot encode field ${messageName}.${fieldName} to binary: ${e.message}`) : e;
    }
  };
}
function compileScalarWrite(type) {
  switch (type) {
    case ScalarType.STRING:
      return (writer, value) => writer.string(value);
    case ScalarType.BOOL:
      return (writer, value) => writer.bool(value);
    case ScalarType.DOUBLE:
      return (writer, value) => writer.double(value);
    case ScalarType.FLOAT:
      return (writer, value) => writer.float(value);
    case ScalarType.INT32:
      return (writer, value) => writer.int32(value);
    case ScalarType.INT64:
      return (writer, value) => writer.int64(value);
    case ScalarType.UINT64:
      return (writer, value) => writer.uint64(value);
    case ScalarType.FIXED64:
      return (writer, value) => writer.fixed64(value);
    case ScalarType.BYTES:
      return (writer, value) => writer.bytes(value);
    case ScalarType.FIXED32:
      return (writer, value) => writer.fixed32(value);
    case ScalarType.SFIXED32:
      return (writer, value) => writer.sfixed32(value);
    case ScalarType.SFIXED64:
      return (writer, value) => writer.sfixed64(value);
    case ScalarType.SINT64:
      return (writer, value) => writer.sint64(value);
    case ScalarType.UINT32:
      return (writer, value) => writer.uint32(value);
    case ScalarType.SINT32:
      return (writer, value) => writer.sint32(value);
  }
}
function compileChildWriter(field) {
  let fieldNo = field.number, writeMessage = compiledWriter(field.message);
  return field.delimitedEncoding ? (writer, opts, child) => {
    writer.tag(fieldNo, WireType.StartGroup), writeMessage(writer, opts, child), writer.tag(fieldNo, WireType.EndGroup);
  } : (writer, opts, child) => {
    writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeMessage(writer, opts, child), writer.join();
  };
}
function writeTypeOfScalar(type) {
  switch (type) {
    case ScalarType.BYTES:
    case ScalarType.STRING:
      return WireType.LengthDelimited;
    case ScalarType.DOUBLE:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      return WireType.Bit64;
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.FLOAT:
      return WireType.Bit32;
    default:
      return WireType.Varint;
  }
}

// lib/browser_threading.ts
var key = /* @__PURE__ */ Symbol.for("or-tools-wasm.single-thread-warning"), host = globalThis, state = () => host[key] ?? (host[key] = { enabled: !0, printed: !1 });
function isSingleThreadedBrowser() {
  return typeof globalThis.crossOriginIsolated == "boolean" && (globalThis.crossOriginIsolated !== !0 || typeof globalThis.SharedArrayBuffer != "function");
}
function warnSingleThreadedBrowser() {
  if (typeof document > "u") return;
  let notice = state();
  if (!(!isSingleThreadedBrowser() || !notice.enabled || notice.printed)) {
    notice.printed = !0;
    try {
      console.warn("OR-Tools WASM is running with one solver thread because cross-origin isolation is unavailable. Automatic execution runs directly and may block the UI. Enable COOP/COEP headers for parallel solving and shared worker callbacks/cancellation. To hide this warning, call setSingleThreadWarningEnabled(false).");
    } catch {
    }
  }
}

// lib/generated/bridge/job_pb.ts
var file_job = /* @__PURE__ */ fileDesc("Cglqb2IucHJvdG8SFm9ydG9vbHNfd2FzbS5icmlkZ2UudjEi7gIKE1NvbHZlckJyaWRnZVJlcXVlc3QSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSQAoJcmVzb3VyY2VzGAMgASgLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJSZXNvdXJjZVJlcXVlc3QSGQoPZXhlY3V0ZV9wYXlsb2FkGAogASgMSAASPQoGY2FuY2VsGAsgASgLMisub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJDYW5jZWxSZXF1ZXN0SAASQwoJaW50ZXJydXB0GAwgASgLMi4ub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJJbnRlcnJ1cHRSZXF1ZXN0SAASRQoOY2FsbGJhY2tfcmVwbHkYDSABKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckNhbGxiYWNrUmVwbHlIAEILCglvcGVyYXRpb24iKAoVU29sdmVyUmVzb3VyY2VSZXF1ZXN0Eg8KB3RocmVhZHMYASABKA0iMAoTU29sdmVyQ2FuY2VsUmVxdWVzdBIZChF0YXJnZXRfcmVxdWVzdF9pZBgBIAEoDSIzChZTb2x2ZXJJbnRlcnJ1cHRSZXF1ZXN0EhkKEXRhcmdldF9yZXF1ZXN0X2lkGAEgASgNIjEKFFNvbHZlckpvYkludGVycnVwdGVkEhkKEXRhcmdldF9yZXF1ZXN0X2lkGAEgASgNIj0KFVNvbHZlckNhbGxiYWNrUmVxdWVzdBITCgtjYWxsYmFja19pZBgBIAEoBBIPCgdwYXlsb2FkGAIgASgMIkoKE1NvbHZlckNhbGxiYWNrUmVwbHkSEwoLY2FsbGJhY2tfaWQYASABKAQSDwoHcGF5bG9hZBgCIAEoDBINCgVlcnJvchgDIAEoCSKiBAoUU29sdmVyQnJpZGdlUmVzcG9uc2USEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSDgoGam9iX2lkGAMgASgEEhMKC3NlcXVlbmNlX2lkGAQgASgEEjkKBnN0YXR1cxgKIAEoCzInLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iU3RhdHVzSAASOwoHZmFpbHVyZRgLIAEoCzIoLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iRmFpbHVyZUgAEhcKDWV2ZW50X3BheWxvYWQYDCABKAxIABIYCg5yZXN1bHRfcGF5bG9hZBgNIAEoDEgAEj8KCWNhbmNlbGxlZBgOIAEoCzIqLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iQ2FuY2VsbGVkSAASOgoFcmVhZHkYDyABKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlcldvcmtlclJlYWR5SAASQwoLaW50ZXJydXB0ZWQYECABKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYkludGVycnVwdGVkSAASSQoQY2FsbGJhY2tfcmVxdWVzdBgRIAEoCzItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVyQ2FsbGJhY2tSZXF1ZXN0SABCCQoHcGF5bG9hZCITChFTb2x2ZXJXb3JrZXJSZWFkeSIvChJTb2x2ZXJKb2JDYW5jZWxsZWQSGQoRdGFyZ2V0X3JlcXVlc3RfaWQYASABKA0iUwoQU29sdmVyRXZlbnRCYXRjaBI/CglyZXNwb25zZXMYASADKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckJyaWRnZVJlc3BvbnNlIs0BCg9Tb2x2ZXJKb2JTdGF0dXMSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSNQoFc3RhdGUYAyABKA4yJi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYlN0YXRlEhUKDWNyZWF0ZWRfYXRfbXMYBCABKAQSFQoNc3RhcnRlZF9hdF9tcxgFIAEoBBIZChFhbGxvY2F0ZWRfdGhyZWFkcxgGIAEoDRIWCg5xdWV1ZV9wb3NpdGlvbhgHIAEoDSKiAQoQU29sdmVySm9iRmFpbHVyZRISCgpyZXF1ZXN0X2lkGAEgASgNEg4KBnNvbHZlchgCIAEoCRI3CgRraW5kGAMgASgOMikub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJGYWlsdXJlS2luZBIPCgdtZXNzYWdlGAQgASgJEg0KBXRyYWNlGAUgASgJEhEKCXJldHJ5YWJsZRgGIAEoCCqKAgoOU29sdmVySm9iU3RhdGUSIAocU09MVkVSX0pPQl9TVEFURV9VTlNQRUNJRklFRBAAEhsKF1NPTFZFUl9KT0JfU1RBVEVfUVVFVUVEEAESHQoZU09MVkVSX0pPQl9TVEFURV9TVEFSVElORxACEhwKGFNPTFZFUl9KT0JfU1RBVEVfUlVOTklORxADEh8KG1NPTFZFUl9KT0JfU1RBVEVfQ0FOQ0VMTElORxAEEh4KGlNPTFZFUl9KT0JfU1RBVEVfQ0FOQ0VMTEVEEAUSHgoaU09MVkVSX0pPQl9TVEFURV9TVUNDRUVERUQQBhIbChdTT0xWRVJfSk9CX1NUQVRFX0ZBSUxFRBAHKucDChFTb2x2ZXJGYWlsdXJlS2luZBIjCh9TT0xWRVJfRkFJTFVSRV9LSU5EX1VOU1BFQ0lGSUVEEAASJgoiU09MVkVSX0ZBSUxVUkVfS0lORF9FWEVDVVRPUl9FUlJPUhABEioKJlNPTFZFUl9GQUlMVVJFX0tJTkRfUlVOVElNRV9MT0FEX0VSUk9SEAISJAogU09MVkVSX0ZBSUxVUkVfS0lORF9XT1JLRVJfQ1JBU0gQAxIrCidTT0xWRVJfRkFJTFVSRV9LSU5EX1NFUlZFUl9ESVNDT05ORUNURUQQBBIfChtTT0xWRVJfRkFJTFVSRV9LSU5EX1RJTUVPVVQQBRIhCh1TT0xWRVJfRkFJTFVSRV9LSU5EX0NBTkNFTExFRBAGEiAKHFNPTFZFUl9GQUlMVVJFX0tJTkRfSU5URVJOQUwQBxInCiNTT0xWRVJfRkFJTFVSRV9LSU5EX0lOVkFMSURfUkVRVUVTVBAIEicKI1NPTFZFUl9GQUlMVVJFX0tJTkRfVU5BVVRIRU5USUNBVEVEEAkSIgoeU09MVkVSX0ZBSUxVUkVfS0lORF9RVUVVRV9GVUxMEAoSKgomU09MVkVSX0ZBSUxVUkVfS0lORF9VTlNVUFBPUlRFRF9TT0xWRVIQC2IGcHJvdG8z"), SolverBridgeRequestSchema = /* @__PURE__ */ messageDesc(file_job, 0);
var SolverBridgeResponseSchema = /* @__PURE__ */ messageDesc(file_job, 7), SolverWorkerReadySchema = /* @__PURE__ */ messageDesc(file_job, 8), SolverJobCancelledSchema = /* @__PURE__ */ messageDesc(file_job, 9);
var SolverJobStatusSchema = /* @__PURE__ */ messageDesc(file_job, 11), SolverJobFailureSchema = /* @__PURE__ */ messageDesc(file_job, 12), SolverJobState = /* @__PURE__ */ ((SolverJobState3) => (SolverJobState3[SolverJobState3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverJobState3[SolverJobState3.QUEUED = 1] = "QUEUED", SolverJobState3[SolverJobState3.STARTING = 2] = "STARTING", SolverJobState3[SolverJobState3.RUNNING = 3] = "RUNNING", SolverJobState3[SolverJobState3.CANCELLING = 4] = "CANCELLING", SolverJobState3[SolverJobState3.CANCELLED = 5] = "CANCELLED", SolverJobState3[SolverJobState3.SUCCEEDED = 6] = "SUCCEEDED", SolverJobState3[SolverJobState3.FAILED = 7] = "FAILED", SolverJobState3))(SolverJobState || {});
var SolverFailureKind = /* @__PURE__ */ ((SolverFailureKind3) => (SolverFailureKind3[SolverFailureKind3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverFailureKind3[SolverFailureKind3.EXECUTOR_ERROR = 1] = "EXECUTOR_ERROR", SolverFailureKind3[SolverFailureKind3.RUNTIME_LOAD_ERROR = 2] = "RUNTIME_LOAD_ERROR", SolverFailureKind3[SolverFailureKind3.WORKER_CRASH = 3] = "WORKER_CRASH", SolverFailureKind3[SolverFailureKind3.SERVER_DISCONNECTED = 4] = "SERVER_DISCONNECTED", SolverFailureKind3[SolverFailureKind3.TIMEOUT = 5] = "TIMEOUT", SolverFailureKind3[SolverFailureKind3.CANCELLED = 6] = "CANCELLED", SolverFailureKind3[SolverFailureKind3.INTERNAL = 7] = "INTERNAL", SolverFailureKind3[SolverFailureKind3.INVALID_REQUEST = 8] = "INVALID_REQUEST", SolverFailureKind3[SolverFailureKind3.UNAUTHENTICATED = 9] = "UNAUTHENTICATED", SolverFailureKind3[SolverFailureKind3.QUEUE_FULL = 10] = "QUEUE_FULL", SolverFailureKind3[SolverFailureKind3.UNSUPPORTED_SOLVER = 11] = "UNSUPPORTED_SOLVER", SolverFailureKind3))(SolverFailureKind || {});

// lib/solver_bridge.ts
function decodeSolverBridgeRequest(bytes) {
  return fromBinary(SolverBridgeRequestSchema, bytes);
}
function encodeSolverBridgeEvent(requestId, solver, payload, jobId = 0n, sequenceId = 0n) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    requestId,
    solver,
    jobId,
    sequenceId,
    payload: { case: "eventPayload", value: payload }
  }));
}
function encodeSolverBridgeResult(requestId, solver, payload, jobId = 0n, sequenceId = 0n) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    requestId,
    solver,
    jobId,
    sequenceId,
    payload: { case: "resultPayload", value: payload }
  }));
}
function encodeSolverBridgeStatus(requestId, solver, status, jobId = 0n, sequenceId = 0n) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    requestId,
    solver,
    jobId,
    sequenceId,
    payload: { case: "status", value: status }
  }));
}
function encodeSolverBridgeFailure(requestId, solver, failure, jobId = 0n, sequenceId = 0n) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    requestId,
    solver,
    jobId,
    sequenceId,
    payload: { case: "failure", value: failure }
  }));
}
function encodeSolverBridgeCancelled(requestId, solver, targetRequestId, jobId = 0n, sequenceId = 0n) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    requestId,
    solver,
    jobId,
    sequenceId,
    payload: {
      case: "cancelled",
      value: create(SolverJobCancelledSchema, { targetRequestId })
    }
  }));
}
function encodeSolverBridgeReady(solver) {
  return toBinary(SolverBridgeResponseSchema, create(SolverBridgeResponseSchema, {
    solver,
    payload: {
      case: "ready",
      value: create(SolverWorkerReadySchema)
    }
  }));
}

// lib/solver_executor.ts
var SolverJobState2 = SolverJobState, SolverFailureKind2 = SolverFailureKind, SolverExecutorBusyError = class extends Error {
  constructor(solver) {
    super(`${solver} executor already has an active job.`), this.name = "SolverExecutorBusyError";
  }
};
var SolverCancellationUnsupportedError = class extends Error {
  constructor(solver) {
    super(`${solver} direct executor does not support cancellation.`), this.name = "SolverCancellationUnsupportedError";
  }
}, SolverCallbackTransportError = class extends Error {
  constructor(message) {
    super(message), this.name = "SolverCallbackTransportError";
  }
};
function createSolverJobStatusEvent(solver, requestId, state2, createdAtMs, startedAtMs = 0n, allocatedThreads = 0, queuePosition = 0) {
  return {
    type: "status",
    status: create(SolverJobStatusSchema, {
      requestId,
      solver,
      state: state2,
      createdAtMs,
      startedAtMs,
      allocatedThreads,
      queuePosition
    })
  };
}
function createSolverFailureEvent(solver, requestId, message, kind = SolverFailureKind2.INTERNAL, trace = "", retryable = !1) {
  return {
    type: "failure",
    failure: create(SolverJobFailureSchema, {
      requestId,
      solver,
      kind,
      message,
      trace,
      retryable
    })
  };
}
function trackPendingEvent(pending, result, onFailure) {
  if (result === void 0) return;
  let tracked = Promise.resolve(result).then(
    () => {
      pending.delete(tracked);
    },
    (error) => {
      pending.delete(tracked), onFailure(error);
    }
  );
  pending.add(tracked);
}

// lib/solver_worker.ts
var WORKER_CALLBACK_REPLY_CHUNK_SIZE = 65536, CALLBACK_REPLY_TIMEOUT_MS = 3e4;
function isJobEvent(event) {
  if (!event || typeof event != "object" || !("type" in event)) return !1;
  let type = event.type;
  return type === "status" || type === "failure";
}
function installSolverWorker(scope, executor2, codec, options = {}) {
  let jobs = /* @__PURE__ */ new Map(), post = (bytes) => scope.postMessage(bytes, [bytes.buffer]);
  scope.onmessage = async (message) => {
    let requestId = 0, failureSent = !1;
    try {
      let outer = decodeSolverBridgeRequest(message.data);
      if (requestId = outer.requestId, outer.solver !== codec.solver)
        throw new Error(`${codec.label} worker received request for solver ${outer.solver}.`);
      if (outer.operation.case === "cancel") {
        let targetRequestId = outer.operation.value.targetRequestId;
        await jobs.get(targetRequestId)?.cancel(), post(encodeSolverBridgeCancelled(requestId, codec.solver, targetRequestId));
        return;
      }
      if (outer.operation.case !== "executePayload")
        throw new Error(`${codec.label} worker request has no operation.`);
      let job = executor2.execute(codec.decodeRequest(outer.operation.value), {
        onCallback: (payload) => {
          if (isSingleThreadedBrowser()) throw new SolverCallbackTransportError(
            'Worker callbacks require cross-origin isolation. Use executor: "direct" for callbacks without COOP/COEP headers.'
          );
          let reply = new SharedArrayBuffer(12 + WORKER_CALLBACK_REPLY_CHUNK_SIZE), control = new Int32Array(reply, 0, 3);
          scope.postMessage({ type: "callback", requestId, payload, reply }, []);
          let bytes, offset = 0;
          do {
            if (Atomics.wait(control, 0, 0, CALLBACK_REPLY_TIMEOUT_MS) === "timed-out")
              throw Atomics.store(control, 0, -2), Atomics.notify(control, 0), new SolverCallbackTransportError("Solver callback reply timed out.");
            if (Atomics.load(control, 0) === -2) throw new SolverCallbackTransportError("Solver callback transport failed or was terminated.");
            if (Atomics.load(control, 0) !== 1) throw new Error("Solver callback handler failed.");
            bytes ?? (bytes = new Uint8Array(Atomics.load(control, 2)));
            let count = Atomics.load(control, 1);
            bytes.set(new Uint8Array(reply, 12, count), offset), offset += count, Atomics.store(control, 0, offset === bytes.length ? 2 : 0), Atomics.notify(control, 0);
          } while (offset < bytes.length);
          return bytes;
        },
        onEvent: async (event) => {
          if (isJobEvent(event)) {
            event.type === "status" ? post(encodeSolverBridgeStatus(requestId, codec.solver, event.status)) : (failureSent = !0, post(encodeSolverBridgeFailure(requestId, codec.solver, event.failure)));
            return;
          }
          if (!codec.encodeEvent)
            throw new Error(`${codec.label} executor emitted an unsupported solver event.`);
          post(encodeSolverBridgeEvent(requestId, codec.solver, codec.encodeEvent(event)));
        }
      });
      jobs.set(requestId, job);
      try {
        let result = await job.result;
        post(encodeSolverBridgeResult(requestId, codec.solver, codec.encodeResult(result)));
      } finally {
        jobs.delete(requestId);
      }
    } catch (error) {
      if (failureSent) return;
      let failure = create(SolverJobFailureSchema, {
        requestId,
        solver: codec.solver,
        kind: 3 /* WORKER_CRASH */,
        message: error instanceof Error ? error.message : String(error),
        trace: error instanceof Error ? error.stack ?? "" : "",
        retryable: !0
      });
      post(encodeSolverBridgeFailure(requestId, codec.solver, failure));
    }
  }, (async () => {
    options.cancellation && !isSingleThreadedBrowser() && scope.postMessage({
      type: "shared-cancellation",
      ...await options.cancellation()
    }, []), post(encodeSolverBridgeReady(codec.solver));
  })().catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
}

// lib/runtime_loader_core.ts
function isJspiSupported() {
  return typeof globalThis.WebAssembly?.promising == "function";
}
function preferredRuntimeFlavor() {
  return isJspiSupported() ? "jspi" : "asyncify";
}
function createRuntimeLoader(adapter) {
  let modulePromises = {}, selectedFlavor = null;
  function selectRuntimeFlavor() {
    return selectedFlavor || (selectedFlavor = preferredRuntimeFlavor(), adapter.logFlavorSelection && console.log(
      selectedFlavor === "jspi" ? "JSPI is supported. Using JSPI runtime." : "Using Asyncify runtime."
    ), selectedFlavor);
  }
  async function createRuntime(runtimeName, resolveAsset2, flavor = selectRuntimeFlavor()) {
    let key2 = `${runtimeName}:${flavor}`;
    modulePromises[key2] ?? (modulePromises[key2] = (async () => {
      let asset = await resolveAsset2(flavor);
      try {
        let createModule = await adapter.loadFactory(asset.jsUrl), moduleOverrides = {
          locateFile: asset.locateFile,
          noExitRuntime: !0
        };
        return asset.wasmBinary && (moduleOverrides.wasmBinary = asset.wasmBinary), asset.mainScriptUrlOrBlob && (moduleOverrides.mainScriptUrlOrBlob = asset.mainScriptUrlOrBlob), await createModule(moduleOverrides);
      } finally {
        asset.cleanupGlobalState?.();
      }
    })());
    let loading = modulePromises[key2];
    try {
      return await loading;
    } catch (error) {
      throw modulePromises[key2] === loading && delete modulePromises[key2], error;
    }
  }
  async function terminateLoadedRuntimeThreads2() {
    let loadedModules = Object.entries(modulePromises), modules = await Promise.allSettled(loadedModules.map(([, module]) => module));
    try {
      for (let moduleResult of modules) {
        if (moduleResult.status !== "fulfilled") continue;
        let module = moduleResult.value;
        try {
          Object.prototype.hasOwnProperty.call(module, "PThread") && module.PThread?.terminateAllThreads?.();
        } catch (error) {
          if (!String(error).includes("PThread")) throw error;
        }
      }
    } finally {
      for (let [key2, loading] of loadedModules)
        modulePromises[key2] === loading && delete modulePromises[key2];
    }
  }
  return {
    terminateLoadedRuntimeThreads: terminateLoadedRuntimeThreads2,
    loadRuntime: createRuntime
  };
}

// lib/runtime_loader.ts
var loader = createRuntimeLoader({
  logFlavorSelection: !0,
  async loadFactory(runtimeUrl) {
    let { default: createModule } = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      runtimeUrl
    );
    return createModule;
  }
}), terminateLoadedRuntimeThreads = loader.terminateLoadedRuntimeThreads;
function loadBrowserRuntime(name, resolveAsset2, flavor) {
  return loader.loadRuntime(name, (selectedFlavor) => {
    warnSingleThreadedBrowser();
    let asset = resolveAsset2(selectedFlavor), baseName = selectedFlavor === "asyncify" ? `${name}_asyncify` : name;
    return {
      jsUrl: asset.jsUrl,
      // Let Emscripten compile the response as it streams instead of buffering it.
      locateFile: (file) => file === `${baseName}.wasm` ? asset.wasmUrl : file === `${baseName}.js` ? asset.jsUrl : file,
      mainScriptUrlOrBlob: asset.jsUrl
    };
  }, flavor);
}

// lib/runtime/cp_sat.ts
function resolveAsset(flavor) {
  return flavor === "jspi" ? {
    jsUrl: new URL("../../wasm/cp_sat_runtime.js", import.meta.url).href,
    wasmUrl: new URL("../../wasm/cp_sat_runtime.wasm", import.meta.url).href
  } : {
    jsUrl: new URL("../../wasm/cp_sat_runtime_asyncify.js", import.meta.url).href,
    wasmUrl: new URL("../../wasm/cp_sat_runtime_asyncify.wasm", import.meta.url).href
  };
}
var loadRuntime = () => loadBrowserRuntime("cp_sat_runtime", resolveAsset);

// lib/generated/bridge/cp_sat_pb.ts
var file_cp_sat = /* @__PURE__ */ fileDesc("CgxjcF9zYXQucHJvdG8SFm9ydG9vbHNfd2FzbS5icmlkZ2UudjEiuAIKEkNwU2F0QnJpZGdlUmVxdWVzdBI6CgVzb2x2ZRgKIAEoCzIpLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRTb2x2ZVJlcXVlc3RIABJACgh2YWxpZGF0ZRgLIAEoCzIsLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRWYWxpZGF0ZVJlcXVlc3RIABIVCgttb2RlbF9zdGF0cxgMIAEoDEgAEhgKDnJlc3BvbnNlX3N0YXRzGA0gASgMSAASGwoRZXhwb3J0X21vZGVsX3RleHQYDiABKAxIABJLCg5jaGVja19zb2x1dGlvbhgPIAEoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRDaGVja1NvbHV0aW9uUmVxdWVzdEgAQgkKB3BheWxvYWQiswIKE0NwU2F0QnJpZGdlUmVzcG9uc2USQAoMc29sdmVfcmVzdWx0GAogASgLMigub3J0b29sc193YXNtLmJyaWRnZS52MS5DcFNhdFNvbHZlUmVzdWx0SAASPgoLc29sdmVfZXZlbnQYCyABKAsyJy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLkNwU2F0U29sdmVFdmVudEgAEkYKD3ZhbGlkYXRlX3Jlc3VsdBgMIAEoCzIrLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuQ3BTYXRWYWxpZGF0ZVJlc3VsdEgAEhQKCnN0YXRpc3RpY3MYDSABKAlIABIUCgptb2RlbF90ZXh0GA4gASgJSAASGwoRc29sdXRpb25fZmVhc2libGUYDyABKAhIAEIJCgdwYXlsb2FkIosBChFDcFNhdFNvbHZlUmVxdWVzdBIWCg5jcF9tb2RlbF9wcm90bxgBIAEoDBIcChRzYXRfcGFyYW1ldGVyc19wcm90bxgCIAEoDBJACg1jYWxsYmFja19tYXNrGAMgASgLMikub3J0b29sc193YXNtLmJyaWRnZS52MS5DcFNhdENhbGxiYWNrTWFzayJGChFDcFNhdENhbGxiYWNrTWFzaxIQCghzb2x1dGlvbhgBIAEoCBISCgpiZXN0X2JvdW5kGAIgASgIEgsKA2xvZxgDIAEoCCJuChBDcFNhdFNvbHZlUmVzdWx0EiAKGGNwX3NvbHZlcl9yZXNwb25zZV9wcm90bxgBIAEoDBIgChNyZXNwb25zZV9zdGF0aXN0aWNzGAIgASgJSACIAQFCFgoUX3Jlc3BvbnNlX3N0YXRpc3RpY3MiWwoPQ3BTYXRTb2x2ZUV2ZW50EhgKDnNvbHV0aW9uX3Byb3RvGAEgASgMSAASFAoKYmVzdF9ib3VuZBgCIAEoAUgAEg0KA2xvZxgDIAEoCUgAQgkKB3BheWxvYWQiLgoUQ3BTYXRWYWxpZGF0ZVJlcXVlc3QSFgoOY3BfbW9kZWxfcHJvdG8YASABKAwiMgoTQ3BTYXRWYWxpZGF0ZVJlc3VsdBIKCgJvaxgBIAEoCBIPCgdtZXNzYWdlGAIgASgJIkwKGUNwU2F0Q2hlY2tTb2x1dGlvblJlcXVlc3QSFgoOY3BfbW9kZWxfcHJvdG8YASABKAwSFwoPdmFyaWFibGVfdmFsdWVzGAIgAygDYgZwcm90bzM"), CpSatBridgeRequestSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 0), CpSatBridgeResponseSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 1), CpSatSolveRequestSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 2), CpSatCallbackMaskSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 3), CpSatSolveResultSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 4), CpSatSolveEventSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 5), CpSatValidateRequestSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 6), CpSatValidateResultSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 7), CpSatCheckSolutionRequestSchema = /* @__PURE__ */ messageDesc(file_cp_sat, 8);

// lib/cp_sat/protocol.ts
function decodeRequest(payload) {
  let request = fromBinary(CpSatBridgeRequestSchema, payload);
  switch (request.payload.case) {
    case "checkSolution":
      return {
        type: "checkSolution",
        model: request.payload.value.cpModelProto,
        values: request.payload.value.variableValues
      };
    case "solve": {
      let { cpModelProto, satParametersProto, callbackMask } = request.payload.value;
      return {
        type: "solve",
        model: cpModelProto,
        parameters: satParametersProto,
        callbacks: {
          solution: callbackMask?.solution ?? !1,
          bestBound: callbackMask?.bestBound ?? !1,
          log: callbackMask?.log ?? !1
        }
      };
    }
    case "exportModelText":
      return { type: "exportModelText", input: request.payload.value };
    case "modelStats":
      return { type: "modelStats", input: request.payload.value };
    case "responseStats":
      return { type: "responseStats", input: request.payload.value };
    case "validate":
      return { type: "validate", model: request.payload.value.cpModelProto };
    default:
      throw new Error("CP-SAT bridge request has no operation.");
  }
}
function decodeResponse(payload) {
  return fromBinary(CpSatBridgeResponseSchema, payload);
}
var cpSatProtocol = {
  solver: "cp-sat",
  label: "CP-SAT",
  encodeRequest: (operation) => {
    let payload = operation.type === "checkSolution" ? { case: "checkSolution", value: create(CpSatCheckSolutionRequestSchema, {
      cpModelProto: operation.model,
      variableValues: operation.values
    }) } : operation.type === "solve" ? {
      case: "solve",
      value: create(CpSatSolveRequestSchema, {
        cpModelProto: operation.model,
        satParametersProto: operation.parameters,
        callbackMask: create(CpSatCallbackMaskSchema, operation.callbacks)
      })
    } : operation.type === "modelStats" || operation.type === "responseStats" || operation.type === "exportModelText" ? { case: operation.type, value: operation.input } : {
      case: "validate",
      value: create(CpSatValidateRequestSchema, {
        cpModelProto: operation.model
      })
    };
    return toBinary(
      CpSatBridgeRequestSchema,
      create(CpSatBridgeRequestSchema, { payload })
    );
  },
  decodeRequest,
  encodeResult: (result) => {
    let payload = result.type === "solutionFeasible" ? { case: "solutionFeasible", value: result.feasible } : result.type === "solve" ? {
      case: "solveResult",
      value: create(CpSatSolveResultSchema, {
        cpSolverResponseProto: result.response,
        responseStatistics: result.statistics
      })
    } : result.type === "modelText" ? { case: "modelText", value: result.text } : result.type === "statistics" ? { case: "statistics", value: result.report } : {
      case: "validateResult",
      value: create(CpSatValidateResultSchema, {
        ok: result.ok,
        message: result.message
      })
    };
    return toBinary(
      CpSatBridgeResponseSchema,
      create(CpSatBridgeResponseSchema, { payload })
    );
  },
  decodeResult: (payload) => {
    let response = decodeResponse(payload);
    switch (response.payload.case) {
      case "solutionFeasible":
        return { type: "solutionFeasible", feasible: response.payload.value };
      case "solveResult":
        return {
          type: "solve",
          response: response.payload.value.cpSolverResponseProto,
          statistics: response.payload.value.responseStatistics
        };
      case "modelText":
        return { type: "modelText", text: response.payload.value };
      case "statistics":
        return { type: "statistics", report: response.payload.value };
      case "validateResult":
        return {
          type: "validate",
          ok: response.payload.value.ok,
          message: response.payload.value.message
        };
      default:
        throw new Error("CP-SAT bridge response has no result.");
    }
  },
  encodeEvent: (event) => {
    let payload = event.type === "solution" ? { case: "solutionProto", value: event.response } : event.type === "bestBound" ? { case: "bestBound", value: event.bound } : { case: "log", value: event.message };
    return toBinary(CpSatBridgeResponseSchema, create(CpSatBridgeResponseSchema, {
      payload: {
        case: "solveEvent",
        value: create(CpSatSolveEventSchema, { payload })
      }
    }));
  },
  decodeEvent: (payload) => {
    let response = decodeResponse(payload);
    if (response.payload.case !== "solveEvent") return null;
    let event = response.payload.value.payload;
    switch (event.case) {
      case "solutionProto":
        return { type: "solution", response: event.value };
      case "bestBound":
        return { type: "bestBound", bound: event.value };
      case "log":
        return { type: "log", message: event.value };
      default:
        return null;
    }
  }
};

// lib/wasm_memory.ts
function allocateWasm(module, size) {
  let pointer = module._malloc(size);
  if (!pointer) throw new Error("Could not allocate WASM memory.");
  return pointer;
}
function allocateWasmBytes(module, bytes, minimumSize = 0) {
  let size = Math.max(bytes?.length ?? 0, minimumSize);
  if (!size) return 0;
  let pointer = allocateWasm(module, size);
  try {
    return bytes && module.HEAPU8.set(bytes, pointer), pointer;
  } catch (error) {
    throw module._free(pointer), error;
  }
}
async function withWasmAllocations(module, use) {
  let pointers = [];
  try {
    return await use((bytes, minimumSize) => {
      let pointer = allocateWasmBytes(module, bytes, minimumSize);
      return pointer && pointers.push(pointer), pointer;
    });
  } finally {
    for (let pointer of pointers) module._free(pointer);
  }
}
async function readWasmResult(module, invoke, release = (pointer) => module._free(pointer)) {
  let lengthPointer = allocateWasm(module, Uint32Array.BYTES_PER_ELEMENT), resultPointer = 0;
  try {
    resultPointer = await invoke(lengthPointer);
    let length = new DataView(
      module.HEAPU8.buffer,
      lengthPointer,
      Uint32Array.BYTES_PER_ELEMENT
    ).getUint32(0, !0);
    return resultPointer && length ? module.HEAPU8.slice(resultPointer, resultPointer + length) : new Uint8Array();
  } finally {
    try {
      resultPointer && release(resultPointer);
    } finally {
      module._free(lengthPointer);
    }
  }
}

// lib/wasm_runtime_lock.ts
async function withWasmRuntimeLock(module, run) {
  let previous = module.__ortoolsNativeCallTail ?? Promise.resolve(), release, current = new Promise((resolve) => {
    release = resolve;
  });
  module.__ortoolsNativeCallTail = current, await previous;
  try {
    return await run();
  } finally {
    release(), module.__ortoolsNativeCallTail === current && delete module.__ortoolsNativeCallTail;
  }
}

// lib/cp_sat/direct_executor.ts
var SOLUTION_CALLBACK_FLAG = 1, BEST_BOUND_CALLBACK_FLAG = 2, LOG_CALLBACK_FLAG = 4, SOLUTION_CALLBACK_EVENT = 1, BEST_BOUND_CALLBACK_EVENT = 2, LOG_CALLBACK_EVENT = 3;
function callbackFlags(mask) {
  let flags = 0;
  return mask?.solution && (flags |= SOLUTION_CALLBACK_FLAG), mask?.bestBound && (flags |= BEST_BOUND_CALLBACK_FLAG), mask?.log && (flags |= LOG_CALLBACK_FLAG), flags;
}
function cpSatWasmCallbacks(module) {
  return module.__ortoolsCpSatCallbacks ?? (module.__ortoolsCpSatCallbacks = {
    nextId: 1,
    sinks: /* @__PURE__ */ new Map()
  });
}
function cpSatCallbackEvent(eventType, payload) {
  return eventType === SOLUTION_CALLBACK_EVENT ? { type: "solution", response: payload } : eventType === BEST_BOUND_CALLBACK_EVENT ? {
    type: "bestBound",
    bound: new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getFloat64(0, !0)
  } : eventType === LOG_CALLBACK_EVENT ? { type: "log", message: new TextDecoder().decode(payload) } : null;
}
async function nativeStatistics(module, input, response) {
  let pointer = allocateWasmBytes(module, input);
  try {
    let bytes = await readWasmResult(
      module,
      (length) => module.ccall(
        "cp_sat_statistics",
        "number",
        ["number", "number", "number", "number"],
        [pointer, input.length, response ? 1 : 0, length]
      ),
      (pointer2) => module._free_buffer(pointer2)
    ), report = new TextDecoder().decode(bytes);
    if (module.ccall("cp_sat_statistics_failed", "number", [], [])) throw new Error(report || "Failed to generate CP-SAT statistics.");
    if (!report) throw new Error("Failed to generate CP-SAT statistics.");
    return report;
  } finally {
    module._free(pointer);
  }
}
function nowMs() {
  return BigInt(Date.now());
}
function createCpSatJobStatusEvent(requestId, state2, createdAtMs, startedAtMs = 0n) {
  return createSolverJobStatusEvent(
    "cp-sat",
    requestId,
    state2,
    createdAtMs,
    startedAtMs
  );
}
function createCpSatFailureEvent(requestId, message, kind = SolverFailureKind2.INTERNAL, trace = "", retryable = !1) {
  return createSolverFailureEvent("cp-sat", requestId, message, kind, trace, retryable);
}
var DirectCpSatExecutor = class {
  constructor(loadModuleImpl = loadRuntime) {
    this.loadModuleImpl = loadModuleImpl;
    this.solver = "cp-sat";
    this.nextRequestId = 1;
    this.activeJob = null;
  }
  async load() {
    await this.module();
  }
  module() {
    return this.loadModuleImpl();
  }
  execute(payload, options) {
    if (this.activeJob) throw new SolverExecutorBusyError(this.solver);
    let requestId = this.nextCpSatRequestId(), state2 = { cancelled: !1, nativeRunning: !1 };
    this.activeJob = state2;
    let stop = async () => {
      if (payload.type !== "solve") throw new SolverCancellationUnsupportedError(this.solver);
      if (this.activeJob !== state2) return;
      state2.cancelled = !0;
      let module = await this.module();
      this.activeJob === state2 && state2.nativeRunning && this.interrupt(module);
    };
    return {
      requestId,
      result: this.run(requestId, payload, options.onEvent).finally(() => {
        this.activeJob === state2 && (this.activeJob = null);
      }),
      cancel: stop,
      interrupt: stop
    };
  }
  interrupt(module) {
    let address = module.ccall("cp_sat_interrupt_address", "number", [], []);
    Atomics.store(module.HEAPU8, address, 1);
  }
  async run(requestId, payload, onEvent) {
    let createdAtMs = nowMs();
    try {
      await onEvent(createCpSatJobStatusEvent(
        requestId,
        SolverJobState2.STARTING,
        createdAtMs
      ));
      let result;
      switch (payload.type) {
        case "checkSolution": {
          let module = await this.module();
          result = { response: { type: "solutionFeasible", feasible: await withWasmRuntimeLock(module, () => withWasmAllocations(module, async (allocate) => {
            let model = allocate(payload.model), values = allocate(new Uint8Array(new BigInt64Array(payload.values).buffer)), output = allocate(new Uint8Array(4)), error = await readWasmResult(
              module,
              (length) => module.ccall(
                "cp_sat_solution_is_feasible",
                "number",
                ["number", "number", "number", "number", "number", "number"],
                [model, payload.model.length, values, payload.values.length, output, length],
                { async: !0 }
              ),
              (pointer) => module._free_buffer(pointer)
            ), answer = new DataView(module.HEAPU8.buffer).getInt32(output, !0);
            if (answer !== 0 && answer !== 1) throw new Error(new TextDecoder().decode(error) || "Failed to check CP-SAT solution.");
            return answer === 1;
          })) }, terminalState: SolverJobState2.SUCCEEDED };
          break;
        }
        case "solve":
          result = {
            response: await this.solve(requestId, payload, createdAtMs, onEvent),
            terminalState: SolverJobState2.SUCCEEDED
          };
          break;
        case "exportModelText": {
          let module = await this.module();
          result = { response: { type: "modelText", text: await withWasmRuntimeLock(module, async () => {
            let pointer = allocateWasmBytes(module, payload.input);
            try {
              let bytes = await readWasmResult(
                module,
                (length) => module.ccall(
                  "cp_sat_export_model_text",
                  "number",
                  ["number", "number", "number"],
                  [pointer, payload.input.length, length]
                ),
                (pointer2) => module._free_buffer(pointer2)
              ), text2 = new TextDecoder().decode(bytes);
              if (module.ccall("cp_sat_model_text_failed", "number", [], [])) throw new Error(text2 || "Failed to export CP-SAT model text.");
              return text2;
            } finally {
              module._free(pointer);
            }
          }) }, terminalState: SolverJobState2.SUCCEEDED };
          break;
        }
        case "modelStats":
        case "responseStats": {
          let module = await this.module();
          result = { response: { type: "statistics", report: await withWasmRuntimeLock(module, () => nativeStatistics(module, payload.input, payload.type === "responseStats")) }, terminalState: SolverJobState2.SUCCEEDED };
          break;
        }
        case "validate":
          result = {
            response: await this.validate(requestId, payload, createdAtMs, onEvent),
            terminalState: SolverJobState2.SUCCEEDED
          };
          break;
        default:
          throw new Error("Unsupported CP-SAT operation.");
      }
      return await onEvent(createCpSatJobStatusEvent(
        requestId,
        result.terminalState,
        createdAtMs
      )), result.response;
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error), trace = error instanceof Error ? error.stack ?? "" : "", failure = createCpSatFailureEvent(requestId, message, SolverFailureKind2.INTERNAL, trace);
      throw await onEvent(failure), await onEvent(createCpSatJobStatusEvent(
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), error;
    }
  }
  terminate(_reason) {
  }
  nextCpSatRequestId() {
    return this.nextRequestId++;
  }
  async solve(requestId, solveRequest, createdAtMs, onEvent) {
    let module = await this.module(), startedAtMs = nowMs();
    await onEvent(createCpSatJobStatusEvent(
      requestId,
      SolverJobState2.RUNNING,
      createdAtMs,
      startedAtMs
    ));
    let modelBytes = solveRequest.model, paramsBytes = solveRequest.parameters, flags = callbackFlags(solveRequest.callbacks), callbackError, pendingCallbacks = /* @__PURE__ */ new Set(), bytes = await withWasmRuntimeLock(module, () => withWasmAllocations(module, async (allocate) => {
      let modelPtr = allocate(modelBytes), paramsPtr = allocate(paramsBytes), callbackId = 0, interruptAddress, state2 = this.activeJob;
      if (!state2) throw new Error("CP-SAT solve has no active job.");
      try {
        let bytes2 = await readWasmResult(module, async (lengthPointer) => {
          if (interruptAddress = module.ccall("cp_sat_interrupt_address", "number", [], []), state2.nativeRunning = !0, state2.cancelled && Atomics.store(module.HEAPU8, interruptAddress, 1), !flags)
            return await module.ccall(
              "solve_model",
              "number",
              ["number", "number", "number", "number", "number"],
              [modelPtr, modelBytes.length, paramsPtr, paramsBytes.length, lengthPointer],
              { async: !0 }
            );
          let callbacks = cpSatWasmCallbacks(module);
          return callbackId = callbacks.nextId++, callbacks.sinks.set(callbackId, (eventType, payload) => {
            let event = cpSatCallbackEvent(eventType, payload);
            if (!(!event || callbackError))
              try {
                let pending = onEvent(event);
                trackPendingEvent(pendingCallbacks, pending, (error) => {
                  callbackError ?? (callbackError = { error });
                });
              } catch (error) {
                callbackError ?? (callbackError = { error });
              }
          }), await module.ccall(
            "solve_model_with_callback_events",
            "number",
            ["number", "number", "number", "number", "number", "number", "number"],
            [modelPtr, modelBytes.length, paramsPtr, paramsBytes.length, flags, callbackId, lengthPointer],
            { async: !0 }
          );
        }, (pointer) => module._free_buffer(pointer));
        return state2.nativeRunning = !1, { bytes: bytes2, statistics: await nativeStatistics(module, bytes2, !0) };
      } finally {
        state2.nativeRunning = !1, interruptAddress !== void 0 && Atomics.store(module.HEAPU8, interruptAddress, 0), callbackId && cpSatWasmCallbacks(module).sinks.delete(callbackId);
      }
    }));
    if (await Promise.all(pendingCallbacks), callbackError) throw callbackError.error;
    return { type: "solve", response: bytes.bytes, statistics: bytes.statistics };
  }
  async validate(requestId, validateRequest, createdAtMs, onEvent) {
    let module = await this.module(), startedAtMs = nowMs();
    return await onEvent(createCpSatJobStatusEvent(
      requestId,
      SolverJobState2.RUNNING,
      createdAtMs,
      startedAtMs
    )), withWasmRuntimeLock(module, async () => {
      let modelBytes = validateRequest.model, modelPtr = allocateWasmBytes(module, modelBytes);
      try {
        let bytes = await readWasmResult(
          module,
          (lengthPointer) => module.ccall(
            "validate_model",
            "number",
            ["number", "number", "number"],
            [modelPtr, modelBytes.length, lengthPointer],
            { async: !0 }
          ),
          (pointer) => module._free_buffer(pointer)
        ), message = new TextDecoder().decode(bytes);
        return { type: "validate", ok: message.length === 0, message };
      } finally {
        modelPtr && module._free(modelPtr);
      }
    });
  }
};

// lib/cp_sat/worker.ts
var modulePromise = null;
function loadCpSatRuntime() {
  return modulePromise ?? (modulePromise = loadRuntime()), modulePromise;
}
var executor = new DirectCpSatExecutor(loadCpSatRuntime);
async function sharedCancellation() {
  let module = await loadCpSatRuntime(), memory = module.HEAPU8.buffer;
  if (!(memory instanceof SharedArrayBuffer))
    throw new Error("CP-SAT worker cancellation requires shared WASM memory.");
  let interruptAddress = module._cp_sat_interrupt_address ?? module.cp_sat_interrupt_address;
  if (typeof interruptAddress != "function")
    throw new Error("CP-SAT interrupt address export unavailable.");
  return {
    memory,
    byteOffset: interruptAddress()
  };
}
installSolverWorker(
  self,
  executor,
  cpSatProtocol,
  { cancellation: sharedCancellation }
);
