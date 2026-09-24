/**
 * Each option: { option (config key), label, description, widget, default }.
 */

// Select choices from "Select options reference" in OPTIONS_BY_CATEGORY.md
export const SELECT_OPTIONS = {
  blockfilterindex: [
    { value: '', label: 'Disable' },
    { value: 'basic', label: 'Basic filters' },
    { value: '1', label: 'Enable all' }
  ],
  chain: [
    { value: 'main', label: 'Mainnet' },
    { value: 'test', label: 'Testnet (testnet3)' },
    { value: 'testnet4', label: 'Testnet 4' },
    { value: 'signet', label: 'Signet' },
    { value: 'regtest', label: 'Regtest' }
  ],
  onlynet: [
    { value: '', label: 'Use every available network' },
    { value: 'ipv4', label: 'IPv4 only' },
    { value: 'ipv6', label: 'IPv6 only' },
    { value: 'onion', label: 'Tor only' },
    { value: 'i2p', label: 'I2P only' },
    { value: 'cjdns', label: 'CJDNS only' }
  ],
  test: [
    { value: '', label: 'None' },
    { value: 'addrman', label: 'Addrman' },
    { value: 'bip94', label: 'Bip94' },
    { value: 'reindex_after_failure_noninteractive_yes', label: 'Reindex after failure (non-interactive yes)' }
  ],
  debug: [
    { value: '', label: 'Disable' },
    { value: 'all', label: 'Enable All' },
    { value: 'addrman', label: 'Address Manager' },
    { value: 'alerts', label: 'Alerts' },
    { value: 'bench', label: 'Benchmarking' },
    { value: 'compact', label: 'Compact Blocks' },
    { value: 'coindb', label: 'CoinDB' },
    { value: 'db', label: 'Database' },
    { value: 'http', label: 'HTTP' },
    { value: 'leveldb', label: 'LevelDB' },
    { value: 'libevent', label: 'LibEvent' },
    { value: 'lock', label: 'Locking' },
    { value: 'mempool', label: 'Mempool' },
    { value: 'mempoolrej', label: 'Mempool Rejection' },
    { value: 'net', label: 'Networking' },
    { value: 'proxy', label: 'Proxy' },
    { value: 'prune', label: 'Pruning' },
    { value: 'rand', label: 'Random' },
    { value: 'reindex', label: 'Reindex' },
    { value: 'rpc', label: 'RPC' },
    { value: 'selectcoins', label: 'Coin Selection' },
    { value: 'tor', label: 'Tor' },
    { value: 'zmq', label: 'ZeroMQ' }
  ],
  debugexclude: [
    { value: '', label: 'No Exclusions' },
    { value: 'all', label: 'Enable All' },
    { value: 'addrman', label: 'Address Manager' },
    { value: 'alerts', label: 'Alerts' },
    { value: 'bench', label: 'Benchmarking' },
    { value: 'compact', label: 'Compact Blocks' },
    { value: 'coindb', label: 'CoinDB' },
    { value: 'db', label: 'Database' },
    { value: 'http', label: 'HTTP' },
    { value: 'leveldb', label: 'LevelDB' },
    { value: 'libevent', label: 'LibEvent' },
    { value: 'lock', label: 'Locking' },
    { value: 'mempool', label: 'Mempool' },
    { value: 'mempoolrej', label: 'Mempool Rejection' },
    { value: 'net', label: 'Networking' },
    { value: 'proxy', label: 'Proxy' },
    { value: 'prune', label: 'Pruning' },
    { value: 'rand', label: 'Random' },
    { value: 'reindex', label: 'Reindex' },
    { value: 'rpc', label: 'RPC' },
    { value: 'selectcoins', label: 'Coin Selection' },
    { value: 'tor', label: 'Tor' },
    { value: 'zmq', label: 'ZeroMQ' }
  ],
  deprecatedrpc: [
    { value: '', label: 'None' },
    { value: 'create_bdb', label: 'create_bdb' },
    { value: 'settxfee', label: 'settxfee' },
    { value: 'warnings', label: 'warnings' }
  ],
  rpccookieperms: [
    { value: 'owner', label: 'owner' },
    { value: 'group', label: 'group' },
    { value: 'all', label: 'all' }
  ],
  addresstype: [
    { value: 'legacy', label: 'Legacy' },
    { value: 'p2sh-segwit', label: 'p2sh-segwit' },
    { value: 'bech32', label: 'bech32' },
    { value: 'bech32m', label: 'bech32m' }
  ],
  changetype: [
    { value: 'legacy', label: 'Legacy' },
    { value: 'p2sh-segwit', label: 'p2sh-segwit' },
    { value: 'bech32', label: 'bech32' },
    { value: 'bech32m', label: 'bech32m' }
  ]
}

// OS-dependent file/path defaults from OPTIONS_BY_CATEGORY.md (Windows / Mac / Linux)
const PATH_DEFAULTS_BY_OPTION = {
  blocksdir: {
    windows: '%APPDATA%\\Bitcoin\\blocks',
    mac: '~/Library/Application Support/Bitcoin/blocks',
    linux: '~/.bitcoin/blocks'
  },
  datadir: {
    windows: '%APPDATA%\\Bitcoin',
    mac: '~/Library/Application Support/Bitcoin',
    linux: '~/.bitcoin'
  },
  debuglogfile: {
    windows: '%APPDATA%\\Bitcoin\\debug.log',
    mac: '~/Library/Application Support/Bitcoin/debug.log',
    linux: '~/.bitcoin/debug.log'
  },
  asmap: {
    windows: '%APPDATA%\\Bitcoin\\ip_asn.map',
    mac: '~/Library/Application Support/Bitcoin/ip_asn.map',
    linux: '~/.bitcoin/ip_asn.map'
  },
  walletdir: {
    windows: '%APPDATA%\\Bitcoin\\wallets',
    mac: '~/Library/Application Support/Bitcoin/wallets',
    linux: '~/.bitcoin/wallets'
  }
}

