import {Transform} from './util/node-builtins.mjs'
import {nodeCrypto, webCrypto, platform, createApiShortcut} from './util/util.mjs'
import {bufferFrom, bufferFromString, bufferToString} from './util/buffer.mjs'
import {Hex, hex} from './encodings/numeric.mjs'


// TODO: extend from SombraTransform so everything works
//       - do not just copy paste methods, but apply descriptors (due to getters/setters)

// Imports or shims Node crypto Hash class that's used in crypto.createHash() factory function.
var Hash = nodeCrypto ? nodeCrypto.Hash : class Hash extends Transform {

	// TODO: Remove this class after fully migrating functionality to SombraTransform.
	//       Then migrate to it and make sure .encode() works properly.

}

// TODO
//Object.getOwnPropertyDescriptors(SombraTransform)
//Object.getOwnPropertyDescriptors(SombraTransform.prototype)


export class SombraHash extends Hash {

	defaultEncoding = 'hex'

	static validate(data) {
		if (typeof data === 'string') {
			return data.match(/[^A-Fa-f0-9]/) === null
				&& data.length === this.chars
		} else {
			return data.length === this.bytes
		}
	}

}


export var Sha

if (platform.node) {

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			// TODO
			var nameNode = this.name.toLowerCase()
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

	let WEBNAMES = {
		sha1:   'SHA-1',
		sha256: 'SHA-256',
		sha384: 'SHA-384',
		sha512: 'SHA-512',
	}

	Sha = class Sha extends SombraHash {

		static async encode(buffer) {
			var webName = WEBNAMES[this.name.toLowerCase()]
			var arrayBuffer = await webCrypto.subtle.digest(webName, buffer)
			return new Uint8Array(arrayBuffer)
		}

	}

}


export class Sha1 extends Sha {
	static size = 160
}

export class Sha256 extends Sha {
	static size = 256
}

export class Sha384 extends Sha {
	static size = 384
}

export class Sha512 extends Sha {
	static size = 512
}

export class Md5 extends Sha {
	static size = 128
}


// TODO: extend from SombraTransform so everything works
//export var sha1   = createApiShortcut(Sha1)
//export var sha256 = createApiShortcut(Sha256)
//export var sha384 = createApiShortcut(Sha384)
//export var sha512 = createApiShortcut(Sha512)
//export var md5    = createApiShortcut(Md5)
// TODO: fixme
// for now using this
export var sha1   = async arg => {
	var buffer = bufferFrom(arg)
	var encodedBuffer = await Sha1.encode(buffer)
	return hex(encodedBuffer)
}
//export var sha1   = arg => (Sha1.encode(arg))
export var sha256 = {}
export var sha384 = {}
export var sha512 = {}
export var md5    = {}


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
	//return new Class
	return Class
}

export function hash(data, name, encoding = 'hex') {
	return getHashConstructor(name).hash(data, encoding)
}
