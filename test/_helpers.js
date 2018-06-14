
export function assert_pending(promise) {
	return new Promise((resolve, reject) => {
		promise.then(
			() => { reject(new Error("already fulfilled")); },
			() => { reject(new Error("already rejected")); }
		);
		setTimeout(() => { resolve("still pending"); }, 200);
	});
}