export const OS_PATH_OPTION_KEYS = Object.keys(PATH_DEFAULTS_BY_OPTION)

/** Return the default path for an option for the given OS (windows/mac/linux), or '' if unknown. */
export function getDefaultPathForOption (optionKey, os) {
  const byOs = PATH_DEFAULTS_BY_OPTION[optionKey]
  if (!byOs || !os) return ''
  return byOs[os] ?? ''
}

/** True if value is empty or equals one of the OS default paths for this option. */
export function isPathDefaultValue (optionKey, value) {
  if (value === '' || value == null || String(value).trim() === '') return true
  const byOs = PATH_DEFAULTS_BY_OPTION[optionKey]
  if (!byOs) return false
  const v = String(value).trim()
  return Object.values(byOs).some(p => p === v)
}

// Normalize default from MD for comparison (empty = omit from conf)
function def (val) {
  if (val === undefined || val === null) return ''
  const s = String(val).trim()
  if (s === '' || s === '""' || s === '—' || s.toLowerCase() === 'any' || /^varies|^Windows:|^Mac:|^Linux:/i.test(s)) return ''
  return s
}

// Options by category; order and descriptions follow Bitcoin Core src/init.cpp (OptionsCategory::OPTIONS)
const OPTIONS_OPTIONS = [
  { option: 'alertnotify', label: 'Alert Notification', description: 'Execute command when an alert is raised (%s in cmd is replaced by message).', widget: 'text', default: def('') },
  { option: 'assumevalid', label: 'Assume Valid', description: 'If this block is in the chain assume that it and its ancestors are valid; 0 to verify all. Bitcoin Core uses chain-specific defaults.', widget: 'text', default: def('') },
  { option: 'blocksdir', label: 'Blocks Directory', description: 'Specify directory to hold blocks subdirectory for *.dat files.', widget: 'text', default: '' },
  { option: 'blocksxor', label: 'Blocks XOR', description: 'Whether an XOR-key applies to blocksdir *.dat files (0 or 1).', widget: 'switch', default: '1' },
  { option: 'blocknotify', label: 'Block Notification', description: 'Execute command when the best block changes (%s in cmd is replaced by block hash).', widget: 'text', default: def('') },
  { option: 'blockreconstructionextratxn', label: 'Block Reconstruction Extra Transactions', description: 'Extra transactions to keep in memory for compact block reconstructions.', widget: 'number', default: '100', min: 0 },
  { option: 'blocksonly', label: 'Blocks Only', description: 'Reject transactions from network peers (broadcast/rebroadcast disabled unless peer has forcerelay). RPC transactions not affected.', widget: 'switch', default: '0' },
  { option: 'coinstatsindex', label: 'Coin Stats Index', description: 'Maintain coinstats index used by the gettxoutsetinfo RPC.', widget: 'switch', default: '0' },
  { option: 'datadir', label: 'Data Directory', description: 'Specify data directory.', widget: 'text', default: '' },
  { option: 'dbbatchsize', label: 'DB Batch Size', description: 'Maximum database write batch size in bytes.', widget: 'number', default: '33554432', min: 0 },
  { option: 'dbcache', label: 'DB Cache', description: 'Maximum database cache size in MiB (minimum 4). Unused mempool memory is shared with this cache.', widget: 'number', default: '450', min: 4 },
  { option: 'includeconf', label: 'Include Config', description: 'Additional configuration file, relative to datadir (only from config file, not command line).', widget: 'text', default: def('') },
  { option: 'allowignoredconf', label: 'Allow Ignored Config', description: 'Treat an unused bitcoin.conf in the datadir as a warning, not an error.', widget: 'switch', default: '0' },
  { option: 'loadblock', label: 'Load Block', description: 'Imports blocks from external file on startup. Can be set multiple times.', widget: 'textarea', default: def('') },
  { option: 'maxmempool', label: 'Max Mempool', description: 'Keep the transaction memory pool below N megabytes.', widget: 'number', default: '300', min: 0 },
  { option: 'mempoolexpiry', label: 'Mempool Expiry', description: 'Do not keep transactions in the mempool longer than N hours.', widget: 'number', default: '336', min: 0 },
  { option: 'minimumchainwork', label: 'Minimum Chain Work', description: 'Minimum work assumed to exist on a valid chain (hex). Bitcoin Core uses chain-specific defaults; this generator uses mainnet default.', widget: 'text', default: '0x000000000000000000000000000000000000000000f91c579d57cad4bc5278cc' },
  { option: 'par', label: 'Script Verification Threads', description: 'Number of script verification threads (0=auto, <0=leave that many cores free, positive up to 256).', widget: 'number', default: '0', min: -256, max: 256 },
  { option: 'persistmempool', label: 'Persist Mempool', description: 'Save the mempool on shutdown and load on restart.', widget: 'switch', default: '1' },
  { option: 'persistmempoolv1', label: 'Persist Mempool Legacy Format', description: 'Write mempool.dat in legacy (v1) or current (v2) format. Temporary option.', widget: 'switch', default: '0' },
  { option: 'pid', label: 'PID File', description: 'Specify pid file. Relative paths prefixed by net-specific datadir.', widget: 'text', default: 'bitcoind.pid' },
  { option: 'prune', label: 'Prune', description: 'Reduce storage by pruning old blocks. Valid: 0=disable, 1=manual via RPC, ≥550=auto prune to target MiB. Values 2–549 are invalid in Bitcoin Core. Incompatible with txindex.', widget: 'number', default: '0', min: 0, max: 1000000 },
  { option: 'reindex', label: 'Reindex', description: 'Wipe chain state and block index and rebuild from blk*.dat. Also wipes optional indexes.', widget: 'switch', default: '0' },
  { option: 'reindex-chainstate', label: 'Reindex Chainstate', description: 'Wipe chain state and rebuild from blk*.dat on disk.', widget: 'switch', default: '0' },
  { option: 'settings', label: 'Settings File', description: 'Path to dynamic settings data file. Written at runtime; use bitcoin.conf for custom settings.', widget: 'text', default: 'settings.json' },
  { option: 'startupnotify', label: 'Startup Notify', description: 'Execute command on startup.', widget: 'text', default: def('') },
  { option: 'shutdownnotify', label: 'Shutdown Notify', description: 'Execute command immediately before shutdown. Do not delay.', widget: 'text', default: def('') },
  { option: 'txindex', label: 'Transaction Index', description: 'Maintain a full transaction index for the getrawtransaction RPC.', widget: 'switch', default: '0' },
  { option: 'txospenderindex', label: 'TxOut Spender Index', description: 'Maintain a transaction output spender index for the gettxspendingprevout RPC.', widget: 'switch', default: '0' },
  { option: 'blockfilterindex', label: 'Block Filter Index', description: 'Maintain an index of compact filters by block (0, basic, or 1=all types).', widget: 'select', default: '' },
  { option: 'daemon', label: 'Daemon', description: 'Run in the background as a daemon and accept commands.', widget: 'switch', default: '0' },
  { option: 'daemonwait', label: 'Daemon Wait', description: 'Wait for initialization to finish before exiting. Implies -daemon.', widget: 'switch', default: '0' }
]

