"use strict";

/**
 * What the Energy Match add-on costs. Kept apart from the Stripe code so the
 * free-reading limit can show the price without loading Stripe.
 */
const ENERGY_MATCH_PRICE_USD = 4.99; // the charge (inline price) and the amount shown in the app
const ENERGY_MATCH_INTERVAL = "month";

module.exports = { ENERGY_MATCH_PRICE_USD, ENERGY_MATCH_INTERVAL };
