import './testcore.js'
var {bufferFrom, bufferToString, bufferConcat} = sombra


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
