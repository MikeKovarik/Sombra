(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('crypto'), require('stream'), require('buffer')) :
	typeof define === 'function' && define.amd ? define(['exports', 'crypto', 'stream', 'buffer'], factory) :
	(factory((global.sombra = {}),global.crypto,global.stream,global.buffer));
}(this, (function (exports,_nodeCrypto,stream,_Buffer) { 'use strict';

_nodeCrypto = _nodeCrypto && _nodeCrypto.hasOwnProperty('default') ? _nodeCrypto['default'] : _nodeCrypto;
stream = stream && stream.hasOwnProperty('default') ? stream['default'] : stream;
_Buffer = _Buffer && _Buffer.hasOwnProperty('default') ? _Buffer['default'] : _Buffer;

var Buffer$1;
// Similarly stream module and its Transform class is not mandatory.
var Transform = stream && stream.Transform ? stream.Transform : class {};

// Custom functions that map to Buffer.alloc(), Bufer.from(), buffer.toString() if Buffer class is present,
// Otherwise falls back to providing similar fuctionality over Uint8Array.
var bufferAlloc;
var bufferAllocUnsafe;
var bufferFrom;
var bufferToString;

if (_Buffer) {
	if (typeof _Buffer === 'function') Buffer$1 = _Buffer;else if (typeof _Buffer.Buffer === 'function') Buffer$1 = _Buffer.Buffer;
}

// Also exporting internal methods used for shimming Buffer.from() and buffer.toString().
// Sombra's encoding classes Utf8, Hex and Base64 would normally contain following shims, but it has been moved
// here to form a coherent shim of Buffer class (due to class hoisting and circular dependencies).
var bufferFromUtf8;
var bufferFromHex;
var bufferFromBase64;
var bufferToStringUtf8;
var bufferToStringHex;
var bufferToStringBase64;

// Wrapper or shims (where necessary) of Buffer methods
if (Buffer$1) {

	bufferAlloc = Buffer$1.alloc;
	bufferAllocUnsafe = Buffer$1.allocUnsafe;
	bufferFrom = Buffer$1.from;
	bufferToString = (buffer, encoding) => buffer.toString(encoding);

	bufferFromUtf8 = data => Buffer$1.from(data, 'utf8');
	bufferFromHex = data => Buffer$1.from(data, 'hex');
	bufferFromBase64 = data => Buffer$1.from(data, 'base64');
	bufferToStringUtf8 = buffer => buffer.toString('utf8');
	bufferToStringHex = buffer => buffer.toString('hex');
	bufferToStringBase64 = buffer => buffer.toString('base64');
} else {

	// Shim of Buffer.alloc() & Buffer.allocUnsafe(). Note: Uint8Array is always 0 filled.
	bufferAlloc = bufferAllocUnsafe = size => new Uint8Array(size);

	// UTF8, depends on availability of TextDecoder/TextEncoder and platform.
	if (typeof TextDecoder !== 'undefined') {
		// browser supporting Encoding API
		let decoder = new TextDecoder('utf-8');
		let encoder = new TextEncoder('utf-8');
		bufferFromUtf8 = string => encoder.encode(string);
		bufferToStringUtf8 = buffer => decoder.decode(buffer);
	} else if (platform.uwp) {
		// Windows UWP
		let CryptographicBuffer = Windows.Security.Cryptography.CryptographicBuffer;
		let utf8enc = Windows.Security.Cryptography.BinaryStringEncoding.utf8;
		bufferFromUtf8 = string => {
			var iBuffer = CryptographicBuffer.convertStringToBinary(string, utf8enc);
			return new Uint8Array(iBuffer);
		};
		bufferToStringUtf8 = buffer => {
			var iBuffer = CryptographicBuffer.createFromByteArray(buffer);
			return CryptographicBuffer.convertBinaryToString(utf8enc, iBuffer);
		};
	}

	// HEX
	bufferFromHex = string => {
		var buffer = new Uint8Array(string.length / 2);
		var i, b;
		for (i = 0, b = 0; i < string.length; i += 2, b++) buffer[b] = parseInt(string.slice(i, i + 2), 16);
		return buffer;
	};
	bufferToStringHex = buffer => {
		var string = '';
		for (var i = 0; i < buffer.length; i++) string += buffer[i].toString(16).padStart(2, '0');
		return string;
	};

	// BASE64
	bufferFromBase64 = string => {
		var raw = window.atob(string);
		console.log(string, raw);
		var rawLength = raw.length;
		var buffer = new Uint8Array(raw.length);
		for (var i = 0; i < rawLength; i++) buffer[i] = raw.charCodeAt(i);
		return buffer;
	};
	bufferToStringBase64 = buffer => {
		var CHUNK_SIZE = 0xFFFF;
		var temp = '';
		var slice;
		for (var i = 0; i < buffer.length; i += CHUNK_SIZE) {
			slice = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length));
			temp += String.fromCharCode.apply(null, slice);
			console.log(i, slice, temp);
		}
		return btoa(temp);
	};

	// Shim of Buffer.from(data, encoding)
	bufferFrom = (data, encoding = 'utf8') => {
		if (Array.isArray(data) || data instanceof Uint8Array || data instanceof ArrayBuffer) {
			return new Uint8Array(data);
		} else {
			switch (encoding) {
				case 'hex':
					return bufferFromHex(data);
				case 'utf8':
					return bufferFromUtf8(data);
				case 'base64':
					return bufferFromBase64(data);
			}
		}
	};
	// Shim of buffer.to(encoding)
	bufferToString = (buffer, encoding = 'utf8') => {
		switch (encoding) {
			case 'hex':
				return bufferToStringHex(buffer);
			case 'utf8':
				return bufferToStringUtf8(buffer);
			case 'base64':
				return bufferToStringBase64(buffer);
		}
	};
}

var nodeCrypto = _nodeCrypto.createCipheriv && _nodeCrypto.Hash ? _nodeCrypto : undefined;
var webCrypto = typeof window === 'object' ? window.crypto : undefined;

function iterator() {
	return {
		i: 0,
		values: Object.values(Sombra),
		next() {
			return {
				value: this.values[this.i++],
				done: this.i > this.values.length
			};
		}
	};
}

var platform = {
	node: typeof process === 'object' && process.versions.v8,
	uwp: typeof Windows === 'object',
	browser: typeof navigator === 'object'

	// Turns int number into buffer (e.g. 0xABCDEF56 => <AB,CD,EF,56>)
};function bufferFromInt(int, bytes) {
	var buffer = bufferAlloc(bytes);
	for (var i = 0; i < bytes; i++) buffer[bytes - i - 1] = int >>> i * 8;
	return buffer;
}

/*
export function chain(input, actions, returnBuffer = false, defaultAction = 'encode') {
	var state = input
	// convert given string to buffer
	if (typeof state == 'string') {
		state = Sombra.string.decode(state)
	}
	// 
	if (typeof actions[0] == 'string') {
		actions = actions.map(name => [name, defaultAction])
	}
	// run the pipeline
	actions.forEach(action => {
		var [algorithm, method, ...args] = action
		state = Sombra[algorithm][method](state, ...args)
	})
	// convert buffer to string
	if (returnBuffer == false) {
		state = Sombra.string.encode(state)
	}
	return state
}
*/

var util = Object.freeze({
	nodeCrypto: nodeCrypto,
	webCrypto: webCrypto,
	iterator: iterator,
	platform: platform,
	bufferFromInt: bufferFromInt,
	get Buffer () { return Buffer$1; },
	Transform: Transform,
	get bufferAlloc () { return bufferAlloc; },
	get bufferAllocUnsafe () { return bufferAllocUnsafe; },
	get bufferFrom () { return bufferFrom; },
	get bufferToString () { return bufferToString; },
	get bufferFromUtf8 () { return bufferFromUtf8; },
	get bufferFromHex () { return bufferFromHex; },
	get bufferFromBase64 () { return bufferFromBase64; },
	get bufferToStringUtf8 () { return bufferToStringUtf8; },
	get bufferToStringHex () { return bufferToStringHex; },
	get bufferToStringBase64 () { return bufferToStringBase64; }
});

class SombraTransform extends Transform {

	// Shared constructor for update()/digest() and transform stream.

	constructor(...args) {
		super();
		// Apply defaults to the arguments (if any defaults are defined).
		if (this.constructor.args) args = this._preProcessArgs(this.constructor.args, args);
		// Apply Class' args changes, if method for handling them is defined.
		if (this._handleArgs) args = this._handleArgs(...args);
		this.args = args;
		this._rawChunks = [];
		this._encodedChunks = [];
		if (this._init) this._init(...args);
	}

	// TODO: Get rid of this mess, make it create instance and rely on update/digest
	//       so Hash classes can inherit from this.
	static encode(data, ...args) {
		// Converts potential strings to buffer and makes sure we don't tamper with user's data.
		var buffer = bufferFrom(data);
		// Apply defaults to the arguments (if any defaults are defined).
		if (this.args) args = this.prototype._preProcessArgs(this.args, args);
		// Apply Class' args changes, if method for handling them is defined.
		if (this.prototype._handleArgs) args = this.prototype._handleArgs(...args);
		// If class defined _encode() method that can do the calculation in one go,
		// then execute it and bypass the update/digest streaming.
		if (this.prototype._encode) return this.prototype._encode(buffer, ...args);
		var context = {
			constructor: this,
			prototype: this.prototype
		};
		if (this.prototype._init) this.prototype._init.call(context, ...args);
		var encodedChunks = [this.prototype._update.call(context, buffer, ...args), this.prototype._digest.call(context, ...args)].filter(a => a);
		//console.log('encodedChunks', encodedChunks)
		//console.log('Buffer.concat(encodedChunks)', Buffer.concat(encodedChunks))
		return Buffer.concat(encodedChunks);
	}

	// Continual update()/digest() API for streaming sources (other than Node streams).
	// Modeled after Node's 'crypto' module and the crypto.Hash class.
	// https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding
	// Similar to web crypto subtle.digest(), except webcrypto doesn't have update().
	// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest

	// Updates the hash content with the given data, the encoding of which is given in inputEncoding and
	// can be 'utf8', 'ascii' or 'latin1'. If encoding is not provided, and the data is a string,
	// an encoding of 'utf8' is enforced. If data is a Buffer, TypedArray, or DataView, then inputEncoding is ignored.
	update(chunk, encoding = 'utf8') {
		chunk = bufferFrom(chunk, encoding);
		// TODO: how to pass the value?
		var returned = this._update(chunk, ...this.args);
		if (returned) this._encodedChunks.push(returned);
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// TODO: how to pass the value?
		// TODO: digest has to return the result, but _update is pushing it
		var returned = this._digest(...this.args);
		if (returned) this._encodedChunks.push(returned);
		var result = Buffer.concat(this._encodedChunks);
		// Always return buffer unless encoding is specified.
		if (encoding) return bufferToString(result, encoding);else return result;
	}

	// Node stream.Transform stream API to enable pipe-ing.

	_transform(chunk, encoding = 'utf8', cb) {
		chunk = bufferFrom(chunk, encoding);
		var returned = this._update(chunk, ...this.args);
		if (returned) this.push(returned);
		cb();
	}

	_flush(cb) {
		var returned = this._digest(...this.args);
		if (returned) this.push(returned);
		cb();
	}

	// default implementation to be overwritten where needed
	_update(chunk /*, ...args*/) {
		this._rawChunks.push(chunk);
	}

	_digest(...args) {
		var buffer = Buffer.concat(this._rawChunks);
		return this._encode(buffer, ...args);
	}

	_preProcessArgs(defaults, custom) {
		return defaults.map((options, i) => {
			var value = custom[i];
			if (value === undefined) {
				value = options.default;
			} else {
				if (options.min !== undefined) value = Math.min(options.min, value);
				if (options.max !== undefined) value = Math.max(options.max, value);
				if (options.type === 'number') value = parseFloat(value);
			}
			return value;
		});
	}

	// TODO: Figure out how to do Decoder streams
	static decode(buffer) {
		if (this.args) return this.prototype._decode(buffer, ...this.args.map(o => o.default));else return this.prototype._decode(buffer);
	}

	// HELPER FUNCTIONS

	static set chars(newVal) {
		this._chars = newVal;
	}
	static set bytes(newVal) {
		this._bytes = newVal;
	}
	static set bits(newVal) {
		this._bits = newVal;
	}

	static get chars() {
		return this._chars || this.size / 4;
	}
	static get bytes() {
		return this._bytes || this.size / 8;
	}
	static get bits() {
		return this._bits || this.size;
	}

	// TODO: this was temporarily copy-pasted here from subclass. make this work for all classes.
	//static toString(buffer, encoding) {
	//	return toString(this.encode(buffer), encoding)
	//}

	static convert(string) {
		var buffer = bufferFrom(string);
		return this.encode(buffer);
	}

	static decodeString(string) {
		return this.decode(bufferFrom(string));
	}
	static encodeString(string) {
		return this.encode(bufferFrom(string));
	}

}

class Utf8$1 extends SombraTransform {}

Utf8$1.encode = bufferToStringUtf8;
Utf8$1.decode = bufferFromUtf8;
Utf8$1.toString = bufferToStringUtf8;
Utf8$1.fromBuffer = bufferToStringUtf8;
Utf8$1.fromString = bufferFromUtf8;
Utf8$1.toBuffer = bufferFromUtf8;
var utf8 = Utf8$1;

class Base64 extends SombraTransform {

	// Converts buffer into buffer representation of the base64 string.
	// To get the actual string it has go through Utf8 encoder, or Base64.toString should be used.
	// This is because of piping
	// e.g. Buffer.from('ff', 'hex') => Buffer.from('/w==', 'utf8')
	//      <Buffer ff>              => <Buffer 2f 77 3d 3d>
	_encode(buffer) {
		return bufferFromUtf8(bufferToStringBase64(buffer));
	}

	// Reversal of .encode(). Takes in buffer (form of base64 string) and returns buffer.


	// TODO: _transform methods for stream
	// TODO: turn this into two transform stream classes (one for decoding, second to encoding)

	_decode(buffer) {
		return bufferFromBase64(bufferToStringUtf8(buffer));
	}

	static toString(buffer) {
		buffer = bufferFrom(buffer);
		return bufferToStringBase64(buffer);
	}

	// todo


	_update(chunk) {
		if (this.lastChunk) {
			chunk = Buffer.concat([this.lastChunk, chunk]);
			this.lastChunk = undefined;
		}
		var chunkLength = chunk.length;
		if (chunkLength < 3) {
			this.lastChunk = chunk;
			return;
		}
		var overflowBytes = chunkLength % 3;
		if (overflowBytes) {
			this.lastChunk = chunk.slice(chunkLength - overflowBytes);
			chunk = chunk.slice(0, chunkLength - overflowBytes);
		}
		if (chunk) return this._encode(chunk);
	}

	_digest() {
		if (this.lastChunk) return this._encode(this.lastChunk);
	}

	// Note: every 3 bytes result in 3 characters. transform stream can process divisions of 3 and carry
	// remaining chunks to next computation

}

Base64.validate = string => string.match(/^[A-Za-z0-9+/=]*$/) === null;

Base64.fromString = bufferFromBase64;
var base64 = Base64.toString.bind(Base64);

function splitIntoChunks(input, chars) {
	var output = [];
	for (var i = 0; i < input.length; i += chars) {
		myChunk = input.slice(i, i + chars);
		output.push(myChunk);
	}
	return output;
}

class NumericEncoding extends SombraTransform {

	_encode(buffer, separator, radix, chars) {
		radix = radix || this.constructor.radix;
		chars = chars || this.constructor.chars;
		var array = Array.from(buffer).map(val => val.toString(radix));
		if (separator.length === 0 || this.constructor.zeroPadded) array = array.map(num => num.padStart(chars, '0'));
		return bufferFrom(array.join(separator));
	}

	// TODO: _transform methods for stream
	// TODO: turn this into two transform stream classes (one for decoding, second to encoding)

	static encodeString(buffer, separator = ' ') {
		return Array.from(buffer).map(val => val.toString(this.radix).padStart(this.chars, '0')).join(separator);
	}

	static decodeString(string, separator = ' ') {
		var { chars, radix } = this;
		if (separator.length) {
			// Slower parsing using separator over uncertain strings - chunks might not be zero padded.
			var array = string.split(separator).map(str => parseInt(str, radix));
			return bufferFrom(array);
		} else {
			// More performant way iteration over non-spaced array of fixed-length chunks (0 padded).
			var buffer = bufferAllocUnsafe(string.length / chars);
			var i, b;
			for (i = 0, b = 0; i < string.length; i += chars, b++) buffer[b] = parseInt(string.slice(i, i + chars), radix);
			return buffer;
		}
	}

}

NumericEncoding.args = [{
	title: 'Separator',
	type: 'string',
	default: ' '
}];
class Bin extends NumericEncoding {}

Bin.validate = (string, separator) => string.match(/^[01 ]*$/);

Bin.radix = 2;
Bin.chars = 8;
Bin.zeroPadded = true;
class Oct extends NumericEncoding {}

Oct.validate = (string, separator) => string.match(/^[0-8 ]*$/);

Oct.radix = 8;
Oct.chars = 3;
Oct.zeroPadded = true;
class Dec extends NumericEncoding {}

Dec.validate = (string, separator) => string.match(/^[0-9 ]*$/);

Dec.radix = 10;
Dec.chars = 3;
Dec.zeroPadded = false;
class Hex extends NumericEncoding {}

// Custom radix encoding.

Hex.validate = (string, separator) => string.match(/^[0-9a-fA-F ]*$/);

Hex.radix = 16;
Hex.chars = 2;
Hex.zeroPadded = true;
class Num extends NumericEncoding {

	_init(separator, radix, chars) {
		this.radix = radix;
		this.chars = chars;
	}

}

// Idea of what the encoder/decoder interface should look like
/*
var hex = createShortcut(HexEncoder, HexDecoder)

function createShortcut(Encoder, Decoder) {
	var fn = Encoder.convert.bind(Encoder)
	fn.Encoder = Encoder
	fn.encode = Encoder.convert.bind(Encoder)
	if (Decoder) {
		fn.Decoder = Decoder
		fn.decode = Encoder.convert.bind(Encoder)
	}
	return fn
}
*/

Num.args = [{
	title: 'Separator',
	type: 'string',
	default: ' '
}, {
	name: 'Radix',
	type: 'number',
	default: 16
}, {
	name: 'Character size',
	type: 'number',
	default: 2
}];

// TODO: decode
// TODO: make decoder streamable (through _update and _digest), because the chunks might be split
//       right in the middle of entity - &#x at the end of one, the hex value at the beginning of second chunk.
class EntityEncoding extends SombraTransform {

	_encode(buffer) {
		var input = bufferToString(buffer);
		var output = '';
		for (var i = 0; i < input.length; i++) {
			output += this._encodeCharacter(input.charCodeAt(i));
		}
		return bufferFrom(output);
	}

	_decode(buffer) {
		// TODO: 
		// - search for the beginning of prefix
		// - select the whole entity
		//   - Unicode is always 4 hex characters long
		//   - UnicodeEscaped doesnt have postfix, length is variable. it's nearly impossible to detect end properly.
		//    Probably should be looking for any non-hex character.
		//   - other encoders end with ;
		// - strip the entity, turn back into character, decode into utf8 hex value
		// - slice preceding text and add among other chunks
		// - add decoded character (from entity) into chunks
		// - look for next entity in text and repeat
		/*
  // not actually working, dry coded idea of what decoder should look like
  var chunks = []
  var input = bufferToString(buffer)
  var prefixIndex
  while (prefixIndex = input.indexOf(this.constructor.prefix)) {
  	var beforeEntity = input.slice(0, prefixIndex)
  	chunks.push(bufferFrom(beforeEntity))
  	var entityEndIndex = ???? //TODO
  	var entity = input.slice(prefixIndex, entityEndIndex)
  	var char = this._decodeEntity(entity)
  	chunks.push(bufferFrom(char))
  	input = input.slice(entityEndIndex)
  }
  return Buffer.concat(chunks)
  */
	}
	_decodeEntity(entity) {
		return String.fromCharCode(parseInt(this._parseEntity(entity)));
	}

}

// TODO: decode
// Encodes every character into notation
class NcrDec extends EntityEncoding {
	_encodeCharacter(char) {
		return `&#${char};`;
	}
	_parseEntity(entity) {
		return entity.slice(2, -1);
	}
}

// TODO: decode
// Encodes every character into notation
NcrDec.prefix = '';
class NcrHex extends EntityEncoding {
	_encodeCharacter(char) {
		return `&#x${char.toString(16)};`;
	}
	_parseEntity(entity) {
		return entity.slice(3, -1);
	}
}

// TODO: decode
// Encodes every character into notation
NcrHex.prefix = '';
class UnicodeEscaped extends EntityEncoding {
	_encodeCharacter(char) {
		return `\\u${char.toString(16)}`;
	}
	_parseEntity(entity) {
		return entity.slice(2);
	}
}

// TODO: decode
// Encodes every character into notation
UnicodeEscaped.prefix = '';
class Unicode extends EntityEncoding {
	_encodeCharacter(char) {
		return `U+${char.toString(16).toUpperCase().padStart(4, '0')}`;
	}
	_parseEntity(entity) {
		return entity.slice(2);
	}
}

// TODO:
// </div> => %3C%2Fdiv%3E
Unicode.prefix = '';
class Percent extends EntityEncoding {}

// TODO:
// </div> => &lt;/div&gt;
class HtmlEscaper extends EntityEncoding {}

function getEncodingConstructor(encoding) {
	switch (encoding) {
		case 'utf-8':
		case 'utf8':
			return Utf8$1;
		case 'base64':
			return Base64;
		case 'hex':
			return Hex;
		case 'dec':
			return Dec;
		case 'oct':
			return Oct;
		case 'bin':
			return Bin;
	}
}

function createEncoding(encoding) {
	return new getEncodingConstructor(encoding);
}

function encode(data, encoding, separator) {
	return getEncodingConstructor(encoding).encode(data, separator);
}

function decode(data, encoding, separator) {
	return getEncodingConstructor(encoding).decode(data, separator);
}

function toString(data, encoding) {
	return getEncodingConstructor(encoding).toString(data);
}
function fromString(data, encoding) {
	return getEncodingConstructor(encoding).fromString(data);
}

function finalizeEncoding$1(buffer, encoding) {
	var Encoder = getEncodingConstructor(encoding);
	if (Encoder) return Encoder.toString(buffer);else return buffer;
}

var _encodings = Object.freeze({
	createEncoding: createEncoding,
	encode: encode,
	decode: decode,
	toString: toString,
	fromString: fromString,
	finalizeEncoding: finalizeEncoding$1,
	Utf8: Utf8$1,
	utf8: utf8,
	Base64: Base64,
	base64: base64,
	NumericEncoding: NumericEncoding,
	Bin: Bin,
	Oct: Oct,
	Dec: Dec,
	Hex: Hex,
	Num: Num,
	EntityEncoding: EntityEncoding,
	NcrDec: NcrDec,
	NcrHex: NcrHex,
	UnicodeEscaped: UnicodeEscaped,
	Unicode: Unicode,
	Percent: Percent,
	HtmlEscaper: HtmlEscaper
});

function bitReversal(x, n) {
	var b = 0;
	while (--n >= 0) {
		b <<= 1;
		b |= x & 1;
		x >>>= 1;
	}
	return b;
}

// Base class for all inheriting checksum classes.
// Defines basic set of methods each class should have.
class SombraChecksum extends SombraTransform {

	// All checksums start with 0.
	_init(arg) {
		//console.log('shared._init()', arg)
		this.value = 0;
	}

	// TODO: should this be moved to parent class?


	// TODO: work this into .encode() and .convert() in parent class
	static toString(buffer, arg) {
		return finalizeEncoding$1(this.encode(buffer, arg), 'hex');
	}

	// todo, figure out naming conventions. hash/convert
	static hash(string, arg) {
		var buffer = bufferFrom(string);
		buffer = this.encode(buffer, arg);
		return bufferToString(buffer, 'hex');
	}

}

// Base class for simple checksum classes.
SombraChecksum.defaultEncoding = 'hex';
class SombraSimpleChecksum extends SombraChecksum {

	// All simple checksums start with 0.
	_init(arg) {
		//console.log('shared._init()', arg)
		this.value = 0;
	}

	// Takes one optional argument size (width of bits).
	// 8 by default => returns 1 byte buffer
	// 16 => returns 2 byte buffer
	// 32 => returns 4 byte buffer
}

SombraSimpleChecksum.args = [{
	title: 'Bit size',
	default: 8
}];
class Sum extends SombraSimpleChecksum {

	_update(buffer) {
		for (var i = 0; i < buffer.length; i++) this.value += buffer[i];
	}

	_digest(size) {
		return bufferFromInt(this.value % 2 ** size, size / 8);
	}

}

class Xor extends SombraSimpleChecksum {

	_update(buffer) {
		for (var i = 0; i < buffer.length; i++) this.value ^= buffer[i];
	}

	_digest(size) {
		return bufferFromInt(this.value % 2 ** size, size / 8);
	}

}

class TwosComplement extends SombraSimpleChecksum {

	_update(buffer, size) {
		var value = this.value;
		for (var i = 0; i < buffer.length; i++) value = value + buffer[i] & 2 ** size - 1;
		this.value = value;
	}

	_digest(size) {
		return bufferFromInt(2 ** size - this.value, size / 8);
	}

}

// Base class with implementation of CRC checking and lookup table creation.
// http://www.sunshine2k.de/articles/coding/crc/understanding_crc.html
// http://reveng.sourceforge.net/crc-catalogue/all.htm
class SombraCrcChecksum extends SombraChecksum {

	// CRC parameters:
	// normal or polynomial - 
	// init value - what the crc starts with, usually 0 or 1s
	// input reflection - each input byte is bitwise reversed (0x82 = 10000010 => 01000001 = 0x41)
	// result reflection - result is bitwise reversed
	// out xor - what to xor the result with before returning it

	// There is variety of CRC algorithms and each has a different init values, lookup table, xor output
	_init(variantName) {
		//console.log('crc._init', variantName)
		var variant = this.constructor.variants[variantName];
		// Normal form is bit-reverse of Polynomial form.
		// normal     = 0x04C11DB7 = 00000100110000010001110110110111
		// polynomial = 0xEDB88320 = 11101101101110001000001100100000
		if (variant.poly === undefined) variant.poly = bitReversal(variant.normal, variant.size);
		// Generate lookup table on the fly for the CRC variant in use.
		if (variant.table === undefined) variant.table = this.constructor.createTable(variant.poly);
		this.variant = variant;
		// CRC can have predefined initial value. Usually 0 or 1s
		this.value = variant.init;
	}

	// Each byte has to be xored against current (or initial) value
	_update(buffer) {
		//console.log('crc32._update')
		// Most of the CRC (sub)algorithms have their own lookup tables.
		var value = this.value;
		var { table, inputReflected } = this.variant;
		for (var i = 0; i < buffer.length; i++) {
			let byte = buffer[i];
			if (inputReflected) byte = bitReversal(byte, 8);
			value = table[(value ^ byte) & 0xFF] ^ value >>> 8;
		}
		this.value = value;
	}

	// Finalizes the execution by xoring current value with variant's final xor value.
	_digest() {
		//console.log('crc32._digest')
		var value = this.value;
		if (this.variant.resultReflected) this.value = bitReversal(this.value, size);
		// Crc value is always XORed at the output. It's usually same as init value. 
		value ^= this.variant.xorOut;
		// Bitwise shift ensures 32b number
		value = value >>> 0;
		// Convert the int number into buffer.
		return bufferFromInt(value, this.variant.size / 8);
	}

	// Generates CRC lookup table for given polynomial (every CRC algorithm has different)
	static createTable(poly) {
		var table = new Array(256);
		var c;
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) {
				c = c & 1 ? poly ^ c >>> 1 : c >>> 1;
			}
			table[n] = c;
		}
		return table;
	}

}

