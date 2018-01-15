import {Transform, bufferFrom} from './node-builtins.mjs'
import {nodeCrypto, webCrypto, platform} from './util.mjs'
import {Utf8, Hex} from './encodings.mjs'


// Imports or shims Node crypto Hash class that's used in crypto.createHash() factory function.
var Hash = nodeCrypto ? nodeCrypto.Hash : class Hash extends Transform {

	// TODO: Remove this class after fully migrating functionality to SombraTransform.
	//       Then migrate to it and make sure .encode() works properly.

	// Calculates the digest of all of the data passed to be hashed (using the .update() method).
	// If encoding is provided a string will be returned; otherwise a Buffer is returned.
	// The encoding can be 'hex', 'latin1' or 'base64'.
	digest(encoding) {
		// todo
		var hashed = this.__chunks
		if (encoding) {}
		return finalizeEncoding(buffer, encoding)
	}

	// Updates the hash content with the given data, the encoding of which is given in inputEncoding and
	// can be 'utf8', 'ascii' or 'latin1'. If encoding is not provided, and the data is a string,
	// an encoding of 'utf8' is enforced. If data is a Buffer, TypedArray, or DataView, then inputEncoding is ignored.
	update(chunk, inputEncoding) {
		// todo
		if (inputEncoding)
			chunk = bufferFrom(chunk, inputEncoding)
		this.__chunks = this.__chunks || []
		this.__chunks.push(chunk)
	}

}


export class SombraHash extends Hash {

	static get chars() {
		return this.size / 4
	}

	static get bytes() {
		return this.size / 8
	}

	static validate(data) {
		if (typeof data === 'string') {
			return data.match(/[^A-Fa-f0-9]/) === null
				&& data.length === this.chars
		} else {
			return data.length === this.bytes
		}
	}

	encode(buffer) {
		return this.constructor.encode(buffer)
	}

	static async hash(string) {
		var buffer = Utf8.decode(string)
		buffer = await this.encode(buffer)
		return Hex.toString(buffer)
	}

}


var Sha

if (platform.node) {

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			// TODO
			return nodeCrypto.createHash(this.nameNode).update(buffer).digest()
		}

	}

} else if (platform.uwp) {

	let {Cryptography} = Windows.Security
	let {CryptographicBuffer} = Cryptography
	let {HashAlgorithmProvider, HashAlgorithmNames} = Cryptography.Core

	let providers = {
		md5:    HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.md5),
		sha1:   HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha1),
		sha256: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha256),
		sha384: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha384),
		sha512: HashAlgorithmProvider.openAlgorithm(HashAlgorithmNames.sha512),
	}

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			var provider = providers[this.name]
			var iBuffer = CryptographicBuffer.createFromByteArray(buffer)
			var iBufferHashed = provider.hashData(iBuffer)
			return new Uint8Array(iBufferHashed)
		}

	}

} else {

	const WEBNAMES = {
		sha1:   'SHA-1',
		sha256: 'SHA-256',
		sha384: 'SHA-384',
		sha512: 'SHA-512',
	}

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			var algorithm = WEBNAMES[this.nameNode]
			var arrayBuffer = await webCrypto.subtle.digest(algorithm, buffer)
			return new Uint8Array(arrayBuffer)
		}

	}

}


export class Sha1 extends Sha {
	constructor(options) {super('sha1', options)}
	static nameNode = 'sha1'
	static size = 160
}

export class Sha256 extends Sha {
	constructor(options) {super('sha256', options)}
	static nameNode = 'sha256'
	static size = 256
}

export class Sha384 extends Sha {
	constructor(options) {super('sha384', options)}
	static nameNode = 'sha384'
	static size = 384
}

export class Sha512 extends Sha {
	constructor(options) {super('sha512', options)}
	static nameNode = 'sha512'
	static size = 512
}

export class Md5 extends Sha {
	constructor(options) {super('md5', options)}
	static nameNode = 'md5'
	static size = 128
}


export var sha1   = Sha1.hash.bind(Sha1)
export var sha256 = Sha256.hash.bind(Sha256)
export var sha384 = Sha384.hash.bind(Sha384)
export var sha512 = Sha512.hash.bind(Sha512)
export var md5    = Md5.hash.bind(Md5)


function getHashConstructor(name) {
	switch (name) {
		case 'sha1':   return Sha1
		case 'sha256': return Sha256
		case 'sha384': return Sha384
		case 'sha512': return Sha512
		case 'md5':    return Md5
	}
}

// node style crypto.createHash('sha256')
export function createHash(name) {
	var Class = getHashConstructor(name)
	return new Class
}

export function hash(data, name, encoding = 'hex') {
	return getHashConstructor(name).hash(data, encoding)
}
