# forkable
Fork Node streams into different destinations based on the input data

> Sometimes you want to create complex data flows, that behave differently based on the input data. For example, if you want to split a log file into several files, one for errors and one for everything else. Using simple stream pipes makes it difficult. This minimal library provides the interface for constructing these branched data flows.

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

* **readable** a Node readable stream, or a standard `options` object that is passed to Node's `PassThrough` stream. Optional
* **returns** the `readable` stream itself, augmented with the `.fork` method

Adds the `.fork()` method to the provided readable stream, and returns it. This is the simplest way to attach the forkable functionality to any existing stream. 

If you omit the `readable` argument, a `PassThrough` stream will be created and returned by default. You can also pass in an options object to be passed into the new `PassThrough`, for example:

```javascript
fs.createReadStream( "file.log" )
    .pipe( forkable({ highWaterMark: 100 }) )
    .fork( fn );
```

`fork( fn [, options ] )`

* **fn** a mapping function:
    - **data** the input chunk from the stream
    - **returns** a destination name string, or an object of destination names to data chunks
* **options** a standard options object that is passed to `stream.Transform`
* **returns** a `ForkStream` object, which is a subclass of `stream.Transform`

Creates a fork stream with the provided mapping function, which will be invoked for every input data piped to it from the `readable` stream. The purpose of this function is to map a destination name for the input data in order to determine to which destination stream it should be piped into.

```javascript
forkable( stream )
    .fork( function ( data ) {
        return "destination1"; // writes all of the data to "destination1"
    })
```

The example above will write all of the input data to a single destination. You can also break down the data into separate sub-chunks and write it to multiple destinations:

```javascript
forkable( stream )
    .fork( function ( data ) {
        return {
            destination1: data[ 0 ],
            destination2: data[ 2 ]
        }
    })
```

Any data that is not included in the returned destination map is discarded

`pipe( fn )`

* **fn** a dynamic pipe stream function
    - **name** the destination name returned from `.fork()`
    - **returns** the corresponding `stream.Writable` instance for that name
* **returns** the `ForkStream` instance itself

Unlike to the normal `.pipe()` method, this augmented method receives a function which will dynamically pipe the data based on the input map from the `.fork()` function. It will be invoked exactly once for each unique destination name, allowing you to define where the data should be piped into for the given name:

```javascript
forkable( stream )
    .fork( function ( data ) {
        return data > 100 ? "big" : "small";
    })
    .pipe( function ( name ) { 
        // name is either "big" or "small"
        return fs.createWriteStream( name )
    })
```

The example above will create two files: "big", with the data that is greater than 100, and "small" for everything else.






