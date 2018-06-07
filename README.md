# stream-watcher

Watch stream completion state and errors for single streams,
pipes or groups of streams with promises or async/await.

## Motivation

Handling node streams in async functions is unnecessarily complicated. Streams
signal their state through events which have to be listened for and need
annoying boilerplate code to convert to promises or async function results
in the right places.

Especially if several streams are piped into each other, proper error handling
and checking for stream completion requires much more code than creating and
connecting the streams themselves.

stream-watcher provides a convenient interface to simplify this process as
much as possible while still staying very flexible. It tracks the state of
arbitrary groups of streams and makes it easy to wait 

## API

General usage:

```javascript
import StreamWatcher from 'stream-watcher';

async function doStreamWork() {
	const watcher = new StreamWatcher();

	const somestream = ...;
	watcher.watch(somestream);

	const otherstream = ...;
	watcher.watch(otherstream);

	// ... work on the streams, pipe them, ...

	// Wait for the watched streams to complete or raise errors
	await watcher.finish;
}
```

### `new StreamWatcher()`

Constructs a new StreamWatcher object that can be used to track one or more streams.

### `StreamWatcher#watch(stream, [options]) -> Promise`

Watch `stream`. Returns a promise that resolves/rejects according to the state
of this watched stream. Either this promise or `StreamWatcher.finish` can be
used to track the stream state.

The function can take the following options:

#### `options.error`

A handler function that is called whenever an `error` event is emitted by the
stream. The handler function can convert the error into a custom error object
or ignore it by returning a falsy value.

The handler function can be async.

Usage example:

```javascript
const watcher = new StreamWatcher();
watcher.watch(somestream, {
	error(err) {
		if (err.message.startsWith("warning:")) {
			// Ignore the error
			return;
		}
		else if (err.message === "") {
			// Fail with a custom error instead
			return new Error("Unknown internal error");
		}
		else {
			// Fail with the original error
			return err;
		}
	}
});
```

### `StreamWatcher#finish`

A `Promise` that is fulfilled when all the watched streams completed successfully.
If any watched stream emits an `error` event (and doesn't ignore it with a custom
error handler), the promise is rejected with the first such error that occurs.

