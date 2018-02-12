import {SombraTransform} from './SombraTransform.mjs'
import {createApiShortcut} from './util.mjs'
import {bufferAlloc, bufferFrom, bufferToString} from './util-buffer.mjs'
import {getCodeUnits} from './util-utf.mjs'


function shiftCharCode(code, key, shiftBy) {
	// shift
	var temp = code - shiftBy + key
	if (temp < 0) temp += 26
	// get character back into the a-z range of 26
	return (temp % 26) + shiftBy
	//return String.fromCharCode(temp % 26 + shiftBy)
}

function isUpperCaseCode(code) {
	return code >= 65 && code <= 90
}
function isLowerCaseCode(code) {
	return code >= 97 && code <= 122
}

export class Clock extends SombraTransform {

	static args = [{
		title: 'Separator',
		type: 'string',
		default: ':'
	}]

	// TODO: FIX LOWER CASE
	//static encode(buffer, separator = ':') {
	//	return this.encodePipe(buffer, separator = ':').join(separator)
	//}
	static _encode(buffer, separator) {
		return Array.from(buffer)
			.map(code => {
				// handle uppercase
				if (code >= 65 && code <= 90) code += 32
				if (code === 97)  return 'AM'
				if (code === 122) return 'PM'
				if (code === 32)  return '00'
				if (code == 32 || (code >= 97 && code <= 122)) {
					return (code - 97) + ''
				} else {
					throw new Error(`Sombra.clock cipher: invalid character '${String.fromCharCode(code)}' (${code})`)
				}
			})
			.filter(str => str) // remove invalid (undefined after mapping) characters
			.join(separator)
	}

	static _decode(buffer, separator) {
		var decodedBuffer = Utf8.toString(buffer)
			.toUpperCase()
			.split(separator)
			.filter(str => str.length) // remove empty spaces between ::
			.map(str => {
				if (str === 'AM') str = 0
				if (str === 'PM') str = 25
				if (str === '00') str = -65
				return parseInt(str) + 97
			})
		return String.fromCharCode(...decodedBuffer)
	}

}



// Work in progress
//var memoizedCodes = {}
export class xor extends SombraTransform {

	static args = [{
		title: 'Key',
		type: 'number',
		min: 0,
		max: 26,
		default: 23
	//}, {
	//	title: 'Skip characters',
	//	type: 'string',
	//	default: ' .'
	}]

	static encode(buffer, key = 0/*, skipCodesString*/) {
		// stejne neresi diakritiku
		//var skipCodes = memoizedCodes[memoizedCodes]
		//if (!skipCodes) skipCodes = memoizedCodes[memoizedCodes] = Utf8.fromString(skipCodesString)
		//console.log('XOR', buffer, key, skipCodes)
		return Array.from(buffer)
			.map(code => skipCodes.includes(code) ? code : code ^ key)	
	}

	static decode(buffer, key = 0) {
		return this.encode(buffer, key)
	}

}



// AKA ROT-n
export class Caesar extends SombraTransform {

	static destructive = false

	static args = [{
		title: 'Key',
		type: 'number',
		min: 0,
		max: 26,
		default: 23
	}]

	_encode(chunk, key) {
		var encoded = bufferAlloc(chunk.length)
		for (var i = 0; i < chunk.length; i++)
			encoded[i] = this._encodeCharacter(chunk[i], key)
		return encoded
	}
	_encodeCharacter(code, key) {
		if (isUpperCaseCode(code))
			return shiftCharCode(code, key, 65) // upper case
		else if (isLowerCaseCode(code))
			return shiftCharCode(code, key, 97) // lower case
		else
			return code
	}

	// TODO
	static decode(buffer, key) {
		return this.encode(buffer, -key)
	}

}

// Reverses alphabet
export class Atbash extends SombraTransform {

