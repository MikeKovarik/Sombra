import {bufferFromUtf8String, bufferToUtf8String, bufferFromBase64String} from './node-builtins.mjs'
import {escapeUtf8, unescapeUtf8, bufferToUtf8EscapedString} from './node-builtins.mjs'
import {bufferFrom} from './node-builtins.mjs'
import {platform, createApiShortcut} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


export class Base64 extends SombraTransform {

	static validate = string => string.match(/^[A-Za-z0-9+/=]*$/) === null

	// Converts buffer into buffer representation of the base64 string.
	// To get the actual string it has go through Utf8 encoder, or Base64.toString should be used.
	// This is because of piping
	// e.g. Buffer.from('ff', 'hex') => Buffer.from('/w==', 'utf8')
	//      <Buffer ff>              => <Buffer 2f 77 3d 3d>
	_encode(chunk) {
		if (platform.node) {
			if (typeof chunk === 'string')
				chunk = bufferFromUtf8String(chunk)
			return chunk.toString('base64')
		} else {
			if (typeof chunk === 'string')
				return btoa(escapeUtf8(chunk))
			else
				return btoa(bufferToUtf8EscapedString(chunk))
		}
	}

	// Reversal of .encode(). Takes in buffer (form of base64 string) and returns buffer.
	_decode(chunk) {
		if (platform.node) {
			if (typeof chunk !== 'string')
				chunk = bufferToUtf8String(chunk)
			return bufferFromBase64String(chunk)
		} else {
			if (typeof chunk === 'string')
				return unescapeUtf8(atob(chunk))
			else
				return unescapeUtf8(atob(bufferToUtf8EscapedString(chunk)))
		}
	}

	_update(chunk) {
		// 3 bytes of data can be encoded into 4 base64 characters (bytes)
		// and vice versa - 4 b64 character are minimum chunk size for decoding.
		var minChunkSize = this.encoder ? 3 : 4
		if (this.lastChunk) {
			chunk = Buffer.concat([this.lastChunk, chunk])
			this.lastChunk = undefined
		}
		var chunkLength = chunk.length
		if (chunkLength < minChunkSize) {
			this.lastChunk = chunk
			return
		} else if (chunkLength > 0) {
			var overflowBytes = chunkLength % minChunkSize
			if (overflowBytes) {
				this.lastChunk = chunk.slice(chunkLength - overflowBytes)
				chunk = chunk.slice(0, chunkLength - overflowBytes)
			}
			return this._convert(chunk)
		}
	}

	_digest() {
		if (this.lastChunk)
			return this._convert(this.lastChunk)
	}

}


export var base64 = createApiShortcut(Base64)