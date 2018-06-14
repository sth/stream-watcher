
export class EventNotFound extends Error {
	constructor() {
		super("Stream ended without encountering event");
	}
}

function untracked(promise) {
	promise.catch(err => {});
}

class FailStates {
	constructor() {
		this._states = {};
	}
	_state(name) {
		if (!this._states[name]) {
			this._states[name] = {
				triggered: false,
				value: undefined,
				actions: []
			};
		}
		return this._states[name];
	}
	on(name, action) {
		const st = this._state(name);
		if (st.triggered)
			action(st.value);
		else
			st.actions.push(action);
	}
	trigger(name, value) {
		const st = this._state(name);
		if (st.triggered)
			return;
		st.triggered = true;
		st.value = value;
		for (const action of st.actions) {
			action(value);
		}
	}
}

export class StreamState {
	constructor(stream, options = {}) {
		this.stream = stream;
		this._failures = new FailStates();

		this.stream.on("error", err => {
			if (options.error) {
				try {
					err = options.error(err);
				}
				catch (handlerErr) {
					this._failures.trigger("error", handlerErr);
					return;
				}
				if (err) {
					this._failures.trigger("error", err);
					return;
				}
			} else {
				this._failures.trigger("error", err);
				return;
			}
		});
		this.stream.on("end", () => {
			this._failures.trigger("end", new EventNotFound());
		});
		this.stream.on("finish", () => {
			this._failures.trigger("finish", new EventNotFound());
		});

		this.end = this.eventState("end");
		this.finish = this.eventState("finish");
		this.complete = new Promise((resolve, reject) => {
			this.stream.on('end', resolve);
			this.stream.on('finish', resolve);
			this._failures.on("error", reject);
		});
		this.close = this.eventState("close");

		untracked(this.end);
		untracked(this.finish);
		untracked(this.complete);
		untracked(this.close);
	}

	eventState(eventName) {
		return new Promise((resolve, reject) => {
			this.stream.on(eventName, resolve);
			if (eventName !== "error")
				this._failures.on("error", reject);
			if (eventName !== "end" && eventName !== "close")
				this._failures.on("end", reject);
			if (eventName !== "finish" && eventName !== "close")
				this._failures.on("finish", reject);
		});
	}
}

export { StreamState as default };
