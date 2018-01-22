var isBrowser = typeof window === 'object'
if (isBrowser) {
	mocha.setup('bdd')
	setTimeout(() => mocha.run(), 20)
} else {
	var chai = require('chai')
	var sombra = require('../index.js')
	var stream = require('stream')
}
var assert = chai.assert

var {bufferFrom, bufferToString} = sombra.util

// TODO: Run the tests in browser without bundled 'buffer' module.
//       Let sombra work with Uint8Array only.

function promisifyStream(stream) {
	return new Promise((resolve, reject) => {
		var chunks = []
		stream.on('data', chunk => chunks.push(chunk))
		stream.on('end', () => resolve(Buffer.concat(chunks)))
		stream.on('end', err => reject(err))
	})
}

var fixtures = {
	0: bufferFrom(''),
	1: bufferFrom([0x00]),
	2: bufferFrom([0xff]),
	3: bufferFrom('a'),
	4: bufferFrom('hello'),
	5: bufferFrom('Avocados are useless.'),
	6: bufferFrom('💀'),
	7: bufferFrom('cdF0§)ú.g9-ř;°á´$*6💀'),
	8: bufferFrom('</div>'),
}



var asyncPromise = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout))

function createReadStream() {
	var inputStream = new stream.Readable
	inputStream._read = () => {}
	return inputStream
}

function createFullSuite(name, ...suiteArgs) {
	if (typeof suiteArgs[suiteArgs.length - 1] === 'function')
		var customTests = suiteArgs.pop()
	var results = suiteArgs.pop()
	var args = suiteArgs.pop()

	describe(name, () => {
		var compound = sombra[name]
		if (compound.Encoder)
			createSuite(compound.Encoder, args, results, 'encode')
		if (compound.Decoder)
			createSuite(compound.Decoder, args, results, 'decode')
		if (customTests)
			customTests()
	})
}