class Crc32 extends SombraCrcChecksum {}

Crc32.args = [{
	title: 'Algorithm',
	default: 'crc32'
}];
Crc32.size = 32;
Crc32.variants = {
	['crc32']: { size: 32, normal: 0x04C11DB7, init: 0xFFFFFFFF, xorOut: 0xFFFFFFFF // CRC-32
	} };
class Crc16 extends SombraCrcChecksum {}
Crc16.args = [{
	title: 'Algorithm',
	default: 'crc16'
}];
Crc16.size = 16;
Crc16.variants = {
	['crc16']: { size: 16, normal: 0x8005, init: 0x0000, xorOut: 0x0000, inputReflected: false, resultReflected: false } // CRC-16
	// TODO
	//['crc16-modbus']: {size: 16, normal: 0x8005, init: 0xffff, xorOut: 0x0000, inputReflected: true,  resultReflected: true}, // CRC-16 (Modbus)
	//['crc16-xmodem']: {size: 16, normal: 0x1021, init: 0x0000, xorOut: 0x0000, inputReflected: false, resultReflected: false}, // CRC-CCITT (XModem)
	//['crc16-sick']:   {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-16 (Sick)
	//['crc16-0xffff']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (0xFFFF)
	//['crc16-0x1d0f']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (0x1D0F)
	//['crc16-kermit']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (Kermit)
	//['crc16-dnp']:    {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (Kermit)
};

