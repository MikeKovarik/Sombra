import {bufferFrom, bufferToString, bufferConcat} from './util-buffer.mjs'
import {fromCodePoint, getCodePoints, getCodeUnits, sanitizeUtf8BufferChunk, codePointToUtf8Sequence} from './util-utf.mjs'
import {createApiShortcut} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'
import {ENTITY} from './util-tables.mjs'


function bufferFromCodePoint(codePoint) {
	return bufferFrom([codePoint])
}

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
		if (this.decoder && this.lastChunk) {
			var lastProcessed = this._decode(undefined, options)
			if (lastProcessed && typeof lastProcessed === 'string')
				lastProcessed = bufferFrom(lastProcessed)
			console.log('lastProcessed', lastProcessed)
			if (this.lastChunk)
				return bufferConcat([lastProcessed, bufferFrom(this.lastChunk)])
			else
				return lastProcessed
		}
	}

	// Entity encoder and decoder methods.

	_encode(chunk, options) {
		return getCodeUnits(chunk, options.bits)
			.map(code => this._encodeCharacter(code, options))
			.join('')
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
		var {safeBufferSize, chars} = this
		// Most formats have either postfix of fixed length of the payload. Though for example Unicode has 4 zero-padded
		// characters which could be longer than that (Skull emoji is 5 character long U+1F480) so we need to keep some
		// room at the end of each chunk to safely account for possibly longer codes.
		var entityLength = safeBufferSize ? 0 : chars || options.zeroPadded
		console.log('_decode #############################################################')
		//console.log('# chunk', chunk, typeof chunk)
		//console.log('# this.lastChunk', this.lastChunk, typeof this.lastChunk)
		var isFinalChunk = false
		if (chunk === undefined) {
			isFinalChunk = true
			chunk = this.lastChunk
			if (typeof chunk !== 'string')
				chunk = bufferToString(chunk)
		} else {
			if (typeof chunk !== 'string')
				chunk = bufferToString(chunk)
			if (this.lastChunk) {
				//console.log('merging', this.lastChunk, chunk)
				chunk = this.lastChunk + chunk
				this.lastChunk = undefined
			}
		}
		console.log('chunk', chunk)
		// TODO: This implementation expects prefix to be defined. However in case CSS unicode escaping
		//       with \ it will not work as expected. i guess. 
		var prefixIndex
		var sections = []
		while ((prefixIndex = chunk.indexOf(prefix)) !== -1) {
			if (prefixIndex > 0) {
				var beforePrefix = chunk.slice(0, prefixIndex)
				chunk = chunk.slice(prefixIndex)
				prefixIndex = 0
				sections.push(bufferFrom(beforePrefix))
			}
			var entityEndIndex = chunk.length
			// Find end of the entity so it can be stripped of prefix and postfix for further processing.
			if (postfix) {
				var postfixIndex = chunk.indexOf(postfix)
				if (postfixIndex === -1) {
					break
				} else {
					entityEndIndex = postfixIndex + postfix.length
				}
			} else if (entityLength) {
				entityEndIndex = prefixIndex + prefix.length + entityLength
				if (!isFinalChunk && entityEndIndex > chunk.length)
					break
			} else {
				// Entity does not have postfix that could be used for determining length.
				// Manually looping through all characters after prefix until end is guessed.
				var i = prefixIndex + prefix.length
				var guessedEntityEndIndex = i + safeBufferSize
				if (!isFinalChunk && guessedEntityEndIndex > chunk.length)
					break
				var maxEnd = Math.min(chunk.length, guessedEntityEndIndex)
				while (i++ < maxEnd) {
					if (!isHexCharacter(chunk[i])) {
						entityEndIndex = i
						break
					}
				}
			}
			//console.log('before', chunk)
			//console.log('prefixIndex', prefixIndex)
			//console.log('entityEndIndex', entityEndIndex)
			// Slice entity's prefix and postfix and decode it.
			var entity = chunk.slice(prefixIndex, entityEndIndex)
			//console.log('entity', entity)
			sections.push(this._decodeEntity(entity, options))
			// Remove the entity we just decoded and continue with the rest of the chunk in next loop.
			chunk = chunk.slice(entityEndIndex)
			//console.log('chunk to store', chunk)
		}
		this.lastChunk = chunk && chunk.length ? chunk : undefined
		//console.log('this.lastChunk', this.lastChunk)
		console.log('sections', sections)
		console.log('concat', bufferConcat(sections))
		console.log('res', bufferToString(bufferConcat(sections)))
		return bufferConcat(sections)
	}

	_decodeEntity(entity, options) {
		console.log('_decodeEntity', entity)
		var {prefix, postfix, radix} = options
		if (postfix && postfix.length)
			var parsed = entity.slice(prefix.length, -postfix.length)
		else
			var parsed = entity.slice(prefix.length)
		// Check if the charcode is single character or special unicode (usually emoji) that takes two
		// characters (4 bytes). And stringify the charcode properly if so.
		//return fromCodePoint(parseInt(parsed, radix))
		var codePoint = parseInt(parsed, radix)
		//console.log('entity', entity)
		//console.log('parsed', parsed)
		//console.log('codePoint', codePoint)
		if (codePoint > 0xFF)
			return bufferFrom(codePointToUtf8Sequence(codePoint))
		else
			return bufferFrom([codePoint])
	}

}


