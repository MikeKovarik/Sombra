import './testcore.js'
var {bufferFrom, bufferToString, bufferConcat} = sombra


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
	createSuite('twosComplement', {bits: 16}, [
		['Avocados are useless.', bufferFrom('F826', 'hex')],
	])
	createSuite('twosComplement', {bits: 32}, [
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