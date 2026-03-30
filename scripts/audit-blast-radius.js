const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const CODE_EXTENSION_LIST = ['.js', '.jsx', '.ts', '.tsx']
const CODE_EXTENSIONS = new Set(CODE_EXTENSION_LIST)
const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'build',
  'node_modules'
])

const SEVERITY_RANK = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  info: 4
}

function main () {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }

  logStep('running npm audit --dry-run --json')
  const auditReport = runJsonCommand('npm', ['audit', '--dry-run', '--json'], {
    allowFailure: true
  })

  const fixableVulnerabilities = getFixableVulnerabilities(auditReport)
  if (fixableVulnerabilities.length === 0) {
    const emptyReport = {
      generatedAt: new Date().toISOString(),
      projectRoot: ROOT,
      summary: {
        totalFixableVulnerabilities: 0,
        totalFixRoots: 0,
        totalAffectedFiles: 0,
        totalHighestLevelImporters: 0
      },
      fixRoots: [],
      vulnerabilities: []
    }

    writeReport(emptyReport, options)
    return
  }

  logStep(`expanding ${fixableVulnerabilities.length} fixable vulnerabilities with npm ls`)
  const vulnerabilityDetails = fixableVulnerabilities.map(vulnerability => {
    const lsTree = runJsonCommand('npm', ['ls', vulnerability.name, '--all', '--json'], {
      allowFailure: true
    })
    const dependencyPaths = dedupeAndSort(
      findPathsToPackage(lsTree, vulnerability.name).map(formatDependencyPath)
    )
    const fixRoots = dedupeAndSort(
      dependencyPaths
        .map(dependencyPath => dependencyPath.split(' > ')[0])
        .filter(Boolean)
    )

    return {
      name: vulnerability.name,
      severity: vulnerability.severity,
      isDirect: vulnerability.isDirect,
      fixAvailable: vulnerability.fixAvailable,
      via: summarizeVia(vulnerability.via),
      dependencyPaths,
      fixRoots: fixRoots.length > 0 ? fixRoots : [vulnerability.name]
    }
  })

  logStep('discovering source files')
  const sourceFiles = collectSourceFiles(ROOT)
  if (sourceFiles.length === 0) {
    throw new Error('No source files found to graph')
  }

  logStep(`building local import graph for ${sourceFiles.length} source files`)
  const sourceGraph = buildSourceGraph(sourceFiles)
  logStep('running madge summary on normalized source tree')
  const madgeSummary = summarizeWithMadge(sourceFiles)
  const reverseGraph = buildReverseGraph(sourceGraph)
  const packageImporters = buildPackageImporters(sourceFiles)

  const fixRootNames = dedupeAndSort(
    vulnerabilityDetails.flatMap(vulnerability => vulnerability.fixRoots)
  )

  const fixRootReports = fixRootNames.map(packageName => {
    const directImporters = packageImporters.get(packageName) ?? []
    const affectedFiles = collectDependents(directImporters, reverseGraph)
    const highestLevelImporters = affectedFiles.filter(file => {
      return (reverseGraph.get(file)?.length ?? 0) === 0
    })
    const vulnerablePackages = dedupeAndSort(
      vulnerabilityDetails
        .filter(vulnerability => vulnerability.fixRoots.includes(packageName))
        .map(vulnerability => vulnerability.name)
    )
    const dependencyPaths = dedupeAndSort(
      vulnerabilityDetails
        .filter(vulnerability => vulnerability.fixRoots.includes(packageName))
        .flatMap(vulnerability => {
          return vulnerability.dependencyPaths.filter(dependencyPath => {
            return dependencyPath === packageName || dependencyPath.startsWith(`${packageName} > `)
          })
        })
    )

    return {
      package: packageName,
      vulnerablePackages,
      dependencyPaths,
      directImporters,
      affectedFiles,
      highestLevelImporters,
      topLevelDirectoryCounts: countTopLevelDirectories(affectedFiles)
    }
  }).sort(compareFixRootReports)

  const overallAffectedFiles = dedupeAndSort(
    fixRootReports.flatMap(report => report.affectedFiles)
  )
  const overallHighestLevelImporters = dedupeAndSort(
    fixRootReports.flatMap(report => report.highestLevelImporters)
  )

  const report = {
    generatedAt: new Date().toISOString(),
    projectRoot: ROOT,
    auditMetadata: auditReport.metadata,
    madge: {
      summary: madgeSummary
    },
    sourceGraph: {
      totalFiles: Object.keys(sourceGraph).length,
      totalEdges: Object.values(sourceGraph).reduce((sum, dependencies) => sum + dependencies.length, 0)
    },
    summary: {
      totalFixableVulnerabilities: vulnerabilityDetails.length,
      totalFixRoots: fixRootReports.length,
      totalAffectedFiles: overallAffectedFiles.length,
      totalHighestLevelImporters: overallHighestLevelImporters.length
    },
    fixRoots: fixRootReports,
    vulnerabilities: vulnerabilityDetails.sort(compareVulnerabilities)
  }

  writeReport(report, options)
}

