'use strict';

const GIT = require('./git');

function save( root, path, content )
{
	const fs = require('fs');

	let directories = path.split('/'), filename = directories[directories.length-1]; path = root;

	// TODO iterate downwards
	for( let i = 0; i < directories.length - 1; ++i )
	{
		if( !fs.existsSync( path + directories[i] ) )
		{
			fs.mkdirSync( path + directories[i] );
		}

		path += directories[i] + '/';
	}

	fs.writeFileSync( path + filename, content );
}

function getRequirements( source )
{
	let requirement, requirements = [];
	const require_RE = /require\s*\(\s*/g;

	while( requirement = require_RE.exec( source ) )
	{
		// TODO improve to not match parenthesis inside strings
		let parenthesis = 1;

		for( let i = require_RE.lastIndex; i < source.length; ++i )
		{
			if( source[i] === '(' ){ ++parenthesis; }
			else if( source[i] === ')' && --parenthesis === 0 )
			{
				requirements.push( source.substring( require_RE.lastIndex, i ).trim() );
				break;
			}
		}
	}

	return requirements;
}

const Packager = module.exports = class Packager
{
	constructor( repositories, ignore )
	{
		this.repositories = repositories;
	}

	async build()
	{
		const ignore =
		{
			directories: [ /^((?!lib[\/]{0,1}).)*$/, /^lib\/lib\//, /^lib\/.*\/lib\// ],
			files: [ /^\./, /\/\./, /\.$/, /package-lock\.json/, /LICENSE$/, /VERSION/, /\.md$/ ]
		}

		let downloads = await Promise.all( this.repositories.map( repository => GIT.downloadRepository( repository, ignore ) ) );

		for( let repository of downloads )
		{
			console.log( repository.name, repository.version );

			for( let file in repository.files )
			{
				let file_requirements = getRequirements( repository.files[file] ).filter( requirement => /^['"]liqd-/.test(requirement) || /\/lib\//.test(requirement) );

				if( file_requirements.length )
				{
					console.log( '  '+file, '\n    ' + file_requirements.join(',\n    ') );
				}
			}
		}

		let root = __dirname + '/../build/';

		for( let repository of downloads )
		{
			save( root, 'lib/' + repository.name.replace(/^liqd-/,'') + '/.VERSION', repository.version  )

			for( let file in repository.files )
			{
				save( root, 'lib/' + repository.name.replace(/^liqd-/,'') + '/' + file.replace(/^lib\//,''), repository.files[file] );
			}
		}
	}
}

const packager = new Packager( [ 'radixxko/liqd-sql', 'radixxko/liqd-timed-promise', 'radixxko/liqd-cluster', 'radixxko/liqd-flow' ] );
packager.build();
