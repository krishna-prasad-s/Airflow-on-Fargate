FROM apache/airflow:2.4.3

ENV AIRFLOW_HOME=/usr/local/airflow

USER root

RUN apt-get update && apt-get install -y python3-pip \
    libcurl4-gnutls-dev \
    librtmp-dev \
    python3-dev \
    libpq-dev 

USER airflow
RUN pip install --no-cache-dir PyGreSQL argcomplete pycurl pgdb
USER root

COPY ./config/* /
COPY ./dags ${AIRFLOW_HOME}/dags

RUN chown -R airflow: ${AIRFLOW_HOME}

EXPOSE 8080

USER airflow

WORKDIR ${AIRFLOW_HOME}

# ENTRYPOINT ["/entrypoint.sh"]