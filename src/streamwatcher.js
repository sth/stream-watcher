
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
			let pendingEvents = Promise.resolve();
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
					pendingEvents = pendingEvents.then(() => handled);
				}
				else {
					reject(err);
				}
			});
			stream.on("finish", () => {
				pendingEvents.then(() => {
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
		return streamPromise;
	}
}

export { StreamWatcher as default };
