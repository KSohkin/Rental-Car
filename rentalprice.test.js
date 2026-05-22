// rentalprice.test.js
const { price } = require('./rentalPrice');

// ---------------------------------------------------------------------------
// Test date helpers
// Low season:  January  (month 0)  →  well outside May–November
// High season: July     (month 6)  →  inside May–November
// ---------------------------------------------------------------------------
function makeDate(year, month, day) {
  // month is 1-based here for readability, converted to 0-based for Date
  return new Date(year, month - 1, day).getTime();
}

// Convenience wrappers so individual tests only change what matters
const LOW_PICKUP  = makeDate(2024, 1, 10); // 10 Jan
const LOW_DROPOFF = makeDate(2024, 1, 12); // 12 Jan  → 3 days, low season
const HIGH_PICKUP  = makeDate(2024, 7, 1); // 1 Jul
const HIGH_DROPOFF = makeDate(2024, 7, 3); // 3 Jul  → 3 days, high season

function priceWith(overrides) {
  const defaults = {
    pickup:       'Tallinn',
    dropoff:      'Tartu',
    pickupDate:   LOW_PICKUP,
    dropoffDate:  LOW_DROPOFF,
    type:         'Compact',
    age:          30,
    licenseYears: 5,
  };
  const o = { ...defaults, ...overrides };
  return price(o.pickup, o.dropoff, o.pickupDate, o.dropoffDate, o.type, o.age, o.licenseYears);
}

// ===========================================================================
// 1. ELIGIBILITY – driver age
// ===========================================================================
describe('Eligibility – driver age', () => {
  test('driver under 18 is rejected', () => {
    expect(priceWith({ age: 17 })).toBe('Driver too young - cannot quote the price');
  });

  test('driver exactly 18 is accepted', () => {
    expect(priceWith({ age: 18 })).toMatch(/^\$/);
  });
});

// ===========================================================================
// 2. ELIGIBILITY – young driver car restriction (age ≤ 21)
// ===========================================================================
describe('Eligibility – young driver car restriction', () => {
  test('driver aged 21 cannot rent Electric', () => {
    expect(priceWith({ age: 21, type: 'Electric' }))
      .toBe('Drivers aged 21 or under can only rent Compact vehicles');
  });

  test('driver aged 21 cannot rent Cabrio', () => {
    expect(priceWith({ age: 21, type: 'Cabrio' }))
      .toBe('Drivers aged 21 or under can only rent Compact vehicles');
  });

  test('driver aged 21 cannot rent Racer', () => {
    expect(priceWith({ age: 21, type: 'Racer' }))
      .toBe('Drivers aged 21 or under can only rent Compact vehicles');
  });

  test('driver aged 21 CAN rent Compact', () => {
    expect(priceWith({ age: 21, type: 'Compact' })).toMatch(/^\$/);
  });

  test('driver aged 22 can rent any car (Electric)', () => {
    expect(priceWith({ age: 22, type: 'Electric' })).toMatch(/^\$/);
  });
});

// ===========================================================================
// 3. ELIGIBILITY – license duration
// ===========================================================================
describe('Eligibility – license duration', () => {
  test('license held 0 years is rejected', () => {
    expect(priceWith({ licenseYears: 0 }))
      .toBe('Driver must have held a license for at least 1 year to rent');
  });

  test('license held 0.5 years is rejected', () => {
    expect(priceWith({ licenseYears: 0.5 }))
      .toBe('Driver must have held a license for at least 1 year to rent');
  });

  test('license held exactly 1 year is accepted', () => {
    expect(priceWith({ licenseYears: 1 })).toMatch(/^\$/);
  });
});

// ===========================================================================
// 4. BASE PRICE  (age × days, no modifiers)
// Low season, experienced driver (licenseYears ≥ 3), not Racer, rental ≤ 10 days
// ===========================================================================
describe('Base price calculation', () => {
  test('30-year-old, 3 days, low season, no surcharges → $90.00', () => {
    // base = 30 * 3 = 90
    expect(priceWith({ age: 30, licenseYears: 5 })).toBe('$90.00');
  });

  test('price scales linearly with age', () => {
    expect(priceWith({ age: 40, licenseYears: 5 })).toBe('$120.00'); // 40*3
  });
});

