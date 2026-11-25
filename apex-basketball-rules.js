/* Shared, pure relationship rules. No writes and no implicit stat creation. */
(() => {
  'use strict';
  const other = team => team === 'us' ? 'opponent' : team === 'opponent' ? 'us' : null;
  const rebound = (shooter, receiving, outOfBounds = false) => {
    if (!['us','opponent'].includes(shooter) || !['us','opponent'].includes(receiving)) return null;
    const kind = shooter === receiving ? 'offensive_rebound' : 'defensive_rebound';
    return Object.freeze({
      team: receiving,
      type: outOfBounds ? 'team_' + kind : kind,
      reason: outOfBounds ? 'out_of_bounds' : null,
      needsJersey: !outOfBounds && receiving === 'us',
      possession: receiving
    });
  };
  const nextAfterShot = (made) => made ? ['assist','no_assist','new_event'] :
    ['offensive_rebound','defensive_rebound','out_of_bounds_us','out_of_bounds_opponent','block','skip'];
  window.ApexBasketballRules = Object.freeze({other, rebound, nextAfterShot});
})();
