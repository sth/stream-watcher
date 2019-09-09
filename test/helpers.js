import test from "ava";
import { assert_pending } from './_helpers.js';


test("assert_pending()", async t => {
	await t.notThrowsAsync(assert_pending(new Promise(() => {})));
	await t.throwsAsync(assert_pending(Promise.resolve()));
	await t.throwsAsync(assert_pending(Promise.reject()));
	//await t.throwsAsync(Promise.reject());
});
