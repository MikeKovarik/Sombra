import fs from 'fs'
import babel from 'rollup-plugin-babel'
import notify from 'rollup-plugin-notify'


var pkg = fs.readFileSync('package.json')
pkg = JSON.parse(pkg.toString())

var nodeCoreModules = require('repl')._builtinLibs
var external = [...nodeCoreModules, ...Object.keys(pkg.dependencies || {})]
var globals = objectFromArray(external)

export default {
	treeshake: false,
	input: 'index.mjs',
	output: {
		file: `index.js`,
		format: 'umd',
		name: pkg.name,
		amd: {id: pkg.name},
		globals,
	},
	external,
	plugins: [notify(), babel()]
}

function objectFromArray(arr) {
	var obj = {}
	arr.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}