var _checksums = Object.freeze({
	Sum: Sum,
	Xor: Xor,
	TwosComplement: TwosComplement,
	Crc32: Crc32,
	Crc16: Crc16
});

var Hash = nodeCrypto ? nodeCrypto.Hash : class Hash extends Transform {

	// TODO: Remove this class after fully migrating functionality to SombraTransform.
	//       Then migrate to it and make sure .encode() works properly.

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// todo
		var hashed = this.__chunks;
		if (encoding) {}
		return finalizeEncoding(buffer, encoding);
	}

	// Updates the hash content with the given data, the encoding of which is given in inputEncoding and
	// can be 'utf8', 'ascii' or 'latin1'. If encoding is not provided, and the data is a string,
	// an encoding of 'utf8' is enforced. If data is a Buffer, TypedArray, or DataView, then inputEncoding is ignored.
	update(chunk, inputEncoding) {
		// todo
		if (inputEncoding) chunk = bufferFrom(chunk, inputEncoding);
		this.__chunks = this.__chunks || [];
		this.__chunks.push(chunk);
	}

};

class SombraHash extends Hash {

	static get chars() {
		return this.size / 4;
	}

	static get bytes() {
		return this.size / 8;
	}

	static validate(data) {
		if (typeof data === 'string') {
			return data.match(/[^A-Fa-f0-9]/) === null && data.length === this.chars;
		} else {
			return data.length === this.bytes;
		}
	}