function createSuite(Class, args = [], results, mode = 'encode') {
	if (results === undefined) {
		results = args
		args = []
	}

	var forEach

	if (Array.isArray(results)) {
		for (var i in results) {
			var pair = results[i]
			results[i] = [bufferFrom(pair[0]), bufferFrom(pair[1])]
		}
		forEach = runTest => {
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
	} else {
		for (var i in results)
			if (typeof results[i] === 'string')
				results[i] = bufferFrom(results[i], 'hex')
		forEach = runTest => {
			return async () => {
				for (var i in results) {
					if (mode === 'encode') {
						var from = fixtures[i]
						var to = results[i]
					} else {
						var to = fixtures[i]
						var from = results[i]
					}
					await runTest(from, to)
				}
			}
		}
	}

	var subName = ` (${JSON.stringify(args).slice(1, -1)})`
	var argList = JSON.stringify(args).slice(1, -1)

	it(`.${mode}(${argList})`, forEach(async (from, to) => {
		assert.deepEqual(await Class.convert(from, ...args), to)
	}))
/*
	it(`(new (${argList})).update() & .digest()` + subName, forEach(async (from, to) => {
		var testedStream = new Class(...args)
		var remainder = from
		while (remainder.length) {
			testedStream.update(remainder.slice(0, 5))
			remainder = remainder.slice(5)
		}
		assert.deepEqual(testedStream.digest(), to)
	}))

	it(`(new (${argList})).pipe() stream` + subName, forEach(async (from, to) => {
		var testedStream = new Class(...args)
		var inputStream = createReadStream()
		var remainder = from
		while (remainder.length) {
			await asyncPromise(5)
			inputStream.push(remainder.slice(0, 5))
			remainder = remainder.slice(5)
		}
		inputStream.push(null)
		inputStream.pipe(testedStream)
		assert.deepEqual(await promisifyStream(testedStream), to)
	}))
*/
}










/*
function createSuite(Class, args = [], items) {
	if (items === undefined) {
		items = args
		args = []
	}

	for (var i in items)
		if (typeof items[i] === 'string')
			items[i] = bufferFrom(items[i], 'hex')

	var subName = ` (${JSON.stringify(args).slice(1, -1)})`

	function forEach(runTest) {
		return async () => {
			for (var i in items) {
				var from = fixtures[i]
				var to = items[i]
				await runTest(from, to)
			}
		}
	}

	it('.encode()' + subName, forEach(async (from, to) => {
		assert.deepEqual(await Class.encode(from, ...args), to)
	}))

	if (items[4]) {
		it('.update() & .digest() simple' + subName, async () => {
			var testedStream = new Class(...args)
			testedStream.update('hello')
			assert.deepEqual(testedStream.digest(), items[4])
		})
	}

	if (items[5]) {
		it('.update() & .digest() chunked' + subName, async () => {
			var testedStream = new Class(...args)
			testedStream.update('Avocados')
			testedStream.update(Buffer.from(' '))
			testedStream.update('are ')
			testedStream.update(Buffer.from('use'))
			testedStream.update('less.')
			assert.deepEqual(testedStream.digest(), items[5])
		})
	}

	if (stream && items[4]) {
		it('.pipe() stream simple' + subName, async () => {
			var testedStream = new Class(...args)
			var inputStream = new stream.Readable
			inputStream._read = () => {}
			setTimeout(() => {
				inputStream.push('hello')
				inputStream.push(null)
			}, 5)
			inputStream.pipe(testedStream)
			assert.deepEqual(await promisifyStream(testedStream), items[4])
		})
	}

	if (stream && items[5]) {
		it('.pipe() stream chunked' + subName, async () => {
			var testedStream = new Class(...args)
			var inputStream = new stream.Readable
			inputStream._read = () => {}
			inputStream.push('Avocados')
			inputStream.push(Buffer.from(' '))
			setTimeout(() => {
				inputStream.push('are ')
			}, 5)
			setTimeout(() => {
				inputStream.push(Buffer.from('use'))
				inputStream.push('less.')
				inputStream.push(null)
			}, 10)
			inputStream.pipe(testedStream)
			assert.deepEqual(await promisifyStream(testedStream), items[5])
		})
	}


}


*/














describe('Utilities', () => {

	it('bufferFromInt()', async () => {
		assert.deepEqual(sombra.util.bufferFromInt(0xFF, 1), bufferFrom('FF', 'hex'))
		assert.deepEqual(sombra.util.bufferFromInt(0x2468, 2), bufferFrom('2468', 'hex'))
		assert.deepEqual(sombra.util.bufferFromInt(0xABCDEF56, 4), bufferFrom('ABCDEF56', 'hex'))
	})

})

describe('Buffer shim', () => {

	it('Buffer from array', async () => {
		var buffer = bufferFrom([0, 0x4e, 0xFF])
		assert.equal(buffer.length, 3)
		assert.equal(buffer[0], 0)
		assert.equal(buffer[1], 0x4e)
		assert.equal(buffer[2], 0xFF)
	})

	it('Buffer from string (basic utf8)', async () => {
		assert.deepEqual(bufferFrom('ab'), bufferFrom([97, 98]))
	})
	it('Buffer from string (extended)', async () => {
		assert.deepEqual(bufferFrom('ř'), bufferFrom([0xC5, 0x99]))
	})
	it('Buffer from string (unicode)', async () => {
		assert.deepEqual(bufferFrom('☢'), bufferFrom([0xE2, 0x98, 0xA2]))
	})
	it('Buffer to string', async () => {
		assert.deepEqual(bufferToString(bufferFrom([97, 98, 0xC5, 0x99, 0xE2, 0x98, 0xA2])), 'abř☢')
	})

	it('Buffer from hex', async () => {
		assert.deepEqual(bufferFrom('c599e298a2', 'hex'), bufferFrom([0xC5, 0x99, 0xE2, 0x98, 0xA2]))
	})
	it('Buffer to hex', async () => {
		assert.deepEqual(bufferToString(bufferFrom([0xC5, 0x99, 0xE2, 0x98, 0xA2]), 'hex'), 'c599e298a2')
	})

	it('Buffer from base64', async () => {
		assert.deepEqual(bufferFrom('AA==', 'base64'), bufferFrom([0]))
		assert.deepEqual(bufferFrom('AAA=', 'base64'), bufferFrom([0,0]))
		assert.deepEqual(bufferFrom('AAAA', 'base64'), bufferFrom([0,0,0]))
		assert.deepEqual(bufferFrom('AAAAAA==', 'base64'), bufferFrom([0,0,0,0]))
		assert.deepEqual(bufferFrom('/w==', 'base64'), bufferFrom([0xFF]))
		assert.deepEqual(bufferFrom('//8=', 'base64'), bufferFrom([0xFF,0xFF]))
		assert.deepEqual(bufferFrom('////', 'base64'), bufferFrom([0xFF,0xFF,0xFF]))
		assert.deepEqual(bufferFrom('/////w==', 'base64'), bufferFrom([0xFF,0xFF,0xFF,0xFF]))
	})
	it('Buffer to base64', async () => {
		assert.deepEqual(bufferToString(bufferFrom([0]), 'base64'), 'AA==')
		assert.deepEqual(bufferToString(bufferFrom([0,0]), 'base64'), 'AAA=')
		assert.deepEqual(bufferToString(bufferFrom([0,0,0]), 'base64'), 'AAAA')
		assert.deepEqual(bufferToString(bufferFrom([0,0,0,0]), 'base64'), 'AAAAAA==')
		assert.deepEqual(bufferToString(bufferFrom([0xFF]), 'base64'), '/w==')
		assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF]), 'base64'), '//8=')
		assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF,0xFF]), 'base64'), '////')
		assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF,0xFF,0xFF]), 'base64'), '/////w==')
	})

	it('Buffer from base64 (advanced)', async () => {
		assert.deepEqual(bufferFrom('YXZvY2Fkb3MgYXJlIHVzZWxlc3M=', 'base64'), bufferFrom('61766f6361646f7320617265207573656c657373', 'hex'))
	})
	it('Buffer to base64 (advanced)', async () => {
		assert.deepEqual(bufferToString(bufferFrom('avocados are useless'), 'base64'), 'YXZvY2Fkb3MgYXJlIHVzZWxlc3M=')
	})

})



