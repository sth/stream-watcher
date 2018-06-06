import test from 'ava';

import StreamWatcher from "../lib/streamwatcher";

import stream from 'stream';

class ChunkReader extends stream.Readable {
	constructor(chunks) {
		super();
		this.chunks = chunks;
	}
	_read(size) {
		while (this.chunks.length) {
			const chunk = this.chunks.shift();
			if (chunk instanceof Function) {
				if (!chunk(this))
					return;
			}
			else if (!this.push(chunk)) {
				return;
			}
		}
		this.push(null);
	}
};

class NullWriter extends stream.Writable {
	_write(c, e, cb) { cb(); }
};


function assert_pending(promise) {
	return new Promise((resolve, reject) => {
		promise.then(
			() => { reject(new Error("already fulfilled")); },
			() => { reject(new Error("already rejected")); }
		);
		setTimeout(() => { resolve("still pending"); }, 200);
	});
}


// helpers

test("assert_pending()", async t => {
	await t.notThrows(assert_pending(new Promise(() => {})));
	await t.throws(assert_pending(Promise.resolve()));
	await t.throws(assert_pending(Promise.reject()));
	//await t.throws(Promise.reject());
});


// no streams

test("watcher without streams fulfills", async t => {
	const watcher = new StreamWatcher();
	await t.notThrows(watcher.finish);
});


// readable streams

test("stays pending for readable stream while stream isn't read", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", "def"]);
	
	const psrc = watcher.watch(src);

	// As long as `src` isn't read stream/watcher shouldn't finish
	await t.notThrows(assert_pending(psrc), "stream still pending");
	await t.notThrows(assert_pending(watcher.finish), "watcher stillp pending");
});

test("fulfills for readable stream when stream ends", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", "def"]);
	
	const psrc = watcher.watch(src);

	// Read whole stream by piping it to a writer
	src.pipe(new NullWriter());

	await t.notThrows(psrc, "stream finished without error");
	await t.notThrows(watcher.finish, "watcher finished without error");
});

test("rejects for readable stream when error occurs", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", s => s.emit("error", new Error("E"))]);
	
	const psrc = watcher.watch(src);

	// Read whole stream by piping it to a writer
	src.pipe(new NullWriter());

	await t.throws(psrc, "E", "stream finished with error");
	await t.throws(watcher.finish, "E", "watcher finished with error");
});


// writable streams

test("stays pending for writable stream while stream isn't complete", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();
	
	const pdest = watcher.watch(dest);

	// As long as `src` isn't read stream/watcher shouldn't finish
	await t.notThrows(assert_pending(pdest), "stream still pending");
	await t.notThrows(assert_pending(watcher.finish), "watcher still pending");
});

test("fulfills for writable stream when stream finishes", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();
	
	const pdest = watcher.watch(dest);

	// Write to stream
	dest.write("abc");
	dest.end("def");

	await t.notThrows(pdest, "stream finished without error");
	await t.notThrows(watcher.finish, "watcher finished without error");
});

test("rejects for writable stream when error occurs", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();
	
	const pdest = watcher.watch(dest);

	// Write to stream
	dest.write("abc");
	dest.emit("error", new Error("E"));
	dest.end("def");

	await t.throws(pdest, "E", "stream finished with error");
	await t.throws(watcher.finish, "E", "watcher finished with error");
});

test("watcher with {error: ...} rejects with modified error", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error(err) { return new Error(err.message + "-custom"); }
	});

	dest.write("abc");
	dest.emit("error", new Error("E"));

	await t.throws(pdest, "E-custom");
	await t.throws(watcher.finish, "E-custom");
});

test("watcher with {error: ...} doesn't reject with ignored error", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error(err) { return; }
	});

	dest.write("abc");
	dest.emit("error", new Error("E"));
	dest.end("def");

	await t.notThrows(pdest);
	await t.notThrows(watcher.finish);
});

test("fulfills on completed pipe", async t => {
	const watcher = new StreamWatcher();
	const src = new stream.PassThrough();
	const dest = new NullWriter();

	const psrc = watcher.watch(src);
	const pdest = watcher.watch(dest);

	src.pipe(dest);
	src.write("abc");
	src.end("def");

	await t.notThrows(psrc);
	await t.notThrows(pdest);
	await t.notThrows(watcher.finish);
});

test("fulfills on completed pipe with multiple targets", async t => {
	const watcher = new StreamWatcher();
	const src = new stream.PassThrough();
	const dest1 = new NullWriter();
	const dest2 = new NullWriter();

	const psrc = watcher.watch(src);
	const pdest1 = watcher.watch(dest1);
	const pdest2 = watcher.watch(dest2);

	src.pipe(dest1);
	src.pipe(dest2);
	src.write("abc");
	src.end("def");

	await t.notThrows(psrc);
	await t.notThrows(pdest1);
	await t.notThrows(pdest2);
	await t.notThrows(watcher.finish);
});

test("rejects on error in pipe source", async t => {
	const watcher = new StreamWatcher();
	const src = new stream.PassThrough();
	const dest = new NullWriter();

	const psrc = watcher.watch(src);
	const pdest = watcher.watch(dest);

	src.pipe(dest);
	src.write("abc");
	src.emit("error", new Error("E"));

	await t.throws(psrc, "E");
	await t.notThrows(assert_pending(pdest));
	await t.throws(watcher.finish, "E");
});

test("rejects on error in pipe destination", async t => {
	const watcher = new StreamWatcher();
	const src = new stream.PassThrough();
	const dest = new NullWriter();

	const psrc = watcher.watch(src);
	const pdest = watcher.watch(dest);

	src.pipe(dest);
	src.write("abc");
	dest.emit("error", new Error("E"));

	await t.notThrows(assert_pending(psrc));
	await t.throws(pdest, "E");
	await t.throws(watcher.finish, "E");

	src.end("def");

	await t.notThrows(psrc);
	await t.throws(pdest, "E");
	await t.throws(watcher.finish, "E");
});
