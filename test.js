var assert = require( "assert" );
var stream = require( "stream" );
var forkable = require( "./index" );

describe( "Forkable", function () {

    it( "adds the .fork() method to streams", function () {
        var forked = forkable( new stream.Readable() );
        assert.equal( typeof forked.fork, "function" );
    });

    it( "supports single destination per input", function ( done ) {
        var results = {};
        forkable( from( [ 1, 2, 3, 4, 5 ] ) )
            .fork( function ( data ) {
                return data % 2 ? "odd" : "even"
            })
            .pipe( function ( dest ) {
                results[ dest ] = [];
                return new stream.PassThrough({ objectMode: true })
                    .on( "data", function ( d ) {
                        results[ dest ].push( d )
                    })
            })
            .on( "end", function () {
                assert.deepEqual( results.odd, [ 1, 3, 5 ] );
                assert.deepEqual( results.even, [ 2, 4 ] );
                done();
            })
    });

    it( "supports multiple destinations per input", function ( done ) {
        var results = {};
        forkable( from( [ [ 1, 2, 3 ], [ 4, 5 ] ] ) )
            .fork( function ( data ) {
                return data.reduce( function ( destmap, d ) {
                    destmap[ d % 2 ? "odd" : "even" ].push( d );
                    return destmap;
                }, { odd: [], even: [] } )
            })
            .pipe( function ( dest ) {
                results[ dest ] = [];
                return new stream.PassThrough({ objectMode: true })
                    .on( "data", function ( d ) {
                        results[ dest ] = results[ dest ].concat( d )
                    })
            })
            .on( "end", function () {
                assert.deepEqual( results.odd, [ 1, 3, 5 ] );
                assert.deepEqual( results.even, [ 2, 4 ] );
                done();
            })
    })

    it( "emits an error when no pipe function is defined", function ( done ) {
        forkable( from( [ 1, 2, 3, 4, 5 ] ) )
            .fork( function ( data ) {
                var map = {};
                var name = data % 2 ? "odd" : "even";
                map[ name ] = data;
                return map;
            })
            .on( "error", function ( err ) {
                assert.equal( err.message, "No pipe function was defined" );
                done();
            })
            .on( "data", function () {});
    });

    it( "emits an error when the pipe isn't a writable stream", function () {
        var forked = forkable( from( [ 1, 2, 3, 4, 5 ] ) )
            .fork( function ( data ) {
                var map = {};
                var name = data % 2 ? "odd" : "even";
                map[ name ] = data;
                return map;
            })

        assert.throws( function () {
            forked.pipe( {} );
        }, /must be a function/ )
    })

    it( "implements the README.md usage example", function ( done ) {
        var input = [
            "One",
            "ERROR: Two",
            "Three",
            "Four",
            "ERROR: Five"
        ].join( "\n" );
        var results = {};
        forkable( createReadStream( input ) )
            .fork(function ( chunk ) {
                // called for every input data to determine the 
                // destination of that chunk
                var lines = chunk.toString().split( "\n" );
                var errors = lines.filter( function ( l ) {
                    return l.indexOf( "ERROR:" ) == 0;
                }).join( "\n" );
                var logs = lines.filter( function ( l ) {
                    return l.indexOf( "ERROR:" ) != 0;
                }).join( "\n" );

                return {
                    "errors": errors,
                    "logs": logs
                }
            })
            .pipe( function ( dest ) {
                return createWriteStream( dest )
                    .on( "finish", function () {
                        results[ dest ] = this.val();
                        if ( results.errors && results.logs ) {
                            complete();
                        }
                    })
            })
        
        function complete() {
            assert.deepEqual( results.errors.split( "\n" ), [
                "ERROR: Two",
                "ERROR: Five",
            ]);
            assert.deepEqual( results.logs.split( "\n" ), [
                "One",
                "Three",
                "Four",
            ]);
            done();
        }
    })
})

function from( data ) {
    var _stream = new stream.Readable({ objectMode: true });
    _stream._read = function () {
        this.push( data.shift() || null );
    }
    return _stream;
}

function createReadStream( text ) {
    var reader = new stream.Readable();
    reader._read = function ( size ) {
        this.push( text.substr( 0, size ) || null );
        text = text.substr( size );
    }
    return reader;
}

function createWriteStream() {
    var text = "";
    var writer = new stream.Writable();
    writer._write = function ( chunk, enc, done ) {
        text += chunk;
        done();
    }
    writer.val = function () { return text };
    return writer;
}