	_encode(chunk) {
		var encoded = bufferAlloc(chunk.length)
		for (var i = 0; i < chunk.length; i++)
			encoded[i] = this._encodeCharacter(chunk[i])
		return encoded
	}
	_encodeCharacter(code) {
		if (isUpperCaseCode(code))
			return Math.abs(code - 65 - 25) + 65
		else if (isLowerCaseCode(code))
			return Math.abs(code - 97 - 25) + 97
		else
			return code
	}

	_decode(buffer) {
		var encoded = bufferAlloc(buffer.length)
		for (var i = 0; i < buffer.length; i++)
			encoded[i] = this._decodeCharacter(buffer[i])
		return encoded
	}
	_decodeCharacter(code) {
		if (isUpperCaseCode(code))
			return Math.abs(code - 65 - 25) + 65
		else if (isLowerCaseCode(code))
			return Math.abs(code - 97 - 25) + 97
		else
			return code
	}

	// TODO: decoder

}

// AKA Caesar shift with key 13
export class rot13 extends SombraTransform {

	// TODO: rot5 (0-9), rot13 (A-Z, a-z), rot18 (0-9, A-Z, a-z), rot47 (!-~)

	static encode = (buffer, key) => Caesar.encode(buffer, 13)
	static decode = (buffer, key) => Caesar.encode(buffer, 13)
	// nature of ROT13 causes every other encode() to revert previous encoding

}


// Maps a-z to 1-26
// Note: only works on words. Will not work meaningfuly with exotic strings like 'cdF0§)ú.g9-ř;°á´$*6☢'
// Work in progress, do not use
// TODO: Finish
export class A1z26 extends SombraTransform {

	static destructive = true

	static args = [{
		title: 'Spacer',
		type: 'string',
		default: '-'
	}]

	// TODO: make it streamable so we don't break it in middle of a word

	_encode(chunk, separator) {
		var encoded = bufferAlloc(chunk.length)
		var characters = Array.from(chunk)
			// TODO: split into words and only encode those
			.map(code => this._encodeCharacter(code))
			.join(separator)
		return bufferFrom(characters)
	}
	_encodeCharacter(code) {
		if (isUpperCaseCode(code))
			return code - 64 // upper case
		else if (isLowerCaseCode(code))
			return code - 96 // lower case
		else
			return code
	}

}

// Like casear, but
export class vigenere extends SombraTransform {

	static destructive = true

	static args = [{
		title: 'Key',
		type: 'string',
		default: ''
	}]

	static encode(buffer, key) {
	}

	static decode(buffer, key) {
	}

}


// IDEA: builtin diacritics sanitizer?
export class Morse extends SombraTransform {

	// TODO: figure out some other way to signalize that the cipher does not translate 1:1
	//static destructive = true

	static short = '.'
	static long = '-'
	static space = '/'
	static separator = ' '
	static throwErrors = true

	static alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789.,?-=:;()/"$\'_@!!+~#&\näáåéñöü'

	// TODO: enable custom long/short characters
	static codes = [
		// abcdefghijklmnopqrstuvwxyz
		'.-', '-...', '-.-.', '-..', '.', '..-.', '--.', '....', '..', '.---', '-.-', '.-..', '--',
		'-.', '---', '.--.', '--.-', '.-.', '...', '-', '..-', '...-', '.--', '-..-', '-.--', '--..',
		// 0123456789
		'-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.',
		// .,?-=:;()/"$\'_@!!+~#&\n
		'.-.-.-', '--..--', '..--..', '-....-', '-...-', '---...', '-.-.-.', '-.--.', '-.--.-', '-..-.', '.-..-.',
		'...-..-', '.----.', '..--.-', '.--.-.', '---.', '-.-.--', '.-.-.', '.-...', '...-.-', '.-...', '.-.-..',
		// äáåéñöü
		'.-.-', '.--.-', '.--.-', '..-..', '--.--', '---.', '..--',
	]


