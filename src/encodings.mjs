import {Base64} from './encodings/base64.mjs'
import {Bin, Oct, Dec, Hex} from './encodings/numeric.mjs'
import {} from './encodings/entity.mjs'

export * from './encodings/base64.mjs'
export * from './encodings/numeric.mjs'
export * from './encodings/entity.mjs'



// TODO: _transform methods for stream
// TODO: turn this into two transform stream classes (one for decoding, second to encoding)


function getEncodingConstructor(encoding) {
	switch (encoding) {
		//case 'utf-8':
		//case 'utf8':   return Utf8
		case 'base64': return Base64
		case 'hex':    return Hex
		case 'dec':    return Dec
		case 'oct':    return Oct
		case 'bin':    return Bin
	}
}

export function createEncoding(encoding) {
	return new getEncodingConstructor(encoding).Encoder
}
export function createEncoder(encoding) {
	return new getEncodingConstructor(encoding).Encoder
}
export function createDecoder(encoding) {
	return new getEncodingConstructor(encoding).Decoder
}

export function encode(data, encoding, separator) {
	return getEncodingConstructor(encoding).encode(data, separator)
}

export function decode(data, encoding, separator) {
	return getEncodingConstructor(encoding).decode(data, separator)
}

export function toString(data, encoding) {
	return getEncodingConstructor(encoding).encodeToString(data)
}
// TODO
//export function fromString(data, encoding) {
//	return getEncodingConstructor(encoding).Decoder.fromString(data)
//}
