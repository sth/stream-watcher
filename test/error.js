
import StreamWatcher from "../src/streamwatcher";
import through from 'through2';

import assert from 'assert';
import stream from 'stream';

class ChunkReader extends stream.Readable {
	constructor(chunks) {
		super();
		this.chunks = chunks;
	}
	_read(size) {
		while (this.chunks.length) {
			if (!this.push(this.chunks.shift()))
				return;
		}
		this.push(null);
	}
};

class NullWritable extends stream.Writable {
	_write(c, e, cb) { cb(); }
};

async function assertFulfill(p) {
	const ret = await p;
	assert.ok(true);
	return ret;
}

async function assertReject(p, error, message) {
	let ret;
	try {
		ret = await p;
	}
	catch (err) {
		assert.ok(true);
		return err;
	}
	assert.throws(() => { return ret; }, error, message);
}

describe("watcher with no streams", function() {
	beforeEach(function () {
		this.watcher = new StreamWatcher();
	});

	it("fulfills", async function() {
		await assertFulfill(this.watcher.finish);
	});
});


it("watcher with readable stream fulfills on end of stream", async function() {
	this.watcher = new StreamWatcher();
	this.src = new ChunkReader(["abc", "def"]);
	this.watcher.watch(this.src);
	while (this.src.read() !== null)
		;
	await assertFulfill(this.watcher.finish);
	assert.ok(true);
});

describe("watcher with single stream", function() {
	beforeEach(function() {
		this.watcher = new StreamWatcher();
		this.src = through();
		this.watcher.watch(this.src);
	});

	it("fulfills on end of stream", async function() {
		this.src.write("abc");
		this.src.end("def");

		await assertFulfill(this.watcher.finish);
	});

	it("rejects on stream error", async function() {
		this.src.write("abc");
		this.src.emit("error", "E");

		const err = await assertReject(this.watcher.finish);
		assert.equal(err, "E");
	});
});


describe("single stream with {error: ...}", function() {
	beforeEach(function() {
		this.watcher = new StreamWatcher();
		this.src = through();
	});

	it("rejects with modified error", async function() {
		this.watcher.watch(this.src, {
			error(err) { return err + "-custom"; }
		});

		this.src.write("abc");
		this.src.emit("error", "E");

		const err = await assertReject(this.watcher.finish);
		assert.equal(err, "E-custom");
	});

	it("doesn't reject with ignored error", async function() {
		this.watcher.watch(this.src, {
			error(err) { return; }
		});

		this.src.write("abc");
		this.src.emit("error", "E");
		this.src.end("def");

		await assertFulfill(this.watcher.finish);
	});
});

describe("watcher for two piped streams", function() {
	beforeEach(function() {
		this.watcher = new StreamWatcher();
		this.src = through();
		this.dest = new NullWritable();
		this.src.pipe(this.dest);
		this.watcher.watch(this.src);
		this.watcher.watch(this.dest);
	});

	it("fulfills on completed pipe", async function() {
		this.src.end("abc");

		await assertFulfill(this.watcher.finish);
	});

	it("fulfills on completed pipe with multiple targets", async function() {
		this.dest2 = new NullWritable();
		this.src.pipe(this.dest2);

		this.watcher.watch(this.dest2);

		await assertFulfill(this.watcher);
	});

	it("rejects on error in pipe source", async function() {
		this.src.emit('error', "a");
		const res = await assertReject(this.watcher.finish);
		assert.equal(res, "a");
	});

	it("rejects on error in pipe destination", async function() {
		this.dest.emit("error", "b");
		const err = await assertReject(this.watcher.finish);
		assert.equal(err, "b");
	});

	it("rejects on successful source and error in pipe destination", async function() {
		this.src.write("abc");
		this.dest.emit("error", "b");
		this.src.end("def");
		const err = await assertReject(this.watcher.finish);
		assert.equal(err, "b");
	});
});