	encode(buffer) {
		return this.constructor.encode(buffer);
	}

	static async hash(string) {
		var buffer = Utf8$1.decode(string);
		buffer = await this.encode(buffer);
		return Hex.toString(buffer);
	}

}

var Sha;

if (platform.node) {

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			// TODO
			return nodeCrypto.createHash(this.nameNode).update(buffer).digest();
		}

	};
} else if (platform.uwp) {

	let { Cryptography } = Windows.Security;
	let { CryptographicBuffer } = Cryptography;
	let { HashAlgorithmProvider, HashAlgorithmNames } = Cryptography.Core;

	let providers = {
		md5: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.md5),
		sha1: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha1),
		sha256: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha256),
		sha384: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha384),
		sha512: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha512)
	};

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			var provider = providers[this.name];
			var iBuffer = CryptographicBuffer.createFromByteArray(buffer);
			var iBufferHashed = provider.hashData(iBuffer);
			return new Uint8Array(iBufferHashed);
		}

	};
} else {

	const WEBNAMES = {
		sha1: 'SHA-1',
		sha256: 'SHA-256',
		sha384: 'SHA-384',
		sha512: 'SHA-512'
	};

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			var algorithm = WEBNAMES[this.nameNode];
			var arrayBuffer = await webCrypto.subtle.digest(algorithm, buffer);
			return new Uint8Array(arrayBuffer);
		}

	};
}