function parseArgs (argv) {
  const options = {
    help: false,
    json: false,
    out: null
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true
        break
      case '--json':
        options.json = true
        break
      case '--out':
        i += 1
        if (!argv[i]) {
          throw new Error('--out requires a file path')
        }
        options.out = argv[i]
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function usage () {
  return [
    'Usage: node scripts/audit-blast-radius.js [options]',
    '',
    'Options:',
    '  --json        print the full report as JSON',
    '  --out FILE    write the full report to FILE',
    '  -h, --help    show this help'
  ].join('\n')
}

function runJsonCommand (command, args, { allowFailure = false, cwd = ROOT } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  })

  if (result.error) {
    throw result.error
  }

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (result.status !== 0 && !allowFailure) {
    throw new Error(formatCommandError(command, args, stdout, stderr))
  }

  return parseJsonOutput(stdout || stderr, `${command} ${args.join(' ')}`)
}

function runTextCommand (command, args, { allowFailure = false, cwd = ROOT } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  })

  if (result.error) {
    throw result.error
  }

  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (result.status !== 0 && !allowFailure) {
    throw new Error(formatCommandError(command, args, stdout, stderr))
  }

  return stdout || stderr
}

function formatCommandError (command, args, stdout, stderr) {
  const details = (stderr || stdout || 'No output').trim()
  return `Command failed: ${command} ${args.join(' ')}\n${details}`
}

function parseJsonOutput (output, label) {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')

  if (start === -1 || end === -1 || end < start) {
    const snippet = output.trim().slice(0, 500) || 'No output'
    throw new Error(`Could not parse JSON from ${label}\n${snippet}`)
  }

  try {
    return JSON.parse(output.slice(start, end + 1))
  } catch (error) {
    throw new Error(`Invalid JSON from ${label}: ${error.message}`)
  }
}

function getFixableVulnerabilities (auditReport) {
  return Object.entries(auditReport.vulnerabilities ?? {})
    .filter(([, vulnerability]) => Boolean(vulnerability.fixAvailable))
    .map(([name, vulnerability]) => ({
      name,
      severity: vulnerability.severity,
      isDirect: vulnerability.isDirect,
      fixAvailable: vulnerability.fixAvailable,
      via: vulnerability.via
    }))
    .sort(compareVulnerabilities)
}

function summarizeVia (via) {
  return (via ?? []).map(entry => {
    if (typeof entry === 'string') {
      return { package: entry }
    }

    return {
      package: entry.name,
      severity: entry.severity,
      title: entry.title,
      url: entry.url,
      range: entry.range
    }
  })
}

function compareVulnerabilities (left, right) {
  const severityOrder = (SEVERITY_RANK[left.severity] ?? 99) - (SEVERITY_RANK[right.severity] ?? 99)
  if (severityOrder !== 0) {
    return severityOrder
  }

  return left.name.localeCompare(right.name)
}

function findPathsToPackage (node, packageName, trail = []) {
  const dependencies = node?.dependencies ?? {}
  const paths = []

  for (const [dependencyName, dependency] of Object.entries(dependencies)) {
    const nextTrail = [...trail, dependencyName]

    if (dependencyName === packageName) {
      paths.push(nextTrail)
    }

    paths.push(...findPathsToPackage(dependency, packageName, nextTrail))
  }

  return paths
}

function formatDependencyPath (dependencyPath) {
  return dependencyPath.join(' > ')
}

