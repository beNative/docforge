import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');
const docPath = path.resolve(projectRoot, 'docs', 'gui-test-plan-report.md');
const artifactDir = path.resolve(projectRoot, 'artifacts');

function ensureArtifactsDir() {
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
}

function readDocument() {
  try {
    return fs.readFileSync(docPath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${path.relative(projectRoot, docPath)}: ${error.message}`);
  }
}

function extractScenarioTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('| Priority'));
  if (headerIndex === -1) {
    throw new Error('Scenario table header not found in Section 1.');
  }
  const rows = [];
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      break;
    }
    if (line.trim().startsWith('|')) {
      rows.push(line);
    }
  }
  if (rows.length === 0) {
    throw new Error('Scenario table does not contain any rows.');
  }
  return rows;
}

function parseScenarioRow(row) {
  const cells = row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length < 7) {
    throw new Error(`Scenario row has an unexpected number of columns: ${row}`);
  }
  return {
    priority: cells[0],
    scenario: cells[1],
    objective: cells[2],
    testSteps: cells[3],
    expectedOutcome: cells[4],
    environment: cells[5],
    executionStatus: cells[6],
    raw: row,
  };
}

function validateExecutionStatus(status) {
  const allowed = ['**Pass**', '**Fail**', '**Blocked**', '**Not Run**'];
  return allowed.some((token) => status.includes(token));
}

function collectValidations(markdown) {
  const validations = [];
  const failures = [];

  const requiredHeadings = [
    '## 1. Prioritized Test Scenarios',
    '## 2. Test Execution Report',
    '### 2.1 Execution Summary',
    '### 2.2 Impact on Scenario Coverage',
    '### 2.3 Blocker Detail',
    '### 2.4 Mitigation Plan',
  ];

  requiredHeadings.forEach((heading) => {
    const found = markdown.includes(heading);
    validations.push({
      name: `Heading present: ${heading}`,
      status: found ? 'pass' : 'fail',
      details: found
        ? 'Heading located in document.'
        : 'Heading missing from document. Update the test report to include this section.',
    });
    if (!found) {
      failures.push(`Missing heading: ${heading}`);
    }
  });

  const rows = extractScenarioTable(markdown).map(parseScenarioRow);

  const seenNames = new Set();
  rows.forEach((row) => {
    const statusValid = validateExecutionStatus(row.executionStatus);
    validations.push({
      name: `Execution status format: ${row.scenario}`,
      status: statusValid ? 'pass' : 'fail',
      details: statusValid
        ? `Execution status "${row.executionStatus}" uses an approved label.`
        : 'Execution status must include one of **Pass**, **Fail**, **Blocked**, or **Not Run**.',
    });
    if (!statusValid) {
      failures.push(`Invalid execution status for scenario: ${row.scenario}`);
    }

    if (seenNames.has(row.scenario)) {
      validations.push({
        name: `Unique scenario name: ${row.scenario}`,
        status: 'fail',
        details: 'Duplicate scenario name detected. Scenario names must be unique.',
      });
      failures.push(`Duplicate scenario name found: ${row.scenario}`);
    } else {
      seenNames.add(row.scenario);
      validations.push({
        name: `Unique scenario name: ${row.scenario}`,
        status: 'pass',
        details: 'Scenario name is unique within the matrix.',
      });
    }
  });

  const fileTypeExpectations = [
    { keyword: 'Markdown', label: 'Markdown document scenario present' },
    { keyword: 'HTML', label: 'HTML document scenario present' },
    { keyword: 'PlantUML', label: 'PlantUML document scenario present' },
    { keyword: 'PDF', label: 'PDF document scenario present' },
    { keyword: 'PNG', label: 'Image document scenario present' },
    { keyword: 'plaintext', label: 'Plaintext document scenario present' },
  ];

  fileTypeExpectations.forEach(({ keyword, label }) => {
    const match = rows.some((row) => row.scenario.toLowerCase().includes(keyword.toLowerCase()));
    validations.push({
      name: label,
      status: match ? 'pass' : 'fail',
      details: match
        ? `Scenario covering ${keyword} documents is present.`
        : `Add a scenario that covers ${keyword} documents to satisfy onboarding coverage.`,
    });
    if (!match) {
      failures.push(`Missing file type scenario: ${keyword}`);
    }
  });

  const statusCounts = rows.reduce(
    (acc, row) => {
      if (row.executionStatus.includes('**Pass**')) acc.pass += 1;
      else if (row.executionStatus.includes('**Fail**')) acc.fail += 1;
      else if (row.executionStatus.includes('**Blocked**')) acc.blocked += 1;
      else if (row.executionStatus.includes('**Not Run**')) acc.notRun += 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );

  validations.push({
    name: 'Scenario coverage summary',
    status: 'pass',
    details: `Scenario counts — Pass: ${statusCounts.pass}, Fail: ${statusCounts.fail}, Blocked: ${statusCounts.blocked}, Not Run: ${statusCounts.notRun}.`,
  });

  return { validations, failures, statusCounts };
}

function writeArtifacts(result) {
  ensureArtifactsDir();
  const timestamp = new Date().toISOString();
  const payload = { timestamp, ...result };
  fs.writeFileSync(
    path.resolve(artifactDir, 'gui-test-plan-validation.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );

  const markdownLines = [
    '# GUI Test Plan Validation Results',
    '',
    `Generated: ${timestamp}`,
    '',
    '| Test | Status | Details |',
    '| --- | --- | --- |',
    ...result.validations.map((test) => `| ${test.name} | ${test.status.toUpperCase()} | ${test.details} |`),
    '',
    `**Summary:** Pass ${result.statusCounts.pass}, Fail ${result.statusCounts.fail}, Blocked ${result.statusCounts.blocked}, Not Run ${result.statusCounts.notRun}.`,
  ];

  fs.writeFileSync(
    path.resolve(artifactDir, 'gui-test-plan-validation.md'),
    `${markdownLines.join('\n')}\n`,
    'utf8',
  );

  const htmlRows = result.validations
    .map((test) => {
      const statusClass = test.status === 'pass' ? 'pass' : test.status === 'fail' ? 'fail' : 'info';
      return `<tr class="${statusClass}"><td>${test.name}</td><td>${test.status.toUpperCase()}</td><td>${test.details}</td></tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>GUI Test Plan Validation Results</title>
<style>
  :root {
    color-scheme: light dark;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  body {
    margin: 2rem;
    background: #f6f7fb;
    color: #1f2933;
  }
  h1 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #ffffff;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  }
  th, td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }
  th {
    background: #1f2937;
    color: #f9fafb;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  tr.pass td.status {
    color: #047857;
    font-weight: 600;
  }
  tr.fail td.status {
    color: #b91c1c;
    font-weight: 600;
  }
  tr.info td.status {
    color: #0f172a;
    font-weight: 600;
  }
  tr:nth-child(even) td {
    background: rgba(15, 23, 42, 0.03);
  }
  .meta {
    margin-bottom: 1rem;
    color: #4b5563;
  }
</style>
</head>
<body>
  <h1>GUI Test Plan Validation Results</h1>
  <p class="meta">Generated: ${timestamp}</p>
  <table>
    <thead>
      <tr><th>Test</th><th>Status</th><th>Details</th></tr>
    </thead>
    <tbody>
      ${htmlRows}
      <tr class="info"><td colspan="3"><strong>Summary:</strong> Pass ${result.statusCounts.pass}, Fail ${result.statusCounts.fail}, Blocked ${result.statusCounts.blocked}, Not Run ${result.statusCounts.notRun}</td></tr>
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(
    path.resolve(artifactDir, 'gui-test-plan-validation.html'),
    html,
    'utf8',
  );
}

function main() {
  const markdown = readDocument();
  const result = collectValidations(markdown);
  writeArtifacts(result);
  const failed = result.failures.length > 0;
  result.validations.forEach((test) => {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : 'ℹ️';
    console.log(`${icon} ${test.name} — ${test.details}`);
  });
  console.log('\nSummary:', result.statusCounts);
  if (failed) {
    console.error('\nValidation failures detected. See artifacts/gui-test-plan-validation.json for details.');
    process.exitCode = 1;
  }
}

main();
