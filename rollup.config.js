import fs from 'fs'
import babel from 'rollup-plugin-babel'


var pkg = fs.readFileSync('package.json')
pkg = JSON.parse(pkg.toString())

var nodeCoreModules = require('repl')._builtinLibs
var globals = objectFromArray(nodeCoreModules)

export default {
	treeshake: false,
	input: 'index.mjs',
	output: {
		file: `index.js`,
		format: 'umd',
	},
	name: pkg.name,
	globals,
	plugins: [
		babel({
			plugins: ['transform-class-properties'],
			//externalHelpers: true
		})
	]
}

function objectFromArray(arr) {
	var obj = {}
	arr.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}
