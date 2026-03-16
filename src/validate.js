/**
 * NCCI validation logic — PTP edits and MUE checks.
 */

// Modifiers that can unbundle NCCI edits
const UNBUNDLING_MODIFIERS = new Set([
  '25', // Significant, separately identifiable E&M
  '59', // Distinct procedural service
  'XE', // Separate encounter
  'XS', // Separate structure
  'XP', // Separate practitioner
  'XU', // Unusual non-overlapping service
]);

// Build lookup indexes from raw data
const buildIndexes = (ptpEdits, mueData) => {
  // PTP: map from "code1|code2" -> edit entry (both directions)
  const ptpByPair = new Map();
  // PTP: map from code -> array of edits where code appears
  const ptpByCode = new Map();

  ptpEdits.forEach((edit) => {
    // Canonical key: column1 is comprehensive, column2 is component
    const key = `${edit.column1}|${edit.column2}`;
    ptpByPair.set(key, edit);

    // Also store reverse for quick lookup regardless of order
    const revKey = `${edit.column2}|${edit.column1}`;
    if (!ptpByPair.has(revKey)) {
      ptpByPair.set(revKey, { ...edit, reversed: true });
    }

    // Index by each code
    const addToCodeIndex = (code) => {
      const arr = ptpByCode.get(code) || [];
      arr.push(edit);
      ptpByCode.set(code, arr);
    };
    addToCodeIndex(edit.column1);
    addToCodeIndex(edit.column2);
  });

  // MUE: map from code -> mue entry
  const mueByCode = new Map();
  mueData.forEach((entry) => {
    mueByCode.set(entry.code, entry);
  });

  return { ptpByPair, ptpByCode, mueByCode };
};

// Check if a modifier unbundles the edit
const modifierUnbundles = (modifiers, modifierIndicator) => {
  if (modifierIndicator !== 1) { return false; }
  if (!modifiers || modifiers.length === 0) { return false; }
  return modifiers.some((m) => UNBUNDLING_MODIFIERS.has(m));
};

// Validate a single code pair
const validatePair = (indexes, code1, code2, modifiers = {}) => {
  const key = `${code1}|${code2}`;
  const edit = indexes.ptpByPair.get(key);

  if (!edit) {
    return {
      code1,
      code2,
      canBillTogether: true,
      hasEdit: false,
      message: 'No NCCI PTP edit exists for this code pair — they can be billed together.',
    };
  }

  // Determine which code's modifiers to check
  // The component code (column2) is the one that needs the modifier
  const componentCode = edit.reversed ? edit.column1 : edit.column2;
  const comprehensiveCode = edit.reversed ? edit.column2 : edit.column1;
  const componentModifiers = modifiers[componentCode] || modifiers[code2] || [];
  const modList = Array.isArray(componentModifiers) ? componentModifiers : [componentModifiers];

  const unbundles = modifierUnbundles(modList, edit.modifierIndicator);

  const modifierIndicatorText = {
    0: 'Not allowed — no modifier will unbundle this edit',
    1: 'Modifier allowed — use modifier 25, 59, XE, XS, XP, or XU to unbundle',
    9: 'Not applicable',
  };

  return {
    code1,
    code2,
    canBillTogether: unbundles,
    hasEdit: true,
    comprehensiveCode,
    componentCode,
    modifierIndicator: edit.modifierIndicator,
    modifierIndicatorDescription: modifierIndicatorText[edit.modifierIndicator] || 'Unknown',
    modifierApplied: modList.length > 0 ? modList : null,
    unbundledByModifier: unbundles,
    effectiveDate: edit.effectiveDate,
    deletionDate: edit.deletionDate,
    rationale: edit.rationale,
    category: edit.category,
    column1Description: edit.column1Description,
    column2Description: edit.column2Description,
    message: unbundles
      ? `Edit exists but unbundled by modifier ${modList.join(', ')} on ${componentCode}. These codes can be billed together.`
      : edit.modifierIndicator === 1
        ? `NCCI edit: ${comprehensiveCode} bundles ${componentCode}. Apply modifier 25/59/XE/XS/XP/XU to ${componentCode} if services are distinct.`
        : `NCCI edit: ${comprehensiveCode} bundles ${componentCode}. This pair cannot be unbundled with a modifier.`,
  };
};