// Debugging/testing options; order follows init.cpp OptionsCategory::DEBUG_TEST (+ logging from AddLoggingArgs)
const DEBUG_OPTIONS = [
  { option: 'checkblocks', label: 'Check Blocks', description: 'How many blocks to check at startup (0 = all).', widget: 'number', default: '6', min: 0 },
  { option: 'checklevel', label: 'Check Level', description: 'How thorough the block verification of -checkblocks is (0–4).', widget: 'number', default: '3', min: 0, max: 4 },
  { option: 'checkblockindex', label: 'Check Block Index', description: 'Consistency check for block tree, chainstate, etc. every N operations. 0 to disable.', widget: 'number', default: '0', min: 0 },
  { option: 'checkaddrman', label: 'Check Addrman', description: 'Run addrman consistency checks every N operations. 0 to disable.', widget: 'number', default: '0', min: 0 },
  { option: 'checkmempool', label: 'Check Mempool', description: 'Run mempool consistency checks every N transactions. 0 to disable.', widget: 'number', default: '0', min: 0 },
  { option: 'deprecatedrpc', label: 'Deprecated RPC', description: 'Allow deprecated RPC method(s) to be used. Enable one or more.', widget: 'multi_switch', default: '', multiSwitchOptions: [{ value: 'create_bdb', label: 'create_bdb' }, { value: 'settxfee', label: 'settxfee' }, { value: 'warnings', label: 'warnings' }] },
  { option: 'stopafterblockimport', label: 'Stop After Block Import', description: 'Stop running after importing blocks from disk.', widget: 'switch', default: '0' },
  { option: 'stopatheight', label: 'Stop At Height', description: 'Stop running after reaching the given height in the main chain. Blocks after target may be processed during shutdown.', widget: 'number', default: '0', min: 0 },
  { option: 'test', label: 'Test', description: 'Pass a test-only option (e.g. addrman, bip94). Only applies when chain=regtest.', widget: 'select', default: '' },
  { option: 'limitclustercount', label: 'Limit Cluster Count', description: 'Do not accept tx into mempool connected to ≥ N other unconfirmed tx (max 64).', widget: 'number', default: '64', min: 0, max: 64 },
  { option: 'limitclustersize', label: 'Limit Cluster Size', description: 'Do not accept tx whose virtual size with connected in-mempool tx exceeds N kB.', widget: 'number', default: '101', min: 0 },
  { option: 'capturemessages', label: 'Capture Messages', description: 'Capture all P2P messages to disk.', widget: 'switch', default: '0' },
  { option: 'mocktime', label: 'Mock Time', description: 'Replace actual time with Unix epoch time (default: 0).', widget: 'number', default: '0', min: 0 },
  { option: 'maxsigcachesize', label: 'Max Sig Cache Size', description: 'Limit sum of signature cache and script execution cache sizes to N MiB.', widget: 'number', default: '32', min: 0 },
  { option: 'maxtipage', label: 'Max Tip Age', description: 'Maximum tip age in seconds to consider node in initial block download.', widget: 'number', default: '86400', min: 0 },
  { option: 'printpriority', label: 'Print Priority', description: 'Log transaction fee rate in BTC/kvB when mining blocks.', widget: 'switch', default: '0' },
  { option: 'uacomment', label: 'User-Agent Comment', description: 'Append comment to the user agent string.', widget: 'text', default: def('') },
  { option: 'acceptstalefeeestimates', label: 'Accept Stale Fee Estimates', description: 'Read fee estimates even if stale (regtest only). Stale = over 60 hours old.', widget: 'switch', default: '0' },
  { option: 'dbcrashratio', label: 'DB Crash Ratio', description: 'Randomly crash while writing at given rate 0–1 (testing). Hidden in bitcoind -help.', widget: 'number_float_8', default: '0', min: 0, max: 1 },
  { option: 'fastprune', label: 'Fast Prune', description: 'Use smaller block files and lower minimum prune height for testing.', widget: 'switch', default: '0' },
  { option: 'testactivationheight', label: 'Test Activation Height', description: "Set activation height of 'name' (segwit, bip34, dersig, cltv, csv). Regtest-only. Format: name@height.", widget: 'text', default: def('') },
  { option: 'scriptverifyflag', label: 'Script Verify Flag', description: 'Integer script verification flags to enable.', widget: 'text', default: def('') },
  { option: 'maxtxfee', label: 'Max Tx Fee', description: 'Maximum total fees (BTC) in a single wallet or raw transaction. Too low may abort large tx.', widget: 'number_float_8', default: '0.10', min: 0 },
  { option: 'debug', label: 'Debug', description: 'Output debug and trace logging. Category optional; 1 or "all" for all.', widget: 'select', default: '' },
  { option: 'debugexclude', label: 'Debug Exclude', description: 'Exclude debug logging for category. Takes priority over -debug.', widget: 'select', default: '' },
  { option: 'debuglogfile', label: 'Debug Log File', description: 'Location of debug log. Relative paths prefixed by net-specific datadir. -nodebuglogfile disables file.', widget: 'text', default: '' },
  { option: 'logips', label: 'Log IPs', description: 'Include IP addresses in log output.', widget: 'switch', default: '0' },
  { option: 'loglevel', label: 'Log Level', description: 'Global or per-category severity (info, debug, trace). Category:level overrides global.', widget: 'text', default: def('') },
  { option: 'loglevelalways', label: 'Log Level Always', description: 'Always prepend category and level to each log message.', widget: 'switch', default: '0' },
  { option: 'logratelimit', label: 'Log Rate Limit', description: 'Apply rate limiting to unconditional logging to mitigate disk-filling.', widget: 'switch', default: '1' },
  { option: 'logsourcelocations', label: 'Log Source Locations', description: 'Prepend source location (file, line, function) to debug output.', widget: 'switch', default: '0' },
  { option: 'logthreadnames', label: 'Log Thread Names', description: 'Prepend thread name to debug output.', widget: 'switch', default: '0' },
  { option: 'logtimestamps', label: 'Log Timestamps', description: 'Prepend timestamp to debug output.', widget: 'switch', default: '1' },
  { option: 'logtimemicros', label: 'Log Time Micros', description: 'Microsecond precision in debug timestamps.', widget: 'switch', default: '0' },
  { option: 'printtoconsole', label: 'Print to Console', description: 'Send trace/debug to console (default when no -daemon). Use -nodebuglogfile to disable file.', widget: 'switch', default: '0' },
  { option: 'shrinkdebugfile', label: 'Shrink Debug File', description: 'Shrink debug.log on client startup (default when no -debug).', widget: 'switch', default: '1' }
]

