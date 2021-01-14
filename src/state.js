
export class EventNotFound extends Error {
	constructor() {
		super("Stream ended without encountering event");
	}
}

function untracked(promise) {
	promise.catch(err_unused => {});
}

class FailStates {
	constructor() {
		this._states = {};
		this.order = [];
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
		this.order.push(name);
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

			// Collect events on which we fail
			const failEvents = [];
			if (eventName !== "error")
				failEvents.push("error");
			if (eventName !== "end" && eventName !== "close")
				failEvents.push("end");
			if (eventName !== "finish" && eventName !== "close")
				failEvents.push("finish");

			// Check for already triggered fail events.
			// This ensures that we see already triggered events in order
			for (const name of this._failures.order) {
				// Could use Array#includes() for Node >6
				// failEvents is <= 3 elements, so iterating over it is not expensive
				if (failEvents.some(elem => elem == name)) {
					// This rejects immediately
					this._failures.on(name, reject);
					return;
				}
			}

			// No existing failure conditions, register all handlers
			for (const name of failEvents) {
				this._failures.on(name, reject);
			}
		});
	}
}

export { StreamState as default };
