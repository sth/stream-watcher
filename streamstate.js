
class StreamState {
	constructor() {
		this._resolve = null;
		this._reject = null;
		this.pending = 0;
		this.result = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	track(stream, options) {
		options.error = options.error || noop;
		let pendingEvents = Promise.resolve();
		const streamPromise = new Promise((resolve, reject) => {
			stream.on('error', err => {
				const handled = new Promise((res, rej) => {
					if (options.error) {
						Promise.resolve(options.error(err)).then(
							newerr => {
								if (newerr) rej(newerr);
								else res();
							},
							rej
						);
					}
					else {
						rej(err);
					}
				});
				handled.catch(reject);
				pendingEvents = pendingEvents.then(() => handled);
			});
			stream.on('finish', () => {
				pendingEvents.then(() => {
					resolve(new Promise(res => {
						if (options.finish)
							res(options.finish(stream)));
						else
							res();
					});
				});
			});
		});

		this._pending += 1;
		streamPromise.then(
			value => {
				this._pending -= 1;
				if (options.final)
					this._value = value;
				if (!this._pending)
					this._resolve(this._value);
			},
			err => {
				this._reject(err);
			}
		);

		return streamPromise;
	}
}