// Chain selection; order follows chainparamsbase.cpp SetupChainParamsBaseOptions (OptionsCategory::CHAINPARAMS)
const CHAIN_OPTIONS = [
  { option: 'chain', label: 'Chain', description: 'Use the chain (main, test, testnet4, signet, regtest).', widget: 'select', default: 'main' },
  { option: 'regtest', label: 'Regtest', description: 'Regression test mode; blocks can be solved instantly. Equivalent to -chain=regtest.', widget: 'switch', default: '0' },
  { option: 'testnet4', label: 'Testnet 4', description: 'Use the testnet4 chain. Equivalent to -chain=testnet4.', widget: 'switch', default: '0' },
  { option: 'vbparams', label: 'Version Bits Params', description: 'Version bits deployment start/end and min_activation_height. Regtest-only. Format: deployment:start:end[:min_activation_height].', widget: 'text', default: def('') },
  { option: 'signet', label: 'Signet', description: 'Use the signet chain. Equivalent to -chain=signet. Network defined by -signetchallenge.', widget: 'switch', default: '0' },
  { option: 'signetchallenge', label: 'Signet Challenge', description: 'Blocks must satisfy the given script (signet only). Defaults to global default signet test network challenge.', widget: 'text', default: def('') },
  { option: 'signetseednode', label: 'Signet Seed Node', description: 'Seed node for signet, hostname[:port]. Can be set multiple times. Defaults to global default signet seed node(s).', widget: 'textarea', default: def('') }
]

// Block creation; order follows init.cpp OptionsCategory::BLOCK_CREATION
const BLOCK_CREATION_OPTIONS = [
  { option: 'blockmaxweight', label: 'Block Max Weight', description: 'Set maximum BIP141 block weight (max 4000000).', widget: 'number', default: '4000000', min: 0, max: 4000000 },
  { option: 'blockreservedweight', label: 'Block Reserved Weight', description: 'Reserve space for block header plus largest coinbase. Min 2000, max 4000000. Affects mining RPC clients only.', widget: 'number', default: '8000', min: 2000, max: 4000000 },
  { option: 'blockmintxfee', label: 'Block Min Tx Fee', description: 'Lowest fee rate (BTC/kvB) for tx to be included in block creation.', widget: 'number_float_8', default: '0.00001', min: 0 },
  { option: 'blockversion', label: 'Block Version', description: 'Override block version to test forking scenarios.', widget: 'text', default: def('') }
]

