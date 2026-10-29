FROM dhi.io/debian-base:trixie@sha256:2664ef25f3f63f5545a121a6a4676bf70da18df2bcadece1a913d6daaa19fdfb AS runtime

FROM dhi.io/debian-base:trixie-dev@sha256:cc4e05ff415ee2d83918f2af45c737983209924ef7362c53f00cfcdaa1c94326 AS builder
# Debian's Tor installer expects this group and service-management tools.
# They stay in the builder along with apt, dpkg, and the other install dependencies.
RUN printf 'adm:x:4:\n' >> /etc/group \
    && apt-get update && apt-get install -y --no-install-recommends tor init-system-helpers \
    && rm -rf /var/lib/apt/lists/*

# Keep the runtime's DHI libraries; add only the missing Tor libraries and cmp.
# Retain package versions and licenses for the components copied into the image.
COPY --from=runtime /var/lib/dpkg/status /out/var/lib/dpkg/status
RUN set -eu; mkdir -p /out/usr/bin \
    && cp /usr/bin/tor /usr/bin/cmp /out/usr/bin/ \
    && cp -a --parents /usr/lib/*-linux-gnu/libevent-2.1.so.* \
        /usr/lib/*-linux-gnu/liblzma.so.* /usr/lib/*-linux-gnu/libseccomp.so.* /out/ \
    && for package in tor diffutils libevent-2.1-7t64 liblzma5 libseccomp2; do \
        printf '\n' >> /out/var/lib/dpkg/status; \
        dpkg-query -s "$package" >> /out/var/lib/dpkg/status; \
        cp -a --parents "/usr/share/doc/$package/copyright" /out/; \
    done

FROM runtime
USER 0:0
COPY --from=builder /out/ /
# Match the existing EB key/state ownership without importing builder accounts.
RUN printf 'debian-tor:x:100:101::/var/lib/tor:/bin/false\n' >> /etc/passwd \
    && printf 'debian-tor:x:101:\n' >> /etc/group
COPY --chmod=755 tor-entrypoint.sh /usr/local/bin/sn-tor
USER debian-tor
RUN test "$(id -u)" = 100 && test "$(id -g)" = 101 \
    && tor --version && cmp /dev/null /dev/null
ENTRYPOINT ["/usr/local/bin/sn-tor"]
