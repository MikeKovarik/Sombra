import stream from 'stream'
import _Buffer from 'buffer'


// Sombra doesn't require Buffer module as it's dependency (in browser)
// but utilizes it if it's present. Otherwise falls back to Uint8Array.

// Export Buffer constructor if it exists (in browser)
export var Buffer

if (_Buffer) {
	if (typeof _Buffer === 'function')
		Buffer = _Buffer
	else if (typeof _Buffer.Buffer === 'function')
		Buffer = _Buffer.Buffer
}

// Similarly stream module and its Transform class is not mandatory.
export var Transform = stream && stream.Transform ? stream.Transform : class {}
