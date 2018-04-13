# Streamy

## Installation

### Ubunu 16.04

#### Nodejs
Install latest version of node (right now it's 8)
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Run `node -v` to check the installation

#### MySQL / MariaDB
docker run -it --rm --name streamy-mariadb -e MYSQL_PASSWORD=pwd -e MYSQL_DATABASE=streamy -e MYSQL_ROOT_PASSWORD=pwd -e MYSQL_USER=streamy -e MYSQL_ROOT_PASSWORD=pwd -v /media/michael/Data1/tmp/mariadb/data:/var/lib/mysql -p 3306:3306 mariadb:10.0 --port 3306

CLient:
mysql -u root -p -h 127.0.0.1
show databases;
use streamy;
show tables;

#### Some Notes
http://expressjs.com/fr/advanced/best-practice-security.html

## TODO
- Limit auth access rate (brute force multi ips)
- Store hashed password
- Multilang support i18n

 npm install consolidate mustache
 https://phraseapp.com/blog/posts/node-js-i18n-guide/