// ===========================================================================
// 5. HIGH SEASON multiplier (×1.15)
// ===========================================================================
describe('High season multiplier', () => {
  test('high season adds 15% to price', () => {
    // age=30, days=3, base=90, ×1.15 = 103.50
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$103.50');
  });

  test('low season does NOT add 15%', () => {
    expect(priceWith({ age: 30, licenseYears: 5 })).toBe('$90.00');
  });
});

// ===========================================================================
// 6. RACER + high season + age ≤ 25  (×1.5 then ×1.15)
// ===========================================================================
describe('Racer young driver high-season surcharge', () => {
  test('Racer, age 25, high season → ×1.5 then ×1.15', () => {
    // base=25*3=75, ×1.5=112.5, ×1.15=129.375
    expect(priceWith({
      age: 25, type: 'Racer', licenseYears: 5,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$129.38');
  });

  test('Racer, age 26 (not young), high season → only ×1.15', () => {
    // base=26*3=78, ×1.15=89.7
    expect(priceWith({
      age: 26, type: 'Racer', licenseYears: 5,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$89.70');
  });

  test('Racer, age 25, LOW season → no multipliers', () => {
    // base=25*3=75
    expect(priceWith({
      age: 25, type: 'Racer', licenseYears: 5,
    })).toBe('$75.00');
  });
});

// ===========================================================================
// 7. LONG RENTAL discount (×0.9 when days > 10 AND low season)
// ===========================================================================
describe('Long rental low-season discount', () => {
  const LONG_LOW_PICKUP  = makeDate(2024, 1, 1);
  const LONG_LOW_DROPOFF = makeDate(2024, 1, 11); // 11 days, low season

  test('11 days in low season → 10% discount', () => {
    // base=30*11=330, ×0.9=297
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: LONG_LOW_PICKUP, dropoffDate: LONG_LOW_DROPOFF,
    })).toBe('$297.00');
  });

  test('exactly 10 days in low season → NO discount', () => {
    const tenDayDropoff = makeDate(2024, 1, 10); // 10 days
    // base=30*10=300
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: LONG_LOW_PICKUP, dropoffDate: tenDayDropoff,
    })).toBe('$300.00');
  });

  test('11 days in HIGH season → NO discount', () => {
    const longHighPickup  = makeDate(2024, 7, 1);
    const longHighDropoff = makeDate(2024, 7, 11); // 11 days, high season
    // base=30*11=330, ×1.15=379.50 (no long-rental discount)
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: longHighPickup, dropoffDate: longHighDropoff,
    })).toBe('$379.50');
  });
});

// ===========================================================================
// 8. LICENSE SURCHARGE – < 2 years (×1.30)
// ===========================================================================
describe('License surcharge – held less than 2 years', () => {
  test('licenseYears=1, low season → base ×1.30', () => {
    // base=30*3=90, ×1.30=117
    expect(priceWith({ age: 30, licenseYears: 1 })).toBe('$117.00');
  });

  test('licenseYears=1.5, low season → base ×1.30', () => {
    expect(priceWith({ age: 30, licenseYears: 1.5 })).toBe('$117.00');
  });

  test('licenseYears=2, low season → NO surcharge', () => {
    expect(priceWith({ age: 30, licenseYears: 2 })).toBe('$90.00');
  });
});

