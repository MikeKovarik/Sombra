import {Transform, bufferFrom, bufferToString, bufferConcat} from './node-builtins.mjs'


export class SombraTransform extends Transform {

	constructor(...args) {
		super()

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
		// TODO
		if (this.encode) {
			// TODO
		} else if (this.decode) {
			// TODO
		}

		// Apply defaults to the arguments (if any defaults are defined).
		if (this.constructor.args)
			args = this._preProcessArgs(this.constructor.args, args)
		// Apply Class' args changes, if method for handling them is defined.
		if (this._handleArgs)
			args = this._handleArgs(...args)
		this.args = args
		// Used to store raw chunks for defalt _update/_digest set of functions in algorithms that are not streamable.
		// _update and _digest can be overwritten by inheritor in which case _rawChunks is useless because _update will
		// be encoding each chunk on the fly. 
		this._rawChunks = []
		// Used for .digest/.update to handle returned encoded chunks from _update/_digest.
		this._covertedChunks = []
		if (this._init)
			this._init(...args)
	}

	// default implementation to be overwritten where needed
	_update(chunk/*, ...args*/) {
		console.log('_update')
		this._rawChunks.push(chunk)
	}

	_digest(...args) {
		console.log('_digest')
		// Only proceed if there is something to digest.
		if (this._rawChunks.length === 0)
			return
		// Merge unprocessed chunks.
		var buffer = bufferConcat(this._rawChunks)
		this._rawChunks = []
		// Only return if there is something to digest.
		if (buffer.length)
			return this._encode(buffer, ...args)
	}

	static convertToString(data, ...args) {
		return (new this(...args))
			.update(data)
			.digest(this.defaultEncoding || 'utf8')
	}
	convertToString(data, ...args) {
		return this
			.update(data)
			.digest(this.defaultEncoding || 'utf8')
	}

	static convert(data, ...args) {
		return (new this(...args))
			.update(data)
			.digest()
	}
	convert(data) {
		return this
			.update(data)
			.digest()
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
		// TODO: how to pass the value?
		var converted = this._update(chunk, ...this.args)
		if (converted) {
			if (typeof converted === 'string')
				converted = bufferFrom(converted)
			this._covertedChunks.push(converted)
		}
		return this
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		var converted = this._digest(...this.args)
		if (converted) {
			if (typeof converted === 'string')
				converted = bufferFrom(converted)
			this._covertedChunks.push(converted)
		}
		console.log('this._covertedChunks', this._covertedChunks)
		var result = bufferConcat(this._covertedChunks)
		this._covertedChunks = []
		// Always return buffer unless encoding is specified.
		if (encoding)
			return bufferToString(result, encoding)
		else
			return result
	}

	// Node stream.Transform stream API to enable pipe-ing.

	_transform(chunk, encoding = 'utf8', cb) {
		chunk = bufferFrom(chunk, encoding)
		var returned = this._update(chunk, ...this.args)
		if (returned)
			this.push(returned)
		cb()
	}

	_flush(cb) {
		var returned = this._digest(...this.args)
		if (returned)
			this.push(returned)
		cb()
	}

	// HELPER FUNCTIONS

	_preProcessArgs(defaults, custom) {
		return defaults.map((options, i) => {
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
	}

	static set chars(newVal) {this._chars = newVal}
	static set bytes(newVal) {this._bytes = newVal}
	static set bits(newVal)  {this._bits  = newVal}

	static get chars() {return this._chars || this.size / 4}
	static get bytes() {return this._bytes || this.size / 8}
	static get bits()  {return this._bits  || this.size}

	// TODO: this was temporarily copy-pasted here from subclass. make this work for all classes.
	//static toString(buffer, encoding) {
	//	return toString(this.encode(buffer), encoding)
	//}
/*
	static decodeString(string) {
		return this.decode(bufferFrom(string))
	}
	static encodeString(string) {
		return this.encode(bufferFrom(string))
	}
*/
}
