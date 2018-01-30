import {bufferAlloc, bufferToString, bufferFrom} from './node-builtins.mjs'
import {bufferFromInt} from './node-builtins.mjs'
import {SombraTransform} from './SombraTransform.mjs'
import {finalizeEncoding, fromString} from './encodings.mjs'


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

	// TODO: work this into .encode() and .convert() in parent class
	static defaultEncoding = 'hex'

	// All checksums start with 0.
	_init() {
		//console.log('shared._init()', arg)
		this.value = 0
	}

	// TODO: should this be moved to parent class?
	static toString(buffer, arg) {
		return finalizeEncoding(this.encode(buffer, arg), 'hex')
	}

	// todo, figure out naming conventions. hash/convert
	static hash(string, arg) {
		var buffer = bufferFrom(string)
		buffer = this.encode(buffer, arg)
		return bufferToString(buffer, 'hex')
	}

}

// Base class for simple checksum classes.
class SombraSimpleChecksum extends SombraChecksum {

	// All simple checksums start with 0.
	_init(arg) {
		//console.log('shared._init()', arg)
		this.value = 0
	}

	// Takes one optional argument size (width of bits).
	// 8 by default => returns 1 byte buffer
	// 16 => returns 2 byte buffer
	// 32 => returns 4 byte buffer
	static args = [{
		title: 'Bit size',
		default: 8
	}]

}


export class Sum extends SombraSimpleChecksum {

	_update(buffer) {
		for (var i = 0; i < buffer.length; i++)
			this.value += buffer[i]
	}

	_digest(size) {
		return bufferFromInt(this.value % (2 ** size), size / 8)
	}

}

export class Xor extends SombraSimpleChecksum {

	_update(buffer) {
		for (var i = 0; i < buffer.length; i++)
			this.value ^= buffer[i]
	}

	_digest(size) {
		return bufferFromInt(this.value % (2 ** size), size / 8)
	}

}

export class TwosComplement extends SombraSimpleChecksum {

	_update(buffer, size) {
		var value = this.value
		for (var i = 0; i < buffer.length; i++)
			value = (value + buffer[i]) & (2 ** size - 1)
		this.value = value
	}

	_digest(size) {
		return bufferFromInt((2 ** size) - this.value, size / 8)
	}

}





// Base class with implementation of CRC checking and lookup table creation.
// http://www.sunshine2k.de/articles/coding/crc/understanding_crc.html
// http://reveng.sourceforge.net/crc-catalogue/all.htm
class SombraCrcChecksum extends SombraChecksum {

	// CRC parameters:
	// normal or polynomial - 
	// init value - what the crc starts with, usually 0 or 1s
	// input reflection - each input byte is bitwise reversed (0x82 = 10000010 => 01000001 = 0x41)
	// result reflection - result is bitwise reversed
	// out xor - what to xor the result with before returning it

	// There is variety of CRC algorithms and each has a different init values, lookup table, xor output
	_init(options) {
		var {variantName} = options
		//console.log('crc._init', variantName)
		var variant = this.constructor.variants[variantName]
		// Normal form is bit-reverse of Polynomial form.
		// normal     = 0x04C11DB7 = 00000100110000010001110110110111
		// polynomial = 0xEDB88320 = 11101101101110001000001100100000
		if (variant.poly === undefined)
			variant.poly = bitReversal(variant.normal, variant.size)
		// Generate lookup table on the fly for the CRC variant in use.
		if (variant.table === undefined)
			variant.table = this.constructor.createTable(variant.poly)
		this.variant = variant
		// CRC can have predefined initial value. Usually 0 or 1s
		this.value = variant.init
	}

	// Each byte has to be xored against current (or initial) value
	_update(buffer) {
		//console.log('crc32._update')
		// Most of the CRC (sub)algorithms have their own lookup tables.
		var value = this.value
		var {table, inputReflected} = this.variant
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
		//console.log('crc32._digest')
		var value = this.value
		if (this.variant.resultReflected)
			this.value = bitReversal(this.value, size)
		// Crc value is always XORed at the output. It's usually same as init value. 
		value ^= this.variant.xorOut
		// Bitwise shift ensures 32b number
		value = value >>> 0
		// Convert the int number into buffer.
		return bufferFromInt(value, this.variant.size / 8)
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


export class Crc32 extends SombraCrcChecksum {

	static args = [{
		title: 'Algorithm',
		default: 'crc32'
	}]

	static size = 32

	static variants = {
		['crc32']: {size: 32, normal: 0x04C11DB7, init: 0xFFFFFFFF, xorOut: 0xFFFFFFFF} // CRC-32
	}

}

export class Crc16 extends SombraCrcChecksum {

	static args = [{
		title: 'Algorithm',
		default: 'crc16'
	}]

	static size = 16

	static variants = {
		['crc16']:        {size: 16, normal: 0x8005, init: 0x0000, xorOut: 0x0000, inputReflected: false, resultReflected: false}, // CRC-16
		// TODO
		//['crc16-modbus']: {size: 16, normal: 0x8005, init: 0xffff, xorOut: 0x0000, inputReflected: true,  resultReflected: true}, // CRC-16 (Modbus)
		//['crc16-xmodem']: {size: 16, normal: 0x1021, init: 0x0000, xorOut: 0x0000, inputReflected: false, resultReflected: false}, // CRC-CCITT (XModem)
		//['crc16-sick']:   {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-16 (Sick)
		//['crc16-0xffff']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (0xFFFF)
		//['crc16-0x1d0f']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (0x1D0F)
		//['crc16-kermit']: {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (Kermit)
		//['crc16-dnp']:    {size: 16, normal: 0x0000, init: 0x0000, xorOut: 0x0000}, // CRC-CCITT (Kermit)
	}

}
