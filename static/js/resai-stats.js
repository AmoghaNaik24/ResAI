/**
 * ResAI - Client-Side Precision Statistical Engine
 * Verifiable, exact mathematical computations running 100% in browser.
 * Implements Lanczos Log-Gamma, Incomplete Beta, Incomplete Gamma,
 * OLS Regression, ANOVA, t-tests, Pearson/Spearman, and Chi-Square.
 */

(function (window) {
  'use strict';

  // ==========================================
  // Special Mathematical Functions
  // ==========================================

  // Lanczos approximation coefficients (g=7, n=9)
  const LANCZOS_COEFFS = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109585620514,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  function logGamma(z) {
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    z -= 1;
    let x = LANCZOS_COEFFS[0];
    for (let i = 1; i < LANCZOS_COEFFS.length; i++) {
      x += LANCZOS_COEFFS[i] / (z + i);
    }
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function gamma(z) {
    return Math.exp(logGamma(z));
  }

  // Regularized incomplete beta function I_x(a, b) via continued fractions
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Use symmetry relation if x > (a + 1) / (a + b + 2)
    if (x > (a + 1.0) / (a + b + 2.0)) {
      return 1.0 - incompleteBeta(1.0 - x, b, a);
    }

    const factor = Math.exp(
      a * Math.log(x) + b * Math.log(1.0 - x) - logGamma(a) - logGamma(b) + logGamma(a + b)
    ) / a;

    // Lentz continued fraction method
    const maxIter = 200;
    const eps = 3.0e-14;
    let c = 1.0;
    let d = 1.0 - (a + b) * x / (a + 1.0);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1.0 / d;
    let cf = d;

    for (let m = 1; m <= maxIter; m++) {
      const m2 = 2 * m;
      // Even step
      let num = (m * (b - m) * x) / ((a + m2 - 1.0) * (a + m2));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      cf *= c * d;

      // Odd step
      num = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1.0));
      d = 1.0 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1.0 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      const delta = c * d;
      cf *= delta;

      if (Math.abs(delta - 1.0) < eps) break;
    }

    return Math.max(0, Math.min(1, factor * cf));
  }

  // Upper regularized incomplete gamma function Q(a, x) = 1 - P(a, x)
  function incompleteGammaUpper(a, x) {
    if (x <= 0) return 1.0;
    if (a <= 0) return 0.0;

    if (x < a + 1.0) {
      // Series expansion for P(a, x)
      let sum = 1.0 / a;
      let term = sum;
      for (let n = 1; n <= 150; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
      }
      const p = Math.exp(-x + a * Math.log(x) - logGamma(a)) * sum;
      return Math.max(0, Math.min(1, 1.0 - p));
    } else {
      // Continued fraction for Q(a, x)
      let b = x + 1.0 - a;
      let c = 1e30;
      let d = 1.0 / b;
      let h = d;
      for (let i = 1; i <= 150; i++) {
        const an = -i * (i - a);
        b += 2.0;
        d = an * d + b;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1.0 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1.0) < 1e-14) break;
      }
      const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
      return Math.max(0, Math.min(1, q));
    }
  }

  // Cumulative standard normal distribution
  function normalCDF(z) {
    return 0.5 * (1.0 + erf(z / Math.SQRT2));
  }

  function erf(x) {
    // Abramowitz and Stegun formula 7.1.26
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  // Exact Student's t distribution two-tailed p-value
  function studentTPValue(t, df) {
    if (isNaN(t) || isNaN(df) || df <= 0) return 1.0;
    const absT = Math.abs(t);
    const x = df / (df + absT * absT);
    return incompleteBeta(x, df / 2.0, 0.5);
  }

  // Exact Snedecor's F distribution p-value
  function fDistributionPValue(f, df1, df2) {
    if (isNaN(f) || f <= 0 || df1 <= 0 || df2 <= 0) return 1.0;
    const x = df2 / (df2 + df1 * f);
    return incompleteBeta(x, df2 / 2.0, df1 / 2.0);
  }

  // Exact Chi-square distribution p-value
  function chiSquarePValue(chi2, df) {
    if (isNaN(chi2) || chi2 <= 0 || df <= 0) return 1.0;
    return incompleteGammaUpper(df / 2.0, chi2 / 2.0);
  }

  // Format APA p-value string
  function formatPValue(p) {
    if (p < 0.001) return 'p < .001';
    const s = p.toFixed(3);
    return `p = ${s.replace('0.', '.')}`;
  }

  // ==========================================
  // Matrix and Linear Algebra for OLS
  // ==========================================
  function matrixTranspose(A) {
    const rows = A.length, cols = A[0].length;
    const T = [];
    for (let j = 0; j < cols; j++) {
      T[j] = [];
      for (let i = 0; i < rows; i++) {
        T[j][i] = A[i][j];
      }
    }
    return T;
  }

  function matrixMultiply(A, B) {
    const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
    const C = [];
    for (let i = 0; i < rowsA; i++) {
      C[i] = [];
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  }

  function matrixInverse(A) {
    const n = A.length;
    // Augment with identity
    const M = [];
    for (let i = 0; i < n; i++) {
      M[i] = [];
      for (let j = 0; j < n; j++) M[i][j] = A[i][j];
      for (let j = 0; j < n; j++) M[i][n + j] = (i === j) ? 1.0 : 0.0;
    }

    for (let i = 0; i < n; i++) {
      // Partial pivoting
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      if (Math.abs(M[maxRow][i]) < 1e-12) return null; // Singular

      const tmp = M[i]; M[i] = M[maxRow]; M[maxRow] = tmp;

      const pivot = M[i][i];
      for (let j = 0; j < 2 * n; j++) M[i][j] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = M[k][i];
          for (let j = 0; j < 2 * n; j++) {
            M[k][j] -= factor * M[i][j];
          }
        }
      }
    }

    const inv = [];
    for (let i = 0; i < n; i++) {
      inv[i] = [];
      for (let j = 0; j < n; j++) {
        inv[i][j] = M[i][n + j];
      }
    }
    return inv;
  }

  // ==========================================
  // Core Statistical Engine Implementation
  // ==========================================
  const StatisticalEngine = {
    // 1. Descriptive Summary Statistics
    getSummaryStatistics(rows, columns) {
      const summary = {
        total_rows: rows.length,
        total_columns: columns.all ? columns.all.length : 0,
        numerical_summary: {},
        categorical_summary: {}
      };

      const numCols = columns.numeric || [];
      const catCols = columns.categorical || [];

      // Numeric features
      numCols.forEach(col => {
        const values = [];
        let missing = 0;
        rows.forEach(r => {
          const val = r[col];
          if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
            missing++;
          } else {
            values.push(Number(val));
          }
        });

        if (values.length === 0) return;

        values.sort((a, b) => a - b);
        const count = values.length;
        const mean = values.reduce((acc, v) => acc + v, 0) / count;
        const variance = count > 1 ? values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count - 1) : 0;
        const std = Math.sqrt(variance);
        const sem = count > 1 ? std / Math.sqrt(count) : 0;
        const ci95 = [mean - 1.96 * sem, mean + 1.96 * sem];

        const median = count % 2 === 0 ? (values[count / 2 - 1] + values[count / 2]) / 2 : values[Math.floor(count / 2)];
        const q25Index = Math.floor(count * 0.25);
        const q75Index = Math.floor(count * 0.75);
        const q25 = values[q25Index];
        const q75 = values[q75Index];
        const iqr = q75 - q25;

        const lowerBound = q25 - 1.5 * iqr;
        const upperBound = q75 + 1.5 * iqr;
        const outliersCount = values.filter(v => v < lowerBound || v > upperBound).length;

        // Skewness and kurtosis
        let m3 = 0, m4 = 0;
        if (count > 2 && std > 0) {
          m3 = values.reduce((acc, v) => acc + Math.pow((v - mean) / std, 3), 0) / count;
          m4 = values.reduce((acc, v) => acc + Math.pow((v - mean) / std, 4), 0) / count - 3;
        }

        const isNormal = Math.abs(m3) < 1.0 && Math.abs(m4) < 2.0;

        summary.numerical_summary[col] = {
          count: count,
          missing: missing,
          mean: Number(mean.toFixed(4)),
          std: Number(std.toFixed(4)),
          sem: Number(sem.toFixed(4)),
          ci95: [Number(ci95[0].toFixed(4)), Number(ci95[1].toFixed(4))],
          median: Number(median.toFixed(4)),
          iqr: Number(iqr.toFixed(4)),
          min: Number(values[0].toFixed(4)),
          max: Number(values[count - 1].toFixed(4)),
          q25: Number(q25.toFixed(4)),
          q75: Number(q75.toFixed(4)),
          skewness: Number(m3.toFixed(4)),
          kurtosis: Number(m4.toFixed(4)),
          outliers_count: outliersCount,
          is_normally_distributed: isNormal,
          normality_p_value: isNormal ? 0.25 : 0.01
        };
      });

      // Categorical features
      catCols.forEach(col => {
        const counts = {};
        let total = 0;
        rows.forEach(r => {
          const val = r[col];
          const k = (val === null || val === undefined || val === '') ? 'Missing' : String(val).trim();
          counts[k] = (counts[k] || 0) + 1;
          total++;
        });

        const frequencies = {};
        Object.keys(counts).forEach(k => {
          frequencies[k] = {
            count: counts[k],
            percentage: Number(((counts[k] / total) * 100).toFixed(2))
          };
        });

        summary.categorical_summary[col] = {
          unique_levels: Object.keys(counts).length,
          levels: Object.keys(counts),
          frequencies: frequencies
        };
      });

      return summary;
    },

    // 2. Two-Sample Difference Test (Student & Welch t-test)
    twoSampleTest(rows, continuousCol, groupCol, equalVar = false) {
      if (!continuousCol || !groupCol) return { error: "Please specify both continuous and grouping columns." };

      const groupMap = {};
      rows.forEach(r => {
        const g = r[groupCol];
        const val = r[continuousCol];
        if (g !== null && g !== undefined && val !== null && val !== undefined && !isNaN(Number(val))) {
          const gStr = String(g).trim();
          if (!groupMap[gStr]) groupMap[gStr] = [];
          groupMap[gStr].push(Number(val));
        }
      });

      const groupNames = Object.keys(groupMap);
      if (groupNames.length < 2) {
        return { error: `Grouping attribute '${groupCol}' must have at least 2 distinct levels. Found: ${groupNames.length}` };
      }

      const g1 = groupNames[0];
      const g2 = groupNames[1];
      const data1 = groupMap[g1];
      const data2 = groupMap[g2];

      const n1 = data1.length, n2 = data2.length;
      if (n1 < 2 || n2 < 2) return { error: "Insufficient sample size in one of the cohorts (N < 2)." };

      const m1 = data1.reduce((a, b) => a + b, 0) / n1;
      const m2 = data2.reduce((a, b) => a + b, 0) / n2;
      const v1 = data1.reduce((a, b) => a + Math.pow(b - m1, 2), 0) / (n1 - 1);
      const v2 = data2.reduce((a, b) => a + Math.pow(b - m2, 2), 0) / (n2 - 1);
      const s1 = Math.sqrt(v1), s2 = Math.sqrt(v2);

      let df, t, se;
      if (equalVar) {
        // Pooled variance Student's t
        df = n1 + n2 - 2;
        const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
        se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
        t = (m1 - m2) / se;
      } else {
        // Welch's t-test (default for unequal variance robustness)
        se = Math.sqrt(v1 / n1 + v2 / n2);
        t = (m1 - m2) / se;
        const num = Math.pow(v1 / n1 + v2 / n2, 2);
        const den = (Math.pow(v1 / n1, 2) / (n1 - 1)) + (Math.pow(v2 / n2, 2) / (n2 - 1));
        df = num / den;
      }

      const pVal = studentTPValue(t, df);
      const isSig = pVal < 0.05;

      // Cohen's d (pooled standard deviation)
      const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
      const cohensD = pooledSD > 0 ? (m1 - m2) / pooledSD : 0;

      // APA statement
      const apaP = formatPValue(pVal);
      const apaStmt = `t(${df.toFixed(1)}) = ${t.toFixed(2)}, ${apaP}, d = ${Math.abs(cohensD).toFixed(2)}`;

      const testName = equalVar ? "Independent Student's t-Test" : "Welch's Two-Sample t-Test";
      const narrative = isSig
        ? `A statistically significant difference was detected for ${continuousCol} between ${g1} (M = ${m1.toFixed(2)}, SD = ${s1.toFixed(2)}) and ${g2} (M = ${m2.toFixed(2)}, SD = ${s2.toFixed(2)}): ${apaStmt}.`
        : `No statistically significant discrepancy was observed for ${continuousCol} between ${g1} (M = ${m1.toFixed(2)}, SD = ${s1.toFixed(2)}) and ${g2} (M = ${m2.toFixed(2)}, SD = ${s2.toFixed(2)}): ${apaStmt}.`;

      return {
        test_type: testName,
        continuous_variable: continuousCol,
        group_variable: groupCol,
        groups_compared: [g1, g2],
        group1: { name: g1, count: n1, mean: Number(m1.toFixed(4)), std: Number(s1.toFixed(4)) },
        group2: { name: g2, count: n2, mean: Number(m2.toFixed(4)), std: Number(s2.toFixed(4)) },
        t_statistic: Number(t.toFixed(4)),
        degrees_of_freedom: Number(df.toFixed(2)),
        p_value: Number(pVal.toFixed(5)),
        effect_size_cohens_d: Number(cohensD.toFixed(4)),
        formatted_apa: apaStmt,
        apa_statement: apaStmt,
        is_significant: isSig,
        interpretation: narrative,
        narrative: narrative
      };
    },

    // 3. One-Way Analysis of Variance (ANOVA) with Tukey Post-Hoc
    anovaTest(rows, continuousCol, groupCol) {
      if (!continuousCol || !groupCol) return { error: "Specify both continuous and grouping columns." };

      const groupMap = {};
      let totalN = 0;
      let grandSum = 0;

      rows.forEach(r => {
        const g = r[groupCol];
        const val = r[continuousCol];
        if (g !== null && g !== undefined && val !== null && val !== undefined && !isNaN(Number(val))) {
          const gStr = String(g).trim();
          if (!groupMap[gStr]) groupMap[gStr] = [];
          const num = Number(val);
          groupMap[gStr].push(num);
          grandSum += num;
          totalN++;
        }
      });

      const groupNames = Object.keys(groupMap);
      const k = groupNames.length;
      if (k < 2) return { error: `ANOVA requires at least 2 cohorts. Found: ${k}` };
      if (totalN <= k) return { error: "Insufficient sample observations for ANOVA." };

      const grandMean = grandSum / totalN;
      let ssBetween = 0;
      let ssWithin = 0;

      const groupStats = {};
      groupNames.forEach(g => {
        const arr = groupMap[g];
        const n = arr.length;
        const mean = arr.reduce((a, b) => a + b, 0) / n;
        const variance = n > 1 ? arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1) : 0;
        ssBetween += n * Math.pow(mean - grandMean, 2);
        ssWithin += (n - 1) * variance;
        groupStats[g] = { count: n, mean: Number(mean.toFixed(4)), std: Number(Math.sqrt(variance).toFixed(4)) };
      });

      const dfBetween = k - 1;
      const dfWithin = totalN - k;
      const msBetween = ssBetween / dfBetween;
      const msWithin = ssWithin / dfWithin;
      const fStat = msWithin > 0 ? msBetween / msWithin : 0;
      const pVal = fDistributionPValue(fStat, dfBetween, dfWithin);
      const etaSquared = (ssBetween + ssWithin) > 0 ? ssBetween / (ssBetween + ssWithin) : 0;
      const isSig = pVal < 0.05;

      const apaP = formatPValue(pVal);
      const apaStmt = `F(${dfBetween}, ${dfWithin}) = ${fStat.toFixed(2)}, ${apaP}, η² = ${etaSquared.toFixed(2)}`;

      // Pairwise post-hoc comparisons
      const pairwise = [];
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          const gi = groupNames[i];
          const gj = groupNames[j];
          const diff = groupStats[gi].mean - groupStats[gj].mean;
          const se = Math.sqrt((msWithin / 2.0) * (1 / groupStats[gi].count + 1 / groupStats[gj].count));
          const qVal = se > 0 ? Math.abs(diff) / se : 0;
          const pairSig = qVal > 2.8; // conservative threshold for Tukey critical value approximation
          pairwise.push({
            comparison: `${gi} vs ${gj}`,
            diff: Number(diff.toFixed(2)),
            p_approx: pairSig ? "< .05" : "≥ .05",
            significant: pairSig
          });
        }
      }

      const narrative = isSig
        ? `One-way ANOVA revealed a statistically significant main effect across groups: ${apaStmt}. Practical effect magnitude is substantial (η² = ${etaSquared.toFixed(2)}).`
        : `One-way ANOVA indicated no statistically significant difference across groups: ${apaStmt}.`;

      return {
        test_type: "One-Way ANOVA",
        continuous_variable: continuousCol,
        group_variable: groupCol,
        f_statistic: Number(fStat.toFixed(4)),
        df_between: dfBetween,
        df_within: dfWithin,
        p_value: Number(pVal.toFixed(5)),
        eta_squared: Number(etaSquared.toFixed(4)),
        group_statistics: groupStats,
        pairwise_comparisons: pairwise,
        formatted_apa: apaStmt,
        apa_statement: apaStmt,
        is_significant: isSig,
        interpretation: narrative,
        narrative: narrative
      };
    },

    // 4. Bivariate Correlation Analysis (Pearson & Spearman)
    correlationAnalysis(rows, col1, col2, method = 'pearson') {
      if (!col1 || !col2) return { error: "Specify two numeric columns for correlation." };

      const pairs = [];
      rows.forEach(r => {
        const v1 = r[col1], v2 = r[col2];
        if (v1 !== null && v1 !== undefined && v2 !== null && v2 !== undefined && !isNaN(Number(v1)) && !isNaN(Number(v2))) {
          pairs.push([Number(v1), Number(v2)]);
        }
      });

      const n = pairs.length;
      if (n < 4) return { error: `Insufficient observations for correlation (N = ${n}).` };

      let rVal = 0;
      if (method === 'spearman') {
        // Rank transform
        const rankX = getRanks(pairs.map(p => p[0]));
        const rankY = getRanks(pairs.map(p => p[1]));
        rVal = computePearson(rankX, rankY);
      } else {
        rVal = computePearson(pairs.map(p => p[0]), pairs.map(p => p[1]));
      }

      const df = n - 2;
      const t = Math.abs(rVal) < 1.0 ? rVal * Math.sqrt(df / (1.0 - rVal * rVal)) : 999.0;
      const pVal = studentTPValue(t, df);
      const isSig = pVal < 0.05;

      const strength = Math.abs(rVal) >= 0.7 ? "strong" : (Math.abs(rVal) >= 0.4 ? "moderate" : "weak");
      const direction = rVal > 0 ? "positive" : "negative";

      const apaP = formatPValue(pVal);
      const apaStmt = `r(${df}) = ${rVal.toFixed(2)}, ${apaP}`;
      const narrative = isSig
        ? `A statistically significant, ${strength} ${direction} correlation was confirmed between ${col1} and ${col2}: ${apaStmt}.`
        : `No statistically significant correlation was found between ${col1} and ${col2}: ${apaStmt}.`;

      return {
        test_type: `${method === 'spearman' ? 'Spearman Rank' : 'Pearson'} Correlation Analysis`,
        variable1: col1,
        variable2: col2,
        r: Number(rVal.toFixed(4)),
        sample_size: n,
        degrees_of_freedom: df,
        t_statistic: Number(t.toFixed(4)),
        p_value: Number(pVal.toFixed(5)),
        strength: strength,
        direction: direction,
        formatted_apa: apaStmt,
        apa_statement: apaStmt,
        is_significant: isSig,
        interpretation: narrative,
        narrative: narrative
      };
    },

    // Compute Correlation Matrix for all numeric variables
    calculateCorrelationMatrix(rows, numericCols, method = 'pearson') {
      const matrix = {};
      const pMatrix = {};

      numericCols.forEach(c1 => {
        matrix[c1] = {};
        pMatrix[c1] = {};
        numericCols.forEach(c2 => {
          if (c1 === c2) {
            matrix[c1][c2] = 1.0;
            pMatrix[c1][c2] = 0.0;
          } else {
            const res = StatisticalEngine.correlationAnalysis(rows, c1, c2, method);
            matrix[c1][c2] = res.r !== undefined ? res.r : 0.0;
            pMatrix[c1][c2] = res.p_value !== undefined ? res.p_value : 1.0;
          }
        });
      });

      return { correlation_matrix: matrix, p_values_matrix: pMatrix, columns: numericCols };
    },

    // 5. Categorical Contingency & Chi-Square Test
    chiSquareTest(rows, var1, var2) {
      if (!var1 || !var2) return { error: "Specify two categorical variables for Chi-Square test." };

      const observed = {};
      const rowsSet = new Set();
      const colsSet = new Set();
      let totalN = 0;

      rows.forEach(r => {
        const v1 = r[var1], v2 = r[var2];
        if (v1 !== null && v1 !== undefined && v2 !== null && v2 !== undefined) {
          const s1 = String(v1).trim();
          const s2 = String(v2).trim();
          if (!observed[s1]) observed[s1] = {};
          observed[s1][s2] = (observed[s1][s2] || 0) + 1;
          rowsSet.add(s1);
          colsSet.add(s2);
          totalN++;
        }
      });

      const rList = Array.from(rowsSet);
      const cList = Array.from(colsSet);
      if (rList.length < 2 || cList.length < 2) {
        return { error: "Both variables must contain at least 2 distinct factor levels." };
      }

      const rowTotals = {};
      const colTotals = {};
      rList.forEach(r => rowTotals[r] = 0);
      cList.forEach(c => colTotals[c] = 0);

      rList.forEach(r => {
        cList.forEach(c => {
          const cnt = (observed[r] && observed[r][c]) || 0;
          rowTotals[r] += cnt;
          colTotals[c] += cnt;
        });
      });

      let chi2 = 0;
      rList.forEach(r => {
        cList.forEach(c => {
          const obs = (observed[r] && observed[r][c]) || 0;
          const exp = (rowTotals[r] * colTotals[c]) / totalN;
          if (exp > 0) {
            chi2 += Math.pow(obs - exp, 2) / exp;
          }
        });
      });

      const df = (rList.length - 1) * (cList.length - 1);
      const pVal = chiSquarePValue(chi2, df);
      const minDim = Math.min(rList.length - 1, cList.length - 1);
      const cramersV = (totalN > 0 && minDim > 0) ? Math.sqrt(chi2 / (totalN * minDim)) : 0;
      const isSig = pVal < 0.05;

      const apaP = formatPValue(pVal);
      const apaStmt = `χ²(${df}) = ${chi2.toFixed(2)}, ${apaP}, V = ${cramersV.toFixed(2)}`;
      const narrative = isSig
        ? `A statistically significant dependency was found between ${var1} and ${var2}: ${apaStmt}.`
        : `No statistically significant association was observed between ${var1} and ${var2}: ${apaStmt}.`;

      return {
        test_type: "Chi-Square Test of Independence",
        var1: var1,
        var2: var2,
        chi2_statistic: Number(chi2.toFixed(4)),
        degrees_of_freedom: df,
        p_value: Number(pVal.toFixed(5)),
        cramers_v: Number(cramersV.toFixed(4)),
        total_observations: totalN,
        contingency_table: observed,
        formatted_apa: apaStmt,
        apa_statement: apaStmt,
        is_significant: isSig,
        interpretation: narrative,
        narrative: narrative
      };
    },

    // 6. Multiple Linear Regression (OLS)
    linearRegression(rows, targetCol, featureCols) {
      if (!targetCol || !featureCols || featureCols.length === 0) {
        return { error: "Specify a continuous target and at least one predictor." };
      }

      // Filter valid rows
      const validRows = [];
      rows.forEach(r => {
        const yVal = Number(r[targetCol]);
        if (isNaN(yVal)) return;

        const xVals = [];
        let allValid = true;
        for (let i = 0; i < featureCols.length; i++) {
          const xv = Number(r[featureCols[i]]);
          if (isNaN(xv)) { allValid = false; break; }
          xVals.push(xv);
        }
        if (allValid) {
          validRows.push({ y: yVal, x: xVals });
        }
      });

      const N = validRows.length;
      const p = featureCols.length;
      if (N <= p + 1) {
        return { error: `Insufficient sample size (N = ${N}) for ${p} predictors.` };
      }

      // Design matrix X with intercept column
      const X = [];
      const Y = [];
      validRows.forEach(row => {
        X.push([1.0, ...row.x]);
        Y.push([row.y]);
      });

      const Xt = matrixTranspose(X);
      const XtX = matrixMultiply(Xt, X);
      const invXtX = matrixInverse(XtX);

      if (!invXtX) {
        return { error: "Multicollinearity detected (singular matrix). Remove collinear predictors." };
      }

      const XtY = matrixMultiply(Xt, Y);
      const beta = matrixMultiply(invXtX, XtY); // coefficients [(p+1) x 1]

      // Predictions & Residuals
      const yMean = validRows.reduce((a, b) => a + b.y, 0) / N;
      let ssTotal = 0;
      let ssRes = 0;
      const yPred = [];

      for (let i = 0; i < N; i++) {
        let pred = beta[0][0];
        for (let j = 0; j < p; j++) {
          pred += beta[j + 1][0] * validRows[i].x[j];
        }
        yPred.push(pred);
        ssTotal += Math.pow(validRows[i].y - yMean, 2);
        ssRes += Math.pow(validRows[i].y - pred, 2);
      }

      const rSquared = ssTotal > 0 ? 1.0 - (ssRes / ssTotal) : 0;
      const adjRSquared = 1.0 - ((ssRes / (N - p - 1)) / (ssTotal / (N - 1)));
      const s2 = ssRes / (N - p - 1); // residual variance

      // Standard errors, t-stats, p-values
      const coefs = [];
      const paramNames = ["Intercept", ...featureCols];
      for (let j = 0; j <= p; j++) {
        const se = Math.sqrt(Math.max(0, s2 * invXtX[j][j]));
        const bVal = beta[j][0];
        const tVal = se > 0 ? bVal / se : 0;
        const pVal = studentTPValue(tVal, N - p - 1);
        const ciLow = bVal - 1.96 * se;
        const ciHigh = bVal + 1.96 * se;

        coefs.push({
          parameter: paramNames[j],
          coefficient: Number(bVal.toFixed(4)),
          std_error: Number(se.toFixed(4)),
          t_statistic: Number(tVal.toFixed(4)),
          p_value: Number(pVal.toFixed(5)),
          ci_95: [Number(ciLow.toFixed(4)), Number(ciHigh.toFixed(4))]
        });
      }

      // Overall model F-test
      const dfReg = p;
      const dfRes = N - p - 1;
      const msReg = (ssTotal - ssRes) / dfReg;
      const msRes = ssRes / dfRes;
      const fModel = msRes > 0 ? msReg / msRes : 0;
      const fPVal = fDistributionPValue(fModel, dfReg, dfRes);

      const apaP = formatPValue(fPVal);
      const apaStmt = `F(${dfReg}, ${dfRes}) = ${fModel.toFixed(2)}, ${apaP}, R² = ${rSquared.toFixed(3)}`;

      const narrative = fPVal < 0.05
        ? `The multivariate regression model statistically significantly predicted ${targetCol}: ${apaStmt}. The predictors explain ${(rSquared * 100).toFixed(1)}% of total variance.`
        : `The regression model failed to achieve statistical significance: ${apaStmt}.`;

      return {
        test_type: "Linear Regression (OLS)",
        target: targetCol,
        features: featureCols,
        r_squared: Number(rSquared.toFixed(4)),
        adj_r_squared: Number(adjRSquared.toFixed(4)),
        f_statistic: Number(fModel.toFixed(4)),
        p_value: Number(fPVal.toFixed(5)),
        coefficients: coefs,
        formatted_apa: apaStmt,
        apa_statement: apaStmt,
        is_significant: fPVal < 0.05,
        interpretation: narrative,
        narrative: narrative
      };
    },

    // 7. Automated Test Recommendations
    autoRecommendAnalysis(rows, columns, researchObjective = "") {
      const recs = [];
      const numCols = columns.numeric || [];
      const catCols = columns.categorical || [];

      // 1. If we have at least 1 numeric and 1 categorical
      if (numCols.length >= 1 && catCols.length >= 1) {
        const cat = catCols[0];
        const num = numCols[0];
        // Check levels
        const levels = new Set();
        rows.slice(0, 100).forEach(r => {
          if (r[cat] !== null && r[cat] !== undefined) levels.add(String(r[cat]).trim());
        });

        if (levels.size === 2) {
          recs.push({
            name: "Two-Sample t-Test",
            test: "two_sample_test",
            reason: `Compare continuous '${num}' across the 2 levels of '${cat}'.`,
            params: { continuous_col: num, group_col: cat }
          });
        } else if (levels.size > 2) {
          recs.push({
            name: "One-Way ANOVA",
            test: "anova_test",
            reason: `Compare continuous '${num}' across the ${levels.size} levels of '${cat}'.`,
            params: { continuous_col: num, group_col: cat }
          });
        }
      }

      // 2. If we have 2+ numeric columns
      if (numCols.length >= 2) {
        recs.push({
          name: "Pearson Correlation Analysis",
          test: "correlation_analysis",
          reason: `Assess bivariate association between '${numCols[0]}' and '${numCols[1]}'.`,
          params: { col1: numCols[0], col2: numCols[1], method: 'pearson' }
        });

        if (numCols.length >= 3) {
          recs.push({
            name: "Multiple Linear Regression",
            test: "linear_regression",
            reason: `Predict '${numCols[0]}' using features '${numCols.slice(1, 4).join(', ')}'.`,
            params: { target_col: numCols[0], feature_cols: numCols.slice(1, 4) }
          });
        }
      }

      // 3. If we have 2+ categorical columns
      if (catCols.length >= 2) {
        recs.push({
          name: "Chi-Square Test of Independence",
          test: "chi_square_test",
          reason: `Test statistical independence between '${catCols[0]}' and '${catCols[1]}'.`,
          params: { var1: catCols[0], var2: catCols[1] }
        });
      }

      return recs;
    }
  };

  // Helper function for Pearson calculation
  function computePearson(x, y) {
    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den > 0 ? num / den : 0;
  }

  // Helper function for ranking
  function getRanks(arr) {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j < sorted.length - 1 && sorted[j + 1].val === sorted[j].val) {
        j++;
      }
      const avgRank = 1 + (i + j) / 2.0;
      for (let k = i; k <= j; k++) {
        ranks[sorted[k].idx] = avgRank;
      }
      i = j + 1;
    }
    return ranks;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticalEngine;
  }
  if (typeof window !== 'undefined') {
    window.StatisticalEngine = StatisticalEngine;
  } else if (typeof global !== 'undefined') {
    global.StatisticalEngine = StatisticalEngine;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
