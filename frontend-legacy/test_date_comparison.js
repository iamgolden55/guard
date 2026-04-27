#!/usr/bin/env node
/**
 * Test script to verify date comparison fix
 * Tests the exact logic used in ShiftScheduling.tsx line 868
 */

// Simulate formatTimeToISO function
const formatTimeToISO = (date, timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const dateObj = new Date(date);
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj.toISOString();
};

console.log('='.repeat(70));
console.log('DATE COMPARISON FIX VERIFICATION');
console.log('='.repeat(70));

// Test setup
const now = new Date('2026-01-01T18:30:00.000Z');
const futureDate = new Date('2026-01-12T08:00:00.000Z');
const pastDate = new Date('2025-12-25T08:00:00.000Z');

console.log('\n✓ Test Setup:');
console.log(`  Current time: ${now.toISOString()}`);
console.log(`  Future date:  ${futureDate.toISOString()}`);
console.log(`  Past date:    ${pastDate.toISOString()}`);

// Test 1: String vs Date (BROKEN)
console.log('\n' + '='.repeat(70));
console.log('TEST 1: BROKEN CODE (String vs Date comparison)');
console.log('='.repeat(70));

const futureISOString = formatTimeToISO(futureDate, '08:00');
const pastISOString = formatTimeToISO(pastDate, '08:00');

console.log('\nComparison results:');
console.log(`  futureISOString > now: ${futureISOString > now}`);
console.log(`  pastISOString > now:   ${pastISOString > now}`);

console.log('\n⚠️  Problem: Both return false due to string comparison!');
console.log(`  "${futureISOString.substring(0, 10)}" > "${now.toString().substring(0, 15)}"`);
console.log('  String "2" < "W" in ASCII → incorrect result');

// Test 2: Date vs Date (FIXED)
console.log('\n' + '='.repeat(70));
console.log('TEST 2: FIXED CODE (Date vs Date comparison)');
console.log('='.repeat(70));

const futureIsPast = new Date(futureISOString) <= now;
const pastIsPast = new Date(pastISOString) <= now;

console.log('\nComparison results:');
console.log(`  new Date(futureISOString) <= now: ${futureIsPast}`);
console.log(`  new Date(pastISOString) <= now:   ${pastIsPast}`);

console.log('\n✅ Correct: Future date is not past (false), past date is past (true)');

// Test 3: Filter simulation
console.log('\n' + '='.repeat(70));
console.log('TEST 3: FILTER SIMULATION');
console.log('='.repeat(70));

const testDates = [
  { date: new Date('2026-01-12'), label: 'Jan 12, 2026 (Monday)' },
  { date: new Date('2026-01-14'), label: 'Jan 14, 2026 (Wednesday)' },
  { date: new Date('2026-01-16'), label: 'Jan 16, 2026 (Friday)' },
  { date: new Date('2026-01-19'), label: 'Jan 19, 2026 (Monday)' },
];

console.log('\nFiltering with BROKEN code:');
const brokenFiltered = testDates.filter(({ date }) => {
  const shiftStart = formatTimeToISO(date, '08:00');
  return shiftStart > now; // BROKEN
});
console.log(`  Results: ${brokenFiltered.length} out of ${testDates.length} dates`);
console.log('  ❌ WRONG: Should be 4, got ' + brokenFiltered.length);

console.log('\nFiltering with FIXED code:');
const fixedFiltered = testDates.filter(({ date }) => {
  const shiftStart = formatTimeToISO(date, '08:00');
  const isPast = new Date(shiftStart) <= now;
  return !isPast; // FIXED
});
console.log(`  Results: ${fixedFiltered.length} out of ${testDates.length} dates`);
console.log('  ✅ CORRECT: All 4 dates are in the future');

// Summary
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

if (brokenFiltered.length === 0 && fixedFiltered.length === 4) {
  console.log('\n✅ VERIFICATION PASSED');
  console.log('   The fix correctly identifies future dates');
  console.log('   Broken code would have rejected all dates');
  console.log('   Fixed code properly filters only past dates');
} else {
  console.log('\n❌ VERIFICATION FAILED');
  console.log('   Unexpected results from test');
}

console.log('\n' + '='.repeat(70));
console.log('Fix applied in: frontend/src/pages/admin/ShiftScheduling.tsx:868');
console.log('='.repeat(70));