	_encode(buffer, options) {
		var {alphabet, codes, short, long, space, separator, throwErrors} = options
		// TODO: enable custom long/short characters
		var string = bufferToString(buffer)
			.toLowerCase()
			.split('')
			.map(char => {
				if (char === ' ')
					return space
				var index = alphabet.indexOf(char)
				if (index === -1 && throwErrors)
					throw new Error(`Invalid character: '${char}'`)
				return codes[index]
			})
			.filter(char => char && char.length > 0)
			.join(separator)
		return bufferFrom(string)
	}

	static decode(buffer) {
		return this.prototype._decode(buffer, ...this.args.map(o => o.default))
	}
	_decode(buffer, options) {
		var {alphabet, codes, short, long, space, separator, throwErrors} = options
		// TODO: enable custom long/short characters
		var string = bufferToString(buffer)
			.split(separator)
			.map(entity => {
				if (entity === space)
					return ' '
				var index = codes.indexOf(entity)
				if (index === -1 && throwErrors)
					throw new Error(`Invalid code: '${entity}'`)
				return alphabet[index]
			})
			.join('')
		return bufferFrom(string)
	}

}



export class Polybius extends SombraTransform {

	// TODO: figure out some way to signalize that the cipher does not translate 1:1

	static charToReplace = 'j'
	static replaceWith = 'i'

	// Encoder

	_encodeSetup(options, state) {
		this._createAlphabet(options, state)
	}

	_encode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		var sanitized = this._sanitizeChunk(chunk, options, state)
		var {alphabet} = state
		var output = ''
		var char
		for (var i = 0; i < chunk.length; i++) {
			char = sanitized[i]
			if (char === ' ') {
				output += ' '
				continue
			}
			let [row, col] = this._indexToCords(alphabet.indexOf(char))
			output += `${row}${col}`
		}
		return output
	}
	
	// Decoder

	_decodeSetup(options, state) {
		this._createAlphabet(options, state)
	}

	_decode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		// Restore last chunk if there was one.
		if (this.lastChunk) {
			chunk = this.lastChunk + chunk
			this.lastChunk = undefined
		}
		var {alphabet} = state
		var sanitized = this._sanitizeChunk(chunk, options, state)
		var codeToSkip = options.charToReplace.charCodeAt(0)
		var output = ''
		var row
		var col
		for (var i = 0; i < chunk.length; i += 2) {
			// Spaces!
			if (chunk[i] === ' ') {
				i--
				output += ' '
				continue
			}
			// Prevent handling if we only have one character left (the row/col pair is split).
			if (i + 1 >= chunk.length) {
				this.lastChunk = chunk[i]
				continue
			}
			row = parseInt(chunk[i])
			col = parseInt(chunk[i + 1])
			output += alphabet[this._cordsToIndex(row, col)]
		}
		return output
	}

	// Helpers

	_sanitizeChunk(chunk, options, state) {
		var {charToReplace, replaceWith, charToSkip} = options
		// 'j' is replaced by 'i' by default but only unless there's a specific character to completely skip.
		if (charToReplace && !charToSkip)
			chunk = chunk.replace(new RegExp(charToReplace, 'g'), replaceWith)
		else if (charToSkip)
			chunk = chunk.replace(new RegExp(charToSkip, 'g'), '')
		return chunk
			.toLowerCase()
			.replace(/[^a-z ]/g, '')
	}

	_createAlphabet(options, state) {
		// Allow custom defined alphabet or key (25 char long string, e.g. alphabet).
		var alphabet = options.key || options.alphabet
		if (alphabet && alphabet.length !== 25)
			throw new Error('Alphabet (or key) has to be exactly 25 characters long')
		// Create alphabet of 25 chars (skipping one) based on given skip or replacement rules
		if (!alphabet) {
			var exclude = options.charToSkip || options.charToReplace
			var AlphabetCache = this.constructor = this.constructor || {}
			var alphabet = AlphabetCache[exclude]
			if (!alphabet) {
				AlphabetCache[exclude] = alphabet = []
				var code
				var excludeCode = exclude.charCodeAt(0)
				for (var i = 0; i < 26; i++) {
					code = 97 + i
					if (code !== excludeCode)
					alphabet.push(String.fromCharCode(code))
				}
			}
		}
		state.alphabet = alphabet
	}

	_indexToCords(code) {
		var row = Math.ceil((code + 1) / 5)
		var col = code % 5 + 1
		return [row, col]
	}

	_cordsToIndex(row, col) {
		return (row * 5) + col - 6
	}

}




