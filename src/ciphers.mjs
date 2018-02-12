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



class SingleCharacterCipher extends SombraTransform {

	_encode(chunk, options) {
		var encoded = bufferAlloc(chunk.length)
		for (var i = 0; i < chunk.length; i++)
			encoded[i] = this._encodeCharacter(chunk[i], options)
		return encoded
	}

	_decode(chunk, options) {
		var decoded = bufferAlloc(chunk.length)
		for (var i = 0; i < chunk.length; i++)
			decoded[i] = this._decodeCharacter(chunk[i], options)
		return decoded
	}

}


class NumericKeyCipher extends SingleCharacterCipher {

	// Is not lossless. Decoding won't yield exact copy of input.
	static lossless = false // TODO: move this around, some ciphers can contain special characters

	static key = 1

	_setup(options) {
		if (options.key > 26)
			throw new Error('Key cannot be larger than 26')
		if (options.key < 0)
			throw new Error('Key cannot be smaller than 0')
	}

}


class RotaryCipher extends NumericKeyCipher {

	_encodeCharacter(code, options) {
		if (isUpperCaseCode(code))
			return shiftCharCode(code, options.key, 65) // upper case
		else if (isLowerCaseCode(code))
			return shiftCharCode(code, options.key, 97) // lower case
		else
			return code
	}

	_decodeSetup(options) {
		options.key = -options.key
	}

	_decode(chunk, options, state) {
		return this._encode(chunk, options, state)
	}

}


// Reverses alphabet
export class Atbash extends SingleCharacterCipher {

	_encodeCharacter(code) {
		if (isUpperCaseCode(code))
			return Math.abs(code - 65 - 25) + 65
		else if (isLowerCaseCode(code))
			return Math.abs(code - 97 - 25) + 97
		else
			return code
	}

	_decode(chunk, options, state) {
		return this._encode(chunk, options, state)
	}

}


// Work in progress
//var memoizedCodes = {}
export class XorCipher extends NumericKeyCipher {

	_encodeCharacter(code, options) {
		return code ^ options.key	
		//return skipCodes.includes(code) ? code : code ^ options.key	
	}

	_decode(buffer, options) {
		return this._encode(buffer, options)
	}

}


// AKA ROT-n
export class Caesar extends RotaryCipher {
	// Cauesar is not limited to key 23, this is just arbitrary number
	// that user will overwite with his own key.
	static key = 23

}

// AKA Caesar shift with key 5
// Covers numbers (0-9)
export class Rot5 extends RotaryCipher {
	// TODO: handle special characters (add option to un/sanitize) and lossless
	static key = 5
}

// AKA Caesar shift with key 13
// Covers the 26 letters of basic latin alphabet (A-Z, a-z)
export class Rot13 extends RotaryCipher {
	// TODO: handle special characters (add option to un/sanitize) and lossless
	static key = 13
}

// AKA Caesar shift with key 18. Combination of ROT5 and ROT13
// Covers numbers and basic latin alphabet (0-9, A-Z, a-z)
export class Rot18 extends RotaryCipher {
	// TODO: handle special characters (add option to un/sanitize) and lossless
	static key = 18
}

// AKA Caesar shift with key 47
// Covers all printable ASCII characters, except empty spaces.
export class Rot47 extends RotaryCipher {
	// TODO: handle special characters (add option to un/sanitize) and lossless
	static key = 47
}


// Maps a-z to 1-26
// Note: only works on words. Will not work meaningfuly with exotic strings like 'cdF0§)ú.g9-ř;°á´$*6☢'
// Work in progress, do not use
// TODO: Finish
export class A1z26 extends SombraTransform {

	// Is not lossless. Decoding won't yield exact copy of input.
	static lossless = false

	static separator = '-'

	// TODO: make it streamable so we don't break it in middle of a word

	_encode(chunk, options) {
		var encoded = bufferAlloc(chunk.length)
		var characters = Array.from(chunk)
			// TODO: split into words and only encode those
			.map(code => this._encodeCharacter(code))
			.join(options.separator)
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
export class Vigenere extends SombraTransform {

	// Is not lossless. Decoding won't yield exact copy of input.
	static lossless = false

	static key = ''

	_encode(chunk, options) {
	}

	_decode(chunk, options) {
	}

}


// IDEA: builtin diacritics sanitizer?
export class Morse extends SombraTransform {

	// Is not lossless. Decoding won't yield exact copy of input.
	static lossless = false

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
		'...-..-', '.----.', '..--.-', '.--.-.', '---.', '-.-.--', '.-.-.', '--.--', '...-.-', '.-...', '.-.-..',
		// äáåéñöü
		'.-.-', '.--.-', '.--.-', '..-..', '--.--', '---.', '..--',
	]


	_setup(options, state) {
		var code = options.code
		if (options.short !== '.')
			code = code.replace(/\./g, options.short)
		if (options.long !== '-')
			code = code.replace(/\-/g, options.long)
		options.code = code
		state.isFirstChunk = true
		state.input = ''
	}

	_encode(chunk, options, state) {
		var {alphabet, codes, space, separator, throwErrors} = options
		// TODO: enable custom long/short characters
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		var output = chunk
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
		if (state.isFirstChunk)
			state.isFirstChunk = false
		else
			return separator + output
		return output
	}

	_decode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		state.input += chunk
	}

	_decodeDigest(options, state) {
		var {alphabet, codes, space, separator, throwErrors} = options
		return state.input
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
	}

}



export class Polybius extends SombraTransform {

	// TODO: figure out some way to signalize that the cipher does not translate 1:1

	static charToReplace = 'j'
	static replaceWith = 'i'

	_setup(options, state) {
		this._createAlphabet(options, state)
	}

	// Encoder

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

	_decode(chunk, options, state) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		// Restore last chunk if there was one.
		if (state.lastChunk) {
			chunk = state.lastChunk + chunk
			state.lastChunk = undefined
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
				state.lastChunk = chunk[i]
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


export class ClockCipher extends SombraTransform {

	static separator = ':'

	// TODO: FIX LOWER CASE
	_encode(buffer, options) {
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
			.join(options.separator)
	}

	_decode(buffer, options) {
		var decodedBuffer = Utf8.toString(buffer)
			.toUpperCase()
			.split(options.separator)
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


export var xorCipher = createApiShortcut(XorCipher)
export var caesar = createApiShortcut(Caesar)
export var atbash = createApiShortcut(Atbash)
export var rot13 = createApiShortcut(Rot13)
export var a1z26 = createApiShortcut(A1z26)
export var vigenere = createApiShortcut(Vigenere)
export var morse = createApiShortcut(Morse)
export var polybius = createApiShortcut(Polybius)
export var bifid = createApiShortcut(Bifid)
export var clockCipher = createApiShortcut(ClockCipher)
