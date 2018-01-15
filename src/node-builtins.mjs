import stream from 'stream'
import _Buffer from 'buffer'
import {nodeCrypto, webCrypto} from './util.mjs'
import {platform} from './util.mjs'


// Sombra doesn't require Buffer module as it's dependency (in browser)
// but utilizes it if it's present. Otherwise falls back to Uint8Array.

// Export Buffer constructor if it exists (in browser)
export var Buffer
// Similarly stream module and its Transform class is not mandatory.
export var Transform = stream && stream.Transform ? stream.Transform : class {}


// Custom functions that map to Buffer.alloc(), Bufer.from(), buffer.toString() if Buffer class is present,
// Otherwise falls back to providing similar fuctionality over Uint8Array.
export var bufferAlloc
export var bufferAllocUnsafe
export var bufferFrom
export var bufferToString

if (_Buffer) {
	if (typeof _Buffer === 'function')
		Buffer = _Buffer
	else if (typeof _Buffer.Buffer === 'function')
		Buffer = _Buffer.Buffer
}

// Also exporting internal methods used for shimming Buffer.from() and buffer.toString().
// Sombra's encoding classes Utf8, Hex and Base64 would normally contain following shims, but it has been moved
// here to form a coherent shim of Buffer class (due to class hoisting and circular dependencies).
export var bufferFromUtf8
export var bufferFromHex
export var bufferFromBase64
export var bufferToStringUtf8
export var bufferToStringHex
export var bufferToStringBase64

// Wrapper or shims (where necessary) of Buffer methods
if (Buffer) {

	bufferAlloc       = Buffer.alloc
	bufferAllocUnsafe = Buffer.allocUnsafe
	bufferFrom        = Buffer.from
	bufferToString    = (buffer, encoding) => buffer.toString(encoding)

	bufferFromUtf8       = data => Buffer.from(data, 'utf8')
	bufferFromHex        = data => Buffer.from(data, 'hex')
	bufferFromBase64     = data => Buffer.from(data, 'base64')
	bufferToStringUtf8   = buffer => buffer.toString('utf8')
	bufferToStringHex    = buffer => buffer.toString('hex')
	bufferToStringBase64 = buffer => buffer.toString('base64')

} else {

	// Shim of Buffer.alloc() & Buffer.allocUnsafe(). Note: Uint8Array is always 0 filled.
	bufferAlloc = bufferAllocUnsafe = size => new Uint8Array(size)

	// UTF8, depends on availability of TextDecoder/TextEncoder and platform.
	if (typeof TextDecoder !== 'undefined') {
		// browser supporting Encoding API
		let decoder = new TextDecoder('utf-8')
		let encoder = new TextEncoder('utf-8')
		bufferFromUtf8 = string => encoder.encode(string)
		bufferToStringUtf8 = buffer => decoder.decode(buffer)
	} else if (platform.uwp) {
		// Windows UWP
		let CryptographicBuffer = Windows.Security.Cryptography.CryptographicBuffer
		let utf8enc = Windows.Security.Cryptography.BinaryStringEncoding.utf8
		bufferFromUtf8 = string => {
			var iBuffer = CryptographicBuffer.convertStringToBinary(string, utf8enc)
			return new Uint8Array(iBuffer)
		}
		bufferToStringUtf8 = buffer => {
			var iBuffer = CryptographicBuffer.createFromByteArray(buffer)
			return CryptographicBuffer.convertBinaryToString(utf8enc, iBuffer)
		}
	}

	// HEX
	bufferFromHex = string => {
		var buffer = new Uint8Array(string.length / 2)
		var i, b
		for (i = 0, b = 0; i < string.length; i += 2, b++)
			buffer[b] = parseInt(string.slice(i, i + 2), 16)
		return buffer
	}
	bufferToStringHex = buffer => {
		var string = ''
		for (var i = 0; i < buffer.length; i++)
			string += buffer[i].toString(16).padStart(2, '0')
		return string
	}

	// BASE64
	bufferFromBase64 = string => {
		var raw = window.atob(string)
		console.log(string, raw)
		var rawLength = raw.length
		var buffer = new Uint8Array(raw.length)
		for (var i = 0; i < rawLength; i++)
			buffer[i] = raw.charCodeAt(i)
		return buffer
	}
	bufferToStringBase64 = buffer => {
		var CHUNK_SIZE = 0xFFFF
		var temp = ''
		var slice
		for (var i = 0; i < buffer.length; i += CHUNK_SIZE) {
			slice = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length)) 
			temp += String.fromCharCode.apply(null, slice)
			console.log(i, slice, temp)
		}
		return btoa(temp)
	}

	// Shim of Buffer.from(data, encoding)
	bufferFrom = (data, encoding = 'utf8') => {
		if (Array.isArray(data) || data instanceof Uint8Array || data instanceof ArrayBuffer) {
			return new Uint8Array(data)
		} else {
			switch (encoding) {
				case 'hex':    return bufferFromHex(data)
				case 'utf8':   return bufferFromUtf8(data)
				case 'base64': return bufferFromBase64(data)
			}
		}
	}
	// Shim of buffer.to(encoding)
	bufferToString = (buffer, encoding = 'utf8') => {
		switch (encoding) {
			case 'hex':    return bufferToStringHex(buffer)
			case 'utf8':   return bufferToStringUtf8(buffer)
			case 'base64': return bufferToStringBase64(buffer)
		}
	}

}

