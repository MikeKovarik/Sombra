import {bufferFromUtf8, bufferToStringUtf8, bufferFromBase64, bufferToStringBase64} from './node-builtins.mjs'
import {bufferFrom} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


export class Base64 extends SombraTransform {

	// TODO: _transform methods for stream
	// TODO: turn this into two transform stream classes (one for decoding, second to encoding)

	static validate = string => string.match(/^[A-Za-z0-9+/=]*$/) === null

	// Converts buffer into buffer representation of the base64 string.
	// To get the actual string it has go through Utf8 encoder, or Base64.toString should be used.
	// This is because of piping
	// e.g. Buffer.from('ff', 'hex') => Buffer.from('/w==', 'utf8')
	//      <Buffer ff>              => <Buffer 2f 77 3d 3d>
	_encode(buffer) {
		return bufferFromUtf8(bufferToStringBase64(buffer))
	}

	// Reversal of .encode(). Takes in buffer (form of base64 string) and returns buffer.
	_decode(buffer) {
		return bufferFromBase64(bufferToStringUtf8(buffer))
	}

	static toString(buffer) {
		buffer = bufferFrom(buffer)
		return bufferToStringBase64(buffer)
	}

	static fromString = bufferFromBase64 // todo


	_update(chunk) {
		if (this.lastChunk) {
			chunk = Buffer.concat([this.lastChunk, chunk])
			this.lastChunk = undefined
		}
		var chunkLength = chunk.length
		if (chunkLength < 3) {
			this.lastChunk = chunk
			return
		}
		var overflowBytes = chunkLength % 3
		if (overflowBytes) {
			this.lastChunk = chunk.slice(chunkLength - overflowBytes)
			chunk = chunk.slice(0, chunkLength - overflowBytes)
		}
		if (chunk)
			return this._encode(chunk)
	}

	_digest() {
		if (this.lastChunk)
			return this._encode(this.lastChunk)
	}

	// Note: every 3 bytes result in 3 characters. transform stream can process divisions of 3 and carry
	// remaining chunks to next computation

}


export var base64 = Base64.toString.bind(Base64)