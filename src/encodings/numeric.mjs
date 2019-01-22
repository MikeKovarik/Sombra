import {bufferFromString, bufferAllocUnsafe, bufferFrom} from '../util/buffer.mjs'
import {createApiShortcut} from '../util/util.mjs'
import {SombraTransform} from '../SombraTransform.mjs'


function splitIntoChunks(input, chars) {
	var output = []
	for (var i = 0; i < input.length; i += chars) {
		myChunk = input.slice(i, i + chars)
		output.push(myChunk)
	}
	return output
}

export class NumericEncoding extends SombraTransform {

	// TODO: _transform methods for stream
	// TODO: turn this into two transform stream classes (one for decoding, second to encoding)

	// TODO
	static args = [{
		title: 'Separator',
		type: 'string',
		default: ' '
	}]

	_encode(buffer, separator, radix, chars, prefix, postfix) {
		// TODO: fixme: radix argument receives object instead of number
		radix = this.constructor.radix
		//radix = radix || this.constructor.radix
		chars = chars || this.constructor.chars
		prefix = prefix || this.prefix
		var uppercase = uppercase || this.uppercase
		var array = Array.from(buffer)
			.map(val => val.toString(radix))
		if (separator.length === 0 || this.constructor.zeroPadded)
			array = array.map(num => num.padStart(chars, '0'))
		if (uppercase)
			array = array.map(num => num.toUpperCase())
		if (prefix)
			array = array.map(num => prefix + num)
		if (postfix)
			array = array.map(num => postfix + num)
		return bufferFromString(array.join(separator))
	}

	static encodeString(buffer, separator = ' ') {
		return Array.from(buffer)
			.map(val => val.toString(this.radix).padStart(this.chars, '0'))
			.join(separator)
	}

	static encodeToString(...args) {
		return this.encodeString(...args)
	}

	static decodeString(string, separator = ' ') {
		var {chars, radix} = this
		if (separator.length) {
			// Slower parsing using separator over uncertain strings - chunks might not be zero padded.
			var array = string
				.split(separator)
				.map(str => parseInt(str, radix))
			return bufferFrom(array)
		} else {
			// More performant way iteration over non-spaced array of fixed-length chunks (0 padded).
			var buffer = bufferAllocUnsafe(string.length / chars)
			var i, b
			for (i = 0, b = 0; i < string.length; i += chars, b++)
				buffer[b] = parseInt(string.slice(i, i + chars), radix)
			return buffer
		}
	}

}

// Custom radix encoding.
export class Num extends NumericEncoding {

	static args = [{
		title: 'Separator',
		type: 'string',
		default: ' '
	}, {
		name: 'Radix',
		type: 'number',
		default: 16
	}, {
		name: 'Character size',
		type: 'number',
		default: 2
	}]

	static validate(string, separator = ' ') {
		var regex = new RegExp(`^[${this.alphabet}${separator}]*$`, 'g')
		return string.match(regex) !== null
	}

	_init(separator, radix, chars) {
		this.radix = radix
		this.chars = chars
	}

}


export class Bin extends NumericEncoding {
	static alphabet = '01'
	static radix = 2
	static chars = 8
	// Is always padded, even with spacers.
	static zeroPadded = true
}

export class Oct extends NumericEncoding {
	static alphabet = '01234567'
	static radix = 8
	static chars = 3
	// Is always padded, even with spacers.
	static zeroPadded = true
}

export class Dec extends NumericEncoding {
	static alphabet = '0123456789'
	static radix = 10
	static chars = 3
	// Is not zero padded  in free form (when separators are used).
	static zeroPadded = false
}

export class Hex extends NumericEncoding {
	static alphabet = '0123456789ABCDEFabcdef'
	static radix = 16
	static chars = 2
	static canBeZeroPadded = true
	static canHaveSeparator = true
	// Is always padded, even with spacers.
	static zeroPadded = true
}

export var num = createApiShortcut(NumericEncoding)
export var bin = createApiShortcut(Bin)
export var oct = createApiShortcut(Oct)
export var dec = createApiShortcut(Dec)
// TODO: fixme
//export var hex = createApiShortcut(Hex)
export var hex = (arg, separator = '') => {
	//console.log('hex()')
	var buffer = bufferFrom(arg)
	//console.log('#', arg.length, buffer.length)
	/*
	if (arg.length !== buffer.length) {
		console.log('-----------------------------------------')
		console.log('arg', arg)
		console.log('buffer', buffer)
		console.log('-----------------------------------------')
	}
	*/
	return Hex.encodeToString(buffer, separator)
}
