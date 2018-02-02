import {Transform} from './node-builtins.mjs'
import {bufferFrom, bufferToString, bufferConcat} from './util-buffer.mjs'


// TODO: take another stab at making the core functionality state-less so _encode() and _decode()
//       can be called from static methods without having to instantiate. Options object is already
//       being passed through argument. Next could be 'lastValue' with so-far transformed chunks (or
//       current value in case of checksums) and 'state' for passing things like 'lastChunk' that would
//       otherwise end up in instance as this.lastChunk
export class SombraTransform extends Transform {

	constructor(options) {
		super()
		// Apply user's options and class' default options.
		var defaultOptions = {}
		var Super = this.constructor
		for (var key in Super)
			if (typeof Super[key] !== 'function')
				defaultOptions[key] = Super[key]
		Object.assign(this, defaultOptions, options)
		this.encoder = !this.decoder
		this.decoder = !this.encoder
		// Used to store raw chunks for defalt _update/_digest set of functions in algorithms that are not streamable.
		// _update and _digest can be overwritten by inheritor in which case _rawChunks is useless because _update will
		// be encoding each chunk on the fly. 
		this._rawChunks = []
		// Used for .digest/.update to handle returned encoded chunks from _update/_digest.
		this._covertedChunks = []
	}

	// default implementation to be overwritten where needed
	_update(chunk, options) {
		if (this.staggered) {
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
			return this._convert(chunk, options)
		}
	}

	_digest(options) {
		// Only proceed if there is something to digest.
		if (this._rawChunks.length === 0)
			return
		// Merge unprocessed chunks.
		var buffer = bufferConcat(this._rawChunks)
		this._rawChunks = []
		// Only return if there is something to digest.
		if (buffer.length)
			return this._convert(buffer, options)
	}

	_convert(buffer, options) {
		if (this.decoder)
			return this._decode(buffer, options)
		else
			return this._encode(buffer, options)
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
		this._covertedChunks.push(this._update(chunk, this))
		// Maintain chaniability.
		return this
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		//console.log('digest')
		// Call underlying digest function and add the result to other chunks.
		try {
		this._covertedChunks.push(this._digest(this))
	} catch(err) {console.error(err)}
		// Merge all previously collected chunks into single buffer.
		//console.log('this._covertedChunks', this._covertedChunks)
		var chunks = this._covertedChunks
			.filter(chunk => chunk)
			.map(chunk => bufferFrom(chunk))
		//console.log('chunks', chunks)
		this._covertedChunks = []
		var result = bufferConcat(chunks)
		//console.log('result', result)
		// Always return buffer unless encoding is specified.
		if (encoding)
			return bufferToString(result, encoding)
		else
			return result
	}

	// Node stream.Transform stream API to enable pipe-ing.

	_transform(chunk, encoding = 'utf8', cb) {
		chunk = bufferFrom(chunk, encoding)
		// Transform the chunk and store it for flush (end of stream).
		this.push(this._update(chunk, this))
		cb()
	}

	_flush(cb) {
		this.push(this._digest(this))
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

	convert(data) {
		return this
			.update(data)
			.digest()
	}
	static convert(data, options) {
		return (new this(options)).convert(data)
	}
	static encode(data, options) {
		options = Object.assign({encoder: true}, options)
		return this.convert(data, options)
	}
	static decode(data, options) {
		options = Object.assign({decoder: true}, options)
		return this.convert(data, options)
	}

	convertToString(data, options) {
		return this
			.update(data)
			.digest(this.defaultEncoding || this.constructor.defaultEncoding || 'utf8')
	}
	static convertToString(data, options) {
		return (new this(options)).convertToString(data)
	}
	static encodeToString(data, options) {
		options = Object.assign({encoder: true}, options)
		return this.convertToString(data, options)
	}
	static decodeToString(data, options) {
		options = Object.assign({decoder: true}, options)
		return this.convertToString(data, options)
	}

}
