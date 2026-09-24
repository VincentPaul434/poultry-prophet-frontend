const NUMERIC_VALUE_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

const SCORE_INDICATORS = new Set(["BHI", "BSI", "CRS"]);

export function validateThresholdValue(
  value: string,
  indicator: string,
  label: "Minimum" | "Maximum"
) {
  if (!value.trim()) return `${label} is required.`;
  if (!NUMERIC_VALUE_PATTERN.test(value)) {
    return `${label} must contain only digits and one decimal separator.`;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return `${label} must be a finite number.`;
  if (number < 0) return `${label} cannot be negative.`;
  if (SCORE_INDICATORS.has(indicator) && number > 100) {
    return `${label} must be between 0 and 100.`;
  }

  return null;
}

export function validateThresholdOrder(min: string, max: string) {
  if (!NUMERIC_VALUE_PATTERN.test(min) || !NUMERIC_VALUE_PATTERN.test(max)) {
    return null;
  }

  return Number(min) <= Number(max) ? null : "Minimum cannot exceed maximum.";
}

export function parseThresholdValue(value: string) {
  return Number(value);
}
