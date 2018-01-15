import {bufferFromUtf8, bufferToStringUtf8} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


export class Utf8 extends SombraTransform {

	// TODO: _transform methods for stream
	// TODO: turn this into two transform stream classes (one for decoding, second to encoding)

	static encode = bufferToStringUtf8
	static decode = bufferFromUtf8

	static toString   = bufferToStringUtf8
	static fromBuffer = bufferToStringUtf8
	static fromString = bufferFromUtf8
	static toBuffer   = bufferFromUtf8

}

export var utf8 = Utf8