class Sha1 extends Sha {
	constructor(options) {
		super('sha1', options);
	}
}

Sha1.nameNode = 'sha1';
Sha1.size = 160;
class Sha256 extends Sha {
	constructor(options) {
		super('sha256', options);
	}
}

Sha256.nameNode = 'sha256';
Sha256.size = 256;
class Sha384 extends Sha {
	constructor(options) {
		super('sha384', options);
	}
}

Sha384.nameNode = 'sha384';
Sha384.size = 384;
class Sha512 extends Sha {
	constructor(options) {
		super('sha512', options);
	}
}

Sha512.nameNode = 'sha512';
Sha512.size = 512;
class Md5 extends Sha {
	constructor(options) {
		super('md5', options);
	}
}

Md5.nameNode = 'md5';
Md5.size = 128;
var sha1 = Sha1.hash.bind(Sha1);
var sha256 = Sha256.hash.bind(Sha256);
var sha384 = Sha384.hash.bind(Sha384);
var sha512 = Sha512.hash.bind(Sha512);
var md5 = Md5.hash.bind(Md5);

function getHashConstructor(name) {
	switch (name) {
		case 'sha1':
			return Sha1;
		case 'sha256':
			return Sha256;
		case 'sha384':
			return Sha384;
		case 'sha512':
			return Sha512;
		case 'md5':
			return Md5;
	}
}

