'use strict';

const request = require('request');

function ignored( filename, ignores )
{
	return Boolean( ignores.find( ignore => ignore.test( filename )));
}

function match( RE, str, match_index = 1 )
{
	let match = RE.exec( str );

	return ( match ? match[ match_index ] : undefined );
}

function download( url, retries = 5 )
{
	return new Promise( ( resolve, reject ) =>
	{
		request({ url: 'https://github.com/' + url, gzip: true }, ( error, response, body ) =>
		{
			if( !error ){ resolve( body ); }
			else if( retries ){ setTimeout( () => download( url, retries - 1 ).then( resolve ).catch( reject ), 500 + Math.ceil( Math.random() * 5000 ) ); }
			else{ reject( error ); }
		});
	});
}

function downloadDirectory( url, ignore, path = '' )
{
	return new Promise( async( resolve, reject ) =>
	{
		try
		{
			let contents = [];
			let directory_page = await download( url );

			const files_table_RE = /<table[^>]+class="[^"]*files[^"]*"[^>]*>(.*?)<\/table>/s;
			const files_table_row_RE = /<tr[^>]*>(.*?)<\/tr>/gs;
			const file_RE = /<td[^>]+class="[^"]*content[^"]*"[^>]*>.*?(<a[^>]+>.*?<\/a>)/s;
			const file_type_RE =  /<td[^>]+class="[^"]*icon[^"]*"[^>]*>\s*<svg class="([^"]+)"/s;
			const file_name_RE = /<a[^>]+>\s*(.*?)\s*<\/a>/s;
			const file_URL_RE = /<a[^>]+href="([^"]+)"/s;

			let files_table = match( files_table_RE, directory_page ), files_table_row, file;

			if( files_table )
			{
				while( files_table_row = match( files_table_row_RE, files_table ) )
				{
					if( file = match( file_RE, files_table_row ) )
					{
						let name = match( file_name_RE, file ).replace(/<[^>]+>/g,'') , url = match( file_URL_RE, file ), type = match( file_type_RE, files_table_row ).includes('directory') ? 'directory' : 'file';

						if( ( type === 'directory' && ( !ignore || !ignore.directories || !ignored( path + name, ignore.directories ) ) ) || ( type === 'file' && ( !ignore || !ignore.files || !ignored( path + name, ignore.files ) ) ) )
						{
							contents.push({ type, path: path + name, url });
						}
					}
				}

				let downloads = await Promise.all( contents.map( item => ( item.type === 'directory' ? downloadDirectory(item.url, ignore, item.path+'/') : download(item.url.replace('/blob/','/raw/')) ) ) );

				resolve( contents.reduce( ( files, item, i ) =>
				{
					if( item.type === 'directory' )
					{
						Object.keys( downloads[i] ).forEach( path => files[path] = downloads[i][path] );
					}
					else
					{
						files[item.path] = downloads[i];
					}

					return files;
				},
				{} ));
			}
			else{ throw new Error('No Files Table found at ' + url); }
		}
		catch(e){ reject(e); }
	});
}

const GIT = module.exports =
{
	downloadRepository: function( repository, ignore )
	{
		return new Promise( async( resolve, reject ) =>
		{
			try
			{
				let files = await downloadDirectory( repository, ignore ), package_json = files['package.json']; delete(files['package.json']);

				if( package_json )
				{
					package_json = JSON.parse( package_json );

					resolve(
					{
						name: package_json.name,
						version:  package_json.version,
						dependencies: package_json.dependencies || {},
						files
					});
				}
				else{ throw new Error('package.json missing in ' + repository); }
			}
			catch(e){ reject(e); }
		});
	}
}