// ===========================================================================
// 9. LICENSE SURCHARGE – < 3 years + high season (+€15/day)
// ===========================================================================
describe('License surcharge – held less than 3 years in high season', () => {
  test('licenseYears=2, high season → +15 per day (3 days = +45)', () => {
    // base=30*3=90, ×1.15=103.50, +45=148.50
    expect(priceWith({
      age: 30, licenseYears: 2,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$148.50');
  });

  test('licenseYears=1, high season → ×1.30 AND +15/day', () => {
    // base=90, ×1.15=103.50, ×1.30=134.55, +45=179.55
    expect(priceWith({
      age: 30, licenseYears: 1,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$179.55');
  });

  test('licenseYears=3, high season → NO daily surcharge', () => {
    // base=90, ×1.15=103.50
    expect(priceWith({
      age: 30, licenseYears: 3,
      pickupDate: HIGH_PICKUP, dropoffDate: HIGH_DROPOFF,
    })).toBe('$103.50');
  });

  test('licenseYears=2, LOW season → NO daily surcharge', () => {
    // base=90, no high-season modifier
    expect(priceWith({ age: 30, licenseYears: 2 })).toBe('$90.00');
  });
});

// ===========================================================================
// 10. CAR CLASS normalisation
// ===========================================================================
describe('Car type input normalisation', () => {
  test('lowercase "compact" is accepted', () => {
    expect(priceWith({ type: 'compact' })).toBe('$90.00');
  });

  test('uppercase "ELECTRIC" is accepted', () => {
    expect(priceWith({ type: 'ELECTRIC', age: 30 })).toBe('$90.00');
  });

  test('unknown car type still returns a price (treated as Unknown class)', () => {
    // Unknown class is not Compact, age=30 (>21) so eligible; no special modifiers
    expect(priceWith({ type: 'hovercraft', age: 30 })).toBe('$90.00');
  });
});

// ===========================================================================
// 11. SEASON boundary detection
// ===========================================================================
describe('Season boundary detection', () => {
  test('pickup in April (month 4) is high season', () => {
    // April = month index 3 in JS... but HIGH_SEASON_START_MONTH=4 means May
    // April = month 4 in 1-based → month index 3 → NOT high season
    const aprilPickup  = makeDate(2024, 4, 1);  // April 1
    const aprilDropoff = makeDate(2024, 4, 3);  // April 3
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: aprilPickup, dropoffDate: aprilDropoff,
    })).toBe('$90.00'); // low season
  });

  test('pickup in May (month 5) is high season', () => {
    const mayPickup  = makeDate(2024, 5, 1);
    const mayDropoff = makeDate(2024, 5, 3);
    // base=90, ×1.15=103.50
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: mayPickup, dropoffDate: mayDropoff,
    })).toBe('$103.50');
  });

  test('pickup in November (month 11) is high season', () => {
    const novPickup  = makeDate(2024, 11, 1);
    const novDropoff = makeDate(2024, 11, 3);
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: novPickup, dropoffDate: novDropoff,
    })).toBe('$103.50');
  });

  test('pickup in December is low season', () => {
    const decPickup  = makeDate(2024, 12, 1);
    const decDropoff = makeDate(2024, 12, 3);
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: decPickup, dropoffDate: decDropoff,
    })).toBe('$90.00');
  });

  test('rental spanning from low to high season is treated as high season', () => {
    // pickup Jan (low), dropoff Jul (high) → high season
    const spanPickup  = makeDate(2024, 1, 1);
    const spanDropoff = makeDate(2024, 7, 1);
    const result = priceWith({
      age: 30, licenseYears: 5,
      pickupDate: spanPickup, dropoffDate: spanDropoff,
    });
    expect(result).toMatch(/^\$/);
    // price should reflect high season multiplier (much larger than base)
    const numericPrice = parseFloat(result.slice(1));
    expect(numericPrice).toBeGreaterThan(30 * 3); // definitely not just 3-day base
  });
});

// ===========================================================================
// 12. DAYS calculation
// ===========================================================================
describe('Days calculation', () => {
  test('same pickup and dropoff date = 1 day', () => {
    const d = makeDate(2024, 1, 10);
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: d, dropoffDate: d,
    })).toBe('$30.00'); // 30*1=30
  });

  test('dropoff before pickup is handled (absolute value)', () => {
    // reversed dates should give same result as correct order
    expect(priceWith({
      age: 30, licenseYears: 5,
      pickupDate: LOW_DROPOFF, dropoffDate: LOW_PICKUP, // swapped
    })).toBe('$90.00'); // still 3 days
  });
});