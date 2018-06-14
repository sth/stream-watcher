
import { StreamState } from './state.js';

export class StreamWatcher {
	constructor(stream) {
		this.finish = Promise.resolve();
		if (stream) {
			this.watch(stream);
		}
	}

	watch(stream, options) {
		options = options || {};
		const state = new StreamState(stream, options);

		this.finish = Promise.all([this.finish, state.complete]);

		// We don't want to force the user to wait for `this.finish`, since
		// the `streamPromise` we return here might be everything they want.
		// Therefore we add an empty catch() to make sure the promise doesn't
		// end up as an unhandled exception.
		this.finish.catch(() => {});

		return state;
	}
}

export { StreamWatcher as default };