describe('Hashes', () => {

	describe('Algorithms', () => {
/*
		it('sha1()', async () => {
			assert.equal(await sombra.sha1(EMPTY), SHA1_EMPTY)
			assert.equal(await sombra.sha1(SPACE), SHA1_SPACE)
			assert.equal(await sombra.sha1(HELLO), SHA1_HELLO)
		})

		it('sha256()', async () => {
			assert.equal(await sombra.sha256(EMPTY), SHA256_EMPTY)
			assert.equal(await sombra.sha256(SPACE), SHA256_SPACE)
			assert.equal(await sombra.sha256(HELLO), SHA256_HELLO)
		})

		it('sha384()', async () => {
			assert.equal(await sombra.sha384(EMPTY), SHA384_EMPTY)
			assert.equal(await sombra.sha384(SPACE), SHA384_SPACE)
			assert.equal(await sombra.sha384(HELLO), SHA384_HELLO)
		})

		it('sha512()', async () => {
			assert.equal(await sombra.sha512(EMPTY), SHA512_EMPTY)
			assert.equal(await sombra.sha512(SPACE), SHA512_SPACE)
			assert.equal(await sombra.sha512(HELLO), SHA512_HELLO)
		})

		if (!sombra.webCrypto) {
			it('md5()', async () => {
				assert.equal(await sombra.md5(EMPTY), MD5_EMPTY)
				assert.equal(await sombra.md5(SPACE), MD5_SPACE)
				assert.equal(await sombra.md5(HELLO), MD5_HELLO)
			})
		}
*/
		describe('Sha1', () => {
			createSuite(sombra.Sha1, {
				0: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
				1: '5ba93c9db0cff93f52b521d7420e43f6eda2784f',
				2: '85e53271e14006f0265921d02d4d736cdc580b0b',
				4: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
				5: 'b37401be9ace578c44a0a5f10412d014d737c49d',
			})
		})

		describe('Sha256', () => {
			createSuite(sombra.Sha256, {
				0: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
				1: '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
				2: 'a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89',
				4: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
				5: '732a278662fe4fe57913fe31554ba62350301c435ca899f3bf74a848271c341a',
			})
		})

		describe('Sha384', () => {
			createSuite(sombra.Sha384, {
				0: '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
				1: 'bec021b4f368e3069134e012c2b4307083d3a9bdd206e24e5f0d86e13d6636655933ec2b413465966817a9c208a11717',
				2: '43950796d9883503655e35b5190aee687a2dd99f265012625b95753978e4efff3e8414d178a6e2318480d8eb6ddee643',
				4: '59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f',
				5: '8f5ffb1d816e9306f7bb2a0203d02a3d1da0bb1052f95980078fb8d1724ef1c9c622d88c6fb24afc4ccabae74b78673c',
			})
		})

		describe('Sha512', () => {
			createSuite(sombra.Sha512, {
				0: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
				1: 'b8244d028981d693af7b456af8efa4cad63d282e19ff14942c246e50d9351d22704a802a71c3580b6370de4ceb293c324a8423342557d4e5c38438f0e36910ee',
				2: '6700df6600b118ab0432715a7e8a68b0bf37cdf4adaf0fb9e2b3ebe04ad19c7032cbad55e932792af360bafaa09962e2e690652bc075b2dad0c30688ba2f31a3',
				4: '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043',
				5: '889c8b016febf78e66ee669f8bea7a485b2737c6bfa790ea764f8635977bb1065bf6f0b81a5d8d71ab71d07f1b3cc9b4c15fa849b203b4dc58dea16ad0747a98',
			})
		})

		if (!sombra.webCrypto) {
			describe('Md5', async () => {
				createSuite(sombra.Md5, {
					0: 'd41d8cd98f00b204e9800998ecf8427e',
					1: '93b885adfe0da089cdf634904fd59f71',
					2: '00594fd4f42ba43fc1ca0427a0576295',
					4: '5d41402abc4b2a76b9719d911017c592',
					5: 'cdf495ea6b5355caeb061913f569bd76',
				})
			})
		}

	})
/*
	describe('Syntactic sugar', () => {

		it('Hash.hash() takes string and returns string', async () => {
			assert.equal(await sombra.Sha256.hash(HELLO), SHA256_HELLO)
		})

		it('createHash(name) returns instance of the hash', async () => {
			assert.equal(sombra.createHash('sha256').name, 'Sha256')
		})

		it('hash(data, name) resolves hash of the input string data', async () => {
			assert.equal(await sombra.hash(HELLO, 'sha256'), SHA256_HELLO)
		})

	})
*/
})


