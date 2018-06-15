import test from "ava";

import { ChunkReader, NullWriter } from 'testcase-streams';
import { assert_pending } from './_helpers.js';

import { StreamState, EventNotFound } from "../lib/state.js";

// readable streams

test("filfills for readable stream when stream ends", async t => {
	const src = new ChunkReader(["abc", "def"]);
	const st = new StreamState(src);

	// As long as `src` isn't read stream/watcher shouldn't finish
	await t.notThrows(assert_pending(st.end), "end still pending");
	await t.notThrows(assert_pending(st.finish), "finish still pending");
	await t.notThrows(assert_pending(st.complete), "complete still pending");

	src.pipe(new NullWriter());

	await t.notThrows(st.complete, "complete without error");
	await t.throws(st.finish);
	await t.notThrows(st.end, "end without error");
	//await t.throws(st.finish, {instanceOf: EventNotFound}, "there finish won't happen");
});

test("rejects for readable stream when error occurs", async t => {
	const src = new ChunkReader(["abc", new Error("E")]);
	const st = new StreamState(src);

	// Read whole stream by piping it to a writer
	src.pipe(new NullWriter());

	await t.throws(st.complete, "E", "complete with error");
	await t.throws(st.end, "E", "end with error");
	await t.throws(st.finish, "E", "finish failed");
});


// writable streams

test("fulfills for writable stream when stream finishes", async t => {
	const dest = new NullWriter();
	const st = new StreamState(dest);

	// As long as `dest` isn't written stream/watcher shouldn't finish
	await t.notThrows(assert_pending(st.complete), "complete still pending");
	await t.notThrows(assert_pending(st.finish), "finish still pending");
	await t.notThrows(assert_pending(st.end), "end still pending");

	// Write to stream
	dest.write("abc");

	await t.notThrows(assert_pending(st.complete), "complete still pending");
	await t.notThrows(assert_pending(st.finish), "finish still pending");
	await t.notThrows(assert_pending(st.end), "end still pending");

	dest.end("def");

	await t.notThrows(st.complete, "complete without error");
	await t.notThrows(st.finish, "finish without error");
	await t.throws(st.end);
	//await t.throws(st.end, {instanceOf: EventNotFound}, "end not found");
});

test("rejects for writable stream when error occurs", async t => {
	const dest = new NullWriter();
	const st = new StreamState(dest);

	// Write to stream
	dest.write("abc");
	dest.emit("error", new Error("E"));
	dest.end("def");

	await t.throws(st.complete, "E", "complete with error");
	await t.throws(st.finish, "E", "finish with error");
	await t.throws(st.end, "E", "end failed");
});
