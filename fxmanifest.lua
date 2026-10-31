name 'ai-fuel'
author 'TGIANN'
version '0.1.2' -- x-release-please-version
license 'GPL-3.0-only'
description 'Fuel use, gas stations and the vehicle fuel state'
repository 'https://github.com/aifivem/ai-fuel'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/stations.json',
}
