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



describe('complex examples', () => {

	describe('certificate', () => {

		it(`length`, async () => {
			var buffer = bufferFrom(certificateDer, 'base64')
			assert.lengthOf(buffer, 501)
		})

		it(`bytes`, async () => {
			var buffer = bufferFrom(certificateDer, 'base64')
			assert.equal(buffer[0], 48)
			assert.equal(buffer[1], 130)
			assert.equal(buffer[2], 1)
			assert.equal(buffer[3], 241)
		})

		it(`fingerprint`, async () => {
			//var wanted = crypto.createHash('sha1').update(Buffer.from(certificateDer, 'base64')).digest().toString('hex')
			var wanted = '5d05515244dc98b5a8b901173dca49e56eda5120'
			var buffer = bufferFrom(certificateDer, 'base64')
			await sombra.sha1(buffer)
			var result = sombra.hex(buffer)
			assert.equal(result, wanted)
		})

	})

})
