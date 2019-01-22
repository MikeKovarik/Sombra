import './testcore.js'
var {bufferFrom, bufferToString, bufferConcat} = sombra


describe('ciphers', () => {

	createSuite('rot5', [
		['123',        '678'],
		['123hello',   '678hello'],
		['2.4;6-8 10', '7.9;1-3 65'],
	])

	createSuite('rot13', [
		['a',        'n'],
		['hello',    'uryyb'],
		['123hello', '123uryyb'],
		['Avocados are useless.', 'Nibpnqbf ner hfryrff.'],
	])

	createSuite('rot18', [
		['hello',       'uryyb'],
		['123hello',    '678uryyb'],
		['L0s Mu3r7o5', 'Y5f Zh8e2b0'],
	])

	createSuite('caesar', [
		['a',     'x'],
		['hello', 'ebiil'],
		['Avocados are useless.', 'Xslzxalp xob rpbibpp.'],
		// special characters
		['-.§=´a', '-.§=´x'],
	])

	createSuite('vigenere', {key: 'sombra'}, [
		['a',            'a'],
		['aaaaaaaaaaaa', 'sombrasombra'],
		['hello',        'zsxmf'],
		['Avocados are useless.', 'Sjadrdgg msv uksxfjs.'],
	])

	createSuite('atbash', [
		['a',     'z'],
		['hello', 'svool'],
		['Avocados are useless.', 'Zelxzwlh ziv fhvovhh.'],
		// special characters
		['-.§=´a', '-.§=´z'],
	])

	createSuite('a1z26', [
		['a',     '1'],
		['hello', '8-5-12-12-15'],
		['Avocados are useless.', '1-22-15-3-1-4-15-19 1-18-5 21-19-5-12-5-19-19.'],
	])

	createSuite('morse', [
		['a',     '.-'],
		['hello', '.... . .-.. .-.. ---'],
		['avocados are useless.', '.- ...- --- -.-. .- -.. --- ... / .- .-. . / ..- ... . .-.. . ... ... .-.-.-'],
		// special characters
		['&\n', '.-... .-.-..'],
	], () => {
		it('uppercase characters are transformed to lower case', async () => {
			assert.deepEqual(sombra.morse('hello'), '.... . .-.. .-.. ---')
			assert.deepEqual(sombra.morse('HeLlO'), '.... . .-.. .-.. ---')
		})
		it('invalid characters throw error by default', async () => {
			try {
				sombra.morse.encode(bufferFrom('řčžw'))
			} catch(e) {
				assert.exists(e)
			}
		})
		it('invalid characters can be ignored, errors suppressed', async () => {
			assert.deepEqual(sombra.morse.encode(bufferFrom('řb'), {throwErrors: false}), bufferFrom('-...'))
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
			var opts = {charToReplace: 'a', replaceWith: 'c'}
			assert.deepEqual(sombra.polybius.encodeToString('a', opts), '12')
			assert.deepEqual(sombra.polybius.encodeToString('b', opts), '11')
			assert.deepEqual(sombra.polybius.encodeToString('c', opts), '12')
			assert.deepEqual(sombra.polybius.encodeToString('d', opts), '13')
		})
	})

	createSuite('bifid', [
		['i',  'i'],
		['ii', 'gt'],
		// complex examples
		['hello', 'fnnvd'],
		['Avocados are useless.', 'Elaoddql tas dsbzpen.'],
		// special characters
		['-.§=´a', '-.§=´a'],
	], () => {
		it('maps J as I', async () => {
			assert.deepEqual(sombra.bifid.encodeToString('i'), 'i')
			assert.deepEqual(sombra.bifid.encodeToString('j'), 'i')
			assert.deepEqual(sombra.bifid.encodeToString('iii'), 'git')
			assert.deepEqual(sombra.bifid.encodeToString('jij'), 'git')
		})
		it('maps A as C', async () => {
			var opts = {charToReplace: 'a', replaceWith: 'c'}
			assert.deepEqual(sombra.bifid.encodeToString('aba', opts), 'bcc')
			assert.deepEqual(sombra.bifid.encodeToString('abc', opts), 'bcc')
			assert.deepEqual(sombra.bifid.encodeToString('cbc', opts), 'bcc')
		})
	})

	createSuite('bifid', {charToSkip: 'q'}, [
		['i', 'i'],
		['j', 'j'],
		['ij', 'gu'],
		// 'q' is not encoded, just copied
		['q', 'q'],
		['qqq', 'qqq'],
		['qyoq', 'qxuq'],
		// complex examples
		['hello', 'fmmwj'],
		['Avocados are useless.', 'Ekanddpk tax dxbzojm.'],
	])

})