describe('Encodings', () => {

	describe('Utf8', () => {

		it('.fromString()', async () => {
			assert.deepEqual(sombra.Utf8.fromString('abcd'), bufferFrom([97, 98, 99, 100]))
			assert.deepEqual(sombra.Utf8.fromString('cdEF0§)úž-'), bufferFrom('6364454630c2a729c3bac5be2d', 'hex'))
		})

		it('.toString()', async () => {
			assert.deepEqual(sombra.Utf8.toString(bufferFrom([97, 98, 99, 100])), 'abcd')
			assert.deepEqual(sombra.Utf8.toString(bufferFrom('6364454630c2a729c3bac5be2d', 'hex')), 'cdEF0§)úž-')
		})

	})

	describe('Base64', () => {
		createSuite(sombra.Base64, {
			0: bufferFrom(''),
			1: bufferFrom('AA=='),
			2: bufferFrom('/w=='),
			3: bufferFrom('YQ=='),
			4: bufferFrom('aGVsbG8='),
			5: bufferFrom('QXZvY2Fkb3MgYXJlIHVzZWxlc3Mu'),
			6: bufferFrom('8J+SgA=='),
			7: bufferFrom('Y2RGMMKnKcO6Lmc5LcWZO8Kww6HCtCQqNvCfkoA='),
		})
	})

	describe('Numeric', () => {

		describe('Bin', () => {
			// Bin is always zero padded, no matter the separator. Also spaced by default
			createSuite(sombra.Bin, {
				0: bufferFrom(''),
			})
			createSuite(sombra.Bin, [''], {
				1: bufferFrom('00000000'),
				2: bufferFrom('11111111'),
				4: bufferFrom('0110100001100101011011000110110001101111'),
				6: bufferFrom('11110000100111111001001010000000'),
			})
			// Not zero padded, no matter the separator.
			createSuite(sombra.Bin, [' '], {
				1: bufferFrom('00000000'),
				4: bufferFrom('01101000 01100101 01101100 01101100 01101111'),
				6: bufferFrom('11110000 10011111 10010010 10000000'),
			})
			createSuite(sombra.Bin, ['-'], {
				4: bufferFrom('01101000-01100101-01101100-01101100-01101111'),
			})

			it('short form decoding', async () => {
				assert.deepEqual(sombra.Bin.decodeString('00000011 11111111', ' '), bufferFrom('03ff', 'hex'))
				assert.deepEqual(sombra.Bin.decodeString('000-001-010', '-'), bufferFrom('000102', 'hex'))
			})
		})

		describe('Hex', () => {
			// Hex is always zero padded, no matter the separator. Also spaced by default
			createSuite(sombra.Hex, {
				0: bufferFrom(''),
				4: bufferFrom('68 65 6c 6c 6f'),
			})
			createSuite(sombra.Hex, [''], {
				1: bufferFrom('00'),
				2: bufferFrom('ff'),
				3: bufferFrom('61'),
				4: bufferFrom('68656c6c6f'),
				5: bufferFrom('41766f6361646f7320617265207573656c6573732e'),
				6: bufferFrom('f09f9280'),
				7: bufferFrom('63644630c2a729c3ba2e67392dc5993bc2b0c3a1c2b4242a36f09f9280'),
			})
			// Not zero padded, no matter the separator.
			createSuite(sombra.Hex, [' '], {
				1: bufferFrom('00'),
				2: bufferFrom('ff'),
				3: bufferFrom('61'),
				4: bufferFrom('68 65 6c 6c 6f'),
				5: bufferFrom('41 76 6f 63 61 64 6f 73 20 61 72 65 20 75 73 65 6c 65 73 73 2e'),
				6: bufferFrom('f0 9f 92 80'),
				7: bufferFrom('63 64 46 30 c2 a7 29 c3 ba 2e 67 39 2d c5 99 3b c2 b0 c3 a1 c2 b4 24 2a 36 f0 9f 92 80'),
			})
			createSuite(sombra.Hex, ['-'], {
				4: bufferFrom('68-65-6c-6c-6f'),
			})
			it('short form decoding', async () => {
				assert.deepEqual(sombra.Hex.decodeString('0 0a 3'), bufferFrom('000a03', 'hex'))
			})
		})

		describe('Dec', () => {
			// Spaced by default. If spaced then not zero-padded
			createSuite(sombra.Dec, {
				0: bufferFrom(''),
				4: bufferFrom('104 101 108 108 111'),
			})
			// Spaces can be disabled with empty string. Then all numbers are prepended by 0 if they're not 3 digit long.
			createSuite(sombra.Dec, [''], {
				1: bufferFrom('000'),
				2: bufferFrom('255'),
				3: bufferFrom('097'),
				4: bufferFrom('104101108108111'),
				5: bufferFrom('065118111099097100111115032097114101032117115101108101115115046'),
				6: bufferFrom('240159146128'),
				7: bufferFrom('099100070048194167041195186046103057045197153059194176195161194180036042054240159146128'),
			})
			createSuite(sombra.Dec, [' '], {
				1: bufferFrom('0'),
				2: bufferFrom('255'),
				3: bufferFrom('97'),
				4: bufferFrom('104 101 108 108 111'),
				5: bufferFrom('65 118 111 99 97 100 111 115 32 97 114 101 32 117 115 101 108 101 115 115 46'),
				6: bufferFrom('240 159 146 128'),
				7: bufferFrom('99 100 70 48 194 167 41 195 186 46 103 57 45 197 153 59 194 176 195 161 194 180 36 42 54 240 159 146 128'),
			})
			createSuite(sombra.Dec, ['-'], {
				5: bufferFrom('65-118-111-99-97-100-111-115-32-97-114-101-32-117-115-101-108-101-115-115-46'),
			})
		})

	})

	// ཨ  in UTF-8 = 0xE0 0xBD 0xA8; in UTF-16 = 0x0F68
	// 𠀋 in UTF-8 = 0xF0 0xA0 0x80 0x8B, in UTF-16 = 0xD840 0xDC0B, in UTF-32 = 0x0002000B, html entity hex = &#x2000b;
	// 💀 in UTF-8 = 0xF0 0x9F 0x92 0x80, in UTF-16 = 0xD83D 0xDC80, in UTF-32 = 0x0001F480, html entity hex = &#x1f480;

	describe('Entity', () => {

		createFullSuite('ncrdec', [
			['a',   '&#97;'],
			['Σ',   '&#931;'],
			['💀',   '&#128128;'],
			['€♦💀', '&#8364;&#9830;&#128128;'],
			['<>',  '&#60;&#62;'],
			//['</div>', '&#60;/div&#62;'], // TODO - advanced in place en/decoding
		])

		createFullSuite('ncrhex', [
			['a',  '&#x61;'],
			['Σ',  '&#x3a3;'],
			['💀',  '&#x1f480;'],
			['€♦💀', '&#x20ac;&#x2666;&#x1f480;'],
			['<>',  '&#x3c;&#x3e;'],
			//['</div>', '&#x3c;/div&#x3e;'], // TODO - advanced in place en/decoding
		])

		createFullSuite('unicodeescaped', [
			['a',   '\\u61'],
			['Σ',   '\\u3a3'],
			['💀',   '\\u1f480'],
			['€♦💀', '\\u20ac\\u2666\\u1f480'],
			['<>',  '\\u3c\\u3e'],
			//['</div>', '\\u3c/div\\u3e'], // TODO - advanced in place en/decoding
		])

		createFullSuite('unicode', [
			['a',   'U+0061'],
			['Σ',   'U+03A3'],
			['💀',   'U+1F480'],
			['€♦💀', 'U+20ACU+2666U+1F480'],
			['<>',  'U+003CU+003E'],
			//['</div>', 'U+003C/divU+003E'], // TODO - advanced in place en/decoding
		])

		createFullSuite('html', [
			['</div>', '&lt;/div&gt;'],
		], () => {
			//it('decodes named and number equivalents', async () => {
			//	assert.deepEqual(sombra.html.Decoder.convert(bufferFrom('&lt;&#60;&#x3c;')), bufferFrom('<<'))
			//})
		})

	})

})

