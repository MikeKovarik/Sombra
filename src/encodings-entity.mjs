import {bufferFrom, bufferToString} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


// Table of commonly known named entities
var entities = {
	' ': 'nbsp',
	"'": 'apos',
	'<': 'lt',
	'>': 'gt',
	'&': 'amp',
	'"': 'quot',
	'¢': 'cent',
	'£': 'pound',
	'¥': 'yen',
	'€': 'euro',
	'©': 'copy',
	'®': 'reg',
}

var entityChars = ' \'<>&"¢£¥€©®'
var entityCodes = [
	// ' \'<>&"¢£¥€©®'
	'nbsp', 'apos', 'lt', 'gt', 'amp', 'quot', 'cent', 'pound', 'yen', 'euro', 'copy', 'reg',
]

function isHexCharacter(character) {
	return /[0-9A-Fa-f]/.test(character)
}

// Methods for detecting, encoding and decoding special unicode characters that take more than 2 bytes (1 character)
// and need to be represented by two separate utf characters.
function isFirstHalfOfSpecialUnicodeChar(charCode) {
	return charCode > 55296 && charCode <= 56319
}
function isSpecialUnicodeChar(charCode) {
	return charCode > 65536
}
function mergeUnicodeCharacters(leftCode, rightCode) {
	return 65536 + ((leftCode - 55296) << 10) + (rightCode - 56320)
}
function splitUnicodeCharacters(charCode) {
	charCode -= 65536
	var leftCode = ((charCode >>> 10) + 55296)
	var rightCode = (charCode & 0x3FF) + 56320
	return [leftCode, rightCode]
}


// TODO: decode
// TODO: make decoder streamable (through _update and _digest), because the chunks might be split
//       right in the middle of entity - &#x at the end of one, the hex value at the beginning of second chunk.
export class EntityEncoder extends SombraTransform {

	_encode(buffer) {
		var {prefix, postfix, radix, uppercase, zeroPadded} = this.constructor
		var input = bufferToString(buffer)
		// Encoded output string
		var output = ''
		// Code of the currently read character
		var charCode
		// Characters usually take one or two bytes, but emoji and other special unicode characters
		// take up to 4 bytes and two characters making it impossible to simply iterate over string.
		// If charcode is greater than 55296 it means it's split into two characters and we need to
		// keep track of both characters to get the emoji's actual charcode.
		var prevCode
		for (var i = 0; i < input.length; i++) {
			charCode = input.charCodeAt(i)
			if (prevCode) {
				// We found second part (second character) of the special character.
				// Calculate real charcode.
				charCode = mergeUnicodeCharacters(prevCode, charCode)
				prevCode = 0
			} else if (isFirstHalfOfSpecialUnicodeChar(charCode)) {
				// We found first part of two-character special character. Keep first half's charcode and skip iteration.
				prevCode = charCode
				continue
			}
			// Encode the character and add it to the output string.
			output += this._encodeCharacter(charCode, prefix, postfix, radix, uppercase, zeroPadded)
		}
		return bufferFrom(output)
	}
	
	_encodeCharacter(char, prefix, postfix, radix, uppercase, zeroPadded) {
		var stringCode = char.toString(radix)
		if (uppercase)
			stringCode = stringCode.toUpperCase()
		if (zeroPadded)
			stringCode = stringCode.padStart(zeroPadded, '0')
		return `${prefix || ''}${stringCode}${postfix || ''}`
	}

}

export class EntityDecoder extends SombraTransform {

	_encode(buffer) {
		var {prefix, postfix, radix} = this.constructor

		var chunks = []
		var input = bufferToString(buffer)
		var remainder = input
		var prefixIndex
		var killswitch = 5
		while ((prefixIndex = remainder.indexOf(prefix)) !== -1) {
			if (prefixIndex > 0) {
				var before = remainder.slice(0, prefixIndex)
				chunks.push(before)
			}
			var entityEndIndex = remainder.length
			if (postfix) {
				entityEndIndex = remainder.indexOf(postfix) + postfix.length
			} else {
				var i = prefixIndex + prefix.length
				while (i < remainder.length) {
					if (!isHexCharacter(remainder[i])) {
						entityEndIndex = i
						break
					}
					i++
				}
			}
			var entity = remainder.slice(prefixIndex, entityEndIndex)
			var decoded = this._decodeEntity(entity, prefix, postfix, radix) // todo
			chunks.push(decoded)
			remainder = remainder.slice(entityEndIndex)
			if (killswitch-- === 0) return
		}
		var output = chunks.join('')
		return bufferFrom(output)
	}

