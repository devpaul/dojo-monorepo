import UrlSearchParams from '@dojo/core/UrlSearchParams';
import { suite, test } from 'intern!tdd';
import * as assert from 'intern/chai!assert';
import { stub } from 'sinon';
import { DefaultParameters, Context, Parameters } from '../../src/interfaces';
import { deconstruct as deconstructPath } from '../../src/lib/path';

import Route, { MatchType } from '../../src/Route';
import Router from '../../src/Router';

suite('Route', () => {
	test('can create route without options', () => {
		assert.doesNotThrow(() => {
			new Route();
		});
	});

	test('a route is not matched if guard() returns false', () => {
		const route = new Route({
			guard () {
				return false;
			}
		});

		const selections = route.select({} as Context, [], false, new UrlSearchParams());
		assert.lengthOf(selections, 0);
	});

	test('guard() receives the context', () => {
		const context: Context = {};
		let received: Context = <any> undefined;
		const route = new Route({
			guard ({ context }) {
				received = context;
				return true;
			}
		});

		route.select(context, [], false, new UrlSearchParams());
		assert.strictEqual(received, context);
	});

	test('path must not contain #', () => {
		assert.throws(() => {
			new Route({ path: '/foo#' });
		}, TypeError, 'Path must not contain \'#\'');
	});

	test('path segments cannot contain &', () => {
		assert.throws(() => {
			new Route({ path: '/&/bar' });
		}, TypeError, 'Path segment must not contain \'&\'');
	});

	test('path segments cannot be empty', () => {
		assert.throws(() => {
			new Route({ path: '/foo//bar' });
		}, TypeError, 'Path segment must not be empty');
	});

	test('path must contain at least one segment', () => {
		assert.throws(() => {
			new Route({ path: '?{query}' });
		}, TypeError, 'Path must contain at least one segment');

		assert.throws(() => {
			new Route({ path: '/?{query}' });
		}, TypeError, 'Path must contain at least one segment');
	});

	test('path parameters are extracted', () => {
		const route = new Route<Context, DefaultParameters>({
			path: '/{foo}/{bar}?{baz}&{qux}'
		});

		const result = route.select({} as Context, ['quux', 'corge'], false, new UrlSearchParams('baz=grault&qux=garply'));
		if (typeof result === 'string') {
			throw new TypeError('Unexpected result');
		}

		const [ { params } ] = result;
		assert.deepEqual(params, {
			foo: 'quux',
			bar: 'corge',
			baz: 'grault',
			qux: 'garply'
		});
	});

	test('search parameters are optional', () => {
		const route = new Route<Context, DefaultParameters>({
			path: '/{foo}/{bar}?{baz}&{qux}'
		});

		const result = route.select({} as Context, ['quux', 'corge'], false, new UrlSearchParams('baz=grault'));
		if (typeof result === 'string') {
			throw new TypeError('Unexpected result');
		}

		const [ { params } ] = result;
		assert.deepEqual(params, {
			foo: 'quux',
			bar: 'corge',
			baz: 'grault'
		});
	});

	test('only the first search parameter value is extracted', () => {
		const route = new Route<Context, DefaultParameters>({
			path: '/{foo}/{bar}?{baz}&{qux}'
		});

		const result = route.select({} as Context, ['quux', 'corge'], false, new UrlSearchParams('baz=grault&baz=garply'));
		if (typeof result === 'string') {
			throw new TypeError('Unexpected result');
		}

		const [ { params } ] = result;
		assert.deepEqual(params, {
			foo: 'quux',
			bar: 'corge',
			baz: 'grault'
		});
	});

	test('path parameters cannot contain {, & or :', () => {
		assert.throws(() => {
			new Route({ path: '/{{}' });
		}, TypeError, 'Parameter name must not contain \'{\', \'&\' or \':\'');

		assert.throws(() => {
			new Route({ path: '/{&}' });
		}, TypeError, 'Parameter name must not contain \'{\', \'&\' or \':\'');

		assert.throws(() => {
			new Route({ path: '/{:}' });
		}, TypeError, 'Parameter name must not contain \'{\', \'&\' or \':\'');
	});

	test('path parameters must be named', () => {
		assert.throws(() => {
			new Route({ path: '/{}/' });
		}, TypeError, 'Parameter must have a name');
	});

	test('path parameters must be closed', () => {
		assert.throws(() => {
			new Route({ path: '/{foo/' });
		}, TypeError, 'Parameter name must be followed by \'}\', got \'/\'');
	});

	test('path parameters must be separated by /', () => {
		assert.throws(() => {
			new Route({ path: '/{foo}{bar}' });
		}, TypeError, 'Parameter must be followed by \'/\' or \'?\', got \'{\'');
	});

	test('search parameters must be separated by &', () => {
		assert.throws(() => {
			new Route({ path: '/segment?{foo}{bar}' });
		}, TypeError, 'Search parameter must be followed by \'&\', got \'{\'');
	});

	test('search component must only contain parameters', () => {
		assert.throws(() => {
			new Route({ path: '/segment?foo=bar' });
		}, TypeError, 'Expected parameter in search component, got \'foo=bar\'');

		assert.throws(() => {
			new Route({ path: '/segment?{foo}&/bar' });
		}, TypeError, 'Expected parameter in search component, got \'/\'');

		assert.throws(() => {
			new Route({ path: '/segment?{foo}&?bar' });
		}, TypeError, 'Expected parameter in search component, got \'?\'');

		assert.throws(() => {
			new Route({ path: '/segment?{foo}&&bar' });
		}, TypeError, 'Expected parameter in search component, got \'&\'');
	});

	test('path parameters must have unique names', () => {
		assert.throws(() => {
			new Route({ path: '/{foo}/{foo}' });
		}, TypeError, 'Parameter must have a unique name, got \'foo\'');

		assert.throws(() => {
			new Route({ path: '/{foo}?{foo}' });
		}, TypeError, 'Parameter must have a unique name, got \'foo\'');
		assert.throws(() => {
			new Route({ path: '/segment?{foo}&{foo}' });
		}, TypeError, 'Parameter must have a unique name, got \'foo\'');

		assert.throws(() => {
			new Route({ path: '/segment?{foo}&{foo}' });
		}, TypeError, 'Parameter must have a unique name, got \'foo\'');
	});

	test('deconstructed path can be accessed and is deeply frozen', () => {
		const { path } = new Route({ path: '/foo/{bar}?{baz}' });
		assert.isTrue(Object.isFrozen(path));

		const { expectedSegments, leadingSlash, parameters, searchParameters, trailingSlash } = path;
		assert.isTrue(Object.isFrozen(expectedSegments));
		assert.isTrue(Object.isFrozen(parameters));
		assert.isTrue(Object.isFrozen(searchParameters));

		assert.lengthOf(expectedSegments, 2);
		assert.isTrue(Object.isFrozen(expectedSegments[0]));
		assert.isTrue(Object.isFrozen(expectedSegments[1]));
		assert.deepEqual(expectedSegments, [
			{ literal: 'foo' },
			{ name: 'bar' }
		]);

		assert.isTrue(leadingSlash);
		assert.deepEqual(parameters, [ 'bar' ]);
		assert.deepEqual(searchParameters, [ 'baz' ]);
		assert.isFalse(trailingSlash);
	});

	test('guard() receives the extracted parameters', () => {
		let received: Parameters = <any> undefined;
		const route = new Route({
			path: '/{foo}/{bar}?{baz}&{qux}',
			guard ({ params }) {
				received = params;
				return true;
			}
		});
		route.select({} as Context, ['quux', 'corge'], false, new UrlSearchParams('baz=grault&qux=garply'));
		assert.deepEqual(received, {
			foo: 'quux',
			bar: 'corge',
			baz: 'grault',
			qux: 'garply'
		});
	});

	test('parameter extraction can be customized', () => {
		interface Customized extends Parameters {
			upper: string;
			barIsQux: boolean;
		}
		const route = new Route<Context, Customized>({
			path: '/{foo}/{bar}',
			params (fromPath) {
				const [foo, bar] = fromPath;
				return {
					upper: foo.toUpperCase(),
					barIsQux: bar === 'qux'
				};
			}
		});

		const result = route.select({} as Context, ['baz', 'qux'], false, new UrlSearchParams());
		if (typeof result === 'string') {
			throw new TypeError('Unexpected result');
		}

		const [ { params } ] = result;
		assert.deepEqual(params, {
			upper: 'BAZ',
			barIsQux: true
		});
	});

	test('search parameter extraction can be customized', () => {
		interface Customized {
			fooArr: string[];
			barIsQux: boolean;
		}
		const route = new Route<Context, Customized>({
			path: '/segment?{foo}&{bar}',
			params (fromPath, searchParams) {
				return {
					fooArr: searchParams.getAll('foo') || [],
					barIsQux: searchParams.get('bar') === 'qux'
				};
			}
		});

		const result = route.select({} as Context, ['segment'], false, new UrlSearchParams('foo=baz&bar=qux&foo=BAZ'));
		if (typeof result === 'string') {
			throw new TypeError('Unexpected result');
		}

		const [ { params } ] = result;
		assert.deepEqual(params, {
			fooArr: ['baz', 'BAZ'],
			barIsQux: true
		});
	});

	test('parameter extraction cannot be customized if the path doesn\'t contain parameters', () => {
		assert.throws(() => {
			new Route({
				path: '/foo/bar',
				params () {
					return {};
				}
			});
		}, TypeError, 'Can\'t specify params() if path doesn\'t contain any');
	});

	test('parameter extraction can cause a route not to match', () => {
		const route = new Route({
			path: '/{foo}',
			params () {
				return <any> null;
			}
		});

		const selections = route.select({} as Context, ['foo'], false, new UrlSearchParams());
		assert.lengthOf(selections, 0);
	});

	test('without a path, is selected for zero segments', () => {
		const route = new Route();
		const selections = route.select({} as Context, [], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 1);
		assert.strictEqual(selections[0].route, route);
	});

	test('without a path or nested routes, is not selected for segments', () => {
		const route = new Route();
		const selections = route.select({} as Context, ['foo'], false, new UrlSearchParams());
		assert.lengthOf(selections, 0);
	});

	test('with a path, is selected if segments match', () => {
		const route = new Route({ path: '/foo/bar' });
		const selections = route.select({} as Context, ['foo', 'bar'], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 1);
		assert.strictEqual(selections[0].route, route);
	});

	test('with a path, is not selected if segments do not match', () => {
		{
			const route = new Route({ path: '/foo/bar' });
			const selections = route.select({} as Context, ['baz', 'qux'], false, new UrlSearchParams());
			assert.lengthOf(selections, 0);
		}

		{
			const route = new Route({ path: '/foo/bar' });
			const selections = route.select({} as Context, ['foo'], false, new UrlSearchParams());
			assert.lengthOf(selections, 0);
		}
	});

	test('selects nested routes', () => {
		const root = new Route({ path: '/foo' });
		const deep = new Route({ path: '/bar' });
		const deeper = new Route({ path: '/baz' });
		root.append(deep);
		deep.append(deeper);

		const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 3);
		const [{ route: first }, { route: second }, { route: third }] = selections;
		assert.strictEqual(first, root);
		assert.strictEqual(second, deep);
		assert.strictEqual(third, deeper);
	});

	test('selects nested routes in order of registration', () => {
		{
			const root = new Route({ path: '/foo' });
			const deep = new Route({ path: '/bar' });
			const altDeep = new Route({ path: '/bar/baz' });
			const deeper = new Route({ path: '/baz' });
			root.append(deep);
			root.append(altDeep);
			deep.append(deeper);

			const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
			assert.lengthOf(selections, 3);
		}

		{
			const root = new Route({ path: '/foo' });
			const deep = new Route({ path: '/bar' });
			const altDeep = new Route({ path: '/bar/baz' });
			const deeper = new Route({ path: '/baz' });
			root.append(altDeep);
			root.append(deep);
			deep.append(deeper);

			const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
			assert.lengthOf(selections, 2);
		}
	});

	test('leading slashes are irrelevant', () => {
		const root = new Route({ path: 'foo' });
		const deep = new Route({ path: '/bar' });
		const deeper = new Route({ path: 'baz' });
		root.append(deep);
		deep.append(deeper);

		const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
		assert.lengthOf(selections, 3);
	});

	test('if present in route, there must be a trailing slash when selecting', () => {
		[true, false].forEach(withSlash => {
			const root = new Route({ path: '/foo/' });
			const deep = new Route({ path: '/bar/' });
			const deeper = new Route({ path: '/baz/' });
			root.append(deep);
			deep.append(deeper);

			const selections = root.select({} as Context, ['foo', 'bar', 'baz'], withSlash, new UrlSearchParams());
			assert.lengthOf(selections, withSlash ? 3 : 0, `there is ${withSlash ? 'a' : 'no'} trailing slash when selecting`);
		});
	});

	test('if not present in route, there must not be a trailing slash when selecting', () => {
		[true, false].forEach(withSlash => {
			const root = new Route({ path: '/foo/' });
			const deep = new Route({ path: '/bar/' });
			const deeper = new Route({ path: '/baz' });
			root.append(deep);
			deep.append(deeper);

			const selections = root.select({} as Context, ['foo', 'bar', 'baz'], withSlash, new UrlSearchParams());
			assert.lengthOf(selections, withSlash ? 0 : 3, `there is ${withSlash ? 'a' : 'no'} trailing slash when selecting`);
		});
	});

	test('routes can be configured to ignore trailing slash discrepancies', () => {
		[true, false].forEach(withSlash => {
			const root = new Route({ path: '/foo/' });
			const deep = new Route({ path: '/bar/' });
			const deeper = new Route({
				path: `/baz${withSlash ? '' : '/'}`,
				trailingSlashMustMatch: false
			});
			root.append(deep);
			deep.append(deeper);

			const selections = root.select({} as Context, ['foo', 'bar', 'baz'], withSlash, new UrlSearchParams());
			assert.lengthOf(selections, 3, `there is ${withSlash ? 'a' : 'no'} trailing slash when selecting`);
		});
	});

	test('all segments must match for a route hierarchy to be selected', () => {
		const root = new Route({ path: 'foo' });
		const deep = new Route({ path: '/bar' });
		root.append(deep);

		const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
		assert.lengthOf(selections, 0);
	});

	test('selections contain expected properties', () => {
		const root = new Route({ path: '/foo/{param}?{foo}' });
		const deep = new Route({ path: '/bar/{param}?{bar}' });
		const deeper = new Route({ path: '/baz/{param}?{foo}&{baz}' });
		root.append(deep);
		deep.append(deeper);

		const selections = root.select({} as Context, ['foo', 'root', 'bar', 'deep', 'baz', 'deeper'], false, new UrlSearchParams({
			'foo': [ 'foo'] ,
			'baz': [ 'one', 'two' ]
		}));
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 3);
		const [first, second, third] = selections;
		assert.deepEqual(first.params, { param: 'root', foo: 'foo' });
		assert.deepEqual(first.rawPathValues, [ 'root' ]);
		assert.deepEqual(first.rawSearchParams, { foo: [ 'foo' ] });
		assert.deepEqual(first.path, deconstructPath('/foo/{param}?{foo}'));
		assert.strictEqual(first.route, root);

		assert.deepEqual(second.params, { param: 'deep' });
		assert.deepEqual(second.rawPathValues, [ 'deep' ]);
		assert.deepEqual(second.rawSearchParams, {});
		assert.deepEqual(second.path, deconstructPath('/bar/{param}?{bar}'));
		assert.strictEqual(second.route, deep);

		assert.deepEqual(third.params, { param: 'deeper', foo: 'foo', baz: 'one' });
		assert.deepEqual(third.rawPathValues, [ 'deeper' ]);
		assert.deepEqual(third.rawSearchParams, { foo: [ 'foo' ], baz: [ 'one', 'two' ] });
		assert.deepEqual(third.path, deconstructPath('/baz/{param}?{foo}&{baz}'));
		assert.strictEqual(third.route, deeper);
	});

	test('guards can request redirects by returning path strings', () => {
		const root = new Route({ path: '/root' });
		const deep = new Route({
			path: '/deep',
			guard() {
				return '/shallow';
			}
		});
		root.append(deep);

		assert.strictEqual(root.select({} as Context, ['root', 'deep'], false, new UrlSearchParams()), '/shallow');
	});

	test('guards can request redirects by returning empty path strings', () => {
		const root = new Route({ path: '/root' });
		const deep = new Route({
			path: '/deep',
			guard() {
				return '';
			}
		});
		root.append(deep);

		assert.strictEqual(root.select({} as Context, ['root', 'deep'], false, new UrlSearchParams()), '');
	});

	test('guard() is not called unnecessarily', () => {
		let called: string[];
		const root = new Route({
			path: '/root',
			guard () {
				called.push('root');
				return true;
			}
		});
		const deep = new Route({
			path: '/deep',
			guard () {
				called.push('deep');
				return true;
			}
		});
		root.append(deep);

		called = [];
		root.select({} as Context, ['root'], false, new UrlSearchParams());
		assert.deepEqual(called, ['root'], '/root');

		called = [];
		root.select({} as Context, ['root', 'deep'], false, new UrlSearchParams());
		assert.deepEqual(called, ['root', 'deep'], '/root/deep');

		called = [];
		root.select({} as Context, ['root', 'deep', 'deeper'], false, new UrlSearchParams());
		assert.deepEqual(called, ['root'], '/root/deep/deeper (deep isn’t selected because it doesn’t have a fallback)');
	});

	test('can append several routes at once', () => {
		const root = new Route({ path: '/foo' });
		const deep = new Route({ path: '/bar' });
		const altDeep = new Route({ path: '/bar/baz' });
		root.append([altDeep, deep]);

		const selections = root.select({} as Context, ['foo', 'bar', 'baz'], false, new UrlSearchParams());
		assert.lengthOf(selections, 2);
	});

	test('routes can only be appended once', () => {
		const foo = new Route({ path: '/foo' });
		const bar = new Route({ path: '/bar' });
		const baz = new Route({ path: '/baz' });

		foo.append(bar);
		assert.throws(() => {
			foo.append(bar);
		}, Error, 'Cannot append route that has already been appended');
		assert.throws(() => {
			foo.append([ bar, baz ]);
		}, Error, 'Cannot append route that has already been appended');
		assert.throws(() => {
			baz.append(bar);
		}, Error, 'Cannot append route that has already been appended');
	});

	test('link() throws if the route has not been appended to a router', () => {
		const foo = new Route();
		const bar = new Route();
		foo.append(bar);

		assert.throws(() => {
			foo.link();
		}, Error, 'Cannot generate link for route that is not in the hierarchy');
		assert.throws(() => {
			bar.link();
		}, Error, 'Cannot generate link for route that is not in the hierarchy');
	});

	test('link() forwards to link() on router', () => {
		const router = new Router();
		const foo = new Route();
		const bar = new Route();
		foo.append(bar);
		router.append(foo);

		const expected = '/foo';
		const link = stub(router, 'link').returns(expected);

		{
			assert.equal(foo.link(), expected);
			assert.isTrue(link.calledOnce);
			const { args } = link.firstCall;
			assert.lengthOf(args, 2);
			assert.strictEqual(args[0], foo);
			assert.isUndefined(args[1]);
		}

		{
			const params = {};
			assert.equal(bar.link(params), expected);
			assert.isTrue(link.calledTwice);
			const { args } = link.secondCall;
			assert.lengthOf(args, 2);
			assert.strictEqual(args[0], bar);
			assert.strictEqual(args[1], params);
		}
	});

	// This test is mostly there to verify the typings at compile time.
	test('Route() takes a Context type', () => {
		interface Refined extends Context {
			refined: boolean;
		}
		const route = new Route<Refined, any>({
			path: '/foo',
			exec({ context }) {
				assert.isTrue(context.refined);
			}
		});
		const context: Refined = { refined: true };
		const result = route.select(context, ['foo'], false, new UrlSearchParams());
		if (Array.isArray(result)) {
			result[0].handler({ context, params: {} });
		}
	});

	test('exact matched route returns "index" type', () => {
		const route = new Route({ path: '/foo/bar', outlet: '1' });
		const selections = route.select({} as Context, ['foo', 'bar'], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 1);
		assert.strictEqual(selections[0].route, route);
		assert.strictEqual(selections[0].type, MatchType.INDEX);
	});
	test('matched route returns "outlet" type', () => {
		const route1 = new Route({ path: '/foo/bar', outlet: '1' });
		const route2 = new Route({ path: '/qux', outlet: '2' });
		route1.append(route2);
		const selections = route1.select({} as Context, ['foo', 'bar', 'qux'], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 2);
		assert.strictEqual(selections[0].route, route1);
		assert.strictEqual(selections[0].type, MatchType.PARTIAL);
	});
	test('unmatched route returns "error" type when an outlet id is specified', () => {
		const route = new Route({ path: '/foo/bar', outlet: '1' });
		const selections = route.select({} as Context, ['foo', 'bar', 'qux'], false, new UrlSearchParams());
		if (typeof selections === 'string') {
			throw new TypeError('Unexpected result');
		}

		assert.lengthOf(selections, 1);
		assert.strictEqual(selections[0].route, route);
		assert.strictEqual(selections[0].type, MatchType.ERROR);
	});
});