describe('Checksums', () => {

	describe('Sum', () => {
		createSuite(sombra.Sum, {
			3: '61',
			4: '14',
			5: 'da',
		})
	})

	describe('Xor', () => {
		createSuite(sombra.Xor, {
			3: '61',
			4: '62',
			5: '10',
		})
	})

	describe('TwosComplement', () => {
		createSuite(sombra.TwosComplement, {
			3: '9f',
			4: 'ec',
			5: '26',
		})
		createSuite(sombra.TwosComplement, [16], {
			5: 'F826',
		})
		createSuite(sombra.TwosComplement, [32], {
			5: 'FFFFF826',
		})
	})


	function testVariant(Class, name, string, result) {
		it(name, async () => {
			assert.deepEqual(Class.encode(bufferFrom(string), name), bufferFrom(result, 'hex'))
		})
	}

	describe('Crc32', () => {
		createSuite(sombra.Crc32, {
			0: '00000000',
			1: 'd202ef8d',
			2: 'ff000000',
			3: 'e8b7be43',
			4: '3610a686',
			5: '71b3f376',
			6: 'ffa25dce',
			7: 'bd892b4e',
		})
		//describe('Variants', () => {
			// TODO: add mode CRC algorithms in the future
		//})
	})

	describe('Crc16', () => {
		createSuite(sombra.Crc16, {
			0: '0000', // todo
			1: '0000', // todo
			2: '4040', // todo
			3: 'e8c1',
			4: '34d2',
			5: 'dbcb',
			6: 'ee6f',
			7: 'b15d',
		})

		describe('Variants', () => {
			testVariant(sombra.Crc16, 'crc16',        'hello', '34d2')
			// TODO: add mode CRC algorithms in the future
			//testVariant(sombra.Crc16, 'crc16-modbus', 'hello', '34f6')
			//testVariant(sombra.Crc16, 'crc16-xmodem', 'hello', 'c362')
			//testVariant(sombra.Crc16, 'crc16-sick',   'hello', 'a0e4')
			//testVariant(sombra.Crc16, 'crc16-0xffff', 'hello', 'd26e')
			//testVariant(sombra.Crc16, 'crc16-0x1d0f', 'hello', '32ac')
			//testVariant(sombra.Crc16, 'crc16-kermit', 'hello', 'cafb')
			//testVariant(sombra.Crc16, 'crc16-dnp'   , 'hello', 'b158')
		})

	})
/*
	describe('Crc8', () => {
		createSuite(sombra.Crc8, {
			0: '00',
			1: '00',
			2: 'F3',
			3: '20',
			4: '92',
			5: 'DC',
			//6: '',
			//7: '',
		})
	})
*/
})


