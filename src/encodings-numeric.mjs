import {bufferFrom, bufferAllocUnsafe} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


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

	static args = [{
		title: 'Separator',
		type: 'string',
		default: ' '
	}]

	_encode(buffer, separator, radix, chars) {
		radix = radix || this.constructor.radix
		chars = chars || this.constructor.chars
		var array = Array.from(buffer)
			.map(val => val.toString(radix))
		if (separator.length === 0 || this.constructor.zeroPadded)
			array = array.map(num => num.padStart(chars, '0'))
		return bufferFrom(array.join(separator))
	}

	static encodeString(buffer, separator = ' ') {
		return Array.from(buffer)
			.map(val => val.toString(this.radix).padStart(this.chars, '0'))
			.join(separator)
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

export class Bin extends NumericEncoding {
	static validate = (string, separator) => string.match(/^[01 ]*$/) // todo
	static radix = 2
	static chars = 8
	// Is always padded, even with spacers.
	static zeroPadded = true
}

export class Oct extends NumericEncoding {
	static validate = (string, separator) => string.match(/^[0-8 ]*$/) // todo
	static radix = 8
	static chars = 3
	// Is always padded, even with spacers.
	static zeroPadded = true
}

export class Dec extends NumericEncoding {
	static validate = (string, separator) => string.match(/^[0-9 ]*$/) // todo
	static radix = 10
	static chars = 3
	// Is not zero padded  in free form (when separators are used).
	static zeroPadded = false
}

export class Hex extends NumericEncoding {
	static validate = (string, separator) => string.match(/^[0-9a-fA-F ]*$/) // todo
	static radix = 16
	static chars = 2
	// Is always padded, even with spacers.
	static zeroPadded = true
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

	_init(separator, radix, chars) {
		this.radix = radix
		this.chars = chars
	}

}


// Idea of what the encoder/decoder interface should look like
/*
var hex = createShortcut(HexEncoder, HexDecoder)

function createShortcut(Encoder, Decoder) {
	var fn = Encoder.convert.bind(Encoder)
	fn.Encoder = Encoder
	fn.encode = Encoder.convert.bind(Encoder)
	if (Decoder) {
		fn.Decoder = Decoder
		fn.decode = Encoder.convert.bind(Encoder)
	}
	return fn
}
*/