// Validate a full claim (all code combinations)
const validateClaim = (indexes, codes, modifiers = {}) => {
  const issues = [];
  const mueIssues = [];
  let pairCount = 0;

  // Check all pairs
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      pairCount++;
      const result = validatePair(indexes, codes[i], codes[j], modifiers);
      if (result.hasEdit) {
        issues.push(result);
      }
    }
  }

  // Check MUE limits (count occurrences)
  const codeCounts = {};
  codes.forEach((code) => {
    codeCounts[code] = (codeCounts[code] || 0) + 1;
  });

  Object.entries(codeCounts).forEach(([code, count]) => {
    const mue = indexes.mueByCode.get(code);
    if (mue && count > mue.practitionerMue) {
      mueIssues.push({
        code,
        description: mue.description,
        unitsOnClaim: count,
        mueLimit: mue.practitionerMue,
        rationale: mue.rationale,
        adjudicationIndicator: mue.adjudicationIndicator,
        message: `MUE violation: ${code} appears ${count} times but MUE limit is ${mue.practitionerMue}`,
      });
    }
  });

  const unbundledCount = issues.filter((i) => i.unbundledByModifier).length;
  const blockedCount = issues.filter((i) => !i.canBillTogether).length;

  return {
    codesSubmitted: codes,
    modifiersApplied: Object.keys(modifiers).length > 0 ? modifiers : null,
    pairsChecked: pairCount,
    editIssues: issues.length,
    mueIssues: mueIssues.length,
    blocked: blockedCount,
    unbundled: unbundledCount,
    clean: blockedCount === 0 && mueIssues.length === 0,
    issues,
    mue: mueIssues.length > 0 ? mueIssues : [],
    summary: blockedCount === 0 && mueIssues.length === 0
      ? 'Claim passes NCCI validation — no blocked edit pairs or MUE violations.'
      : `Claim has ${blockedCount} blocked edit pair(s) and ${mueIssues.length} MUE violation(s).`,
  };
};

// Get all edits for a code
const getEditsForCode = (indexes, code) => {
  const edits = indexes.ptpByCode.get(code) || [];
  return edits.map((edit) => ({
    pairedCode: edit.column1 === code ? edit.column2 : edit.column1,
    role: edit.column1 === code ? 'comprehensive' : 'component',
    modifierIndicator: edit.modifierIndicator,
    rationale: edit.rationale,
    category: edit.category,
    effectiveDate: edit.effectiveDate,
    deletionDate: edit.deletionDate,
    pairedCodeDescription: edit.column1 === code ? edit.column2Description : edit.column1Description,
  }));
};

// Get MUE for a code
const getMue = (indexes, code) => {
  const mue = indexes.mueByCode.get(code);
  if (!mue) {
    return { code, found: false, message: `No MUE entry found for code ${code}` };
  }
  return {
    code,
    found: true,
    description: mue.description,
    practitionerMue: mue.practitionerMue,
    facilityMue: mue.facilityMue,
    rationale: mue.rationale,
    adjudicationIndicator: mue.adjudicationIndicator,
    adjudicationDescription: {
      1: 'Claim Line Edit — applies per claim line',
      2: 'Per Day Edit — applies per beneficiary per day',
      3: 'Per Encounter Edit — applies per encounter',
    }[mue.adjudicationIndicator] || 'Unknown',
  };
};

// Search edits by code or description keyword
const searchEdits = (ptpEdits, mueData, query, limit = 50, offset = 0) => {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return { total: 0, results: [], query: q };
  }

  const matchingEdits = ptpEdits.filter((edit) =>
    edit.column1.toLowerCase().includes(q) ||
    edit.column2.toLowerCase().includes(q) ||
    edit.column1Description.toLowerCase().includes(q) ||
    edit.column2Description.toLowerCase().includes(q) ||
    edit.rationale.toLowerCase().includes(q) ||
    edit.category.toLowerCase().includes(q)
  );

  const matchingMue = mueData.filter((entry) =>
    entry.code.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.rationale.toLowerCase().includes(q)
  );

  const clampedLimit = Math.min(Math.max(limit, 1), 200);
  const clampedOffset = Math.max(offset, 0);

  return {
    query: q,
    ptpEdits: {
      total: matchingEdits.length,
      results: matchingEdits.slice(clampedOffset, clampedOffset + clampedLimit),
    },
    mue: {
      total: matchingMue.length,
      results: matchingMue.slice(clampedOffset, clampedOffset + clampedLimit),
    },
  };
};

// Build stats
const buildStats = (ptpEdits, mueData, meta) => {
  const categoryCounts = {};
  ptpEdits.forEach((edit) => {
    categoryCounts[edit.category] = (categoryCounts[edit.category] || 0) + 1;
  });

  const modIndicatorCounts = { 0: 0, 1: 0, 9: 0 };
  ptpEdits.forEach((edit) => {
    modIndicatorCounts[edit.modifierIndicator] = (modIndicatorCounts[edit.modifierIndicator] || 0) + 1;
  });

  const adjIndicatorCounts = { 1: 0, 2: 0, 3: 0 };
  mueData.forEach((entry) => {
    adjIndicatorCounts[entry.adjudicationIndicator] = (adjIndicatorCounts[entry.adjudicationIndicator] || 0) + 1;
  });

  return {
    dataSource: meta.dataSource,
    cmsQuarter: meta.cmsQuarter,
    buildDate: meta.buildDate,
    ptpEdits: {
      total: ptpEdits.length,
      byCategory: categoryCounts,
      byModifierIndicator: {
        notAllowed: modIndicatorCounts[0],
        modifierAllowed: modIndicatorCounts[1],
        notApplicable: modIndicatorCounts[9],
      },
    },
    mue: {
      total: mueData.length,
      byAdjudicationIndicator: {
        claimLineEdit: adjIndicatorCounts[1],
        perDay: adjIndicatorCounts[2],
        perEncounter: adjIndicatorCounts[3],
      },
    },
  };
};

export {
  buildIndexes,
  validatePair,
  validateClaim,
  getEditsForCode,
  getMue,
  searchEdits,
  buildStats,
  UNBUNDLING_MODIFIERS,
};
