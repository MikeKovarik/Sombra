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

/*
// Characters usually take one or two bytes, but emoji and other special unicode characters
// take up to 4 bytes and two characters making it impossible to just iterate over string.
// This function takes string (of one emoji but realistically multiple characters) and returns charCode.
function unicodeCharCode(str) {
	// Strip unicode variation selector and zero-width joiner
	//str = str.replace(/\ufe0f|\u200d/gm, '')
	var i = 0
	var code = 0
	var lastChunk = 0
	while (i < str.length) {
		code = str.charCodeAt(i++)
		if (lastChunk) {
			return 65536 + (lastChunk - 55296 << 10) + (code - 56320)
		} else if (55296 <= code && code <= 56319) {
			lastChunk = code
		} else {
			return code
		}
	}
}

console.log(unicodeCharCode('💀').toString(16))
*/