	_decodeEntity(entity, prefix, postfix, radix) {
		var {prefix, postfix, radix} = this.constructor
		if (postfix)
			var parsed = entity.slice(prefix.length, -postfix.length)
		else
			var parsed = entity.slice(prefix.length)
		var charCode = parseInt(parsed, radix)
		// Check if the charcode is single character or special unicode (usually emoji) that takes two
		// characters (4 bytes). And stringify the charcode properly if so.
		if (isSpecialUnicodeChar(charCode))
			return String.fromCharCode(...splitUnicodeCharacters(charCode))
		else
			return String.fromCharCode(charCode)
	}

}



// TODO: decode
// Encodes every character into notation
export class NcrDec extends EntityEncoder {
	static prefix = '&#'
	static postfix = ';'
	static radix = 10
}
export class NcrDecDecoder extends EntityDecoder {
	static prefix = '&#'
	static postfix = ';'
	static radix = 10
}



// TODO: decode
// Encodes every character into notation
export class NcrHex extends EntityEncoder {
	static prefix = '&#x'
	static postfix = ';'
	static radix = 16
}
export class NcrHexDecoder extends EntityDecoder {
	static prefix = '&#x'
	static postfix = ';'
	static radix = 16
}

// TODO: decode
// Encodes every character into notation
export class UnicodeEscaped extends EntityEncoder {
	static prefix = '\\u'
	static radix = 16
}
export class UnicodeEscapedDecoder extends EntityDecoder {
	static prefix = '\\u'
	static radix = 16
}

// TODO: decode
// Encodes every character into notation
export class Unicode extends EntityEncoder {
	static prefix = 'U+'
	static postfix = ''
	static radix = 16
	static uppercase = true
	static zeroPadded = 4
}
export class UnicodeDecoder extends EntityDecoder {
	static prefix = 'U+'
	static postfix = ''
	static radix = 16

}


// TODO:
// </div> => %3C%2Fdiv%3E
export class Percent extends EntityEncoder {
}



// </div> => &lt;/div&gt;
export class HtmlEscaper extends EntityEncoder {
	_encode(buffer) {
		var input = bufferToString(buffer)
		var output = ''
		var char
		for (var i = 0; i < input.length; i++) {
			char = input[i]
			output += entities[char] ? `&${entities[char]};` : char
		}
		return bufferFrom(output)
	}
}
// </div> => &lt;/div&gt;
export class HtmlUnescaper extends EntityDecoder {
	static prefix = '&'
	static postfix = ';'
	_decodeEntity(string) {
		var index = entityCodes.indexOf(string.slice(1, -1))
		return entityChars[index]
	}
}


function createShortcut(Encoder, Decoder) {
	if (Encoder) {
		var fn = Encoder.convert.bind(Encoder)
		fn.Encoder = Encoder
		fn.encode = Encoder.convert.bind(Encoder)
	} else {
		var fn = {}
	}
	if (Decoder) {
		fn.Decoder = Decoder
		fn.decode = Decoder.convert.bind(Decoder)
	}
	return fn
}


export var ncrdec = createShortcut(NcrDec, NcrDecDecoder)
//export var ncrdec = createShortcut(undefined, NcrDecDecoder)
export var ncrhex = createShortcut(NcrHex, NcrHexDecoder)
export var unicodeescaped = createShortcut(UnicodeEscaped, UnicodeEscapedDecoder)
export var unicode = createShortcut(Unicode, UnicodeDecoder)
export var html = createShortcut(HtmlEscaper, HtmlUnescaper)
