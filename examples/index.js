var stream = require('stream')
var crypto = require('crypto')
var sombra = require('../index.js')


function promisifyStream(stream) {
	return new Promise((resolve, reject) => {
		var chunks = []
		stream.on('data', chunk => chunks.push(chunk))
		stream.on('end', () => resolve(Buffer.concat(chunks)))
		stream.on('end', err => reject(err))
	})
}

function createStringReadStream(string) {
	var inputStream = new stream.Readable
	inputStream._read = () => {}
	inputStream.push(string)
	inputStream.push(null)
	return inputStream
}

function createConsoleWriteStream(encoding = 'utf8') {
	var outputStream = new stream.Writable
	outputStream._write = (chunk, enc, callback) => {
		console.log(chunk.toString(encoding))
		callback()
	}
	return outputStream
}


// Various means of getting: c5a207aeb567728a4650ee49839a1007ac5bc1d9b09f4140de0bca658f2e05a7
async function testSha256() {
	// Node.js variant
	console.log(crypto.createHash('sha256').update('Information is power').digest().toString('hex'))

	// Sombra is backwards compatible to 'crypto'
	console.log(sombra.createHash('sha256').update('Information is power').digest().toString('hex'))
	// and offers instanciable classes
	console.log((new sombra.Sha256).update('Information is power').digest().toString('hex'))
	// that are also Streams
	createStringReadStream('Information is power')
		.pipe(new sombra.Sha256)
		.pipe(createConsoleWriteStream('hex'))
	// besides static method .encode() (note: this is async and returns promises)
	console.log((await sombra.Sha256.encode('Information is power')).toString('hex'))
	// and the ultimate sugar coated function that returns string instead of raw buffer.
	console.log(await sombra.sha256('Information is power'))
}

async function chainingStreams() {
	//console.log(sombra.Caesar.encode('boop').toString())
	//console.log(sombra.Morse.encode('yllm').toString())
	//console.log((await sombra.Sha256.encode('-.-- .-.. .-.. --')).toString('hex'))
	createStringReadStream('boop')
		// converts 'boop' to 'yllm'
		.pipe(new sombra.Caesar)
		// converts 'yllm' to '-.-- .-.. .-.. --'
		.pipe(new sombra.Morse)
		// hashes '-.-- .-.. .-.. --' to <Buffer eb 5c f0 a3 90 a1 88 98 38 dc ..>
		.pipe(new sombra.Sha256)
		// prints out the buffer as string 'eb5cf0a390a1889838dc1d870ff44aff05d440e9348a8f7308770db56939a551'
		.pipe(createConsoleWriteStream('hex'))
}

async function escapers() {
	console.log(sombra.NcrDec.encode('</div>').toString())
	console.log(sombra.NcrHex.encode('💀').toString()) // &#xd83d;&#xdc80;
	console.log(sombra.Unicode.encode('💀').toString()) // U+D83DU+DC80
}

async function checksums() {
	console.log(sombra.Crc32.encode('Avocados are useless.').toString('hex'))
	console.log(sombra.TwosComplement.encode('Avocados are useless.').toString('hex'))
}

(await sombra.Sha256.encode('Information is power')).toString('hex') // c5a207aeb567728a4650ee49839a1007ac5bc1d9b09f4140de0bca658f2e05a7

chainingStreams()
testSha256()
escapers()
checksums()
