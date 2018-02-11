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

// ----------------------------------------------------------------------------
// ---------- UTF-8 -----------------------------------------------------------
// ----------------------------------------------------------------------------

export function isUtf8Sequence(codeUnit) {
	return codeUnit >= 0b10000000
}
export function isUtf8SequenceLead(codeUnit) {
	return codeUnit >= 0b11000000
}
export function getUtf8SequenceLength(codeUnit) {
	if (isUtf8Sequence(codeUnit)) {
		codeUnit = codeUnit & 0b11110000
		if (codeUnit === 0b11110000) {
			return 4
		} else if (codeUnit === 0b11100000) {
			return 3
		} else if (codeUnit >= 0b11000000) {
			return 2
		} else if (codeUnit >= 0b10000000) {
			return 1
		}
	}
	return 0
}
export function extractUtf8SequencePayload(codeUnit) {
	return codeUnit & 0b00111111
}
export function extractUtf8SequenceLead(codeUnit, seqBytes = 2) {
	switch (seqBytes) {
		case 4: return codeUnit & 0b00001111
		case 3: return codeUnit & 0b00011111
		case 2: return codeUnit & 0b00111111
		case 1: return codeUnit & 0b01111111
	}
}

// Converts single codepoint (of any size and value) into UTF-8 encoded array of 8b code units (UTF-8 sequence)
export function codePointToUtf8Sequence(codePoint) {
	if (codePoint < 0b10000000)
		return [codePoint]
	var bytes = 0
	var payloads = []
	while (codePoint !== 0) {
		payloads.unshift(codePoint & 0b00111111)
		codePoint = codePoint >>> 6
	}
	var bytes = payloads.length
	var leadPayload = payloads.shift()
	var codeUnits = payloads.map(payload => payload | 0b10000000)
	var leadByteMask   = ((2 ** (7 - bytes)) - 1)
	var masked = leadPayload & leadByteMask
	if (masked !== leadPayload) {
		// Payload is larger than available bits in the leading byte! The payload needs to be split into another byte.
		var trailingByte = (leadPayload & 0b00111111) | 0b10000000
		leadPayload      = (leadPayload & 0b11000000) >>> 6 
		codeUnits.unshift(trailingByte)
		bytes++
	}
	var leadByteHeader = ((2 ** bytes) - 1) << (8 - bytes)
	var leadByte = leadPayload |= leadByteHeader
	codeUnits.unshift(leadByte)
	return codeUnits
}


// ----------------------------------------------------------------------------
// ------ UTF-16 SURROGATE PAIR DETECTION AND MANIPULATION --------------------
// ----------------------------------------------------------------------------


// Detects if the character (its code) is standalone character or member of surrogate pair (special character).
export function isUtf16Surrogate(charCode) {
	return charCode > 0xFFFF
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
	var temp = codePoint - 0x10000
	var high = Math.floor(temp / 0x400) + 0xD800
	var low = temp % 0x400 + 0xDC00
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
	var array = getCodePoints(string)
	return new Uint32Array(array)
}


export function getCodeUnits(chunk, bits = 8) {
	if (bits === 32) {
		return getCodePoints(chunk)
	} else {
		if (typeof chunk === 'string') {
			if (bits === 8)
				chunk = escapeUtf8(chunk)
			return getCharCodes(chunk)
		} else {
			if (bits === 8) {
				return Array.from(chunk)
			} else {
				var codeUnits = []
				var codePoints = getCodePointsFromUtf8Buffer(chunk)
				for (var i = 0; i < codePoints.length; i++) {
					var codePoint = codePoints[i]
					if (isUtf16Surrogate(codePoint))
						codeUnits.push(...codePointToSurrogatePair(codePoint))
					else
						codeUnits.push(codePoint)
				}
				return codeUnits
			}
		}
	}
}

export function getCharCodes(string, buffer = []) {
	for (var i = 0; i < string.length; i++)
		buffer[i] = string.charCodeAt(i)
	return buffer
}

export function getCodePoints(chunk, outputBuffer) {
	if (typeof chunk === 'string')
		return getCodePointsFromString(chunk, outputBuffer)
	else
		return getCodePointsFromUtf8Buffer(chunk, outputBuffer)
}

export function getCodePointsFromString(string, outputBuffer = []) {
	var code
	for (var i = 0; i < string.length; i++) {
		code = string.codePointAt(i)
		if (isUtf16Surrogate(code))
			i++
		outputBuffer.push(code)
	}
	return outputBuffer
}

export function getCodePointsFromUtf8Buffer(buffer, outputBuffer) {
	var codeUnit
	var seqBytesLeft = 0
	var seqCodePoint = 0
	var outputBuffer = []
	for (var i = 0; i < buffer.length; i++) {
		codeUnit = buffer[i]
		if (seqBytesLeft === 0) {
			// This codepoint is not part of any previous sequence.
			// It could be simple 0-127 ASCII character, beginning of new sequence
			// or corrupted middle of sequence which we couldn't read leading byte for
			let header = codeUnit & 0b11000000
			if (header === 0b10000000) {
				// Corrupted sequence. Header 10 suggests this byte is continuation of sequence
				// but having seqBytesLeft equal to 0 means we're not reading one currently.
				outputBuffer.push(65533)
			} else if (!isUtf8SequenceLead(codeUnit)) {
				// Normal non sequence codeunit that is a codepoint itself.
				outputBuffer.push(codeUnit)
			} else if (header !== 0) {
				// Beginning of new sequence. Header is non zero (either 11, 111 or 1111). 
				seqBytesLeft = getUtf8SequenceLength(codeUnit)
				// Remove the sequence headers (could be firt 2 to 4 bits) to get encoded value in the leading byte
				// and shift it by the ammount of bytes in the sequence left to be read * 6b
				seqCodePoint = extractUtf8SequenceLead(codeUnit, seqBytesLeft) << (6 * --seqBytesLeft)
			}
		} else {
			seqBytesLeft--
			// Remove the first two bits of the continuation header to get the value encoded in the next 6 bits.
			// Shift it to proper position to make room for remaining bytes and merge it into the previously read.
			seqCodePoint |= (codeUnit & 0b00111111) << (6 * seqBytesLeft)
			// Return the codepoint if we finished reading the sequence.
			if (seqBytesLeft === 0) {
				outputBuffer.push(seqCodePoint)
				seqCodePoint = 0
				seqBytesLeft = 0
			}
		}
	}
	return outputBuffer
}

export function sanitizeUtf8BufferChunk(chunk) {
	var i = chunk.length
	var codeUnit
	var incompleteChunk
	while (i--) {
		codeUnit = chunk[i]
		if (isUtf8Sequence(codeUnit)) {
			if (isUtf8SequenceLead(codeUnit)) {
				var sequenceBytes = getUtf8SequenceLength(codeUnit)
				if (i + sequenceBytes > chunk.length) {
					incompleteChunk = chunk.slice(i)
					chunk = chunk.slice(0, i)
					break
				}
			}
		} else {
			break
		}
	}
	return [chunk, incompleteChunk]
}


export function bufferToCharCodes(buffer) {
	return String.fromCharCode(...buffer)
}

export function bufferToCodePoints(buffer) {
	return String.fromCodePoint(...buffer)
}

export function fromCodePoint(codePoint) {
	if (isUtf16Surrogate(codePoint))
		return String.fromCodePoint(codePoint)
	else
		return String.fromCharCode(codePoint)
}