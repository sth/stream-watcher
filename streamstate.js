
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
		const streamPromise = new Promise((resolve, reject) => {
			let pendingEvents = Promise.resolve();
			stream.on('error', err => {
				if (options.error) {
					const handled = new Promise((res, rej) => {
						Promise.resolve(options.error(err)).then(
							newerr => {
								if (newerr) rej(newerr);
								else res();
							},
							rej
						);
					});
					handled.catch(reject);
					pendingEvents = pendingEvents.then(() => handled);
				}
				else {
					reject(err);
				}
			});
			stream.on('finish', () => {
				pendingEvents.then(() => {
					if (options.finish) {
						resolve(new Promise(res => {
							res(options.finish(stream)));
						});
					}
					else {
						resolve();
					}
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
