import _nodeCrypto from 'crypto'


export var nodeCrypto = _nodeCrypto.createCipheriv && _nodeCrypto.Hash ? _nodeCrypto : undefined
export var webCrypto = typeof window === 'object' ? window.crypto : undefined

export var platform = {
	node: typeof process === 'object' && process.versions.v8,
	uwp: typeof Windows === 'object',
	browser: typeof navigator === 'object',
}

export function iterator() {
	return {
		i: 0,
		values: Object.values(Sombra),
		next() {
			return {
				value: this.values[this.i++],
				done: this.i > this.values.length,
			}
		}
	}
}

export function createApiShortcut(Class, hasDecoder = true) {
	var {name} = Class
	var fn = Class.encodeToString.bind(Class)
	fn.Encoder = Class
	fn.encode = Class.encode.bind(Class)
	fn.encodeToString = Class.encodeToString.bind(Class)
	//if (hasDecoder !== false) {
	if (Class.prototype._decode) {
		class Decoder extends Class {
			static decoder = true
			decoder = true
		}
		Object.defineProperty(Decoder, 'name', {value: name + 'Decoder'})
		fn.Decoder = Decoder
		fn.decode = Class.decode.bind(Class)
		fn.decodeToString = Class.decodeToString.bind(Class)
	}
	return fn
}


/*
export function chain(input, actions, returnBuffer = false, defaultAction = 'encode') {
	var state = input
	// convert given string to buffer
	if (typeof state == 'string') {
		state = Sombra.string.decode(state)
	}
	// 
	if (typeof actions[0] == 'string') {
		actions = actions.map(name => [name, defaultAction])
	}
	// run the pipeline
	actions.forEach(action => {
		var [algorithm, method, ...args] = action
		state = Sombra[algorithm][method](state, ...args)
	})
	// convert buffer to string
	if (returnBuffer == false) {
		state = Sombra.string.encode(state)
	}
	return state
}
*/
