import {SombraTransform} from './SombraTransform.mjs'
import {Utf8} from './encodings-utf8.mjs'
import {Base64} from './encodings-base64.mjs'
import {Bin, Oct, Dec, Hex} from './encodings-numeric.mjs'
import {} from './encodings-entity.mjs'

export * from './encodings-utf8.mjs'
export * from './encodings-base64.mjs'
export * from './encodings-numeric.mjs'
export * from './encodings-entity.mjs'



// TODO: _transform methods for stream
// TODO: turn this into two transform stream classes (one for decoding, second to encoding)


function getEncodingConstructor(encoding) {
	switch (encoding) {
		case 'utf-8':
		case 'utf8':   return Utf8
		case 'base64': return Base64
		case 'hex':    return Hex
		case 'dec':    return Dec
		case 'oct':    return Oct
		case 'bin':    return Bin
	}
}

export function createEncoding(encoding) {
	return new getEncodingConstructor(encoding)
}

export function encode(data, encoding, separator) {
	return getEncodingConstructor(encoding).encode(data, separator)
}

export function decode(data, encoding, separator) {
	return getEncodingConstructor(encoding).decode(data, separator)
}

export function toString(data, encoding) {
	return getEncodingConstructor(encoding).toString(data)
}
export function fromString(data, encoding) {
	return getEncodingConstructor(encoding).fromString(data)
}

export function finalizeEncoding(buffer, encoding) {
	var Encoder = getEncodingConstructor(encoding)
	if (Encoder)
		return Encoder.toString(buffer)
	else
		return buffer
}




/*
// TODO: Figure out a way to use this UTF8 escaping

// converts 'ཨ' into 'à½¨', 'í' into 'Ã', 'ž' into 'Å¾'
function encodeUtf8(rawString) {
	return unescape(encodeURIComponent(rawString))
}

// converts 'à½¨' into 'ཨ', 'Ã' into 'í', 'Å¾' into 'ž'
function decodeUtf8(escapedString) {
	return decodeURIComponent(escape(escapedString))
}

*/