// Encodes every character into notation
export class NcrDec extends EntityTransform {
	static prefix = '&#'
	static postfix = ';'
	static radix = 10
	static bits = 32
	static uppercase = true
}

// Encodes every character into notation
export class NcrHex extends EntityTransform {
	static prefix = '&#x'
	static postfix = ';'
	static radix = 16
	static bits = 32
	static uppercase = true
}

// Encodes every character into notation
// a  => \x61
// ř  => \xC5\x99
// €  => \xE2\x82\xAC
// 💀 => \xF0\x9F\x92\x80
export class UnicodeEscaped8 extends EntityTransform {
	static prefix = '\\x'
	static radix = 16
	static chars = 2
	//static bits = 8
	static zeroPadded = 2
	static uppercase = true
}

// Encodes every character into notation
// a  => \u0061
// ř  => \u0159
// €  => \u20AC
// 💀 => \uD83D\uDC80
export class UnicodeEscaped16 extends EntityTransform {
	static prefix = '\\u'
	static radix = 16
	static chars = 4
	//static bits = 16
	static zeroPadded = 4
	static uppercase = true
}

// Encodes every character into notation
// a  => \u{61}
// ř  => \u{159}
// €  => \u{20AC}
// 💀 => \u{1F480}
export class UnicodeEscaped32 extends EntityTransform {
	static prefix = '\\u{'
	static postfix = '}'
	static radix = 16
	static bits = 32
	static uppercase = true
}

// Encodes every character into notation
// a  => U+0061
// ř  => U+0159
// €  => U+20AC
// 💀 => U+1F480
export class Unicode extends EntityTransform {
	static prefix = 'U+'
	static radix = 16
	static zeroPadded = 4
	static bits = 32
	// Unicode codes have 4 zero-padded characters by default but the code can be londer than that.
	// Skull emoji is 5 character long (U+1F480) so we need to leave some room at the end of each chunk
	// to safely account for possibly longer than 4 bytes codes while decoding.
	static variableLength = true
	static safeBufferSize = 6
	static uppercase = true
}

// TODO:
// </div> => %3C%2F%64%69%76%3E
// 💀 => %F0%9F%92%80
// Name URL?
export class Percent extends EntityTransform {
	static prefix = '%'
	static postfix = ''
	static radix = 16
	static uppercase = true
	static zeroPadded = 2
	static chars = 2
}

// </div> => %3C/div%3E
export class Url extends Percent {

	_encode(chunk) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		return encodeURI(chunk)
	}

}

// </div> => %3C%2Fdiv%3E
export class UrlComponent extends Percent {

	_encode(chunk) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		return encodeURIComponent(chunk)
	}

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
		if (entity.length === 0) return
		// return string character (of the named entity)
		var char = ENTITY.get(entity)
		if (char === undefined) return
		var codePoint = char.codePointAt(0)
		return bufferFrom(codePointToUtf8Sequence(codePoint))
	}

	//_decodeEntity(string) {
	//	var entity = string.slice(1, -1)
	//	// return string character (of the named entity)
	//	return ENTITY.get(entity)
	//}

}



export var ncrdec = createApiShortcut(NcrDec)
export var ncrhex = createApiShortcut(NcrHex)
export var unicodeEscaped8 = createApiShortcut(UnicodeEscaped8)
export var unicodeEscaped16 = createApiShortcut(UnicodeEscaped16)
export var unicodeEscaped32 = createApiShortcut(UnicodeEscaped32)
export var unicode = createApiShortcut(Unicode)
export var html = createApiShortcut(HtmlEscaper)

export var percent = createApiShortcut(Percent)
export var url = createApiShortcut(Url)
export var urlComponent = createApiShortcut(UrlComponent)
