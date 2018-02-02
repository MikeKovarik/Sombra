import {bufferFrom, bufferToString, bufferConcat} from './util-buffer.mjs'
import {fromCodePoint, getCodePoints, sanitizeUtf8BufferChunk} from './util-utf.mjs'
import {createApiShortcut} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'
import {ENTITY} from './util-tables.mjs'


function isHexCharacter(character) {
	return /[0-9A-Fa-f]/.test(character)
}

// TODO: take another stab at making the core functionality state-less so _encode() and _decode()
//       can be called from static methods without having to instantiate. Options object is already
//       being passed through argument. Next could be 'lastValue' with so-far transformed chunks (or
//       current value in case of checksums) and 'state' for passing things like 'lastChunk' that would
//       otherwise end up in instance as this.lastChunk
export class EntityTransform extends SombraTransform {

	// Short circuiting default behavior of SombraTransform

	_update(chunk, options) {
		if (typeof chunk !== 'string') {
			if (this.lastUtf8Chunk)
				chunk = bufferConcat([this.lastUtf8Chunk, chunk])
			let result = sanitizeUtf8BufferChunk(chunk)
			chunk = result[0]
			this.lastUtf8Chunk = result[1]
		}
		return this._convert(chunk, options)
	}

	_digest(options) {
		if (this.decoder) {
			var lastProcessed = this._decode(undefined, options)
			if (lastProcessed && typeof lastProcessed === 'string')
				lastProcessed = bufferFrom(lastProcessed)
			if (this.lastChunk)
				return bufferConcat([lastProcessed, bufferFrom(this.lastChunk)])
			else
				return lastProcessed
		}
	}

	// Entity encoder and decoder methods.

	_encode(chunk, options) {
		//console.log('_encode -------------------------------------------')
		//console.log(chunk, bufferToString(chunk))
		var {prefix, postfix, radix, uppercase, zeroPadded} = options
		//console.log('codepoints', getCodePoints(chunk))
		var res = getCodePoints(chunk)
			.map(code => this._encodeCharacter(code, options))
			.join('')
		//console.log('res', res)
		return res
	}
	
	_encodeCharacter(code, options) {
		var stringCode = code.toString(options.radix)
		//console.log('_encodeCharacter', code, stringCode)
		if (options.uppercase)
			stringCode = stringCode.toUpperCase()
		if (options.zeroPadded)
			stringCode = stringCode.padStart(options.zeroPadded, '0')
		return `${options.prefix || ''}${stringCode}${options.postfix || ''}`
	}

	_decode(chunk, options) {
		var {prefix, postfix} = options
		//console.log('_decode #############################################################')
		var isLastChunk = false
		if (chunk === undefined) {
			isLastChunk = true
			chunk = this.lastChunk
		} else {
			if (typeof chunk !== 'string')
				chunk = bufferToString(chunk)
			if (this.lastChunk) {
				//console.log('merging', this.lastChunk, chunk)
				chunk = this.lastChunk + chunk
				this.lastChunk = undefined
			}
		}
		//console.log(chunk)
		// TODO: This implementation expects prefix to be defined. However in case CSS unicode escaping
		//       with \ it will not work as expected. i guess. 
		var prefixIndex
		var sections = []
		//var killswitch = 4
		while ((prefixIndex = chunk.indexOf(prefix)) !== -1) {
			//if (killswitch-- === 0) return
			if (prefixIndex > 0) {
				var beforePrefix = chunk.slice(0, prefixIndex)
				sections.push(beforePrefix)
			}
			var entityEndIndex = chunk.length
			// Find end of the entity so it can be stripped of prefix and postfix for further processing.
			if (postfix) {
				var postfixIndex = chunk.indexOf(postfix)
				if (postfixIndex === -1) {
					chunk = chunk.slice(prefixIndex)
					break
				} else {
					entityEndIndex = postfixIndex + postfix.length
				}
			} else {
				// Entity does not have postfix that could be used for determining length.
				// Manually looping through all characters after prefix until end is guessed.
				var i = prefixIndex + prefix.length
				var minLength = options.minLength || 4
				//console.log(i, minLength, i + minLength, chunk.length)
				if (!isLastChunk && i + minLength >= chunk.length) {
					break
				}
				var maxEnd = Math.min(chunk.length, i + minLength)
				while (i++ < maxEnd) {
					if (!isHexCharacter(chunk[i])) {
						entityEndIndex = i
						break
					}
				}
			}
			// Slice entity's prefix and postfix and decode it.
			var entity = chunk.slice(prefixIndex, entityEndIndex)
			sections.push(this._decodeEntity(entity, options))
			//console.log('sections', sections)
			// Remove the entity we just decoded and continue with the rest of the chunk in next loop.
			chunk = chunk.slice(entityEndIndex)
		}
		//console.log('storing', chunk)
		this.lastChunk = chunk
		//console.log('# sections', sections)
		//console.log('res', sections.join(''))
		return sections.join('')
	}

	_decodeEntity(entity, options) {
		var {prefix, postfix, radix} = options
		if (postfix && postfix.length)
			var parsed = entity.slice(prefix.length, -postfix.length)
		else
			var parsed = entity.slice(prefix.length)
		// Check if the charcode is single character or special unicode (usually emoji) that takes two
		// characters (4 bytes). And stringify the charcode properly if so.
		return fromCodePoint(parseInt(parsed, radix))
	}

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

export var url// = createApiShortcut(HtmlEscaper)
export var percent = url
export var urlComponent// = createApiShortcut(HtmlEscaper)
