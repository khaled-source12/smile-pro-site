export function calculateSavings() {
  const ageInput = document.getElementById('calc-age');
  const spendInput = document.getElementById('calc-spend');
  if (!ageInput || !spendInput) return;
  const calculator = ageInput.closest('[data-procedure-cost]');
  const endAge = Number.parseFloat(calculator?.dataset.endAge);
  const procedureCost = Number.parseFloat(calculator?.dataset.procedureCost);
  if (!Number.isFinite(endAge) || !Number.isFinite(procedureCost)) return;
  const enteredAge = Number.parseFloat(ageInput.value);
  const enteredSpend = Number.parseFloat(spendInput.value);
  const age = Number.isFinite(enteredAge) ? enteredAge : Number.parseFloat(ageInput.defaultValue);
  const spend = Number.isFinite(enteredSpend) ? enteredSpend : Number.parseFloat(spendInput.defaultValue);
  const lifetime = Math.max(0, endAge - age) * spend;
  const savings = Math.max(0, lifetime - procedureCost);
  const lifetimeOutput = document.getElementById('res-lifetime');
  const savingsOutput = document.getElementById('res-savings');
  const numberLocale = document.documentElement.lang.startsWith('ar') ? 'ar-EG' : 'en-US';
  if (lifetimeOutput) lifetimeOutput.textContent = lifetime.toLocaleString(numberLocale);
  if (savingsOutput) savingsOutput.textContent = savings.toLocaleString(numberLocale);
}