export class Bifid extends Polybius {

	// TODO: this cipher has to have everything buffered up front

	static charToReplace = 'j'
	static replaceWith = 'i'

	static charToSkip = undefined

	//static charToSkip = 'q'
	static sanitize = false

	// Prevents chunked processing (of the stream). Cipher has to be calculated all at once.
	static chunked = false

	// Encoder

	_encodeSetup(options, state) {
		state.input = ''
		state.rows = []
		state.cols = []
		this._createAlphabet(options, state)
	}

	_encode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		var sanitized = this._sanitizeChunk(chunk, options, state)
		var {rows, cols, alphabet} = state
		for (var i = 0; i < sanitized.length; i++) {
			let [row, col] = this._indexToCords(alphabet.indexOf(sanitized[i]))
			rows[i] = row
			cols[i] = col
		}
	}

	_encodeDigest(options, state) {
		var {rows, cols, alphabet, input} = state
		var combined = [...rows, ...cols]
		var encoded = ''
		for (var i = 0; i < combined.length; i += 2)
			encoded += alphabet[this._cordsToIndex(combined[i], combined[i + 1])]
		if (options.sanitize)
			return encoded
		else
			return this._formatOutput(state.input, encoded, alphabet)
	}

	// Decoder

	_decodeSetup(options, state) {
		state.input = ''
		state.cords = []
		this._createAlphabet(options, state)
	}

	_decode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		// Restore last chunk if there was one.
		if (state.lastChunk) {
			chunk = state.lastChunk + chunk
			state.lastChunk = undefined
		}
		var sanitized = this._sanitizeChunk(chunk, options, state)
		var {alphabet, cords} = state
		for (var i = 0; i < sanitized.length; i++)
			cords.push(...this._indexToCords(alphabet.indexOf(sanitized[i])))
	}

	_decodeDigest(options, state) {
		var {alphabet, cords} = state
		var rows = cords.slice(0, cords.length / 2)
		var cols = cords.slice(cords.length / 2)
		var decoded = ''
		for (var i = 0; i < rows.length; i++)
			decoded += alphabet[this._cordsToIndex(rows[i], cols[i])]
		if (options.sanitize)
			return decoded
		else
			return this._formatOutput(state.input, decoded, alphabet)
	}

	// Helpers

	_sanitizeChunk(chunk, options, state) {
		var {charToReplace, replaceWith, charToSkip} = options
		// 'j' is replaced by 'i' by default but only unless there's a specific character to completely skip.
		if (charToReplace && !charToSkip)
			chunk = chunk.replace(new RegExp(charToReplace, 'g'), replaceWith)
		state.input += chunk
		if (charToSkip)
			chunk = chunk.replace(new RegExp(charToSkip, 'g'), '')
		return chunk
			.toLowerCase()
			.replace(/[^a-z]/g, '')
	}

	_formatOutput(input, processed, alphabet) {
		var output = ''
		var j = 0
		var char
		var charLowerCase
		for (var i = 0; i < input.length; i++) {
			char = input[i]
			charLowerCase = char.toLowerCase()
			if (alphabet.includes(charLowerCase)) {
				if (char === charLowerCase)
					output += processed[j]
				else
					output += processed[j].toUpperCase()
				j++
			} else {
				output += char
			}
		}
		return output
	}

}



//export var morse = createApiShortcut(Morse)
//export var polybius = createApiShortcut(Polybius)
//export var bifid = createApiShortcut(Bifid)

export var morse = createApiShortcut(Morse)
export var polybius = createApiShortcut(Polybius)
export var bifid = createApiShortcut(Bifid)