// node style crypto.createHash('sha256')
function createHash(name) {
	var Class = getHashConstructor(name);
	return new Class();
}

function hash(data, name, encoding = 'hex') {
	return getHashConstructor(name).hash(data, encoding);
}

var _hashes = Object.freeze({
	SombraHash: SombraHash,
	Sha1: Sha1,
	Sha256: Sha256,
	Sha384: Sha384,
	Sha512: Sha512,
	Md5: Md5,
	sha1: sha1,
	sha256: sha256,
	sha384: sha384,
	sha512: sha512,
	md5: md5,
	createHash: createHash,
	hash: hash
});

function shiftCharCode(code, key, shiftBy) {
	// shift
	var temp = code - shiftBy + key;
	if (temp < 0) temp += 26;
	// get character back into the a-z range of 26
	return temp % 26 + shiftBy;
	//return String.fromCharCode(temp % 26 + shiftBy)
}

class Clock extends SombraTransform {

	// TODO: FIX LOWER CASE
	//static encode(buffer, separator = ':') {
	//	return this.encodePipe(buffer, separator = ':').join(separator)
	//}
	static _encode(buffer, separator) {
		return Array.from(buffer).map(code => {
			// handle uppercase
			if (code >= 65 && code <= 90) code += 32;
			if (code === 97) return 'AM';
			if (code === 122) return 'PM';
			if (code === 32) return '00';
			if (code == 32 || code >= 97 && code <= 122) {
				return code - 97 + '';
			} else {
				throw new Error(`Sombra.clock cipher: invalid character '${String.fromCharCode(code)}' (${code})`);
			}
		}).filter(str => str) // remove invalid (undefined after mapping) characters
		.join(separator);
	}

