var util = require( "util" );
var stream = require( "stream" );

module.exports = forkable;
module.exports.ForkStream = ForkStream;

function forkable( _stream ) {
    // default pass-through
    if ( arguments.length == 0 ) {
        _stream = {};
    }

    // pass the options argument into the PassThrough constructor, as-is
    if ( _stream.constructor == Object ) {
        
        // default high water mark of 1, for minimal memory overhead
        _stream.highWaterMark || ( _stream.highWaterMark = 1 );
        _stream = new stream.PassThrough( _stream );
    }

    if ( !_stream.pipe || !_stream.read ) {
        throw new Error( "Non-readable streams are not forkable" );
    }

    _stream.fork = function ( forkfn, options ) { 
        options || ( options = {} );
        options.writableObjectMode = this._readableState.objectMode;
        return this.pipe( new ForkStream( forkfn, options ) );
    };
    return _stream;
}

util.inherits( ForkStream, stream.Transform )
function ForkStream( forkfn, options ) {
    options || ( options = {} );
    options.highWaterMark = 1;
    options.readableObjectMode = true;

    stream.Transform.call( this, options );

    this._forkableState = { 
        forkfn: forkfn,
        pipefn: function () {
            throw new Error( "No pipe function was defined" )
        },
        destinations: {}
    };
}

ForkStream.prototype.pipe = function ( pipefn ) {
    if ( typeof pipefn != "function" ) {
        throw new Error( "Forkable pipes must be a function" );
    }

    this._forkableState.pipefn = pipefn;
    return this;
}

ForkStream.prototype._transform = function ( data, enc, done ) {
    var state = this._forkableState;

    // map the input to the destinations
    var dest = state.forkfn.call( this, data );
    if ( typeof dest != "object" ) {
        var name = dest;
        dest = {};
        dest[ name ] = data;
    }

    // create the fork
    var output = [];
    var pipe = stream.Transform.prototype.pipe;
    Object.keys( dest ).forEach( function ( name ) {
        if ( !state.destinations[ name ] ) {
            state.destinations[ name ] = pipe.call( this, fork( this, name ) );
        }
        output.push({ dest: name, value: dest[ name ] });
    }.bind( this ) )

    // push out the mapped data
    output.forEach( this.push.bind( this ) );
    done();
}

function fork ( _stream, dest ) {
    var forked = new stream.Transform({ objectMode: true, highWaterMark: 1 });
    forked._transform = function ( data, enc, done ) {
        if ( data.dest === dest ) {
            done( null, data.value );
        } else {
            done();
        }
    }
    forked._forkableState || ( forked._forkableState = {} );
    forked._forkableState.dest = dest;

    try {
        var pipeto = _stream._forkableState.pipefn.call( _stream, dest );
        if ( !pipeto || !pipeto.write ) {
            throw new Error( "Pipe function returned a non-writable stream" );
        }

        forked.pipe( pipeto );
    } catch ( err ) {
        _stream.emit( "error", err );
    }
    
    return forked;
}





