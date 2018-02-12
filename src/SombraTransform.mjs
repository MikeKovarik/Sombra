import {Transform} from './node-builtins.mjs'
import {bufferFrom, bufferToString, bufferConcat} from './util-buffer.mjs'


function getDefaultOptions(Class, includeUnits) {
	var obj = {}
	for (var key in Class)
		if (typeof Class[key] !== 'function')
			obj[key] = Class[key]
	if (includeUnits) {
		obj.bits = Class.bits
		obj.chars = Class.chars
		obj.bytes = Class.bytes
	}
	return obj
}

// TODO: take another stab at making the core functionality state-less so _encode() and _decode()
//       can be called from static methods without having to instantiate. Options object is already
//       being passed through argument. Next could be 'lastValue' with so-far transformed chunks (or
//       current value in case of checksums) and 'state' for passing things like 'lastChunk' that would
//       otherwise end up in instance as this.lastChunk
export class SombraTransform extends Transform {

	constructor(options) {
		super()
		// Apply user's options and class' default options.
		var defaultOptions = getDefaultOptions(this.constructor)
		Object.assign(this, defaultOptions, options)
		this.encoder = !this.decoder
		this.decoder = !this.encoder
		if (this._setup)
			this._setup(this, this)
		if (this.encoder && this._encodeSetup)
			this._encodeSetup(this, this)
		if (this.decoder && this._decodeSetup)
			this._decodeSetup(this, this)
		// Used to store raw chunks for defalt _update/_digest set of functions in algorithms that are not streamable.
		// _update and _digest can be overwritten by inheritor in which case _rawChunks is useless because _update will
		// be encoding each chunk on the fly. 
		this._rawChunks = []
		// Used for .digest/.update to handle returned encoded chunks from _update/_digest.
		this._covertedChunks = []
	}

	_update(chunk) {
		if (this.chunked === false) {
			// Sequential processing of possibly chunked but ordered and connected data.
			// Chunks could be further sliced and stored (and their processing delayed)
			// Until next chunk or until the very end of the stream.
			// That is to safely handle e.g. html entities that are split in half in two chunks.
			this._rawChunks.push(chunk)
		} else {
			// Endless passthrough stream that converts each chunk as is
			// without slicing or storing it in order to wait for another part.
			// Suitable for binding to text fields.
			// Unsuitable for converting files.
			if (this.decoder)
				return this._decode(chunk, this, this)
			else
				return this._encode(chunk, this, this)
		}
	}

	_digest() {
		// Only proceed if there is something to digest.
		if (this._rawChunks.length) {
			// Merge unprocessed chunks.
			var buffer = bufferConcat(this._rawChunks)
			this._rawChunks = []
			// Only return if there is something to digest.
			if (buffer.length) {
				if (this.decoder) {
					var result = this._decode(buffer, this, this)
					if (this._decodeDigest)
						return this._decodeDigest(this, this)
					return result
				} else {
					var result = this._encode(buffer, this, this)
					if (this._encodeDigest)
						return this._encodeDigest(this, this)
					return result
				}
			}
		} else {
			if (this.decoder && this._decodeDigest)
				return this._decodeDigest(this, this)
			else if (this.encoder && this._encodeDigest)
				return this._encodeDigest(this, this)
		}
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
		chunk = bufferFrom(chunk, encoding)
		// Transform the chunk and store it for .digest() (end).
		this._covertedChunks.push(this._update(chunk))
		// Maintain chaniability.
		return this
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// Call underlying digest function and add the result to other chunks.
		this._covertedChunks.push(this._digest())
		// Merge all previously collected chunks into single buffer.
		var chunks = this._covertedChunks
			.filter(chunk => chunk)
			.map(chunk => bufferFrom(chunk))
		this._covertedChunks = []
		var result = bufferConcat(chunks)
		// Always return buffer unless encoding is specified.
		var type = typeof result
		if (encoding && type !== 'string')
			return bufferToString(result, encoding)
		else if (!encoding && type === 'string')
			return bufferFrom(result)
		return result
	}

