if (typeof require === 'function') {
	global.sombra = require('../index.js')
	global.Benchmark = require('benchmark')
}


var suite = new Benchmark.Suite;

var {getUtf8SequenceLength, extractUtf8SequenceLead, transformUtf8SequencePayload} = sombra
var {bufferFrom, bufferToString} = sombra
var {getCodePoints, getCodePointsFromString, getCodePointsFromUtf8Buffer} = sombra

var string = '€♦💀čř§ů'
var buffer = bufferFrom(string)

console.log('res', getCodePointsFromUtf8Buffer(buffer))
console.log('cp ', getCodePoints(string))


suite.add('getCodePointsFromUtf8Buffer from buffer', function() {
	getCodePointsFromUtf8Buffer(buffer)
})

suite.add('getCodePointsFromUtf8Buffer from string', function() {
	var b = bufferFrom(string)
	getCodePointsFromUtf8Buffer(b)
})

suite.add('getCodePointsFromString from string', function() {
	getCodePointsFromString(string)
})

suite.add('getCodePointsFromString from buffer', function() {
	var s = bufferToString(buffer)
	getCodePointsFromString(s)
})

suite.add('getCodePoints from buffer', function() {
	getCodePoints(buffer)
})

suite.add('getCodePoints from string', function() {
	getCodePoints(string)
})

// add listeners
var results = []
suite.on('cycle', function(event) {
	var res = String(event.target)
	console.log(res)
	results.push(res)
})
suite.on('complete', function() {
	var res = 'Fastest is ' + this.filter('fastest').map('name')
	console.log(res)
	results.push(res)
	if (typeof document === 'object')
		document.body.innerText = results.join('\n') 
})

suite.run()
