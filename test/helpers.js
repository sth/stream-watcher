import test from "ava";
import { assert_pending } from './_helpers.js';


test("assert_pending()", async t => {
	await t.notThrows(assert_pending(new Promise(() => {})));
	await t.throws(assert_pending(Promise.resolve()));
	await t.throws(assert_pending(Promise.reject()));
	//await t.throws(Promise.reject());
});
