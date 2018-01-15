import {Transform, bufferFrom, bufferToString} from './node-builtins.mjs'


export class SombraTransform extends Transform {

	// Shared constructor for update()/digest() and transform stream.

	constructor(...args) {
		super()
		// Apply defaults to the arguments (if any defaults are defined).
		if (this.constructor.args)
			args = this._preProcessArgs(this.constructor.args, args)
		// Apply Class' args changes, if method for handling them is defined.
		if (this._handleArgs)
			args = this._handleArgs(...args)
		this.args = args
		this._rawChunks = []
		this._encodedChunks = []
		if (this._init)
			this._init(...args)
	}

	static convertToString(data, ...args) {
		var instance = new this(...args)
		return instance.update(data).digest(this.defaultEncoding || 'utf8')
	}
	static convert(data, ...args) {
		var instance = new this(...args)
		return instance.update(data).digest()
	}

	// TODO: Get rid of this mess, make it create instance and rely on update/digest
	//       so Hash classes can inherit from this.
	static encode(data, ...args) {
		// Converts potential strings to buffer and makes sure we don't tamper with user's data.
		var buffer = bufferFrom(data)
		// Apply defaults to the arguments (if any defaults are defined).
		if (this.args)
			args = this.prototype._preProcessArgs(this.args, args)
		// Apply Class' args changes, if method for handling them is defined.
		if (this.prototype._handleArgs)
			args = this.prototype._handleArgs(...args)
		// If class defined _encode() method that can do the calculation in one go,
		// then execute it and bypass the update/digest streaming.
		if (this.prototype._encode)
			return this.prototype._encode(buffer, ...args)
		var context = {
			constructor: this,
			prototype: this.prototype,
		}
		if (this.prototype._init)
			this.prototype._init.call(context, ...args)
		var encodedChunks = [
			this.prototype._update.call(context, buffer, ...args), 
			this.prototype._digest.call(context, ...args)
		].filter(a => a)
		//console.log('encodedChunks', encodedChunks)
		//console.log('Buffer.concat(encodedChunks)', Buffer.concat(encodedChunks))
		return Buffer.concat(encodedChunks)
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
		var returned = this._update(chunk, ...this.args)
		if (returned)
			this._encodedChunks.push(returned)
		return this
	}

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// TODO: how to pass the value?
		// TODO: digest has to return the result, but _update is pushing it
		var returned = this._digest(...this.args)
		if (returned)
			this._encodedChunks.push(returned)
		var result = Buffer.concat(this._encodedChunks)
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

	// default implementation to be overwritten where needed
	_update(chunk/*, ...args*/) {
		this._rawChunks.push(chunk)
	}

	_digest(...args) {
		var buffer = Buffer.concat(this._rawChunks)
		return this._encode(buffer, ...args)
	}




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
/*
	// TODO: Figure out how to do Decoder streams
	static decode(buffer) {
		if (this.args)
			return this.prototype._decode(buffer, ...this.args.map(o => o.default))
		else
			return this.prototype._decode(buffer)
	}
*/

	// HELPER FUNCTIONS

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
