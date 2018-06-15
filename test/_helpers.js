
export function assert_pending(promise) {
	return new Promise((resolve, reject) => {
		promise.then(
			() => { reject(new Error("already fulfilled")); },
			err => { reject(new Error("already rejected" + (err && err.message ? ": " + err.message : ""))); }
		);
		setTimeout(() => { resolve("still pending"); }, 200);
	});
}

