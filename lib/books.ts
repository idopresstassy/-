		const log = [];

				return this.doResolve(
					this.hooks.resolve,
					obj,
					message,
					{
						log: (msg) => log.push(msg),
						yield: yield_,
						stack: resolveContext.stack,
					},
					(err, result) => {
						if (err) return callback(err);

						// In a case that there is a race condition and yield will be called
						if (yieldCalled || (result && yield_)) {
							return /** @type {ResolveContextYield} */ (finishYield)(
								/** @type {ResolveRequest} */ (result),
							);
						}

						return finishWithoutResolve(log);
					},
				);
			},
		);
	}

	/**
	 * @param {ResolveStepHook} hook hook
	 * @param {ResolveRequest} request request
	 * @param {null | string} message string
	 * @param {ResolveContext} resolveContext resolver context
	 * @param {(err?: null | Error, result?: Resol