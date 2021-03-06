FROM node:10.13.0
RUN apt-get update && apt-get -y install cron

WORKDIR /app
COPY src /app/src
COPY index.js /app/
COPY package.json /app
COPY keys.json /app
COPY run.sh /app
RUN chmod 0555 /app/run.sh

RUN npm install

# Crontab set up
COPY crontab /etc/cron.d/sherlock-cron
RUN chmod 0644 /etc/cron.d/sherlock-cron
RUN touch /var/log/cron.log

CMD cron && tail -f /var/log/cron.log
