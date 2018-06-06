
export class StreamWatcher {
	constructor(stream) {
		this.finish = Promise.resolve();
		if (stream) {
			this.track(stream);
		}
	}

	watch(stream, options) {
		options = options || {};
		const streamPromise = new Promise((resolve, reject) => {
			let pendingEvents = [];
			stream.on("error", err => {
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
					pendingEvents.push(handled);
				}
				else {
					reject(err);
				}
			});
			stream.on("finish", () => {
				Promise.all(pendingEvents).then(() => {
					if (options.finish) {
						resolve(new Promise(res => {
							res(options.finish(stream));
						}));
					}
					else {
						resolve();
					}
				});
			});
			stream.on("end", () => {
				Promise.all(pendingEvents).then(() => {
					if (options.finish) {
						resolve(new Promise(res => {
							res(options.finish(stream));
						}));
					}
					else {
						resolve();
					}
				});
			});
		});

		this.finish = Promise.all([this.finish, streamPromise]);

		// We don't want to force the user to wait for `this.finish`, since
		// the `streamPromise` we return here might be everything they want.
		// Therefore we add an empty catch() to make sure the promise doesn't
		// end up as an unhandled exception.
		this.finish.catch(() => {});

		return streamPromise;
	}
}

export { StreamWatcher as default };
