import './testcore.js'
var {bufferFrom, bufferToString, bufferConcat} = sombra


var certificateDer = `
MIIB8TCCAVqgAwIBAgIJF7pYoC10fT2eMA0GCSqGSIb3DQEBCwUAMCsxKTAnBgNV
BAMTIE15IFRydXN0ZWQgQ2VydGlmaWNhdGUgQXV0aG9yaXR5MB4XDTE5MDExOTIw
NTQzOFoXDTIwMDExOTIwNTQzOFowKzEpMCcGA1UEAxMgTXkgVHJ1c3RlZCBDZXJ0
aWZpY2F0ZSBBdXRob3JpdHkwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAINh
rIps6Ec5cDUXsa8D8EVk8D2xFI6CpEEOjdYUlX4bp0uxoFc/hqDKReajIi7PpSyr
WjrFl2KLH7TaTsE1EFQg9Qt6eHpHiHbB/e5Ntfgqsh310ukzo5n/hmUT4a3iBU52
WfLZkmLD3Np1jhKE1yXVaRNaGGc7hrxO0oNHzSdpAgMBAAGjHTAbMAwGA1UdEwQF
MAMBAf8wCwYDVR0PBAQDAgL0MA0GCSqGSIb3DQEBCwUAA4GBAGADcaeyYD2GgjSV
HiMHFi1dfjBo8f6yUioeTpClQzyYdU+Tlaxn5Y7E+Vf9NjWR6JgjhIR8wscjbzVG
xXNDY8lP/q7KiQoff38YbGXKDpAsdAWXiI8K7b9y/OSWm7k0Sy+GzeTrTMKdMAZ4
ZlMu5/XGsj/RuQx8iwEMHokKvEkW
`.trim().replace(/\n/g, '')


describe('utilities', () => {

	it(`bufferFromInt()`, async () => {
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

	it(`Buffer from array`, async () => {
		var buffer = bufferFrom([48, 130, 1, 241, 48])
		assert.equal(buffer.length, 5)
		assert.equal(buffer[0], 48)
		assert.equal(buffer[2], 1)
		assert.equal(buffer[4], 48)
	})

	it(`Buffer from Uint8Array`, async () => {
		var uint = new Uint8Array([48, 130, 1, 241, 48])
		var buffer = bufferFrom(uint)
		assert.equal(buffer.length, 5)
		assert.equal(buffer[0], 48)
		assert.equal(buffer[2], 1)
		assert.equal(buffer[4], 48)
	})

	it(`Buffer from string (basic utf8)`, async () => {
		assert.deepEqual(bufferFrom('ab'), bufferFrom([97, 98]))
	})

	it(`Buffer from string (extended)`, async () => {
		assert.deepEqual(bufferFrom('ř'), bufferFrom([0xC5, 0x99]))
	})

	it(`Buffer from string (unicode)`, async () => {
		assert.deepEqual(bufferFrom('☢'), bufferFrom([0xE2, 0x98, 0xA2]))
		assert.deepEqual(bufferFrom('骨'), bufferFrom([0xE9, 0xAA, 0xA8]))
	})

	it(`Buffer to string`, async () => {
		assert.deepEqual(bufferToString(bufferFrom([97, 98, 0xC5, 0x99, 0xE2, 0x98, 0xA2])), 'abř☢')
	})

	it(`Buffer from hex`, async () => {
		assert.deepEqual(bufferFrom('c599e298a2', 'hex'), bufferFrom([0xC5, 0x99, 0xE2, 0x98, 0xA2]))
	})

	it(`Buffer to hex`, async () => {
		assert.deepEqual(bufferToString(bufferFrom([0xC5, 0x99, 0xE2, 0x98, 0xA2]), 'hex'), 'c599e298a2')
	})

	it(`concat`, async () => {
		var buffers = [
			new Uint8Array([226, 130, 172]),
			new Uint8Array([226, 153, 166]),
			new Uint8Array([240, 159, 146, 128]),
		]
		assert.deepEqual(bufferConcat(buffers), bufferFrom([226, 130, 172, 226, 153, 166, 240, 159, 146, 128]))
	})

	describe('base64', () => {

		it(`bufferFrom(..., 'base64') zeroes`, async () => {
			assert.deepEqual(bufferFrom('AA==', 'base64'), bufferFrom([0]))
			assert.deepEqual(bufferFrom('AAA=', 'base64'), bufferFrom([0,0]))
			assert.deepEqual(bufferFrom('AAAA', 'base64'), bufferFrom([0,0,0]))
			assert.deepEqual(bufferFrom('AAAAAA==', 'base64'), bufferFrom([0,0,0,0]))
		})
		it(`bufferFrom(..., 'base64') FFs`, async () => {
			assert.deepEqual(bufferFrom('/w==', 'base64'), bufferFrom([0xFF]))
			assert.deepEqual(bufferFrom('//8=', 'base64'), bufferFrom([0xFF,0xFF]))
			assert.deepEqual(bufferFrom('////', 'base64'), bufferFrom([0xFF,0xFF,0xFF]))
			assert.deepEqual(bufferFrom('/////w==', 'base64'), bufferFrom([0xFF,0xFF,0xFF,0xFF]))
		})

		it(`bufferFrom(..., 'base64') real world data`, async () => {
			assert.deepEqual(bufferFrom('MIIB', 'base64'), bufferFrom([48, 130, 1]))
		})

		it(`bufferToString('base64') zeroes`, async () => {
			assert.deepEqual(bufferToString(bufferFrom([0]), 'base64'), 'AA==')
			assert.deepEqual(bufferToString(bufferFrom([0,0]), 'base64'), 'AAA=')
			assert.deepEqual(bufferToString(bufferFrom([0,0,0]), 'base64'), 'AAAA')
			assert.deepEqual(bufferToString(bufferFrom([0,0,0,0]), 'base64'), 'AAAAAA==')
		})
		it(`bufferToString('base64') FFs`, async () => {
			assert.deepEqual(bufferToString(bufferFrom([0xFF]), 'base64'), '/w==')
			assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF]), 'base64'), '//8=')
			assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF,0xFF]), 'base64'), '////')
			assert.deepEqual(bufferToString(bufferFrom([0xFF,0xFF,0xFF,0xFF]), 'base64'), '/////w==')
		})

		it(`bufferFrom(..., 'base64') advanced`, async () => {
			var buffer1 = bufferFrom('YXZvY2Fkb3MgYXJlIHVzZWxlc3M=', 'base64')
			var buffer2 = bufferFrom('61766f6361646f7320617265207573656c657373', 'hex')
			assert.deepEqual(buffer1, buffer2)
		})

		it(`bufferToString('base64') advanced`, async () => {
			var buffer = bufferFrom('avocados are useless')
			assert.deepEqual(bufferToString(buffer, 'base64'), 'YXZvY2Fkb3MgYXJlIHVzZWxlc3M=')
		})

		it(`certificate DER length`, async () => {
			console.log([48,130,1,241,48,130,1,90,160,3,2,1,2,2,9,23,186])
			var buffer = bufferFrom(certificateDer, 'base64')
			console.log(buffer)
			assert.lengthOf(buffer, 501)
		})

		it(`certificate DER bytes`, async () => {
			var buffer = bufferFrom(certificateDer, 'base64')
			assert.equal(buffer[0], 48)
			assert.equal(buffer[1], 130)
			assert.equal(buffer[2], 1)
			assert.equal(buffer[3], 241)
		})

	})

})
