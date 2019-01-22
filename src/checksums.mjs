import {bufferFromInt} from './util/buffer.mjs'
import {createApiShortcut} from './util/util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


// Reverses bit order
function bitReversal(x, n) {
	var b = 0
	while (--n >= 0) {
		b <<= 1
		b |= x & 1
		x >>>= 1
	}
	return b
}

// Base class for all inheriting checksum classes.
// Defines basic set of methods each class should have.
class SombraChecksum extends SombraTransform {
	// Takes one optional argument bits (width of bits).
	// 8 by default => returns 1 byte buffer
	// 16 => returns 2 byte buffer
	// 32 => returns 4 byte buffer
	static bits = 8
	// Calling .convertToString will return hex-encoded string.
	static defaultEncoding = 'hex'
}


export class Sum extends SombraChecksum {

	_update(buffer) {
		var value = this.value || 0
		for (var i = 0; i < buffer.length; i++)
			value += buffer[i]
		this.value = value
	}

	_digest() {
		var value = this.value || 0
		return bufferFromInt(value % (2 ** this.bits), this.bits / 8)
	}

}

export class Xor extends SombraChecksum {

	_update(buffer) {
		var value = this.value || 0
		for (var i = 0; i < buffer.length; i++)
			value ^= buffer[i]
		this.value = value
	}

	_digest() {
		var value = this.value || 0
		return bufferFromInt(value % (2 ** this.bits), this.bits / 8)
	}

}

export class TwosComplement extends SombraChecksum {

	_update(buffer) {
		var value = this.value || 0
		for (var i = 0; i < buffer.length; i++)
			value = (value + buffer[i]) & (2 ** this.bits - 1)
		this.value = value
	}

	_digest() {
		var value = this.value || 0
		return bufferFromInt((2 ** this.bits) - value, this.bits / 8)
	}

}





// Base class with implementation of CRC checking and lookup table creation.
// http://www.sunshine2k.de/articles/coding/crc/understanding_crc.html
// http://reveng.sourceforge.net/crc-catalogue/all.htm
class Crc extends SombraChecksum {

	static variants = {
		['crc32']:        {bits: 32, normal: 0x04C11DB7, init: 0xFFFFFFFF, xorOut: 0xFFFFFFFF}, // CRC-32
		['crc16']:        {bits: 16, normal: 0x8005,     init: 0x0000,     xorOut: 0x0000,     inputReflected: false, resultReflected: false}, // CRC-16
		// TODO: Future expansion
		//['crc16-modbus']: {bits: 16, normal: 0x8005,     init: 0xffff,     xorOut: 0x0000,     inputReflected: true,  resultReflected: true}, // CRC-16 (Modbus)
		//['crc16-xmodem']: {bits: 16, normal: 0x1021,     init: 0x0000,     xorOut: 0x0000,     inputReflected: false, resultReflected: false}, // CRC-CCITT (XModem)
		//['crc16-sick']:   {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-16 (Sick)
		//['crc16-0xffff']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (0xFFFF)
		//['crc16-0x1d0f']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (0x1D0F)
		//['crc16-kermit']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (Kermit)
		//['crc16-dnp']:    {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (Kermit)
	}

	// CRC parameters:
	// normal or polynomial - 
	// init value - what the crc starts with, usually 0 or 1s
	// input reflection - each input byte is bitwise reversed (0x82 = 10000010 => 01000001 = 0x41)
	// result reflection - result is bitwise reversed
	// out xor - what to xor the result with before returning it

	// There is variety of CRC algorithms and each has a different init values, lookup table, xor output
	_encodeSetup(options, state) {
		var variant = options.variant || 'crc' + options.bits
		Object.assign(state, Crc.variants[variant])
		// Normal form is bit-reverse of Polynomial form.
		// normal     = 0x04C11DB7 = 00000100110000010001110110110111
		// polynomial = 0xEDB88320 = 11101101101110001000001100100000
		if (state.poly === undefined)
			state.poly = bitReversal(state.normal, state.bits)
		// Generate lookup table on the fly for the CRC this in use.
		if (state.table === undefined)
			state.table = this.constructor.createTable(state.poly)
		// CRC can have predefined initial value. Usually 0 or 1s
		state.value = state.init
	}

	// Each byte has to be xored against current (or initial) value
	_encode(buffer, options, state) {
		// Most of the CRC (sub)algorithms have their own lookup tables.
		var {value, table, inputReflected} = state
		for (var i = 0; i < buffer.length; i++) {
			let byte = buffer[i]
			if (inputReflected)
				byte = bitReversal(byte, 8)
			value = table[(value ^ byte) & 0xFF] ^ (value >>> 8)
		}
		state.value = value
	}

	// Finalizes the execution by xoring current value with variant's final xor value.
	_encodeDigest(options, state) {
		var {value} = state
		if (options.resultReflected)
			value = bitReversal(value, options.bits)
		// Crc value is always XORed at the output. It's usually same as init value. 
		value ^= options.xorOut
		// Bitwise shift ensures 32b number
		value = value >>> 0
		// Convert the int number into buffer.
		return bufferFromInt(value, options.bits / 8)
	}

