# forkable
Fork streams into different destinations based on the input data

### Usage

```javascript
var forkable = require( "forkable" );

// split a log file into two destinations: errors and non errors
forkable( fs.createReadStream( "somefile" ) )
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
        return fs.createWriteStream( dest )
    });
```

### API

`forkable([ readable ])`

Adds the `.fork()` method to the provided readable stream, and returns it. This is the simplest way to attach the forkable functionality to any existing stream.

`fork( fn [, options ] )`

* **fn** a mapping function:
    - **data** the input chunk from the stream
    - **returns** a destination name string, or an object of destination names to data chunks
* **options** an standard options object that is passed to `stream.Transform`

Creates a fork stream with the provided mapping function, which will be invoked for every input data piped to it from the `readable` stream. The purpose of this function is to map a destination name for the input data in order to determine to which destination stream it should be piped into.

```javascript
forkable( stream )
    .fork( function ( data ) {
        return "destination1"; // writes all of the data to "destination1"
    })
```