describe('Ciphers', () => {

	//describe('Vigenere', () => {
	//	createSuite(sombra.Vigenere, {
	// TODO:
	//	})
	//})
/*
	// TODO: work in progress
	describe('Rot13', () => {
		createSuite(sombra.Rot13, {
			3: bufferFrom('n'),
			4: bufferFrom('uryyb'),
			5: bufferFrom('Nibpnqbf ner hfryrff.'),
			//7: '', // TODO:
		})
		//createSuite(sombra.TwosComplement, [16], {
		//	// todo. different key tests
		//})
		it('special characters', async () => {
			assert.deepEqual(sombra.Rot13.encode(bufferFrom('-.§=´')), bufferFrom('-.§=´'))
		})
	})
*/
	describe('Caesar', () => {
		createSuite(sombra.Caesar, {
			3: bufferFrom('x'),
			4: bufferFrom('ebiil'),
			5: bufferFrom('Xslzxalp xob rpbibpp.'),
			//7: '', // TODO:
		})
		it('special characters', async () => {
			assert.deepEqual(sombra.Caesar.encode(bufferFrom('-.§=´a')), bufferFrom('-.§=´x'))
		})
	})

	// TODO: work in progress
	describe('Atbash', () => {
		createSuite(sombra.Atbash, {
			3: bufferFrom('z'),
			4: bufferFrom('svool'),
			5: bufferFrom('Zelxzwlh ziv fhvovhh.'),
		})
		it('special characters', async () => {
			assert.deepEqual(sombra.Atbash.encode(bufferFrom('-.§=´a')), bufferFrom('-.§=´z'))
		})
		it('.decode()', async () => {
			assert.deepEqual(sombra.Atbash.decode(bufferFrom('Zelxzwlh ziv fhvovhh.')), bufferFrom('Avocados are useless.'))
		})
	})
/*
	describe('A1z26', () => {
		createSuite(sombra.A1z26, {
			3: bufferFrom('1'),
			4: bufferFrom('8-5-12-12-15'),
			5: bufferFrom('1-22-15-3-1-4-15-19 1-18-5 21-19-5-12-5-19-19.'),
		})
	})
*/
	describe('Morse', () => {
		createSuite(sombra.Morse, {
			3: bufferFrom('.-'),
			4: bufferFrom('.... . .-.. .-.. ---'),
			5: bufferFrom('.- ...- --- -.-. .- -.. --- ... / .- .-. . / ..- ... . .-.. . ... ... .-.-.-'),
		})
		it('.decode()', async () => {
			var input = '.- ...- --- -.-. .- -.. --- ... / .- .-. . / ..- ... . .-.. . ... ... .-.-.-'
			var result = 'avocados are useless.'
			assert.deepEqual(sombra.Morse.decode(bufferFrom(input)), bufferFrom(result))
		})
		it('special characters', async () => {
			assert.deepEqual(sombra.Morse.encode(bufferFrom('&\n')), bufferFrom('.-... .-.-..'))
		})
		it('invalid characters throw error by default', async () => {
			try {
				sombra.Morse.encode(bufferFrom('řčžw'))
			} catch(e) {
				assert.exists(e)
			}
		})
		it('invalid characters can be ignored, errors suppressed', async () => {
			assert.deepEqual(sombra.Morse.encode(bufferFrom('řb'), false), bufferFrom('-...'))
		})
	})

})


describe('Chaining & Streaming', () => {
/*
	it('chaining', async () => {
		var input = 'hello world'
		var output = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'
		const hash = crypto.createHash('sha1')
		input.pipe(hash).pipe(process.stdout)
		assert.equal(result, output)
	})
*/
})

