---
title: Official Alby Hub Guide
id: ???
sub: meta
---

# Official Alby Hub Guide

last updated: September 10, 2025

Flavors:

- [Desktop](#setup-alby-hub-desktop)
- [Server](#setup-alby-hub-server)

## Setup Alby Hub Desktop

1. Download the latest Alby Hub Desktop release from Github [here](https://github.com/getAlby/hub/releases)
2. Run Alby Hub Desktop

It is recommended to use an always-on device, as receiving payments would fail otherwise.

see [official documentation](https://guides.getalby.com/user-guide/alby-hub/alby-hub-flavors/desktop)

Now you can attach [send](#attach-send) and/or [receive](#attach-receive)

## Setup Alby Hub Server

Requirements:
- a server running a Linux-based distribution or macOS
- reachable from the internet via clearnet and HTTPS

Choose a path:
- [Quickstart](#quickstart) (only Linux)
- [Manual](#manual)
- [Docker](#docker)

### Quickstart

1. Follow the Quick start script provided by Alby [here](https://github.com/getAlby/hub?tab=readme-ov-file#from-the-release)
2. Visit the Web UI at `ip:8080` or `ip:8029` (if installed as a service) to continue setup

### Docker

1. Pull the image from Docker:

```bash
$ docker run -v .albyhub-data:/data -e WORK_DIR='/data' -p 8080:8080 ghcr.io/getalby/hub:latest
```

2. Visit the Web UI at `ip:8080` to continue setup

### Manual

1. Download the latest Alby Hub Server release for your processor from Github [here](https://github.com/getAlby/hub/releases)
2. Extract it to a folder of your choice, we'll go with `albyhub`, and navigate to it
3. Create a `data` folder in `albyhub`: `mkdir -p data`
4. Create a `start.sh` script in `albyhub`

```bash
WORK_DIR="dir/to/albyhub/data" LDK_GOSSIP_SOURCE="" dir/to/albyhub/bin/albyhub
```

5. Now you can either [install it as a service](#install-as-a-systemd-service-optional) or run it via `./start.sh`
6. Visit the Web UI at `ip:8080` or `ip:PORT` (if installed as a service) to continue setup

Now you can attach [send](#attach-send) and/or [receive](#attach-receive)

#### Install as a systemd service (optional)

This focuses on **systemd** for Linux systems.

macOS uses **launchd** to handle services, you can follow [this really good guide](https://nathangrigg.com/2012/07/schedule-jobs-using-launchd/) to mirror what we're going to do here.

1. Open with your editor of choice `/etc/systemd/system/albyhub.service`
2. Populate:

```ini
[Unit]
Description=Alby Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=1
User=$USER
ExecStart=dir/to/albyhub/start.sh
Environment="PORT=8029"

[Install]
WantedBy=multi-user.target
```

3. `sudo systemctl enable albyhub`
4. `sudo systemctl start albyhub`


## Attach send

1. Navigate to the Connections tab in Alby Hub
2. Create a Full Access connection and press Next

![](https://m.stacker.news/107521)

3. Copy the Nostr Wallet Connect URL via the apposited button

![](https://m.stacker.news/107519)

4. Paste the copied NWC URL in the NWC send step of the Alby Hub wallet attachment on SN
5. Press **next**

## Attach receive

1. Navigate to the Connections tab in Alby Hub
2. Create a Read Only connection and press Next

![](https://m.stacker.news/107520)

3. Copy the Nostr Wallet Connect URL via the apposited button

![](https://m.stacker.news/107519)

4. Paste the copied NWC URL in the NWC receive step of the Alby Hub wallet attachment on SN
5. Press **next**
