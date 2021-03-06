import test from "ava";

import { ChunkReader, NullWriter } from '@tejp/testing-streams';
import { assert_pending } from './_helpers.js';
import stream from "stream";

import StreamWatcher from "../lib/watcher.js";


// no streams

test("watcher without streams fulfills", async t => {
	const watcher = new StreamWatcher();
	await t.notThrowsAsync(watcher.finish);
});


// readable streams

test("stays pending for readable stream while stream isn't read", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", "def"]);

	const psrc = watcher.watch(src);

	// As long as `src` isn't read stream/watcher shouldn't finish
	await t.notThrowsAsync(assert_pending(psrc.complete), "stream still pending");
	await t.notThrowsAsync(assert_pending(watcher.finish), "watcher still pending");
});

test("fulfills for readable stream when stream ends", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", "def"]);

	const psrc = watcher.watch(src);

	// Read whole stream by piping it to a writer
	src.pipe(new NullWriter());

	await t.notThrowsAsync(psrc.complete, "stream finished without error");
	await t.notThrowsAsync(watcher.finish, "watcher finished without error");
});

test("rejects for readable stream when error occurs", async t => {
	const watcher = new StreamWatcher();
	const src = new ChunkReader(["abc", s => s.emit("error", new Error("E"))]);

	const psrc = watcher.watch(src);

	// Read whole stream by piping it to a writer
	src.pipe(new NullWriter());

	await t.throwsAsync(psrc.complete, {message: "E"}, "stream finished with error");
	await t.throwsAsync(watcher.finish, {message: "E"}, "watcher finished with error");
});


// writable streams

test("stays pending for writable stream while stream isn't complete", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest);

	// As long as `dest` isn't written stream/watcher shouldn't finish
	await t.notThrowsAsync(assert_pending(pdest.complete), "stream still pending");
	await t.notThrowsAsync(assert_pending(watcher.finish), "watcher still pending");
});

test("fulfills for writable stream when stream finishes", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest);

	// Write to stream
	dest.write("abc");
	dest.end("def");

	await t.notThrowsAsync(pdest.complete, "stream finished without error");
	await t.notThrowsAsync(watcher.finish, "watcher finished without error");
});

test("rejects for writable stream when error occurs", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest);

	// Write to stream
	dest.write("abc");
	dest.emit("error", new Error("E"));
	dest.end("def");

	await t.throwsAsync(pdest.complete, {message: "E"}, "stream finished with error");
	await t.throwsAsync(watcher.finish, {message: "E"}, "watcher finished with error");
});

test("watcher with {error: ...} rejects with modified error", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error(err) { return new Error(err.message + "-custom"); }
	});

	dest.write("abc");
	dest.emit("error", new Error("E"));

	await t.throwsAsync(pdest.complete, {message: "E-custom"});
	await t.throwsAsync(watcher.finish, {message: "E-custom"});
});

test("watcher with {error: ...} doesn't reject with ignored error", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error(err_unused) { return; }
	});

	dest.write("abc");
	dest.emit("error", new Error("E"));
	dest.end("def");

	await t.notThrowsAsync(pdest.complete);
	await t.notThrowsAsync(watcher.finish);
});

/*
test("{error: ...} supports async handler functions", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error: async (err) => {
			t.is(err.message, "E");

			await new Promise((resolve, reject_unused) => {
				setTimeout(resolve, 100);
			});

			return new Error("E2");
		}
	});

	dest.emit("error", new Error("E"));

	await t.throwsAsync(pdest.complete, "E2");
	await t.throwsAsync(watcher.finish, "E2");
});
*/

test("{error: ...} handles exceptions in the handler function", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest, {
		error(err_unused) { throw new Error("H"); }
	});

	dest.emit("error", new Error("E"));

	await t.throwsAsync(pdest.complete, {message: "H"});
	await t.throwsAsync(watcher.finish, {message: "H"});
});

test("the `finish` promise can be ignored even if rejected", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest);

	dest.write("abc");
	dest.emit("error", new Error("E"));

	await t.throwsAsync(pdest.complete, {message: "E"});
});

test("the promise returned by watch() can be ignored even if rejected", async t => {
	const watcher = new StreamWatcher();
	const dest = new NullWriter();

	const pdest = watcher.watch(dest); // eslint-disable-line no-unused-vars

	dest.write("abc");
	dest.emit("error", new Error("E"));

	await t.throwsAsync(watcher.finish, {message: "E"});
});


// multiple streams

test("fulfills only after all streams are fulfilled", async t => {
	const watcher = new StreamWatcher();
	const dest1 = new NullWriter();
	const dest2 = new NullWriter();

	const pdest1 = watcher.watch(dest1);
	const pdest2 = watcher.watch(dest2);

	// originally pending
	await t.notThrowsAsync(assert_pending(watcher.finish));
	await t.notThrowsAsync(assert_pending(pdest1.complete));
	await t.notThrowsAsync(assert_pending(pdest2.complete));

	dest1.end();

	// still pending
	await t.notThrowsAsync(assert_pending(watcher.finish));
	await t.notThrowsAsync(assert_pending(pdest2.complete));

	dest2.end();

	// resolved now
	await t.notThrowsAsync(watcher.finish);
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

	await t.notThrowsAsync(psrc.complete);
	await t.notThrowsAsync(pdest.complete);
	await t.notThrowsAsync(watcher.finish);
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

	await t.notThrowsAsync(psrc.complete);
	await t.notThrowsAsync(pdest1.complete);
	await t.notThrowsAsync(pdest2.complete);
	await t.notThrowsAsync(watcher.finish);
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

	await t.throwsAsync(psrc.complete, {message: "E"});
	await t.notThrowsAsync(assert_pending(pdest.complete));
	await t.throwsAsync(watcher.finish, {message: "E"});
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

	await t.notThrowsAsync(assert_pending(psrc.complete));
	await t.throwsAsync(pdest.complete, {message: "E"});
	await t.throwsAsync(watcher.finish, {message: "E"});

	src.end("def");

	await t.notThrowsAsync(psrc.complete);
	await t.throwsAsync(pdest.complete, {message: "E"});
	await t.throwsAsync(watcher.finish, {message: "E"});
});
