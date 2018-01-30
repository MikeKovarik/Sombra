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
export var bufferConcat
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
export var bufferFromUtf8String
export var bufferFromHexString
export var bufferFromBase64String
export var bufferToUtf8String
export var bufferToHexString
export var bufferToBase64String

// Wrapper or shims (where necessary) of Buffer methods
if (Buffer) {

	bufferAlloc       = Buffer.alloc
	bufferAllocUnsafe = Buffer.allocUnsafe
	bufferFrom        = Buffer.from
	bufferConcat      = Buffer.concat
	bufferToString    = (buffer, encoding) => buffer.toString(encoding)

	bufferFromUtf8String       = data => Buffer.from(data, 'utf8')
	bufferFromHexString        = data => Buffer.from(data, 'hex')
	bufferFromBase64String     = data => Buffer.from(data, 'base64')
	bufferToUtf8String   = buffer => buffer.toString('utf8')
	bufferToHexString    = buffer => buffer.toString('hex')
	bufferToBase64String = buffer => buffer.toString('base64')

} else {

	// Shim of Buffer.alloc() & Buffer.allocUnsafe(). Note: Uint8Array is always 0 filled.
	bufferAlloc = bufferAllocUnsafe = size => new Uint8Array(size)

	bufferConcat = buffers => {
		buffers = buffers.filter(buffer => buffer && buffer.length > 0)
		var size = buffers.reduce((sum, item) => sum + item.length, 0)
		var output = new Uint8Array(size)
		if (size === 0) return output
		var previousItem = buffers.shift()
		output.set(previousItem)
		var currentItem
		while (buffers.length) {
			output.set(buffers[0], previousItem.length)
			previousItem = buffers.shift()
		}
		return output
	}

	// UTF8, depends on availability of TextDecoder/TextEncoder and platform.
	if (typeof TextDecoder !== 'undefined') {
		// browser supporting Encoding API
		let encoder = new TextEncoder('utf-8')
		let decoder = new TextDecoder('utf-8')
		bufferFromUtf8String = string => encoder.encode(string)
		bufferToUtf8String   = buffer => decoder.decode(buffer)
	} else {
		// Shim for decoding/encoding UTF8.
		bufferFromUtf8String = string => bufferFromUtf8EscapedString(escapeUtf8(string))
		bufferToUtf8String   = buffer => unescapeUtf8(bufferToUtf8EscapedString(buffer))
	}

	// BASE64
	// String needs to be escaped to UTF8 befor btoa() or after atob().
	// NOTE: btoa('č') throws error but 'č' encodes as 'Ä' or [196, 141]
	//       which can be btoa'd.
	bufferFromBase64String = string => bufferFromUtf8EscapedString(atob(string))
	bufferToBase64String   = buffer => btoa(bufferToUtf8EscapedString(buffer))

	// HEX
	bufferFromHexString = string => {
		var buffer = new Uint8Array(string.length / 2)
		var i, b
		for (i = 0, b = 0; i < string.length; i += 2, b++)
			buffer[b] = parseInt(string.slice(i, i + 2), 16)
		return buffer
	}
	bufferToHexString = buffer => {
		var string = ''
		for (var i = 0; i < buffer.length; i++)
			string += buffer[i].toString(16).padStart(2, '0')
		return string
	}

	// Shim of Buffer.from(data, encoding)
	bufferFrom = (data, encoding = 'utf8') => {
		if (Array.isArray(data) || data instanceof Uint8Array || data instanceof ArrayBuffer) {
			return new Uint8Array(data)
		} else {
			switch (encoding) {
				case 'hex':    return bufferFromHexString(data)
				case 'utf8':   return bufferFromUtf8String(data)
				case 'base64': return bufferFromBase64String(data)
			}
		}
	}
	// Shim of buffer.to(encoding)
	bufferToString = (buffer, encoding = 'utf8') => {
		switch (encoding) {
			case 'hex':    return bufferToHexString(buffer)
			case 'utf8':   return bufferToUtf8String(buffer)
			case 'base64': return bufferToBase64String(buffer)
		}
	}

}

// OTHER BUFFER UTILITIES

// Turns int number into buffer (e.g. 0xABCDEF56 => <AB,CD,EF,56>)
export function bufferFromInt(int, bytes) {
	var buffer = bufferAlloc(bytes)
	for (var i = 0; i < bytes; i++)
		buffer[bytes - i - 1] = int >>> (i * 8)
	return buffer
}





// helper function that converts UTF8 encoded strings to buffer
export function bufferFromUtf8EscapedString(string) {
	var {length} = string
	var buffer = new Uint8Array(length)
	for (var i = 0; i < length; i++)
		buffer[i] = string.charCodeAt(i)
	return buffer
}
export function bufferToUtf8EscapedString(buffer) {
	return String.fromCharCode(...buffer)
}

// TODO: Figure out a way to use this UTF8 escaping

// converts 'ཨ' into 'à½¨', 'í' into 'Ã', 'ž' into 'Å¾'
export function escapeUtf8(rawString) {
	return unescape(encodeURIComponent(rawString))
}

// converts 'à½¨' into 'ཨ', 'Ã' into 'í', 'Å¾' into 'ž'
export function unescapeUtf8(escapedString) {
	return decodeURIComponent(escape(escapedString))
}
