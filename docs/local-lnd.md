# Local LND

To also work with wallet functionality, you need a local running LND node.

1. Download the AppImage for [polar](https://lightningpolar.com/) and run it.
2. Create a lightning network with one LND node and one Bitcoin Core node.
3. Start the network
4. Click on the LND node and make sure status is green
5. Go to "Connect" > "Hex"
6. Copy TLS cert and admin macaroon in hex into your env file
7. Create the network `stackernews_default` if it is not created yet. It is automatically created when running `docker-compose up`:

```
$ docker network create stackernews_default
Error response from daemon: network with name stackernews_default already exists
$ docker network inspect stackernews_default
[
    {
        "Name": "stackernews_default",
        "Id": "2a5b089fb0f6f71f98c0f434f58cb368568227ced489c490d09cea3f63973a2a",
        "Created": "2023-05-17T02:04:06.302835394+02:00",
        "Scope": "local",
        "Driver": "bridge",
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": null,
            "Config": [
                {
                    "Subnet": "192.168.128.0/20",
                    "Gateway": "192.168.128.1"
                }
            ]
        },
        "Internal": false,
        "Attachable": false,
        "Ingress": false,
        "ConfigFrom": {
            "Network": ""
        },
        "ConfigOnly": false,
        "Containers": {},
        "Options": {},
        "Labels": {
            "com.docker.compose.network": "default",
            "com.docker.compose.project": "stackernews",
            "com.docker.compose.version": "2.17.3"
        }
    }
]
```

8. Run `docker ps` and find the container name and GRPC container port of the LND node:

```
$ docker ps
CONTAINER ID   IMAGE                            COMMAND                  CREATED          STATUS          PORTS                                                                                                                                                                                        NAMES
eb3480c0d0c4   polarlightning/lnd:0.16.0-beta   "/entrypoint.sh lnd …"   8 minutes ago    Up 8 minutes    0.0.0.0:9735->9735/tcp, :::9735->9735/tcp, 10000/tcp, 0.0.0.0:8081->8080/tcp, :::8081->8080/tcp, 0.0.0.0:10001->10009/tcp, :::10001->10009/tcp                                               polar-n1-alice
e0635bff36ba   polarlightning/bitcoind:24.0     "/entrypoint.sh bitc…"   8 minutes ago    Up 8 minutes    0.0.0.0:18443->18443/tcp, :::18443->18443/tcp, 0.0.0.0:28334->28334/tcp, :::28334->28334/tcp, 0.0.0.0:19444->18444/tcp, :::19444->18444/tcp, 0.0.0.0:29335->28335/tcp, :::29335->28335/tcp   polar-n1-backend1
```

Here, it is `polar-n1-alice` and port is 10009 (**not 10001, that's the host port**).

9. Add the container to the network `stackernews_default`:

```
$ docker network connect stackernews_default polar-n1-alice
$ docker network inspect stackernews_default
[
    {
        "Name": "stackernews_default",
        "Id": "2e1bc3297c95073dc3723051144587a8431f242d031fce2c27ec13be948783ec",
        "Created": "2023-05-17T02:40:57.605076983+02:00",
        "Scope": "local",
        "Driver": "bridge",
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": {},
            "Config": [
                {
                    "Subnet": "192.168.192.0/20",
                    "Gateway": "192.168.192.1"
                }
            ]
        },
        "Internal": false,
        "Attachable": false,
        "Ingress": false,
        "ConfigFrom": {
            "Network": ""
        },
        "ConfigOnly": false,
        "Containers": {
            "eb3480c0d0c4452cfe5cb94da6cb81a060d5a6db45526e15b960adbb01064930": {
                "Name": "polar-n1-alice",
                "EndpointID": "421462516a1d858f856ef5af0e677063b35777fe8b24134e129b82c889ef51d1",
                "MacAddress": "02:42:c0:a8:c0:02",
                "IPv4Address": "192.168.192.2/20",
                "IPv6Address": ""
            }
        },
        "Options": {},
        "Labels": {}
    }
]
```

10. Set `LND_SOCKET` to `<container_name>:<grpc_container_port>`.
    Make sure to use the container name as found in the output of `docker ps` or `docker network inspect`. **IPs do not work!**
11. Run `docker-compose up --build`
12. You should now see all four containers in the `stackernews_default` network:

```
$ docker network inspect stackernews_default
[
    {
        "Name": "stackernews_default",
        "Id": "2e1bc3297c95073dc3723051144587a8431f242d031fce2c27ec13be948783ec",
        "Created": "2023-05-17T02:40:57.605076983+02:00",
        "Scope": "local",
        "Driver": "bridge",
        "EnableIPv6": false,
        "IPAM": {
            "Driver": "default",
            "Options": {},
            "Config": [
                {
                    "Subnet": "192.168.192.0/20",
                    "Gateway": "192.168.192.1"
                }
            ]
        },
        "Internal": false,
        "Attachable": false,
        "Ingress": false,
        "ConfigFrom": {
            "Network": ""
        },
        "ConfigOnly": false,
        "Containers": {
            "97977685f6c3dfa74b37406a300a97dc188b32c248dd0f7d127804c4f5028d47": {
                "Name": "db",
                "EndpointID": "5c6307e5cf70108ac37965730180ae1ecadd39673c58146b0755fecea9964391",
                "MacAddress": "02:42:c0:a8:c0:03",
                "IPv4Address": "192.168.192.3/20",
                "IPv6Address": ""
            },
            "b8b48fd9c6464d70e4ab0140102be233ade57d3898a00572eb261469b3a510f8": {
                "Name": "worker",
                "EndpointID": "cdb488fec12b127e502326bbfafbde4704ed26faf70a9ca76db9ae8fa480a487",
                "MacAddress": "02:42:c0:a8:c0:05",
                "IPv4Address": "192.168.192.5/20",
                "IPv6Address": ""
            },
            "eb3480c0d0c4452cfe5cb94da6cb81a060d5a6db45526e15b960adbb01064930": {
                "Name": "polar-n1-alice",
                "EndpointID": "421462516a1d858f856ef5af0e677063b35777fe8b24134e129b82c889ef51d1",
                "MacAddress": "02:42:c0:a8:c0:02",
                "IPv4Address": "192.168.192.2/20",
                "IPv6Address": ""
            },
            "fe8be23961026e0fc264e384e8f3715956cb0b947d6b9925f71f1071dc07c402": {
                "Name": "app",
                "EndpointID": "660c360c4750a69c1f77eb40c510b3cc679bb1ae4442f648d41c40402abb5f85",
                "MacAddress": "02:42:c0:a8:c0:04",
                "IPv4Address": "192.168.192.4/20",
                "IPv6Address": ""
            }
        },
        "Options": {},
        "Labels": {}
    }
]
```

13. Watch logs of app container for "LND GRPC connection error" or "LND GRPC connection successful"
