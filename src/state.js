
export class EventNotFound extends Error {
	constructor() {
		super("Stream ended without encountering event");
	}
}

function untracked(promise) {
	promise.catch(err => {});
}

export class StreamState {
	constructor(stream, options = {}) {
		this.stream = stream;

		this._failureActions = {
			error: [],
			end: [],
			finish: []
		};

		this.stream.on("error", err => {
			if (options.error) {
				try {
					err = options.error(err);
				}
				catch (handlerErr) {
					this._triggerFailure("error", handlerErr);
					return;
				}
				if (err) {
					this._triggerFailure("error", err);
					return;
				}
			} else {
				this._triggerFailure("error", err);
				return;
			}
		});
		this.stream.on("end", () => {
			this._triggerFailure("end", new EventNotFound());
		});
		this.stream.on("finish", () => {
			this._triggerFailure("finish", new EventNotFound());
		});

		this.end = this.eventState("end");
		this.finish = this.eventState("finish");
		this.complete = new Promise((resolve, reject) => {
			this.stream.on('end', resolve);
			this.stream.on('finish', resolve);
			this._failureActions.error.push(reject);
		});
		this.close = this.eventState("close");

		untracked(this.end);
		untracked(this.finish);
		untracked(this.complete);
		untracked(this.close);
	}

	_triggerFailure(eventName, value) {
		const actions = this._failureActions[eventName];
		
		// Future failure actions are triggered immediately
		this._failureActions[eventName] = {
			push(action) { action(value); }
		};

		for (const action of actions) {
			action(value);
		}
	}

	eventState(eventName) {
		return new Promise((resolve, reject) => {
			this.stream.on(eventName, resolve);
			if (eventName !== "error")
				this._failureActions.error.push(reject);
			if (eventName !== "end" && eventName !== "close")
				this._failureActions.end.push(reject);
			if (eventName !== "finish" && eventName !== "close")
				this._failureActions.finish.push(reject);
		});
	}
}

export { StreamState as default };
