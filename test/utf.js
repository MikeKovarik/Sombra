import './testcore.js'
var {bufferFrom, bufferToString, bufferConcat} = sombra


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
