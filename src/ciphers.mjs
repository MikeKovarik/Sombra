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
		console.log(bufferFrom(characters).toString())
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

	static destructive = true

	static args = [{
		title: 'Throw errors',
		name: 'throwErrors',
		default: true
	}, {
		title: 'Short',
		name: 'short',
		default: '.'
	}, {
		title: 'Long',
		name: 'long',
		default: '-'
	}, {
		title: 'Space',
		name: 'space',
		default: '/'
	}, {
		title: 'Separator',
		name: 'separator',
		default: ' '
	}]

	static alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789.,?-=:;()/"$\'_@!!+~#&\näáåéñöü'

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


	_encode(buffer, throwErrors, short, long, space, separator) {
		var {alphabet, codes} = this.constructor
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
	_decode(buffer, throwErrors, short, long, space, separator) {
		var {alphabet, codes} = this.constructor
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

	static charToSkip = 'j'
	static skipAsChar = 'i'

	_encode(chunk, options) {
		// Note: polybius only accepts a-z characters that fall under ASCII range (up to 127)
		//       so we can safely use only UTF-8 buffer or alternatively transform string to 8b code units
		//       (effectively encoding it into UTF8 array)
		if (typeof chunk === 'string')
			chunk = getCodeUnits(chunk)
		var {charToSkip, skipAsChar} = options
		var codeToSkip = charToSkip.charCodeAt(0)
		var skipAsCode = skipAsChar.charCodeAt(0)
		var output = ''
		var code
		var base
		var num
		var row
		var col
		for (var i = 0; i < chunk.length; i++) {
			code = chunk[i]
			// outside the square only space can be used
			// TODO: add option to allow more characters (commas, quotes, etc)
			if (code === 32) {
				output += ' '
				continue
			}
			// trasform to lowercase
			if (isUpperCaseCode(code))
				code += 32
			// ignore all non a-z characters
			if (!isLowerCaseCode(code))
				continue
			// map the character 26th to skip
			if (code === codeToSkip)
				code = skipAsCode
			base = code > codeToSkip ? 97 : 96
			num = code - base
			row = Math.ceil((num) / 5)
			col = (num - 1) % 5 + 1
			output += `${row}${col}`
		}
		return output
	}
	
	_decode(chunk, options) {
		if (typeof chunk !== 'string')
			chunk = bufferToString(chunk)
		// Restore last chunk if there was one.
		if (this.lastChunk) {
			chunk = this.lastChunk + chunk
			this.lastChunk = undefined
		}
		var output = []
		var row
		var col
		var code
		var codeToSkip = options.charToSkip.charCodeAt(0)
		for (var i = 0; i < chunk.length; i += 2) {
			// Spaces!
			if (chunk[i] === ' ') {
				i--
				output.push(32)
				continue
			}
			// Prevent handling if we only have one character left (the row/col pair is split).
			if (i + 1 >= chunk.length) {
				this.lastChunk = chunk[i]
				continue
			}
			row = parseInt(chunk[i])
			col = parseInt(chunk[i + 1])
			if (col && row)
			code = (row - 1) * 5 + col + 96
			if (code > codeToSkip)
				code++
			output.push(code)
			// TODO: handle incomplete chunks
		}
		return bufferFrom(output)
	}

}


export class Bifid extends SombraTransform {
}



export var polybius = createApiShortcut(Polybius)
export var bifid = createApiShortcut(Bifid)