// Connection options; order follows init.cpp OptionsCategory::CONNECTION
const CONNECTION_OPTIONS = [
  { option: 'addnode', label: 'Add Node', description: 'Add a node to connect to and attempt to keep the connection open. Can be set multiple times (limit 8).', widget: 'textarea', default: def('') },
  { option: 'asmap', label: 'ASN Mapping', description: 'ASN mapping used for bucketing peers. Relative paths prefixed by net-specific datadir.', widget: 'text', default: '' },
  { option: 'bantime', label: 'Ban Time', description: 'Default duration in seconds for manually configured bans.', widget: 'number', default: '86400', min: 0 },
  { option: 'bind', label: 'Bind', description: 'Bind to given address and always listen. Use [host]:port for IPv6. Append =onion for Tor.', widget: 'text', default: '0.0.0.0' },
  { option: 'cjdnsreachable', label: 'CJDNS Reachable', description: 'If set, this host is configured for CJDNS (fc00::/8).', widget: 'switch', default: '0' },
  { option: 'connect', label: 'Connect', description: 'Connect only to the specified node(s); -noconnect disables automatic connections. Can be set multiple times.', widget: 'textarea', default: def('') },
  { option: 'discover', label: 'Discover', description: 'Discover own IP addresses (when listening and no -externalip or -proxy).', widget: 'switch', default: '1' },
  { option: 'dns', label: 'DNS Lookups', description: 'Allow DNS lookups for -addnode, -seednode and -connect.', widget: 'switch', default: '1' },
  { option: 'dnsseed', label: 'DNS Seed', description: 'Query for peer addresses via DNS lookup when low on addresses.', widget: 'switch', default: '1' },
  { option: 'externalip', label: 'External IP', description: 'Specify your own public address.', widget: 'text', default: def('') },
  { option: 'fixedseeds', label: 'Fixed Seeds', description: 'Allow fixed seeds if DNS seeds don\'t provide peers.', widget: 'switch', default: '1' },
  { option: 'forcednsseed', label: 'Force DNS Seed', description: 'Always query for peer addresses via DNS lookup.', widget: 'switch', default: '0' },
  { option: 'listen', label: 'Listen', description: 'Accept connections from outside.', widget: 'switch', default: '1' },
  { option: 'listenonion', label: 'Listen Onion', description: 'Automatically create Tor onion service.', widget: 'switch', default: '1' },
  { option: 'maxconnections', label: 'Max Connections', description: 'Maintain at most N automatic connections to peers. Does not apply to -addnode or private broadcast.', widget: 'number', default: '125', min: 0 },
  { option: 'maxreceivebuffer', label: 'Max Receive Buffer', description: 'Maximum per-connection receive buffer (×1000 bytes).', widget: 'number', default: '5000', min: 0 },
  { option: 'maxsendbuffer', label: 'Max Send Buffer', description: 'Maximum per-connection send buffer (×1000 bytes).', widget: 'number', default: '1000', min: 0 },
  { option: 'maxuploadtarget', label: 'Max Upload Target', description: 'Keep outbound traffic under target per 24h (MiB). 0 = no limit. This generator uses MiB only; Bitcoin Core also accepts suffixes k/K/m/M/g/G/t/T in config.', widget: 'number', default: '0', min: 0 },
  { option: 'onion', label: 'Onion Proxy', description: 'Separate SOCKS5 proxy for Tor onion services; -noonion to disable. Defaults to -proxy.', widget: 'text', default: def('') },
  { option: 'i2psam', label: 'I2P SAM Proxy', description: 'I2P SAM proxy to reach I2P peers and accept I2P connections.', widget: 'text', default: def('') },
  { option: 'i2pacceptincoming', label: 'I2P Accept Incoming', description: 'Accept inbound I2P connections. Ignored if -i2psam not set.', widget: 'switch', default: '1' },
  { option: 'onlynet', label: 'Only Net', description: 'Make automatic outbound connections only to network (ipv4, ipv6, onion, i2p, cjdns). This generator allows one network; Bitcoin Core allows multiple onlynet lines.', widget: 'select', default: '' },
  { option: 'v2transport', label: 'V2 Transport', description: 'Support v2 transport (BIP324).', widget: 'switch', default: '1' },
  { option: 'peerbloomfilters', label: 'Peer Bloom Filters', description: 'Support filtering of blocks and transactions with bloom filters.', widget: 'switch', default: '0' },
  { option: 'peerblockfilters', label: 'Peer Block Filters', description: 'Serve compact block filters to peers per BIP 157.', widget: 'switch', default: '0' },
  { option: 'txreconciliation', label: 'Tx Reconciliation', description: 'Enable transaction reconciliations per BIP 330.', widget: 'switch', default: '0' },
  { option: 'port', label: 'Port', description: 'Listen for connections on port. Core default is chain-specific (e.g. 8333 mainnet). 0 = use Core default. Not relevant for I2P. Onion port defaults to port+1.', widget: 'number', default: '0', min: 0 },
  { option: 'proxy', label: 'Proxy', description: 'Connect through SOCKS5 proxy; -noproxy to disable. May end in =network (ipv4, ipv6, tor, cjdns).', widget: 'text', default: def('') },
  { option: 'proxyrandomize', label: 'Proxy Randomize', description: 'Randomize credentials for every proxy connection (Tor stream isolation).', widget: 'switch', default: '1' },
  { option: 'seednode', label: 'Seed Node', description: 'Connect to a node to retrieve peer addresses and disconnect. Can be set multiple times. Tried before dnsseeds.', widget: 'textarea', default: def('') },
  { option: 'networkactive', label: 'Network Active', description: 'Enable all P2P network activity. Can be changed by setnetworkactive RPC.', widget: 'switch', default: '1' },
  { option: 'timeout', label: 'Timeout', description: 'Socket connection timeout in milliseconds before dropping an attempt (minimum 1).', widget: 'number', default: '5000', min: 1 },
  { option: 'peertimeout', label: 'Peer Timeout', description: 'Seconds of inactivity before considering disconnection (after connecting). Must be ≥ 1.', widget: 'number', default: '60', min: 1 },
  { option: 'torcontrol', label: 'Tor Control', description: 'Tor control host and port if onion listening enabled. Default port 9051 if omitted.', widget: 'text', default: '127.0.0.1:9051' },
  { option: 'torpassword', label: 'Tor Password', description: 'Tor control port password.', widget: 'password', default: def('') },
  { option: 'natpmp', label: 'NAT-PMP', description: 'Use PCP or NAT-PMP to map the listening port.', widget: 'switch', default: '0' },
  { option: 'whitebind', label: 'Whitebind', description: 'Bind to address and add permission flags for peers connecting. Permissions: bloomfilter, noban, forcerelay, relay, mempool, download, addr. Can be set multiple times.', widget: 'text', default: def('') },
  { option: 'whitelist', label: 'Whitelist', description: 'Add permission flags for peers at given IP or CIDR. Same permissions as -whitebind. Flags "in" and "out" control direction. Can be set multiple times.', widget: 'textarea', default: def('') }
]

