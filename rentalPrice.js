// rentalPrice.js

// --- Constants ---
const MINIMUM_AGE = 18;
const YOUNG_DRIVER_MAX_AGE = 21;
const YOUNG_ADULT_MAX_AGE = 25;
const LONG_RENTAL_THRESHOLD_DAYS = 10;

const MIN_LICENSE_YEARS_TO_RENT = 1;
const LICENSE_SURCHARGE_THRESHOLD_YEARS = 2;
const LICENSE_SURCHARGE_RATE = 1.30;
const LICENSE_NOVICE_THRESHOLD_YEARS = 3;
const LICENSE_NOVICE_DAILY_SURCHARGE = 15;

const HIGH_SEASON_START_MONTH = 4; // May (0-indexed)
const HIGH_SEASON_END_MONTH = 10;  // November (0-indexed)

const RACER_HIGH_SEASON_YOUNG_MULTIPLIER = 1.5;
const HIGH_SEASON_MULTIPLIER = 1.15;
const LONG_RENTAL_LOW_SEASON_DISCOUNT = 0.9;
const WEEKEND_PRICE_MULTIPLIER = 1.05;

const SATURDAY = 6;
const SUNDAY = 0;

const CAR_CLASSES = {
  Compact: "Compact",
  Electric: "Electric",
  Cabrio: "Cabrio",
  Racer: "Racer",
};

const SEASONS = {
  High: "High",
  Low: "Low",
};

// --- Exported price function ---

/**
 * Calculates the rental price for a given booking.
 * @param {string} pickup - Pickup location
 * @param {string} dropoff - Dropoff location
 * @param {number} pickupDate - Pickup date as ms timestamp
 * @param {number} dropoffDate - Dropoff date as ms timestamp
 * @param {string} type - Car type string
 * @param {number} age - Driver's age in years
 * @param {number} licenseYears - Years the driver has held their license
 * @returns {string} Formatted price or an error message
 */
function price(pickup, dropoff, pickupDate, dropoffDate, type, age, licenseYears) {
  const carClass = normaliseCarClass(type);
  const days = calculateDays(pickupDate, dropoffDate);
  const season = determineSeason(pickupDate, dropoffDate);

  const eligibilityError = checkEligibility(age, carClass, licenseYears);
  if (eligibilityError) {
    return eligibilityError;
  }

  const startDate = Math.min(pickupDate, dropoffDate);
  let rentalPrice = calculateBasePrice(age, startDate, days);
  rentalPrice = applySeasonAndClassModifiers(rentalPrice, carClass, age, season);
  rentalPrice = applyRentalDurationDiscount(rentalPrice, days, season);
  rentalPrice = applyLicenseSurcharges(rentalPrice, licenseYears, days, season);

  return '$' + rentalPrice.toFixed(2);
}

// --- Eligibility checks ---

function checkEligibility(age, carClass, licenseYears) {
  if (age < MINIMUM_AGE) {
    return "Driver too young - cannot quote the price";
  }

  if (age <= YOUNG_DRIVER_MAX_AGE && carClass !== CAR_CLASSES.Compact) {
    return "Drivers aged 21 or under can only rent Compact vehicles";
  }

  if (licenseYears < MIN_LICENSE_YEARS_TO_RENT) {
    return "Driver must have held a license for at least 1 year to rent";
  }

  return null;
}

// --- Price calculation steps ---

/**
 * Calculates base price by iterating over each rental day individually.
 * Weekend days (Saturday and Sunday) receive a 5% surcharge.
 * @param {number} age - Driver age (used as the base daily rate)
 * @param {number} startDate - Chronologically earlier date as ms timestamp
 * @param {number} days - Total number of rental days
 * @returns {number} Summed base price across all days
 */
function calculateBasePrice(age, startDate, days) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let total = 0;

  for (let i = 0; i < days; i++) {
    const dayOfWeek = new Date(startDate + i * MS_PER_DAY).getDay();
    const isWeekend = dayOfWeek === SATURDAY || dayOfWeek === SUNDAY;
    total += isWeekend ? age * WEEKEND_PRICE_MULTIPLIER : age;
  }

  return total;
}

function applySeasonAndClassModifiers(rentalPrice, carClass, age, season) {
  if (carClass === CAR_CLASSES.Racer && age <= YOUNG_ADULT_MAX_AGE && season === SEASONS.High) {
    rentalPrice *= RACER_HIGH_SEASON_YOUNG_MULTIPLIER;
  }

  if (season === SEASONS.High) {
    rentalPrice *= HIGH_SEASON_MULTIPLIER;
  }

  return rentalPrice;
}

function applyRentalDurationDiscount(rentalPrice, days, season) {
  if (days > LONG_RENTAL_THRESHOLD_DAYS && season === SEASONS.Low) {
    rentalPrice *= LONG_RENTAL_LOW_SEASON_DISCOUNT;
  }
  return rentalPrice;
}

function applyLicenseSurcharges(rentalPrice, licenseYears, days, season) {
  if (licenseYears < LICENSE_SURCHARGE_THRESHOLD_YEARS) {
    rentalPrice *= LICENSE_SURCHARGE_RATE;
  }

  if (licenseYears < LICENSE_NOVICE_THRESHOLD_YEARS && season === SEASONS.High) {
    rentalPrice += LICENSE_NOVICE_DAILY_SURCHARGE * days;
  }

  return rentalPrice;
}

// --- Helper functions ---

function normaliseCarClass(type) {
  const normalised = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return CAR_CLASSES[normalised] || "Unknown";
}

function calculateDays(pickupDate, dropoffDate) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const firstDate = new Date(pickupDate);
  const secondDate = new Date(dropoffDate);
  return Math.round(Math.abs((firstDate - secondDate) / MS_PER_DAY)) + 1;
}

function determineSeason(pickupDate, dropoffDate) {
  const pickup = new Date(pickupDate);
  const dropoff = new Date(dropoffDate);

  const pickupMonth = pickup.getMonth();
  const dropoffMonth = dropoff.getMonth();

  const isHighSeason =
    (pickupMonth >= HIGH_SEASON_START_MONTH && pickupMonth <= HIGH_SEASON_END_MONTH) ||
    (dropoffMonth >= HIGH_SEASON_START_MONTH && dropoffMonth <= HIGH_SEASON_END_MONTH) ||
    (pickupMonth < HIGH_SEASON_START_MONTH && dropoffMonth > HIGH_SEASON_END_MONTH);

  return isHighSeason ? SEASONS.High : SEASONS.Low;
}

exports.price = price;