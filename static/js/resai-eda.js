/**
 * ResAI - Client-Side EDA Profiler & Data Cleansing Engine
 * Evaluates dataset quality, detects outliers, and executes in-browser data hygiene.
 */

(function (window) {
  'use strict';

  const EDAProfiler = {
    // Determine if an array of values should be treated as numeric
    isNumericColumn(values) {
      let numericCount = 0;
      let nonNullCount = 0;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v !== null && v !== undefined && v !== '') {
          nonNullCount++;
          if (typeof v === 'number' && !isNaN(v)) {
            numericCount++;
          } else if (typeof v === 'string') {
            const trimmed = v.trim();
            if (trimmed !== '' && !isNaN(Number(trimmed))) {
              numericCount++;
            }
          }
        }
      }
      if (nonNullCount === 0) return false;
      return (numericCount / nonNullCount) >= 0.75;
    },

    // Comprehensive profiling of rows array
    profileDataset(rows) {
      if (!rows || rows.length === 0) {
        return { error: "Dataset is empty." };
      }

      const totalRows = rows.length;
      // Get all unique keys across all row objects
      const allColsSet = new Set();
      rows.forEach(r => Object.keys(r).forEach(k => allColsSet.add(k)));
      const allCols = Array.from(allColsSet);
      const totalCols = allCols.length;

      // Duplicate rows detection
      const seenStrings = new Set();
      let duplicateRows = 0;
      rows.forEach(r => {
        const s = JSON.stringify(r);
        if (seenStrings.has(s)) {
          duplicateRows++;
        } else {
          seenStrings.add(s);
        }
      });

      let totalMissingCells = 0;
      const columnsProfile = {};
      const issuesDetected = [];
      const numericColumns = [];
      const categoricalColumns = [];

      allCols.forEach(col => {
        const rawVals = rows.map(r => r[col]);
        const isNumeric = EDAProfiler.isNumericColumn(rawVals);

        if (isNumeric) {
          numericColumns.push(col);
        } else {
          categoricalColumns.push(col);
        }

        let missingCount = 0;
        const validNumericVals = [];
        const uniqueSet = new Set();

        rawVals.forEach(v => {
          if (v === null || v === undefined || v === '' || (isNumeric && isNaN(Number(v)))) {
            missingCount++;
            totalMissingCells++;
          } else {
            uniqueSet.add(v);
            if (isNumeric) validNumericVals.push(Number(v));
          }
        });

        const missingPct = Number(((missingCount / totalRows) * 100).toFixed(2));
        const uniqueCount = uniqueSet.size;

        const colInfo = {
          name: col,
          type: isNumeric ? 'numeric' : 'categorical',
          missing_count: missingCount,
          missing_percentage: missingPct,
          unique_values: uniqueCount,
          unique_ratio: Number((uniqueCount / totalRows).toFixed(4)),
          issues: []
        };

        // Issues audit
        if (missingPct > 20.0) {
          const issue = `High missing rate (${missingPct}%). Imputation recommended.`;
          colInfo.issues.push(issue);
          issuesDetected.push(`Column '${col}': ${issue}`);
        }

        if (uniqueCount === 1) {
          const issue = "Zero variance (constant attribute). Uninformative for hypothesis modeling.";
          colInfo.issues.push(issue);
          issuesDetected.push(`Column '${col}': ${issue}`);
        }

        if (!isNumeric && uniqueCount === totalRows && totalRows > 10) {
          const issue = "Unique record identifier. Exclude from cohort comparisons.";
          colInfo.issues.push(issue);
        }

        // Numeric outlier diagnostics
        if (isNumeric) {
          if (validNumericVals.length >= 4) {
            validNumericVals.sort((a, b) => a - b);
            const n = validNumericVals.length;
            const q25 = validNumericVals[Math.floor(n * 0.25)];
            const q75 = validNumericVals[Math.floor(n * 0.75)];
            const iqr = q75 - q25;
            const lowerBound = q25 - 1.5 * iqr;
            const upperBound = q75 + 1.5 * iqr;
            const outliers = validNumericVals.filter(v => v < lowerBound || v > upperBound);

            colInfo.outliers_count = outliers.length;
            colInfo.outliers_pct = Number(((outliers.length / n) * 100).toFixed(2));
            colInfo.iqr = Number(iqr.toFixed(4));
            colInfo.bounds = [Number(lowerBound.toFixed(2)), Number(upperBound.toFixed(2))];

            // Skewness
            const mean = validNumericVals.reduce((a, b) => a + b, 0) / n;
            const variance = validNumericVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const std = Math.sqrt(variance);
            if (std > 0) {
              const skew = validNumericVals.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / n;
              colInfo.skewness = Number(skew.toFixed(2));
              if (Math.abs(skew) > 1.5) {
                const issue = `Substantial skewness (${skew.toFixed(2)}). Check log transform.`;
                colInfo.issues.push(issue);
                issuesDetected.push(`Column '${col}': ${issue}`);
              }
            } else {
              colInfo.skewness = 0.0;
            }
          } else {
            colInfo.outliers_count = 0;
            colInfo.skewness = 0.0;
          }
        }

        columnsProfile[col] = colInfo;
      });

      const totalCells = totalRows * totalCols;
      const missingRateOverall = totalCells > 0 ? (totalMissingCells / totalCells) : 0;

      // Health Score Calculation (0 - 100)
      let healthScore = 100.0;
      healthScore -= (missingRateOverall * 50); // Up to 50 pts off
      if (duplicateRows > 0) {
        healthScore -= Math.min(15, (duplicateRows / totalRows) * 100);
      }
      healthScore -= Math.min(20, issuesDetected.length * 3);
      healthScore = Math.max(10.0, Math.min(100.0, Number(healthScore.toFixed(1))));

      return {
        total_rows: totalRows,
        total_columns: totalCols,
        duplicate_rows: duplicateRows,
        total_missing_cells: totalMissingCells,
        missing_rate_overall: Number((missingRateOverall * 100).toFixed(2)),
        health_score: healthScore,
        numerical_columns: numericColumns,
        categorical_columns: categoricalColumns,
        columns: columnsProfile,
        issues: issuesDetected,
        preview_data: rows.slice(0, 10)
      };
    },

    // Client-side Data Cleaning & Imputation
    cleanData(rows, options = {}) {
      const numStrategy = options.missing_numeric_strategy || 'median';
      const catStrategy = options.missing_categorical_strategy || 'mode';
      const dropDuplicates = options.drop_duplicates !== false;

      let workingRows = rows.map(r => ({ ...r }));
      const actions = [];

      // 1. Remove duplicate rows if requested
      if (dropDuplicates) {
        const initialCount = workingRows.length;
        const seen = new Set();
        workingRows = workingRows.filter(r => {
          const s = JSON.stringify(r);
          if (seen.has(s)) return false;
          seen.add(s);
          return true;
        });
        const removedDups = initialCount - workingRows.length;
        if (removedDups > 0) {
          actions.push(`Removed ${removedDups} duplicate observation(s).`);
        }
      }

      // If user selected 'drop' for missing rows
      if (numStrategy === 'drop' || catStrategy === 'drop') {
        const initialCount = workingRows.length;
        workingRows = workingRows.filter(r => {
          for (const k in r) {
            const v = r[k];
            if (v === null || v === undefined || v === '') return false;
          }
          return true;
        });
        const droppedMissing = initialCount - workingRows.length;
        if (droppedMissing > 0) {
          actions.push(`Dropped ${droppedMissing} row(s) containing missing values.`);
        }
        return { cleanedRows: workingRows, actions: actions };
      }

      // 2. Identify column types and replacement values
      const cols = Object.keys(workingRows[0] || {});
      cols.forEach(col => {
        const isNumeric = EDAProfiler.isNumericColumn(workingRows.map(r => r[col]));
        const validValues = [];
        const freqMap = {};

        workingRows.forEach(r => {
          const v = r[col];
          if (v !== null && v !== undefined && v !== '') {
            if (isNumeric && !isNaN(Number(v))) {
              validValues.push(Number(v));
            } else if (!isNumeric) {
              const str = String(v).trim();
              freqMap[str] = (freqMap[str] || 0) + 1;
            }
          }
        });

        // Compute fill value
        let fillVal = null;
        if (isNumeric && validValues.length > 0) {
          validValues.sort((a, b) => a - b);
          if (numStrategy === 'median') {
            const mid = Math.floor(validValues.length / 2);
            fillVal = validValues.length % 2 !== 0 ? validValues[mid] : (validValues[mid - 1] + validValues[mid]) / 2;
          } else if (numStrategy === 'mean') {
            fillVal = validValues.reduce((a, b) => a + b, 0) / validValues.length;
          } else if (numStrategy === 'zero') {
            fillVal = 0;
          } else if (numStrategy === 'mode') {
            fillVal = validValues[0];
          }
          if (fillVal !== null) fillVal = Number(fillVal.toFixed(2));
        } else if (!isNumeric) {
          if (catStrategy === 'mode' && Object.keys(freqMap).length > 0) {
            let maxCount = -1;
            Object.keys(freqMap).forEach(k => {
              if (freqMap[k] > maxCount) {
                maxCount = freqMap[k];
                fillVal = k;
              }
            });
          } else {
            fillVal = 'Missing';
          }
        }

        // Apply imputation
        if (fillVal !== null) {
          let imputedCount = 0;
          workingRows.forEach(r => {
            const v = r[col];
            if (v === null || v === undefined || v === '' || (isNumeric && isNaN(Number(v)))) {
              r[col] = fillVal;
              imputedCount++;
            }
          });
          if (imputedCount > 0) {
            actions.push(`Imputed ${imputedCount} missing value(s) in '${col}' with ${isNumeric ? numStrategy : catStrategy} (${fillVal}).`);
          }
        }
      });

      return { cleanedRows: workingRows, actions: actions };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EDAProfiler;
  }
  if (typeof window !== 'undefined') {
    window.EDAProfiler = EDAProfiler;
  } else if (typeof global !== 'undefined') {
    global.EDAProfiler = EDAProfiler;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