// Node relay; order follows init.cpp OptionsCategory::NODE_RELAY
const RELAY_OPTIONS = [
  { option: 'acceptnonstdtxn', label: 'Accept Non-Standard Tx', description: 'Relay and mine "non-standard" transactions (test networks only).', widget: 'switch', default: '0' },
  { option: 'incrementalrelayfee', label: 'Incremental Relay Fee', description: 'Fee rate (BTC/kvB) for cost of relay; mempool limiting and replacement policy.', widget: 'number_float_8', default: '0.00001', min: 0 },
  { option: 'dustrelayfee', label: 'Dust Relay Fee', description: 'Fee rate (BTC/kvB) used to define dust (output that costs more than its value in fees at this rate to spend).', widget: 'number_float_8', default: '0.00001', min: 0 },
  { option: 'bytespersigop', label: 'Bytes Per Sigop', description: 'Equivalent bytes per sigop in transactions for relay and mining.', widget: 'number', default: '20', min: 0 },
  { option: 'datacarrier', label: 'Data Carrier', description: 'Relay and mine data carrier (OP_RETURN) transactions.', widget: 'switch', default: '1' },
  { option: 'datacarriersize', label: 'Data Carrier Size', description: 'Max aggregate size of data-carrying scriptPubKeys we relay and mine. Multiple outputs allowed.', widget: 'number', default: '100000', min: 0 },
  { option: 'permitbaremultisig', label: 'Permit Bare Multisig', description: 'Relay transactions creating non-P2SH multisig outputs.', widget: 'switch', default: '1' },
  { option: 'minrelaytxfee', label: 'Min Relay Tx Fee', description: 'Fees (BTC/kvB) smaller than this are zero fee for relaying, mining and transaction creation.', widget: 'number_float_8', default: '0.00001', min: 0 },
  { option: 'privatebroadcast', label: 'Private Broadcast', description: 'Broadcast sendrawtransaction RPC tx via short-lived Tor/I2P connections without putting in mempool. Wallet tx not affected.', widget: 'switch', default: '0' },
  { option: 'whitelistforcerelay', label: 'Whitelist Force Relay', description: "Add 'forcerelay' to whitelisted peers with default permissions; relay tx even if already in mempool.", widget: 'switch', default: '0' },
  { option: 'whitelistrelay', label: 'Whitelist Relay', description: "Add 'relay' to whitelisted peers; accept relayed tx even when not relaying.", widget: 'switch', default: '1' }
]

