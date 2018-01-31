// UTF-8 / UTF-16 ESCAPING AND CONVERSION

// converts 'ཨ' into 'à½¨', 'í' into 'Ã', 'ž' into 'Å¾'
export function escapeUtf8(rawString) {
	// Encodes UTF16 special characters into percentage notation which is then unescaped into
	// two or more UTF8 special character
	return unescape(encodeURIComponent(rawString))
}

// converts 'à½¨' into 'ཨ', 'Ã' into 'í', 'Å¾' into 'ž'
export function unescapeUtf8(escapedString) {
	// Escapes UTF8 special characters (outside the a-z A-Z 0-9 range) into percentage notation
	// which is then decoded into UTF16 character.
	return decodeURIComponent(escape(escapedString))
}


// SURROGATE PAIR DETECTION AND MANIPULATION

// Detects if the character (its code) is standalone character or member of surrogate pair (special character).
export function isSurrogate(charCode) {
	return isSurrogateHigh(charCode)
		|| isSurrogateLow(charCode)
}

// First code unit of a surrogate pair is in the range from 0xD800 to 0xDBFF, and is called a high surrogate.
export function isSurrogateHigh(charCode) {
	return charCode >= 0xD800 && charCode <= 0xDBFF
}

// Second code unit of a surrogate pair is in the range from 0xDC00 to 0xDFFF, and is called a low surrogate.
export function isSurrogateLow(charCode) {
	return charCode >= 0xDC00 && charCode <= 0xDFFF
}

// Merges High and Low parts of surrogate pair (2x16b) into single code point number (32b).
export function surrogatePairToCodePoint(high, low) {
	return (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000
}

// Splits single code point number (32b) into High and Low parts of surrogate pair (2x16b).
export function codePointToSurrogatePair(codePoint) {
	var high = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800
	var low = (codePoint - 0x10000) % 0x400 + 0xDC00
	return [high, low]
}


// STRING TO BUFFER CONVERSIONS

// Returns typed array of 8b unit codes
// '💀' => [240, 159, 146, 128]
// 'ř'  => [197, 153]
// 'a'  => [97]
export function encodeUtf8String(string) {
	var buffer = new Uint8Array(string.length)
	return getCharCodes(string, buffer)
}

// Returns typed array of 16b unit codes
// '💀' => [55357, 56448]
// 'ř'  => [348]
// 'a'  => [97]
export function encodeUtf16String(string) {
	var buffer = new Uint16Array(string.length)
	return getCharCodes(string, buffer)
}

// Returns typed array of 32b code points
// '💀' => [128128]
// 'ř'  => [348]
// 'a'  => [97]
export function encodeUtf32String(string) {
	var array = getCharCodes(string)
	return new Uint32Array(array)
}


export function getCharCodes(string, buffer = []) {
	for (var i = 0; i < string.length; i++)
		buffer[i] = string.charCodeAt(i)
	return buffer
}

export function getCodePoints(string, buffer = []) {
	var buffer = []
	var code
	for (var i = 0; i < string.length; i++) {
		code = string.codePointAt(i)
		if (isSurrogate(code))
			i++
		buffer.push(code)
	}
	return buffer
}


export function bufferToCharCodes(buffer) {
	return String.fromCharCode(...buffer)
}

export function bufferToCodePoints(buffer) {
	return String.fromCodePoint(...buffer)
}
//function fromCodePoint(code) {
//    return code < 0x10000 ? String.fromCharCode(code) : String.fromCodePoint(code);
//}