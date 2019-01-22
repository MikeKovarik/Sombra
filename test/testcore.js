var isBrowser = typeof window === 'object'

if (isBrowser) {
	window.global = window
	mocha.setup('bdd')
	setTimeout(() => mocha.run(), 20)
	global.stream = undefined
} else {
	global.chai = require('chai')
	global.sombra = require('../index.js')
	global.stream = require('stream')
}

global.assert = chai.assert

Promise.timeout = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout))

var {bufferFrom} = sombra

global.promisifyStream = function(stream) {
	return new Promise((resolve, reject) => {
		var chunks = []
		stream.on('data', chunk => chunks.push(chunk))
		stream.on('end', () => resolve(Buffer.concat(chunks)))
		stream.on('end', err => reject(err))
	})
}


global.createReadStream = function() {
	var inputStream = new stream.Readable
	inputStream._read = () => {}
	return inputStream
}


global.createSuite = function(name, ...suiteArgs) {
	if (typeof suiteArgs[suiteArgs.length - 1] === 'function')
		var customTests = suiteArgs.pop()
	var results = suiteArgs.pop()
	var options = suiteArgs.pop()

	describe(name, () => {
		if (sombra[name] === undefined) {
			console.error('SOMBRA CLASS UNDEFINED', name)
			return
		}
		var compound = sombra[name]
		if (compound.Encoder)
			createClassSuite(compound.Encoder, options, results, 'encode')
		if (compound.Decoder)
			createClassSuite(compound.Decoder, options, results, 'decode')
		if (customTests)
			customTests()
	})
}


function createClassSuite(Class, options, results, mode = 'encode') {
	if (results === undefined) {
		results = options
		options = undefined
	}
	options = options || {}
	for (var i in results) {
		var pair = results[i]
		results[i] = [bufferFrom(pair[0]), bufferFrom(pair[1])]
	}
	var forEach = runTest => {
		return async () => {
			for (var pair of results) {
				if (mode === 'encode')
					var [from, to] = pair
				else
					var [to, from] = pair
				await runTest(from, to)
			}
		}
	}

	var subName = ` (${JSON.stringify(options)})`
	var argList = JSON.stringify(options)

	it(`.${mode}(${argList})`, forEach(async (from, to) => {
		var result = await Class.convert(from, options)
		//console.log('result', result, typeof result !== 'string' ? bufferToString(result) : '')
		//console.log('epectd', to, typeof to !== 'string' ? bufferToString(to) : '')
		assert.deepEqual(result, to)
	}))

	it(`(new ${Class.name}(${argList})).update() & .digest()` + subName, forEach(async (from, to) => {
		var testedStream = new Class(options)
		var remainder = from
		var killswitch = 20
		//console.log('--------------------------------------------------------')
		//console.log(from, bufferToString(from))
		//console.log(Array.from(from).map(n => n.toString(2)))
		while (remainder.length) {
			var chunk = remainder.slice(0, 5)
			remainder = remainder.slice(5)
			testedStream.update(chunk)
			if (killswitch-- === 0)
				assert.equal('kill', 'switch')
		}
		var result = testedStream.digest()
		//console.log('result', result, bufferToString(result))
		//console.log('epectd', to, bufferToString(to))
		assert.deepEqual(result, to)
	}))

	if (stream) {
		it(`(new (${argList})).pipe() stream` + subName, forEach(async (from, to) => {
			var testedStream = new Class(options)
			var inputStream = createReadStream()
			var remainder = from
			while (remainder.length) {
				await Promise.timeout(5)
				inputStream.push(remainder.slice(0, 5))
				remainder = remainder.slice(5)
			}
			inputStream.push(null)
			inputStream.pipe(testedStream)
			assert.deepEqual(await promisifyStream(testedStream), to)
		}))
	}

}