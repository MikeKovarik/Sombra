import {bufferFrom, bufferToString} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'
import {ENTITY} from './util-tables.mjs'




/*
TODO
memoize input and codepoints
Codepoints function must use hybrid of codepointat and charcodeat
getcharcodes manually detect surrogatepairs rather than using codepointat - performace
create longer array and then slice, rather than pushing
function fromCodePoint(code) {
    return code < 0x10000 ? String.fromCharCode(code) : String.fromCodePoint(code);
}
*/

function getCharCodes(input) {
	var output = Array(input.length)
	for (var i = 0; i < input.length; i++) {
		output[i] = input.codePointAt(i)
	}
	return output
}

function getCodePoints(input) {
	var output = []
	var code
	for (var i = 0; i < input.length; i++) {
		code = input.codePointAt(i)
		if (code > 0xFFFF)
			i++
		output.push(code)
	}
	return output
}




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
		var inputString = bufferToString(buffer)
		console.log('inputString', inputString)
		// Encoded output string
		var outputString = getCodePoints(inputString)
			.map(code => this._encodeCharacter(code, this))
			.join('')
		console.log('outputString', outputString)
		return bufferFrom(outputString)
	}
	
	_encodeCharacter(code, options) {
		var stringCode = code.toString(options.radix)
		if (options.uppercase)
			stringCode = stringCode.toUpperCase()
		if (options.zeroPadded)
			stringCode = stringCode.padStart(options.zeroPadded, '0')
		return `${options.prefix || ''}${stringCode}${options.postfix || ''}`
	}

}

export class EntityDecoder extends SombraTransform {

	_encode(buffer) {
		var {prefix, postfix, radix} = this.constructor

		var chunks = []
		var input = bufferToString(buffer)
		var remainder = input
		var prefixIndex
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
		}
		console.log('chunks', chunks)
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
	_encode(chunk) {
		console.log('_encode', chunk)
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		console.log('post convert', chunk)
		// NOTE: All named entities are of characters bellow charcode 9000,
		//       meaning they only take one byte (and one actual character)
		//       so bracket notation can be used to compare single characters
		//       instead of turning them into codepoints.
		var char
		var output = ''
		for (var i = 0; i < chunk.length; i++) {
			char = chunk[i]
			var entity = ENTITY.get(char)
			output += entity ? `&${entity};` : char
		}
		console.log('output', output)
		return output
	}
}
// </div> => &lt;/div&gt;
export class HtmlUnescaper extends EntityDecoder {
	static prefix = '&'
	static postfix = ';'
	_decodeEntity(string) {
		var entity = string.slice(1, -1)
		// return string character (of the named entity)
		return ENTITY.get(entity)
	}
}


function createShortcut(Encoder, Decoder) {
	if (Encoder) {
		var fn = Encoder.convertToString.bind(Encoder)
		fn.Encoder = Encoder
		fn.encode = Encoder.convert.bind(Encoder)
		fn.encodeToString = Encoder.convertToString.bind(Encoder)
	} else {
		var fn = {}
	}
	if (Decoder) {
		fn.Decoder = Decoder
		fn.decode = Decoder.convert.bind(Decoder)
		fn.decodeToString = Decoder.convertToString.bind(Decoder)
	}
	return fn
}


export var ncrdec = createShortcut(NcrDec, NcrDecDecoder)
//export var ncrdec = createShortcut(undefined, NcrDecDecoder)
export var ncrhex = createShortcut(NcrHex, NcrHexDecoder)
export var unicodeescaped = createShortcut(UnicodeEscaped, UnicodeEscapedDecoder)
export var unicode = createShortcut(Unicode, UnicodeDecoder)
export var html = createShortcut(HtmlEscaper, HtmlUnescaper)