	static _decode(buffer, separator) {
		var decodedBuffer = Utf8.toString(buffer).toUpperCase().split(separator).filter(str => str.length) // remove empty spaces between ::
		.map(str => {
			if (str === 'AM') str = 0;
			if (str === 'PM') str = 25;
			if (str === '00') str = -65;
			return parseInt(str) + 97;
		});
		return String.fromCharCode(...decodedBuffer);
	}

}

// Work in progress
//var memoizedCodes = {}
Clock.args = [{
	title: 'Separator',
	type: 'string',
	default: ':'
}];
class xor extends SombraTransform {

	static encode(buffer, key = 0 /*, skipCodesString*/) {
		// stejne neresi diakritiku
		//var skipCodes = memoizedCodes[memoizedCodes]
		//if (!skipCodes) skipCodes = memoizedCodes[memoizedCodes] = Utf8.fromString(skipCodesString)
		//console.log('XOR', buffer, key, skipCodes)
		return Array.from(buffer).map(code => skipCodes.includes(code) ? code : code ^ key);
	}

	static decode(buffer, key = 0) {
		return this.encode(buffer, key);
	}

}

// AKA ROT-n
xor.args = [{
	title: 'Key',
	type: 'number',
	min: 0,
	max: 26,
	default: 23
	//}, {
	//	title: 'Skip characters',
	//	type: 'string',
	//	default: ' .'
}];
class Caesar extends SombraTransform {

	_encode(chunk, key) {
		var encoded = bufferAlloc(chunk.length);
		for (var i = 0; i < chunk.length; i++) encoded[i] = this._encodeCharacter(chunk[i], key);
		return encoded;
	}
	_encodeCharacter(code, key) {
		if (code >= 65 && code <= 90) return shiftCharCode(code, key, 65); // upper case
		else if (code >= 97 && code <= 122) return shiftCharCode(code, key, 97); // lower case
			else return code;
	}

	// TODO
	static decode(buffer, key) {
		return this.encode(buffer, -key);
	}

}

// Reverses alphabet
Caesar.destructive = false;
Caesar.args = [{
	title: 'Key',
	type: 'number',
	min: 0,
	max: 26,
	default: 23
}];
class Atbash extends SombraTransform {

	_encode(chunk) {
		var encoded = bufferAlloc(chunk.length);
		for (var i = 0; i < chunk.length; i++) encoded[i] = this._encodeCharacter(chunk[i]);
		return encoded;
	}
	_encodeCharacter(code) {
		if (code >= 65 && code <= 90) return Math.abs(code - 65 - 25) + 65;else if (code >= 97 && code <= 122) return Math.abs(code - 97 - 25) + 97;else return code;
	}

	_decode(buffer) {
		var encoded = bufferAlloc(buffer.length);
		for (var i = 0; i < buffer.length; i++) encoded[i] = this._decodeCharacter(buffer[i]);
		return encoded;
	}
	_decodeCharacter(code) {
		if (code >= 65 && code <= 90) return Math.abs(code - 65 - 25) + 65;else if (code >= 97 && code <= 122) return Math.abs(code - 97 - 25) + 97;else return code;
	}

	// TODO: decoder

}

// AKA Caesar shift with key 13
class rot13 extends SombraTransform {}

// Maps a-z to 1-26
// Note: only works on words. Will not work meaningfuly with exotic strings like 'cdF0§)ú.g9-ř;°á´$*6☢'
// Work in progress, do not use
// TODO: Finish

rot13.encode = (buffer, key) => Caesar.encode(buffer, 13);

rot13.decode = (buffer, key) => Caesar.encode(buffer, 13);

class A1z26 extends SombraTransform {

	// TODO: make it streamable so we don't break it in middle of a word

	_encode(chunk, separator) {
		var encoded = bufferAlloc(chunk.length);
		var characters = Array.from(chunk)
		// TODO: split into words and only encode those
		.map(code => this._encodeCharacter(code)).join(separator);
		console.log(bufferFrom(characters).toString());
		return bufferFrom(characters);
	}
	_encodeCharacter(code) {
		if (code >= 65 && code <= 90) return code - 64; // upper case
		else if (code >= 97 && code <= 122) return code - 96; // lower case
			else return code;
	}

}

// Like casear, but
A1z26.destructive = true;
A1z26.args = [{
	title: 'Spacer',
	type: 'string',
	default: '-'
}];
class vigenere extends SombraTransform {

	static encode(buffer, key) {}

	static decode(buffer, key) {}

}

// IDEA: builtin diacritics sanitizer?
vigenere.destructive = true;
vigenere.args = [{
	title: 'Key',
	type: 'string',
	default: ''
}];
class Morse extends SombraTransform {

	_encode(buffer, throwErrors, short, long, space, separator) {
		var { alphabet, codes } = this.constructor;
		var string = bufferToString(buffer).toLowerCase().split('').map(char => {
			if (char === ' ') return space;
			var index = alphabet.indexOf(char);
			if (index === -1 && throwErrors) throw new Error(`Invalid character: '${char}'`);
			return codes[index];
		}).filter(char => char && char.length > 0).join(separator);
		return bufferFrom(string);
	}

