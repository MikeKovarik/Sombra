import {Transform, bufferFrom, bufferToString, bufferConcat} from './node-builtins.mjs'


export class SombraTransform extends Transform {

	constructor(options) {
		super()

		// Apply defaults to the arguments (if any defaults are defined).
		/*if (this.constructor.args) {
			this.args = defaults.map((options, i) => {
				var value = custom[i]
				if (value === undefined) {
					value = options.default
				} else {
					if (options.min !== undefined) value = Math.min(options.min, value)
					if (options.max !== undefined) value = Math.max(options.max, value)
					if (options.type === 'number') value = parseFloat(value)
				}
				return value
			})
		}*/


		var defaultOptions = {}
		var Super = this.constructor
		for (var key in Super)
			if (typeof Super[key] !== 'function')
				defaultOptions[key] = Super[key]

		Object.assign(this, defaultOptions, options)

		// TODO
		if (this.continuous) {
			// Endless passthrough stream that converts each chunk as is
			// without slicing or storing it in order to wait for another part.
			// Suitable for binding to text fields.
			// Unsuitable for converting files.
		} else {
			// Sequential processing of possibly chunked but ordered and connected data.
			// Chunks could be further sliced and stored (and their processing delayed)
			// Until next chunk or until the very end of the stream.
			// That is to safely handle e.g. html entities that are split in half in two chunks.
		}

		// Used to store raw chunks for defalt _update/_digest set of functions in algorithms that are not streamable.
		// _update and _digest can be overwritten by inheritor in which case _rawChunks is useless because _update will
		// be encoding each chunk on the fly. 
		this._rawChunks = []
		// Used for .digest/.update to handle returned encoded chunks from _update/_digest.
		this._covertedChunks = []
		if (this._init)
			this._init(options)
	}

	// default implementation to be overwritten where needed
	// TODO: endless/continuous mode
	_update(chunk, options) {
		console.log('_update')
		if (this.continuous)
			return this._convert(chunk, options)
		else
			this._rawChunks.push(chunk)
	}

	// TODO: endless/continuous mode
	_digest(options) {
		console.log('_digest')
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
		if (this.encoder)
			return this._encode(buffer, options)
		else if (this.decoder)
			return this._decode(buffer, options)
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
		var converted = this._update(chunk, this)
		if (converted)
			this._covertedChunks.push(converted)
		// Maintain chaniability.
		return this
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// Call underlying digest function and add the result to other chunks.
		var converted = this._digest(this)
		if (converted)
			this._covertedChunks.push(converted)
		// Merge all previously collected chunks into single buffer.
		var chunks = this._covertedChunks.map(chunk => bufferFrom(chunk))
		this._covertedChunks = []
		var result = bufferConcat(chunks)
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
		var converted = this._update(chunk, this)
		if (converted)
			this.push(converted)
		cb()
	}

	_flush(cb) {
		var converted = this._digest(this)
		if (converted)
			this.push(converted)
		cb()
	}

	// HELPER FUNCTIONS

	static set chars(newVal) {this._chars = newVal}
	static set bytes(newVal) {this._bytes = newVal}
	static set bits(newVal)  {this._bits  = newVal}

	static get chars() {return this._chars || this.size / 4}
	static get bytes() {return this._bytes || this.size / 8}
	static get bits()  {return this._bits  || this.size}


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
			.digest(this.defaultEncoding || 'utf8')
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
