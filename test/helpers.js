import test from "ava";
import { assert_pending } from './_helpers';


test("assert_pending()", async t => {
	await t.notThrowsAsync(assert_pending(new Promise(() => {})));
	await t.throwsAsync(assert_pending(Promise.resolve()), {message: "already fulfilled"});
	await t.throwsAsync(assert_pending(Promise.reject()), {message: "already rejected"});
});
