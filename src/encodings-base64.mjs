import {bufferFromUtf8, bufferToStringUtf8, bufferFromBase64, bufferToStringBase64, encodeUtf8} from './node-builtins.mjs'
import {bufferFrom} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


export class Base64 extends SombraTransform {

	static validate = string => string.match(/^[A-Za-z0-9+/=]*$/) === null

	// Converts buffer into buffer representation of the base64 string.
	// To get the actual string it has go through Utf8 encoder, or Base64.toString should be used.
	// This is because of piping
	// e.g. Buffer.from('ff', 'hex') => Buffer.from('/w==', 'utf8')
	//      <Buffer ff>              => <Buffer 2f 77 3d 3d>
	_encode(chunk) {
		return bufferFromUtf8(bufferToStringBase64(chunk))
	}

	// Reversal of .encode(). Takes in buffer (form of base64 string) and returns buffer.
	_decode(chunk) {
		if (typeof chunk === 'string')
			return btoa(encodeUtf8(chunk))
		else
			return btoa(String.fromCharCode(...chunk))
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
			return this._encode(chunk)
		}
	}

	_digest() {
		if (this.lastChunk)
			return this._encode(this.lastChunk)
	}

	// Note: every 3 bytes result in 3 characters. transform stream can process divisions of 3 and carry
	// remaining chunks to next computation

}


export var base64 = Base64.toString.bind(Base64)