function collectSourceFiles (directory, relativeDirectory = '') {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue
      }

      files.push(...collectSourceFiles(absolutePath, relativePath))
      continue
    }

    if (!CODE_EXTENSIONS.has(path.extname(entry.name))) {
      continue
    }

    files.push(toPosixPath(relativePath))
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function buildSourceGraph (sourceFiles) {
  const sourceFileSet = new Set(sourceFiles.map(toPosixPath))
  const sourceGraph = {}

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.join(ROOT, sourceFile)
    const content = fs.readFileSync(sourcePath, 'utf8')
    sourceGraph[sourceFile] = dedupeAndSort(
      extractImportSpecifiers(content)
        .map(specifier => resolveLocalImport(sourceFile, specifier, sourceFileSet))
        .filter(Boolean)
    )
  }

  return sourceGraph
}

function summarizeWithMadge (sourceFiles) {
  return withNormalizedWorkspace(sourceFiles, tempDirectory => {
    const { command, args } = resolveMadgeCommand()
    return runTextCommand(command, [
      ...args,
      '--summary',
      '--no-spinner',
      '--extensions',
      'js,jsx,ts,tsx',
      '.'
    ], { cwd: tempDirectory }).trim()
  })
}

function withNormalizedWorkspace (sourceFiles, callback) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-audit-blast-radius-'))

  try {
    for (const sourceFile of sourceFiles) {
      const sourcePath = path.join(ROOT, sourceFile)
      const tempPath = path.join(tempDirectory, sourceFile)
      const content = fs.readFileSync(sourcePath, 'utf8')

      fs.mkdirSync(path.dirname(tempPath), { recursive: true })
      fs.writeFileSync(tempPath, normalizeAliasImports(content, sourceFile))
    }

    return callback(tempDirectory)
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

function resolveMadgeCommand () {
  const localMadge = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'madge.cmd' : 'madge'
  )

  if (fs.existsSync(localMadge)) {
    return { command: localMadge, args: [] }
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['--yes', 'madge']
  }
}

function normalizeAliasImports (content, sourceFile) {
  return content.replace(
    /((?:\bfrom\s*|\brequire(?:\.resolve)?\s*\(\s*|\bimport\s*\(\s*))(['"])@\/([^'"]+)\2/g,
    (_, prefix, quote, target) => {
      return `${prefix}${quote}${toRelativeImport(sourceFile, target)}${quote}`
    }
  )
}

function toRelativeImport (sourceFile, target) {
  const sourceDirectory = path.posix.dirname(sourceFile)
  let relativeImport = path.posix.relative(sourceDirectory, target)

  if (relativeImport === '') {
    relativeImport = '.'
  } else if (!relativeImport.startsWith('.')) {
    relativeImport = `./${relativeImport}`
  }

  return relativeImport
}

function resolveLocalImport (sourceFile, specifier, sourceFileSet) {
  if (specifier.startsWith('@/')) {
    return resolveSourceFile(specifier.slice(2), sourceFileSet)
  }

  if (!specifier.startsWith('.')) {
    return null
  }

  const sourceDirectory = path.posix.dirname(sourceFile)
  const basePath = path.posix.normalize(path.posix.join(sourceDirectory, specifier))
  return resolveSourceFile(basePath, sourceFileSet)
}

function resolveSourceFile (basePath, sourceFileSet) {
  const normalizedBasePath = toPosixPath(basePath)
  const extension = path.posix.extname(normalizedBasePath)
  const candidates = extension
    ? [normalizedBasePath]
    : [
        ...CODE_EXTENSION_LIST.map(candidateExtension => `${normalizedBasePath}${candidateExtension}`),
        ...CODE_EXTENSION_LIST.map(candidateExtension => `${normalizedBasePath}/index${candidateExtension}`)
      ]

  return candidates.find(candidate => sourceFileSet.has(candidate)) ?? null
}

function buildReverseGraph (graph) {
  const reverseGraph = new Map()

  for (const file of Object.keys(graph)) {
    reverseGraph.set(file, [])
  }

  for (const [file, dependencies] of Object.entries(graph)) {
    for (const dependency of dependencies) {
      if (!reverseGraph.has(dependency)) {
        reverseGraph.set(dependency, [])
      }

      reverseGraph.get(dependency).push(file)
    }
  }

  for (const [file, dependents] of reverseGraph.entries()) {
    reverseGraph.set(file, dedupeAndSort(dependents))
  }

  return reverseGraph
}

function buildPackageImporters (sourceFiles) {
  const packageImporters = new Map()

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.join(ROOT, sourceFile)
    const content = fs.readFileSync(sourcePath, 'utf8')
    const importedPackages = dedupeAndSort(
      extractImportSpecifiers(content)
        .map(toPackageName)
        .filter(Boolean)
    )

    for (const packageName of importedPackages) {
      const importers = packageImporters.get(packageName) ?? []
      importers.push(sourceFile)
      packageImporters.set(packageName, importers)
    }
  }

  for (const [packageName, importers] of packageImporters.entries()) {
    packageImporters.set(packageName, dedupeAndSort(importers))
  }

  return packageImporters
}

function extractImportSpecifiers (content) {
  const specifiers = []
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\brequire(?:\.resolve)?\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  ]

  for (const pattern of patterns) {
    let match

    while ((match = pattern.exec(content)) !== null) {
      specifiers.push(match[1])
    }
  }

  return specifiers
}

function toPackageName (specifier) {
  if (
    !specifier ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('@/') ||
    specifier.startsWith('node:')
  ) {
    return null
  }

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return name ? `${scope}/${name}` : specifier
  }

  return specifier.split('/')[0]
}

function collectDependents (files, reverseGraph) {
  const queue = [...files]
  const seen = new Set(files)

  while (queue.length > 0) {
    const current = queue.shift()
    const dependents = reverseGraph.get(current) ?? []

    for (const dependent of dependents) {
      if (seen.has(dependent)) {
        continue
      }

      seen.add(dependent)
      queue.push(dependent)
    }
  }

  return dedupeAndSort([...seen])
}

function countTopLevelDirectories (files) {
  const counts = new Map()

  for (const file of files) {
    const topLevelDirectory = file.split('/')[0]
    counts.set(topLevelDirectory, (counts.get(topLevelDirectory) ?? 0) + 1)
  }

  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return left[0].localeCompare(right[0])
    })
  )
}