	// Node stream.Transform stream API to enable pipe-ing.

	_transform(chunk, encoding = 'utf8', cb) {
		chunk = bufferFrom(chunk, encoding)
		// Transform the chunk and store it for flush (end of stream).
		this.push(this._update(chunk))
		cb()
	}

	_flush(cb) {
		this.push(this._digest())
		cb()
	}

	// BITS, BYTES AND CHAR SIZE

	static set bits(val)  {this._bits = val}
	static set chars(val) {this._bits = val * 4}
	static set bytes(val) {this._bits = val * 8}

	set bits(val)  {this._bits = val}
	set chars(val) {this._bits = val * 4}
	set bytes(val) {this._bits = val * 8}

	static get bits()  {return this._bits ? this._bits     : 0}
	static get chars() {return this._bits ? this._bits / 4 : 0}
	static get bytes() {return this._bits ? this._bits / 8 : 0}

	get bits()  {return this._bits ? this._bits     : this.constructor._bits}
	get chars() {return this._bits ? this._bits / 4 : this.constructor._bits}
	get bytes() {return this._bits ? this._bits / 8 : this.constructor._bits}

	// HELPER FUNCTIONS

	convert(data, encoding) {
		return this
			.update(data)
			.digest(encoding)
	}
	convertToString(data) {
		return this
			.update(data)
			.digest(this.defaultEncoding || this.constructor.defaultEncoding)
	}

	// Some algorithms may returns string, some return Buffer due to performance (especially in chaining)
	// .convertRaw() .encodeRaw() and .decodeRaw() directly return that without changing.

	static convertRaw(data, options) {
		if (this.decoder)
			return this.decodeRaw(data, options)
		else
			return this.encodeRaw(data, options)
	}
	static encodeRaw(data, options) {
		options = Object.assign(getDefaultOptions(this, true), options)
		var proto = this.prototype
		var state = {}
		if (proto._setup)
			proto._setup(options, state)
		if (proto._encodeSetup)
			proto._encodeSetup(options, state)
		var result = proto._encode(data, options, state)
		if (proto._encodeDigest)
			return proto._encodeDigest(options, state)
		return result
	}
	static decodeRaw(data, options) {
		options = Object.assign(getDefaultOptions(this, true), options)
		var proto = this.prototype
		var state = {}
		if (proto._setup)
			proto._setup(options, state)
		if (proto._decodeSetup)
			proto._decodeSetup(options, state)
		var result = proto._decode(data, options, state)
		if (proto._decodeDigest)
			return proto._decodeDigest(options, state)
		return result
	}

	// .convert() .encode() and .decode() only return Buffer.

	static convert(data, options) {
		var result = this.convertRaw(data, options)
		if (typeof result === 'string')
			return bufferFrom(result)
		return result
	}
	static encode(data, options) {
		var result = this.encodeRaw(data, options)
		if (typeof result === 'string')
			return bufferFrom(result)
		return result
	}
	static decode(data, options) {
		var result = this.decodeRaw(data, options)
		if (typeof result === 'string')
			return bufferFrom(result)
		return result
	}

	// .convertToString() .encodeToString() and .decodeToString() only return ... well... Boolean apparently.

	static convertToString(data, options = {}) {
		var result = this.convertRaw(data, options)
		if (typeof result !== 'string')
			return bufferToString(result, options.encoding || this.defaultEncoding || 'utf8')
		return result
	}
	static encodeToString(data, options = {}) {
		var result = this.encodeRaw(data, options)
		if (typeof result !== 'string')
			return bufferToString(result, options.encoding || this.defaultEncoding || 'utf8')
		return result
	}
	static decodeToString(data, options = {}) {
		var result = this.decodeRaw(data, options)
		if (typeof result !== 'string')
			return bufferToString(result, options.encoding || this.defaultEncoding || 'utf8')
		return result
	}

}
