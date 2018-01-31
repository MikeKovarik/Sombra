import {bufferFrom, bufferToString} from './util-buffer.mjs'
import {getCodePoints, isSurrogate, codePointToSurrogatePair} from './util-utf.mjs'
import {createApiShortcut} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'
import {ENTITY} from './util-tables.mjs'


function isHexCharacter(character) {
	return /[0-9A-Fa-f]/.test(character)
}

// TODO: make decoder streamable (through _update and _digest), because the chunks might be split
//       right in the middle of entity - &#x at the end of one, the hex value at the beginning of second chunk.
export class EntityTransform extends SombraTransform {

	_encode(chunk, options) {
		var {prefix, postfix, radix, uppercase, zeroPadded} = options
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		console.log('EntityTransform _encode', chunk)
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
		console.log('EntityTransform _decode', chunk)
		var remainder = chunk
		var prefixIndex
		var sections = []
		console.log('prefix', prefix)
		// TODO: make this work with partial entities
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
		// Check if the charcode is single character or special unicode (usually emoji) that takes two
		// characters (4 bytes). And stringify the charcode properly if so.
		return TODOchange(parseInt(parsed, radix))
	}

}

function TODOchange(codePoint) {
	// TODO: this could be function on its own, part of util-utf.mjs
	if (isSurrogate(codePoint))
		return String.fromCharCode(...codePointToSurrogatePair(codePoint))
	else
		return String.fromCharCode(codePoint)
}


// Encodes every character into notation
export class NcrDec extends EntityTransform {
	static prefix = '&#'
	static postfix = ';'
	static radix = 10
}

// Encodes every character into notation
export class NcrHex extends EntityTransform {
	static prefix = '&#x'
	static postfix = ';'
	static radix = 16
}

// Encodes every character into notation
export class UnicodeEscaped extends EntityTransform {
	static prefix = '\\u'
	static radix = 16
}

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
// Name URL?
export class Percent extends EntityTransform {
	// TODO
}
// TODO: two classes, URL, URL component



// </div> => &lt;/div&gt;
export class HtmlEscaper extends EntityTransform {

	static prefix = '&'
	static postfix = ';'

	_encode(chunk) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		console.log('html _encode', chunk)
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
		console.log('html _decodeEntity')
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

export var url// = createApiShortcut(HtmlEscaper)
export var percent = url
export var urlComponent// = createApiShortcut(HtmlEscaper)
