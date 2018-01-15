import {bufferFrom, bufferToString} from './node-builtins.mjs'
import {platform} from './util.mjs'
import {SombraTransform} from './SombraTransform.mjs'


// TODO: decode
// TODO: make decoder streamable (through _update and _digest), because the chunks might be split
//       right in the middle of entity - &#x at the end of one, the hex value at the beginning of second chunk.
export class EntityEncoding extends SombraTransform {

	_encode(buffer) {
		var input = bufferToString(buffer)
		var output = ''
		for (var i = 0; i < input.length; i++) {
			output += this._encodeCharacter(input.charCodeAt(i))
		}
		return bufferFrom(output)
	}

	_decode(buffer) {
		// TODO: 
		// - search for the beginning of prefix
		// - select the whole entity
		//   - Unicode is always 4 hex characters long
		//   - UnicodeEscaped doesnt have postfix, length is variable. it's nearly impossible to detect end properly.
		//    Probably should be looking for any non-hex character.
		//   - other encoders end with ;
		// - strip the entity, turn back into character, decode into utf8 hex value
		// - slice preceding text and add among other chunks
		// - add decoded character (from entity) into chunks
		// - look for next entity in text and repeat
		/*
		// not actually working, dry coded idea of what decoder should look like
		var chunks = []
		var input = bufferToString(buffer)
		var prefixIndex
		while (prefixIndex = input.indexOf(this.constructor.prefix)) {
			var beforeEntity = input.slice(0, prefixIndex)
			chunks.push(bufferFrom(beforeEntity))
			var entityEndIndex = ???? //TODO
			var entity = input.slice(prefixIndex, entityEndIndex)
			var char = this._decodeEntity(entity)
			chunks.push(bufferFrom(char))
			input = input.slice(entityEndIndex)
		}
		return Buffer.concat(chunks)
		*/
	}
	_decodeEntity(entity) {
		return String.fromCharCode(parseInt(this._parseEntity(entity)))
	}

}

// TODO: decode
// Encodes every character into notation
export class NcrDec extends EntityEncoding {
	static prefix = ''
	_encodeCharacter(char) {
		return `&#${char};`
	}
	_parseEntity(entity) {
		return entity.slice(2, -1)
	}
}

// TODO: decode
// Encodes every character into notation
export class NcrHex extends EntityEncoding {
	static prefix = ''
	_encodeCharacter(char) {
		return `&#x${char.toString(16)};`
	}
	_parseEntity(entity) {
		return entity.slice(3, -1)
	}
}

// TODO: decode
// Encodes every character into notation
export class UnicodeEscaped extends EntityEncoding {
	static prefix = ''
	_encodeCharacter(char) {
		return `\\u${char.toString(16)}`
	}
	_parseEntity(entity) {
		return entity.slice(2)
	}
}

// TODO: decode
// Encodes every character into notation
export class Unicode extends EntityEncoding {
	static prefix = ''
	_encodeCharacter(char) {
		return `U+${char.toString(16).toUpperCase().padStart(4, '0')}`
	}
	_parseEntity(entity) {
		return entity.slice(2)
	}
}


// TODO:
// </div> => %3C%2Fdiv%3E
export class Percent extends EntityEncoding {
}

// TODO:
// </div> => &lt;/div&gt;
export class HtmlEscaper extends EntityEncoding {

	// Table of commonly known named entities
	static table = {
		' ': 'nbsp',
		''': 'apos',
		'<': 'lt',
		'>': 'gt',
		'&': 'amp',
		'"': 'quot',
		'¢': 'cent',
		'£': 'pound',
		'¥': 'yen',
		'€': 'euro',
		'©': 'copy',
		'®': 'reg',
	}
}