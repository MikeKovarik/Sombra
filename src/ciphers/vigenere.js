
/*

BOOO extremely experimental


Vigenère decipher
A Caesar cipher except with multiple shift values

https://cryptii.com/pipes/vigenere-cipher

variant
	- normal
	- beaufort
	- variant beaufort
	- trithemius

key mode
	- repeat
	- auto key

alphabet

case sensitivity
	- yes
	- no

foreign characters
	- ignore
	- include


*/


/*
// Like casear, but
class Vigenere extends SombraTransform {

	// Is not lossless. Decoding won't yield exact copy of input.
	static lossless = false

	static key = ''

	_encode(chunk, options) {
	}

	_decode(chunk, options) {
	}

}
*/






var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
		'abcdefghijklmnopqrstuvwxyz .,?!-_;:+1234567890"'

function vigenere(msg, key, decrypt) {
	if (!key) return msg

	var code = '', msgChr, keyChr, msgPos, keyPos, alphPos

	for (var i = 0; i < msg.length; i++) {
		msgChr = msg.charAt(i)
		keyChr = key.charAt(i % key.length)
		//console.log(msgChr, keyChr)

		msgPos = alphabet.indexOf(msgChr)
		keyPos = alphabet.indexOf(keyChr)

		// If msgChr og keyChr is not present in alphabet, use it unencrypted.
		if (msgPos < 0 || keyPos < 0) {
			code += msgChr
		} else {
			if (!decrypt) {
				alphPos = (msgPos + keyPos) % alphabet.length
			} else {
				alphPos = msgPos - keyPos
				if (alphPos < 0) {
					alphPos += alphabet.length
				}
			}
			code += alphabet.charAt(alphPos)
		}
	}

	return code
}


// Demonstration
var key = 'a2e7j6ic78h0j7eiejd0120'
var input = 'Ukbn Txltbz nal hh Uoxelmgox wdvg Akw; hvu ogl rsm ar sbv ix jwz'

var decrypted = vigenere(input, key)
var encrypted = vigenere(decrypted, key)

console.log('Original:  ', input)
console.log('Decrypted: ', decrypted)
console.log('Encrypted: ', encrypted)



var lowerCaseStart = 'a'.charCodeAt()
var upperCaseStart = 'A'.charCodeAt()

// from http://eli40.com/rights/cicada/04-reddit/
function UpdateVigenere(message, key) {
	var keyCodes = key
		.split('')
		.map(char => char.match(/[0-9a-z]/i) ? char.charCodeAt() : 0)
		.map(code => code >= 97 ? code - 87 : code - 48) // modified cicada 3301 vigenere?
	var d = 0
	var output = ''
	for (var c = 0; c < message.length; c++) {
		var g = message[c];
		if (g.match(/[a-z]/i)) {
			let e = keyCodes[d]
			d = (d + 1) % keyCodes.length
			let k = g == g.toLowerCase() ? lowerCaseStart : upperCaseStart
			g = String.fromCharCode((g.charCodeAt() - k - e + 26) % 26 + k);
		}
		output += g
	}
	return output
}

console.log(UpdateVigenere(input, key))







/*
console.log('|' + vigenere('hello', 'key') + '|')


function vigenere(input, key) {
	var output = "";
	for (var i = 0, j = 0; i < input.length; i++) {
		var c = input.charCodeAt(i);
		if (isUppercase(c)) {
			output += String.fromCharCode((c - 65 + key[j % key.length]) % 26 + 65);
			j++;
		} else if (isLowercase(c)) {
			output += String.fromCharCode((c - 97 + key[j % key.length]) % 26 + 97);
			j++;
		} else {
			output += input.charAt(i);
		}
	}
	return output;
}

 
// * Returns an array of numbers, each in the range [0, 26), representing the given key.
// * The key is case-insensitive, and non-letters are ignored.
// * Examples:
// * - filterKey("AAA") = [0, 0, 0].
// * - filterKey("abc") = [0, 1, 2].
// * - filterKey("the $123# EHT") = [19, 7, 4, 4, 7, 19].
function filterKey(key) {
	var result = [];
	for (var i = 0; i < key.length; i++) {
		var c = key.charCodeAt(i);
		if (isLetter(c))
			result.push((c - 65) % 32);
	}
	return result;
}


// Tests whether the specified character code is a letter.
function isLetter(c) {
	return isUppercase(c) || isLowercase(c);
}

// Tests whether the specified character code is an uppercase letter.
function isUppercase(c) {
	return 65 <= c && c <= 90;  // 65 is character code for 'A'. 90 is 'Z'.
}

// Tests whether the specified character code is a lowercase letter.
function isLowercase(c) {
	return 97 <= c && c <= 122;  // 97 is character code for 'a'. 122 is 'z'.
}
*/