	// Generates CRC lookup table for given polynomial (every CRC algorithm has different)
	static createTable(poly) {
		var table = new Array(256)
		var c
		for (var n = 0; n < 256; n++) {
			c = n
			for (var k = 0; k < 8; k++) {
				c = ((c & 1) ? (poly ^ (c >>> 1)) : (c >>> 1))
			}
			table[n] = c
		}
		return table
	}

}

/*

// Base class with implementation of CRC checking and lookup table creation.
// http://www.sunshine2k.de/articles/coding/crc/understanding_crc.html
// http://reveng.sourceforge.net/crc-catalogue/all.htm
class Crc extends SombraChecksum {

	static variants = {
		['crc32']:        {bits: 32, normal: 0x04C11DB7, init: 0xFFFFFFFF, xorOut: 0xFFFFFFFF}, // CRC-32
		['crc16']:        {bits: 16, normal: 0x8005,     init: 0x0000,     xorOut: 0x0000,     inputReflected: false, resultReflected: false}, // CRC-16
		// TODO: Future expansion
		//['crc16-modbus']: {bits: 16, normal: 0x8005,     init: 0xffff,     xorOut: 0x0000,     inputReflected: true,  resultReflected: true}, // CRC-16 (Modbus)
		//['crc16-xmodem']: {bits: 16, normal: 0x1021,     init: 0x0000,     xorOut: 0x0000,     inputReflected: false, resultReflected: false}, // CRC-CCITT (XModem)
		//['crc16-sick']:   {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-16 (Sick)
		//['crc16-0xffff']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (0xFFFF)
		//['crc16-0x1d0f']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (0x1D0F)
		//['crc16-kermit']: {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (Kermit)
		//['crc16-dnp']:    {bits: 16, normal: 0x0000,     init: 0x0000,     xorOut: 0x0000}, // CRC-CCITT (Kermit)
	}

	// CRC parameters:
	// normal or polynomial - 
	// init value - what the crc starts with, usually 0 or 1s
	// input reflection - each input byte is bitwise reversed (0x82 = 10000010 => 01000001 = 0x41)
	// result reflection - result is bitwise reversed
	// out xor - what to xor the result with before returning it

	// There is variety of CRC algorithms and each has a different init values, lookup table, xor output
	constructor(options) {
		super(options)
		var variant = this.variant || 'crc' + this.bits
		var variantDescriptor = this.constructor.variants[variant]
		Object.assign(this, variantDescriptor)
		// Normal form is bit-reverse of Polynomial form.
		// normal     = 0x04C11DB7 = 00000100110000010001110110110111
		// polynomial = 0xEDB88320 = 11101101101110001000001100100000
		if (this.poly === undefined)
			this.poly = bitReversal(this.normal, this.bits)
		// Generate lookup table on the fly for the CRC this in use.
		if (this.table === undefined)
			this.table = this.constructor.createTable(this.poly)
		// CRC can have predefined initial value. Usually 0 or 1s
		this.value = this.init
	}

	// Each byte has to be xored against current (or initial) value
	_update(buffer) {
		// Most of the CRC (sub)algorithms have their own lookup tables.
		var {value, table, inputReflected} = this
		for (var i = 0; i < buffer.length; i++) {
			let byte = buffer[i]
			if (inputReflected)
				byte = bitReversal(byte, 8)
			value = table[(value ^ byte) & 0xFF] ^ (value >>> 8)
		}
		this.value = value
	}

	// Finalizes the execution by xoring current value with variant's final xor value.
	_digest() {
		var value = this.value
		if (this.resultReflected)
			value = bitReversal(value, this.bits)
		// Crc value is always XORed at the output. It's usually same as init value. 
		value ^= this.xorOut
		// Bitwise shift ensures 32b number
		value = value >>> 0
		// Convert the int number into buffer.
		return bufferFromInt(value, this.bits / 8)
	}

	// Generates CRC lookup table for given polynomial (every CRC algorithm has different)
	static createTable(poly) {
		var table = new Array(256)
		var c
		for (var n = 0; n < 256; n++) {
			c = n
			for (var k = 0; k < 8; k++) {
				c = ((c & 1) ? (poly ^ (c >>> 1)) : (c >>> 1))
			}
			table[n] = c
		}
		return table
	}

}
*/

export class Crc32 extends Crc {
	static bits = 32
	static variant = 'crc32'
}

export class Crc16 extends Crc {
	static bits = 16
	static variant = 'crc16'
}

/*
// TODO: Future expansion
export class Crc8 extends Crc {
	static bits = 8
	static variant = 'crc8'
}
*/

// Checksums don't have decoders
export var sum = createApiShortcut(Sum, false)
export var xor = createApiShortcut(Xor, false)
export var twosComplement = createApiShortcut(TwosComplement, false)
export var crc = createApiShortcut(Crc, false)
export var crc32 = createApiShortcut(Crc32, false)
export var crc16 = createApiShortcut(Crc16, false)
//export var crc8 = createApiShortcut(Crc8, false)
