#!/usr/bin/env python3
"""Run by EB on deployment, never by the local release builder."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

env = json.loads(subprocess.check_output([
    '/opt/elasticbeanstalk/bin/get-config', 'environment'
]))

prefix = env.get('TOR_KEYS_S3_PREFIX', '')
if not prefix.startswith('s3://'):
    raise SystemExit('Set TOR_KEYS_S3_PREFIX in EB environment configuration to s3://YOUR_PRIVATE_BUCKET/YOUR_PREFIX')

# DHI nginx runs entirely as 65532, including cache and health-log writes.
for directory in (Path('/var/cache/sn-nginx'), Path('/var/log/nginx/healthd')):
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o755)
    os.chown(directory, 65532, 65532)
keys = Path('/var/lib/sn-onion')
keys.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(keys, 0o700)
os.chown(keys, 100, 101)
# Match the debian-tor UID/GID checked by tor.Dockerfile.
state = Path('/var/lib/sn-tor')
state.mkdir(mode=0o700, parents=True, exist_ok=True)
state.chmod(0o700)
os.chown(state, 100, 101)

with tempfile.TemporaryDirectory(prefix='sn-onion-', dir='/var/lib') as directory:
    for name in ('hostname', 'hs_ed25519_public_key', 'hs_ed25519_secret_key'):
        target = Path(directory) / name
        subprocess.run(['aws', 's3', 'cp', prefix.rstrip('/') + '/' + name,
                        str(target), '--only-show-errors'], check=True)
        os.chmod(target, 0o600)
        os.chown(target, 100, 101)
        if target.stat().st_size == 0:
            raise SystemExit('Empty onion identity file: ' + name)
    if (Path(directory) / 'hostname').read_text().strip() != 'snsnsnya6h3ot563f3p566wuhfoklkg5f62hokdlaqzcaub3gf4xlxyd.onion':
        raise SystemExit('Unexpected onion hostname')
    (Path(directory) / 'hostname').write_text('snsnsnya6h3ot563f3p566wuhfoklkg5f62hokdlaqzcaub3gf4xlxyd.onion\n')
    # Validate all downloads, then replace each file atomically.
    for name in ('hostname', 'hs_ed25519_public_key', 'hs_ed25519_secret_key'):
        os.replace(Path(directory) / name, keys / name)

# The container writes the required hourly files; bound their local retention.
cleanup = Path('/etc/cron.hourly/sn-healthd-cleanup')
cleanup.write_text('#!/bin/sh\nfind /var/log/nginx/healthd -type f -name "application.log.*" -mmin +1440 -delete\n')
cleanup.chmod(0o755)
