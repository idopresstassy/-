bject
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveContext=} resolveContext resolve context
	 * @returns {Promise<string | false>} result
	 */
	/**
	 * @param {Context | string} context context information object or context path when no context is provided
	 * @param {string | ResolveContext=} path context path or resolve context when no context is provided
	 * @param {string | ResolveContext=} request request string or resolve context when no context is provided
	 * @param {ResolveContext=} resolveContext resolve context
	 * @returns {Promise<string | false>} result
	 */
	resolvePromise(context, path, request, resolveContext) {
		// `|| {}` ensures the 5-arg fast path inside `resolve()` is reached
		// even when the caller doesn't pass a resolveContext.
		return _withResolvers(
			this,
			/** @type {Context} */ (context),
			/** @type {string} */ (path),
			/** @type {string} */ (request),
			/** @type {ResolveContext} */ (resolveContext) || {},
		);
	}

	/**
	 * @overload
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveCallback} callback callback function
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveContext} resolveContext resolve context
	 * @param {ResolveCallback} callback callback function
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {Context} context context information object
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveCallback} callback callback function
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {Context} context context information object
	 * @param {string} path context path
	 * @param {string} request request string
	 * @param {ResolveContext} resolveContext resolve context
	 * @param {ResolveCallback} callback callback function
	 * @returns {void}
	 */
	/**
	 * @param {Context | string} context context information object or context path when no context is provided
	 * @param {string | ResolveContext | ResolveCallback=} path context path or (when no context) resolve context or callback
	 * @param {string | ResolveContext | ResolveCallback=} request request string or (when no context) resolve context or callback
	 * @param {ResolveContext | ResolveCallback=} resolveContext resolve context or callback when no resolve context is provided
	 * @param {ResolveCallback=} callback callback function
	 * @returns {void}
	 */
	resolve(context, path, request, resolveContext, callback) {
		// Fast path for the common 5-arg call (`resolver.resolve(ctx, from,
		// req, resolveCtx, cb)`) — every call from `resolveSync` /
		// `resolvePromise` plus the vast majority of direct API callers.
		// PR #536 added runtime overload-shifting to support optional
		// `context` / `resolveContext`; that adds several `typeof` checks
		// per resolve which show up as a measurable instruction-count
		// regression on every benchmark that calls into this method. Skip
		// the shifting entirely when all 5 args are already well-typed.
		if (
			typeof callback === "function" &&
			typeof context === "object" &&
			context !== null &&
			typeof resolveContext === "object" &&
			resolveContext !== null
		) {
			// proceed straight to per-arg validation below
		} else {
			// Slow path: shift positional args based on what was supplied.
			// Shift when context is omitted (first positional arg is the path string).
			if (typeof context === "string") {
				// Keep an already-supplied callback (resolveSync / resolvePromise
				// always pass one in the 5th position).
				if (typeof callback !== "function") {
					callback = /** @type {ResolveCallback | undefined} */ (
						resolveContext
					);
				}
				resolveContext =
					/** @type {ResolveContext | ResolveCallback | undefined} */ (request);
				request = /** @type {string} */ (path);
				path = context;
				context = {};
			}
			// 4-arg form: the resolveContext slot holds the callback.
			if (typeof resolveContext === "function") {
				callback = resolveContext;
				resolveContext = {};
			} else if (!resolveContext || typeof resolveContext !== "object") {
				resolveContext = {};
			}
			if (typeof callback !== "function") {
				throw new TypeError("callback argument is not a function");
			}
			if (!context || typeof context !== "object") {
				context = {};
			}
		}
		if (typeof path !== "string") {
			return callback(new Error("path argument is not a string"));
		}
		if (typeof request !== "string") {
			return callback(new Error("request argument is not a string"));
		}

		/** @type {ResolveRequest} */
		const obj = {
			context,
			path,
			request,
		};

		/** @type {ResolveContextYield | undefined} */
		let yield_;
		let yieldCalled = false;
		/** @type {ResolveContextYield | undefined} */
		let finishYield;
		if (typeof resolveContext.yield === "function") {
			const old = resolveContext.yield;
			/**
			 * @param {ResolveRequest} obj object
			 */
			yield_ = (obj) => {
				old(obj);
				yieldCalled = true;
			};
			/**
			 * @param {ResolveRequest} result result
			 * @returns {void}
			 */
			finishYield = (result) => {
				if (result) {
					/** @type {ResolveContextYield} */ (yield_)(result);
				}
				callback(null);
			};
		}

		const message = `resolve '${request}' in '${path}'`;

		/**
		 * @param {ResolveRequest} result result
		 * @returns {void}
		 */
		const finishResolved = (result) => {
			const resultPath = result.path;
			if (resultPath === false) return callback(null, false, result);
			const escapedPath = resultPath.includes("#")
				? resultPath.replace(HASH_ESCAPE_RE, "\0#")
				: resultPath;
			const resultQuery = result.query;
			let escapedQuery;
			if (resultQuery) {
				escapedQuery = resultQuery.includes("#")
					? resultQuery.replace(HASH_ESCAPE_RE, "\0#")
					: resultQuery;
			} else {
				escapedQuery = "";
			}
			return callback(
				null,
				`${escapedPath}${escapedQuery}${result.fragment || ""}`,
				result,
			);
		};

		/**
		 * @param {string[]} log logs
		 * @returns {void}
		 */
		const finishWithoutResolve = (log) => {
			/**
			 * @type {ErrorWithDetail}
			 */
			const error = new Error(`Can't ${message}`);
			error.details = log.join("\n");
			this.hooks.noResolve.call(obj, error);
			return callback(error);
		};

		if (resolveContext.log) {
			// We need log anyway to capture it in case of an error
			const parentLog = resolveContext.log;
			/** @type {string[]} */
			const log = [];
			return this.doResolve(
				this.hooks.resolve,
				obj,
				message,
				{
					log: (msg) => {
						parentLog(msg);
						log.push(msg);
					},
					yield: yield_,
					fileDependencies: resolveContext.fileDependencies,
					contextDependencies: resolveContext.contextDependencies,
					missingDependencies: resolveContext.missingDependencies,
					stack: resolveContext.stack,
				},
				(err, result) => {
					if (err) return callback(err);

					if (yieldCalled || (result && yield_)) {
						return /** @type {ResolveContextYield} */ (finishYield)(
							/** @type {ResolveRequest} */ (result),
						);
					}

					if (result) return finishResolved(result);

					return finishWithoutResolve(log);
				},
			);
		}
		// Try to resolve assuming there is no error
		// We don't log stuff in this case
		return this.doResolve(
			this.hooks.resolve,
			obj,
			message,
			{
				log: undefined,
				yield: yield_,
				fileDependencies: resolveContext.fileDependencies,
		