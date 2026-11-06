/**
 * verify-routes.js
 * Verifies that:
 * 1. Every place-to-place pair (n x (n-1)) return a valid route.
 * 2. RouteCore.nearest works across every place and category,
 *    returns properly sorted results, and never includes the origin place.
 */
const CAMPUS = require('../js/data.js');
const RouteCore = require('../js/route-core.js');

const places = CAMPUS.places;
const categories = Object.keys(CAMPUS.categories);

// 1. Test every route pair
let totalPairs = 0;
let successCount = 0;
let failures = [];

for (const from of places) {
  for (const to of places) {
    if (from.id === to.id) continue;
    totalPairs++;
    const route = RouteCore.route(from.id, to.id);
    if (!route || !route.points || route.points.length < 2 || !route.steps || route.steps.length === 0) {
      failures.push({ from: from.id, to: to.id, error: 'No route or invalid route structure' });
    } else if (route.meters <= 0 || route.minutes <= 0) {
      failures.push({ from: from.id, to: to.id, error: `Invalid distance or time (${route.meters}m, ${route.minutes}min)` });
    } else {
      successCount++;
    }
  }
}

console.log(`Tested ${totalPairs} place pairs: ${successCount} successful, ${failures.length} failed.`);

if (failures.length > 0) {
  console.error('Route Failures:', failures);
  process.exit(1);
} else {
  console.log(`✓ All ${totalPairs} route pairs verified successfully!`);
}

// 2. Test RouteCore.nearest for all 21 places x 5 categories
let nearestTests = 0;
let nearestSuccess = 0;
let nearestFailures = [];

for (const from of places) {
  for (const cat of categories) {
    nearestTests++;
    try {
      const results = RouteCore.nearest(from.id, cat, 3);
      if (!Array.isArray(results)) {
        nearestFailures.push({ from: from.id, cat, error: 'Expected array output' });
        continue;
      }

      // Check max limit
      if (results.length > 3) {
        nearestFailures.push({ from: from.id, cat, error: `Returned ${results.length} results, expected <= 3` });
        continue;
      }

      // Verify no self-inclusion
      if (results.some(r => r.place.id === from.id)) {
        nearestFailures.push({ from: from.id, cat, error: 'Result includes starting place itself' });
        continue;
      }

      // Verify category match
      if (results.some(r => r.place.cat !== cat)) {
        nearestFailures.push({ from: from.id, cat, error: 'Result contains place with mismatched category' });
        continue;
      }

      // Verify distance sort order
      let sorted = true;
      for (let i = 1; i < results.length; i++) {
        if (results[i].route.meters < results[i - 1].route.meters) {
          sorted = false;
          break;
        }
      }
      if (!sorted) {
        nearestFailures.push({ from: from.id, cat, error: 'Results are not sorted ascending by distance' });
        continue;
      }

      nearestSuccess++;
    } catch (err) {
      nearestFailures.push({ from: from.id, cat, error: err.message });
    }
  }

  // Also test nearest across all categories (cat = null)
  const allCatResults = RouteCore.nearest(from.id, null, 3);
  if (!Array.isArray(allCatResults) || allCatResults.length === 0 || allCatResults.some(r => r.place.id === from.id)) {
    nearestFailures.push({ from: from.id, cat: 'any', error: 'Failed unconstrained nearest check' });
  }
}

console.log(`Tested ${nearestTests} RouteCore.nearest combinations: ${nearestSuccess} successful, ${nearestFailures.length} failed.`);

if (nearestFailures.length > 0) {
  console.error('Nearest Place Failures:', nearestFailures);
  process.exit(1);
} else {
  console.log(`✓ All ${nearestTests} RouteCore.nearest category tests verified successfully!`);
}
