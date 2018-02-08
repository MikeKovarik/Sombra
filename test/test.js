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

var {bufferFrom, bufferToString, bufferConcat} = sombra

var asyncTimeout = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout))

function promisifyStream(stream) {
	return new Promise((resolve, reject) => {
		var chunks = []
		stream.on('data', chunk => chunks.push(chunk))
		stream.on('end', () => resolve(Buffer.concat(chunks)))
		stream.on('end', err => reject(err))
	})
}

function createReadStream() {
	var inputStream = new stream.Readable
	inputStream._read = () => {}
	return inputStream
}

function createSuite(name, ...suiteArgs) {
	if (typeof suiteArgs[suiteArgs.length - 1] === 'function')
		var customTests = suiteArgs.pop()
	var results = suiteArgs.pop()
	var args = suiteArgs.pop()

	describe(name, () => {
		if (sombra[name] === undefined) {
			console.error('SOMBRA CLASS UNDEFINED', name)
			return
		}
		var compound = sombra[name]
		if (compound.Encoder)
			createClassSuite(compound.Encoder, args, results, 'encode')
		if (compound.Decoder)
			createClassSuite(compound.Decoder, args, results, 'decode')
		if (customTests)
			customTests()
	})
}

function createClassSuite(Class, args = [], results, mode = 'encode') {
	if (results === undefined) {
		results = args
		args = []
	}

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

	var subName = ` (${JSON.stringify(args).slice(1, -1)})`
	var argList = JSON.stringify(args).slice(1, -1)

	it(`.${mode}(${argList})`, forEach(async (from, to) => {
		var result = await Class.convert(from, ...args)
		console.log('result', result, bufferToString(result))
		console.log('epectd', to, bufferToString(to))
		assert.deepEqual(result, to)
	}))

	it(`(new ${Class.name}(${argList})).update() & .digest()` + subName, forEach(async (from, to) => {
		var testedStream = new Class(...args)
		var remainder = from
		var killswitch = 10
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
		console.log('result', result, bufferToString(result))
		console.log('epectd', to, bufferToString(to))
		assert.deepEqual(result, to)
	}))

	if (stream) {
		it(`(new (${argList})).pipe() stream` + subName, forEach(async (from, to) => {
			var testedStream = new Class(...args)
			var inputStream = createReadStream()
			var remainder = from
			while (remainder.length) {
				await asyncTimeout(5)
				inputStream.push(remainder.slice(0, 5))
				remainder = remainder.slice(5)
			}
			inputStream.push(null)
			inputStream.pipe(testedStream)
			assert.deepEqual(await promisifyStream(testedStream), to)
		}))
	}

}












describe('utilities', () => {

	it('bufferFromInt()', async () => {
		assert.deepEqual(sombra.bufferFromInt(0xFF, 1), bufferFrom('FF', 'hex'))
		assert.deepEqual(sombra.bufferFromInt(0x2468, 2), bufferFrom('2468', 'hex'))
		assert.deepEqual(sombra.bufferFromInt(0xABCDEF56, 4), bufferFrom('ABCDEF56', 'hex'))
	})

	// TODO. UTF8/UTF16 escaping
	/*
	骨 = [0xE9, 0xAA, 0xA8] = 0x9AA8
	💀 = [0xF0, 0x9F, 0x92, 0x80] = 0xD83D 0xDC80 = 0x1F480
	*/

})

describe('buffer shim', () => {

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
		assert.deepEqual(bufferFrom('骨'), bufferFrom([0xE9, 0xAA, 0xA8]))
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

	it('concat', async () => {
		var buffers = [
			new Uint8Array([226, 130, 172]),
			new Uint8Array([226, 153, 166]),
			new Uint8Array([240, 159, 146, 128]),
		]
		assert.deepEqual(bufferConcat(buffers), bufferFrom([226, 130, 172, 226, 153, 166, 240, 159, 146, 128]))
	})

})

describe('utf8 tools', () => {

	it('getCodePoints() corrupted', async () => {
		var incompleteBuffer = new Uint8Array([166, 240, 159, 146, 128])
		var incompleteString = bufferToString(incompleteBuffer)
		assert.deepEqual(sombra.getCodePoints(incompleteBuffer), [65533, 128128])
		assert.deepEqual(sombra.getCodePoints(incompleteString), [65533, 128128])
	})

	it('codePointToUtf8Sequence()', async () => {
		assert.deepEqual(sombra.codePointToUtf8Sequence(97), [97]) // a
		assert.deepEqual(sombra.codePointToUtf8Sequence(345), [197, 153]) // ř
		assert.deepEqual(sombra.codePointToUtf8Sequence(8364), [226, 130, 172]) // €
		assert.deepEqual(sombra.codePointToUtf8Sequence(128128), [240, 159, 146, 128]) // 💀
	})

	// TODO. UTF8/UTF16 escaping
	/*
	骨 = [0xE9, 0xAA, 0xA8] = 0x9AA8
	💀 = [0xF0, 0x9F, 0x92, 0x80] = 0xD83D 0xDC80 = 0x1F480
	*/

})