// RPC server; order follows init.cpp OptionsCategory::RPC (+ IPC)
const RPC_OPTIONS = [
  { option: 'rest', label: 'REST', description: 'Accept public REST requests.', widget: 'switch', default: '0' },
  { option: 'rpcallowip', label: 'RPC Allow IP', description: 'Allow JSON-RPC from specified source (IP, netmask, CIDR, 0.0.0.0/0, ::/0). Can be set multiple times.', widget: 'textarea', default: def('') },
  { option: 'rpcauth', label: 'RPC Auth', description: 'Username and HMAC-SHA-256 hashed password for JSON-RPC. Format: username:salt$hash. Can be set multiple times. Client uses rpcuser/rpcpassword.', widget: 'text', default: def('') },
  { option: 'rpcbind', label: 'RPC Bind', description: 'Bind to address to listen for JSON-RPC. Ignored unless -rpcallowip passed. Port optional, overrides -rpcport. Can be set multiple times.', widget: 'textarea', default: def('') },
  { option: 'rpcdoccheck', label: 'RPC Doc Check', description: 'Throw non-fatal error at runtime if RPC documentation is incorrect.', widget: 'switch', default: '0' },
  { option: 'rpccookiefile', label: 'RPC Cookie File', description: 'Location of auth cookie. Relative paths prefixed by net-specific datadir.', widget: 'text', default: '.cookie' },
  { option: 'rpccookieperms', label: 'RPC Cookie Perms', description: 'Make cookie readable by owner, group, or all.', widget: 'select', default: 'owner' },
  { option: 'rpcpassword', label: 'RPC Password', description: 'Password for JSON-RPC (legacy; prefer rpcauth).', widget: 'password', default: def('') },
  { option: 'rpcport', label: 'RPC Port', description: 'Listen for JSON-RPC on port. Varies by network.', widget: 'number', default: '8332', min: 0 },
  { option: 'rpcservertimeout', label: 'RPC Server Timeout', description: 'Timeout during HTTP requests (seconds).', widget: 'number', default: '30', min: 0 },
  { option: 'rpcthreads', label: 'RPC Threads', description: 'Number of threads to service RPC calls.', widget: 'number', default: '16', min: 0 },
  { option: 'rpcuser', label: 'RPC User', description: 'Username for JSON-RPC (legacy; prefer rpcauth).', widget: 'text', default: def('') },
  { option: 'rpcwhitelist', label: 'RPC Whitelist', description: 'Filter incoming RPC calls for a user. Format: username:rpc1,rpc2,... Multiple whitelists set-intersected. See -rpcwhitelistdefault.', widget: 'text', default: def('') },
  { option: 'rpcwhitelistdefault', label: 'RPC Whitelist Default', description: 'Default whitelist behavior. If any -rpcwhitelist: all users subject to empty-unless-specified. If 1 and none: all subject to empty.', widget: 'switch', default: '0' },
  { option: 'rpcworkqueue', label: 'RPC Work Queue', description: 'Maximum depth of work queue to service RPC calls.', widget: 'number', default: '64', min: 0 },
  { option: 'server', label: 'Server', description: 'Accept command line and JSON-RPC commands.', widget: 'switch', default: '0' },
  { option: 'ipcbind', label: 'IPC Bind', description: 'Bind to Unix socket for incoming connections. "unix" = default path, "unix:/path" = custom. Can be set multiple times.', widget: 'text', default: def('') }
]

const WALLET_OPTIONS = [
  { option: 'addresstype', label: 'Address Type', description: 'Address type for receiving (legacy, p2sh-segwit, bech32, bech32m).', widget: 'select', default: 'p2sh-segwit' },
  { option: 'avoidpartialspends', label: 'Avoid Partial Spends', description: 'Group outputs by address, selecting all or none.', widget: 'switch', default: '0' },
  { option: 'changetype', label: 'Change Address Type', description: 'Change address type (legacy, p2sh-segwit, bech32, bech32m).', widget: 'select', default: 'p2sh-segwit' },
  { option: 'consolidatefeerate', label: 'Consolidate Fee Rate', description: 'The maximum feerate (in BTC/kvB) at which transaction building may use more inputs.', widget: 'number_float_8', default: '0.0001', min: 0 },
  { option: 'disablewallet', label: 'Disable Wallet', description: 'Do not load the wallet and disable wallet RPC calls.', widget: 'switch', default: '0' },
  { option: 'keypool', label: 'Key Pool Size', description: 'Set key pool size.', widget: 'number', default: '1000', min: 0 },
  { option: 'fallbackfee', label: 'Fallback Transaction Fee', description: 'A fee rate (in BTC/kB) that will be used when fee estimation has insufficient data', widget: 'number_float_8', default: '0.0002', min: 0 },
  { option: 'discardfee', label: 'Discard Change Fee', description: 'The fee rate (in BTC/kB) that indicates your tolerance for discarding change by adding it to the fee', widget: 'number_float_8', default: '0.0001', min: 0 },
  { option: 'maxapsfee', label: 'Max Avoid Partial Spend Fee', description: 'Spend up to this amount in additional (absolute) fees (in BTC) if it allows the use of partial spend avoidance.', widget: 'number_float_8', default: '0.00', min: 0 },
  { option: 'mintxfee', label: 'Min Transaction Fee', description: 'Fee rates (in BTC/kB) smaller than this are considered zero fee for transaction creation', widget: 'number_float_8', default: '0.00001', min: 0 },
  { option: 'paytxfee', label: 'Pay Transaction Fee', description: 'Fee rate (in BTC/kB) to add to transactions you send. Not recommended to set!', widget: 'number_float_8', default: '0', min: 0 },
  { option: 'signer', label: 'Signer Command', description: 'External signing tool, see doc/external-signer.md', widget: 'text', default: def('') },
  { option: 'spendzeroconfchange', label: 'Spend Unconfirmed Change', description: 'Spend unconfirmed change when sending transactions.', widget: 'switch', default: '1' },
  { option: 'rootcertificates', label: 'Root Certificate file', description: 'Specify a custom root certificate to trust for payment requests.', widget: 'text', default: '-system-' },
  { option: 'txconfirmtarget', label: 'Transaction Fee Confirmation Target', description: 'If paytxfee is not set, include enough fee so that transactions should confirm within blocks', widget: 'number', default: '6', min: 0 },
  { option: 'unsafesqlitesync', label: 'Unsafe SQL Lite Sync', description: 'Disable waiting for the database to sync to disk. This is unsafe.', widget: 'switch', default: '0' },
  { option: 'walletrbf', label: 'Enable Replace By Fee Transactions', description: 'Send transactions with full-RBF opt-in enabled.', widget: 'switch', default: '1' },
  { option: 'wallet', label: 'Wallet Path', description: 'Specify wallet database path. Can be specified multiple times.', widget: 'text', default: def('') },
  { option: 'walletdir', label: 'Wallet Data Storage Location', description: 'Specify a non-default location to store wallet data.', widget: 'text', default: '' },
  { option: 'walletbroadcast', label: 'Broadcast Transactions', description: 'Broadcast transactions created by the wallet.', widget: 'switch', default: '1' },
  { option: 'walletnotify', label: 'Wallet Notification', description: 'Execute command when a wallet transaction changes (%s in cmd is replaced by TxID)', widget: 'text', default: def('') },
  { option: 'walletrejectlongchains', label: 'Reject Long Transaction Chains', description: 'Wallet will not create transactions that violate mempool chain limits.', widget: 'switch', default: '1' },
  { option: 'walletcrosschain', label: 'Wallet Cross Chain', description: 'Allow reusing wallet files across chains.', widget: 'switch', default: '0' }
]