function compareFixRootReports (left, right) {
  if (right.highestLevelImporters.length !== left.highestLevelImporters.length) {
    return right.highestLevelImporters.length - left.highestLevelImporters.length
  }

  if (right.affectedFiles.length !== left.affectedFiles.length) {
    return right.affectedFiles.length - left.affectedFiles.length
  }

  return left.package.localeCompare(right.package)
}

function dedupeAndSort (values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function toPosixPath (value) {
  return value.split(path.sep).join('/')
}

function writeReport (report, options) {
  if (options.out) {
    const outputPath = path.resolve(ROOT, options.out)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    logStep(`wrote report to ${path.relative(ROOT, outputPath) || outputPath}`)
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }

  process.stdout.write(`${formatHumanSummary(report)}\n`)
}

function formatHumanSummary (report) {
  const lines = [
    `Fixable vulnerabilities: ${report.summary.totalFixableVulnerabilities}`,
    `Fix roots to inspect: ${report.summary.totalFixRoots}`,
    `Affected files: ${report.summary.totalAffectedFiles}`,
    `Highest-level files: ${report.summary.totalHighestLevelImporters}`,
    ''
  ]

  for (const fixRoot of report.fixRoots) {
    lines.push(`${fixRoot.package}`)
    lines.push(`  vulnerable packages: ${formatInlineList(fixRoot.vulnerablePackages, 8)}`)
    lines.push(`  dependency paths: ${formatInlineList(fixRoot.dependencyPaths, 4)}`)
    lines.push(`  direct importers (${fixRoot.directImporters.length}): ${formatInlineList(fixRoot.directImporters, 6)}`)
    lines.push(`  high-level files (${fixRoot.highestLevelImporters.length}): ${formatInlineList(fixRoot.highestLevelImporters, 8)}`)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function formatInlineList (values, limit) {
  if (!values || values.length === 0) {
    return 'none'
  }

  if (values.length <= limit) {
    return values.join(', ')
  }

  return `${values.slice(0, limit).join(', ')}, ... +${values.length - limit} more`
}

function logStep (message) {
  process.stderr.write(`[audit:blast-radius] ${message}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