	static decode(buffer) {
		return this.prototype._decode(buffer, ...this.args.map(o => o.default));
	}
	_decode(buffer, throwErrors, short, long, space, separator) {
		var { alphabet, codes } = this.constructor;
		var string = bufferToString(buffer).split(separator).map(entity => {
			if (entity === space) return ' ';
			var index = codes.indexOf(entity);
			if (index === -1 && throwErrors) throw new Error(`Invalid code: '${entity}'`);
			return alphabet[index];
		}).join('');
		return bufferFrom(string);
	}

}
Morse.destructive = true;
Morse.args = [{
	title: 'Throw errors',
	name: 'throwErrors',
	default: true
}, {
	title: 'Short',
	name: 'short',
	default: '.'
}, {
	title: 'Long',
	name: 'long',
	default: '-'
}, {
	title: 'Space',
	name: 'space',
	default: '/'
}, {
	title: 'Separator',
	name: 'separator',
	default: ' '
}];
Morse.alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789.,?-=:;()/"$\'_@!!+~#&\näáåéñöü';
Morse.codes = [
// abcdefghijklmnopqrstuvwxyz
'.-', '-...', '-.-.', '-..', '.', '..-.', '--.', '....', '..', '.---', '-.-', '.-..', '--', '-.', '---', '.--.', '--.-', '.-.', '...', '-', '..-', '...-', '.--', '-..-', '-.--', '--..',
// 0123456789
'-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.',
// .,?-=:;()/"$\'_@!!+~#&\n
'.-.-.-', '--..--', '..--..', '-....-', '-...-', '---...', '-.-.-.', '-.--.', '-.--.-', '-..-.', '.-..-.', '...-..-', '.----.', '..--.-', '.--.-.', '---.', '-.-.--', '.-.-.', '.-...', '...-.-', '.-...', '.-.-..',
// äáåéñöü
'.-.-', '.--.-', '.--.-', '..-..', '--.--', '---.', '..--'];

var _ciphers = Object.freeze({
	Clock: Clock,
	xor: xor,
	Caesar: Caesar,
	Atbash: Atbash,
	rot13: rot13,
	A1z26: A1z26,
	vigenere: vigenere,
	Morse: Morse
});

var encodings = Object.assign({}, _encodings);
var checksums = Object.assign({}, _checksums);
var hashes = Object.assign({}, _hashes);
var ciphers = Object.assign({}, _ciphers);

// making groups iterable
encodings[Symbol.iterator] = iterator;
checksums[Symbol.iterator] = iterator;
hashes[Symbol.iterator] = iterator;
ciphers[Symbol.iterator] = iterator;

var _default$1 = Object.freeze({
	util: util,
	encodings: encodings,
	checksums: checksums,
	hashes: hashes,
	ciphers: ciphers,
	createEncoding: createEncoding,
	encode: encode,
	decode: decode,
	toString: toString,
	fromString: fromString,
	finalizeEncoding: finalizeEncoding$1,
	Utf8: Utf8$1,
	utf8: utf8,
	Base64: Base64,
	base64: base64,
	NumericEncoding: NumericEncoding,
	Bin: Bin,
	Oct: Oct,
	Dec: Dec,
	Hex: Hex,
	Num: Num,
	EntityEncoding: EntityEncoding,
	NcrDec: NcrDec,
	NcrHex: NcrHex,
	UnicodeEscaped: UnicodeEscaped,
	Unicode: Unicode,
	Percent: Percent,
	HtmlEscaper: HtmlEscaper,
	Sum: Sum,
	Xor: Xor,
	TwosComplement: TwosComplement,
	Crc32: Crc32,
	Crc16: Crc16,
	SombraHash: SombraHash,
	Sha1: Sha1,
	Sha256: Sha256,
	Sha384: Sha384,
	Sha512: Sha512,
	Md5: Md5,
	sha1: sha1,
	sha256: sha256,
	sha384: sha384,
	sha512: sha512,
	md5: md5,
	createHash: createHash,
	hash: hash,
	Clock: Clock,
	xor: xor,
	Caesar: Caesar,
	Atbash: Atbash,
	rot13: rot13,
	A1z26: A1z26,
	vigenere: vigenere,
	Morse: Morse
});

exports['default'] = _default$1;
exports.util = util;
exports.encodings = encodings;
exports.checksums = checksums;
exports.hashes = hashes;
exports.ciphers = ciphers;
exports.createEncoding = createEncoding;
exports.encode = encode;
exports.decode = decode;
exports.toString = toString;
exports.fromString = fromString;
exports.finalizeEncoding = finalizeEncoding$1;
exports.Utf8 = Utf8$1;
exports.utf8 = utf8;
exports.Base64 = Base64;
exports.base64 = base64;
exports.NumericEncoding = NumericEncoding;
exports.Bin = Bin;
exports.Oct = Oct;
exports.Dec = Dec;
exports.Hex = Hex;
exports.Num = Num;
exports.EntityEncoding = EntityEncoding;
exports.NcrDec = NcrDec;
exports.NcrHex = NcrHex;
exports.UnicodeEscaped = UnicodeEscaped;
exports.Unicode = Unicode;
exports.Percent = Percent;
exports.HtmlEscaper = HtmlEscaper;
exports.Sum = Sum;
exports.Xor = Xor;
exports.TwosComplement = TwosComplement;
exports.Crc32 = Crc32;
exports.Crc16 = Crc16;
exports.SombraHash = SombraHash;
exports.Sha1 = Sha1;
exports.Sha256 = Sha256;
exports.Sha384 = Sha384;
exports.Sha512 = Sha512;
exports.Md5 = Md5;
exports.sha1 = sha1;
exports.sha256 = sha256;
exports.sha384 = sha384;
exports.sha512 = sha512;
exports.md5 = md5;
exports.createHash = createHash;
exports.hash = hash;
exports.Clock = Clock;
exports.xor = xor;
exports.Caesar = Caesar;
exports.Atbash = Atbash;
exports.rot13 = rot13;
exports.A1z26 = A1z26;
exports.vigenere = vigenere;
exports.Morse = Morse;

Object.defineProperty(exports, '__esModule', { value: true });

})));
