import {bufferFrom, bufferToString} from './node-builtins.mjs'
import {platform, createApiShortcut} from './util.mjs'
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
export class EntityTransform extends SombraTransform {

	_encode(chunk, options) {
		var {prefix, postfix, radix, uppercase, zeroPadded} = options
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		console.log('chunk', chunk)
		// Encoded output string
		var outputString = getCodePoints(chunk)
			.map(code => this._encodeCharacter(code, options))
			.join('')
		console.log('outputString', outputString)
		return outputString
	}
	
	_encodeCharacter(code, options) {
		var stringCode = code.toString(options.radix)
		if (options.uppercase)
			stringCode = stringCode.toUpperCase()
		if (options.zeroPadded)
			stringCode = stringCode.padStart(options.zeroPadded, '0')
		return `${options.prefix || ''}${stringCode}${options.postfix || ''}`
	}

	_decode(chunk, options) {
		var {prefix, postfix} = options
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		console.log('_decode', chunk)
		var remainder = chunk
		var prefixIndex
		var sections = []
		console.log('prefix', prefix)
		while ((prefixIndex = remainder.indexOf(prefix)) !== -1) {
			if (prefixIndex > 0) {
				var before = remainder.slice(0, prefixIndex)
				sections.push(before)
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
			var decoded = this._decodeEntity(entity, options) // todo
			sections.push(decoded)
			remainder = remainder.slice(entityEndIndex)
		}
		console.log('sections', sections)
		return sections.join('')
	}

	_decodeEntity(entity, options) {
		var {prefix, postfix, radix} = options
		if (postfix.length)
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
export class NcrDec extends EntityTransform {
	static prefix = '&#'
	static postfix = ';'
	static radix = 10
}


// TODO: decode
// Encodes every character into notation
export class NcrHex extends EntityTransform {
	static prefix = '&#x'
	static postfix = ';'
	static radix = 16
}

// TODO: decode
// Encodes every character into notation
export class UnicodeEscaped extends EntityTransform {
	static prefix = '\\u'
	static radix = 16
}

// TODO: decode
// Encodes every character into notation
export class Unicode extends EntityTransform {
	static prefix = 'U+'
	static postfix = ''
	static radix = 16
	static uppercase = true
	static zeroPadded = 4
}


// TODO:
// </div> => %3C%2Fdiv%3E
export class Percent extends EntityTransform {
}



// </div> => &lt;/div&gt;
export class HtmlEscaper extends EntityTransform {

	static decoder = true
	static prefix = '&'
	static postfix = ';'

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

	_decodeEntity(string) {
		var entity = string.slice(1, -1)
		// return string character (of the named entity)
		return ENTITY.get(entity)
	}

}



export var ncrdec = createApiShortcut(NcrDec)
export var ncrhex = createApiShortcut(NcrHex)
export var unicodeescaped = createApiShortcut(UnicodeEscaped)
export var unicode = createApiShortcut(Unicode)
export var html = createApiShortcut(HtmlEscaper)