const ZMQ_OPTIONS = [
  { option: 'zmqpubhashblock', label: 'Publish Block Hashes', description: 'Enable publishing of block hashes to ZMQ endpoint (e.g. tcp://127.0.0.1:28332).', widget: 'text', default: def('') },
  { option: 'zmqpubhashtx', label: 'Publish Transaction Hashes', description: 'Enable publishing of transaction hashes to ZMQ endpoint (e.g. tcp://127.0.0.1:28332).', widget: 'text', default: def('') },
  { option: 'zmqpubrawblock', label: 'Publish Raw Blocks', description: 'Enable publishing of raw block hex to ZMQ endpoint (e.g. tcp://127.0.0.1:28332).', widget: 'text', default: def('') },
  { option: 'zmqpubrawtx', label: 'Publish Raw Transactions', description: 'Enable publishing of raw transaction hex to ZMQ endpoint (e.g. tcp://127.0.0.1:28332).', widget: 'text', default: def('') },
  { option: 'zmqpubsequence', label: 'Publish Hash Block and Transaction Sequence', description: 'Enable publishing of hash block and tx sequence to ZMQ endpoint (e.g. tcp://127.0.0.1:28332).', widget: 'text', default: def('') },
  { option: 'zmqpubhashblockhwm', label: 'Publish Block Hashes High Water Mark', description: 'Set publish hash block outbound message high water mark.', widget: 'number', default: '1000', min: 0 },
  { option: 'zmqpubhashtxhwm', label: 'Publish Transaction Hashes High Water Mark', description: 'Set publish hash transaction outbound message high water mark.', widget: 'number', default: '1000', min: 0 },
  { option: 'zmqpubrawblockhwm', label: 'Publish Raw Blocks High Water Mark', description: 'Set publish raw block outbound message high water mark.', widget: 'number', default: '1000', min: 0 },
  { option: 'zmqpubrawtxhwm', label: 'Publish Raw Transactions High Water Mark', description: 'Set publish raw transaction outbound message high water mark.', widget: 'number', default: '1000', min: 0 },
  { option: 'zmqpubsequencehwm', label: 'Publish Hash Sequence Message High Water Mark', description: 'Set publish hash sequence message high water mark.', widget: 'number', default: '1000', min: 0 }
]

// Category order follows Bitcoin Core init.cpp: Options → Connection → Wallet → ZMQ → Debug → Chain → Node Relay → Block Creation → RPC
export const ALL_OPTIONS = [
  ...OPTIONS_OPTIONS,
  ...CONNECTION_OPTIONS,
  ...WALLET_OPTIONS,
  ...ZMQ_OPTIONS,
  ...DEBUG_OPTIONS,
  ...CHAIN_OPTIONS,
  ...RELAY_OPTIONS,
  ...BLOCK_CREATION_OPTIONS,
  ...RPC_OPTIONS
]

export const OPTIONS_BY_KEY = Object.fromEntries(ALL_OPTIONS.map(o => [o.option, o]))

export const CATEGORIES = [
  { id: 'options', title: 'Options', keys: OPTIONS_OPTIONS.map(o => o.option) },
  { id: 'connection', title: 'Connection', keys: CONNECTION_OPTIONS.map(o => o.option) },
  { id: 'wallet', title: 'Wallet', keys: WALLET_OPTIONS.map(o => o.option) },
  { id: 'zeromq', title: 'ZeroMQ', keys: ZMQ_OPTIONS.map(o => o.option) },
  { id: 'debugging', title: 'Debugging & Testing', keys: DEBUG_OPTIONS.map(o => o.option) },
  { id: 'chain', title: 'Chain Selection', keys: CHAIN_OPTIONS.map(o => o.option) },
  { id: 'relay', title: 'Transaction Relay', keys: RELAY_OPTIONS.map(o => o.option) },
  { id: 'blockcreation', title: 'Block Creation', keys: BLOCK_CREATION_OPTIONS.map(o => o.option) },
  { id: 'rpc', title: 'RPC API', keys: RPC_OPTIONS.map(o => o.option) }
]

/** Parse default for initial state: empty string for "omit", normalized value otherwise */
export function parseDefault (opt) {
  const d = opt.default
  if (opt.widget === 'switch') {
    if (d === '' || d === '0' || d === 'false') return false
    if (d === '1' || d === 'true') return true
    return false
  }
  if (opt.widget === 'number' || opt.widget === 'number_float_8') {
    if (d === '') return ''
    const n = Number(String(d).replace(/,.*/, '').trim())
    return isNaN(n) ? (opt.widget === 'number_float_8' ? d : '') : (opt.widget === 'number_float_8' ? String(d) : n)
  }
  if (opt.widget === 'select' && d === '') return ''
  if (opt.widget === 'multi_switch') return d === undefined || d === null ? '' : (typeof d === 'string' ? d : '')
  return d === undefined || d === null ? '' : String(d)
}

/** Build initial state from defaults */
export function getInitialState () {
  const state = {}
  ALL_OPTIONS.forEach(o => {
    state[o.option] = parseDefault(o)
  })
  return state
}