describe('hashes', () => {

	createSuite('sha1', [
		['',      'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
		[[0x00],  '5ba93c9db0cff93f52b521d7420e43f6eda2784f'],
		[[0xff],  '85e53271e14006f0265921d02d4d736cdc580b0b'],
		['hello', 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'],
		['Avocados are useless.', 'b37401be9ace578c44a0a5f10412d014d737c49d'],
	])

	createSuite('sha256', [
		['',      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
		[[0x00],  '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d'],
		[[0xff],  'a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89'],
		['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
		['Avocados are useless.', '732a278662fe4fe57913fe31554ba62350301c435ca899f3bf74a848271c341a'],
	])

	createSuite('sha384', [
		['',      '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b'],
		[[0x00],  'bec021b4f368e3069134e012c2b4307083d3a9bdd206e24e5f0d86e13d6636655933ec2b413465966817a9c208a11717'],
		[[0xff],  '43950796d9883503655e35b5190aee687a2dd99f265012625b95753978e4efff3e8414d178a6e2318480d8eb6ddee643'],
		['hello', '59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f'],
		['Avocados are useless.', '8f5ffb1d816e9306f7bb2a0203d02a3d1da0bb1052f95980078fb8d1724ef1c9c622d88c6fb24afc4ccabae74b78673c'],
	])

	createSuite('sha512', [
		['',      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'],
		[[0x00],  'b8244d028981d693af7b456af8efa4cad63d282e19ff14942c246e50d9351d22704a802a71c3580b6370de4ceb293c324a8423342557d4e5c38438f0e36910ee'],
		[[0xff],  '6700df6600b118ab0432715a7e8a68b0bf37cdf4adaf0fb9e2b3ebe04ad19c7032cbad55e932792af360bafaa09962e2e690652bc075b2dad0c30688ba2f31a3'],
		['hello', '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'],
		['Avocados are useless.', '889c8b016febf78e66ee669f8bea7a485b2737c6bfa790ea764f8635977bb1065bf6f0b81a5d8d71ab71d07f1b3cc9b4c15fa849b203b4dc58dea16ad0747a98'],
	])

	if (!sombra.webCrypto) {
		createSuite('md5', [
			['',      'd41d8cd98f00b204e9800998ecf8427e'],
			[[0x00],  '93b885adfe0da089cdf634904fd59f71'],
			[[0xff],  '00594fd4f42ba43fc1ca0427a0576295'],
			['hello', '5d41402abc4b2a76b9719d911017c592'],
			['Avocados are useless.', 'cdf495ea6b5355caeb061913f569bd76'],
		])
	}

})



describe('encodings', () => {


	describe('radix', () => {


		createSuite('base64', [
			['',      ''],
			[[0x00],  'AA=='],
			[[0xff],  '/w=='],
			['a',     'YQ=='],
			['hello', 'aGVsbG8='],
			['💀',    '8J+SgA=='],
			['Avocados are useless.',  'QXZvY2Fkb3MgYXJlIHVzZWxlc3Mu'],
			['cdF0§)ú.g9-ř;°á´$*6💀', 'Y2RGMMKnKcO6Lmc5LcWZO8Kww6HCtCQqNvCfkoA='],
		])


		// Bin is always zero padded, no matter the separator. Also spaced by default
		createSuite('bin', [
			['',      ''],
		])
		createSuite('bin', [''], [
			[[0x00],  '00000000'],
			[[0xff],  '11111111'],
			['hello', '0110100001100101011011000110110001101111'],
			['💀',    '11110000100111111001001010000000'],
		])
		// Not zero padded, no matter the separator.
		createSuite('bin', [' '], [
			[[0x00],  '00000000'],
			['hello', '01101000 01100101 01101100 01101100 01101111'],
			['💀',    '11110000 10011111 10010010 10000000'],
		])
		createSuite('bin', ['-'], [
			['hello', '01101000-01100101-01101100-01101100-01101111'],
		])
		//it('short form decoding', async () => {
		//	assert.deepEqual(sombra.Bin.decodeString('00000011 11111111', ' '), bufferFrom('03ff', 'hex'))
		//	assert.deepEqual(sombra.Bin.decodeString('000-001-010', '-'), bufferFrom('000102', 'hex'))
		//})


		// Hex is always zero padded, no matter the separator. Also spaced by default
		createSuite('hex', [
			['',      bufferFrom('')],
			['hello', bufferFrom('68 65 6c 6c 6f')],
		])
		createSuite('hex', [''], [
			[[0x00],  bufferFrom('00')],
			[[0xff],  bufferFrom('ff')],
			['a',     bufferFrom('61')],
			['hello', bufferFrom('68656c6c6f')],
			['💀',    bufferFrom('f09f9280')],
			['Avocados are useless.', bufferFrom('41766f6361646f7320617265207573656c6573732e')],
			['cdF0§)ú.g9-ř;°á´$*6💀', bufferFrom('63644630c2a729c3ba2e67392dc5993bc2b0c3a1c2b4242a36f09f9280')],
		])
		// Not zero padded, no matter the separator.
		createSuite('hex', [' '], [
			[[0x00],  '00'],
			[[0xff],  'ff'],
			['a',     '61'],
			['hello', '68 65 6c 6c 6f'],
			['💀',    'f0 9f 92 80'],
			['Avocados are useless.', '41 76 6f 63 61 64 6f 73 20 61 72 65 20 75 73 65 6c 65 73 73 2e'],
			['cdF0§)ú.g9-ř;°á´$*6💀', '63 64 46 30 c2 a7 29 c3 ba 2e 67 39 2d c5 99 3b c2 b0 c3 a1 c2 b4 24 2a 36 f0 9f 92 80'],
		])
		createSuite('hex', ['-'], [
			['hello', '68-65-6c-6c-6f'],
		])
		//it('short form decoding', async () => {
		//	assert.deepEqual(sombra.Hex.decodeString('0 0a 3'), bufferFrom('000a03', 'hex'))
		//})


		// Spaced by default. If spaced then not zero-padded
		createSuite('dec', [
			['',      ''],
			['hello', '104 101 108 108 111'],
		])
		// Spaces can be disabled with empty string. Then all numbers are prepended by 0 if they're not 3 digit long.
		createSuite('dec', [''], [
			[[0x00],  '000'],
			[[0xff],  '255'],
			['a',     '097'],
			['hello', '104101108108111'],
			['💀',    '240159146128'],
			['Avocados are useless.', '065118111099097100111115032097114101032117115101108101115115046'],
			['cdF0§)ú.g9-ř;°á´$*6💀', '099100070048194167041195186046103057045197153059194176195161194180036042054240159146128'],
		])
		createSuite('dec', [' '], [
			[[0x00],  '0'],
			[[0xff],  '255'],
			['a',     '97'],
			['hello', '104 101 108 108 111'],
			['💀',    '240 159 146 128'],
			['Avocados are useless.', '65 118 111 99 97 100 111 115 32 97 114 101 32 117 115 101 108 101 115 115 46'],
			['cdF0§)ú.g9-ř;°á´$*6💀', '99 100 70 48 194 167 41 195 186 46 103 57 45 197 153 59 194 176 195 161 194 180 36 42 54 240 159 146 128'],
		])
		//createSuite('dec', ['-'], [
		//	['Avocados are useless.', '65-118-111-99-97-100-111-115-32-97-114-101-32-117-115-101-108-101-115-115-46'],
		//])

	})


	// ཨ  in UTF-8 = 0xE0 0xBD 0xA8; in UTF-16 = 0x0F68
	// 𠀋 in UTF-8 = 0xF0 0xA0 0x80 0x8B, in UTF-16 = 0xD840 0xDC0B, in UTF-32 = 0x0002000B, html entity hex = &#x2000b;
	// 💀 in UTF-8 = 0xF0 0x9F 0x92 0x80, in UTF-16 = 0xD83D 0xDC80, in UTF-32 = 0x0001F480, html entity hex = &#x1f480;

	describe('entity', () => {

		createSuite('ncrdec', [
			['a',    '&#97;'],
			['Σ',    '&#931;'],
			['💀',   '&#128128;'],
			['€♦💀', '&#8364;&#9830;&#128128;'],
			['<>',   '&#60;&#62;'],
		])

		createSuite('ncrhex', [ // TODO: reenable
			['a',    '&#x61;'],
			['Σ',    '&#x3A3;'],
			['💀',   '&#x1F480;'],
			['€♦💀', '&#x20AC;&#x2666;&#x1F480;'],
			['<>',   '&#x3C;&#x3E;'],
		])

		createSuite('unicodeEscaped8', [
			['a',    '\\x61'],
			['Σ',    '\\xCE\\xA3'],
			['💀',   '\\xF0\\x9F\\x92\\x80'],
			['€♦💀', '\\xE2\\x82\\xAC\\xE2\\x99\\xA6\\xF0\\x9F\\x92\\x80'],
			['<>',   '\\x3C\\x3E'],
		])

		createSuite('unicodeEscaped16', [
			['a',    '\\u0061'],
			['Σ',    '\\u03A3'],
			['💀',   '\\uD83D\\uDC80'],
			['€♦💀', '\\u20AC\\u2666\\uD83D\\uDC80'],
			['<>',   '\\u003C\\u003E'],
		])

		createSuite('unicodeEscaped32', [
			['a',    '\\u{61}'],
			['Σ',    '\\u{3A3}'],
			['💀',   '\\u{1F480}'],
			['€♦💀', '\\u{20AC}\\u{2666}\\u{1F480}'],
			['<>',   '\\u{3C}\\u{3E}'],
		])

		createSuite('unicode', [
			['a',    'U+0061'],
			['Σ',    'U+03A3'],
			['💀',   'U+1F480'],
			['€♦💀', 'U+20ACU+2666U+1F480'],
			['<>',   'U+003CU+003E'],
		])

		createSuite('html', [
			['</div>', '&lt;/div&gt;'],
			['foo</div>bar', 'foo&lt;/div&gt;bar'],
			['č</div>💀', 'č&lt;/div&gt;💀'],
		], () => {
			it('decodes empty entities', async () => {
				assert.deepEqual(sombra.html.Decoder.convert(bufferFrom('&lt;/div&;')), bufferFrom('</div'))
			})
			//it('decodes named and number equivalents', async () => {
			//	assert.deepEqual(sombra.html.Decoder.convert(bufferFrom('&lt;&#60;&#x3c;')), bufferFrom('<<'))
			//})
		})

		createSuite('percent', [
			['</div>', '%3C%2F%64%69%76%3E'],
			['💀',     '%F0%9F%92%80'],
		])

		createSuite('url', [
			['</div>', '%3C/div%3E'],
			['💀',     '%F0%9F%92%80'],
		])

		createSuite('urlComponent', [
			['</div>', '%3C%2Fdiv%3E'],
			['💀',     '%F0%9F%92%80'],
		])

	})

})


describe('checksums', () => {


	createSuite('sum', [
		['a',     [0x61]],
		['hello', [0x14]],
		['Avocados are useless.', [0xda]],
	])


	createSuite('xor', [
		['a',     [0x61]],
		['hello', [0x62]],
		['Avocados are useless.', [0x10]],
	])


	createSuite('twosComplement', [
		['a',     [0x9f]],
		['hello', [0xec]],
		['Avocados are useless.', [0x26]],
	])
	createSuite('twosComplement', [{bits: 16}], [
		['Avocados are useless.', bufferFrom('F826', 'hex')],
	])
	createSuite('twosComplement', [{bits: 32}], [
		['Avocados are useless.', bufferFrom('FFFFF826', 'hex')],
	])


	//function testVariant(Class, name, string, result) {
	//	it(name, async () => {
	//		assert.deepEqual(Class.encode(bufferFrom(string), name), bufferFrom(result, 'hex'))
	//	})
	//}

	createSuite('crc32', [
		['',      bufferFrom('00000000', 'hex')],
		[[0x00],  bufferFrom('d202ef8d', 'hex')],
		[[0xff],  bufferFrom('ff000000', 'hex')],
		['a',     bufferFrom('e8b7be43', 'hex')],
		['hello', bufferFrom('3610a686', 'hex')],
		['💀',    bufferFrom('ffa25dce', 'hex')],
		['Avocados are useless.', bufferFrom('71b3f376', 'hex')],
		['cdF0§)ú.g9-ř;°á´$*6💀', bufferFrom('bd892b4e', 'hex')],
	], () => {
		//describe('variants', () => {
			// TODO: add mode CRC algorithms in the future
		//})
	})

	createSuite('crc16', [
		['',      bufferFrom('0000', 'hex')],
		[[0x00],  bufferFrom('0000', 'hex')],
		[[0xff],  bufferFrom('4040', 'hex')],
		['a',     bufferFrom('e8c1', 'hex')],
		['hello', bufferFrom('34d2', 'hex')],
		['💀',    bufferFrom('ee6f', 'hex')],
		['Avocados are useless.', bufferFrom('dbcb', 'hex')],
		['cdF0§)ú.g9-ř;°á´$*6💀', bufferFrom('b15d', 'hex')],
	], () => {
		/*describe('variants', () => {
			testVariant(sombra.Crc16, 'crc16',        'hello', '34d2')
			// TODO: add mode CRC algorithms in the future
			//testVariant(sombra.Crc16, 'crc16-modbus', 'hello', '34f6')
			//testVariant(sombra.Crc16, 'crc16-xmodem', 'hello', 'c362')
			//testVariant(sombra.Crc16, 'crc16-sick',   'hello', 'a0e4')
			//testVariant(sombra.Crc16, 'crc16-0xffff', 'hello', 'd26e')
			//testVariant(sombra.Crc16, 'crc16-0x1d0f', 'hello', '32ac')
			//testVariant(sombra.Crc16, 'crc16-kermit', 'hello', 'cafb')
			//testVariant(sombra.Crc16, 'crc16-dnp'   , 'hello', 'b158')
		})*/
	})
/*
	// TODO: future expansion
	describe('crc8', () => {
		createSuite('crc8', {
			['',      '00'],
			[[0x00],  '00'],
			[[0xff],  'F3'],
			['a',     '20'],
			['hello', '92'],
			['Avocados are useless.', 'DC'],
			//6: '',
			//7: '',
		})
	})
*/
})


describe('ciphers', () => {

	//describe('vigenere', () => {
	//	createSuite('vigenere', {
	// TODO:
	//	})
	//})
/*
	// TODO: work in progress
	createSuite('rot13', {
		['a',     'n'],
		['hello', 'uryyb'],
		['Avocados are useless.', 'Nibpnqbf ner hfryrff.'],
		//7: '', // TODO:
	})
	//createSuite('twosComplement', [16], {
	//	// todo. different key tests
	//})
	it('special characters', async () => {
		assert.deepEqual(sombra.Rot13.encode(bufferFrom('-.§=´')), bufferFrom('-.§=´'))
	})
*/
	createSuite('caesar', [
		['a',     'x'],
		['hello', 'ebiil'],
		['Avocados are useless.', 'Xslzxalp xob rpbibpp.'],
		// special characters
		['-.§=´a', '-.§=´x'],
	])

	createSuite('atbash', [
		['a',     'z'],
		['hello', 'svool'],
		['Avocados are useless.', 'Zelxzwlh ziv fhvovhh.'],
		// special characters
		['-.§=´a', '-.§=´z'],
	])
/*
	createSuite('a1z26', {
		['a',     '1'],
		['hello', '8-5-12-12-15'],
		['Avocados are useless.', '1-22-15-3-1-4-15-19 1-18-5 21-19-5-12-5-19-19.'],
	})
*/
	createSuite('morse', [
		['a',     '.-'],
		['hello', '.... . .-.. .-.. ---'],
		['Avocados are useless.', '.- ...- --- -.-. .- -.. --- ... / .- .-. . / ..- ... . .-.. . ... ... .-.-.-'],
		// special characters
		['&\n', '.-... .-.-..'],
	], () => {
		it('invalid characters throw error by default', async () => {
			try {
				sombra.morse.encode(bufferFrom('řčžw'))
			} catch(e) {
				assert.exists(e)
			}
		})
		it('invalid characters can be ignored, errors suppressed', async () => {
			assert.deepEqual(sombra.morse.encode(bufferFrom('řb'), false), bufferFrom('-...'))
		})
	})

	createSuite('polybius', [
		['a',  '11'],
		['b',  '12'],
		['e',  '15'],
		['f',  '21'],
		['i',  '24'],
		['z',  '55'],
		['hello', '2315313134'],
		['avocados are useless', '1151341311143443 114215 45431531154343'],
	], () => {
		it('maps J as I', async () => {
			assert.deepEqual(sombra.polybius.encodeToString('i'), '24')
			assert.deepEqual(sombra.polybius.encodeToString('j'), '24')
		})
		it('maps A as C', async () => {
			var opts = {charToSkip: 'a', skipAsChar: 'c'}
			assert.deepEqual(sombra.polybius.encodeToString('a', opts), '12')
			assert.deepEqual(sombra.polybius.encodeToString('b', opts), '11')
			assert.deepEqual(sombra.polybius.encodeToString('c', opts), '12')
			assert.deepEqual(sombra.polybius.encodeToString('d', opts), '13')
		})
	})

	createSuite('bifid', [
		['i',  'i'],
		//['j',  'i'],
		['ii', 'gt'],
		['hello', 'fnnvd'],
		['Avocados are useless.', 'Elaoddql tas dsbzpen.'],
		// i and j translates as one character
		// special characters
		['-.§=´a', '-.§=´a'],
	])

})
