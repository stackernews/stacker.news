FROM opensearchproject/opensearch:2.17.0

USER root
RUN yum install -y jq && \
    yum clean all && \
    rm -rf /var/cache/yum

USER opensearch