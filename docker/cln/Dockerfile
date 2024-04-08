FROM polarlightning/clightning:23.08

RUN apt-get update -y \
  && apt-get install -y jq \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY ["./hsm_secret", "/home/clightning/.lightning/regtest/hsm_secret"]