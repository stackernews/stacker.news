#!/bin/sh
set -eu
umask 077
expected=snsnsnya6h3ot563f3p566wuhfoklkg5f62hokdlaqzcaub3gf4xlxyd.onion
# Let Tor validate a disposable copy offline, including the secret/public pair.
# It may repair damaged keys; never accept or install such replacements.
check_dir=$(mktemp -d)
check_pid=
cleanup() {
  if [ -n "$check_pid" ]; then
    kill "$check_pid" 2>/dev/null || true
    wait "$check_pid" 2>/dev/null || true
  fi
  rm -rf "$check_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
install -d -m 700 "$check_dir/sn"
install -m 600 /dev/null "$check_dir/torrc"
for file in hostname hs_ed25519_public_key hs_ed25519_secret_key; do
  test -s "/run/sn-onion/$file" || { echo "Missing existing onion identity: $file" >&2; exit 1; }
done
test "$(cat /run/sn-onion/hostname)" = "$expected" || {
  echo 'Unexpected onion identity' >&2; exit 1;
}
for file in hs_ed25519_public_key hs_ed25519_secret_key; do
  install -m 600 "/run/sn-onion/$file" "$check_dir/sn/$file"
done
tor -f "$check_dir/torrc" --DataDirectory "$check_dir" \
  --HiddenServiceDir "$check_dir/sn" --HiddenServicePort '80 127.0.0.1:8081' \
  --SocksPort 0 --DisableNetwork 1 --RunAsDaemon 0 --Log 'warn stdout' &
check_pid=$!
attempt=0
until test -s "$check_dir/sn/hostname"; do
  if ! kill -0 "$check_pid" 2>/dev/null || [ "$attempt" -ge 100 ]; then
    echo 'Unable to validate onion keys' >&2; exit 1
  fi
  attempt=$((attempt + 1))
  sleep 0.1
done
kill "$check_pid"
wait "$check_pid" || test "$?" -eq 143
check_pid=
test "$(cat "$check_dir/sn/hostname")" = "$expected" || {
  echo 'Onion keys do not match the expected hostname' >&2; exit 1;
}
for file in hs_ed25519_public_key hs_ed25519_secret_key; do
  cmp -s "/run/sn-onion/$file" "$check_dir/sn/$file" || {
    echo "Tor replaced an invalid onion key: $file" >&2; exit 1;
  }
done
install -d -m 700 /var/lib/tor/sn
for file in hostname hs_ed25519_public_key hs_ed25519_secret_key; do
  install -m 600 "$check_dir/sn/$file" "/var/lib/tor/sn/$file"
done
cleanup
trap - EXIT HUP INT TERM
cat > /var/lib/tor/torrc <<'EOF'
DataDirectory /var/lib/tor
SocksPort 0
HTTPTunnelPort 0.0.0.0:7050
Log notice stdout
RunAsDaemon 0
HiddenServiceDir /var/lib/tor/sn
HiddenServicePort 80 nginx:8081
EOF
exec tor -f /var/lib/tor/torrc "$@"
